import express from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { Resume } from '../models/Resume.js';
import { scoreResume, tailorResume } from '../services/aiService.js';
import { deductCredits } from '../services/creditService.js';
import { requireCredits } from '../middleware/requireCredits.js';
import { CREDIT_COSTS } from '../config/credits.config.js';
import { handleValidationErrors } from '../middleware/errorHelpers.js';

const router = express.Router();

// POST /api/ai/score/:resumeId — score a stored resume (costs 1 credit)
router.post('/score/:resumeId', requireCredits(CREDIT_COSTS.RESUME_SCORE), async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    // Use Resume model to get complete resume with experience, education, projects
    const resume = await Resume.findByUuid(req.params.resumeId);
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const scoreReport = await scoreResume(resume);

    // Store score in DB using the internal ID
    const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [req.params.resumeId]);
    if (dbResume) {
      await database.run(
        "UPDATE base_resumes SET score = ?, suggestions = ?, updated_at = datetime('now') WHERE id = ?",
        [scoreReport.score, JSON.stringify(scoreReport.suggestions), dbResume.id]
      );
    }

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_SCORE);

    res.json({ success: true, data: scoreReport });
  } catch (error) {
    console.error('Error scoring resume:', error);
    const status = error.status === 503 ? 503 : 500;
    res.status(status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
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

    // Use Resume model to get complete resume with experience, education, projects
    const resumeData = await Resume.findByUuid(resumeId);
    if (!resumeData) return res.status(404).json({ success: false, message: 'Resume not found' });

    const { tailoredResume, diff, beforeScore, afterScore } = await tailorResume(
      resumeData, jobTitle, company, jobDescription
    );

    const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [resumeId]);
    const tailoredUuid = uuidv4();
    await database.run(
      `INSERT INTO tailored_resumes (uuid, base_resume_id, job_title, company, job_description, tailored_data, before_score, after_score, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tailoredUuid, dbResume.id, jobTitle, company, jobDescription,
       JSON.stringify(tailoredResume), beforeScore, afterScore, JSON.stringify(diff)]
    );

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_TAILOR);

    res.json({
      success: true,
      data: { tailoredResumeId: tailoredUuid, tailoredResume, diff, beforeScore, afterScore }
    });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    const status = error.status === 503 ? 503 : 500;
    res.status(status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
});

export default router;
