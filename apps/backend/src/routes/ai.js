import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { Resume } from '../models/Resume.js';

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

// POST /api/ai/parse-resume - Parse resume text using AI
router.post('/parse-resume', authenticateToken, [
  body('resumeText').trim().isLength({ min: 50 }).withMessage('Resume text must be at least 50 characters'),
  body('apiKey').trim().isLength({ min: 1 }).withMessage('API key is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { resumeText, apiKey } = req.body;
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Parse the following resume text into a structured JSON format. Extract all relevant information including contact details, experience, education, projects, and skills. If some information is missing, use appropriate defaults or empty values.

    Resume Text:
    ---
    ${resumeText}
    ---

    Return ONLY a valid JSON object with the following structure:
    {
      "contact": {
        "name": "Full Name",
        "email": "email@example.com",
        "phone": "phone number",
        "location": "City, State",
        "linkedin": "linkedin URL",
        "github": "github URL",
        "website": "website URL"
      },
      "summary": "Professional summary",
      "experience": [
        {
          "role": "Job Title",
          "company": "Company Name",
          "location": "City, State",
          "startDate": "Month Year",
          "endDate": "Month Year or Present",
          "responsibilities": ["bullet point 1", "bullet point 2"]
        }
      ],
      "education": [
        {
          "degree": "Degree Name",
          "institution": "University Name",
          "location": "City, State",
          "graduationDate": "Month Year",
          "gpa": "GPA if available"
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "url": "project URL",
          "repoUrl": "repository URL",
          "description": ["description point 1", "description point 2"]
        }
      ],
      "skills": ["skill1", "skill2", "skill3"]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse the JSON response
    let parsedData;
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      throw new Error('Failed to parse AI response as JSON');
    }

    res.json({
      success: true,
      message: 'Resume parsed successfully',
      data: parsedData
    });
  } catch (error) {
    console.error('Error parsing resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse resume',
      error: error.message
    });
  }
});

// POST /api/ai/tailor-resume - Tailor resume for specific job
router.post('/tailor-resume', authenticateToken, [
  body('resumeData').isObject().withMessage('Resume data is required'),
  body('resumeData.id').optional().isUUID().withMessage('Resume ID must be a valid UUID if provided'),
  body('jobDetails.jobTitle').trim().isLength({ min: 1 }).withMessage('Job title is required'),
  body('jobDetails.company').trim().isLength({ min: 1 }).withMessage('Company is required'),
  body('jobDetails.description').trim().isLength({ min: 10 }).withMessage('Job description is required'),
  body('apiKey').trim().isLength({ min: 1 }).withMessage('API key is required'),
  body('useRaReOptimization').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const { resumeData, jobDetails, apiKey, useRaReOptimization = true } = req.body;
    
    // If resume has an ID, verify user owns this resume
    if (resumeData.id) {
      const existingResume = await Resume.findByUuid(resumeData.id);
      
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
          message: 'Access denied. You can only tailor your own resumes.'
        });
      }
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert ATS resume optimizer using the RARe framework (Readability, Applicability, Remarkability). Given the following resume JSON and job description, rewrite the resume to be highly tailored for the job.

OPTIMIZATION REQUIREMENTS:
1. READABILITY: Keep bullets under 280 characters, ensure scannable format
2. APPLICABILITY: Align content with job requirements, prioritize relevant skills
3. REMARKABILITY: Use XYZ framework (Accomplished X as measured by Y by doing Z), strong action verbs

ATS OPTIMIZATION RULES (CRITICAL - MANDATORY):
1. ELIMINATE VAGUE BUZZWORDS: Never use these overused terms anywhere:
   - "proactive", "dynamic", "team player", "highly motivated", "self-starter", "passionate"
   - "excellent communication skills", "detail-oriented", "hard worker", "results-driven"
   - "pixel-perfect", "fast-paced environments", "collaborative", "innovative", "strategic"
   - Replace with specific, measurable achievements
   
2. ACTION VERB VARIATION (STRICT ENFORCEMENT):
   - MAXIMUM 1 use per action verb across the ENTIRE resume
   - Must use diverse verbs: Built, Created, Delivered, Launched, Streamlined, Accelerated, Transformed, etc.
   - BANNED from repetition: Architected, Optimized, Engineered, Designed, Developed, Implemented, Enhanced
   - Count each verb as you write - never repeat any action verb
   
3. QUANTIFICATION REQUIREMENTS (CRITICAL):
   - MINIMUM 75% of bullets must include specific numbers/metrics
   - Include: percentages, time saved, team sizes, dollar amounts, volumes, frequencies
   - CORRECT Examples: "40% increase", "5-person team", "10K users", "3x faster"
   - NEVER use malformed percentages like "3+0%" - use "30%" instead
   - NEVER use plus in middle of numbers - use "1M users" not "1M+ users" unless indicating "more than"
   - Even estimate metrics if exact numbers unavailable (use "~", "approximately", "over")
   
4. METRICS STANDARDIZATION (CRITICAL):
   - Use ONLY valid percentages: "30%", "45%", "60%" - NEVER "3+0%", "4+5%", "6+0%"
   - Format numbers correctly: "100K", "1M", "2.5M" - NOT "10+0K" or "1M+"
   - Use "over" or "more than" for approximations: "over 100K users", not "100K+ users"
   - Always include specific numbers with units
   
5. BULLET LENGTH: Maximum 280 characters per bullet point

SPECIFIC INSTRUCTIONS:
- Rewrite the summary to align with key job requirements (keep under 400 characters, NO BUZZWORDS)
- Transform each responsibility/project bullet using XYZ or RAS framework
- Start bullets with varied, high-impact action verbs (NEVER repeat any verb)
- QUANTIFY 75%+ of bullets with specific metrics (%, numbers, time, team sizes, volumes, etc.)
- Use XYZ framework: "Accomplished [X] as measured by [Y] by doing [Z]"
- Include time periods, team sizes, percentages, dollar amounts wherever possible
- Incorporate relevant keywords from job description naturally
- Ensure most relevant skills are prioritized first
- Do NOT invent new experiences, projects, or skills - only enhance existing content
- Keep each bullet under 280 characters for optimal readability
- Show achievements through concrete, quantified examples, not subjective claims
- If exact metrics unknown, use reasonable estimates with qualifiers (~, approximately, over)

TARGET JOB:
Title: ${jobDetails.jobTitle}
Company: ${jobDetails.company}

Job Description:
---
${jobDetails.description}
---

Original Resume Data:
---
${JSON.stringify(resumeData, null, 2)}
---

Return the complete, optimized resume as a JSON object following the RARe framework principles and ATS optimization rules.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to parse the JSON response
    let tailoredData;
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      tailoredData = JSON.parse(cleanedText);
    } catch (parseError) {
      throw new Error('Failed to parse AI response as JSON');
    }

    // Preserve original IDs and metadata
    tailoredData.id = resumeData.id;
    tailoredData.name = resumeData.name;

    res.json({
      success: true,
      message: 'Resume tailored successfully',
      data: tailoredData
    });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to tailor resume',
      error: error.message
    });
  }
});

export default router;