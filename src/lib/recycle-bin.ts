import { Customer, Bill, Payment } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Storage keys matching those in storage.ts
const STORAGE_KEYS = {
  CUSTOMERS: 'prakash_customers',
  BILLS: 'prakash_bills',
  PAYMENTS: 'prakash_payments',
};

export interface RecycledItem {
  id: string;
  type: 'customer' | 'bill' | 'payment';
  data: Customer | Bill | Payment;
  deletedAt: string;
  displayName: string;
}

const RECYCLE_BIN_KEY = 'recycle_bin';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getRecycleBin = (): RecycledItem[] => {
  try {
    const data = localStorage.getItem(RECYCLE_BIN_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading recycle bin:', error);
    return [];
  }
};

export const addToRecycleBin = (
  type: RecycledItem['type'],
  data: Customer | Bill | Payment,
  displayName: string
): void => {
  const recycleBin = getRecycleBin();
  const recycledItem: RecycledItem = {
    id: uuidv4(),
    type,
    data,
    deletedAt: new Date().toISOString(),
    displayName,
  };
  
  recycleBin.push(recycledItem);
  localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(recycleBin));
  
  // Auto-cleanup old items
  cleanupOldItems();
};

export const restoreFromRecycleBin = (itemId: string): boolean => {
  try {
    const recycleBin = getRecycleBin();
    const itemIndex = recycleBin.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) return false;
    
    const item = recycleBin[itemIndex];
    
    // Restore to appropriate storage
    switch (item.type) {
      case 'customer': {
        const customers = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
        customers.push(item.data);
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
        break;
      }
      case 'bill': {
        const bills = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILLS) || '[]');
        bills.push(item.data);
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
        break;
      }
      case 'payment': {
        const payments = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
        payments.push(item.data);
        localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
        break;
      }
    }
    
    // Remove from recycle bin
    recycleBin.splice(itemIndex, 1);
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(recycleBin));
    
    window.dispatchEvent(new Event('storage'));
    return true;
  } catch (error) {
    console.error('Error restoring item:', error);
    return false;
  }
};

export const permanentlyDelete = (itemId: string): boolean => {
  try {
    const recycleBin = getRecycleBin();
    const filteredBin = recycleBin.filter(item => item.id !== itemId);
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(filteredBin));
    return true;
  } catch (error) {
    console.error('Error permanently deleting item:', error);
    return false;
  }
};

export const clearRecycleBin = (): void => {
  localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify([]));
};

export const cleanupOldItems = (): number => {
  const recycleBin = getRecycleBin();
  const now = Date.now();
  
  const filteredBin = recycleBin.filter(item => {
    const deletedTime = new Date(item.deletedAt).getTime();
    return (now - deletedTime) < THIRTY_DAYS_MS;
  });
  
  const deletedCount = recycleBin.length - filteredBin.length;
  
  if (deletedCount > 0) {
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(filteredBin));
  }
  
  return deletedCount;
};

export const getDaysRemaining = (deletedAt: string): number => {
  const deletedTime = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsed = now - deletedTime;
  const remaining = THIRTY_DAYS_MS - elapsed;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
};
