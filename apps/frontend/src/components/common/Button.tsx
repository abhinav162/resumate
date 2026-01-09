import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-display font-semibold tracking-wide uppercase
    rounded-lg transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
    focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-amber-400 text-text-inverse
      hover:bg-amber-500 active:bg-amber-600
      shadow-lg shadow-amber-400/20
      hover:shadow-amber-400/30
    `,
    secondary: `
      bg-transparent border border-border
      text-text-primary
      hover:bg-bg-tertiary hover:border-border-hover
    `,
    ghost: `
      bg-transparent text-text-secondary
      hover:bg-bg-tertiary hover:text-text-primary
    `,
    danger: `
      bg-rose-500 text-white
      hover:bg-rose-600 active:bg-rose-700
    `,
    success: `
      bg-emerald-500 text-white
      hover:bg-emerald-600 active:bg-emerald-700
    `,
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs h-8',
    md: 'px-6 py-3 text-sm h-10',
    lg: 'px-8 py-4 text-base h-12',
    icon: 'p-2 w-10 h-10',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      data-loading={loading}
      {...props}
    >
      {loading ? (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        <>
          {icon && <span className="inline-flex">{icon}</span>}
          {children}
        </>
      )}
      {loading && <span className="sr-only">Loading...</span>}
    </button>
  );
};
