// Enhanced data validation with real-time validation, duplicate detection, and integrity checks

import { 
  ValidationResult, 
  DataValidationResult,
  validateCustomerName,
  validateItemName
} from './validation';
import { getCustomers, getBills, getPayments, getItems } from './storage';

// Real-time validation hook result
export interface RealTimeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isValidating: boolean;
}

// Duplicate detection
export interface DuplicateCheck {
  isDuplicate: boolean;
  duplicateOf?: string;
  similarity: number;
}

// Check for duplicate customer names
export const checkDuplicateCustomer = (name: string, excludeId?: string): DuplicateCheck => {
  const customers = getCustomers();
  const normalizedName = name.trim().toLowerCase();
  
  for (const customer of customers) {
    if (excludeId && customer.id === excludeId) continue;
    
    const normalizedExisting = customer.name.trim().toLowerCase();
    const similarity = calculateSimilarity(normalizedName, normalizedExisting);
    
    if (normalizedExisting === normalizedName || similarity > 0.9) {
      return {
        isDuplicate: true,
        duplicateOf: customer.id,
        similarity
      };
    }
  }
  
  return { isDuplicate: false, similarity: 0 };
};

// Check for duplicate item names
export const checkDuplicateItem = (name: string, excludeId?: string): DuplicateCheck => {
  const items = getItems();
  const normalizedName = name.trim().toLowerCase();
  
  for (const item of items) {
    if (excludeId && item.id === excludeId) continue;
    
    const normalizedExisting = item.name.trim().toLowerCase();
    const similarity = calculateSimilarity(normalizedName, normalizedExisting);
    
    if (normalizedExisting === normalizedName || similarity > 0.9) {
      return {
        isDuplicate: true,
        duplicateOf: item.id,
        similarity
      };
    }
  }
  
  return { isDuplicate: false, similarity: 0 };
};

// Calculate string similarity (Levenshtein distance based)
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Enhanced customer validation
export const validateCustomerEnhanced = (
  name: string,
  excludeId?: string
): ValidationResult & { duplicate?: DuplicateCheck } => {
  const basicValidation = validateCustomerName(name);
  if (!basicValidation.isValid) {
    return basicValidation;
  }
  
  const duplicateCheck = checkDuplicateCustomer(name, excludeId);
  if (duplicateCheck.isDuplicate) {
    return {
      isValid: false,
      errors: [`A customer with a similar name already exists (${(duplicateCheck.similarity * 100).toFixed(0)}% similar)`],
      duplicate: duplicateCheck
    };
  }
  
  return { isValid: true, errors: [] };
};

// Enhanced item validation
export const validateItemEnhanced = (
  name: string,
  excludeId?: string
): ValidationResult & { duplicate?: DuplicateCheck } => {
  const basicValidation = validateItemName(name);
  if (!basicValidation.isValid) {
    return basicValidation;
  }
  
  const duplicateCheck = checkDuplicateItem(name, excludeId);
  if (duplicateCheck.isDuplicate) {
    return {
      isValid: false,
      errors: [`An item with a similar name already exists (${(duplicateCheck.similarity * 100).toFixed(0)}% similar)`],
      duplicate: duplicateCheck
    };
  }
  
  return { isValid: true, errors: [] };
};

// Data integrity checks
export const checkDataIntegrity = (): DataValidationResult & { 
  orphanedBills: string[];
  orphanedPayments: string[];
  invalidReferences: string[];
} => {
  const errors: string[] = [];
  const orphanedBills: string[] = [];
  const orphanedPayments: string[] = [];
  const invalidReferences: string[] = [];
  
  const customers = getCustomers();
  const bills = getBills();
  const payments = getPayments();
  const items = getItems();
  
  const customerIds = new Set(customers.map(c => c.id));
  
  // Check bills
  bills.forEach((bill, index) => {
    if (!bill.customerId || !customerIds.has(bill.customerId)) {
      orphanedBills.push(bill.id);
      errors.push(`Bill at index ${index} references non-existent customer`);
    }
    
    if (bill.items) {
      bill.items.forEach((item, itemIndex) => {
        // Check if item exists in master (if it's a fixed item)
        const masterItem = items.find(i => i.name === item.itemName);
        if (masterItem && masterItem.type === 'fixed' && masterItem.rate !== item.rate) {
          invalidReferences.push(`Bill ${bill.id}, item ${itemIndex}: rate mismatch`);
        }
      });
    }
  });
  
  // Check payments
  payments.forEach((payment, index) => {
    if (!payment.customerId || !customerIds.has(payment.customerId)) {
      orphanedPayments.push(payment.id);
      errors.push(`Payment at index ${index} references non-existent customer`);
    }
    
    // Check payment date is not before bill dates for that customer
    const customerBills = bills.filter(b => b.customerId === payment.customerId);
    if (customerBills.length > 0) {
      const paymentDate = new Date(payment.date);
      const earliestBill = customerBills.reduce((earliest, bill) => {
        const billDate = new Date(bill.date);
        return billDate < earliest ? billDate : earliest;
      }, new Date(customerBills[0].date));
      
      if (paymentDate < earliestBill) {
        errors.push(`Payment ${payment.id} date is before earliest bill date for customer`);
      }
    }
  });
  
  return {
    isConsistent: errors.length === 0,
    errors,
    orphanedBills,
    orphanedPayments,
    invalidReferences
  };
};

// Real-time validation hook
export const useRealTimeValidation = (
  value: string,
  validator: (val: string) => ValidationResult,
  debounceMs: number = 300
): RealTimeValidation => {
  const [validation, setValidation] = useState<RealTimeValidation>({
    isValid: true,
    errors: [],
    warnings: [],
    isValidating: false
  });
  
  useEffect(() => {
    if (!value) {
      setValidation({ isValid: true, errors: [], warnings: [], isValidating: false });
      return;
    }
    
    setValidation(prev => ({ ...prev, isValidating: true }));
    
    const timeoutId = setTimeout(() => {
      const result = validator(value);
      setValidation({
        isValid: result.isValid,
        errors: result.errors || [],
        warnings: [],
        isValidating: false
      });
    }, debounceMs);
    
    return () => clearTimeout(timeoutId);
  }, [value, validator, debounceMs]);
  
  return validation;
};

// Auto-fix common data issues
export const autoFixDataIssues = (): {
  fixed: number;
  issues: string[];
} => {
  const integrity = checkDataIntegrity();
  const issues: string[] = [];
  const fixed = 0;
  
  // Remove orphaned bills (or mark them)
  if (integrity.orphanedBills.length > 0) {
    issues.push(`Found ${integrity.orphanedBills.length} orphaned bills`);
    // Could implement auto-fix here if needed
  }
  
  // Remove orphaned payments
  if (integrity.orphanedPayments.length > 0) {
    issues.push(`Found ${integrity.orphanedPayments.length} orphaned payments`);
    // Could implement auto-fix here if needed
  }
  
  return { fixed, issues };
};

// Import React for hooks
import { useState, useEffect } from 'react';

