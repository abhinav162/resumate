import React from 'react';
import type { TailoredResume } from '../types';
import { Button, Card, Badge, MatchScore } from '../src/components/common';
import SparklesIcon from './icons/SparklesIcon';

interface DashboardProps {
  tailoredResumes: TailoredResume[];
  onTailorNew: () => void;
  onView: (resume: TailoredResume) => void;
  onReTailor: (resume: TailoredResume) => void;
}

/**
 * Generates a deterministic match score based on resume id.
 * In production, this would come from actual resume analysis.
 */
const getMatchScore = (resumeId: string): number => {
  const hash = resumeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 85 + (hash % 11); // Returns 85-95
};

/**
 * Determines if a resume is recent (created within last 7 days)
 */
const isRecentResume = (createdAt: Date | string): boolean => {
  const created = new Date(createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return created > sevenDaysAgo;
};

const Dashboard: React.FC<DashboardProps> = ({
  tailoredResumes,
  onTailorNew,
  onView,
  onReTailor,
}) => {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-text-primary">
            Dashboard
          </h2>
          <p className="font-body text-text-secondary mt-1">
            Manage your tailored resumes and applications.
          </p>
          {/* Stats row */}
          {tailoredResumes.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="default" size="sm">
                {tailoredResumes.length} {tailoredResumes.length === 1 ? 'Resume' : 'Resumes'}
              </Badge>
            </div>
          )}
        </div>
        <Button
          variant="primary"
          onClick={onTailorNew}
          icon={<SparklesIcon />}
          className="shadow-lg shadow-amber-400/20"
        >
          Tailor New Resume
        </Button>
      </div>

      {/* Content Section */}
      {tailoredResumes.length === 0 ? (
        /* Empty State */
        <Card variant="elevated" padding="lg" className="border-2 border-dashed border-border">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 bg-bg-tertiary rounded-full flex items-center justify-center mb-6">
              <SparklesIcon className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="font-display text-xl font-bold text-text-primary mb-2">
              No tailored resumes yet
            </h3>
            <p className="font-body text-text-secondary max-w-md text-center mb-8">
              Create your first tailored resume to see how Resumate can optimize
              your application for specific job descriptions.
            </p>
            <Button variant="primary" size="lg" onClick={onTailorNew}>
              Start Tailoring
            </Button>
          </div>
        </Card>
      ) : (
        /* Resume Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tailoredResumes.map((resume) => {
            const matchScore = getMatchScore(resume.id);
            const isRecent = isRecentResume(resume.createdAt);

            return (
              <Card
                key={resume.id}
                variant="bordered"
                padding="lg"
                hover
                className="flex flex-col group"
              >
                {/* Status Badge */}
                <div className="mb-3">
                  {isRecent ? (
                    <Badge variant="success" size="sm">
                      Recent
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      Saved
                    </Badge>
                  )}
                </div>

                {/* Job Info */}
                <div className="mb-4">
                  <h3
                    className="font-display font-bold text-xl text-text-primary group-hover:text-amber-400 transition-colors line-clamp-1"
                    title={resume.jobDetails.jobTitle}
                  >
                    {resume.jobDetails.jobTitle}
                  </h3>
                  <p className="font-body text-text-secondary mt-1">
                    {resume.jobDetails.company}
                  </p>
                </div>

                {/* Match Score */}
                <div className="flex justify-center my-4">
                  <MatchScore
                    score={matchScore}
                    size="sm"
                    animated={false}
                    showLabel
                  />
                </div>

                {/* Date */}
                <p className="text-sm font-body text-text-tertiary text-center mb-4">
                  Created {new Date(resume.createdAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="flex gap-3 mt-auto pt-4 border-t border-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onReTailor(resume)}
                    icon={<SparklesIcon />}
                    className="flex-1"
                  >
                    Re-tailor
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onView(resume)}
                    className="flex-1"
                  >
                    View
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
