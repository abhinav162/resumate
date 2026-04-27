# Backend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues found during audit — ordered by criticality from runtime crash to dev experience.

**Architecture:** Changes span backend (`apps/backend/`) and frontend (`apps/frontend-v2/`). Tasks are independent — each can be committed and deployed separately.

**Tech Stack:** Node.js, Express, Stripe SDK, SQLite, React, TypeScript

**Priority Order:**
1. **CRITICAL** — `requireCredits` middleware crash when `req.user` is null
2. **HIGH** — AI suggestion accept broken (two bugs: backend sends incomplete data, frontend writes to wrong field)
3. **HIGH** — Stripe env placeholder validation (silent failures)
4. **MEDIUM** — Inconsistent error response formats across routes
5. **LOW** — Dead JWT_SECRET config cleanup
6. **LOW** — `.env.example` documentation

**Dropped from original list:** "Tailored resume data shape mismatch" — investigation confirmed the frontend POST body `{ baseResumeId, jobDetails, tailoredData }` matches backend validation exactly. No fix needed.

---

### Task 1: Fix `requireCredits` middleware null check (CRITICAL)

**Why:** If a request hits an AI endpoint without a valid `x-user-id` header, `ensureUserExists` (line 12-13) calls `next()` without setting `req.user`. Then `requireCredits` does `req.user.id` on line 12, causing `TypeError: Cannot read properties of undefined`. This crashes the request with an opaque 500 error instead of a clear 401.

**Files:**
- Modify: `apps/backend/src/middleware/requireCredits.js:9-27`

- [ ] **Step 1: Add null guard before accessing `req.user.id`**

Open `apps/backend/src/middleware/requireCredits.js` and replace the entire file content with:

```js
import { getCredits } from '../services/creditService.js';

/**
 * Middleware factory to require a minimum credit balance
 * Returns 402 Payment Required if insufficient balance
 * @param {number} amount - Minimum credits required
 * @returns {Function} Express middleware function
 */
export function requireCredits(amount) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

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

- [ ] **Step 2: Verify the server starts without errors**

Run: `cd /Users/apple/Desktop/den/resumate && npm run dev:backend`
Expected: Server starts on port 4300 with no import errors.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/middleware/requireCredits.js
git commit -m "fix: guard against null req.user in requireCredits middleware"
```

---

### Task 2: Fix AI suggestion scoring and acceptance (HIGH)

**Why — two connected bugs:**

**Bug A (Backend):** The score and tailor endpoints in `ai.js` use raw SQL and read `JSON.parse(resume.contact_data)` as the "full resume". But after the upload pipeline fix, `Resume.create()` only stores contact info (name, email, phone) in `contact_data`. Experience, education, projects, and skills are in separate tables. So the AI only sees contact data — not the actual resume content. Both endpoints should use `Resume.findByUuid()` which assembles the complete resume.

**Bug B (Frontend):** `acceptSuggestion` in `ResumeEditorContext.tsx` tries to modify `experience[idx].responsibilities[bulletIdx]`, but the frontend data model uses `experience[idx].description` (a single newline-joined string). The condition `updated.experience?.[sectionIdx]?.responsibilities` is always falsy, so the data never updates. The suggestion gets dismissed from the UI but the resume text doesn't change.

**Files:**
- Modify: `apps/backend/src/routes/ai.js:19-45,53-88` (use Resume model instead of raw SQL)
- Modify: `apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx:192-214` (fix acceptSuggestion)

- [ ] **Step 1: Fix backend score endpoint to use Resume model**

Open `apps/backend/src/routes/ai.js` and replace the entire file with:

