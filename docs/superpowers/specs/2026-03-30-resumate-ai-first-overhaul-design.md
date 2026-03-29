# Resumate — AI-First Overhaul Design Spec
**Date:** 2026-03-30
**Branch:** `chore/ux-overhaul-2`
**Status:** Approved, ready for implementation planning

---

## 1. Problem Statement

`frontend-v2` drifted from its goal. It became a normal resume builder with AI bolted on as step 6 of 6. Critical issues:
- `ResultsView` shows hardcoded fake data — AI tailoring output is `console.log`'d and discarded
- Users must supply their own Gemini API key stored in `localStorage` — impossible to monetize
- No credit or subscription infrastructure exists
- The "magic moment" (AI value) is buried behind too much manual friction

**Goal:** Transform Resumate into a genuinely AI-first product that justifies a credit-based monetization model and can be sold to job seekers.

---

## 2. Target Users

**Primary:** Active job seekers applying to 10–30 jobs/month (high-volume, credit model suits)
**Secondary:** Professionals making 1–2 strategic job changes/year (low-volume, willing to pay for quality)
**Funnel:** Freemium — free tier (3 credits on signup) converts to credit pack purchases

---

## 3. Core User Flow

### 3.1 Onboarding (one-time)
```
Landing Page → Sign Up (Clerk) → Upload Resume PDF → AI Parses + Scores → Magic Moment: Side-by-side suggestions
```
- Upload triggers server-side PDF parsing → structured JSON resume
- AI immediately scores and surfaces suggestions — no JD required
- Costs 1 credit (3 free on signup). User sees value before any payment friction.

### 3.2 Dashboard (home base)
- Lists base resumes with AI scores
- Lists tailored copies per job application
- Credits balance always visible in sidebar
- Entry point to editor and tailor workspace

### 3.3 AI Editor (base resume editing)
- Split view: resume sections on left, AI suggestion cards on right
- Weak/missing bullets highlighted inline (yellow = weak, red = missing quantification)
- Right panel: accept/reject individual suggestions
- Re-scoring available at any time (costs 1 credit)
- Manual editing is always free

### 3.4 Tailor Workspace (per job application)
- Pick a base resume
- Paste job description
- AI generates tailored copy showing before/after ATS match score
- Diff view: what changed and why
- Save as new copy (base resume untouched) + download PDF
- Costs 2 credits

### 3.5 Credits & Billing
- 3 credits free on signup
- Credit packs via Stripe: 10 / 25 / 50 credits
- Credit gates enforced server-side
- No subscription in V1 — pure credit model

---

## 4. Design System — Paper

**Philosophy:** Typography-led, confident, minimal. Not "AI tool" aesthetic. Feels like a premium productivity app.

### 4.1 Colors
```
Background:     #fafaf8  (off-white, warm)
Surface:        #ffffff  (cards, panels)
Border:         #ebebeb  (dividers, card borders)
Text primary:   #0f0f0f  (headings)
Text secondary: #777777  (body, descriptions)
Text muted:     #aaaaaa  (labels, hints)

Accent:         #4f46e5  (indigo — primary actions, links, highlights)
Accent light:   #eef2ff  (indigo tint — tags, badges, hover states)
Accent dark:    #3730a3  (hover on primary buttons)

Success:        #22c55e
Warning:        #f59e0b
Danger:         #ef4444
```

### 4.2 Typography
```
Headlines:  Space Grotesk — weight 700, letter-spacing -0.04em
Body:       DM Sans — weight 400/500
Labels:     DM Sans — weight 600, uppercase, letter-spacing 0.06em
Mono:       Geist Mono — scores, credits, technical data
```

### 4.3 Spacing & Shape
```
Border radius:  8px (inputs, small cards), 12px (cards), 16px (large panels)
Shadows:        0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06)
Max width:      1200px (app), 480px (auth/onboarding)
```

### 4.4 Component Principles
- Buttons: filled (indigo) for primary, white+border for secondary, ghost for tertiary
- Cards: white bg, 1px #ebebeb border, 12px radius, subtle shadow
- Forms: white bg, 1px border, focus ring in indigo
- Score badges: colored bg (green/yellow/red) with matching text, pill shape
- No gradients on UI chrome — gradients only allowed in marketing/landing contexts

