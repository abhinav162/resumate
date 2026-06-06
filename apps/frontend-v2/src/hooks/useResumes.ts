import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resumesApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { ResumeData } from '../types';

/**
 * Resume queries & mutations.
 *
 * These wrap the existing `resumesApi` transport (which keeps all backend
 * field-mapping logic) and add caching, dedup, and cache invalidation.
 */

/** Raw list shape used by dashboard cards (id/name/score/...). */
export function useResumes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.resumes.all,
    queryFn: resumesApi.getAll,
    enabled: options?.enabled ?? true,
  });
}

/** Editor-shaped single resume. */
export function useResume(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.resumes.detail(id ?? ''),
    queryFn: () => resumesApi.getResume(id as string),
    enabled: !!id,
  });
}

export function useCreateResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ResumeData) => resumesApi.createResume(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}

export function useUpdateResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResumeData> }) =>
      resumesApi.updateResume(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.resumes.all });
      qc.invalidateQueries({ queryKey: queryKeys.resumes.detail(id) });
    },
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resumesApi.deleteResume(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.resumes.all });
      // Deleting a base resume cascades to its tailored copies.
      qc.invalidateQueries({ queryKey: ['tailored-resumes'] });
    },
  });
}

export function useScoreResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: string) => resumesApi.scoreResume(resumeId),
    onSuccess: (_res, resumeId) => {
      // A new score changes both the list card and the detail view.
      qc.invalidateQueries({ queryKey: queryKeys.resumes.all });
      qc.invalidateQueries({ queryKey: queryKeys.resumes.detail(resumeId) });
    },
  });
}

export function useUploadPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => resumesApi.uploadPdf(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.resumes.all });
    },
  });
}
