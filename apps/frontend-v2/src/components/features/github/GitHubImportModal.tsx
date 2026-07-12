import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Github, Star, X } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { githubApi, type RepoSummary } from '../../../lib/githubApi';

const CREDIT_COST_PER_REPO = 0.2;

export type ImportedProject = {
  name: string;
  url?: string;
  repoUrl?: string;
  description: string[];
};

/** Compact relative time for a repo's last push (e.g. "3d ago"). */
function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

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
}: {
  open: boolean;
  onClose: () => void;
  onImport: (projects: ImportedProject[]) => void;
}) {
  if (!open) return null;
  return <ModalContent onClose={onClose} onImport={onImport} />;
}

function ModalContent({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (projects: ImportedProject[]) => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  // Pick order matters: the first `freeReposLeft` non-cached selections are free.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<RepoSummary[]>([]);
  const [checkedRepoIds, setCheckedRepoIds] = useState<Set<string>>(new Set());

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

  const analyze = useMutation({
    mutationFn: githubApi.analyzeRepos,
    onSuccess: (result) => {
      setSummaries(result.summaries);
      setCheckedRepoIds(new Set(result.summaries.map((s) => s.repoId)));
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

  // Price meter: cached repos are always free; among the rest, the first
  // `freeReposLeft` picks (in selection order) are free, the others are paid.
  const analyzedIds = new Set(importable.filter((r) => r.analyzed).map((r) => r.id));
  const billableIds = selectedIds.filter((id) => !analyzedIds.has(id));
  const freeCount = Math.min(billableIds.length, freeReposLeft) + (selectedIds.length - billableIds.length);
  const paidCount = billableIds.length - Math.min(billableIds.length, freeReposLeft);
  const totalCost = (paidCount * CREDIT_COST_PER_REPO).toFixed(1);

  /** Price label for a selected, non-cached repo based on its pick order. */
  const priceLabel = (repoId: string): string => {
    const billableIndex = billableIds.indexOf(repoId);
    return billableIndex < freeReposLeft ? 'free' : `${CREDIT_COST_PER_REPO} cr`;
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
      .filter((s) => checkedRepoIds.has(s.repoId))
      .map((s) => ({
        name: s.project.name,
        url: s.project.url,
        repoUrl: s.project.repoUrl,
        description: s.project.description,
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
                <ul className="space-y-2">
                  {importable.map((repo) => {
                    const selected = selectedIds.includes(repo.id);
                    return (
                      <li key={repo.id}>
                        <label
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selected
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-paper-border hover:border-paper-border-strong'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(repo.id)}
                            className="mt-1 accent-indigo-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-ink-primary truncate">{repo.name}</span>
                              {repo.analyzed ? (
                                <Badge variant="success">cached · free</Badge>
                              ) : (
                                selected && <Badge variant="indigo">{priceLabel(repo.id)}</Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-xs text-ink-secondary truncate mt-0.5">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted">
                              <span className="inline-flex items-center gap-1">
                                <Star size={11} />
                                {repo.stars}
                              </span>
                              {repo.primaryLanguage && <Badge>{repo.primaryLanguage}</Badge>}
                              <span>pushed {timeAgo(repo.pushedAt)}</span>
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                  {importable.length === 0 && (
                    <p className="py-12 text-center text-sm text-ink-muted">No importable repositories found.</p>
                  )}
                </ul>
              )}
            </>
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
              <p className="text-xs text-ink-muted">
                {selectedIds.length} selected · {freeCount} free
                {paidCount > 0 && ` · ${paidCount} × ${CREDIT_COST_PER_REPO} = ${totalCost} credits`}
              </p>
              <Button
                size="sm"
                disabled={selectedIds.length === 0}
                loading={analyze.isPending}
                onClick={() => analyze.mutate(selectedIds)}
              >
                Analyze {selectedIds.length} {selectedIds.length === 1 ? 'repo' : 'repos'}
              </Button>
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
