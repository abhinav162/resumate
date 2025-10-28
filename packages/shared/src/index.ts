// Export all shared types
export * from './types/resume';

// Export utilities (with explicit re-exports to avoid conflicts)
export { 
  validateEmail, 
  validatePhone, 
  validateUrl, 
  validateContactInfo, 
  validateResume, 
  validateJobDetails 
} from './utils/validation';
export * from './utils/common';

// Export constants
export const API_ENDPOINTS = {
  RESUMES: '/api/resumes',
  TAILORED_RESUMES: '/api/tailored-resumes',
  AI_PARSE: '/api/ai/parse-resume',
  AI_TAILOR: '/api/ai/tailor-resume',
  HEALTH: '/health'
} as const;

export const DEFAULT_CONFIG = {
  API_TIMEOUT: 30000, // 30 seconds
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FILE_TYPES: ['application/pdf', 'text/plain', 'application/json'],
  MIN_RESUME_TEXT_LENGTH: 50,
  MAX_RESUME_TEXT_LENGTH: 50000,
  MIN_JOB_DESCRIPTION_LENGTH: 10,
  MAX_JOB_DESCRIPTION_LENGTH: 10000
} as const;