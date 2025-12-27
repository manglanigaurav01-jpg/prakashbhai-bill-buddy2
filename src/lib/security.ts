/**
 * Security utilities for input sanitization and validation
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML input to prevent XSS attacks
 */
export const sanitizeHtml = (input: string): string => {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
  });
};

/**
 * Sanitize text input by removing potentially dangerous characters
 */
export const sanitizeText = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Validate and sanitize customer name
 */
export const sanitizeCustomerName = (name: string): string => {
  if (typeof name !== 'string') return '';
  return sanitizeText(name)
    .replace(/[^\w\s\-'&.,()]/g, '') // Allow only safe characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

/**
 * Validate and sanitize item name
 */
export const sanitizeItemName = (name: string): string => {
  if (typeof name !== 'string') return '';
  return sanitizeText(name)
    .replace(/[^\w\s\-'&.,()/]/g, '') // Allow only safe characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

/**
 * Validate and sanitize particulars/notes
 */
export const sanitizeParticulars = (input: string): string => {
  if (typeof input !== 'string') return '';
  return sanitizeText(input)
    .replace(/[^\w\s\-'&.,()/\n\r]/g, '') // Allow multiline text
    .trim();
};

/**
 * Validate numeric input for amounts
 */
export const validateAmount = (value: string | number): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid amount: must be a positive number');
  }
  // Prevent extremely large numbers that could cause issues
  if (num > 999999999) {
    throw new Error('Amount too large');
  }
  return Math.round(num * 100) / 100; // Round to 2 decimal places
};

/**
 * Validate quantity input
 */
export const validateQuantity = (value: string | number): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid quantity: must be a positive number');
  }
  // Prevent extremely large quantities
  if (num > 999999) {
    throw new Error('Quantity too large');
  }
  return Math.round(num * 1000) / 1000; // Round to 3 decimal places
};

/**
 * Validate percentage input (0-100)
 */
export const validatePercentage = (value: string | number): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num < 0 || num > 100) {
    throw new Error('Invalid percentage: must be between 0 and 100');
  }
  return Math.round(num * 100) / 100; // Round to 2 decimal places
};

/**
 * Generate a secure random ID
 */
export const generateSecureId = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Hash sensitive data for storage (basic implementation)
 * Note: In production, use proper encryption libraries
 */
export const hashData = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate email format (basic validation)
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (basic validation for Indian numbers)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
};

/**
 * Rate limiting helper (basic implementation)
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Input validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: any;
}

/**
 * Validate customer input
 */
export const validateCustomerInput = (name: string): ValidationResult => {
  try {
    const sanitized = sanitizeCustomerName(name);
    if (!sanitized) {
      return { isValid: false, error: 'Customer name cannot be empty' };
    }
    if (sanitized.length < 2) {
      return { isValid: false, error: 'Customer name must be at least 2 characters' };
    }
    if (sanitized.length > 100) {
      return { isValid: false, error: 'Customer name cannot exceed 100 characters' };
    }
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return { isValid: false, error: 'Invalid customer name format' };
  }
};

/**
 * Validate item input
 */
export const validateItemInput = (name: string): ValidationResult => {
  try {
    const sanitized = sanitizeItemName(name);
    if (!sanitized) {
      return { isValid: false, error: 'Item name cannot be empty' };
    }
    if (sanitized.length < 1) {
      return { isValid: false, error: 'Item name cannot be empty' };
    }
    if (sanitized.length > 200) {
      return { isValid: false, error: 'Item name cannot exceed 200 characters' };
    }
    return { isValid: true, sanitizedValue: sanitized };
  } catch (error) {
    return { isValid: false, error: 'Invalid item name format' };
  }
};
