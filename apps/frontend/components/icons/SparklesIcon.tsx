
import React from 'react';

const SparklesIcon: React.FC<{className?: string}> = ({className}) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 12l-2 2 2.828 2.828a1 1 0 001.414 0L17 12m-3 8l2.293-2.293a1 1 0 000-1.414L12 14l-2 2 2.828 2.828a1 1 0 011.414 0z" />
  </svg>
);
export default SparklesIcon;
