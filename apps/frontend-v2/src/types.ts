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
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    year: string;
  }>;
  skills: string[];
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
