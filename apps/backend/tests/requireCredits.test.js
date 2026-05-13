import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { requireCredits } from '../src/middleware/requireCredits.js';

describe('requireCredits middleware', () => {
  let userId;

  before(async () => {
    process.env.DB_PATH = ':memory:';
    await database.close(); // Ensure fresh connection for test isolation
    await initializeDatabase();
    const result = await database.run(
      "INSERT INTO users (uuid, email, credits, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      ['mw-user', 'mw@test.com', 2]
    );
    userId = result.lastID;
  });

  it('calls next() when user has sufficient credits', async () => {
    const req = { user: { id: userId } };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    await requireCredits(1)(req, res, next);
    assert.ok(nextCalled);
  });

  it('returns 402 when user has insufficient credits', async () => {
    const req = { user: { id: userId } };
    let statusCode, body;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { body = data; }
    };
    await requireCredits(10)(req, res, () => {});
    assert.equal(statusCode, 402);
    assert.equal(body.code, 'INSUFFICIENT_CREDITS');
  });
});