---

## 5. Screen Specifications

### 5.1 Landing Page
**Sections (top to bottom):**
1. **Nav** — Logo, Product / Pricing links, Sign In, "Get Started" (indigo filled)
2. **Hero** — Tag pill ("✦ AI-First Resume Platform"), H1 ("Get more interviews faster."), subtitle, two CTAs (Upload Resume → / See demo), floating score card mockup
3. **Social proof** — "500+ job seekers · 89% avg ATS match · 2min to tailor"
4. **How it works** — 3-step visual: Upload → AI Scores → Tailor per job
5. **Feature highlights** — Side-by-side editor, before/after score, instant PDF
6. **Pricing** — Credit packs (10 / 25 / 50), free tier callout
7. **CTA footer** — "Upload your resume. It's free to start."

### 5.2 Dashboard
**Layout:** Left sidebar (200px, white) + main content area
- Sidebar: Logo, nav links (My Resumes / Tailor / History), credits widget at bottom
- Main: "My Resumes" heading + upload button, resume cards grid (2 cols), recent tailored copies list
- Resume card: name, score badge, "X tailored copies" badge, Edit + Tailor buttons
- Empty state: large dashed upload card

### 5.3 AI Editor
**Layout:** Top bar + split (left: editor, right: AI panel)
- Top bar: resume name (editable), score pill, "Re-score" button (1 credit), "Tailor this →" CTA
- Left panel: resume sections (Experience, Education, Skills, Summary) — each bullet editable inline, highlighted if AI flagged it
- Right panel: suggestion cards — each shows original, AI rewrite, Accept / Skip buttons, issue label
- Bottom: overall issues summary ("4 issues found · 2 accepted")

### 5.4 Tailor Workspace
**Layout:** Left input panel (280px) + right results panel
- Left: base resume selector (dropdown), job description textarea, "Tailor Resume — 2 credits" button
- Right (pre-tailor): empty state with instructions
- Right (post-tailor): match score before → after with delta badge, diff list (changed bullets with strikethrough + new version), Download PDF + Save Copy buttons

### 5.5 Credits Page
- Current balance (large, prominent)
- Credit pack cards: Starter (10 credits, $X), Pro (25 credits, $X), Max (50 credits, $X)
- What credits buy: scoring (1), tailoring (2)
- Stripe checkout on click

---

## 6. Technical Architecture

### 6.1 Backend Changes (`apps/backend`)

#### New: User Management
```js
// Table: users
// clerk_id TEXT UNIQUE, credits INTEGER DEFAULT 3, created_at
// Populated on first API call via ensureUser middleware (already exists in branch)
```

#### New: PDF Upload & Parsing
```
POST /api/resumes/upload
- Accepts: multipart/form-data (PDF or DOCX, max 5MB)
- Uses: multer (file storage) + pdf-parse (text extraction)
- Uses: Gemini API to structure raw text → ResumeData JSON
- Returns: { resumeId, parsed: ResumeData }
- Saves parsed resume to DB
```

#### New: AI Scoring
```
POST /api/resumes/:id/score
- Requires: 1 credit
- Uses: Gemini API — scores resume sections, returns issues array + suggestions array
- Each suggestion: { bulletId, original, rewrite, issueType, severity }
- Returns: { score: number, issues: [], suggestions: [] }
- Deducts 1 credit on success
```

#### Fix: AI Tailoring
```
POST /api/tailor
- Requires: 2 credits
- Fix: actually return + save tailored resume data (currently discarded)
- Add: before/after ATS match score calculation
- Add: diff generation (which bullets changed, what was added/removed)
- Returns: { tailoredResumeId, beforeScore, afterScore, diff: [], resumeData }
```

#### New: Credits
```
GET  /api/credits              — returns current balance
POST /api/credits/purchase     — Stripe checkout session creation
POST /api/webhooks/stripe      — webhook: top up balance on payment success
```

#### Server-side AI key
- Remove all user-supplied API key logic
- Single `GEMINI_API_KEY` in `.env` used for all AI operations
- Rate limit AI endpoints per user (10 req/min)

