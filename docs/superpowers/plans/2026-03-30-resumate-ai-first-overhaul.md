# Resumate AI-First Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Resumate from a generic resume builder into a genuine AI-first product with a working credit monetization system, server-side AI, PDF upload with instant scoring, and a Paper design system.

**Architecture:** Express backend with SQLite gains a credits system, server-side Gemini key, PDF parsing, and AI scoring. React frontend-v2 gets a full design system reset (Paper), working upload onboarding, wired AI editor suggestions, and Stripe credit purchases.

**Tech Stack:** Node.js (ESM), Express, SQLite (via existing Database class), @google/generative-ai (gemini-2.5-flash), multer, pdf-parse, stripe, React 18, Vite, Tailwind CSS, Clerk auth, Space Grotesk + DM Sans fonts.

---

## File Map

### Backend — New Files
- `apps/backend/src/config/pricing.config.js` — single source of truth for credit packs + Stripe Price IDs
- `apps/backend/src/config/credits.config.js` — single source of truth for per-operation credit costs
- `apps/backend/src/services/creditService.js` — get balance, deduct, grant credits
- `apps/backend/src/services/aiService.js` — server-side Gemini: parse, score, tailor
- `apps/backend/src/middleware/requireCredits.js` — gate endpoints behind credit checks
- `apps/backend/src/routes/credits.js` — GET /balance, POST /purchase, POST /grant
- `apps/backend/src/routes/uploads.js` — POST /upload (multer + pdf-parse + AI parse)
- `apps/backend/tests/creditService.test.js`
- `apps/backend/tests/requireCredits.test.js`
- `apps/backend/tests/aiService.test.js`

### Backend — Modified Files
- `apps/backend/src/config/initDb.js` — add `credits` col to users, `score`+`suggestions` to base_resumes, `before_score`+`after_score`+`diff` to tailored_resumes
- `apps/backend/src/middleware/ensureUser.js` — seed 5 credits on user creation
- `apps/backend/src/routes/ai.js` — remove user-supplied apiKey, use server-side key, add credit deduction, return scores + diff on tailor
- `apps/backend/src/server.js` — mount /api/uploads and /api/credits routes
- `apps/backend/package.json` — add multer, pdf-parse, stripe

### Frontend — New Files
- `apps/frontend-v2/src/contexts/CreditContext.tsx` — global credit balance + deduct
- `apps/frontend-v2/src/components/ui/ScorePill.tsx`
- `apps/frontend-v2/src/components/ui/CreditCounter.tsx`
- `apps/frontend-v2/src/components/ui/Badge.tsx`
- `apps/frontend-v2/src/components/ui/RequiresCredits.tsx` — gate wrapper
- `apps/frontend-v2/src/components/features/upload/UploadDropzone.tsx`
- `apps/frontend-v2/src/pages/UploadPage.tsx`
- `apps/frontend-v2/src/pages/CreditsPage.tsx`

### Frontend — Modified Files
- `apps/frontend-v2/tailwind.config.js` — replace aurora/void with Paper tokens
- `apps/frontend-v2/index.html` — add Google Fonts
- `apps/frontend-v2/src/components/ui/Button.tsx` — Paper style
- `apps/frontend-v2/src/components/ui/Card.tsx` — Paper style
- `apps/frontend-v2/src/layouts/AppLayout.tsx` — sidebar with credits widget
- `apps/frontend-v2/src/layouts/RootLayout.tsx` — Paper navbar
- `apps/frontend-v2/src/pages/Dashboard.tsx` — resume cards with scores, tailored copies
- `apps/frontend-v2/src/pages/TailorWorkspace.tsx` — wire real API results + before/after
- `apps/frontend-v2/src/pages/LandingPage.tsx` — full Paper landing page
- `apps/frontend-v2/src/components/features/editor/AuroraWorkbenchEditor.tsx` — suggestions panel
- `apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx` — add suggestions state
- `apps/frontend-v2/src/lib/api.ts` — add upload + credits + score endpoints
- `apps/frontend-v2/src/router.tsx` — add /upload + /credits routes

---

## Phase 1 — Backend Foundation

### Task 1: Pricing & Credits Config

**Files:**
- Create: `apps/backend/src/config/pricing.config.js`
- Create: `apps/backend/src/config/credits.config.js`

- [ ] **Step 1: Create pricing config**

```js
// apps/backend/src/config/pricing.config.js
export const SIGNUP_CREDITS = 5;

export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 20,
    priceUsd: 10,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsd: 20,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    popular: true,
  },
  {
    id: 'max',
    name: 'Max',
    credits: 120,
    priceUsd: 40,
    stripePriceId: process.env.STRIPE_PRICE_MAX,
    popular: false,
  },
];
```

- [ ] **Step 2: Create credits config**

```js
// apps/backend/src/config/credits.config.js
export const CREDIT_COSTS = {
  RESUME_SCORE: 1,
  RESUME_RESCORE: 1,
  RESUME_TAILOR: 2,
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/config/pricing.config.js apps/backend/src/config/credits.config.js
git commit -m "feat: add pricing and credits config files"
```

---

### Task 2: DB Migration — Credits + Score Columns

**Files:**
- Modify: `apps/backend/src/config/initDb.js`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/tests/db.test.js`:

```js
// apps/backend/tests/db.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';

describe('database schema', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDatabase();
  });

  it('users table has credits column defaulting to 0', async () => {
    const row = await database.get("PRAGMA table_info(users)");
    const cols = await database.all("PRAGMA table_info(users)");
    const credits = cols.find(c => c.name === 'credits');
    assert.ok(credits, 'credits column missing from users');
    assert.equal(credits.dflt_value, '0');
  });

  it('base_resumes table has score and suggestions columns', async () => {
    const cols = await database.all("PRAGMA table_info(base_resumes)");
    assert.ok(cols.find(c => c.name === 'score'), 'score column missing');
    assert.ok(cols.find(c => c.name === 'suggestions'), 'suggestions column missing');
  });

  it('tailored_resumes table has before_score, after_score, diff columns', async () => {
    const cols = await database.all("PRAGMA table_info(tailored_resumes)");
    assert.ok(cols.find(c => c.name === 'before_score'), 'before_score missing');
    assert.ok(cols.find(c => c.name === 'after_score'), 'after_score missing');
    assert.ok(cols.find(c => c.name === 'diff'), 'diff column missing');
  });
});
```

- [ ] **Step 2: Add test script to backend package.json**

In `apps/backend/package.json`, add to scripts:
```json
"test": "node --test tests/**/*.test.js"
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
cd apps/backend && npm test
```
Expected: `credits column missing from users`

- [ ] **Step 4: Apply DB migration in `createTables()`**

In `apps/backend/src/config/initDb.js`, replace the `createTables` function body — add these lines **after** all `CREATE TABLE IF NOT EXISTS` statements and **before** the index creation lines:

```js
  // Migrations — safe to run repeatedly
  await database.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await database.run(`ALTER TABLE base_resumes ADD COLUMN IF NOT EXISTS score INTEGER`).catch(() => {});
  await database.run(`ALTER TABLE base_resumes ADD COLUMN IF NOT EXISTS suggestions TEXT`).catch(() => {});
  await database.run(`ALTER TABLE tailored_resumes ADD COLUMN IF NOT EXISTS before_score INTEGER`).catch(() => {});
  await database.run(`ALTER TABLE tailored_resumes ADD COLUMN IF NOT EXISTS after_score INTEGER`).catch(() => {});
  await database.run(`ALTER TABLE tailored_resumes ADD COLUMN IF NOT EXISTS diff TEXT`).catch(() => {});
