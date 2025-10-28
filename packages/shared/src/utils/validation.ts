import { Resume, ContactInfo, Experience, Education, Project } from '../types/resume';

export class ValidationError extends Error {
  field: string;
  
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone.trim()) && phone.trim().length >= 10;
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateContactInfo = (contact: ContactInfo): void => {
  if (!contact.name?.trim()) {
    throw new ValidationError('contact.name', 'Name is required');
  }
  
  if (!contact.email?.trim()) {
    throw new ValidationError('contact.email', 'Email is required');
  }
  
  if (!validateEmail(contact.email)) {
    throw new ValidationError('contact.email', 'Invalid email format');
  }
  
  if (!contact.phone?.trim()) {
    throw new ValidationError('contact.phone', 'Phone is required');
  }
  
  if (!validatePhone(contact.phone)) {
    throw new ValidationError('contact.phone', 'Invalid phone format');
  }
  
  if (!contact.location?.trim()) {
    throw new ValidationError('contact.location', 'Location is required');
  }
  
  if (contact.linkedin && !validateUrl(contact.linkedin)) {
    throw new ValidationError('contact.linkedin', 'Invalid LinkedIn URL');
  }
  
  if (contact.github && !validateUrl(contact.github)) {
    throw new ValidationError('contact.github', 'Invalid GitHub URL');
  }
  
  if (contact.website && !validateUrl(contact.website)) {
    throw new ValidationError('contact.website', 'Invalid website URL');
  }
};

export const validateResume = (resume: Partial<Resume>): void => {
  if (!resume.name?.trim()) {
    throw new ValidationError('name', 'Resume name is required');
  }
  
  if (!resume.contact) {
    throw new ValidationError('contact', 'Contact information is required');
  }
  
  validateContactInfo(resume.contact);
  
  if (!Array.isArray(resume.skills)) {
    throw new ValidationError('skills', 'Skills must be an array');
  }
  
  if (!Array.isArray(resume.experience)) {
    throw new ValidationError('experience', 'Experience must be an array');
  }
  
  if (!Array.isArray(resume.education)) {
    throw new ValidationError('education', 'Education must be an array');
  }
  
  if (resume.projects && !Array.isArray(resume.projects)) {
    throw new ValidationError('projects', 'Projects must be an array');
  }
};

export const validateJobDetails = (jobDetails: any): void => {
  if (!jobDetails.jobTitle?.trim()) {
    throw new ValidationError('jobTitle', 'Job title is required');
  }
  
  if (!jobDetails.company?.trim()) {
    throw new ValidationError('company', 'Company is required');
  }
  
  if (!jobDetails.description?.trim()) {
    throw new ValidationError('description', 'Job description is required');
  }
  
  if (jobDetails.description.trim().length < 10) {
    throw new ValidationError('description', 'Job description must be at least 10 characters');
  }
};