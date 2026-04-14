import express from 'express';
import TailoredResume from '../models/TailoredResume.js';
import { Resume } from '../models/Resume.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/errorHelpers.js';

const router = express.Router();

// GET /api/tailored-resumes - Get all tailored resumes
router.get('/', async (req, res) => {
  try {
    const { baseResumeId } = req.query;
    let tailoredResumes;

    if (baseResumeId) {
      tailoredResumes = await TailoredResume.findByBaseResumeId(baseResumeId);
    } else {
      tailoredResumes = await TailoredResume.findAll();
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
router.get('/:id', [
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
router.post('/', [
  body('baseResumeId').isUUID().withMessage('Valid base resume ID is required'),
  body('jobDetails.jobTitle').trim().isLength({ min: 1 }).withMessage('Job title is required'),
  body('jobDetails.company').trim().isLength({ min: 1 }).withMessage('Company is required'),
  body('jobDetails.description').trim().isLength({ min: 1 }).withMessage('Job description is required'),
  body('tailoredData').isObject().withMessage('Tailored data is required')
], handleValidationErrors, async (req, res) => {
  try {
    // Verify base resume exists
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
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid tailored resume ID'),
  body('jobDetails.jobTitle').optional().trim().isLength({ min: 1 }).withMessage('Job title cannot be empty'),
  body('jobDetails.company').optional().trim().isLength({ min: 1 }).withMessage('Company cannot be empty'),
  body('jobDetails.description').optional().trim().isLength({ min: 1 }).withMessage('Job description cannot be empty'),
  body('tailoredData').optional().isObject().withMessage('Tailored data must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const tailoredResume = await TailoredResume.update(req.params.id, req.body);
    
    if (!tailoredResume) {
      return res.status(404).json({
        success: false,
        message: 'Tailored resume not found'
      });
    }

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
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid tailored resume ID')
], handleValidationErrors, async (req, res) => {
  try {
    const deleted = await TailoredResume.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tailored resume not found'
      });
    }

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