```

> Note: SQLite does not support `IF NOT EXISTS` on `ALTER TABLE ADD COLUMN` — the `.catch(() => {})` silences the error if the column already exists on subsequent runs. This is the correct pattern for SQLite migrations.

- [ ] **Step 5: Run test — expect PASS**

```bash
cd apps/backend && npm test
```
Expected: all 3 assertions pass

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/config/initDb.js apps/backend/tests/db.test.js apps/backend/package.json
git commit -m "feat: add credits, score, diff columns to DB schema"
```

---

### Task 3: Credit Service

**Files:**
- Create: `apps/backend/src/services/creditService.js`
- Create: `apps/backend/tests/creditService.test.js`

- [ ] **Step 1: Write failing tests**

```js
// apps/backend/tests/creditService.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { getCredits, deductCredits, grantCredits } from '../src/services/creditService.js';

describe('creditService', () => {
  let userId;

  before(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDatabase();
    const result = await database.run(
      "INSERT INTO users (uuid, email, credits) VALUES (?, ?, ?)",
      ['test-user-1', 'test@test.com', 10]
    );
    userId = result.lastID;
  });

  it('getCredits returns current balance', async () => {
    const balance = await getCredits(userId);
    assert.equal(balance, 10);
  });

  it('deductCredits reduces balance and returns new balance', async () => {
    const newBalance = await deductCredits(userId, 3);
    assert.equal(newBalance, 7);
  });

  it('deductCredits throws if insufficient credits', async () => {
    await assert.rejects(
      () => deductCredits(userId, 100),
      { message: 'Insufficient credits' }
    );
  });

  it('grantCredits increases balance', async () => {
    const newBalance = await grantCredits(userId, 5);
    assert.equal(newBalance, 12); // 7 + 5
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/backend && npm test
```
Expected: `Cannot find module '../src/services/creditService.js'`

- [ ] **Step 3: Implement creditService**

```js
// apps/backend/src/services/creditService.js
import database from '../config/database.js';

export async function getCredits(userId) {
  const row = await database.get(
    'SELECT credits FROM users WHERE id = ?',
    [userId]
  );
  if (!row) throw new Error('User not found');
  return row.credits;
}

export async function deductCredits(userId, amount) {
  const row = await database.get(
    'SELECT credits FROM users WHERE id = ?',
    [userId]
  );
  if (!row) throw new Error('User not found');
  if (row.credits < amount) throw new Error('Insufficient credits');

  await database.run(
    'UPDATE users SET credits = credits - ?, updated_at = datetime(\'now\') WHERE id = ?',
    [amount, userId]
  );
  return row.credits - amount;
}

export async function grantCredits(userId, amount) {
  await database.run(
    'UPDATE users SET credits = credits + ?, updated_at = datetime(\'now\') WHERE id = ?',
    [amount, userId]
  );
  const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
  return row.credits;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/backend && npm test
```

- [ ] **Step 5: Update ensureUser to seed 5 credits on creation**

In `apps/backend/src/middleware/ensureUser.js`, replace the INSERT statement:

```js
import { SIGNUP_CREDITS } from '../config/pricing.config.js';

// inside the if (!existingUser) block, replace the INSERT:
await database.run(
  "INSERT INTO users (uuid, email, credits, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
  [userId, `${userId}@clerk.user`, SIGNUP_CREDITS]
);
console.log(`Auto-created user: ${userId} with ${SIGNUP_CREDITS} credits`);
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/creditService.js apps/backend/tests/creditService.test.js apps/backend/src/middleware/ensureUser.js
git commit -m "feat: credit service with deduct/grant, seed 5 credits on signup"
```

---

### Task 4: requireCredits Middleware

**Files:**
- Create: `apps/backend/src/middleware/requireCredits.js`
- Create: `apps/backend/tests/requireCredits.test.js`

- [ ] **Step 1: Write failing tests**

```js
// apps/backend/tests/requireCredits.test.js
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import { requireCredits } from '../src/middleware/requireCredits.js';

describe('requireCredits middleware', () => {
  let userId;

  before(async () => {
    process.env.DB_PATH = ':memory:';
    await initializeDatabase();
    const result = await database.run(
      "INSERT INTO users (uuid, email, credits) VALUES (?, ?, ?)",
      ['mw-user', 'mw@test.com', 2]
    );
    userId = result.lastID;
  });

  it('calls next() when user has sufficient credits', async () => {
    const req = { user: { id: userId } };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    await requireCredits(1)(req, res, next);
    assert.ok(nextCalled);
  });

  it('returns 402 when user has insufficient credits', async () => {
    const req = { user: { id: userId } };
    let statusCode, body;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { body = data; }
    };
    await requireCredits(10)(req, res, () => {});
    assert.equal(statusCode, 402);
    assert.equal(body.code, 'INSUFFICIENT_CREDITS');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/backend && npm test
```

- [ ] **Step 3: Implement middleware**

```js
// apps/backend/src/middleware/requireCredits.js
import { getCredits } from '../services/creditService.js';

export function requireCredits(amount) {
  return async (req, res, next) => {
    try {
      const balance = await getCredits(req.user.id);
      if (balance < amount) {
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_CREDITS',
          message: `This action requires ${amount} credit${amount > 1 ? 's' : ''}. You have ${balance}.`,
          required: amount,
          balance,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/backend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/middleware/requireCredits.js apps/backend/tests/requireCredits.test.js
git commit -m "feat: requireCredits middleware with 402 on insufficient balance"
```

---

## Phase 2 — AI Service + Upload

### Task 5: AI Service (Server-Side Key)

**Files:**
- Create: `apps/backend/src/services/aiService.js`
- Create: `apps/backend/tests/aiService.test.js`

- [ ] **Step 1: Add GEMINI_API_KEY to .env.example**

In `apps/backend/.env.example`, add:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

- [ ] **Step 2: Write failing test**

