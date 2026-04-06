import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getCustomers, getBills, getPayments, getAllCustomerBalances, getItems, getRateHistory, getBusinessAnalytics } from './storage';
import { getRecycleBin } from './recycle-bin';
import { Customer, Bill, Payment, CustomerBalance, ItemMaster, ItemRateHistory, BusinessAnalytics, RecycledItem } from '@/types';
import { BackupEncryptionMeta, decodeBackupPayload } from './backup-encryption';

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
const TEXT_ENCODER = new TextEncoder();

const stripBom = (value: string) => value.replace(/^\uFEFF/, '').trim();
const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const arrayBufferToBinaryString = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

const coerceLegacyBackupData = (value: unknown): BackupData | null => {
  if (!isObject(value)) return null;

  if (
    !Array.isArray(value.customers) ||
    !Array.isArray(value.bills) ||
    !Array.isArray(value.payments) ||
    !Array.isArray(value.lastBalances)
  ) {
    return null;
  }

  const payload: BackupPayload = {
    customers: value.customers as Customer[],
    bills: value.bills as Bill[],
    payments: value.payments as Payment[],
    lastBalances: value.lastBalances as CustomerBalance[],
    items: Array.isArray(value.items) ? value.items as ItemMaster[] : [],
    itemRateHistory: Array.isArray(value.itemRateHistory) ? value.itemRateHistory as ItemRateHistory[] : [],
    businessAnalytics: isObject(value.businessAnalytics) ? value.businessAnalytics as BusinessAnalytics : undefined,
    recycleBin: Array.isArray(value.recycleBin) ? value.recycleBin as RecycledItem[] : [],
    dataVersion: typeof value.dataVersion === 'string' ? value.dataVersion : undefined,
    syncStatus: value.syncStatus,
    analysisCache: value.analysisCache,
    lastSync: typeof value.lastSync === 'string' ? value.lastSync : undefined,
    syncConflicts: Array.isArray(value.syncConflicts) ? value.syncConflicts : undefined
  };

  return {
    version: typeof value.version === 'string' ? value.version : BACKUP_VERSION,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    metadata: buildMetadata(payload),
    payload: encodePlainPayload(JSON.stringify(payload))
  };
};

const tryParseBackupData = (value: string): BackupData | null => {
  const normalizedValue = stripBom(value);
  if (!normalizedValue) return null;

  const parseJson = (input: string): BackupData | null => {
    try {
      const parsed = JSON.parse(stripBom(input));
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.version === 'string' &&
        typeof parsed.createdAt === 'string' &&
        typeof parsed.payload === 'string'
      ) {
        return parsed as BackupData;
      }

      return coerceLegacyBackupData(parsed);
    } catch {
      return null;
    }
  };

  const directJson = parseJson(normalizedValue);
  if (directJson) return directJson;

  const withoutNulls = normalizedValue.split('\0').join('');
  if (withoutNulls !== normalizedValue) {
    const nullStrippedJson = parseJson(withoutNulls);
    if (nullStrippedJson) return nullStrippedJson;
  }

  const compactValue = normalizedValue.replace(/\s+/g, '');
  const looksLikeBase64 = compactValue.length > 0 && compactValue.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(compactValue);
  if (looksLikeBase64) {
    try {
      const decoded = atob(compactValue);
      const decodedJson = parseJson(decoded);
      if (decodedJson) return decodedJson;
    } catch {
      return null;
    }
  }

  return null;
};

const encodePlainPayload = (value: string) => arrayBufferToBase64(TEXT_ENCODER.encode(value));

export const readBackupDataFile = async (file: File): Promise<BackupData> => {
  const text = await file.text();
  const directParse = tryParseBackupData(text);
  if (directParse) {
    return directParse;
  }

  const buffer = await file.arrayBuffer();
  const decoders = ['utf-8', 'utf-16le', 'utf-16be'] as const;
  for (const encoding of decoders) {
    try {
      const decoded = new TextDecoder(encoding).decode(buffer);
      const parsed = tryParseBackupData(decoded);
      if (parsed) {
        return parsed;
      }
    } catch {
      // Try the next decoder
    }
  }

  const binaryString = arrayBufferToBinaryString(buffer);
  const binaryParse = tryParseBackupData(binaryString);
  if (binaryParse) {
    return binaryParse;
  }

  const bufferAsBase64 = arrayBufferToBase64(buffer);
  const base64Parse = tryParseBackupData(bufferAsBase64);
  if (base64Parse) {
    return base64Parse;
  }

  throw new Error('Invalid backup file format');
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
  const { mode = 'save' } = options;
  const payload = buildPayload();
  const payloadString = JSON.stringify(payload);
  const cipherText = encodePlainPayload(payloadString);
  const metadata = buildMetadata(payload);

  const backupData: BackupData = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    metadata,
    payload: cipherText
  };

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
    const targetDirectories = mode === 'share'
      ? [Directory.Cache]
      : [Directory.Documents, Directory.Cache];

    for (const directory of targetDirectories) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory,
          encoding: Encoding.UTF8
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
    const backupData = await readBackupDataFile(file);
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
  if (!backupData.encryption) {
    const payloadString = await decodeBackupPayload(backupData.payload);
    return JSON.parse(payloadString);
  }

  try {
    const payloadString = await decodeBackupPayload(backupData.payload, backupData.encryption);
    return JSON.parse(payloadString);
  } catch (error) {
    try {
      const plaintextPayload = await decodeBackupPayload(backupData.payload);
      return JSON.parse(plaintextPayload);
    } catch {
      throw new Error(
        'This backup is encrypted and cannot be opened by this app install. If it was created before uninstalling the old app, the old encryption key was lost.'
      );
    }
  }
};
