# Extracting the GitHub Integration as a Reusable SDK

Assessment of whether resumate's GitHub integration (M2 series) can be packaged as an
SDK and reused across other projects — coupling audit, proposed design, extraction
plan, and tradeoffs. Companion to `docs/github-integration.md` (the "what it does"
reference; this doc is the "how to reuse it" plan).

**Verdict: yes, and the codebase is already ~85% of the way there.** The integration
was built with seams that make extraction mechanical rather than a rewrite: user
identity is an opaque `userId` string (the SDK never touches the users table), auth is
injected as route middleware, the ranking/evidence logic is already pure, and the only
app-specific logic inside the entire backend integration is **three call sites** in
`githubService.js` (one LLM call, two credit-ledger calls).

---

## 1. Coupling audit

Every GitHub-related backend file and what it imports:

| File (lines) | Depends on | Portable? |
|---|---|---|
| `lib/github/profile.js` (142) | nothing | ✅ pure already — recency decay, tech profile, `rankImportable`, `dedupeSkills` |
| `lib/crypto.js` (76) | `GITHUB_TOKEN_ENCRYPTION_KEY` env | ✅ pure — just parametrize the key instead of reading env directly |
| `routes/githubWebhook.js` (135) | `database` | ✅ generic — signature verify, delivery idempotency, installation mirroring |
| `services/githubService.js` (1250) | `database`, `crypto`, **`creditService`**, **`credits.config`**, **`aiService`** | ✅ ~1000 lines generic; ⚠️ 3 app-specific call sites (see §2) |
| `routes/github.js` (443) | `database`, `crypto`, `profile`, **`creditService`**, **`credits.config`** | ✅ generic routes; ⚠️ `/status` reports credit balance, `/analyze` reports free-slot counts |
| `lib/github/evidence.js` (53) | nothing (pure) | ❌ resume-tailoring specific — stays in resumate |
| `config/initDb.js` (github slice) | `database` | ✅ the 5 `github_*` tables + migrations move into the SDK's storage adapter |
| `routes/ai.js` (evidence loading) | `github_profiles`, `github_repo_summaries` | ❌ consumer of SDK data — stays |

The app-specific imports (bold) are confined to the **analysis/pricing path**. The
connect → discover → webhook core has zero resumate coupling beyond the database
handle.

### The three app-specific call sites in `githubService.js`

1. `summarizeRepo` → `bifrostGenerate(prompt)` (line ~1039): the LLM call with a
   resume-bullet prompt. The *fetching* (README excerpt, metadata, cache-by-pushed_at)
   is generic; the *prompt and output shape* are resumate's.
2. `analyzeRepos` → `deductCredits` / free-allowance math (lines ~1115–1122).
3. `analyzeRepos` → `grantCredits` refund on partial failure (lines ~1158–1160).

Everything else in the file — OAuth token exchange, encryption, refresh with 5-min
skew, `withAuthRetry` 401 recovery, multi-account upsert rules, GraphQL discovery +
REST installation merge, 24h profile cache, installation queries, rate-limit mapping —
is generic GitHub App machinery any project could use.

---

## 2. Proposed design: `packages/github-connect`

A workspace package in the monorepo first (`packages/github-connect`), publishable to
npm later (`@resumate/github-connect`) with zero code change. Node ≥20 ESM, no runtime
deps beyond what the host provides.

### 2.1 Package layout

```
packages/github-connect/
  src/
    core/
      crypto.js          # AES-256-GCM + HMAC state signing (key injected, not env)
      fetch.js           # githubFetch: retries, backoff, rate-limit mapping
      errors.js          # GITHUB_NOT_CONNECTED / RECONNECT / RATE_LIMITED / ACCOUNT_LIMIT
      profile.js         # recencyWeight, techProfile, rankImportable, dedupeSkills (as-is)
    service.js           # createGithubConnect(config) → the service surface
    storage/
      interface.d.ts     # StorageAdapter contract (JSDoc-typed)
      sqlite.js          # default adapter: schema DDL + migrations + queries (libsql/better-sqlite3)
    express/
      router.js          # createGithubRouter(sdk, { requireUser }) → the 8 routes
      webhook.js         # createWebhookHandler(sdk) (expects raw body, like today)
  test/                  # existing github tests move here nearly verbatim
```

