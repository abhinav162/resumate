
import React, { useState } from 'react';
import type { ResumeData } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import Spinner from './common/Spinner';
import ResumeEditor from './ResumeEditor';
import { apiClient } from '../services/api';
import { generateLatexPdf } from '../services/latexService';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import DownloadIcon from './icons/DownloadIcon';
import SparklesIcon from './icons/SparklesIcon';

interface ProfileManagerProps {
  resumes: ResumeData[];
  addResume: (resume: ResumeData) => Promise<ResumeData>;
  updateResume: (resume: ResumeData) => Promise<ResumeData>;
  deleteResume: (resumeId: string) => Promise<void>;
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
      const parsedData = await apiClient.parseResume(resumeText, apiKey);
      const newResume: ResumeData = {
        ...parsedData,
        name: `My Resume #${resumes.length + 1}`,
        experience: parsedData.experience?.map(e => ({ ...e, id: e.id || crypto.randomUUID() })) || [],
        education: parsedData.education?.map(e => ({ ...e, id: e.id || crypto.randomUUID() })) || [],
        projects: parsedData.projects?.map(e => ({ ...e, id: e.id || crypto.randomUUID() })) || [],
      };
      const createdResume = await addResume(newResume);
      setEditingResume(createdResume);
      setResumeText('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndCloseEditor = async (updatedData: ResumeData) => {
    try {
      setError(null);
      await updateResume(updatedData);
      setEditingResume(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update resume');
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    try {
      setError(null);
      await deleteResume(resumeId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete resume');
    }
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
              <p className="text-indigo-400 mt-1 flex justify-center gap-2">
                {viewingResume.contact.linkedin && (
                  <a href={viewingResume.contact.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                )}
                {viewingResume.contact.linkedin && viewingResume.contact.github && <span>•</span>}
                {viewingResume.contact.github && (
                  <a href={viewingResume.contact.github} target="_blank" rel="noopener noreferrer">GitHub</a>
                )}
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
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white">Profile Manager</h2>
          <p className="text-gray-400 mt-1">Manage your base resumes and profiles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create New Profile Card */}
        <div className="lg:col-span-1">
          <Card className="h-full border-dashed border-2 border-gray-700 bg-gray-800/30 hover:border-indigo-500/50 transition-colors">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><PlusIcon /></span>
              New Profile
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Paste your resume text below to have AI parse it into a structured profile.
            </p>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your full resume text here..."
              className="w-full h-48 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 mb-4 resize-none"
              disabled={isLoading}
            />
            {error && <p className="text-red-400 text-xs mb-4 bg-red-900/20 p-2 rounded">{error}</p>}
            <Button onClick={handleParseResume} disabled={isLoading} className="w-full justify-center">
              {isLoading ? <Spinner size="sm" /> : <SparklesIcon />}
              {isLoading ? 'Parsing...' : 'Parse & Create'}
            </Button>
          </Card>
        </div>

        {/* Profiles List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-white mb-4">Your Profiles</h3>
          {resumes.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-2xl">
              <p className="text-gray-400">You haven't created any profiles yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {resumes.map(resume => (
                <Card key={resume.id} className={`transition-all ${baseResumeId === resume.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'hover:border-gray-600'}`}>
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white">{resume.name}</h3>
                        {baseResumeId === resume.id && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                            Default Base
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 font-medium">{resume.contact.name}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="px-2 py-1 text-xs bg-gray-800 rounded text-gray-400 border border-gray-700">
                          {resume.experience.length} Experience
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-800 rounded text-gray-400 border border-gray-700">
                          {resume.projects?.length || 0} Projects
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-800 rounded text-gray-400 border border-gray-700">
                          {resume.skills.length} Skills
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setViewingResume(resume)}
                          className="flex-1 justify-center"
                          title="View Profile"
                        >
                          👁️
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingResume(resume)}
                          className="flex-1 justify-center"
                          title="Edit Profile"
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteResume(resume.id)}
                          className="flex-1 justify-center"
                          title="Delete Profile"
                        >
                          <TrashIcon />
                        </Button>
                      </div>

                      <Button
                        variant={baseResumeId === resume.id ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setBaseResumeId(resume.id)}
                        disabled={baseResumeId === resume.id}
                        className="justify-center"
                      >
                        {baseResumeId === resume.id ? 'Active Base' : 'Set as Base'}
                      </Button>

                      <div className="flex gap-2 mt-auto pt-2 border-t border-gray-700/50">
                        <button
                          onClick={() => handleDownloadJson(resume)}
                          className="flex-1 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          JSON
                        </button>
                        <span className="text-gray-700">|</span>
                        <button
                          onClick={() => handleDownloadPdf(resume)}
                          disabled={downloadingPdf === resume.id}
                          className="flex-1 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          {downloadingPdf === resume.id ? '...' : 'PDF'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {pdfError && downloadingPdf === resume.id && (
                    <p className="text-red-400 text-xs mt-2 text-right">Error: {pdfError}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileManager;
