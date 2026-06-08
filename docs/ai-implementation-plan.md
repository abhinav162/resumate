# AI Implementation Plan — Milestones, Algorithms & Verification

Companion to [`ai-roadmap.md`](./ai-roadmap.md). This breaks the roadmap into
sequenced milestones with concrete subtasks, the algorithm for each piece (and
exactly how it plugs into the **current** system), and a verification checklist
per milestone.

## System anchors (current state)

These are the integration points every milestone builds on:

- **LLM transport:** `apps/backend/src/services/aiService.js` →
  `bifrostGenerate(prompt)` (model `gpt-5.4-mini`, `response_format: json_object`).
- **AI routes:** `apps/backend/src/routes/ai.js` (`/score/:id`, `/tailor`,
  `/tailor/status/:id`).
- **Credits:** `apps/backend/src/services/creditService.js`
  (`deductCredits`, `grantCredits`, `getCredits`) + `config/credits.config.js`.
  `users.credits` is declared `INTEGER`, but SQLite's flexible typing stores a
  REAL when the value isn't a lossless integer — so fractional charges work
  without a type migration (verified in M2).
- **Schema / migrations:** `apps/backend/src/config/initDb.js` — new columns/tables
  are added with the idempotent `ALTER TABLE ... .catch(() => {})` pattern.
- **Tables:** `users`, `base_resumes`, `experiences`, `education`, `projects`,
  `tailored_resumes` (cols `before_score`, `after_score`, `diff`, `status`),
  `api_keys` (encrypted secrets), `processed_payment_events`.
- **Frontend data layer:** TanStack Query hooks (`useResumes`, `useTailor*`,
  `useScoreResume`, `useCreditBalance`) + `lib/api.ts`; tailor UI in
  `pages/TailorWorkspace.tsx`, editor in
  `components/features/editor/*`.

---

## Milestone overview & sequencing

| # | Milestone | Depends on | Risk |
|---|-----------|-----------|------|
| **M1** | Scoring quick wins (rubric + JD keyword coverage + cache) | — | Low |
| **M2** | GitHub integration MVP | M1 (keyword infra reused) | Med |
| **M3** | Tailoring robustness (schema validation, streaming, section re-tailor) | M1 | Med |
| **M4** | Bigger bets (ATS simulation, embeddings match, eval harness) | M1–M3 | High |
| **M5** | LinkedIn export parsing | M2 patterns | Med |

Each milestone is independently shippable behind a feature flag where noted.

---

## M1 — Scoring quick wins

**Goal:** make the score explainable, grounded in the JD, reproducible, and cheap
to recompute.

### M1.1 — Deterministic rubric + sub-scores

**Subtasks**
- Add `lib/scoring/rubric.js` (backend) with pure functions per sub-score.
- Extend `scoreResume` to a hybrid: deterministic sub-scores + a constrained LLM
  qualitative pass.
- Persist a `score_breakdown` JSON (new column on `base_resumes` and
  `tailored_resumes`).
- Frontend: breakdown panel in the editor AI panel + tailor score card.

**Algorithm**
```
score(resumeData, jobDescription?):
  bullets = collectBullets(resumeData)          # [{id, text, section}]
  sub.metrics      = pctBulletsWithNumbers(bullets)        # regex /\d|%|\$|x\b/
  sub.verbs        = uniqueStrongVerbRatio(firstWords)     # penalize weak/repeat verbs (verb lists)
  sub.readability  = f(avgLen, ≤280 chars/bullet, passive-voice heuristic)
  sub.formatting   = sectionCompleteness + contactCompleteness + bulletCount in range
  sub.keywordMatch = M1.2 coverage(resume, jobDescription)  # 0 if no JD
  # one LLM call, temperature 0, fixed rubric → qualitative only
  llm = bifrostGenerate(rubricPrompt) -> { impact, clarity, issues[], suggestions[] }
  composite = round( Σ weight_i * sub_i )       # weights in scoring.config
  return { score: composite, breakdown: {...sub, impact, clarity}, issues, suggestions }
```