### 2.2 Instantiation (what resumate's code becomes)

```js
import { createGithubConnect } from '@resumate/github-connect';
import { sqliteStorage } from '@resumate/github-connect/storage/sqlite';

export const github = createGithubConnect({
  app: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    appSlug: env.GITHUB_APP_SLUG,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET,
  },
  encryptionKey: env.GITHUB_TOKEN_ENCRYPTION_KEY,
  redirectBase: env.APP_URL,                    // where /callback redirects land
  maxAccounts: 3,                               // today's MAX_GITHUB_ACCOUNTS
  storage: sqliteStorage(database),             // or any StorageAdapter
  analyzer: resumeBulletAnalyzer,               // app hook — see 2.4
  billing: creditsBilling,                      // app hook — see 2.4
});
```

```js
// server.js
app.post('/api/github/webhook', express.raw({ type: 'application/json' }),
  createWebhookHandler(github));
app.use('/api/github', createGithubRouter(github, { requireUser }));
```

### 2.3 StorageAdapter contract

The single biggest extraction task: `githubService.js` + `routes/github.js` +
`githubWebhook.js` contain ~35 raw SQL statements against 5 tables. These become an
interface of roughly 16 methods, grouped by table:

- **connections**: `getConnections(userId)`, `getConnection(id)`,
  `findByAccountId(userId, accountId)`, `insertConnection(row)`,
  `updateTokens(id, tokens)`, `setIncludePrivate(id, bool)`, `deleteConnection(id)`,
  `deleteByAccountIdOrLogin(accountId, login)` (webhook revocation)
- **profile cache**: `getProfile(userId)`, `putProfile(userId, data)`,
  `clearProfiles(userId?)` (webhooks clear all)
- **repo summaries** (analysis cache): `getSummary(userId, repoId)`,
  `putSummary(row)`, `listSummaries(userId)`, `countFreeUsed(userId)`
- **installations**: `upsertInstallation(row)`, `deleteInstallation(id)`,
  `listInstallations()`
- **webhook deliveries**: `recordDelivery(deliveryId, event)` → boolean (dedupe)

The default `sqlite.js` adapter ships today's exact DDL + the create-copy-swap
migrations from `initDb.js`, so resumate (and any libsql/SQLite project) adopts it
with one line, while a Postgres project implements the interface (~150 lines).

**Tradeoff**: an adapter interface loses SQLite-specific atomicity idioms
(`INSERT OR IGNORE` for webhook dedupe). The interface is therefore specified in terms
of *semantics* ("recordDelivery must be atomic first-write-wins"), not SQL, and each
adapter owns its idiom (`ON CONFLICT DO NOTHING` in Postgres).

### 2.4 App hooks — how the 3 coupled call sites invert

```js
// analyzer: repo metadata + README excerpt in → summary out. The SDK owns fetching,
// caching by (userId, repoId, pushedAt), per-repo fault isolation; the app owns the
// LLM prompt and output schema. resumate's implementation wraps bifrostGenerate +
// lintSummary exactly as today.
analyzer: async ({ repo, readmeExcerpt }) => ({ summary, model }),

// billing: null → analysis is free (a new project can simply omit it).
billing: {
  quote:  async (userId, repoCount) => ({ cost, freeUsed }),  // free-allowance math
  charge: async (userId, cost) => {},                          // throws INSUFFICIENT_CREDITS
  refund: async (userId, amount) => {},                        // partial-failure refunds
}
```

This preserves resumate's exact behavior (charge upfront, refund failures, free slots
consumed only by successes) while making pricing optional for other consumers.

### 2.5 Express adapter

`routes/github.js` is already 90% generic. `createGithubRouter` takes `requireUser`
(any middleware that sets `req.user.uuid` — rename to a configurable
`getUserId(req)`) and exposes the same 8 routes. The two credit-flavored response
fields (`/status` balance, `/analyze` freeRemaining) come from `billing.quote` when a
billing hook exists, and are omitted otherwise. The error contract
(`GITHUB_NOT_CONNECTED` 400, `GITHUB_RECONNECT` 401, `GITHUB_RATE_LIMITED` 429 +
retryAt, `GITHUB_ACCOUNT_LIMIT` 409) ships in the SDK — it's what the frontend keys on.

### 2.6 What stays in resumate

