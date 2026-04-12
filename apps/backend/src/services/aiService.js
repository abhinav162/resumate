import { GoogleGenerativeAI } from '@google/generative-ai';

function getModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
  }
}

export async function parseResumeText(resumeText) {
  const model = getModel();
  const prompt = `Parse the following resume text into structured JSON. Extract contact, summary, experience (with responsibilities as arrays), education, projects, and skills.

Resume:
---
${resumeText}
---

Return ONLY valid JSON with this structure:
{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": "" },
  "summary": "",
  "experience": [{ "role": "", "company": "", "location": "", "startDate": "", "endDate": "", "responsibilities": [] }],
  "education": [{ "degree": "", "institution": "", "location": "", "graduationDate": "", "gpa": "" }],
  "projects": [{ "name": "", "url": "", "repoUrl": "", "description": [] }],
  "skills": []
}`;

  const result = await model.generateContent(prompt);
  return parseJsonResponse(result.response.text());
}

export async function scoreResume(resumeData) {
  const model = getModel();
  const prompt = `You are an ATS resume expert. Analyze this resume and return a JSON score report.

Resume:
${JSON.stringify(resumeData, null, 2)}

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "issues": [
    { "bulletId": "<sectionType>-<sectionIndex>-<bulletIndex>", "issueType": "weak_verb|no_metrics|vague|ats_keyword_missing", "severity": "warn|error", "original": "<original text>" }
  ],
  "suggestions": [
    { "bulletId": "<same id>", "original": "<original>", "rewrite": "<improved version>", "issueType": "<same>", "severity": "<same>" }
  ]
}

bulletId format: "experience-0-2" means experience[0].responsibilities[2]. Use "summary-0-0" for summary, "skills-0-0" for skills section.`;

  const result = await model.generateContent(prompt);
  return parseJsonResponse(result.response.text());
}

export async function tailorResume(resumeData, jobTitle, company, jobDescription) {
  const model = getModel();

  // Score before tailoring
  const beforeScoreData = await scoreResume(resumeData);
  const beforeScore = beforeScoreData.score;

  const prompt = `You are an expert ATS resume optimizer. Tailor this resume for the target job using the RARe framework (Readability, Applicability, Remarkability).

Rules:
- Use XYZ framework: "Accomplished X as measured by Y by doing Z"
- 75%+ bullets must have specific metrics
- No repeated action verbs
- No buzzwords (proactive, dynamic, team player, passionate, etc.)
- Max 280 chars per bullet
- Do NOT invent new experiences

Target Job: ${jobTitle} at ${company}
Job Description:
---
${jobDescription}
---

Original Resume:
${JSON.stringify(resumeData, null, 2)}

Return ONLY valid JSON with two keys:
{
  "tailoredResume": <full resume object matching original structure>,
  "diff": [
    { "sectionType": "experience", "bulletId": "experience-0-1", "original": "<old text>", "rewritten": "<new text>", "reason": "<why changed>" }
  ]
}`;

  const result = await model.generateContent(prompt);
  const parsed = parseJsonResponse(result.response.text());

  // Score after tailoring
  const afterScoreData = await scoreResume(parsed.tailoredResume);
  const afterScore = afterScoreData.score;

  return {
    tailoredResume: parsed.tailoredResume,
    diff: parsed.diff,
    beforeScore,
    afterScore,
  };
}
