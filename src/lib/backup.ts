import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getCustomers, getBills, getPayments, getAllCustomerBalances, getItems, getRateHistory, getBusinessAnalytics } from './storage';
import { getRecycleBin } from './recycle-bin';
import { Customer, Bill, Payment, CustomerBalance, ItemMaster, ItemRateHistory, BusinessAnalytics, RecycledItem } from '@/types';

export interface BackupData {
  version: string;
  createdAt: string;
  customers: Customer[];
  bills: Bill[];
  payments: Payment[];
  lastBalances: CustomerBalance[];
  items?: ItemMaster[];
  itemRateHistory?: ItemRateHistory[];
  businessAnalytics?: BusinessAnalytics;
  recycleBin?: RecycledItem[];
  dataVersion?: string;
  syncStatus?: any;
  analysisCache?: any;
  lastSync?: string;
  syncConflicts?: any[];
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
 * 4. All items from the item master
 * 5. Item rate history
 * 6. Business analytics data
 * 7. Recycle bin data
 * 8. Sync status and metadata
 */
export const createBackup = async (): Promise<BackupResult> => {
  try {
    // Gather all data
    const customers = getCustomers();
    const bills = getBills();
    const payments = getPayments();
    const lastBalances = getAllCustomerBalances();
    const items = getItems();
    const itemRateHistory = getRateHistory();
    const businessAnalytics = getBusinessAnalytics();
    const recycleBin = getRecycleBin();

    // Gather additional metadata
    const dataVersion = localStorage.getItem('prakash_data_version') || '1.0.0';
    const syncStatus = localStorage.getItem('prakash_sync_status');
    const analysisCache = localStorage.getItem('prakash_analysis_cache');
    const lastSync = localStorage.getItem('prakash_last_sync');
    const syncConflicts = localStorage.getItem('prakash_sync_conflicts');

    const backupData: BackupData = {
      version: '3.0',
      createdAt: new Date().toISOString(),
      customers,
      bills,
      payments,
      lastBalances,
      items,
      itemRateHistory,
      businessAnalytics,
      recycleBin,
      dataVersion,
      syncStatus: syncStatus ? JSON.parse(syncStatus) : undefined,
      analysisCache: analysisCache ? JSON.parse(analysisCache) : undefined,
      lastSync: lastSync || undefined,
      syncConflicts: syncConflicts ? JSON.parse(syncConflicts) : undefined
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

    // Validate backup structure (support both old and new backup formats)
    if (!backupData.customers || !backupData.bills || !backupData.payments || !backupData.lastBalances) {
      throw new Error('Invalid backup file structure');
    }

    // Clear existing data and restore from backup
    localStorage.clear();

    // Restore core data (always present)
    localStorage.setItem('prakash_customers', JSON.stringify(backupData.customers));
    localStorage.setItem('prakash_bills', JSON.stringify(backupData.bills));
    localStorage.setItem('prakash_payments', JSON.stringify(backupData.payments));

    // Restore items and rate history (may be empty arrays for older backups)
    let restoredItems = backupData.items || [];

    // Extract items from bills and add them to item master if they don't exist
    // This ensures that items referenced in bills are available in the item master
    const itemsFromBills: ItemMaster[] = [];
    const existingItemNames = new Set(restoredItems.map(item => item.name.toLowerCase()));

    backupData.bills.forEach(bill => {
      bill.items.forEach(billItem => {
        const itemName = billItem.itemName.trim();
        const itemNameLower = itemName.toLowerCase();

        // If this item doesn't exist in the restored items, create it
        if (!existingItemNames.has(itemNameLower)) {
          const newItem: ItemMaster = {
            id: `restored_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: itemName,
            type: 'variable', // Default to variable since we don't know the pricing type
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          itemsFromBills.push(newItem);
          existingItemNames.add(itemNameLower);
        }
      });
    });

    // Combine restored items with items extracted from bills
    const allItems = [...restoredItems, ...itemsFromBills];
    localStorage.setItem('prakash_items', JSON.stringify(allItems));

    if (backupData.itemRateHistory) {
      localStorage.setItem('prakash_item_rate_history', JSON.stringify(backupData.itemRateHistory));
    }

    // Restore business analytics (new in v3.0)
    if (backupData.businessAnalytics) {
      localStorage.setItem('prakash_business_analytics', JSON.stringify(backupData.businessAnalytics));
    }

    // Restore recycle bin data (new in v3.0)
    if (backupData.recycleBin) {
      localStorage.setItem('recycle_bin', JSON.stringify(backupData.recycleBin));
    }

    // Restore metadata (new in v3.0)
    if (backupData.dataVersion) {
      localStorage.setItem('prakash_data_version', backupData.dataVersion);
    }
    if (backupData.syncStatus) {
      localStorage.setItem('prakash_sync_status', JSON.stringify(backupData.syncStatus));
    }
    if (backupData.analysisCache) {
      localStorage.setItem('prakash_analysis_cache', JSON.stringify(backupData.analysisCache));
    }
    if (backupData.lastSync) {
      localStorage.setItem('prakash_last_sync', backupData.lastSync);
    }
    if (backupData.syncConflicts) {
      localStorage.setItem('prakash_sync_conflicts', JSON.stringify(backupData.syncConflicts));
    }

    // Note: lastBalances is computed from bills and payments, so we don't store it directly

    return {
      success: true,
      message: 'Backup restored successfully'
    };
  } catch (error) {
    console.error('Backup restoration failed:', error);
    return {
      success: false,
      message: `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    itemCount: backupData.items?.length || 0,
    totalRevenue: backupData.bills.reduce((sum, bill) => sum + bill.grandTotal, 0),
    totalPayments: backupData.payments.reduce((sum, payment) => sum + payment.amount, 0)
  };
};
