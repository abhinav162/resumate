import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-secondary font-display"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? errorId : helper ? helperId : undefined
          }
          className={`
            w-full px-4 py-3
            bg-bg-secondary border rounded-lg
            text-text-primary placeholder:text-text-tertiary
            font-body text-base
            transition-all duration-200
            focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-border'}
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-rose-400 flex items-center gap-1" role="alert">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={helperId} className="text-sm text-text-tertiary">{helper}</p>
      )}
    </div>
  );
};
