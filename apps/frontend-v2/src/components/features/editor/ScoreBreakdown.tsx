import type { ScoreBreakdown as ScoreBreakdownType } from "../../../lib/api";

type Row = { key: keyof ScoreBreakdownType; label: string };

// Display order + labels. keywordMatch is filtered out below when absent.
const ROWS: Row[] = [
  { key: "metrics", label: "Metrics" },
  { key: "verbs", label: "Action verbs" },
  { key: "readability", label: "Readability" },
  { key: "formatting", label: "Formatting" },
  { key: "keywordMatch", label: "JD keywords" },
  { key: "impact", label: "Impact" },
  { key: "clarity", label: "Clarity" },
];

function barColor(value: number): string {
  if (value >= 75) return "bg-success-text";
  if (value >= 50) return "bg-warning-text";
  return "bg-danger-text";
}

export function ScoreBreakdown({
  breakdown,
}: {
  breakdown: ScoreBreakdownType | null | undefined;
}) {
  if (!breakdown) return null;

  const rows = ROWS.filter(
    (row) => typeof breakdown[row.key] === "number",
  );

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      {rows.map(({ key, label }) => {
        const value = breakdown[key] as number;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-ink-muted">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-paper-border overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(value)}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-mono text-ink-secondary">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
