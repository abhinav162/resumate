import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useParams, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { EditorLayout } from "../../../layouts/EditorLayout";
import { Button } from "../../ui/Button";
import { ScorePill } from "../../ui/ScorePill";
import { Badge } from "../../ui/Badge";
import { RequiresCredits } from "../../ui/RequiresCredits";
import { ResumeEditorProvider, useResumeEditor } from "./ResumeEditorContext";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { ResponsivePreviewCanvas } from "./ResumePreview";
import { SortableList } from "./SortableList";
import { BulletListEditor } from "./BulletListEditor";
import { SkillsTagInput } from "./SkillsTagInput";
import { GitHubImportModal } from "../github/GitHubImportModal";
import { generateLatexPdf } from "../../../services/latexService";
import {
  User,
  Briefcase,
  GraduationCap,
  Code,
  FileText,
  FolderGit2,
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
  Github,
} from "lucide-react";
// Paper light theme — no dark import needed

const STEPS = [
  { id: "contact", label: "Contact", icon: <User size={18} /> },
  { id: "experience", label: "Experience", icon: <Briefcase size={18} /> },
  { id: "projects", label: "Projects", icon: <FolderGit2 size={18} /> },
  { id: "education", label: "Education", icon: <GraduationCap size={18} /> },
  { id: "skills", label: "Skills", icon: <Code size={18} /> },
  { id: "summary", label: "Summary", icon: <FileText size={18} /> },
];

export function AuroraWorkbenchEditor({ mode = 'base' }: { mode?: 'base' | 'tailored' } = {}) {
  const { id } = useParams<{ id: string }>();

  return (
    <ResumeEditorProvider resumeId={id} mode={mode}>
      <AuroraWorkbenchInner />
    </ResumeEditorProvider>
  );
}

function AuroraWorkbenchInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    mode,
    tailoredMeta,
    resumeData,
    updateField,
    isSaving,
    lastSaved,
    isLoading,
    saveResume,
    score,
    breakdown,
    suggestions,
    scoring,
    triggerScore,
    acceptSuggestion,
    dismissSuggestion,
  } = useResumeEditor();

  // URL Sync: If we started without an ID but now have one (after first save), update URL.
  // Skipped in tailored mode — tailored rows are created server-side by /api/ai/tailor and
  // the route always has the ID.
  useEffect(() => {
    if (mode === 'tailored') return;
    const checkId = async () => {
      if (!id && !isLoading && lastSaved) {
        const currentId = await saveResume();
        if (currentId) {
          navigate(`/editor/${currentId}`, { replace: true });
        }
      }
    };
    checkId();
  }, [id, isLoading, lastSaved, navigate, saveResume, mode]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

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

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-paper-bg">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <EditorLayout
      title={resumeData.title}
      onTitleChange={(v) => updateField('title', v)}
      onExport={handleExport}
      isExporting={isExporting}
      actions={
        <div className="flex items-center gap-2 mr-4">
          {mode === 'tailored' && tailoredMeta && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 border border-indigo-200">
              <Sparkles size={12} className="text-indigo-600" />
              <span className="text-[10px] text-indigo-700 uppercase tracking-wider font-mono">
                Tailored · {tailoredMeta.jobTitle} @ {tailoredMeta.company}
              </span>
            </div>
          )}
          {isSaving ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-paper-bg border border-paper-border">
              <Loader2 size={12} className="animate-spin text-indigo-600" />
              <span className="text-[10px] text-ink-secondary uppercase tracking-wider font-mono">
                Saving...
              </span>
            </div>
          ) : lastSaved ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-paper-bg border border-paper-border">
              <CheckCircle2 size={12} className="text-indigo-600" />
              <span className="text-[10px] text-ink-secondary uppercase tracking-wider font-mono">
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
      <div className="w-16 bg-paper-surface border-r border-paper-border flex flex-col items-center py-4 gap-4 z-20">
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
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "text-ink-secondary hover:text-ink-primary hover:bg-paper-bg"
                              }
                          `}
              >
                {step.icon}

                {/* Tooltip */}
                <div className="absolute left-14 bg-paper-surface border border-paper-border px-2 py-1 rounded text-[10px] uppercase tracking-wider text-ink-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-card">
                  {step.label}
                </div>

                {/* Status Dot */}
                {isCompleted && !isActive && (
                  <div className="absolute -top-1 -right-1 text-indigo-500 bg-paper-surface rounded-full">
                    <CheckCircle2
                      size={12}
                      fill="currentColor"
                      className="text-indigo-500"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Navigation (Bottom of Rail) */}
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-paper-border mt-auto">
          <Link
            to="/dashboard"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-bg transition-all group relative"
          >
            <LayoutDashboard size={18} />
            <div className="absolute left-14 bg-paper-surface border border-paper-border px-2 py-1 rounded text-[10px] uppercase tracking-wider text-ink-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-card">
              Dashboard
            </div>
          </Link>
          <Link
            to="/tailor"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-bg transition-all group relative"
          >
            <Wand2 size={18} />
            <div className="absolute left-14 bg-paper-surface border border-paper-border px-2 py-1 rounded text-[10px] uppercase tracking-wider text-ink-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-card">
              Tailor
            </div>
          </Link>
          <div className="pt-2">
            <UserButton
              appearance={{
                variables: {
                  colorBackground: "#ffffff",
                  colorText: "#0f0f0f",
                  colorPrimary: "#4f46e5",
                  colorTextSecondary: "#555555",
                  colorInputBackground: "#fafaf8",
                  colorInputText: "#0f0f0f",
                },
                elements: {
                  avatarBox:
                    "w-8 h-8 rounded-lg border border-paper-border overflow-hidden",
                  rootBox: "w-full flex justify-center",
                  card: "bg-transparent shadow-none w-full max-w-full p-0",
                  headerTitle: "text-ink-primary font-serif text-center",
                  headerSubtitle: "text-ink-secondary text-center",
                  socialButtonsBlockButton:
                    "bg-paper-bg border border-paper-border text-ink-primary hover:bg-paper-bg transition-colors",
                  dividerLine: "bg-paper-border",
                  dividerText:
                    "text-ink-secondary font-mono text-xs uppercase tracking-wider",
                  formFieldLabel: "text-ink-secondary font-medium",
                  formFieldInput:
                    "bg-paper-bg border-paper-border text-ink-primary focus:border-indigo-400 rounded-xl transition-all",
                  footerActionText: "text-ink-secondary",
                  footerActionLink:
                    "text-indigo-600 hover:text-indigo-700 font-medium",
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Middle Panel: The Editor (Input) */}
      <div className="w-[40%] min-w-[400px] max-w-[600px] bg-paper-bg flex flex-col border-r border-paper-border relative z-10">
        {/* Rigid Header for Step */}
        <div className="h-14 border-b border-paper-border flex items-center justify-between px-6 bg-paper-surface/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
            <span className="text-indigo-300 font-mono text-sm">
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
              {currentStep.id === "projects" && <ProjectsForm />}
              {currentStep.id === "education" && <EducationForm />}
              {currentStep.id === "skills" && <SkillsForm />}
              {currentStep.id === "summary" && <SummaryForm />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-paper-border bg-paper-bg">
          {!isLast ? (
            <Button
              onClick={nextStep}
              className="w-full bg-paper-surface text-ink-primary border border-paper-border hover:bg-indigo-50 transition-all text-[10px] font-bold uppercase tracking-widest h-10 gap-2"
            >
              Continue to {STEPS[currentStepIndex + 1].label}
              <ChevronRight size={14} />
            </Button>
          ) : (
            <div className="flex items-center justify-center h-10 px-4 text-[10px] text-ink-muted uppercase tracking-widest font-mono">
              Final Optimization Step
            </div>
          )}
        </div>
      </div>

      {/* 3. AI Suggestions Panel */}
      <div className="w-72 shrink-0 border-l border-paper-border bg-paper-surface overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">AI Suggestions</span>
          {score !== null && <ScorePill score={score} size="sm" />}
        </div>

        {score !== null && <ScoreBreakdown breakdown={breakdown} />}

        {scoring && (
          <div className="text-sm text-ink-secondary flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block" />
            Analyzing...
          </div>
        )}

        {suggestions.length === 0 && !scoring && (
          <div className="text-center py-8 space-y-2">
            <p className="text-ink-muted text-sm">No suggestions yet.</p>
            <RequiresCredits cost={1}>
              <Button size="sm" variant="ghost" onClick={triggerScore} disabled={scoring}>
                Score Resume — 1 credit
              </Button>
            </RequiresCredits>
          </div>
        )}

        {suggestions.map(s => (
          <div key={s.bulletId} className="bg-paper-bg border border-paper-border rounded-lg p-3 space-y-2">
            <Badge variant={s.severity === 'error' ? 'danger' : 'warning'}>
              {s.issueType.replace(/_/g, ' ')}
            </Badge>
            <p className="text-xs text-ink-muted line-through leading-relaxed">{s.original}</p>
            <p className="text-xs text-ink-primary leading-relaxed font-medium">"{s.rewrite}"</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => acceptSuggestion(s.bulletId)}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(s.bulletId)}>Skip</Button>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Right Panel: The Preview (Output) */}
      <div className="flex-1 bg-paper-bg overflow-hidden relative flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-paper-border flex items-center justify-end px-4 gap-2 text-xs text-ink-secondary bg-paper-bg/50">
          <span>View Mode:</span>
          <select className="bg-paper-surface border border-paper-border rounded px-2 py-1 focus:outline-none">
            <option>A4 Page</option>
            <option>Full Width</option>
          </select>
          <div className="h-4 w-px bg-paper-border mx-2" />
          <button className="hover:text-ink-primary">Fit</button>
          <button className="hover:text-ink-primary">100%</button>
        </div>

        {/* Canvas */}
        <ResponsivePreviewCanvas resumeData={resumeData} />
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
      <SortableList
        items={resumeData.education}
        onReorder={(next) => updateField("education", next)}
        className="space-y-6"
        itemClassName="group relative border border-paper-border bg-paper-surface rounded-lg p-4 hover:border-paper-border-strong transition-colors"
        renderItem={(edu, i, handle) => (
          <>
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
              <button
                {...handle}
                style={{ touchAction: "none" }}
                className="text-ink-muted hover:text-ink-primary p-1 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
                aria-label="Drag to reorder position"
              >
                <GripVertical size={14} />
              </button>
              <button
                onClick={() => removeListItem("education", i)}
                className="text-ink-muted hover:text-red-400 p-1"
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
          </>
        )}
      />
      <Button
        variant="secondary"
        onClick={() =>
          addListItem("education", { school: "", degree: "", year: "" })
        }
        className="w-full border-dashed border-paper-border text-ink-secondary hover:text-indigo-600 hover:border-indigo-400 py-6 flex flex-col gap-1 h-auto"
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
      <div className="p-4 bg-paper-surface border border-paper-border rounded-lg">
        <label className="block text-[10px] font-mono text-ink-muted mb-3 uppercase tracking-wider">
          Technical Skills
        </label>
        <SkillsTagInput
          value={resumeData.skills ?? []}
          onChange={(next) => updateField("skills", next)}
          placeholder="Type a skill and press Enter"
        />
      </div>
      <p className="text-[10px] text-ink-muted italic px-2">
        Press Enter or comma to add. Drag chips to reorder, click × to remove.
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
              `${e.target.value} ${contact.fullName.split(" ")[1] || ""}`,
            )
          }
        />
        <DenseInput
          label="Last Name"
          value={contact.fullName.split(" ")[1] || ""}
          onChange={(e: any) =>
            updateField(
              "contact.fullName",
              `${contact.fullName.split(" ")[0] || ""} ${e.target.value}`,
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

      <div className="h-px bg-paper-border my-4" />

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
      <SortableList
        items={resumeData.experience}
        onReorder={(next) => updateField("experience", next)}
        className="space-y-6"
        itemClassName="group relative border border-paper-border bg-paper-surface rounded-lg p-4 hover:border-paper-border-strong transition-colors"
        renderItem={(exp, i, handle) => (
          <>
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
              <button
                {...handle}
                style={{ touchAction: "none" }}
                className="text-ink-muted hover:text-ink-primary p-1 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
                aria-label="Drag to reorder position"
              >
                <GripVertical size={14} />
              </button>
              <button
                onClick={() => removeListItem("experience", i)}
                className="text-ink-muted hover:text-red-400 p-1"
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
            <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
              Responsibilities
            </label>
            <BulletListEditor
              value={Array.isArray(exp.responsibilities) ? exp.responsibilities : []}
              onChange={(next) => handleUpdate(i, "responsibilities", next)}
              placeholder="Reduced p95 latency 40% by introducing a Redis cache..."
              addLabel="Add bullet"
            />
            <p className="text-[10px] text-ink-muted italic mt-2 px-1">
              Each bullet becomes a line item in the preview and final PDF.
            </p>
          </>
        )}
      />
      <Button
        variant="secondary"
        onClick={() =>
          addListItem("experience", {
            company: "",
            role: "",
            startDate: "",
            endDate: "",
            responsibilities: [],
          })
        }
        className="w-full border-dashed border-paper-border text-ink-secondary hover:text-indigo-600 hover:border-indigo-400 py-6 flex flex-col gap-1 h-auto"
      >
        <Plus size={20} />
        <span className="text-xs font-bold uppercase tracking-wider">
          Add Position
        </span>
      </Button>
    </div>
  );
}

function ProjectsForm() {
  const { resumeData, updateField, addListItem, removeListItem } =
    useResumeEditor();
  const [importOpen, setImportOpen] = useState(false);

  const projects = resumeData.projects ?? [];

  // Repos already imported into this resume — the modal marks them unselectable.
  const existingRepoIds = projects
    .map((p) => p.githubRepoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const handleUpdate = (index: number, field: string, value: any) => {
    const newProjects = [...projects];
    newProjects[index] = { ...newProjects[index], [field]: value };
    updateField("projects", newProjects);
  };

  return (
    <div className="space-y-6">
      <SortableList
        items={projects}
        onReorder={(next) => updateField("projects", next)}
        className="space-y-6"
        itemClassName="group relative border border-paper-border bg-paper-surface rounded-lg p-4 hover:border-paper-border-strong transition-colors"
        renderItem={(proj, i, handle) => {
          return (
            <>
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
                {proj.githubRepoId && (
                  <span
                    className="text-ink-muted p-1"
                    title="Imported from GitHub"
                    aria-label="Imported from GitHub"
                  >
                    <Github size={14} />
                  </span>
                )}
                <button
                  {...handle}
                  style={{ touchAction: "none" }}
                  className="text-ink-muted hover:text-ink-primary p-1 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-label="Drag to reorder position"
                >
                  <GripVertical size={14} />
                </button>
                <button
                  onClick={() => removeListItem("projects", i)}
                  className="text-ink-muted hover:text-red-400 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-3">
                <DenseInput
                  label="Project Name"
                  value={proj.name || ""}
                  onChange={(e: any) => handleUpdate(i, "name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <DenseInput
                  label="Live URL"
                  value={proj.url || ""}
                  onChange={(e: any) => handleUpdate(i, "url", e.target.value)}
                  placeholder="https://example.com"
                />
                <DenseInput
                  label="Repo URL"
                  value={proj.repoUrl || ""}
                  onChange={(e: any) =>
                    handleUpdate(i, "repoUrl", e.target.value)
                  }
                  placeholder="https://github.com/..."
                />
              </div>
              <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
                Description
              </label>
              <BulletListEditor
                value={Array.isArray(proj.description) ? proj.description : []}
                onChange={(next) => handleUpdate(i, "description", next)}
                placeholder="Built a real-time collaboration engine..."
                addLabel="Add bullet"
              />
              <p className="text-[10px] text-ink-muted italic mt-2 px-1">
                Each bullet becomes a line item in the preview and final PDF.
              </p>
            </>
          );
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          onClick={() =>
            addListItem("projects", {
              name: "",
              url: "",
              repoUrl: "",
              description: [],
            })
          }
          className="border-dashed border-paper-border text-ink-secondary hover:text-indigo-600 hover:border-indigo-400 py-6 flex flex-col gap-1 h-auto"
        >
          <Plus size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Add Project
          </span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setImportOpen(true)}
          className="border-dashed border-paper-border text-ink-secondary hover:text-indigo-600 hover:border-indigo-400 py-6 flex flex-col gap-1 h-auto"
        >
          <Github size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Import from GitHub
          </span>
        </Button>
      </div>

      <GitHubImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingRepoIds={existingRepoIds}
        onImport={(imported) => {
          // Each drafted repo becomes an editable project entry; saving goes
          // through the normal resume mutations (auto-save picks it up).
          for (const p of imported) {
            addListItem("projects", {
              name: p.name,
              url: p.url ?? "",
              repoUrl: p.repoUrl ?? "",
              description: p.description,
              githubRepoId: p.githubRepoId,
            });
          }
        }}
      />
    </div>
  );
}

function DenseInput({ label, isTextArea, className, ...props }: any) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-[10px] font-mono text-ink-muted mb-1.5 uppercase tracking-wider">
          {label}
        </label>
      )}
      {isTextArea ? (
        <textarea
          className="w-full bg-paper-bg border border-paper-border rounded px-3 py-2 text-ink-primary text-sm focus:outline-none focus:border-indigo-400 transition-all min-h-[100px] resize-y placeholder:text-ink-muted"
          {...props}
        />
      ) : (
        <input
          type="text"
          className="w-full bg-paper-bg border border-paper-border rounded px-3 py-2 text-ink-primary text-sm focus:outline-none focus:border-indigo-400 transition-all placeholder:text-ink-muted"
          {...props}
        />
      )}
    </div>
  );
}

