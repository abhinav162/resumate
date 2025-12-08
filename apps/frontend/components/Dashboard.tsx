
import React from 'react';
import type { TailoredResume } from '../types';
import Button from './common/Button';
import Card from './common/Card';
import SparklesIcon from './icons/SparklesIcon';

interface DashboardProps {
  tailoredResumes: TailoredResume[];
  onTailorNew: () => void;
  onView: (resume: TailoredResume) => void;
  onReTailor: (resume: TailoredResume) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tailoredResumes, onTailorNew, onView, onReTailor }) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-gray-400 mt-1">Manage your tailored resumes and applications.</p>
        </div>
        <Button onClick={onTailorNew} className="shadow-lg shadow-indigo-500/20">
          <SparklesIcon />
          Tailor New Resume
        </Button>
      </div>

      {tailoredResumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-700">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">✨</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No tailored resumes yet</h3>
          <p className="text-gray-400 max-w-md text-center mb-8">
            Create your first tailored resume to see how Resumate can optimize your application for specific job descriptions.
          </p>
          <Button onClick={onTailorNew} size="lg">
            Start Tailoring
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tailoredResumes.map((resume) => (
            <Card key={resume.id} className="flex flex-col justify-between hover:border-indigo-500 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1" title={resume.jobDetails.jobTitle}>
                    {resume.jobDetails.jobTitle}
                  </h3>
                  <p className="text-sm text-gray-400 font-medium">{resume.jobDetails.company}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <span>📅 {new Date(resume.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-800">
                <Button onClick={() => onReTailor(resume)} variant="secondary" size="sm" className="flex-1 justify-center">
                  <SparklesIcon />
                  Re-tailor
                </Button>
                <Button onClick={() => onView(resume)} variant="primary" size="sm" className="flex-1 justify-center">
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
