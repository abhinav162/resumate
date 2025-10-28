import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResumeData, JobDetails } from '../types';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  setApiKey(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async parseResume(resumeText: string): Promise<ResumeData> {
    if (!this.genAI) {
      throw new Error('Gemini API key not set');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsedData = JSON.parse(cleanedText);
      
      // Add default ID and name
      return {
        id: crypto.randomUUID(),
        name: `Resume - ${parsedData.contact?.name || 'Unnamed'}`,
        ...parsedData
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      throw new Error('Failed to parse resume data from AI response');
    }
  }

  async tailorResume(
    resumeData: ResumeData, 
    jobDetails: JobDetails,
    useRaReOptimization: boolean = true
  ): Promise<ResumeData> {
    if (!this.genAI) {
      throw new Error('Gemini API key not set');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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
    
    try {
      // Remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const tailoredData = JSON.parse(cleanedText);
      
      // Preserve original IDs and metadata
      return {
        ...tailoredData,
        id: resumeData.id,
        name: resumeData.name
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      throw new Error('Failed to parse tailored resume data from AI response');
    }
  }

  async enhanceResume(
    resumeData: ResumeData,
    enhancementConfig: any
  ): Promise<ResumeData> {
    if (!this.genAI) {
      throw new Error('Gemini API key not set');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Enhance the following resume based on the provided configuration. Improve the content while maintaining accuracy and truthfulness.

Enhancement Configuration:
${JSON.stringify(enhancementConfig, null, 2)}

Resume Data:
${JSON.stringify(resumeData, null, 2)}

Return the enhanced resume as a JSON object with the same structure.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const enhancedData = JSON.parse(cleanedText);
      
      return {
        ...enhancedData,
        id: resumeData.id,
        name: resumeData.name
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      throw new Error('Failed to parse enhanced resume data from AI response');
    }
  }
}

export const geminiService = new GeminiService();
export default geminiService;