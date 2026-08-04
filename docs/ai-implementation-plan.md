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
| **M2.7** | GitHub project library (standalone analysis + add-to-resume) | M2 | Low |
| **M2.8** | GitHub project provenance (dedupe + badges + usage map) | M2.7 | Low |
| **M2.9** | GitHub token refresh + private repo opt-in | M2 | Low |
| **M2.10** | Enterprise-grade GitHub: multi-org, installations, webhooks, resilience | M2.9 | Med |
| **M2.11** | Multiple GitHub accounts per user + /github UX redesign | M2.10 | Med |
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

## M1.5 — Array-backed bullet & skill editor

**Goal:** edit experience/project bullets and skills as real arrays with
per-item add / remove / drag-reorder, instead of a single newline/comma
`<textarea>`. This is also the proper fix for the save-persistence bugs: the
`description`(string) ↔ `responsibilities`(array) round-trip was the root cause,
so making the editor array-native removes that whole class of bug.

**Subtasks**
- New reusable components:
  - `BulletListEditor` — list of single-line bullet inputs, each with a drag
    handle (reusing `SortableList`) + delete, plus "Add bullet". Generic over
    `string[]` (`value` / `onChange`).
  - `SkillsTagInput` — chip/tag input: type-to-add (Enter or comma), click-× to
    remove, drag to reorder, case-insensitive de-dupe.
- Model change: editor experience bullets become `responsibilities: string[]`
  (matching the backend), dropping the `description` string. Projects already use
  `description: string[]`; skills already `string[]`.
- Update every consumer of the old experience `description` string: `types.ts`,
  `api.ts` (to/fromBackendPayload — array passthrough, no join/split),
  `ResumePreview`, `ResumeEditorContext.acceptSuggestion`, `tailorSelection`
  (keep/discard), `keywordMatch.resumeToText`, and the LaTeX/PDF generator.
- Wire `BulletListEditor` into the Experience + Projects forms and
  `SkillsTagInput` into the Skills form.

**Algorithm (save path, now lossless)**
```
load:  backend responsibilities[] ──(fromBackendPayload, identity)──▶ editor responsibilities[]
edit:  BulletListEditor mutates the array directly (no string join/split)
save:  editor responsibilities[] ──(toBackendPayload, trim+filter empties)──▶ backend responsibilities[]
```
No intermediate string means an edited/reordered/accepted bullet can no longer be
dropped by a stale conversion.

**Verification**
- [ ] Add / edit / delete / reorder a bullet → reflected in preview and persists
      across reload.
- [ ] Accept an AI suggestion → the edited bullet survives a reload.
- [ ] Skills: add (Enter/comma), remove (×), reorder (drag), de-dupe; persists.
- [ ] PDF/LaTeX export renders bullets from the array.
- [ ] `tsc`, `eslint` (no new `any`), `vite build` all clean.

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

## M2.7 — GitHub project library (standalone analysis)

**Goal:** decouple repo analysis from the editor. Users analyze repos from a
dedicated page and build a "verified project pool"; any resume can then pull
from that pool. Cache/pricing accounting is shared with the editor flow.
**Decisions (locked):** re-analysis of a *changed* repo is **free for now**
(pricing hook added later) — only never-analyzed repos consume free slots or
charge 0.2 · new page at `/github` linked from the dashboard connect card.

### M2.7.1 — Pricing rule update (re-analysis free)

**Subtasks**
- `analyzeRepos`: chargeable set = repos whose `repo_id` has NO summary row at
  all. A row with stale `pushed_at` re-summarizes (LLM runs) but is free and
  does not consume a free slot or flip `counted_free`.
- Keep the free-slot marking for genuinely new repos unchanged.

**Algorithm (charge, revised):**
```
analyzeRepos(userId, repos):
  newRepos   = repos with no github_repo_summaries row (any pushed_at)
  changed    = repos with a row whose pushed_at differs      # re-analyzed FREE
  freeLeft   = max(0, GITHUB_FREE_REPOS - count(counted_free=1))
  freeNow    = min(freeLeft, newRepos.length)
  chargeable = newRepos.length - freeNow
  cost       = round2(chargeable * 0.2); deduct before any LLM call
```

