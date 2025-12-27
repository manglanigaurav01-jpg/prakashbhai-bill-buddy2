import { Customer, Bill, Payment, CustomerBalance, ItemMaster, ItemRateHistory, ItemUsage } from '@/types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export interface BusinessAnalytics {
  version: string;
  lastUpdated: string;
  salesTrends: {
    monthly: { [key: string]: number };
    seasonal: { [key: string]: number };
  };
  customerPatterns: {
    paymentFrequency: { [customerId: string]: number };
    averageBillAmount: { [customerId: string]: number };
  };
  popularItems: {
    monthly: { [itemId: string]: number };
    overall: { [itemId: string]: number };
  };
  cashFlow: {
    predicted: { [key: string]: number };
    actual: { [key: string]: number };
  };
}

// Add version tracking for data structures
const DATA_VERSION = '1.0.0';

const STORAGE_KEYS = {
  DATA_VERSION: 'prakash_data_version',
  CUSTOMERS: 'prakash_customers',
  BILLS: 'prakash_bills',
  PAYMENTS: 'prakash_payments',
  ITEMS: 'prakash_items',
  ITEM_RATE_HISTORY: 'prakash_item_rate_history',
  SYNC_STATUS: 'prakash_sync_status',
  ANALYSIS_CACHE: 'prakash_analysis_cache',
  BUSINESS_ANALYTICS: 'prakash_business_analytics',
  LAST_SYNC: 'prakash_last_sync',
  SYNC_CONFLICTS: 'prakash_sync_conflicts'
};

// Customer management
export const getCustomers = (): Customer[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
  return data ? JSON.parse(data) : [];
};

// Payment management
export const getPayments = (): Payment[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  return data ? JSON.parse(data) : [];
};

// Normalize customer name: trim, remove extra spaces, normalize casing
export const normalizeCustomerName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Title case
    .join(' ');
};

export const saveCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>): Customer => {
  const customers = getCustomers();
  // Normalize the input name
  const normalizedInputName = normalizeCustomerName(customer.name);
  
  // Check for duplicates using normalized comparison (case-insensitive, space-insensitive)
  const normalizedInputLower = normalizedInputName.toLowerCase().replace(/\s+/g, ' ');
  const isDuplicate = customers.some(c => {
    const normalizedExisting = normalizeCustomerName(c.name).toLowerCase().replace(/\s+/g, ' ');
    return normalizedExisting === normalizedInputLower;
  });
  
  if (isDuplicate) {
    throw new Error('DUPLICATE_CUSTOMER_NAME');
  }
  
  const newCustomer: Customer = {
    ...customer,
    name: normalizedInputName, // Save with normalized name
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  customers.push(newCustomer);
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  return newCustomer;
};

export const deleteCustomer = (customerId: string): void => {
  const customers = getCustomers();
  const customer = customers.find(c => c.id === customerId);
  if (customer) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { addToRecycleBin } = require('./recycle-bin');
    addToRecycleBin('customer', customer, `Customer - ${customer.name}`);
  }
  const updatedCustomers = customers.filter(c => c.id !== customerId);
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedCustomers));
  window.dispatchEvent(new Event('storage'));
};

// Bill management
export const getBills = (): Bill[] => {
  const data = localStorage.getItem(STORAGE_KEYS.BILLS);
  return data ? JSON.parse(data) : [];
};

// Business Intelligence Functions
export const getBusinessAnalytics = (): BusinessAnalytics => {
  const data = localStorage.getItem(STORAGE_KEYS.BUSINESS_ANALYTICS);
  if (!data) {
    const initialAnalytics: BusinessAnalytics = {
      version: DATA_VERSION,
      lastUpdated: new Date().toISOString(),
      salesTrends: { monthly: {}, seasonal: {} },
      customerPatterns: { paymentFrequency: {}, averageBillAmount: {} },
      popularItems: { monthly: {}, overall: {} },
      cashFlow: { predicted: {}, actual: {} }
    };
    localStorage.setItem(STORAGE_KEYS.BUSINESS_ANALYTICS, JSON.stringify(initialAnalytics));
    return initialAnalytics;
  }
  return JSON.parse(data);
};

