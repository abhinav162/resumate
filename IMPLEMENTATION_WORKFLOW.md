# RESUMATE DESIGN SYSTEM IMPLEMENTATION WORKFLOW

**Version:** 1.0
**Last Updated:** January 9, 2026
**Status:** Ready to Start

---

## Overview

This workflow breaks down the complete UI revamp into **10 manageable phases**. Each phase can be completed independently and work can be paused/resumed at any checkpoint.

**Total Estimated Time:** 4-6 weeks (part-time)
**Phases:** 10 phases, each 3-8 hours
**Strategy:** Foundation → Components → Pages → Polish

---

## Progress Tracking

### Current Status

- [ ] **Phase 0:** Foundation Setup (2-3 hours)
- [ ] **Phase 1:** Design Tokens & Tailwind Config (2 hours)
- [ ] **Phase 2:** Core Components - Button & Input (4 hours)
- [ ] **Phase 3:** Core Components - Card & Badge (3 hours)
- [ ] **Phase 4:** Signature Component - Match Score (4 hours)
- [ ] **Phase 5:** Landing Page Revamp (6 hours)
- [ ] **Phase 6:** Dashboard Revamp (5 hours)
- [ ] **Phase 7:** Profile Manager Revamp (6 hours)
- [ ] **Phase 8:** Tailor Page Revamp (5 hours)
- [ ] **Phase 9:** Testing & Accessibility Audit (4 hours)
- [ ] **Phase 10:** Polish & Launch Preparation (3 hours)

**Legend:**
- ⏸️ Not Started
- 🔄 In Progress
- ✅ Completed
- 🔍 Needs Review

---

## PHASE 0: Foundation Setup

**Goal:** Set up the foundation for the new design system
**Time:** 2-3 hours
**Prerequisites:** None
**Can Resume:** Yes, after any task

### Tasks

#### Task 0.1: Install Dependencies ⏸️

```bash
cd /Users/apple/Desktop/den/resumate/apps/frontend
npm install @fontsource/jetbrains-mono
```

**Checkpoint:** Verify in `package.json`

#### Task 0.2: Add Font Links ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/index.html`

Add inside `<head>` tag, before existing scripts:

```html
<!-- Design System Fonts -->
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Checkpoint:** Open app in browser, check Network tab for fonts loading

#### Task 0.3: Create Directory Structure ⏸️

```bash
# From frontend directory
mkdir -p src/styles
mkdir -p src/components/common
mkdir -p src/components/icons
```

**Checkpoint:** Verify directories exist

#### Task 0.4: Backup Current Files ⏸️

```bash
# Create backup of current components
cp -r src/components src/components.backup
cp index.css index.css.backup
```

**Checkpoint:** Backup folder created

### Completion Criteria

- [ ] Dependencies installed
- [ ] Font links added to HTML
- [ ] Directory structure created
- [ ] Backup files created
- [ ] App still runs without errors

**Resume Point:** Can pause after any task. Mark completed tasks with ✅

---

## PHASE 1: Design Tokens & Tailwind Config

**Goal:** Establish the design system foundation
**Time:** 2 hours
**Prerequisites:** Phase 0 complete
**Can Resume:** Yes, after any task

### Tasks

#### Task 1.1: Create Design Tokens File ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/styles/design-tokens.css`

**Action:** Create new file with this content:

