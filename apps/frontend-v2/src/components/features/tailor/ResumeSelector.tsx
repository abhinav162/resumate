import { useState } from "react";
import { Card } from "../../ui/Card";
import { FileText, Plus } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

// Mock data for resumes until backend integration
const MOCK_RESUMES = [
  { id: "1", name: "Software Engineer - General", lastEdited: "2 days ago" },
  { id: "2", name: "Frontend Specialist", lastEdited: "1 week ago" },
];

interface ResumeSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ResumeSelector({ selectedId, onSelect }: ResumeSelectorProps) {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOCK_RESUMES.map((resume) => (
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
                    Edited {resume.lastEdited}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
