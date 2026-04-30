import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { getCredits, deductCredits, grantCredits } from '../src/services/creditService.js';

describe('creditService', () => {
  let userId;

  before(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDatabase();
    const result = await database.run(
      "INSERT INTO users (uuid, email, credits, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      ['test-user-1', 'test@test.com', 10]
    );
    userId = result.lastID;
  });

  it('getCredits returns current balance', async () => {
    const balance = await getCredits(userId);
    assert.equal(balance, 10);
  });

  it('deductCredits reduces balance and returns new balance', async () => {
    const newBalance = await deductCredits(userId, 3);
    assert.equal(newBalance, 7);
  });

  it('deductCredits throws if insufficient credits', async () => {
    await assert.rejects(
      () => deductCredits(userId, 100),
      { message: 'Insufficient credits' }
    );
  });

  it('grantCredits increases balance', async () => {
    const newBalance = await grantCredits(userId, 5);
    assert.equal(newBalance, 12); // 7 + 5
  });
});
