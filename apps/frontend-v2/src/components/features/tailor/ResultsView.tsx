import { motion } from "framer-motion";
import { Button } from "../../ui/Button";
import { Download, ArrowLeft, Star } from "lucide-react";

interface ResultsViewProps {
  onReset: () => void;
  result?: any; // The full tailored resume result
}

export function ResultsView({ onReset, result }: ResultsViewProps) {
  // Temporary: Log result to suppress unused variable warning during dev
  if (result) console.log("Tailoring Result:", result);

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {/* Left Column: Success & Score */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-8 rounded-[32px] bg-void-900/40 border border-white/5 backdrop-blur-xl text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-aurora-teal/10 text-aurora-teal mb-4 border border-aurora-teal/20 shadow-[0_0_30px_rgba(20,184,166,0.1)]">
              <Star size={32} fill="currentColor" />
            </div>
            <h2 className="text-4xl font-serif text-mist-100 mb-2">95%</h2>
            <p className="text-mist-400 text-sm font-mono uppercase tracking-wider">
              Match Score
            </p>

            <div className="my-6 border-t border-white/10" />

            <p className="text-mist-400 text-sm leading-relaxed mb-6">
              Your resume has been successfully tailored to highlight{" "}
              <strong>12 matching keywords</strong> from the job description.
            </p>

            <Button className="w-full gap-2 shadow-lg shadow-aurora-teal/10">
              <Download size={18} /> Download PDF
            </Button>
          </div>

          <Button variant="ghost" className="w-full" onClick={onReset}>
            <ArrowLeft size={18} className="mr-2" /> Start New Application
          </Button>
        </div>

        {/* Right Column: Preview (Mock PDF) */}
        <div className="lg:col-span-2">
          <div className="aspect-[1/1.4] bg-white rounded-[4px] shadow-2xl opacity-90 hover:opacity-100 transition-opacity relative overflow-hidden group">
            {/* Mock Resume Content Structure */}
            <div className="p-12 space-y-8 pointer-events-none select-none">
              <div className="h-8 w-1/3 bg-gray-800 rounded mb-8" />

              <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 rounded" />
                <div className="h-4 w-full bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
              </div>

              <div className="grid grid-cols-3 gap-8 mt-12">
                <div className="col-span-1 space-y-4">
                  <div className="h-4 w-full bg-blue-100 rounded" />
                  <div className="h-4 w-full bg-blue-100 rounded" />
                  <div className="h-4 w-full bg-blue-100 rounded" />
                </div>
                <div className="col-span-2 space-y-4">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-5/6 bg-gray-100 rounded" />
                </div>
              </div>
            </div>

            {/* Overlay Hint */}
            <div className="absolute inset-0 bg-void-950/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="secondary" className="shadow-2xl">
                Preview Full Document
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
