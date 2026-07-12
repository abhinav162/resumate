import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectBullets,
  metricsDensityScore,
  actionVerbScore,
  readabilityScore,
  formattingScore,
  computeDeterministic,
  weightedComposite,
  WEIGHTS,
} from '../src/lib/scoring/rubric.js';

const strongResume = {
  contact: { name: 'Jane Doe', email: 'jane@example.com', phone: '123' },
  summary: 'Senior engineer with 8 years of experience building scalable backend systems.',
  skills: ['JavaScript', 'Node.js', 'SQL'],
  experience: [
    {
      role: 'Staff Engineer',
      company: 'Acme',
      responsibilities: [
        'Led a team of 6 engineers and reduced p95 latency by 40% across core services.',
        'Designed an event-driven pipeline processing 2M events per day with 99.9% uptime.',
        'Automated deployments, cutting release time from 3 hours to 15 minutes.',
      ],
    },
  ],
  projects: [
    {
      name: 'Side Project',
      description: ['Built a CLI tool used by 5k developers, improving build speed by 3x.'],
    },
  ],
  education: [{ degree: 'BS CS', institution: 'State U', graduationDate: '2016' }],
};

const weakResume = {
  contact: { name: 'John', email: 'john@example.com' },
  summary: 'Engineer.',
  skills: ['stuff'],
  experience: [
    {
      role: 'Dev',
      company: 'Corp',
      responsibilities: [
        'Responsible for things.',
        'Worked on code.',
        'Worked on more code.',
      ],
    },
  ],
  projects: [],
  education: [{ degree: 'BS', institution: 'U' }],
};

describe('collectBullets', () => {
  it('indexes ids correctly across sections', () => {
    const data = {
      summary: 'A summary line.',
      experience: [{ responsibilities: ['exp bullet one'] }],
      projects: [{ description: ['proj zero', 'proj one'] }],
    };
    const bullets = collectBullets(data);
    const ids = bullets.map((b) => b.id);
    assert.ok(ids.includes('experience-0-0'));
    assert.ok(ids.includes('projects-0-0'));
    assert.ok(ids.includes('projects-0-1'));
    assert.ok(ids.includes('summary-0-0'));

    const proj1 = bullets.find((b) => b.id === 'projects-0-1');
    assert.equal(proj1.section, 'projects');
    assert.equal(proj1.text, 'proj one');
  });

  it('handles responsibilities as a string and drops empty lines', () => {
    const data = {
      experience: [{ responsibilities: 'first line\n\n   \nsecond line' }],
    };
    const bullets = collectBullets(data);
    assert.equal(bullets.length, 2);
    assert.equal(bullets[0].id, 'experience-0-0');
    assert.equal(bullets[0].text, 'first line');
    assert.equal(bullets[1].id, 'experience-0-1');
    assert.equal(bullets[1].text, 'second line');
  });

  it('skips empty/whitespace bullets and missing arrays', () => {
    const data = {
      experience: [{ responsibilities: ['   ', '', 'real bullet'] }],
      projects: [{}],
    };
    const bullets = collectBullets(data);
    assert.equal(bullets.length, 1);
    assert.equal(bullets[0].text, 'real bullet');
  });

  it('omits summary bullet when summary is empty', () => {
    const bullets = collectBullets({ summary: '   ', experience: [] });
    assert.equal(bullets.length, 0);
  });
});

describe('strong vs weak resume', () => {
  const strong = computeDeterministic(strongResume);
  const weak = computeDeterministic(weakResume);

  it('strong scores higher on metrics', () => {
    assert.ok(strong.metrics > weak.metrics, `${strong.metrics} > ${weak.metrics}`);
  });

  it('strong scores higher on verbs', () => {
    assert.ok(strong.verbs > weak.verbs, `${strong.verbs} > ${weak.verbs}`);
  });

  it('strong scores higher on readability', () => {
    assert.ok(strong.readability > weak.readability, `${strong.readability} > ${weak.readability}`);
  });

  it('all sub-scores are in 0..100', () => {
    for (const key of Object.keys(strong)) {
      assert.ok(strong[key] >= 0 && strong[key] <= 100);
      assert.ok(weak[key] >= 0 && weak[key] <= 100);
    }
  });
});

describe('metricsDensityScore', () => {
  it('returns 0 with no experience/projects bullets', () => {
    const bullets = collectBullets({ summary: 'Has a metric like 50% here.' });
    assert.equal(metricsDensityScore(bullets), 0);
  });

  it('detects various metric formats', () => {
    const bullets = collectBullets({
      experience: [
        {
          responsibilities: [
            'Increased revenue by $2M',
            'Improved speed 3x',
            'Served 10k users',
            'Made things nice',
          ],
        },
      ],
    });
    assert.equal(metricsDensityScore(bullets), 75);
  });
});

describe('actionVerbScore', () => {
  it('returns 0 with no bullets', () => {
    assert.equal(actionVerbScore([]), 0);
  });
});

describe('readabilityScore', () => {
  it('returns 0 with no bullets', () => {
    assert.equal(readabilityScore([]), 0);
  });
});

describe('formattingScore', () => {
  it('rewards a complete resume', () => {
    assert.ok(formattingScore(strongResume) > formattingScore(weakResume) - 1);
    assert.ok(formattingScore(strongResume) >= 80);
  });

  it('penalizes a near-empty resume', () => {
    assert.ok(formattingScore({}) < 30);
  });
});

describe('weightedComposite', () => {
  it('normalizes when keywordMatch is absent', () => {
    const breakdown = {
      metrics: 80,
      verbs: 80,
      readability: 80,
      formatting: 80,
      impact: 80,
      clarity: 80,
    };
    assert.equal(weightedComposite(breakdown), 80);
  });

  it('all-100 returns 100 and all-0 returns 0', () => {
    assert.equal(weightedComposite({ metrics: 100, verbs: 100, formatting: 100 }), 100);
    assert.equal(weightedComposite({ metrics: 0, verbs: 0, formatting: 0 }), 0);
  });

  it('ignores unknown and null/NaN keys', () => {
    const a = weightedComposite({ metrics: 50, verbs: 50 });
    const b = weightedComposite({
      metrics: 50,
      verbs: 50,
      bogus: 999,
      keywordMatch: null,
      impact: undefined,
      clarity: NaN,
    });
    assert.equal(a, b);
    assert.equal(a, 50);
  });

  it('returns an integer', () => {
    const r = weightedComposite({ metrics: 77, verbs: 33, formatting: 91 });
    assert.equal(Number.isInteger(r), true);
  });

  it('returns 0 for empty/invalid breakdown', () => {
    assert.equal(weightedComposite({}), 0);
    assert.equal(weightedComposite(null), 0);
  });

  it('WEIGHTS has expected keys', () => {
    assert.deepEqual(
      Object.keys(WEIGHTS).sort(),
      ['clarity', 'formatting', 'impact', 'keywordMatch', 'metrics', 'readability', 'verbs'].sort()
    );
  });
});
