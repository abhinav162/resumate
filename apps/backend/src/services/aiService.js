import { computeDeterministic, weightedComposite } from '../lib/scoring/rubric.js';
import { keywordMatchScore } from '../lib/scoring/keywords.js';

const MODEL = 'gpt-5.4-mini';

function getBifrostConfig() {
  const url = process.env.BIFROST_URL;
  const key = process.env.BIFROST_VIRTUAL_KEY;
  if (!url) throw new Error('BIFROST_URL is not set');
  if (!key) throw new Error('BIFROST_VIRTUAL_KEY is not set');
  return { url: url.replace(/\/$/, ''), key };
}

function isOverloadedStatus(status, message) {
  if (status === 503) return true;
  const msg = (message ?? '').toLowerCase();
  return msg.includes('overloaded') || msg.includes('high demand');
}

async function bifrostGenerate(prompt, { temperature } = {}) {
  const { url, key } = getBifrostConfig();

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  };
  // Deterministic calls (scoring, keyword extraction) pass temperature: 0 so the
  // same input yields a reproducible result.
  if (typeof temperature === 'number') body.temperature = temperature;

  let response;
  try {
    response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const e = new Error(`Bifrost network error: ${err.message}`);
    e.cause = err;
    throw e;
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    if (isOverloadedStatus(response.status, bodyText)) {
      const e = new Error('AI service is temporarily overloaded. Please try again in a moment.');
      e.status = 503;
      e.code = 'AI_OVERLOADED';
      throw e;
    }
    const e = new Error(`Bifrost request failed (${response.status}): ${bodyText.slice(0, 500)}`);
    e.status = response.status;
    throw e;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error('Bifrost response missing choices[0].message.content');
  }
  return text;
}

function parseJsonResponse(text) {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Normalize Python literals to JSON equivalents
  cleaned = cleaned.replace(/:\s*None\s*([,}\]])/g, ': null$1');
  cleaned = cleaned.replace(/:\s*True\s*([,}\]])/g, ': true$1');
  cleaned = cleaned.replace(/:\s*False\s*([,}\]])/g, ': false$1');

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    cleaned = cleaned.replace(/\]\s*,\s*\{/g, ']},\n{');
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
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

  const text = await bifrostGenerate(prompt);
  return parseJsonResponse(text);
}

/**
 * Extract the hard skills / tools / keywords a job description requires.
 * Returns a normalized lowercase string[]. Deterministic (temperature 0) so the
 * same JD yields the same keyword set (cacheable upstream by JD hash).
 */
export async function extractJdKeywords(jobDescription) {
  if (!jobDescription || !jobDescription.trim()) return [];
  const prompt = `Extract the hard skills, tools, technologies, and must-have keywords from this job description.

Job Description:
---
${jobDescription}
---

Return ONLY valid JSON: { "keywords": ["lowercased keyword", ...] }
Rules: only concrete skills/tools/technologies (e.g. "react", "kubernetes", "postgresql"), not soft skills or generic words. Lowercase. No duplicates. Max 30.`;

  const text = await bifrostGenerate(prompt, { temperature: 0 });
  const parsed = parseJsonResponse(text);
  return Array.isArray(parsed.keywords) ? parsed.keywords : [];
}

/**
 * Legacy single-call scorer (kept for fallback via SCORING_V2=false).
 */
async function scoreResumeLegacy(resumeData) {
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

  const text = await bifrostGenerate(prompt, { temperature: 0 });
  return parseJsonResponse(text);
}

/**
 * Hybrid ATS scorer (SCORING_V2, default on).
 *
 * Combines deterministic, reproducible sub-scores (metrics density, action-verb
 * variety, readability, formatting, and — when a JD is provided — keyword
 * coverage) with an LLM qualitative pass (impact, clarity) and the model's
 * bullet-level issues/suggestions. The pieces are blended via the rubric WEIGHTS
 * into a single 0-100 `score`, with a `breakdown` for transparency.
 *
 * Backward compatible: still returns { score, issues, suggestions }.
 *
 * @param {object} resumeData
 * @param {{ jobDescription?: string, jdKeywords?: string[] }} [opts]
 */
export async function scoreResume(resumeData, opts = {}) {
  if (process.env.SCORING_V2 === 'false') {
    return scoreResumeLegacy(resumeData);
  }

  // Deterministic sub-scores — no LLM.
  const deterministic = computeDeterministic(resumeData);

  // Optional JD keyword coverage. Accept pre-extracted keywords (so callers like
  // tailoring can extract once and reuse), else extract from the JD if given.
  let jdKeywords = opts.jdKeywords ?? null;
  if (!jdKeywords && opts.jobDescription) {
    jdKeywords = await extractJdKeywords(opts.jobDescription);
  }
  const keywordMatch = jdKeywords && jdKeywords.length
    ? keywordMatchScore(resumeData, jdKeywords)
    : null;

  // LLM qualitative pass — impact/clarity + bullet-level issues/suggestions.
  const prompt = `You are an ATS resume expert. Judge the QUALITY of this resume's writing and return a JSON report.

Resume:
${JSON.stringify(resumeData, null, 2)}

Return ONLY valid JSON:
{
  "impact": <integer 0-100, how strongly bullets convey measurable impact/outcomes>,
  "clarity": <integer 0-100, how clear, concise and professional the writing is>,
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
- "summary-0-0" for summary`;

  const text = await bifrostGenerate(prompt, { temperature: 0 });
  const parsed = parseJsonResponse(text);

  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const breakdown = {
    metrics: deterministic.metrics,
    verbs: deterministic.verbs,
    readability: deterministic.readability,
    formatting: deterministic.formatting,
    impact: clamp(parsed.impact),
    clarity: clamp(parsed.clarity),
  };
  if (keywordMatch !== null) breakdown.keywordMatch = keywordMatch;

  return {
    score: weightedComposite(breakdown),
    breakdown,
    issues: parsed.issues ?? [],
    suggestions: parsed.suggestions ?? [],
  };
}

export async function tailorResume(resumeData, jobTitle, company, jobDescription) {
  // Extract JD keywords once and reuse for both before/after scoring so the
  // keyword-coverage component is consistent and the delta is meaningful.
  const jdKeywords = await extractJdKeywords(jobDescription);

  const beforeScoreData = await scoreResume(resumeData, { jdKeywords });
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

  const text = await bifrostGenerate(prompt);
  const parsed = parseJsonResponse(text);

  const afterScoreData = await scoreResume(parsed.tailoredResume, { jdKeywords });
  const afterScore = afterScoreData.score;

  return {
    tailoredResume: parsed.tailoredResume,
    diff: parsed.diff,
    beforeScore,
    afterScore,
    afterBreakdown: afterScoreData.breakdown ?? null,
  };
}
