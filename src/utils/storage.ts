// src/utils/storage.ts
/**
 * Type-safe Web Storage (localStorage or sessionStorage) wrapper.
 * This utility is client-side only as it interacts with browser storage APIs.
 */

export type WebStorageType = 'localStorage' | 'sessionStorage';

export class Storage {
  private prefix: string;
  private store: globalThis.Storage; // Use globalThis.Storage for type, will be window.localStorage/sessionStorage

  /**
   * Creates a new Storage instance.
   * @param storageType Specifies whether to use 'localStorage' or 'sessionStorage'. Defaults to 'localStorage'.
   * @param prefix A prefix to be added to all keys to avoid collisions. Defaults to 'properaccount_'.
   */
  constructor(storageType: WebStorageType = 'localStorage', prefix = 'properaccount_') {
    this.prefix = prefix;
    
    if (typeof window === 'undefined') {
      // Provide a mock storage for SSR or non-browser environments to prevent errors,
      // though data won't persist.
      console.warn(`Storage utility initialized in a non-browser environment. Data will not persist.`);
      this.store = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };
    } else {
      this.store = window[storageType];
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Retrieves an item from storage and parses it as JSON.
   * @param key The key of the item to retrieve.
   * @param defaultValue Optional default value to return if the item is not found or parsing fails.
   * @returns The parsed item, the default value, or null.
   */
  get<T>(key: string, defaultValue?: T): T | null {
    if (typeof window === 'undefined') return defaultValue ?? null;
    try {
      const item = this.store.getItem(this.getKey(key));
      return item ? (JSON.parse(item) as T) : (defaultValue !== undefined ? defaultValue : null);
    } catch (error) {
      console.warn(`Storage.get: Error parsing item with key "${key}". Returning default value.`, error);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * Stores an item in storage after serializing it to JSON.
   * @param key The key to store the item under.
   * @param value The value to store.
   */
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      if (value === undefined) { // Don't store undefined, effectively a remove.
        this.remove(key);
      } else {
        this.store.setItem(this.getKey(key), JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Storage.set: Error setting item with key "${key}". This might be due to storage quota exceeded.`, error);
      // Potentially add more robust error handling or reporting here if quota issues are common.
    }
  }

  /**
   * Removes an item from storage.
   * @param key The key of the item to remove.
   */
  remove(key: string): void {
    if (typeof window === 'undefined') return;
    this.store.removeItem(this.getKey(key));
  }

  /**
   * Clears all items from storage that match the instance's prefix.
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    // Iterate and remove only prefixed keys to avoid clearing unrelated localStorage items.
    for (let i = this.store.length - 1; i >= 0; i--) {
      const key = this.store.key(i);
      if (key && key.startsWith(this.prefix)) {
        this.store.removeItem(key);
      }
    }
  }

  /**
   * Checks if a key exists in storage.
   * @param key The key to check.
   * @returns True if the key exists, false otherwise.
   */
  has(key: string): boolean {
    if (typeof window === 'undefined') return false;
    return this.store.getItem(this.getKey(key)) !== null;
  }
}

/**
 * Pre-configured instance for using localStorage with the default application prefix.
 * Data persists until explicitly deleted or browser data is cleared.
 */
export const appLocalStorage = new Storage('localStorage', 'properaccount_local_');

/**
 * Pre-configured instance for using sessionStorage with the default application prefix.
 * Data persists only for the duration of the page session (until the browser tab is closed).
 */
export const appSessionStorage = new Storage('sessionStorage', 'properaccount_session_');