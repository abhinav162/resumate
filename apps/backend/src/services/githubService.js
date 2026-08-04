import database from '../config/database.js';
import { encryptToken, decryptToken } from '../lib/crypto.js';
import { deductCredits, grantCredits } from './creditService.js';
import { CREDIT_COSTS, GITHUB_FREE_REPOS } from '../config/credits.config.js';
import { bifrostGenerate, parseJsonResponse } from './aiService.js';

/**
 * GitHub integration service (M2).
 *
 * Handles the encrypted token store (M2.11: up to MAX_GITHUB_ACCOUNTS
 * connections per user, keyed by GitHub's numeric account id), a TTL-cached
 * per-connection GraphQL profile fetch merged across accounts, and per-repo
 * LLM summarization with a (repo_id, pushed_at) cache plus the free-allowance
 * / credit pricing model (the allowance stays per USER, not per account).
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

// M2.11 — hard cap on connected GitHub accounts per user.
export const MAX_GITHUB_ACCOUNTS = 3;

// Profile payloads are considered fresh for 24h unless the caller forces a refresh.
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;

// README excerpt fed to the LLM — enough for grounding without blowing up tokens.
const README_EXCERPT_CHARS = 3000;

// Resume bullets are capped like everywhere else in the app (see tailorResume).
const MAX_BULLET_CHARS = 280;
const MAX_BULLETS = 4;

// Refresh the access token when it expires within this window, so a token
// can't die between the check and the API calls that follow it.
const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

// Discovery caps (M2.10.1): affiliated repos are paged, contributed-to repos
// take one page — keeps a full profile refresh cheap even for large accounts.
const REPO_PAGE_SIZE = 100;
const MAX_REPO_PAGES = 3;

const REPO_FIELDS = `
        id
        name
        nameWithOwner
        description
        url
        isPrivate
        isFork
        stargazerCount
        viewerPermission
        primaryLanguage { name }
        pushedAt
        owner { login __typename }
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name } }
        }`;

// First page (M2.10.1): identity + contribution counts (incl. per-repo commit
// counts used for ranking) + org memberships + affiliated repos — now
// including ORGANIZATION_MEMBER, the multi-org fix — plus repos the user
// contributed to without holding any affiliation. Private repos stay excluded
// at the query level unless the user opted in (M2.9.2).
const profileQuery = (includePrivate) => `query {
  viewer {
    login
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      commitContributionsByRepository(maxRepositories: 100) {
        repository { id }
        contributions { totalCount }
      }
    }
    organizations(first: 50) {
      nodes { login databaseId }
    }
    repositories(first: ${REPO_PAGE_SIZE}, orderBy: {field: PUSHED_AT, direction: DESC}, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]${includePrivate ? '' : ', privacy: PUBLIC'}) {
      pageInfo { hasNextPage endCursor }
      nodes {${REPO_FIELDS}
      }
    }
    repositoriesContributedTo(first: ${REPO_PAGE_SIZE}, orderBy: {field: PUSHED_AT, direction: DESC}, contributionTypes: [COMMIT, PULL_REQUEST], includeUserRepositories: false${includePrivate ? '' : ', privacy: PUBLIC'}) {
      nodes {${REPO_FIELDS}
      }
    }
  }
}`;

// Follow-up pages of affiliated repos (cursor-based).
const repoPageQuery = (includePrivate) => `query($cursor: String!) {
  viewer {
    repositories(first: ${REPO_PAGE_SIZE}, after: $cursor, orderBy: {field: PUSHED_AT, direction: DESC}, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]${includePrivate ? '' : ', privacy: PUBLIC'}) {
      pageInfo { hasNextPage endCursor }
      nodes {${REPO_FIELDS}
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// HTTP layer (M2.10.4) — every GitHub call goes through githubFetch, which
// retries transient upstream failures with exponential backoff and maps
// rate-limit responses to a typed GITHUB_RATE_LIMITED error carrying retryAt.
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rateLimitedError(response) {
  const e = new Error('GitHub API rate limit exceeded — try again later');
  e.code = 'GITHUB_RATE_LIMITED';
  e.status = 429;
  const retryAfter = Number(response.headers.get('retry-after'));
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    e.retryAt = new Date(Date.now() + retryAfter * 1000).toISOString();
  } else if (Number.isFinite(reset) && reset > 0) {
    e.retryAt = new Date(reset * 1000).toISOString();
  }
  return e;
}

/**
 * fetch() with GitHub-aware resilience:
 * - network errors and 502/503/504 retry with exponential backoff
 *   (GITHUB_BACKOFF_MS base, default 500ms);
 * - primary rate limit (403/429 with x-ratelimit-remaining: 0) and secondary
 *   abuse limit (retry-after header) throw GITHUB_RATE_LIMITED with retryAt
 *   instead of hammering the API.
 */