**Verification**
- [ ] Changed repo (stale `pushed_at`) re-analyzes with an LLM call but charges 0
      and leaves `counted_free` counts untouched.
- [ ] New repo beyond the free allowance still charges exactly 0.2.
- [ ] Existing M2 tests updated to the new rule, suite green.

### M2.7.2 — Summaries endpoint

**Subtasks**
- `GET /api/github/summaries` → stored library entries:
  `[{ repoId, repoName, pushedAt, bullets, project, countedFree, createdAt, stale }]`
  where `stale` = cached profile shows a newer `pushed_at` than the row.
- No network, no LLM — reads `github_repo_summaries` (+ cached profile for `stale`).

**Verification**
- [ ] Returns only the requesting user's rows; empty array when none.
- [ ] `stale` flips true after the cached profile shows a newer push.

### M2.7.3 — `/github` page (library + repo browser)

**Subtasks**
- Route `/github`; dashboard connect card links to it ("Manage projects →").
- Library section: analyzed repos with generated bullets; `stale` rows show a
  "repo updated — re-analyze (free)" action.
- Browser section: reuse the ranked repo list + analyze flow from the modal
  (extract shared pieces from `GitHubImportModal` rather than duplicating).
- **Add to resume:** per library entry, resume picker (existing resumes query) →
  appends a project via the existing resume update mutation.

**Verification**
- [ ] Analyze from the page and from the editor modal share cache + allowance.
- [ ] Add-to-resume appends an editable project; auto-save/PDF unaffected.
- [ ] Page works when GitHub is connected but no repos analyzed yet (empty state).

### M2.7.4 — Editor modal fast-path

**Subtasks**
- Already-analyzed (non-stale) repos selected alone → skip the analyze mutation,
  fetch cached summaries, jump straight to preview.

**Verification**
- [ ] Cached-only selection reaches preview with zero LLM calls and no charge.
- [ ] Mixed selection (cached + new) still goes through analyze and prices only
      the new repos.

---

## M2.8 — GitHub project provenance (dedupe + badges + usage map)

**Goal:** track which GitHub repo a project came from so the same repo can't be
added twice to one resume, imported projects are visibly GitHub-sourced in the
editor, and the library shows where each project is already used.

### M2.8.1 — Provenance column end-to-end
- Migration: `projects.github_repo_id TEXT` (idempotent ALTER).
- `Project.create`/`findByResumeId` persist/return `githubRepoId`; import flows
  (editor modal + /github add-to-resume) stamp it; hand-written projects keep null.
- `Resume.update` child-replace dedupes incoming projects by `githubRepoId`
  (keep first) — server-side guard against double-add.

**Verification**
- [ ] `githubRepoId` round-trips create → find → update; null for manual projects.
- [ ] Update payload with two projects sharing a `githubRepoId` persists one.

### M2.8.2 — Usage map in the library
- `listSummaries` gains `inResumes: [{ id, name }]` via
  `projects.github_repo_id` ⋈ `base_resumes` (user-scoped).
- /github library cards show "In: <resume names>"; the add-to-resume picker
  disables resumes that already contain the repo ("Added").

**Verification**
- [ ] inResumes lists exactly the user's resumes containing the repo.
- [ ] Adding to a listed resume is blocked in UI; server dedupe holds regardless.

### M2.8.3 — Editor indicators + modal dedupe
- Projects form: GitHub icon beside the reorder handle when `githubRepoId` is
  set (tooltip "Imported from GitHub").
- Import modal receives the current resume's `githubRepoId`s; matching repos
  show "in this resume" and can't be selected.

**Verification**
- [ ] Icon shows only on imported projects; layout unchanged otherwise.
- [ ] Repos already in the open resume are unselectable in the modal.

---

## M2.9 — GitHub token refresh + private repo opt-in

