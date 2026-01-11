import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EditorLayout } from "../../../layouts/EditorLayout";
import { Button } from "../../ui/Button";
import { MOCK_RESUME_DATA } from "./mockData";
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
} from "lucide-react";

const STEPS = [
  { id: "contact", label: "Contact", icon: <User size={18} /> },
  { id: "experience", label: "Experience", icon: <Briefcase size={18} /> },
  { id: "education", label: "Education", icon: <GraduationCap size={18} /> },
  { id: "skills", label: "Skills", icon: <Code size={18} /> },
  { id: "summary", label: "Summary", icon: <FileText size={18} /> },
];

export function AuroraWorkbenchEditor() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === STEPS.length - 1;

  const nextStep = () =>
    setCurrentStepIndex(Math.min(STEPS.length - 1, currentStepIndex + 1));
  const prevStep = () => setCurrentStepIndex(Math.max(0, currentStepIndex - 1));

  return (
    <EditorLayout>
      {/* 1. Left Rail: Navigation */}
      <div className="w-16 bg-void-950 border-r border-white/10 flex flex-col items-center py-4 gap-4 z-20">
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
              <div className="absolute left-14 bg-void-900 border border-white/10 px-2 py-1 rounded text-[10px] uppercase tracking-wider text-mist-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
              {currentStep.id === "education" && (
                <PlaceholderForm name="Education" />
              )}
              {currentStep.id === "skills" && <PlaceholderForm name="Skills" />}
              {currentStep.id === "summary" && (
                <PlaceholderForm name="Summary" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 border-t border-white/10 bg-void-950">
          <Button className="w-full bg-aurora-teal/10 text-aurora-teal border border-aurora-teal/50 hover:bg-aurora-teal hover:text-void-950 transition-all text-xs font-bold uppercase tracking-wider h-10">
            Run AI Tailor on this Section
          </Button>
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
            <ResumePreviewMock />
          </div>
        </div>
      </div>
    </EditorLayout>
  );
}

// -- Sub-Components for Forms (Dense Style) --

function ContactForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <DenseInput
          label="First Name"
          defaultValue={MOCK_RESUME_DATA.contact.fullName.split(" ")[0]}
        />
        <DenseInput
          label="Last Name"
          defaultValue={MOCK_RESUME_DATA.contact.fullName.split(" ")[1]}
        />
      </div>
      <DenseInput
        label="Target Role"
        defaultValue={MOCK_RESUME_DATA.contact.role}
      />
      <DenseInput
        label="Email Address"
        defaultValue={MOCK_RESUME_DATA.contact.email}
      />
      <div className="grid grid-cols-2 gap-4">
        <DenseInput
          label="Phone"
          defaultValue={MOCK_RESUME_DATA.contact.phone}
        />
        <DenseInput
          label="Location"
          defaultValue={MOCK_RESUME_DATA.contact.location}
        />
      </div>
      <div className="pt-4 border-t border-white/5">
        <label className="text-[10px] font-mono text-mist-500 uppercase tracking-wider mb-2 block">
          Social Links
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <DenseInput placeholder="LinkedIn URL" className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-mist-500"
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed border-white/10 text-mist-500 h-8 text-xs hover:text-aurora-teal hover:border-aurora-teal/50"
          >
            + Add Link
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExperienceForm() {
  return (
    <div className="space-y-6">
      {MOCK_RESUME_DATA.experience.map((exp, i) => (
        <div
          key={i}
          className="group relative border border-white/5 bg-white/[0.02] rounded-lg p-4 hover:border-white/10 transition-colors"
        >
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1">
            <button className="text-mist-500 hover:text-white p-1">
              <GripVertical size={14} />
            </button>
            <button className="text-mist-500 hover:text-red-400 p-1">
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-3">
            <DenseInput label="Role Title" defaultValue={exp.role} />
            <DenseInput label="Company" defaultValue={exp.company} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DenseInput label="Start Date" defaultValue={exp.startDate} />
            <DenseInput label="End Date" defaultValue={exp.endDate} />
          </div>
          <DenseInput
            label="Description"
            isTextArea
            defaultValue={exp.description}
          />
        </div>
      ))}
      <Button
        variant="outline"
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

function PlaceholderForm({ name }: { name: string }) {
  return (
    <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-lg bg-white/[0.01]">
      <p className="text-mist-500 text-sm">
        Form fields for <span className="text-mist-200 font-bold">{name}</span>
      </p>
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
function ResumePreviewMock() {
  return (
    <div className="p-12 h-full flex flex-col text-gray-800">
      <header className="border-b-2 border-gray-900 pb-6 mb-8">
        <h1 className="text-5xl font-serif font-bold text-gray-900 mb-3 uppercase tracking-tight">
          {MOCK_RESUME_DATA.contact.fullName}
        </h1>
        <div className="flex gap-4 text-sm font-medium tracking-wide text-gray-600 uppercase">
          <span>{MOCK_RESUME_DATA.contact.role}</span>
          <span>•</span>
          <span>{MOCK_RESUME_DATA.contact.location}</span>
        </div>
      </header>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Professional Summary
          </h3>
          <p className="text-gray-700 leading-relaxed text-sm text-justify">
            {MOCK_RESUME_DATA.summary}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Experience
          </h3>
          <div className="space-y-6">
            {MOCK_RESUME_DATA.experience.map((exp: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="font-bold text-gray-900 text-base">
                    {exp.role}
                  </h4>
                  <span className="text-xs font-mono text-gray-500">
                    {exp.startDate} – {exp.endDate}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-600 mb-2">
                  {exp.company}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
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
          {MOCK_RESUME_DATA.education.map((edu: any, i: number) => (
            <div key={i} className="flex justify-between">
              <div>
                <div className="font-bold text-gray-900">{edu.school}</div>
                <div className="text-sm text-gray-600">{edu.degree}</div>
              </div>
              <div className="text-xs font-mono text-gray-500">{edu.year}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
