
export type View = 'dashboard' | 'profile' | 'tailor';

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location: string;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  responsibilities: string[];
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location: string;
  graduationDate: string;
  gpa?: string;
}

export interface Project {
  id: string;
  name: string;
  url?: string;
  repoUrl?: string;
  description: string[];
}

export interface ResumeData {
  id: string;
  name: string; // User-given name for this resume version e.g., "My SWE Resume"
  contact: ContactInfo;
  summary: string;
  experience: Experience[];
  education: Education[];
  projects: Project[];
  skills: string[];
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
  jobDetails: JobDetails;
  baseResumeId: string;
  tailoredData: ResumeData;
  createdAt: string;
}
