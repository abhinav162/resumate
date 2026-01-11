import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { EditorLayout } from "../../../layouts/EditorLayout";
import { Button } from "../../ui/Button";
import { ResumeEditorProvider, useResumeEditor } from "./ResumeEditorContext";
import { generateLatexPdf } from "../../../services/latexService";
import type { ResumeData } from "../../../types";
import {
  User,
  Briefcase,
  GraduationCap,
  Code,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  LayoutDashboard,
  Wand2,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { id: "contact", label: "Contact", icon: <User size={18} /> },
  { id: "experience", label: "Experience", icon: <Briefcase size={18} /> },
  { id: "education", label: "Education", icon: <GraduationCap size={18} /> },
  { id: "skills", label: "Skills", icon: <Code size={18} /> },
  { id: "summary", label: "Summary", icon: <FileText size={18} /> },
  { id: "tailor", label: "AI Tailor", icon: <Wand2 size={18} /> },
];

export function AuroraWorkbenchEditor() {
  const { id } = useParams<{ id: string }>();

  return (
    <ResumeEditorProvider resumeId={id}>
      <AuroraWorkbenchInner />
    </ResumeEditorProvider>
  );
}

function AuroraWorkbenchInner() {
  const { resumeData, isSaving, lastSaved, isLoading, setResumeData } =
    useResumeEditor();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [geminiKey, setGeminiKey] = useState(
    localStorage.getItem("gemini_api_key") || ""
  );
  const [jobDetails, setJobDetails] = useState({
    jobTitle: "",
    company: "",
    description: "",
  });

  const currentStep = STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === STEPS.length - 1;

  const nextStep = () =>
    setCurrentStepIndex(Math.min(STEPS.length - 1, currentStepIndex + 1));
  const prevStep = () => setCurrentStepIndex(Math.max(0, currentStepIndex - 1));

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await generateLatexPdf(resumeData);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resumeData.title || "resume"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export PDF. Please try again later.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleTailor = async () => {
    if (!geminiKey) {
      alert("Please provide a Gemini API Key first.");
      return;
    }
    if (
      !jobDetails.jobTitle ||
      !jobDetails.company ||
      !jobDetails.description
    ) {
      alert("Please fill in all job details.");
      return;
    }

    setIsTailoring(true);
    try {
      localStorage.setItem("gemini_api_key", geminiKey);

      const { aiApi } = await import("../../../lib/api");
      const tailoredResume = await aiApi.tailorResume({
        resumeData,
        jobDetails,
        apiKey: geminiKey,
      });

      setResumeData(tailoredResume);
      alert("Resume tailored successfully! Preview updated.");
    } catch (error: any) {
      console.error("Tailoring failed:", error);
      alert(`Optimization failed: ${error.message}`);
    } finally {
      setIsTailoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-void-950">
        <Loader2 className="w-8 h-8 text-aurora-teal animate-spin" />
      </div>
    );
  }

  return (
    <EditorLayout
      title={resumeData.title}
      onExport={handleExport}
      isExporting={isExporting}
      actions={
        <div className="flex items-center gap-2 mr-4">
          {isSaving ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5">
              <Loader2 size={12} className="animate-spin text-aurora-teal" />
              <span className="text-[10px] text-mist-400 uppercase tracking-wider font-mono">
                Saving...
              </span>
            </div>
          ) : lastSaved ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5">
              <CheckCircle2 size={12} className="text-aurora-teal" />
              <span className="text-[10px] text-mist-400 uppercase tracking-wider font-mono">
                Saved{" "}
                {lastSaved.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ) : null}
        </div>
      }
    >
      {/* 1. Left Rail: Navigation */}
      <div className="w-16 bg-void-950 border-r border-white/10 flex flex-col items-center py-4 gap-4 z-20">
        <div className="flex flex-col items-center gap-4 flex-1">
          {STEPS.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(index)}
                className={`
                              relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group
                              ${
                                isActive
                                  ? "bg-aurora-teal text-void-950 shadow-[0_0_10px_rgba(20,184,166,0.3)]"
                                  : "text-mist-400 hover:text-mist-100 hover:bg-white/5"
                              }
                          `}
              >
                {step.icon}

                {/* Tooltip */}
                <div className="absolute left-14 bg-void-900 border border-white/10 px-2 py-1 rounded text-[10px] uppercase tracking-wider text-mist-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                  {step.label}
                </div>

                {/* Status Dot */}
                {isCompleted && !isActive && (
                  <div className="absolute -top-1 -right-1 text-aurora-teal bg-void-950 rounded-full">
                    <CheckCircle2
                      size={12}
                      fill="currentColor"
                      className="text-aurora-teal"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Navigation (Bottom of Rail) */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5 mt-auto">
          <Link
            to="/dashboard"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-mist-400 hover:text-mist-100 hover:bg-white/5 transition-all group relative"
          >
            <LayoutDashboard size={18} />
            <div className="absolute left-14 bg-void-900 border border-white/10 px-2 py-1 rounded text-[10px] uppercase tracking-wider text-mist-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
              Dashboard
            </div>
          </Link>
          <Link
            to="/tailor"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-mist-400 hover:text-mist-100 hover:bg-white/5 transition-all group relative"
          >
            <Wand2 size={18} />
            <div className="absolute left-14 bg-void-900 border border-white/10 px-2 py-1 rounded text-[10px] uppercase tracking-wider text-mist-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
              Tailor
            </div>
          </Link>
          <div className="pt-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "w-8 h-8 rounded-lg border border-white/10 overflow-hidden",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Middle Panel: The Editor (Input) */}
      <div className="w-[40%] min-w-[400px] max-w-[600px] bg-void-950 flex flex-col border-r border-white/10 relative z-10">
        {/* Rigid Header for Step */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-void-950/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-lg font-bold text-mist-100 flex items-center gap-2">
            <span className="text-aurora-teal opacity-50 font-mono text-sm">
              0{currentStepIndex + 1}.
            </span>
            {currentStep.label}
          </h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={isFirst}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextStep}
              disabled={isLast}
              className="h-8 w-8 p-0"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {currentStep.id === "contact" && <ContactForm />}
              {currentStep.id === "experience" && <ExperienceForm />}
              {currentStep.id === "education" && <EducationForm />}
              {currentStep.id === "skills" && <SkillsForm />}
              {currentStep.id === "summary" && <SummaryForm />}
              {currentStep.id === "tailor" && (
                <AITailorForm
                  geminiKey={geminiKey}
                  setGeminiKey={setGeminiKey}
                  jobDetails={jobDetails}
                  setJobDetails={setJobDetails}
                  onTailor={handleTailor}
                  isTailoring={isTailoring}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-white/10 bg-void-950">
          {!isLast ? (
            <Button
              onClick={nextStep}
              className="w-full bg-white/5 text-mist-200 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest h-10 gap-2"
            >
              Continue to {STEPS[currentStepIndex + 1].label}
              <ChevronRight size={14} />
            </Button>
          ) : (
            <div className="flex items-center justify-center h-10 px-4 text-[10px] text-mist-500 uppercase tracking-widest font-mono">
              Final Optimization Step
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Panel: The Preview (Output) */}
      <div className="flex-1 bg-void-900 overflow-hidden relative flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center justify-end px-4 gap-2 text-xs text-mist-400 bg-void-900/50">
          <span>View Mode:</span>
          <select className="bg-void-950 border border-white/10 rounded px-2 py-1 focus:outline-none">
            <option>A4 Page</option>
            <option>Full Width</option>
          </select>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <button className="hover:text-white">Fit</button>
          <button className="hover:text-white">100%</button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100">
          {/* The "Paper" */}
          <div className="w-[210mm] min-h-[297mm] bg-white text-black shadow-2xl origin-top transition-transform duration-300 transform scale-[0.85] md:scale-[0.9] lg:scale-[1]">
            <ResumePreviewMock resumeData={resumeData} />
          </div>
        </div>
      </div>
    </EditorLayout>
  );
}

// -- Sub-Components for Forms (Dense Style) --

function EducationForm() {
  const { resumeData, updateField, addListItem, removeListItem } =
    useResumeEditor();

  const handleUpdate = (index: number, field: string, value: any) => {
    const newEdu = [...resumeData.education];
    newEdu[index] = { ...newEdu[index], [field]: value };
    updateField("education", newEdu);
  };

  return (
    <div className="space-y-6">
      {resumeData.education.map((edu: any, i: number) => (
        <div
          key={i}
          className="group relative border border-white/5 bg-white/[0.02] rounded-lg p-4 hover:border-white/10 transition-colors"
        >
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
            <button
              onClick={() => removeListItem("education", i)}
              className="text-mist-500 hover:text-red-400 p-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 mb-3">
            <DenseInput
              label="School / University"
              value={edu.school}
              onChange={(e: any) => handleUpdate(i, "school", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <DenseInput
                label="Degree"
                value={edu.degree}
                onChange={(e: any) => handleUpdate(i, "degree", e.target.value)}
              />
              <DenseInput
                label="Year"
                value={edu.year}
                onChange={(e: any) => handleUpdate(i, "year", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          addListItem("education", { school: "", degree: "", year: "" })
        }
        className="w-full border-dashed border-white/20 text-mist-400 hover:text-aurora-teal hover:border-aurora-teal py-6 flex flex-col gap-1 h-auto"
      >
        <Plus size={20} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Add Education
        </span>
      </Button>
    </div>
  );
}

function SkillsForm() {
  const { resumeData, updateField } = useResumeEditor();

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-lg">
        <label className="block text-[10px] font-mono text-mist-400 mb-3 uppercase tracking-wider">
          Technical Skills (Comma Separated)
        </label>
        <textarea
          className="w-full bg-void-900 border border-white/10 rounded px-3 py-2 text-mist-100 text-sm focus:outline-none focus:border-aurora-teal/50 focus:bg-void-950 transition-all min-h-[150px] resize-y"
          value={resumeData.skills.join(", ")}
          onChange={(e) =>
            updateField(
              "skills",
              e.target.value.split(",").map((s) => s.trim())
            )
          }
          placeholder="React, TypeScript, Node.js..."
        />
      </div>
      <p className="text-[10px] text-mist-500 italic px-2">
        Separate skills with commas. They will be formatted automatically in the
        preview.
      </p>
    </div>
  );
}

function SummaryForm() {
  const { resumeData, updateField } = useResumeEditor();

  return (
    <div className="space-y-4">
      <DenseInput
        label="Professional Summary"
        isTextArea
        className="h-64"
        value={resumeData.summary}
        onChange={(e: any) => updateField("summary", e.target.value)}
        placeholder="Write a brief overview of your professional background and key achievements..."
      />
    </div>
  );
}

function ContactForm() {
  const { resumeData, updateField } = useResumeEditor();
  const contact = resumeData.contact;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <DenseInput
          label="First Name"
          value={contact.fullName.split(" ")[0] || ""}
          onChange={(e: any) =>
            updateField(
              "contact.fullName",
              `${e.target.value} ${contact.fullName.split(" ")[1] || ""}`
            )
          }
        />
        <DenseInput
          label="Last Name"
          value={contact.fullName.split(" ")[1] || ""}
          onChange={(e: any) =>
            updateField(
              "contact.fullName",
              `${contact.fullName.split(" ")[0] || ""} ${e.target.value}`
            )
          }
        />
      </div>
      <DenseInput
        label="Target Role"
        value={contact.role}
        onChange={(e: any) => updateField("contact.role", e.target.value)}
      />
      <DenseInput
        label="Email Address"
        value={contact.email}
        onChange={(e: any) => updateField("contact.email", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <DenseInput
          label="Phone"
          value={contact.phone}
          onChange={(e: any) => updateField("contact.phone", e.target.value)}
        />
        <DenseInput
          label="Location"
          value={contact.location}
          onChange={(e: any) => updateField("contact.location", e.target.value)}
        />
      </div>

      <div className="h-px bg-white/5 my-4" />

      <div className="space-y-4">
        <DenseInput
          label="LinkedIn URL"
          value={contact.linkedin || ""}
          onChange={(e: any) => updateField("contact.linkedin", e.target.value)}
          placeholder="linkedin.com/in/username"
        />
        <DenseInput
          label="GitHub URL"
          value={contact.github || ""}
          onChange={(e: any) => updateField("contact.github", e.target.value)}
          placeholder="github.com/username"
        />
        <DenseInput
          label="Portfolio / Website"
          value={contact.website || ""}
          onChange={(e: any) => updateField("contact.website", e.target.value)}
          placeholder="yourwebsite.com"
        />
      </div>
    </div>
  );
}

function ExperienceForm() {
  const { resumeData, updateField, addListItem, removeListItem } =
    useResumeEditor();

  const handleUpdate = (index: number, field: string, value: any) => {
    const newExp = [...resumeData.experience];
    newExp[index] = { ...newExp[index], [field]: value };
    updateField("experience", newExp);
  };

  return (
    <div className="space-y-6">
      {resumeData.experience.map((exp: any, i: number) => (
        <div
          key={i}
          className="group relative border border-white/5 bg-white/[0.02] rounded-lg p-4 hover:border-white/10 transition-colors"
        >
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
            <button className="text-mist-500 hover:text-white p-1">
              <GripVertical size={14} />
            </button>
            <button
              onClick={() => removeListItem("experience", i)}
              className="text-mist-500 hover:text-red-400 p-1"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-3">
            <DenseInput
              label="Role Title"
              value={exp.role}
              onChange={(e: any) => handleUpdate(i, "role", e.target.value)}
            />
            <DenseInput
              label="Company"
              value={exp.company}
              onChange={(e: any) => handleUpdate(i, "company", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DenseInput
              label="Start Date"
              value={exp.startDate}
              onChange={(e: any) =>
                handleUpdate(i, "startDate", e.target.value)
              }
            />
            <DenseInput
              label="End Date"
              value={exp.endDate}
              onChange={(e: any) => handleUpdate(i, "endDate", e.target.value)}
            />
          </div>
          <DenseInput
            label="Description"
            isTextArea
            value={exp.description}
            onChange={(e: any) =>
              handleUpdate(i, "description", e.target.value)
            }
          />
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          addListItem("experience", {
            company: "",
            role: "",
            startDate: "",
            endDate: "",
            description: "",
          })
        }
        className="w-full border-dashed border-white/20 text-mist-400 hover:text-aurora-teal hover:border-aurora-teal py-6 flex flex-col gap-1 h-auto"
      >
        <Plus size={20} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Add Position
        </span>
      </Button>
    </div>
  );
}

function DenseInput({ label, isTextArea, className, ...props }: any) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-mono text-mist-400 mb-1.5 uppercase tracking-wider">
          {label}
        </label>
      )}
      {isTextArea ? (
        <textarea
          className="w-full bg-void-900 border border-white/10 rounded px-3 py-2 text-mist-100 text-sm focus:outline-none focus:border-aurora-teal/50 focus:bg-void-950 transition-all min-h-[100px] resize-y placeholder:text-mist-700"
          {...props}
        />
      ) : (
        <input
          type="text"
          className="w-full bg-void-900 border border-white/10 rounded px-3 py-2 text-mist-100 text-sm focus:outline-none focus:border-aurora-teal/50 focus:bg-void-950 transition-all placeholder:text-mist-700"
          {...props}
        />
      )}
    </div>
  );
}

// -- Preview Mock --
function ResumePreviewMock({ resumeData }: { resumeData: any }) {
  return (
    <div className="p-12 h-full flex flex-col text-gray-800">
      <header className="border-b-2 border-gray-900 pb-6 mb-8">
        <h1 className="text-5xl font-serif font-bold text-gray-900 mb-3 uppercase tracking-tight">
          {resumeData.contact.fullName || "Your Name"}
        </h1>
        <div className="flex gap-4 text-sm font-medium tracking-wide text-gray-600 uppercase">
          <span>{resumeData.contact.role || "Target Role"}</span>
          <span>•</span>
          <span>{resumeData.contact.location || "Location"}</span>
        </div>
      </header>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Professional Summary
          </h3>
          <p className="text-gray-700 leading-relaxed text-sm text-justify">
            {resumeData.summary ||
              "Click editor sections to start building your resume..."}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Experience
          </h3>
          <div className="space-y-6">
            {resumeData.experience.map((exp: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="font-bold text-gray-900 text-base">
                    {exp.role || "Position"}
                  </h4>
                  <span className="text-xs font-mono text-gray-500">
                    {exp.startDate} – {exp.endDate}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-600 mb-2">
                  {exp.company || "Company"}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {exp.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Education
          </h3>
          {resumeData.education.map((edu: any, i: number) => (
            <div key={i} className="flex justify-between">
              <div>
                <div className="font-bold text-gray-900">
                  {edu.school || "School"}
                </div>
                <div className="text-sm text-gray-600">
                  {edu.degree || "Degree"}
                </div>
              </div>
              <div className="text-xs font-mono text-gray-500">{edu.year}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function AITailorForm({
  geminiKey,
  setGeminiKey,
  jobDetails,
  setJobDetails,
  onTailor,
  isTailoring,
}: any) {
  return (
    <div className="space-y-8 pb-32">
      <div className="bg-aurora-teal/5 border border-aurora-teal/10 rounded-xl p-6 relative overflow-hidden group">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-aurora-teal/5 rounded-full blur-3xl group-hover:bg-aurora-teal/10 transition-colors" />
        <div className="relative">
          <h3 className="text-sm font-bold text-aurora-teal uppercase tracking-widest mb-1 flex items-center gap-2">
            <Sparkles size={14} /> AI Context
          </h3>
          <p className="text-xs text-mist-400 mb-6 font-mono uppercase tracking-tighter">
            Optimization Engine Config
          </p>

          <div className="space-y-4">
            <DenseInput
              label="Gemini API Key"
              type="password"
              value={geminiKey}
              onChange={(e: any) => setGeminiKey(e.target.value)}
              placeholder="Paste your API key here..."
              className="bg-void-950/50"
            />
            <p className="text-[10px] text-mist-500 italic">
              Your key is stored locally and never sent to our servers. Get one
              at{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-aurora-teal hover:underline"
              >
                Google AI Studio
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-bold text-mist-100 uppercase tracking-widest flex items-center gap-2">
          Target Job Details
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <DenseInput
            label="Job Title"
            value={jobDetails.jobTitle}
            onChange={(e: any) =>
              setJobDetails({ ...jobDetails, jobTitle: e.target.value })
            }
            placeholder="e.g. Senior Frontend Engineer"
          />
          <DenseInput
            label="Company"
            value={jobDetails.company}
            onChange={(e: any) =>
              setJobDetails({ ...jobDetails, company: e.target.value })
            }
            placeholder="e.g. Acme Corp"
          />
        </div>

        <DenseInput
          label="Job Description"
          isTextArea
          className="h-64"
          value={jobDetails.description}
          onChange={(e: any) =>
            setJobDetails({ ...jobDetails, description: e.target.value })
          }
          placeholder="Paste the full job description here..."
        />

        <Button
          variant="primary"
          className="w-full h-12 text-sm gap-2 font-bold shadow-[0_0_20px_rgba(45,212,191,0.1)] py-4"
          onClick={onTailor}
          disabled={isTailoring}
        >
          {isTailoring ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Tailoring with RARe Framework...
            </>
          ) : (
            <>
              <Wand2 size={18} />
              Optimize for this Role
            </>
          )}
        </Button>
      </div>

      <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
        <h4 className="text-[10px] font-bold text-mist-300 uppercase tracking-widest">
          How it works
        </h4>
        <ul className="space-y-2">
          {[
            "Readability: Bullets under 280 chars",
            "Applicability: Keywords aligned to role",
            "Remarkability: XYZ metric-driven achievements",
          ].map((text, i) => (
            <li
              key={i}
              className="text-[10px] text-mist-500 flex items-center gap-2"
            >
              <CheckCircle2 size={10} className="text-aurora-teal/50" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
