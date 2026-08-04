import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import database from '../src/config/database.js';
import { initializeDatabase, createTables } from '../src/config/initDb.js';
import { saveConnection, listConnections } from '../src/services/githubService.js';

/**
 * M2.11.1 — schema rebuild migration. Existing production DBs carry
 * UNIQUE(user_id) on github_connections and a user_id-keyed github_profiles;
 * createTables() must rebuild both WITHOUT losing a single connection field
 * (tokens, expiries, preference) and stay idempotent afterwards.
 */

async function createUser() {
  const uuid = crypto.randomUUID();
  const result = await database.run(
    'INSERT INTO users (uuid, email, credits) VALUES (?, ?, 0)',
    [uuid, `${uuid}@test.com`]
  );
  return result.id;
}

describe('M2.11 schema migration', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    await database.close(); // fresh in-memory connection for test isolation
    await initializeDatabase();
  });

  it('rebuilds a pre-M2.11 schema preserving every connection field', async () => {
    const userId = await createUser();

    // Recreate the exact pre-M2.11 shapes: single-account UNIQUE(user_id)
    // connections (M2.9 columns appended, as ALTER did) and user-keyed profiles.
    await database.run('DROP TABLE github_profiles');
    await database.run('DROP TABLE github_connections');
    await database.run(`CREATE TABLE github_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      github_login TEXT,
      encrypted_token TEXT NOT NULL,
      scopes TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      encrypted_refresh_token TEXT,
      token_expires_at TEXT,
      refresh_token_expires_at TEXT,
      include_private INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
    await database.run(`CREATE TABLE github_profiles (
      user_id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await database.run(
      `INSERT INTO github_connections
         (id, user_id, github_login, encrypted_token, scopes, connected_at,
          encrypted_refresh_token, token_expires_at, refresh_token_expires_at, include_private)
       VALUES (7, ?, 'octocat', 'enc_token', 'repo,read:user', '2026-01-01 00:00:00',
               'enc_refresh', '2026-08-04T08:00:00Z', '2027-01-01T00:00:00Z', 1)`,
      [userId]
    );
    await database.run(
      "INSERT INTO github_profiles (user_id, data, fetched_at) VALUES (?, '{}', '2026-08-01T00:00:00Z')",
      [userId]
    );
    // A pre-M2.11 summary row (no connection_id yet) for the backfill check.
    await database.run(
      `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary)
       VALUES (?, 'R_mig', 'mig', '2026-01-01T00:00:00Z', '{}')`,
      [userId]
    );
    await database.run(
      'UPDATE github_repo_summaries SET connection_id = NULL WHERE repo_id = ?',
      ['R_mig']
    );

    await createTables(); // runs the M2.11 rebuild

    // New schema in place…
    const cols = await database.all('PRAGMA table_info(github_connections)');
    assert.ok(cols.some((c) => c.name === 'github_account_id'), 'account id column added');

    // …every field of the live row preserved, including the row id…
    const row = await database.get('SELECT * FROM github_connections WHERE user_id = ?', [userId]);
    assert.equal(Number(row.id), 7, 'row id preserved (profiles/summaries reference it)');
    assert.equal(row.github_login, 'octocat');
    assert.equal(row.encrypted_token, 'enc_token');
    assert.equal(row.scopes, 'repo,read:user');
    assert.equal(row.connected_at, '2026-01-01 00:00:00');
    assert.equal(row.encrypted_refresh_token, 'enc_refresh');
    assert.equal(row.token_expires_at, '2026-08-04T08:00:00Z');
    assert.equal(row.refresh_token_expires_at, '2027-01-01T00:00:00Z');
    assert.equal(Number(row.include_private), 1);
    assert.equal(row.github_account_id, null, 'legacy rows have no account id yet');

    // …the single-account UNIQUE(user_id) constraint is gone…
    await saveConnection(userId, { token: 'ghp_second', login: 'work', scopes: '', accountId: '222' });
    assert.equal((await listConnections(userId)).length, 2, 'second account now allowed');

    // …profiles re-keyed per connection (disposable cache dropped)…
    const profCols = await database.all('PRAGMA table_info(github_profiles)');
    assert.ok(profCols.some((c) => c.name === 'connection_id'));
    const profiles = await database.all('SELECT 1 FROM github_profiles');
    assert.equal(profiles.length, 0, 'old user-keyed cache rows dropped');

    // …and the legacy summary row backfilled to the surviving connection.
    const summary = await database.get(
      'SELECT connection_id FROM github_repo_summaries WHERE repo_id = ?',
      ['R_mig']
    );
    assert.equal(Number(summary.connection_id), 7);
  });

  it('createTables stays idempotent after the rebuild', async () => {
    await createTables();
    await createTables();
    const rows = await database.all('SELECT id FROM github_connections');
    assert.ok(rows.length >= 1, 'connections still present after repeated init');
  });
});
