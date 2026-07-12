import { Star } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import type { GithubRepo } from '../../../lib/githubApi';
import { CREDIT_COST_PER_REPO, computeRepoPricing, timeAgo } from './repoPricing';

/**
 * Selectable repo rows shared by the import modal and the /github page.
 * Selection order matters: it decides which non-cached picks land in the free
 * allowance (see `computeRepoPricing`).
 */
export function RepoPickerList({
  repos,
  selectedIds,
  onToggle,
  freeRepoIds,
  freeReposLeft,
}: {
  repos: GithubRepo[];
  selectedIds: string[];
  onToggle: (repoId: string) => void;
  /** Repo ids that are always free to (re-)analyze — analyzed or in the library. */
  freeRepoIds: Set<string>;
  freeReposLeft: number;
}) {
  const { priceLabel } = computeRepoPricing(selectedIds, freeRepoIds, freeReposLeft);

  return (
    <ul className="space-y-2">
      {repos.map((repo) => {
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
                onChange={() => onToggle(repo.id)}
                className="mt-1 accent-indigo-600"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink-primary truncate">{repo.name}</span>
                  {freeRepoIds.has(repo.id) ? (
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
      {repos.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-muted">No importable repositories found.</p>
      )}
    </ul>
  );
}

/** "N selected · M free · ..." price meter shown under the repo list. */
export function RepoPricingSummary({
  selectedIds,
  freeRepoIds,
  freeReposLeft,
}: {
  selectedIds: string[];
  freeRepoIds: Set<string>;
  freeReposLeft: number;
}) {
  const { freeCount, paidCount, totalCost } = computeRepoPricing(
    selectedIds,
    freeRepoIds,
    freeReposLeft
  );
  return (
    <p className="text-xs text-ink-muted">
      {selectedIds.length} selected · {freeCount} free
      {paidCount > 0 && ` · ${paidCount} × ${CREDIT_COST_PER_REPO} = ${totalCost} credits`}
    </p>
  );
}
