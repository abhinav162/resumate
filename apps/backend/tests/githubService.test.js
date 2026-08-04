import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import {
  saveConnection,
  getConnection,
  listConnections,
  getToken,
  getValidToken,
  setIncludePrivate,
  deleteConnection,
  fetchGithubProfile,
  fetchReadme,
  summarizeRepo,
  analyzeRepos,
  listSummaries,
  listUserInstallations,
  countInstallationAccessibleRepos,
  MAX_GITHUB_ACCOUNTS,
} from '../src/services/githubService.js';

// ---------------------------------------------------------------------------
// Fetch mock — routes by URL: GitHub GraphQL, README REST, and Bifrost LLM.
// Every call is recorded in fetchCalls so tests can assert caching behavior.
// ---------------------------------------------------------------------------
const realFetch = global.fetch;
let fetchCalls = [];

function mockResponse(status, { json, text, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => json,
    text: async () => text ?? (json !== undefined ? JSON.stringify(json) : ''),
  };
}

function graphqlPayload() {
  return {
    data: {
      viewer: {
        login: 'octocat',
        contributionsCollection: {
          totalCommitContributions: 120,
          totalPullRequestContributions: 15,
          totalPullRequestReviewContributions: 7,
          totalIssueContributions: 3,
        },
        repositories: {
          nodes: [
            {
              id: 'R_1',
              name: 'alpha',
              nameWithOwner: 'octocat/alpha',
              description: 'A tool',
              url: 'https://github.com/octocat/alpha',
              isPrivate: false,
              isFork: false,
              stargazerCount: 42,
              primaryLanguage: { name: 'JavaScript' },
              pushedAt: '2026-07-01T00:00:00Z',
              owner: { login: 'octocat' },
              languages: {
                edges: [
                  { size: 900, node: { name: 'JavaScript' } },
                  { size: 100, node: { name: 'CSS' } },
                ],
              },
            },
            {
              id: 'R_2',
              name: 'beta',
              nameWithOwner: 'someoneelse/beta',
              description: null,
              url: 'https://github.com/someoneelse/beta',
              isPrivate: true,
              isFork: true,
              stargazerCount: 0,
              primaryLanguage: null,
              pushedAt: '2026-06-15T00:00:00Z',
              owner: { login: 'someoneelse' },
              languages: { edges: [] },
            },
          ],
        },
      },
    },
  };
}

const DEFAULT_LLM_SUMMARY = {
  bullets: [
    'Accomplished faster deployments as measured by CI setup by building an automated pipeline.',
    'Improved developer experience by documenting the setup in the README.',
  ],
  project: {
    name: 'alpha',
    description: ['Automated pipeline project.'],
    url: 'https://alpha.example.com',
    repoUrl: 'placeholder',
  },
};

function installFetchMock(overrides = {}) {
  fetchCalls = [];
  let graphqlFailedOnce = false;
  let graphqlPageIndex = 0;
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    fetchCalls.push({ url: u, init });

    if (u === 'https://github.com/login/oauth/access_token') {
      return mockResponse(200, {
        json: overrides.refreshResponse ?? {
          access_token: 'ghp_refreshed',
          refresh_token: 'ghr_rotated',
          expires_in: 28800,
          refresh_token_expires_in: 15811200,
        },
      });
    }
    if (/api\.github\.com\/user\/installations\/[^/]+\/repositories/.test(u)) {
      return mockResponse(200, {
        json: overrides.installationRepos ?? { total_count: 0, repositories: [] },
      });
    }
    if (u.startsWith('https://api.github.com/user/installations')) {
      return mockResponse(200, { json: overrides.installations ?? { installations: [] } });
    }
    if (u === 'https://api.github.com/graphql') {
      // graphqlByToken: route by Authorization header (multi-account tests).
      // Values are either a payload object or a status number to fail with.
      if (overrides.graphqlByToken) {
        const token = String(init.headers?.Authorization ?? '').replace('Bearer ', '');
        const entry = overrides.graphqlByToken[token];
        if (typeof entry === 'number') {
          return mockResponse(entry, { json: { message: 'Bad credentials' } });
        }
        if (entry) return mockResponse(200, { json: entry });
      }
      // graphqlStatusOnce: fail the FIRST GraphQL call only (401-retry tests).
      if (overrides.graphqlStatusOnce && !graphqlFailedOnce) {
        graphqlFailedOnce = true;
        return mockResponse(overrides.graphqlStatusOnce, { json: { message: 'Bad credentials' } });
      }
      if (overrides.graphqlStatus) {
        return mockResponse(overrides.graphqlStatus, { json: { message: 'Bad credentials' } });
      }
      // graphqlPages: sequential payloads, one per GraphQL call (pagination tests).
      if (overrides.graphqlPages) {
        const idx = Math.min(graphqlPageIndex, overrides.graphqlPages.length - 1);
        graphqlPageIndex += 1;
        return mockResponse(200, { json: overrides.graphqlPages[idx] });
      }
      return mockResponse(200, { json: overrides.graphql ?? graphqlPayload() });
    }
    if (u.startsWith('https://api.github.com/repos/') && u.endsWith('/readme')) {
      // readmeFailFor: URL fragment whose README request permanently 500s.
      if (overrides.readmeFailFor && u.includes(overrides.readmeFailFor)) {
        return mockResponse(500, { text: 'boom' });
      }
      if (overrides.readmeStatus) {
        return mockResponse(overrides.readmeStatus, { headers: overrides.readmeHeaders ?? {} });
      }
      return mockResponse(200, { text: overrides.readme ?? '# Alpha\nAn automated pipeline tool.' });
    }
    if (u.startsWith('https://bifrost.test')) {
      const content = JSON.stringify(overrides.llm ?? DEFAULT_LLM_SUMMARY);
      return mockResponse(200, { json: { choices: [{ message: { content } }] } });
    }
    throw new Error(`Unexpected fetch in test: ${u}`);
  };
}