- `lib/github/evidence.js` + the tailor-prompt injection in `routes/ai.js` (consume
  SDK data via `github.getProfile()` / `github.listSummaries()`).
- The resume-bullet analyzer implementation (prompt, `lintSummary` shape rules).
- The credits billing hook implementation.
- All frontend components (paper/ink themed, resume-specific import modal). The
  portable frontend pieces — `lib/githubApi.ts` (203 lines, typed client for the 8
  routes + error codes) and `useGithubConnect.ts` (popup/redirect + flash-param
  handling) — can become `@resumate/github-connect-react` in a later phase; UI
  components are a port-the-pattern, not reuse-the-code, situation.

---

## 3. What "reuse" does and doesn't mean here

**One GitHub App per consuming project.** A GitHub App has fixed callback and webhook
URLs, one client id/secret, and its own installation grants. The SDK reuses the *code*;
each project registers its own App and supplies its own five env values. (A shared
multi-tenant App serving several products from one registration is possible but a
different architecture — state would need a tenant discriminator and the callback
would need to dispatch across products. Out of scope; nothing in this design blocks it
later.)

Per-project knobs that today are constants become config: `maxAccounts`,
`profileTtlMs` (24h), `maxRepoPages` (3), `readmeExcerptChars` (3000),
`tokenExpirySkewMs` (5 min), backoff base/retries — all with today's values as
defaults.

---

## 4. Extraction plan (phased, each phase shippable)

- **SDK.1 — carve the seams in place** (no new package yet): introduce the
  `StorageAdapter` interface inside `apps/backend`, move the ~35 SQL statements behind
  it, invert the 3 app call sites into `analyzer`/`billing` hooks, thread config
  instead of env reads. The 194-test suite must stay green — behavior-preserving
  refactor, verified by the existing tests (the github suites are the spec).
- **SDK.2 — move to `packages/github-connect`**: npm workspace member; move
  `core/`, `service.js`, `storage/sqlite.js`, `express/`; move the github test files
  with it; backend imports the package. Root `package.json` gains `workspaces`.
- **SDK.3 — harden the boundary**: JSDoc-typed public API, README with the
  instantiation recipe + GitHub App registration checklist (permissions: read-only
  Contents+Metadata; events: installation, installation_repositories,
  github_app_authorization; "Expire user authorization tokens" ON), semver, CHANGELOG.
- **SDK.4 (optional, later)** — `github-connect-react`: extract `githubApi.ts` +
  `useGithubConnect` + headless hooks (`useGithubRepos`, `useGithubOrgs`); publish to
  npm if a second project materializes.

Sizing: SDK.1 is the real work (touches every SQL call site; mostly mechanical,
riskiest part is the analyze path's charge/refund ordering — its tests are thorough).
SDK.2–3 are file moves + docs. Recommended trigger: do SDK.1 now if desired (it
improves resumate's own structure regardless), but **defer SDK.2+ until the second
consumer actually exists** — a boundary designed against one consumer tends to get the
abstraction wrong; the second consumer tells you which knobs are real.

---

## 5. Risks and honest tradeoffs

1. **Premature abstraction** — the standard "rule of three" caveat: extracting before a
   second consumer exists risks baking resumate-isms into the "generic" API (e.g., the
   summary shape, the free-allowance concept living in `billing.quote`). Mitigation:
   phase SDK.1 in place, defer the package split.
2. **Adapter drift** — each new storage backend must honor subtle semantics
   (first-write-wins dedupe, upsert-preserving `include_private`, rename-stable
   account-id matching). Mitigation: ship the adapter *contract tests* as part of the
   package — any adapter must pass the same suite the sqlite one does.
3. **Migration ownership moves** — the `github_*` DDL leaves `initDb.js`; the SDK must
   version its own schema (a `github_schema_version` row) so upgrades stay idempotent
   across consumers.
4. **Webhook fan-out** — today's `clearProfileCaches()` deletes ALL users' profile
   caches on any installation event. Fine for resumate's scale; a bigger consumer will
   want per-installation targeting. Leave as-is, note in README as a known coarseness.
5. **The LLM boundary stays app-side by design** — the SDK never calls an LLM. That
   keeps it dependency-free and lets each product own its prompt, model, and data
   policy (resumate's "README + metadata only, never code" rule lives in the SDK's
   fetch layer and is inherited by everyone).
