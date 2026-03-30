import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { scoreResume, tailorResume } from '../services/aiService.js';
import { deductCredits } from '../services/creditService.js';
import { requireCredits } from '../middleware/requireCredits.js';
import { CREDIT_COSTS } from '../config/credits.config.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// POST /api/ai/score/:resumeId — score a stored resume (costs 1 credit)
router.post('/score/:resumeId', requireCredits(CREDIT_COSTS.RESUME_SCORE), async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    const resume = await database.get(
      'SELECT * FROM base_resumes WHERE uuid = ? AND user_id = ?',
      [req.params.resumeId, userRow.id]
    );
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const resumeData = JSON.parse(resume.contact_data);
    const scoreReport = await scoreResume(resumeData);

    await database.run(
      "UPDATE base_resumes SET score = ?, suggestions = ?, updated_at = datetime('now') WHERE id = ?",
      [scoreReport.score, JSON.stringify(scoreReport.suggestions), resume.id]
    );

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_SCORE);

    res.json({ success: true, data: scoreReport });
  } catch (error) {
    console.error('Error scoring resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/tailor — tailor a resume to a JD (costs 2 credits)
router.post('/tailor', [
  body('resumeId').trim().notEmpty(),
  body('jobTitle').trim().isLength({ min: 1 }),
  body('company').trim().isLength({ min: 1 }),
  body('jobDescription').trim().isLength({ min: 10 }),
], handleValidationErrors, requireCredits(CREDIT_COSTS.RESUME_TAILOR), async (req, res) => {
  try {
    const { resumeId, jobTitle, company, jobDescription } = req.body;
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    const baseResume = await database.get(
      'SELECT * FROM base_resumes WHERE uuid = ? AND user_id = ?',
      [resumeId, userRow.id]
    );
    if (!baseResume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const resumeData = JSON.parse(baseResume.contact_data);
    const { tailoredResume, diff, beforeScore, afterScore } = await tailorResume(
      resumeData, jobTitle, company, jobDescription
    );

    const tailoredUuid = uuidv4();
    await database.run(
      `INSERT INTO tailored_resumes (uuid, base_resume_id, job_title, company, job_description, tailored_data, before_score, after_score, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tailoredUuid, baseResume.id, jobTitle, company, jobDescription,
       JSON.stringify(tailoredResume), beforeScore, afterScore, JSON.stringify(diff)]
    );

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_TAILOR);

    res.json({
      success: true,
      data: { tailoredResumeId: tailoredUuid, tailoredResume, diff, beforeScore, afterScore }
    });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
