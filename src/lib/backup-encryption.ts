// Helpers for encrypting and decrypting backup payloads using Web Crypto

export interface BackupEncryptionMeta {
  algorithm: 'AES-GCM';
  iv: string;
  salt: string;
  version: string;
}

const STORAGE_KEY = 'prakash_backup_encryption_secret';
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const GLOBAL_CRYPTO = globalThis.crypto;

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (b64: string): ArrayBuffer => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const stringToBase64 = (value: string) => toBase64(TEXT_ENCODER.encode(value));
const base64ToString = (value: string) => TEXT_DECODER.decode(fromBase64(value));

const ensureLocalSecret = (): string => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'prakash_backup_fallback_secret';
  }

  let secret = localStorage.getItem(STORAGE_KEY);
  if (!secret) {
    secret = GLOBAL_CRYPTO?.randomUUID ? GLOBAL_CRYPTO.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem(STORAGE_KEY, secret);
  }

  return secret;
};

const getSecret = (): string => {
  const envSecret = import.meta.env.VITE_BACKUP_ENCRYPTION_SECRET;
  if (envSecret) {
    return envSecret;
  }
  return ensureLocalSecret();
};

const getSubtle = () => globalThis.crypto?.subtle;

const deriveKey = async (secret: string, salt: Uint8Array): Promise<CryptoKey> => {
  const subtle = getSubtle();
  if (!subtle) {
    throw new Error('Web Crypto API not available');
  }

  const keyMaterial = await subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 200000,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

const generateRandomBytes = (length: number): Uint8Array => {
  const buffer = new Uint8Array(length);
  if (GLOBAL_CRYPTO?.getRandomValues) {
    GLOBAL_CRYPTO.getRandomValues(buffer);
  } else {
    for (let i = 0; i < length; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return buffer;
};

export const encryptBackupPayload = async (payload: string): Promise<{ cipherText: string; encryption?: BackupEncryptionMeta }> => {
  try {
    const subtle = getSubtle();
    if (!subtle) {
      return { cipherText: stringToBase64(payload) };
    }

    const salt = generateRandomBytes(16);
    const iv = generateRandomBytes(12);
    const key = await deriveKey(getSecret(), salt);
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, TEXT_ENCODER.encode(payload));

    const cipherText = toBase64(encrypted);
    const encryption: BackupEncryptionMeta = {
      algorithm: 'AES-GCM',
      iv: toBase64(iv.buffer),
      salt: toBase64(salt.buffer),
      version: '1.0',
    };

    return { cipherText, encryption };
  } catch (error) {
    console.warn('Backing up without encryption:', error);
    return { cipherText: stringToBase64(payload) };
  }
};

export const decodeBackupPayload = async (payload: string, encryption?: BackupEncryptionMeta): Promise<string> => {
  if (!encryption) {
    return base64ToString(payload);
  }

  try {
    const subtle = getSubtle();
    if (!subtle) {
      throw new Error('Web Crypto API not available');
    }

    const salt = new Uint8Array(fromBase64(encryption.salt));
    const iv = new Uint8Array(fromBase64(encryption.iv));
    const key = await deriveKey(getSecret(), salt);

    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(payload)
    );

    return TEXT_DECODER.decode(decrypted);
  } catch (error) {
    console.warn('Failed to decrypt backup payload, assuming plaintext', error);
    return base64ToString(payload);
  }
};
