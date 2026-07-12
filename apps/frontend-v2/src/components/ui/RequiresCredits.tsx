import type { ReactNode } from 'react';
import { useCredits, formatCredits } from '../../contexts/CreditContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface RequiresCreditsProps {
  cost: number;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequiresCredits({ cost, children, fallback }: RequiresCreditsProps) {
  const { balance } = useCredits();
  const navigate = useNavigate();

  if (balance !== null && balance < cost) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="p-4 bg-warning-bg border border-warning-border rounded-lg text-center">
        <p className="text-sm font-medium text-warning-text mb-2">
          This action requires {cost} credit{cost > 1 ? 's' : ''}. You have {formatCredits(balance)}.
        </p>
        <Button size="sm" onClick={() => navigate('/credits')}>Buy Credits</Button>
      </div>
    );
  }

  return <>{children}</>;
}
