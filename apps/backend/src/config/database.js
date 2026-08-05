import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.client = null;
  }

  async connect() {
    // Turso cloud URL takes priority; fall back to DB_PATH or local file for development
    const url = process.env.TURSO_DATABASE_URL || process.env.DB_PATH || 'file:./data/resumate.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    this.client = createClient({ url, authToken });

    // Enable foreign key enforcement (SQLite default is OFF)
    await this.client.execute('PRAGMA foreign_keys = ON');

    console.log(`Connected to database: ${url.startsWith('libsql://') ? 'Turso cloud' : url}`);
  }

  async close() {
    if (this.client) {
      this.client.close();
      this.client = null;
      console.log('Database connection closed');
    }
  }

  // For INSERT / UPDATE / DELETE — returns { id, lastID, changes } to match previous API
  async run(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return {
      id: Number(result.lastInsertRowid),
      lastID: Number(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  }

  // For SELECT — returns single row object or null
  async get(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return result.rows[0] ?? null;
  }

  // For SELECT — returns array of row objects
  async all(sql, params = []) {
    const result = await this.client.execute({ sql, args: params });
    return result.rows;
  }

  // Runs multiple statements in ONE implicit transaction — libsql rolls the
  // whole batch back if any statement fails. Used by rebuild migrations where
  // a partial apply would corrupt the schema.
  async batch(statements) {
    return this.client.batch(
      statements.map((s) => (typeof s === 'string' ? { sql: s, args: [] } : { sql: s.sql, args: s.params ?? [] })),
      'write'
    );
  }
}

// Singleton instance shared across the app
const database = new Database();

export default database;
