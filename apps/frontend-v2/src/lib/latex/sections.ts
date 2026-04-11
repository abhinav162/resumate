/**
 * Resume section generators
 */

import type { ResumeData } from '../../types';
import { escapeLatex, createHyperlink, createEmailLink, joinWithLineBreaks } from './utils';

type ContactInfo = ResumeData['contact'];
type Experience = ResumeData['experience'][0];
type Education = ResumeData['education'][0];

/**
 * Configuration for section generation
 */
export interface SectionConfig {
    showEmptyFields?: boolean;
    urlDisplayThreshold?: number;
    customLabels?: Record<string, string>;
}

/**
 * Generates the contact header section
 */
export class HeaderGenerator {
    private config: SectionConfig;
    constructor(config: SectionConfig = {}) {
        this.config = config;
    }

    generate(contact: ContactInfo): { address1: string; address2: string } {
        const urlThreshold = this.config.urlDisplayThreshold || 30;
        
        // Primary contact info
        const address1 = `${escapeLatex(contact.phone)} \\\\ ${escapeLatex(contact.location)}`;
        
        // Secondary contact info with conditional fields
        const address2Parts: string[] = [];
        
        // Email is always included
        address2Parts.push(createEmailLink(contact.email));
        
        // LinkedIn - only if provided
        if (contact.linkedin && contact.linkedin.trim()) {
            const linkedinDisplay = contact.linkedin.length > urlThreshold ? 'LinkedIn' : contact.linkedin;
            address2Parts.push(createHyperlink(contact.linkedin, linkedinDisplay));
        }
        
        // GitHub - only if provided
        if (contact.github && contact.github.trim()) {
            const githubDisplay = contact.github.length > urlThreshold ? 'GitHub' : contact.github;
            address2Parts.push(createHyperlink(contact.github, githubDisplay));
        }
        
        // Website/Portfolio - only if provided
        if (contact.website && contact.website.trim()) {
            const websiteDisplay = contact.website.length > urlThreshold ? 'Portfolio' : contact.website;
            address2Parts.push(createHyperlink(contact.website, websiteDisplay));
        }
        
        return {
            address1,
            address2: joinWithLineBreaks(address2Parts)
        };
    }
}

/**
 * Generates the skills section
 */
export class SkillsGenerator {
    private config: SectionConfig;
    constructor(config: SectionConfig = {}) {
        this.config = config;
    }

    generate(skills: string[]): string {
        const sectionTitle = this.config.customLabels?.skills || 'SKILLS';
        const skillsFormatted = skills.map(s => escapeLatex(s)).join(', ');
        
        return `\\begin{rSection}{${sectionTitle}}
    ${skillsFormatted}
\\end{rSection}
`;
    }
}

/**
 * Generates the summary section
 */
export class SummaryGenerator {
    private config: SectionConfig;
    constructor(config: SectionConfig = {}) {
        this.config = config;
    }

    generate(summary: string): string {
        if (!summary || !summary.trim()) return '';
        
        const sectionTitle = this.config.customLabels?.summary || 'SUMMARY';
        
        return `\\begin{rSection}{${sectionTitle}}
    ${escapeLatex(summary)}
\\end{rSection}
`;
    }
}

/**
 * Generates the experience section
 */
export class ExperienceGenerator {
    private config: SectionConfig;
    constructor(config: SectionConfig = {}) {
        this.config = config;
    }

    generate(experiences: Experience[]): string {
        const sectionTitle = this.config.customLabels?.experience || 'EXPERIENCE';
        
        // Sort experiences by date (most recent first)
        const sortedExperiences = this.sortExperiencesByDate(experiences);
        
        const experienceFormatted = sortedExperiences.map(exp => {
            // Split description by newlines to form items
            const responsibilities = exp.description.split('\n').filter(r => r.trim());
            
            return `
\\textbf{${escapeLatex(exp.role)}} \\\\ ${escapeLatex(exp.company)} \\hfill ${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}
 \\begin{itemize}
    \\itemsep -5pt {} 
    ${responsibilities.map(r => `\\item ${escapeLatex(r)}`).join('\n    ')}
 \\end{itemize}
`;
        }).join('\n');
        
        return `\\begin{rSection}{${sectionTitle}}
    ${experienceFormatted}
\\end{rSection}
`;
    }

    /**
     * Sorts experiences by date (most recent first)
     */
    private sortExperiencesByDate(experiences: Experience[]): Experience[] {
        return [...experiences].sort((a, b) => {
            // Handle "Present" as current date
            const aEndDate = a.endDate.toLowerCase() === 'present' ? new Date() : this.parseDate(a.endDate);
            const bEndDate = b.endDate.toLowerCase() === 'present' ? new Date() : this.parseDate(b.endDate);
            
            // Sort by end date first (most recent first)
            const endDateDiff = bEndDate.getTime() - aEndDate.getTime();
            if (endDateDiff !== 0) return endDateDiff;
            
            // If end dates are same, sort by start date (most recent first)
            const aStartDate = this.parseDate(a.startDate);
            const bStartDate = this.parseDate(b.startDate);
            return bStartDate.getTime() - aStartDate.getTime();
        });
    }

    /**
     * Parses date string in format "Month YYYY" or "YYYY-MM" to Date object
     */
    private parseDate(dateStr: string): Date {
        if (!dateStr) return new Date(0); // Invalid date goes to beginning
        
        const parts = dateStr.split(' ');
        if (parts.length === 2) {
            const [month, year] = parts;
            const monthNames = [
                'january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'
            ];
            
            const monthIndex = monthNames.findIndex(m => m.startsWith(month.toLowerCase()));
            if (monthIndex !== -1) {
                return new Date(parseInt(year), monthIndex);
            }
        }
        
        // Fallback to native Date parsing
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    }
}

/**
 * Generates the education section
 */
export class EducationGenerator {
    private config: SectionConfig;
    constructor(config: SectionConfig = {}) {
        this.config = config;
    }

    generate(education: Education[]): string {
        const sectionTitle = this.config.customLabels?.education || 'Education';
        
        const educationFormatted = education.map(edu => {
            return `
{\\bf ${escapeLatex(edu.degree)}}, ${escapeLatex(edu.school)} \\hfill {${escapeLatex(edu.year)}}
`;
        }).join('\n');
        
        return `\\begin{rSection}{${sectionTitle}}
    ${educationFormatted}
\\end{rSection}
`;
    }
}
