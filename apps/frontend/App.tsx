
import React, { useState, useEffect, useCallback } from 'react';
import type { ResumeData, TailoredResume, View } from './types';
import { Resume, TailoredResumeData } from './src/types/resume';
import { useLocalStorage } from './hooks/useLocalStorage';
import { apiClient } from './src/services/api';
import Header from './components/Header';
import ApiKeyModal from './components/ApiKeyModal';
import Dashboard from './components/Dashboard';
import ProfileManager from './components/ProfileManager';
import JobTailor from './components/JobTailor';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  const [resumes, setResumes] = useLocalStorage<ResumeData[]>('resumes', []);
  const [baseResumeId, setBaseResumeId] = useLocalStorage<string | null>('base-resume-id', null);
  const [tailoredResumes, setTailoredResumes] = useLocalStorage<TailoredResume[]>('tailored-resumes', []);
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTailoredResume, setSelectedTailoredResume] = useState<TailoredResume | null>(null);
  const [resumeToReTailor, setResumeToReTailor] = useState<ResumeData | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setApiKeyModalOpen(true);
    }
  }, [apiKey]);
  
  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    setApiKeyModalOpen(false);
  };
  
  const addResume = (newResume: ResumeData) => {
    const updatedResumes = [...resumes, newResume];
    setResumes(updatedResumes);
    if (!baseResumeId) {
      setBaseResumeId(newResume.id);
    }
  };

  const updateResume = (updatedResume: ResumeData) => {
    setResumes(resumes.map(r => r.id === updatedResume.id ? updatedResume : r));
  };
  
  const deleteResume = (resumeId: string) => {
    setResumes(resumes.filter(r => r.id !== resumeId));
    if (baseResumeId === resumeId) {
      setBaseResumeId(resumes.length > 1 ? resumes.filter(r => r.id !== resumeId)[0].id : null);
    }
  }

  const addTailoredResume = (newTailoredResume: TailoredResume) => {
    setTailoredResumes([newTailoredResume, ...tailoredResumes]);
    setCurrentView('dashboard');
  };

  const updateTailoredResume = (updatedTailoredResume: TailoredResume) => {
    setTailoredResumes(tailoredResumes.map(resume => 
      resume.id === updatedTailoredResume.id ? updatedTailoredResume : resume
    ));
  };

  const viewTailoredResume = (resume: TailoredResume) => {
    setSelectedTailoredResume(resume);
    setResumeToReTailor(null); // Clear re-tailor state
    setCurrentView('tailor');
  }

  const reTailorResume = (resume: TailoredResume) => {
    setResumeToReTailor(resume.tailoredData);
    setSelectedTailoredResume(resume); // Pass the full tailored resume for job details
    setCurrentView('tailor');
  }
  
  const renderContent = () => {
    switch(currentView) {
      case 'profile':
        return <ProfileManager 
                  resumes={resumes} 
                  addResume={addResume}
                  updateResume={updateResume}
                  deleteResume={deleteResume}
                  baseResumeId={baseResumeId}
                  setBaseResumeId={setBaseResumeId}
                  apiKey={apiKey}
                />;
      case 'tailor':
        const baseResume = resumeToReTailor || resumes.find(r => r.id === baseResumeId) || resumes[0];
        return <JobTailor 
                  apiKey={apiKey}
                  baseResume={baseResume}
                  resumes={resumes}
                  addTailoredResume={addTailoredResume}
                  updateTailoredResume={updateTailoredResume}
                  onBack={() => {
                    setCurrentView('dashboard');
                    setResumeToReTailor(null); // Clear re-tailor state
                    setSelectedTailoredResume(null); // Clear selected resume
                  }}
                  existingTailoredResume={selectedTailoredResume}
                  setExistingTailoredResume={setSelectedTailoredResume}
                  isReTailoring={!!resumeToReTailor}
                  onReTailor={(resume: ResumeData) => {
                    setResumeToReTailor(resume);
                    setSelectedTailoredResume(null);
                  }}
                />;
      case 'dashboard':
      default:
        return <Dashboard 
                  tailoredResumes={tailoredResumes} 
                  onTailorNew={() => {
                    setSelectedTailoredResume(null);
                    setResumeToReTailor(null);
                    setCurrentView('tailor');
                  }}
                  onView={viewTailoredResume}
                  onReTailor={reTailorResume}
                />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Header currentView={currentView} setCurrentView={setCurrentView} onApiKeyClick={() => setApiKeyModalOpen(true)} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => { if (apiKey) setApiKeyModalOpen(false) }} 
        onSetApiKey={handleSetApiKey}
      />
    </div>
  );
};

export default App;
