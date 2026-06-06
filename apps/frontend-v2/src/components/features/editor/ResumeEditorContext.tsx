import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useCredits } from "../../../contexts/CreditContext";
import { useResume, useCreateResume, useUpdateResume, useScoreResume } from "../../../hooks/useResumes";
import { useTailoredEditorData, useSaveTailoredEditorData } from "../../../hooks/useTailoredResumes";
import type { ResumeData } from "../../../types";

export type Suggestion = {
  bulletId: string;
  original: string;
  rewrite: string;
  issueType: string;
  severity: 'warn' | 'error';
};

export type EditorMode = 'base' | 'tailored';

export type TailoredMeta = {
  jobTitle: string;
  company: string;
  description: string;
  baseResumeId: string;
};

interface ResumeEditorContextType {
  mode: EditorMode;
  tailoredMeta: TailoredMeta | null;
  resumeData: ResumeData;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  updateField: (path: string, value: any) => void;
  addListItem: (path: "experience" | "education" | "projects", item: any) => void;
  removeListItem: (path: "experience" | "education" | "projects", index: number) => void;
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
  mode?: EditorMode;
  children: React.ReactNode;
}> = ({ resumeId, initialData, mode = 'base', children }) => {
  const [tailoredMeta, setTailoredMeta] = useState<TailoredMeta | null>(null);
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
      projects: [],
      skills: [],
    },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [scoring, setScoring] = useState(false);
  const isDirty = useRef(false);
  const currentResumeId = useRef<string | undefined>(resumeId);
  const { refresh: refreshCredits } = useCredits();

  // Cached loaders — only one is enabled depending on editor mode. Loading from
  // a query means an already-cached resume (e.g. opened recently) appears
  // instantly instead of refetching.
  const wantsFetch = !!resumeId && !initialData;
  const baseQuery = useResume(wantsFetch && mode === 'base' ? resumeId : undefined);
  const tailoredQuery = useTailoredEditorData(wantsFetch && mode === 'tailored' ? resumeId : undefined);

  // Mutations (stable mutateAsync refs) — these invalidate the shared resume
  // caches so the dashboard/list reflect edits.
  const { mutateAsync: createResumeAsync } = useCreateResume();
  const { mutateAsync: updateResumeAsync } = useUpdateResume();
  const { mutateAsync: saveTailoredAsync } = useSaveTailoredEditorData();
  const { mutateAsync: scoreResumeAsync } = useScoreResume();

  // Sync ref with prop
  useEffect(() => {
    currentResumeId.current = resumeId;
  }, [resumeId]);

  // Seed the editable draft from the query exactly once per resumeId. Guarding
  // on seededRef means a background refetch (e.g. on window focus) never
  // clobbers in-progress edits.
  const seededRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!wantsFetch || seededRef.current === resumeId) return;
    if (mode === 'tailored') {
      if (tailoredQuery.data) {
        const { data, jobDetails, baseResumeId } = tailoredQuery.data;
        setResumeData({ ...data, projects: data.projects ?? [] });
        setTailoredMeta({ ...jobDetails, baseResumeId });
        isDirty.current = false;
        seededRef.current = resumeId;
      }
    } else if (baseQuery.data) {
      setResumeData({ ...baseQuery.data, projects: baseQuery.data.projects ?? [] });
      setTailoredMeta(null);
      isDirty.current = false;
      seededRef.current = resumeId;
    }
  }, [wantsFetch, resumeId, mode, baseQuery.data, tailoredQuery.data]);

  // Stay loading until the active query has resolved (or errored), so the editor
  // never renders with the default draft while the real resume is still loading.
  // The draft itself is seeded one render later by the effect above; since the
  // form fields (including the title) are controlled, that one-render gap is
  // invisible.
  const activeQuery = mode === 'tailored' ? tailoredQuery : baseQuery;
  const isLoading = wantsFetch && !activeQuery.data && !activeQuery.isError;

  // Save function — routes to base or tailored endpoint based on editor mode
  const saveResume = useCallback(async () => {
    if (!isDirty.current) return currentResumeId.current;

    setIsSaving(true);
    try {
      let finalId = currentResumeId.current;

      if (mode === 'tailored') {
        // Tailored editor never creates new rows — the row exists once /tailor returns.
        if (currentResumeId.current) {
          await saveTailoredAsync({ id: currentResumeId.current, data: resumeData });
        }
      } else if (currentResumeId.current) {
        await updateResumeAsync({ id: currentResumeId.current, data: resumeData });
      } else {
        const created = await createResumeAsync(resumeData);
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
  }, [resumeData, mode, saveTailoredAsync, updateResumeAsync, createResumeAsync]);

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

  const addListItem = (path: "experience" | "education" | "projects", item: any) => {
    setResumeData((prev) => ({
      ...prev,
      [path]: [...(prev[path] ?? []), item],
    }));
    isDirty.current = true;
  };

  const removeListItem = (path: "experience" | "education" | "projects", index: number) => {
    setResumeData((prev) => ({
      ...prev,
      [path]: (prev[path] ?? []).filter((_: any, i: number) => i !== index),
    }));
    isDirty.current = true;
  };

  const triggerScore = async () => {
    if (!resumeId) return;
    setScoring(true);
    try {
      const result = await scoreResumeAsync(resumeId);
      setScore(result.score);
      setSuggestions(result.suggestions ?? []);
      // Scoring spends a credit — refresh the cached balance.
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
      } else if (sectionType === 'projects' && updated.projects?.[sectionIdx]) {
        const proj = { ...updated.projects[sectionIdx] };
        const bullets = Array.isArray(proj.description) ? [...proj.description] : [];
        if (bulletIdx < bullets.length) {
          bullets[bulletIdx] = s.rewrite;
        } else {
          bullets.push(s.rewrite);
        }
        proj.description = bullets;
        updated.projects = updated.projects.map((p: any, i: number) => i === sectionIdx ? proj : p);
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
    mode,
    tailoredMeta,
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
