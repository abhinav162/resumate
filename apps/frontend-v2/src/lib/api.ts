import axios from 'axios';
import type { ResumeData, TailoredResume, ApiResponse } from '../types';

// Create a standard axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4300/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to set auth headers dynamically
// This is called from the App/Layout level where Clerk context is available
export const setAuthHeaders = (token: string | null | undefined, userId: string | null | undefined) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }

  if (userId) {
    api.defaults.headers.common['x-user-id'] = userId;
  } else {
    delete api.defaults.headers.common['x-user-id'];
  }
};

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * Resume methods
 */
export const resumesApi = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get('/resumes');
    return response.data.data ?? response.data.resumes ?? [];
  },

  getResumes: async (): Promise<ResumeData[]> => {
    const response = await api.get<ApiResponse<any[]>>('/resumes');
    const data = response.data.data || [];
    return data.map(r => ({
      ...r,
      title: r.name || 'Untitled',
      contact: {
        ...r.contact,
        fullName: r.contact?.name || '',
      }
    }));
  },

  getResume: async (id: string): Promise<ResumeData> => {
    const response = await api.get<ApiResponse<any>>(`/resumes/${id}`);
    const r = response.data.data;
    if (!r) throw new Error('Resume not found');
    return {
      ...r,
      title: r.name || 'Untitled',
      contact: {
        ...r.contact,
        fullName: r.contact?.name || '',
      }
    };
  },

  createResume: async (resumeData: ResumeData): Promise<ResumeData> => {
    const response = await api.post<ApiResponse<ResumeData>>('/resumes', {
      ...resumeData,
      name: resumeData.title, // Backend uses 'name'
      contact: {
        ...resumeData.contact,
        name: resumeData.contact.fullName, // Backend uses 'contact.name'
      }
    });
    if (!response.data.data) throw new Error('Failed to create resume');
    return response.data.data;
  },

  updateResume: async (id: string, resumeData: Partial<ResumeData>): Promise<ResumeData> => {
    const payload: any = { ...resumeData };
    if (resumeData.title) payload.name = resumeData.title;
    if (resumeData.contact?.fullName) {
      payload.contact = {
        ...resumeData.contact,
        name: resumeData.contact.fullName
      };
    }

    const response = await api.put<ApiResponse<ResumeData>>(`/resumes/${id}`, payload);
    if (!response.data.data) throw new Error('Failed to update resume');
    return response.data.data;
  },

  deleteResume: async (id: string): Promise<void> => {
    await api.delete(`/resumes/${id}`);
  },

  scoreResume: async (resumeId: string): Promise<{ score: number; issues: any[]; suggestions: any[] }> => {
    const response = await api.post(`/ai/score/${resumeId}`);
    return response.data.data;
  },

  uploadPdf: async (file: File): Promise<{ resumeId: string; name: string; parsed: any }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/uploads/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
};

/**
 * Tailored Resume methods
 */
export const tailoredResumesApi = {
  getTailoredResumes: async (baseResumeId?: string): Promise<TailoredResume[]> => {
    const url = baseResumeId ? `/tailored-resumes?baseResumeId=${baseResumeId}` : '/tailored-resumes';
    const response = await api.get<ApiResponse<TailoredResume[]>>(url);
    return response.data.data || [];
  },

  getTailoredResume: async (id: string): Promise<TailoredResume> => {
    const response = await api.get<ApiResponse<TailoredResume>>(`/tailored-resumes/${id}`);
    if (!response.data.data) throw new Error('Tailored resume not found');
    return response.data.data;
  },

  createTailoredResume: async (data: {
    baseResumeId: string;
    jobDetails: {
      jobTitle: string;
      company: string;
      description: string;
    };
    tailoredData: ResumeData;
  }): Promise<TailoredResume> => {
    const response = await api.post<ApiResponse<TailoredResume>>('/tailored-resumes', data);
    if (!response.data.data) throw new Error('Failed to create tailored resume');
    return response.data.data;
  },

  updateTailoredResume: async (id: string, updateData: Partial<TailoredResume>): Promise<TailoredResume> => {
    const response = await api.put<ApiResponse<TailoredResume>>(`/tailored-resumes/${id}`, updateData);
    if (!response.data.data) throw new Error('Failed to update tailored resume');
    return response.data.data;
  },

  deleteTailoredResume: async (id: string): Promise<void> => {
    await api.delete(`/tailored-resumes/${id}`);
  },
};

/**
 * AI methods
 */
export const aiApi = {
  parseResume: async (resumeText: string, apiKey: string): Promise<ResumeData> => {
    const response = await api.post<ApiResponse<any>>('/ai/parse-resume', { resumeText, apiKey });
    if (!response.data.data) throw new Error('Failed to parse resume');
    
    // Map backend structure back to frontend-v2 structure
    const data = response.data.data;
    return {
      title: 'Parsed Resume',
      contact: {
        fullName: data.contact.name || '',
        role: '',
        email: data.contact.email || '',
        phone: data.contact.phone || '',
        location: data.contact.location || '',
        linkedin: data.contact.linkedin || '',
        github: data.contact.github || '',
        website: data.contact.website || '',
      },
      summary: data.summary || '',
      experience: (data.experience || []).map((exp: any) => ({
        company: exp.company || '',
        role: exp.role || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        description: (exp.responsibilities || []).join('\n'),
      })),
      education: (data.education || []).map((edu: any) => ({
        school: edu.institution || '',
        degree: edu.degree || '',
        year: edu.graduationDate || '',
      })),
      skills: data.skills || [],
    };
  },

  tailorResume: async (payload: {
    resumeId: string;
    jobTitle: string;
    company: string;
    jobDescription: string;
  }): Promise<{ tailoredResumeId: string; tailoredResume: any; diff: any[]; beforeScore: number; afterScore: number }> => {
    const response = await api.post('/ai/tailor', payload);
    return response.data.data;
  },
};

/**
 * Credits methods
 */
export const creditsApi = {
  getBalance: async (): Promise<{ balance: number }> => {
    const response = await api.get('/credits/balance');
    return response.data.data;
  },
  getPacks: async () => {
    const response = await api.get('/credits/packs');
    return response.data.data;
  },
  createCheckout: async (packId: string): Promise<{ url: string }> => {
    const response = await api.post('/credits/checkout', { packId });
    return response.data.data;
  },
};

export default api;
