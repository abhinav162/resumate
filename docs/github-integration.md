# GitHub Integration — Technical Reference

Complete technical documentation of resumate's GitHub integration: architecture,
every design decision and its rationale, the cases handled, tradeoffs taken, and
known edge cases. Built incrementally across milestones M2.0–M2.12.4 (see
`docs/ai-implementation-plan.md` for the milestone history).

Code map:

| Area | File |
|---|---|
| Service core (tokens, discovery, analysis, pricing) | `apps/backend/src/services/githubService.js` |
| HTTP routes | `apps/backend/src/routes/github.js` |
| Webhook receiver | `apps/backend/src/routes/githubWebhook.js` |
| Crypto (token encryption, OAuth state) | `apps/backend/src/lib/crypto.js` |
| Pure ranking/derivation | `apps/backend/src/lib/github/profile.js` |
| Schema + migrations | `apps/backend/src/config/initDb.js` |
| Pricing constants | `apps/backend/src/config/credits.config.js` |
| Frontend page | `apps/frontend-v2/src/pages/GitHubPage.tsx` + `components/features/github/*` |
| API client + types | `apps/frontend-v2/src/lib/githubApi.ts` |

---

## 1. Architecture: GitHub App with user-to-server tokens ONLY

We registered a **GitHub App** (not an OAuth App) but authenticate exclusively
with **user-to-server tokens** obtained through the App's OAuth flow. We never
mint or cache **installation (server-to-server) tokens**.

**Why this is the single most important decision in the integration:**

- An installation token sees *everything the installation grants*, regardless
  of which user is asking. If we used installation tokens, user A of org X
  could read private repos that user B installed — a cross-tenant data leak by
  construction. With user-to-server tokens, **every API result is the
  intersection of (what the user can access on GitHub) ∩ (what the
  installation grants)**. GitHub itself enforces the boundary; we cannot leak
  what the token cannot see.
- It also means we inherit GitHub's own permission model for free: org base
  permissions, team grants, collaborator invites, repo visibility — all
  enforced upstream.

**Why a GitHub App instead of a classic OAuth App:**

- Fine-grained, installation-scoped repo selection ("only these 4 repos"), so
  org admins never grant blanket `repo` scope.
- Read-only permission set: **Contents: read** + **Metadata: read**. Nothing
  else. We physically cannot write to repos or read org membership lists.
- Expiring tokens + refresh tokens (opt-in app setting) limit blast radius of
  a leaked token to ~8 hours.
- Webhooks for lifecycle events (revocation, install/uninstall, repo
  selection changes).

