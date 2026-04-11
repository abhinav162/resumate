/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: '#fafaf8',
          surface: '#ffffff',
          border: '#ebebeb',
          'border-strong': '#d4d4d4',
        },
        ink: {
          primary: '#0f0f0f',
          secondary: '#555555',
          muted: '#aaaaaa',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        success: { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
        warning: { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
        danger: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"Geist Mono"', 'monospace'],
      },
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'title': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'elevated': '0 4px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
