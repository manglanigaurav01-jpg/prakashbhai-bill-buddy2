/**
 * Security Utilities for Bill Buddy App
 *
 * Provides comprehensive input sanitization and security functions
 * to prevent XSS, injection attacks, and other security vulnerabilities.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

/**
 * Sanitize text input by removing HTML, scripts, and dangerous characters
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for display/storage
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript:/gi, '')
    // Remove data: URLs (can contain malicious content)
    .replace(/data:text\/html/gi, '')
    // Remove event handlers (onClick, onLoad, etc.)
    .replace(/on\w+\s*=/gi, '')
    // Remove style attributes that could contain javascript
    .replace(/style\s*=\s*["'][^"']*javascript:[^"']*["']/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object/embed tags
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize customer name - allow letters, numbers, spaces, and basic punctuation
 * @param name - Customer name to sanitize
 * @returns Sanitized customer name
 */
export function sanitizeCustomerName(name: string): string {
  if (typeof name !== 'string') return '';

  return name
    // Remove HTML and scripts first
    .replace(/<[^>]*>/g, '')
    // Allow only letters, numbers, spaces, hyphens, apostrophes, and periods
    .replace(/[^a-zA-Z0-9\s\-'.]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize phone number - keep only digits, spaces, hyphens, parentheses, and plus
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  if (typeof phone !== 'string') return '';

  return phone
    // Remove HTML and scripts first
    .replace(/<[^>]*>/g, '')
    // Allow only digits, spaces, hyphens, parentheses, and plus
    .replace(/[^0-9\s-()+]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize and validate email address
 * @param email - Email address to sanitize
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';

  const sanitized = email
    // Remove HTML and scripts first
    .replace(/<[^>]*>/g, '')
    // Basic email pattern validation
    .trim();

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

/**
 * Sanitize bill particulars/description
 * @param text - Bill description to sanitize
 * @returns Sanitized bill description
 */
export function sanitizeBillParticulars(text: string): string {
  if (typeof text !== 'string') return '';

  return text
    // Remove HTML and scripts first
    .replace(/<[^>]*>/g, '')
    // Allow letters, numbers, spaces, and common punctuation
    .replace(/[^a-zA-Z0-9\s\-.,()&/]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize and validate number input
 * @param input - Number or string to sanitize
 * @returns Valid number or 0 if invalid
 */
export function sanitizeNumber(input: string | number): number {
  if (typeof input === 'number' && !isNaN(input) && isFinite(input)) {
    return input;
  }

  if (typeof input === 'string') {
    // Remove HTML and scripts first
    const sanitized = input.replace(/<[^>]*>/g, '');
    const parsed = parseFloat(sanitized);
    return (!isNaN(parsed) && isFinite(parsed)) ? parsed : 0;
  }

  return 0;
}

/**
 * Detect potential injection patterns (NoSQL, SQL injection)
 * @param input - Input string to check
 * @returns True if injection patterns detected
 */
export function detectInjection(input: string): boolean {
  if (typeof input !== 'string') return false;

  const injectionPatterns = [
    // MongoDB operators
    /(\$where|\$ne|\$gt|\$gte|\$lt|\$lte|\$in|\$nin|\$or|\$and|\$not|\$nor|\$exists|\$type|\$mod|\$regex|\$options|\$elemMatch|\$all|\$size|\$comment)/i,
    // SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|JOIN|WHERE|FROM|HAVING|GROUP BY|ORDER BY)\b)/i,
    // Script injection
    /(<script|javascript:|vbscript:|data:text)/i,
    // File system traversal
    /(\.\.|\/etc\/|\/bin\/|\/usr\/)/i,
    // Command injection
    /(\||&|;|\$\(|`)/i
  ];

  return injectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Recursively sanitize all string properties in an object
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate input length
 * @param input - String to validate
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns True if length is valid
 */
export function validateLength(input: string, min: number, max: number): boolean {
  if (typeof input !== 'string') return false;
  const length = input.trim().length;
  return length >= min && length <= max;
}

/**
 * Generate a secure random token
 * @param length - Token length (default: 32)
 * @returns Secure random token string
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Advanced XSS detection and sanitization
 * @param input - Input to check and sanitize
 * @returns Object with sanitized content and security warnings
 */
export function advancedSanitize(input: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];

  if (typeof input !== 'string') {
    return { sanitized: '', warnings: ['Input is not a string'] };
  }

  let sanitized = input;

  // Check for various XSS patterns
  if (/<script/i.test(input)) warnings.push('Script tag detected');
  if (/javascript:/i.test(input)) warnings.push('JavaScript URL detected');
  if (/on\w+\s*=/i.test(input)) warnings.push('Event handler detected');
  if (/<iframe/i.test(input)) warnings.push('Iframe detected');
  if (/<object/i.test(input)) warnings.push('Object/embed tag detected');

  // Apply comprehensive sanitization
  sanitized = sanitizeText(sanitized);

  // Additional checks
  if (detectInjection(sanitized)) {
    warnings.push('Potential injection pattern detected');
  }

  return { sanitized, warnings };
}

/**
 * Validate and sanitize user input with comprehensive checks
 * @param input - Input to validate and sanitize
 * @param options - Validation options
 * @returns Validation result with sanitized value
 */
export function validateAndSanitize(
  input: string,
  options: {
    maxLength?: number;
    minLength?: number;
    allowHtml?: boolean;
    fieldType?: 'text' | 'email' | 'phone' | 'name' | 'number';
  } = {}
): ValidationResult {
  const errors: string[] = [];
  let sanitizedValue = input;

  // Basic sanitization
  if (!options.allowHtml) {
    sanitizedValue = sanitizeText(input);
  }

  // Length validation
  if (options.minLength && sanitizedValue.length < options.minLength) {
    errors.push(`Minimum length is ${options.minLength} characters`);
  }

  if (options.maxLength && sanitizedValue.length > options.maxLength) {
    errors.push(`Maximum length is ${options.maxLength} characters`);
  }

  // Type-specific validation
  switch (options.fieldType) {
    case 'email': {
      const sanitizedEmail = sanitizeEmail(input);
      if (!sanitizedEmail) {
        errors.push('Invalid email format');
      } else {
        sanitizedValue = sanitizedEmail;
      }
      break;
    }

    case 'phone':
      sanitizedValue = sanitizePhoneNumber(input);
      if (sanitizedValue && !/^[\d\s-()+]+$/.test(sanitizedValue)) {
        errors.push('Invalid phone number format');
      }
      break;

    case 'name':
      sanitizedValue = sanitizeCustomerName(input);
      break;

    case 'number': {
      const numValue = sanitizeNumber(input);
      if (numValue === 0 && input !== '0') {
        errors.push('Invalid number format');
      }
      sanitizedValue = numValue.toString();
      break;
    }
  }

  // Injection detection
  if (detectInjection(input)) {
    errors.push('Potentially dangerous input detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue
  };
}

/**
 * Validate customer input data
 * @param data - Customer data object to validate
 * @returns Validation result
 */
export function validateCustomerInput(data: any): ValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters');
  }

  // Validate email
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate phone (optional)
  if (data.phone && typeof data.phone !== 'string') {
    errors.push('Phone must be a string');
  }

  // Validate address (optional)
  if (data.address && typeof data.address !== 'string') {
    errors.push('Address must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: data
  };
}
