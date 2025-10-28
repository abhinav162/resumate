// Shared Resume Types for Frontend and Backend
export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Experience {
  id?: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
}

export interface Education {
  id?: string;
  degree: string;
  institution: string;
  location: string;
  graduationDate: string;
  gpa?: string;
}

export interface Project {
  id?: string;
  name: string;
  url?: string;
  repoUrl?: string;
  description: string[];
}

export interface Resume {
  id: string;
  name: string;
  contact: ContactInfo;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  isBase?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobDetails {
  jobTitle: string;
  company: string;
  description: string;
}

export interface TailoredResume {
  id: string;
  baseResumeId: string;
  jobDetails: JobDetails;
  tailoredData: Resume;
  createdAt?: string;
  updatedAt?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Validation Errors
export interface ValidationError {
  field: string;
  message: string;
}

// UI Types
export type View = 'dashboard' | 'profile' | 'tailor';

// Legacy types for backward compatibility (can be removed after migration)
export type ResumeData = Resume;
export type TailoredResumeData = TailoredResume;