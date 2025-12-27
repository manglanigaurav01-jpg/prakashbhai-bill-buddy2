/**
 * Encrypted Storage for Bill Buddy App
 *
 * Provides secure client-side storage using AES encryption
 * with user-specific keys derived from Firebase Auth tokens.
 */

import { getAuth } from 'firebase/auth';

export class EncryptedStorage {
  private static instance: EncryptedStorage | null = null;
  private static userId: string | null = null;
  private static encryptionKey: CryptoKey | null = null;
  private static isInitialized = false;

  private constructor() {}

  /**
   * Initialize encrypted storage for a user
   * Derives encryption key from user's Firebase Auth token
   */
  public static async initialize(userId: string): Promise<void> {
    if (this.isInitialized && this.userId === userId) {
      return; // Already initialized for this user
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get the user's ID token
      const idToken = await user.getIdToken();

      // Derive encryption key from user ID and token
      const keyMaterial = await this.deriveKeyMaterial(userId, idToken);
      this.encryptionKey = await this.deriveEncryptionKey(keyMaterial);

      this.userId = userId;
      this.isInitialized = true;

    } catch (error) {
      console.error('Failed to initialize encrypted storage:', error);
      throw new Error('Failed to initialize secure storage');
    }
  }

  /**
   * Check if encrypted storage is initialized
   */
  public static isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Store encrypted data
   */
  public static async setItem(key: string, value: any): Promise<void> {
    if (!this.isInitialized || !this.encryptionKey) {
      throw new Error('Encrypted storage not initialized');
    }

    try {
      const data = JSON.stringify(value);
      const encrypted = await this.encryptData(data);

      const storageKey = this.getStorageKey(key);
      localStorage.setItem(storageKey, encrypted);
    } catch (error) {
      console.error('Failed to store encrypted data:', error);
      throw new Error('Failed to store data securely');
    }
  }

  /**
   * Retrieve and decrypt data
   */
  public static async getItem<T = any>(key: string): Promise<T | null> {
    if (!this.isInitialized || !this.encryptionKey) {
      throw new Error('Encrypted storage not initialized');
    }

    try {
      const storageKey = this.getStorageKey(key);
      const encrypted = localStorage.getItem(storageKey);

      if (!encrypted) {
        return null;
      }

      const decrypted = await this.decryptData(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to retrieve encrypted data:', error);
      throw new Error('Failed to retrieve data securely');
    }
  }

  /**
   * Remove encrypted data
   */
  public static removeItem(key: string): void {
    if (!this.isInitialized) {
      throw new Error('Encrypted storage not initialized');
    }

    const storageKey = this.getStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  /**
   * Clear all encrypted data for current user
   */
  public static clear(): void {
    if (!this.userId) {
      return;
    }

    // Remove all items with user prefix
    const prefix = `bb_enc_${this.userId}_`;
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Reset encryption state (logout)
   */
  public static reset(): void {
    this.instance = null;
    this.userId = null;
    this.encryptionKey = null;
    this.isInitialized = false;
  }

  /**
   * Get all stored keys for current user
   */
  public static getKeys(): string[] {
    if (!this.userId) {
      return [];
    }

    const prefix = `bb_enc_${this.userId}_`;
    const keys = Object.keys(localStorage);

    return keys
      .filter(key => key.startsWith(prefix))
      .map(key => key.replace(prefix, ''));
  }

  private static async deriveKeyMaterial(userId: string, token: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId + token);

    return await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.digest('SHA-256', data),
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );
  }

  private static async deriveEncryptionKey(keyMaterial: CryptoKey): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32), // Fixed salt for consistency
        info: new Uint8Array(32)
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  }

  private static async decryptData(encryptedData: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt data - invalid key or corrupted data');
    }
  }

  private static getStorageKey(key: string): string {
    if (!this.userId) {
      throw new Error('User ID not set');
    }
    return `bb_enc_${this.userId}_${key}`;
  }
}
