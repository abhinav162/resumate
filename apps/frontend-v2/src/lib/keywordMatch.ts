import type { ResumeData } from '../types';

/**
 * Lightweight client-side keyword matcher for the live "missing JD keywords"
 * panel. Mirrors the backend's synonym handling (apps/backend/src/lib/scoring/
 * keywords.js) but stays intentionally simple: presence is checked against the
 * resume's text so it can recompute instantly as the user keeps/discards
 * tailored changes. The backend remains the source of truth for the scored
 * keywordMatch value.
 */

// Keep in sync with apps/backend/src/lib/scoring/keywords.js.
const SYNONYMS: Record<string, string[]> = {
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

const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
    map[canonical] = canonical;
    for (const alias of aliases) map[alias] = canonical;
  }
  return map;
})();

export function normalize(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9.+#]+|[^a-z0-9.+#]+$/g, '');
}

export function canonical(token: string): string {
  const n = normalize(token);
  return ALIAS_TO_CANONICAL[n] ?? n;
}

// Match a term in the (lowercased) blob. Terms with special chars (multiword,
// dotted like "node.js") use substring; purely alphanumeric terms use a
// word boundary to avoid false positives (e.g. "go" inside "good").
function containsTerm(blob: string, term: string): boolean {
  if (!term) return false;
  if (/[^a-z0-9]/.test(term)) return blob.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(blob);
}

function formsFor(keyword: string): string[] {
  const c = canonical(keyword);
  const forms = new Set<string>([c, normalize(keyword)]);
  for (const alias of SYNONYMS[c] ?? []) forms.add(alias);
  return [...forms].filter(Boolean);
}

export type KeywordCoverage = { matched: string[]; missing: string[]; ratio: number };

/** Coverage of `keywords` within `text`, deduped by canonical form. */
export function keywordCoverage(text: string, keywords: string[]): KeywordCoverage {
  const blob = ` ${String(text ?? '').toLowerCase()} `;
  const seen = new Set<string>();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords ?? []) {
    const c = canonical(kw);
    if (seen.has(c)) continue;
    seen.add(c);
    const present = formsFor(kw).some((f) => containsTerm(blob, f));
    (present ? matched : missing).push(kw);
  }
  const total = matched.length + missing.length;
  return { matched, missing, ratio: total ? matched.length / total : 0 };
}

/** Flatten a resume into a single searchable text blob. */
export function resumeToText(data: ResumeData): string {
  const parts: string[] = [];
  if (data.summary) parts.push(data.summary);
  if (data.skills?.length) parts.push(data.skills.join(' '));
  for (const exp of data.experience ?? []) {
    parts.push(exp.role || '', exp.company || '', exp.description || '');
  }
  for (const proj of data.projects ?? []) {
    parts.push(proj.name || '');
    parts.push(Array.isArray(proj.description) ? proj.description.join(' ') : '');
  }
  return parts.join(' ');
}
