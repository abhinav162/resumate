import crypto from 'node:crypto';
import database from '../config/database.js';

/**
 * GitHub App webhook receiver (M2.10.3).
 *
 * Mounted with express.raw() BEFORE express.json() (see server.js) so req.body
 * is the raw Buffer required for HMAC verification — a payload is never parsed
 * before its signature checks out.
 *
 * Handled events:
 * - github_app_authorization (action=revoked): the user revoked the app on
 *   GitHub — purge their connection + profile cache immediately so we stop
 *   calling the API on their behalf (paid repo summaries are kept).
 * - installation (created/deleted/suspend/unsuspend/...): mirror into
 *   github_app_installations; repo visibility may have changed, so cached
 *   profiles are cleared and rebuild lazily on the next request.
 * - installation_repositories (added/removed): clear cached profiles.
 *
 * Deliveries are deduped on X-GitHub-Delivery (GitHub is at-least-once) and
 * every handler is an idempotent upsert/delete, so duplicate and out-of-order
 * arrivals are harmless. Unknown events are acknowledged with 200 and ignored.
 */

function verifySignature(rawBody, signature, secret) {
  if (!signature || typeof signature !== 'string' || !signature.startsWith('sha256=')) {
    return false;
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Coarse but safe: installation-level changes can affect any user in the
// account, and profiles rebuild lazily (24h TTL cache) on the next request.
function clearProfileCaches() {
  return database.run('DELETE FROM github_profiles');
}

async function handleAuthorizationRevoked(payload) {
  const login = payload?.sender?.login;
  if (!login) return;
  const rows = await database.all(
    'SELECT user_id FROM github_connections WHERE github_login = ?',
    [login]
  );
  for (const row of rows) {
    await database.run('DELETE FROM github_connections WHERE user_id = ?', [row.user_id]);
    await database.run('DELETE FROM github_profiles WHERE user_id = ?', [row.user_id]);
  }
}

async function handleInstallation(payload) {
  const inst = payload?.installation;
  if (!inst?.id) return;
  const id = String(inst.id);
  if (payload.action === 'deleted') {
    await database.run('DELETE FROM github_app_installations WHERE installation_id = ?', [id]);
  } else {
    const suspended = payload.action === 'suspend' || Boolean(inst.suspended_at);
    await database.run(
      `INSERT INTO github_app_installations (installation_id, account_login, account_type, suspended, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(installation_id) DO UPDATE SET
         account_login = excluded.account_login,
         account_type = excluded.account_type,
         suspended = excluded.suspended,
         updated_at = excluded.updated_at`,
      [id, inst.account?.login ?? null, inst.account?.type ?? null, suspended ? 1 : 0]
    );
  }
  await clearProfileCaches();
}

export async function githubWebhookHandler(req, res) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: 'GitHub webhooks not configured' });
  }

  if (!verifySignature(req.body, req.headers['x-hub-signature-256'], secret)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  // Parse only after the signature is valid.
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ success: false, message: 'Malformed JSON' });
  }

  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  // Idempotency — GitHub delivers at-least-once; INSERT-OR-IGNORE swallows
  // duplicate delivery ids atomically.
  if (deliveryId) {
    const result = await database.run(
      'INSERT OR IGNORE INTO github_webhook_deliveries (delivery_id, event) VALUES (?, ?)',
      [deliveryId, event ?? null]
    );
    if (result.changes === 0) {
      return res.json({ received: true, duplicate: true });
    }
  }

  try {
    if (event === 'github_app_authorization' && payload.action === 'revoked') {
      await handleAuthorizationRevoked(payload);
    } else if (event === 'installation') {
      await handleInstallation(payload);
    } else if (event === 'installation_repositories') {
      await clearProfileCaches();
    }
    // Everything else: acknowledge and ignore.
  } catch (err) {
    // Log but still 200 — GitHub only retries on non-2xx/timeouts, and since
    // handlers are idempotent a retry storm buys nothing over the next
    // legitimate event or lazy cache rebuild.
    console.error('GitHub webhook handling error:', err);
  }

  res.json({ received: true });
}
