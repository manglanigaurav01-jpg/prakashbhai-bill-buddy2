import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getCustomers, getBills, getPayments, getAllCustomerBalances } from './storage';
import { Customer, Bill, Payment, CustomerBalance } from '@/types';

export interface BackupData {
  version: string;
  createdAt: string;
  customers: Customer[];
  bills: Bill[];
  payments: Payment[];
  lastBalances: CustomerBalance[];
}

export interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
}

/**
 * Creates a comprehensive backup of all app data
 * Stores:
 * 1. All customers with their complete bill history (including edited bills)
 * 2. All payments with dates and payment methods
 * 3. Last balance for all customers
 */
export const createBackup = async (): Promise<BackupResult> => {
  try {
    // Gather all data
    const customers = getCustomers();
    const bills = getBills();
    const payments = getPayments();
    const lastBalances = getAllCustomerBalances();

    const backupData: BackupData = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      customers,
      bills,
      payments,
      lastBalances
    };

    // Convert to JSON
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `billbuddy_backup_${timestamp}.json`;

    if (Capacitor.isNativePlatform()) {
      // Mobile: Save to device storage
      const base64Data = await blobToBase64(blob);

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: 'DOCUMENTS' as Directory
      });

      // Share the file
      const fileUri = await Filesystem.getUri({
        path: fileName,
        directory: 'DOCUMENTS' as Directory
      });

      await Share.share({
        title: 'Bill Buddy Backup',
        text: 'Complete backup of all customer data, bills, payments, and balances',
        url: fileUri.uri,
        dialogTitle: 'Save Backup File'
      });

      return {
        success: true,
        message: 'Backup created and shared successfully',
        filePath: fileUri.uri
      };
    } else {
      // Web: Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        success: true,
        message: 'Backup downloaded successfully'
      };
    }
  } catch (error) {
    console.error('Backup creation failed:', error);
    return {
      success: false,
      message: 'Failed to create backup'
    };
  }
};

/**
 * Restores data from a backup file
 */
export const restoreBackup = async (file: File): Promise<BackupResult> => {
  try {
    const text = await file.text();
    const backupData: BackupData = JSON.parse(text);

    // Validate backup structure
    if (!backupData.customers || !backupData.bills || !backupData.payments || !backupData.lastBalances) {
      throw new Error('Invalid backup file structure');
    }

    // Clear existing data and restore from backup
    localStorage.clear();

    // Restore data
    localStorage.setItem('prakash_customers', JSON.stringify(backupData.customers));
    localStorage.setItem('prakash_bills', JSON.stringify(backupData.bills));
    localStorage.setItem('prakash_payments', JSON.stringify(backupData.payments));

    // Note: lastBalances is computed from bills and payments, so we don't store it directly

    return {
      success: true,
      message: 'Backup restored successfully'
    };
  } catch (error) {
    console.error('Backup restoration failed:', error);
    return {
      success: false,
      message: 'Failed to restore backup'
    };
  }
};

/**
 * Converts a Blob to base64 string
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (data:application/json;base64,)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Gets backup file info for display
 */
export const getBackupInfo = (backupData: BackupData) => {
  return {
    version: backupData.version,
    createdAt: new Date(backupData.createdAt).toLocaleString(),
    customerCount: backupData.customers.length,
    billCount: backupData.bills.length,
    paymentCount: backupData.payments.length,
    totalRevenue: backupData.bills.reduce((sum, bill) => sum + bill.grandTotal, 0),
    totalPayments: backupData.payments.reduce((sum, payment) => sum + payment.amount, 0)
  };
};
