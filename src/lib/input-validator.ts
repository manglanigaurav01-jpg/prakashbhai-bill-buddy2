/**
 * Input Validator for Bill Buddy App
 *
 * Advanced input validation with schema-based validation,
 * sanitization, and comprehensive security checks.
 */

import { validateAndSanitize, ValidationResult } from './security';
import { AuditLogger, AuditEventType } from './audit-logger';

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'date' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[] | number[];
  custom?: (value: any, data?: any) => boolean;
  sanitize?: boolean;
  fieldType?: 'text' | 'email' | 'phone' | 'name' | 'number';
  nestedSchema?: ValidationSchema;
}

export interface ValidationOptions {
  strict?: boolean; // Reject unknown fields
  sanitize?: boolean; // Sanitize input
  auditFailures?: boolean; // Log validation failures
  maxDepth?: number; // Maximum nesting depth
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
  warnings: string[];
}

export interface ValidationError {
  field: string;
  value: any;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export class InputValidator {
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    strict: false,
    sanitize: true,
    auditFailures: true,
    maxDepth: 5
  };

  /**
   * Validate input against schema
   */
  public static async validateInput(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions = {}
  ): Promise<ValidationReport> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let sanitizedData = data;

    try {
      // Validate structure
      const structureResult = this.validateStructure(data, schema, opts);
      errors.push(...structureResult.errors);
      warnings.push(...structureResult.warnings);

      // Validate individual fields
      const fieldResults = await this.validateFields(data, schema, opts, '');
      errors.push(...fieldResults.errors);
      warnings.push(...fieldResults.warnings);

      // Sanitize if requested
      if (opts.sanitize && errors.length === 0) {
        sanitizedData = this.sanitizeData(data, schema);
      }

      // Audit validation failures
      if (opts.auditFailures && errors.length > 0) {
        await AuditLogger.logEvent(
          AuditEventType.SECURITY_VIOLATION,
          {
            validationErrors: errors.length,
            fields: errors.map(e => e.field),
            source: 'input_validation'
          },
          'low'
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: opts.sanitize ? sanitizedData : undefined,
        warnings
      };

    } catch (error) {
      console.error('Input validation error:', error);
      return {
        isValid: false,
        errors: [{
          field: 'system',
          value: null,
          rule: 'validation_error',
          message: 'Validation system error',
          severity: 'error'
        }],
        warnings: ['Validation system encountered an error']
      };
    }
  }

  /**
   * Validate customer data schema
   */
  public static async validateCustomerData(data: any): Promise<ValidationReport> {
    const schema: ValidationSchema = {
      name: {
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 100,
        fieldType: 'name',
        sanitize: true
      },
      email: {
        type: 'email',
        required: true,
        fieldType: 'email',
        sanitize: true
      },
      phone: {
        type: 'phone',
        required: false,
        fieldType: 'phone',
        sanitize: true
      },
      address: {
        type: 'string',
        required: false,
        maxLength: 500,
        sanitize: true
      },
      dateOfBirth: {
        type: 'date',
        required: false,
        custom: (value) => {
          const date = new Date(value);
          const now = new Date();
          const age = now.getFullYear() - date.getFullYear();
          return age >= 18 && age <= 120;
        }
      }
    };

    return await this.validateInput(data, schema, { strict: true });
  }

