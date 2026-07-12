export interface ResumeData {
  id?: string;
  title: string;
  contact: {
    fullName: string;
    role: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    id?: string;
    company: string;
    role: string;
    location?: string;
    startDate: string;
    endDate: string;
    responsibilities: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    year: string;
  }>;
  projects: Array<{
    id?: string;
    name: string;
    url?: string;
    repoUrl?: string;
    description: string[];
    /** Source repo id when imported from GitHub; null/absent for manual projects. */
    githubRepoId?: string | null;
  }>;
  skills: string[];
  updatedAt?: string;
  isBase?: boolean;
}

export interface TailoredResume {
  id: string;
  baseResumeId: string;
  jobDetails: {
    jobTitle: string;
    company: string;
    description: string;
  };
  tailoredData: ResumeData;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}