**Integration:** replaces the body of `scoreResume`; keeps the existing
`{ score, issues, suggestions }` shape (additive `breakdown`) so callers and the
`bulletId` contract are unchanged.

**Verification**
- [ ] Unit tests for each deterministic sub-scorer (fixtures: strong vs weak resume).
- [ ] Same resume scored twice → identical composite (determinism; temp 0).
- [ ] `score` stays an integer 0–100; `breakdown` persisted and returned by API.
- [ ] Editor + tailor UI render the breakdown; no regression in existing score display.
- [ ] `tsc`, `eslint`, backend tests green.

### M1.2 — JD keyword extraction & coverage

**Subtasks**
- `lib/scoring/keywords.js`: extract + normalize + match.
- Cache extracted JD keywords by `sha256(jobDescription)`.
- "Missing keywords" panel in tailor UI.

**Algorithm**
```
extractKeywords(jd):
  if cache[hash(jd)] return it
  kws = bifrostGenerate(extractPrompt) -> string[]    # hard skills/tools, lowercased
  cache[hash(jd)] = normalize(kws); return it
coverage(resume, jd):
  resumeTokens = lower(tokenize(skills + allBulletText))
  syn = synonymMap (k8s↔kubernetes, js↔javascript, ...)
  matched = kws.filter(k => resumeTokens.has(k) || syn-match || fuzzy≥0.9)
  return { ratio: matched/kws.length, missing: kws \ matched (ranked) }
```

**Integration:** feeds `sub.keywordMatch` (M1.1) and the tailor prompt (M3) and is
surfaced as actionable gaps in `TailorWorkspace`.

**Verification**
- [ ] Extraction cached — second call with same JD makes no LLM call (assert via spy).
- [ ] Synonym + fuzzy matching unit-tested.
- [ ] Missing-keyword list renders and updates with JD edits.

### M1.3 — Score cache by content hash

**Subtasks**
- Add `score_hash` column (base + tailored).
- Gate the LLM call **and** credit deduction in `/ai/score/:id` on hash mismatch.

**Algorithm**
```
POST /ai/score/:id:
  data = load(resume)
  h = sha256(canonicalJSON(data))           # stable key order
  if row.score_hash == h && row.score != null:
      return cached score (NO LLM, NO credit deduction)
  report = scoreResume(data)
  persist(score, breakdown, score_hash=h)
  deductCredits(...)                         # only on real compute
```

