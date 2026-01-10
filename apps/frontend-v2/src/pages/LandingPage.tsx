import { Button } from "../components/ui/Button";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { useUser } from "@clerk/clerk-react";

export default function LandingPage() {
  const { isSignedIn } = useUser();

  return (
    <div className="container mx-auto px-4 md:px-6 py-20 md:py-32 max-w-6xl">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center space-y-8 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-aurora-teal uppercase tracking-widest mb-6">
            <Sparkles size={12} /> AI-Powered Resume Tailoring
          </span>
          <h1 className="text-5xl md:text-7xl font-serif text-mist-100 mb-6 leading-tight">
            Craft the perfect resume <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-aurora-teal to-aurora-purple animate-gradient">
              in seconds.
            </span>
          </h1>
          <p className="text-mist-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Stop generic applications. Resumate analyzes job descriptions and
            intelligently creates a tailored version of your resume to match
            every opportunity.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex flex-col md:flex-row gap-4 w-full justify-center"
        >
          <Link to={isSignedIn ? "/dashboard" : "/sign-in"}>
            <Button
              size="lg"
              className="h-14 px-8 text-lg shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
            >
              {isSignedIn ? "Go to Dashboard" : "Get Started Free"}{" "}
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </Link>
          <Link to="/features">
            <Button
              variant="secondary"
              size="lg"
              className="h-14 px-8 text-lg border-white/10 hover:bg-white/5"
            >
              View Features
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Feature Grid (Quick Preview) */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <FeatureCard
          title="Smart Matching"
          description="Our AI detects key skills in job descriptions and maps them to your experience."
        />
        <FeatureCard
          title="ATS Friendly"
          description="Generated PDFs are strictly formatted to pass Applicant Tracking Systems."
        />
        <FeatureCard
          title="Version Control"
          description="Keep track of every application and tailored resume version automatically."
        />
      </motion.div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 rounded-[32px] bg-void-900/40 border border-white/5 backdrop-blur-md hover:bg-white/5 transition-colors group">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-aurora-teal mb-6 group-hover:scale-110 transition-transform">
        <CheckCircle2 size={24} />
      </div>
      <h3 className="text-xl font-serif text-mist-100 mb-3">{title}</h3>
      <p className="text-mist-400 leading-relaxed">{description}</p>
    </div>
  );
}
