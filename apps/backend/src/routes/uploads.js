import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import database from '../config/database.js';
import { Resume } from '../models/Resume.js';
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

    const resumeName = parsed.contact?.name
      ? `${parsed.contact.name}'s Resume`
      : req.file.originalname.replace('.pdf', '');

    const resume = await Resume.create({
      name: resumeName,
      contact: parsed.contact || {},
      summary: parsed.summary || '',
      skills: parsed.skills || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      projects: parsed.projects || [],
      userId: userRow.id,
      isBase: true,
    });

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: { resumeId: resume.id, name: resume.name, parsed: resume }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
