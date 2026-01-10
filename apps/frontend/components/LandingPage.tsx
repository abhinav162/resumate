import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { Button, Card, Badge, MatchScore } from '../src/components/common';

// ============================================================================
// TYPES
// ============================================================================

interface FAQItem {
  question: string;
  answer: string;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar: string;
}

interface Step {
  number: string;
  title: string;
  description: string;
  terminal: string[];
}

// ============================================================================
// DATA
// ============================================================================

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Will recruiters know my resume was written by AI?',
    answer:
      'No. Our AI rewrites your content in a natural, professional tone that sounds like you at your best. We focus on highlighting your real achievements and skills, not generating fake content.',
  },
  {
    question: 'How is this different from ChatGPT?',
    answer:
      'ChatGPT gives generic advice. Resumate is built specifically for resume tailoring - we understand ATS systems, keyword optimization, and professional resume formatting. Plus, we analyze the specific job description to create a truly tailored resume.',
  },
  {
    question: 'Is my resume data secure?',
    answer:
      'Absolutely. We use bank-level encryption and never share your data with third parties. Your resume content is processed securely and you can delete your data at any time.',
  },
  {
    question: 'What if I want to apply to multiple jobs?',
    answer:
      'Thats exactly what Resumate is built for. Save your base profile once, then generate unlimited tailored versions for different job applications. Each one is optimized for that specific role.',
  },
  {
    question: 'Can I export my resume as a PDF?',
    answer:
      'Yes! Every tailored resume can be exported as a professionally formatted PDF, ready to submit to employers or upload to job application portals.',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Software Engineer',
    company: 'Google',
    content:
      'I was applying to 10+ jobs a week and getting nowhere. After using Resumate, I got 4 interview callbacks in my first week. The ATS optimization actually works.',
    rating: 5,
    avatar: 'SC',
  },
  {
    name: 'Marcus Johnson',
    role: 'Product Manager',
    company: 'Stripe',
    content:
      'The before/after difference was night and day. My resume went from generic to perfectly targeted for each role. Landed my dream job in 3 weeks.',
    rating: 5,
    avatar: 'MJ',
  },
  {
    name: 'Emily Rodriguez',
    role: 'Data Analyst',
    company: 'Netflix',
    content:
      'Finally, a tool that actually understands what hiring managers are looking for. The keyword matching is incredibly smart and natural.',
    rating: 5,
    avatar: 'ER',
  },
];

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Upload Your Resume',
    description: 'Paste or upload your existing resume. Our AI parses your experience, skills, and achievements.',
    terminal: [
      '$ resumate parse --input resume.pdf',
      '> Analyzing document structure...',
      '> Extracting 12 skills, 4 experiences',
      '> Profile ready in 2.3 seconds',
    ],
  },
  {
    number: '02',
    title: 'Add Job Description',
    description: 'Paste the job listing you are targeting. We analyze requirements, keywords, and culture fit.',
    terminal: [
      '$ resumate analyze --job "Senior Engineer"',
      '> Parsing job requirements...',
      '> Found 18 keyword matches',
      '> Identifying skill gaps...',
    ],
  },
  {
    number: '03',
    title: 'Get Tailored Resume',
    description: 'Download your perfectly optimized resume, rewritten to match the job while staying authentic to you.',
    terminal: [
      '$ resumate generate --optimize',
      '> Tailoring content...',
      '> ATS score: 94/100',
      '> Resume ready! Downloading PDF...',
    ],
  },
];

const PAIN_POINTS = [
  'Spending hours customizing each application',
  'Getting ghosted after submitting dozens of resumes',
  'Not knowing what keywords ATS systems are scanning for',
  'Watching less qualified candidates get interviews',
];

const BENEFITS = [
  'AI rewrites bullet points to match job requirements naturally',
  'Keywords are woven into context, not just stuffed in',
  'Maintains your authentic voice and experience',
  'Highlights relevant achievements for each role',
  'Formats perfectly for ATS parsing',
  'Exports to professional PDF in seconds',
];

