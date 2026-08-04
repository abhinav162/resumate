import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import githubRouter from '../src/routes/github.js';

/**
 * M2.11.4 — OAuth callback redirect decisions. With "Request user
 * authorization (OAuth) during installation" enabled, GitHub redirects the
 * user to the callback after installing/configuring repo access with
 * setup_action (+ installation_id, sometimes a code) but NO state — that must
 * land softly on the access tab, not flash "connection failed".
 *
 * The handler is pulled straight off the router so the fallback paths (which
 * never touch the DB or the network) can be exercised without an HTTP server.
 */

function callbackHandler() {
  const layer = githubRouter.stack.find((l) => l.route?.path === '/callback');
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle; // last layer = the async handler
}

function mockRes() {
  const res = { redirectedTo: null };
  res.redirect = (url) => {
    res.redirectedTo = url;
  };
  return res;
}

describe('GET /api/github/callback redirect decisions', () => {
  before(() => {
    process.env.FRONTEND_URL = 'https://app.test';
    // requireGithubConfig guarantees this in production before the handler
    // runs; verifyState needs it to evaluate (and reject) a forged state.
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  beforeEach(() => {
    // None of these paths may hit GitHub — fail loudly if one does.
    global.fetch = () => {
      throw new Error('callback fallback paths must not call fetch');
    };
  });

  it('post-install redirect (setup_action, no state) lands on the access tab', async () => {
    const res = mockRes();
    await callbackHandler()(
      { query: { setup_action: 'update', installation_id: '12345' } },
      res
    );
    assert.equal(res.redirectedTo, 'https://app.test/github?tab=access&github=installed');
  });

  it('post-install redirect with a code but no state still lands softly (code discarded)', async () => {
    const res = mockRes();
    await callbackHandler()(
      { query: { code: 'abc123', setup_action: 'install', installation_id: '12345' } },
      res
    );
    assert.equal(res.redirectedTo, 'https://app.test/github?tab=access&github=installed');
  });

  it("an org-member's access REQUEST lands with the pending flash, not the success one", async () => {
    const res = mockRes();
    await callbackHandler()(
      { query: { setup_action: 'request', installation_id: '12345' } },
      res
    );
    assert.equal(
      res.redirectedTo,
      'https://app.test/github?tab=access&github=requested',
      'nothing is installed until an org owner approves — the flash must say so'
    );
  });

  it('a tampered state with setup_action still lands softly', async () => {
    const res = mockRes();
    await callbackHandler()(
      { query: { code: 'abc123', state: 'forged.state', setup_action: 'update' } },
      res
    );
    assert.equal(res.redirectedTo, 'https://app.test/github?tab=access&github=installed');
  });

  it('a plain bad request (no code/state/setup_action) still flashes the error', async () => {
    const res = mockRes();
    await callbackHandler()({ query: {} }, res);
    assert.equal(res.redirectedTo, 'https://app.test/dashboard?github=error');
  });
});
