import { Customer, Bill, Payment, ItemMaster } from '@/types';
import { validateBillDate, validatePaymentDate } from './validation';
import { buildIndexes, invalidateIndexes, needsReindexing } from './indexing';
import { createLocalBackup } from './data-backup';

const STORAGE_KEYS = {
  CUSTOMERS: 'prakash_customers',
  BILLS: 'prakash_bills',
  PAYMENTS: 'prakash_payments',
  ITEMS: 'prakash_items',
};

let cachedCustomers: Customer[] | null = null;
let cachedBills: Bill[] | null = null;
let cachedPayments: Payment[] | null = null;
let cachedItems: ItemMaster[] | null = null;

// Function to safely parse JSON
const safeJSONParse = <T>(data: string | null, defaultValue: T): T => {
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

// Function to safely store data
const safeStore = (key: string, data: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error storing ${key}:`, error);
    throw new Error('Storage failed');
  }
};

// Customer management
export const getCustomers = (): Customer[] => {
  if (cachedCustomers) return cachedCustomers;
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  cachedCustomers = safeJSONParse<Customer[]>(data, []);
  return cachedCustomers;
};

export const saveCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>): Customer => {
  const customers = getCustomers();
  const normalizedNewName = customer.name.trim().toLowerCase();
  
  // Check for duplicates
  const isDuplicate = customers.some(c => c.name.trim().toLowerCase() === normalizedNewName);
  if (isDuplicate) {
    throw new Error('DUPLICATE_CUSTOMER_NAME');
  }

  const newCustomer: Customer = {
    ...customer,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };

  customers.push(newCustomer);
  safeStore(STORAGE_KEYS.CUSTOMERS, customers);
  cachedCustomers = customers;
  invalidateIndexes();
  
  // Create backup after significant changes
  createLocalBackup().catch(console.error);
  
  return newCustomer;
};

// Bill management
export const getBills = (): Bill[] => {
  if (cachedBills) return cachedBills;
  const data = localStorage.getItem(STORAGE_KEYS.BILLS);
  cachedBills = safeJSONParse<Bill[]>(data, []);
  return cachedBills;
};

export const saveBill = (bill: Omit<Bill, 'id' | 'createdAt'>): Bill => {
  // Validate bill
  const dateValidation = validateBillDate(bill.date);
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error || 'Invalid bill date');
  }

  if (!bill.customerId) {
    throw new Error('Customer ID is required');
  }
  if (!bill.items || bill.items.length === 0) {
    throw new Error('Bill must have at least one item');
  }
  if (!bill.grandTotal || bill.grandTotal <= 0) {
    throw new Error('Invalid total amount');
  }

  const bills = getBills();
  const newBill: Bill = {
    ...bill,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };

  bills.push(newBill);
  safeStore(STORAGE_KEYS.BILLS, bills);
  cachedBills = bills;
  invalidateIndexes();
  
  // Create backup after significant changes
  createLocalBackup().catch(console.error);
  
  return newBill;
};

// Payment management
export const getPayments = (): Payment[] => {
  if (cachedPayments) return cachedPayments;
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  cachedPayments = safeJSONParse<Payment[]>(data, []);
  return cachedPayments;
};

export const savePayment = (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
  // Validate payment
  const dateValidation = validatePaymentDate(payment.date);
  if (!dateValidation.isValid) {
    throw new Error(dateValidation.error || 'Invalid payment date');
  }

  if (!payment.customerId) {
    throw new Error('Customer ID is required');
  }
  if (!payment.amount || payment.amount <= 0) {
    throw new Error('Invalid payment amount');
  }
  if (!payment.paymentMethod) {
    throw new Error('Payment method is required');
  }

  const payments = getPayments();
  const newPayment: Payment = {
    ...payment,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };

  payments.push(newPayment);
  safeStore(STORAGE_KEYS.PAYMENTS, payments);
  cachedPayments = payments;
  invalidateIndexes();
  
  // Create backup after significant changes
  createLocalBackup().catch(console.error);
  
  return newPayment;
};

// Function to rebuild indexes if needed
const _ensureIndexes = () => {
  if (needsReindexing()) {
    buildIndexes(getBills(), getPayments(), getCustomers(), getItems());
  }
};

// Function to clear cache
// Item management
export const getItems = (): ItemMaster[] => {
  if (cachedItems) return cachedItems;
  const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
  cachedItems = safeJSONParse<ItemMaster[]>(data, []);
  return cachedItems;
};

export const saveItem = (item: Omit<ItemMaster, 'id' | 'createdAt'>): ItemMaster => {
  const items = getItems();
  const normalizedNewName = item.name.trim().toLowerCase();
  
  // Check for duplicates
  const isDuplicate = items.some(i => i.name.trim().toLowerCase() === normalizedNewName);
  if (isDuplicate) {
    throw new Error('DUPLICATE_ITEM_NAME');
  }

  const newItem: ItemMaster = {
    ...item,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };

  items.push(newItem);
  safeStore(STORAGE_KEYS.ITEMS, items);
  cachedItems = items;
  invalidateIndexes();
  
  // Create backup after significant changes
  createLocalBackup().catch(console.error);
  
  return newItem;
};

export const clearCache = () => {
  cachedCustomers = null;
  cachedBills = null;
  cachedPayments = null;
  cachedItems = null;
  invalidateIndexes();
};

// Add event listener for storage changes
window.addEventListener('storage', () => {
  clearCache();
});