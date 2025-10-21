
import React, { useState } from 'react';
import type { ResumeData } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import Spinner from './common/Spinner';
import ResumeEditor from './ResumeEditor';
import { parseResumeText } from '../services/geminiService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

interface ProfileManagerProps {
  resumes: ResumeData[];
  addResume: (resume: ResumeData) => void;
  updateResume: (resume: ResumeData) => void;
  deleteResume: (resumeId: string) => void;
  baseResumeId: string | null;
  setBaseResumeId: (id: string | null) => void;
  apiKey: string | null;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ resumes, addResume, updateResume, deleteResume, baseResumeId, setBaseResumeId, apiKey }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [editingResume, setEditingResume] = useState<ResumeData | null>(null);

  const handleParseResume = async () => {
    if (!resumeText.trim() || !apiKey) {
      setError("Please paste your resume text and ensure your API key is set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const parsedData = await parseResumeText(resumeText, apiKey);
      const newResume: ResumeData = {
        ...parsedData,
        id: `resume-${Date.now()}`,
        name: `My Resume #${resumes.length + 1}`,
      };
      addResume(newResume);
      setEditingResume(newResume);
      setResumeText('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndCloseEditor = (updatedData: ResumeData) => {
    updateResume(updatedData);
    setEditingResume(null);
  }

  if (editingResume) {
    return <ResumeEditor 
            resumeData={editingResume} 
            onSave={handleSaveAndCloseEditor} 
            onCancel={() => setEditingResume(null)}
            />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Create New Profile from Resume</h2>
        <p className="text-gray-400 mb-4">Paste your resume text below to have AI parse it into a structured profile.</p>
        <Card>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your full resume text here..."
            className="w-full h-48 bg-gray-900 border border-gray-600 rounded-md p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoading}
          />
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleParseResume} disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : <PlusIcon />}
              {isLoading ? 'Parsing...' : 'Parse & Create Profile'}
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Your Resume Profiles</h2>
        {resumes.length === 0 ? (
          <p className="text-gray-400">You haven't created any profiles yet.</p>
        ) : (
          <div className="space-y-4">
            {resumes.map(resume => (
              <Card key={resume.id} className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{resume.name}</h3>
                  <p className="text-sm text-gray-400">{resume.contact.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={baseResumeId === resume.id ? 'primary' : 'secondary'}
                    onClick={() => setBaseResumeId(resume.id)}
                    disabled={baseResumeId === resume.id}
                  >
                    {baseResumeId === resume.id ? 'Base Profile' : 'Set as Base'}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingResume(resume)}>Edit</Button>
                  <Button variant="danger" onClick={() => deleteResume(resume.id)}><TrashIcon/></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileManager;