**Goal:** stop the forced re-connect every 8 hours (GitHub App user tokens
expire when "Expire user authorization tokens" is enabled) and let users opt
into listing private repositories — public-only stays the default flow.

### M2.9.1 — Token refresh
- `github_connections` gains `encrypted_refresh_token`, `token_expires_at`,
  `refresh_token_expires_at` (idempotent ALTERs). Both tokens AES-256-GCM
  encrypted at rest.
- OAuth callback stores the full token response (`refresh_token`,
  `expires_in`, `refresh_token_expires_in` → absolute ISO expiries).
- `getValidToken(userId)`: refreshes proactively when the access token is
  within 5 min of expiry (`grant_type=refresh_token`), persists the rotated
  pair (GitHub rotates the refresh token on every use). Legacy rows without
  expiry metadata are returned as-is.
- Reactive fallback: a live GraphQL 401 forces one refresh-and-retry before
  surfacing `GITHUB_RECONNECT`. Refresh impossible/rejected → `GITHUB_RECONNECT`
  (one final re-connect for pre-M2.9 connections, then self-healing).

**Verification**
- [x] Expired/near-expiry token → one refresh call, rotated pair persisted.
- [x] Expired with no refresh token, or refresh rejected → `GITHUB_RECONNECT`.
- [x] Live 401 with valid-looking expiry → refresh + retry succeeds.

### M2.9.2 — Private repo opt-in
- `github_connections.include_private` (default 0). `POST
  /api/github/preferences { includePrivate }` toggles it and clears the
  profile cache; reconnect preserves the preference.
- GraphQL repositories query adds `privacy: PUBLIC` unless opted in, plus a
  server-side `isPrivate` post-filter as defense-in-depth.
- `/status` returns `includePrivate` + `appSlug` (new `GITHUB_APP_SLUG` env);
  UI checkbox on the connect card and /github page with a
  `github.com/apps/<slug>/installations/new` "grant repo access" link —
  private repos only appear once the app is installed on the account (app
  needs Contents: Read-only permission).
- Repo picker rows show a "Private" lock badge.

**Verification**
- [x] Default flow: query carries `privacy: PUBLIC`, private repos filtered.
- [x] Opt-in: filter dropped, private repos listed; toggle invalidates cache.
- [x] Preference survives reconnect; toggle without connection → 400.

---

## M2.10 — Enterprise-grade GitHub integration

**Goal:** repos across multiple organizations (owned or not) are discovered and
ranked by the user's actual work; org install/approval state is visible and
actionable; app lifecycle events (revocation, suspension) are handled; API
failures degrade gracefully instead of sinking whole requests.

### M2.10.1 — Multi-org repo discovery
- GraphQL affiliations gain `ORGANIZATION_MEMBER`; `repositoriesContributedTo`
  (COMMIT/PULL_REQUEST, excluding own repos) merged in, deduped by id;
  affiliated repos cursor-paginated (3 × 100 cap).
- Normalized repos carry `ownerLogin`, `ownerType`, `viewerPermission`,
  `contributed`, `commitCount` (last-year commits via
  `commitContributionsByRepository`); profile carries `organizations`.
- Ranking: `+1.5·log1p(commitCount)`, ownership down-weighted to 0.5 — org
  repos the user built rank on evidence, not ownership.
- Picker groups rows by owner with org badges.

**Verification**
- [x] Query carries ORGANIZATION_MEMBER + contributed-to + commit counts.
- [x] Affiliated+contributed merge dedupes; owner/commit metadata mapped.
- [x] Cursor pagination issues follow-up queries and merges pages.
- [x] Commit-heavy unowned org repo outranks an idle owned repo.

### M2.10.2 — Installations & org-access panel
- `listUserInstallations` (`GET /user/installations`) mirrored into
  `github_app_installations` (global — several users can share an org).
- `GET /api/github/orgs`: personal account + every org membership with the
  app's status there (`installed` / `suspended` / `not_installed`).
