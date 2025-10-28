
import React, { useState, useEffect } from 'react';
import type { JobDetails, ResumeData, TailoredResume } from '../types';
import { apiClient } from '../src/services/api';
import { defaultEnhancementConfig, type EnhancementConfig } from '../services/resumeEnhancer';
import Button from './common/Button';
import Input from './common/Input';
import TextArea from './common/TextArea';
import Card from './common/Card';
import Spinner from './common/Spinner';
import ResumePreview from './ResumePreview';
import SparklesIcon from './icons/SparklesIcon';

interface JobTailorProps {
  apiKey: string | null;
  baseResume: ResumeData | undefined;
  resumes: ResumeData[];
  addTailoredResume: (resume: TailoredResume) => Promise<TailoredResume>;
  updateTailoredResume?: (resume: TailoredResume) => Promise<TailoredResume>;
  onBack: () => void;
  existingTailoredResume: TailoredResume | null;
  setExistingTailoredResume: (resume: TailoredResume | null) => void;
  isReTailoring?: boolean;
  onReTailor?: (resume: ResumeData) => void;
}

const JobTailor: React.FC<JobTailorProps> = ({ 
    apiKey, 
    baseResume, 
    resumes, 
    addTailoredResume,
    updateTailoredResume,
    onBack,
    existingTailoredResume,
    setExistingTailoredResume,
    isReTailoring = false,
    onReTailor
}) => {
  const [jobDetails, setJobDetails] = useState<JobDetails>({ jobTitle: '', company: '', description: '' });
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>(baseResume?.id);
  const [tailoredData, setTailoredData] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRaReOptimization, setUseRaReOptimization] = useState(true);
  const [enhancementConfig, setEnhancementConfig] = useState<EnhancementConfig>(defaultEnhancementConfig);
  
  // Section selection state
  const [selectedSections, setSelectedSections] = useState({
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    education: true
  });
  
  // Individual item selection state
  const [selectedExperience, setSelectedExperience] = useState<Record<string, boolean>>({});
  const [selectedProjects, setSelectedProjects] = useState<Record<string, boolean>>({});
  const [selectedEducation, setSelectedEducation] = useState<Record<string, boolean>>({});

  useEffect(() => {
      if (existingTailoredResume) {
          if (isReTailoring) {
              // For re-tailoring, pre-populate with previous job details
              setJobDetails(existingTailoredResume.jobDetails);
          } else {
              // For viewing existing resume, load all data
              setJobDetails(existingTailoredResume.jobDetails);
              setTailoredData(existingTailoredResume.tailoredData);
          }
          setSelectedResumeId(existingTailoredResume.baseResumeId);
      }
      return () => {
        // cleanup when component unmounts
        setExistingTailoredResume(null);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTailoredResume, isReTailoring]);

  // Initialize item selections when base resume changes
  useEffect(() => {
    if (baseResume) {
      const expSelections: Record<string, boolean> = {};
      baseResume.experience.forEach(exp => {
        expSelections[exp.id] = true;
      });
      setSelectedExperience(expSelections);

      const projSelections: Record<string, boolean> = {};
      baseResume.projects?.forEach(proj => {
        projSelections[proj.id] = true;
      });
      setSelectedProjects(projSelections);

      const eduSelections: Record<string, boolean> = {};
      baseResume.education.forEach(edu => {
        eduSelections[edu.id] = true;
      });
      setSelectedEducation(eduSelections);
    }
  }, [baseResume]);

  const handleTailor = async () => {
    const selectedResume = resumes.find(r => r.id === selectedResumeId);
    if (!apiKey || !selectedResume || !jobDetails.description.trim()) {
      setError("API Key, a selected base resume, and a job description are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const filteredResume = createFilteredResume(selectedResume);
      const result = await apiClient.tailorResume({
        resumeData: filteredResume,
        jobDetails,
        apiKey,
        useRaReOptimization
      });
      setTailoredData(result);
      if (!existingTailoredResume) {
          const newTailoredResume: TailoredResume = {
              id: `tailored-${Date.now()}`,
              jobDetails,
              baseResumeId: selectedResume.id,
              tailoredData: result,
              createdAt: new Date().toISOString()
          };
          await addTailoredResume(newTailoredResume);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setJobDetails({ ...jobDetails, [e.target.name]: e.target.value });
  };

  const toggleSection = (section: keyof typeof selectedSections) => {
    setSelectedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleExperience = (expId: string) => {
    setSelectedExperience(prev => ({ ...prev, [expId]: !prev[expId] }));
  };

  const toggleProject = (projId: string) => {
    setSelectedProjects(prev => ({ ...prev, [projId]: !prev[projId] }));
  };

  const toggleEducation = (eduId: string) => {
    setSelectedEducation(prev => ({ ...prev, [eduId]: !prev[eduId] }));
  };

  const createFilteredResume = (resume: ResumeData): ResumeData => {
    return {
      ...resume,
      summary: selectedSections.summary ? resume.summary : '',
      skills: selectedSections.skills ? resume.skills : [],
      experience: selectedSections.experience 
        ? resume.experience.filter(exp => selectedExperience[exp.id])
        : [],
      projects: selectedSections.projects 
        ? (resume.projects?.filter(proj => selectedProjects[proj.id]) || [])
        : [],
      education: selectedSections.education
        ? resume.education.filter(edu => selectedEducation[edu.id])
        : []
    };
  };
  
  const originalResume = resumes.find(r => r.id === (existingTailoredResume?.baseResumeId || selectedResumeId));

  const handleSaveEditedResume = async (editedResume: ResumeData) => {
    setTailoredData(editedResume);
    // If this is an existing tailored resume, update it in the parent state
    if (existingTailoredResume && updateTailoredResume) {
      try {
        const updatedTailoredResume = {
          ...existingTailoredResume,
          tailoredData: editedResume
        };
        const result = await updateTailoredResume(updatedTailoredResume);
        setExistingTailoredResume(result);
      } catch (err: any) {
        setError(err.message || 'Failed to update tailored resume');
      }
    }
  };

  if (tailoredData && originalResume) {
    return (
        <ResumePreview 
            originalResume={originalResume}
            tailoredResume={tailoredData}
            jobDetails={jobDetails}
            onBack={onBack}
            onReTailor={onReTailor}
            onSaveEdits={handleSaveEditedResume}
        />
    )
  }

  return (
    <div>
      <Button onClick={onBack} variant="secondary" className="mb-4">
        &larr; Back to Dashboard
      </Button>
      <h2 className="text-3xl font-bold mb-6">
        {isReTailoring ? 'Re-tailor Resume for New Job' : 'Tailor Resume for a Job'}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="space-y-4">
          <div>
            <label htmlFor="base-resume" className="block text-sm font-medium text-gray-300 mb-1">
              {isReTailoring ? 'Source Resume (from previous tailoring)' : 'Base Resume'}
            </label>
            <select
              id="base-resume"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              disabled={isReTailoring}
              className={`w-full border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                isReTailoring ? 'bg-gray-700 cursor-not-allowed' : 'bg-gray-800'
              }`}
            >
              {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {isReTailoring && (
              <p className="text-xs text-gray-400 mt-1">
                Using tailored resume as source for re-tailoring
              </p>
            )}
          </div>
          <Input label="Job Title" id="jobTitle" name="jobTitle" value={jobDetails.jobTitle} onChange={handleInputChange} />
          <Input label="Company" id="company" name="company" value={jobDetails.company} onChange={handleInputChange} />
          <TextArea label="Job Description" id="description" name="description" value={jobDetails.description} onChange={handleInputChange} rows={10} />
          
          {/* RARe Optimization Toggle */}
          <div className="border border-gray-600 rounded-lg p-4 bg-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-white font-medium flex items-center gap-2">
                <SparklesIcon />
                RARe Framework Optimization
              </label>
              <input
                type="checkbox"
                checked={useRaReOptimization}
                onChange={(e) => setUseRaReOptimization(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
              />
            </div>
            <p className="text-sm text-gray-400">
              Automatically optimizes resume using Readability, Applicability, and Remarkability principles with XYZ framework and strong action verbs
            </p>
          </div>
          
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleTailor} disabled={isLoading || !baseResume}>
              {isLoading ? <Spinner size="sm" /> : <SparklesIcon />}
              {isLoading 
                ? (isReTailoring ? 'Re-tailoring...' : 'Tailoring...') 
                : (isReTailoring ? 'Re-tailor Resume' : 'Generate Tailored Resume')
              }
            </Button>
          </div>
        </Card>
        <div className="hidden lg:block">
            <Card>
                <h3 className="text-xl font-semibold mb-4">Select Sections to Include</h3>
                {baseResume ? (
                    <div className="bg-gray-900 p-4 rounded-md h-[500px] overflow-y-auto text-sm">
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-white">{baseResume.contact.name}</h2>
                            <p className="text-gray-400">{baseResume.contact.location}</p>
                            <p className="text-gray-400">{baseResume.contact.email} | {baseResume.contact.phone}</p>
                        </div>
                        
                        {/* Summary Section */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="summary-checkbox"
                                    checked={selectedSections.summary}
                                    onChange={() => toggleSection('summary')}
                                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                                />
                                <h3 className={`text-sm font-bold border-b border-gray-700 pb-1 flex-1 ${selectedSections.summary ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    SUMMARY
                                </h3>
                            </div>
                            {selectedSections.summary && (
                                <p className="text-gray-300 ml-6">{baseResume.summary}</p>
                            )}
                        </div>

                        {/* Skills Section */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="skills-checkbox"
                                    checked={selectedSections.skills}
                                    onChange={() => toggleSection('skills')}
                                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                                />
                                <h3 className={`text-sm font-bold border-b border-gray-700 pb-1 flex-1 ${selectedSections.skills ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    SKILLS
                                </h3>
                            </div>
                            {selectedSections.skills && (
                                <p className="text-gray-300 ml-6">{baseResume.skills.join(', ')}</p>
                            )}
                        </div>

                        {/* Experience Section */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="experience-checkbox"
                                    checked={selectedSections.experience}
                                    onChange={() => toggleSection('experience')}
                                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                                />
                                <h3 className={`text-sm font-bold border-b border-gray-700 pb-1 flex-1 ${selectedSections.experience ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    EXPERIENCE
                                </h3>
                            </div>
                            {selectedSections.experience && baseResume.experience.map((exp, index) => (
                                <div key={exp.id} className="mb-3 ml-6">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id={`exp-${exp.id}`}
                                            checked={selectedExperience[exp.id] || false}
                                            onChange={() => toggleExperience(exp.id)}
                                            className="w-3 h-3 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className={`text-sm font-semibold ${selectedExperience[exp.id] ? 'text-white' : 'text-gray-500'}`}>
                                                    {exp.role}
                                                </h4>
                                                <p className="text-xs text-gray-500">{exp.startDate} - {exp.endDate}</p>
                                            </div>
                                            <p className="text-xs text-gray-400">{exp.company}, {exp.location}</p>
                                            {index < 2 && selectedExperience[exp.id] && (
                                                <ul className="list-disc list-inside mt-1 text-xs text-gray-300">
                                                    {exp.responsibilities.slice(0, 1).map((resp, rIndex) => (
                                                        <li key={rIndex}>{resp}</li>
                                                    ))}
                                                    {exp.responsibilities.length > 1 && (
                                                        <li className="text-gray-500">... and {exp.responsibilities.length - 1} more</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Projects Section */}
                        {baseResume.projects && baseResume.projects.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        id="projects-checkbox"
                                        checked={selectedSections.projects}
                                        onChange={() => toggleSection('projects')}
                                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                                    />
                                    <h3 className={`text-sm font-bold border-b border-gray-700 pb-1 flex-1 ${selectedSections.projects ? 'text-indigo-400' : 'text-gray-500'}`}>
                                        PROJECTS
                                    </h3>
                                </div>
                                {selectedSections.projects && baseResume.projects.map((proj, index) => (
                                    <div key={proj.id} className="mb-2 ml-6">
                                        <div className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                id={`proj-${proj.id}`}
                                                checked={selectedProjects[proj.id] || false}
                                                onChange={() => toggleProject(proj.id)}
                                                className="w-3 h-3 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 mt-1"
                                            />
                                            <div className="flex-1">
                                                <h4 className={`text-sm font-semibold ${selectedProjects[proj.id] ? 'text-white' : 'text-gray-500'}`}>
                                                    {proj.name}
                                                </h4>
                                                {index < 2 && selectedProjects[proj.id] && proj.description.slice(0, 1).map((desc, dIndex) => (
                                                    <p key={dIndex} className="text-xs text-gray-300">• {desc}</p>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Education Section */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="education-checkbox"
                                    checked={selectedSections.education}
                                    onChange={() => toggleSection('education')}
                                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                                />
                                <h3 className={`text-sm font-bold border-b border-gray-700 pb-1 flex-1 ${selectedSections.education ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    EDUCATION
                                </h3>
                            </div>
                            {selectedSections.education && baseResume.education.map((edu, index) => (
                                <div key={edu.id} className="mb-2 ml-6">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id={`edu-${edu.id}`}
                                            checked={selectedEducation[edu.id] || false}
                                            onChange={() => toggleEducation(edu.id)}
                                            className="w-3 h-3 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className={`text-sm font-semibold ${selectedEducation[edu.id] ? 'text-white' : 'text-gray-500'}`}>
                                                    {edu.degree}
                                                </h4>
                                                <p className="text-xs text-gray-500">{edu.graduationDate}</p>
                                            </div>
                                            <p className="text-xs text-gray-400">{edu.institution}, {edu.location}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : <p>Please create a profile first.</p>}
            </Card>
        </div>
      </div>
    </div>
  );
};

export default JobTailor;