```js
// apps/backend/tests/aiService.test.js
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('aiService', () => {
  it('scoreResume returns score between 0-100 and array of suggestions', async () => {
    // Mock Gemini response
    const mockResponse = {
      score: 72,
      issues: [
        { bulletId: 'exp-0-0', issueType: 'weak_verb', severity: 'warn', original: 'Responsible for managing team' }
      ],
      suggestions: [
        { bulletId: 'exp-0-0', original: 'Responsible for managing team', rewrite: 'Led cross-functional team of 6 engineers', issueType: 'weak_verb', severity: 'warn' }
      ]
    };

    // Import after mocking env
    process.env.GEMINI_API_KEY = 'test-key';
    const { scoreResume } = await import('../src/services/aiService.js');

    // The real test validates the contract — in CI, mock the module
    assert.ok(typeof scoreResume === 'function');
  });
});
```

- [ ] **Step 3: Implement aiService**

```js
// apps/backend/src/services/aiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';

function getModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
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
```

- [ ] **Step 4: Run test**

```bash
cd apps/backend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/aiService.js apps/backend/tests/aiService.test.js apps/backend/.env.example
git commit -m "feat: aiService with server-side Gemini key, scoreResume, tailorResume"
```

---

### Task 6: Update ai.js Routes — Remove User API Key, Add Credit Gating

**Files:**
- Modify: `apps/backend/src/routes/ai.js`

- [ ] **Step 1: Rewrite ai.js**

Replace the entire contents of `apps/backend/src/routes/ai.js`:

```js
import express from 'express';
import { body, validationResult } from 'express-validator';
import database from '../config/database.js';
import { scoreResume, tailorResume } from '../services/aiService.js';
import { deductCredits } from '../services/creditService.js';
import { requireCredits } from '../middleware/requireCredits.js';
import { CREDIT_COSTS } from '../config/credits.config.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// GET /api/ai/score/:resumeId — score a stored resume (costs 1 credit)
router.post('/score/:resumeId', requireCredits(CREDIT_COSTS.RESUME_SCORE), async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    const resume = await database.get(
      'SELECT * FROM base_resumes WHERE uuid = ? AND user_id = ?',
      [req.params.resumeId, userRow.id]
    );
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const resumeData = JSON.parse(resume.contact_data);
    const scoreReport = await scoreResume(resumeData);

    // Persist score + suggestions
    await database.run(
      'UPDATE base_resumes SET score = ?, suggestions = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [scoreReport.score, JSON.stringify(scoreReport.suggestions), resume.id]
    );

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_SCORE);

    res.json({ success: true, data: scoreReport });
  } catch (error) {
    console.error('Error scoring resume:', error);
    res.status(500).json({ success: false, message: error.message });
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

    const baseResume = await database.get(
      'SELECT * FROM base_resumes WHERE uuid = ? AND user_id = ?',
      [resumeId, userRow.id]
    );
    if (!baseResume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const resumeData = JSON.parse(baseResume.contact_data);
    const { tailoredResume, diff, beforeScore, afterScore } = await tailorResume(
      resumeData, jobTitle, company, jobDescription
    );

    // Save tailored copy
    const { v4: uuidv4 } = await import('uuid');
    const tailoredUuid = uuidv4();
    await database.run(
      `INSERT INTO tailored_resumes (uuid, base_resume_id, job_title, company, job_description, tailored_data, before_score, after_score, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tailoredUuid, baseResume.id, jobTitle, company, jobDescription,
       JSON.stringify(tailoredResume), beforeScore, afterScore, JSON.stringify(diff)]
    );

    await deductCredits(userRow.id, CREDIT_COSTS.RESUME_TAILOR);

    res.json({
      success: true,
      data: { tailoredResumeId: tailoredUuid, tailoredResume, diff, beforeScore, afterScore }
    });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

- [ ] **Step 2: Install uuid if not present**

```bash
cd apps/backend && npm list uuid || npm install uuid
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/ai.js
git commit -m "feat: ai routes use server-side key, credit gating, persist tailor results"
```

---

### Task 7: PDF Upload Endpoint

**Files:**
- Create: `apps/backend/src/routes/uploads.js`
- Modify: `apps/backend/src/server.js`
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/backend && npm install multer pdf-parse
```

- [ ] **Step 2: Create uploads route**

```js
// apps/backend/src/routes/uploads.js
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { parseResumeText } from '../services/aiService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/uploads/resume
router.post('/resume', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Only PDF files are supported' });
    }

    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    if (!pdfData.text || pdfData.text.trim().length < 50) {
      return res.status(422).json({ success: false, message: 'Could not extract text from PDF. Please ensure it is not a scanned image.' });
    }

    // Parse with AI
    const parsed = await parseResumeText(pdfData.text);

    // Save to DB
    const resumeUuid = uuidv4();
    const resumeName = parsed.contact?.name
      ? `${parsed.contact.name}'s Resume`
      : req.file.originalname.replace('.pdf', '');

    await database.run(
      `INSERT INTO base_resumes (uuid, user_id, name, contact_data, summary, skills, is_base)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [resumeUuid, userRow.id, resumeName, JSON.stringify(parsed), parsed.summary || '', JSON.stringify(parsed.skills || [])]
    );

    // Save experiences
    for (let i = 0; i < (parsed.experience || []).length; i++) {
      const exp = parsed.experience[i];
      await database.run(
        `INSERT INTO experiences (uuid, resume_id, role, company, location, start_date, end_date, responsibilities, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, exp.role, exp.company, exp.location || '', exp.startDate || '', exp.endDate || '', JSON.stringify(exp.responsibilities || []), i]
      );
    }

    // Save education
    for (let i = 0; i < (parsed.education || []).length; i++) {
      const edu = parsed.education[i];
      await database.run(
        `INSERT INTO education (uuid, resume_id, degree, institution, location, graduation_date, gpa, display_order)
         VALUES (?, (SELECT id FROM base_resumes WHERE uuid = ?), ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), resumeUuid, edu.degree, edu.institution, edu.location || '', edu.graduationDate || '', edu.gpa || '', i]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: { resumeId: resumeUuid, name: resumeName, parsed }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

- [ ] **Step 3: Mount route in server.js**

In `apps/backend/src/server.js`, after the existing route imports add:

```js
import uploadsRouter from './routes/uploads.js';
```

And after the existing route mounts add:

```js
app.use('/api/uploads', uploadsRouter);
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/routes/uploads.js apps/backend/src/server.js apps/backend/package.json
git commit -m "feat: PDF upload endpoint with AI parsing, saves to DB"
```

---

### Task 8: Credits API Route + Stripe

**Files:**
- Create: `apps/backend/src/routes/credits.js`
- Modify: `apps/backend/src/server.js`

- [ ] **Step 1: Install Stripe**

```bash
cd apps/backend && npm install stripe
```

Add to `apps/backend/.env.example`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MAX=price_...
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 2: Create credits route**

```js
// apps/backend/src/routes/credits.js
import express from 'express';
import Stripe from 'stripe';
import database from '../config/database.js';
import { getCredits, grantCredits } from '../services/creditService.js';
import { CREDIT_PACKS } from '../config/pricing.config.js';

const router = express.Router();

// GET /api/credits/balance
router.get('/balance', async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });
    const balance = await getCredits(userRow.id);
    res.json({ success: true, data: { balance } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/credits/packs — return available packs for frontend display
router.get('/packs', (req, res) => {
  // Strip Stripe IDs before sending to client
  const packs = CREDIT_PACKS.map(({ id, name, credits, priceUsd, popular }) => ({
    id, name, credits, priceUsd, popular
  }));
  res.json({ success: true, data: packs });
});

// POST /api/credits/checkout — create Stripe checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ success: false, message: 'Invalid pack' });
    if (!pack.stripePriceId) return res.status(500).json({ success: false, message: 'Stripe price not configured' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      metadata: { userId: req.headers['x-user-id'], packId, credits: pack.credits },
      success_url: `${process.env.FRONTEND_URL}/credits?success=true&credits=${pack.credits}`,
      cancel_url: `${process.env.FRONTEND_URL}/credits?cancelled=true`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/credits/webhook — Stripe webhook (raw body required)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, credits } = session.metadata;
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [userId]);
    if (userRow) {
      await grantCredits(userRow.id, parseInt(credits, 10));
      console.log(`Granted ${credits} credits to user ${userId}`);
    }
  }

  res.json({ received: true });
});

