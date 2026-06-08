import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock the Bifrost LLM endpoint by stubbing global.fetch. Each test sets the
// canned JSON the "model" returns and can inspect the request body.
const realFetch = global.fetch;
let lastRequestBody = null;

function mockLLM(content) {
  global.fetch = async (_url, init) => {
    lastRequestBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    };
  };
}

const STRONG_RESUME = {
  contact: { name: 'A', email: 'a@b.com' },
  summary: 'Senior engineer with measurable impact.',
  skills: ['React', 'Node.js', 'Kubernetes'],
  experience: [
    {
      role: 'Engineer',
      company: 'Acme',
      responsibilities: [
        'Reduced p95 latency by 40% by introducing a Redis cache layer.',
        'Led a team of 5 to ship a billing system handling 1M requests/day.',
      ],
    },
  ],
  projects: [],
  education: [{ degree: 'BS', institution: 'Uni' }],
};

describe('scoreResume (hybrid, SCORING_V2 default)', () => {
  beforeEach(() => {
    process.env.BIFROST_URL = 'https://bifrost.test';
    process.env.BIFROST_VIRTUAL_KEY = 'sk-bf-test';
    delete process.env.SCORING_V2;
    lastRequestBody = null;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns a composite score + breakdown, blending deterministic and LLM parts', async () => {
    mockLLM(JSON.stringify({ impact: 80, clarity: 75, issues: [], suggestions: [] }));
    const { scoreResume } = await import('../src/services/aiService.js');

    const res = await scoreResume(STRONG_RESUME);
    assert.ok(Number.isInteger(res.score) && res.score >= 0 && res.score <= 100);
    for (const k of ['metrics', 'verbs', 'readability', 'formatting', 'impact', 'clarity']) {
      assert.ok(typeof res.breakdown[k] === 'number', `breakdown.${k} present`);
    }
    assert.equal(res.breakdown.impact, 80);
    // No JD provided → no keywordMatch component.
    assert.equal(res.breakdown.keywordMatch, undefined);
    assert.ok(Array.isArray(res.issues) && Array.isArray(res.suggestions));
  });

  it('sends temperature 0 for deterministic scoring', async () => {
    mockLLM(JSON.stringify({ impact: 50, clarity: 50, issues: [], suggestions: [] }));
    const { scoreResume } = await import('../src/services/aiService.js');
    await scoreResume(STRONG_RESUME);
    assert.equal(lastRequestBody.temperature, 0);
  });

  it('includes a keywordMatch component when jdKeywords are supplied', async () => {
    mockLLM(JSON.stringify({ impact: 60, clarity: 60, issues: [], suggestions: [] }));
    const { scoreResume } = await import('../src/services/aiService.js');
    const res = await scoreResume(STRONG_RESUME, { jdKeywords: ['react', 'kubernetes', 'graphql'] });
    assert.ok(typeof res.breakdown.keywordMatch === 'number');
    // Resume has React + Kubernetes (2 of 3) → ~67.
    assert.ok(res.breakdown.keywordMatch >= 60 && res.breakdown.keywordMatch <= 70);
  });

  it('falls back to the legacy single-call scorer when SCORING_V2=false', async () => {
    process.env.SCORING_V2 = 'false';
    mockLLM(JSON.stringify({ score: 73, issues: [], suggestions: [] }));
    const { scoreResume } = await import('../src/services/aiService.js');
    const res = await scoreResume(STRONG_RESUME);
    assert.equal(res.score, 73);
    assert.equal(res.breakdown, undefined);
  });
});

describe('extractJdKeywords', () => {
  beforeEach(() => {
    process.env.BIFROST_URL = 'https://bifrost.test';
    process.env.BIFROST_VIRTUAL_KEY = 'sk-bf-test';
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns [] for empty JD without calling the LLM', async () => {
    let called = false;
    global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    const { extractJdKeywords } = await import('../src/services/aiService.js');
    const kws = await extractJdKeywords('   ');
    assert.deepEqual(kws, []);
    assert.equal(called, false);
  });

  it('parses the keywords array from the LLM response', async () => {
    mockLLM(JSON.stringify({ keywords: ['react', 'node.js', 'aws'] }));
    const { extractJdKeywords } = await import('../src/services/aiService.js');
    const kws = await extractJdKeywords('We need React and AWS experience.');
    assert.deepEqual(kws, ['react', 'node.js', 'aws']);
  });
});