  /**
   * Validate bill data schema
   */
  public static async validateBillData(data: any): Promise<ValidationReport> {
    const schema: ValidationSchema = {
      customerId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50
      },
      amount: {
        type: 'number',
        required: true,
        min: 0.01,
        max: 1000000
      },
      currency: {
        type: 'string',
        required: true,
        enum: ['USD', 'EUR', 'GBP', 'INR'],
        minLength: 3,
        maxLength: 3
      },
      description: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 1000,
        fieldType: 'text',
        sanitize: true
      },
      dueDate: {
        type: 'date',
        required: true,
        custom: (value) => new Date(value) > new Date()
      },
      category: {
        type: 'string',
        required: false,
        enum: ['utilities', 'rent', 'groceries', 'entertainment', 'other'],
        sanitize: true
      },
      tags: {
        type: 'array',
        required: false,
        custom: (value) => Array.isArray(value) && value.length <= 10
      }
    };

    return await this.validateInput(data, schema, { strict: true });
  }

  /**
   * Validate user registration data
   */
  public static async validateRegistrationData(data: any): Promise<ValidationReport> {
    const schema: ValidationSchema = {
      email: {
        type: 'email',
        required: true,
        fieldType: 'email',
        sanitize: true
      },
      password: {
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        custom: (value) => !this.isCommonPassword(value)
      },
      confirmPassword: {
        type: 'string',
        required: true,
        custom: (value, data) => value === data.password
      },
      firstName: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        fieldType: 'name',
        sanitize: true
      },
      lastName: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        fieldType: 'name',
        sanitize: true
      },
      acceptTerms: {
        type: 'boolean',
        required: true,
        custom: (value) => value === true
      }
    };

    return await this.validateInput(data, schema, { strict: true });
  }

  /**
   * Validate payment data
   */
  public static async validatePaymentData(data: any): Promise<ValidationReport> {
    const schema: ValidationSchema = {
      billId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50
      },
      amount: {
        type: 'number',
        required: true,
        min: 0.01,
        max: 1000000
      },
      paymentMethod: {
        type: 'string',
        required: true,
        enum: ['credit_card', 'debit_card', 'bank_transfer', 'paypal', 'cash']
      },
      cardNumber: {
        type: 'string',
        required: false,
        pattern: /^\d{13,19}$/,
        custom: (value, data) => {
          if (data.paymentMethod?.includes('card')) {
            return this.isValidCardNumber(value);
          }
          return true;
        }
      },
      expiryDate: {
        type: 'string',
        required: false,
        pattern: /^(0[1-9]|1[0-2])\/\d{2}$/,
        custom: (value, data) => {
          if (data.paymentMethod?.includes('card')) {
            return this.isValidExpiryDate(value);
          }
          return true;
        }
      },
      cvv: {
        type: 'string',
        required: false,
        pattern: /^\d{3,4}$/
      }
    };

    return await this.validateInput(data, schema, { strict: true });
  }

  /**
   * Validate structure (required fields, unknown fields)
   */
  private static validateStructure(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions
  ): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push({
        field: 'root',
        value: data,
        rule: 'type',
        message: 'Input must be an object',
        severity: 'error'
      });
      return { errors, warnings };
    }

    // Check required fields
    for (const [field, rule] of Object.entries(schema)) {
      if (rule.required && !(field in data)) {
        errors.push({
          field,
          value: undefined,
          rule: 'required',
          message: `Field '${field}' is required`,
          severity: 'error'
        });
      }
    }

    // Check for unknown fields if strict mode
    if (options.strict) {
      for (const field in data) {
        if (!(field in schema)) {
          errors.push({
            field,
            value: data[field],
            rule: 'unknown_field',
            message: `Unknown field '${field}'`,
            severity: 'error'
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate individual fields
   */
  private static async validateFields(
    data: any,
    schema: ValidationSchema,
    options: ValidationOptions,
    path: string,
    depth: number = 0
  ): Promise<{ errors: ValidationError[]; warnings: string[] }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (depth > options.maxDepth!) {
      errors.push({
        field: path || 'root',
        value: data,
        rule: 'max_depth',
        message: 'Maximum validation depth exceeded',
        severity: 'error'
      });
      return { errors, warnings };
    }

    for (const [field, rule] of Object.entries(schema)) {
      const fieldPath = path ? `${path}.${field}` : field;
      const value = data[field];

      // Skip validation if field is not present and not required
      if (value === undefined && !rule.required) {
        continue;
      }

      // Type validation
      const typeResult = this.validateType(value, rule.type, fieldPath);
      if (!typeResult.valid) {
        errors.push(typeResult.error!);
        continue;
      }

      // Length validation for strings
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push({
            field: fieldPath,
            value,
            rule: 'minLength',
            message: `String too short (min: ${rule.minLength})`,
            severity: 'error'
          });
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push({
            field: fieldPath,
            value,
            rule: 'maxLength',
            message: `String too long (max: ${rule.maxLength})`,
            severity: 'error'
          });
        }
      }

      // Range validation for numbers
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({
            field: fieldPath,
            value,
            rule: 'min',
            message: `Number too small (min: ${rule.min})`,
            severity: 'error'
          });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({
            field: fieldPath,
            value,
            rule: 'max',
            message: `Number too large (max: ${rule.max})`,
            severity: 'error'
          });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          errors.push({
            field: fieldPath,
            value,
            rule: 'pattern',
            message: 'Value does not match required pattern',
            severity: 'error'
          });
        }
      }

      // Enum validation
      if (rule.enum && !(rule.enum as any[]).includes(value as any)) {
        errors.push({
          field: fieldPath,
          value,
          rule: 'enum',
          message: `Value must be one of: ${rule.enum.join(', ')}`,
          severity: 'error'
        });
      }

      // Custom validation
      if (rule.custom && !rule.custom(value, data)) {
        errors.push({
          field: fieldPath,
          value,
          rule: 'custom',
          message: 'Custom validation failed',
          severity: 'error'
        });
      }

      // Nested validation
      if (rule.type === 'object' && rule.nestedSchema && typeof value === 'object') {
        const nestedResult = await this.validateFields(value, rule.nestedSchema, options, fieldPath, depth + 1);
        errors.push(...nestedResult.errors);
        warnings.push(...nestedResult.warnings);
      }

      // Array validation
      if (rule.type === 'array' && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const itemPath = `${fieldPath}[${i}]`;
          if (rule.nestedSchema) {
            const nestedResult: { errors: ValidationError[]; warnings: string[] } = await this.validateFields(value[i], rule.nestedSchema, options, itemPath, depth + 1);
            errors.push(...nestedResult.errors);
            warnings.push(...nestedResult.warnings);
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate field type
   */
  private static validateType(value: any, expectedType: string, field: string): { valid: boolean; error?: ValidationError } {
    let valid = true;
    let message = '';

    switch (expectedType) {
      case 'string':
        valid = typeof value === 'string';
        message = 'Must be a string';
        break;
      case 'number':
        valid = typeof value === 'number' && !isNaN(value) && isFinite(value);
        message = 'Must be a valid number';
        break;
      case 'boolean':
        valid = typeof value === 'boolean';
        message = 'Must be a boolean';
        break;
      case 'email':
        valid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        message = 'Must be a valid email address';
        break;
      case 'phone':
        valid = typeof value === 'string' && /^[\d\s\-\(\)\+]+$/.test(value);
        message = 'Must be a valid phone number';
        break;
      case 'date':
        valid = value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
        message = 'Must be a valid date';
        break;
      case 'array':
        valid = Array.isArray(value);
        message = 'Must be an array';
        break;
      case 'object':
        valid = typeof value === 'object' && value !== null && !Array.isArray(value);
        message = 'Must be an object';
        break;
    }

    if (!valid) {
      return {
        valid: false,
        error: {
          field,
          value,
          rule: 'type',
          message,
          severity: 'error'
        }
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize data according to schema
   */
  private static sanitizeData(data: any, schema: ValidationSchema): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized: any = {};

    for (const [field, rule] of Object.entries(schema)) {
      if (field in data) {
        let value = data[field];

        if (rule.sanitize && typeof value === 'string') {
          const result = validateAndSanitize(value, {
            fieldType: rule.fieldType,
            maxLength: rule.maxLength
          });
          value = result.sanitizedValue || value;
        }

        if (rule.type === 'object' && rule.nestedSchema) {
          value = this.sanitizeData(value, rule.nestedSchema);
        }

      if (rule.type === 'array' && Array.isArray(value) && rule.nestedSchema) {
        value = value.map((item: any) => this.sanitizeData(item, rule.nestedSchema));
      }

        sanitized[field] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if password is common
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  private static isValidCardNumber(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }

  /**
   * Validate expiry date
   */
  private static isValidExpiryDate(expiryDate: string): boolean {
    const match = expiryDate.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!match) return false;

    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10) + 2000;
    const now = new Date();
    const expiry = new Date(year, month - 1);

    return expiry > now;
  }

  /**
   * Get validation statistics
   */
  public static getValidationStats(): {
    schemas: string[];
    commonErrors: Record<string, number>;
  } {
    return {
      schemas: ['customer', 'bill', 'registration', 'payment'],
      commonErrors: {
        required: 0,
        type: 0,
        minLength: 0,
        maxLength: 0,
        pattern: 0,
        enum: 0,
        custom: 0
      }
    };
  }
}
