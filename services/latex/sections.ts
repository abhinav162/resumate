/**
 * Resume section generators
 */

import type { ContactInfo, Experience, Education, Project } from '../../types';
import { escapeLatex, createHyperlink, createEmailLink, joinWithLineBreaks } from './utils';

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
    constructor(private config: SectionConfig = {}) {}

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
    constructor(private config: SectionConfig = {}) {}

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
    constructor(private config: SectionConfig = {}) {}

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
    constructor(private config: SectionConfig = {}) {}

    generate(experiences: Experience[]): string {
        const sectionTitle = this.config.customLabels?.experience || 'EXPERIENCE';
        
        // Sort experiences by date (most recent first)
        const sortedExperiences = this.sortExperiencesByDate(experiences);
        
        const experienceFormatted = sortedExperiences.map(exp => `
\\textbf{${escapeLatex(exp.role)}} \\\\ ${escapeLatex(exp.company)}, \\textit{${escapeLatex(exp.location)}} \\hfill ${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate)}
 \\begin{itemize}
    \\itemsep -5pt {} 
    ${exp.responsibilities.map(r => `\\item ${escapeLatex(r)}`).join('\n    ')}
 \\end{itemize}
`).join('\n');
        
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
     * Parses date string in format "Month YYYY" to Date object
     */
    private parseDate(dateStr: string): Date {
        if (!dateStr) return new Date(0); // Invalid date goes to beginning
        
        const [month, year] = dateStr.split(' ');
        const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        const monthIndex = monthNames.findIndex(m => m.startsWith(month.toLowerCase()));
        if (monthIndex === -1) return new Date(0);
        
        return new Date(parseInt(year), monthIndex);
    }
}

/**
 * Generates the projects section
 */
export class ProjectsGenerator {
    constructor(private config: SectionConfig = {}) {}

    generate(projects: Project[]): string {
        if (!projects || projects.length === 0) return '';
        
        const sectionTitle = this.config.customLabels?.projects || 'PROJECTS';
        
        const projectsFormatted = projects.map(proj => {
            const urlLinks: string[] = [];
            
            if (proj.url) {
                urlLinks.push(`\\textit{ ${createHyperlink(proj.url, '(View project)')}}`);
            }
            
            if (proj.repoUrl) {
                urlLinks.push(`\\textit{ ${createHyperlink(proj.repoUrl, '(Source Code)')}}`);
            }
            
            const linksLine = urlLinks.length > 0 ? `\n${urlLinks.join(' ')}` : '';
            
            return `
\\item \\textbf{${escapeLatex(proj.name)}} ${linksLine}

\\begin{itemize}
    \\itemsep -5pt {} 
    ${proj.description.map(d => `\\item ${escapeLatex(d)}`).join('\n    ')}
\\end{itemize}
`;
        }).join('\n');
        
        return `\\begin{rSection}{${sectionTitle}}
\\vspace{-1.25em}
    ${projectsFormatted}
\\end{rSection}
`;
    }
}

/**
 * Generates the education section
 */
export class EducationGenerator {
    constructor(private config: SectionConfig = {}) {}

    generate(education: Education[]): string {
        const sectionTitle = this.config.customLabels?.education || 'Education';
        
        const educationFormatted = education.map(edu => {
            const gpaLine = edu.gpa ? `\nCGPA: ${escapeLatex(edu.gpa)}` : '';
            
            return `
{\\bf ${escapeLatex(edu.degree)}}, ${escapeLatex(edu.institution)} \\hfill {${escapeLatex(edu.graduationDate)}}\\${gpaLine}
`;
        }).join('\n');
        
        return `\\begin{rSection}{${sectionTitle}}
    ${educationFormatted}
\\end{rSection}
`;
    }
}