```css
/* design-tokens.css */
:root {
  /* ========== COLORS ========== */

  /* Backgrounds */
  --color-bg-primary: #0A0E14;
  --color-bg-secondary: #151922;
  --color-bg-tertiary: #1E2330;
  --color-bg-elevated: #252B3A;

  /* Text */
  --color-text-primary: #E8E9ED;
  --color-text-secondary: #9CA3B4;
  --color-text-tertiary: #6B7280;
  --color-text-inverse: #0A0E14;

  /* Amber - Primary Brand */
  --color-amber-50: #FFFBEB;
  --color-amber-100: #FEF3C7;
  --color-amber-400: #FBBF24;
  --color-amber-500: #F59E0B;
  --color-amber-600: #D97706;
  --color-amber-900: #78350F;

  /* Emerald - Success */
  --color-emerald-400: #34D399;
  --color-emerald-500: #10B981;
  --color-emerald-600: #059669;

  /* Rose - Error */
  --color-rose-400: #FB7185;
  --color-rose-500: #F43F5E;
  --color-rose-600: #E11D48;

  /* Sky - Info */
  --color-sky-400: #38BDF8;
  --color-sky-500: #0EA5E9;

  /* Borders */
  --color-border-default: #2D3748;
  --color-border-hover: #4A5568;
  --color-border-focus: #FBBF24;
  --color-border-active: #F59E0B;

  /* ========== TYPOGRAPHY ========== */

  --font-display: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: 'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;

  /* Font Sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;
  --text-6xl: 3.75rem;
  --text-7xl: 4.5rem;

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Letter Spacing */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;

  /* ========== SPACING ========== */

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;

  /* ========== BORDERS & SHADOWS ========== */

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  --shadow-amber-glow: 0 0 20px rgba(251, 191, 36, 0.3);

  /* ========== ANIMATIONS ========== */

  --ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-dramatic: 600ms;
}

/* ========== ANIMATIONS ========== */

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

@keyframes pulseGlow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.6));
  }
}

.animate-fade-up {
  animation: fadeUp var(--duration-slow) var(--ease-out) forwards;
}

/* ========== REDUCED MOTION ========== */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Checkpoint:** File created, no syntax errors

#### Task 1.2: Update Main CSS File ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/index.css`

**Action:** Replace current content with:

```css
/* Import design tokens first */
@import './styles/design-tokens.css';

/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  background-color: var(--color-bg-primary);
  color: var(--color-text-secondary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  color: var(--color-text-primary);
  font-weight: 700;
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Selection */
::selection {
  background-color: var(--color-amber-400);
  color: var(--color-text-inverse);
}
```

**Checkpoint:** App loads with new colors, fonts visible

#### Task 1.3: Update Tailwind Config ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/tailwind.config.js`

**Action:** Replace current content with:

```javascript
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
```

**Checkpoint:** Tailwind classes work with new colors

### Testing Checklist

- [ ] App loads without errors
- [ ] Fonts are visible (Satoshi headings, General Sans body)
- [ ] Colors changed from old to new palette
- [ ] Tailwind classes work (try `bg-amber-400`, `text-text-primary`)
- [ ] Console has no errors

### Completion Criteria

- [ ] design-tokens.css created and imported
- [ ] index.css updated with global styles
- [ ] tailwind.config.js extended
- [ ] App runs with new design tokens
- [ ] All tests pass

**Resume Point:** Phase complete. Can pause here. Next: Build components.

---

## PHASE 2: Core Components - Button & Input

**Goal:** Build foundation UI components
**Time:** 4 hours
**Prerequisites:** Phase 1 complete
**Can Resume:** Yes, after each component

### Tasks

#### Task 2.1: Create Button Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Button.tsx`

**Action:** Create new file:

```typescript
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
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className="inline-flex">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
```

**Checkpoint:** Button component created

#### Task 2.2: Test Button Component ⏸️

**File:** Create test file `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/ButtonTest.tsx`

```typescript
import { Button } from './Button';

export const ButtonTest = () => {
  return (
    <div className="p-8 space-y-4 bg-bg-primary">
      <h2 className="text-2xl font-display font-bold text-text-primary mb-4">Button Tests</h2>

      <div className="space-x-4">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
      </div>

      <div className="space-x-4">
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="md">Medium</Button>
        <Button variant="primary" size="lg">Large</Button>
      </div>

      <div className="space-x-4">
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" loading>Loading</Button>
      </div>
    </div>
  );
};
```

Temporarily add to App.tsx to test, then remove.

**Checkpoint:** All button variants render correctly

#### Task 2.3: Create Input Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Input.tsx`

```typescript
import React from 'react';

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
  ...props
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-text-secondary font-display">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-rose-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {helper && !error && (
        <p className="text-sm text-text-tertiary">{helper}</p>
      )}
    </div>
  );
};
```

**Checkpoint:** Input component created

