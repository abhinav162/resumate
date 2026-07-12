// Pure, deterministic JD-keyword matching/coverage module.
// No database, no network, no LLM. Only normalizes and matches a given list
// of keywords against a resume data object.

/**
 * Normalize a token: lowercase, trim, collapse internal whitespace, and strip
 * surrounding punctuation. Internal dots/+/# are preserved (e.g. "node.js",
 * "c++", "c#").
 * @param {string} s
 * @returns {string}
 */
export function normalizeToken(s) {
  if (s == null) return '';
  let t = String(s).toLowerCase().trim();
  t = t.replace(/\s+/g, ' ');
  // Strip surrounding punctuation but keep internal . + #.
  t = t.replace(/^[^a-z0-9.+#]+/, '');
  t = t.replace(/[^a-z0-9.+#]+$/, '');
  return t;
}

/**
 * Canonical term -> array of aliases. Common modern-tech synonyms.
 * Keep in sync with apps/frontend-v2/src/lib/keywordMatch.ts.
 */
export const SYNONYMS = {
  // Languages
  javascript: ['js'],
  typescript: ['ts'],
  python: ['py'],
  golang: ['go', 'go lang'],
  'c++': ['cpp', 'cplusplus'],
  'c#': ['csharp', 'c sharp'],
  '.net': ['dotnet', 'dot net'],
  // Frontend
  react: ['react.js', 'reactjs'],
  'react native': ['react-native', 'reactnative'],
  'next.js': ['nextjs', 'next js'],
  'vue.js': ['vue', 'vuejs'],
  angular: ['angular.js', 'angularjs'],
  'tailwind css': ['tailwind', 'tailwindcss'],
  // Backend frameworks / runtimes
  'node.js': ['node', 'nodejs'],
  'express.js': ['express', 'expressjs'],
  'ruby on rails': ['rails', 'ror'],
  'spring boot': ['springboot'],
  // Data stores
  postgresql: ['postgres', 'psql'],
  mongodb: ['mongo'],
  elasticsearch: ['elastic search'],
  dynamodb: ['dynamo'],
  // Messaging / streaming
  kafka: ['apache kafka'],
  rabbitmq: ['rabbit mq'],
  // Cloud
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp', 'google cloud'],
  'microsoft azure': ['azure'],
  // DevOps / infra
  kubernetes: ['k8s', 'kube'],
  docker: ['dockerized'],
  'github actions': ['gh actions'],
  'gitlab ci': ['gitlab-ci'],
  'ci/cd': ['cicd', 'ci cd'],
  // APIs
  'rest api': ['rest', 'restful', 'restful api'],
  graphql: ['gql'],
  websockets: ['websocket'],
  // Data / ML / AI
  'machine learning': ['ml'],
  'deep learning': ['dl'],
  'artificial intelligence': ['ai'],
  'natural language processing': ['nlp'],
  'large language models': ['llm', 'llms'],
  'computer vision': ['cv'],
  pytorch: ['torch'],
  'scikit-learn': ['sklearn', 'scikit learn'],
  'apache spark': ['spark', 'pyspark'],
  'apache airflow': ['airflow'],
  'power bi': ['powerbi'],
  // Practices / architecture
  microservices: ['micro services', 'microservice'],
  'test-driven development': ['tdd'],
};

// Build a bidirectional lookup: any normalized alias OR canonical -> canonical.
const SYNONYM_LOOKUP = (() => {
  const map = new Map();
  for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
    const normCanonical = normalizeToken(canonical);
    map.set(normCanonical, normCanonical);
    for (const alias of aliases) {
      map.set(normalizeToken(alias), normCanonical);
    }
  }
  return map;
})();

/**
 * Normalize then map through the synonym lookup to the canonical term.
 * Returns the normalized token if no synonym exists.
 * @param {string} token
 * @returns {string}
 */
export function canonicalize(token) {
  const norm = normalizeToken(token);
  return SYNONYM_LOOKUP.get(norm) ?? norm;
}

/**
 * Coerce a responsibilities/description field that may be a string (split on
 * newlines), an array, or missing.
 * @param {*} field
 * @returns {string[]}
 */
function toLines(field) {
  if (Array.isArray(field)) return field.filter((x) => x != null).map(String);
  if (typeof field === 'string') return field.split('\n');
  return [];
}

// Split text into word-ish tokens, keeping internal . + # (e.g. node.js, c++).
function splitWords(text) {
  if (text == null) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9.+#]+/)
    .map((w) => normalizeToken(w))
    .filter((w) => w.length > 0);
}

/**
 * Collect canonicalized tokens from a resume data object.
 * Includes individual words from skills, experience responsibilities & roles,
 * project descriptions & names, and the summary; plus the canonicalized
 * multi-word skill entries themselves (so multiword keywords can match).
 * @param {object} resumeData
 * @returns {Set<string>}
 */
export function buildResumeTokens(resumeData) {
  const tokens = new Set();
  if (!resumeData || typeof resumeData !== 'object') return tokens;

  const addText = (text) => {
    for (const w of splitWords(text)) {
      tokens.add(canonicalize(w));
    }
  };

  // skills[]: add both the whole (multi-word) canonicalized entry and words.
  const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  for (const skill of skills) {
    if (skill == null) continue;
    tokens.add(canonicalize(skill));
    addText(skill);
  }

  // experience: roles + responsibilities.
  const experience = Array.isArray(resumeData.experience)
    ? resumeData.experience
    : [];
  for (const exp of experience) {
    if (!exp || typeof exp !== 'object') continue;
    addText(exp.role);
    for (const line of toLines(exp.responsibilities)) addText(line);
  }

  // projects: names + descriptions.
  const projects = Array.isArray(resumeData.projects) ? resumeData.projects : [];
  for (const proj of projects) {
    if (!proj || typeof proj !== 'object') continue;
    addText(proj.name);
    for (const line of toLines(proj.description)) addText(line);
  }

  // summary.
  addText(resumeData.summary);

  return tokens;
}

/**
 * Build a single lowercased text blob of all relevant resume content, used for
 * substring matching of multiword keywords.
 * @param {object} resumeData
 * @returns {string}
 */
export function buildResumeText(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return '';
  const parts = [];

  const skills = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  for (const skill of skills) if (skill != null) parts.push(String(skill));

  const experience = Array.isArray(resumeData.experience)
    ? resumeData.experience
    : [];
  for (const exp of experience) {
    if (!exp || typeof exp !== 'object') continue;
    if (exp.role != null) parts.push(String(exp.role));
    parts.push(...toLines(exp.responsibilities));
  }

  const projects = Array.isArray(resumeData.projects) ? resumeData.projects : [];
  for (const proj of projects) {
    if (!proj || typeof proj !== 'object') continue;
    if (proj.name != null) parts.push(String(proj.name));
    parts.push(...toLines(proj.description));
  }

  if (resumeData.summary != null) parts.push(String(resumeData.summary));

  return parts.join(' \n ').toLowerCase();
}

// Inline Levenshtein distance.
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

function similarityRatio(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Determine whether a keyword is present in the resume.
 * Matches if: (a) the token set contains the canonical form, OR
 * (b) the resume text includes the canonical as a word-ish substring, OR
 * (c) some resume token is within a Levenshtein ratio >= 0.9 of the canonical
 *     (fuzzy is skipped for very short tokens, length <= 3).
 * @param {Set<string>} resumeTokens
 * @param {string} resumeText lowercased full resume string
 * @param {string} keyword
 * @returns {boolean}
 */
export function matchesKeyword(resumeTokens, resumeText, keyword) {
  const canonical = canonicalize(keyword);
  if (!canonical) return false;

  // (a) exact canonical token present.
  if (resumeTokens && resumeTokens.has(canonical)) return true;

  // (b) substring with word-ish boundaries (good for multiword keywords).
  if (resumeText) {
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRe = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`);
    if (boundaryRe.test(resumeText)) return true;
  }

  // (c) fuzzy match, skipping very short canonicals to avoid false positives.
  if (canonical.length > 3 && resumeTokens) {
    for (const token of resumeTokens) {
      if (token.length <= 3) continue;
      if (similarityRatio(token, canonical) >= 0.9) return true;
    }
  }

  return false;
}

/**
 * Compute keyword coverage for a resume.
 * Keywords are deduplicated by canonical form; matched/missing contain the
 * ORIGINAL keyword strings. ratio = matched / totalUnique (0 if none).
 * @param {object} resumeData
 * @param {string[]} keywords
 * @returns {{ ratio: number, matched: string[], missing: string[] }}
 */
export function coverage(resumeData, keywords) {
  const list = Array.isArray(keywords) ? keywords : [];

  // Deduplicate by canonical form, keeping the first original spelling.
  const seen = new Set();
  const unique = [];
  for (const kw of list) {
    if (kw == null) continue;
    const canonical = canonicalize(kw);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    unique.push(kw);
  }

  if (unique.length === 0) {
    return { ratio: 0, matched: [], missing: [] };
  }

  const resumeTokens = buildResumeTokens(resumeData);
  const resumeText = buildResumeText(resumeData);

  const matched = [];
  const missing = [];
  for (const kw of unique) {
    if (matchesKeyword(resumeTokens, resumeText, kw)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  return {
    ratio: matched.length / unique.length,
    matched,
    missing,
  };
}

/**
 * Integer 0..100 keyword match score. Returns null when keywords is
 * empty/falsy (caller treats null as "no JD").
 * @param {object} resumeData
 * @param {string[]} keywords
 * @returns {number|null}
 */
export function keywordMatchScore(resumeData, keywords) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return null;
  }
  const { ratio } = coverage(resumeData, keywords);
  return Math.round(ratio * 100);
}
