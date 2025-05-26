// src/lib/cloudflare/kv.ts
/**
 * KV Storage Helper Utilities
 */
import type { KVNamespace, KVNamespaceListOptions, KVNamespaceListResult, KVNamespaceGetWithMetadataResult } from '@cloudflare/workers-types';

export interface PutKVOptions {
  expirationTtl?: number; // in seconds
  expiration?: number; // timestamp in seconds
  metadata?: Record<string, any>;
}

export type KVGetValueType = 'text' | 'json' | 'arrayBuffer' | 'stream';

export interface GetKVHelperOptions {
  cacheTtl?: number;
}

export async function putKV<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options: PutKVOptions = {}
): Promise<void> {
  const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
  await kv.put(key, valueToStore, options);
}

// Overloads for getKV
export async function getKV(kv: KVNamespace, key: string, options: GetKVHelperOptions & { type: 'text' }): Promise<string | null>;
export async function getKV(kv: KVNamespace, key: string, options: GetKVHelperOptions & { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
export async function getKV(kv: KVNamespace, key: string, options: GetKVHelperOptions & { type: 'stream' }): Promise<ReadableStream | null>;
export async function getKV<T = any>(kv: KVNamespace, key: string, options?: GetKVHelperOptions & { type?: 'json' }): Promise<T | null>;

export async function getKV<T = any>(
  kv: KVNamespace,
  key: string,
  options: GetKVHelperOptions & { type?: KVGetValueType } = {}
): Promise<T | string | ArrayBuffer | ReadableStream | null> {
  const effectiveType = options.type || 'json';
  const { cacheTtl } = options;

  try {
    const rawValue = await kv.get(key, { type: effectiveType as any, cacheTtl });

    if (rawValue === null) {
      return null;
    }

    if (effectiveType === 'json' && typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue) as T;
      } catch (error) {
        console.error(`Error parsing JSON from KV for key "${key}":`, error);
        return null;
      }
    }
    return rawValue as any;
  } catch (error) {
    console.error(`Error retrieving from KV for key "${key}":`, error);
    return null;
  }
}

// Overloads for getWithMetadataKV
export interface GetWithMetadataKVHelperOptions {
  cacheTtl?: number;
}

export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(kv: KVNamespace, key: string, options: GetWithMetadataKVHelperOptions & { type: 'text' }): Promise<{ value: string | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(kv: KVNamespace, key: string, options: GetWithMetadataKVHelperOptions & { type: 'arrayBuffer' }): Promise<{ value: ArrayBuffer | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(kv: KVNamespace, key: string, options: GetWithMetadataKVHelperOptions & { type: 'stream' }): Promise<{ value: ReadableStream | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(kv: KVNamespace, key: string, options?: GetWithMetadataKVHelperOptions & { type?: 'json' }): Promise<{ value: ValueType | null; metadata: MetadataType | null }>;

export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options: GetWithMetadataKVHelperOptions & { type?: KVGetValueType } = {}
): Promise<{ value: ValueType | string | ArrayBuffer | ReadableStream | null; metadata: MetadataType | null }> {
  const effectiveType = options.type || 'json';
  const { cacheTtl } = options;

  try {
    // Cast the specific call to the general type to satisfy TypeScript's strict checking on generics
    const result: KVNamespaceGetWithMetadataResult<any, MetadataType> = await kv.getWithMetadata<any, MetadataType>(key, { type: effectiveType as any, cacheTtl });

    if (effectiveType === 'json') {
      if (typeof result.value === 'string' && result.value !== null) {
        try {
          const parsedValue = JSON.parse(result.value) as ValueType;
          return { value: parsedValue, metadata: result.metadata };
        } catch (e) {
          console.error(`Error parsing string value as JSON (getWithMetadataKV) for key "${key}":`, e);
          return { value: null, metadata: result.metadata };
        }
      }
      // If value is null or not a string, return it as is.
      return { value: result.value, metadata: result.metadata };
    }

    // Return raw value for non-JSON types
    return {
      value: result.value,
      metadata: result.metadata
    };

  } catch (error) {
    console.error(`Error retrieving with metadata from KV for key "${key}":`, error);
    return { value: null, metadata: null };
  }
}

export async function deleteKV(kv: KVNamespace, key: string | string[]): Promise<void> {
  if(Array.isArray(key)) {
    // This is not a standard KV feature, batch delete would need to be implemented manually
    // For now, we iterate.
    await Promise.all(key.map(k => kv.delete(k)));
  } else {
    await kv.delete(key);
  }
}

export async function listKV<M = unknown>(
  kv: KVNamespace,
  options: KVNamespaceListOptions = {}
): Promise<KVNamespaceListResult<M>> {
  return await kv.list<M>(options);
}

// Other helper functions (getOrSetKV, getEntityConfig, etc.) remain the same
export async function getOrSetKV<T>(
  kv: KVNamespace,
  key: string,
  compute: () => Promise<T>,
  options: PutKVOptions = { expirationTtl: 3600 }
): Promise<T> {
  const cached = await getKV<T>(kv, key);
  if (cached !== null) {
    return cached;
  }
  const value = await compute();
  await putKV<T>(kv, key, value, options);
  return value;
}

export async function getEntityConfig<T = Record<string, unknown>>(
  kvConfig: KVNamespace,
  entityId: string
): Promise<T | null> {
  return await getKV<T>(kvConfig, `entity:${entityId}:config`);
}

export async function setEntityConfig<T = Record<string, unknown>>(
  kvConfig: KVNamespace,
  entityId: string,
  config: T
): Promise<void> {
  await putKV(kvConfig, `entity:${entityId}:config`, config);
}

export async function cacheReport<T = unknown>(
  kvReportCache: KVNamespace,
  entityId: string,
  reportType: string,
  period: string,
  data: T
): Promise<void> {
  const key = `entity:${entityId}:report:${reportType}:${period}`;
  await putKV(kvReportCache, key, data, {
    metadata: { generatedAt: new Date().toISOString() },
    expirationTtl: 86400,
  });
}

export async function getCachedReport<T = unknown>(
  kvReportCache: KVNamespace,
  entityId: string,
  reportType: string,
  period: string
): Promise<T | null> {
  const key = `entity:${entityId}:report:${reportType}:${period}`;
  return await getKV<T>(kvReportCache, key);
}

export async function getSession<T = Record<string, unknown>>(
  sessionKv: KVNamespace,
  sessionId: string
): Promise<T | null> {
  return await getKV<T>(sessionKv, `session:${sessionId}`);
}

export async function setSession<T = Record<string, unknown>>(
  sessionKv: KVNamespace,
  sessionId: string,
  sessionData: T,
  expirationTtl: number = 86400
): Promise<void> {
  await putKV(sessionKv, `session:${sessionId}`, sessionData, {
    expirationTtl
  });
}

export async function deleteSession(
  sessionKv: KVNamespace,
  sessionId: string
): Promise<void> {
  await deleteKV(sessionKv, `session:${sessionId}`);
}