
import React, { useState, useEffect, useCallback } from 'react';
import type { ResumeData, TailoredResume, View } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
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

  const viewTailoredResume = (resume: TailoredResume) => {
    setSelectedTailoredResume(resume);
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
        const baseResume = resumes.find(r => r.id === baseResumeId) || resumes[0];
        return <JobTailor 
                  apiKey={apiKey}
                  baseResume={baseResume}
                  resumes={resumes}
                  addTailoredResume={addTailoredResume}
                  onBack={() => setCurrentView('dashboard')}
                  existingTailoredResume={selectedTailoredResume}
                  setExistingTailoredResume={setSelectedTailoredResume}
                />;
      case 'dashboard':
      default:
        return <Dashboard 
                  tailoredResumes={tailoredResumes} 
                  onTailorNew={() => {
                    setSelectedTailoredResume(null);
                    setCurrentView('tailor');
                  }}
                  onView={viewTailoredResume}
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
