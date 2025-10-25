import React, { useState, useEffect } from 'react';
import type { ResumeData, JobDetails } from '../types';
import { resumeOptimizer, type RaReScore } from '../services/resumeOptimizer';
import Card from './common/Card';
import SparklesIcon from './icons/SparklesIcon';

interface ResumeOptimizerProps {
  originalResume: ResumeData;
  tailoredResume: ResumeData;
  jobDetails: JobDetails;
  className?: string;
}

const ResumeInsightsPanel: React.FC<ResumeOptimizerProps> = ({ 
  originalResume, 
  tailoredResume, 
  jobDetails, 
  className = '' 
}) => {
  const [originalScore, setOriginalScore] = useState<RaReScore | null>(null);
  const [tailoredScore, setTailoredScore] = useState<RaReScore | null>(null);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const analyzeResumes = async () => {
      setIsLoading(true);
      
      // Analyze both versions
      const originalAnalysis = resumeOptimizer.generateQuickAssessment(originalResume, jobDetails.description);
      const tailoredAnalysis = resumeOptimizer.generateQuickAssessment(tailoredResume, jobDetails.description);
      
      setOriginalScore(originalAnalysis);
      setTailoredScore(tailoredAnalysis);
      
      // Generate improvement insights
      const improvementsList = generateImprovements(originalAnalysis, tailoredAnalysis);
      setImprovements(improvementsList);
      
      setIsLoading(false);
    };

    analyzeResumes();
  }, [originalResume, tailoredResume, jobDetails]);

  const generateImprovements = (original: RaReScore, tailored: RaReScore): string[] => {
    const improvements: string[] = [];
    
    // Compare scores and generate insights
    if (tailored.readability > original.readability) {
      improvements.push(`Improved readability by ${(tailored.readability - original.readability).toFixed(1)} points`);
    }
    
    if (tailored.applicability > original.applicability) {
      improvements.push(`Enhanced job relevance by ${(tailored.applicability - original.applicability).toFixed(1)} points`);
    }
    
    if (tailored.remarkability > original.remarkability) {
      improvements.push(`Strengthened impact statements by ${(tailored.remarkability - original.remarkability).toFixed(1)} points`);
    }

    // Add specific improvements based on bullet analysis
    const originalBullets = [
      ...originalResume.experience.flatMap(exp => exp.responsibilities),
      ...(originalResume.projects?.flatMap(proj => proj.description) || [])
    ];
    
    const tailoredBullets = [
      ...tailoredResume.experience.flatMap(exp => exp.responsibilities),
      ...(tailoredResume.projects?.flatMap(proj => proj.description) || [])
    ];

    // Check for metric improvements
    const originalMetrics = originalBullets.filter(bullet => /\d+(\.\d+)?(%|x|\+|k|million|billion)/.test(bullet)).length;
    const tailoredMetrics = tailoredBullets.filter(bullet => /\d+(\.\d+)?(%|x|\+|k|million|billion)/.test(bullet)).length;
    
    if (tailoredMetrics > originalMetrics) {
      improvements.push(`Added ${tailoredMetrics - originalMetrics} quantitative metrics`);
    }

    // Check for strong action verbs
    const strongVerbs = ['architected', 'engineered', 'optimized', 'spearheaded', 'enhanced', 'delivered'];
    const originalStrongVerbs = originalBullets.filter(bullet => 
      strongVerbs.some(verb => bullet.toLowerCase().startsWith(verb))
    ).length;
    const tailoredStrongVerbs = tailoredBullets.filter(bullet => 
      strongVerbs.some(verb => bullet.toLowerCase().startsWith(verb))
    ).length;
    
    if (tailoredStrongVerbs > originalStrongVerbs) {
      improvements.push(`Enhanced ${tailoredStrongVerbs - originalStrongVerbs} bullets with stronger action verbs`);
    }

    return improvements;
  };

  const ScoreDisplay = ({ 
    label, 
    originalScore, 
    tailoredScore, 
    feedback 
  }: { 
    label: string; 
    originalScore: number; 
    tailoredScore: number; 
    feedback: string[] 
  }) => {
    const improvement = tailoredScore - originalScore;
    const improvementColor = improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-gray-400';
    
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-white">{label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${originalScore >= 4 ? 'text-green-400' : originalScore >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
              {originalScore.toFixed(1)}
            </span>
            <span className="text-gray-500">→</span>
            <span className={`text-lg font-bold ${tailoredScore >= 4 ? 'text-green-400' : tailoredScore >= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
              {tailoredScore.toFixed(1)}
            </span>
            {improvement !== 0 && (
              <span className={`text-sm ${improvementColor}`}>
                ({improvement > 0 ? '+' : ''}{improvement.toFixed(1)})
              </span>
            )}
          </div>
        </div>
        {feedback.length > 0 && (
          <ul className="text-sm text-gray-300 space-y-1">
            {feedback.slice(0, 2).map((item, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Analyzing optimizations...</span>
        </div>
      </Card>
    );
  }

  if (!originalScore || !tailoredScore) {
    return null;
  }

  const overallImprovement = tailoredScore.overall - originalScore.overall;

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <SparklesIcon />
        <h3 className="text-xl font-semibold text-white">Optimization Insights</h3>
      </div>
      
      {/* Overall Score Improvement */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-white text-lg">Overall RARe Score</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{originalScore.overall.toFixed(1)}</span>
            <span className="text-gray-500">→</span>
            <span className={`text-xl font-bold ${
              tailoredScore.overall >= 4 ? 'text-green-400' : 
              tailoredScore.overall >= 3 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {tailoredScore.overall.toFixed(1)}/5
            </span>
            {overallImprovement !== 0 && (
              <span className={`text-lg ${overallImprovement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({overallImprovement > 0 ? '+' : ''}{overallImprovement.toFixed(1)})
              </span>
            )}
          </div>
        </div>
        {overallImprovement > 0 && (
          <p className="text-green-300 text-sm">
            🎉 Great improvement! Your resume is now more competitive.
          </p>
        )}
      </div>

      {/* Detailed Scores */}
      <div className="space-y-4 mb-6">
        <ScoreDisplay 
          label="Readability" 
          originalScore={originalScore.readability}
          tailoredScore={tailoredScore.readability}
          feedback={tailoredScore.feedback.readability}
        />
        
        <ScoreDisplay 
          label="Applicability" 
          originalScore={originalScore.applicability}
          tailoredScore={tailoredScore.applicability}
          feedback={tailoredScore.feedback.applicability}
        />
        
        <ScoreDisplay 
          label="Remarkability" 
          originalScore={originalScore.remarkability}
          tailoredScore={tailoredScore.remarkability}
          feedback={tailoredScore.feedback.remarkability}
        />
      </div>

      {/* Key Improvements */}
      {improvements.length > 0 && (
        <div className="border-t border-gray-600 pt-4">
          <h4 className="font-semibold text-white mb-3">Key Improvements Made:</h4>
          <ul className="space-y-2">
            {improvements.map((improvement, index) => (
              <li key={index} className="flex items-start text-sm text-green-300">
                <span className="text-green-400 mr-2">✓</span>
                {improvement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optimization Tip */}
      <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-600">
        <h4 className="font-semibold text-blue-300 mb-2">💡 Pro Tip:</h4>
        <p className="text-sm text-blue-200">
          {tailoredScore.overall >= 4 
            ? "Excellent! Your resume follows RARe framework principles and should perform well with ATS systems."
            : tailoredScore.overall >= 3
            ? "Good progress! Consider adding more quantitative metrics and stronger action verbs for even better results."
            : "Keep optimizing! Focus on adding specific metrics, using XYZ framework structure, and ensuring job keyword alignment."
          }
        </p>
      </div>
    </Card>
  );
};

export default ResumeInsightsPanel;