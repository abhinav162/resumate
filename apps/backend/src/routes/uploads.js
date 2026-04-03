import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { parseResumeText } from '../services/aiService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/uploads/resume
router.post('/resume', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Only PDF files are supported' });
    }

    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    const pdfData = await pdfParse(req.file.buffer);
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return res.status(422).json({ success: false, message: 'Could not extract text from PDF. Please ensure it is not a scanned image.' });
    }

    const parsed = await parseResumeText(pdfData.text);

    const resumeUuid = uuidv4();
    const resumeName = parsed.contact?.name
      ? `${parsed.contact.name}'s Resume`
      : req.file.originalname.replace('.pdf', '');

    await database.run(
      `INSERT INTO base_resumes (uuid, user_id, name, contact_data, summary, skills, is_base)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [resumeUuid, userRow.id, resumeName, JSON.stringify(parsed), parsed.summary || '', JSON.stringify(parsed.skills || [])]
    );

    for (let i = 0; i < (parsed.experience || []).length; i++) {
      const exp = parsed.experience[i];
      await database.run(
        `INSERT INTO experiences (uuid, resume_id, role, company, location, start_date, end_date, responsibilities, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, exp.role, exp.company, exp.location || '', exp.startDate || '', exp.endDate || '', JSON.stringify(exp.responsibilities || []), i]
      );
    }

    for (let i = 0; i < (parsed.education || []).length; i++) {
      const edu = parsed.education[i];
      await database.run(
        `INSERT INTO education (uuid, resume_id, degree, institution, location, graduation_date, gpa, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, edu.degree, edu.institution, edu.location || '', edu.graduationDate || '', edu.gpa || '', i]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: { resumeId: resumeUuid, name: resumeName, parsed }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