async function githubFetch(url, init = {}, { retries = 2 } = {}) {
  const baseMs = Number(process.env.GITHUB_BACKOFF_MS ?? 500);
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(baseMs * 2 ** attempt);
      continue;
    }
    if ([502, 503, 504].includes(response.status) && attempt < retries) {
      await sleep(baseMs * 2 ** attempt);
      continue;
    }
    if (
      (response.status === 403 || response.status === 429) &&
      (response.headers.get('x-ratelimit-remaining') === '0' ||
        response.headers.get('retry-after'))
    ) {
      throw rateLimitedError(response);
    }
    return response;
  }
}

// ---------------------------------------------------------------------------
// Connection management (userId = internal integer users.id; a user can have
// several connections, identified to clients by the connection row id)
// ---------------------------------------------------------------------------

/** Builds the typed error for a missing connection. */
function notConnectedError() {
  const e = new Error('GitHub account is not connected');
  e.code = 'GITHUB_NOT_CONNECTED';
  e.status = 400;
  return e;
}

/** Builds the typed error that sends the frontend into the reconnect flow. */
function reconnectError() {
  const e = new Error('GitHub token expired or revoked — please reconnect');
  e.code = 'GITHUB_RECONNECT';
  e.status = 401;
  return e;
}

/** Builds the typed error for exceeding the per-user account cap. */
function accountLimitError() {
  const e = new Error(`At most ${MAX_GITHUB_ACCOUNTS} GitHub accounts can be connected`);
  e.code = 'GITHUB_ACCOUNT_LIMIT';
  e.status = 409;
  return e;
}

/**
 * Stores a GitHub connection. Both tokens are encrypted at rest.
 *
 * M2.11 upsert rules (accountId = GitHub's numeric user id, stable across
 * renames):
 * - same (user, accountId) → token rotation in place, include_private PRESERVED;
 * - a legacy row (NULL accountId) is claimed when the login matches (or when
 *   the caller itself has no accountId — pre-M2.11 semantics);
 * - otherwise a NEW row is added, capped at MAX_GITHUB_ACCOUNTS per user.
 *
 * Expiry fields are absolute ISO timestamps (null = non-expiring token, i.e.
 * the app has "Expire user authorization tokens" disabled).
 *
 * @param {number} userId
 * @param {{ token: string, login: string, scopes?: string, accountId?: string|number|null,
 *   refreshToken?: string|null, tokenExpiresAt?: string|null,
 *   refreshTokenExpiresAt?: string|null }} connection
 * @returns {Promise<number>} the connection row id
 */
