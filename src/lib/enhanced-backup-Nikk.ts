import { Filesystem, Directory } from '@capacitor/filesystem';
import { Bill, Customer, Payment, ItemMaster, ItemRateHistory } from '@/types';
import { 
  getCustomers, 
  getBills, 
  getPayments, 
  getItems, 
  getRateHistory, 
  getBusinessAnalytics
} from './storage';

import { format } from 'date-fns';

// Filesystem directory constant removed, using Directory.Cache
const MAX_LOCAL_BACKUPS = 5;

// Enhanced backup data structure
interface EnhancedBackupData {
  version: string;
  timestamp: string;
  data: {
    customers: Customer[];
    bills: Bill[];
    payments: Payment[];
    items: ItemMaster[];
    itemRateHistory: ItemRateHistory[];
    businessAnalytics: any;
  };
  metadata: {
    checksum: string;
    counts: {
      customers: number;
      bills: number;
      payments: number;
      items: number;
      itemRateHistory: number;
    };
    totalAmount: {
      billed: number;
      paid: number;
      outstanding: number;
    };
    dateRange: {
      firstBill: string;
      lastBill: string;
      firstPayment: string;
      lastPayment: string;
    };
  };
}

// Function to calculate checksum
const calculateChecksum = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// Function to get all data with validation
const getAllData = () => {
  const customers = getCustomers();
  const bills = getBills();
  const payments = getPayments();
  const items = getItems();
  const itemRateHistory = getRateHistory();
  const businessAnalytics = getBusinessAnalytics();

  // Validate data relationships
  const customerIds = new Set(customers.map(c => c.id));
  // itemIds validation removed - not currently used

  // Validate bills have valid customer references
  const validBills = bills.filter(bill => customerIds.has(bill.customerId));
  if (validBills.length !== bills.length) {
    console.warn(`Found ${bills.length - validBills.length} bills with invalid customer references`);
  }

  // Validate payments have valid customer references
  const validPayments = payments.filter(payment => customerIds.has(payment.customerId));
  if (validPayments.length !== payments.length) {
    console.warn(`Found ${payments.length - validPayments.length} payments with invalid customer references`);
  }

  return {
    customers,
    validBills,
    validPayments,
    items,
    itemRateHistory,
    businessAnalytics
  };
};

// Function to calculate metadata
const calculateMetadata = (data: ReturnType<typeof getAllData>) => {
  const totalBilled = data.validBills.reduce((sum, bill) => sum + bill.grandTotal, 0);
  const totalPaid = data.validPayments.reduce((sum, payment) => sum + payment.amount, 0);
  
  const billDates = data.validBills.map(b => new Date(b.date));
  const paymentDates = data.validPayments.map(p => new Date(p.date));
  
  return {
    counts: {
      customers: data.customers.length,
      bills: data.validBills.length,
      payments: data.validPayments.length,
      items: data.items.length,
      itemRateHistory: data.itemRateHistory.length
    },
    totalAmount: {
      billed: totalBilled,
      paid: totalPaid,
      outstanding: totalBilled - totalPaid
    },
    dateRange: {
      firstBill: billDates.length ? format(new Date(Math.min(...billDates.map(d => d.getTime()))), 'yyyy-MM-dd') : '',
      lastBill: billDates.length ? format(new Date(Math.max(...billDates.map(d => d.getTime()))), 'yyyy-MM-dd') : '',
      firstPayment: paymentDates.length ? format(new Date(Math.min(...paymentDates.map(d => d.getTime()))), 'yyyy-MM-dd') : '',
      lastPayment: paymentDates.length ? format(new Date(Math.max(...paymentDates.map(d => d.getTime()))), 'yyyy-MM-dd') : ''
    }
  };
};

// Enhanced backup creation function
export const createEnhancedBackup = async () => {
  try {
    // Get and validate all data
    const allData = getAllData();
    
    // Create backup object with all data
    const backup: EnhancedBackupData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      data: {
        customers: allData.customers,
        bills: allData.validBills,
        payments: allData.validPayments,
        items: allData.items,
        itemRateHistory: allData.itemRateHistory,
        businessAnalytics: allData.businessAnalytics
      },
      metadata: {
        checksum: '',
        ...calculateMetadata(allData)
      }
    };

    // Calculate checksum after preparing the data
    const backupString = JSON.stringify(backup.data);
    backup.metadata.checksum = calculateChecksum(backupString);

    // Save backup with metadata
    const fileName = `enhanced_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`;
    await Filesystem.writeFile({
      path: fileName,
      data: JSON.stringify(backup),
      directory: Directory.Cache
    });

    // Clean up old backups
    await cleanupOldBackups();

    return {
      success: true,
      message: 'Enhanced backup created successfully',
      metadata: backup.metadata
    };
  } catch (error) {
    console.error('Enhanced backup creation failed:', error);
    return {
      success: false,
      message: 'Failed to create enhanced backup',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Enhanced restore function
export const restoreFromEnhancedBackup = async (backupFilePath: string) => {
  try {
    const { data: backupContent } = await Filesystem.readFile({
      path: backupFilePath,
      directory: Directory.Cache
    });

    const backup: EnhancedBackupData = JSON.parse(backupContent.toString());

    // Validate backup structure and checksum
    const calculatedChecksum = calculateChecksum(JSON.stringify(backup.data));
    if (calculatedChecksum !== backup.metadata.checksum) {
      throw new Error('Backup checksum validation failed');
    }

    // Store all data
    localStorage.setItem('prakash_customers', JSON.stringify(backup.data.customers));
    localStorage.setItem('prakash_bills', JSON.stringify(backup.data.bills));
    localStorage.setItem('prakash_payments', JSON.stringify(backup.data.payments));
    localStorage.setItem('prakash_items', JSON.stringify(backup.data.items));
    localStorage.setItem('prakash_item_rate_history', JSON.stringify(backup.data.itemRateHistory));
    localStorage.setItem('prakash_business_analytics', JSON.stringify(backup.data.businessAnalytics));

    // Trigger storage event for components to refresh
    window.dispatchEvent(new Event('storage'));

    return {
      success: true,
      message: 'Backup restored successfully',
      metadata: backup.metadata
    };
  } catch (error) {
    console.error('Backup restoration failed:', error);
    return {
      success: false,
      message: 'Failed to restore backup',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Function to clean up old backups
const cleanupOldBackups = async () => {
  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache
    });

    // Sort backups by date (newest first)
    const backups = result.files
      .filter(file => file.name.startsWith('enhanced_backup_'))
      .sort((a, b) => b.name.localeCompare(a.name));

    // Remove excess backups
    for (let i = MAX_LOCAL_BACKUPS; i < backups.length; i++) {
      await Filesystem.deleteFile({
        path: backups[i].name,
        directory: Directory.Cache
      });
    }
  } catch (error) {
    console.error('Cleanup of old backups failed:', error);
  }
};

// Function to list available backups
export const listAvailableBackups = async () => {
  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache
    });

    const backups = await Promise.all(
      result.files
        .filter(file => file.name.startsWith('enhanced_backup_'))
        .map(async (file) => {
          try {
            const { data } = await Filesystem.readFile({
              path: file.name,
              directory: Directory.Cache
            });
            const backup: EnhancedBackupData = JSON.parse(data.toString());
            return {
              fileName: file.name,
              timestamp: backup.timestamp,
              metadata: backup.metadata
            };
          } catch {
            return null;
          }
        })
    );

    return backups.filter((backup): backup is NonNullable<typeof backup> => backup !== null)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
};