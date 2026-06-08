import { createHash } from 'crypto';

/**
 * Deterministic JSON serialization with recursively sorted object keys, so the
 * same logical content always produces the same string regardless of property
 * insertion order. Used to key the score cache by resume content.
 */
export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 of the stable serialization — the score-cache key for a resume. */
export function contentHash(resumeData) {
  return createHash('sha256').update(stableStringify(resumeData)).digest('hex');
}
