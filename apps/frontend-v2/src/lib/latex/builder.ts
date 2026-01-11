/**
 * Resume builder that orchestrates all sections
 */

import type { ResumeData } from '../../types';
import { generateDocumentTemplate, type TemplateConfig } from './templates';
import { 
    HeaderGenerator, 
    SkillsGenerator, 
    SummaryGenerator, 
    ExperienceGenerator, 
    EducationGenerator,
    type SectionConfig 
} from './sections';

/**
 * Configuration for the entire resume generation
 */
export interface ResumeBuilderConfig {
    template?: TemplateConfig;
    sections?: SectionConfig;
    sectionOrder?: string[];
    enabledSections?: string[];
}

/**
 * Main resume builder class
 */
export class ResumeBuilder {
    private config: ResumeBuilderConfig;
    private headerGenerator: HeaderGenerator;
    private skillsGenerator: SkillsGenerator;
    private summaryGenerator: SummaryGenerator;
    private experienceGenerator: ExperienceGenerator;
    private educationGenerator: EducationGenerator;
    
    constructor(config: ResumeBuilderConfig = {}) {
        this.config = config;
        const sectionConfig = this.config.sections || {};
        
        this.headerGenerator = new HeaderGenerator(sectionConfig);
        this.skillsGenerator = new SkillsGenerator(sectionConfig);
        this.summaryGenerator = new SummaryGenerator(sectionConfig);
        this.experienceGenerator = new ExperienceGenerator(sectionConfig);
        this.educationGenerator = new EducationGenerator(sectionConfig);
    }
    
    /**
     * Generates the complete LaTeX document
     */
    generateLatexDocument(resumeData: ResumeData): string {
        const { contact } = resumeData;
        
        // Generate header
        const { address1, address2 } = this.headerGenerator.generate(contact);
        
        // Generate all sections
        const sections = this.generateAllSections(resumeData);
        
        // Combine sections in the specified order
        const orderedSections = this.orderSections(sections);
        const content = orderedSections.join('\n');
        
        // Generate final document
        return generateDocumentTemplate(
            contact.fullName,
            address1,
            address2,
            content,
            this.config.template
        );
    }
    
    /**
     * Generates all resume sections
     */
    private generateAllSections(resumeData: ResumeData): Record<string, string> {
        const { skills, summary, experience, education } = resumeData;
        const enabledSections = this.config.enabledSections;
        
        const sections: Record<string, string> = {};
        
        // Generate each section if enabled
        if (!enabledSections || enabledSections.includes('skills')) {
            sections.skills = this.skillsGenerator.generate(skills);
        }
        
        if (!enabledSections || enabledSections.includes('summary')) {
            sections.summary = this.summaryGenerator.generate(summary);
        }
        
        if (!enabledSections || enabledSections.includes('experience')) {
            sections.experience = this.experienceGenerator.generate(experience);
        }
        
        if (!enabledSections || enabledSections.includes('education')) {
            sections.education = this.educationGenerator.generate(education);
        }
        
        return sections;
    }
    
    /**
     * Orders sections according to configuration
     */
    private orderSections(sections: Record<string, string>): string[] {
        const defaultOrder = ['summary', 'skills', 'experience', 'education'];
        const order = this.config.sectionOrder || defaultOrder;
        
        return order
            .map(sectionName => sections[sectionName])
            .filter(section => section && section.trim());
    }
    
    /**
     * Updates configuration
     */
    updateConfig(newConfig: Partial<ResumeBuilderConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Recreate generators with new config
        const sectionConfig = this.config.sections || {};
        this.headerGenerator = new HeaderGenerator(sectionConfig);
        this.skillsGenerator = new SkillsGenerator(sectionConfig);
        this.summaryGenerator = new SummaryGenerator(sectionConfig);
        this.experienceGenerator = new ExperienceGenerator(sectionConfig);
        this.educationGenerator = new EducationGenerator(sectionConfig);
    }
    
    /**
     * Gets current configuration
     */
    getConfig(): ResumeBuilderConfig {
        return { ...this.config };
    }
}
