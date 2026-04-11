/**
 * Test-only routes — only mounted in non-production environments.
 * Used by E2E tests to seed data without going through the full upload/AI pipeline.
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';

const router = express.Router();

const TEST_RESUME = {
  contact: {
    name: 'Alex Johnson',
    email: 'alex.johnson@email.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexjohnson',
  },
  summary:
    'Experienced software engineer with 5+ years building scalable web applications using React, TypeScript, and Node.js. Passionate about clean code and great user experiences.',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'Git'],
  experience: [
    {
      role: 'Senior Frontend Engineer',
      company: 'Acme Corp',
      location: 'San Francisco, CA',
      startDate: '2021-03',
      endDate: 'Present',
      responsibilities: [
        'Led redesign of the core product dashboard, improving load time by 40%',
        'Mentored 3 junior engineers and conducted regular code reviews',
        'Introduced TypeScript across the frontend codebase',
      ],
    },
    {
      role: 'Frontend Engineer',
      company: 'Startup Inc',
      location: 'Remote',
      startDate: '2019-01',
      endDate: '2021-02',
      responsibilities: [
        'Built React component library used across 5 products',
        'Integrated Stripe payments and reduced checkout abandonment by 25%',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      institution: 'UC Berkeley',
      location: 'Berkeley, CA',
      graduationDate: '2018-05',
      gpa: '3.8',
    },
  ],
};

// POST /api/test/seed-resume
// Creates a test resume for the authenticated user if they have none.
router.post('/seed-resume', async (req, res) => {
  try {
    const userUuid = req.headers['x-user-id'];
    if (!userUuid) {
      return res.status(401).json({ success: false, message: 'Missing x-user-id header' });
    }

    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [userUuid]);
    if (!userRow) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user already has resumes — idempotent
    const existing = await database.get(
      'SELECT id FROM base_resumes WHERE user_id = ? LIMIT 1',
      [userRow.id]
    );
    if (existing) {
      return res.json({ success: true, seeded: false, message: 'User already has resumes' });
    }

    const resumeUuid = uuidv4();
    await database.run(
      `INSERT INTO base_resumes (uuid, user_id, name, contact_data, summary, skills, is_base)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        resumeUuid,
        userRow.id,
        "Alex Johnson's Resume",
        JSON.stringify(TEST_RESUME),
        TEST_RESUME.summary,
        JSON.stringify(TEST_RESUME.skills),
      ]
    );

    for (let i = 0; i < TEST_RESUME.experience.length; i++) {
      const exp = TEST_RESUME.experience[i];
      await database.run(
        `INSERT INTO experiences (uuid, resume_id, role, company, location, start_date, end_date, responsibilities, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), resumeUuid,
          exp.role, exp.company, exp.location,
          exp.startDate, exp.endDate,
          JSON.stringify(exp.responsibilities), i,
        ]
      );
    }

    for (let i = 0; i < TEST_RESUME.education.length; i++) {
      const edu = TEST_RESUME.education[i];
      await database.run(
        `INSERT INTO education (uuid, resume_id, degree, institution, location, graduation_date, gpa, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), resumeUuid,
          edu.degree, edu.institution, edu.location,
          edu.graduationDate, edu.gpa, i,
        ]
      );
    }

    res.status(201).json({ success: true, seeded: true, resumeId: resumeUuid });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