**Integration:** wraps the existing score route; re-score becomes free when
content is unchanged (fixes roadmap limitation #4).

**Verification**
- [ ] Re-score with no edits → 0 credits spent, no LLM call.
- [ ] Re-score after an edit → 1 credit, fresh score.
- [ ] Concurrent re-score requests don't double-charge (transactional check).

---

## M2 — GitHub integration MVP

**Goal:** connect GitHub, derive a grounded tech/skills profile and importable
projects, and feed verified evidence into tailoring.
**Decisions (locked):** GitHub App (user-to-server OAuth) · public default,
private opt-in · first **10 user-selected repos free**, then **0.2 credits/repo**.

### M2.0 — Fractional credits foundation

**Subtasks**
- Confirm SQLite stores fractional `credits`; add a regression test.
- Add `CREDIT_COSTS.GITHUB_REPO = 0.2` and `GITHUB_FREE_REPOS = 10`.
- Make `getCredits`/balance API return a number (already does); format to 2 dp in UI.

**Algorithm (charge):**
```
analyzeRepos(userId, requestedRepoIds):
  alreadyFree = count(github_repo_summaries WHERE user=userId AND counted_free=1)
  freeLeft    = max(0, 10 - alreadyFree)
  fresh       = requestedRepoIds.filter(not cached-or-changed)   # cache = (repoId, pushed_at)
  freeNow     = min(freeLeft, fresh.length)
  chargeable  = fresh.length - freeNow
  cost        = round2(chargeable * 0.2)
  if cost > 0: deductCredits(userId, cost)
  mark freeNow repos counted_free=1
```

**Verification**
- [ ] `deductCredits(user, 0.2)` leaves a `4.8`-style REAL balance (DB + API).
- [ ] 11th repo for a new user charges exactly 0.2; re-importing a cached repo charges 0.
- [ ] Insufficient-credit path returns 402 and changes nothing.

### M2.1 — GitHub App + OAuth connect

**Subtasks**
- Register a GitHub App (scopes: `read:user`, repo contents read; request per-repo on install).
- Routes: `GET /github/connect` (redirect), `GET /github/callback` (code→token),
  `POST /github/disconnect`.
- Store token in `api_keys` (`service_name='github'`, reuse existing encryption) or
  a new `oauth_connections` table; store granted repo scope.
- Frontend: "Connect GitHub" in settings/dashboard.

**Algorithm:** standard authorization-code flow; encrypt token at rest; persist
`github_login`, `installation_id`, `granted_repos`.

**Verification**
- [ ] OAuth round-trip stores an encrypted token; disconnect deletes it.
- [ ] Token never returned to the client or logged.
- [ ] Revoked/expired token surfaces a "reconnect" state, not a crash.

### M2.2 — Fetch layer (`githubService.js`)

**Subtasks**
- GraphQL: `viewer.contributionsCollection` (commit/PR/review counts,
  `repositoriesContributedTo`) + `repositories(first:100, orderBy:{field:PUSHED_AT})`
  with `languages`, `stargazerCount`, `primaryLanguage`, `description`, `pushedAt`.
- REST: `GET /repos/{o}/{r}/readme` (decode base64).
- Cache raw payload in `github_profiles(user_id, data JSON, fetched_at)`, TTL 24h,
  manual refresh; respect rate-limit headers.

**Verification**
- [ ] Fetch within TTL serves cache (no network) — asserted via spy.
- [ ] Rate-limit headers honored; graceful degrade when `remaining` low.
- [ ] Private repos fetched only if granted.

### M2.3 — Derive tech/skills profile + importable repos

**Algorithm**
```
techProfile(repos):
  for repo: weight = recencyWeight(pushedAt) * (1 + log1p(stars))
  langScore[lang] += bytes(lang) * weight
  return topLanguages + mappedSkills
importable(repos):
  rank = w1*log1p(stars) + w2*recency + w3*isOwner + w4*hasDescription
  return repos sorted by rank desc
```

**Verification**
- [ ] Deterministic given a fixed payload (snapshot test).
- [ ] Skills suggestions exclude what's already in the resume (dedupe).

### M2.4 — Repo → bullets (LLM, cached + priced)

**Algorithm**
```
summarizeRepo(repo):
  key = `${repo.id}:${repo.pushedAt}`
  if github_repo_summaries[key] return cached      # no LLM, no charge
  bullets = bifrostGenerate(repoPrompt(readme excerpt + metadata)) # XYZ bullets + project entry
  store github_repo_summaries[key]; return bullets
# charging handled by M2.0 analyzeRepos around the batch
```

**Verification**
- [ ] Unchanged repo (same `pushed_at`) reuses cache, no LLM/credit.
- [ ] Generated bullets follow XYZ + ≤280 chars (lint on output).
- [ ] Pricing matches M2.0 checklist end-to-end.

### M2.5 — "Import from GitHub" UI + M2.6 evidence into tailoring

**Subtasks**
- Editor flow: list importable repos → user selects → preview drafted bullets →
  insert as project/experience entries.
- Build a compact `githubEvidence` summary (top skills, notable repos, metrics) and
  inject it into the tailor prompt as **verified context**; bias keyword
  suggestions (M1.2) toward evidence-backed skills.

**Verification**
- [ ] Imported entries are editable and save through existing resume mutations.
- [ ] Tailoring with evidence present produces grounded bullets (manual eval) and
      does not fabricate beyond evidence (spot-check).
- [ ] Feature flag off → tailoring behaves exactly as today.

---

## M3 — Tailoring robustness

**Goal:** make tailoring reliable, faster-feeling, and granular.

### M3.1 — Schema validation + repair
**Algorithm**
```
tailor():
  raw = bifrostGenerate(prompt)
  parsed = parseJsonResponse(raw)
  res = TailorSchema.safeParse(parsed)           # zod: tailoredResume + diff
  if !res.ok && retries left:
     raw = bifrostGenerate(prompt + "Fix these errors: "+res.error)   # repair pass
  validate every diff.bulletId resolves to a real bullet; drop/flag unresolved
```
**Verification**
- [ ] Malformed model output is repaired or fails cleanly (no corrupt save).
- [ ] Every persisted `diff` bulletId resolves in `tailored_data` (assert).
- [ ] Keep/discard in UI maps 1:1 with no drift (regression of current flow).

### M3.2 — Streaming progress
- Switch `bifrostGenerate` to support SSE streaming; relay token/section progress to
  the tailor status endpoint; UI shows partial output.
- [ ] Status endpoint emits progress; UI updates; non-streaming fallback intact.

### M3.3 — Section-level re-tailor
- `POST /ai/tailor/section` to re-run one section against the JD.
- [ ] Re-tailoring one section leaves others byte-identical; credits priced per call.

---

## M4 — Bigger bets

### M4.1 — ATS simulation
```
atsScore(resume, jd):
  text = renderPlainText(resume)        # same path as PDF/text export
  sections = detectSections(text)       # headings heuristic
  parseability = sectionsFound / expected
  keywordMatch = coverage(text, jd)     # reuse M1.2
  return weightedScore(parseability, keywordMatch, formatting)
```
- [ ] Known-bad formats score low on parseability; clean resumes score high.
- [ ] Correlates with manual ATS tools on a small sample.

### M4.2 — Embeddings semantic match
```
match(resume, jd):
  reqs = splitRequirements(jd)
  e_req = embed(reqs); e_bul = embed(bullets)
  per req: maxCosine(e_req, e_bul) → coverage + ranked gaps
```
- [ ] Embedding calls cached by text hash.
- [ ] Gap ranking is stable and sensible on fixtures.

### M4.3 — Eval harness
- Labeled `resume × JD` fixtures; metrics: score variance (stability), tailoring
  win-rate vs baseline, keyword-coverage lift.
- [ ] CI job runs the harness; thresholds gate model/prompt changes.

---

## M5 — LinkedIn export parsing (later)

**Algorithm**
```
import(zipOrCsv):
  files = unzip()                       # Positions.csv, Education.csv, Skills.csv, Projects.csv, Recommendations.csv
  profile = mapToResumeShape(files)
  merged = reconcile(profile, existingResume)   # dedupe roles, fill gaps, flag conflicts
  insights = { skills(+endorsements), tone-from-recommendations }
  return merged + insights (feeds tailoring context, like GitHub evidence)
```
- [ ] Parser handles real LinkedIn export archives (fixtures of each CSV).
- [ ] Only user-uploaded data; PII encrypted; deletable; no scraping/unofficial API.
- [ ] Reconciliation never silently overwrites resume content.

---

## Cross-cutting verification (every milestone)

- [ ] Feature behind a flag where it changes existing AI behavior.
- [ ] `tsc --noEmit`, `eslint`, and backend tests green; no new `any`.
- [ ] Credits: charge only on real compute; refund on failure; never double-charge.
- [ ] No secrets/tokens logged or returned to the client.
- [ ] Backward compatible API shapes (additive fields only).
- [ ] Manual smoke test of the affected flow before PR to `staging`.
