// src/utils/cache.ts
/**
 * Represents an item stored in the cache, including its value and expiration time.
 */
interface CacheItem<T> {
  value: T;
  expires: number; // Timestamp in milliseconds
}

/**
 * Simple in-memory cache with Time-To-Live (TTL) support.
 *
 * IMPORTANT CONTEXT:
 * - Client-Side Usage: When used in a browser, this cache is specific to the user's current
 * browser tab/session and persists as long as the JavaScript context is alive (e.g., page is open).
 * - Server-Side Usage (e.g., Cloudflare Workers): When used in a serverless environment
 * like Cloudflare Workers, this cache is IN-MEMORY AND PER-ISOLATE. This means:
 * - Data is NOT shared across different Worker instances or requests handled by different isolates.
 * - The cache lifetime is tied to the lifecycle of the Worker isolate, which can be short-lived
 * (often just for a single request or a few if the isolate is reused quickly).
 * For persistent, shared caching across serverless function invocations or globally,
 * use a distributed cache like Cloudflare KV. This in-memory cache is suitable server-side
 * ONLY for caching data within the scope of a single request or a very short-lived process
 * where an isolate might handle a burst of related operations.
 */
export class Cache<T = any> { // Default T to any if not specified, like original
  private cache = new Map<string, CacheItem<T>>();

  /**
   * Adds or updates an item in the cache.
   * @param key The key to store the item under.
   * @param value The value to store.
   * @param ttlSeconds Time-to-live in seconds. Defaults to 300 seconds (5 minutes).
   */
  set(key: string, value: T, ttlSeconds = 300): void {
    if (ttlSeconds <= 0) {
      // If TTL is zero or negative, don't store, or treat as immediately expired
      this.cache.delete(key);
      return;
    }
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Retrieves an item from the cache.
   * Returns null if the item is not found or has expired.
   * @param key The key of the item to retrieve.
   * @returns The cached value or null.
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key); // Item has expired, remove it
      return null;
    }

    return item.value;
  }

  /**
   * Removes an item from the cache.
   * @param key The key of the item to remove.
   * @returns True if an item was removed, false otherwise.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all items from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Removes all expired items from the cache.
   * This can be called periodically to free up memory if the cache instance is long-lived.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Checks if a key exists in the cache and has not expired.
   * @param key The key to check.
   * @returns True if the key exists and is valid, false otherwise.
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expires) {
      this.cache.delete(key); // Prune expired item on access
      return false;
    }
    return true;
  }

  /**
   * Returns the number of non-expired items currently in the cache.
   * Note: This will iterate and check expiry, potentially pruning.
   */
  get size(): number {
    this.prune(); // Ensure size reflects only non-expired items
    return this.cache.size;
  }
}

// --- Global Cache Instances ---

/**
 * Global in-memory cache for API responses.
 * See Cache class documentation for important context on its behavior in client-side vs. server-side (Cloudflare Workers) environments.
 * For shared/distributed server-side API caching, consider Cloudflare KV or the Cache API.
 */
export const apiCache = new Cache<any>();

/**
 * Global in-memory cache for report data.
 * See Cache class documentation for important context on its behavior in client-side vs. server-side (Cloudflare Workers) environments.
 * For shared/distributed server-side report caching, consider Cloudflare KV (like your REPORT_CACHE_KV).
 */
export const reportCache = new Cache<any>();

// Example: Periodically prune global caches if this script runs in a long-lived client-side context.
// Not typically needed for serverless functions due to their shorter lifecycle.
// if (typeof window !== 'undefined') {
//   setInterval(() => {
//     apiCache.prune();
//     reportCache.prune();
//   }, 5 * 60 * 1000); // Prune every 5 minutes
// }