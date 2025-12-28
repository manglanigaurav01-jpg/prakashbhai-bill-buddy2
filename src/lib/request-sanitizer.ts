/**
 * Request Sanitizer for Bill Buddy App
 *
 * Sanitizes and validates all incoming requests to prevent
 * injection attacks, XSS, and other security vulnerabilities.
 */

import { detectInjection, sanitizeText } from './security';
import { AuditLogger, AuditEventType } from './audit-logger';

export interface SanitizedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  query: Record<string, string>;
  params: Record<string, string>;
  isValid: boolean;
  violations: string[];
  sanitized: boolean;
}

export interface SanitizerConfig {
  maxBodySize: number; // 10MB
  maxQueryParams: number;
  maxHeaders: number;
  allowedMethods: string[];
  blockedPaths: string[];
  requireHttps: boolean;
  enableInjectionDetection: boolean;
  enableXssProtection: boolean;
}

export class RequestSanitizer {
  private static readonly CONFIG: SanitizerConfig = {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxQueryParams: 50,
    maxHeaders: 100,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    blockedPaths: ['/admin', '/debug', '/internal'],
    requireHttps: true,
    enableInjectionDetection: true,
    enableXssProtection: true
  };

  /**
   * Sanitize incoming request
   */
  public static async sanitizeRequest(
    url: string,
    method: string,
    headers: Record<string, string> = {},
    body?: any,
    query: Record<string, string> = {},
    params: Record<string, string> = {}
  ): Promise<SanitizedRequest> {
    const violations: string[] = [];
    let sanitized = false;

    // Basic validation
    const basicValidation = this.validateBasicRequest(url, method, headers, body, query);
    violations.push(...basicValidation.violations);

    // Sanitize URL and path
    const sanitizedUrl = this.sanitizeUrl(url);
    const sanitizedParams = this.sanitizeParams(params);

    // Sanitize query parameters
    const sanitizedQuery = this.sanitizeQueryParams(query);
    violations.push(...sanitizedQuery.violations);

    // Sanitize headers
    const sanitizedHeaders = this.sanitizeHeaders(headers);
    violations.push(...sanitizedHeaders.violations);

    // Sanitize body
    const sanitizedBody = body ? this.sanitizeBody(body) : undefined;
    if (sanitizedBody && sanitizedBody.violations.length > 0) {
      violations.push(...sanitizedBody.violations);
    }

    // Check for injection attempts
    if (this.CONFIG.enableInjectionDetection) {
      const injectionCheck = this.checkForInjection(url, method, headers, body, query, params);
      violations.push(...injectionCheck.violations);
    }

    // Check for XSS attempts
    if (this.CONFIG.enableXssProtection) {
      const xssCheck = this.checkForXSS(url, method, headers, body, query, params);
      violations.push(...xssCheck.violations);
    }

    const isValid = violations.length === 0;
    sanitized = !isValid || sanitizedUrl.sanitized || sanitizedQuery.sanitized ||
                sanitizedHeaders.sanitized || (sanitizedBody?.sanitized ?? false);

    const result: SanitizedRequest = {
      url: sanitizedUrl.url,
      method,
      headers: sanitizedHeaders.headers,
      body: sanitizedBody?.body,
      query: sanitizedQuery.query,
      params: sanitizedParams,
      isValid,
      violations,
      sanitized
    };

    // Log violations
    if (!isValid) {
      await AuditLogger.logSecurityViolation('request_validation_failed', {
        violations,
        originalUrl: url,
        method,
        userAgent: headers['user-agent']
      });
    }

    return result;
  }

