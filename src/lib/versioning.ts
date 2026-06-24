import { parseStoredDateToLocal, toStoredDateISO } from './stored-date';
export interface MigrationContext {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type Migration = {
  version: string; // semver-like sortable string, e.g. '1.0.0'
  up: (ctx: MigrationContext) => void | Promise<void>;
};

const APP_VERSION_KEY = 'app_version_v1';

// Define migrations in ascending chronological order
const migrations: Migration[] = [
  // Example scaffold migration: ensure required keys exist
  {
    version: '1.0.0',
    up: (ctx) => {
      // Ensure arrays are initialized
      const ensureArray = (key: string) => {
        const raw = ctx.getItem(key);
        if (!raw) ctx.setItem(key, '[]');
      };
      ensureArray('prakash_customers');
      ensureArray('prakash_bills');
      ensureArray('prakash_payments');
      ensureArray('prakash_items');
      ensureArray('prakash_item_rate_history');
    }
  },
  {
    version: '1.1.0',
    up: (ctx) => {
      const normalizeDateField = <T extends { date: string }>(rows: T[]): T[] => {
        return rows.map((row) => ({
          ...row,
          date: toStoredDateISO(parseStoredDateToLocal(row.date)),
        }));
      };

      const rawBills = ctx.getItem('prakash_bills');
      if (rawBills) {
        try {
          const bills = JSON.parse(rawBills);
          if (Array.isArray(bills)) {
            ctx.setItem('prakash_bills', JSON.stringify(normalizeDateField(bills)));
          }
        } catch {
          // Keep existing data untouched if malformed.
        }
      }

      const rawPayments = ctx.getItem('prakash_payments');
      if (rawPayments) {
        try {
          const payments = JSON.parse(rawPayments);
          if (Array.isArray(payments)) {
            ctx.setItem('prakash_payments', JSON.stringify(normalizeDateField(payments)));
          }
        } catch {
          // Keep existing data untouched if malformed.
        }
      }
    },
  },
];

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(n => parseInt(n, 10));
  const pb = b.split('.').map(n => parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};

export const getStoredAppVersion = (): string | null => {
  return localStorage.getItem(APP_VERSION_KEY);
};

export const setStoredAppVersion = (v: string): void => {
  localStorage.setItem(APP_VERSION_KEY, v);
};

export const runMigrationsIfNeeded = async (currentVersion: string): Promise<void> => {
  const ctx: MigrationContext = {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
  };

  const stored = getStoredAppVersion();
  if (!stored) {
    // First run: run all migrations up to current version
    for (const m of migrations) {
      if (compareVersions(m.version, currentVersion) <= 0) {
        await m.up(ctx);
      }
    }
    setStoredAppVersion(currentVersion);
    return;
  }

  // Run only migrations newer than stored version and <= currentVersion
  for (const m of migrations) {
    if (compareVersions(m.version, stored) > 0 && compareVersions(m.version, currentVersion) <= 0) {
      await m.up(ctx);
    }
  }
  setStoredAppVersion(currentVersion);
};


