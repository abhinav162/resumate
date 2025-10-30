import express from 'express';
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

// GET /api/resumes - Get all resumes for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const resumes = await Resume.findByUserId(userId);
    
    res.json({
      success: true,
      data: resumes
    });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    });
  }
});

// GET /api/resumes/:id - Get specific resume
router.get('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    const resume = await Resume.findByUuid(req.params.id);
    
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Check if user owns this resume
    if (resume.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own resumes.'
      });
    }

    res.json({
      success: true,
      data: resume
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resume',
      error: error.message
    });
  }
});

// POST /api/resumes - Create new resume
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Resume name is required'),
  body('contact.name').trim().isLength({ min: 1 }).withMessage('Contact name is required'),
  body('contact.email').isEmail().withMessage('Valid email is required'),
  body('contact.phone').trim().isLength({ min: 1 }).withMessage('Phone number is required'),
  body('contact.location').trim().isLength({ min: 1 }).withMessage('Location is required'),
  body('summary').optional().trim(),
  body('skills').isArray().withMessage('Skills must be an array'),
  body('experience').isArray().withMessage('Experience must be an array'),
  body('education').isArray().withMessage('Education must be an array'),
  body('projects').optional().isArray().withMessage('Projects must be an array')
], handleValidationErrors, async (req, res) => {
  try {
    const resumeData = {
      ...req.body,
      userId: req.user.userId
    };

    const resume = await Resume.create(resumeData);
    
    res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      data: resume
    });
  } catch (error) {
    console.error('Error creating resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create resume',
      error: error.message
    });
  }
});

// PUT /api/resumes/:id - Update resume
router.put('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid resume ID'),
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Resume name cannot be empty'),
  body('contact.name').optional().trim().isLength({ min: 1 }).withMessage('Contact name cannot be empty'),
  body('contact.email').optional().isEmail().withMessage('Valid email is required'),
  body('contact.phone').optional().trim().isLength({ min: 1 }).withMessage('Phone number cannot be empty'),
  body('contact.location').optional().trim().isLength({ min: 1 }).withMessage('Location cannot be empty'),
  body('summary').optional().trim(),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('isBase').optional().isBoolean().withMessage('isBase must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    // First check if resume exists and user owns it
    const existingResume = await Resume.findByUuid(req.params.id);
    
    if (!existingResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Check if user owns this resume
    if (existingResume.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own resumes.'
      });
    }

    const resume = await Resume.update(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: resume
    });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resume',
      error: error.message
    });
  }
});

// DELETE /api/resumes/:id - Delete resume
router.delete('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Invalid resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    // First check if resume exists and user owns it
    const existingResume = await Resume.findByUuid(req.params.id);
    
    if (!existingResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Check if user owns this resume
    if (existingResume.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own resumes.'
      });
    }

    const deleted = await Resume.delete(req.params.id);

    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume',
      error: error.message
    });
  }
});

export default router;