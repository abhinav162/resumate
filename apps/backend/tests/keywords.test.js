import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeToken,
  canonicalize,
  buildResumeTokens,
  matchesKeyword,
  buildResumeText,
  coverage,
  keywordMatchScore,
  SYNONYMS,
} from '../src/lib/scoring/keywords.js';

describe('normalizeToken', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeToken('  React '), 'react');
  });

  it('strips surrounding punctuation but keeps internal dots', () => {
    assert.equal(normalizeToken('Node.js,'), 'node.js');
  });

  it('keeps internal + and #', () => {
    assert.equal(normalizeToken('C++'), 'c++');
    assert.equal(normalizeToken('(C#)'), 'c#');
  });

  it('collapses internal whitespace', () => {
    assert.equal(normalizeToken('Amazon   Web  Services'), 'amazon web services');
  });

  it('handles null/undefined', () => {
    assert.equal(normalizeToken(null), '');
    assert.equal(normalizeToken(undefined), '');
  });
});

describe('canonicalize', () => {
  it('maps k8s -> kubernetes', () => {
    assert.equal(canonicalize('k8s'), 'kubernetes');
  });

  it('maps JS -> javascript', () => {
    assert.equal(canonicalize('JS'), 'javascript');
  });

  it('maps AWS -> amazon web services', () => {
    assert.equal(canonicalize('AWS'), 'amazon web services');
  });

  it('maps canonical to itself', () => {
    assert.equal(canonicalize('Kubernetes'), 'kubernetes');
  });

  it('returns normalized token when no synonym', () => {
    assert.equal(canonicalize('GraphQL'), 'graphql');
  });

  it('SYNONYMS contains expected canonical keys', () => {
    assert.ok(Array.isArray(SYNONYMS.kubernetes));
    assert.ok(SYNONYMS.kubernetes.includes('k8s'));
  });
});

describe('buildResumeTokens', () => {
  const resume = {
    summary: 'Experienced engineer building scalable systems',
    skills: ['React', 'Amazon Web Services', 'k8s'],
    experience: [
      {
        role: 'Backend Engineer',
        responsibilities: ['Built APIs using GraphQL and Node'],
      },
    ],
    projects: [
      { name: 'DataPipeline', description: 'Processed events with Kafka' },
    ],
  };

  it('includes skill words and canonicalized multiword skills', () => {
    const tokens = buildResumeTokens(resume);
    assert.ok(tokens.has('react'));
    assert.ok(tokens.has('amazon web services')); // multiword skill entry
    assert.ok(tokens.has('kubernetes')); // k8s canonicalized
  });

  it('includes words from bullets, roles, project names and summary', () => {
    const tokens = buildResumeTokens(resume);
    assert.ok(tokens.has('graphql'));
    assert.ok(tokens.has('node.js')); // "Node" canonicalized
    assert.ok(tokens.has('backend'));
    assert.ok(tokens.has('datapipeline'));
    assert.ok(tokens.has('kafka'));
    assert.ok(tokens.has('scalable'));
  });

  it('handles responsibilities/description given as strings', () => {
    const r = {
      experience: [{ role: 'Dev', responsibilities: 'Used Redis\nUsed Docker' }],
      projects: [{ name: 'P', description: 'Built with Terraform' }],
    };
    const tokens = buildResumeTokens(r);
    assert.ok(tokens.has('redis'));
    assert.ok(tokens.has('docker'));
    assert.ok(tokens.has('terraform'));
  });

  it('returns empty set for missing/invalid input', () => {
    assert.equal(buildResumeTokens(null).size, 0);
    assert.equal(buildResumeTokens(undefined).size, 0);
  });
});

describe('matchesKeyword', () => {
  it('matches via synonym (k8s in resume vs Kubernetes keyword)', () => {
    const resume = { skills: ['k8s'] };
    const tokens = buildResumeTokens(resume);
    const text = buildResumeText(resume);
    assert.equal(matchesKeyword(tokens, text, 'Kubernetes'), true);
  });

  it('substring match for a multiword keyword present in a bullet', () => {
    const resume = {
      experience: [
        { role: 'ML Engineer', responsibilities: ['Applied machine learning to ranking'] },
      ],
    };
    const tokens = buildResumeTokens(resume);
    const text = buildResumeText(resume);
    assert.equal(matchesKeyword(tokens, text, 'machine learning'), true);
  });

  it('fuzzy match for a typo (kubernets -> kubernetes)', () => {
    const resume = { skills: ['kubernets'] };
    const tokens = buildResumeTokens(resume);
    const text = buildResumeText(resume);
    assert.equal(matchesKeyword(tokens, text, 'kubernetes'), true);
  });

  it('does NOT fuzzy-match short tokens (no false positive)', () => {
    // resume has "go" (short), keyword "io" should NOT match via fuzzy.
    const resume = { skills: ['cat'] };
    const tokens = buildResumeTokens(resume);
    const text = buildResumeText(resume);
    assert.equal(matchesKeyword(tokens, text, 'car'), false);
  });
});

describe('coverage', () => {
  const resume = {
    skills: ['React', 'Node', 'k8s'],
    experience: [],
    projects: [],
  };

  it('matches React and Kubernetes(via k8s), misses GraphQL', () => {
    const result = coverage(resume, ['React', 'Kubernetes', 'GraphQL']);
    assert.deepEqual(result.matched.sort(), ['Kubernetes', 'React']);
    assert.deepEqual(result.missing, ['GraphQL']);
    assert.ok(Math.abs(result.ratio - 2 / 3) < 1e-9);
  });

  it('deduplicates by canonical form, keeping original strings', () => {
    const result = coverage(resume, ['k8s', 'Kubernetes', 'GraphQL']);
    // k8s and Kubernetes collapse to one unique canonical.
    assert.equal(result.matched.length + result.missing.length, 2);
    assert.ok(result.matched.includes('k8s'));
  });

  it('returns zero ratio and empty arrays for empty keywords', () => {
    const result = coverage(resume, []);
    assert.deepEqual(result, { ratio: 0, matched: [], missing: [] });
  });
});

describe('keywordMatchScore', () => {
  const resume = { skills: ['React', 'Node', 'k8s'] };

  it('returns null for empty/falsy keywords', () => {
    assert.equal(keywordMatchScore(resume, []), null);
    assert.equal(keywordMatchScore(resume, null), null);
    assert.equal(keywordMatchScore(resume, undefined), null);
  });

  it('returns an integer 0..100', () => {
    const score = keywordMatchScore(resume, ['React', 'Kubernetes', 'GraphQL']);
    assert.equal(Number.isInteger(score), true);
    assert.equal(score, 67); // round(2/3 * 100)
    assert.ok(score >= 0 && score <= 100);
  });
});
