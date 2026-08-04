import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { githubWebhookHandler } from '../src/routes/githubWebhook.js';
import { saveConnection, getConnection, listConnections } from '../src/services/githubService.js';

const SECRET = 'whsec_test_secret';

// ---------------------------------------------------------------------------
// Request/response fakes — the handler only touches headers, body (Buffer),
// res.status().json().
// ---------------------------------------------------------------------------

function sign(rawBody, secret = SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

let deliveryCounter = 0;

function makeReq(event, payload, { deliveryId, signature } = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    body,
    headers: {
      'x-github-event': event,
      'x-github-delivery': deliveryId ?? `delivery-${++deliveryCounter}`,
      'x-hub-signature-256': signature ?? sign(body),
    },
  };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

async function createUser() {
  const uuid = crypto.randomUUID();
  const result = await database.run(
    'INSERT INTO users (uuid, email, credits) VALUES (?, ?, 0)',
    [uuid, `${uuid}@test.com`]
  );
  return result.id;
}

describe('githubWebhookHandler', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    await database.close(); // fresh in-memory connection for test isolation
    await initializeDatabase();
  });

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  });

  it('returns 503 when no webhook secret is configured', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const res = mockRes();
    await githubWebhookHandler(makeReq('installation', { action: 'created' }), res);
    assert.equal(res.statusCode, 503);
  });

  it('rejects an invalid signature with 401 and processes nothing', async () => {
    const req = makeReq('installation', {
      action: 'created',
      installation: { id: 999, account: { login: 'evil', type: 'Organization' } },
    });
    req.headers['x-hub-signature-256'] = sign(req.body, 'wrong_secret');
    const res = mockRes();

    await githubWebhookHandler(req, res);

    assert.equal(res.statusCode, 401);
    const row = await database.get(
      'SELECT 1 FROM github_app_installations WHERE installation_id = ?',
      ['999']
    );
    assert.equal(row, null, 'unverified payloads must never reach handlers');
  });

  it('returns 400 for malformed JSON that passes the signature check', async () => {
    const body = Buffer.from('not-json{');
    const res = mockRes();
    await githubWebhookHandler(
      {
        body,
        headers: {
          'x-github-event': 'installation',
          'x-github-delivery': 'delivery-malformed',
          'x-hub-signature-256': sign(body),
        },
      },
      res
    );
    assert.equal(res.statusCode, 400);
  });

  it('github_app_authorization revoked purges the connection but keeps summaries', async () => {
    const userId = await createUser();
    await saveConnection(userId, { token: 'ghp_x', login: 'revoker', scopes: '' });
    await database.run(
      'INSERT INTO github_profiles (user_id, data, fetched_at) VALUES (?, ?, ?)',
      [userId, '{}', new Date().toISOString()]
    );
    await database.run(
      `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary)
       VALUES (?, 'R_paid', 'paid', '2026-01-01T00:00:00Z', '{}')`,
      [userId]
    );
    const res = mockRes();

    await githubWebhookHandler(
      makeReq('github_app_authorization', { action: 'revoked', sender: { login: 'revoker' } }),
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(await getConnection(userId), null, 'connection purged');
    const profile = await database.get('SELECT 1 FROM github_profiles WHERE user_id = ?', [userId]);
    assert.equal(profile, null, 'profile cache purged');
    const summary = await database.get(
      'SELECT 1 FROM github_repo_summaries WHERE user_id = ?',
      [userId]
    );
    assert.ok(summary, 'paid summaries survive revocation');
  });

  // M2.11 — revocation is per GitHub account: the numeric sender id is the
  // key (stable across renames) and the user's OTHER accounts must survive.
  it('revoked matches by account id and removes only that account', async () => {
    const userId = await createUser();
    await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
    await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });
    const res = mockRes();

    await githubWebhookHandler(
      makeReq('github_app_authorization', {
        action: 'revoked',
        // Renamed on GitHub since connecting — only the id still matches.
        sender: { id: 111, login: 'personal-renamed' },
      }),
      res
    );

    assert.equal(res.statusCode, 200);
    const conns = await listConnections(userId);
    assert.equal(conns.length, 1, 'exactly one connection revoked');
    assert.equal(conns[0].login, 'workcat', 'the other account survives');
  });

  it('installation lifecycle: created upserts, suspend flags, deleted removes', async () => {
    const inst = { id: 555, account: { login: 'acme', type: 'Organization' } };
    const res = mockRes();

    await githubWebhookHandler(makeReq('installation', { action: 'created', installation: inst }), res);
    let row = await database.get(
      'SELECT account_login, suspended FROM github_app_installations WHERE installation_id = ?',
      ['555']
    );
    assert.equal(row.account_login, 'acme');
    assert.equal(Number(row.suspended), 0);

    await githubWebhookHandler(makeReq('installation', { action: 'suspend', installation: inst }), mockRes());
    row = await database.get(
      'SELECT suspended FROM github_app_installations WHERE installation_id = ?',
      ['555']
    );
    assert.equal(Number(row.suspended), 1, 'suspend flags the installation');

    await githubWebhookHandler(makeReq('installation', { action: 'unsuspend', installation: inst }), mockRes());
    row = await database.get(
      'SELECT suspended FROM github_app_installations WHERE installation_id = ?',
      ['555']
    );
    assert.equal(Number(row.suspended), 0, 'unsuspend clears the flag');

    await githubWebhookHandler(makeReq('installation', { action: 'deleted', installation: inst }), mockRes());
    row = await database.get(
      'SELECT 1 FROM github_app_installations WHERE installation_id = ?',
      ['555']
    );
    assert.equal(row, null, 'deleted removes the row');
  });

  it('duplicate delivery ids are acknowledged but not re-processed', async () => {
    const inst = { id: 777, account: { login: 'dupes', type: 'Organization' } };
    await githubWebhookHandler(
      makeReq('installation', { action: 'suspend', installation: inst }, { deliveryId: 'dup-1' }),
      mockRes()
    );

    // Same delivery id replayed with a contradictory action — must be ignored.
    const res = mockRes();
    await githubWebhookHandler(
      makeReq('installation', { action: 'unsuspend', installation: inst }, { deliveryId: 'dup-1' }),
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.duplicate, true);
    const row = await database.get(
      'SELECT suspended FROM github_app_installations WHERE installation_id = ?',
      ['777']
    );
    assert.equal(Number(row.suspended), 1, 'replayed delivery must not mutate state');
  });

  it('installation events clear cached profiles so listings rebuild', async () => {
    const userId = await createUser();
    await database.run(
      'INSERT INTO github_profiles (user_id, data, fetched_at) VALUES (?, ?, ?)',
      [userId, '{}', new Date().toISOString()]
    );

    await githubWebhookHandler(
      makeReq('installation_repositories', { action: 'added', installation: { id: 888 } }),
      mockRes()
    );

    const row = await database.get('SELECT 1 FROM github_profiles WHERE user_id = ?', [userId]);
    assert.equal(row, null, 'profile cache cleared after repo-access change');
  });

  it('unknown events are acknowledged with 200', async () => {
    const res = mockRes();
    await githubWebhookHandler(makeReq('push', { ref: 'refs/heads/main' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.received, true);
  });
});
