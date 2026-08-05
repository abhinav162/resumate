/**
 * Formats a credit balance for display. Balances can be fractional since the
 * 0.2-credit GitHub repo pricing (M2) — show whole numbers plainly and clamp
 * fractional values to 2 dp so float drift (4.799999…) never leaks into the UI.
 */
export function formatCredits(balance: number | null | undefined): string {
  if (balance == null) return '–';
  return Number.isInteger(balance) ? String(balance) : balance.toFixed(2);
}
