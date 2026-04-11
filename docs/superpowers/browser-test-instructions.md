# Resumate UI Browser Test Instructions

## Setup
- Frontend: http://localhost:5173
- Backend: http://localhost:4300
- Clerk auth is active — you will need to sign up/sign in

## Output Format
Save your results to: `/Users/apple/Desktop/den/resumate/docs/superpowers/browser-test-results.md`

Use this structure for each step:
```
### Step N: <step name>
- **Status:** PASS / FAIL / PARTIAL
- **Screenshot:** <describe what you see or attach image>
- **Issues found:** <list any bugs, broken styles, missing elements>
```

---

## Test Steps

### Step 1: Landing Page
1. Navigate to http://localhost:5173
2. Check the following:
   - Page background is off-white (#fafaf8), NOT dark/black
   - Top nav shows "resumate" logo with indigo-colored "mate" suffix
   - Nav has "How it works", "Pricing", "Sign in", "Get started →" buttons
   - Hero has headline "Get more interviews faster." with "faster." in indigo
   - A floating score card is visible on the right (shows 42 → 89 score improvement)
   - "Social proof" bar shows "500+ job seekers", "89% avg ATS match", "2 min to tailor"
   - "How it works" section has 3 steps (01, 02, 03)
   - "Pricing" section has 3 cards: Starter ($10/20 credits), Pro ($20/50 credits), Max ($40/120 credits)
   - "Pro" card has "Most Popular" badge
   - Footer says "© 2026 Resumate"
   - Fonts look clean/modern (Space Grotesk for headings, DM Sans for body)
3. Scroll down and verify all sections load

### Step 2: Sign Up / Sign In
1. Click "Get started →" button in the nav
2. Complete Clerk sign-up (use any email/password)
3. After sign in, check:
   - You are redirected (likely to /dashboard or /upload)
   - The page has a LEFT SIDEBAR with "resumate" logo
   - Sidebar has nav items: "My Resumes" (📄) and "Tailor" (✨)
   - Bottom of sidebar shows a "Credits" widget with a number and "Buy credits →" link

### Step 3: Dashboard
1. Navigate to http://localhost:5173/dashboard
2. Check:
   - Page title "My Resumes" in bold heading
   - "+ Upload Resume" button in top right
   - If no resumes: empty state with dashed border box, 📄 emoji, "Upload your first resume" text
   - The sidebar is visible on the left
   - Credit counter shows a number (should be 5 for new users)

### Step 4: Upload Page
1. Navigate to http://localhost:5173/upload
2. Check:
   - Full-screen centered layout (NO sidebar)
   - Title "Upload your resume"
   - Subtitle "AI will score it and show you exactly how to improve it — in seconds."
   - Large dashed dropzone with 📄 emoji, "Drop your resume here", "PDF only · Max 5MB · Click to browse"
   - Footer text "Uses 1 credit to score · 5 credits included free on signup"
3. Try uploading a real PDF resume:
   - Drag and drop OR click the zone to pick a file
   - While uploading: spinner appears + "AI is reading your resume..." text
   - After success: page navigates to /editor/<resumeId>
   - If no PDF available, skip the actual upload and just verify the UI

### Step 5: Editor Page (if upload succeeded)
1. After upload, you should be on /editor/<some-uuid>
2. Check:
   - Main editor content area on the left/center
   - A RIGHT PANEL titled "AI Suggestions" (w-72, narrow)
   - Right panel shows score (if already scored) or a button "Score Resume — 1 credit"
   - Credit counter in sidebar decremented by 1 after scoring
3. Click "Score Resume — 1 credit" button:
   - Loading spinner + "Analyzing..." text appears
   - After ~10-30 seconds: suggestions appear as cards
   - Each suggestion card shows: badge (issue type), strikethrough original text, new rewrite in quotes, "Accept" and "Skip" buttons
   - Score pill appears next to "AI Suggestions" heading

### Step 6: Tailor Workspace
1. Navigate to http://localhost:5173/tailor
2. Check:
   - Left panel (w-72) with: "Tailor Resume" heading, Resume ID input, Job Title input, Company input, Job Description textarea, "✨ Tailor — 2 credits" button
   - Right panel shows empty state: ✨ emoji, "Results will appear here", "Fill in the form and click Tailor"
   - If coming from dashboard via "Tailor →" button, Resume ID should be pre-filled
3. Fill in the form and click Tailor (if you have credits and a resume ID):
   - Button shows loading state
   - After response: score banner appears showing "before → after" with ScorePill components
   - Green "+X pts" badge appears
   - "What Changed" section lists diff items with: section badge, red strikethrough original, green rewritten text, italic reason
   - "Open Tailored Resume →" button visible

### Step 7: Credits Page
1. Navigate to http://localhost:5173/credits
2. Check:
   - "Buy Credits" heading
   - "Current balance: X credits" shown
   - Info box: "What costs credits?" with pricing breakdown
   - 3 credit pack cards in a grid: Starter (20 credits/$10), Pro (50 credits/$20), Max (120 credits/$40)
   - Pro card has "Most Popular" badge floating above it with indigo ring border
   - "Buy Starter/Pro/Max" buttons present

### Step 8: Visual Design Check (any page)
Verify the Paper design system is applied:
- Background is off-white, NOT white/dark
- All primary buttons are indigo (#4f46e5)
- Secondary buttons are white with gray border
- Cards have subtle shadow, white background, light border
- Headings use Space Grotesk (geometric, modern)
- Body text uses DM Sans (clean sans-serif)
- Score numbers use monospace font
- NO dark mode, NO purple/teal aurora gradients

---

## Known Issues to Ignore
- Console warning: "NODE_ENV=production is not supported in .env file" — harmless
- Stripe checkout will fail (no real Stripe keys) — just verify the button exists
- AI features (upload, score, tailor) require GEMINI_API_KEY — already set in .env

## Report Back
For each FAIL or PARTIAL, include:
1. What you expected to see
2. What you actually saw
3. Any console errors (open DevTools → Console tab)
