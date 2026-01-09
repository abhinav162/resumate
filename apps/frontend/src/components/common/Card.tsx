import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  hover = false,
  className = '',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-bg-secondary border border-border',
    elevated: 'bg-bg-secondary shadow-lg',
    bordered: 'bg-transparent border border-border',
    glass: 'bg-bg-secondary/50 backdrop-blur-sm border border-border/50',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverStyles = hover
    ? 'transition-all duration-200 hover:border-border-hover hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
    : '';

  return (
    <div
      className={`
        rounded-xl
        ${variants[variant]}
        ${paddings[padding]}
        ${hoverStyles}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </div>
  );
};
