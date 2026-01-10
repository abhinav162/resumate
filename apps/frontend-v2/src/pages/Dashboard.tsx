import { AppLayout } from "../layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="mb-16">
          <h1 className="text-4xl md:text-6xl font-serif font-light mb-6 text-mist-100 leading-tight">
            Welcome back, <br />
            <span className="italic text-mist-400">Alexander</span>
          </h1>
          <p className="text-mist-400 text-lg md:text-xl max-w-xl font-light">
            You have <span className="font-mono text-aurora-teal">3</span>{" "}
            drafts pending. Ready to tailor your next application?
          </p>
        </header>

        {/* Main Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Main Action Card */}
          <Card
            hoverEffect
            className="col-span-1 lg:col-span-1 border-white/10 shadow-2xl shadow-void-950/50"
          >
            <div className="flex flex-col h-full items-start">
              <div className="mb-auto">
                <h3 className="text-2xl font-serif mb-2 text-mist-100">
                  Tailor New Resume
                </h3>
                <p className="text-sm text-mist-400 leading-relaxed max-w-[24ch]">
                  Paste a JD, select a base resume, and let our AI optimize
                  keywords.
                </p>
              </div>

              <Button className="mt-8 gap-2 group">
                Start Processing
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70 group-hover:translate-x-1 transition-transform"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            </div>
          </Card>

          {/* Stats Card */}
          <Card hoverEffect>
            <div>
              <h3 className="text-xl font-serif mb-1 text-mist-100">
                Velocity
              </h3>
              <p className="text-xs font-mono text-mist-400 uppercase tracking-widest">
                Applications / Week
              </p>
            </div>
            <div className="mt-8">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-mono text-aurora-teal font-light">
                  12
                </span>
                <span className="text-sm text-mist-400">+2 from last week</span>
              </div>
            </div>
          </Card>

          {/* Recent Activity Mini-List */}
          <Card>
            <h3 className="text-xl font-serif mb-6 text-mist-100">
              Recent Tailors
            </h3>
            <div className="space-y-4">
              {[
                { role: "Senior React Dev", company: "Google", date: "2h ago" },
                {
                  role: "Frontend Architect",
                  company: "Linear",
                  date: "1d ago",
                },
                { role: "UX Engineer", company: "Stripe", date: "3d ago" },
              ].map((job, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div>
                    <div className="text-mist-100 font-medium text-sm group-hover:text-aurora-purple transition-colors">
                      {job.role}
                    </div>
                    <div className="text-xs text-mist-400">{job.company}</div>
                  </div>
                  <div className="text-xs font-mono text-mist-400">
                    {job.date}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}
