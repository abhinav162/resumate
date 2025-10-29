import React, { useState, useEffect } from 'react';
import type { ResumeData, TailoredResume, View } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { apiClient } from './services/api';
import Header from './components/Header';
import ApiKeyModal from './components/ApiKeyModal';
import Dashboard from './components/Dashboard';
import ProfileManager from './components/ProfileManager';
import JobTailor from './components/JobTailor';

const App: React.FC = () => {
  // Keep API key in localStorage for convenience
  const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Replace localStorage with API state
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [baseResumeId, setBaseResumeId] = useState<string | null>(null);
  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  
  // Loading and error states
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [isLoadingTailored, setIsLoadingTailored] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTailoredResume, setSelectedTailoredResume] = useState<TailoredResume | null>(null);
  const [resumeToReTailor, setResumeToReTailor] = useState<ResumeData | null>(null);

  // Load data from backend on mount
  useEffect(() => {
    loadResumes();
    loadTailoredResumes();
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setApiKeyModalOpen(true);
    }
  }, [apiKey]);

  const loadResumes = async () => {
    try {
      setIsLoadingResumes(true);
      setError(null);
      const resumesData = await apiClient.getResumes();
      setResumes(resumesData);
      
      // Set base resume if not set and resumes exist
      if (!baseResumeId && resumesData.length > 0) {
        const baseResume = resumesData.find(r => r.isBase) || resumesData[0];
        setBaseResumeId(baseResume.id);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
      setError('Failed to load resumes from server');
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const loadTailoredResumes = async () => {
    try {
      setIsLoadingTailored(true);
      setError(null);
      const tailoredData = await apiClient.getTailoredResumes();
      setTailoredResumes(tailoredData);
    } catch (err) {
      console.error('Failed to load tailored resumes:', err);
      setError('Failed to load tailored resumes from server');
    } finally {
      setIsLoadingTailored(false);
    }
  };
  
  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    setApiKeyModalOpen(false);
  };
  
  const addResume = async (newResume: ResumeData) => {
    try {
      setError(null);
      const createdResume = await apiClient.createResume(newResume);
      setResumes(prev => [...prev, createdResume]);
      
      if (!baseResumeId) {
        setBaseResumeId(createdResume.id);
      }
      
      return createdResume;
    } catch (err) {
      console.error('Failed to create resume:', err);
      setError('Failed to create resume');
      throw err;
    }
  };

  const updateResume = async (updatedResume: ResumeData) => {
    try {
      setError(null);
      const updated = await apiClient.updateResume(updatedResume.id, updatedResume);
      setResumes(prev => prev.map(r => r.id === updated.id ? updated : r));
      return updated;
    } catch (err) {
      console.error('Failed to update resume:', err);
      setError('Failed to update resume');
      throw err;
    }
  };
  
  const deleteResume = async (resumeId: string) => {
    try {
      setError(null);
      await apiClient.deleteResume(resumeId);
      setResumes(prev => prev.filter(r => r.id !== resumeId));
      
      if (baseResumeId === resumeId) {
        const remainingResumes = resumes.filter(r => r.id !== resumeId);
        setBaseResumeId(remainingResumes.length > 0 ? remainingResumes[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete resume:', err);
      setError('Failed to delete resume');
      throw err;
    }
  };

  const addTailoredResume = async (newTailoredResume: TailoredResume) => {
    try {
      setError(null);
      const created = await apiClient.createTailoredResume({
        baseResumeId: newTailoredResume.baseResumeId,
        jobDetails: newTailoredResume.jobDetails,
        tailoredData: newTailoredResume.tailoredData
      });
      setTailoredResumes(prev => [created, ...prev]);
      setCurrentView('dashboard');
      return created;
    } catch (err) {
      console.error('Failed to create tailored resume:', err);
      setError('Failed to create tailored resume');
      throw err;
    }
  };

  const updateTailoredResume = async (updatedTailoredResume: TailoredResume) => {
    try {
      setError(null);
      const updated = await apiClient.updateTailoredResume(
        updatedTailoredResume.id, 
        updatedTailoredResume
      );
      setTailoredResumes(prev => 
        prev.map(resume => resume.id === updated.id ? updated : resume)
      );
      return updated;
    } catch (err) {
      console.error('Failed to update tailored resume:', err);
      setError('Failed to update tailored resume');
      throw err;
    }
  };

  const viewTailoredResume = (resume: TailoredResume) => {
    setSelectedTailoredResume(resume);
    setResumeToReTailor(null); // Clear re-tailor state
    setCurrentView('tailor');
  };

  const reTailorResume = (resume: TailoredResume) => {
    setResumeToReTailor(resume.tailoredData);
    setSelectedTailoredResume(resume); // Pass the full tailored resume for job details
    setCurrentView('tailor');
  };
  
  const renderContent = () => {
    // Show loading state
    if (isLoadingResumes || isLoadingTailored) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your data...</p>
          </div>
        </div>
      );
    }

    // Show error state
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => {
                loadResumes();
                loadTailoredResumes();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

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
  };

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