#### Task 2.4: Create Textarea Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Textarea.tsx`

```typescript
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helper,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-text-secondary font-display">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-4 py-3
          bg-bg-secondary border rounded-lg
          text-text-primary placeholder:text-text-tertiary
          font-body text-base
          transition-all duration-200
          focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-none
          ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-border'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-rose-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {helper && !error && (
        <p className="text-sm text-text-tertiary">{helper}</p>
      )}
    </div>
  );
};
```

**Checkpoint:** Textarea component created

#### Task 2.5: Create Component Index ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/index.ts`

```typescript
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
```

**Checkpoint:** Components can be imported from single path

### Testing Checklist

- [ ] Button renders all 5 variants
- [ ] Button responds to hover/active states
- [ ] Button shows loading spinner
- [ ] Input accepts text and shows focus state
- [ ] Input displays error messages
- [ ] Textarea resizes properly
- [ ] All components are keyboard accessible

### Completion Criteria

- [ ] Button component complete
- [ ] Input component complete
- [ ] Textarea component complete
- [ ] Components exported from index
- [ ] Manual testing passed

**Resume Point:** Phase complete. Components ready. Next: Card & Badge.

---

## PHASE 3: Core Components - Card & Badge

**Goal:** Build container and status components
**Time:** 3 hours
**Prerequisites:** Phase 2 complete
**Can Resume:** Yes, after each component

### Tasks

#### Task 3.1: Create Card Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Card.tsx`

```typescript
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
      `}
      {...props}
    >
      {children}
    </div>
  );
};
```

**Checkpoint:** Card component created

#### Task 3.2: Create Badge Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Badge.tsx`

```typescript
import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-bg-elevated text-text-secondary border border-border',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    error: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    info: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1
        font-display font-medium
        rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};
```

**Checkpoint:** Badge component created

#### Task 3.3: Create Spinner Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/Spinner.tsx`

```typescript
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`
        ${sizes[size]}
        border-current border-t-transparent
        rounded-full
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
};
```

**Checkpoint:** Spinner component created

#### Task 3.4: Update Component Index ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/index.ts`

Update to include new components:

```typescript
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Card } from './Card';
export { Badge } from './Badge';
export { Spinner } from './Spinner';
```

**Checkpoint:** All components exported

### Testing Checklist

- [ ] Card renders all 4 variants
- [ ] Card hover effect works
- [ ] Badge shows all status colors
- [ ] Spinner animates smoothly
- [ ] Components work together

### Completion Criteria

- [ ] Card component complete
- [ ] Badge component complete
- [ ] Spinner component complete
- [ ] Components exported
- [ ] Manual testing passed

**Resume Point:** Phase complete. Core components done. Next: Signature component.

---

## PHASE 4: Signature Component - Match Score

**Goal:** Build the unforgettable Match Score component
**Time:** 4 hours
**Prerequisites:** Phase 3 complete
**Can Resume:** Yes, after any task

### Tasks

#### Task 4.1: Create Match Score Component ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/MatchScore.tsx`