```js
import express from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { Resume } from '../models/Resume.js';
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

// POST /api/ai/score/:resumeId — score a stored resume (costs 1 credit)
router.post('/score/:resumeId', requireCredits(CREDIT_COSTS.RESUME_SCORE), async (req, res) => {
  try {
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [req.headers['x-user-id']]);
    if (!userRow) return res.status(401).json({ success: false, message: 'User not found' });

    // Use Resume model to get complete resume with experience, education, projects
    const resume = await Resume.findByUuid(req.params.resumeId);
    if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });

    const scoreReport = await scoreResume(resume);

    // Store score in DB using the internal ID
    const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [req.params.resumeId]);
    if (dbResume) {
      await database.run(
        "UPDATE base_resumes SET score = ?, suggestions = ?, updated_at = datetime('now') WHERE id = ?",
        [scoreReport.score, JSON.stringify(scoreReport.suggestions), dbResume.id]
      );
    }

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

    // Use Resume model to get complete resume with experience, education, projects
    const resumeData = await Resume.findByUuid(resumeId);
    if (!resumeData) return res.status(404).json({ success: false, message: 'Resume not found' });

    const { tailoredResume, diff, beforeScore, afterScore } = await tailorResume(
      resumeData, jobTitle, company, jobDescription
    );

    const dbResume = await database.get('SELECT id FROM base_resumes WHERE uuid = ?', [resumeId]);
    const tailoredUuid = uuidv4();
    await database.run(
      `INSERT INTO tailored_resumes (uuid, base_resume_id, job_title, company, job_description, tailored_data, before_score, after_score, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tailoredUuid, dbResume.id, jobTitle, company, jobDescription,
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

Key changes:
- Import `Resume` model
- Score endpoint: `Resume.findByUuid(req.params.resumeId)` instead of raw SQL + `JSON.parse(contact_data)`
- Tailor endpoint: same — uses model to get complete resume data
- Separate DB lookup for internal ID when writing score/tailored data back

- [ ] **Step 2: Verify backend starts and score endpoint has access to full resume data**

Run: `cd /Users/apple/Desktop/den/resumate && npm run dev:backend`
Expected: Server starts without errors.

- [ ] **Step 3: Fix frontend `acceptSuggestion` to work with `description` string**

Open `apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx` and replace the `acceptSuggestion` function (lines 192-214) with:

```tsx
  const acceptSuggestion = (bulletId: string) => {
    const s = suggestions.find(s => s.bulletId === bulletId);
    if (!s) return;
    // bulletId format: "experience-0-1" → sectionType, sectionIndex, bulletIndex
    const parts = bulletId.split('-');
    const sectionType = parts[0]; // "experience"
    const sectionIdx = parseInt(parts[1], 10);
    const bulletIdx = parseInt(parts[2], 10);

    setResumeData((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (sectionType === 'experience' && updated.experience?.[sectionIdx]) {
        const exp = { ...updated.experience[sectionIdx] };
        // Frontend stores description as a newline-joined string; split, replace, rejoin
        const bullets = (exp.description || '').split('\n').filter(Boolean);
        if (bulletIdx < bullets.length) {
          bullets[bulletIdx] = s.rewrite;
        } else {
          bullets.push(s.rewrite);
        }
        exp.description = bullets.join('\n');
        updated.experience = updated.experience.map((e: any, i: number) => i === sectionIdx ? exp : e);
      }
      return updated;
    });
    isDirty.current = true;
    setSuggestions(prev => prev.filter(s => s.bulletId !== bulletId));
  };
```

Key changes:
- Condition checks `updated.experience?.[sectionIdx]` (not `.responsibilities`)
- Splits `description` string by newlines into bullet array
- Replaces bullet at `bulletIdx` with `s.rewrite`
- Rejoins and writes back to `description`
- Sets `isDirty.current = true` to trigger auto-save

- [ ] **Step 4: Verify frontend compiles**

Run: `cd /Users/apple/Desktop/den/resumate && npx --workspace=apps/frontend-v2 tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/ai.js apps/frontend-v2/src/components/features/editor/ResumeEditorContext.tsx
git commit -m "fix: AI suggestions now use full resume data and correctly update description field"
```

---

### Task 3: Validate Stripe environment variables at startup (HIGH)

**Why:** `credits.js` creates `new Stripe(process.env.STRIPE_SECRET_KEY)` on every checkout request. If the key is the placeholder `sk_test_...` from `.env.example`, Stripe silently creates an instance that fails with a confusing error on the first API call. We should validate at startup and fail fast, and also guard the checkout/webhook routes at runtime.

**Files:**
- Modify: `apps/backend/src/routes/credits.js:1-79`

- [ ] **Step 1: Add Stripe singleton with validation**

Open `apps/backend/src/routes/credits.js` and replace the file with:

```js
import express from 'express';
import Stripe from 'stripe';
import database from '../config/database.js';
import { getCredits, grantCredits } from '../services/creditService.js';
import { CREDIT_PACKS } from '../config/pricing.config.js';

const router = express.Router();

// Validate and create Stripe instance once at module load
function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_...' || key.length < 20) {
    console.warn('WARNING: STRIPE_SECRET_KEY is missing or is a placeholder. Credit purchases will fail.');
    return null;
  }
  return new Stripe(key);
}

const stripe = createStripeClient();

// Guard for routes that need Stripe
function requireStripe(req, res, next) {
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: 'Payment service is not configured. Please contact support.',
    });
  }
  next();
}

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

// GET /api/credits/packs — available packs (no Stripe IDs exposed)
router.get('/packs', (req, res) => {
  const packs = CREDIT_PACKS.map(({ id, name, credits, priceUsd, popular }) => ({
    id, name, credits, priceUsd, popular
  }));
  res.json({ success: true, data: packs });
});

// POST /api/credits/checkout — create Stripe checkout session
router.post('/checkout', requireStripe, async (req, res) => {
  try {
    const { packId } = req.body;
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ success: false, message: 'Invalid pack' });
    if (!pack.stripePriceId) return res.status(500).json({ success: false, message: 'Stripe price not configured' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      metadata: { userId: req.headers['x-user-id'], packId, credits: String(pack.credits) },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/credits?success=true&credits=${pack.credits}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/credits?cancelled=true`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/credits/webhook — Stripe webhook (raw body required, handled in server.js)
router.post('/webhook', requireStripe, express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook error: ${err.message}` });
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

Key changes:
- Stripe client created once at module load (singleton)
- Validates key exists and is not the `.env.example` placeholder
- `requireStripe` middleware returns 503 with clear message instead of crashing
- Webhook error response now includes `success: false` (was missing before)

- [ ] **Step 2: Verify server starts and logs warning if Stripe key is placeholder**

Run: `cd /Users/apple/Desktop/den/resumate && npm run dev:backend`
Expected: See `WARNING: STRIPE_SECRET_KEY is missing or is a placeholder` in console (unless real keys are configured).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/routes/credits.js
git commit -m "fix: validate Stripe config at startup, return 503 when unconfigured"
```

---

### Task 4: Standardize error response formats (MEDIUM)

**Why:** Error responses are inconsistent across routes:
- `ai.js` validation: `{ success: false, errors }` (no `message`)
- `resumes.js` validation: `{ success: false, message: "Validation errors", errors }` (has `message`)
- `credits.js` webhook: `{ message }` (no `success` field!)
- 500 errors: some include `error: error.message`, some don't

This makes frontend error handling unreliable. The fix: extract a shared `handleValidationErrors` helper and standardize all 500 responses.

**Files:**
- Create: `apps/backend/src/middleware/errorHelpers.js`
- Modify: `apps/backend/src/routes/ai.js:12-16`
- Modify: `apps/backend/src/routes/resumes.js:1-19`
- Modify: `apps/backend/src/routes/tailored-resumes.js:1-19`

**Note:** `ai.js` was already rewritten in Task 2. The local `handleValidationErrors` in that rewrite should be replaced with the shared import in this task.

- [ ] **Step 1: Create shared validation error handler**

Create `apps/backend/src/middleware/errorHelpers.js`:

```js
import { validationResult } from 'express-validator';

/**
 * Shared validation error handler.
 * All routes should use this instead of defining their own.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array(),
    });
  }
  next();
};
```

- [ ] **Step 2: Update `ai.js` to use shared handler**

Open `apps/backend/src/routes/ai.js`. Replace the imports and local handler (lines 1-16 from Task 2's version):

```js
import express from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import database from '../config/database.js';
import { Resume } from '../models/Resume.js';
import { scoreResume, tailorResume } from '../services/aiService.js';
import { deductCredits } from '../services/creditService.js';
import { requireCredits } from '../middleware/requireCredits.js';
import { CREDIT_COSTS } from '../config/credits.config.js';
import { handleValidationErrors } from '../middleware/errorHelpers.js';

const router = express.Router();
```

This removes the local `handleValidationErrors` and the unused `validationResult` import.

- [ ] **Step 3: Update `resumes.js` to use shared handler**

Open `apps/backend/src/routes/resumes.js`. Replace lines 1-19:

```js
import express from "express";
import { Resume } from "../models/Resume.js";
import { body, param } from "express-validator";
import database from "../config/database.js";
import { handleValidationErrors } from "../middleware/errorHelpers.js";

const router = express.Router();
```

This removes the local `handleValidationErrors` and the unused `validationResult` import.

- [ ] **Step 4: Update `tailored-resumes.js` to use shared handler**

Open `apps/backend/src/routes/tailored-resumes.js`. Replace lines 1-19:

```js
import express from 'express';
import TailoredResume from '../models/TailoredResume.js';
import { Resume } from '../models/Resume.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/errorHelpers.js';

const router = express.Router();
```

This removes the local `handleValidationErrors` and the unused `validationResult` import.

- [ ] **Step 5: Verify server starts and all imports resolve**

Run: `cd /Users/apple/Desktop/den/resumate && npm run dev:backend`
Expected: Server starts on port 4300 with no import errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/middleware/errorHelpers.js apps/backend/src/routes/ai.js apps/backend/src/routes/resumes.js apps/backend/src/routes/tailored-resumes.js
git commit -m "refactor: extract shared handleValidationErrors, standardize error responses"
```

---

### Task 5: Remove dead JWT_SECRET config (LOW)

**Why:** The app uses Clerk for authentication. There is zero JWT code in the backend (`jsonwebtoken` is not imported anywhere). The `JWT_SECRET` in `.env.example` and its associated comment mislead developers into thinking it's required.

**Files:**
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Remove JWT_SECRET from `.env.example`**

Open `apps/backend/.env.example` and replace the entire file with:

```
# Backend Environment Variables
# Copy this file to .env and fill in real values

PORT=4300
NODE_ENV=production
FRONTEND_URL=http://localhost:3160
DB_PATH=../../data/resumate.db
CORS_ORIGIN=http://localhost:3160
GEMINI_API_KEY=your_gemini_api_key_here

# Stripe (required for credit purchases — leave blank to disable)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_MAX=
```

Changes:
- Removed `JWT_SECRET` and its misleading "IMPORTANT" comment
- Removed placeholder values like `sk_test_...` (empty is honest — indicates "not configured")
- Added section comment for Stripe
- Added top-level instruction comment

- [ ] **Step 2: Commit**

```bash
git add apps/backend/.env.example
git commit -m "chore: remove dead JWT_SECRET, clean up .env.example placeholders"
```

---

### Task 6: Document `.env.example` with inline explanations (LOW)

**Why:** Developers (including future you) need to know which variables are required vs optional and what each one does. The current file has no documentation beyond the variable names.

**Files:**
- Modify: `apps/backend/.env.example` (already updated in Task 5 — this adds inline docs)

- [ ] **Step 1: Add inline documentation to `.env.example`**

Open `apps/backend/.env.example` and replace with the final documented version:

```
# Backend Environment Variables
# Copy this file to .env and fill in real values
# Variables marked [REQUIRED] must be set for the app to function

# [REQUIRED] Server port
PORT=4300

# [REQUIRED] "development" or "production" — controls error verbosity and rate limits
NODE_ENV=production

# [REQUIRED] Frontend origin for CORS and Stripe redirect URLs
FRONTEND_URL=http://localhost:3160

# [OPTIONAL] SQLite database path (default: ../../data/resumate.db)
DB_PATH=../../data/resumate.db

# [REQUIRED] Must match FRONTEND_URL (used by CORS middleware)
CORS_ORIGIN=http://localhost:3160

# [REQUIRED] Google Gemini API key for AI features (scoring, tailoring, PDF parsing)
GEMINI_API_KEY=

# --- Stripe (leave blank to disable credit purchases) ---

# [OPTIONAL] Stripe secret key (sk_test_* or sk_live_*)
STRIPE_SECRET_KEY=

# [OPTIONAL] Stripe webhook signing secret (whsec_*)
STRIPE_WEBHOOK_SECRET=

# [OPTIONAL] Stripe Price IDs for credit packs
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_MAX=
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/.env.example
git commit -m "docs: add inline documentation to .env.example"
```

---

## Verification Checklist

After all tasks are done:

1. Start backend + frontend: `npm run dev`
   - No import errors
   - Stripe warning logged if keys are empty
2. Hit `/api/ai/score/fake-id` without `x-user-id` header
   - Should return `401 { success: false, message: "Authentication required" }` (not a crash)
3. Hit `/api/credits/checkout` with `{ "packId": "starter" }`
   - Should return `503 { success: false, message: "Payment service is not configured..." }` if Stripe is unconfigured
4. Hit `/api/resumes` with invalid POST body
   - Should return `400 { success: false, message: "Validation errors", errors: [...] }`
5. Upload a PDF resume, then click "Analyse with AI" in the editor
   - Should return a score and suggestions with real experience bullets (not just contact)
6. Click "Accept" on a suggestion
   - The experience description text should update in the editor
   - The change should auto-save (check "Saving..." indicator)
7. Check `.env.example` has no `JWT_SECRET` and has inline docs
