/**
 * Resume enhancement service that applies RARe framework during tailoring
 */

import type { ResumeData, JobDetails, Experience, Project } from '../types';

/**
 * Enhancement configuration
 */
export interface EnhancementConfig {
    enableRaReOptimization: boolean;
    enableXYZFramework: boolean;
    enableStrongActionVerbs: boolean;
    enableMetricEnhancement: boolean;
    maxBulletLength: number;
}

/**
 * Default enhancement configuration
 */
export const defaultEnhancementConfig: EnhancementConfig = {
    enableRaReOptimization: true,
    enableXYZFramework: true,
    enableStrongActionVerbs: true,
    enableMetricEnhancement: true,
    maxBulletLength: 300
};

/**
 * Resume enhancement service
 */
export class ResumeEnhancer {
    
    /**
     * Enhances resume content using RARe framework principles
     */
    enhanceResume(
        resumeData: ResumeData, 
        jobDetails: JobDetails, 
        config: EnhancementConfig = defaultEnhancementConfig
    ): ResumeData {
        const enhanced = { ...resumeData };

        if (config.enableRaReOptimization) {
            // Enhance experience bullets
            enhanced.experience = enhanced.experience.map(exp => 
                this.enhanceExperience(exp, jobDetails, config)
            );

            // Enhance project descriptions
            if (enhanced.projects) {
                enhanced.projects = enhanced.projects.map(proj => 
                    this.enhanceProject(proj, jobDetails, config)
                );
            }

            // Enhance summary for better applicability
            enhanced.summary = this.enhanceSummary(enhanced.summary, jobDetails);

            // Optimize skills order based on job relevance
            enhanced.skills = this.optimizeSkillsOrder(enhanced.skills, jobDetails);
        }

        return enhanced;
    }

    /**
     * Enhances experience entries
     */
    private enhanceExperience(
        experience: Experience, 
        jobDetails: JobDetails, 
        config: EnhancementConfig
    ): Experience {
        const enhanced = { ...experience };

        enhanced.responsibilities = enhanced.responsibilities.map(bullet => {
            let enhancedBullet = bullet;

            if (config.enableStrongActionVerbs) {
                enhancedBullet = this.enhanceActionVerbs(enhancedBullet);
            }

            if (config.enableXYZFramework) {
                enhancedBullet = this.applyXYZFramework(enhancedBullet);
            }

            if (config.enableMetricEnhancement) {
                enhancedBullet = this.enhanceMetrics(enhancedBullet);
            }

            // Ensure bullet doesn't exceed max length
            if (enhancedBullet.length > config.maxBulletLength) {
                enhancedBullet = this.trimBullet(enhancedBullet, config.maxBulletLength);
            }

            return enhancedBullet;
        });

        return enhanced;
    }

    /**
     * Enhances project descriptions
     */
    private enhanceProject(
        project: Project, 
        jobDetails: JobDetails, 
        config: EnhancementConfig
    ): Project {
        const enhanced = { ...project };

        enhanced.description = enhanced.description.map(bullet => {
            let enhancedBullet = bullet;

            if (config.enableStrongActionVerbs) {
                enhancedBullet = this.enhanceActionVerbs(enhancedBullet);
            }

            if (config.enableXYZFramework) {
                enhancedBullet = this.applyXYZFramework(enhancedBullet);
            }

            if (config.enableMetricEnhancement) {
                enhancedBullet = this.enhanceMetrics(enhancedBullet);
            }

            if (enhancedBullet.length > config.maxBulletLength) {
                enhancedBullet = this.trimBullet(enhancedBullet, config.maxBulletLength);
            }

            return enhancedBullet;
        });

        return enhanced;
    }

    /**
     * Enhances summary for better applicability
     */
    private enhanceSummary(summary: string, jobDetails: JobDetails): string {
        if (!summary) return summary;

        // Keep summary concise (under 400 characters)
        if (summary.length > 400) {
            const sentences = summary.split('. ');
            let trimmed = sentences[0];
            
            for (let i = 1; i < sentences.length && trimmed.length < 350; i++) {
                const nextSentence = sentences[i];
                if (trimmed.length + nextSentence.length + 2 <= 350) {
                    trimmed += '. ' + nextSentence;
                }
            }
            
            return trimmed.endsWith('.') ? trimmed : trimmed + '.';
        }

        return summary;
    }

