import { clerkSetup } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_RESUME = {
  contact: { name: 'Alex Johnson', email: 'alex.johnson@email.com', phone: '+1 (555) 123-4567', location: 'San Francisco, CA' },
  summary: 'Experienced software engineer with 5+ years building scalable web applications using React, TypeScript, and Node.js.',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
  experience: [
    {
      role: 'Senior Frontend Engineer', company: 'Acme Corp', location: 'San Francisco, CA',
      startDate: '2021-03', endDate: 'Present',
      responsibilities: ['Led redesign of the core product dashboard, improving load time by 40%', 'Mentored 3 junior engineers'],
    },
    {
      role: 'Frontend Engineer', company: 'Startup Inc', location: 'Remote',
      startDate: '2019-01', endDate: '2021-02',
      responsibilities: ['Built React component library used across 5 products'],
    },
  ],
  education: [
    { degree: 'B.S. Computer Science', institution: 'UC Berkeley', location: 'Berkeley, CA', graduationDate: '2018-05', gpa: '3.8' },
  ],
};

async function seedTestResume() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const email = process.env.E2E_USER_EMAIL ?? 'test1@gmail.com';

  if (!secretKey) {
    console.warn('[seed] CLERK_SECRET_KEY not set — skipping resume seed');
    return;
  }

  // Get the Clerk user ID for the test user
  let clerkUserId: string | undefined;
  try {
    const clerk = createClerkClient({ secretKey });
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    clerkUserId = users.data[0]?.id;
  } catch (e) {
    console.warn('[seed] Could not look up Clerk user — skipping seed:', (e as Error).message);
    return;
  }

  if (!clerkUserId) {
    console.warn(`[seed] No Clerk user found for ${email} — skipping seed`);
    return;
  }

  // Open the SQLite database directly (path matches backend DB_PATH=../../data/data/resumate.db)
  const dbPath = path.resolve(__dirname, '../../../data/data/resumate.db');
  const db = new sqlite3.Database(dbPath);
  const get = promisify<string, any[], any>(db.get.bind(db));
  const run = promisify<string, any[]>(db.run.bind(db));

  try {
    // Find the user's internal DB id
    const userRow = await get('SELECT id FROM users WHERE uuid = ?', [clerkUserId]);
    if (!userRow) {
      console.warn(`[seed] User ${clerkUserId} not in DB yet — they need to sign in first`);
      return;
    }

    // Always reset credits to 10 so credit-gated tests work consistently
    await run('UPDATE users SET credits = 10 WHERE id = ?', [userRow.id]);
    console.log(`[seed] Reset credits to 10 for user ${clerkUserId}`);

    // Idempotent: only seed if user has no resumes
    const existing = await get('SELECT id FROM base_resumes WHERE user_id = ? LIMIT 1', [userRow.id]);
    if (existing) {
      console.log(`[seed] User already has resumes — skipping`);
      return;
    }

    const resumeUuid = uuidv4();
    await run(
      `INSERT INTO base_resumes (uuid, user_id, name, contact_data, summary, skills, is_base)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [resumeUuid, userRow.id, "Alex Johnson's Resume",
       JSON.stringify(TEST_RESUME), TEST_RESUME.summary, JSON.stringify(TEST_RESUME.skills)]
    );

    for (let i = 0; i < TEST_RESUME.experience.length; i++) {
      const exp = TEST_RESUME.experience[i];
      await run(
        `INSERT INTO experiences (uuid, resume_id, role, company, location, start_date, end_date, responsibilities, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, exp.role, exp.company, exp.location, exp.startDate, exp.endDate, JSON.stringify(exp.responsibilities), i]
      );
    }

    for (let i = 0; i < TEST_RESUME.education.length; i++) {
      const edu = TEST_RESUME.education[i];
      await run(
        `INSERT INTO education (uuid, resume_id, degree, institution, location, graduation_date, gpa, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, edu.degree, edu.institution, edu.location, edu.graduationDate, edu.gpa, i]
      );
    }

    console.log(`[seed] Created test resume ${resumeUuid} for user ${clerkUserId}`);
  } finally {
    db.close();
  }
}

export default async function globalSetup() {
  await clerkSetup();
  // Note: seedTestResume() is called by auth.setup.ts AFTER sign-in,
  // so the user row exists in the DB by then.
}

// Export for use by auth.setup.ts
export { seedTestResume };
