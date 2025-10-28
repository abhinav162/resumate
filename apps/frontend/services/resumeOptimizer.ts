/**
 * Resume optimization service using RARe framework and XYZ/RAS transformations
 */

import type { ResumeData, JobDetails } from '../types';

/**
 * RARe framework criteria for resume evaluation
 */
export interface RaReScore {
    readability: number;
    applicability: number;
    remarkability: number;
    overall: number;
    feedback: {
        readability: string[];
        applicability: string[];
        remarkability: string[];
    };
}

/**
 * Resume optimization recommendations
 */
export interface OptimizationRecommendations {
    sectionReorganization: {
        currentOrder: string[];
        recommendedOrder: string[];
        reasoning: string;
    };
    bulletTransformations: {
        experience: Array<{
            original: string;
            transformed: string;
            framework: 'XYZ' | 'RAS';
            reasoning: string;
        }>;
        projects: Array<{
            original: string;
            transformed: string;
            framework: 'XYZ' | 'RAS';
            reasoning: string;
        }>;
    };
    generalImprovements: string[];
}

/**
 * Complete optimization analysis
 */
export interface ResumeOptimizationAnalysis {
    rareScore: RaReScore;
    recommendations: OptimizationRecommendations;
    optimizationPrompt: string;
}

/**
 * Generates a comprehensive resume optimization prompt using RARe framework
 */
export class ResumeOptimizer {
    
    /**
     * Creates the optimization prompt for AI analysis
     */
    generateOptimizationPrompt(
        currentTitle: string,
        desiredRole: string,
        desiredIndustry: string,
        jobDescription: string,
        resumeData: ResumeData
    ): string {
        const resumeText = this.convertResumeToText(resumeData);
        
        return `I am a ${currentTitle} going after ${desiredRole} in the ${desiredIndustry}. Here is the target job description:

${jobDescription}

Here is my resume:
${resumeText}

I want you to run a thorough analysis and feedback of my resume using these 3 steps:

1. Rate the first page of my resume on a scale of 5 using Varun Negandhi's RARe framework -- Readability, Applicability, and Remarkability. Be balanced, with a lean towards the critical, as the market is quite competitive.

RARe Framework:
For a resume to be interview-winning, it needs to be RARe.
- Readable: Easily scannable by a busy reader
- Applicable: Applicable to the position requirements  
- Remarkable: Experience bullets positioned impressively to spark interest

Readability Criteria:
□ Is the resume easily scannable by a busy reader?
- Ease-up the margins
- Avoid a long wall of bullet-point text
- Have a readable font size (11 pt or higher)
- Keep the formatting simple and consistent
- Don't crowd to fit to a 1-page resume. It is okay to have a 2-page resume
- Differentiate the font style to create visual separation between headings and bullet points

Applicability Criteria:
□ Is the resume applicable to the position requirements?
- If you have experience, lead with that right at the top, as it's your strongest suit
- Education can go at the end of the first page, or after your experience section
- If you have matching experience, there is no need to list relevant courses
- Keep the professional summary under five bullet points (3 is best)
- You can bring skills before experience if your work is tool heavy
- Don't highlight your soft skills, like, "Excellent team player."
- You can eliminate the objective section
- Use sub-sections to divide your experience bullets into sub-themes

Remarkability Criteria:
□ Are the experience bullets positioned impressively to spark interest?
- Use the Google XYZ framework or RAS framework
- Don't showcase a diamond as an uncut rock
- Let amazing experiences shine through clear positioning

2. Using the RARe framework, tell me how you would reorganize or re-size the sections of the first page of my resume to improve my readability and applicability.

3. Transform each of my bullets using the XYZ or the RAS framework. Keep it under 300 characters and use the highest tier of Bloom's Taxonomy for the action verbs. Make sure each bullet is a micro-story of the Why-How-What of that part of the project and has either a technical metric, or a business metric, or both.

XYZ Framework: "Accomplished [X] as measured by [Y], by doing [Z]"
RAS Framework: "Result - Action - Situation" or "Action - Situation - Result"

Provide specific, actionable feedback with exact recommendations for improvement.`;
    }

    /**
     * Converts resume data to readable text format
     */
    private convertResumeToText(resumeData: ResumeData): string {
        const { contact, summary, experience, projects, education, skills } = resumeData;
        
        let resumeText = `${contact.name}
${contact.location} | ${contact.phone} | ${contact.email}`;
        
        if (contact.linkedin) resumeText += ` | LinkedIn: ${contact.linkedin}`;
        if (contact.github) resumeText += ` | GitHub: ${contact.github}`;
        if (contact.website) resumeText += ` | Portfolio: ${contact.website}`;
        
        resumeText += `\n\nSKILLS\n${skills.join(', ')}`;
        
        if (summary) {
            resumeText += `\n\nSUMMARY\n${summary}`;
        }
        
        resumeText += `\n\nEXPERIENCE`;
        experience.forEach(exp => {
            resumeText += `\n\n${exp.role}, ${exp.company} | ${exp.location} | ${exp.startDate} - ${exp.endDate}`;
            exp.responsibilities.forEach(resp => {
                resumeText += `\n• ${resp}`;
            });
        });
        
        if (projects && projects.length > 0) {
            resumeText += `\n\nPROJECTS`;
            projects.forEach(proj => {
                resumeText += `\n\n${proj.name}`;
                if (proj.url) resumeText += ` | ${proj.url}`;
                if (proj.repoUrl) resumeText += ` | ${proj.repoUrl}`;
                proj.description.forEach(desc => {
                    resumeText += `\n• ${desc}`;
                });
            });
        }
        
        resumeText += `\n\nEDUCATION`;
        education.forEach(edu => {
            resumeText += `\n\n${edu.degree}, ${edu.institution} | ${edu.location} | ${edu.graduationDate}`;
            if (edu.gpa) resumeText += ` | CGPA: ${edu.gpa}`;
        });
        
        return resumeText;
    }