export const updateBusinessAnalytics = async () => {
  const bills = getBills();
  const customers = getCustomers();
  const now = new Date();

  // Calculate sales trends
  const monthlyTrends: { [key: string]: number } = {};

  bills.forEach(bill => {
    const billMonth = format(new Date(bill.date), 'yyyy-MM');
    monthlyTrends[billMonth] = (monthlyTrends[billMonth] || 0) + bill.grandTotal;
  });

  // Calculate customer patterns
  const customerPatterns: { [key: string]: number } = {};
  customers.forEach(customer => {
    const customerBills = bills.filter(b => b.customerId === customer.id);
    const totalAmount = customerBills.reduce((sum, bill) => sum + bill.grandTotal, 0);
    customerPatterns[customer.id] = totalAmount / (customerBills.length || 1);
  });

  // Calculate popular items
  const itemPopularity: { [key: string]: number } = {};
  bills.forEach(bill => {
    bill.items.forEach(item => {
      itemPopularity[item.itemName] = (itemPopularity[item.itemName] || 0) + item.quantity;
    });
  });

  const analytics: BusinessAnalytics = {
    version: DATA_VERSION,
    lastUpdated: now.toISOString(),
    salesTrends: {
      monthly: monthlyTrends,
      seasonal: {} // To be implemented
    },
    customerPatterns: {
      paymentFrequency: {},  // To be implemented
      averageBillAmount: customerPatterns
    },
    popularItems: {
      monthly: {},  // To be implemented
      overall: itemPopularity
    },
    cashFlow: {
      predicted: {},  // To be implemented
      actual: monthlyTrends
    }
  };

  localStorage.setItem(STORAGE_KEYS.BUSINESS_ANALYTICS, JSON.stringify(analytics));
  return analytics;
};

export const saveBill = (bill: Omit<Bill, 'id' | 'createdAt'>): Bill => {
  const bills = getBills();
  const newBill: Bill = {
    ...bill,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  bills.push(newBill);
  localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  // Dispatch storage event for other components
  window.dispatchEvent(new Event('storage'));
  return newBill;
};

export const updateBill = (billId: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>): Bill | null => {
  const bills = getBills();
  const index = bills.findIndex(b => b.id === billId);
  if (index === -1) return null;
  const oldBill = bills[index];
  const updated: Bill = {
    ...oldBill,
    ...updates,
  };
  bills[index] = updated;
  localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  return updated;
};

export const deleteBill = (billId: string): void => {
  const bills = getBills();
  const bill = bills.find(b => b.id === billId);
  if (bill) {
    try {
      // Direct localStorage manipulation to avoid circular dependency
      const recycleBin = JSON.parse(localStorage.getItem('recycle_bin') || '[]');
      const recycledItem = {
        id: uuidv4(),
        type: 'bill',
        data: bill,
        deletedAt: new Date().toISOString(),
        displayName: `Bill #${billId.slice(-6)} - ${bill.customerName} - ₹${bill.grandTotal}`,
      };
      recycleBin.push(recycledItem);
      localStorage.setItem('recycle_bin', JSON.stringify(recycleBin));
    } catch (error) {
      console.error('Error adding bill to recycle bin:', error);
      // Don't throw error - allow deletion to proceed even if recycle bin fails
    }
  }
  const updatedBills = bills.filter(b => b.id !== billId);
  localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(updatedBills));
  window.dispatchEvent(new Event('storage'));
};