export async function saveConnection(
  userId,
  {
    token,
    login,
    scopes,
    accountId = null,
    refreshToken = null,
    tokenExpiresAt = null,
    refreshTokenExpiresAt = null,
  }
) {
  const encrypted = encryptToken(token);
  const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;
  const account = accountId != null ? String(accountId) : null;

  let existing = null;
  if (account != null) {
    existing = await database.get(
      'SELECT id FROM github_connections WHERE user_id = ? AND github_account_id = ?',
      [userId, account]
    );
  }
  if (!existing) {
    // Legacy rows (pre-M2.11) have no account id. Claim one only when it is
    // provably the same account (login match) — a different login means the
    // user is genuinely adding a second account.
    existing =
      account != null
        ? await database.get(
            'SELECT id FROM github_connections WHERE user_id = ? AND github_account_id IS NULL AND github_login = ?',
            [userId, login]
          )
        : await database.get(
            'SELECT id FROM github_connections WHERE user_id = ? AND github_account_id IS NULL',
            [userId]
          );
  }

  if (existing) {
    await database.run(
      `UPDATE github_connections SET
         github_account_id = COALESCE(?, github_account_id),
         github_login = ?,
         encrypted_token = ?,
         scopes = ?,
         encrypted_refresh_token = ?,
         token_expires_at = ?,
         refresh_token_expires_at = ?,
         connected_at = datetime('now')
       WHERE id = ?`,
      [account, login, encrypted, scopes ?? null, encryptedRefresh, tokenExpiresAt, refreshTokenExpiresAt, existing.id]
    );
    return Number(existing.id);
  }

  const countRow = await database.get(
    'SELECT COUNT(*) AS n FROM github_connections WHERE user_id = ?',
    [userId]
  );
  if (Number(countRow?.n ?? 0) >= MAX_GITHUB_ACCOUNTS) throw accountLimitError();

  const result = await database.run(
    `INSERT INTO github_connections
       (user_id, github_account_id, github_login, encrypted_token, scopes,
        encrypted_refresh_token, token_expires_at, refresh_token_expires_at, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [userId, account, login, encrypted, scopes ?? null, encryptedRefresh, tokenExpiresAt, refreshTokenExpiresAt]
  );
  return result.id;
}

/**
 * Lists all of the user's connections for display. NEVER returns tokens.
 *
 * @param {number} userId
 * @returns {Promise<Array<{ id: number, accountId: string|null, login: string|null,
 *   scopes: string|null, connectedAt: string, includePrivate: boolean }>>}
 */
export async function listConnections(userId) {
  const rows = await database.all(
    `SELECT id, github_account_id, github_login, scopes, connected_at, include_private
     FROM github_connections WHERE user_id = ? ORDER BY id`,
    [userId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    accountId: row.github_account_id ?? null,
    login: row.github_login,
    scopes: row.scopes,
    connectedAt: row.connected_at,
    includePrivate: Boolean(row.include_private),
  }));
}

/**
 * Returns the user's FIRST connection's metadata (legacy single-account view),
 * or null when not connected. NEVER returns the token (not even encrypted).
 *
 * @param {number} userId
 * @returns {Promise<{ id: number, login: string, scopes: string|null,
 *   connectedAt: string, includePrivate: boolean }|null>}
 */
export async function getConnection(userId) {
  const [first] = await listConnections(userId);
  if (!first) return null;
  const { accountId: _accountId, ...conn } = first;
  return conn;
}

/**
 * Returns the first connection's decrypted access token, or null when not
 * connected. For internal use by routes/services only — never expose it in
 * API responses.
 *
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function getToken(userId) {
  const row = await database.get(
    'SELECT encrypted_token FROM github_connections WHERE user_id = ? ORDER BY id LIMIT 1',
    [userId]
  );
  if (!row) return null;
  return decryptToken(row.encrypted_token);
}

/**
 * Exchanges the stored refresh token for a fresh access token and persists the
 * rotated pair (GitHub rotates the refresh token on every use). Throws
 * GITHUB_RECONNECT when there is no refresh token, it has expired, or GitHub
 * rejects it — all cases where only a full re-connect can help.
 *
 * @param {number} connectionId
 * @param {{ encrypted_refresh_token: string|null, refresh_token_expires_at: string|null }} row
 * @returns {Promise<string>} fresh plaintext access token
 */
async function refreshAccessToken(connectionId, row) {
  if (!row?.encrypted_refresh_token) throw reconnectError();
  const refreshExpiry = row.refresh_token_expires_at ? Date.parse(row.refresh_token_expires_at) : NaN;
  if (Number.isFinite(refreshExpiry) && refreshExpiry <= Date.now()) throw reconnectError();

  const response = await githubFetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: decryptToken(row.encrypted_refresh_token),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw reconnectError();

  const now = Date.now();
  await database.run(
    `UPDATE github_connections SET
       encrypted_token = ?,
       encrypted_refresh_token = ?,
       token_expires_at = ?,
       refresh_token_expires_at = ?
     WHERE id = ?`,
    [
      encryptToken(data.access_token),
      data.refresh_token ? encryptToken(data.refresh_token) : row.encrypted_refresh_token,
      data.expires_in ? new Date(now + data.expires_in * 1000).toISOString() : null,
      data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
        : row.refresh_token_expires_at,
      connectionId,
    ]
  );
  return data.access_token;
}

/** Reads the full token row for refresh decisions. */
function getTokenRowById(connectionId) {
  return database.get(
    `SELECT id, encrypted_token, encrypted_refresh_token, token_expires_at, refresh_token_expires_at
     FROM github_connections WHERE id = ?`,
    [connectionId]
  );
}

/**
 * Returns a currently-valid access token for ONE connection, refreshing it
 * first when it is expired or about to expire (within TOKEN_EXPIRY_SKEW_MS).
 * Tokens without an expiry (app setting disabled, or legacy rows) are returned
 * as-is. Null when the connection does not exist; GITHUB_RECONNECT when a
 * needed refresh is impossible.
 *
 * @param {number} connectionId
 * @returns {Promise<string|null>}
 */
export async function getValidTokenById(connectionId) {
  const row = await getTokenRowById(connectionId);
  if (!row) return null;
  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : NaN;
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() <= TOKEN_EXPIRY_SKEW_MS) {
    return refreshAccessToken(connectionId, row);
  }
  return decryptToken(row.encrypted_token);
}

/**
 * Legacy single-account variant: valid token for the user's FIRST connection.
 *
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
export async function getValidToken(userId) {
  const row = await database.get(
    'SELECT id FROM github_connections WHERE user_id = ? ORDER BY id LIMIT 1',
    [userId]
  );
  if (!row) return null;
  return getValidTokenById(Number(row.id));
}

/**
 * Forces a token refresh regardless of the stored expiry — used after a live
 * 401, which proves the current token is dead no matter what the row says
 * (revocation, clock skew, legacy rows without expiry metadata).
 *
 * @param {number} connectionId
 * @returns {Promise<string>} fresh plaintext access token
 */
async function forceRefreshToken(connectionId) {
  const row = await getTokenRowById(connectionId);
  if (!row) throw notConnectedError();
  return refreshAccessToken(connectionId, row);
}

/**
 * Runs an authenticated request, transparently refreshing the token once when
 * GitHub answers a live 401 (revoked token, legacy rows without expiry
 * metadata). `request` is called with a plaintext token and must return the
 * fetch Response.
 *
 * @param {number} connectionId
 * @param {(token: string) => Promise<Response>} request
 * @returns {Promise<Response>}
 */
async function withAuthRetry(connectionId, request) {
  const token = await getValidTokenById(connectionId);
  if (!token) throw notConnectedError();
  let response = await request(token);
  if (response.status === 401) {
    response = await request(await forceRefreshToken(connectionId));
    if (response.status === 401) throw reconnectError();
  }
  return response;
}

/**
 * Persists the private-repo listing preference and invalidates the affected
 * cached profiles so the next listing reflects it immediately.
 *
 * @param {number} userId
 * @param {boolean} includePrivate
 * @param {number|null} [connectionId] specific account, or null for ALL
 */
export async function setIncludePrivate(userId, includePrivate, connectionId = null) {
  const connections = await listConnections(userId);
  if (connections.length === 0) throw notConnectedError();
  if (connectionId != null) {
    const target = connections.find((c) => c.id === Number(connectionId));
    if (!target) throw notConnectedError();
    await database.run('UPDATE github_connections SET include_private = ? WHERE id = ?', [
      includePrivate ? 1 : 0,
      target.id,
    ]);
    await database.run('DELETE FROM github_profiles WHERE connection_id = ?', [target.id]);
    return;
  }
  await database.run('UPDATE github_connections SET include_private = ? WHERE user_id = ?', [
    includePrivate ? 1 : 0,
    userId,
  ]);
  await database.run('DELETE FROM github_profiles WHERE user_id = ?', [userId]);
}

/**
 * Disconnects GitHub: removes the connection(s) and the cached profile
 * payload(s). Repo summaries are kept — the user paid (credits or free
 * allowance) for them.
 *
 * @param {number} userId
 * @param {number|null} [connectionId] specific account, or null for ALL
 */
export async function deleteConnection(userId, connectionId = null) {
  if (connectionId != null) {
    await database.run('DELETE FROM github_connections WHERE id = ? AND user_id = ?', [
      connectionId,
      userId,
    ]);
    await database.run('DELETE FROM github_profiles WHERE connection_id = ?', [connectionId]);
    return;
  }
  await database.run('DELETE FROM github_connections WHERE user_id = ?', [userId]);
  await database.run('DELETE FROM github_profiles WHERE user_id = ?', [userId]);
}

// ---------------------------------------------------------------------------
// Fetch layer (M2.2; M2.11: per-connection fetch + merged multi-account view)
// ---------------------------------------------------------------------------

/**
 * Fetches ONE connection's GitHub profile (identity, contributions, repos)
 * via the GraphQL API, normalized for the frontend. Cached per connection in
 * github_profiles for 24h; pass { refresh: true } to bypass the cache.
 *
 * @param {number} userId
 * @param {{ id: number, includePrivate: boolean }} connection
 * @param {{ refresh?: boolean }} [opts]
 * @returns {Promise<object>} normalized profile
 */
async function fetchConnectionProfile(userId, connection, { refresh = false } = {}) {
  // Cache hit: fresh enough and not forced → no network call at all.
  const cached = await database.get(
    'SELECT data, fetched_at FROM github_profiles WHERE connection_id = ?',
    [connection.id]
  );
  if (cached && !refresh) {
    const age = Date.now() - Date.parse(cached.fetched_at);
    if (Number.isFinite(age) && age < PROFILE_TTL_MS) {
      return JSON.parse(cached.data);
    }
  }

  const includePrivate = connection.includePrivate;

  // Every GraphQL request goes through the auth-retry + resilience layers.
  const runQuery = async (query, variables) => {
    const response = await withAuthRetry(connection.id, (token) =>
      githubFetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(variables ? { query, variables } : { query }),
      })
    );
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
    return viewer;
  };

  const viewer = await runQuery(profileQuery(includePrivate));

  // Page through the remaining affiliated repos (capped at MAX_REPO_PAGES).
  const affiliated = [...(viewer.repositories?.nodes ?? [])];
  let pageInfo = viewer.repositories?.pageInfo;
  for (let page = 1; page < MAX_REPO_PAGES && pageInfo?.hasNextPage && pageInfo?.endCursor; page++) {
    const pageViewer = await runQuery(repoPageQuery(includePrivate), { cursor: pageInfo.endCursor });
    affiliated.push(...(pageViewer.repositories?.nodes ?? []));
    pageInfo = pageViewer.repositories?.pageInfo;
  }

  // Merge affiliated + contributed-to repos, deduped by id (affiliated wins —
  // it carries the same fields, and its ordering reflects PUSHED_AT rank).
  const contributed = viewer.repositoriesContributedTo?.nodes ?? [];
  const contributedIds = new Set(contributed.map((n) => n?.id).filter(Boolean));
  const seenIds = new Set();
  const nodes = [];
  for (const node of [...affiliated, ...contributed]) {
    if (!node || seenIds.has(node.id)) continue;
    seenIds.add(node.id);
    nodes.push(node);
  }

  // Last-year commit counts per repo — the strongest "this is my work" signal
  // for ranking org repos the user does not own.
  const contrib = viewer.contributionsCollection ?? {};
  const commitsByRepo = new Map();
  for (const c of contrib.commitContributionsByRepository ?? []) {
    if (c?.repository?.id) commitsByRepo.set(c.repository.id, c.contributions?.totalCount ?? 0);
  }

  const normalized = {
    login: viewer.login,
    contributions: {
      commits: contrib.totalCommitContributions ?? 0,
      prs: contrib.totalPullRequestContributions ?? 0,
      reviews: contrib.totalPullRequestReviewContributions ?? 0,
      issues: contrib.totalIssueContributions ?? 0,
    },
    organizations: (viewer.organizations?.nodes ?? [])
      .filter((org) => org?.login)
      .map((org) => ({ login: org.login, databaseId: org.databaseId ?? null })),
    // Defense-in-depth: the query already filters privacy, but a public-only
    // user must never see private repos even if GitHub returns them.
    repos: nodes
      .filter((node) => includePrivate || !node.isPrivate)
      .map((node) => ({
      id: node.id,
      name: node.name,
      nameWithOwner: node.nameWithOwner,
      description: node.description ?? null,
      url: node.url,
      isPrivate: !!node.isPrivate,
      isFork: !!node.isFork,
      isOwner: node.owner?.login === viewer.login,
      ownerLogin: node.owner?.login ?? null,
      ownerType: node.owner?.__typename === 'Organization' ? 'Organization' : 'User',
      viewerPermission: node.viewerPermission ?? null,
      contributed: contributedIds.has(node.id),
      commitCount: commitsByRepo.get(node.id) ?? 0,
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
    `INSERT INTO github_profiles (connection_id, user_id, data, fetched_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(connection_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
    [connection.id, userId, JSON.stringify(normalized), normalized.fetchedAt]
  );

  return normalized;
}

/**
 * Fetches the user's GitHub profile MERGED across every connected account.
 * One account failing (e.g. needs reconnect) must not blank the others: its
 * error code is reported in `accounts[].error` and the rest still load. Only
 * when EVERY account fails does the first failure propagate.
 *
 * Merged shape: repos are deduped by repo id across accounts (first account
 * wins) and tagged with `connectionId` + `accountLogin`; contributions are
 * summed; organizations are deduped by login. `accounts` carries the
 * per-account breakdown (login, organizations, error).
 *
 * @param {number} userId
 * @param {{ refresh?: boolean }} [opts]
 * @returns {Promise<object>} merged normalized profile
 */
export async function fetchGithubProfile(userId, { refresh = false } = {}) {
  const connections = await listConnections(userId);
  if (connections.length === 0) throw notConnectedError();

  const results = await Promise.allSettled(
    connections.map((c) => fetchConnectionProfile(userId, c, { refresh }))
  );

  const accounts = [];
  const repos = [];
  const seenRepoIds = new Set();
  const organizations = [];
  const seenOrgLogins = new Set();
  const contributions = { commits: 0, prs: 0, reviews: 0, issues: 0 };
  let firstProfile = null;

  results.forEach((result, i) => {
    const connection = connections[i];
    if (result.status === 'rejected') {
      accounts.push({
        connectionId: connection.id,
        login: connection.login,
        includePrivate: connection.includePrivate,
        organizations: [],
        error: result.reason?.code ?? 'GITHUB_ERROR',
      });
      return;
    }
    const profile = result.value;
    if (!firstProfile) firstProfile = profile;
    accounts.push({
      connectionId: connection.id,
      login: profile.login ?? connection.login,
      includePrivate: connection.includePrivate,
      organizations: profile.organizations ?? [],
      error: null,
    });
    contributions.commits += profile.contributions?.commits ?? 0;
    contributions.prs += profile.contributions?.prs ?? 0;
    contributions.reviews += profile.contributions?.reviews ?? 0;
    contributions.issues += profile.contributions?.issues ?? 0;
    for (const org of profile.organizations ?? []) {
      if (seenOrgLogins.has(org.login)) continue;
      seenOrgLogins.add(org.login);
      organizations.push(org);
    }
    for (const repo of profile.repos ?? []) {
      if (seenRepoIds.has(repo.id)) continue;
      seenRepoIds.add(repo.id);
      repos.push({ ...repo, connectionId: connection.id, accountLogin: profile.login ?? connection.login });
    }
  });

  if (!firstProfile) {
    throw results[0].reason;
  }

  return {
    login: firstProfile.login,
    contributions,
    organizations,
    repos,
    accounts,
    fetchedAt: firstProfile.fetchedAt,
  };
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
  // githubFetch already retries transient failures and throws
  // GITHUB_RATE_LIMITED (with retryAt) when the quota is exhausted.
  const response = await githubFetch(
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

  const bodyText = await response.text().catch(() => '');
  const e = new Error(`GitHub README request failed (${response.status}): ${bodyText.slice(0, 500)}`);
  e.status = response.status;
  throw e;
}

// ---------------------------------------------------------------------------
// Installations (M2.10.2)
// ---------------------------------------------------------------------------

/**
 * Lists the app installations one connection's token can see (its account +
 * orgs where the app is installed) and mirrors them into
 * github_app_installations so webhook lifecycle events (suspend/unsuspend/
 * delete) have rows to keep current between refreshes.
 *
 * @param {number} userId
 * @param {number|null} [connectionId] specific account, or null for the first
 * @returns {Promise<Array<{ id: string, login: string|null, type: string|null, suspended: boolean }>>}
 */
export async function listUserInstallations(userId, connectionId = null) {
  const row = await database.get(
    connectionId != null
      ? 'SELECT id FROM github_connections WHERE user_id = ? AND id = ?'
      : 'SELECT id FROM github_connections WHERE user_id = ? ORDER BY id LIMIT 1',
    connectionId != null ? [userId, connectionId] : [userId]
  );
  if (!row) throw notConnectedError();

  const response = await withAuthRetry(Number(row.id), (token) =>
    githubFetch('https://api.github.com/user/installations?per_page=100', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
    })
  );
  if (!response.ok) {
    const e = new Error(`GitHub installations request failed (${response.status})`);
    e.status = response.status;
    throw e;
  }
  const data = await response.json().catch(() => ({}));
  const installations = (data.installations ?? []).map((inst) => ({
    id: String(inst.id),
    login: inst.account?.login ?? null,
    type: inst.account?.type ?? null,
    suspended: Boolean(inst.suspended_at),
    // 'all' | 'selected' — whether the grant covers every repo or a hand-picked list.
    repositorySelection: inst.repository_selection ?? null,
  }));

  for (const inst of installations) {
    await database.run(
      `INSERT INTO github_app_installations (installation_id, account_login, account_type, suspended, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(installation_id) DO UPDATE SET
         account_login = excluded.account_login,
         account_type = excluded.account_type,
         suspended = excluded.suspended,
         updated_at = excluded.updated_at`,
      [inst.id, inst.login, inst.type, inst.suspended ? 1 : 0]
    );
  }
  return installations;
}

/**
 * Lists the repos ONE connection's token can reach through ONE installation —
 * i.e. the intersection of the installation's repo grant and the user's own
 * GitHub permissions (M2.12). This is the ground truth for "why don't I see
 * repo X": an org member without read access on a granted private repo gets
 * it filtered out HERE by GitHub, not by us.
 *
 * @param {number} connectionId
 * @param {string} installationId
 * @returns {Promise<{ total: number, privateCount: number }>}
 */
export async function countInstallationAccessibleRepos(connectionId, installationId) {
  const response = await withAuthRetry(connectionId, (token) =>
    githubFetch(
      `https://api.github.com/user/installations/${encodeURIComponent(installationId)}/repositories?per_page=100`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
        },
      }
    )
  );
  if (!response.ok) {
    const e = new Error(`GitHub installation repositories request failed (${response.status})`);
    e.status = response.status;
    throw e;
  }
  const data = await response.json().catch(() => ({}));
  const repos = data.repositories ?? [];
  return {
    // total_count covers ALL pages; the private count is derived from the
    // first 100 — plenty for a diagnostic hint.
    total: Number(data.total_count ?? repos.length),
    privateCount: repos.filter((r) => r?.private).length,
  };
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
 * @param {number|null} [connectionId] source account, stamped for display
 * @returns {Promise<{ bullets: string[], project: object, cached: boolean }>}
 */
export async function summarizeRepo(userId, repo, token, connectionId = null) {
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
    `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, connection_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, repo_id) DO UPDATE SET
       pushed_at = excluded.pushed_at,
       repo_name = excluded.repo_name,
       summary = excluded.summary,
       connection_id = COALESCE(excluded.connection_id, github_repo_summaries.connection_id)`,
    [userId, repo.id, repo.name, repo.pushedAt, JSON.stringify(summary), connectionId]
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
 * M2.11: each repo's README is fetched with its OWN account's token (repos
 * carry connectionId from the merged profile); a repo whose account needs
 * reconnecting fails individually instead of sinking the batch.
 *
 * @param {number} userId
 * @param {object[]} repos normalized repo objects the user selected
 * @returns {Promise<{ summaries: object[], charged: number, freeUsed: number, freeLeft: number, reanalyzed: number }>}
 */
export async function analyzeRepos(userId, repos) {
  const connections = await listConnections(userId);
  if (connections.length === 0) throw notConnectedError();
  const defaultConnectionId = connections[0].id;

  // Per-account token cache — resolved lazily so one dead account only fails
  // its own repos (caught per-repo below).
  const tokenByConnection = new Map();
  const tokenFor = async (repo) => {
    const cid = repo.connectionId ?? defaultConnectionId;
    if (!tokenByConnection.has(cid)) {
      tokenByConnection.set(cid, await getValidTokenById(cid));
    }
    const token = tokenByConnection.get(cid);
    if (!token) throw reconnectError();
    return token;
  };

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

  // Summarize sequentially with per-repo fault tolerance (M2.10.4): one repo
  // failing — deleted, org access lost mid-batch, rate limit — must not sink
  // the whole batch. Free slots go to the first freeNow NEW repos that
  // actually succeed; changed repos never flip counted_free.
  const summaries = [];
  const failed = [];
  let freeMarked = 0;
  let paidSucceeded = 0;
  for (const repo of repos) {
    let summary;
    try {
      const token = await tokenFor(repo);
      summary = await summarizeRepo(userId, repo, token, repo.connectionId ?? defaultConnectionId);
    } catch (err) {
      failed.push({ repoId: repo.id, repoName: repo.name ?? null, code: err.code ?? 'ANALYSIS_FAILED' });
      continue;
    }
    if (newIds.has(repo.id)) {
      if (freeMarked < freeNow) {
        await database.run(
          'UPDATE github_repo_summaries SET counted_free = 1 WHERE user_id = ? AND repo_id = ?',
          [userId, repo.id]
        );
        freeMarked += 1;
      } else {
        paidSucceeded += 1;
      }
    }
    summaries.push({ repoId: repo.id, repoName: repo.name, ...summary });
  }

  // Refund the up-front charge for paid NEW repos that failed — the user must
  // never pay for a summary they didn't get.
  const refund = Math.round(Math.max(0, chargeable - paidSucceeded) * CREDIT_COSTS.GITHUB_REPO * 100) / 100;
  if (refund > 0) {
    await grantCredits(userId, refund);
  }

  return {
    summaries,
    charged: Math.round((cost - refund) * 100) / 100,
    freeUsed: freeMarked,
    freeLeft: freeLeft - freeMarked,
    reanalyzed: summaries.filter((s) => changedIds.has(s.repoId)).length,
    failed,
  };
}

// ---------------------------------------------------------------------------
// Project library (M2.7.2)
// ---------------------------------------------------------------------------

/**
 * Lists the user's stored repo summaries (project library). Pure DB read —
 * no network, no LLM. `stale` is true when any cached GitHub profile shows a
 * newer pushed_at for the repo than the one the summary was generated from;
 * without a profile cache (or when the repo is absent from it) stale is false.
 *
 * M2.8.2: each entry also carries `inResumes` — the user's base resumes that
 * already contain a project imported from that repo (via projects.github_repo_id).
 * M2.11: `accountLogin` names the account the summary came from (null for
 * summaries whose connection is gone).
 *
 * @param {number} userId
 * @returns {Promise<Array<{ repoId: string, repoName: string|null, pushedAt: string,
 *   bullets: string[], project: object, countedFree: boolean, createdAt: string, stale: boolean,
 *   accountLogin: string|null, inResumes: Array<{ id: string, name: string }> }>>}
 */
export async function listSummaries(userId) {
  const rows = await database.all(
    `SELECT s.repo_id, s.repo_name, s.pushed_at, s.summary, s.counted_free, s.created_at,
            c.github_login AS account_login
     FROM github_repo_summaries s
     LEFT JOIN github_connections c ON c.id = s.connection_id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`,
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

  // Map repoId → pushedAt across ALL of the user's cached account profiles
  // (M2.11) for staleness.
  const pushedAtById = new Map();
  const profileRows = await database.all(
    'SELECT data FROM github_profiles WHERE user_id = ?',
    [userId]
  );
  for (const profileRow of profileRows) {
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
      accountLogin: row.account_login ?? null,
      inResumes: inResumesByRepoId.get(row.repo_id) ?? [],
    };
  });
}
