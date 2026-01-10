import axios from 'axios';

// Create a standard axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4300/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to set auth headers dynamically
// This is called from the App/Layout level where Clerk context is available
export const setAuthHeaders = (token: string | null, userId: string | null) => {
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

export default api;
