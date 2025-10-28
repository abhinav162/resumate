import { Resume } from '../types/resume';

const API_BASE_URL = 'http://localhost:3001/api';

// API client class for backend communication
class ApiClient {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': 'default-user', // For now, using a default user
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Resume methods
  async getResumes(): Promise<Resume[]> {
    const result = await this.request<Resume[]>('/resumes');
    return result.data || [];
  }

  async getResume(id: string): Promise<Resume> {
    const result = await this.request<Resume>(`/resumes/${id}`);
    if (!result.data) {
      throw new Error('Resume not found');
    }
    return result.data;
  }

  async createResume(resumeData: Omit<Resume, 'id'>): Promise<Resume> {
    const result = await this.request<Resume>('/resumes', {
      method: 'POST',
      body: JSON.stringify(resumeData),
    });
    if (!result.data) {
      throw new Error('Failed to create resume');
    }
    return result.data;
  }

  async updateResume(id: string, resumeData: Partial<Resume>): Promise<Resume> {
    const result = await this.request<Resume>(`/resumes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resumeData),
    });
    if (!result.data) {
      throw new Error('Failed to update resume');
    }
    return result.data;
  }

  async deleteResume(id: string): Promise<void> {
    await this.request(`/resumes/${id}`, {
      method: 'DELETE',
    });
  }

  // Tailored Resume methods
  async getTailoredResumes(baseResumeId?: string): Promise<any[]> {
    const endpoint = baseResumeId 
      ? `/tailored-resumes?baseResumeId=${baseResumeId}` 
      : '/tailored-resumes';
    const result = await this.request<any[]>(endpoint);
    return result.data || [];
  }

  async getTailoredResume(id: string): Promise<any> {
    const result = await this.request<any>(`/tailored-resumes/${id}`);
    if (!result.data) {
      throw new Error('Tailored resume not found');
    }
    return result.data;
  }

  async createTailoredResume(tailoredData: {
    baseResumeId: string;
    jobDetails: {
      jobTitle: string;
      company: string;
      description: string;
    };
    tailoredData: any;
  }): Promise<any> {
    const result = await this.request<any>('/tailored-resumes', {
      method: 'POST',
      body: JSON.stringify(tailoredData),
    });
    if (!result.data) {
      throw new Error('Failed to create tailored resume');
    }
    return result.data;
  }

  async updateTailoredResume(id: string, updateData: any): Promise<any> {
    const result = await this.request<any>(`/tailored-resumes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
    if (!result.data) {
      throw new Error('Failed to update tailored resume');
    }
    return result.data;
  }

  async deleteTailoredResume(id: string): Promise<void> {
    await this.request(`/tailored-resumes/${id}`, {
      method: 'DELETE',
    });
  }

  // AI methods
  async parseResume(resumeText: string, apiKey: string): Promise<Resume> {
    const result = await this.request<Resume>('/ai/parse-resume', {
      method: 'POST',
      body: JSON.stringify({ resumeText, apiKey }),
    });
    if (!result.data) {
      throw new Error('Failed to parse resume');
    }
    return result.data;
  }

  async tailorResume(data: {
    resumeData: Resume;
    jobDetails: {
      jobTitle: string;
      company: string;
      description: string;
    };
    apiKey: string;
    useRaReOptimization?: boolean;
  }): Promise<Resume> {
    const result = await this.request<Resume>('/ai/tailor-resume', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!result.data) {
      throw new Error('Failed to tailor resume');
    }
    return result.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;