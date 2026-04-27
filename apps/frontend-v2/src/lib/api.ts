import axios from 'axios';
import type { ResumeData, TailoredResume, ApiResponse } from '../types';

// Create a standard axios instance
const api = axios.create({
  baseURL: (window as any).ENV?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:4300/api',
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

// Request interceptor — inject auth headers from Clerk global on every request.
// This avoids the race condition where components fetch before AuthInitializer
// finishes its async getToken() call.
api.interceptors.request.use(async (config) => {
  const clerk = (window as any).Clerk;
  if (clerk?.session) {
    const token = await clerk.session.getToken();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    const userId = clerk.user?.id;
    if (userId) config.headers['x-user-id'] = userId;
  }
  return config;
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Map frontend field names to backend field names
function toBackendPayload(resumeData: any) {
  const payload: any = { ...resumeData };
  if (resumeData.title) payload.name = resumeData.title;
  if (resumeData.contact?.fullName) {
    payload.contact = { ...resumeData.contact, name: resumeData.contact.fullName };
  }
  if (resumeData.experience) {
    payload.experience = resumeData.experience.map((exp: any) => ({
      ...exp,
      responsibilities: exp.responsibilities || (exp.description ? exp.description.split('\n').filter(Boolean) : []),
    }));
  }
  if (resumeData.education) {
    payload.education = resumeData.education.map((edu: any) => ({
      ...edu,
      institution: edu.institution || edu.school || '',
      graduationDate: edu.graduationDate || edu.year || '',
    }));
  }
  return payload;
}

// Map a backend resume object (or a tailored resume's tailoredData) into the editor's expected shape.
function fromBackendPayload(r: any): ResumeData {
  return {
    ...r,
    title: r.name || r.title || 'Untitled',
    contact: {
      ...(r.contact || {}),
      fullName: r.contact?.fullName || r.contact?.name || '',
    },
    experience: (r.experience || []).map((exp: any) => ({
      ...exp,
      description: exp.description || (exp.responsibilities || []).join('\n'),
    })),
    education: (r.education || []).map((edu: any) => ({
      ...edu,
      school: edu.school || edu.institution || '',
      year: edu.year || edu.graduationDate || '',
    })),
  };
}

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
    return data.map(fromBackendPayload);
  },

  // Fetches a resume by ID. Transparently falls back to the tailored-resumes
  // endpoint if the ID isn't a base resume — this lets the editor open both kinds.
  getResume: async (id: string): Promise<ResumeData> => {
    try {
      const response = await api.get<ApiResponse<any>>(`/resumes/${id}`);
      const r = response.data.data;
      if (r) return fromBackendPayload(r);
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
    }

    // Fallback: try to load as a tailored resume
    const tailored = await api.get<ApiResponse<any>>(`/tailored-resumes/${id}`);
    const tr = tailored.data.data;
    if (!tr) throw new Error('Resume not found');

    const content = tr.tailoredData ?? {};
    const mapped = fromBackendPayload({
      ...content,
      id: tr.id,
      name: `${tr.jobDetails?.jobTitle ?? 'Tailored'} @ ${tr.jobDetails?.company ?? 'Resume'}`,
    });
    // Tag the resume so the save path can route updates to the tailored endpoint
    return { ...mapped, isTailored: true, baseResumeId: tr.baseResumeId } as any;
  },

  createResume: async (resumeData: ResumeData): Promise<ResumeData> => {
    const response = await api.post<ApiResponse<ResumeData>>('/resumes', toBackendPayload(resumeData));
    if (!response.data.data) throw new Error('Failed to create resume');
    return response.data.data;
  },

  updateResume: async (id: string, resumeData: Partial<ResumeData>): Promise<ResumeData> => {
    // Tailored resumes are flagged via getResume(); save them through the tailored endpoint.
    if ((resumeData as any).isTailored) {
      const payload = { tailoredData: toBackendPayload(resumeData) };
      const response = await api.put<ApiResponse<any>>(`/tailored-resumes/${id}`, payload);
      if (!response.data.data) throw new Error('Failed to update tailored resume');
      return response.data.data;
    }

    try {
      const response = await api.put<ApiResponse<ResumeData>>(`/resumes/${id}`, toBackendPayload(resumeData));
      if (response.data.data) return response.data.data;
    } catch (err: any) {
      if (err?.response?.status !== 404) throw err;
    }

    // Fallback: write to tailored_resumes if the ID isn't a base resume
    const payload = { tailoredData: toBackendPayload(resumeData) };
    const response = await api.put<ApiResponse<any>>(`/tailored-resumes/${id}`, payload);
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
export type TailorStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export const aiApi = {
  // Kicks off async tailoring. Returns immediately with the job ID + initial status.
  tailorResume: async (payload: {
    resumeId: string;
    jobTitle: string;
    company: string;
    jobDescription: string;
  }): Promise<{ tailoredResumeId: string; status: TailorStatus }> => {
    const response = await api.post('/ai/tailor', payload);
    return response.data.data;
  },

  // Poll endpoint — returns just the status fields (cheap, suitable for polling)
  getTailorStatus: async (tailoredResumeId: string): Promise<{
    tailoredResumeId: string;
    status: TailorStatus;
    errorMessage: string | null;
    beforeScore: number | null;
    afterScore: number | null;
    updatedAt: string;
  }> => {
    const response = await api.get(`/ai/tailor/status/${tailoredResumeId}`);
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
