import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  recencyWeight,
  techProfile,
  rankImportable,
  dedupeSkills,
} from '../src/lib/github/profile.js';

// Fixed reference timestamp so every test is deterministic.
const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

function isoMonthsAgo(months) {
  return new Date(NOW - months * MS_PER_MONTH).toISOString();
}

function makeRepo(overrides = {}) {
  return {
    id: 'node-id',
    name: 'repo',
    nameWithOwner: 'user/repo',
    description: 'A repo',
    url: 'https://github.com/user/repo',
    isPrivate: false,
    isFork: false,
    isOwner: true,
    stars: 0,
    primaryLanguage: 'JavaScript',
    languages: [{ name: 'JavaScript', bytes: 1000 }],
    pushedAt: isoMonthsAgo(0),
    ...overrides,
  };
}

describe('recencyWeight', () => {
  it('returns ~1 for a fresh push', () => {
    assert.equal(recencyWeight(isoMonthsAgo(0), NOW), 1);
    assert.ok(recencyWeight(isoMonthsAgo(0.1), NOW) > 0.99);
  });

  it('returns ~0.5 at the 12-month half-life', () => {
    const w = recencyWeight(isoMonthsAgo(12), NOW);
    assert.ok(Math.abs(w - 0.5) < 1e-9, `${w} ~= 0.5`);
  });

  it('returns 0 for invalid or missing dates', () => {
    assert.equal(recencyWeight('not-a-date', NOW), 0);
    assert.equal(recencyWeight('', NOW), 0);
    assert.equal(recencyWeight(null, NOW), 0);
    assert.equal(recencyWeight(undefined, NOW), 0);
  });

  it('clamps future dates to 1', () => {
    assert.equal(recencyWeight(isoMonthsAgo(-24), NOW), 1);
  });
});

describe('techProfile', () => {
  const fixture = [
    makeRepo({
      name: 'starred',
      stars: 100,
      pushedAt: isoMonthsAgo(0),
      languages: [
        { name: 'JavaScript', bytes: 1000 },
        { name: 'TypeScript', bytes: 500 },
      ],
    }),
    makeRepo({
      name: 'quiet',
      stars: 0,
      pushedAt: isoMonthsAgo(0),
      languages: [{ name: 'Python', bytes: 2000 }],
    }),
    makeRepo({
      name: 'forked',
      isFork: true,
      stars: 9999,
      pushedAt: isoMonthsAgo(0),
      languages: [{ name: 'Go', bytes: 1000000 }],
    }),
  ];

  it('orders languages by weighted score and excludes forks', () => {
    const { languages } = techProfile(fixture, { now: NOW });
    assert.deepEqual(
      languages.map((l) => l.name),
      ['JavaScript', 'TypeScript', 'Python']
    );
    assert.ok(!languages.some((l) => l.name === 'Go'));
  });

  it('computes exact scores from the weighting formula', () => {
    const { languages } = techProfile(fixture, { now: NOW });
    const starredWeight = 1 + Math.log1p(100); // recency = 1 at NOW
    const byName = Object.fromEntries(languages.map((l) => [l.name, l]));
    assert.ok(Math.abs(byName.JavaScript.score - 1000 * starredWeight) < 1e-9);
    assert.ok(Math.abs(byName.TypeScript.score - 500 * starredWeight) < 1e-9);
    assert.ok(Math.abs(byName.Python.score - 2000) < 1e-9);
  });

  it('percents sum to ~100 and are rounded to 1 dp', () => {
    const { languages } = techProfile(fixture, { now: NOW });
    const sum = languages.reduce((a, l) => a + l.percent, 0);
    assert.ok(Math.abs(sum - 100) < 0.3, `${sum} ~= 100`);
    for (const l of languages) {
      assert.equal(l.percent, Math.round(l.percent * 10) / 10);
    }
  });

  it('caps output at the top 15 languages', () => {
    const many = makeRepo({
      languages: Array.from({ length: 20 }, (_, i) => ({
        name: `Lang${i}`,
        bytes: 1000 - i,
      })),
    });
    const { languages } = techProfile([many], { now: NOW });
    assert.equal(languages.length, 15);
    assert.equal(languages[0].name, 'Lang0');
  });

  it('returns empty languages for empty or fork-only input', () => {
    assert.deepEqual(techProfile([], { now: NOW }), { languages: [] });
    assert.deepEqual(techProfile([makeRepo({ isFork: true })], { now: NOW }), { languages: [] });
  });
});

describe('rankImportable', () => {
  const hot = makeRepo({
    id: 'hot',
    name: 'hot',
    stars: 50,
    pushedAt: isoMonthsAgo(0),
    isOwner: true,
    description: 'Actively maintained tool',
  });
  const stale = makeRepo({
    id: 'stale',
    name: 'stale',
    stars: 0,
    pushedAt: isoMonthsAgo(120),
    isOwner: false,
    description: null,
  });
  const fork = makeRepo({ id: 'fork', name: 'fork', isFork: true, stars: 9999 });

  it('ranks starred+recent+owned above a stale unowned repo', () => {
    const ranked = rankImportable([stale, hot, fork], { now: NOW });
    assert.deepEqual(
      ranked.map((r) => r.id),
      ['hot', 'stale']
    );
    assert.ok(ranked[0].rank > ranked[1].rank);
  });

  it('excludes forks', () => {
    const ranked = rankImportable([hot, fork], { now: NOW });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].id, 'hot');
  });

  it('applies the scoring formula, rounded to 3 dp', () => {
    const [top] = rankImportable([hot], { now: NOW });
    const expected = 2.0 * Math.log1p(50) + 3.0 * 1 + 1.0 + 0.5;
    assert.equal(top.rank, Math.round(expected * 1000) / 1000);
  });

  it('is stable for ties, keeping input order', () => {
    const a = makeRepo({ id: 'a', name: 'a' });
    const b = makeRepo({ id: 'b', name: 'b' });
    const ranked = rankImportable([a, b], { now: NOW });
    assert.deepEqual(
      ranked.map((r) => r.id),
      ['a', 'b']
    );
    assert.equal(ranked[0].rank, ranked[1].rank);
  });

  it('does not mutate the input', () => {
    const input = [stale, hot, fork];
    const snapshot = JSON.parse(JSON.stringify(input));
    rankImportable(input, { now: NOW });
    assert.deepEqual(JSON.parse(JSON.stringify(input)), snapshot);
    assert.ok(!('rank' in hot));
  });

  it('is deterministic with a fixed now', () => {
    const first = rankImportable([stale, hot, fork], { now: NOW });
    const second = rankImportable([stale, hot, fork], { now: NOW });
    assert.deepEqual(first, second);
  });
});

describe('dedupeSkills', () => {
  it('removes existing skills case-insensitively', () => {
    const result = dedupeSkills(['TypeScript', 'Go', 'Rust'], ['typescript', 'GO']);
    assert.deepEqual(result, ['Rust']);
  });

  it('preserves original casing and order', () => {
    const result = dedupeSkills(['GraphQL', 'aws', 'Docker'], []);
    assert.deepEqual(result, ['GraphQL', 'aws', 'Docker']);
  });

  it('dedupes within suggested, keeping the first occurrence', () => {
    const result = dedupeSkills(['Node.js', 'node.js', 'NODE.JS', 'SQL'], []);
    assert.deepEqual(result, ['Node.js', 'SQL']);
  });

  it('handles empty and missing inputs', () => {
    assert.deepEqual(dedupeSkills([], ['x']), []);
    assert.deepEqual(dedupeSkills(['x'], []), ['x']);
    assert.deepEqual(dedupeSkills(undefined, undefined), []);
  });
});
