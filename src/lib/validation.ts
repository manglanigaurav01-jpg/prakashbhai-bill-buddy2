/**
 * Validation Utilities for Bill Buddy App
 *
 * Provides comprehensive validation functions for all data types
 * used in the application with security-focused input validation.
 */

import { sanitizeCustomerName, sanitizeEmail, sanitizePhoneNumber, sanitizeNumber, sanitizeBillParticulars, validateLength } from './security';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export interface Customer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Bill {
  id?: string;
  customerId: string;
  customerName: string;
  particulars: string;
  amount: number;
  date: Date;
  dueDate?: Date;
  status: 'pending' | 'paid' | 'overdue';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Payment {
  id?: string;
  billId: string;
  customerId: string;
  amount: number;
  date: Date;
  method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Validate customer data object
 * @param customer - Customer object to validate
 * @returns Validation result
 */
export function validateCustomerData(customer: Partial<Customer>): ValidationResult {
  const errors: string[] = [];
  const sanitizedCustomer: Partial<Customer> = {};

  // Required fields
  if (!customer.name || typeof customer.name !== 'string') {
    errors.push('Customer name is required');
  } else {
    const sanitizedName = sanitizeCustomerName(customer.name);
    if (!sanitizedName) {
      errors.push('Customer name contains invalid characters');
    } else if (!validateLength(sanitizedName, 1, 100)) {
      errors.push('Customer name must be between 1 and 100 characters');
    } else {
      sanitizedCustomer.name = sanitizedName;
    }
  }

  // Optional email validation
  if (customer.email) {
    const sanitizedEmail = sanitizeEmail(customer.email);
    if (!sanitizedEmail) {
      errors.push('Invalid email format');
    } else {
      sanitizedCustomer.email = sanitizedEmail;
    }
  }

  // Optional phone validation
  if (customer.phone) {
    const sanitizedPhone = sanitizePhoneNumber(customer.phone);
    if (sanitizedPhone && !validateLength(sanitizedPhone, 7, 20)) {
      errors.push('Phone number must be between 7 and 20 characters');
    } else if (sanitizedPhone) {
      sanitizedCustomer.phone = sanitizedPhone;
    }
  }

  // Optional address validation
  if (customer.address) {
    if (typeof customer.address !== 'string') {
      errors.push('Address must be a string');
    } else if (!validateLength(customer.address, 0, 500)) {
      errors.push('Address must be less than 500 characters');
    } else {
      sanitizedCustomer.address = customer.address.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedCustomer
  };
}

/**
 * Validate bill data object
 * @param bill - Bill object to validate
 * @returns Validation result
 */
export function validateBillData(bill: Partial<Bill>): ValidationResult {
  const errors: string[] = [];
  const sanitizedBill: Partial<Bill> = {};

  // Required customer ID
  if (!bill.customerId || typeof bill.customerId !== 'string') {
    errors.push('Customer ID is required');
  } else {
    sanitizedBill.customerId = bill.customerId.trim();
  }

  // Required customer name
  if (!bill.customerName || typeof bill.customerName !== 'string') {
    errors.push('Customer name is required');
  } else {
    const sanitizedName = sanitizeCustomerName(bill.customerName);
    if (!sanitizedName) {
      errors.push('Customer name contains invalid characters');
    } else if (!validateLength(sanitizedName, 1, 100)) {
      errors.push('Customer name must be between 1 and 100 characters');
    } else {
      sanitizedBill.customerName = sanitizedName;
    }
  }

  // Required particulars
  if (!bill.particulars || typeof bill.particulars !== 'string') {
    errors.push('Bill particulars are required');
  } else {
    const sanitizedParticulars = sanitizeBillParticulars(bill.particulars);
    if (!sanitizedParticulars) {
      errors.push('Bill particulars contain invalid characters');
    } else if (!validateLength(sanitizedParticulars, 1, 500)) {
      errors.push('Bill particulars must be between 1 and 500 characters');
    } else {
      sanitizedBill.particulars = sanitizedParticulars;
    }
  }

  // Required amount
  if (bill.amount === undefined || bill.amount === null) {
    errors.push('Bill amount is required');
  } else {
    const sanitizedAmount = sanitizeNumber(bill.amount);
    if (sanitizedAmount <= 0) {
      errors.push('Bill amount must be greater than 0');
    } else if (sanitizedAmount > 10000000) { // 1 crore limit
      errors.push('Bill amount cannot exceed 10,000,000');
    } else {
      sanitizedBill.amount = sanitizedAmount;
    }
  }

  // Required date
  if (!bill.date) {
    errors.push('Bill date is required');
  } else {
    const dateResult = validateDate(bill.date);
    if (!dateResult.isValid) {
      errors.push(...dateResult.errors);
    } else {
      sanitizedBill.date = dateResult.sanitizedValue;
    }
  }

  // Optional due date
  if (bill.dueDate) {
    const dueDateResult = validateDate(bill.dueDate);
    if (!dueDateResult.isValid) {
      errors.push('Invalid due date: ' + dueDateResult.errors.join(', '));
    } else {
      sanitizedBill.dueDate = dueDateResult.sanitizedValue;
    }
  }

  // Required status
  if (!bill.status || !['pending', 'paid', 'overdue'].includes(bill.status)) {
    errors.push('Bill status must be one of: pending, paid, overdue');
  } else {
    sanitizedBill.status = bill.status;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedBill
  };
}

/**
 * Validate payment data object
 * @param payment - Payment object to validate
 * @returns Validation result
 */
export function validatePaymentData(payment: Partial<Payment>): ValidationResult {
  const errors: string[] = [];
  const sanitizedPayment: Partial<Payment> = {};

  // Required bill ID
  if (!payment.billId || typeof payment.billId !== 'string') {
    errors.push('Bill ID is required');
  } else {
    sanitizedPayment.billId = payment.billId.trim();
  }

  // Required customer ID
  if (!payment.customerId || typeof payment.customerId !== 'string') {
    errors.push('Customer ID is required');
  } else {
    sanitizedPayment.customerId = payment.customerId.trim();
  }

  // Required amount
  if (payment.amount === undefined || payment.amount === null) {
    errors.push('Payment amount is required');
  } else {
    const sanitizedAmount = sanitizeNumber(payment.amount);
    if (sanitizedAmount <= 0) {
      errors.push('Payment amount must be greater than 0');
    } else if (sanitizedAmount > 10000000) { // 1 crore limit
      errors.push('Payment amount cannot exceed 10,000,000');
    } else {
      sanitizedPayment.amount = sanitizedAmount;
    }
  }

  // Required date
  if (!payment.date) {
    errors.push('Payment date is required');
  } else {
    const dateResult = validateDate(payment.date);
    if (!dateResult.isValid) {
      errors.push(...dateResult.errors);
    } else {
      sanitizedPayment.date = dateResult.sanitizedValue;
    }
  }

  // Required payment method
  if (!payment.method || !['cash', 'card', 'bank_transfer', 'cheque', 'other'].includes(payment.method)) {
    errors.push('Payment method must be one of: cash, card, bank_transfer, cheque, other');
  } else {
    sanitizedPayment.method = payment.method;
  }

  // Optional notes
  if (payment.notes) {
    if (typeof payment.notes !== 'string') {
      errors.push('Payment notes must be a string');
    } else if (!validateLength(payment.notes, 0, 500)) {
      errors.push('Payment notes must be less than 500 characters');
    } else {
      sanitizedPayment.notes = sanitizeBillParticulars(payment.notes);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedPayment
  };
}

/**
 * Validate required field
 * @param value - Value to check
 * @param fieldName - Name of the field for error messages
 * @returns Validation result
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
  const isValid = value !== null && value !== undefined && value !== '';

  return {
    isValid,
    errors: isValid ? [] : [`${fieldName} is required`],
    sanitizedValue: value
  };
}

/**
 * Validate email format
 * @param email - Email string to validate
 * @returns Validation result
 */
export function validateEmailFormat(email: string): ValidationResult {
  if (typeof email !== 'string') {
    return {
      isValid: false,
      errors: ['Email must be a string'],
      sanitizedValue: email
    };
  }

  const sanitizedEmail = sanitizeEmail(email);

  if (!sanitizedEmail) {
    return {
      isValid: false,
      errors: ['Invalid email format'],
      sanitizedValue: email
    };
  }

  // Additional validation for common email issues
  const errors: string[] = [];

  if (email.length > 254) {
    errors.push('Email is too long');
  }

  if (email.includes('..')) {
    errors.push('Email contains consecutive dots');
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedEmail
  };
}

/**
 * Validate phone number format
 * @param phone - Phone number string to validate
 * @returns Validation result
 */
export function validatePhoneNumberFormat(phone: string): ValidationResult {
  if (typeof phone !== 'string') {
    return {
      isValid: false,
      errors: ['Phone number must be a string'],
      sanitizedValue: phone
    };
  }

  const sanitizedPhone = sanitizePhoneNumber(phone);
  const errors: string[] = [];

  // Basic length check
  if (sanitizedPhone.length < 7) {
    errors.push('Phone number is too short');
  }

  if (sanitizedPhone.length > 20) {
    errors.push('Phone number is too long');
  }

  // Check for at least some digits
  const digitCount = (sanitizedPhone.match(/\d/g) || []).length;
  if (digitCount < 7) {
    errors.push('Phone number must contain at least 7 digits');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: sanitizedPhone
  };
}

/**
 * Validate amount (must be positive number within reasonable limits)
 * @param amount - Amount to validate
 * @returns Validation result
 */
export function validateAmount(amount: number): ValidationResult {
  const errors: string[] = [];

  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number');
    return { isValid: false, errors, sanitizedValue: amount };
  }

  if (amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (amount > 10000000) { // 1 crore limit
    errors.push('Amount cannot exceed 10,000,000');
  }

  // Check for too many decimal places (max 2)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push('Amount cannot have more than 2 decimal places');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: Math.round(amount * 100) / 100 // Round to 2 decimal places
  };
}

/**
 * Validate date (must be valid Date object or parseable date string)
 * @param date - Date to validate
 * @returns Validation result
 */
export function validateDate(date: Date | string): ValidationResult {
  let dateObj: Date;

  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    return {
      isValid: false,
      errors: ['Date must be a Date object or valid date string'],
      sanitizedValue: date
    };
  }

  const errors: string[] = [];

  if (isNaN(dateObj.getTime())) {
    errors.push('Invalid date format');
  } else {
    // Check if date is not too far in the future (max 1 year ahead)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // Check if date is not too far in the past (max 10 years ago)
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    if (dateObj > oneYearFromNow) {
      errors.push('Date cannot be more than 1 year in the future');
    }

    if (dateObj < tenYearsAgo) {
      errors.push('Date cannot be more than 10 years in the past');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedValue: dateObj
  };
}

/**
 * Comprehensive data validation with multiple checks
 * @param data - Data to validate
 * @param type - Type of data ('customer', 'bill', 'payment')
 * @returns Validation result
 */
export function validateData(data: any, type: 'customer' | 'bill' | 'payment'): ValidationResult {
  switch (type) {
    case 'customer':
      return validateCustomerData(data);
    case 'bill':
      return validateBillData(data);
    case 'payment':
      return validatePaymentData(data);
    default:
      return {
        isValid: false,
        errors: ['Unknown data type'],
        sanitizedValue: data
      };
  }
}

/**
 * Batch validation for multiple items
 * @param items - Array of items to validate
 * @param type - Type of data for each item
 * @returns Array of validation results
 */
export function validateBatch(items: any[], type: 'customer' | 'bill' | 'payment'): ValidationResult[] {
  return items.map(item => validateData(item, type));
}

/**
 * Get validation summary for batch validation
 * @param results - Array of validation results
 * @returns Summary object
 */
export function getValidationSummary(results: ValidationResult[]): {
  totalItems: number;
  validItems: number;
  invalidItems: number;
  allErrors: string[];
} {
  const validItems = results.filter(r => r.isValid).length;
  const allErrors = results.flatMap(r => r.errors);

  return {
    totalItems: results.length,
    validItems,
    invalidItems: results.length - validItems,
    allErrors: [...new Set(allErrors)] // Remove duplicates
  };
}

/**
 * Validate customer name
 * @param name - Name string to validate
 * @returns Validation result
 */
export function validateCustomerName(name: string): ValidationResult {
  if (typeof name !== 'string') {
    return { isValid: false, errors: ['Name must be a string'] };
  }

  const sanitized = sanitizeCustomerName(name);
  if (!sanitized) {
    return { isValid: false, errors: ['Name contains invalid characters'] };
  }

  if (sanitized.length < 2) {
    return { isValid: false, errors: ['Name must be at least 2 characters long'] };
  }

  if (sanitized.length > 100) {
    return { isValid: false, errors: ['Name must be less than 100 characters'] };
  }

  return { isValid: true, errors: [], sanitizedValue: sanitized };
}

/**
 * Validate item name
 * @param name - Item name string to validate
 * @returns Validation result
 */
export function validateItemName(name: string): ValidationResult {
  if (typeof name !== 'string') {
    return { isValid: false, errors: ['Item name must be a string'] };
  }

  const sanitized = sanitizeBillParticulars(name);
  if (!sanitized || sanitized.length === 0) {
    return { isValid: false, errors: ['Item name is required'] };
  }

  return { isValid: true, errors: [], sanitizedValue: sanitized };
}

/**
 * Validate item rate
 * @param rate - Rate number to validate
 * @returns Validation result
 */
export function validateItemRate(rate: any): ValidationResult {
  if (typeof rate !== 'number' || isNaN(rate)) {
    return { isValid: false, errors: ['Rate must be a valid number'] };
  }

  if (rate <= 0) {
    return { isValid: false, errors: ['Rate must be greater than 0'] };
  }

  return { isValid: true, errors: [], sanitizedValue: sanitizeNumber(rate) };
}

/**
 * Validate item quantity
 * @param quantity - Quantity number to validate
 * @returns Validation result
 */
export function validateItemQuantity(quantity: any): ValidationResult {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return { isValid: false, errors: ['Quantity must be a valid number'] };
  }

  if (quantity <= 0) {
    return { isValid: false, errors: ['Quantity must be greater than 0'] };
  }

  if (quantity % 1 !== 0) {
    return { isValid: false, errors: ['Quantity must be a whole number'] };
  }

  return { isValid: true, errors: [], sanitizedValue: Math.floor(quantity) };
}

/**
 * Validate payment amount
 * @param amount - Amount number to validate
 * @returns Validation result
 */
export function validatePaymentAmount(amount: any): ValidationResult {
  return validateAmount(amount);
}

/**
 * Validate bill date
 * @param date - Date to validate
 * @returns Validation result
 */
export function validateBillDate(date: any): ValidationResult {
  return validateDate(date);
}

/**
 * Validate email
 * @param email - Email string to validate
 * @param fieldName - Field name for error messages
 * @returns Validation result
 */
export function validateEmail(email: string, fieldName: string): ValidationResult {
  const result = validateEmailFormat(email);
  if (!result.isValid) {
    return result;
  }
  return { ...result, errors: result.errors.map(err => `${fieldName}: ${err}`) };
}

/**
 * Validate phone
 * @param phone - Phone string to validate
 * @param fieldName - Field name for error messages
 * @returns Validation result
 */
export function validatePhone(phone: string, fieldName: string): ValidationResult {
  const result = validatePhoneNumberFormat(phone);
  if (!result.isValid) {
    return result;
  }
  return { ...result, errors: result.errors.map(err => `${fieldName}: ${err}`) };
}

/**
 * Validate form with multiple validations
 * @param validations - Array of validation results
 * @returns Combined validation result
 */
export function validateForm(validations: ValidationResult[]): ValidationResult {
  const allErrors = validations.flatMap(v => v.errors);
  const allValid = validations.every(v => v.isValid);

  return {
    isValid: allValid,
    errors: allErrors,
    sanitizedValue: validations.map(v => v.sanitizedValue)
  };
}
