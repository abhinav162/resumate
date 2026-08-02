import express from 'express';
import database from '../config/database.js';
import { signState, verifyState } from '../lib/crypto.js';
import { techProfile, rankImportable } from '../lib/github/profile.js';
import { GITHUB_FREE_REPOS } from '../config/credits.config.js';
import { getCredits } from '../services/creditService.js';
import {
  saveConnection,
  getConnection,
  deleteConnection,
  fetchGithubProfile,
  analyzeRepos,
  listSummaries,
  setIncludePrivate,
  listUserInstallations,
} from '../services/githubService.js';

const router = express.Router();

function isConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY
  );
}

function requireGithubConfig(req, res, next) {
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'GitHub integration is not configured. Please contact support.',
    });
  }
  next();
}

// ensureUserExists attaches req.user when the Clerk header is present.
function requireUser(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }
  next();
}

function redirectUri() {
  return (
    process.env.GITHUB_REDIRECT_URI ||
    `${(process.env.BACKEND_URL || 'http://localhost:4300').replace(/\/$/, '')}/api/github/callback`
  );
}

// Maps githubService error codes to HTTP responses so token problems surface
// as a "reconnect" state instead of a 500.
function sendGithubError(res, error) {
  if (error.code === 'GITHUB_NOT_CONNECTED') {
    return res.status(400).json({ success: false, code: error.code, message: 'GitHub is not connected' });
  }
  if (error.code === 'GITHUB_RECONNECT') {
    return res.status(401).json({ success: false, code: error.code, message: 'GitHub token expired or revoked — please reconnect' });
  }
  if (error.code === 'GITHUB_RATE_LIMITED') {
    return res.status(429).json({
      success: false,
      code: error.code,
      retryAt: error.retryAt ?? null,
      message: 'GitHub rate limit reached — try again shortly',
    });
  }
  if (error.code === 'INSUFFICIENT_CREDITS') {
    return res.status(402).json({ success: false, code: error.code, message: 'Not enough credits for this analysis' });
  }
  console.error('GitHub route error:', error);
  return res.status(error.status || 500).json({ success: false, message: error.message });
}

async function freeReposLeft(userId) {
  const row = await database.get(
    'SELECT COUNT(*) AS n FROM github_repo_summaries WHERE user_id = ? AND counted_free = 1',
    [userId]
  );
  return Math.max(0, GITHUB_FREE_REPOS - (row?.n ?? 0));
}

// GET /api/github/status — connection state for the dashboard card
router.get('/status', requireUser, async (req, res) => {
  try {
    const conn = await getConnection(req.user.id);
    res.json({
      success: true,
      data: {
        connected: Boolean(conn),
        login: conn?.login ?? null,
        freeReposLeft: await freeReposLeft(req.user.id),
        includePrivate: conn?.includePrivate ?? false,
        // App slug for the "grant repo access" install deep-link (private repos
        // are only visible once the app is installed on the user's account).
        appSlug: process.env.GITHUB_APP_SLUG || null,
      },
    });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// GET /api/github/connect — returns the GitHub authorize URL; the state param
// carries the signed user uuid so the unauthenticated callback can identify them.
router.get('/connect', requireGithubConfig, requireUser, (req, res) => {
  const state = signState({ u: req.user.uuid });
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
  });
  res.json({ success: true, data: { url: `https://github.com/login/oauth/authorize?${params}` } });
});

// GET /api/github/callback — browser redirect from GitHub (no auth headers here;
// identity comes from the signed state). Exchanges code → token, stores it
// encrypted, then bounces back to the frontend.
router.get('/callback', requireGithubConfig, async (req, res) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  try {
    const { code, state } = req.query;
    const decoded = verifyState(state);
    if (!code || !decoded?.u) {
      return res.redirect(`${frontend}/dashboard?github=error`);
    }
    const userRow = await database.get('SELECT id FROM users WHERE uuid = ?', [decoded.u]);
    if (!userRow) return res.redirect(`${frontend}/dashboard?github=error`);

    // Exchange the authorization code for a user-to-server token.
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri(),
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('GitHub token exchange failed:', tokenData.error_description || tokenRes.status);
      return res.redirect(`${frontend}/dashboard?github=error`);
    }

    // Resolve the login for display; the token itself is never sent to the client.
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
    });
    const ghUser = userRes.ok ? await userRes.json() : {};

    // Expiring user tokens ("Expire user authorization tokens" app setting):
    // GitHub returns expires_in (~8h) + a refresh_token (~6 months). Store both
    // so getValidToken can rotate silently instead of forcing a reconnect.
    const now = Date.now();
    await saveConnection(userRow.id, {
      token: tokenData.access_token,
      login: ghUser.login ?? null,
      scopes: tokenData.scope ?? '',
      refreshToken: tokenData.refresh_token ?? null,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(now + tokenData.expires_in * 1000).toISOString()
        : null,
      refreshTokenExpiresAt: tokenData.refresh_token_expires_in
        ? new Date(now + tokenData.refresh_token_expires_in * 1000).toISOString()
        : null,
    });
    res.redirect(`${frontend}/dashboard?github=connected`);
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.redirect(`${frontend}/dashboard?github=error`);
  }
});

