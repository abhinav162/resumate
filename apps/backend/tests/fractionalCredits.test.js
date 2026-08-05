import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { getCredits, deductCredits, grantCredits } from '../src/services/creditService.js';
import { CREDIT_COSTS, GITHUB_FREE_REPOS } from '../src/config/credits.config.js';

// M2.0 — SQLite's flexible typing must store fractional credit balances in the
// INTEGER `credits` column without rounding (0.2-credit GitHub repo pricing).
describe('fractional credits (M2.0 foundation)', () => {
  let userId;

  before(async () => {
    process.env.DB_PATH = ':memory:';
    await database.close(); // fresh connection for test isolation
    await initializeDatabase();
    const res = await database.run(
      "INSERT INTO users (uuid, email, credits) VALUES ('frac-user', 'f@t.est', 5)"
    );
    userId = res.lastID;
  });

  it('exposes the GitHub pricing constants', () => {
    assert.equal(CREDIT_COSTS.GITHUB_REPO, 0.2);
    assert.equal(GITHUB_FREE_REPOS, 10);
  });

  it('deductCredits(user, 0.2) leaves a REAL 4.8 balance in DB and API', async () => {
    const balance = await deductCredits(userId, CREDIT_COSTS.GITHUB_REPO);
    assert.equal(balance, 4.8);
    const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
    assert.equal(row.credits, 4.8);
    assert.equal(await getCredits(userId), 4.8);
  });

  it('accumulated fractional deductions stay 2dp-exact after rounding', async () => {
    // 4.8 → 4.6 → 4.4: float drift must stay below a visible 2dp difference.
    await deductCredits(userId, 0.2);
    await deductCredits(userId, 0.2);
    const balance = await getCredits(userId);
    assert.equal(Math.round(balance * 100) / 100, 4.4);
  });

  it('rejects a fractional deduction exceeding the balance and changes nothing', async () => {
    const beforeBalance = await getCredits(userId);
    await assert.rejects(deductCredits(userId, beforeBalance + 0.2), (err) => {
      assert.equal(err.code, 'INSUFFICIENT_CREDITS');
      return true;
    });
    assert.equal(await getCredits(userId), beforeBalance);
  });

  it('grantCredits restores fractional balances', async () => {
    const beforeBalance = await getCredits(userId);
    const after = await grantCredits(userId, 0.6);
    assert.equal(Math.round(after * 100) / 100, Math.round((beforeBalance + 0.6) * 100) / 100);
  });
});
