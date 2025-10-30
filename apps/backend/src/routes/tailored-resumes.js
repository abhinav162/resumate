import express from 'express';
import TailoredResume from '../models/TailoredResume.js';
import { Resume } from '../models/Resume.js';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// GET /api/tailored-resumes - Get all tailored resumes for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { baseResumeId } = req.query;
    const userId = req.user.userId;
    let tailoredResumes;

    if (baseResumeId) {
      // Verify user owns the base resume before fetching tailored resumes
      const ownsBaseResume = await TailoredResume.verifyBaseResumeOwnership(baseResumeId, userId);
      if (!ownsBaseResume) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view tailored resumes for your own base resumes.'
        });
      }
      tailoredResumes = await TailoredResume.findByBaseResumeId(baseResumeId, userId);
    } else {
      tailoredResumes = await TailoredResume.findAll(userId);
    }
    
    res.json({
      success: true,
      data: tailoredResumes
    });
  } catch (error) {
    console.error('Error fetching tailored resumes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tailored resumes',
      error: error.message
    });
  }
});

// GET /api/tailored-resumes/:id - Get specific tailored resume
router.get('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid tailored resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    const tailoredResume = await TailoredResume.findByUuid(req.params.id);
    
    if (!tailoredResume) {
      return res.status(404).json({
        success: false,
        message: 'Tailored resume not found'
      });
    }

    // Check if user owns this tailored resume (through the base resume)
    if (tailoredResume.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own tailored resumes.'
      });
    }

    res.json({
      success: true,
      data: tailoredResume
    });
  } catch (error) {
    console.error('Error fetching tailored resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tailored resume',
      error: error.message
    });
  }
});

// POST /api/tailored-resumes - Create new tailored resume
router.post('/', authenticateToken, [
  body('baseResumeId').isUUID().withMessage('Valid base resume ID is required'),
  body('jobDetails.jobTitle').trim().isLength({ min: 1 }).withMessage('Job title is required'),
  body('jobDetails.company').trim().isLength({ min: 1 }).withMessage('Company is required'),
  body('jobDetails.description').trim().isLength({ min: 1 }).withMessage('Job description is required'),
  body('tailoredData').isObject().withMessage('Tailored data is required')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Verify user owns the base resume
    const ownsBaseResume = await TailoredResume.verifyBaseResumeOwnership(req.body.baseResumeId, userId);
    if (!ownsBaseResume) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only create tailored resumes from your own base resumes.'
      });
    }

    // Verify base resume exists (additional check)
    const baseResume = await Resume.findByUuid(req.body.baseResumeId);
    if (!baseResume) {
      return res.status(404).json({
        success: false,
        message: 'Base resume not found'
      });
    }

    const tailoredResume = await TailoredResume.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Tailored resume created successfully',
      data: tailoredResume
    });
  } catch (error) {
    console.error('Error creating tailored resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tailored resume',
      error: error.message
    });
  }
});

// PUT /api/tailored-resumes/:id - Update tailored resume
router.put('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid tailored resume ID'),
  body('jobDetails.jobTitle').optional().trim().isLength({ min: 1 }).withMessage('Job title cannot be empty'),
  body('jobDetails.company').optional().trim().isLength({ min: 1 }).withMessage('Company cannot be empty'),
  body('jobDetails.description').optional().trim().isLength({ min: 1 }).withMessage('Job description cannot be empty'),
  body('tailoredData').optional().isObject().withMessage('Tailored data must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // First check if the tailored resume exists and verify ownership
    const existingTailoredResume = await TailoredResume.findByUuid(req.params.id);
    
    if (!existingTailoredResume) {
      return res.status(404).json({
        success: false,
        message: 'Tailored resume not found'
      });
    }

    // Check if user owns this tailored resume (through the base resume)
    if (existingTailoredResume.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own tailored resumes.'
      });
    }

    const tailoredResume = await TailoredResume.update(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Tailored resume updated successfully',
      data: tailoredResume
    });
  } catch (error) {
    console.error('Error updating tailored resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tailored resume',
      error: error.message
    });
  }
});

// DELETE /api/tailored-resumes/:id - Delete tailored resume
router.delete('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid tailored resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // First check if the tailored resume exists and verify ownership
    const existingTailoredResume = await TailoredResume.findByUuid(req.params.id);
    
    if (!existingTailoredResume) {
      return res.status(404).json({
        success: false,
        message: 'Tailored resume not found'
      });
    }

    // Check if user owns this tailored resume (through the base resume)
    if (existingTailoredResume.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own tailored resumes.'
      });
    }

    const deleted = await TailoredResume.delete(req.params.id);

    res.json({
      success: true,
      message: 'Tailored resume deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tailored resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tailored resume',
      error: error.message
    });
  }
});

export default router;