// Pure, deterministic GitHub profile derivation.
// No DB, no network, no project imports. Plain ESM JavaScript.
//
// Input repo shape (normalized upstream):
// {
//   id, name, nameWithOwner, description, url,
//   isPrivate, isFork, isOwner,
//   stars, primaryLanguage,
//   languages: [{ name, bytes }],
//   pushedAt, // ISO date string
// }

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000; // 30.44-day months
const HALF_LIFE_MONTHS = 12;
const MAX_LANGUAGES = 15;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n, dp) {
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
}

/**
 * Exponential recency decay with a 12-month half-life.
 *
 * `0.5 ** (ageMonths / 12)` where ageMonths uses 30.44-day months.
 *
 * @param {string} pushedAt - ISO date string of the last push.
 * @param {number} [now] - Reference timestamp in ms (defaults to Date.now()).
 * @returns {number} Weight in [0, 1]; 0 for invalid/missing dates.
 */
export function recencyWeight(pushedAt, now = Date.now()) {
  const pushed = Date.parse(pushedAt);
  if (Number.isNaN(pushed)) return 0;
  const ageMonths = (now - pushed) / MS_PER_MONTH;
  return clamp(0.5 ** (ageMonths / HALF_LIFE_MONTHS), 0, 1);
}

/**
 * Derive a language/tech profile from a list of normalized repos.
 *
 * Each repo contributes `bytes * weight` per language, where
 * `weight = recencyWeight(pushedAt, now) * (1 + Math.log1p(stars))`.
 * Forks are skipped entirely.
 *
 * @param {Array<object>} repos - Normalized repos.
 * @param {{ now?: number }} [options] - Optional fixed timestamp for determinism.
 * @returns {{ languages: Array<{ name: string, score: number, percent: number }> }}
 *   Languages sorted by score desc, percent to 1 dp, capped at top 15.
 */
export function techProfile(repos, { now } = {}) {
  const items = Array.isArray(repos) ? repos : [];
  const langScore = new Map();

  for (const repo of items) {
    if (!repo || repo.isFork) continue;
    const weight =
      recencyWeight(repo.pushedAt, now ?? Date.now()) * (1 + Math.log1p(repo.stars || 0));
    if (weight <= 0) continue;

    const languages = Array.isArray(repo.languages) ? repo.languages : [];
    for (const lang of languages) {
      if (!lang || typeof lang.name !== 'string' || !(lang.bytes > 0)) continue;
      langScore.set(lang.name, (langScore.get(lang.name) || 0) + lang.bytes * weight);
    }
  }

  const totalScore = [...langScore.values()].reduce((a, b) => a + b, 0);
  if (totalScore <= 0) return { languages: [] };

  const languages = [...langScore.entries()]
    .map(([name, score]) => ({ name, score, percent: round((score / totalScore) * 100, 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LANGUAGES);

  return { languages };
}

/**
 * Rank non-fork repos by import-worthiness.
 *
 * Score per repo:
 *   2.0 * log1p(stars)
 * + 3.0 * recencyWeight(pushedAt, now)
 * + 1.0 * (isOwner ? 1 : 0)
 * + 0.5 * (non-empty description ? 1 : 0)
 *
 * @param {Array<object>} repos - Normalized repos (not mutated).
 * @param {{ now?: number }} [options] - Optional fixed timestamp for determinism.
 * @returns {Array<object>} New array of `{ ...repo, rank }` sorted by rank desc
 *   (stable for ties: input order preserved), rank rounded to 3 dp.
 */
export function rankImportable(repos, { now } = {}) {
  const items = Array.isArray(repos) ? repos : [];
  return items
    .filter((repo) => repo && !repo.isFork)
    .map((repo) => {
      const score =
        2.0 * Math.log1p(repo.stars || 0) +
        3.0 * recencyWeight(repo.pushedAt, now ?? Date.now()) +
        1.0 * (repo.isOwner ? 1 : 0) +
        0.5 * (repo.description?.trim() ? 1 : 0);
      return { ...repo, rank: round(score, 3) };
    })
    .sort((a, b) => b.rank - a.rank); // Array#sort is stable, ties keep input order
}

/**
 * Remove skills already present in an existing list, case-insensitively.
 *
 * @param {Array<string>} suggested - Candidate skills (original casing kept).
 * @param {Array<string>} existing - Skills the user already has.
 * @returns {Array<string>} Suggested skills minus existing ones, order
 *   preserved and internally deduped (first occurrence wins).
 */
export function dedupeSkills(suggested, existing) {
  const existingSet = new Set(
    (Array.isArray(existing) ? existing : [])
      .filter((s) => typeof s === 'string')
      .map((s) => s.trim().toLowerCase())
  );

  const seen = new Set();
  const result = [];
  for (const skill of Array.isArray(suggested) ? suggested : []) {
    if (typeof skill !== 'string') continue;
    const key = skill.trim().toLowerCase();
    if (key.length === 0 || existingSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(skill);
  }
  return result;
}
