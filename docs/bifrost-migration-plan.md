# Plan: Migrate LLM calls to Bifrost gateway

## Goal

Replace direct Google Generative AI (Gemini) SDK calls with HTTP calls to the
self-hosted Bifrost gateway at `bifrost.abhinavaditya.com`. Public behavior of
`/api/ai/*` routes (parse, score, tailor) MUST remain identical so the frontend
needs no changes.

## Scope (verified by grep)

The entire LLM surface area lives in one file:

- **`apps/backend/src/services/aiService.js`** (193 lines)
  - imports `@google/generative-ai`
  - exports `parseResumeText`, `scoreResume`, `tailorResume`
  - internal: `getModel`, `generateWithRetry`, `PRIMARY_MODEL`,
    `FALLBACK_MODEL`

Consumers (read-only — must not change behavior):

- `apps/backend/src/routes/ai.js` — calls the three exported functions.
- `apps/backend/tests/aiService.test.js` — existing tests.
- `apps/frontend-v2/**` — calls `/api/ai/*` over HTTP. Untouched.

Out of scope:

- `apps/frontend/` (legacy frontend, not the active app — `frontend-v2` is).
  vite config references `GEMINI_API_KEY` but it is not deployed. Confirm with
  user before touching.
- Frontend code in `frontend-v2` — it talks to our own backend, not Gemini.

## Resolved decisions

1. **Bifrost endpoint** — OpenAI-compatible:
   - `POST https://bifrost.abhinavaditya.com/v1/chat/completions`
   - `Authorization: Bearer ${BIFROST_VIRTUAL_KEY}`
   - Body: `{ model, messages: [{role: "user", content: prompt}],
     response_format: {type: "json_object"} }`
   - Response: `data.choices[0].message.content` (string)
2. **Model** — Gemini through Bifrost. Use bare model name
   `gemini-3.1-pro-preview` (matches current PRIMARY_MODEL). Drop
   FALLBACK_MODEL (Bifrost handles fallbacks).
3. **JSON mode** — yes, set `response_format: {type: "json_object"}`. Keep
   the existing `parseJsonResponse` cleanup as belt-and-braces (handles fence
   blocks / minor LLM JSON glitches).
4. **Retries** — trust Bifrost. Drop the in-app retry loop entirely. BUT
   preserve the error contract that routes rely on: when Bifrost returns
   HTTP 503 (or message indicates overload), throw an Error tagged with
   `.status = 503` and `.code = 'AI_OVERLOADED'`.
5. **Env vars** — `BIFROST_URL` and `BIFROST_VIRTUAL_KEY`.

## Approach (after blockers resolved)

### Step 1 — branch
- `git checkout staging && git pull && git checkout -b llm/bifrost-migration`
- **Verify:** `git status` clean, on new branch.

### Step 2 — replace `aiService.js` internals only
Touch only `apps/backend/src/services/aiService.js`. Keep the same three
exported function signatures and return shapes.

- Delete the `@google/generative-ai` import and the `getModel` helper.
- Replace `generateWithRetry(prompt, …)` with a `bifrostGenerate(prompt, …)`
  helper that:
  - reads the Bifrost URL from env (`BIFROST_URL`, default
    `https://bifrost.abhinavaditya.com`)
  - reads the auth secret from env (name TBD per blocker #5)
  - POSTs the body shape decided by blocker #1
  - parses the response per blocker #1
  - keeps the existing retry-with-fallback loop (blocker #4) by swapping
    `model` between primary/fallback strings
- The three exported functions (`parseResumeText`, `scoreResume`,
  `tailorResume`) stay 1:1 — they only ever called `generateWithRetry`,
  so the diff inside each is zero.
- **Verify:** `git diff apps/backend/src/services/aiService.js` shows
  changes only inside that file; export signatures unchanged.

### Step 3 — env scaffolding
- Add `BIFROST_URL` and the auth-secret env var to `apps/backend/.env.example`
  (if it exists) or document in the README.
- Remove `GEMINI_API_KEY` from required-env checks (it's no longer needed
  inside the backend).
- **Verify:** `grep -r GEMINI_API_KEY apps/backend/src` returns nothing.

### Step 4 — drop the unused dep
- `npm uninstall @google/generative-ai` in `apps/backend`.
- **Verify:** package.json no longer lists it; `npm install` clean; backend
  boots without the import.

### Step 5 — tests
- Existing `apps/backend/tests/aiService.test.js` likely mocks the Gemini
  SDK. Update mocks to mock `fetch` (or whatever http client we use)
  instead. Keep the same assertions on the three exported functions'
  outputs.
- **Verify:** `cd apps/backend && npm test` — green.

### Step 6 — manual smoke against the live Bifrost endpoint
- Boot backend locally with the new env vars.
- Hit `/api/ai/parse` with a sample resume PDF text.
- Hit `/api/ai/score` with a sample `resumeData`.
- Hit `/api/ai/tailor` with a sample resume + job description.
- **Verify:** all three return well-formed JSON with the same shape as
  before. Capture one response of each as evidence.

### Step 7 — commit + PR
- Single commit on `llm/bifrost-migration`:
  `feat(backend): route LLM calls through Bifrost gateway`
- PR base: `staging` (so prod deploy goes through the same staging→main
  flow we just used).

## Non-goals (do NOT do in this PR)

- Do NOT refactor the prompt strings.
- Do NOT change the public `/api/ai/*` request/response shapes.
- Do NOT touch `apps/frontend-v2/`.
- Do NOT touch the legacy `apps/frontend/` directory.
- Do NOT add streaming support (current code is non-streaming and the
  frontend doesn't expect SSE).
- Do NOT add Bifrost-specific config knobs (model picker UI, etc.).

## Rollback

If Bifrost misbehaves in prod: revert the merge of the migration PR. The
removed `@google/generative-ai` package and `GEMINI_API_KEY` env var come
back automatically with the revert.