    /**
     * Optimizes skills order based on job relevance
     */
    private optimizeSkillsOrder(skills: string[], jobDetails: JobDetails): string[] {
        const jobDescLower = jobDetails.description.toLowerCase();
        
        // Score skills based on job description mentions
        const scoredSkills = skills.map(skill => ({
            skill,
            score: jobDescLower.includes(skill.toLowerCase()) ? 1 : 0
        }));

        // Sort by relevance, then alphabetically
        scoredSkills.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return a.skill.localeCompare(b.skill);
        });

        return scoredSkills.map(item => item.skill);
    }

    /**
     * Enhances action verbs with stronger alternatives
     */
    private enhanceActionVerbs(bullet: string): string {
        const verbReplacements: Record<string, string> = {
            'worked': 'collaborated',
            'helped': 'facilitated',
            'made': 'created',
            'did': 'executed',
            'built': 'architected',
            'created': 'engineered',
            'developed': 'designed',
            'improved': 'optimized',
            'increased': 'accelerated',
            'reduced': 'streamlined',
            'managed': 'orchestrated',
            'led': 'spearheaded',
            'handled': 'managed',
            'responsible for': 'owned',
            'dealt with': 'resolved',
            'fixed': 'resolved',
            'updated': 'enhanced',
            'changed': 'transformed',
            'added': 'integrated',
            'used': 'leveraged'
        };

        let enhanced = bullet;
        const firstWord = bullet.trim().split(' ')[0].toLowerCase();
        
        if (verbReplacements[firstWord]) {
            const replacement = verbReplacements[firstWord];
            enhanced = replacement.charAt(0).toUpperCase() + replacement.slice(1) + 
                      bullet.slice(firstWord.length);
        }

        // Replace weak verbs in the middle of sentences
        Object.entries(verbReplacements).forEach(([weak, strong]) => {
            const regex = new RegExp(`\\b${weak}\\b`, 'gi');
            enhanced = enhanced.replace(regex, strong);
        });

        return enhanced;
    }

    /**
     * Applies XYZ framework structure
     */
    private applyXYZFramework(bullet: string): string {
        // Check if bullet already follows XYZ pattern
        const hasMetric = /\d+(\.\d+)?(%|x|\+|k|million|billion|hours?|days?|weeks?|months?|years?)/i.test(bullet);
        const hasAction = /^(Architected|Engineered|Optimized|Developed|Created|Built|Designed|Implemented|Enhanced|Achieved|Delivered|Led|Managed|Increased|Reduced|Improved)/i.test(bullet);
        
        // If it already has good structure, return as is
        if (hasMetric && hasAction) {
            return bullet;
        }

        // Basic XYZ enhancement - add structure cues
        if (!hasMetric && bullet.includes('improved') || bullet.includes('increased') || bullet.includes('reduced')) {
            // Suggest where metrics could be added
            return bullet + ' [add specific metric]';
        }

        return bullet;
    }

    /**
     * Enhances metrics in bullets
     */
    private enhanceMetrics(bullet: string): string {
        // Convert percentage improvements to more impactful phrasing
        let enhanced = bullet;

        // Enhance time-based metrics
        enhanced = enhanced.replace(/(\d+) hours?/gi, '$1+ hours');
        enhanced = enhanced.replace(/(\d+) days?/gi, '$1+ days');
        
        // Enhance percentage metrics
        enhanced = enhanced.replace(/(\d+)%/gi, '$1%');
        enhanced = enhanced.replace(/by (\d+)/gi, 'by $1+');

        // Add "over" for large numbers to make them more impactful
        enhanced = enhanced.replace(/(\d{4,})/g, 'over $1');
        enhanced = enhanced.replace(/(\d+) million/gi, '$1+ million');
        enhanced = enhanced.replace(/(\d+) thousand/gi, '$1K+');

        return enhanced;
    }

    /**
     * Trims bullet to specified length while preserving meaning
     */
    private trimBullet(bullet: string, maxLength: number): string {
        if (bullet.length <= maxLength) return bullet;

        // Try to trim at sentence boundaries first
        const sentences = bullet.split('. ');
        if (sentences.length > 1) {
            let trimmed = sentences[0];
            for (let i = 1; i < sentences.length; i++) {
                if (trimmed.length + sentences[i].length + 2 <= maxLength) {
                    trimmed += '. ' + sentences[i];
                } else {
                    break;
                }
            }
            if (trimmed.length <= maxLength) {
                return trimmed.endsWith('.') ? trimmed : trimmed + '.';
            }
        }

        // If still too long, trim at word boundaries
        const words = bullet.split(' ');
        let trimmed = '';
        for (const word of words) {
            if (trimmed.length + word.length + 1 <= maxLength - 3) {
                trimmed += (trimmed ? ' ' : '') + word;
            } else {
                break;
            }
        }

        return trimmed + '...';
    }

    /**
     * Generates enhancement prompt for AI services
     */
    generateEnhancementPrompt(
        resumeData: ResumeData, 
        jobDetails: JobDetails,
        config: EnhancementConfig
    ): string {
        return `You are an expert resume optimizer. Please enhance this resume for the following job using the RARe framework:

JOB DETAILS:
Title: ${jobDetails.jobTitle}
Company: ${jobDetails.company}
Description: ${jobDetails.description}

ENHANCEMENT REQUIREMENTS:
1. READABILITY: Keep bullets under ${config.maxBulletLength} characters, ensure scannable format
2. APPLICABILITY: Align content with job requirements, prioritize relevant skills
3. REMARKABILITY: Use XYZ framework (Accomplished X as measured by Y by doing Z), strong action verbs from Bloom's Taxonomy

CURRENT RESUME CONTENT:
${JSON.stringify(resumeData, null, 2)}

Please enhance each bullet point following these rules:
- Start with high-impact action verbs (Architected, Engineered, Optimized, etc.)
- Include quantitative metrics where possible
- Follow XYZ or RAS framework structure
- Keep under ${config.maxBulletLength} characters
- Align with job requirements
- Focus on business impact and technical achievements

Return the enhanced resume in the same JSON format.`;
    }
}

// Export singleton instance
export const resumeEnhancer = new ResumeEnhancer();