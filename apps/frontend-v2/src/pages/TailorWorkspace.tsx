import { useState } from "react";
import { motion } from "framer-motion";
import { ResumeSelector } from "../components/features/tailor/ResumeSelector";
import { JobDescriptionInput } from "../components/features/tailor/JobDescriptionInput";
import { Button } from "../components/ui/Button";
import { Sparkles, ArrowRight } from "lucide-react";

export default function TailorWorkspace() {
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");

  const canStart = selectedResumeId && jobDescription.length > 20;

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl md:text-5xl font-serif text-mist-100 mb-4">
          Tailor your Application
        </h1>
        <p className="text-mist-400 text-lg max-w-2xl mx-auto">
          Select a base resume and paste the job description. Our AI will
          optimize your keywords and relevance.
        </p>
      </motion.div>

      <div className="space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ResumeSelector
            selectedId={selectedResumeId}
            onSelect={setSelectedResumeId}
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <JobDescriptionInput
            label="Target Job Description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </motion.section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center pt-8"
        >
          <Button
            size="lg"
            className={clsx(
              "w-full max-w-sm text-lg gap-2 shadow-2xl shadow-aurora-purple/20 transition-all duration-500",
              canStart
                ? "opacity-100 translate-y-0"
                : "opacity-50 grayscale cursor-not-allowed"
            )}
            disabled={!canStart}
          >
            <Sparkles size={20} className={canStart ? "animate-pulse" : ""} />
            <span>Start Optimization</span>
            <ArrowRight
              size={20}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// Helper to avoid clsx import error in Button scope if previously missed,
// though standard practice is to let Button handle its own disabled state visually.
// Added simple inline helper logic for this demo page.
function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
