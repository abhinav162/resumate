
import React, { useState, useEffect } from 'react';
import type { JobDetails, ResumeData, TailoredResume } from '../types';
import { tailorResumeForJob } from '../services/geminiService';
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
  addTailoredResume: (resume: TailoredResume) => void;
  onBack: () => void;
  existingTailoredResume: TailoredResume | null;
  setExistingTailoredResume: (resume: TailoredResume | null) => void;
}

const JobTailor: React.FC<JobTailorProps> = ({ 
    apiKey, 
    baseResume, 
    resumes, 
    addTailoredResume, 
    onBack,
    existingTailoredResume,
    setExistingTailoredResume
}) => {
  const [jobDetails, setJobDetails] = useState<JobDetails>({ jobTitle: '', company: '', description: '' });
  const [selectedResumeId, setSelectedResumeId] = useState<string | undefined>(baseResume?.id);
  const [tailoredData, setTailoredData] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRaReOptimization, setUseRaReOptimization] = useState(true);
  const [enhancementConfig, setEnhancementConfig] = useState<EnhancementConfig>(defaultEnhancementConfig);

  useEffect(() => {
      if (existingTailoredResume) {
          setJobDetails(existingTailoredResume.jobDetails);
          setSelectedResumeId(existingTailoredResume.baseResumeId);
          setTailoredData(existingTailoredResume.tailoredData);
      }
      return () => {
        // cleanup when component unmounts
        setExistingTailoredResume(null);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTailoredResume]);

  const handleTailor = async () => {
    const selectedResume = resumes.find(r => r.id === selectedResumeId);
    if (!apiKey || !selectedResume || !jobDetails.description.trim()) {
      setError("API Key, a selected base resume, and a job description are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await tailorResumeForJob(selectedResume, jobDetails, apiKey, useRaReOptimization, enhancementConfig);
      setTailoredData(result);
      if (!existingTailoredResume) {
          const newTailoredResume: TailoredResume = {
              id: `tailored-${Date.now()}`,
              jobDetails,
              baseResumeId: selectedResume.id,
              tailoredData: result,
              createdAt: new Date().toISOString()
          };
          addTailoredResume(newTailoredResume);
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
  
  const originalResume = resumes.find(r => r.id === (existingTailoredResume?.baseResumeId || selectedResumeId));

  if (tailoredData && originalResume) {
    return (
        <ResumePreview 
            originalResume={originalResume}
            tailoredResume={tailoredData}
            jobDetails={jobDetails}
            onBack={onBack}
        />
    )
  }

  return (
    <div>
      <Button onClick={onBack} variant="secondary" className="mb-4">
        &larr; Back to Dashboard
      </Button>
      <h2 className="text-3xl font-bold mb-6">Tailor Resume for a Job</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="space-y-4">
          <div>
            <label htmlFor="base-resume" className="block text-sm font-medium text-gray-300 mb-1">Base Resume</label>
            <select
              id="base-resume"
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
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
              {isLoading ? 'Tailoring...' : 'Generate Tailored Resume'}
            </Button>
          </div>
        </Card>
        <div className="hidden lg:block">
            <Card>
                <h3 className="text-xl font-semibold mb-4">Preview of Base Resume</h3>
                {baseResume ? (
                    <div className="bg-gray-900 p-4 rounded-md h-[500px] overflow-y-auto text-sm">
                        <h2 className="text-2xl font-bold">{baseResume.contact.name}</h2>
                        <p className="text-gray-400">{baseResume.contact.email} | {baseResume.contact.phone}</p>
                        <hr className="my-2 border-gray-600"/>
                        <p>{baseResume.summary}</p>
                        {/* A minimal preview */}
                    </div>
                ) : <p>Please create a profile first.</p>}
            </Card>
        </div>
      </div>
    </div>
  );
};

export default JobTailor;
