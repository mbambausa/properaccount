// src/utils/cache.ts
/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  
  set(key: string, value: T, ttlSeconds = 300): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000
    });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Clean up expired entries
  prune(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const apiCache = new Cache<any>();
export const reportCache = new Cache<any>();