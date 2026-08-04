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
  /** Login of the owning user/org. Optional: stale cached responses may lack it. */
  ownerLogin?: string;
  /** Whether the repo belongs to a personal account or an organization. */
  ownerType?: 'User' | 'Organization';
  /** The user's commits to this repo in the last year (0 if none). */
  commitCount?: number;
  /** Connection (account) this repo was listed through (M2.11 multi-account). */
  connectionId?: number | null;
  /** Login of the connected account that listed this repo. */
  accountLogin?: string | null;
};

export type GithubTechProfile = {
  languages: { name: string; score: number; percent: number }[];
};

/** One connected GitHub account (a user can connect up to `maxAccounts`). */
export type GithubAccount = {
  id: number;
  login: string | null;
  /** Whether private repos are included in listings for this account. */
  includePrivate: boolean;
  connectedAt: string;
};

export type GithubStatus = {
  connected: boolean;
  /** Login of the first connected account (legacy mirror — see `accounts`). */
  login: string | null;
  freeReposLeft: number;
  /** Private-repo preference of the first account (legacy mirror). */
  includePrivate: boolean;
  /** All connected GitHub accounts, oldest first. */
  accounts: GithubAccount[];
  /** How many accounts can be connected at once. */
  maxAccounts: number;
  /** GitHub App slug for the "grant repo access" install deep-link, if configured. */
  appSlug: string | null;
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
  /** How many stale library entries were re-analyzed for free. */
  reanalyzed?: number;
  /** Repos that could not be analyzed (absent or empty when everything succeeded). */
  failed?: { repoId: string; repoName: string | null; code?: string }[];
};

/** One account (personal or organization) and the GitHub App's install state there. */
export type GithubOrgAccess = {
  login: string;
  type: 'User' | 'Organization';
  databaseId: number | null;
  status: 'installed' | 'suspended' | 'not_installed';
};

/** Org/installation access grouped under one connected account (M2.11). */
export type GithubOrgAccountAccess = {
  id: number;
  login: string | null;
  /** Error code (e.g. 'GITHUB_RECONNECT') when this account's org fetch failed. */
  error?: string | null;
  orgs: GithubOrgAccess[];
};

/** A stored library entry from a previous repo analysis. */
export type GithubSummaryEntry = {
  repoId: string;
  repoName: string;
  pushedAt: string;
  bullets: string[];
  project: { name: string; description: string[]; url?: string; repoUrl?: string };
  countedFree: boolean;
  createdAt: string;
  /** True when the repo has new pushes since this entry was generated. */
  stale: boolean;
  /** Resumes that already contain a project imported from this repo. */
  inResumes: { id: string; name: string }[];
  /** Login of the connected account the repo was analyzed through. */
  accountLogin: string | null;
};

/** Per-account fetch state returned alongside the repo list. */
export type GithubRepoAccountState = {
  id: number;
  login: string | null;
  /** Error code (e.g. 'GITHUB_RECONNECT') when this account's fetch failed —
   *  other accounts still contribute repos to `importable`. */
  error: string | null;
};

export type GithubReposResult = {
  login: string;
  techProfile: GithubTechProfile;
  importable: GithubRepo[];
  /** One entry per connected account so partial failures can be surfaced. */
  accounts: GithubRepoAccountState[];
  freeReposLeft: number;
};

export const githubApi = {
  getStatus: async (): Promise<GithubStatus> => {
    const response = await api.get<ApiResponse<GithubStatus>>('/github/status');
    if (!response.data.data) throw new Error('Failed to fetch GitHub status');
    return response.data.data;
  },

  /**
   * One flow for connect, "add account" and reconnect: GitHub authorizes
   * whichever account the browser is signed into — reconnecting an existing
   * account rotates its token, a new account adds a connection.
   */
  getConnectUrl: async (): Promise<{ url: string }> => {
    const response = await api.get<ApiResponse<{ url: string }>>('/github/connect');
    if (!response.data.data) throw new Error('Failed to fetch GitHub connect URL');
    return response.data.data;
  },

  /** Disconnect one account by connection id, or all accounts when omitted. */
  disconnect: async (connectionId?: number): Promise<void> => {
    await api.post('/github/disconnect', connectionId !== undefined ? { connectionId } : {});
  },

  /** Set the private-repo preference for one account, or all when omitted. */
  setPreferences: async (includePrivate: boolean, connectionId?: number): Promise<void> => {
    await api.post('/github/preferences', {
      includePrivate,
      ...(connectionId !== undefined ? { connectionId } : {}),
    });
  },

  getRepos: async (refresh?: boolean): Promise<GithubReposResult> => {
    const url = refresh ? '/github/repos?refresh=true' : '/github/repos';
    const response = await api.get<ApiResponse<GithubReposResult>>(url);
    if (!response.data.data) throw new Error('Failed to fetch GitHub repos');
    return response.data.data;
  },

  getOrgs: async (): Promise<{ accounts: GithubOrgAccountAccess[]; appSlug: string | null }> => {
    const response = await api.get<
      ApiResponse<{ accounts: GithubOrgAccountAccess[]; appSlug: string | null }>
    >('/github/orgs');
    if (!response.data.data) throw new Error('Failed to fetch GitHub organizations');
    return response.data.data;
  },

  getSummaries: async (): Promise<{ summaries: GithubSummaryEntry[]; freeReposLeft: number }> => {
    const response = await api.get<
      ApiResponse<{ summaries: GithubSummaryEntry[]; freeReposLeft: number }>
    >('/github/summaries');
    if (!response.data.data) throw new Error('Failed to fetch GitHub summaries');
    return response.data.data;
  },

  analyzeRepos: async (repoIds: string[]): Promise<AnalyzeResult> => {
    const response = await api.post<ApiResponse<AnalyzeResult>>('/github/analyze', { repoIds });
    if (!response.data.data) throw new Error('Failed to analyze repos');
    return response.data.data;
  },
};
