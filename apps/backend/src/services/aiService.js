import { GoogleGenerativeAI } from '@google/generative-ai';

// Primary model + fallback when primary is overloaded
// gemini-3.1-pro: latest top-tier reasoning for resume scoring/tailoring
// gemini-3-flash: fast 3-gen fallback if pro is overloaded
const PRIMARY_MODEL = 'gemini-3.1-pro-preview';
const FALLBACK_MODEL = 'gemini-3-flash-preview';

function getModel(modelName = PRIMARY_MODEL) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: 'application/json' },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryableError(err) {
  // Gemini returns 503 when overloaded, 429 when rate-limited, 500 for transient errors
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 500 || status === 503) return true;
  // Fallback: check the message text
  const msg = (err?.message ?? '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('high demand') || msg.includes('rate limit') || msg.includes('try again');
}

function isOverloadedError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 503) return true;
  const msg = (err?.message ?? '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('high demand');
}

/**
 * Call Gemini with retry + fallback-model strategy.
 * - Retries the same model up to 2 times with exponential backoff (1s, 2s) on transient errors
 * - If primary model is still overloaded, falls back to FALLBACK_MODEL for one more attempt
 * - Throws a tagged error with .status = 503 if all attempts fail due to overload
 */
async function generateWithRetry(prompt, { maxAttempts = 3 } = {}) {
  let lastError;

  // Attempts 1 & 2: primary model with exponential backoff
  for (let attempt = 1; attempt <= maxAttempts - 1; attempt++) {
    try {
      const model = getModel(PRIMARY_MODEL);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
      console.warn(`Gemini ${PRIMARY_MODEL} attempt ${attempt} failed (${err.status ?? '?'}). Retrying in ${delay}ms.`);
      await sleep(delay);
    }
  }

  // Final attempt: fallback model
  try {
    console.warn(`Gemini ${PRIMARY_MODEL} exhausted retries. Falling back to ${FALLBACK_MODEL}.`);
    const model = getModel(FALLBACK_MODEL);
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    // Tag the error so routes can return 503 instead of 500
    if (isOverloadedError(err) || isOverloadedError(lastError)) {
      const e = new Error('AI service is temporarily overloaded. Please try again in a moment.');
      e.status = 503;
      e.code = 'AI_OVERLOADED';
      throw e;
    }
    throw err;
  }
}

function parseJsonResponse(text) {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Fix common LLM JSON issues:
    // 1. Missing closing } between array elements: ]\n,\n{ → ]},\n{
    cleaned = cleaned.replace(/\]\s*,\s*\{/g, ']},\n{');
    // 2. Trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    // 3. Double/extra commas between elements
    cleaned = cleaned.replace(/,\s*,/g, ',');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${firstError.message}`);
    }
  }
}

export async function parseResumeText(resumeText) {
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

  const text = await generateWithRetry(prompt);
  return parseJsonResponse(text);
}

export async function scoreResume(resumeData) {
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

bulletId format:
- "experience-<expIdx>-<bulletIdx>" → experience[expIdx].responsibilities[bulletIdx]
- "projects-<projIdx>-<bulletIdx>" → projects[projIdx].description[bulletIdx]
- "summary-0-0" for summary
- "skills-0-0" for skills section`;

  const text = await generateWithRetry(prompt);
  return parseJsonResponse(text);
}

export async function tailorResume(resumeData, jobTitle, company, jobDescription) {
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
  "tailoredResume": <full resume object matching original structure (preserve projects array if present)>,
  "diff": [
    { "sectionType": "experience", "bulletId": "experience-0-1", "original": "<old text>", "rewritten": "<new text>", "reason": "<why changed>" },
    { "sectionType": "projects", "bulletId": "projects-0-2", "original": "<old text>", "rewritten": "<new text>", "reason": "<why changed>" }
  ]
}`;

  const text = await generateWithRetry(prompt);
  const parsed = parseJsonResponse(text);

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
