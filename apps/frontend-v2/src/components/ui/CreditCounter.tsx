import { useCredits, formatCredits } from '../../contexts/CreditContext';
import { useNavigate } from 'react-router-dom';

export function CreditCounter() {
  const { balance, loading } = useCredits();
  const navigate = useNavigate();

  return (
    <div className="p-3 bg-paper-bg border border-paper-border rounded-lg">
      <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Credits</p>
      {loading ? (
        <div className="h-7 w-12 bg-paper-border rounded animate-pulse" />
      ) : (
        <p className="font-mono text-2xl font-semibold text-ink-primary">{formatCredits(balance)}</p>
      )}
      <button
        onClick={() => navigate('/credits')}
        className="mt-2 w-full text-xs text-center text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
      >
        Buy credits →
      </button>
    </div>
  );
}
