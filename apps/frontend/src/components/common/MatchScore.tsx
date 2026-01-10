import React from 'react';

interface MatchScoreProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showLabel?: boolean;
}

export const MatchScore: React.FC<MatchScoreProps> = ({
  score,
  size = 'md',
  animated = true,
  showLabel = false,
}) => {
  const [displayScore, setDisplayScore] = React.useState(animated ? 0 : score);
  const [isComplete, setIsComplete] = React.useState(!animated);

  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Animate score counting up
  React.useEffect(() => {
    if (!animated) {
      setDisplayScore(clampedScore);
      setIsComplete(true);
      return;
    }

    let start = 0;
    const duration = 1500; // 1.5 seconds
    const increment = clampedScore / (duration / 16); // 60fps
    setIsComplete(false);

    const timer = setInterval(() => {
      start += increment;
      if (start >= clampedScore) {
        setDisplayScore(clampedScore);
        setIsComplete(true);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [clampedScore, animated]);

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score < 60) {
      return {
        gradient: 'from-rose-500 to-rose-400',
        glow: 'shadow-rose-500/50',
        text: 'text-rose-400',
        label: 'Low Match',
      };
    }
    if (score < 80) {
      return {
        gradient: 'from-amber-500 to-amber-400',
        glow: 'shadow-amber-500/50',
        text: 'text-amber-400',
        label: 'Good Match',
      };
    }
    return {
      gradient: 'from-emerald-500 to-emerald-400',
      glow: 'shadow-emerald-500/50',
      text: 'text-emerald-400',
      label: 'Excellent Match',
    };
  };

  const colors = getScoreColor(displayScore);

  // Size configurations
  const sizes = {
    sm: {
      container: 'w-20 h-20',
      circle: 'w-20 h-20',
      text: 'text-xl',
      stroke: '8',
      radius: '36',
    },
    md: {
      container: 'w-28 h-28',
      circle: 'w-28 h-28',
      text: 'text-3xl',
      stroke: '10',
      radius: '42',
    },
    lg: {
      container: 'w-36 h-36',
      circle: 'w-36 h-36',
      text: 'text-5xl',
      stroke: '12',
      radius: '60',
    },
  };

  const config = sizes[size];
  const circumference = 2 * Math.PI * parseInt(config.radius);
  const offset = circumference - (displayScore / 100) * circumference;

  // Show particles for high scores
  const showParticles = displayScore >= 80 && isComplete;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative ${config.container}`}>
        {/* SVG Circle */}
        <svg className={`${config.circle} -rotate-90`} viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-bg-elevated"
          />

          {/* Progress circle with gradient */}
          <circle
            cx="50"
            cy="50"
            r={config.radius}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300"
            style={{
              filter: displayScore >= 60 ? `drop-shadow(0 0 8px ${
                displayScore < 80 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(16, 185, 129, 0.4)'
              })` : undefined
            }}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop
                offset="0%"
                stopColor={
                  displayScore < 60 ? '#F43F5E' : displayScore < 80 ? '#F59E0B' : '#10B981'
                }
              />
              <stop
                offset="100%"
                stopColor={
                  displayScore < 60 ? '#FB7185' : displayScore < 80 ? '#FBBF24' : '#34D399'
                }
              />
            </linearGradient>
          </defs>
        </svg>

        {/* Score text overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className={`font-display font-bold ${config.text} text-text-primary`}>
              {displayScore}
            </span>
            <span className="text-sm text-text-secondary font-display">%</span>
          </div>
        </div>

        {/* Particle effects for excellent scores */}
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const angle = (i * Math.PI * 2) / 6;
              const x = 50 + Math.cos(angle) * 45;
              const y = 50 + Math.sin(angle) * 45;
              return (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    animationDelay: `${i * 0.1}s`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Pulsing glow for high scores */}
        {displayScore >= 80 && (
          <div
            className={`absolute inset-0 rounded-full ${colors.glow} blur-xl opacity-50 animate-pulse`}
          />
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span className={`text-xs font-display font-medium uppercase tracking-wider ${colors.text}`}>
          {colors.label}
        </span>
      )}
    </div>
  );
};
