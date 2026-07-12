import api from './api';
import type { ApiResponse } from '../types';

/**
 * GitHub integration API client.
 *
 * Backend routes live under /github (the axios baseURL already includes /api)
 * and use the standard `{ success, data }` envelope.
 */

export type GithubRepo = {
  id: string;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  isPrivate: boolean;
  stars: number;
  primaryLanguage: string | null;
  pushedAt: string;
  /** Importance rank assigned by the backend (lower = more relevant). */
  rank?: number;
  /** True when a cached analysis already exists — re-analyzing is free. */
  analyzed?: boolean;
};

export type GithubTechProfile = {
  languages: { name: string; score: number; percent: number }[];
};

export type GithubStatus = {
  connected: boolean;
  login: string | null;
  freeReposLeft: number;
};

export type RepoSummary = {
  repoId: string;
  repoName: string;
  cached?: boolean;
  bullets: string[];
  project: { name: string; description: string[]; url?: string; repoUrl?: string };
};

export type AnalyzeResult = {
  summaries: RepoSummary[];
  charged: number;
  freeUsed: number;
  freeLeft: number;
};

export type GithubReposResult = {
  login: string;
  techProfile: GithubTechProfile;
  importable: GithubRepo[];
  freeReposLeft: number;
};

export const githubApi = {
  getStatus: async (): Promise<GithubStatus> => {
    const response = await api.get<ApiResponse<GithubStatus>>('/github/status');
    if (!response.data.data) throw new Error('Failed to fetch GitHub status');
    return response.data.data;
  },

  getConnectUrl: async (): Promise<{ url: string }> => {
    const response = await api.get<ApiResponse<{ url: string }>>('/github/connect');
    if (!response.data.data) throw new Error('Failed to fetch GitHub connect URL');
    return response.data.data;
  },

  disconnect: async (): Promise<void> => {
    await api.post('/github/disconnect');
  },

  getRepos: async (refresh?: boolean): Promise<GithubReposResult> => {
    const url = refresh ? '/github/repos?refresh=true' : '/github/repos';
    const response = await api.get<ApiResponse<GithubReposResult>>(url);
    if (!response.data.data) throw new Error('Failed to fetch GitHub repos');
    return response.data.data;
  },

  analyzeRepos: async (repoIds: string[]): Promise<AnalyzeResult> => {
    const response = await api.post<ApiResponse<AnalyzeResult>>('/github/analyze', { repoIds });
    if (!response.data.data) throw new Error('Failed to analyze repos');
    return response.data.data;
  },
};
