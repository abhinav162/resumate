
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Tailored Resumes</h2>
        <Button onClick={onTailorNew}>
          <SparklesIcon />
          Tailor New Resume
        </Button>
      </div>
      {tailoredResumes.length === 0 ? (
        <Card className="text-center">
          <h3 className="text-lg font-medium text-white">No tailored resumes yet</h3>
          <p className="mt-1 text-sm text-gray-400">
            Click on "Tailor New Resume" to get started.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tailoredResumes.map((resume) => (
            <Card key={resume.id} className="flex flex-col justify-between hover:border-indigo-500 transition-all">
              <div>
                <h3 className="text-lg font-semibold text-indigo-400">{resume.jobDetails.jobTitle}</h3>
                <p className="text-md text-gray-300">{resume.jobDetails.company}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Created on {new Date(resume.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <Button onClick={() => onReTailor(resume)} variant="secondary" className="text-sm">
                  <SparklesIcon />
                  Re-tailor
                </Button>
                <Button onClick={() => onView(resume)} variant="primary" className="text-sm">
                  View & Download
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
