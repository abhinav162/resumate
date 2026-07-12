import database from '../config/database.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { deductCredits } from './creditService.js';
import { CREDIT_COSTS, GITHUB_FREE_REPOS } from '../config/credits.config.js';
import { bifrostGenerate, parseJsonResponse } from './aiService.js';

/**
 * GitHub integration service (M2).
 *
 * Handles the encrypted token store (one connection per user), a TTL-cached
 * GitHub GraphQL profile fetch, and per-repo LLM summarization with a
 * (repo_id, pushed_at) cache plus the free-allowance / credit pricing model.
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// Profile payloads are considered fresh for 24h unless the caller forces a refresh.
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;

// README excerpt fed to the LLM — enough for grounding without blowing up tokens.
const README_EXCERPT_CHARS = 3000;

// Resume bullets are capped like everywhere else in the app (see tailorResume).
const MAX_BULLET_CHARS = 280;
const MAX_BULLETS = 4;

// GraphQL query: viewer identity + contribution counts + 100 most recently
// pushed repos (owned or collaborated on) with language byte breakdown.
const PROFILE_QUERY = `query {
  viewer {
    login
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
    }
    repositories(first: 100, orderBy: {field: PUSHED_AT, direction: DESC}, ownerAffiliations: [OWNER, COLLABORATOR]) {
      nodes {
        id
        name
        nameWithOwner
        description
        url
        isPrivate
        isFork
        stargazerCount
        primaryLanguage { name }
        pushedAt
        owner { login }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// Connection management (userId = internal integer users.id)
// ---------------------------------------------------------------------------

/**
 * Stores (or replaces) a user's GitHub connection. The token is encrypted at
 * rest; reconnecting overwrites the previous token/login/scopes.
 *
 * @param {number} userId
 * @param {{ token: string, login: string, scopes?: string }} connection
 */
export async function saveConnection(userId, { token, login, scopes }) {
  const encrypted = encryptToken(token);
  await database.run(
    `INSERT INTO github_connections (user_id, github_login, encrypted_token, scopes, connected_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       github_login = excluded.github_login,
       encrypted_token = excluded.encrypted_token,
       scopes = excluded.scopes,
       connected_at = excluded.connected_at`,
    [userId, login, encrypted, scopes ?? null]
  );
}

/**
 * Returns the user's connection metadata for display, or null when not
 * connected. NEVER returns the token (not even encrypted).
 *
 * @param {number} userId
 * @returns {Promise<{ login: string, scopes: string|null, connectedAt: string }|null>}
 */
export async function getConnection(userId) {
  const row = await database.get(
    'SELECT github_login, scopes, connected_at FROM github_connections WHERE user_id = ?',
    [userId]
  );
  if (!row) return null;
  return { login: row.github_login, scopes: row.scopes, connectedAt: row.connected_at };
}

/**
 * Returns the decrypted access token, or null when not connected. For internal
 * use by routes/services only — never expose it in API responses.
 *
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function getToken(userId) {
  const row = await database.get(
    'SELECT encrypted_token FROM github_connections WHERE user_id = ?',
    [userId]
  );
  if (!row) return null;
  return decryptToken(row.encrypted_token);
}

/**
 * Disconnects GitHub: removes the connection and the cached profile payload.
 * Repo summaries are kept — the user paid (credits or free allowance) for them.
 *
 * @param {number} userId
 */
export async function deleteConnection(userId) {
  await database.run('DELETE FROM github_connections WHERE user_id = ?', [userId]);
  await database.run('DELETE FROM github_profiles WHERE user_id = ?', [userId]);
}

// ---------------------------------------------------------------------------
// Fetch layer (M2.2)
// ---------------------------------------------------------------------------

/** Builds the typed error for a missing connection. */
function notConnectedError() {
  const e = new Error('GitHub account is not connected');
  e.code = 'GITHUB_NOT_CONNECTED';
  e.status = 400;
  return e;
}

/**
 * Fetches the user's GitHub profile (identity, contributions, repos) via the
 * GraphQL API, normalized for the frontend. Cached in github_profiles for 24h;
 * pass { refresh: true } to bypass the cache.
 *
 * @param {number} userId
 * @param {{ refresh?: boolean }} [opts]
 * @returns {Promise<object>} normalized profile
 */