const COMPANIES = ['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix', 'Stripe', 'Airbnb'];

// ============================================================================
// COMPONENTS
// ============================================================================

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-1">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-amber-400' : 'text-bg-elevated'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const FAQAccordion: React.FC<{ item: FAQItem; isOpen: boolean; onToggle: () => void }> = ({
  item,
  isOpen,
  onToggle,
}) => (
  <div className="border-b border-border last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full py-5 flex items-center justify-between text-left group"
    >
      <span className="font-display font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
        {item.question}
      </span>
      <svg
        className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div
      className={`overflow-hidden transition-all duration-300 ${
        isOpen ? 'max-h-48 pb-5' : 'max-h-0'
      }`}
    >
      <p className="text-text-secondary font-body leading-relaxed">{item.answer}</p>
    </div>
  </div>
);

const TerminalOutput: React.FC<{ lines: string[] }> = ({ lines }) => (
  <div className="bg-bg-primary rounded-lg p-4 font-mono text-sm border border-border">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
      <div className="w-3 h-3 rounded-full bg-rose-500" />
      <div className="w-3 h-3 rounded-full bg-amber-400" />
      <div className="w-3 h-3 rounded-full bg-emerald-500" />
      <span className="ml-2 text-text-tertiary text-xs">terminal</span>
    </div>
    {lines.map((line, i) => (
      <div key={i} className={`${line.startsWith('$') ? 'text-amber-400' : 'text-emerald-400'}`}>
        {line}
      </div>
    ))}
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const LandingPage: React.FC = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-body selection:bg-amber-400 selection:text-text-inverse overflow-x-hidden">
      {/* ================================================================== */}
      {/* NAVIGATION */}
      {/* ================================================================== */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-20">
        <div className="font-display text-2xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <span className="text-text-inverse font-bold text-lg">R</span>
          </div>
          Resumate
        </div>
        <div className="flex items-center gap-4">
          <SignedIn>
            <Link to="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </nav>

      {/* ================================================================== */}
      {/* HERO SECTION */}
      {/* ================================================================== */}
      <header className="container mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32 text-center relative">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-400/10 rounded-full blur-[150px] -z-10" />

        {/* Trust badge */}
        <div className="animate-fade-up">
          <Badge variant="warning" size="md" className="mb-8">
            <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-2" />
            247 resumes tailored in the last 24 hours
          </Badge>
        </div>

        {/* Main headline */}
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-up text-text-primary" style={{ animationDelay: '100ms' }}>
          Stop Getting Rejected
          <br />
          <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
            by ATS Filters
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 font-body leading-relaxed animate-fade-up" style={{ animationDelay: '200ms' }}>
          Tailor your resume to any job description in 30 seconds.
          <br className="hidden md:block" />
          AI-powered rewriting that actually sounds like you.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <SignedIn>
            <Link to="/dashboard">
              <Button variant="primary" size="lg">
                Go to Dashboard
              </Button>
            </Link>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="primary" size="lg">
                Tailor My Resume Free
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
            </SignInButton>
          </SignedOut>
          <Button variant="secondary" size="lg" onClick={() => scrollToSection('how-it-works')}>
            See How It Works
          </Button>
        </div>

        {/* Trust elements */}
        <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-text-tertiary animate-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            No credit card required
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Free forever plan
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Export to PDF
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* PROBLEM/AGITATION SECTION */}
      {/* ================================================================== */}
      <section className="py-20 bg-bg-secondary">
        <div className="container mx-auto px-6">
          {/* Headline */}
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-text-primary">
              You are Doing Everything Right.
              <br />
              <span className="text-text-secondary">But Still Not Hearing Back.</span>
            </h2>
          </div>

          {/* Statistics cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="font-display text-5xl font-bold text-rose-400 mb-2">75%</div>
              <p className="text-text-secondary">of resumes are rejected by ATS before a human ever sees them</p>
            </Card>
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="font-display text-5xl font-bold text-rose-400 mb-2">2+ hrs</div>
              <p className="text-text-secondary">wasted tailoring each application manually</p>
            </Card>
            <Card variant="bordered" padding="lg" className="text-center">
              <div className="font-display text-5xl font-bold text-rose-400 mb-2">100+</div>
              <p className="text-text-secondary">applications before most job seekers get an interview</p>
            </Card>
          </div>

          {/* Pain points */}
          <div className="max-w-2xl mx-auto">
            <div className="space-y-4">
              {PAIN_POINTS.map((point, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-text-secondary font-body">{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Transition */}
          <div className="text-center mt-16">
            <p className="font-display text-xl text-amber-400 italic">There is a better way...</p>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* HOW IT WORKS SECTION */}
      {/* ================================================================== */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-text-primary">
              Three Steps to Your Perfect Resume
            </h2>
            <p className="text-text-secondary text-lg">
              From upload to tailored PDF in under 60 seconds
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-16 max-w-4xl mx-auto">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 items-center`}
              >
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center">
                      <span className="font-display font-bold text-text-inverse">{step.number}</span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-text-primary">{step.title}</h3>
                  </div>
                  <p className="text-text-secondary font-body leading-relaxed mb-6">{step.description}</p>
                </div>

                {/* Terminal */}
                <div className="flex-1 w-full">
                  <TerminalOutput lines={step.terminal} />
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="primary" size="lg">
                  Try It Now - It is Free
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard">
                <Button variant="primary" size="lg">
                  Go to Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SOCIAL PROOF SECTION */}
      {/* ================================================================== */}
      <section className="py-24 bg-bg-secondary">
        <div className="container mx-auto px-6">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            <Card variant="glass" padding="md" className="text-center">
              <div className="font-display text-3xl font-bold text-amber-400 mb-1">12,847</div>
              <p className="text-text-tertiary text-sm">Resumes Tailored</p>
            </Card>
            <Card variant="glass" padding="md" className="text-center">
              <div className="font-display text-3xl font-bold text-emerald-400 mb-1">89%</div>
              <p className="text-text-tertiary text-sm">Interview Callback Rate</p>
            </Card>
            <Card variant="glass" padding="md" className="text-center">
              <div className="font-display text-3xl font-bold text-amber-400 mb-1">32 sec</div>
              <p className="text-text-tertiary text-sm">Avg. Time to Tailor</p>
            </Card>
            <Card variant="glass" padding="md" className="text-center">
              <div className="font-display text-3xl font-bold text-emerald-400 mb-1">94/100</div>
              <p className="text-text-tertiary text-sm">Avg. ATS Score</p>
            </Card>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} variant="default" padding="lg" hover>
                <StarRating rating={testimonial.rating} />
                <p className="text-text-secondary font-body leading-relaxed my-4">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <span className="font-display font-bold text-amber-400 text-sm">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <div className="font-display font-semibold text-text-primary">{testimonial.name}</div>
                    <div className="text-text-tertiary text-sm">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Companies */}
          <div className="text-center">
            <p className="text-text-tertiary text-sm mb-6">Our users have landed roles at</p>
            <div className="flex flex-wrap justify-center items-center gap-8">
              {COMPANIES.map((company, i) => (
                <span key={i} className="font-display text-lg text-text-tertiary/60 hover:text-text-secondary transition-colors">
                  {company}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* BENEFITS SECTION */}
      {/* ================================================================== */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-text-primary">
                Professional Rewriting,
                <br />
                <span className="text-amber-400">Not Just Keywords</span>
              </h2>
              <p className="text-text-secondary font-body mb-8 leading-relaxed">
                Our AI does not just stuff keywords into your resume. It professionally rewrites
                your experience to highlight the skills and achievements that matter most for each role.
              </p>

              {/* Benefits list */}
              <div className="space-y-4">
                {BENEFITS.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-text-secondary font-body">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo / Before-After */}
            <div className="space-y-6">
              {/* Before */}
              <Card variant="bordered" padding="md">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="error" size="sm">Before</Badge>
                  <span className="text-text-tertiary text-sm">Generic resume</span>
                </div>
                <div className="font-mono text-sm text-text-secondary bg-bg-primary p-4 rounded-lg border border-border">
                  <p className="mb-2 text-text-tertiary">Experience:</p>
                  <p>- Worked on various projects</p>
                  <p>- Used different technologies</p>
                  <p>- Helped with team tasks</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <MatchScore score={42} size="sm" animated={false} />
                  <span className="text-rose-400 text-sm">Low ATS Match</span>
                </div>
              </Card>

              {/* After */}
              <Card variant="default" padding="md" className="border-2 border-amber-400/30 shadow-amber-glow">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="success" size="sm">After</Badge>
                  <span className="text-text-tertiary text-sm">Tailored for Senior Engineer role</span>
                </div>
                <div className="font-mono text-sm text-text-secondary bg-bg-primary p-4 rounded-lg border border-border">
                  <p className="mb-2 text-text-tertiary">Experience:</p>
                  <p>- Led development of <span className="text-amber-400">microservices architecture</span> serving 2M+ users</p>
                  <p>- Implemented <span className="text-amber-400">CI/CD pipelines</span> reducing deployment time by 60%</p>
                  <p>- Mentored team of 5 engineers on <span className="text-amber-400">React</span> and <span className="text-amber-400">TypeScript</span> best practices</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <MatchScore score={94} size="sm" animated={false} />
                  <span className="text-emerald-400 text-sm">Excellent ATS Match</span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ SECTION */}
      {/* ================================================================== */}
      <section className="py-24 bg-bg-secondary">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-text-primary">
              Frequently Asked Questions
            </h2>
            <p className="text-text-secondary">
              Everything you need to know about Resumate
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card variant="default" padding="lg">
              {FAQ_ITEMS.map((item, i) => (
                <FAQAccordion
                  key={i}
                  item={item}
                  isOpen={openFAQ === i}
                  onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
                />
              ))}
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FINAL CTA SECTION */}
      {/* ================================================================== */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <Card variant="glass" padding="lg" className="text-center relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent" />

            <div className="relative z-10">
              {/* Urgency */}
              <Badge variant="success" className="mb-6">
                <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-2" />
                127 people signed up in the last 24 hours
              </Badge>

              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-text-primary">
                Your Next Interview is
                <br />
                <span className="text-amber-400">One Tailored Resume Away</span>
              </h2>

              <p className="text-text-secondary text-lg max-w-xl mx-auto mb-8">
                Join thousands of job seekers who stopped guessing and started getting callbacks.
              </p>

              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="primary" size="lg" className="shadow-lg shadow-amber-400/30">
                    Start Tailoring My Resume
                    <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link to="/dashboard">
                  <Button variant="primary" size="lg" className="shadow-lg shadow-amber-400/30">
                    Go to Dashboard
                  </Button>
                </Link>
              </SignedIn>

              {/* Trust reinforcement */}
              <p className="text-text-tertiary text-sm mt-6">
                Free forever. No credit card required. Cancel anytime.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FOOTER */}
      {/* ================================================================== */}
      <footer className="border-t border-border bg-bg-secondary py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo */}
            <div className="font-display text-xl font-bold text-text-primary flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-400 flex items-center justify-center">
                <span className="text-text-inverse font-bold text-sm">R</span>
              </div>
              Resumate
            </div>

            {/* Copyright */}
            <div className="text-text-tertiary text-sm">
              &copy; {new Date().getFullYear()} Resumate. All rights reserved.
            </div>

            {/* Links */}
            <div className="flex gap-6 text-text-secondary text-sm">
              <a href="#" className="hover:text-amber-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
