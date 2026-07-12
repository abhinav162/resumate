import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildGithubEvidence } from '../src/lib/github/evidence.js';

const PROFILE = {
  login: 'octo',
  contributions: { commits: 812, prs: 64, reviews: 31, issues: 12 },
  repos: [
    {
      id: 'R1', name: 'aurora', nameWithOwner: 'octo/aurora', description: 'A viz engine',
      url: 'https://github.com/octo/aurora', isPrivate: false, isFork: false, isOwner: true,
      stars: 120, primaryLanguage: 'TypeScript',
      languages: [{ name: 'TypeScript', bytes: 90000 }, { name: 'CSS', bytes: 8000 }],
      pushedAt: '2026-06-01T00:00:00Z',
    },
    {
      id: 'R2', name: 'mlkit', nameWithOwner: 'octo/mlkit', description: 'ML toolkit',
      url: 'https://github.com/octo/mlkit', isPrivate: false, isFork: false, isOwner: true,
      stars: 15, primaryLanguage: 'Python',
      languages: [{ name: 'Python', bytes: 60000 }],
      pushedAt: '2026-05-01T00:00:00Z',
    },
  ],
};

const SUMMARIES = [
  { repoId: 'R1', repoName: 'octo/aurora', bullets: ['Built a WebGL viz engine rendering 1M points at 60fps.'] },
];

describe('buildGithubEvidence', () => {
  it('produces a compact block with languages, contributions and analyzed repos', () => {
    const text = buildGithubEvidence(PROFILE, SUMMARIES);
    assert.match(text, /Top languages/);
    assert.match(text, /TypeScript \(\d+(\.\d+)?%\)/);
    assert.match(text, /812 commits, 64 pull requests, 31 code reviews/);
    assert.match(text, /octo\/aurora \(★120, TypeScript\)/);
    assert.match(text, /WebGL viz engine/);
  });

  it('returns null when there is no cached profile or repos', () => {
    assert.equal(buildGithubEvidence(null, SUMMARIES), null);
    assert.equal(buildGithubEvidence({ repos: [] }, []), null);
  });

  it('caps output length', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      repoId: `R${i}`, repoName: `octo/repo-${i}`,
      bullets: ['x'.repeat(200), 'y'.repeat(200), 'z'.repeat(200)],
    }));
    const text = buildGithubEvidence(PROFILE, many, { maxRepos: 50 });
    assert.ok(text.length <= 1500);
  });
});

describe('tailorResume evidence injection (M2.6)', () => {
  const realFetch = global.fetch;
  let requestBodies;

  beforeEach(() => {
    process.env.BIFROST_URL = 'https://bifrost.test';
    process.env.BIFROST_VIRTUAL_KEY = 'sk-bf-test';
    requestBodies = [];
    // One canned payload serves every call in the tailor pipeline: keyword
    // extraction, before/after scoring, and the tailor call itself.
    const content = JSON.stringify({
      keywords: ['react'],
      impact: 50, clarity: 50, issues: [], suggestions: [],
      tailoredResume: { summary: 'S', skills: [], experience: [], projects: [], education: [] },
      diff: [],
    });
    global.fetch = async (_url, init) => {
      requestBodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
    };
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  function tailorPrompt() {
    const req = requestBodies.find((b) =>
      b.messages?.[0]?.content?.includes('ATS resume optimizer')
    );
    assert.ok(req, 'tailor prompt request found');
    return req.messages[0].content;
  }

  it('includes the evidence block when githubEvidence is provided', async () => {
    const { tailorResume } = await import('../src/services/aiService.js');
    await tailorResume({ summary: 'S' }, 'SWE', 'Acme', 'A job description here.', {
      githubEvidence: 'Top languages: TypeScript (80%)',
    });
    const prompt = tailorPrompt();
    assert.match(prompt, /Verified GitHub evidence/);
    assert.match(prompt, /TypeScript \(80%\)/);
    assert.match(prompt, /NEVER\nfabricate/);
  });

  it('omits the block entirely when no evidence is passed (prompt unchanged)', async () => {
    const { tailorResume } = await import('../src/services/aiService.js');
    await tailorResume({ summary: 'S' }, 'SWE', 'Acme', 'A job description here.');
    const prompt = tailorPrompt();
    assert.ok(!prompt.includes('Verified GitHub evidence'));
    assert.match(prompt, /---\n\nOriginal Resume:/);
  });
});
