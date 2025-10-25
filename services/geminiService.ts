
import { GoogleGenAI, Type } from "@google/genai";
import type { ResumeData, JobDetails } from '../types';
import { resumeEnhancer, type EnhancementConfig } from './resumeEnhancer';

const resumeSchema = {
    type: Type.OBJECT,
    properties: {
        contact: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Full name" },
                email: { type: Type.STRING, description: "Email address" },
                phone: { type: Type.STRING, description: "Phone number" },
                linkedin: { type: Type.STRING, description: "LinkedIn profile URL" },
                github: { type: Type.STRING, description: "GitHub profile URL" },
                website: { type: Type.STRING, description: "Personal website or portfolio URL" },
                location: { type: Type.STRING, description: "City and State, e.g., San Francisco, CA" },
            },
            required: ['name', 'email', 'phone', 'location']
        },
        summary: {
            type: Type.STRING,
            description: "A professional summary of 2-4 sentences. This field is optional."
        },
        experience: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    role: { type: Type.STRING },
                    company: { type: Type.STRING },
                    location: { type: Type.STRING },
                    startDate: { type: Type.STRING, description: "Month YYYY" },
                    endDate: { type: Type.STRING, description: "Month YYYY or Present" },
                    responsibilities: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING, description: "A bullet point describing a responsibility or achievement." }
                    },
                },
                required: ['role', 'company', 'startDate', 'endDate', 'responsibilities']
            }
        },
        education: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    degree: { type: Type.STRING },
                    institution: { type: Type.STRING },
                    location: { type: Type.STRING },
                    graduationDate: { type: Type.STRING, description: "Month YYYY" },
                    gpa: { type: Type.STRING, description: "GPA, e.g., 3.8/4.0. Optional." },
                },
                required: ['degree', 'institution', 'graduationDate']
            }
        },
        projects: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    url: { type: Type.STRING, description: "Live project URL" },
                    repoUrl: { type: Type.STRING, description: "Source code/repository URL" },
                    description: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING, description: "A bullet point describing a feature or technology used." }
                    },
                },
                required: ['name', 'description']
            }
        },
        skills: {
            type: Type.ARRAY,
            description: "A list of technical and soft skills.",
            items: { type: Type.STRING }
        }
    },
    required: ['contact', 'experience', 'education', 'skills']
};


export const parseResumeText = async (resumeText: string, apiKey: string): Promise<Omit<ResumeData, 'id' | 'name'>> => {
    if (!apiKey) throw new Error("API Key is required.");
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Parse the following resume text into a JSON object. Adhere strictly to the provided JSON schema. If some information (like github, website, projects, or summary) is not present, use an empty string or empty array. Extract all experiences, education entries, and projects.

Resume Text:
---
${resumeText}
---`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: resumeSchema
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        
        // Add IDs to nested objects
        if(parsedData.experience) {
            parsedData.experience = parsedData.experience.map((exp: any, index: number) => ({ ...exp, id: `exp-${Date.now()}-${index}` }));
        }
        if(parsedData.education) {
            parsedData.education = parsedData.education.map((edu: any, index: number) => ({ ...edu, id: `edu-${Date.now()}-${index}` }));
        }
        if(parsedData.projects) {
            parsedData.projects = parsedData.projects.map((proj: any, index: number) => ({ ...proj, id: `proj-${Date.now()}-${index}` }));
        } else {
            parsedData.projects = [];
        }

        return parsedData;
    } catch (error) {
        console.error("Error parsing resume with Gemini:", error);
        throw new Error("Failed to parse resume. Please check the API key and the resume text format.");
    }
};

export const tailorResumeForJob = async (
    resumeData: ResumeData, 
    jobDetails: JobDetails, 
    apiKey: string,
    useRaReOptimization: boolean = true,
    enhancementConfig?: EnhancementConfig
): Promise<ResumeData> => {
    if (!apiKey) throw new Error("API Key is required.");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert ATS resume optimizer using the RARe framework (Readability, Applicability, Remarkability). Given the following resume JSON and job description, rewrite the resume to be highly tailored for the job.

OPTIMIZATION REQUIREMENTS:
1. READABILITY: Keep bullets under 300 characters, ensure scannable format
2. APPLICABILITY: Align content with job requirements, prioritize relevant skills
3. REMARKABILITY: Use XYZ framework (Accomplished X as measured by Y by doing Z), strong action verbs

SPECIFIC INSTRUCTIONS:
- Rewrite the summary to align with key job requirements (keep under 400 characters)
- Transform each responsibility/project bullet using XYZ or RAS framework
- Start bullets with high-impact action verbs (Architected, Engineered, Optimized, Spearheaded, etc.)
- Include quantitative metrics where possible (%, numbers, time saved, etc.)
- Incorporate relevant keywords from job description naturally
- Ensure most relevant skills are prioritized first
- Do NOT invent new experiences, projects, or skills - only enhance existing content
- Keep each bullet under 300 characters for optimal readability

TARGET JOB:
Title: ${jobDetails.jobTitle}
Company: ${jobDetails.company}

Job Description:
---
${jobDetails.description}
---

Original Resume Data:
---
${JSON.stringify(resumeData, null, 2)}
---

Return the complete, optimized resume as a JSON object following the RARe framework principles.`;

    try {
         const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    ...resumeSchema,
                    properties: {
                        ...resumeSchema.properties,
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                    }
                }
            },
        });
        
        const jsonText = response.text.trim();
        let tailoredData = JSON.parse(jsonText);

        // Preserve original IDs
        tailoredData.id = resumeData.id;
        tailoredData.name = resumeData.name;
        if(tailoredData.experience && resumeData.experience) {
            tailoredData.experience = tailoredData.experience.map((exp: any, index: number) => ({ ...exp, id: resumeData.experience[index]?.id || `exp-${Date.now()}-${index}` }));
        }
        if(tailoredData.education && resumeData.education) {
            tailoredData.education = tailoredData.education.map((edu: any, index: number) => ({ ...edu, id: resumeData.education[index]?.id || `edu-${Date.now()}-${index}` }));
        }
         if(tailoredData.projects && resumeData.projects) {
            tailoredData.projects = tailoredData.projects.map((proj: any, index: number) => ({ ...proj, id: resumeData.projects[index]?.id || `proj-${Date.now()}-${index}` }));
        }
        
        // Apply additional RARe framework enhancements if enabled
        if (useRaReOptimization && enhancementConfig) {
            tailoredData = resumeEnhancer.enhanceResume(tailoredData, jobDetails, enhancementConfig);
        }
        
        return tailoredData as ResumeData;
    } catch (error) {
        console.error("Error tailoring resume with Gemini:", error);
        throw new Error("Failed to tailor resume. Please check your API key and input data.");
    }
};
