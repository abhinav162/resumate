# RESUMATE DESIGN SYSTEM
## MNC-Grade Professional Identity

**Version:** 1.0
**Last Updated:** January 9, 2026
**Status:** Ready for Implementation

---

## Executive Summary

This design system transforms Resumate from a basic dark-themed tool into an MNC-grade professional application through:

- **Distinctive Identity:** Warm amber accent (#FBBF24) + deep slate foundation (#0A0E14)
- **Premium Typography:** Satoshi (display) + General Sans (body) - avoiding generic Inter
- **Signature Element:** Match Score Pulse animation with real-time feedback
- **Aesthetic Direction:** "Confident Professionalism with Warm Precision"
- **Competitive Edge:** Warm, empowering vs. cold, corporate competitors

---

## Table of Contents

1. [Strategic Direction](#strategic-direction)
2. [Color System](#color-system)
3. [Typography System](#typography-system)
4. [Spacing & Layout](#spacing--layout)
5. [Component Specifications](#component-specifications)
6. [Animation & Motion](#animation--motion)
7. [Accessibility](#accessibility)
8. [Implementation Package](#implementation-package)

---

## Strategic Direction

### Design Philosophy

**"Confident Professionalism with Warm Precision"**

A refined evolution of neo-brutalism that balances:
- **Industrial precision** (sharp edges, clear hierarchy) to convey AI-powered accuracy
- **Warm confidence** (amber/gold accents, softer shadows) to reduce anxiety
- **Editorial clarity** (typography-first, generous spacing) to emphasize content quality

### User Psychology

Job seekers are anxious and time-constrained. They need:
- **Confidence** not overwhelm → Warm tones reduce anxiety vs cold blues
- **Precision** not guesswork → Sharp edges communicate AI accuracy
- **Speed** not complexity → Instant feedback, minimal steps

### Competitive Differentiation

| Aspect | Competitors | Resumate |
|--------|-------------|----------|
| Colors | Generic blue/purple | Warm amber + slate |
| Typography | Inter (oversaturated) | Satoshi + General Sans |
| Tone | Sterile/corporate | Empowering + professional |
| Signature | None | Match Score Pulse |

### The Unforgettable Element

**"Match Score Pulse"**

When users paste a job description, an animated circular progress indicator shows the ATS compatibility score building in real-time (0% → 94%), with:
- Pulsing amber glow intensifying as score increases
- Particle effects representing keywords being matched
- Color gradient shifting from red (low) → amber (medium) → emerald (high)
- Haptic micro-celebration at completion

**Purpose:** Transforms anxiety ("will this work?") into confidence ("94% match!")

### Design Principles

1. **"Clarity Commands Confidence"** - Reduce cognitive load, don't add to it
2. **"Precision Without Coldness"** - Technical accuracy balanced with warmth
3. **"Speed is a Feature"** - Every interaction feels instant
4. **"Content is King"** - Typography makes resume content shine
5. **"Trust Through Transparency"** - Show the AI working (scores, keywords)

---

## Color System

### Philosophy

Deep slate foundation with warm amber primary accent and emerald success states. Avoid purple/indigo SaaS clichés.

### Primary Palette (Slate Foundation)

```css
/* Backgrounds - Soft blacks, not pure black */
--color-bg-primary: #0A0E14;      /* Deep slate, reduced eye strain */
--color-bg-secondary: #151922;    /* Elevated surfaces */
--color-bg-tertiary: #1E2330;     /* Cards, panels */
--color-bg-elevated: #252B3A;     /* Hover states, modals */

/* Text - Warm grays, not pure white */
--color-text-primary: #E8E9ED;    /* Body text, high contrast */
--color-text-secondary: #9CA3B4;  /* Helper text, labels */
--color-text-tertiary: #6B7280;   /* Disabled, placeholder */
--color-text-inverse: #0A0E14;    /* Text on light backgrounds */
```

### Accent Palette

```css
/* Amber - Primary brand accent (warm, confident) */
--color-amber-50: #FFFBEB;
--color-amber-100: #FEF3C7;
--color-amber-400: #FBBF24;        /* Primary buttons, links */
--color-amber-500: #F59E0B;        /* Hover states */
--color-amber-600: #D97706;        /* Active states */
--color-amber-900: #78350F;        /* Dark mode text on amber bg */

/* Emerald - Success, positive outcomes */
--color-emerald-400: #34D399;      /* Success states */
--color-emerald-500: #10B981;      /* ATS score high (80%+) */
--color-emerald-600: #059669;      /* Success button hover */

/* Rose - Errors, warnings */
--color-rose-400: #FB7185;         /* Error states */
--color-rose-500: #F43F5E;         /* Low ATS score (<60%) */
--color-rose-600: #E11D48;         /* Error button hover */

/* Sky - Informational (used sparingly) */
--color-sky-400: #38BDF8;          /* Info badges */
--color-sky-500: #0EA5E9;          /* Links (secondary) */
```

### Semantic Colors

```css
/* Interactive States */
--color-border-default: #2D3748;   /* Default borders */
--color-border-hover: #4A5568;     /* Hover borders */
--color-border-focus: #FBBF24;     /* Focus rings (amber) */
--color-border-active: #F59E0B;    /* Active borders */

/* Overlay & Shadows */
--color-overlay: rgba(10, 14, 20, 0.75);  /* Modal backdrop */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
--shadow-amber-glow: 0 0 20px rgba(251, 191, 36, 0.3);
```

### Gradients

```css
/* Hero gradient - background only */
--gradient-hero: radial-gradient(
  circle at 30% 20%,
  rgba(251, 191, 36, 0.08) 0%,
  rgba(10, 14, 20, 0) 50%
);

/* Match score gradient - functional element */
--gradient-score-low: linear-gradient(135deg, #F43F5E 0%, #FB7185 100%);
--gradient-score-mid: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);
--gradient-score-high: linear-gradient(135deg, #10B981 0%, #34D399 100%);
```

### WCAG Compliance

- Text primary (#E8E9ED) on bg primary (#0A0E14): **14.8:1** ✅ AAA
- Amber 400 (#FBBF24) on bg primary: **9.2:1** ✅ AAA
- Emerald 500 (#10B981) on bg primary: **6.8:1** ✅ AA

---

## Typography System

### Philosophy

Distinctive but not distracting. Avoid Inter/Roboto. Choose fonts with professional character.

### Font Families

**Display Font: Satoshi (Variable)**
- Purpose: Headlines, section titles, button labels, nav items
- Rationale: Modern geometric sans with unique character. Variable font for performance.
- Weights: 500 (Medium), 700 (Bold), 900 (Black)
- Source: `https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap`

**Body Font: General Sans (Variable)**
- Purpose: Paragraphs, descriptions, form inputs, body text
- Rationale: Excellent readability, neutral but expressive
- Weights: 400 (Regular), 500 (Medium), 600 (Semibold)
- Source: `https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap`

**Mono Font: JetBrains Mono**
- Purpose: Code snippets, data displays, API keys
- Rationale: Superior readability for code, ligatures
- Weights: 400 (Regular), 500 (Medium)
- Source: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap`

### Fallback Stack

```css
--font-display: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-body: 'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

### Type Scale

```css
/* Font Sizes - 1.25 modular scale */
--text-xs: 0.75rem;      /* 12px - Helper text, badges */
--text-sm: 0.875rem;     /* 14px - Secondary text, captions */
--text-base: 1rem;       /* 16px - Body text, inputs */
--text-lg: 1.125rem;     /* 18px - Large body, subheadings */
--text-xl: 1.25rem;      /* 20px - Card titles */
--text-2xl: 1.5rem;      /* 24px - Page titles, h3 */
--text-3xl: 1.875rem;    /* 30px - Section headings, h2 */
--text-4xl: 2.25rem;     /* 36px - Page headings, h1 */
--text-5xl: 3rem;        /* 48px - Hero headings */
--text-6xl: 3.75rem;     /* 60px - Landing page hero */
--text-7xl: 4.5rem;      /* 72px - Marketing mega hero */

/* Line Heights */
--leading-tight: 1.2;       /* Headlines */
--leading-snug: 1.375;      /* Subheadings */
--leading-normal: 1.5;      /* Body text */
--leading-relaxed: 1.625;   /* Long-form content */
--leading-loose: 2;         /* Spacious layouts */

/* Letter Spacing */
--tracking-tighter: -0.05em;   /* Large display text */
--tracking-tight: -0.025em;    /* Headings */
--tracking-normal: 0;          /* Body text */
--tracking-wide: 0.025em;      /* Uppercase labels */
--tracking-wider: 0.05em;      /* Buttons, badges */
```

### Hierarchy Examples

```css
/* Hero Headline */
font-family: var(--font-display);
font-size: var(--text-6xl);
font-weight: 900;
line-height: var(--leading-tight);
letter-spacing: var(--tracking-tighter);

/* Page Heading (H1) */
font-family: var(--font-display);
font-size: var(--text-4xl);
font-weight: 700;
line-height: var(--leading-tight);

/* Body Text */
font-family: var(--font-body);
font-size: var(--text-base);
font-weight: 400;
line-height: var(--leading-normal);
color: var(--color-text-secondary);
```

---

## Spacing & Layout

### Spacing Scale (4px base unit)

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px - Default */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
--space-32: 8rem;     /* 128px */
```

### Grid System

```css
/* Breakpoints */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;

/* Container Widths */
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1400px;  /* Max for readability */

/* Content Widths */
--prose-width: 65ch;      /* Optimal line length */
--form-width: 480px;      /* Comfortable forms */
--card-max-width: 400px;  /* Standard cards */
```

### Border Radius

```css
--radius-none: 0;
--radius-sm: 0.25rem;    /* 4px - Badges */
--radius-md: 0.5rem;     /* 8px - Buttons, inputs */
--radius-lg: 0.75rem;    /* 12px - Cards */
--radius-xl: 1rem;       /* 16px - Modals */
--radius-2xl: 1.5rem;    /* 24px - Hero cards */
--radius-full: 9999px;   /* Pills, avatars */
```

---

## Component Specifications

### Button Component

**Variants:**
- **Primary** - Amber solid, main actions
- **Secondary** - Transparent with border, less important
- **Ghost** - No border, minimal emphasis
- **Danger** - Rose accent, destructive actions
- **Success** - Emerald accent, positive confirmations

**Sizes:** sm (32px), md (40px), lg (48px), icon (square)

**States:** Default, Hover, Active, Disabled, Loading, Focus

### Input Component

**Features:**
- Label support
- Left/right icon slots
- Error and helper text
- Focus states with amber ring
- Disabled state

### Card Component

**Variants:**
- **Default** - Gray background with border
- **Elevated** - Shadow, no border
- **Bordered** - Transparent with border
- **Glass** - Blur backdrop

**Features:** Padding options, hover effects

### Match Score Component (Signature)

**The Unforgettable Element:**
- Circular progress indicator
- Animated score counting (0% → 94%)
- Color gradient based on score (red → amber → emerald)
- Pulsing amber glow
- Particle effects at high scores
- Three sizes: sm, md, lg

---

## Animation & Motion

### Philosophy

"Orchestrated high-impact moments, not scattered micro-interactions"

### Timing Functions

```css
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);
--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0.0, 1, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-smooth: cubic-bezier(0.65, 0, 0.35, 1);
```

### Duration Scale

```css
--duration-instant: 0ms;
--duration-fast: 150ms;      /* Quick feedback */
--duration-normal: 250ms;    /* Default transitions */
--duration-slow: 400ms;      /* Page transitions */
--duration-dramatic: 600ms;  /* Signature moments */
```

### Key Patterns

1. **Page Enter** - Staggered fade-up
2. **Score Reveal** - Scale bounce with pulse glow (signature)
3. **Button Press** - Quick scale down/up
4. **Success Celebration** - Confetti particles
5. **Loading States** - Shimmer skeleton

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive components: 3:1 minimum

**Keyboard Navigation:**
- Tab order follows logical flow
- Escape closes modals
- Enter/Space activates buttons
- Arrow keys for custom controls

**Focus Indicators:**
- 2px solid amber outline
- 2px offset from element
- Visible on all interactive elements

**Screen Reader Support:**
- Proper ARIA labels
- Status announcements (aria-live)
- Error messages linked to inputs

---

## Implementation Package

### Files Included

1. **design-tokens.css** - Complete CSS variables
2. **tailwind.config.js** - Extended Tailwind configuration
3. **Button.tsx** - Full button component
4. **Input.tsx** - Full input component
5. **Card.tsx** - Full card component
6. **MatchScore.tsx** - Signature component

### Setup Instructions

1. Add font links to `index.html`
2. Create `design-tokens.css` in `src/styles/`
3. Update `tailwind.config.js`
4. Import tokens in main CSS
5. Install components in `src/components/common/`

### Quick Start

```tsx
// Import components
import { Button, Input, Card, MatchScore } from './components/common';

// Use in your app
<Button variant="primary" size="lg">
  Tailor My Resume
</Button>

<MatchScore score={94} size="md" animated />
```

---

## Resources & References

**Competitive Research:**
- [Best AI Resume Builders 2025](https://pitchmeai.com/blog/best-free-ai-resume-builders)
- [Linear Design System Principles](https://blog.logrocket.com/ux-design/linear-design/)

**Typography:**
- [Trending Fonts for SaaS 2025](https://medium.com/@mypippa.studio/10-trending-fonts-for-saas-websites-in-2025-for-ui-ux-design-a8860171721d)

**Color Systems:**
- [Dark UI Design Best Practices](https://www.toptal.com/designers/ui/dark-ui-design)
- [Dark UI Color Palettes](https://octet.design/colors/user-interfaces/dark-ui-design/)

---

**Design System Version:** 1.0
**Created:** January 9, 2026
**Status:** Ready for Implementation
**Next Review:** After Phase 1 completion
