import database from './database.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializeDatabase() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = dirname(database.db?.filename || '../data');
    await mkdir(dataDir, { recursive: true });

    // Connect to database
    await database.connect();

    // Create tables
    await createTables();
    
    // Create default data
    await createDefaultData();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

async function createTables() {
  // Users table
  await database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Base resumes table
  await database.run(`
    CREATE TABLE IF NOT EXISTS base_resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      name TEXT NOT NULL,
      contact_data TEXT NOT NULL,
      summary TEXT,
      skills TEXT,
      is_base BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Experience table
  await database.run(`
    CREATE TABLE IF NOT EXISTS experiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      resume_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      responsibilities TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resume_id) REFERENCES base_resumes (id) ON DELETE CASCADE
    )
  `);

  // Education table
  await database.run(`
    CREATE TABLE IF NOT EXISTS education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      resume_id INTEGER NOT NULL,
      degree TEXT NOT NULL,
      institution TEXT NOT NULL,
      location TEXT,
      graduation_date TEXT,
      gpa TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resume_id) REFERENCES base_resumes (id) ON DELETE CASCADE
    )
  `);

  // Projects table
  await database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      resume_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      repo_url TEXT,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resume_id) REFERENCES base_resumes (id) ON DELETE CASCADE
    )
  `);

  // Tailored resumes table
  await database.run(`
    CREATE TABLE IF NOT EXISTS tailored_resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      base_resume_id INTEGER NOT NULL,
      job_title TEXT NOT NULL,
      company TEXT NOT NULL,
      job_description TEXT,
      tailored_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_resume_id) REFERENCES base_resumes (id) ON DELETE CASCADE
    )
  `);

  // API keys table (encrypted)
  await database.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  await database.run('CREATE INDEX IF NOT EXISTS idx_base_resumes_user_id ON base_resumes(user_id)');
  await database.run('CREATE INDEX IF NOT EXISTS idx_experiences_resume_id ON experiences(resume_id)');
  await database.run('CREATE INDEX IF NOT EXISTS idx_education_resume_id ON education(resume_id)');
  await database.run('CREATE INDEX IF NOT EXISTS idx_projects_resume_id ON projects(resume_id)');
  await database.run('CREATE INDEX IF NOT EXISTS idx_tailored_resumes_base_id ON tailored_resumes(base_resume_id)');

  console.log('All tables created successfully');
}

async function createDefaultData() {
  // Create default user if it doesn't exist
  const existingUser = await database.get(`
    SELECT id FROM users WHERE uuid = ?
  `, ['default-user']);

  if (!existingUser) {
    await database.run(`
      INSERT INTO users (uuid, email) VALUES (?, ?)
    `, ['default-user', 'default@resumate.local']);
    console.log('Default user created successfully');
  } else {
    console.log('Default user already exists');
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase, createTables };