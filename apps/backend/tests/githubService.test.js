import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import database from '../src/config/database.js';
import { initializeDatabase } from '../src/config/initDb.js';
import {
  saveConnection,
  getConnection,
  getToken,
  deleteConnection,
  fetchGithubProfile,
  summarizeRepo,
  analyzeRepos,
  listSummaries,
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
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    fetchCalls.push({ url: u, init });

    if (u === 'https://api.github.com/graphql') {
      if (overrides.graphqlStatus) {
        return mockResponse(overrides.graphqlStatus, { json: { message: 'Bad credentials' } });
      }
      return mockResponse(200, { json: overrides.graphql ?? graphqlPayload() });
    }
    if (u.startsWith('https://api.github.com/repos/') && u.endsWith('/readme')) {
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
      await database.run(
        'INSERT INTO github_profiles (user_id, data, fetched_at) VALUES (?, ?, ?)',
        [userId, '{}', new Date().toISOString()]
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
      const data = JSON.stringify({
        login: 'octocat',
        repos: repos.map((r) => ({ id: r.id, pushedAt: r.pushedAt })),
        fetchedAt: new Date().toISOString(),
      });
      await database.run(
        `INSERT INTO github_profiles (user_id, data, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
        [userId, data, new Date().toISOString()]
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
