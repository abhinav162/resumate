interface ScorePillProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function scoreVariant(score: number) {
  if (score >= 75) return 'bg-success-bg text-success-text border-success-border';
  if (score >= 50) return 'bg-warning-bg text-warning-text border-warning-border';
  return 'bg-danger-bg text-danger-text border-danger-border';
}

export function ScorePill({ score, size = 'md' }: ScorePillProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-base px-3 py-1' : 'text-sm px-2.5 py-0.5';
  return (
    <span className={`inline-flex items-center font-mono font-semibold border rounded-full ${sizeClass} ${scoreVariant(score)}`}>
      {score}
    </span>
  );
}
