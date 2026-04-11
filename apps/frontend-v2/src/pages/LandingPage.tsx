import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '../components/ui/Button';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-paper-bg">
      {/* Nav */}
      <nav className="border-b border-paper-border bg-paper-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-heading font-bold text-lg tracking-tight">
            resu<span className="text-indigo-600">mate</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#how" className="text-sm text-ink-secondary hover:text-ink-primary transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-ink-secondary hover:text-ink-primary transition-colors">Pricing</a>
            {isSignedIn ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>Dashboard →</Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => navigate('/sign-in')}>Sign in</Button>
                <Button size="sm" onClick={() => navigate('/sign-up')}>Get started →</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 flex gap-12 items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-100">
            ✦ AI-First Resume Platform
          </div>
          <h1 className="font-heading text-5xl font-bold text-ink-primary leading-tight tracking-tight">
            Get more<br />interviews <span className="text-indigo-600">faster.</span>
          </h1>
          <p className="text-lg text-ink-secondary leading-relaxed max-w-md">
            Upload your resume. AI scores it, rewrites weak spots, and tailors it to any job description — in seconds.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => navigate(isSignedIn ? '/upload' : '/sign-up')}>Upload your resume →</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</Button>
          </div>
          {!isSignedIn && <p className="text-xs text-ink-muted">5 free credits on signup · No credit card required</p>}
        </div>

        {/* Floating score card */}
        <div className="w-72 shrink-0">
          <div className="bg-paper-surface border border-paper-border rounded-xl shadow-elevated p-5 space-y-4 rotate-1">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">ATS Match Score</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-red-500">42</span>
              <span className="text-ink-muted">→</span>
              <span className="font-mono text-2xl font-bold text-green-600">89</span>
              <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full border border-green-200">+47 pts</span>
            </div>
            <p className="text-sm font-semibold text-ink-primary">Google SWE L4 — Tailored</p>
            <div className="h-1.5 bg-paper-bg rounded-full overflow-hidden">
              <div className="h-full w-[89%] bg-gradient-to-r from-indigo-500 to-green-500 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-paper-border bg-paper-surface py-4">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-8 text-sm text-ink-secondary">
          <span><strong className="text-ink-primary font-heading">500+</strong> job seekers</span>
          <span className="text-paper-border-strong">·</span>
          <span><strong className="text-ink-primary font-heading">89%</strong> avg ATS match</span>
          <span className="text-paper-border-strong">·</span>
          <span><strong className="text-ink-primary font-heading">2 min</strong> to tailor</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-20 space-y-12">
        <h2 className="font-heading text-3xl font-bold text-ink-primary text-center">How it works</h2>
        <div className="grid grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Upload your resume', desc: 'Drop your PDF. AI parses it into structured data instantly — no manual typing.' },
            { step: '02', title: 'AI scores and improves', desc: 'See your score, weak bullets highlighted, and AI-rewritten improvements side by side.' },
            { step: '03', title: 'Tailor per job', desc: 'Paste a job description. AI rewrites your resume to match it and shows the before/after score.' },
          ].map(item => (
            <div key={item.step} className="space-y-3">
              <span className="font-mono text-xs font-bold text-indigo-500">{item.step}</span>
              <h3 className="font-heading font-semibold text-lg text-ink-primary">{item.title}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper-surface border-t border-paper-border py-20">
        <div className="max-w-3xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="font-heading text-3xl font-bold text-ink-primary">Simple credit pricing</h2>
            <p className="text-ink-secondary">Start free. Pay only for AI actions. No subscriptions.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Starter', credits: 20, price: '$10', popular: false },
              { name: 'Pro', credits: 50, price: '$20', popular: true },
              { name: 'Max', credits: 120, price: '$40', popular: false },
            ].map(pack => (
              <div key={pack.name} className={`border rounded-xl p-6 space-y-4 ${pack.popular ? 'border-indigo-300 ring-1 ring-indigo-200 bg-white' : 'border-paper-border bg-paper-bg'}`}>
                {pack.popular && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Most Popular</span>}
                <div>
                  <p className="font-heading font-semibold text-ink-primary">{pack.name}</p>
                  <p className="font-mono text-xl font-bold mt-1">{pack.credits} <span className="text-sm font-normal text-ink-muted">credits</span></p>
                </div>
                <p className="font-heading text-2xl font-bold text-indigo-600">{pack.price}</p>
                <Button className="w-full" variant={pack.popular ? 'primary' : 'secondary'} onClick={() => navigate('/sign-up')}>
                  Get started
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-ink-muted">1 credit = score a resume · 2 credits = tailor to a job · Downloads are free</p>
        </div>
      </section>

      {/* CTA footer */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="font-heading text-3xl font-bold text-ink-primary">
          {isSignedIn ? 'Ready to improve your resume?' : 'Start for free today'}
        </h2>
        <p className="text-ink-secondary">
          {isSignedIn ? 'Go to your dashboard or upload a new resume.' : 'Upload your resume. 5 free credits. No credit card needed.'}
        </p>
        <Button size="lg" onClick={() => navigate(isSignedIn ? '/dashboard' : '/sign-up')}>
          {isSignedIn ? 'Go to Dashboard →' : 'Upload your resume →'}
        </Button>
      </section>

      <footer className="border-t border-paper-border py-6 text-center text-xs text-ink-muted">
        © 2026 Resumate. All rights reserved.
      </footer>
    </div>
  );
}