export const savePayment = (payment: Omit<Payment, 'id' | 'createdAt'>): Payment => {
  const payments = getPayments();
  const newPayment: Payment = {
    ...payment,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  payments.push(newPayment);
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  return newPayment;
};

export const recordPayment = (customerId: string, customerName: string, amount: number): Payment => {
  return savePayment({
    customerId,
    customerName,
    amount,
    date: new Date().toISOString(),
  });
};

export const getPaymentHistory = (): Payment[] => {
  return getPayments().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const deletePayment = (paymentId: string): void => {
  const payments = getPayments();
  const payment = payments.find(p => p.id === paymentId);
  if (payment) {
    try {
      // Direct localStorage manipulation to avoid circular dependency
      const recycleBin = JSON.parse(localStorage.getItem('recycle_bin') || '[]');
      const recycledItem = {
        id: uuidv4(),
        type: 'payment',
        data: payment,
        deletedAt: new Date().toISOString(),
        displayName: `Payment - ${payment.customerName} - ₹${payment.amount}`,
      };
      recycleBin.push(recycledItem);
      localStorage.setItem('recycle_bin', JSON.stringify(recycleBin));
    } catch (error) {
      console.error('Error adding payment to recycle bin:', error);
      // Don't throw error - allow deletion to proceed even if recycle bin fails
    }
  }
  const updatedPayments = payments.filter(p => p.id !== paymentId);
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(updatedPayments));
  window.dispatchEvent(new Event('storage'));
};

export const updatePayment = (paymentId: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>): Payment | null => {
  const payments = getPayments();
  const index = payments.findIndex(p => p.id === paymentId);
  if (index === -1) return null;
  const old = payments[index];
  const updated: Payment = { ...old, ...updates };
  payments[index] = updated;
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  return updated;
};

// Balance calculations
export const getCustomerBalance = (customerId: string): CustomerBalance => {
  const bills = getBills().filter(bill => bill.customerId === customerId);
  const payments = getPayments().filter(payment => payment.customerId === customerId);
  const customer = getCustomers().find(c => c.id === customerId);
  
  const totalSales = bills.reduce((sum, bill) => sum + bill.grandTotal, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  return {
    customerId,
    customerName: customer?.name || 'Unknown',
    totalSales,
    totalPaid,
    pending: totalSales - totalPaid,
  };
};

// Get bills by customer
export const getBillsByCustomer = (customerId: string): Bill[] => {
  return getBills().filter(bill => bill.customerId === customerId);
};

// Optimized version for 300+ customers - single pass through bills/payments
export const getAllCustomerBalances = (): CustomerBalance[] => {
  const customers = getCustomers();
  const bills = getBills();
  const payments = getPayments();
  
  // Create a map for O(1) lookups instead of O(n) for each customer
  const customerMap = new Map<string, { name: string; totalSales: number; totalPaid: number }>();
  
  // Initialize all customers
  customers.forEach(customer => {
    customerMap.set(customer.id, {
      name: customer.name,
      totalSales: 0,
      totalPaid: 0,
    });
  });
  
  // Single pass through all bills
  bills.forEach(bill => {
    const customer = customerMap.get(bill.customerId);
    if (customer) {
      customer.totalSales += bill.grandTotal;
    }
  });
  
  // Single pass through all payments
  payments.forEach(payment => {
    const customer = customerMap.get(payment.customerId);
    if (customer) {
      customer.totalPaid += payment.amount;
    }
  });
  
  // Convert map to array
  return Array.from(customerMap.entries()).map(([customerId, data]) => ({
    customerId,
    customerName: data.name,
    totalSales: data.totalSales,
    totalPaid: data.totalPaid,
    pending: data.totalSales - data.totalPaid,
  }));
};

// Item Master management
export const getItems = (): ItemMaster[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
  return data ? JSON.parse(data) : [];
};

export const saveItem = (item: Omit<ItemMaster, 'id' | 'createdAt' | 'updatedAt'>): ItemMaster => {
  const items = getItems();
  const normalizedNewName = item.name.trim().toLowerCase();
  const isDuplicate = items.some(existing => existing.name.trim().toLowerCase() === normalizedNewName);
  if (isDuplicate) {
    throw new Error('DUPLICATE_ITEM_NAME');
  }
  const newItem: ItemMaster = {
    ...item,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(newItem);
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  return newItem;
};

export const updateItem = (itemId: string, updates: Partial<Omit<ItemMaster, 'id' | 'createdAt'>>): ItemMaster | null => {
  const items = getItems();
  const itemIndex = items.findIndex(item => item.id === itemId);
  
  if (itemIndex === -1) return null;
  
  const oldItem = items[itemIndex];
  
  // Track rate history if rate is changing
  if (updates.rate && oldItem.rate && updates.rate !== oldItem.rate) {
    saveRateHistory({
      itemId,
      oldRate: oldItem.rate,
      newRate: updates.rate,
    });
  }
  
  const updatedItem = {
    ...oldItem,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  items[itemIndex] = updatedItem;
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  return updatedItem;
};

export const deleteItem = (itemId: string): void => {
  const items = getItems();
  const item = items.find(i => i.id === itemId);
  if (item) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { addToRecycleBin } = require('./recycle-bin');
    addToRecycleBin('customer', item as any, `Item - ${item.name}`);
  }
  const updatedItems = items.filter(i => i.id !== itemId);
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(updatedItems));
  window.dispatchEvent(new Event('storage'));
};

export const getItemById = (itemId: string): ItemMaster | null => {
  const items = getItems();
  return items.find(item => item.id === itemId) || null;
};

// Item rate history
export const getRateHistory = (): ItemRateHistory[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ITEM_RATE_HISTORY);
  return data ? JSON.parse(data) : [];
};

export const saveRateHistory = (history: Omit<ItemRateHistory, 'id' | 'changedAt'>): ItemRateHistory => {
  const histories = getRateHistory();
  const newHistory: ItemRateHistory = {
    ...history,
    id: Date.now().toString(),
    changedAt: new Date().toISOString(),
  };
  histories.push(newHistory);
  localStorage.setItem(STORAGE_KEYS.ITEM_RATE_HISTORY, JSON.stringify(histories));
  return newHistory;
};

export const getRateHistoryForItem = (itemId: string): ItemRateHistory[] => {
  return getRateHistory()
    .filter(history => history.itemId === itemId)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
};

// Item analytics
export const getItemUsageAnalytics = (): ItemUsage[] => {
  const bills = getBills();
  const items = getItems();
  const itemUsageMap = new Map<string, ItemUsage>();

  // Initialize all items
  items.forEach(item => {
    itemUsageMap.set(item.id, {
      itemId: item.id,
      itemName: item.name,
      usageCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
    });
  });

  // Calculate usage from bills
  bills.forEach(bill => {
    bill.items.forEach(billItem => {
      // Try to find matching item by name (legacy support)
      const matchingItem = items.find(item => 
        item.name.toLowerCase() === billItem.itemName.toLowerCase()
      );
      
      if (matchingItem) {
        const usage = itemUsageMap.get(matchingItem.id);
        if (usage) {
          usage.usageCount += 1;
          usage.totalQuantity += billItem.quantity;
          usage.totalRevenue += billItem.total;
        }
      } else {
        // Create entry for items not in master (legacy items)
        const existingLegacy = Array.from(itemUsageMap.values()).find(
          usage => usage.itemName.toLowerCase() === billItem.itemName.toLowerCase()
        );
        
        if (!existingLegacy) {
          itemUsageMap.set(`legacy_${billItem.itemName}`, {
            itemId: `legacy_${billItem.itemName}`,
            itemName: billItem.itemName,
            usageCount: 1,
            totalQuantity: billItem.quantity,
            totalRevenue: billItem.total,
          });
        } else {
          existingLegacy.usageCount += 1;
          existingLegacy.totalQuantity += billItem.quantity;
          existingLegacy.totalRevenue += billItem.total;
        }
      }
    });
  });

  return Array.from(itemUsageMap.values())
    .sort((a, b) => b.usageCount - a.usageCount);
};

export const getMostUsedItems = (limit: number = 10): ItemUsage[] => {
  return getItemUsageAnalytics().slice(0, limit);
};

export const searchItems = (query: string): ItemMaster[] => {
  if (!query.trim()) return getItems();
  
  const items = getItems();
  const searchTerm = query.toLowerCase();
  
  return items.filter(item =>
    item.name.toLowerCase().includes(searchTerm)
  ).sort((a, b) => {
    // Prioritize exact matches
    const aStartsWith = a.name.toLowerCase().startsWith(searchTerm);
    const bStartsWith = b.name.toLowerCase().startsWith(searchTerm);
    
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    
    return a.name.localeCompare(b.name);
  });
};