**Tradeoff accepted:** without the org **Members** permission,
`viewer.organizations` (GraphQL) only reveals *publicized* org memberships.
Concealed members (GitHub's default!) return no org row. This caused a real
production bug (M2.12.4) and is compensated in `/orgs` by deriving org rows
from three sources (§8).

---

## 2. Connect flow (OAuth)

`GET /api/github/connect` → `GET /api/github/callback` in `routes/github.js`.

1. **/connect** (authenticated): returns
   `https://github.com/login/oauth/authorize?client_id&redirect_uri&state`.
   `state = signState({ u: user.uuid })` — base64url(JSON + issued-at) plus an
   HMAC-SHA256 signature, verified with `timingSafeEqual`, max age **10
   minutes**.
   - *Why signed state:* the callback arrives as a **browser redirect with no
     auth headers**. The signed state is the only way to attribute the code to
     a user without trusting a query param. It simultaneously provides CSRF
     protection (an attacker cannot forge a state binding *their* code to
     *your* account).
   - The HMAC key is derived from `GITHUB_TOKEN_ENCRYPTION_KEY`
     (`sha256(key + ':oauth-state')`) so operators manage **one** secret.
2. **/callback**: verifies state → exchanges `code` for tokens at
   `github.com/login/oauth/access_token` → fetches `/user` for
   `login` + numeric `id` → `saveConnection()` → redirect to
   `FRONTEND_URL/dashboard?github=connected`.
   - The token exchange and `/user` fetch happen **server-side**; the access
     token is **never sent to the client, never logged**, and stored only
     encrypted (§3).
   - Failure at any step redirects to `?github=error` (flash banner), never a
     JSON error — this endpoint is a browser navigation, not an XHR.

### 2.1 Post-install redirects without state (M2.11.4 / M2.12.3)

Our App has **"Request user authorization (OAuth) during installation"**
enabled. Consequence: after a user installs/configures the app **starting from
github.com** (not from our /connect), GitHub redirects them to our OAuth
callback with `setup_action` (+ `installation_id`, sometimes a `code`) but **no
`state`** — that flow never passed through us, so no state exists.

Originally this fell into the strict "missing state" branch and flashed
"GitHub connection failed" after a *successful* install (real production bug).
Handling now:

```
no code / no valid state:
  setup_action present?
    'request'          → redirect /github?tab=access&github=requested   (warning flash)
    'install'/'update' → redirect /github?tab=access&github=installed   (success flash)
  else                 → redirect /dashboard?github=error
```

- `setup_action=request` is the **non-admin org member** path: they *asked*
  an owner to approve the installation; **nothing is granted yet**. Showing a
  success flash would lie — the UI says "Access request sent — an organization
  owner must approve it before those repos appear here."
- There is nothing to persist in this branch even when a `code` is present:
  without state the code cannot be safely attributed to a user, and
  installation webhooks + the next `/orgs` refresh keep access state current
  anyway. **Tradeoff:** we discard a usable code rather than risk attaching a
  token to the wrong account.
- The `installed` flash also invalidates the frontend's `['github']` query
  cache so the panel reflects new access immediately.

### 2.2 Tampered / expired state

`verifyState` returns null on bad signature **or** age > 10 min. A tampered
state with `setup_action` present still soft-lands (the setup_action branch);
a plain tampered state → `?github=error`. Covered by
`tests/githubCallback.test.js` (5 cases, including the request-vs-install
distinction).

---

## 3. Token storage, expiry, refresh

### Storage (M2.1)

- Access + refresh tokens encrypted at rest with **AES-256-GCM** (12-byte
  random IV, auth tag verified on decrypt → tampering throws). Key:
  `GITHUB_TOKEN_ENCRYPTION_KEY`, 64 hex chars (32 bytes), validated on use.
- Format `iv:tag:ciphertext` (base64 segments) in
  `github_connections.encrypted_token` / `encrypted_refresh_token`.
- **Invariant:** no code path returns a token (even encrypted) in an API
  response. `getConnection`/`listConnections` explicitly select only metadata.

### Expiring tokens (M2.9.1)

With "Expire user authorization tokens" on, GitHub returns `expires_in`
(~8h) + `refresh_token` (~6 months). We store **absolute ISO timestamps**
(computed at receipt) rather than relative seconds — unambiguous across
restarts. `null` expiry = non-expiring token (setting off, or legacy row) and
is returned as-is.

Refresh logic (`getValidTokenById`):

- Refresh when the token expires within **5 minutes**
  (`TOKEN_EXPIRY_SKEW_MS`) — otherwise a token could pass the check and die
  mid-request-batch.
- GitHub **rotates the refresh token on every use**; we persist the new pair
  atomically. If GitHub omits a new refresh token, we keep the old one.
- `withAuthRetry(connectionId, request)`: wraps every authenticated call; on a
  **live 401** it force-refreshes once (ignoring stored expiry — a 401 proves
  the token is dead regardless of what the row claims: revocation, clock skew,
  legacy rows without expiry metadata) and retries. A second 401 →
  `GITHUB_RECONNECT` (401 to client) → the UI shows a reconnect prompt.
- Refresh impossible (no refresh token / refresh expired / GitHub rejects) →
  `GITHUB_RECONNECT`. Only a full re-connect can fix those.

**Edge case handled:** the original 8h-expiry bug — users were silently
"logged out" of GitHub features every 8 hours until reconnecting. The skew +
rotation + 401-retry stack eliminated it.

---

## 4. Data model

```
github_connections        id PK AUTOINCREMENT, user_id, github_account_id TEXT,
                          github_login, encrypted_token, scopes,
                          encrypted_refresh_token, token_expires_at,
                          refresh_token_expires_at, include_private (0/1),
                          connected_at, UNIQUE(user_id, github_account_id)
github_profiles           connection_id INTEGER PRIMARY KEY, user_id, data (JSON),
                          fetched_at          -- 24h TTL cache, disposable
github_repo_summaries     (user_id, repo_id) unique, repo_name, pushed_at,
                          summary (JSON), counted_free, connection_id, created_at
github_app_installations  installation_id PK, account_login, account_type,
                          suspended, updated_at   -- webhook mirror
github_webhook_deliveries delivery_id PK, event   -- idempotency ledger
projects.github_repo_id   -- provenance link from resume projects to repos
```

Key choices:

- **`github_account_id` = GitHub's numeric user id**, stored as TEXT. Numeric
  id is **stable across renames** — matching by login would orphan
  connections when users rename. Login is stored for display only.
- **Client-facing identifier is the connection row id**, never the GitHub
  account id — avoids leaking GitHub ids and keeps the API stable if the
  keying strategy ever changes.
- `github_profiles` keyed by `connection_id` (one cache row per account); it
  is a **disposable cache** — every invalidation path just deletes rows and
  the next request rebuilds lazily.
- `github_repo_summaries` keyed `(user_id, repo_id)` — summaries are **per
  user** (they paid for them) and survive disconnects (§10).

### 4.1 Migration strategy (M2.11.1)

The pre-M2.11 table had `UNIQUE(user_id)` — one account per user. SQLite
cannot relax a UNIQUE constraint in place, so the migration is a
**create-copy-swap** detected via `PRAGMA table_info` (missing
`github_account_id` column), executed with `database.batch([...])` — libsql
runs the array in **one transaction**, all-or-nothing, so a crash mid-migration
cannot leave a half-renamed table. Row **ids are preserved** (explicitly
copied) because `github_repo_summaries.connection_id` and profile cache rows
reference them. Legacy summaries get backfilled:
`connection_id = MIN(id) of the user's connections`. The old profiles table is
simply dropped and recreated (cache, no data loss). Idempotent — re-running
`createTables()` is a no-op. Regression-tested end-to-end in
`tests/githubMigration.test.js` (byte-for-byte field survival on a full legacy
row).

---

## 5. Multi-account model (M2.11)

Up to **`MAX_GITHUB_ACCOUNTS = 3`** connections per user (personal + work
accounts is the target use case; 3 is a spam/abuse cap, trivially raisable).

### saveConnection upsert rules (order matters)

1. **Same (user, accountId) exists** → token rotation **in place**;
   `include_private` is **preserved** (reconnecting must not silently flip a
   privacy choice); `connected_at` refreshed.
2. **Legacy row (NULL accountId)** → claimed only when the **login matches**
   (provably the same account), or when the caller itself has no accountId
   (pre-M2.11 semantics). A different login means the user is genuinely adding
   a second account — never overwrite someone's existing connection.
3. Otherwise **INSERT**, capped: ≥3 existing rows →
   `GITHUB_ACCOUNT_LIMIT` (409) → callback redirects with `?github=limit`
   (warning flash), API returns 409.

### Per-account vs per-user semantics

| Thing | Scope | Why |
|---|---|---|
| `include_private` preference | per **connection** (API accepts optional `connectionId`; absent = all) | one account may be personal-public, another work-private |
| Profile cache | per **connection** | independent TTLs, independent invalidation |
| Free repo allowance (`GITHUB_FREE_REPOS = 10`) | per **USER** | it's a pricing allowance — connecting more accounts must not multiply free credit |
| Repo summaries | per **user**, stamped with source `connection_id` | paid artifacts; `accountLogin` shown in the library |
| Rate-limit budget on GitHub's side | per **account/token** | inherent to user-to-server tokens |

### Merged profile (`fetchGithubProfile`)

Per-connection profiles are fetched with `Promise.allSettled` and merged:

- **Repos deduped by GraphQL node id across accounts** (first account wins),
  each tagged `connectionId` + `accountLogin` so analysis can pick the right
  token and the UI can badge the source.
- **Contributions summed** across accounts; **organizations deduped** by login.
- **Partial failure is first-class:** one dead account (revoked, needs
  reconnect) reports `accounts[i].error = 'GITHUB_RECONNECT'` while the other
  accounts' repos still render. Only when **every** account fails does the
  first rejection propagate as the response error. This was a deliberate
  choice: a user with one broken work account must not lose their whole page.
- `fetchedAt` mirrors the first successful profile's timestamp so repeated
  merges of unchanged caches stay deep-equal (stable for frontend caching).

---

## 6. Discovery pipeline — what repos we find and how

Per connection, `fetchConnectionProfile` runs one GraphQL query (+ cursor
pages) and one REST sweep:

### 6.1 GraphQL (primary)

`viewer { login, contributionsCollection {...}, organizations(first: 50),
repositories(...), repositoriesContributedTo(...) }`

- `repositories(first: 100, orderBy: PUSHED_AT DESC, ownerAffiliations:
  [OWNER, COLLABORATOR, ORGANIZATION_MEMBER])`, cursor-paged up to
  **3 pages (300 repos)** (`MAX_REPO_PAGES`). *Tradeoff:* a hard cap keeps a
  full refresh cheap (≤4 GraphQL calls) for huge accounts; PUSHED_AT ordering
  means anything cut off is years-stale and worthless for a resume anyway.
- `repositoriesContributedTo(first: 100, contributionTypes: [COMMIT,
  PULL_REQUEST], includeUserRepositories: false)` — **one page**. Catches
  repos the user contributed to without holding any affiliation (e.g. drive-by
  OSS contributions).
- `commitContributionsByRepository(maxRepositories: 100)` — last-year per-repo
  commit counts, the strongest "this is *my* work" ranking signal for org
  repos the user doesn't own.
- **Privacy is filtered at the query level**: `privacy: PUBLIC` is appended
  unless the connection opted into private repos — private repo metadata never
  even enters the process for public-only users. A second **defense-in-depth
  filter** after normalization drops private nodes again in case GitHub ever
  returns them.
- Dedup affiliated ∪ contributed by node id, **affiliated wins** (same fields,
  and its ordering already reflects PUSHED_AT rank).

### 6.2 REST installation merge (M2.12.2) — closing the base-permission gap

**The bug this fixes (real production case):** org member `jeevan-hq` could
open `HireQuotient/hq-sourcing-backend` on github.com, and the installation
covered it — yet the repo didn't appear in resumate. Cause: his access came
from the org's **base member permission**, with no team/collaborator grant, and
GraphQL `ownerAffiliations: [... ORGANIZATION_MEMBER]` **does not return
base-permission-only repos**.

Fix: `GET /user/installations` → for each non-suspended installation
`GET /user/installations/{id}/repositories` (per_page=100). This endpoint
returns **exactly (user's access ∩ installation grant)** — the precise set of
repos we can analyze on the user's behalf. Merge rules:

- Only repos whose `node_id` is not already known. Crucially, `seenIds` holds
  the **pre-privacy-filter** GraphQL ids — otherwise a private repo dropped by
  the privacy filter would be *resurrected* by the REST merge for a
  public-only user.
- `includePrivate` gate applied to REST rows too.
- REST rows are normalized to the GraphQL shape:
  `permissions {admin|maintain|push|triage|pull}` →
  `viewerPermission ADMIN|MAINTAIN|WRITE|TRIAGE|READ`; `languages: []` (REST
  list objects carry no per-language byte breakdown — ranking/display fall back
  to `primaryLanguage`); commit count joined from the GraphQL contributions
  map.
- **Entirely best-effort:** the whole merge is try/caught, and inside it each
  installation is try/caught — one broken/suspended installation never sinks
  discovery, and REST failure degrades to GraphQL-only results rather than an
  error.

### 6.3 Profile cache

Normalized profile JSON cached in `github_profiles` for **24h**
(`PROFILE_TTL_MS`); `?refresh=true` bypasses. Invalidation deletes rows:
preference change (that connection / all), disconnect, and webhooks
(installation & repo-selection events clear **all** profile caches — coarse
but safe, §11).

---

## 7. Ranking & tech profile (pure module, `lib/github/profile.js`)

Deliberately **pure and deterministic** (no DB/network; `now` injectable) so it
is trivially unit-testable.

- `recencyWeight = 0.5 ^ (ageMonths / 12)` — 12-month half-life on last push.
- **techProfile** (language mix): per non-fork repo, each language contributes
  `bytes × recencyWeight × (1 + log1p(stars))`; top 15 languages with percent.
- **rankImportable** (import picker order), non-fork only:
  `2.0·log1p(stars) + 3.0·recencyWeight + 1.5·log1p(commitCount) +
  0.5·isOwner + 0.5·hasDescription`.
  - Recency dominates stars (a resume is about *current* competence).
  - `commitCount` makes org repos the user actually built rank on
    **evidence, not ownership** — without it, work repos (usually 0 stars,
    not owned) sank below toy personal repos.
  - Stable sort: ties keep input order (already PUSHED_AT ranked).
- **Forks are excluded everywhere** — fork metadata (stars, languages)
  describes the upstream project, not the user's work.

---

## 8. Organizations & access panel (`GET /api/github/orgs`)

The panel answers the support question that otherwise generates tickets:
*"why don't I see my org's private repos?"*

For each connected account, each row is
`{ login, type, databaseId, status: installed|suspended|not_installed,
repositorySelection: all|selected, accessible: {total, privateCount} | null }`.

### 8.1 Org candidates come from THREE sources (M2.12.4)

Because the app lacks the org **Members** permission, GraphQL
`viewer.organizations` only reveals **publicized** memberships — and GitHub
conceals membership **by default**. Real bug: jeevan's membership was
concealed, so after his access request was approved his panel showed *no org
row at all* while the org's repos happily flowed into Browse. Sources, deduped
case-insensitively, self-login excluded:

1. **Declared (publicized) memberships** — GraphQL, carries `databaseId`.
2. **Installations the token can see** (`type === 'Organization'`) —
   `databaseId` from the installation's account id.
3. **Owners of org repos in this account's merged listing** — catches
   concealed membership + not-installed-yet cases; no `databaseId` available.

*Tradeoff:* source 3 without a `databaseId` means the install deep-link can't
pre-target the org (`.../installations/new/permissions?target_id={id}` needs
the numeric id) — those rows link to the generic install page instead.

### 8.2 Access diagnostics (M2.12)

For installed, non-suspended rows we call
`countInstallationAccessibleRepos` → "**N repos (M private) visible to you**".
`total` comes from the endpoint's `total_count` (covers all pages);
`privateCount` is derived from the first 100 — a documented approximation,
plenty for a diagnostic hint. Count fetch is try/caught; on failure the row
renders with `accessible: null` (status badge still works).

**The killer diagnostic:** installed org + `accessible.total === 0` → the
**member-access gap** warning: the app is installed and repos are granted, but
*this user* can't reach any of them on GitHub — "Ask an org owner to give you
repository access (via a team or as a collaborator), then refresh." Without
this, the user sees "installed" and an inexplicably empty repo list.

### 8.3 Multi-member org flow (how approval actually works)

1. First member (admin) installs → picks repos → repos appear for them.
2. Second member connects → sees the installation → their repos =
   (their access ∩ grant); if that's 0, the gap warning explains it.
3. A **non-admin** hitting install triggers GitHub's *request* flow →
   `setup_action=request` → honest "requested" flash (§2.1); after an owner
   approves, webhooks clear caches and the next refresh picks everything up.
4. Any member with repo access can *add* repos to the installation's selection
   (GitHub-side rules apply); `installation_repositories` webhooks keep us
   current.

---

## 9. Analysis: repo → resume bullets (M2.4)

`POST /api/github/analyze { repoIds }` (≤20 per call) → `analyzeRepos`.

### What we send to the LLM — and what we never send

**Sent:** repo metadata (name, description, primary language, language list,
stars, URL) + **first 3,000 chars of the README** (`README_EXCERPT_CHARS`),
fetched via REST with `Accept: application/vnd.github.raw+json`; 404 (no
README) → summarize from metadata alone.

**Never sent:** source code, commits, diffs, issues, PRs, or anything from
repos the user didn't explicitly select. Private repos require the opt-in
preference *and* explicit selection.

Prompt contract: 2–4 bullets, XYZ framework, ≤280 chars each, **grounded only
in the provided excerpt/metadata, no fabricated metrics** (temperature 0).
Output is linted defensively (`lintSummary`): non-strings dropped, truncated to
280, capped at 4, project name/description/repoUrl backfilled — a malformed
LLM response degrades, never crashes.

### Caching

Summary cached by `(user_id, repo_id, pushed_at)`: an unchanged repo **never
re-invokes the LLM**. `pushed_at` is the cheapest reliable change signal (no
tree hashing, no clone). Upsert preserves `counted_free`.

### Pricing (M2.7.1)

- **NEW** repos (no summary row ever) are the only chargeable set: first
  `GITHUB_FREE_REPOS = 10` per **user** are free (`counted_free=1`), then
  `CREDIT_COSTS.GITHUB_REPO = 0.2` credits each.
- **CHANGED** repos (row exists, `pushed_at` differs) re-run the LLM **free**
  (deliberate: pricing hook may come later) and never flip `counted_free`.
- **Unchanged** → cache hit, free, no LLM.
- Credits are deducted **up-front, before any LLM call** (a user can't get
  summaries they can't pay for), with **automatic refunds** for paid new repos
  that fail — the user never pays for a summary they didn't get. All money
  math rounds to cents (`Math.round(x*100)/100`) to kill floating-point dust
  (`3 × 0.2` ≠ 0.6 in IEEE754).
- Free slots are assigned to the first N new repos that **actually succeed**,
  not the first N requested — a failed repo doesn't burn a free slot.

### Fault tolerance (M2.10.4 + M2.11)

Sequential per-repo processing with per-repo try/catch: one repo failing
(deleted mid-batch, org access lost, rate limit, its account needs reconnect)
lands in `failed: [{repoId, repoName, code}]` while the rest complete. Each
repo's README is fetched with **its own account's token** (`repo.connectionId`
from the merged profile), resolved lazily and cached per connection — one dead
account fails only its own repos. Response:
`{ summaries, charged, freeUsed, freeLeft, reanalyzed, failed, creditsLeft }`.

### Library & staleness (M2.7.2 / M2.8)

`GET /api/github/summaries` is a pure DB read. Each entry carries:
`stale` (any cached profile shows newer `pushed_at` than analyzed; no cache /
repo absent → `false` — never guess), `accountLogin` (LEFT JOIN; null if the
source connection is gone), `countedFree`, and `inResumes` (base resumes
containing a project imported from that repo, via `projects.github_repo_id`
provenance — powers "already in resume X" badges and import dedupe).

Summaries **survive disconnect by design** — the user paid for them, and they
contain no tokens, just generated text.

### Downstream: tailoring evidence (M2.6)

Tailoring injects a cached evidence block ≤1,500 chars: top 6 languages,
contribution counts, ≤5 analyzed repos × ≤3 bullets. Cached artifacts only —
tailoring never triggers GitHub API or LLM summarization calls.

---

## 10. Resilience & rate limiting

### `githubFetch` (every GitHub call, M2.10.4)

- Network errors and 502/503/504 → exponential backoff retries (2 retries,
  base `GITHUB_BACKOFF_MS` = 500ms).
- Primary quota exhaustion (403/429 + `x-ratelimit-remaining: 0`) and
  secondary abuse limits (`retry-after`) → typed `GITHUB_RATE_LIMITED` (429)
  with `retryAt` derived from `retry-after` or `x-ratelimit-reset` — we stop
  immediately instead of hammering, and the UI can show "try again at T".
- GitHub budget: 5,000 REST req/hr + 5,000 GraphQL points/hr **per account
  token** — the 24h profile cache and summary cache keep normal usage at a few
  calls/day per user.

### Our own limiter (`server.js`)

`app.set('trust proxy', 1)` + express-rate-limit: **600 req / 15 min / client
IP** in production (10,000 in dev), JSON body with code `RATE_LIMITED`,
`standardHeaders: true`. Webhook paths (`/api/github/webhook`,
`/api/credits/webhook`) are **skipped** — GitHub/Razorpay bursts must never be
throttled, they have their own HMAC auth.
**Bug this fixed:** without `trust proxy`, every user behind the reverse proxy
shared the proxy's IP → one global 100/15min bucket → spurious 429s in normal
use. (If a CDN is ever added in front, bump to `trust proxy, 2`.)

---

## 11. Webhooks (`POST /api/github/webhook`, M2.10.3)

- Mounted with `express.raw()` **before** `express.json()` — HMAC-SHA256
  (`x-hub-signature-256`) is verified against the **raw bytes** with
  `timingSafeEqual`; the payload is never parsed before the signature checks
  out. No secret configured → 503.
- **Idempotency:** GitHub delivers at-least-once; `INSERT OR IGNORE` on
  `x-github-delivery` into `github_webhook_deliveries` dedupes atomically.
  All handlers are idempotent upserts/deletes, so out-of-order arrivals are
  also harmless.
- **Always 200 after signature+parse** (even if a handler throws, we log and
  ack): GitHub retries on non-2xx, and a retry storm buys nothing over the
  next legitimate event or the lazy 24h cache rebuild.

Events:

| Event | Handling |
|---|---|
| `github_app_authorization` / `revoked` | Delete the **matching connection only**: by numeric account id (`sender.id`, rename-safe) with login fallback for legacy NULL-id rows. The user's *other* accounts survive. Profile cache cleared per affected user. Paid summaries kept. |
| `installation` (created/deleted/suspend/unsuspend/…) | Mirror into `github_app_installations`; clear **all** profile caches. |
| `installation_repositories` (added/removed) | Clear all profile caches. |
| anything else | 200, ignored. |

*Tradeoff (coarse cache clear):* installation events don't tell us which of
*our* users are affected (installations are account-level, users are ours), so
we drop every profile cache. Cheap: caches rebuild lazily on next request, and
these events are rare. Precision wasn't worth the mapping complexity.

**Known limitation:** org **approval** of a member's access request emits
`installation` events we do catch, but there is no webhook for "your request
was approved" per se — the requesting user just sees the org row flip to
`installed` on their next panel load.

---

## 12. Error contract

All GitHub routes funnel errors through `sendGithubError`:

| Code | HTTP | Meaning / UI behavior |
|---|---|---|
| `GITHUB_NOT_CONNECTED` | 400 | No connection; UI shows connect card |
| `GITHUB_RECONNECT` | 401 | Token dead, refresh impossible; UI shows reconnect prompt (per-account in `/repos` `accounts[].error`) |
| `GITHUB_RATE_LIMITED` | 429 | GitHub quota; carries `retryAt` |
| `INSUFFICIENT_CREDITS` | 402 | Analysis pricing |
| `GITHUB_ACCOUNT_LIMIT` | 409 | 4th account attempt; callback path uses `?github=limit` flash |
| `RATE_LIMITED` | 429 | **Our** limiter (JSON body), distinct from GitHub's |
| (unknown) | `error.status` or 500 | Logged server-side |

Config guard: `/connect`, `/callback` require `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY` → 503 "not configured"
otherwise, so a mis-deployed instance fails loudly and safely.

---

## 13. Frontend (`/github`, M2.11.3)

Tabbed workspace, tab in the URL (`?tab=library|browse|access`) so flashes and
support links can deep-target:

- **Library** — analyzed summaries: bullets, project draft, `stale` badge,
  `accountLogin` badge, "in resume X" links, add-to-resume.
- **Browse** — merged repo list grouped by owner, rank-ordered, lock badges on
  private repos, analyzed markers, per-account error chips (reconnect), free
  allowance counter, sticky analyze bar (sticks to the main scroll container —
  the sidebar is viewport-pinned, `AppLayout` is `h-screen overflow-hidden`
  with `main` as the single scroll area).
- **Access & settings** — accounts strip (≤3, add/disconnect per account),
  per-account private-repo toggle, organizations panel (§8) with install /
  manage-selection deep-links (`https://github.com/apps/{slug}/installations/new/permissions?target_id={databaseId}`
  when the id is known).
- Flash params (click-to-dismiss removes the param): `github=connected` ✓,
  `installed` ✓ (+ invalidates `['github']` queries once), `requested` ⚠
  honest pending copy, `limit` ⚠, `error` ✗.

---

## 14. Edge-case catalog (quick reference)

| # | Case | Handling |
|---|---|---|
| 1 | Callback without state (post-install redirect) | Soft-land on access tab, `installed`/`requested` flash (§2.1) |
| 2 | `setup_action=request` (non-admin) | Warning flash — nothing granted yet; success would lie |
| 3 | Tampered/expired state | `verifyState` → null → error redirect (or soft-land if setup_action) |
| 4 | Token expired mid-batch | 5-min skew refresh + live-401 force-refresh-once (§3) |
| 5 | Refresh token dead | `GITHUB_RECONNECT` → reconnect UI |
| 6 | User renames GitHub account | Connections keyed by numeric id — unaffected; login updated on next connect; webhook revocation also matches by id |
| 7 | Same account reconnected | In-place rotation; `include_private` preserved; no duplicate row |
| 8 | Legacy (pre-M2.11) row on reconnect | Claimed only on login match; different login = genuine second account |
| 9 | 4th account | 409 / `?github=limit` |
| 10 | One of N accounts dead | Others still load; per-account `error` in payload (§5) |
| 11 | Org repo via base permission only | REST installation merge (§6.2) |
| 12 | Private repo + public-only preference | Filtered in query, post-filter, **and** REST merge gate (`seenIds` pre-filter trick) |
| 13 | Concealed org membership | Org rows from installations + repo owners (§8.1) |
| 14 | Member of installed org with zero repo access | `accessible.total === 0` gap warning (§8.2) |
| 15 | Suspended installation | Badged; skipped in counts and REST discovery |
| 16 | One broken installation among several | Per-installation try/catch — others still merge |
| 17 | Repo deleted / access lost mid-analysis | Per-repo `failed[]`, batch continues, paid failures refunded |
| 18 | No README | 404 → '' → metadata-only summary |
| 19 | Malformed LLM output | `lintSummary` degrades gracefully |
| 20 | Repo unchanged since analysis | Cache hit — no LLM, no charge |
| 21 | Free slots vs failures | Slots consumed only by repos that succeed |
| 22 | Duplicate webhook delivery | Delivery-id dedupe + idempotent handlers |
| 23 | Webhook handler throws | Log + 200 (retries pointless; caches rebuild lazily) |
| 24 | Revocation with other accounts connected | Only the revoking account's row deleted |
| 25 | GitHub 5xx flapping | Backoff retries in `githubFetch` |
| 26 | GitHub quota exhausted | `GITHUB_RATE_LIMITED` + `retryAt`, immediate stop |
| 27 | All users behind one proxy IP | `trust proxy` + 600/15min |
| 28 | >300 affiliated repos | Page cap; PUSHED_AT order makes the tail stale/irrelevant |
| 29 | Same repo visible from two connected accounts | Deduped by node id, first account wins |
| 30 | Corrupt cached profile JSON | try/catch → treated as absent (`stale: false`) |
| 31 | Disconnect | Tokens + caches deleted; paid summaries kept (`accountLogin` → null) |
| 32 | Mid-migration crash | `database.batch` transaction — all-or-nothing |

---

## 15. Configuration

| Env var | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | App OAuth credentials |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | 64 hex chars; AES key + HMAC-state key root |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC secret |
| `GITHUB_APP_SLUG` | Install deep-links |
| `GITHUB_REDIRECT_URI` | Optional callback override (default `BACKEND_URL/api/github/callback`) |
| `GITHUB_BACKOFF_MS` | Retry base delay (default 500) |

Tunables in code: `MAX_GITHUB_ACCOUNTS=3`, `PROFILE_TTL_MS=24h`,
`README_EXCERPT_CHARS=3000`, `MAX_BULLETS=4`/`MAX_BULLET_CHARS=280`,
`TOKEN_EXPIRY_SKEW_MS=5min`, `REPO_PAGE_SIZE=100`/`MAX_REPO_PAGES=3`,
`GITHUB_FREE_REPOS=10`, `CREDIT_COSTS.GITHUB_REPO=0.2`, analyze batch ≤20.

## 16. Testing

`node --test` (194 tests green): `githubService.test.js` (fetch-mock harness
routing GraphQL by bearer token + REST by URL; multi-account, installation
discovery, pricing/refunds, fault tolerance), `githubMigration.test.js`
(legacy-schema end-to-end), `githubCallback.test.js` (handler invoked directly
off the router stack; all redirect branches), `githubWebhook.test.js`
(signatures, idempotency, revocation matching), `profile.test.js` (pure
ranking). Frontend: `tsc -b`, eslint, `vite build`.

## 17. Known limitations / future work

- Concealed-membership org rows lack `databaseId` → generic install link.
- `privateCount` diagnostic derived from first 100 granted repos.
- Re-analysis of changed repos is free (pricing hook deferred deliberately).
- REST-merged repos have no per-language byte breakdown.
- No webhook for "access request approved" — state refreshes on next load.
- Cross-user summary sharing (same org repo analyzed twice) is a future
  pricing/product decision.
