import database from '../config/database.js';

export async function getCredits(userId) {
  const row = await database.get(
    'SELECT credits FROM users WHERE id = ?',
    [userId]
  );
  if (!row) throw new Error('User not found');
  return row.credits;
}

export async function deductCredits(userId, amount) {
  const result = await database.run(
    "UPDATE users SET credits = credits - ?, updated_at = datetime('now') WHERE id = ? AND credits >= ?",
    [amount, userId, amount]
  );
  if (result.changes === 0) {
    const err = new Error('Insufficient credits');
    err.code = 'INSUFFICIENT_CREDITS';
    throw err;
  }
  const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
  return row.credits;
}

export async function grantCredits(userId, amount) {
  await database.run(
    "UPDATE users SET credits = credits + ?, updated_at = datetime('now') WHERE id = ?",
    [amount, userId]
  );
  const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
  return row.credits;
}
