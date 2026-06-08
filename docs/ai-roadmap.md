# AI Roadmap — Scoring, Tailoring, and Profile Enrichment

This document describes how resume **scoring** and **tailoring** work today, their
limitations, and a tiered plan to take them to the next level. It also adds two
new initiatives: **GitHub integration** (near-term) and **LinkedIn data parsing**
(later).

---

## 1. How it works today

### Stack
- A single model — `gpt-5.4-mini` — behind the **Bifrost** gateway
  (OpenAI-compatible `/v1/chat/completions`, `response_format: json_object`).
- Every AI feature is a single prompt → JSON, cleaned by `parseJsonResponse`
  (strips markdown fences, normalizes `None/True/False`, regex-repairs trailing
  commas).
- Overload handling: HTTP 503 / "overloaded" → `AI_OVERLOADED` error, credits
  refunded for tailoring.
- Source: `apps/backend/src/services/aiService.js`, routes in
  `apps/backend/src/routes/ai.js`.

### Scoring — `scoreResume` (`POST /ai/score/:id`, 1 credit)
- Sends the **whole resume JSON** to the LLM and asks for
  `{ score: 0–100, issues[], suggestions[] }`.
- `bulletId` scheme (`experience-0-1`, `projects-0-2`, `summary-0-0`, `skills-0-0`)
  maps issues/suggestions back to resume locations.
- Works for both base and tailored resumes; persists `score` + `suggestions`
  (base) or `after_score` (tailored).

### Tailoring — `tailorResume` (`POST /ai/tailor`, 2 credits)
- Async job: `PENDING → IN_PROGRESS → COMPLETED/FAILED`; the frontend polls
  status. Credits are reserved up front (atomic) and refunded on failure.
- Internally makes **three sequential LLM calls**: score-before → tailor → score-after.
- Tailor prompt uses the **RARe** framing + **XYZ** bullet framework, requires
  75%+ bullets with metrics, bans buzzwords, caps bullets at 280 chars, and says
  "do not invent experiences."
- Returns `tailoredResume` (full rewrite) + `diff[]`
  (`{ sectionType, bulletId, original, rewritten, reason }`), stored as JSON columns.
- The `/tailor` UI lets the user keep/discard each diff (client-side
  reconstruction) and re-score the current selection.

---

## 2. Limitations (what to attack)

1. **The score is a black-box LLM opinion** — not grounded in the job
   description, no keyword-coverage math, and non-deterministic. Because before
   and after are both LLM-scored, the "+N pts" delta is noisy.
2. **No JD ↔ resume gap analysis** surfaced (missing keywords / skills).
3. **Three serial LLM calls** ⇒ slow (30–60s), no streaming; flat cost
   regardless of resume size.
4. **No score caching** — re-score always spends a credit + a call even when the
   content is unchanged.
5. **No schema validation** of the model's `tailoredResume` / `diff`; the
   bulletId ↔ content mapping is best-effort and can drift.
6. **Anti-fabrication is a single prompt line** — no factuality check or
   evidence grounding.
7. **The rubric is opaque to the user** — just a number and a list of suggestions.

---

## 3. Roadmap — Scoring & Tailoring

### Quick wins
- **Rubric scoring with a breakdown.** Split the score into sub-scores —
  JD keyword match, metrics density, action-verb variety, readability, length /
  formatting. Compute the mechanical parts deterministically (regex/heuristics)
  and use the LLM only for qualitative judgment. Cheaper, faster, explainable,
  and reproducible.
- **JD keyword extraction + coverage panel.** Extract required skills/keywords
  from the JD, show present vs missing, and let that drive the score. This is the
  single most "ATS-like" upgrade and produces actionable gaps.
- **Cache scores by content hash.** Hash the normalized resume JSON; skip the
  call/credit when unchanged → re-score becomes free when nothing changed.
- **Temperature 0 + fixed rubric prompt** so before/after deltas are meaningful.

### Medium
- **Schema-validate model output** (e.g. zod) with stable bullet ids; repair or
  reject malformed JSON so keep/discard mapping is exact.
- **Stream tailoring** with per-section progress; allow **section-level
  re-tailor** in parallel (faster, more targeted).
- **A/B rewrites** — 2–3 variants per bullet, user picks.
- **Cover-letter / JD-match summary** generation as add-ons.

### Bigger bets
- **Real ATS simulation.** Parse the resume the way ATS systems do (plain-text
  extraction, section detection) and score parseability + keyword match — closer
  to actual ATS behavior than an LLM opinion.
- **Embeddings semantic match** (resume ↔ each JD requirement, cosine similarity)
  for a grounded match score and ranked gaps.
- **Eval harness.** A labeled set of resume + JD pairs to measure scoring
  stability and catch regressions when swapping models. Bifrost makes model
  routing easy (cheap model for scoring, stronger model for tailoring).

---

## 4. GitHub integration (near-term) — brainstorm

**Goal:** pull a user's real engineering work from GitHub to (a) ground and
validate resume bullets with evidence, (b) auto-generate project entries,
(c) surface quantifiable metrics for the XYZ framework, and (d) tailor more
credibly. This directly attacks limitation #6 (fabrication) and feeds #2
(keyword/skill gaps).

