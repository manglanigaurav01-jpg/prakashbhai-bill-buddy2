import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
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
 * Creates a comprehensive backup of all app data and saves to local storage
 */
export const createBackup = async (forceShare: boolean = false): Promise<BackupResult> => {
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
      const base64Data = await blobToBase64(blob);

      try {
        // Save to Documents directory (user-accessible)
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Documents
        });

        console.log('Backup saved successfully to Documents:', fileUri.uri);

        return {
          success: true,
          message: `Backup saved to Documents folder!\n\nFile: ${fileName}\n\nLocation: Documents/${fileName}`,
          filePath: fileUri.uri
        };
      } catch (error) {
        console.error('Failed to save to Documents, trying Cache:', error);
        
        // Fallback: Try Cache directory
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });

          const fileUri = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache
          });

          return {
            success: true,
            message: `Backup saved to Cache folder!\n\nFile: ${fileName}`,
            filePath: fileUri.uri
          };
        } catch (cacheError) {
          console.error('Cache save also failed:', cacheError);
          throw new Error('Failed to save backup to device storage');
        }
      }
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
      message: `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
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

    // Restore core data
    localStorage.setItem('prakash_customers', JSON.stringify(backupData.customers));
    localStorage.setItem('prakash_bills', JSON.stringify(backupData.bills));
    localStorage.setItem('prakash_payments', JSON.stringify(backupData.payments));

    // Restore items
    const restoredItems = backupData.items || [];
    const itemsFromBills: ItemMaster[] = [];
    const existingItemNames = new Set(restoredItems.map(item => item.name.toLowerCase()));

    backupData.bills.forEach(bill => {
      bill.items.forEach(billItem => {
        const itemName = billItem.itemName.trim();
        const itemNameLower = itemName.toLowerCase();

        if (!existingItemNames.has(itemNameLower)) {
          const newItem: ItemMaster = {
            id: `restored_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: itemName,
            type: 'variable',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          itemsFromBills.push(newItem);
          existingItemNames.add(itemNameLower);
        }
      });
    });

    const allItems = [...restoredItems, ...itemsFromBills];
    localStorage.setItem('prakash_items', JSON.stringify(allItems));

    if (backupData.itemRateHistory) {
      localStorage.setItem('prakash_item_rate_history', JSON.stringify(backupData.itemRateHistory));
    }

    if (backupData.businessAnalytics) {
      localStorage.setItem('prakash_business_analytics', JSON.stringify(backupData.businessAnalytics));
    }

    if (backupData.recycleBin) {
      localStorage.setItem('recycle_bin', JSON.stringify(backupData.recycleBin));
    }

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