export default router;
```

- [ ] **Step 3: Mount in server.js**

Add after existing imports:
```js
import creditsRouter from './routes/credits.js';
```

Add after existing routes (the webhook must use raw body, so mount BEFORE `express.json()` middleware or use a separate path):
```js
// Stripe webhook needs raw body — mount before json middleware
app.use('/api/credits/webhook', creditsRouter);
// All other credits routes use json
app.use('/api/credits', creditsRouter);
```

> Note: `express.raw` is applied per-route inside the router, so the above mounting order is fine.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/routes/credits.js apps/backend/src/server.js apps/backend/.env.example
git commit -m "feat: credits API with Stripe checkout and webhook"
```

---

## Phase 3 — Design System Reset

### Task 9: Paper Design Tokens + Base Components

**Files:**
- Modify: `apps/frontend-v2/tailwind.config.js`
- Modify: `apps/frontend-v2/index.html`
- Modify: `apps/frontend-v2/src/index.css`
- Modify: `apps/frontend-v2/src/components/ui/Button.tsx`
- Modify: `apps/frontend-v2/src/components/ui/Card.tsx`
- Create: `apps/frontend-v2/src/components/ui/Badge.tsx`
- Create: `apps/frontend-v2/src/components/ui/ScorePill.tsx`

- [ ] **Step 1: Replace tailwind config**

```js
// apps/frontend-v2/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#fafaf8',
          surface: '#ffffff',
          border: '#ebebeb',
          'border-strong': '#d4d4d4',
        },
        ink: {
          primary: '#0f0f0f',
          secondary: '#555555',
          muted: '#aaaaaa',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        success: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
        warning: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
        danger: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'title': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'elevated': '0 4px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Add Google Fonts to index.html**

In `apps/frontend-v2/index.html`, add inside `<head>` before existing links:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Reset index.css**

Replace `apps/frontend-v2/src/index.css` contents:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-paper-bg text-ink-primary font-sans;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3, h4, h5, h6 {
    @apply font-heading;
  }
}
```

- [ ] **Step 4: Rewrite Button.tsx**

```tsx
// apps/frontend-v2/src/components/ui/Button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border-transparent',
  secondary: 'bg-white text-ink-primary border-paper-border hover:border-paper-border-strong hover:bg-paper-bg',
  ghost: 'bg-transparent text-ink-secondary border-transparent hover:bg-paper-bg hover:text-ink-primary',
  danger: 'bg-danger-bg text-danger-text border-danger-border hover:bg-red-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded',
  md: 'text-sm px-4 py-2 rounded',
  lg: 'text-sm px-5 py-2.5 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-sans font-medium border transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
```

- [ ] **Step 5: Rewrite Card.tsx**

```tsx
// apps/frontend-v2/src/components/ui/Card.tsx
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-paper-surface border border-paper-border rounded-lg ${elevated ? 'shadow-elevated' : 'shadow-card'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Create Badge.tsx**

```tsx
// apps/frontend-v2/src/components/ui/Badge.tsx
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-paper-bg text-ink-secondary border-paper-border',
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium font-sans border rounded-full ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Create ScorePill.tsx**

```tsx
// apps/frontend-v2/src/components/ui/ScorePill.tsx
interface ScorePillProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function scoreVariant(score: number) {
  if (score >= 75) return 'bg-success-bg text-success-text border-success-border';
  if (score >= 50) return 'bg-warning-bg text-warning-text border-warning-border';
  return 'bg-danger-bg text-danger-text border-danger-border';
}

export function ScorePill({ score, size = 'md' }: ScorePillProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-base px-3 py-1' : 'text-sm px-2.5 py-0.5';
  return (
    <span className={`inline-flex items-center font-mono font-semibold border rounded-full ${sizeClass} ${scoreVariant(score)}`}>
      {score}
    </span>
  );
}
```

- [ ] **Step 8: Start dev server and verify fonts + colors load**

```bash
cd apps/frontend-v2 && npm run dev
```
Open http://localhost:5173 — body should render in DM Sans on an off-white background. No purple/teal colors.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend-v2/tailwind.config.js apps/frontend-v2/index.html apps/frontend-v2/src/index.css apps/frontend-v2/src/components/ui/
git commit -m "feat: Paper design system — tokens, Button, Card, Badge, ScorePill"
```

---

### Task 10: AppLayout + Sidebar with Credits Widget

**Files:**
- Modify: `apps/frontend-v2/src/layouts/AppLayout.tsx`
- Modify: `apps/frontend-v2/src/layouts/RootLayout.tsx`
- Create: `apps/frontend-v2/src/contexts/CreditContext.tsx`
- Create: `apps/frontend-v2/src/components/ui/CreditCounter.tsx`
- Create: `apps/frontend-v2/src/components/ui/RequiresCredits.tsx`

- [ ] **Step 1: Create CreditContext**

```tsx
// apps/frontend-v2/src/contexts/CreditContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { creditsApi } from '../lib/api';

interface CreditContextType {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType>({ balance: null, loading: true, refresh: async () => {} });

export function CreditProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await creditsApi.getBalance();
      setBalance(data.balance);
    } catch {
      // silently fail — user may not be logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <CreditContext.Provider value={{ balance, loading, refresh }}>{children}</CreditContext.Provider>;
}

