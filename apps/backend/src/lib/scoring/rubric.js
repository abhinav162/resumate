// Pure, deterministic resume-scoring rubric.
// No DB, no network, no LLM, no project imports. Plain ESM JavaScript.

const WEAK_VERBS = new Set([
  'responsible',
  'worked',
  'helped',
  'assisted',
  'participated',
  'involved',
  'handled',
  'did',
  'made',
  'used',
]);

const STRONG_VERBS = new Set([
  'led',
  'built',
  'designed',
  'engineered',
  'launched',
  'reduced',
  'increased',
  'improved',
  'architected',
  'automated',
  'shipped',
  'optimized',
  'drove',
  'delivered',
  'created',
  'implemented',
  'scaled',
]);

// Metric detection: digits, percentages, currency, multipliers, magnitude words.
const METRIC_PATTERNS = [
  /\d+%/, // percentage
  /[$€£¥₹]\s?\d/, // currency
  /\b\d+(\.\d+)?\s?[x×]\b/i, // multiplier 3x / 10×
  /\b\d+(\.\d+)?\s?(k|m|bn|million|billion|thousand)\b/i, // magnitude words
  /\d/, // any digit (fallback)
];

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Normalize a `responsibilities` / `description` value into an array of strings.
function normalizeBulletList(value) {
  let items;
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === 'string') {
    items = value.split('\n');
  } else {
    return [];
  }
  return items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function collectBullets(resumeData) {
  const data = resumeData || {};
  const bullets = [];

  const experience = Array.isArray(data.experience) ? data.experience : [];
  experience.forEach((exp, i) => {
    const texts = normalizeBulletList(exp && exp.responsibilities);
    texts.forEach((text, j) => {
      bullets.push({ id: `experience-${i}-${j}`, text, section: 'experience' });
    });
  });

  const projects = Array.isArray(data.projects) ? data.projects : [];
  projects.forEach((proj, i) => {
    const texts = normalizeBulletList(proj && proj.description);
    texts.forEach((text, j) => {
      bullets.push({ id: `projects-${i}-${j}`, text, section: 'projects' });
    });
  });

  if (typeof data.summary === 'string' && data.summary.trim().length > 0) {
    bullets.push({ id: 'summary-0-0', text: data.summary.trim(), section: 'summary' });
  }

  return bullets;
}

// Bullets used by content scorers: experience + projects only (no summary).
function contentBullets(bullets) {
  return bullets.filter((b) => b.section === 'experience' || b.section === 'projects');
}

function hasMetric(text) {
  return METRIC_PATTERNS.some((re) => re.test(text));
}

export function metricsDensityScore(bullets) {
  const items = contentBullets(bullets);
  if (items.length === 0) return 0;
  const withMetric = items.filter((b) => hasMetric(b.text)).length;
  return Math.round((withMetric / items.length) * 100);
}

function leadingVerb(text) {
  const match = text.trim().match(/^[A-Za-z'-]+/);
  return match ? match[0].toLowerCase() : '';
}

export function actionVerbScore(bullets) {
  const items = contentBullets(bullets);
  if (items.length === 0) return 0;

  const verbs = items.map((b) => leadingVerb(b.text));
  const nonWeak = verbs.filter((v) => v.length > 0 && !WEAK_VERBS.has(v)).length;
  const nonWeakRatio = nonWeak / items.length;
  const variety = new Set(verbs.filter((v) => v.length > 0)).size / items.length;

  const score = 0.6 * nonWeakRatio + 0.4 * variety;
  return Math.round(clamp(score, 0, 1) * 100);
}

function bulletReadability(len) {
  // Reward 60-200 char band; ramp up from 40, ramp down toward 280 hard cap.
  if (len >= 60 && len <= 200) return 1;
  if (len < 40) return clamp(len / 40, 0, 1) * 0.5; // very short, heavily penalized
  if (len < 60) {
    // 40..60 -> 0.5..1
    return 0.5 + ((len - 40) / 20) * 0.5;
  }
  // len > 200
  if (len <= 280) {
    // 200..280 -> 1..0.4
    return 1 - ((len - 200) / 80) * 0.6;
  }
  return 0.2; // beyond hard cap
}

export function readabilityScore(bullets) {
  const items = contentBullets(bullets);
  if (items.length === 0) return 0;
  const total = items.reduce((sum, b) => sum + bulletReadability(b.text.length), 0);
  return Math.round((total / items.length) * 100);
}

export function formattingScore(resumeData) {
  const data = resumeData || {};
  const contact = data.contact || {};
  const experience = Array.isArray(data.experience) ? data.experience : [];
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const education = Array.isArray(data.education) ? data.education : [];

  // Presence/completeness checks: 6 weighted to 60 points.
  const presence = [
    typeof data.summary === 'string' && data.summary.trim().length > 0,
    experience.length >= 1,
    skills.length >= 1,
    education.length >= 1,
    typeof contact.name === 'string' && contact.name.trim().length > 0,
    typeof contact.email === 'string' && contact.email.trim().length > 0,
  ];
  const presenceScore = (presence.filter(Boolean).length / presence.length) * 60;

  // Bullet-count quality per experience: 40 points.
  let bulletScore;
  if (experience.length === 0) {
    bulletScore = 0;
  } else {
    const per = experience.map((exp) => {
      const n = normalizeBulletList(exp && exp.responsibilities).length;
      if (n >= 2 && n <= 5) return 1;
      if (n === 0) return 0;
      if (n > 7) return 0.3;
      if (n === 1) return 0.5;
      return 0.7; // 6 or 7
    });
    bulletScore = (per.reduce((a, b) => a + b, 0) / per.length) * 40;
  }

  return Math.round(clamp(presenceScore + bulletScore, 0, 100));
}

export function computeDeterministic(resumeData) {
  const bullets = collectBullets(resumeData);
  return {
    metrics: metricsDensityScore(bullets),
    verbs: actionVerbScore(bullets),
    readability: readabilityScore(bullets),
    formatting: formattingScore(resumeData),
  };
}

export const WEIGHTS = {
  metrics: 0.22,
  verbs: 0.15,
  readability: 0.13,
  formatting: 0.10,
  keywordMatch: 0.20,
  impact: 0.12,
  clarity: 0.08,
};

export function weightedComposite(breakdown) {
  const b = breakdown || {};
  let weighted = 0;
  let totalWeight = 0;

  for (const key of Object.keys(WEIGHTS)) {
    if (!(key in b)) continue;
    const value = b[key];
    if (value === null || value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
      continue;
    }
    weighted += WEIGHTS[key] * value;
    totalWeight += WEIGHTS[key];
  }

  if (totalWeight === 0) return 0;
  return clamp(Math.round(weighted / totalWeight), 0, 100);
}
