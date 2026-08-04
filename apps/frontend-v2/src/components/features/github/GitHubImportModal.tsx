import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Github, X } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { githubApi, type RepoSummary } from '../../../lib/githubApi';
import { RepoPickerList, RepoPricingSummary } from './RepoPickerList';

export type ImportedProject = {
  name: string;
  url?: string;
  repoUrl?: string;
  description: string[];
  /** Source repo id — lets the editor dedupe and badge GitHub-imported projects. */
  githubRepoId: string;
};

/**
 * Modal that walks the user through importing GitHub repos as resume projects.
 *
 * Two internal steps: 'pick' (select repos, with a running price meter — the
 * first N non-cached selections are free, the rest cost credits) and 'preview'
 * (review generated bullets per repo, then hand the checked ones to `onImport`
 * as project entries). Selection is preserved when navigating Back; the inner
 * content only mounts while `open`, so all state resets when the modal closes.
 */
export function GitHubImportModal({
  open,
  onClose,
  onImport,
  existingRepoIds,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (projects: ImportedProject[]) => void;
  /** Repo ids already present in the open resume — shown as unselectable. */
  existingRepoIds?: string[];
}) {
  if (!open) return null;
  return <ModalContent onClose={onClose} onImport={onImport} existingRepoIds={existingRepoIds} />;
}

