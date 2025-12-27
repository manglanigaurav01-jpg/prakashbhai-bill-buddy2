# Part 2 Security Implementation Guide

## Overview
This guide covers the implementation of Firestore security rules and encrypted localStorage for the Bill Buddy app.

## Section A: Firestore Security Rules

### Deployment Steps

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase project** (if not already done):
   ```bash
   firebase init
   # Select "Firestore" when prompted
   # Choose your existing Firebase project
   ```

4. **Deploy Firestore rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Test rules locally** (optional):
   ```bash
   firebase emulators:start --only firestore
   ```

### Testing Firestore Rules

1. **Verify in Firebase Console**:
   - Go to Firebase Console > Firestore Database > Rules
   - Confirm rules are deployed and active

2. **Test with authenticated user**:
   - Login to your app
   - Try to read/write data - should work for your user ID

3. **Test with unauthenticated access**:
   - Logout or use incognito mode
   - Try to access Firestore - should be denied

## Section B: Encrypted Storage Integration

### Where to Initialize

Initialize encrypted storage after user authentication:

```typescript
// In your authentication success handler
import { EncryptedStorage } from '@/lib/encrypted-storage';
import { StorageMigration } from '@/lib/storage-migration';

// After successful login
const handleAuthSuccess = async (userId: string) => {
  try {
    // Initialize encryption
    await EncryptedStorage.initialize(userId);

    // Check and run migration if needed
    if (StorageMigration.isMigrationNeeded()) {
      await StorageMigration.migrateToEncryptedStorage(userId);
      StorageMigration.markMigrationComplete();
    }

    console.log('Encrypted storage ready');
  } catch (error) {
    console.error('Failed to setup encrypted storage:', error);
  }
};
```

### When to Run Migration

Run migration check after user authentication but before using any localStorage data:

```typescript
// Example in auth component
useEffect(() => {
  const user = getCurrentUser();
  if (user && !EncryptedStorage.isInitialized()) {
    handleAuthSuccess(user.uid);
  }
}, []);
```

### Code Integration Examples

#### Before (unencrypted localStorage):
```typescript
// Old code
const saveCustomers = (customers: Customer[]) => {
  localStorage.setItem('prakash_customers', JSON.stringify(customers));
};

const getCustomers = (): Customer[] => {
  const data = localStorage.getItem('prakash_customers');
  return data ? JSON.parse(data) : [];
};
```

#### After (encrypted localStorage):
```typescript
// New code
const saveCustomers = async (customers: Customer[]) => {
  if (!EncryptedStorage.isInitialized()) {
    throw new Error('Encrypted storage not initialized');
  }
  await EncryptedStorage.setItem('prakash_customers', customers);
};

const getCustomers = async (): Promise<Customer[]> => {
  if (!EncryptedStorage.isInitialized()) {
    return []; // Or throw error
  }
  const data = await EncryptedStorage.getItem<Customer[]>('prakash_customers');
  return data || [];
};
```

### Replacing localStorage Calls

Update these files to use EncryptedStorage:

1. **src/lib/storage.ts** - Main storage functions
2. **src/lib/auto-backup.ts** - Backup functionality
3. **src/lib/cloud.ts** - Cloud sync functions
4. **src/components/Dashboard.tsx** - Any direct localStorage usage

### Logout Cleanup

Reset encryption on logout:

```typescript
const handleLogout = async () => {
  // Clear encrypted data
  EncryptedStorage.clear();

  // Reset encryption state
  EncryptedStorage.reset();

  // Clear migration status if needed
  StorageMigration.resetMigrationStatus();

  // Proceed with normal logout
  await firebaseSignOut();
};
```

## Testing Instructions

### 1. Test Encryption Works

```typescript
// Test encryption functionality
const testEncryption = async () => {
  await EncryptedStorage.initialize('test-user');

  // Test storing data
  await EncryptedStorage.setItem('test', { message: 'Hello World' });

  // Test retrieving data
  const data = await EncryptedStorage.getItem('test');
  console.log('Retrieved:', data); // Should show { message: 'Hello World' }

  // Test localStorage directly - should be encrypted
  const raw = localStorage.getItem('enc_test');
  console.log('Raw storage:', raw); // Should be gibberish/base64
};
```

### 2. Test Migration Works

```typescript
// Test migration
const testMigration = async () => {
  // Add some test data to old localStorage
  localStorage.setItem('prakash_customers', JSON.stringify([{ id: 1, name: 'Test' }]));

  console.log('Migration needed:', StorageMigration.isMigrationNeeded()); // Should be true

  await StorageMigration.migrateToEncryptedStorage('test-user');
  StorageMigration.markMigrationComplete();

  // Check old data is gone
  const oldData = localStorage.getItem('prakash_customers');
  console.log('Old data removed:', oldData === null); // Should be true

  // Check new encrypted data exists
  const newData = await EncryptedStorage.getItem('prakash_customers');
  console.log('New encrypted data:', newData); // Should show the migrated data
};
```

### 3. Test Firestore Rules

1. **Deploy rules** using the commands above
2. **Test authenticated access**:
   - Login to app
   - Perform read/write operations
   - Should work for your user data
3. **Test unauthenticated access**:
   - Use Firebase Console > Firestore
   - Try to manually add documents
   - Should be denied without authentication

### 4. Integration Testing

1. **Full user flow**:
   - User registers/logs in
   - Migration runs automatically
   - Data is encrypted
   - User can read/write data normally
   - Data persists across sessions
   - Logout clears encrypted data

2. **Error handling**:
   - Test with missing environment variables
   - Test with invalid user IDs
   - Test network failures during sync

## Troubleshooting

### Common Issues

1. **"EncryptedStorage not initialized"**:
   - Ensure `initialize()` is called after authentication
   - Check that user ID is valid

2. **Migration fails**:
   - Check browser console for errors
   - Verify old data exists before migration
   - Ensure user is authenticated

3. **Firestore permission denied**:
   - Verify rules are deployed
   - Check user authentication status
   - Confirm user ID matches document path

### Debug Commands

```typescript
// Check encryption status
console.log('Initialized:', EncryptedStorage.isInitialized());

// Check migration status
console.log('Migration status:', StorageMigration.getMigrationStatus());

// List encrypted keys
console.log('Encrypted keys:', EncryptedStorage.getEncryptedKeys());
```

## Security Notes

- **Key derivation**: Uses PBKDF2 with 100,000 iterations for security
- **Encryption**: AES-GCM with random IV per encryption
- **Storage**: Base64 encoded for localStorage compatibility
- **Isolation**: Each user has their own encryption key
- **Cleanup**: Data is cleared on logout

## Performance Considerations

- Encryption/decryption is async but fast on modern devices
- Migration is one-time and preserves all existing data
- No impact on existing functionality once integrated