- /github "Organizations & access" panel with install / request-approval
  deep-links (`target_id` when the org databaseId is known); explains that
  private org repos require installation + org-owner approval.

### M2.10.3 — Webhook lifecycle receiver
- `POST /api/github/webhook`: raw-body HMAC (X-Hub-Signature-256, new
  `GITHUB_WEBHOOK_SECRET`), payload parsed only after verification;
  idempotency on X-GitHub-Delivery (`github_webhook_deliveries`).
- `github_app_authorization.revoked` → purge connection/tokens (summaries
  kept). `installation` created/deleted/suspend/unsuspend +
  `installation_repositories` → mirror install state, clear profile caches
  (rebuilt lazily). Handlers are idempotent upserts — duplicates and
  out-of-order deliveries are harmless; unknown events ack 200.
- App settings (manual): set webhook URL + secret, subscribe to Installation
  events.

**Verification**
- [x] Bad signature 401 (nothing processed); malformed JSON 400; no secret 503.
- [x] Revocation purges connection, keeps paid summaries.
- [x] Suspend/unsuspend/delete lifecycle mirrored; replayed delivery id inert.

### M2.10.4 — Rate limits & fault tolerance
- All GitHub calls go through `githubFetch`: exponential backoff on network
  errors/502/503/504; primary (`x-ratelimit-remaining: 0`) and secondary
  (`retry-after`) limits throw `GITHUB_RATE_LIMITED` with `retryAt`
  (surfaced by the API as `retryAt`).
- `analyzeRepos` is per-repo fault-tolerant: failures land in `failed[]`,
  successes keep their summaries, failed *paid* repos are auto-refunded and
  failed new repos never consume free slots.
- Security stance: user-to-server tokens only — no installation access tokens
  are ever minted or cached, so cross-tenant leakage by token confusion is
  structurally impossible.

**Verification**
- [x] 403-quota/429 map to GITHUB_RATE_LIMITED with correct retryAt.
- [x] Partial batch: failure collected, success charged, refund issued,
      free slots preserved.

---

## M2.11 — Multiple GitHub accounts + /github UX redesign

**Goal:** a user can connect up to 3 GitHub accounts (personal + work);
repos/orgs/summaries aggregate cleanly across them with per-account controls;
the /github page becomes a tabbed, searchable workspace instead of one long
vertical stack.

### M2.11.1 — Backend: multi-connection data model

- `github_connections` rebuilt from `UNIQUE(user_id)` to
  `UNIQUE(user_id, github_account_id)` — SQLite can't relax a constraint, so
  existing DBs get a transactional create-copy-swap (`database.batch`,
  all-or-nothing; detected by the missing column; row ids preserved). The key
  is GitHub's **numeric account id** (stable across renames); legacy rows keep
  a NULL id until reconnect, when a login match claims them.
- Cap `MAX_GITHUB_ACCOUNTS = 3` (`GITHUB_ACCOUNT_LIMIT`, 409; callback
  redirects `?github=limit`). The free-analysis allowance stays **per user**.
- `github_profiles` re-keyed per connection (disposable cache → drop and
  recreate); `github_repo_summaries.connection_id` added + backfilled (display
  only).
- Token layer keyed by connection id (`getValidTokenById`, `withAuthRetry`,
  refresh rotation); `fetchGithubProfile` merges per-connection profiles via
  `allSettled` — a dead account degrades to `accounts[].error`
  (GITHUB_RECONNECT) instead of blanking the others; repos deduped by id and
  tagged `connectionId`/`accountLogin`; contributions summed.
- `analyzeRepos` resolves each repo's token from its own account (per-repo
  failure + refund semantics unchanged); webhook revocation matches
  `sender.id` (login fallback for legacy rows) and removes ONLY that account.
- Routes: `/status` → `accounts[] + maxAccounts`; `/preferences` and
  `/disconnect` take optional `connectionId`; `/orgs` grouped per account;
  `/repos` tags repos and reports per-account errors.