function ModalContent({
  onClose,
  onImport,
  existingRepoIds,
}: {
  onClose: () => void;
  onImport: (projects: ImportedProject[]) => void;
  existingRepoIds?: string[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  // Pick order matters: the first `freeReposLeft` non-cached selections are free.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Narrow the picker to one connected account ('' = all) when several exist.
  const [accountFilter, setAccountFilter] = useState('');
  const [summaries, setSummaries] = useState<RepoSummary[]>([]);
  const [checkedRepoIds, setCheckedRepoIds] = useState<Set<string>>(new Set());
  // True when the last analyze run skipped some repos (partial failure).
  const [hadFailures, setHadFailures] = useState(false);

  // Repos already in the open resume: unselectable in the picker and never
  // pre-checked (or imported) on the preview step.
  const existingSet = new Set(existingRepoIds ?? []);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['github', 'status'],
    queryFn: githubApi.getStatus,
  });

  const connected = status?.connected === true;

  const {
    data: repos,
    isLoading: reposLoading,
    isError: reposError,
  } = useQuery({
    queryKey: ['github', 'repos'],
    queryFn: () => githubApi.getRepos(),
    enabled: connected,
  });

  // Library entries power the fast-path (cached-only selections skip the
  // analyze call) and the pricing rule that any library repo is free.
  const { data: library } = useQuery({
    queryKey: ['github', 'summaries'],
    queryFn: githubApi.getSummaries,
    enabled: connected,
  });

  const analyze = useMutation({
    mutationFn: githubApi.analyzeRepos,
    onSuccess: (result) => {
      setSummaries(result.summaries);
      setHadFailures((result.failed?.length ?? 0) > 0);
      setCheckedRepoIds(
        new Set(result.summaries.map((s) => s.repoId).filter((id) => !existingSet.has(id)))
      );
      setStep('preview');
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['github'] });
    },
  });
  // Dismiss on Escape while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const importable = repos?.importable ?? [];
  const freeReposLeft = repos?.freeReposLeft ?? status?.freeReposLeft ?? 0;
  const accounts = status?.accounts ?? [];
  const visibleRepos = accountFilter
    ? importable.filter((r) => String(r.connectionId ?? '') === accountFilter)
    : importable;

  // Free set: repos flagged analyzed by the repos endpoint plus anything with
  // a library entry (stale or not — re-analysis is free). Only never-analyzed
  // repos are chargeable.
  const libraryEntries = library?.summaries ?? [];
  const freeRepoIds = new Set([
    ...importable.filter((r) => r.analyzed).map((r) => r.id),
    ...libraryEntries.map((s) => s.repoId),
  ]);

  // Fast-path: every selected repo has a fresh (non-stale) library entry, so
  // the preview can be built from cache with zero LLM calls and no charge.
  const entryByRepoId = new Map(libraryEntries.map((s) => [s.repoId, s]));
  const allCached =
    selectedIds.length > 0 &&
    selectedIds.every((id) => {
      const entry = entryByRepoId.get(id);
      return entry !== undefined && !entry.stale;
    });

  const useCachedBullets = () => {
    const cached: RepoSummary[] = selectedIds.flatMap((id) => {
      const entry = entryByRepoId.get(id);
      if (!entry) return [];
      return [
        {
          repoId: entry.repoId,
          repoName: entry.repoName,
          cached: true,
          bullets: entry.bullets,
          project: entry.project,
        },
      ];
    });
    setSummaries(cached);
    setHadFailures(false);
    setCheckedRepoIds(new Set(cached.map((s) => s.repoId).filter((id) => !existingSet.has(id))));
    setStep('preview');
  };

  const toggleSelected = (repoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  };

  const toggleChecked = (repoId: string) => {
    setCheckedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  };

  const handleImport = () => {
    const projects: ImportedProject[] = summaries
      .filter((s) => checkedRepoIds.has(s.repoId) && !existingSet.has(s.repoId))
      .map((s) => ({
        name: s.project.name,
        url: s.project.url,
        repoUrl: s.project.repoUrl,
        description: s.project.description,
        githubRepoId: s.repoId,
      }));
    onImport(projects);
    onClose();
  };

  const notEnoughCredits =
    analyze.isError && isAxiosError(analyze.error) && analyze.error.response?.status === 402;
  const checkedCount = checkedRepoIds.size;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/40 backdrop-blur-sm p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import projects from GitHub"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-paper-surface border border-paper-border rounded-xl shadow-elevated"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-paper-border">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="text-ink-muted hover:text-ink-primary p-1 -ml-1 rounded transition-colors"
                aria-label="Back to repo selection"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <Github size={18} className="text-ink-primary" />
            <h2 className="font-heading font-semibold text-ink-primary">
              {step === 'pick' ? 'Import from GitHub' : 'Review generated projects'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary p-1 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'pick' && (
            <>
              {(statusLoading || (connected && reposLoading)) && (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-paper-border rounded animate-pulse" />
                  ))}
                </div>
              )}

              {!statusLoading && !connected && (
                <div className="py-12 text-center space-y-2">
                  <Github size={24} className="mx-auto text-ink-muted" />
                  <p className="text-sm text-ink-secondary">Connect GitHub on the dashboard first.</p>
                </div>
              )}

              {connected && reposError && (
                <p className="py-12 text-center text-sm text-danger-text">
                  Could not load your repositories. Please try again.
                </p>
              )}

              {connected && !reposLoading && !reposError && (
                <>
                  {accounts.length > 1 && (
                    <div className="mb-3">
                      <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                        className="text-xs font-medium border border-paper-border rounded px-2 py-1.5 bg-paper-surface text-ink-secondary hover:border-paper-border-strong focus:outline-none focus:border-indigo-500 cursor-pointer"
                        aria-label="Filter by account"
                      >
                        <option value="">All accounts</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={String(a.id)}>
                            {a.login ? `@${a.login}` : `Account #${a.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <RepoPickerList
                    repos={visibleRepos}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    freeRepoIds={freeRepoIds}
                    freeReposLeft={freeReposLeft}
                    disabledIds={existingSet}
                  />
                </>
              )}
            </>
          )}

          {step === 'preview' && hadFailures && (
            <p className="text-xs text-warning-text mb-3">
              Some repositories couldn't be analyzed and were skipped.
            </p>
          )}

          {step === 'preview' && (
            <ul className="space-y-3">
              {summaries.map((summary) => (
                <li key={summary.repoId}>
                  <label className="flex items-start gap-3 p-3 border border-paper-border rounded-lg cursor-pointer hover:border-paper-border-strong transition-colors">
                    <input
                      type="checkbox"
                      checked={checkedRepoIds.has(summary.repoId)}
                      onChange={() => toggleChecked(summary.repoId)}
                      className="mt-1 accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-ink-primary">{summary.project.name}</span>
                        {summary.cached && <Badge variant="success">cached</Badge>}
                      </div>
                      <ul className="mt-1.5 space-y-1 list-disc list-inside">
                        {summary.bullets.map((bullet, i) => (
                          <li key={i} className="text-xs text-ink-secondary">
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-paper-border space-y-2">
          {notEnoughCredits && (
            <p className="text-sm text-danger-text">
              Not enough credits.{' '}
              <a href="/credits" className="text-indigo-600 font-medium hover:text-indigo-700 underline">
                Get credits
              </a>
            </p>
          )}
          {analyze.isError && !notEnoughCredits && (
            <p className="text-sm text-danger-text">Analysis failed. Please try again.</p>
          )}

          {step === 'pick' ? (
            <div className="flex items-center justify-between gap-3">
              <RepoPricingSummary
                selectedIds={selectedIds}
                freeRepoIds={freeRepoIds}
                freeReposLeft={freeReposLeft}
              />
              {allCached ? (
                <Button size="sm" onClick={useCachedBullets}>
                  Use cached bullets
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={selectedIds.length === 0}
                  loading={analyze.isPending}
                  onClick={() => analyze.mutate(selectedIds)}
                >
                  Analyze {selectedIds.length} {selectedIds.length === 1 ? 'repo' : 'repos'}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Button size="sm" variant="ghost" onClick={() => setStep('pick')}>
                <ArrowLeft size={14} />
                Back
              </Button>
              <Button size="sm" disabled={checkedCount === 0} onClick={handleImport}>
                Add {checkedCount} {checkedCount === 1 ? 'project' : 'projects'} to resume
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
