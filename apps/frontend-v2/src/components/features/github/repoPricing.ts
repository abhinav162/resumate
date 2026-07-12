export const CREDIT_COST_PER_REPO = 0.2;

/** Compact relative time for a repo timestamp (e.g. "3d ago"). */
export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Free/paid pricing for a repo selection.
 *
 * Repos in `freeRepoIds` (already analyzed or already in the project library —
 * re-analysis is free, even when stale) never charge. Among the rest, the
 * first `freeReposLeft` picks in selection order are free, the others paid.
 */
export function computeRepoPricing(
  selectedIds: string[],
  freeRepoIds: Set<string>,
  freeReposLeft: number
) {
  const billableIds = selectedIds.filter((id) => !freeRepoIds.has(id));
  const freeCount =
    Math.min(billableIds.length, freeReposLeft) + (selectedIds.length - billableIds.length);
  const paidCount = billableIds.length - Math.min(billableIds.length, freeReposLeft);
  const totalCost = (paidCount * CREDIT_COST_PER_REPO).toFixed(1);
  /** Price label for a selected, non-free repo based on its pick order. */
  const priceLabel = (repoId: string): string => {
    const billableIndex = billableIds.indexOf(repoId);
    return billableIndex < freeReposLeft ? 'free' : `${CREDIT_COST_PER_REPO} cr`;
  };
  return { freeCount, paidCount, totalCost, priceLabel };
}