```typescript
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

  React.useEffect(() => {
    if (!animated) return;

    let start = 0;
    const end = score;
    const duration = 1500; // 1.5 seconds
    const increment = end / (duration / 16); // 60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayScore(end);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score, animated]);

  const getScoreColor = (score: number) => {
    if (score < 60) return { from: '#F43F5E', to: '#FB7185', label: 'Low Match' };
    if (score < 80) return { from: '#F59E0B', to: '#FBBF24', label: 'Good Match' };
    return { from: '#10B981', to: '#34D399', label: 'Excellent Match' };
  };

  const getGlowColor = (score: number) => {
    if (score < 60) return 'rgba(244, 63, 94, 0.3)';
    if (score < 80) return 'rgba(251, 191, 36, 0.3)';
    return 'rgba(16, 185, 129, 0.3)';
  };

  const scoreColor = getScoreColor(displayScore);

  const sizes = {
    sm: { outer: 'w-16 h-16', text: 'text-lg', stroke: 4, radius: 28 },
    md: { outer: 'w-24 h-24', text: 'text-2xl', stroke: 6, radius: 42 },
    lg: { outer: 'w-32 h-32', text: 'text-4xl', stroke: 8, radius: 56 },
  };

  const circumference = 2 * Math.PI * sizes[size].radius;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div className={`relative ${sizes[size].outer} flex flex-col items-center gap-2`}>
      {/* SVG Circle */}
      <svg className="w-full h-full -rotate-90">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={sizes[size].radius}
          stroke="currentColor"
          strokeWidth={sizes[size].stroke}
          fill="none"
          className="text-bg-elevated"
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={sizes[size].radius}
          stroke={`url(#scoreGradient-${displayScore})`}
          strokeWidth={sizes[size].stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
          style={{
            filter: `drop-shadow(0 0 10px ${getGlowColor(displayScore)})`,
          }}
        />
        <defs>
          <linearGradient id={`scoreGradient-${displayScore}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={scoreColor.from} />
            <stop offset="100%" stopColor={scoreColor.to} />
          </linearGradient>
        </defs>
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display font-bold ${sizes[size].text} text-text-primary`}>
          {displayScore}%
        </span>
      </div>

      {/* Particle effect (when score is high) */}
      {displayScore >= 80 && animated && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-emerald-400 rounded-full animate-ping"
              style={{
                top: `${50 + 40 * Math.cos((i * Math.PI * 2) / 6)}%`,
                left: `${50 + 40 * Math.sin((i * Math.PI * 2) / 6)}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Label */}
      {showLabel && (
        <span className="text-xs font-display text-text-tertiary mt-1">
          {scoreColor.label}
        </span>
      )}
    </div>
  );
};
```

**Checkpoint:** Match Score component created

#### Task 4.2: Update Component Index ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/common/index.ts`

Add:

```typescript
export { MatchScore } from './MatchScore';
```

**Checkpoint:** MatchScore exported

#### Task 4.3: Create Test Page ⏸️

Create a temporary test page to see the Match Score animation:

**File:** Create `/Users/apple/Desktop/den/resumate/apps/frontend/src/pages/TestComponents.tsx`

```typescript
import React, { useState } from 'react';
import { MatchScore, Button, Card } from '../components/common';

export const TestComponents = () => {
  const [score, setScore] = useState(75);

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <h1 className="text-4xl font-display font-bold text-text-primary mb-8">
        Component Tests
      </h1>

      <Card className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-primary mb-4">
            Match Score Component
          </h2>

          <div className="flex items-center gap-8 justify-center py-8">
            <MatchScore score={score} size="sm" animated showLabel />
            <MatchScore score={score} size="md" animated showLabel />
            <MatchScore score={score} size="lg" animated showLabel />
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Button onClick={() => setScore(45)} variant="secondary" size="sm">
                Low Score (45%)
              </Button>
              <Button onClick={() => setScore(75)} variant="secondary" size="sm">
                Good Score (75%)
              </Button>
              <Button onClick={() => setScore(94)} variant="secondary" size="sm">
                Excellent Score (94%)
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
```

Add route temporarily to test, then remove.

**Checkpoint:** Match Score animates correctly

### Testing Checklist

- [ ] Score animates from 0 to target
- [ ] Color changes based on score (red → amber → emerald)
- [ ] Glow effect visible
- [ ] Particles appear at 80%+
- [ ] All sizes render correctly
- [ ] Label shows correct text

### Completion Criteria

- [ ] MatchScore component complete
- [ ] Animation smooth and performant
- [ ] All sizes and variants work
- [ ] Component exported
- [ ] Manual testing passed

**Resume Point:** Phase complete. Signature component done. Next: Landing page revamp.

---

## PHASE 5: Landing Page Revamp

**Goal:** Apply new design system to landing page
**Time:** 6 hours
**Prerequisites:** Phases 1-4 complete
**Can Resume:** Yes, after each section

### Overview

The landing page will be rebuilt section by section:
1. Hero section with new headline
2. Problem/Agitation section (NEW)
3. How It Works section
4. Social Proof section (NEW)
5. Benefits section
6. FAQ section (NEW)
7. Final CTA

### Task 5.1: Backup Current Landing Page ⏸️

```bash
cp src/components/LandingPage.tsx src/components/LandingPage.backup.tsx
```

**Checkpoint:** Backup created

### Task 5.2: Update Hero Section ⏸️

**File:** `/Users/apple/Desktop/den/resumate/apps/frontend/src/components/LandingPage.tsx`

Replace hero section with:

```tsx
{/* Hero Section */}
<header className="container mx-auto px-6 pt-32 pb-20 text-center relative z-10">
  {/* Background glow */}
  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px]
                  bg-amber-400/10 rounded-full blur-[120px] -z-10"></div>

  {/* Trust Badge */}
  <div className="inline-flex items-center gap-2 px-4 py-2 mb-8
                  bg-emerald-500/10 border border-emerald-500/20 rounded-full">
    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
    <span className="text-sm text-emerald-400 font-display">
      247 resumes tailored in the last 24 hours
    </span>
  </div>

  {/* Headline - Pain-focused */}
  <h1 className="text-5xl md:text-7xl font-extrabold font-display tracking-tight mb-6
                 text-text-primary leading-tight">
    Stop Getting Rejected by
    <span className="block text-amber-400">ATS Filters</span>
  </h1>

  {/* Subheadline */}
  <p className="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-4 font-body">
    Tailor your resume to any job description in 30 seconds.
  </p>

  <p className="text-lg text-text-tertiary max-w-2xl mx-auto mb-12 font-body">
    Our AI analyzes job requirements and optimizes your resume for
    ATS compatibility and human reviewers alike.
  </p>

  {/* CTA Group */}
  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
    <SignedOut>
      <SignInButton mode="modal">
        <Button variant="primary" size="lg">
          Tailor My Resume Free →
        </Button>
      </SignInButton>
    </SignedOut>
    <SignedIn>
      <Link to="/dashboard">
        <Button variant="primary" size="lg">
          Go to Dashboard →
        </Button>
      </Link>
    </SignedIn>
    <Button variant="ghost" size="lg" onClick={() => {
      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
    }}>
      See How It Works
    </Button>
  </div>

  {/* Trust Elements */}
  <div className="flex flex-wrap justify-center gap-6 text-sm text-text-tertiary font-display">
    <span className="flex items-center gap-2">
      <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
      No credit card required
    </span>
    <span className="flex items-center gap-2">
      <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
      Free forever plan
    </span>
    <span className="flex items-center gap-2">
      <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
      Export to PDF instantly
    </span>
  </div>
</header>
```

**Checkpoint:** Hero section updated, CTA buttons use new Button component

### Task 5.3: Add Problem/Agitation Section (NEW) ⏸️

Add new section after hero:

```tsx
{/* Problem/Agitation Section */}
<section className="py-20 bg-bg-tertiary/30">
  <div className="container mx-auto px-6">
    <div className="max-w-4xl mx-auto text-center">
      <h2 className="text-3xl md:text-4xl font-bold font-display text-text-primary mb-6">
        You're Doing Everything Right.
        <span className="text-text-secondary"> But Still Not Hearing Back.</span>
      </h2>

      {/* Statistics */}
      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <Card variant="elevated" padding="lg">
          <div className="text-4xl font-bold font-display text-rose-400 mb-2">75%</div>
          <p className="text-text-secondary font-body">
            of resumes are rejected by ATS before a human ever sees them
          </p>
        </Card>
        <Card variant="elevated" padding="lg">
          <div className="text-4xl font-bold font-display text-amber-400 mb-2">2+ hrs</div>
          <p className="text-text-secondary font-body">
            Average time spent tailoring a resume for each application
          </p>
        </Card>
        <Card variant="elevated" padding="lg">
          <div className="text-4xl font-bold font-display text-amber-500 mb-2">100+</div>
          <p className="text-text-secondary font-body">
            Applications needed before landing an interview (on average)
          </p>
        </Card>
      </div>

      {/* Pain Points */}
      <div className="mt-12 text-left max-w-2xl mx-auto">
        <h3 className="text-xl font-semibold font-display text-text-primary mb-4">
          Sound familiar?
        </h3>
        <ul className="space-y-3 text-text-secondary font-body">
          <li className="flex items-start gap-3">
            <span className="text-rose-400 mt-1">✕</span>
            <span>Spending hours rewriting your resume for each job application</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-rose-400 mt-1">✕</span>
            <span>Sending 50+ applications with barely any callbacks</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-rose-400 mt-1">✕</span>
            <span>Guessing which keywords the ATS is looking for</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-rose-400 mt-1">✕</span>
            <span>Wondering if your resume is even being seen by recruiters</span>
          </li>
        </ul>
      </div>

      <p className="mt-12 text-lg text-text-tertiary font-body">
        There's a better way. Let AI do the tailoring while you focus on
        preparing for interviews.
      </p>
    </div>
  </div>
</section>
```

**Checkpoint:** Problem section added with statistics

*Due to length limits, I'll create a continuation document...*

### Completion Criteria for Phase 5

- [ ] Hero section updated with new design
- [ ] Problem/Agitation section added
- [ ] How It Works section enhanced
- [ ] Social Proof section added
- [ ] FAQ section added
- [ ] Final CTA enhanced
- [ ] All sections use new components
- [ ] Landing page responsive on mobile

**Resume Point:** Landing page revamp in progress. Continue with remaining sections.

---

## Phases 6-10 Summary

Due to length, here's a summary of remaining phases:

**Phase 6: Dashboard Revamp** (5 hours)
- Update navigation with new Button components
- Replace cards with new Card component
- Add MatchScore displays
- Update empty states

**Phase 7: Profile Manager Revamp** (6 hours)
- Update ProfileManager component
- Replace all buttons and inputs
- Add new card layouts
- Improve mobile layout

**Phase 8: Tailor Page Revamp** (5 hours)
- Update TailorResume component
- Integrate MatchScore component
- Add progress indicators
- Enhance UX flow

**Phase 9: Testing & Accessibility** (4 hours)
- Keyboard navigation testing
- Screen reader testing
- Color contrast verification
- Mobile responsive testing
- Cross-browser testing

**Phase 10: Polish & Launch** (3 hours)
- Performance optimization
- Animation polish
- Final bug fixes
- Documentation
- Deploy to production

---

## Quick Reference

### File Structure
```
resumate/
├── DESIGN_SYSTEM.md (this doc)
├── IMPLEMENTATION_WORKFLOW.md (workflow)
├── apps/frontend/
│   ├── src/
│   │   ├── styles/
│   │   │   └── design-tokens.css
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   ├── MatchScore.tsx
│   │   │   │   └── index.ts
│   │   ├── index.css
│   │   └── tailwind.config.js
```

### Component Imports
```typescript
import { Button, Input, Card, Badge, MatchScore } from '@/components/common';
```

### Color Usage
```tsx
// Text
className="text-text-primary"    // Primary text
className="text-text-secondary"  // Secondary text
className="text-text-tertiary"   // Disabled/placeholder

// Backgrounds
className="bg-bg-primary"        // Main background
className="bg-bg-secondary"      // Cards
className="bg-bg-tertiary"       // Elevated

// Accent
className="bg-amber-400"         // Primary actions
className="bg-emerald-500"       // Success
className="bg-rose-500"          // Error
```

---

## How to Resume Work

1. **Check Current Phase:** Look at "Progress Tracking" section
2. **Find Last Completed Task:** Look for ✅ marks
3. **Resume Next Task:** Start from first ⏸️ task
4. **Test After Each Task:** Use checkpoints
5. **Mark Complete:** Change ⏸️ to ✅ when done
6. **Save Progress:** Commit to git regularly

---

## Emergency Rollback

If something breaks:

```bash
# Restore backup files
cp src/components.backup/* src/components/
cp index.css.backup index.css

# Restart dev server
npm run dev
```

---

**Next Steps:**
1. Start with Phase 0
2. Complete each phase sequentially
3. Test thoroughly at each checkpoint
4. Commit progress regularly
5. Resume anytime using checkpoints
