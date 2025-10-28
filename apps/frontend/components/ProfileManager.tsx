
import React, { useState } from 'react';
import type { ResumeData } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import Spinner from './common/Spinner';
import ResumeEditor from './ResumeEditor';
import geminiService from '../services/geminiService';
import { generateLatexPdf } from '../services/latexService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import DownloadIcon from './icons/DownloadIcon';

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
  const [viewingResume, setViewingResume] = useState<ResumeData | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleParseResume = async () => {
    if (!resumeText.trim() || !apiKey) {
      setError("Please paste your resume text and ensure your API key is set.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      geminiService.setApiKey(apiKey);
      const parsedData = await geminiService.parseResume(resumeText);
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
  };

  const handleDownloadJson = (resume: ResumeData) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resume, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${resume.name.replace(/\s/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDownloadPdf = async (resume: ResumeData) => {
    setDownloadingPdf(resume.id);
    setPdfError(null);
    try {
      const pdfBlob = await generateLatexPdf(resume);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resume.name.replace(/\s/g, '_')}_${resume.contact.name.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Failed to generate PDF:", error);
      setPdfError(error.message || "An unknown error occurred during PDF generation.");
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (editingResume) {
    return <ResumeEditor 
            resumeData={editingResume} 
            onSave={handleSaveAndCloseEditor} 
            onCancel={() => setEditingResume(null)}
            />;
  }

  if (viewingResume) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button onClick={() => setViewingResume(null)} variant="secondary">
            &larr; Back to Profiles
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-white">{viewingResume.name}</h2>
            <p className="text-gray-400">Profile Preview</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button onClick={() => handleDownloadJson(viewingResume)}>
              <DownloadIcon />
              Download JSON
            </Button>
            <Button 
              onClick={() => handleDownloadPdf(viewingResume)} 
              disabled={downloadingPdf === viewingResume.id}
            >
              {downloadingPdf === viewingResume.id ? <Spinner size="sm" /> : <DownloadIcon />}
              {downloadingPdf === viewingResume.id ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
        
        {pdfError && <p className="text-red-400 text-sm mb-4">PDF Error: {pdfError}</p>}
        
        <Card>
          <div className="bg-gray-900 p-6 rounded-lg">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white">{viewingResume.contact.name}</h1>
              <p className="text-gray-300 mt-1">
                {viewingResume.contact.location} • {viewingResume.contact.phone} • {viewingResume.contact.email}
              </p>
              <p className="text-indigo-400 mt-1">
                <a href={viewingResume.contact.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a> • <a href={viewingResume.contact.github} target="_blank" rel="noopener noreferrer">GitHub</a>
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Summary</h2>
              <p className="text-gray-300">{viewingResume.summary}</p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Experience</h2>
              {viewingResume.experience.map((exp) => (
                <div key={exp.id} className="mb-4">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-lg font-semibold text-white">{exp.role}</h3>
                    <p className="text-sm text-gray-400">{exp.startDate} - {exp.endDate}</p>
                  </div>
                  <p className="text-md text-gray-300">{exp.company}, {exp.location}</p>
                  <ul className="list-disc list-inside mt-1 text-gray-300 space-y-1">
                    {exp.responsibilities.map((resp, rIndex) => (
                      <li key={rIndex}>{resp}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {viewingResume.projects && viewingResume.projects.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Projects</h2>
                {viewingResume.projects.map((proj) => (
                  <div key={proj.id} className="mb-4">
                    <h3 className="text-lg font-semibold text-white">{proj.name}</h3>
                    {proj.url && <p className="text-indigo-400 text-sm"><a href={proj.url} target="_blank" rel="noopener noreferrer">Live Demo</a></p>}
                    {proj.repoUrl && <p className="text-indigo-400 text-sm"><a href={proj.repoUrl} target="_blank" rel="noopener noreferrer">Source Code</a></p>}
                    <ul className="list-disc list-inside mt-1 text-gray-300 space-y-1">
                      {proj.description.map((desc, dIndex) => (
                        <li key={dIndex}>{desc}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Education</h2>
              {viewingResume.education.map((edu) => (
                <div key={edu.id} className="mb-4">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-lg font-semibold text-white">{edu.degree}</h3>
                    <p className="text-sm text-gray-400">{edu.graduationDate}</p>
                  </div>
                  <p className="text-md text-gray-300">{edu.institution}, {edu.location}</p>
                  {edu.gpa && <p className="text-sm text-gray-400">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Skills</h2>
              <p className="text-gray-300">{viewingResume.skills.join(', ')}</p>
            </div>
          </div>
        </Card>
      </div>
    );
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
              <Card key={resume.id}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{resume.name}</h3>
                    <p className="text-sm text-gray-400">{resume.contact.name}</p>
                    <p className="text-xs text-gray-500">
                      {resume.experience.length} experience{resume.experience.length !== 1 ? 's' : ''} • 
                      {resume.projects?.length || 0} project{(resume.projects?.length || 0) !== 1 ? 's' : ''} • 
                      {resume.skills.length} skills
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={baseResumeId === resume.id ? 'primary' : 'secondary'}
                      onClick={() => setBaseResumeId(resume.id)}
                      disabled={baseResumeId === resume.id}
                    >
                      {baseResumeId === resume.id ? 'Base Profile' : 'Set as Base'}
                    </Button>
                    <Button variant="secondary" onClick={() => setViewingResume(resume)}>
                      👁️ View
                    </Button>
                    <Button variant="secondary" onClick={() => setEditingResume(resume)}>
                      ✏️ Edit
                    </Button>
                    <Button variant="danger" onClick={() => deleteResume(resume.id)}>
                      <TrashIcon/>
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500">
                    Quick Actions:
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => handleDownloadJson(resume)}
                    >
                      <DownloadIcon />
                      JSON
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => handleDownloadPdf(resume)}
                      disabled={downloadingPdf === resume.id}
                    >
                      {downloadingPdf === resume.id ? <Spinner size="sm" /> : <DownloadIcon />}
                      PDF
                    </Button>
                  </div>
                </div>
                
                {pdfError && downloadingPdf === resume.id && (
                  <p className="text-red-400 text-xs mt-2">Error: {pdfError}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileManager;