  /**
   * Validate basic request properties
   */
  private static validateBasicRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    query: Record<string, string>
  ): { violations: string[] } {
    const violations: string[] = [];

    // Check HTTP method
    if (!this.CONFIG.allowedMethods.includes(method.toUpperCase())) {
      violations.push(`Method not allowed: ${method}`);
    }

    // Check HTTPS requirement
    if (this.CONFIG.requireHttps && !url.startsWith('https://')) {
      violations.push('HTTPS required');
    }

    // Check blocked paths
    if (this.CONFIG.blockedPaths.some(path => url.includes(path))) {
      violations.push(`Blocked path: ${url}`);
    }

    // Check body size
    if (body) {
      const bodySize = JSON.stringify(body).length;
      if (bodySize > this.CONFIG.maxBodySize) {
        violations.push(`Body too large: ${bodySize} bytes`);
      }
    }

    // Check query params count
    if (Object.keys(query).length > this.CONFIG.maxQueryParams) {
      violations.push(`Too many query parameters: ${Object.keys(query).length}`);
    }

    // Check headers count
    if (Object.keys(headers).length > this.CONFIG.maxHeaders) {
      violations.push(`Too many headers: ${Object.keys(headers).length}`);
    }

    return { violations };
  }

  /**
   * Sanitize URL
   */
  private static sanitizeUrl(url: string): { url: string; sanitized: boolean } {
    let sanitized = false;
    let cleanUrl = url;

    // Remove null bytes and other control characters
    cleanUrl = cleanUrl.replace(/[\\x00-\\x1F\\x7F-\\x9F]/g, '');

    // Normalize path traversal attempts
    cleanUrl = cleanUrl.replace(/\.\./g, '');

    // Remove suspicious characters
    cleanUrl = cleanUrl.replace(/[<>]/g, '');

    sanitized = cleanUrl !== url;

    return { url: cleanUrl, sanitized };
  }

  /**
   * Sanitize query parameters
   */
  private static sanitizeQueryParams(query: Record<string, string>): {
    query: Record<string, string>;
    violations: string[];
    sanitized: boolean;
  } {
    const violations: string[] = [];
    const sanitizedQuery: Record<string, string> = {};
    let sanitized = false;

    for (const [key, value] of Object.entries(query)) {
      // Sanitize key
      const cleanKey = sanitizeText(key);
      if (cleanKey !== key) {
        violations.push(`Query key sanitized: ${key}`);
        sanitized = true;
      }

      // Sanitize value
      const cleanValue = sanitizeText(value);
      if (cleanValue !== value) {
        violations.push(`Query value sanitized: ${key}=${value}`);
        sanitized = true;
      }

      // Check for injection in value
      if (detectInjection(cleanValue)) {
        violations.push(`Injection detected in query: ${key}`);
      }

      sanitizedQuery[cleanKey] = cleanValue;
    }

    return { query: sanitizedQuery, violations, sanitized };
  }

  /**
   * Sanitize headers
   */
  private static sanitizeHeaders(headers: Record<string, string>): {
    headers: Record<string, string>;
    violations: string[];
    sanitized: boolean;
  } {
    const violations: string[] = [];
    const sanitizedHeaders: Record<string, string> = {};
    let sanitized = false;

    for (const [key, value] of Object.entries(headers)) {
      // Convert header names to lowercase for consistency
      const lowerKey = key.toLowerCase();

      // Skip dangerous headers
      if (['host', 'connection', 'keep-alive', 'proxy-authenticate'].includes(lowerKey)) {
        violations.push(`Dangerous header removed: ${key}`);
        sanitized = true;
        continue;
      }

      // Sanitize header value
      const cleanValue = sanitizeText(value);
      if (cleanValue !== value) {
        violations.push(`Header value sanitized: ${key}`);
        sanitized = true;
      }

      sanitizedHeaders[lowerKey] = cleanValue;
    }

    return { headers: sanitizedHeaders, violations, sanitized };
  }

  /**
   * Sanitize request body
   */
  private static sanitizeBody(body: any): {
    body: any;
    violations: string[];
    sanitized: boolean;
  } {
    const violations: string[] = [];
    let sanitized = false;

    try {
      if (typeof body === 'string') {
        const cleanBody = sanitizeText(body);
        sanitized = cleanBody !== body;
        return {
          body: cleanBody,
          violations: sanitized ? ['Body string sanitized'] : [],
          sanitized
        };
      }

      if (typeof body === 'object' && body !== null) {
        const cleanBody = this.sanitizeObject(body);
        sanitized = cleanBody.sanitized;
        violations.push(...cleanBody.violations);
        return {
          body: cleanBody.object,
          violations,
          sanitized
        };
      }

      return { body, violations, sanitized };
    } catch (error) {
      violations.push('Body sanitization failed');
      return { body: {}, violations, sanitized: true };
    }
  }

  /**
   * Sanitize route parameters
   */
  private static sanitizeParams(params: Record<string, string>): Record<string, string> {
    const sanitizedParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      sanitizedParams[key] = sanitizeText(value);
    }

    return sanitizedParams;
  }

  /**
   * Recursively sanitize object properties
   */
  private static sanitizeObject(obj: any): {
    object: any;
    violations: string[];
    sanitized: boolean;
  } {
    const violations: string[] = [];
    let sanitized = false;

    if (Array.isArray(obj)) {
      const sanitizedArray = obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          const result = this.sanitizeObject(item);
          if (result.sanitized) sanitized = true;
          violations.push(...result.violations);
          return result.object;
        } else if (typeof item === 'string') {
          const cleanItem = sanitizeText(item);
          if (cleanItem !== item) {
            sanitized = true;
            violations.push('Array item sanitized');
          }
          return cleanItem;
        }
        return item;
      });

      return { object: sanitizedArray, violations, sanitized };
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitizedObj: any = {};

      for (const [key, value] of Object.entries(obj)) {
        const cleanKey = sanitizeText(key);
        if (cleanKey !== key) {
          sanitized = true;
          violations.push(`Object key sanitized: ${key}`);
        }

        if (typeof value === 'object' && value !== null) {
          const result = this.sanitizeObject(value);
          if (result.sanitized) sanitized = true;
          violations.push(...result.violations);
          sanitizedObj[cleanKey] = result.object;
        } else if (typeof value === 'string') {
          const cleanValue = sanitizeText(value);
          if (cleanValue !== value) {
            sanitized = true;
            violations.push(`Object value sanitized: ${key}`);
          }
          sanitizedObj[cleanKey] = cleanValue;
        } else {
          sanitizedObj[cleanKey] = value;
        }
      }

      return { object: sanitizedObj, violations, sanitized };
    }

    return { object: obj, violations, sanitized };
  }

  /**
   * Check for injection attempts
   */
  private static checkForInjection(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    query: Record<string, string>,
    params: Record<string, string>
  ): { violations: string[] } {
    const violations: string[] = [];

    // Check URL
    if (detectInjection(url)) {
      violations.push('Injection detected in URL');
    }

    // Check query parameters
    for (const [key, value] of Object.entries(query)) {
      if (detectInjection(value)) {
        violations.push(`Injection detected in query: ${key}`);
      }
    }

    // Check headers
    for (const [key, value] of Object.entries(headers)) {
      if (detectInjection(value)) {
        violations.push(`Injection detected in header: ${key}`);
      }
    }

    // Check body
    if (body) {
      const bodyStr = JSON.stringify(body);
      if (detectInjection(bodyStr)) {
        violations.push('Injection detected in request body');
      }
    }

    // Check route parameters
    for (const [key, value] of Object.entries(params)) {
      if (detectInjection(value)) {
        violations.push(`Injection detected in param: ${key}`);
      }
    }

    return { violations };
  }

  /**
   * Check for XSS attempts
   */
  private static checkForXSS(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    query: Record<string, string>,
    params: Record<string, string>
  ): { violations: string[] } {
    const violations: string[] = [];
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /expression\s*\(/i,
      /vbscript:/i,
      /data:text\/html/i
    ];

    const checkValue = (value: string, location: string) => {
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          violations.push(`XSS attempt detected in ${location}`);
          return;
        }
      }
    };

    // Check URL
    checkValue(url, 'URL');

    // Check query parameters
    for (const [key, value] of Object.entries(query)) {
      checkValue(value, `query parameter ${key}`);
    }

    // Check headers
    for (const [key, value] of Object.entries(headers)) {
      checkValue(value, `header ${key}`);
    }

    // Check body
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      checkValue(bodyStr, 'request body');
    }

    // Check route parameters
    for (const [key, value] of Object.entries(params)) {
      checkValue(value, `route parameter ${key}`);
    }

    return { violations };
  }

  /**
   * Get sanitizer statistics
   */
  public static getSanitizerStats(): {
    config: SanitizerConfig;
    enabledFeatures: string[];
  } {
    const enabledFeatures = [];
    if (this.CONFIG.enableInjectionDetection) enabledFeatures.push('injection_detection');
    if (this.CONFIG.enableXssProtection) enabledFeatures.push('xss_protection');

    return {
      config: { ...this.CONFIG },
      enabledFeatures
    };
  }
}