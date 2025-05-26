// src/utils/storage.ts
/**
 * Type-safe localStorage wrapper
 */

export class Storage {
  private prefix: string;
  
  constructor(prefix = 'properaccount_') {
    this.prefix = prefix;
  }
  
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }
  
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(this.getKey(key));
      return item ? JSON.parse(item) : (defaultValue ?? null);
    } catch {
      return defaultValue ?? null;
    }
  }
  
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (e) {
      console.error('Storage.set error:', e);
    }
  }
  
  remove(key: string): void {
    localStorage.removeItem(this.getKey(key));
  }
  
  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k));
  }
}

export const storage = new Storage();
export const sessionStorage = new Storage('properaccount_session_');