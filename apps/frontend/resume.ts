// Re-export the existing types with some adjustments for backend compatibility
export interface Resume {
  id: string;
  name: string;
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary: string;
  skills: string[];
  experience: {
    id?: string;
    role: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    responsibilities: string[];
  }[];
  education: {
    id?: string;
    degree: string;
    institution: string;
    location: string;
    graduationDate: string;
    gpa?: string;
  }[];
  projects: {
    id?: string;
    name: string;
    url?: string;
    repoUrl?: string;
    description: string[];
  }[];
  isBase?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TailoredResumeData {
  id: string;
  baseResumeId: string;
  jobDetails: {
    jobTitle: string;
    company: string;
    description: string;
  };
  tailoredData: Resume;
  createdAt?: string;
  updatedAt?: string;
}