### Authentication (decided)
- **GitHub App with user-to-server OAuth** (fine-grained, per-repo, revocable,
  5000 req/hr via installation tokens) — chosen over a classic OAuth App.
- Scopes: `read:user`, `read:org` (optional), repo read.
  **Public repos by default; private repos strictly opt-in** per repository.
- Store tokens **encrypted at rest**; handle refresh/expiry; allow disconnect.

### What to fetch (REST + GraphQL)
- **Profile:** bio, public repo count, followers, pinned repos (a strong signal
  of what the user is proud of).
- **Repos** (owned + contributed): language breakdown, stars, forks, topics,
  description, README, last-updated.
- **Contributions** via GraphQL `contributionsCollection`: commit / PR / issue /
  review counts, by repository and over time.
- **Evidence:** commit messages and PR titles/bodies for themes of work
  (e.g. "migrated to X", "reduced latency by Y").

### Processing → insights
- **Tech-stack profile:** aggregate languages/frameworks weighted by *recent*
  activity → ground the skills section ("TypeScript across 8 repos, ~1.2k commits
  last year").
- **Project candidates:** rank repos by stars / recency / personal authorship →
  suggest project entries with auto-drafted XYZ bullets derived from README +
  commit themes + metrics (stars, forks, contributors).
- **Quantifiable metrics:** stars, merged PRs, repos maintained, contributor
  counts → real numbers for bullets.
- **Evidence linking:** map resume claims to GitHub evidence to raise factual
  confidence and reduce fabrication.

### How it feeds scoring/tailoring
- Inject a **compact, verified "GitHub evidence" block** into the tailoring
  prompt so rewrites are grounded in real work.
- **Keyword coverage:** if the JD wants "Kubernetes" and GitHub shows k8s
  manifests, suggest adding it *with evidence*.
- New **"Import from GitHub"** flow in the editor/upload to generate or enrich
  projects and skills.

### Architecture & cost
- New backend module `githubService.js` (OAuth, fetch, cache). Persist raw
  fetched data + a derived `github_profile` JSON per user, with a TTL and
  on-demand refresh (GitHub data changes slowly).
- **Cache LLM repo summaries by repo `updated_at` / last commit SHA** so we never
  re-summarize unchanged repos (controls credit/LLM cost).
- **Privacy first:** only analyze granted repos; user explicitly picks which
  repos/projects to import; never auto-publish.

### MVP scope (do early)
1. GitHub OAuth connect + encrypted token storage + disconnect.
2. Fetch profile + repos + language stats + contribution counts.
3. Derive a tech/skills profile and a list of importable projects.
4. "Import from GitHub" in the editor: pick repos → LLM drafts XYZ project
   bullets from README + metadata.
5. Feed a compact GitHub evidence summary into the tailoring prompt.

### Pricing (decided)
- **First 10 repos are free.** The user explicitly selects which 10 repos to
  import/analyze.
- **After the first 10, charge 0.2 credits per additional repo** analyzed.
- Combined with the per-repo summary cache (by `updated_at`/SHA), re-analyzing an
  already-processed repo should not re-charge.
- Implementation note: current credit costs are integers
  (`RESUME_SCORE: 1`, `RESUME_TAILOR: 2`). Per-repo charging at `0.2` requires
  either fractional-credit support in `creditService` or batching (e.g. charge
  `ceil(extraRepos * 0.2)` per import). To be finalized at build time.

### Decisions locked
- **Auth:** GitHub App (user-to-server OAuth).
- **Scope:** public repos by default, private opt-in per repo.
- **Pricing:** first 10 user-selected repos free, then 0.2 credits/repo.

---

## 5. LinkedIn data parsing (later)

**Goal:** let the user upload their LinkedIn data and process it into meaningful
insights that enrich resume tailoring.

### Approach
- LinkedIn's API is heavily restricted and scraping violates their ToS, so the
  realistic path is **user-provided exports**: the LinkedIn "Get a copy of your
  data" archive (CSV/JSON: `Positions.csv`, `Education.csv`, `Skills.csv`,
  `Projects.csv`, `Recommendations_Received.csv`, etc.) or a profile PDF export.
- Parse those files into the same structured profile shape the resume uses.

### Insights to derive
- Role durations and titles, education, skills (and endorsement counts as a
  weak signal), projects.
- Recommendation text → tone/keywords for the professional summary.
- Dedupe and reconcile against the existing resume; flag gaps/conflicts.

### Use in tailoring
- Provide additional grounded context to the tailoring prompt (alongside GitHub
  evidence) and to keyword coverage.

### Caveats
- Only user-provided exports — **no scraping, no unofficial APIs**.
- Treat as sensitive PII: encrypt, scope to the user, allow deletion.

---

## 6. Suggested sequencing

1. **Quick-win scoring** (rubric breakdown + JD keyword coverage + score cache) —
   biggest credibility gain, mostly deterministic, low risk.
2. **GitHub integration MVP** — connect, profile/skills derivation, import
   projects, evidence into tailoring.
3. **Schema validation + streaming** for tailoring robustness and UX.
4. **Bigger bets** (ATS simulation, embeddings match, eval harness).
5. **LinkedIn export parsing** — once GitHub enrichment patterns are proven.
