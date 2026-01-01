// EncryptedStorage stub (Firebase removed)
export class EncryptedStorage {
  public static async initialize(userId: string): Promise<void> {}
  public static isReady(): boolean { return false; }
  public static async setItem(key: string, value: any): Promise<void> {}
  public static async getItem<T = any>(key: string): Promise<T | null> { return null; }
  public static removeItem(key: string): void {}
  public static clear(): void {}
  public static reset(): void {}
  public static getKeys(): string[] { return []; }
}
