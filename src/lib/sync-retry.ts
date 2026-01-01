// Cloud sync retry disabled (Firebase removed)
import { delay } from './utils';
import { getCustomers, getBills, getPayments, getItems } from './storage';

interface LocalSnapshot {
  customers: any[];
  bills: any[];
  payments: any[];
  items: any[];
  timestamp: string;
}

interface CloudUser {
  provider: string;
  userId: string;
  displayName: string;
  email: string;
}

const buildLocalSnapshot = async (): Promise<LocalSnapshot> => {
  return {
    customers: getCustomers(),
    bills: getBills(),
    payments: getPayments(),
    items: getItems(),
    timestamp: new Date().toISOString()
  };
};

interface SyncResult {
  success: boolean;
  message: string;
  error?: Error;
}

export const checkNetworkStatus = async (): Promise<boolean> => {
  return false; // Always offline since cloud sync is disabled
};

export const checkPermissions = async (user: CloudUser): Promise<boolean> => {
  return false;
};

export const syncWithRetry = async (
  user: CloudUser,
  direction: 'push' | 'pull'
): Promise<SyncResult> => {
  return {
    success: false,
    message: 'Cloud sync disabled - Firebase removed'
  };
};
