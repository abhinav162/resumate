import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-paper-surface border border-paper-border rounded-lg ${elevated ? 'shadow-elevated' : 'shadow-card'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
