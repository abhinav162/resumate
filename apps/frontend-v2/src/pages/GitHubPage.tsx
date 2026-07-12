import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Github, RefreshCw } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GitHubConnectCard } from '../components/features/github/GitHubConnectCard';
import {
  RepoPickerList,
  RepoPricingSummary,
} from '../components/features/github/RepoPickerList';
import { timeAgo } from '../components/features/github/repoPricing';
import { githubApi, type GithubSummaryEntry } from '../lib/githubApi';
import { resumesApi } from '../lib/api';
import { useResumes, useUpdateResume } from '../hooks/useResumes';

/** Raw list shape from useResumes — only what the picker needs. */
type ResumeListItem = { id: string; name: string };

/**
 * /github — the GitHub project library.
 *
 * Library section: previously analyzed repos with their generated bullets;
 * stale entries offer a free re-analysis, and each entry can be appended to
 * any existing resume. Browser section: the same ranked repo list + analyze
 * flow as the editor's import modal (shared via RepoPickerList), so cache and
 * free-allowance accounting are identical in both places.
 */
export default function GitHubPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  // Pick order matters: the first `freeReposLeft` non-cached selections are free.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['github', 'status'],
    queryFn: githubApi.getStatus,
    enabled: isLoaded && isSignedIn,
  });
  const connected = status?.connected === true;

  const { data: library, isLoading: libraryLoading } = useQuery({
    queryKey: ['github', 'summaries'],
    queryFn: githubApi.getSummaries,
    enabled: connected,
  });

  const {
    data: repos,
    isLoading: reposLoading,
    isError: reposError,
  } = useQuery({
    queryKey: ['github', 'repos'],
    queryFn: () => githubApi.getRepos(),
    enabled: connected,
  });

  // Refresh bypasses the cached repo profile; the result replaces the query
  // cache so the list below updates in place.
  const refresh = useMutation({
    mutationFn: () => githubApi.getRepos(true),
    onSuccess: (data) => {
      queryClient.setQueryData(['github', 'repos'], data);
    },
  });

  const analyze = useMutation({
    mutationFn: githubApi.analyzeRepos,
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['github'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  const { data: resumesData } = useResumes({ enabled: isLoaded && isSignedIn });
  const resumes = (resumesData ?? []) as ResumeListItem[];

  const entries = library?.summaries ?? [];
  const importable = repos?.importable ?? [];
  const freeReposLeft =
    repos?.freeReposLeft ?? library?.freeReposLeft ?? status?.freeReposLeft ?? 0;

  // Free set: repos flagged analyzed by the repos endpoint plus anything with
  // a library entry (stale or not — re-analysis is free). Only never-analyzed
  // repos are chargeable.
  const freeRepoIds = new Set([
    ...importable.filter((r) => r.analyzed).map((r) => r.id),
    ...entries.map((s) => s.repoId),
  ]);

  const toggleSelected = (repoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  };

  const notEnoughCredits =
    analyze.isError && isAxiosError(analyze.error) && analyze.error.response?.status === 402;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Github size={22} className="text-ink-primary" />
          <h1 className="font-heading text-2xl font-bold text-ink-primary">GitHub Projects</h1>
        </div>
        {connected && (
          <p className="text-sm text-ink-muted">
            @{status?.login} · {freeReposLeft} free {freeReposLeft === 1 ? 'analysis' : 'analyses'} left
          </p>
        )}
      </div>

      {statusLoading && <div className="h-24 bg-paper-border rounded-lg animate-pulse" />}

      {!statusLoading && !connected && <GitHubConnectCard />}

      {connected && (
        <>
          {/* Project library */}
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-ink-primary">Project library</h2>
            {libraryLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-28 bg-paper-border rounded-lg animate-pulse" />
                ))}
              </div>
            )}
            {!libraryLoading && entries.length === 0 && (
              <Card className="p-6 text-center space-y-1">
                <p className="text-sm text-ink-secondary">No analyzed repos yet.</p>
                <p className="text-xs text-ink-muted">
                  Pick repositories below to build your project library.
                </p>
              </Card>
            )}
            {entries.map((entry) => (
              <LibraryCard key={entry.repoId} entry={entry} resumes={resumes} />
            ))}
          </section>

          {/* Analyze more repos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-ink-primary">
                Analyze more repos
              </h2>
              <Button
                size="sm"
                variant="ghost"
                loading={refresh.isPending}
                onClick={() => refresh.mutate()}
              >
                <RefreshCw size={14} />
                Refresh
              </Button>
            </div>

            {reposLoading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-paper-border rounded animate-pulse" />
                ))}
              </div>
            )}
            {reposError && (
              <p className="py-8 text-center text-sm text-danger-text">
                Could not load your repositories. Please try again.
              </p>
            )}
            {!reposLoading && !reposError && (
              <>
                <RepoPickerList
                  repos={importable}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                  freeRepoIds={freeRepoIds}
                  freeReposLeft={freeReposLeft}
                />
                {notEnoughCredits && (
                  <p className="text-sm text-danger-text">
                    Not enough credits.{' '}
                    <Link
                      to="/credits"
                      className="text-indigo-600 font-medium hover:text-indigo-700 underline"
                    >
                      Get credits
                    </Link>
                  </p>
                )}
                {analyze.isError && !notEnoughCredits && (
                  <p className="text-sm text-danger-text">Analysis failed. Please try again.</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <RepoPricingSummary
                    selectedIds={selectedIds}
                    freeRepoIds={freeRepoIds}
                    freeReposLeft={freeReposLeft}
                  />
                  <Button
                    size="sm"
                    disabled={selectedIds.length === 0}
                    loading={analyze.isPending}
                    onClick={() => analyze.mutate(selectedIds)}
                  >
                    Analyze {selectedIds.length} {selectedIds.length === 1 ? 'repo' : 'repos'}
                  </Button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * One library entry: generated bullets, staleness state (with a free
 * re-analysis action), and an add-to-resume picker.
 */
function LibraryCard({
  entry,
  resumes,
}: {
  entry: GithubSummaryEntry;
  resumes: ResumeListItem[];
}) {
  const queryClient = useQueryClient();
  const updateResume = useUpdateResume();
  const [adding, setAdding] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const [addError, setAddError] = useState(false);

  const reanalyze = useMutation({
    mutationFn: () => githubApi.analyzeRepos([entry.repoId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });

  // Resumes that already contain this repo — shown as "Added" and not clickable.
  const inResumeIds = new Set(entry.inResumes.map((r) => r.id));

  // Fetch the full resume, append the library project, and save it back.
  // The whole resume is sent (not just `projects`) so no fields are dropped.
  const handleAdd = async (resume: ResumeListItem) => {
    setAdding(true);
    setAddedTo(null);
    setAddError(false);
    try {
      const full = await resumesApi.getResume(resume.id);
      const projects = [
        ...(full.projects ?? []),
        {
          name: entry.project.name,
          url: entry.project.url,
          repoUrl: entry.project.repoUrl,
          description: entry.project.description,
          githubRepoId: entry.repoId,
        },
      ];
      await updateResume.mutateAsync({ id: resume.id, data: { ...full, projects } });
      setAddedTo(resume.name);
      // Refresh the usage map so this resume shows up as "Added" right away.
      queryClient.invalidateQueries({ queryKey: ['github', 'summaries'] });
    } catch {
      setAddError(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-heading font-semibold text-sm text-ink-primary truncate">
            {entry.repoName}
          </span>
          {entry.stale ? (
            <Badge variant="warning">Repo updated</Badge>
          ) : (
            <Badge variant="success">cached · free</Badge>
          )}
        </div>
        <span className="text-xs text-ink-muted shrink-0">analyzed {timeAgo(entry.createdAt)}</span>
      </div>

      <ul className="space-y-1 list-disc list-inside">
        {entry.bullets.map((bullet, i) => (
          <li key={i} className="text-xs text-ink-secondary">
            {bullet}
          </li>
        ))}
      </ul>

      {entry.inResumes.length > 0 && (
        <p className="text-xs text-ink-muted">
          In: {entry.inResumes.map((r) => r.name).join(', ')}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {entry.stale && (
          <Button
            size="sm"
            variant="secondary"
            loading={reanalyze.isPending}
            onClick={() => reanalyze.mutate()}
          >
            Re-analyze (free)
          </Button>
        )}
        {resumes.length > 0 ? (
          <select
            value=""
            disabled={adding}
            onChange={(e) => {
              const resume = resumes.find((r) => r.id === e.target.value);
              if (resume) void handleAdd(resume);
            }}
            className="text-xs font-medium border border-paper-border rounded px-2 py-1.5 bg-paper-bg text-ink-secondary hover:border-paper-border-strong focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            aria-label={`Add ${entry.repoName} to a resume`}
          >
            <option value="" disabled>
              {adding ? 'Adding…' : 'Add to resume…'}
            </option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id} disabled={inResumeIds.has(r.id)}>
                {inResumeIds.has(r.id) ? `${r.name} · Added` : r.name}
              </option>
            ))}
          </select>
        ) : (
          <Link
            to="/upload"
            className="text-xs text-indigo-600 font-medium hover:text-indigo-700"
          >
            Upload a resume to add this project →
          </Link>
        )}
        {addedTo && <span className="text-xs text-success-text">Added to {addedTo}</span>}
        {addError && (
          <span className="text-xs text-danger-text">Could not add project. Please try again.</span>
        )}
        {reanalyze.isError && (
          <span className="text-xs text-danger-text">Re-analysis failed. Please try again.</span>
        )}
      </div>
    </Card>
  );
}