// POST /api/github/preferences { includePrivate } — opt in/out of listing
// private repos (M2.9.2). Clears the profile cache so the change is immediate.
router.post('/preferences', requireUser, async (req, res) => {
  try {
    const { includePrivate } = req.body ?? {};
    if (typeof includePrivate !== 'boolean') {
      return res.status(400).json({ success: false, message: 'includePrivate must be a boolean' });
    }
    await setIncludePrivate(req.user.id, includePrivate);
    res.json({ success: true, data: { includePrivate } });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// POST /api/github/disconnect — removes the stored token + profile cache
router.post('/disconnect', requireUser, async (req, res) => {
  try {
    await deleteConnection(req.user.id);
    res.json({ success: true, data: { connected: false } });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// GET /api/github/repos?refresh=true — cached profile → derived tech profile +
// importable repos ranked for the import picker.
router.get('/repos', requireUser, async (req, res) => {
  try {
    const profile = await fetchGithubProfile(req.user.id, {
      refresh: req.query.refresh === 'true',
    });
    const analyzed = await database.all(
      'SELECT repo_id, pushed_at FROM github_repo_summaries WHERE user_id = ?',
      [req.user.id]
    );
    const analyzedByRepo = new Map(analyzed.map((r) => [r.repo_id, r.pushed_at]));
    const importable = rankImportable(profile.repos).map((repo) => ({
      id: repo.id,
      name: repo.name,
      nameWithOwner: repo.nameWithOwner,
      description: repo.description,
      url: repo.url,
      isPrivate: repo.isPrivate,
      stars: repo.stars,
      primaryLanguage: repo.primaryLanguage,
      pushedAt: repo.pushedAt,
      rank: repo.rank,
      // M2.10.1 — owner grouping + commit-evidence signal for the UI.
      ownerLogin: repo.ownerLogin ?? null,
      ownerType: repo.ownerType ?? 'User',
      commitCount: repo.commitCount ?? 0,
      // "analyzed" means a summary exists for the current push — importing it is free.
      analyzed: analyzedByRepo.get(repo.id) === repo.pushedAt,
    }));
    res.json({
      success: true,
      data: {
        login: profile.login,
        contributions: profile.contributions,
        techProfile: techProfile(profile.repos),
        importable,
        freeReposLeft: await freeReposLeft(req.user.id),
      },
    });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// GET /api/github/orgs — the org/installation access map (M2.10.2): the
// user's personal account plus every org they belong to, each with the app's
// install status there. Powers the "Organizations & access" panel that
// explains why an org's private repos are (in)visible.
router.get('/orgs', requireUser, async (req, res) => {
  try {
    const profile = await fetchGithubProfile(req.user.id);
    const installations = await listUserInstallations(req.user.id);
    const byLogin = new Map(
      installations.filter((i) => i.login).map((i) => [i.login.toLowerCase(), i])
    );
    const statusFor = (login) => {
      const inst = byLogin.get(String(login ?? '').toLowerCase());
      if (!inst) return 'not_installed';
      return inst.suspended ? 'suspended' : 'installed';
    };
    const orgs = [
      { login: profile.login, type: 'User', databaseId: null, status: statusFor(profile.login) },
      // Profiles cached before M2.10 have no organizations array.
      ...(profile.organizations ?? []).map((org) => ({
        login: org.login,
        type: 'Organization',
        databaseId: org.databaseId ?? null,
        status: statusFor(org.login),
      })),
    ];
    res.json({
      success: true,
      data: { orgs, appSlug: process.env.GITHUB_APP_SLUG || null },
    });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// GET /api/github/summaries — the user's analyzed-repo library (M2.7). Pure DB
// read: stored bullets/project drafts plus a `stale` flag when the cached
// profile shows the repo has been pushed since analysis.
router.get('/summaries', requireUser, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        summaries: await listSummaries(req.user.id),
        freeReposLeft: await freeReposLeft(req.user.id),
      },
    });
  } catch (error) {
    sendGithubError(res, error);
  }
});

// POST /api/github/analyze { repoIds: [] } — summarize selected repos into
// resume-ready bullets. First GITHUB_FREE_REPOS never-analyzed repos are free,
// then CREDIT_COSTS.GITHUB_REPO each. Cache hits and re-analysis of changed
// repos are free (M2.7 — re-analysis pricing may come later).
router.post('/analyze', requireUser, async (req, res) => {
  try {
    const { repoIds } = req.body ?? {};
    if (!Array.isArray(repoIds) || repoIds.length === 0) {
      return res.status(400).json({ success: false, message: 'repoIds must be a non-empty array' });
    }
    if (repoIds.length > 20) {
      return res.status(400).json({ success: false, message: 'At most 20 repos per analysis' });
    }
    const profile = await fetchGithubProfile(req.user.id);
    const wanted = new Set(repoIds);
    const repos = profile.repos.filter((r) => wanted.has(r.id));
    if (repos.length === 0) {
      return res.status(400).json({ success: false, message: 'No matching repos in your GitHub profile' });
    }
    const result = await analyzeRepos(req.user.id, repos);
    res.json({
      success: true,
      data: { ...result, creditsLeft: await getCredits(req.user.id) },
    });
  } catch (error) {
    sendGithubError(res, error);
  }
});

export default router;
