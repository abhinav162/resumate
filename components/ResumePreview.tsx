import React, { useState } from 'react';
import type { ResumeData, JobDetails, Project } from '../types';
import Button from './common/Button';
import DownloadIcon from './icons/DownloadIcon';
import Spinner from './common/Spinner';
import { generateLatexPdf } from '../services/latexService';

interface ResumePreviewProps {
  originalResume: ResumeData;
  tailoredResume: ResumeData;
  jobDetails: JobDetails;
  onBack: () => void;
}

const HighlightedText: React.FC<{ original: string; tailored: string }> = ({ original, tailored }) => {
  if (original === tailored) {
    return <span>{tailored}</span>;
  }
  return <span className="bg-green-900 bg-opacity-50 rounded px-1 py-0.5">{tailored}</span>;
};


const ResumePreview: React.FC<ResumePreviewProps> = ({ originalResume, tailoredResume, jobDetails, onBack }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    const handleDownloadJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tailoredResume, null, 2));
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
            const pdfBlob = await generateLatexPdf(tailoredResume);
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Resume_${tailoredResume.contact.name.replace(/\s/g, '_')}_${jobDetails.company}.pdf`;
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
            <div className="flex gap-4">
                <Button onClick={handleDownloadJson}>
                    <DownloadIcon/>
                    Download as JSON
                </Button>
                 <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                    {isGeneratingPdf ? <Spinner size="sm" /> : <DownloadIcon />}
                    {isGeneratingPdf ? 'Generating PDF...' : 'Download as PDF'}
                </Button>
            </div>
        </div>
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-4xl mx-auto border border-gray-700">
            <div className="text-center mb-6">
                <h1 className="text-4xl font-bold text-white">{tailoredResume.contact.name}</h1>
                <p className="text-gray-300 mt-1">
                    {tailoredResume.contact.location} &bull; {tailoredResume.contact.phone} &bull; {tailoredResume.contact.email}
                </p>
                <p className="text-indigo-400 mt-1">
                    <a href={tailoredResume.contact.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a> &bull; <a href={tailoredResume.contact.github} target="_blank" rel="noopener noreferrer">GitHub</a>
                </p>
            </div>
            
            <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Summary</h2>
                <p className="text-gray-300">
                    <HighlightedText original={originalResume.summary} tailored={tailoredResume.summary} />
                </p>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-bold border-b-2 border-indigo-500 pb-1 mb-2 text-indigo-400">Experience</h2>
                {tailoredResume.experience.map((exp, index) => {
                    const originalExp = originalResume.experience.find(o => o.id === exp.id) || originalResume.experience[index];
                    return (
                        <div key={exp.id} className="mb-4">
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
                <p className="text-gray-300">
                    <HighlightedText original={originalResume.skills.join(', ')} tailored={tailoredResume.skills.join(', ')} />
                </p>
            </div>
        </div>
    </div>
  );
};

export default ResumePreview;