/**
 * Storage Migration Utility
 *
 * Migrates existing unencrypted localStorage data to encrypted storage.
 * This is a one-time migration that preserves all existing data.
 *
 * Usage:
 * ```typescript
 * import { StorageMigration } from '@/lib/storage-migration';
 *
 * // Check if migration is needed
 * if (StorageMigration.isMigrationNeeded()) {
 *   // Run migration after user authentication
 *   await StorageMigration.migrateToEncryptedStorage('user123');
 *   StorageMigration.markMigrationComplete();
 * }
 * ```
 */

import { EncryptedStorage } from './encrypted-storage';

export class StorageMigration {
  private static readonly MIGRATION_KEY = 'storage_migration_completed';
  private static readonly KEYS_TO_MIGRATE = [
    'prakash_customers',
    'prakash_bills',
    'prakash_payments'
  ];

  /**
   * Check if migration is needed
   * Returns true if migration hasn't been completed and old data exists
   */
  public static isMigrationNeeded(): boolean {
    // Check if migration already completed
    const migrationCompleted = localStorage.getItem(StorageMigration.MIGRATION_KEY);
    if (migrationCompleted === 'true') {
      return false;
    }

    // Check if any old unencrypted data exists
    return StorageMigration.KEYS_TO_MIGRATE.some(key => {
      const data = localStorage.getItem(key);
      return data !== null && data !== '';
    });
  }

  /**
   * Migrate existing localStorage data to encrypted storage
   * @param userId User ID for encryption initialization
   */
  public static async migrateToEncryptedStorage(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required for migration');
    }

    try {
      // Initialize encrypted storage
      await EncryptedStorage.initialize(userId);

      console.log('Starting storage migration...');

      for (const key of StorageMigration.KEYS_TO_MIGRATE) {
        const oldData = localStorage.getItem(key);

        if (oldData) {
          try {
            // Parse and migrate the data
            const parsedData = JSON.parse(oldData);
            await EncryptedStorage.setItem(key, parsedData);

            // Remove old unencrypted data
            localStorage.removeItem(key);

            console.log(`Migrated ${key} to encrypted storage`);
          } catch (parseError) {
            console.error(`Failed to parse data for ${key}:`, parseError);
            // Skip this key but continue with others
          }
        }
      }

      console.log('Storage migration completed successfully');
    } catch (error) {
      console.error('Storage migration failed:', error);
      throw new Error(`Migration failed: ${error}`);
    }
  }

  /**
   * Mark migration as completed
   * Call this after successful migration
   */
  public static markMigrationComplete(): void {
    localStorage.setItem(StorageMigration.MIGRATION_KEY, 'true');
  }

  /**
   * Reset migration status (useful for testing or forced re-migration)
   */
  public static resetMigrationStatus(): void {
    localStorage.removeItem(StorageMigration.MIGRATION_KEY);
  }

  /**
   * Get migration status
   */
  public static getMigrationStatus(): {
    completed: boolean;
    hasOldData: boolean;
    keysWithData: string[];
  } {
    const completed = localStorage.getItem(StorageMigration.MIGRATION_KEY) === 'true';

    const keysWithData = StorageMigration.KEYS_TO_MIGRATE.filter(key => {
      const data = localStorage.getItem(key);
      return data !== null && data !== '';
    });

    return {
      completed,
      hasOldData: keysWithData.length > 0,
      keysWithData
    };
  }
}