    /**
     * Generates a quick self-assessment using RARe framework
     */
    generateQuickAssessment(resumeData: ResumeData, jobDescription: string): RaReScore {
        const feedback = {
            readability: [] as string[],
            applicability: [] as string[],
            remarkability: [] as string[]
        };

        // Readability assessment
        let readabilityScore = 5;
        
        // Check for wall of text in bullets
        const avgBulletLength = this.getAverageBulletLength(resumeData);
        if (avgBulletLength > 150) {
            readabilityScore -= 1;
            feedback.readability.push("Bullet points are too long - aim for under 150 characters");
        }
        
        // Check section organization
        if (resumeData.summary && resumeData.summary.length > 500) {
            readabilityScore -= 0.5;
            feedback.readability.push("Summary is too long - keep under 3-5 bullet points");
        }

        // Applicability assessment
        let applicabilityScore = 5;
        
        // Check if skills match job description
        const skillsMatch = this.checkSkillsMatch(resumeData.skills, jobDescription);
        if (skillsMatch < 0.3) {
            applicabilityScore -= 1.5;
            feedback.applicability.push("Skills section doesn't strongly match job requirements");
        }
        
        // Check experience relevance
        const expRelevance = this.checkExperienceRelevance(resumeData.experience, jobDescription);
        if (expRelevance < 0.4) {
            applicabilityScore -= 1;
            feedback.applicability.push("Experience bullets need better alignment with job requirements");
        }

        // Remarkability assessment
        let remarkabilityScore = 5;
        
        // Check for metrics in bullets
        const hasMetrics = this.checkForMetrics(resumeData);
        if (hasMetrics < 0.5) {
            remarkabilityScore -= 1.5;
            feedback.remarkability.push("Add more quantitative metrics to experience bullets");
        }
        
        // Check for strong action verbs
        const hasStrongVerbs = this.checkForStrongActionVerbs(resumeData);
        if (!hasStrongVerbs) {
            remarkabilityScore -= 1;
            feedback.remarkability.push("Use higher-tier Bloom's Taxonomy action verbs");
        }

        const overall = (readabilityScore + applicabilityScore + remarkabilityScore) / 3;

        return {
            readability: Math.max(1, readabilityScore),
            applicability: Math.max(1, applicabilityScore),
            remarkability: Math.max(1, remarkabilityScore),
            overall: Math.max(1, overall),
            feedback
        };
    }

    private getAverageBulletLength(resumeData: ResumeData): number {
        const allBullets = [
            ...resumeData.experience.flatMap(exp => exp.responsibilities),
            ...(resumeData.projects?.flatMap(proj => proj.description) || [])
        ];
        
        if (allBullets.length === 0) return 0;
        
        const totalLength = allBullets.reduce((sum, bullet) => sum + bullet.length, 0);
        return totalLength / allBullets.length;
    }

    private checkSkillsMatch(skills: string[], jobDescription: string): number {
        const jobDescLower = jobDescription.toLowerCase();
        const matchingSkills = skills.filter(skill => 
            jobDescLower.includes(skill.toLowerCase())
        );
        return matchingSkills.length / skills.length;
    }

    private checkExperienceRelevance(experience: any[], jobDescription: string): number {
        const jobDescLower = jobDescription.toLowerCase();
        let relevantBullets = 0;
        let totalBullets = 0;

        experience.forEach(exp => {
            exp.responsibilities.forEach((resp: string) => {
                totalBullets++;
                // Simple keyword matching - could be enhanced with NLP
                const words = resp.toLowerCase().split(' ');
                const relevantWords = words.filter(word => jobDescLower.includes(word));
                if (relevantWords.length > 2) {
                    relevantBullets++;
                }
            });
        });

        return totalBullets > 0 ? relevantBullets / totalBullets : 0;
    }

    private checkForMetrics(resumeData: ResumeData): number {
        const allBullets = [
            ...resumeData.experience.flatMap(exp => exp.responsibilities),
            ...(resumeData.projects?.flatMap(proj => proj.description) || [])
        ];
        
        const metricsPattern = /\d+(\.\d+)?(%|x|\+|k|million|billion|hours?|days?|weeks?|months?|years?)/i;
        const bulletsWithMetrics = allBullets.filter(bullet => metricsPattern.test(bullet));
        
        return allBullets.length > 0 ? bulletsWithMetrics.length / allBullets.length : 0;
    }

    private checkForStrongActionVerbs(resumeData: ResumeData): boolean {
        const strongVerbs = [
            'architected', 'engineered', 'optimized', 'transformed', 'revolutionized',
            'spearheaded', 'pioneered', 'orchestrated', 'streamlined', 'accelerated',
            'enhanced', 'delivered', 'achieved', 'exceeded', 'generated', 'reduced',
            'improved', 'increased', 'developed', 'created', 'built', 'designed',
            'implemented', 'established', 'launched', 'led', 'managed', 'directed'
        ];

        const allBullets = [
            ...resumeData.experience.flatMap(exp => exp.responsibilities),
            ...(resumeData.projects?.flatMap(proj => proj.description) || [])
        ];

        return allBullets.some(bullet => {
            const firstWord = bullet.trim().split(' ')[0].toLowerCase();
            return strongVerbs.includes(firstWord);
        });
    }
}

// Export singleton instance
export const resumeOptimizer = new ResumeOptimizer();