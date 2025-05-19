// src/lib/cloudflare/kv.ts
/**
 * KV Storage Helper Utilities
 */

export interface PutKVOptions {
  expirationTtl?: number; // in seconds
  expiration?: number; // timestamp in seconds
  metadata?: Record<string, any>;
}

export type KVGetValueType = 'text' | 'json' | 'arrayBuffer' | 'stream';

// Options for our getKV helper
export interface GetKVHelperOptions {
  cacheTtl?: number;
}

/**
 * Stores a value in KV storage with optional metadata and expiration
 */
export async function putKV<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options: PutKVOptions = {}
): Promise<void> {
  const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
  await kv.put(key, valueToStore, options);
}

// --- getKV Overloads ---
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
    const baseOptions: { cacheTtl?: number } = {};
    if (cacheTtl !== undefined) {
      baseOptions.cacheTtl = cacheTtl;
    }

    let rawValue: string | ArrayBuffer | ReadableStream | null | undefined;

    // The user's code used explicit type assertions on kv.get itself.
    // The error TS2352: Conversion of type '...' to type '(key: string, options: { type: "arraybuffer", ...}) => ...' may be a mistake
    // This means the assertion like `(kv.get as (key: string, options: { type: 'text', ... }) => ...)` is problematic.
    // The issue seems to be that TS still tries to validate the options against a perceived default overload.
    // Let's simplify and use `as any` on the options if direct typing fails.

    if (effectiveType === 'text') {
      // Line 59 error points to the options object for 'arraybuffer' in user's code.
      // The structure of calls seems to be the pain point.
      // Let's try simpler direct calls and rely on function overloads.
      rawValue = await kv.get(key, { ...baseOptions, type: 'text' } as any);
    } else if (effectiveType === 'arrayBuffer') {
      rawValue = await kv.get(key, { ...baseOptions, type: 'arraybuffer' } as any);
    } else if (effectiveType === 'stream') {
      rawValue = await kv.get(key, { ...baseOptions, type: 'stream' } as any);
    } else { // 'json'
      rawValue = await kv.get(key, { ...baseOptions, type: 'text' } as any); // Fetch as text
    }

    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    if (effectiveType === 'json' && typeof rawValue === 'string') {
      // Error on line 98: Argument of type 'string | null' is not assignable to 'string'.
      // `rawValue` here is confirmed to be `string`.
      try {
        return JSON.parse(rawValue) as T;
      } catch (error) {
        console.error(`Error parsing JSON from KV for key "${key}":`, error);
        return null;
      }
    }
    return rawValue as any; // Return raw value for non-JSON types
  } catch (error) {
    console.error(`Error retrieving from KV for key "${key}":`, error);
    return null;
  }
}

// --- getWithMetadataKV ---
export interface GetWithMetadataKVHelperOptions {
  cacheTtl?: number;
}

export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options: GetWithMetadataKVHelperOptions & { type: 'text' }
): Promise<{ value: string | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options: GetWithMetadataKVHelperOptions & { type: 'arrayBuffer' }
): Promise<{ value: ArrayBuffer | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options: GetWithMetadataKVHelperOptions & { type: 'stream' }
): Promise<{ value: ReadableStream | null; metadata: MetadataType | null }>;
export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options?: GetWithMetadataKVHelperOptions & { type?: 'json' }
): Promise<{ value: ValueType | null; metadata: MetadataType | null }>;

export async function getWithMetadataKV<ValueType = any, MetadataType = Record<string, any>>(
  kv: KVNamespace,
  key: string,
  options: GetWithMetadataKVHelperOptions & { type?: KVGetValueType } = {}
): Promise<{ value: ValueType | string | ArrayBuffer | ReadableStream | null; metadata: MetadataType | null }> {
  const effectiveType = options.type || 'json';
  const { cacheTtl } = options;

  try {
    const baseOptions: { cacheTtl?: number } = {};
    if (cacheTtl !== undefined) {
      baseOptions.cacheTtl = cacheTtl;
    }

    let resultFromKV: KVNamespaceGetWithMetadataResult<any, MetadataType | null >; // Allow MetadataType to be null from KV

    // Errors line 133, 136, 139, 146 (your report): related to options and result assignment.
    // The user code has `result = await (kv.getWithMetadata as (...) => ... )`
    // Let's use `as any` for the options to bypass the strict matching.
    if (effectiveType === 'text') {
      resultFromKV = await kv.getWithMetadata<string, MetadataType>(key, { ...baseOptions, type: 'text' } as any);
    } else if (effectiveType === 'arrayBuffer') {
      resultFromKV = await kv.getWithMetadata<ArrayBuffer, MetadataType>(key, { ...baseOptions, type: 'arraybuffer' } as any);
    } else if (effectiveType === 'stream') {
      resultFromKV = await kv.getWithMetadata<ReadableStream, MetadataType>(key, { ...baseOptions, type: 'stream' } as any);
    } else { // 'json'
      // Attempt to get KV to parse JSON directly.
      // The generic ValueType is what we expect *after* parsing.
      resultFromKV = await kv.getWithMetadata<ValueType, MetadataType>(key, { ...baseOptions, type: 'json' } as any);
    }

    // Error on line 148: This kind of expression is always falsy.
    // `if (typeof result.value === 'string' && !(null as ValueType extends string ? true : false))`
    // This was attempting to check if ValueType is not string. A simpler check is if result.value is string when we expected JSON.
    if (effectiveType === 'json' && typeof resultFromKV.value === 'string' && resultFromKV.value !== null) {
        // This means type: 'json' call might have returned a string (e.g., if KV couldn't parse or ValueType generic was string)
        // We should try to parse it if ValueType isn't supposed to be string.
        // This check is tricky without knowing if ValueType itself could be string.
        // For simplicity, if we asked for JSON and got a string, we attempt to parse.
        try {
            const parsedValue = JSON.parse(resultFromKV.value) as ValueType;
            return { value: parsedValue, metadata: resultFromKV.metadata };
        } catch (e) {
            console.error(`Error parsing string value as JSON (getWithMetadataKV type: 'json') for key "${key}":`, e);
            return { value: null, metadata: resultFromKV.metadata };
        }
    }

    // If resultFromKV.value is null or already parsed by KV (for type:'json'), or it's for other types
    return {
      value: resultFromKV.value as ValueType | string | ArrayBuffer | ReadableStream | null, // Cast the value part
      metadata: resultFromKV.metadata // This should be MetadataType | null
    };

  } catch (error) {
    console.error(`Error retrieving with metadata from KV for key "${key}":`, error);
    return { value: null, metadata: null };
  }
}

// ... rest of the file (deleteKV, listKV, etc.) from previous correct version ...
export async function deleteKV(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key); // Reverted from [key]
}

export async function listKV<M = unknown>(
  kv: KVNamespace,
  options: KVNamespaceListOptions = {}
): Promise<KVNamespaceListResult<M>> {
  return await kv.list<M>(options);
}

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
  const metadata: Record<string, any> = {
    generatedAt: new Date().toISOString(),
  };
  await putKV(kvReportCache, key, data, {
    metadata,
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

// Session-related helpers
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