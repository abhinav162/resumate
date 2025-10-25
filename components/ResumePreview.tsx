import React, { useState } from 'react';
import type { ResumeData, JobDetails, Project, Experience } from '../types';
import Button from './common/Button';
import DownloadIcon from './icons/DownloadIcon';
import SparklesIcon from './icons/SparklesIcon';
import Spinner from './common/Spinner';
import { generateLatexPdf } from '../services/latexService';
import ResumeInsightsPanel from './ResumeOptimizer';

interface ResumePreviewProps {
  originalResume: ResumeData;
  tailoredResume: ResumeData;
  jobDetails: JobDetails;
  onBack: () => void;
  onReTailor?: (resume: ResumeData) => void;
  onSaveEdits?: (editedResume: ResumeData) => void;
}

const HighlightedText: React.FC<{ original: string; tailored: string }> = ({ original, tailored }) => {
  if (original === tailored) {
    return <span>{tailored}</span>;
  }
  return <span className="bg-green-900 bg-opacity-50 rounded px-1 py-0.5">{tailored}</span>;
};


const ResumePreview: React.FC<ResumePreviewProps> = ({ originalResume, tailoredResume, jobDetails, onBack, onReTailor, onSaveEdits }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [showInsights, setShowInsights] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedResume, setEditedResume] = useState<ResumeData>(tailoredResume);

    const currentResume = isEditing ? editedResume : tailoredResume;

    const handleSaveEdits = () => {
        if (onSaveEdits) {
            onSaveEdits(editedResume);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedResume(tailoredResume);
        setIsEditing(false);
    };

    const updateExperience = (expIndex: number, field: keyof Experience, value: any) => {
        const updatedExperience = [...editedResume.experience];
        updatedExperience[expIndex] = { ...updatedExperience[expIndex], [field]: value };
        setEditedResume({ ...editedResume, experience: updatedExperience });
    };

    const updateResponsibility = (expIndex: number, respIndex: number, value: string) => {
        const updatedExperience = [...editedResume.experience];
        updatedExperience[expIndex].responsibilities[respIndex] = value;
        setEditedResume({ ...editedResume, experience: updatedExperience });
    };

    const handleDownloadJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentResume, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `resume_${jobDetails.company}_${jobDetails.jobTitle}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    
    const handleDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        setPdfError(null);
        try {
            const pdfBlob = await generateLatexPdf(currentResume);
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Resume_${currentResume.contact.name.replace(/\s/g, '_')}_${jobDetails.company}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error("Failed to generate PDF:", error);
            setPdfError(error.message || "An unknown error occurred during PDF generation.");
        } finally {
            setIsGeneratingPdf(false);
        }
    }
    
    const findOriginalProject = (p: Project) => originalResume.projects?.find(o => o.id === p.id);

  return (
    <div>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
                 <Button onClick={onBack} variant="secondary" className="mb-4">
                    &larr; Back to Dashboard
                </Button>
                <h2 className="text-3xl font-bold text-white">Tailored Resume for {jobDetails.jobTitle}</h2>
                <p className="text-lg text-gray-400">at {jobDetails.company}</p>
                 <p className="mt-2 text-sm text-green-400">Changes made by AI are highlighted in green.</p>
                 {pdfError && <p className="mt-2 text-sm text-red-400">PDF Generation Failed: {pdfError}</p>}
            </div>
            <div className="flex gap-4 flex-wrap">
                {isEditing ? (
                    <>
                        <Button onClick={handleSaveEdits} variant="primary">
                            Save Changes
                        </Button>
                        <Button onClick={handleCancelEdit} variant="secondary">
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Button 
                            onClick={() => setShowInsights(!showInsights)}
                            variant={showInsights ? "primary" : "secondary"}
                        >
                            <SparklesIcon />
                            {showInsights ? 'Hide Insights' : 'View Insights'}
                        </Button>
                        <Button 
                            onClick={() => setIsEditing(true)}
                            variant="secondary"
                        >
                            ✏️ Edit Resume
                        </Button>
                        {onReTailor && (
                            <Button 
                                onClick={() => onReTailor(currentResume)}
                                variant="secondary"
                            >
                                <SparklesIcon />
                                Re-tailor for New Job
                            </Button>
                        )}
                        <Button onClick={handleDownloadJson}>
                            <DownloadIcon/>
                            Download as JSON
                        </Button>
                         <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? <Spinner size="sm" /> : <DownloadIcon />}
                            {isGeneratingPdf ? 'Generating PDF...' : 'Download as PDF'}
                        </Button>
                    </>
                )}
            </div>
        </div>
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-4xl mx-auto border border-gray-700">
            <div className="text-center mb-6">
                <h1 className="text-4xl font-bold text-white">{currentResume.contact.name}</h1>
                <p className="text-gray-300 mt-1">
                    {currentResume.contact.location} &bull; {currentResume.contact.phone} &bull; {currentResume.contact.email}
                </p>
                <p className="text-indigo-400 mt-1">
                    <a href={currentResume.contact.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a> &bull; <a href={currentResume.contact.github} target="_blank" rel="noopener noreferrer">GitHub</a>
                </p>
            </div>
            
            <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Summary</h2>
                {isEditing ? (
                    <textarea
                        value={editedResume.summary}
                        onChange={(e) => setEditedResume({...editedResume, summary: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        rows={3}
                    />
                ) : (
                    <p className="text-gray-300">
                        <HighlightedText original={originalResume.summary} tailored={currentResume.summary} />
                    </p>
                )}
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Experience</h2>
                {currentResume.experience.map((exp, index) => {
                    const originalExp = originalResume.experience.find(o => o.id === exp.id) || originalResume.experience[index];
                    return (
                        <div key={exp.id} className="mb-4 p-4 border border-gray-700 rounded-md">
                            {isEditing ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                        <input
                                            value={exp.role}
                                            onChange={(e) => updateExperience(index, 'role', e.target.value)}
                                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-lg font-semibold"
                                            placeholder="Job Title"
                                        />
                                        <input
                                            value={exp.company}
                                            onChange={(e) => updateExperience(index, 'company', e.target.value)}
                                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
                                            placeholder="Company"
                                        />
                                        <input
                                            value={exp.location}
                                            onChange={(e) => updateExperience(index, 'location', e.target.value)}
                                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300"
                                            placeholder="Location"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                value={exp.startDate}
                                                onChange={(e) => updateExperience(index, 'startDate', e.target.value)}
                                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 flex-1"
                                                placeholder="Start Date"
                                            />
                                            <input
                                                value={exp.endDate}
                                                onChange={(e) => updateExperience(index, 'endDate', e.target.value)}
                                                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 flex-1"
                                                placeholder="End Date"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400">Responsibilities:</label>
                                        {exp.responsibilities.map((resp, rIndex) => (
                                            <textarea
                                                key={rIndex}
                                                value={resp}
                                                onChange={(e) => updateResponsibility(index, rIndex, e.target.value)}
                                                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 text-sm"
                                                rows={2}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between items-baseline">
                                        <h3 className="text-lg font-semibold text-white">{exp.role}</h3>
                                        <p className="text-sm text-gray-400">{exp.startDate} - {exp.endDate}</p>
                                    </div>
                                    <p className="text-md text-gray-300">{exp.company}, {exp.location}</p>
                                    <ul className="list-disc list-inside mt-1 text-gray-300 space-y-1">
                                        {exp.responsibilities.map((resp, rIndex) => (
                                            <li key={rIndex}>
                                                <HighlightedText original={originalExp?.responsibilities[rIndex] || ''} tailored={resp} />
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )
                })}
            </div>

            {tailoredResume.projects && tailoredResume.projects.length > 0 && <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Projects</h2>
                {tailoredResume.projects.map((proj) => {
                    const originalProj = findOriginalProject(proj);
                    return (
                        <div key={proj.id} className="mb-4">
                            <div className="flex justify-between items-baseline">
                                <h3 className="text-lg font-semibold text-white">{proj.name}</h3>
                            </div>
                            <ul className="list-disc list-inside mt-1 text-gray-300 space-y-1">
                                {proj.description.map((desc, dIndex) => (
                                    <li key={dIndex}>
                                        <HighlightedText original={originalProj?.description[dIndex] || ''} tailored={desc} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                })}
            </div>}

             <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Education</h2>
                {tailoredResume.education.map((edu) => (
                    <div key={edu.id} className="mb-4">
                        <div className="flex justify-between items-baseline">
                            <h3 className="text-lg font-semibold text-white">{edu.degree}</h3>
                            <p className="text-sm text-gray-400">{edu.graduationDate}</p>
                        </div>
                        <p className="text-md text-gray-300">{edu.institution}, {edu.location}</p>
                    </div>
                ))}
            </div>

             <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Skills</h2>
                {isEditing ? (
                    <textarea
                        value={editedResume.skills.join(', ')}
                        onChange={(e) => setEditedResume({...editedResume, skills: e.target.value.split(', ').map(s => s.trim())})}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        rows={3}
                        placeholder="Enter skills separated by commas"
                    />
                ) : (
                    <p className="text-gray-300">
                        <HighlightedText original={originalResume.skills.join(', ')} tailored={currentResume.skills.join(', ')} />
                    </p>
                )}
            </div>
        </div>

        {/* Optimization Insights Panel */}
        {showInsights && (
            <div className="mt-6">
                <ResumeInsightsPanel 
                    originalResume={originalResume}
                    tailoredResume={tailoredResume}
                    jobDetails={jobDetails}
                />
            </div>
        )}
    </div>
  );
};

export default ResumePreview;