### 6.2 Frontend Changes (`apps/frontend-v2`)

#### Design system reset
- Replace tailwind config: new Paper tokens (colors, fonts, radii)
- Add Google Fonts: Space Grotesk + DM Sans + Geist Mono
- Rewrite `components/ui/Button.tsx`, `Card.tsx` to Paper style
- Add new: `Badge.tsx`, `ScorePill.tsx`, `CreditCounter.tsx`

#### New: Upload Onboarding flow
- `/upload` route — drag-drop PDF, progress state, redirects to editor on parse complete
- Consumes `POST /api/resumes/upload`

#### Fix: AI Editor
- Wire score + suggestions from `POST /api/resumes/:id/score`
- Inline bullet highlighting based on suggestion severity
- Suggestion cards: accept patches bullet in editor state, skip dismisses card
- Re-score button deducts credit and refetches

#### Fix: Tailor Workspace
- Wire to actual API response (not fake hardcoded data)
- Before/after score display from API response
- Diff list rendered from `diff` array in response
- Save copy → dashboard

#### New: Credits infrastructure
- `CreditContext` — global credit balance, deduct function, refetch
- Gate components: `<RequiresCredits cost={1}>` wrapper that blocks + shows buy prompt if insufficient
- Credits widget in sidebar always shows live balance

### 6.3 Data Models

#### ResumeData (extends `packages/shared/src/types/resume.ts` — do not duplicate)
```ts
type ResumeSection = {
  id: string
  type: 'experience' | 'education' | 'skills' | 'summary' | 'projects'
  bullets: { id: string; text: string; flagged?: boolean; severity?: 'warn' | 'error' }[]
}

type ResumeData = {
  id: string
  userId: string
  name: string
  score?: number
  sections: ResumeSection[]
  createdAt: string
  updatedAt: string
}

type TailoredResume = {
  id: string
  baseResumeId: string
  userId: string
  jobTitle: string
  companyName?: string
  beforeScore: number
  afterScore: number
  diff: DiffItem[]
  resumeData: ResumeData
  createdAt: string
}

type DiffItem = {
  sectionType: string
  bulletId: string
  original: string
  rewritten: string
  reason: string
}
```

---

## 7. Monetization Design

### Credit costs
| Action | Cost | Rationale |
|---|---|---|
| Upload + parse PDF | 0 | Remove onboarding friction |
| Initial AI score | 1 | First "magic moment" — convert to paid |
| Re-score after edits | 1 | Encourages iteration, repeat purchase |
| Tailor to JD | 2 | Core value, most credits consumed here |
| Download PDF | 0 | Never gate the output |

### Credit packs (prices TBD — validate with users)
| Pack | Credits | Tailors equivalent |
|---|---|---|
| Starter | 10 | 5 tailors |
| Pro | 25 | 12 tailors |
| Max | 50 | 25 tailors |

### Free tier
- 3 credits on signup (covers: 1 score + 1 tailor)
- Enough to experience full product loop once
- Conversion trigger: second tailor attempt

---

## 8. What Is Out of Scope (V1)

- Cover letter generation
- LinkedIn optimization
- Application status tracking (CRM)
- Subscription/monthly plan
- Team/agency plans
- Mobile app
- Resume templates (LaTeX templates already exist — use as-is)

---

## 9. Success Metrics

- **Activation:** % of signups who complete first AI score within session
- **Magic moment:** % who accept at least 1 AI suggestion
- **Conversion:** % who buy credits after free tier exhausted
- **Retention:** avg tailors per paying user per month
- **Quality signal:** avg before→after ATS score delta (target: +30 pts)

---

## 10. Open Questions (decide before implementation)

1. **Credit pricing** — what is 1 credit worth in $? Suggested: $0.20–0.30 (so Starter pack ≈ $2–3)
2. **PDF generation** — keep LaTeX pipeline or switch to Puppeteer/HTML-to-PDF? LaTeX is higher quality but slower.
3. **File storage** — local `/uploads` for now is fine, but define S3 migration point (probably when deploying to prod)
4. **ATS scoring algorithm** — pure keyword match vs Gemini-powered semantic match? Gemini is more accurate but costs more per call.
