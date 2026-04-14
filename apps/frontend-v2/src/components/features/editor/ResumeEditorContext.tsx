import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { resumesApi } from "../../../lib/api";
import { useCredits } from "../../../contexts/CreditContext";
import type { ResumeData } from "../../../types";

export type Suggestion = {
  bulletId: string;
  original: string;
  rewrite: string;
  issueType: string;
  severity: 'warn' | 'error';
};

interface ResumeEditorContextType {
  resumeData: ResumeData;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  updateField: (path: string, value: any) => void;
  addListItem: (path: "experience" | "education", item: any) => void;
  removeListItem: (path: "experience" | "education", index: number) => void;
  saveResume: () => Promise<string | undefined>;
  setResumeData: React.Dispatch<React.SetStateAction<ResumeData>>;
  score: number | null;
  suggestions: Suggestion[];
  scoring: boolean;
  triggerScore: () => Promise<void>;
  acceptSuggestion: (bulletId: string) => void;
  dismissSuggestion: (bulletId: string) => void;
}

const ResumeEditorContext = createContext<ResumeEditorContextType | undefined>(
  undefined,
);

export const useResumeEditor = () => {
  const context = useContext(ResumeEditorContext);
  if (!context) {
    throw new Error(
      "useResumeEditor must be used within a ResumeEditorProvider",
    );
  }
  return context;
};

export const ResumeEditorProvider: React.FC<{
  resumeId?: string;
  initialData?: ResumeData;
  children: React.ReactNode;
}> = ({ resumeId, initialData, children }) => {
  const [resumeData, setResumeData] = useState<ResumeData>(
    initialData || {
      title: "New Resume",
      contact: {
        fullName: "",
        role: "",
        email: "",
        phone: "",
        location: "",
        linkedin: "",
        github: "",
        website: "",
      },
      summary: "",
      experience: [],
      education: [],
      skills: [],
    },
  );
  const [isLoading, setIsLoading] = useState(!!resumeId && !initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [scoring, setScoring] = useState(false);
  const isDirty = useRef(false);
  const currentResumeId = useRef<string | undefined>(resumeId);
  const { refresh: refreshCredits } = useCredits();

  // Sync ref with prop
  useEffect(() => {
    currentResumeId.current = resumeId;
  }, [resumeId]);

  // Fetch initial data if ID is provided
  useEffect(() => {
    if (resumeId && !initialData) {
      const fetchResume = async () => {
        setIsLoading(true);
        try {
          const data = await resumesApi.getResume(resumeId);
          setResumeData(data);
          isDirty.current = false;
        } catch (error) {
          console.error("Failed to fetch resume:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchResume();
    }
  }, [resumeId, initialData]);

  // Save function
  const saveResume = useCallback(async () => {
    if (!isDirty.current) return currentResumeId.current;

    setIsSaving(true);
    try {
      let finalId = currentResumeId.current;
      if (currentResumeId.current) {
        await resumesApi.updateResume(currentResumeId.current, resumeData);
      } else {
        const created = await resumesApi.createResume(resumeData);
        currentResumeId.current = created.id;
        finalId = created.id;
      }
      setLastSaved(new Date());
      isDirty.current = false;
      return finalId;
    } catch (error) {
      console.error("Failed to save resume:", error);
      return undefined;
    } finally {
      setIsSaving(false);
    }
  }, [resumeData]);

  // Debounced save using useEffect
  useEffect(() => {
    if (!isDirty.current) return;

    const timer = setTimeout(() => {
      saveResume();
    }, 2000);

    return () => clearTimeout(timer);
  }, [resumeData, saveResume]);

  const updateField = (path: string, value: any) => {
    setResumeData((prev) => {
      const newData = { ...prev };
      const keys = path.split(".");
      let current: any = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      isDirty.current = true;
      return newData;
    });
  };

  const addListItem = (path: "experience" | "education", item: any) => {
    setResumeData((prev) => ({
      ...prev,
      [path]: [...prev[path], item],
    }));
    isDirty.current = true;
  };

  const removeListItem = (path: "experience" | "education", index: number) => {
    setResumeData((prev) => ({
      ...prev,
      [path]: prev[path].filter((_, i) => i !== index),
    }));
    isDirty.current = true;
  };

  const triggerScore = async () => {
    if (!resumeId) return;
    setScoring(true);
    try {
      const result = await resumesApi.scoreResume(resumeId);
      setScore(result.score);
      setSuggestions(result.suggestions ?? []);
      await refreshCredits();
    } finally {
      setScoring(false);
    }
  };

  const acceptSuggestion = (bulletId: string) => {
    const s = suggestions.find(s => s.bulletId === bulletId);
    if (!s) return;
    // bulletId format: "experience-0-1" → sectionType, sectionIndex, bulletIndex
    const parts = bulletId.split('-');
    const sectionType = parts[0]; // "experience"
    const sectionIdx = parseInt(parts[1], 10);
    const bulletIdx = parseInt(parts[2], 10);

    setResumeData((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (sectionType === 'experience' && updated.experience?.[sectionIdx]) {
        const exp = { ...updated.experience[sectionIdx] };
        // Frontend stores description as a newline-joined string; split, replace, rejoin
        const bullets = (exp.description || '').split('\n').filter(Boolean);
        if (bulletIdx < bullets.length) {
          bullets[bulletIdx] = s.rewrite;
        } else {
          bullets.push(s.rewrite);
        }
        exp.description = bullets.join('\n');
        updated.experience = updated.experience.map((e: any, i: number) => i === sectionIdx ? exp : e);
      }
      return updated;
    });
    isDirty.current = true;
    setSuggestions(prev => prev.filter(s => s.bulletId !== bulletId));
  };

  const dismissSuggestion = (bulletId: string) => {
    setSuggestions(prev => prev.filter(s => s.bulletId !== bulletId));
  };

  const value = {
    resumeData,
    isLoading,
    isSaving,
    lastSaved,
    updateField,
    addListItem,
    removeListItem,
    saveResume,
    setResumeData,
    score,
    suggestions,
    scoring,
    triggerScore,
    acceptSuggestion,
    dismissSuggestion,
  };

  return (
    <ResumeEditorContext.Provider value={value}>
      {children}
    </ResumeEditorContext.Provider>
  );
};
