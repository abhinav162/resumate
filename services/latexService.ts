import type { ResumeData } from '../types';
import { ResumeBuilder, resumeClsContent, type ResumeBuilderConfig } from './latex';

const LATEX_COMPILER_URL = 'https://latex.ytotech.com/builds/sync?pdf=true';

// Default configuration for resume generation
const defaultConfig: ResumeBuilderConfig = {
    sections: {
        urlDisplayThreshold: 30,
        showEmptyFields: false
    },
    sectionOrder: ['skills', 'summary', 'experience', 'projects', 'education'],
    enabledSections: ['skills', 'summary', 'experience', 'projects', 'education']
};

/**
 * Generates the .tex file content as a string from resume data using the modular system.
 * @param resumeData The user's tailored resume data.
 * @param config Optional configuration for customization.
 * @returns A string containing the full .tex file.
 */
const generateTexString = (resumeData: ResumeData, config?: ResumeBuilderConfig): string => {
    const builder = new ResumeBuilder(config || defaultConfig);
    return builder.generateLatexDocument(resumeData);
};

/**
 * Creates a customized resume builder with specific configuration.
 * @param config Configuration for the resume builder.
 * @returns A configured ResumeBuilder instance.
 */
export const createResumeBuilder = (config: ResumeBuilderConfig): ResumeBuilder => {
    return new ResumeBuilder(config);
};

/**
 * Calls an external API to compile LaTeX source into a PDF.
 * @param resumeData The resume data to be compiled.
 * @param config Optional configuration for customization.
 * @returns A promise that resolves with the PDF as a Blob.
 */
export const generateLatexPdf = async (resumeData: ResumeData, config?: ResumeBuilderConfig): Promise<Blob> => {
    const texContent = generateTexString(resumeData, config);
    
    const payload = {
        resources: [
            { path: 'resume.tex', content: texContent, main: true },
            { path: 'resume.cls', content: resumeClsContent }
        ]
    };
    
    try {
        const response = await fetch(LATEX_COMPILER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return await response.blob();
        } else {
            const errorText = await response.text();
            let errorMessage = "Unknown LaTeX compilation error.";
             try {
                // Try to parse as JSON in case it's a structured error
                const errorBody = JSON.parse(errorText);
                if (errorBody && errorBody.log) {
                    const logLine = errorBody.log.split('\n').find((line: string) => line.startsWith('! ')) || errorBody.log;
                    errorMessage = logLine.substring(2); // Remove the '! ' prefix
                } else {
                    errorMessage = errorBody.message || errorText;
                }
            } catch (e) {
                // If parsing fails, it's just plain text
                errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error('Error calling LaTeX compiler API:', error.message);
        throw new Error(error.message || 'Failed to connect to the PDF compilation service.');
    }
};

// Re-export types and utilities for convenience
export type { ResumeBuilderConfig } from './latex';
export { ResumeBuilder } from './latex';