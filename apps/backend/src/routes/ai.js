import express from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { Resume } from '../models/Resume.js';
import TailoredResume from '../models/TailoredResume.js';
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

    let resumeForScoring = await Resume.findByUuid(req.params.resumeId);
    let tailored = null;
    if (!resumeForScoring) {
      tailored = await TailoredResume.findByUuid(req.params.resumeId, userRow.id);
      if (!tailored) return res.status(404).json({ success: false, message: 'Resume not found' });
      resumeForScoring = tailored.tailoredData;
    }

    const scoreReport = await scoreResume(resumeForScoring);

    if (tailored) {
      await database.run(
        "UPDATE tailored_resumes SET after_score = ?, updated_at = datetime('now') WHERE uuid = ?",
        [scoreReport.score, req.params.resumeId]
      );
    } else {
      const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [req.params.resumeId]);
      if (dbResume) {
        await database.run(
          "UPDATE base_resumes SET score = ?, suggestions = ?, updated_at = datetime('now') WHERE id = ?",
          [scoreReport.score, JSON.stringify(scoreReport.suggestions), dbResume.id]
        );
      }
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

/**
 * Background worker for tailoring a resume.
 * Updates the tailored_resumes row through PENDING → IN_PROGRESS → COMPLETED/FAILED.
 * Credits are deducted only on success.
 */
async function processTailorJob({ tailoredUuid, resumeData, jobTitle, company, jobDescription, userId }) {
  try {
    await database.run(
      `UPDATE tailored_resumes SET status='IN_PROGRESS', updated_at=datetime('now') WHERE uuid=?`,
      [tailoredUuid]
    );

    const { tailoredResume, diff, beforeScore, afterScore } = await tailorResume(
      resumeData, jobTitle, company, jobDescription
    );

    await database.run(
      `UPDATE tailored_resumes
         SET tailored_data=?, before_score=?, after_score=?, diff=?, status='COMPLETED', updated_at=datetime('now')
       WHERE uuid=?`,
      [JSON.stringify(tailoredResume), beforeScore, afterScore, JSON.stringify(diff), tailoredUuid]
    );

    await deductCredits(userId, CREDIT_COSTS.RESUME_TAILOR);
    console.log(`Tailor job ${tailoredUuid} completed`);
  } catch (error) {
    console.error(`Tailor job ${tailoredUuid} failed:`, error);
    const message = error?.code === 'AI_OVERLOADED'
      ? error.message
      : 'Tailoring failed. Please try again.';
    await database.run(
      `UPDATE tailored_resumes SET status='FAILED', error_message=?, updated_at=datetime('now') WHERE uuid=?`,
      [message, tailoredUuid]
    ).catch(() => {});
  }
}

// POST /api/ai/tailor — kick off a tailoring job (async). Returns job ID immediately.
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

    const resumeData = await Resume.findByUuid(resumeId);
    if (!resumeData) return res.status(404).json({ success: false, message: 'Resume not found' });

    const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [resumeId]);
    if (!dbResume) return res.status(404).json({ success: false, message: 'Base resume not found' });

    // Create the job row in PENDING state. We store the job_description right away so the
    // listing UI can show context even while the AI is still working.
    const tailoredUuid = uuidv4();
    await database.run(
      `INSERT INTO tailored_resumes
         (uuid, base_resume_id, job_title, company, job_description, tailored_data, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [tailoredUuid, dbResume.id, jobTitle, company, jobDescription, JSON.stringify({})]
    );

    // Fire-and-forget background processing. The HTTP response returns immediately.
    processTailorJob({
      tailoredUuid,
      resumeData,
      jobTitle,
      company,
      jobDescription,
      userId: userRow.id,
    }).catch((err) => console.error('Unhandled tailor job error:', err));

    res.status(202).json({
      success: true,
      data: { tailoredResumeId: tailoredUuid, status: 'PENDING' },
    });
  } catch (error) {
    console.error('Error queuing tailor job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ai/tailor/status/:id — poll status of a tailoring job
router.get('/tailor/status/:id', async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const row = await database.get(
      `SELECT tr.uuid, tr.status, tr.error_message, tr.before_score, tr.after_score, tr.updated_at
       FROM tailored_resumes tr
       JOIN base_resumes br ON tr.base_resume_id = br.id
       WHERE tr.uuid = ? AND br.user_id = ?`,
      [req.params.id, userRow.id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Tailor job not found' });

    res.json({
      success: true,
      data: {
        tailoredResumeId: row.uuid,
        status: row.status || 'COMPLETED',
        errorMessage: row.error_message ?? null,
        beforeScore: row.before_score ?? null,
        afterScore: row.after_score ?? null,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching tailor status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
