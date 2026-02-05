import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getCustomers, getBills, getPayments, getAllCustomerBalances, getItems, getRateHistory, getBusinessAnalytics } from './storage';
import { getRecycleBin } from './recycle-bin';
import { Customer, Bill, Payment, CustomerBalance, ItemMaster, ItemRateHistory, BusinessAnalytics, RecycledItem } from '@/types';
import { BackupEncryptionMeta, decodeBackupPayload, encryptBackupPayload } from './backup-encryption';

export interface BackupPayload {
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

export interface BackupMetadata {
  customerCount: number;
  billCount: number;
  paymentCount: number;
  itemCount: number;
  totalRevenue: number;
  totalPayments: number;
  lastBalancesCount: number;
}

export interface BackupData {
  version: string;
  createdAt: string;
  metadata: BackupMetadata;
  payload: string;
  encryption?: BackupEncryptionMeta;
}

export type BackupMode = 'save' | 'share';

export interface CreateBackupOptions {
  mode?: BackupMode;
  encrypt?: boolean;
}

export interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
  sharedUri?: string;
  metadata?: BackupMetadata;
}

const BACKUP_VERSION = '3.0';
const BACKUP_FILE_PREFIX = 'billbuddy_backup_';

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

const triggerDownload = (url: string, fileName: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const shareBackupFile = async (uri: string, fileName: string, description: string) => {
  const sharePayload = {
    title: 'Bill Buddy Backup',
    text: `${description}\nFile: ${fileName}`,
    url: uri
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(sharePayload);
    return;
  }

  const { Share } = await import('@capacitor/share');
  await Share.share({
    ...sharePayload,
    dialogTitle: 'Share Backup File'
  });
};

const buildPayload = (): BackupPayload => {
  const customers = getCustomers();
  const bills = getBills();
  const payments = getPayments();
  const lastBalances = getAllCustomerBalances();
  const items = getItems();
  const itemRateHistory = getRateHistory();
  const businessAnalytics = getBusinessAnalytics();
  const recycleBin = getRecycleBin();

  const dataVersion = localStorage.getItem('prakash_data_version') || '1.0.0';
  const syncStatus = localStorage.getItem('prakash_sync_status');
  const analysisCache = localStorage.getItem('prakash_analysis_cache');
  const lastSync = localStorage.getItem('prakash_last_sync');
  const syncConflicts = localStorage.getItem('prakash_sync_conflicts');

  return {
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
};

const buildMetadata = (payload: BackupPayload): BackupMetadata => ({
  customerCount: payload.customers.length,
  billCount: payload.bills.length,
  paymentCount: payload.payments.length,
  itemCount: payload.items?.length || 0,
  totalRevenue: payload.bills.reduce((sum, bill) => sum + bill.grandTotal, 0),
  totalPayments: payload.payments.reduce((sum, payment) => sum + payment.amount, 0),
  lastBalancesCount: payload.lastBalances.length
});

const describeDirectory = (directory: Directory | undefined) => {
  if (directory === Directory.Documents) return 'Documents';
  if (directory === Directory.Cache) return 'Cache';
  return 'Device';
};

export const createBackup = async (options: CreateBackupOptions = {}): Promise<BackupResult> => {
  const { mode = 'save', encrypt = true } = options;
  const payload = buildPayload();
  const payloadString = JSON.stringify(payload);
  const { cipherText, encryption } = await encryptBackupPayload(payloadString);
  const metadata = buildMetadata(payload);

  const backupData: BackupData = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    metadata,
    payload: cipherText
  };

  if (encryption) {
    backupData.encryption = encryption;
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${BACKUP_FILE_PREFIX}${timestamp}.json`;
  const description = `Bill Buddy backup created on ${new Date().toLocaleString()}`;
  const result: BackupResult = {
    success: true,
    message: '',
    metadata
  };

  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    const targetDirectories = mode === 'share'
      ? [Directory.Cache]
      : [Directory.Documents, Directory.Cache];

    for (const directory of targetDirectories) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory
        });

        const locationName = describeDirectory(directory);
        result.filePath = fileUri.uri;
        result.message = `${mode === 'share' ? 'Backup ready to share' : `Backup saved to ${locationName} folder`}.\n\nFile: ${fileName}\nLocation: ${locationName}/${fileName}`;

        if (mode === 'share' && fileUri.uri) {
          try {
            await shareBackupFile(fileUri.uri, fileName, description);
            result.sharedUri = fileUri.uri;
          } catch (shareError) {
            console.warn('Backup share failed:', shareError);
            result.message += `\n\nCould not open share dialog, file saved in ${locationName}`;
          }
        }

        return result;
      } catch (error) {
        console.error('Failed to save backup to', directory, error);
        if (directory === Directory.Documents && mode === 'save') {
          continue; // try cache as fallback
        }
        throw error;
      }
    }

    throw new Error('Failed to save backup to device storage');
  }

  const objectUrl = URL.createObjectURL(blob);
  if (mode === 'share') {
    try {
      await shareBackupFile(objectUrl, fileName, description);
      result.sharedUri = objectUrl;
      result.message = 'Backup shared successfully.';
    } catch (shareError) {
      console.warn('Web share failed, downloading instead:', shareError);
      triggerDownload(objectUrl, fileName);
      result.filePath = objectUrl;
      result.message = 'Backup downloaded (web sharing was not available).';
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    }
    return result;
  }

  triggerDownload(objectUrl, fileName);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  result.filePath = objectUrl;
  result.message = 'Backup downloaded successfully.';
  return result;
};

export const restoreBackup = async (file: File): Promise<BackupResult> => {
  try {
    const text = await file.text();
    const backupData: BackupData = JSON.parse(text);
    const payload = await parseBackupPayload(backupData);

    if (!payload.customers || !payload.bills || !payload.payments || !payload.lastBalances) {
      throw new Error('Invalid backup file structure');
    }

    localStorage.clear();

    localStorage.setItem('prakash_customers', JSON.stringify(payload.customers));
    localStorage.setItem('prakash_bills', JSON.stringify(payload.bills));
    localStorage.setItem('prakash_payments', JSON.stringify(payload.payments));

    const restoredItems = payload.items || [];
    const itemsFromBills: ItemMaster[] = [];
    const existingItemNames = new Set(restoredItems.map(item => item.name.toLowerCase()));

    payload.bills.forEach(bill => {
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

    if (payload.itemRateHistory) {
      localStorage.setItem('prakash_item_rate_history', JSON.stringify(payload.itemRateHistory));
    }

    if (payload.businessAnalytics) {
      localStorage.setItem('prakash_business_analytics', JSON.stringify(payload.businessAnalytics));
    }

    if (payload.recycleBin) {
      localStorage.setItem('recycle_bin', JSON.stringify(payload.recycleBin));
    }

    if (payload.dataVersion) {
      localStorage.setItem('prakash_data_version', payload.dataVersion);
    }
    if (payload.syncStatus) {
      localStorage.setItem('prakash_sync_status', JSON.stringify(payload.syncStatus));
    }
    if (payload.analysisCache) {
      localStorage.setItem('prakash_analysis_cache', JSON.stringify(payload.analysisCache));
    }
    if (payload.lastSync) {
      localStorage.setItem('prakash_last_sync', payload.lastSync);
    }
    if (payload.syncConflicts) {
      localStorage.setItem('prakash_sync_conflicts', JSON.stringify(payload.syncConflicts));
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

export const getBackupInfo = (backupData: BackupData) => {
  const { metadata } = backupData;
  return {
    version: backupData.version,
    createdAt: new Date(backupData.createdAt).toLocaleString(),
    customerCount: metadata.customerCount,
    billCount: metadata.billCount,
    paymentCount: metadata.paymentCount,
    itemCount: metadata.itemCount,
    totalRevenue: metadata.totalRevenue,
    totalPayments: metadata.totalPayments,
    lastBalancesCount: metadata.lastBalancesCount
  };
};

export const parseBackupPayload = async (backupData: BackupData): Promise<BackupPayload> => {
  const payloadString = await decodeBackupPayload(backupData.payload, backupData.encryption);
  return JSON.parse(payloadString);
};
