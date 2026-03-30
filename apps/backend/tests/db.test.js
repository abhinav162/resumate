import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';

describe('database schema', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDatabase();
  });

  it('users table has credits column defaulting to 0', async () => {
    const cols = await database.all("PRAGMA table_info(users)");
    const credits = cols.find(c => c.name === 'credits');
    assert.ok(credits, 'credits column missing from users');
    assert.equal(credits.dflt_value, '0');
  });

  it('base_resumes table has score and suggestions columns', async () => {
    const cols = await database.all("PRAGMA table_info(base_resumes)");
    assert.ok(cols.find(c => c.name === 'score'), 'score column missing');
    assert.ok(cols.find(c => c.name === 'suggestions'), 'suggestions column missing');
  });

  it('tailored_resumes table has before_score, after_score, diff columns', async () => {
    const cols = await database.all("PRAGMA table_info(tailored_resumes)");
    assert.ok(cols.find(c => c.name === 'before_score'), 'before_score missing');
    assert.ok(cols.find(c => c.name === 'after_score'), 'after_score missing');
    assert.ok(cols.find(c => c.name === 'diff'), 'diff column missing');
  });
});
