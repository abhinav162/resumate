/**
 * Centralized React Query key factory.
 *
 * Using a single source of truth for query keys keeps cache reads, writes, and
 * invalidations in sync — a typo here is caught once instead of silently
 * producing a cache miss at a call site.
 */
export const queryKeys = {
  resumes: {
    all: ['resumes'] as const,
    detail: (id: string) => ['resumes', id] as const,
  },
  tailoredResumes: {
    // baseResumeId is part of the key so lists scoped to a base resume cache
    // independently from the unscoped list.
    list: (baseResumeId?: string) => ['tailored-resumes', baseResumeId ?? 'all'] as const,
    detail: (id: string) => ['tailored-resumes', 'detail', id] as const,
    editor: (id: string) => ['tailored-resumes', 'editor', id] as const,
  },
  tailor: {
    status: (id: string) => ['tailor-status', id] as const,
  },
  credits: {
    balance: ['credits', 'balance'] as const,
    packs: ['credits', 'packs'] as const,
  },
} as const;
