import { FileText, Plus } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useResumes } from "../../../hooks/useResumes";

interface Resume {
  id: string;
  name: string;
  updatedAt: string;
}

interface ResumeSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ResumeSelector({ selectedId, onSelect }: ResumeSelectorProps) {
  // Shared cache with the Dashboard / Tailor workspace — no duplicate fetch.
  const { data, isLoading: loading } = useResumes();
  const resumes = (data ?? []) as Resume[];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-medium text-mist-400 font-mono uppercase tracking-wider">
          Select Base Resume
        </label>
        <button className="text-xs text-aurora-teal hover:text-aurora-teal/80 transition-colors flex items-center gap-1">
          <Plus size={14} /> New Resume
        </button>
      </div>

      {loading ? (
        <div className="flex gap-4">
          <div className="h-20 w-64 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-20 w-64 bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : resumes.length === 0 ? (
        <div className="p-6 rounded-2xl bg-void-950/30 border border-white/5 text-center text-mist-400">
          No resumes found. Please create one in the Dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <motion.div
              key={resume.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                onClick={() => onSelect(resume.id)}
                className={clsx(
                  "cursor-pointer relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
                  selectedId === resume.id
                    ? "bg-white/5 border-aurora-teal shadow-[0_0_20px_rgba(20,184,166,0.1)]"
                    : "bg-void-900/40 border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      "p-2 rounded-lg",
                      selectedId === resume.id
                        ? "bg-aurora-teal/20 text-aurora-teal"
                        : "bg-white/5 text-mist-400"
                    )}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3
                      className={clsx(
                        "text-sm font-medium mb-1",
                        selectedId === resume.id
                          ? "text-mist-100"
                          : "text-mist-400"
                      )}
                    >
                      {resume.name}
                    </h3>
                    <p className="text-xs text-mist-400/60 font-mono">
                      Edited {new Date(resume.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
