/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0E14',
          secondary: '#151922',
          tertiary: '#1E2330',
          elevated: '#252B3A',
        },
        text: {
          primary: '#E8E9ED',
          secondary: '#9CA3B4',
          tertiary: '#6B7280',
          inverse: '#0A0E14',
        },
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          900: '#78350F',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
        },
        sky: {
          400: '#38BDF8',
          500: '#0EA5E9',
        },
        border: {
          DEFAULT: '#2D3748',
          hover: '#4A5568',
          focus: '#FBBF24',
          active: '#F59E0B',
        },
      },
      fontFamily: {
        display: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['General Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        xl: ['1.25rem', { lineHeight: '1.375' }],
        '2xl': ['1.5rem', { lineHeight: '1.375' }],
        '3xl': ['1.875rem', { lineHeight: '1.2' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.2' }],
        '7xl': ['4.5rem', { lineHeight: '1.2' }],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        'amber-glow': '0 0 20px rgba(251, 191, 36, 0.3)',
      },
      transitionTimingFunction: {
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out forwards',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseGlow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.3))' },
          '50%': { filter: 'drop-shadow(0 0 20px rgba(251, 191, 36, 0.6))' },
        },
      },
    },
  },
  plugins: [],
}
