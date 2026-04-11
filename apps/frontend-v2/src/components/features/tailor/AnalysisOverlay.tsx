import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

interface AnalysisOverlayProps {
  isVisible: boolean;
  onComplete: () => void;
}

const STEPS = [
  "Parsing Job Description Keywords...",
  "Analyzing Resume Experience...",
  "Mapping Skills to Requirements...",
  "Optimizing ATS Compatibility...",
  "Finalizing Tailored Resume...",
];

export function AnalysisOverlay({
  isVisible,
  onComplete,
}: AnalysisOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isVisible && currentStep < STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 1500); // Simulate processing time per step
      return () => clearTimeout(timer);
    } else if (isVisible && currentStep === STEPS.length) {
      setTimeout(onComplete, 1000); // Wait a bit after last step before completing
    }
  }, [isVisible, currentStep, onComplete]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/90 backdrop-blur-xl"
    >
      <div className="w-full max-w-md p-8 text-center">
        <div className="mb-8 relative flex justify-center">
          <div className="absolute inset-0 bg-aurora-teal/20 blur-xl rounded-full animate-pulse"></div>
          <Loader2 className="relative z-10 w-16 h-16 text-aurora-teal animate-spin" />
        </div>

        <h2 className="text-2xl font-serif text-mist-100 mb-6">
          Tailoring your application
        </h2>

        <div className="space-y-4 text-left">
          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: index <= currentStep ? 1 : 0.3,
                x: 0,
                scale: index === currentStep ? 1.05 : 1,
              }}
              className={clsx(
                "flex items-center gap-3 text-sm font-medium transition-colors",
                index < currentStep
                  ? "text-aurora-teal"
                  : index === currentStep
                  ? "text-mist-100"
                  : "text-mist-400"
              )}
            >
              {index < currentStep ? (
                <CheckCircle2 size={18} />
              ) : (
                <div
                  className={clsx(
                    "w-4 h-4 rounded-full border-2",
                    index === currentStep
                      ? "border-mist-100 border-t-transparent animate-spin"
                      : "border-mist-400"
                  )}
                />
              )}
              {step}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