**Verification**
- [x] Migration preserves every connection field + row id; idempotent; second
      account insertable afterwards; summaries backfilled (`githubMigration.test.js`).
- [x] Same-account reconnect rotates in place preserving include_private;
      legacy row claimed by login; different login adds a row; 4th account 409.
- [x] Merged profile: dedupe, per-account tags, summed contributions; one dead
      account → per-account error, others load.
- [x] Per-connection preference/disconnect isolation (incl. cross-user guard).
- [x] analyzeRepos uses each repo's own token; summaries stamped with source.
- [x] Webhook revocation by sender.id removes only the matching account.
- [x] Full backend suite green (184 tests).

### M2.11.2 — Frontend: accounts strip + API wiring

- `githubApi.ts` reshaped to the accounts contract; `AccountsStrip` chips
  (@login, private lock, needs-attention dot) with per-account menu (private
  toggle / reconnect / disconnect) + "+ Add account" (hidden at cap) — GitHub
  authorizes whichever account the browser is signed into, noted in the UI.
- Dashboard card + `?github=limit` flash handled.

### M2.11.3 — Frontend: /github tabbed redesign

- Header stats (credits, free analyses) + AccountsStrip; tab state in
  `?tab=library|browse|access` (deep-linkable).
- **Library**: client-side search, filter chips (All / Needs re-analysis /
  In a resume), responsive card grid, origin line (account), collapsed
  bullets with expander.
- **Browse repos**: search + account/owner/language filters, grouped picker,
  **sticky bottom action bar** (selection count · free slots · credit cost ·
  Analyze + inline 402/429/partial-failure messaging) so the CTA never
  scrolls away; per-account reconnect warnings.
- **Access & settings**: one card per account — org/installation rows with
  install deep-links, per-account private toggle, reconnect/disconnect.
- Editor import modal keeps working (shared picker; account filter when >1).

**Verification**
- [x] `tsc -b` clean; `vite build` green; eslint no net-new errors.
- [x] Old flat `/orgs` consumers gone; no stale single-account shapes.

### M2.11.4 — Post-install callback redirect fix

- With "Request user authorization (OAuth) during installation" enabled,
  GitHub redirects to the OAuth callback after an app install/repo-access
  change with `setup_action` (+ `installation_id`, sometimes a `code`) but NO
  `state` — the flow starts on github.com. The callback treated this as a
  failed OAuth and flashed "connection failed".
- Fix: callback detects `setup_action` without a valid state and lands softly
  on `/github?tab=access&github=installed` (the stray `code` is discarded —
  without a state it cannot be attributed to a user; installation webhooks
  keep repo access current). The /github page shows a success flash and
  invalidates the `['github']` queries so new repos appear immediately.

**Verification**
- [x] setup_action without state (with or without code, incl. forged state) →
      access-tab redirect, no fetch; plain bad request still flashes error.
- [x] Full backend suite green (188); tsc/build/eslint green.

## M2.12 — Org-member access diagnostics

**Goal:** when the app is installed on an org but a non-admin member can't
personally access the granted repos on GitHub (base permission "none", no
team/collaborator grant), their repo list is silently empty. GitHub filters by
`user access ∩ installation grant` — correct, but invisible. Surface it.

- `countInstallationAccessibleRepos(connectionId, installationId)` —
  `GET /user/installations/{id}/repositories` returns exactly the repos THIS
  user's token can reach through the installation (total + private count);
  `listUserInstallations` also maps `repository_selection` ('all'|'selected').
- `/orgs` org rows gain `repositorySelection` + `accessible: {total,
  privateCount}` (best-effort — a failed count never breaks the panel).
- Access & settings: installed rows show "N repos (M private) visible to
  you"; an installed org with `accessible.total === 0` gets a pointed hint —
  ask an org owner for repository access (team/collaborator), then refresh —
  plus a "Manage repo selection →" deep-link on installed orgs.

**Verification**
- [x] Accessible counts mapped (incl. the zero-access member gap case);
      repository_selection surfaced; suite green (190).
- [x] tsc/build/eslint green.

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
