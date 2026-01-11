import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import api from "../../../lib/api";

interface ResumeData {
  id?: string;
  title: string;
  contact: {
    fullName: string;
    role: string;
    email: string;
    phone: string;
    location: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    year: string;
  }>;
  skills: string[];
}

interface ResumeEditorContextType {
  resumeData: ResumeData;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  updateField: (path: string, value: any) => void;
  addListItem: (path: "experience" | "education", item: any) => void;
  removeListItem: (path: "experience" | "education", index: number) => void;
  saveResume: () => Promise<void>;
}

const ResumeEditorContext = createContext<ResumeEditorContextType | undefined>(
  undefined
);

export const useResumeEditor = () => {
  const context = useContext(ResumeEditorContext);
  if (!context) {
    throw new Error(
      "useResumeEditor must be used within a ResumeEditorProvider"
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
      title: "Untitled Resume",
      contact: { fullName: "", role: "", email: "", phone: "", location: "" },
      summary: "",
      experience: [],
      education: [],
      skills: [],
    }
  );
  const [isLoading, setIsLoading] = useState(!initialData && !!resumeId);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isDirty = useRef(false);

  // Fetch initial data if ID is provided
  useEffect(() => {
    if (resumeId && !initialData) {
      const fetchResume = async () => {
        try {
          const response = await api.get(`/resumes/${resumeId}`);
          if (response.data.success) {
            setResumeData(response.data.data);
          }
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
    if (!resumeId || !isDirty.current) return;

    setIsSaving(true);
    try {
      await api.patch(`/resumes/${resumeId}`, resumeData);
      setLastSaved(new Date());
      isDirty.current = false;
    } catch (error) {
      console.error("Failed to save resume:", error);
    } finally {
      setIsSaving(false);
    }
  }, [resumeId, resumeData]);

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

  const value = {
    resumeData,
    isLoading,
    isSaving,
    lastSaved,
    updateField,
    addListItem,
    removeListItem,
    saveResume,
  };

  return (
    <ResumeEditorContext.Provider value={value}>
      {children}
    </ResumeEditorContext.Provider>
  );
};
