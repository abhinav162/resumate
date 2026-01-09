import React, { useState, useEffect, useCallback, useMemo, useId } from 'react';

interface MatchScoreProps {
  /** Score value from 0-100 */
  score: number;
  /** Size variant of the component */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to animate the score count-up */
  animated?: boolean;
  /** Whether to show the score label below */
  showLabel?: boolean;
  /** Optional class name for the container */
  className?: string;
}

interface ScoreColorConfig {
  from: string;
  to: string;
  label: string;
  glowColor: string;
}

interface SizeConfig {
  outer: string;
  text: string;
  labelText: string;
  stroke: number;
  radius: number;
}

const SIZE_CONFIG: Record<'sm' | 'md' | 'lg', SizeConfig> = {
  sm: { outer: 'w-16 h-16', text: 'text-lg', labelText: 'text-[10px]', stroke: 4, radius: 28 },
  md: { outer: 'w-24 h-24', text: 'text-2xl', labelText: 'text-xs', stroke: 6, radius: 42 },
  lg: { outer: 'w-32 h-32', text: 'text-4xl', labelText: 'text-sm', stroke: 8, radius: 56 },
};

const ANIMATION_DURATION = 1500; // 1.5 seconds
const PARTICLE_COUNT = 6;

/**
 * Determines color configuration based on score threshold
 * - < 60: Rose (Low Match)
 * - 60-79: Amber (Good Match)
 * - >= 80: Emerald (Excellent Match)
 */
const getScoreColorConfig = (score: number): ScoreColorConfig => {
  if (score < 60) {
    return {
      from: '#F43F5E', // rose-500
      to: '#FB7185',   // rose-400
      label: 'Low Match',
      glowColor: 'rgba(244, 63, 94, 0.4)',
    };
  }
  if (score < 80) {
    return {
      from: '#F59E0B', // amber-500
      to: '#FBBF24',   // amber-400
      label: 'Good Match',
      glowColor: 'rgba(251, 191, 36, 0.4)',
    };
  }
  return {
    from: '#10B981', // emerald-500
    to: '#34D399',   // emerald-400
    label: 'Excellent Match',
    glowColor: 'rgba(16, 185, 129, 0.4)',
  };
};

/**
 * Easing function for smooth animation (ease-out-cubic)
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * MatchScore - The signature element showing ATS compatibility score
 *
 * Features:
 * - Animated circular progress with smooth count-up
 * - Color-shifts based on score (rose -> amber -> emerald)
 * - Pulsing glow effect
 * - Particle celebration at 80%+ scores
 */
export const MatchScore: React.FC<MatchScoreProps> = ({
  score,
  size = 'md',
  animated = true,
  showLabel = false,
  className = '',
}) => {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  const [displayScore, setDisplayScore] = useState(animated ? 0 : clampedScore);
  const [isAnimationComplete, setIsAnimationComplete] = useState(!animated);

  // Generate unique ID for SVG gradient to prevent conflicts
  const uniqueId = useId();
  const gradientId = `scoreGradient-${uniqueId}`;

  // Smooth animation using requestAnimationFrame
  useEffect(() => {
    if (!animated) {
      setDisplayScore(clampedScore);
      setIsAnimationComplete(true);
      return;
    }

    setIsAnimationComplete(false);
    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Apply easing for smooth deceleration
      const easedProgress = easeOutCubic(progress);
      const currentScore = Math.round(easedProgress * clampedScore);

      setDisplayScore(currentScore);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayScore(clampedScore);
        setIsAnimationComplete(true);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [clampedScore, animated]);

  // Memoize color config based on display score
  const scoreColorConfig = useMemo(
    () => getScoreColorConfig(displayScore),
    [displayScore]
  );

  const sizeConfig = SIZE_CONFIG[size];
  const circumference = 2 * Math.PI * sizeConfig.radius;
  const offset = circumference - (displayScore / 100) * circumference;

  // Determine if particles should show (80%+ and animation complete)
  const showParticles = displayScore >= 80 && animated && isAnimationComplete;

  // Generate particle positions
  const particles = useMemo(() => {
    return [...Array(PARTICLE_COUNT)].map((_, i) => ({
      id: i,
      top: `${50 + 45 * Math.cos((i * Math.PI * 2) / PARTICLE_COUNT)}%`,
      left: `${50 + 45 * Math.sin((i * Math.PI * 2) / PARTICLE_COUNT)}%`,
      delay: `${i * 0.15}s`,
    }));
  }, []);

  return (
    <div
      className={`relative flex flex-col items-center gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={displayScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Match score: ${displayScore}%`}
    >
      {/* Main circular progress */}
      <div className={`relative ${sizeConfig.outer}`}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={scoreColorConfig.from} />
              <stop offset="100%" stopColor={scoreColorConfig.to} />
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={sizeConfig.radius}
            stroke="currentColor"
            strokeWidth={sizeConfig.stroke}
            fill="none"
            className="text-bg-elevated"
          />

          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={sizeConfig.radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={sizeConfig.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-100 ease-out"
            style={{
              filter: `drop-shadow(0 0 12px ${scoreColorConfig.glowColor})`,
            }}
          />
        </svg>

        {/* Score text - centered over the circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-display font-bold ${sizeConfig.text} text-text-primary tabular-nums`}
          >
            {displayScore}
            <span className="text-[0.6em] text-text-secondary">%</span>
          </span>
        </div>

        {/* Pulsing glow ring for high scores */}
        {displayScore >= 80 && (
          <div
            className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none"
            style={{
              boxShadow: `0 0 30px ${scoreColorConfig.glowColor}`,
              opacity: 0.6,
            }}
          />
        )}

        {/* Particle celebration effect */}
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="absolute w-1.5 h-1.5 bg-emerald-400 rounded-full"
                style={{
                  top: particle.top,
                  left: particle.left,
                  animation: `ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite`,
                  animationDelay: particle.delay,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score label */}
      {showLabel && (
        <span
          className={`${sizeConfig.labelText} font-display font-medium text-text-tertiary tracking-wide uppercase`}
        >
          {scoreColorConfig.label}
        </span>
      )}
    </div>
  );
};

export default MatchScore;