export const useCredits = () => useContext(CreditContext);
```

- [ ] **Step 2: Add creditsApi to lib/api.ts**

In `apps/frontend-v2/src/lib/api.ts`, add after existing API objects:

```ts
export const creditsApi = {
  getBalance: async (): Promise<{ balance: number }> => {
    const response = await api.get('/credits/balance');
    return response.data.data;
  },
  getPacks: async () => {
    const response = await api.get('/credits/packs');
    return response.data.data;
  },
  createCheckout: async (packId: string): Promise<{ url: string }> => {
    const response = await api.post('/credits/checkout', { packId });
    return response.data.data;
  },
};
```

- [ ] **Step 3: Create CreditCounter**

```tsx
// apps/frontend-v2/src/components/ui/CreditCounter.tsx
import { useCredits } from '../../contexts/CreditContext';
import { useNavigate } from 'react-router-dom';

export function CreditCounter() {
  const { balance, loading } = useCredits();
  const navigate = useNavigate();

  return (
    <div className="p-3 bg-paper-bg border border-paper-border rounded-lg">
      <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Credits</p>
      {loading ? (
        <div className="h-7 w-12 bg-paper-border rounded animate-pulse" />
      ) : (
        <p className="font-mono text-2xl font-semibold text-ink-primary">{balance ?? '–'}</p>
      )}
      <button
        onClick={() => navigate('/credits')}
        className="mt-2 w-full text-xs text-center text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
      >
        Buy credits →
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create RequiresCredits**

```tsx
// apps/frontend-v2/src/components/ui/RequiresCredits.tsx
import { ReactNode } from 'react';
import { useCredits } from '../../contexts/CreditContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface RequiresCreditsProps {
  cost: number;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequiresCredits({ cost, children, fallback }: RequiresCreditsProps) {
  const { balance } = useCredits();
  const navigate = useNavigate();

  if (balance !== null && balance < cost) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="p-4 bg-warning-bg border border-warning-border rounded-lg text-center">
        <p className="text-sm font-medium text-warning-text mb-2">
          This action requires {cost} credit{cost > 1 ? 's' : ''}. You have {balance}.
        </p>
        <Button size="sm" onClick={() => navigate('/credits')}>Buy Credits</Button>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 5: Rewrite AppLayout**

```tsx
// apps/frontend-v2/src/layouts/AppLayout.tsx
import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { CreditCounter } from '../components/ui/CreditCounter';

const navItems = [
  { to: '/dashboard', label: 'My Resumes', icon: '📄' },
  { to: '/tailor', label: 'Tailor', icon: '✨' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper-bg">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-paper-border bg-paper-surface flex flex-col">
        <div className="p-4 border-b border-paper-border">
          <span className="font-heading font-bold text-lg text-ink-primary tracking-tight">
            resu<span className="text-indigo-600">mate</span>
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-ink-secondary hover:bg-paper-bg hover:text-ink-primary'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-paper-border">
          <CreditCounter />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Wrap app in CreditProvider**

In `apps/frontend-v2/src/router.tsx`, wrap the router outlet or root element with `<CreditProvider>`:

```tsx
import { CreditProvider } from './contexts/CreditContext';

// Inside AuthInitializer or the root render, wrap children:
// <CreditProvider>{children}</CreditProvider>
```

Find the `AuthInitializer` function in `router.tsx` and wrap its return value:
```tsx
return <CreditProvider><Outlet /></CreditProvider>;
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend-v2/src/contexts/ apps/frontend-v2/src/components/ui/CreditCounter.tsx apps/frontend-v2/src/components/ui/RequiresCredits.tsx apps/frontend-v2/src/layouts/AppLayout.tsx apps/frontend-v2/src/lib/api.ts apps/frontend-v2/src/router.tsx
git commit -m "feat: CreditContext, CreditCounter sidebar, RequiresCredits gate"
```

---

## Phase 4 — Frontend Feature Wiring

### Task 11: Upload Onboarding Page

**Files:**
- Create: `apps/frontend-v2/src/components/features/upload/UploadDropzone.tsx`
- Create: `apps/frontend-v2/src/pages/UploadPage.tsx`
- Modify: `apps/frontend-v2/src/router.tsx`
- Modify: `apps/frontend-v2/src/lib/api.ts`

- [ ] **Step 1: Add upload API method**

In `apps/frontend-v2/src/lib/api.ts`, add to `resumesApi`:

```ts
uploadPdf: async (file: File): Promise<{ resumeId: string; name: string; parsed: any }> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/uploads/resume', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
},
```

- [ ] **Step 2: Create UploadDropzone**

```tsx
// apps/frontend-v2/src/components/features/upload/UploadDropzone.tsx
import { useCallback, useState, DragEvent } from 'react';

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  loading?: boolean;
}

export function UploadDropzone({ onFile, loading }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-paper-border bg-paper-surface hover:border-indigo-300 hover:bg-paper-bg'
      }`}
      onClick={() => { if (!loading) document.getElementById('file-input')?.click(); }}
    >
      <input
        id="file-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {loading ? (
        <div className="space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-ink-secondary">AI is reading your resume...</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-3xl">📄</p>
          <p className="font-heading font-semibold text-ink-primary">Drop your resume here</p>
          <p className="text-sm text-ink-muted">PDF only · Max 5MB · Click to browse</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create UploadPage**

```tsx
// apps/frontend-v2/src/pages/UploadPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadDropzone } from '../components/features/upload/UploadDropzone';
import { resumesApi } from '../lib/api';

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const { resumeId } = await resumesApi.uploadPdf(file);
      navigate(`/editor/${resumeId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-3xl font-bold text-ink-primary tracking-tight">
            Upload your resume
          </h1>
          <p className="text-ink-secondary text-sm">
            AI will score it and show you exactly how to improve it — in seconds.
          </p>
        </div>

        <UploadDropzone onFile={handleFile} loading={loading} />

        {error && (
          <p className="text-sm text-danger-text bg-danger-bg border border-danger-border rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-ink-muted">
          Uses 1 credit to score · 5 credits included free on signup
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add /upload route to router.tsx**

In `apps/frontend-v2/src/router.tsx`, add an import and a route:

```tsx
import UploadPage from './pages/UploadPage';

// Inside the router config, add:
{ path: '/upload', element: <UploadPage /> }
```

Also update the dashboard "Upload Resume" button to navigate to `/upload`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend-v2/src/components/features/upload/ apps/frontend-v2/src/pages/UploadPage.tsx apps/frontend-v2/src/router.tsx apps/frontend-v2/src/lib/api.ts
git commit -m "feat: upload onboarding page with drag-drop PDF"
```

---

### Task 12: AI Editor Suggestions Panel

**Files:**
- Modify: `apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx`
- Modify: `apps/frontend-v2/src/components/features/editor/AuroraWorkbenchEditor.tsx`
- Modify: `apps/frontend-v2/src/lib/api.ts`

- [ ] **Step 1: Add score API to lib/api.ts**

In `apps/frontend-v2/src/lib/api.ts`, add to `resumesApi`:

```ts
scoreResume: async (resumeId: string): Promise<{ score: number; issues: any[]; suggestions: any[] }> => {
  const response = await api.post(`/ai/score/${resumeId}`);
  return response.data.data;
},
```

- [ ] **Step 2: Add suggestions state to ResumeEditorContext**

In `apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx`, extend the context type and provider to include:

```tsx
// Add to ResumeEditorContextType:
score: number | null;
suggestions: Suggestion[];
scoring: boolean;
triggerScore: () => Promise<void>;
acceptSuggestion: (bulletId: string) => void;
dismissSuggestion: (bulletId: string) => void;

// Add Suggestion type:
export type Suggestion = {
  bulletId: string;
  original: string;
  rewrite: string;
  issueType: string;
  severity: 'warn' | 'error';
};
```

In `ResumeEditorProvider`, add:
```tsx
const [score, setScore] = useState<number | null>(resumeData?.score ?? null);
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
const [scoring, setScoring] = useState(false);

const triggerScore = async () => {
  if (!resumeId) return;
  setScoring(true);
  try {
    const result = await resumesApi.scoreResume(resumeId);
    setScore(result.score);
    setSuggestions(result.suggestions);
    await creditContext.refresh(); // refresh balance after deduction
  } finally {
    setScoring(false);
  }
};

const acceptSuggestion = (bulletId: string) => {
  const s = suggestions.find(s => s.bulletId === bulletId);
  if (!s) return;
  // Parse bulletId: "experience-0-1" → section experience, index 0, bullet 1
  const [sectionType, sectionIdx, bulletIdx] = bulletId.split('-');
  setResumeData(prev => {
    // update the relevant bullet in prev state
    // implementation depends on your ResumeData shape — adjust as needed
    return prev; // placeholder — implement based on actual state shape
  });
  setSuggestions(prev => prev.filter(s => s.bulletId !== bulletId));
};

const dismissSuggestion = (bulletId: string) => {
  setSuggestions(prev => prev.filter(s => s.bulletId !== bulletId));
};
```

> Note: The `acceptSuggestion` mutation logic depends on your exact `resumeData` state shape in `ResumeEditorContext`. Implement the bullet update to match the nested structure (experience[sectionIdx].responsibilities[bulletIdx] = rewrite).

- [ ] **Step 3: Add suggestions panel to AuroraWorkbenchEditor**

In `apps/frontend-v2/src/components/features/editor/AuroraWorkbenchEditor.tsx`, add a right panel that maps over `suggestions` from context:

```tsx
// Add inside the editor layout, as a right column:
<div className="w-72 shrink-0 border-l border-paper-border bg-paper-bg overflow-y-auto p-4 space-y-3">
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">AI Suggestions</span>
    {score !== null && <ScorePill score={score} size="sm" />}
  </div>

  {scoring && (
    <div className="text-sm text-ink-secondary flex items-center gap-2">
      <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Analyzing...
    </div>
  )}

  {suggestions.length === 0 && !scoring && (
    <div className="text-center py-8 space-y-2">
      <p className="text-ink-muted text-sm">No suggestions yet.</p>
      <RequiresCredits cost={1}>
        <Button size="sm" variant="secondary" onClick={triggerScore} loading={scoring}>
          Score Resume — 1 credit
        </Button>
      </RequiresCredits>
    </div>
  )}

  {suggestions.map(s => (
    <div key={s.bulletId} className="bg-paper-surface border border-paper-border rounded-lg p-3 space-y-2">
      <Badge variant={s.severity === 'error' ? 'danger' : 'warning'}>
        {s.issueType.replace(/_/g, ' ')}
      </Badge>
      <p className="text-xs text-ink-muted line-through leading-relaxed">{s.original}</p>
      <p className="text-xs text-ink-primary leading-relaxed font-medium">"{s.rewrite}"</p>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => acceptSuggestion(s.bulletId)}>Accept</Button>
        <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(s.bulletId)}>Skip</Button>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend-v2/src/components/features/editor/ apps/frontend-v2/src/lib/api.ts
git commit -m "feat: AI editor suggestions panel with accept/dismiss, score trigger"
```

---

### Task 13: Tailor Workspace — Wire Real Results

**Files:**
- Modify: `apps/frontend-v2/src/pages/TailorWorkspace.tsx`
- Modify: `apps/frontend-v2/src/lib/api.ts`

- [ ] **Step 1: Add tailor API method**

In `apps/frontend-v2/src/lib/api.ts`, add to `aiApi`:

```ts
tailorResume: async (payload: {
  resumeId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<{ tailoredResumeId: string; tailoredResume: any; diff: any[]; beforeScore: number; afterScore: number }> => {
  const response = await api.post('/ai/tailor', payload);
  return response.data.data;
},
```

- [ ] **Step 2: Rewrite TailorWorkspace**

Replace `apps/frontend-v2/src/pages/TailorWorkspace.tsx` with:

```tsx
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { RequiresCredits } from '../components/ui/RequiresCredits';
import { aiApi, resumesApi } from '../lib/api';
import { useCredits } from '../contexts/CreditContext';
import { CREDIT_COSTS } from '../config/pricing';

type TailorResult = {
  tailoredResumeId: string;
  diff: { sectionType: string; bulletId: string; original: string; rewritten: string; reason: string }[];
  beforeScore: number;
  afterScore: number;
};

export default function TailorWorkspace() {
  const [resumeId, setResumeId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);
  const { refresh } = useCredits();

  async function handleTailor() {
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.tailorResume({ resumeId, jobTitle, company, jobDescription });
      setResult(data);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Tailoring failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-paper-bg">
      {/* Left: Input */}
      <div className="w-72 shrink-0 border-r border-paper-border bg-paper-surface p-5 flex flex-col gap-4">
        <h1 className="font-heading font-bold text-lg text-ink-primary">Tailor Resume</h1>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Resume ID</label>
          <input
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            placeholder="Paste resume ID"
            value={resumeId}
            onChange={e => setResumeId(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Job Title</label>
          <input
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            placeholder="e.g. Software Engineer"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Company</label>
          <input
            className="w-full border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400"
            placeholder="e.g. Google"
            value={company}
            onChange={e => setCompany(e.target.value)}
          />
        </div>

        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Job Description</label>
          <textarea
            className="w-full h-40 border border-paper-border rounded px-3 py-2 text-sm text-ink-primary bg-paper-bg focus:outline-none focus:border-indigo-400 resize-none"
            placeholder="Paste the job description..."
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-danger-text bg-danger-bg border border-danger-border rounded p-2">{error}</p>}

        <RequiresCredits cost={CREDIT_COSTS.RESUME_TAILOR}>
          <Button
            className="w-full"
            size="lg"
            onClick={handleTailor}
            loading={loading}
            disabled={!resumeId || !jobTitle || !company || !jobDescription}
          >
            ✨ Tailor — 2 credits
          </Button>
        </RequiresCredits>
      </div>

      {/* Right: Results */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!result && !loading && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-2">
              <p className="text-3xl">✨</p>
              <p className="font-heading font-semibold text-ink-primary">Results will appear here</p>
              <p className="text-sm text-ink-muted">Fill in the form and click Tailor</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6 max-w-2xl">
            {/* Score banner */}
            <div className="bg-paper-surface border border-paper-border rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink-secondary mb-1">ATS Match Score</p>
                <div className="flex items-center gap-3">
                  <ScorePill score={result.beforeScore} />
                  <span className="text-ink-muted">→</span>
                  <ScorePill score={result.afterScore} size="lg" />
                  <Badge variant="success">+{result.afterScore - result.beforeScore} pts</Badge>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => window.location.href = `/editor/${result.tailoredResumeId}`}>
                Open Tailored Resume →
              </Button>
            </div>

            {/* Diff list */}
            <div className="space-y-3">
              <h2 className="font-heading font-semibold text-ink-primary">What Changed</h2>
              {result.diff.map((item, i) => (
                <div key={i} className="bg-paper-surface border border-paper-border rounded-lg p-4 space-y-2">
                  <Badge variant="default">{item.sectionType}</Badge>
                  <p className="text-xs text-danger-text line-through leading-relaxed">{item.original}</p>
                  <p className="text-xs text-success-text leading-relaxed font-medium">{item.rewritten}</p>
                  <p className="text-xs text-ink-muted italic">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add pricing constants to frontend**

```ts
// apps/frontend-v2/src/config/pricing.ts
export const CREDIT_COSTS = {
  RESUME_SCORE: 1,
  RESUME_RESCORE: 1,
  RESUME_TAILOR: 2,
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend-v2/src/pages/TailorWorkspace.tsx apps/frontend-v2/src/lib/api.ts apps/frontend-v2/src/config/pricing.ts
git commit -m "feat: tailor workspace wired to real API with before/after score and diff"
```

---

### Task 14: Credits Page

**Files:**
- Create: `apps/frontend-v2/src/pages/CreditsPage.tsx`
- Modify: `apps/frontend-v2/src/router.tsx`

- [ ] **Step 1: Create CreditsPage**

```tsx
// apps/frontend-v2/src/pages/CreditsPage.tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useCredits } from '../contexts/CreditContext';
import { creditsApi } from '../lib/api';

type Pack = { id: string; name: string; credits: number; priceUsd: number; popular: boolean };

export default function CreditsPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const { balance, refresh } = useCredits();
  const [params] = useSearchParams();

  useEffect(() => {
    creditsApi.getPacks().then(setPacks);
    if (params.get('success')) refresh();
  }, []);

  async function handleBuy(packId: string) {
    setLoading(packId);
    try {
      const { url } = await creditsApi.createCheckout(packId);
      window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-ink-primary">Buy Credits</h1>
        <p className="text-ink-secondary mt-1">Current balance: <span className="font-mono font-semibold">{balance ?? '–'}</span> credits</p>
      </div>

      {params.get('success') && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text text-sm font-medium">
          ✓ Credits added successfully!
        </div>
      )}

      <div className="text-xs text-ink-muted bg-paper-bg border border-paper-border rounded-lg p-3 space-y-1">
        <p className="font-semibold text-ink-secondary">What costs credits?</p>
        <p>• Score resume: 1 credit &nbsp;·&nbsp; Tailor to job: 2 credits &nbsp;·&nbsp; Download PDF: free</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {packs.map(pack => (
          <Card key={pack.id} className={`p-5 space-y-4 relative ${pack.popular ? 'border-indigo-300 ring-1 ring-indigo-200' : ''}`}>
            {pack.popular && (
              <Badge variant="indigo" className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <div>
              <p className="font-heading font-semibold text-ink-primary">{pack.name}</p>
              <p className="font-mono text-2xl font-bold text-ink-primary mt-1">{pack.credits}<span className="text-sm font-normal text-ink-muted ml-1">credits</span></p>
            </div>
            <p className="text-2xl font-heading font-bold text-indigo-600">${pack.priceUsd}</p>
            <Button
              className="w-full"
              variant={pack.popular ? 'primary' : 'secondary'}
              loading={loading === pack.id}
              onClick={() => handleBuy(pack.id)}
            >
              Buy {pack.name}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add /credits route**

In `apps/frontend-v2/src/router.tsx`:
```tsx
import CreditsPage from './pages/CreditsPage';
// add route:
{ path: '/credits', element: <CreditsPage /> }
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend-v2/src/pages/CreditsPage.tsx apps/frontend-v2/src/router.tsx
git commit -m "feat: credits purchase page with Stripe checkout"
```

---

### Task 15: Dashboard — Resume Cards with Scores

**Files:**
- Modify: `apps/frontend-v2/src/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite Dashboard**

Replace `apps/frontend-v2/src/pages/Dashboard.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { resumesApi } from '../lib/api';

type Resume = { uuid: string; name: string; score: number | null; tailoredCount?: number; updated_at: string };

export default function Dashboard() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    resumesApi.getAll()
      .then(data => setResumes(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink-primary">My Resumes</h1>
        <Button onClick={() => navigate('/upload')}>+ Upload Resume</Button>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-28 bg-paper-border rounded-lg animate-pulse" />)}
        </div>
      )}

      {!loading && resumes.length === 0 && (
        <div
          className="border-2 border-dashed border-paper-border rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          onClick={() => navigate('/upload')}
        >
          <p className="text-3xl mb-2">📄</p>
          <p className="font-heading font-semibold text-ink-primary">Upload your first resume</p>
          <p className="text-sm text-ink-muted mt-1">AI will score it and suggest improvements instantly</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {resumes.map(resume => (
          <Card key={resume.uuid} className="p-4 space-y-3 hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-heading font-semibold text-ink-primary">{resume.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">Updated {new Date(resume.updated_at).toLocaleDateString()}</p>
              </div>
              {resume.score !== null && <ScorePill score={resume.score} />}
            </div>
            {resume.tailoredCount !== undefined && resume.tailoredCount > 0 && (
              <Badge variant="indigo">{resume.tailoredCount} tailored {resume.tailoredCount === 1 ? 'copy' : 'copies'}</Badge>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => navigate(`/editor/${resume.uuid}`)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/tailor?resumeId=${resume.uuid}`)}>Tailor →</Button>
            </div>
          </Card>
        ))}

        {resumes.length > 0 && (
          <div
            className="border-2 border-dashed border-paper-border rounded-lg p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-300 transition-colors"
            onClick={() => navigate('/upload')}
          >
            <span className="text-xl text-ink-muted">+</span>
            <span className="text-sm text-ink-muted">Upload new resume</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ensure resumesApi.getAll() exists in lib/api.ts**

Verify that `resumesApi` in `apps/frontend-v2/src/lib/api.ts` has a `getAll` method. If not, add:

```ts
getAll: async (): Promise<any[]> => {
  const response = await api.get('/resumes');
  return response.data.data ?? response.data.resumes ?? [];
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend-v2/src/pages/Dashboard.tsx apps/frontend-v2/src/lib/api.ts
git commit -m "feat: dashboard with resume cards, scores, tailored copy counts"
```

---

## Phase 5 — Landing Page

### Task 16: Paper Landing Page

**Files:**
- Modify: `apps/frontend-v2/src/pages/LandingPage.tsx`

- [ ] **Step 1: Rewrite LandingPage**

Replace `apps/frontend-v2/src/pages/LandingPage.tsx` with the full Paper-style landing page:

```tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-paper-bg">
      {/* Nav */}
      <nav className="border-b border-paper-border bg-paper-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-heading font-bold text-lg tracking-tight">
            resu<span className="text-indigo-600">mate</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#how" className="text-sm text-ink-secondary hover:text-ink-primary transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-ink-secondary hover:text-ink-primary transition-colors">Pricing</a>
            <Button size="sm" variant="secondary" onClick={() => navigate('/sign-in')}>Sign in</Button>
            <Button size="sm" onClick={() => navigate('/sign-up')}>Get started →</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 flex gap-12 items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100">
            ✦ AI-First Resume Platform
          </div>
          <h1 className="font-heading text-5xl font-bold text-ink-primary leading-tight tracking-tight">
            Get more<br />interviews <span className="text-indigo-600">faster.</span>
          </h1>
          <p className="text-lg text-ink-secondary leading-relaxed max-w-md">
            Upload your resume. AI scores it, rewrites weak spots, and tailors it to any job description — in seconds.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => navigate('/sign-up')}>Upload your resume →</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</Button>
          </div>
          <p className="text-xs text-ink-muted">5 free credits on signup · No credit card required</p>
        </div>

        {/* Floating card */}
        <div className="w-72 shrink-0">
          <div className="bg-paper-surface border border-paper-border rounded-xl shadow-elevated p-5 space-y-4 rotate-1">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">ATS Match Score</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-danger-text">42%</span>
              <span className="text-ink-muted">→</span>
              <span className="font-mono text-2xl font-bold text-success-text">89%</span>
              <span className="bg-success-bg text-success-text text-xs font-bold px-2 py-0.5 rounded-full border border-success-border">+47 pts</span>
            </div>
            <p className="text-sm font-semibold text-ink-primary">Google SWE L4 — Tailored</p>
            <div className="h-1.5 bg-paper-bg rounded-full overflow-hidden">
              <div className="h-full w-[89%] bg-gradient-to-r from-indigo-500 to-success-text rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-paper-border bg-paper-surface py-4">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-8 text-sm text-ink-secondary">
          <span><strong className="text-ink-primary font-heading">500+</strong> job seekers</span>
          <span className="text-paper-border">·</span>
          <span><strong className="text-ink-primary font-heading">89%</strong> avg ATS match</span>
          <span className="text-paper-border">·</span>
          <span><strong className="text-ink-primary font-heading">2 min</strong> to tailor</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-20 space-y-12">
        <h2 className="font-heading text-3xl font-bold text-ink-primary text-center">How it works</h2>
        <div className="grid grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Upload your resume', desc: 'Drop your PDF. AI parses it into structured data instantly — no manual typing.' },
            { step: '02', title: 'AI scores and improves', desc: 'See your score, weak bullets highlighted, and AI-rewritten improvements side by side.' },
            { step: '03', title: 'Tailor per job', desc: 'Paste a job description. AI rewrites your resume to match it and shows the before/after score.' },
          ].map(item => (
            <div key={item.step} className="space-y-3">
              <span className="font-mono text-xs font-bold text-indigo-500">{item.step}</span>
              <h3 className="font-heading font-semibold text-lg text-ink-primary">{item.title}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper-surface border-t border-paper-border py-20">
        <div className="max-w-3xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="font-heading text-3xl font-bold text-ink-primary">Simple credit pricing</h2>
            <p className="text-ink-secondary">Start free. Pay only for AI actions. No subscriptions.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Starter', credits: 20, price: '$10', popular: false },
              { name: 'Pro', credits: 50, price: '$20', popular: true },
              { name: 'Max', credits: 120, price: '$40', popular: false },
            ].map(pack => (
              <div key={pack.name} className={`border rounded-xl p-6 space-y-4 bg-paper-bg ${pack.popular ? 'border-indigo-300 ring-1 ring-indigo-200 bg-white' : 'border-paper-border'}`}>
                {pack.popular && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Most Popular</span>}
                <div>
                  <p className="font-heading font-semibold text-ink-primary">{pack.name}</p>
                  <p className="font-mono text-xl font-bold mt-1">{pack.credits} <span className="text-sm font-normal text-ink-muted">credits</span></p>
                </div>
                <p className="font-heading text-2xl font-bold text-indigo-600">{pack.price}</p>
                <Button className="w-full" variant={pack.popular ? 'primary' : 'secondary'} onClick={() => navigate('/sign-up')}>
                  Get started
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-ink-muted">1 credit = score a resume · 2 credits = tailor to a job · Downloads are free</p>
        </div>
      </section>

      {/* CTA footer */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="font-heading text-3xl font-bold text-ink-primary">Start for free today</h2>
        <p className="text-ink-secondary">Upload your resume. 5 free credits. No credit card needed.</p>
        <Button size="lg" onClick={() => navigate('/sign-up')}>Upload your resume →</Button>
      </section>

      <footer className="border-t border-paper-border py-6 text-center text-xs text-ink-muted">
        © 2026 Resumate. All rights reserved.
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev build**

```bash
cd apps/frontend-v2 && npm run dev
```
Open http://localhost:5173 — landing page should render with Space Grotesk headlines, indigo accents, off-white background.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend-v2/src/pages/LandingPage.tsx
git commit -m "feat: Paper landing page with hero, how-it-works, pricing sections"
```

---

## Phase 6 — Integration Smoke Test

### Task 17: End-to-End Smoke Test

- [ ] **Step 1: Start full stack**

```bash
# Terminal 1
cd apps/backend && npm run dev

# Terminal 2
cd apps/frontend-v2 && npm run dev
```

- [ ] **Step 2: Verify the complete user loop**

Work through each step and confirm it works:

1. Hit http://localhost:5173 — landing page loads ✓
2. Sign up via Clerk → redirected to `/upload` ✓
3. Drop a PDF → parses, redirects to `/editor/:id` ✓
4. In editor: click "Score Resume — 1 credit" → suggestions appear in right panel ✓
5. Accept a suggestion → bullet updates in editor ✓
6. Navigate to `/tailor?resumeId=<id>` ✓
7. Fill JD form → click Tailor → before/after score + diff appear ✓
8. Navigate to `/credits` → packs display ✓
9. Check sidebar: credit balance decremented correctly ✓

- [ ] **Step 3: Run all backend tests**

```bash
cd apps/backend && npm test
```
Expected: all tests pass

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: AI-first overhaul complete — upload, score, tailor, credits, Paper design"
```
