import { Lock, Star } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import type { GithubRepo } from '../../../lib/githubApi';
import { CREDIT_COST_PER_REPO, computeRepoPricing, timeAgo } from './repoPricing';

/** Repos bucketed by owner, in first-appearance order of the ranked list. */
type RepoGroup = {
  login: string;
  ownerType?: 'User' | 'Organization';
  /** False for the trailing bucket of repos with no ownerLogin (stale cache). */
  withHeader: boolean;
  repos: GithubRepo[];
};

/**
 * Group repos by ownerLogin, preserving the ranked order both across groups
 * (first appearance wins) and within each group. Repos missing ownerLogin —
 * e.g. from a stale cached response — collapse into one trailing group that
 * renders without a header, keyed by the nameWithOwner prefix as a fallback.
 */
function groupByOwner(repos: GithubRepo[]): RepoGroup[] {
  const groups: RepoGroup[] = [];
  const byLogin = new Map<string, RepoGroup>();
  let trailing: RepoGroup | null = null;
  for (const repo of repos) {
    if (repo.ownerLogin) {
      let group = byLogin.get(repo.ownerLogin);
      if (!group) {
        group = { login: repo.ownerLogin, ownerType: repo.ownerType, withHeader: true, repos: [] };
        byLogin.set(repo.ownerLogin, group);
        groups.push(group);
      }
      group.repos.push(repo);
    } else {
      if (!trailing) {
        const fallbackLogin = repo.nameWithOwner.split('/')[0] ?? '';
        trailing = { login: fallbackLogin, withHeader: false, repos: [] };
      }
      trailing.repos.push(repo);
    }
  }
  if (trailing) groups.push(trailing);
  return groups;
}

/**
 * Selectable repo rows shared by the import modal and the /github page.
 * Rows are grouped by owner (personal account vs organizations); selection
 * order matters: it decides which non-cached picks land in the free
 * allowance (see `computeRepoPricing`).
 */
export function RepoPickerList({
  repos,
  selectedIds,
  onToggle,
  freeRepoIds,
  freeReposLeft,
  disabledIds,
  disabledTag = 'in this resume',
}: {
  repos: GithubRepo[];
  selectedIds: string[];
  onToggle: (repoId: string) => void;
  /** Repo ids that are always free to (re-)analyze — analyzed or in the library. */
  freeRepoIds: Set<string>;
  freeReposLeft: number;
  /** Repo ids that cannot be selected (e.g. already in the open resume). */
  disabledIds?: Set<string>;
  /** Tag shown on disabled rows explaining why they can't be picked. */
  disabledTag?: string;
}) {
  const { priceLabel } = computeRepoPricing(selectedIds, freeRepoIds, freeReposLeft);
  const groups = groupByOwner(repos);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.withHeader ? group.login : '__ungrouped'}>
          {group.withHeader && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-medium text-ink-muted">{group.login}</span>
              {group.ownerType === 'Organization' && <Badge>org</Badge>}
            </div>
          )}
          <ul className="space-y-2">
            {group.repos.map((repo) => {
              const disabled = disabledIds?.has(repo.id) ?? false;
              const selected = !disabled && selectedIds.includes(repo.id);
              return (
                <li key={repo.id}>
                  <label
                    className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                      disabled
                        ? 'border-paper-border opacity-60 cursor-not-allowed'
                        : selected
                          ? 'border-indigo-400 bg-indigo-50 cursor-pointer'
                          : 'border-paper-border hover:border-paper-border-strong cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => onToggle(repo.id)}
                      className="mt-1 accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-ink-primary truncate">
                          {repo.name}
                        </span>
                        {repo.isPrivate && (
                          <Badge>
                            <span className="inline-flex items-center gap-1">
                              <Lock size={10} />
                              Private
                            </span>
                          </Badge>
                        )}
                        {disabled ? (
                          <Badge>{disabledTag}</Badge>
                        ) : freeRepoIds.has(repo.id) ? (
                          <Badge variant="success">cached · free</Badge>
                        ) : (
                          selected && <Badge variant="indigo">{priceLabel(repo.id)}</Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-ink-secondary truncate mt-0.5">
                          {repo.description}
                        </p>
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
          </ul>
        </div>
      ))}
      {repos.length === 0 && (
        <p className="py-12 text-center text-sm text-ink-muted">No importable repositories found.</p>
      )}
    </div>
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
