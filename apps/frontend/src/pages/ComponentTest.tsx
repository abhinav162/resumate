import React, { useState } from 'react';
import { Button, Input, Textarea, Card, Badge, Spinner, MatchScore } from '../components/common';

export const ComponentTest: React.FC = () => {
  const [score, setScore] = useState(75);
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [hasError, setHasError] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-display font-bold text-text-primary mb-4">
            Design System Components
          </h1>
          <p className="text-xl text-text-secondary font-body">
            Testing all components from the new design system
          </p>
        </div>

        {/* Match Score - Signature Component */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Match Score (Signature Component)
          </h2>
          <p className="text-text-secondary font-body mb-6">
            The unforgettable element - animated circular progress with color-shifting
          </p>

          <div className="flex items-center justify-center gap-12 py-8 bg-bg-tertiary rounded-xl mb-6">
            <div className="text-center">
              <MatchScore score={score} size="sm" animated showLabel />
              <p className="text-xs text-text-tertiary mt-2 font-display">Small</p>
            </div>
            <div className="text-center">
              <MatchScore score={score} size="md" animated showLabel />
              <p className="text-xs text-text-tertiary mt-2 font-display">Medium</p>
            </div>
            <div className="text-center">
              <MatchScore score={score} size="lg" animated showLabel />
              <p className="text-xs text-text-tertiary mt-2 font-display">Large</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-display font-medium text-text-secondary">
              Adjust Score: {score}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setScore(45)}>
                Low (45%)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setScore(75)}>
                Good (75%)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setScore(94)}>
                Excellent (94%)
              </Button>
            </div>
          </div>
        </Card>

        {/* Buttons */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Buttons
          </h2>

          <div className="space-y-6">
            {/* Variants */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="success">Success</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Sizes</h3>
              <div className="flex flex-wrap items-end gap-4">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
                <Button variant="primary" size="icon">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* States */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">States</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Normal</Button>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }>
                  With Icon
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Inputs */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Inputs & Textarea
          </h2>

          <div className="space-y-6 max-w-2xl">
            {/* Normal Input */}
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              helper="We'll never share your email with anyone else."
            />

            {/* Input with Error */}
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              error={hasError ? "Password must be at least 8 characters" : undefined}
            />

            {/* Input with Icons */}
            <Input
              label="Search"
              placeholder="Search resumes..."
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />

            {/* Textarea */}
            <Textarea
              label="Job Description"
              placeholder="Paste the job description here..."
              rows={4}
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              helper={`${textareaValue.length} characters`}
            />

            <Button variant="secondary" onClick={() => setHasError(!hasError)}>
              Toggle Error State
            </Button>
          </div>
        </Card>

        {/* Cards */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Cards
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Default */}
            <Card variant="default" padding="md">
              <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                Default Card
              </h3>
              <p className="text-text-secondary font-body">
                Background with border. Good for standard content.
              </p>
            </Card>

            {/* Elevated */}
            <Card variant="elevated" padding="md">
              <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                Elevated Card
              </h3>
              <p className="text-text-secondary font-body">
                Shadow instead of border. Emphasis on content.
              </p>
            </Card>

            {/* Bordered */}
            <Card variant="bordered" padding="md">
              <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                Bordered Card
              </h3>
              <p className="text-text-secondary font-body">
                Transparent background. Minimal style.
              </p>
            </Card>

            {/* Glass */}
            <Card variant="glass" padding="md">
              <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                Glass Card
              </h3>
              <p className="text-text-secondary font-body">
                Blur backdrop. Modern glassmorphism effect.
              </p>
            </Card>

            {/* Hover Card */}
            <Card variant="elevated" padding="md" hover>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
                Hoverable Card
              </h3>
              <p className="text-text-secondary font-body">
                Hover me! Interactive with lift effect.
              </p>
            </Card>

            {/* Different Paddings */}
            <div className="space-y-2">
              <Card variant="default" padding="sm">
                <p className="text-sm text-text-secondary font-body">Small padding</p>
              </Card>
              <Card variant="default" padding="md">
                <p className="text-sm text-text-secondary font-body">Medium padding</p>
              </Card>
              <Card variant="default" padding="lg">
                <p className="text-sm text-text-secondary font-body">Large padding</p>
              </Card>
            </div>
          </div>
        </Card>

        {/* Badges */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Badges
          </h2>

          <div className="space-y-6">
            {/* Variants */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="info">Info</Badge>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success" size="sm">Small</Badge>
                <Badge variant="success" size="md">Medium</Badge>
                <Badge variant="success" size="lg">Large</Badge>
              </div>
            </div>

            {/* Usage Example */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">In Context</h3>
              <Card variant="default" padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-display font-semibold text-text-primary mb-1">
                      Software Engineer Resume
                    </h4>
                    <p className="text-sm text-text-secondary font-body">
                      Last updated 2 days ago
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="success">Active</Badge>
                    <Badge variant="info">3 Versions</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

        {/* Spinners */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Spinners
          </h2>

          <div className="space-y-6">
            {/* Sizes */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-8">
                <div className="text-center">
                  <Spinner size="sm" className="text-amber-400" />
                  <p className="text-xs text-text-tertiary mt-2 font-display">Small</p>
                </div>
                <div className="text-center">
                  <Spinner size="md" className="text-amber-400" />
                  <p className="text-xs text-text-tertiary mt-2 font-display">Medium</p>
                </div>
                <div className="text-center">
                  <Spinner size="lg" className="text-amber-400" />
                  <p className="text-xs text-text-tertiary mt-2 font-display">Large</p>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Colors</h3>
              <div className="flex flex-wrap items-center gap-8">
                <Spinner size="md" className="text-amber-400" />
                <Spinner size="md" className="text-emerald-500" />
                <Spinner size="md" className="text-rose-500" />
                <Spinner size="md" className="text-sky-500" />
                <Spinner size="md" className="text-text-primary" />
              </div>
            </div>
          </div>
        </Card>

        {/* Color System */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-6">
            Color System
          </h2>

          <div className="space-y-6">
            {/* Backgrounds */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Backgrounds</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-bg-primary border border-border rounded-lg">
                  <p className="text-xs font-display text-text-secondary">Primary</p>
                  <p className="text-xs font-mono text-text-tertiary">#0A0E14</p>
                </div>
                <div className="p-4 bg-bg-secondary border border-border rounded-lg">
                  <p className="text-xs font-display text-text-secondary">Secondary</p>
                  <p className="text-xs font-mono text-text-tertiary">#151922</p>
                </div>
                <div className="p-4 bg-bg-tertiary border border-border rounded-lg">
                  <p className="text-xs font-display text-text-secondary">Tertiary</p>
                  <p className="text-xs font-mono text-text-tertiary">#1E2330</p>
                </div>
                <div className="p-4 bg-bg-elevated border border-border rounded-lg">
                  <p className="text-xs font-display text-text-secondary">Elevated</p>
                  <p className="text-xs font-mono text-text-tertiary">#252B3A</p>
                </div>
              </div>
            </div>

            {/* Accents */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Accent Colors</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-amber-400 rounded-lg">
                  <p className="text-xs font-display text-text-inverse font-semibold">Amber</p>
                  <p className="text-xs font-mono text-text-inverse">#FBBF24</p>
                </div>
                <div className="p-4 bg-emerald-500 rounded-lg">
                  <p className="text-xs font-display text-white font-semibold">Emerald</p>
                  <p className="text-xs font-mono text-white">#10B981</p>
                </div>
                <div className="p-4 bg-rose-500 rounded-lg">
                  <p className="text-xs font-display text-white font-semibold">Rose</p>
                  <p className="text-xs font-mono text-white">#F43F5E</p>
                </div>
                <div className="p-4 bg-sky-500 rounded-lg">
                  <p className="text-xs font-display text-white font-semibold">Sky</p>
                  <p className="text-xs font-mono text-white">#0EA5E9</p>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-3">Typography</h3>
              <div className="space-y-2 p-4 bg-bg-secondary rounded-lg">
                <p className="text-text-primary font-body">Primary Text - General Sans (#E8E9ED)</p>
                <p className="text-text-secondary font-body">Secondary Text - General Sans (#9CA3B4)</p>
                <p className="text-text-tertiary font-body">Tertiary Text - General Sans (#6B7280)</p>
                <p className="text-xl font-display font-bold text-text-primary">Display Font - Satoshi</p>
                <p className="text-sm font-mono text-text-secondary">Mono Font - JetBrains Mono</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-text-tertiary font-body">
            Design System v1.0 - Resumate
          </p>
        </div>
      </div>
    </div>
  );
};