export async function fetchGithubProfile(userId, { refresh = false } = {}) {
  // Cache hit: fresh enough and not forced → no network call at all.
  const cached = await database.get(
    'SELECT data, fetched_at FROM github_profiles WHERE user_id = ?',
    [userId]
  );
  if (cached && !refresh) {
    const age = Date.now() - Date.parse(cached.fetched_at);
    if (Number.isFinite(age) && age < PROFILE_TTL_MS) {
      return JSON.parse(cached.data);
    }
  }

  const token = await getToken(userId);
  if (!token) throw notConnectedError();

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: PROFILE_QUERY }),
  });

  // 401 = token revoked/expired. Surface a reconnect state instead of crashing.
  if (response.status === 401) {
    const e = new Error('GitHub token is no longer valid — please reconnect');
    e.code = 'GITHUB_RECONNECT';
    e.status = 401;
    throw e;
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const e = new Error(`GitHub GraphQL request failed (${response.status}): ${bodyText.slice(0, 500)}`);
    e.status = response.status;
    throw e;
  }

  const payload = await response.json();
  const viewer = payload?.data?.viewer;
  if (!viewer) {
    throw new Error('GitHub GraphQL response missing data.viewer');
  }

  const contrib = viewer.contributionsCollection ?? {};
  const normalized = {
    login: viewer.login,
    contributions: {
      commits: contrib.totalCommitContributions ?? 0,
      prs: contrib.totalPullRequestContributions ?? 0,
      reviews: contrib.totalPullRequestReviewContributions ?? 0,
      issues: contrib.totalIssueContributions ?? 0,
    },
    repos: (viewer.repositories?.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      nameWithOwner: node.nameWithOwner,
      description: node.description ?? null,
      url: node.url,
      isPrivate: !!node.isPrivate,
      isFork: !!node.isFork,
      isOwner: node.owner?.login === viewer.login,
      stars: node.stargazerCount ?? 0,
      primaryLanguage: node.primaryLanguage?.name ?? null,
      languages: (node.languages?.edges ?? []).map((edge) => ({
        name: edge.node?.name,
        bytes: edge.size,
      })),
      pushedAt: node.pushedAt,
    })),
    fetchedAt: new Date().toISOString(),
  };

  // Persist (fetched_at as ISO so TTL parsing is unambiguous) and return.
  await database.run(
    `INSERT INTO github_profiles (user_id, data, fetched_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
    [userId, JSON.stringify(normalized), normalized.fetchedAt]
  );

  return normalized;
}

/**
 * Fetches a repo's README as raw text via the REST API. Returns '' when the
 * repo has no README (404). Throws GITHUB_RATE_LIMITED when the REST quota is
 * exhausted so callers can surface a retry-later state.
 *
 * @param {string} token decrypted access token
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<string>}
 */
export async function fetchReadme(token, owner, repo) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
    {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.ok) return response.text();
  if (response.status === 404) return ''; // no README — summarize from metadata alone

  if (response.headers.get('x-ratelimit-remaining') === '0') {
    const e = new Error('GitHub API rate limit exceeded — try again later');
    e.code = 'GITHUB_RATE_LIMITED';
    e.status = 429;
    throw e;
  }

  const bodyText = await response.text().catch(() => '');
  const e = new Error(`GitHub README request failed (${response.status}): ${bodyText.slice(0, 500)}`);
  e.status = response.status;
  throw e;
}

// ---------------------------------------------------------------------------
// Summarization + pricing (M2.4)
// ---------------------------------------------------------------------------

/**
 * Lints the LLM output into the stable summary shape: bullets truncated to
 * 280 chars, capped at 4, empties dropped; project always carries the repo URL
 * and falls back to the bullets for its description.
 */
function lintSummary(parsed, repo) {
  const bullets = (Array.isArray(parsed.bullets) ? parsed.bullets : [])
    .filter((b) => typeof b === 'string' && b.trim().length > 0)
    .map((b) => b.trim().slice(0, MAX_BULLET_CHARS))
    .slice(0, MAX_BULLETS);

  const project = typeof parsed.project === 'object' && parsed.project !== null ? { ...parsed.project } : {};
  if (!project.name) project.name = repo.name;
  if (!Array.isArray(project.description) || project.description.length === 0) {
    project.description = bullets;
  }
  project.repoUrl = repo.url;

  return { bullets, project };
}

/**
 * Summarizes one repo into resume bullets + a project entry. Cached by
 * (user_id, repo_id, pushed_at): an unchanged repo never re-invokes the LLM.
 *
 * @param {number} userId
 * @param {object} repo normalized repo object (see fetchGithubProfile)
 * @param {string} token decrypted access token (for the README fetch)
 * @returns {Promise<{ bullets: string[], project: object, cached: boolean }>}
 */
export async function summarizeRepo(userId, repo, token) {
  const row = await database.get(
    'SELECT * FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
    [userId, repo.id]
  );
  if (row && row.pushed_at === repo.pushedAt) {
    return { ...JSON.parse(row.summary), cached: true };
  }

  const [owner, name] = String(repo.nameWithOwner).split('/');
  const readme = await fetchReadme(token, owner, name);
  const excerpt = readme.slice(0, README_EXCERPT_CHARS);

  const languages = (repo.languages ?? []).map((l) => l.name).filter(Boolean).join(', ');
  const prompt = `You are an expert resume writer. Turn this GitHub repository into resume content.

Repository metadata:
- Name: ${repo.nameWithOwner}
- Description: ${repo.description || '(none)'}
- Primary language: ${repo.primaryLanguage || '(unknown)'}
- Languages: ${languages || '(unknown)'}
- Stars: ${repo.stars ?? 0}
- URL: ${repo.url}

README excerpt:
---
${excerpt || '(no README)'}
---

Return ONLY valid JSON:
{
  "bullets": ["<resume bullet>", ...],
  "project": { "name": "", "description": ["<bullet>", ...], "url": "", "repoUrl": "" }
}

Rules:
- 2-4 bullets using the XYZ framework: "Accomplished X as measured by Y by doing Z".
- Max ${MAX_BULLET_CHARS} characters per bullet.
- Ground every claim ONLY in the README excerpt and metadata above.
- Do NOT fabricate metrics — omit any number that is not present in the source.`;

  const text = await bifrostGenerate(prompt, { temperature: 0 });
  const summary = lintSummary(parseJsonResponse(text), repo);

  // Upsert, PRESERVING counted_free — a re-summarized repo keeps its free slot.
  await database.run(
    `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, repo_id) DO UPDATE SET
       pushed_at = excluded.pushed_at,
       repo_name = excluded.repo_name,
       summary = excluded.summary`,
    [userId, repo.id, repo.name, repo.pushedAt, JSON.stringify(summary)]
  );

  return { ...summary, cached: false };
}

/**
 * Analyzes a user-selected set of repos, applying the pricing model (M2.7.1):
 * - NEW repos (no github_repo_summaries row at all) are the only chargeable
 *   set: they consume the GITHUB_FREE_REPOS allowance first, then cost
 *   CREDIT_COSTS.GITHUB_REPO each.
 * - CHANGED repos (row exists but pushed_at differs) re-run the LLM but are
 *   FREE for now — no charge, no free-slot consumption, and the row's
 *   counted_free flag is preserved by the summarizeRepo UPSERT. (A pricing
 *   hook for re-analysis may be added later.)
 * - Unchanged repos are served from the cache: free, no LLM.
 * Credits are deducted up-front, BEFORE any LLM call.
 *
 * @param {number} userId
 * @param {object[]} repos normalized repo objects the user selected
 * @returns {Promise<{ summaries: object[], charged: number, freeUsed: number, freeLeft: number, reanalyzed: number }>}
 */
export async function analyzeRepos(userId, repos) {
  const token = await getToken(userId);
  if (!token) throw notConnectedError();

  // Classify: "new" = no summary row at all (chargeable set); "changed" =
  // row exists but the repo was pushed to since (re-analyzed for free).
  const newIds = new Set();
  const changedIds = new Set();
  for (const repo of repos) {
    const row = await database.get(
      'SELECT pushed_at FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
      [userId, repo.id]
    );
    if (!row) newIds.add(repo.id);
    else if (row.pushed_at !== repo.pushedAt) changedIds.add(repo.id);
  }

  // Pricing (new repos only): free allowance first, then per-repo credits.
  // Round to cents to avoid floating-point dust (e.g. 3 * 0.2).
  const freeRow = await database.get(
    'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
    [userId]
  );
  const alreadyFree = Number(freeRow?.n ?? 0);
  const freeLeft = Math.max(0, GITHUB_FREE_REPOS - alreadyFree);
  const freeNow = Math.min(freeLeft, newIds.size);
  const chargeable = newIds.size - freeNow;
  const cost = Math.round(chargeable * CREDIT_COSTS.GITHUB_REPO * 100) / 100;

  // Charge BEFORE any LLM call; INSUFFICIENT_CREDITS propagates to the caller.
  if (cost > 0) {
    await deductCredits(userId, cost);
  }

  // Summarize sequentially (unchanged repos hit the cache, changed repos
  // re-run the LLM for free); mark the first freeNow NEW summaries as
  // consuming the free allowance — changed repos never flip counted_free.
  const summaries = [];
  let freeMarked = 0;
  for (const repo of repos) {
    const summary = await summarizeRepo(userId, repo, token);
    if (newIds.has(repo.id) && freeMarked < freeNow) {
      await database.run(
        'UPDATE github_repo_summaries SET counted_free = 1 WHERE user_id = ? AND repo_id = ?',
        [userId, repo.id]
      );
      freeMarked += 1;
    }
    summaries.push({ repoId: repo.id, repoName: repo.name, ...summary });
  }

  return {
    summaries,
    charged: cost,
    freeUsed: freeNow,
    freeLeft: freeLeft - freeNow,
    reanalyzed: changedIds.size,
  };
}

// ---------------------------------------------------------------------------
// Project library (M2.7.2)
// ---------------------------------------------------------------------------

/**
 * Lists the user's stored repo summaries (project library). Pure DB read —
 * no network, no LLM. `stale` is true when the cached GitHub profile shows a
 * newer pushed_at for the repo than the one the summary was generated from;
 * without a profile cache (or when the repo is absent from it) stale is false.
 *
 * M2.8.2: each entry also carries `inResumes` — the user's base resumes that
 * already contain a project imported from that repo (via projects.github_repo_id).
 *
 * @param {number} userId
 * @returns {Promise<Array<{ repoId: string, repoName: string|null, pushedAt: string,
 *   bullets: string[], project: object, countedFree: boolean, createdAt: string, stale: boolean,
 *   inResumes: Array<{ id: string, name: string }> }>>}
 */
export async function listSummaries(userId) {
  const rows = await database.all(
    `SELECT repo_id, repo_name, pushed_at, summary, counted_free, created_at
     FROM github_repo_summaries WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  // Usage map: github_repo_id → [{ id: resume uuid, name }] for this user's
  // resumes, in one query (grouped in JS below).
  const usageRows = await database.all(
    `SELECT p.github_repo_id, br.uuid AS id, br.name
     FROM projects p JOIN base_resumes br ON br.id = p.resume_id
     WHERE br.user_id = ? AND p.github_repo_id IS NOT NULL`,
    [userId]
  );
  const inResumesByRepoId = new Map();
  for (const u of usageRows) {
    if (!inResumesByRepoId.has(u.github_repo_id)) inResumesByRepoId.set(u.github_repo_id, []);
    inResumesByRepoId.get(u.github_repo_id).push({ id: u.id, name: u.name });
  }

  // Map repoId → pushedAt from the cached profile (if any) for staleness.
  const pushedAtById = new Map();
  const profileRow = await database.get(
    'SELECT data FROM github_profiles WHERE user_id = ?',
    [userId]
  );
  if (profileRow) {
    try {
      for (const repo of JSON.parse(profileRow.data)?.repos ?? []) {
        pushedAtById.set(repo.id, repo.pushedAt);
      }
    } catch {
      // Corrupt profile cache → treat as absent (stale: false everywhere).
    }
  }

  return rows.map((row) => {
    const parsed = JSON.parse(row.summary) ?? {};
    const cachedPushedAt = pushedAtById.get(row.repo_id);
    return {
      repoId: row.repo_id,
      repoName: row.repo_name,
      pushedAt: row.pushed_at,
      bullets: parsed.bullets ?? [],
      project: parsed.project ?? {},
      countedFree: Boolean(row.counted_free),
      createdAt: row.created_at,
      stale: cachedPushedAt !== undefined && cachedPushedAt !== row.pushed_at,
      inResumes: inResumesByRepoId.get(row.repo_id) ?? [],
    };
  });
}