function callsTo(fragment) {
  return fetchCalls.filter((c) => c.url.includes(fragment)).length;
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
async function createUser(credits = 5) {
  const uuid = crypto.randomUUID();
  const result = await database.run(
    'INSERT INTO users (uuid, email, credits) VALUES (?, ?, ?)',
    [uuid, `${uuid}@test.com`, credits]
  );
  return result.id;
}

async function connect(userId, token = 'ghp_plaintext_secret') {
  await saveConnection(userId, { token, login: 'octocat', scopes: 'repo,read:user' });
  return token;
}

/** Normalized repo object as produced by fetchGithubProfile. */
function makeRepo(i, pushedAt = '2026-07-01T00:00:00Z') {
  return {
    id: `R_repo_${i}`,
    name: `repo-${i}`,
    nameWithOwner: `octocat/repo-${i}`,
    description: `Repo number ${i}`,
    url: `https://github.com/octocat/repo-${i}`,
    isPrivate: false,
    isFork: false,
    isOwner: true,
    stars: i,
    primaryLanguage: 'JavaScript',
    languages: [{ name: 'JavaScript', bytes: 1000 }],
    pushedAt,
  };
}

describe('githubService', () => {
  before(async () => {
    process.env.DB_PATH = ':memory:';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    process.env.BIFROST_URL = 'https://bifrost.test';
    process.env.BIFROST_VIRTUAL_KEY = 'sk-test';
    process.env.GITHUB_BACKOFF_MS = '1'; // keep githubFetch retries instant in tests
    await database.close(); // fresh in-memory connection for test isolation
    await initializeDatabase();
  });

  beforeEach(() => {
    installFetchMock();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  describe('connection management', () => {
    it('saveConnection/getConnection returns login but never the token; token is encrypted at rest', async () => {
      const userId = await createUser();
      await connect(userId, 'ghp_super_secret');

      const conn = await getConnection(userId);
      assert.equal(conn.login, 'octocat');
      assert.equal(conn.scopes, 'repo,read:user');
      assert.ok(conn.connectedAt);
      const values = JSON.stringify(conn);
      assert.ok(!values.includes('ghp_super_secret'), 'plaintext token must not leak');
      assert.equal(conn.token, undefined);
      assert.equal(conn.encrypted_token, undefined);

      const row = await database.get(
        'SELECT encrypted_token FROM github_connections WHERE user_id = ?',
        [userId]
      );
      assert.notEqual(row.encrypted_token, 'ghp_super_secret');
      assert.ok(!row.encrypted_token.includes('ghp_super_secret'));
    });

    it('getToken round-trips the plaintext token', async () => {
      const userId = await createUser();
      await connect(userId, 'ghp_roundtrip');
      assert.equal(await getToken(userId), 'ghp_roundtrip');
    });

    it('saveConnection upserts (reconnect replaces the token)', async () => {
      const userId = await createUser();
      await connect(userId, 'ghp_first');
      await saveConnection(userId, { token: 'ghp_second', login: 'octocat2', scopes: 'repo' });

      const rows = await database.all(
        'SELECT * FROM github_connections WHERE user_id = ?',
        [userId]
      );
      assert.equal(rows.length, 1);
      assert.equal(await getToken(userId), 'ghp_second');
      assert.equal((await getConnection(userId)).login, 'octocat2');
    });

    it('deleteConnection removes connection + profile cache but keeps repo summaries', async () => {
      const userId = await createUser();
      await connect(userId);
      const conn = await database.get(
        'SELECT id FROM github_connections WHERE user_id = ?',
        [userId]
      );
      await database.run(
        'INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)',
        [conn.id, userId, '{}', new Date().toISOString()]
      );
      await database.run(
        `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary)
         VALUES (?, 'R_keep', 'keep', '2026-01-01T00:00:00Z', '{}')`,
        [userId]
      );

      await deleteConnection(userId);

      assert.equal(await getConnection(userId), null);
      assert.equal(await getToken(userId), null);
      const profile = await database.get('SELECT 1 FROM github_profiles WHERE user_id = ?', [userId]);
      assert.equal(profile, null);
      const summary = await database.get(
        'SELECT 1 FROM github_repo_summaries WHERE user_id = ?',
        [userId]
      );
      assert.ok(summary, 'paid-for summaries must survive disconnect');
    });
  });

  describe('fetchGithubProfile', () => {
    it('throws GITHUB_NOT_CONNECTED when no connection exists', async () => {
      const userId = await createUser();
      await assert.rejects(fetchGithubProfile(userId), (err) => {
        assert.equal(err.code, 'GITHUB_NOT_CONNECTED');
        assert.equal(err.status, 400);
        return true;
      });
      assert.equal(fetchCalls.length, 0);
    });

    it('first call hits the network, normalizes, and persists the cache row', async () => {
      const userId = await createUser();
      await connect(userId);
      // The mocked payload includes a private repo — opt in so both come through.
      await setIncludePrivate(userId, true);

      const profile = await fetchGithubProfile(userId);

      assert.equal(callsTo('api.github.com/graphql'), 1);
      assert.equal(profile.login, 'octocat');
      assert.deepEqual(profile.contributions, { commits: 120, prs: 15, reviews: 7, issues: 3 });
      assert.equal(profile.repos.length, 2);

      const [alpha, beta] = profile.repos;
      assert.equal(alpha.id, 'R_1');
      assert.equal(alpha.isOwner, true);
      assert.equal(alpha.stars, 42);
      assert.equal(alpha.primaryLanguage, 'JavaScript');
      assert.deepEqual(alpha.languages, [
        { name: 'JavaScript', bytes: 900 },
        { name: 'CSS', bytes: 100 },
      ]);
      assert.equal(beta.isOwner, false, 'owner.login !== viewer.login → collaborator repo');
      assert.equal(beta.primaryLanguage, null);
      assert.ok(profile.fetchedAt);

      // Bearer auth with the decrypted token.
      const gql = fetchCalls.find((c) => c.url.includes('graphql'));
      assert.equal(gql.init.headers.Authorization, 'Bearer ghp_plaintext_secret');

      const row = await database.get('SELECT data FROM github_profiles WHERE user_id = ?', [userId]);
      assert.ok(row, 'profile cache row persisted');
      assert.equal(JSON.parse(row.data).login, 'octocat');
    });

    it('second call within TTL is served from cache with zero fetch calls', async () => {
      const userId = await createUser();
      await connect(userId);
      const first = await fetchGithubProfile(userId);

      installFetchMock(); // reset call counter
      const second = await fetchGithubProfile(userId);

      assert.equal(fetchCalls.length, 0, 'cached call must not hit the network');
      assert.deepEqual(second, first);
    });

    it('{ refresh: true } bypasses the cache and hits the network again', async () => {
      const userId = await createUser();
      await connect(userId);
      await fetchGithubProfile(userId);

      installFetchMock();
      await fetchGithubProfile(userId, { refresh: true });
      assert.equal(callsTo('api.github.com/graphql'), 1);
    });

    it('maps a 401 to error.code=GITHUB_RECONNECT', async () => {
      const userId = await createUser();
      await connect(userId);
      installFetchMock({ graphqlStatus: 401 });

      await assert.rejects(fetchGithubProfile(userId), (err) => {
        assert.equal(err.code, 'GITHUB_RECONNECT');
        assert.equal(err.status, 401);
        return true;
      });
    });
  });

  // M2.9.1 — expiring GitHub App user tokens are refreshed silently.
  describe('token refresh', () => {
    const future = (ms) => new Date(Date.now() + ms).toISOString();
    const past = (ms) => new Date(Date.now() - ms).toISOString();

    async function connectExpiring(userId, { tokenExpiresAt, refreshToken = 'ghr_original' } = {}) {
      await saveConnection(userId, {
        token: 'ghp_original',
        login: 'octocat',
        scopes: '',
        refreshToken,
        tokenExpiresAt,
        refreshTokenExpiresAt: future(180 * 24 * 60 * 60 * 1000),
      });
    }

    it('stores the refresh token encrypted, never in plaintext', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: future(8 * 60 * 60 * 1000) });

      const row = await database.get(
        'SELECT encrypted_refresh_token, token_expires_at FROM github_connections WHERE user_id = ?',
        [userId]
      );
      assert.ok(row.encrypted_refresh_token);
      assert.ok(!row.encrypted_refresh_token.includes('ghr_original'));
      assert.ok(row.token_expires_at);
    });

    it('returns the stored token untouched when it is far from expiry', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: future(8 * 60 * 60 * 1000) });

      assert.equal(await getValidToken(userId), 'ghp_original');
      assert.equal(fetchCalls.length, 0, 'no network call for a healthy token');
    });

    it('returns a legacy non-expiring token as-is (no expiry metadata)', async () => {
      const userId = await createUser();
      await connect(userId, 'ghp_legacy'); // no refresh/expiry fields

      assert.equal(await getValidToken(userId), 'ghp_legacy');
      assert.equal(fetchCalls.length, 0);
    });

    it('refreshes an expired token and persists the rotated pair', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: past(60 * 1000) });

      const token = await getValidToken(userId);

      assert.equal(token, 'ghp_refreshed');
      assert.equal(callsTo('github.com/login/oauth/access_token'), 1);
      const call = fetchCalls.find((c) => c.url.includes('login/oauth/access_token'));
      const body = JSON.parse(call.init.body);
      assert.equal(body.grant_type, 'refresh_token');
      assert.equal(body.refresh_token, 'ghr_original');

      // Rotated pair persisted: next call needs no refresh.
      assert.equal(await getToken(userId), 'ghp_refreshed');
      installFetchMock();
      assert.equal(await getValidToken(userId), 'ghp_refreshed');
      assert.equal(fetchCalls.length, 0, 'new expiry must be in the future');
      const row = await database.get(
        'SELECT encrypted_refresh_token FROM github_connections WHERE user_id = ?',
        [userId]
      );
      assert.ok(!row.encrypted_refresh_token.includes('ghr_rotated'), 'rotated token encrypted');
    });

    it('refreshes proactively when the token expires within the skew window', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: future(60 * 1000) }); // < 5 min skew

      assert.equal(await getValidToken(userId), 'ghp_refreshed');
      assert.equal(callsTo('login/oauth/access_token'), 1);
    });

    it('throws GITHUB_RECONNECT when expired with no refresh token', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: past(60 * 1000), refreshToken: null });

      await assert.rejects(getValidToken(userId), (err) => {
        assert.equal(err.code, 'GITHUB_RECONNECT');
        return true;
      });
      assert.equal(fetchCalls.length, 0);
    });

    it('throws GITHUB_RECONNECT when GitHub rejects the refresh token', async () => {
      const userId = await createUser();
      await connectExpiring(userId, { tokenExpiresAt: past(60 * 1000) });
      installFetchMock({ refreshResponse: { error: 'bad_refresh_token' } });

      await assert.rejects(getValidToken(userId), (err) => {
        assert.equal(err.code, 'GITHUB_RECONNECT');
        return true;
      });
    });

    it('fetchGithubProfile retries once with a refreshed token after a live 401', async () => {
      const userId = await createUser();
      // Expiry metadata says "valid", but GitHub disagrees (revoked/legacy).
      await connectExpiring(userId, { tokenExpiresAt: future(8 * 60 * 60 * 1000) });
      installFetchMock({ graphqlStatusOnce: 401 });

      const profile = await fetchGithubProfile(userId);

      assert.equal(profile.login, 'octocat');
      assert.equal(callsTo('login/oauth/access_token'), 1);
      const graphqlCalls = fetchCalls.filter((c) => c.url.includes('graphql'));
      assert.equal(graphqlCalls.length, 2);
      assert.equal(graphqlCalls[1].init.headers.Authorization, 'Bearer ghp_refreshed');
    });
  });

  // M2.9.2 — private repos are listed only when the user opts in.
  describe('private repo preference', () => {
    it('defaults to public-only: privacy filter in the query, private repos dropped', async () => {
      const userId = await createUser();
      await connect(userId);

      const profile = await fetchGithubProfile(userId);

      const gql = fetchCalls.find((c) => c.url.includes('graphql'));
      assert.ok(JSON.parse(gql.init.body).query.includes('privacy: PUBLIC'));
      assert.deepEqual(profile.repos.map((r) => r.id), ['R_1'], 'private R_2 must be filtered');
      assert.equal((await getConnection(userId)).includePrivate, false);
    });

    it('opt-in removes the privacy filter and keeps private repos', async () => {
      const userId = await createUser();
      await connect(userId);
      await setIncludePrivate(userId, true);

      const profile = await fetchGithubProfile(userId);

      const gql = fetchCalls.find((c) => c.url.includes('graphql'));
      assert.ok(!JSON.parse(gql.init.body).query.includes('privacy:'));
      assert.deepEqual(profile.repos.map((r) => r.id), ['R_1', 'R_2']);
      assert.equal((await getConnection(userId)).includePrivate, true);
    });

    it('toggling the preference invalidates the cached profile', async () => {
      const userId = await createUser();
      await connect(userId);
      await fetchGithubProfile(userId); // caches public-only

      await setIncludePrivate(userId, true);
      const cached = await database.get('SELECT 1 FROM github_profiles WHERE user_id = ?', [userId]);
      assert.equal(cached, null, 'profile cache cleared on toggle');

      installFetchMock();
      const profile = await fetchGithubProfile(userId); // refetches with private
      assert.equal(callsTo('api.github.com/graphql'), 1);
      assert.equal(profile.repos.length, 2);
    });

    it('throws GITHUB_NOT_CONNECTED when setting the preference without a connection', async () => {
      const userId = await createUser();
      await assert.rejects(setIncludePrivate(userId, true), (err) => {
        assert.equal(err.code, 'GITHUB_NOT_CONNECTED');
        return true;
      });
    });

    it('reconnecting preserves the include_private preference', async () => {
      const userId = await createUser();
      await connect(userId);
      await setIncludePrivate(userId, true);

      await saveConnection(userId, { token: 'ghp_new', login: 'octocat', scopes: '' });

      assert.equal((await getConnection(userId)).includePrivate, true);
    });
  });

  // M2.10.1 — repos across orgs and contributed-to repos are discovered.
  describe('multi-org discovery', () => {
    /** GraphQL node factory (raw GraphQL shape, not the normalized one). */
    function makeNode(id, nameWithOwner, { ownerType = 'User', isPrivate = false } = {}) {
      const [ownerLogin, name] = nameWithOwner.split('/');
      return {
        id,
        name,
        nameWithOwner,
        description: `${name} description`,
        url: `https://github.com/${nameWithOwner}`,
        isPrivate,
        isFork: false,
        stargazerCount: 1,
        viewerPermission: 'WRITE',
        primaryLanguage: { name: 'JavaScript' },
        pushedAt: '2026-07-01T00:00:00Z',
        owner: { login: ownerLogin, __typename: ownerType },
        languages: { edges: [] },
      };
    }

    function multiOrgPayload() {
      return {
        data: {
          viewer: {
            login: 'octocat',
            contributionsCollection: {
              totalCommitContributions: 100,
              totalPullRequestContributions: 10,
              totalPullRequestReviewContributions: 5,
              totalIssueContributions: 2,
              commitContributionsByRepository: [
                { repository: { id: 'R_ORG' }, contributions: { totalCount: 42 } },
              ],
            },
            organizations: { nodes: [{ login: 'acme', databaseId: 123 }] },
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                makeNode('R_MINE', 'octocat/mine'),
                makeNode('R_ORG', 'acme/platform', { ownerType: 'Organization' }),
              ],
            },
            repositoriesContributedTo: {
              nodes: [
                makeNode('R_CONTRIB', 'bigco/tool', { ownerType: 'Organization' }),
                makeNode('R_MINE', 'octocat/mine'), // duplicate — must be deduped
              ],
            },
          },
        },
      };
    }

    it('queries with ORGANIZATION_MEMBER affiliation and contributed-to repos', async () => {
      const userId = await createUser();
      await connect(userId);
      installFetchMock({ graphql: multiOrgPayload() });

      await fetchGithubProfile(userId);

      const gql = fetchCalls.find((c) => c.url.includes('graphql'));
      const query = JSON.parse(gql.init.body).query;
      assert.ok(query.includes('ORGANIZATION_MEMBER'), 'org-member affiliation in the query');
      assert.ok(query.includes('repositoriesContributedTo'), 'contributed-to field in the query');
      assert.ok(query.includes('commitContributionsByRepository'), 'commit counts in the query');
    });

    it('merges affiliated + contributed repos, deduped, with owner/commit metadata', async () => {
      const userId = await createUser();
      await connect(userId);
      installFetchMock({ graphql: multiOrgPayload() });

      const profile = await fetchGithubProfile(userId);

      assert.deepEqual(
        profile.repos.map((r) => r.id),
        ['R_MINE', 'R_ORG', 'R_CONTRIB'],
        'affiliated first, contributed appended, duplicate dropped'
      );
      const org = profile.repos.find((r) => r.id === 'R_ORG');
      assert.equal(org.ownerLogin, 'acme');
      assert.equal(org.ownerType, 'Organization');
      assert.equal(org.isOwner, false);
      assert.equal(org.commitCount, 42, 'per-repo commit count mapped');
      const contribRepo = profile.repos.find((r) => r.id === 'R_CONTRIB');
      assert.equal(contribRepo.contributed, true);
      assert.deepEqual(profile.organizations, [{ login: 'acme', databaseId: 123 }]);
    });

    it('pages through affiliated repos with the cursor', async () => {
      const userId = await createUser();
      await connect(userId);
      const page1 = multiOrgPayload();
      page1.data.viewer.repositories.pageInfo = { hasNextPage: true, endCursor: 'c1' };
      const page2 = {
        data: {
          viewer: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [makeNode('R_PAGE2', 'acme/older-repo', { ownerType: 'Organization' })],
            },
          },
        },
      };
      installFetchMock({ graphqlPages: [page1, page2] });

      const profile = await fetchGithubProfile(userId);

      assert.equal(callsTo('api.github.com/graphql'), 2);
      const second = fetchCalls.filter((c) => c.url.includes('graphql'))[1];
      assert.equal(JSON.parse(second.init.body).variables.cursor, 'c1');
      assert.deepEqual(
        profile.repos.map((r) => r.id),
        ['R_MINE', 'R_ORG', 'R_PAGE2', 'R_CONTRIB']
      );
    });
  });

  // M2.11 — multiple GitHub accounts per user.
  describe('multiple accounts', () => {
    /** Minimal GraphQL viewer payload for one account with the given repo ids. */
    function accountNode(login, id) {
      return {
        id,
        name: id.toLowerCase(),
        nameWithOwner: `${login}/${id.toLowerCase()}`,
        description: null,
        url: `https://github.com/${login}/${id.toLowerCase()}`,
        isPrivate: false,
        isFork: false,
        stargazerCount: 0,
        viewerPermission: 'ADMIN',
        primaryLanguage: { name: 'JavaScript' },
        pushedAt: '2026-07-01T00:00:00Z',
        owner: { login, __typename: 'User' },
        languages: { edges: [] },
      };
    }

    function accountPayload(login, repoIds) {
      return {
        data: {
          viewer: {
            login,
            contributionsCollection: {
              totalCommitContributions: 10,
              totalPullRequestContributions: 2,
              totalPullRequestReviewContributions: 1,
              totalIssueContributions: 1,
            },
            organizations: { nodes: [] },
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: repoIds.map((id) => accountNode(login, id)),
            },
            repositoriesContributedTo: { nodes: [] },
          },
        },
      };
    }

    it('creates one connection row per GitHub account', async () => {
      const userId = await createUser();
      const idA = await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      const idB = await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });

      const conns = await listConnections(userId);
      assert.deepEqual(conns.map((c) => c.id), [idA, idB]);
      assert.deepEqual(conns.map((c) => c.accountId), ['111', '222']);
      assert.deepEqual(conns.map((c) => c.login), ['personal', 'workcat']);
    });

    it('reconnecting the same account id rotates the token in place and preserves include_private', async () => {
      const userId = await createUser();
      const id1 = await saveConnection(userId, { token: 'ghp_one', login: 'personal', scopes: '', accountId: '111' });
      await setIncludePrivate(userId, true, id1);

      const id2 = await saveConnection(userId, {
        token: 'ghp_two',
        login: 'personal-renamed', // login changes track renames; the account id is the key
        scopes: '',
        accountId: '111',
      });

      assert.equal(id2, id1, 'same account must reuse the row');
      const conns = await listConnections(userId);
      assert.equal(conns.length, 1);
      assert.equal(conns[0].login, 'personal-renamed');
      assert.equal(conns[0].includePrivate, true, 'preference survives reconnect');
      assert.equal(await getToken(userId), 'ghp_two');
    });

    it('claims a legacy connection (no account id) when the login matches', async () => {
      const userId = await createUser();
      await connect(userId); // legacy: login 'octocat', NULL account id

      const id = await saveConnection(userId, { token: 'ghp_new', login: 'octocat', scopes: '', accountId: '777' });

      const conns = await listConnections(userId);
      assert.equal(conns.length, 1, 'legacy row claimed, not duplicated');
      assert.equal(conns[0].id, id);
      assert.equal(conns[0].accountId, '777', 'account id backfilled');
      assert.equal(await getToken(userId), 'ghp_new');
    });

    it('a different login than the legacy row adds a second connection', async () => {
      const userId = await createUser();
      await connect(userId); // legacy octocat, NULL account id

      await saveConnection(userId, { token: 'ghp_other', login: 'other', scopes: '', accountId: '888' });

      const conns = await listConnections(userId);
      assert.equal(conns.length, 2);
      assert.equal(conns[0].accountId, null, 'legacy row untouched');
      assert.equal(await getToken(userId), 'ghp_plaintext_secret', 'legacy token untouched');
    });

    it(`rejects account ${MAX_GITHUB_ACCOUNTS + 1} with GITHUB_ACCOUNT_LIMIT`, async () => {
      const userId = await createUser();
      for (let i = 1; i <= MAX_GITHUB_ACCOUNTS; i++) {
        await saveConnection(userId, { token: `ghp_${i}`, login: `acct-${i}`, scopes: '', accountId: String(i) });
      }

      await assert.rejects(
        saveConnection(userId, { token: 'ghp_x', login: 'one-too-many', scopes: '', accountId: '99' }),
        (err) => {
          assert.equal(err.code, 'GITHUB_ACCOUNT_LIMIT');
          assert.equal(err.status, 409);
          return true;
        }
      );
      assert.equal((await listConnections(userId)).length, MAX_GITHUB_ACCOUNTS);
    });

    it('merges repos across accounts with per-account tags, deduping shared repos', async () => {
      const userId = await createUser();
      const idA = await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      const idB = await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });
      installFetchMock({
        graphqlByToken: {
          ghp_a: accountPayload('personal', ['R_A1', 'R_SHARED']),
          ghp_b: accountPayload('workcat', ['R_B1', 'R_SHARED']),
        },
      });

      const profile = await fetchGithubProfile(userId);

      assert.deepEqual(
        profile.repos.map((r) => r.id),
        ['R_A1', 'R_SHARED', 'R_B1'],
        'first-account order, shared repo deduped'
      );
      const a1 = profile.repos.find((r) => r.id === 'R_A1');
      assert.equal(a1.connectionId, idA);
      assert.equal(a1.accountLogin, 'personal');
      const b1 = profile.repos.find((r) => r.id === 'R_B1');
      assert.equal(b1.connectionId, idB);
      assert.equal(b1.accountLogin, 'workcat');
      assert.deepEqual(profile.accounts.map((a) => a.login), ['personal', 'workcat']);
      assert.deepEqual(profile.accounts.map((a) => a.error), [null, null]);
      assert.equal(profile.contributions.commits, 20, 'contributions summed across accounts');
    });

    it('one dead account degrades gracefully: the other still loads, error surfaces per account', async () => {
      const userId = await createUser();
      await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      await saveConnection(userId, { token: 'ghp_dead', login: 'workcat', scopes: '', accountId: '222' });
      installFetchMock({
        graphqlByToken: {
          ghp_a: accountPayload('personal', ['R_A1']),
          ghp_dead: 401, // revoked, and no refresh token to fall back on
        },
      });

      const profile = await fetchGithubProfile(userId);

      assert.deepEqual(profile.repos.map((r) => r.id), ['R_A1']);
      assert.equal(profile.accounts.find((a) => a.login === 'personal').error, null);
      assert.equal(
        profile.accounts.find((a) => a.login === 'workcat').error,
        'GITHUB_RECONNECT',
        'dead account reported, not fatal'
      );
    });

    it('deleteConnection with a connectionId removes only that account (summaries kept)', async () => {
      const userId = await createUser();
      const iso = new Date().toISOString();
      const idA = await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      const idB = await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });
      await database.run(
        'INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)',
        [idA, userId, '{}', iso]
      );
      await database.run(
        'INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)',
        [idB, userId, '{}', iso]
      );
      await database.run(
        `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, connection_id)
         VALUES (?, 'R_paid', 'paid', '2026-01-01T00:00:00Z', '{}', ?)`,
        [userId, idB]
      );

      await deleteConnection(userId, idB);

      assert.deepEqual((await listConnections(userId)).map((c) => c.id), [idA]);
      assert.ok(
        await database.get('SELECT 1 FROM github_profiles WHERE connection_id = ?', [idA]),
        "the other account's cache survives"
      );
      assert.equal(await database.get('SELECT 1 FROM github_profiles WHERE connection_id = ?', [idB]), null);
      assert.ok(
        await database.get('SELECT 1 FROM github_repo_summaries WHERE user_id = ?', [userId]),
        'paid summaries survive a per-account disconnect'
      );
    });

    it('setIncludePrivate with a connectionId flips only that account and clears only its cache', async () => {
      const userId = await createUser();
      const iso = new Date().toISOString();
      const idA = await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      const idB = await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });
      await database.run(
        'INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)',
        [idA, userId, '{}', iso]
      );
      await database.run(
        'INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)',
        [idB, userId, '{}', iso]
      );

      await setIncludePrivate(userId, true, idB);

      const conns = await listConnections(userId);
      assert.equal(conns.find((c) => c.id === idA).includePrivate, false);
      assert.equal(conns.find((c) => c.id === idB).includePrivate, true);
      assert.ok(await database.get('SELECT 1 FROM github_profiles WHERE connection_id = ?', [idA]));
      assert.equal(await database.get('SELECT 1 FROM github_profiles WHERE connection_id = ?', [idB]), null);
    });

    it("setIncludePrivate rejects a connectionId the user doesn't own", async () => {
      const userA = await createUser();
      const userB = await createUser();
      await saveConnection(userA, { token: 'ghp_a', login: 'a', scopes: '', accountId: '111' });
      const idB = await saveConnection(userB, { token: 'ghp_b', login: 'b', scopes: '', accountId: '222' });

      await assert.rejects(setIncludePrivate(userA, true, idB), (err) => {
        assert.equal(err.code, 'GITHUB_NOT_CONNECTED');
        return true;
      });
      assert.equal((await listConnections(userB))[0].includePrivate, false, 'victim untouched');
    });

    it("analyzeRepos fetches each repo's README with its own account's token", async () => {
      const userId = await createUser(5);
      const idA = await saveConnection(userId, { token: 'ghp_a', login: 'personal', scopes: '', accountId: '111' });
      const idB = await saveConnection(userId, { token: 'ghp_b', login: 'workcat', scopes: '', accountId: '222' });

      const result = await analyzeRepos(userId, [
        { ...makeRepo(101), connectionId: idA },
        { ...makeRepo(102), connectionId: idB },
      ]);

      assert.equal(result.summaries.length, 2);
      const readmeCalls = fetchCalls.filter((c) => c.url.includes('/readme'));
      assert.equal(readmeCalls.length, 2);
      assert.equal(readmeCalls[0].init.headers.Authorization, 'Bearer ghp_a');
      assert.equal(readmeCalls[1].init.headers.Authorization, 'Bearer ghp_b');

      const rows = await database.all(
        'SELECT repo_id, connection_id FROM github_repo_summaries WHERE user_id = ? ORDER BY repo_id',
        [userId]
      );
      assert.deepEqual(
        rows.map((r) => [r.repo_id, Number(r.connection_id)]),
        [['R_repo_101', idA], ['R_repo_102', idB]],
        'summaries stamped with their source connection'
      );
    });
  });

  // M2.10.2 — installation visibility for the org-access panel.
  describe('listUserInstallations', () => {
    it('normalizes installations and mirrors them into github_app_installations', async () => {
      const userId = await createUser();
      await connect(userId);
      installFetchMock({
        installations: {
          installations: [
            { id: 11, account: { login: 'octocat', type: 'User' }, suspended_at: null, repository_selection: 'all' },
            { id: 22, account: { login: 'acme', type: 'Organization' }, suspended_at: '2026-08-01T00:00:00Z', repository_selection: 'selected' },
          ],
        },
      });

      const list = await listUserInstallations(userId);

      assert.deepEqual(list, [
        { id: '11', login: 'octocat', type: 'User', suspended: false, repositorySelection: 'all' },
        { id: '22', login: 'acme', type: 'Organization', suspended: true, repositorySelection: 'selected' },
      ]);
      const row = await database.get(
        'SELECT account_login, account_type, suspended FROM github_app_installations WHERE installation_id = ?',
        ['22']
      );
      assert.equal(row.account_login, 'acme');
      assert.equal(Number(row.suspended), 1);
    });

    it('throws GITHUB_NOT_CONNECTED without a connection', async () => {
      const userId = await createUser();
      await assert.rejects(listUserInstallations(userId), (err) => {
        assert.equal(err.code, 'GITHUB_NOT_CONNECTED');
        return true;
      });
    });

    // M2.12 — the user-visible slice of an installation's grant: GitHub
    // filters out granted repos the USER can't access, which is exactly what
    // the org-access panel needs to explain to non-admin members.
    it('countInstallationAccessibleRepos returns the user-accessible totals', async () => {
      const userId = await createUser();
      await connect(userId);
      const conn = await database.get('SELECT id FROM github_connections WHERE user_id = ?', [userId]);
      installFetchMock({
        installationRepos: {
          total_count: 4,
          repositories: [
            { id: 1, name: 'pub', private: false },
            { id: 2, name: 'secret-a', private: true },
            { id: 3, name: 'secret-b', private: true },
            { id: 4, name: 'pub-2', private: false },
          ],
        },
      });

      const counts = await countInstallationAccessibleRepos(Number(conn.id), '22');

      assert.deepEqual(counts, { total: 4, privateCount: 2 });
      const call = fetchCalls.find((c) => c.url.includes('/user/installations/22/repositories'));
      assert.ok(call, 'queried the per-installation repositories endpoint');
      assert.equal(call.init.headers.Authorization, 'Bearer ghp_plaintext_secret');
    });

    it('countInstallationAccessibleRepos reports zero access (the org-member gap)', async () => {
      const userId = await createUser();
      await connect(userId);
      const conn = await database.get('SELECT id FROM github_connections WHERE user_id = ?', [userId]);
      installFetchMock({ installationRepos: { total_count: 0, repositories: [] } });

      const counts = await countInstallationAccessibleRepos(Number(conn.id), '22');

      assert.deepEqual(
        counts,
        { total: 0, privateCount: 0 },
        'installation covers repos the user cannot personally access'
      );
    });
  });

  // M2.10.4 — rate-limit mapping with retryAt.
  describe('rate limiting', () => {
    it('maps a 403 with exhausted quota to GITHUB_RATE_LIMITED with retryAt', async () => {
      const resetEpoch = Math.floor(Date.now() / 1000) + 900;
      installFetchMock({
        readmeStatus: 403,
        readmeHeaders: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
        },
      });

      await assert.rejects(fetchReadme('ghp_x', 'octocat', 'alpha'), (err) => {
        assert.equal(err.code, 'GITHUB_RATE_LIMITED');
        assert.equal(err.status, 429);
        assert.equal(err.retryAt, new Date(resetEpoch * 1000).toISOString());
        return true;
      });
    });

    it('maps a 429 with retry-after (secondary limit) to GITHUB_RATE_LIMITED', async () => {
      installFetchMock({
        readmeStatus: 429,
        readmeHeaders: { 'retry-after': '60' },
      });

      await assert.rejects(fetchReadme('ghp_x', 'octocat', 'alpha'), (err) => {
        assert.equal(err.code, 'GITHUB_RATE_LIMITED');
        assert.ok(err.retryAt, 'retryAt derived from retry-after');
        return true;
      });
    });
  });

  // M2.10.4 — one failing repo must not sink the batch, and paid failures refund.
  describe('analyzeRepos partial failure', () => {
    it('collects failures, keeps successes, and refunds the failed paid repo', async () => {
      const userId = await createUser(5);
      await connect(userId);
      // Exhaust the free allowance so both new repos are chargeable.
      for (let i = 0; i < 10; i++) {
        await database.run(
          `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, counted_free)
           VALUES (?, ?, ?, '2026-01-01T00:00:00Z', '{}', 1)`,
          [userId, `R_seed_${i}`, `seed-${i}`]
        );
      }
      installFetchMock({ readmeFailFor: 'repo-22' });

      const result = await analyzeRepos(userId, [makeRepo(21), makeRepo(22)]);

      assert.equal(result.summaries.length, 1);
      assert.equal(result.summaries[0].repoId, 'R_repo_21');
      assert.deepEqual(result.failed.map((f) => f.repoId), ['R_repo_22']);
      assert.equal(result.charged, 0.2, 'only the successful paid repo stays charged');

      const credits = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
      assert.equal(credits.credits, 4.8, '0.4 charged up-front, 0.2 refunded');
      const row = await database.get(
        'SELECT 1 FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
        [userId, 'R_repo_22']
      );
      assert.equal(row, null, 'no summary row for the failed repo');
    });

    it('failed new repos do not consume free slots', async () => {
      const userId = await createUser(5);
      await connect(userId);
      installFetchMock({ readmeFailFor: 'repo-1' });

      const result = await analyzeRepos(userId, [makeRepo(1), makeRepo(2)]);

      assert.equal(result.charged, 0);
      assert.equal(result.freeUsed, 1, 'only the successful repo consumed a slot');
      assert.equal(result.freeLeft, 9);
      assert.deepEqual(result.failed.map((f) => f.repoId), ['R_repo_1']);
      const marked = await database.get(
        'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
        [userId]
      );
      assert.equal(Number(marked.n), 1);
    });
  });

  describe('summarizeRepo', () => {
    it('fresh repo fetches the readme and calls the LLM once', async () => {
      const userId = await createUser();
      const token = await connect(userId);

      const result = await summarizeRepo(userId, makeRepo(1), token);

      assert.equal(callsTo('/readme'), 1);
      assert.equal(callsTo('bifrost.test'), 1);
      assert.equal(result.cached, false);
      assert.ok(Array.isArray(result.bullets) && result.bullets.length >= 1);
      assert.ok(result.bullets.every((b) => b.length <= 280));
      assert.equal(result.project.repoUrl, 'https://github.com/octocat/repo-1');
    });

    it('same pushedAt again → cached:true with no new fetch calls', async () => {
      const userId = await createUser();
      const token = await connect(userId);
      const repo = makeRepo(2);
      const first = await summarizeRepo(userId, repo, token);

      installFetchMock();
      const second = await summarizeRepo(userId, repo, token);

      assert.equal(fetchCalls.length, 0, 'cache hit must be fully offline');
      assert.equal(second.cached, true);
      assert.deepEqual(second.bullets, first.bullets);
      assert.deepEqual(second.project, first.project);
    });

    it('changed pushedAt re-invokes the LLM', async () => {
      const userId = await createUser();
      const token = await connect(userId);
      await summarizeRepo(userId, makeRepo(3, '2026-07-01T00:00:00Z'), token);

      installFetchMock();
      const result = await summarizeRepo(userId, makeRepo(3, '2026-07-05T00:00:00Z'), token);

      assert.equal(callsTo('bifrost.test'), 1);
      assert.equal(result.cached, false);

      const row = await database.get(
        'SELECT pushed_at FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
        [userId, 'R_repo_3']
      );
      assert.equal(row.pushed_at, '2026-07-05T00:00:00Z');
    });
  });

  describe('analyzeRepos pricing', () => {
    it('first 10 fresh repos are free and marked counted_free', async () => {
      const userId = await createUser(5);
      await connect(userId);
      const repos = Array.from({ length: 10 }, (_, i) => makeRepo(i + 1));

      const result = await analyzeRepos(userId, repos);

      assert.equal(result.charged, 0);
      assert.equal(result.freeUsed, 10);
      assert.equal(result.freeLeft, 0);
      assert.equal(result.reanalyzed, 0);
      assert.equal(result.summaries.length, 10);
      assert.equal(result.summaries[0].repoId, 'R_repo_1');
      assert.equal(result.summaries[0].repoName, 'repo-1');

      const row = await database.get(
        'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
        [userId]
      );
      assert.equal(Number(row.n), 10);

      const credits = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
      assert.equal(credits.credits, 5, 'free repos must not charge');
    });

    it('11th new repo charges exactly 0.2 and the REAL balance survives in users.credits', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, Array.from({ length: 10 }, (_, i) => makeRepo(i + 1)));

      const result = await analyzeRepos(userId, [makeRepo(11)]);

      assert.equal(result.charged, 0.2);
      assert.equal(result.freeUsed, 0);
      assert.equal(result.freeLeft, 0);
      assert.equal(result.reanalyzed, 0, 'a brand-new repo is not a re-analysis');

      const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
      assert.equal(row.credits, 4.8, 'fractional balance must be stored, not truncated');

      const marked = await database.get(
        'SELECT counted_free FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
        [userId, 'R_repo_11']
      );
      assert.equal(Number(marked.counted_free), 0, 'a paid repo must not consume the free allowance');
    });

    it('re-analyzing an unchanged (cached) repo charges nothing and skips the LLM', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, Array.from({ length: 10 }, (_, i) => makeRepo(i + 1)));
      await analyzeRepos(userId, [makeRepo(11)]); // balance now 4.8

      installFetchMock();
      const result = await analyzeRepos(userId, [makeRepo(11)]);

      assert.equal(result.charged, 0);
      assert.equal(result.reanalyzed, 0, 'unchanged repo is cached, not re-analyzed');
      assert.equal(result.summaries[0].cached, true);
      assert.equal(callsTo('bifrost.test'), 0);
      assert.equal(callsTo('/readme'), 0);

      const row = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
      assert.equal(row.credits, 4.8);
    });

    // M2.7.1 — re-analysis of a CHANGED repo is free (pricing hook later).
    it('changed repo re-analyzes for free: LLM runs, no charge, counted_free untouched, reanalyzed=1', async () => {
      const userId = await createUser(5);
      await connect(userId);
      // Analyze once: repo-1 is new, consumes a free slot (counted_free=1).
      await analyzeRepos(userId, [makeRepo(1, '2026-07-01T00:00:00Z')]);
      const freeBefore = await database.get(
        'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
        [userId]
      );
      assert.equal(Number(freeBefore.n), 1);

      installFetchMock();
      const result = await analyzeRepos(userId, [makeRepo(1, '2026-07-05T00:00:00Z')]);

      assert.equal(callsTo('bifrost.test'), 1, 'changed repo must re-run the LLM');
      assert.equal(result.charged, 0, 're-analysis is free');
      assert.equal(result.freeUsed, 0, 're-analysis must not consume a free slot');
      assert.equal(result.reanalyzed, 1);
      assert.equal(result.summaries[0].cached, false);

      const freeAfter = await database.get(
        'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
        [userId]
      );
      assert.equal(Number(freeAfter.n), Number(freeBefore.n), 'counted_free totals unchanged');
      const row = await database.get(
        'SELECT counted_free, pushed_at FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
        [userId, 'R_repo_1']
      );
      assert.equal(Number(row.counted_free), 1, 'existing counted_free value preserved');
      assert.equal(row.pushed_at, '2026-07-05T00:00:00Z', 'summary row updated to the new push');

      const credits = await database.get('SELECT credits FROM users WHERE id = ?', [userId]);
      assert.equal(credits.credits, 5, 'no credits deducted for re-analysis');
    });

    it('a 0-credit user can re-analyze a changed repo but cannot add a new repo beyond the allowance', async () => {
      const userId = await createUser(0);
      await connect(userId);
      // Exhaust the free allowance: 9 seeded rows + repo-1 with an old pushedAt.
      for (let i = 0; i < 9; i++) {
        await database.run(
          `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, counted_free)
           VALUES (?, ?, ?, '2026-01-01T00:00:00Z', '{}', 1)`,
          [userId, `R_seed_${i}`, `seed-${i}`]
        );
      }
      await database.run(
        `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, counted_free)
         VALUES (?, 'R_repo_1', 'repo-1', '2026-06-01T00:00:00Z', '{}', 1)`,
        [userId]
      );

      // Changed repo → free re-analysis, no INSUFFICIENT_CREDITS.
      const result = await analyzeRepos(userId, [makeRepo(1, '2026-07-05T00:00:00Z')]);
      assert.equal(result.charged, 0);
      assert.equal(result.reanalyzed, 1);
      assert.equal(callsTo('bifrost.test'), 1);

      // New repo beyond the allowance → still blocked at 0 credits.
      installFetchMock();
      await assert.rejects(analyzeRepos(userId, [makeRepo(50)]), (err) => {
        assert.equal(err.code, 'INSUFFICIENT_CREDITS');
        return true;
      });
      assert.equal(callsTo('bifrost.test'), 0, 'no LLM call when payment fails');
    });

    it('insufficient credits: throws before any LLM call and writes no summary row', async () => {
      const userId = await createUser(0);
      await connect(userId);
      // Exhaust the free allowance directly so one fresh repo becomes chargeable.
      for (let i = 0; i < 10; i++) {
        await database.run(
          `INSERT INTO github_repo_summaries (user_id, repo_id, repo_name, pushed_at, summary, counted_free)
           VALUES (?, ?, ?, '2026-01-01T00:00:00Z', '{}', 1)`,
          [userId, `R_seed_${i}`, `seed-${i}`]
        );
      }

      await assert.rejects(analyzeRepos(userId, [makeRepo(99)]), (err) => {
        assert.equal(err.code, 'INSUFFICIENT_CREDITS');
        return true;
      });

      assert.equal(callsTo('bifrost.test'), 0, 'must not call the LLM before payment succeeds');
      const row = await database.get(
        'SELECT 1 FROM github_repo_summaries WHERE user_id = ? AND repo_id = ?',
        [userId, 'R_repo_99']
      );
      assert.equal(row, null, 'no summary row written on payment failure');
    });

    it('throws GITHUB_NOT_CONNECTED when the user has no connection', async () => {
      const userId = await createUser(5);
      await assert.rejects(analyzeRepos(userId, [makeRepo(1)]), (err) => {
        assert.equal(err.code, 'GITHUB_NOT_CONNECTED');
        return true;
      });
    });
  });

  describe('listSummaries', () => {
    /** Seeds the cached profile with the given repos' (id, pushedAt) pairs. */
    async function seedProfile(userId, repos) {
      const conn = await database.get(
        'SELECT id FROM github_connections WHERE user_id = ? ORDER BY id LIMIT 1',
        [userId]
      );
      const data = JSON.stringify({
        login: 'octocat',
        repos: repos.map((r) => ({ id: r.id, pushedAt: r.pushedAt })),
        fetchedAt: new Date().toISOString(),
      });
      await database.run(
        `INSERT INTO github_profiles (connection_id, user_id, data, fetched_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(connection_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
        [conn.id, userId, data, new Date().toISOString()]
      );
    }

    it('returns [] for a user with no summaries (never throws)', async () => {
      const userId = await createUser();
      assert.deepEqual(await listSummaries(userId), []);
    });

    it('returns entries with parsed bullets/project; stale=false without a profile cache', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, [makeRepo(1)]);

      installFetchMock();
      const entries = await listSummaries(userId);

      assert.equal(fetchCalls.length, 0, 'listSummaries must be a pure DB read');
      assert.equal(entries.length, 1);
      const entry = entries[0];
      assert.equal(entry.repoId, 'R_repo_1');
      assert.equal(entry.repoName, 'repo-1');
      assert.equal(entry.pushedAt, '2026-07-01T00:00:00Z');
      assert.ok(Array.isArray(entry.bullets) && entry.bullets.length >= 1);
      assert.equal(entry.project.repoUrl, 'https://github.com/octocat/repo-1');
      assert.equal(entry.countedFree, true);
      assert.ok(entry.createdAt);
      assert.equal(entry.stale, false, 'no profile cache → stale is false');
    });

    it('stale=false when the cached profile matches; true after the profile shows a newer push', async () => {
      const userId = await createUser(5);
      await connect(userId);
      const repo = makeRepo(1, '2026-07-01T00:00:00Z');
      await analyzeRepos(userId, [repo]);

      await seedProfile(userId, [repo]);
      let [entry] = await listSummaries(userId);
      assert.equal(entry.stale, false, 'matching pushedAt → not stale');

      await seedProfile(userId, [makeRepo(1, '2026-07-09T00:00:00Z')]);
      [entry] = await listSummaries(userId);
      assert.equal(entry.stale, true, 'newer pushedAt in profile cache → stale');
    });

    it('stale=false when the repo is absent from the cached profile', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, [makeRepo(1)]);
      await seedProfile(userId, [makeRepo(2)]); // profile knows a different repo only

      const [entry] = await listSummaries(userId);
      assert.equal(entry.stale, false);
    });

    // M2.8.2 — usage map: which of the user's resumes already contain the repo.
    /** Seeds a base resume + a project row optionally stamped with a github_repo_id. */
    async function seedResumeWithProject(userId, resumeName, githubRepoId) {
      const resumeUuid = crypto.randomUUID();
      const res = await database.run(
        `INSERT INTO base_resumes (uuid, user_id, name, contact_data, skills, is_base)
         VALUES (?, ?, ?, '{}', '[]', 1)`,
        [resumeUuid, userId, resumeName]
      );
      await database.run(
        `INSERT INTO projects (uuid, resume_id, name, description, github_repo_id)
         VALUES (?, ?, 'proj', '[]', ?)`,
        [crypto.randomUUID(), res.id, githubRepoId ?? null]
      );
      return resumeUuid;
    }

    it('inResumes lists the resume uuid+name containing a project stamped with the repo', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, [makeRepo(1)]);
      const resumeUuid = await seedResumeWithProject(userId, 'My Base Resume', 'R_repo_1');

      const [entry] = await listSummaries(userId);
      assert.deepEqual(entry.inResumes, [{ id: resumeUuid, name: 'My Base Resume' }]);
    });

    it('inResumes is an empty array when no resume uses the repo', async () => {
      const userId = await createUser(5);
      await connect(userId);
      await analyzeRepos(userId, [makeRepo(1)]);
      // A resume with only a manual (null github_repo_id) project must not count.
      await seedResumeWithProject(userId, 'Manual Only', null);

      const [entry] = await listSummaries(userId);
      assert.deepEqual(entry.inResumes, []);
    });

    it("inResumes never includes another user's resumes", async () => {
      const userA = await createUser(5);
      const userB = await createUser(5);
      await connect(userA);
      await connect(userB);
      await analyzeRepos(userA, [makeRepo(1)]);
      await analyzeRepos(userB, [makeRepo(1)]);

      const aResume = await seedResumeWithProject(userA, 'A resume', 'R_repo_1');
      await seedResumeWithProject(userB, 'B resume', 'R_repo_1');

      const [aEntry] = await listSummaries(userA);
      assert.deepEqual(aEntry.inResumes, [{ id: aResume, name: 'A resume' }]);
      const [bEntry] = await listSummaries(userB);
      assert.deepEqual(bEntry.inResumes.map((r) => r.name), ['B resume']);
    });

    it('returns only the requesting user rows', async () => {
      const userA = await createUser(5);
      const userB = await createUser(5);
      await connect(userA);
      await connect(userB);
      await analyzeRepos(userA, [makeRepo(1), makeRepo(2)]);
      await analyzeRepos(userB, [makeRepo(3)]);

      const aEntries = await listSummaries(userA);
      const bEntries = await listSummaries(userB);
      assert.deepEqual(aEntries.map((e) => e.repoId).sort(), ['R_repo_1', 'R_repo_2']);
      assert.deepEqual(bEntries.map((e) => e.repoId), ['R_repo_3']);
    });
  });
});
