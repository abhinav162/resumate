import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tailoredResumesApi } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import type { ResumeData, TailoredResume } from '../types';

/**
 * Tailored-resume queries & mutations.
 */

export function useTailoredResumes(baseResumeId?: string) {
  return useQuery({
    queryKey: queryKeys.tailoredResumes.list(baseResumeId),
    queryFn: () => tailoredResumesApi.getTailoredResumes(baseResumeId),
  });
}

export function useTailoredResume(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tailoredResumes.detail(id ?? ''),
    queryFn: () => tailoredResumesApi.getTailoredResume(id as string),
    enabled: !!id,
  });
}

/** Editor-shaped loader for the tailored editor route. */
export function useTailoredEditorData(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tailoredResumes.editor(id ?? ''),
    queryFn: () => tailoredResumesApi.getEditorData(id as string),
    enabled: !!id,
  });
}

export function useUpdateTailoredResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TailoredResume> }) =>
      tailoredResumesApi.updateTailoredResume(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.tailoredResumes.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.tailoredResumes.list() });
    },
  });
}

export function useSaveTailoredEditorData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ResumeData> }) =>
      tailoredResumesApi.saveEditorData(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.tailoredResumes.editor(id) });
      qc.invalidateQueries({ queryKey: queryKeys.tailoredResumes.detail(id) });
    },
  });
}

export function useDeleteTailoredResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tailoredResumesApi.deleteTailoredResume(id),
    onSuccess: () => {
      // Invalidate every tailored-resume list (scoped or not).
      qc.invalidateQueries({ queryKey: ['tailored-resumes'] });
    },
  });
}
