// src/lib/cloudflare/r2.ts
/**
 * Cloudflare R2 Utilities
 *
 * This module provides utilities for working with Cloudflare R2 object storage,
 * including CRUD operations, presigned URLs, batch operations, and metadata handling.
 */

// ----------------
// Types
// ----------------

/**
 * Options for uploading objects to R2
 */
export interface R2UploadOptions {
  /** HTTP content type of the object */
  contentType?: string;
  /** Custom metadata to store with the object */
  customMetadata?: Record<string, string>;
  /** Cache control directives */
  cacheControl?: string;
  /** Content disposition header */
  contentDisposition?: string;
  /** Content encoding header */
  contentEncoding?: string;
  /** Content language header */
  contentLanguage?: string;
  /** Storage class for the object */
  storageClass?: R2StorageClass;
  /** Whether to use chunked upload (for large files) */
  chunked?: boolean;
  /** Checksum for upload verification */
  checksum?: {
    /** Algorithm to use */
    algorithm: "md5" | "sha1" | "sha256" | "sha512";
    /** Checksum value as hex string */
    value: string;
  };
}

/**
 * Options for generating presigned URLs
 */
export interface R2PresignedUrlOptions {
  /** Validity duration in seconds (default: 1 hour) */
  expirationSeconds?: number;
  /** HTTP method for the URL */
  method?: "GET" | "PUT" | "HEAD" | "DELETE";
  /** Custom headers to allow */
  allowedHeaders?: string[];
  /** Content type for PUT requests */
  contentType?: string;
  /** Access controls */
  accessControl?: "public" | "private";
}

/**
 * Available R2 storage classes
 */
export type R2StorageClass = "STANDARD" | "INFREQUENT_ACCESS";

/**
 * Response for R2 batch operations
 */
export interface R2BatchResult<T> {
  /** Successful operations */
  successes: Array<{
    /** Key of the processed object */
    key: string;
    /** Operation result */
    result: T;
  }>;
  /** Failed operations */
  failures: Array<{
    /** Key of the failed object */
    key: string;
    /** Error message */
    error: string;
  }>;
}

/**
 * List options for R2
 */
export interface R2ListOptions {
  /** Maximum number of objects to return */
  limit?: number;
  /** Prefix to filter objects */
  prefix?: string;
  /** Delimiter for "directory-like" separation */
  delimiter?: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Include custom metadata in results */
  includeCustomMetadata?: boolean;
  /** Include checksums in results */
  includeChecksums?: boolean;
  /** Include HTTP metadata in results */
  includeHttpMetadata?: boolean;
}

/**
 * Result from listing objects
 */
export interface R2ListResult {
  /** Objects returned by the listing operation */
  objects: R2ObjectInfo[];
  /** Common prefixes (when using delimiter) */
  prefixes?: string[];
  /** Cursor for fetching next page */
  truncated: boolean;
  /** Cursor for fetching next page */
  cursor?: string;
}

/**
 * Information about an R2 object
 */
export interface R2ObjectInfo {
  /** Object key */
  key: string;
  /** Object size in bytes */
  size: number;
  /** Etag (entity tag) */
  etag: string;
  /** HTTP metadata */
  httpMetadata?: {
    /** Content type */
    contentType?: string;
    /** Cache control directives */
    cacheControl?: string;
    /** Content disposition */
    contentDisposition?: string;
    /** Content encoding */
    contentEncoding?: string;
    /** Content language */
    contentLanguage?: string;
  };
  /** Custom metadata */
  customMetadata?: Record<string, string>;
  /** Created timestamp */
  uploaded: Date;
  /** Storage class */
  storageClass?: R2StorageClass;
  /** Checksums */
  checksums?: {
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha512?: string;
  };
}

// ----------------
// R2 Client
// ----------------

/**
 * Client for interacting with Cloudflare R2 storage
 */
export class R2Client {
  private bucket: R2Bucket;
  private publicUrlBase?: string;

  /**
   * Create a new R2Client
   *
   * @param bucket R2 bucket instance
   * @param publicUrlBase Optional base URL for public access
   */
  constructor(bucket: R2Bucket, publicUrlBase?: string) {
    this.bucket = bucket;
    this.publicUrlBase = publicUrlBase;
  }

  // ----------------
  // Object Operations
  // ----------------

  /**
   * Upload an object to R2
   *
   * @param key Object key
   * @param value Object data (can be various types)
   * @param options Upload options
   * @returns Object metadata from the upload
   */
  async upload(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options: R2UploadOptions = {}
  ): Promise<R2ObjectInfo> {
    try {
      // Prepare upload options
      const uploadOptions: R2PutOptions = {};

      // Set HTTP metadata if provided
      if (options.contentType)
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          contentType: options.contentType,
        };
      if (options.cacheControl)
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          cacheControl: options.cacheControl,
        };
      if (options.contentDisposition)
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          contentDisposition: options.contentDisposition,
        };
      if (options.contentEncoding)
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          contentEncoding: options.contentEncoding,
        };
      if (options.contentLanguage)
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          contentLanguage: options.contentLanguage,
        };

      // Set custom metadata if provided
      if (options.customMetadata) {
        uploadOptions.customMetadata = options.customMetadata;
      }

      // Handle checksums if provided
      if (options.checksum) {
        const algorithm = options.checksum.algorithm;
        const value = options.checksum.value;

        switch (algorithm) {
          case "md5":
            uploadOptions.md5 = value;
            break;
          case "sha1":
            uploadOptions.sha1 = value;
            break;
          case "sha256":
            uploadOptions.sha256 = value;
            break;
          case "sha512":
            uploadOptions.sha512 = value;
            break;
        }
      }

      // Handle chunked upload if requested
      if (options.chunked && value instanceof ReadableStream) {
        return this.uploadChunked(key, value, options);
      }

      // Regular upload
      const result = await this.bucket.put(key, value, uploadOptions);

      // Map to our R2ObjectInfo
      return this.mapObjectHeadToInfo(key, result);
    } catch (error) {
      throw this.wrapError("upload", key, error);
    }
  }

  /**
   * Upload a large object in chunks
   *
   * @param key Object key
   * @param stream Readable stream of data
   * @param options Upload options
   * @returns Object metadata from the upload
   */
  private async uploadChunked(
    key: string,
    stream: ReadableStream,
    options: R2UploadOptions
  ): Promise<R2ObjectInfo> {
    try {
      // In Cloudflare R2, multipart uploads are handled using
      // createMultipartUpload, uploadPart, and completeMultipartUpload

      // Start the multipart upload
      const uploadId = await this.bucket.createMultipartUpload(key);
      const parts: R2UploadedPart[] = [];

      // Process the stream in chunks
      const reader = stream.getReader();
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      let buffer = new Uint8Array(0);
      let partNumber = 1;
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          // Append to buffer
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
        }

        // Upload chunks when we have enough data or reached the end
        while (buffer.length >= chunkSize || (done && buffer.length > 0)) {
          const chunk = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);

          // Upload part
          const etag = await this.bucket.uploadPart(
            key,
            uploadId,
            partNumber,
            chunk
          );

          parts.push({ partNumber, etag });
          partNumber++;
        }
      }

      // Complete the multipart upload
      const result = await this.bucket.completeMultipartUpload(
        key,
        uploadId,
        parts
      );

      // Update metadata if needed
      if (options.customMetadata || options.contentType) {
        // Get the existing object
        const obj = await this.bucket.head(key);

        // Prepare update options
        const updateOptions: R2PutOptions = {};

        // Copy existing metadata
        if (obj?.httpMetadata) {
          updateOptions.httpMetadata = { ...obj.httpMetadata };
        }

        if (obj?.customMetadata) {
          updateOptions.customMetadata = { ...obj.customMetadata };
        }

        // Update with new metadata
        if (options.customMetadata) {
          updateOptions.customMetadata = {
            ...updateOptions.customMetadata,
            ...options.customMetadata,
          };
        }

        if (options.contentType) {
          updateOptions.httpMetadata = {
            ...updateOptions.httpMetadata,
            contentType: options.contentType,
          };
        }

        // Update the object metadata
        await this.bucket.put(key, await this.bucket.get(key), updateOptions);
      }

      // Get updated object info
      const objInfo = await this.bucket.head(key);

      // Map to our R2ObjectInfo
      return this.mapObjectHeadToInfo(key, objInfo);
    } catch (error) {
      throw this.wrapError("uploadChunked", key, error);
    }
  }

  /**
   * Download an object from R2
   *
   * @param key Object key
   * @param options Optional request options
   * @returns The object or null if not found
   */
  async download(
    key: string,
    options: { asStream?: boolean } = {}
  ): Promise<R2ObjectBody | null> {
    try {
      // Get the object
      const obj = await this.bucket.get(key);

      if (!obj) {
        return null;
      }

      return obj;
    } catch (error) {
      throw this.wrapError("download", key, error);
    }
  }

  /**
   * Get metadata for an object without downloading its contents
   *
   * @param key Object key
   * @returns Object metadata or null if not found
   */
  async head(key: string): Promise<R2ObjectInfo | null> {
    try {
      const obj = await this.bucket.head(key);

      if (!obj) {
        return null;
      }

      return this.mapObjectHeadToInfo(key, obj);
    } catch (error) {
      throw this.wrapError("head", key, error);
    }
  }

  /**
   * Delete an object from R2
   *
   * @param key Object key
   * @returns True if deleted, false if not found
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Check if the object exists first
      const exists = await this.bucket.head(key);

      if (!exists) {
        return false;
      }

      await this.bucket.delete(key);
      return true;
    } catch (error) {
      throw this.wrapError("delete", key, error);
    }
  }

  /**
   * List objects in the bucket
   *
   * @param options List options
   * @returns List result with objects and pagination info
   */
  async list(options: R2ListOptions = {}): Promise<R2ListResult> {
    try {
      // Prepare list options
      const listOptions: R2ListOptions = {
        limit: options.limit || 1000,
        prefix: options.prefix,
        delimiter: options.delimiter,
        cursor: options.cursor,
        include: [],
      };

      // Add includes if requested
      if (options.includeMetadata) listOptions.include.push("customMetadata");
      if (options.includeHttpMetadata) listOptions.include.push("httpMetadata");
      if (options.includeChecksums) listOptions.include.push("checksums");

      // Perform listing
      const result = await this.bucket.list(listOptions);

      // Map objects to our format
      const objects = result.objects.map((obj) =>
        this.mapObjectHeadToInfo(obj.key, obj)
      );

      return {
        objects,
        prefixes: result.delimitedPrefixes,
        truncated: result.truncated,
        cursor: result.truncated ? result.cursor : undefined,
      };
    } catch (error) {
      throw this.wrapError("list", "multiple", error);
    }
  }

  /**
   * Check if an object exists
   *
   * @param key Object key
   * @returns True if the object exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.bucket.head(key);
      return !!result;
    } catch (error) {
      if (error.name === "NotFoundError") {
        return false;
      }
      throw this.wrapError("exists", key, error);
    }
  }

  /**
   * Copy an object within the same bucket
   *
   * @param sourceKey Source object key
   * @param destinationKey Destination object key
   * @param options Optional copy options
   * @returns Metadata of the new object
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    options: R2UploadOptions = {}
  ): Promise<R2ObjectInfo> {
    try {
      // Get the source object
      const source = await this.bucket.get(sourceKey);

      if (!source) {
        throw new Error(`Source object not found: ${sourceKey}`);
      }

      // Prepare upload options
      const uploadOptions: R2PutOptions = {};

      // Set HTTP metadata if provided
      if (options.contentType || source.httpMetadata?.contentType) {
        uploadOptions.httpMetadata = {
          ...uploadOptions.httpMetadata,
          contentType: options.contentType || source.httpMetadata?.contentType,
        };
      }

      // Add other HTTP metadata
      for (const key of [
        "cacheControl",
        "contentDisposition",
        "contentEncoding",
        "contentLanguage",
      ]) {
        if (options[key] || source.httpMetadata?.[key]) {
          uploadOptions.httpMetadata = {
            ...uploadOptions.httpMetadata,
            [key]: options[key] || source.httpMetadata?.[key],
          };
        }
      }

      // Set custom metadata if provided
      if (options.customMetadata || source.customMetadata) {
        uploadOptions.customMetadata = {
          ...source.customMetadata,
          ...options.customMetadata,
        };
      }

      // Upload to destination
      const result = await this.bucket.put(
        destinationKey,
        source.body,
        uploadOptions
      );

      return this.mapObjectHeadToInfo(destinationKey, result);
    } catch (error) {
      throw this.wrapError("copy", `${sourceKey} to ${destinationKey}`, error);
    }
  }

  /**
   * Generate a presigned URL for an object
   *
   * @param key Object key
   * @param options URL options
   * @returns Presigned URL
   */
  async getPresignedUrl(
    key: string,
    options: R2PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      // Prepare options
      const presignOptions: R2PresignedUrlOptions = {
        expirationSeconds: options.expirationSeconds || 3600, // Default: 1 hour
        method: options.method || "GET",
      };

      // Add optional parameters
      if (options.allowedHeaders) {
        presignOptions.allowedHeaders = options.allowedHeaders;
      }

      if (options.contentType && presignOptions.method === "PUT") {
        presignOptions.allowedHeaders = [
          ...(presignOptions.allowedHeaders || []),
          "Content-Type",
        ];
      }

      // Generate the URL
      const url = await this.bucket.createPresignedUrl(key, presignOptions);

      return url.toString();
    } catch (error) {
      throw this.wrapError("getPresignedUrl", key, error);
    }
  }

  /**
   * Get a public URL for an object (requires public bucket)
   *
   * @param key Object key
   * @returns Public URL or null if public URL base is not configured
   */
  getPublicUrl(key: string): string | null {
    if (!this.publicUrlBase) {
      return null;
    }

    // Ensure the base URL ends with a slash
    const base = this.publicUrlBase.endsWith("/")
      ? this.publicUrlBase
      : `${this.publicUrlBase}/`;

    // Ensure the key doesn't start with a slash
    const cleanKey = key.startsWith("/") ? key.substring(1) : key;

    return `${base}${cleanKey}`;
  }

  // ----------------
  // Batch Operations
  // ----------------

  /**
   * Delete multiple objects in one operation
   *
   * @param keys Array of object keys to delete
   * @returns Batch operation result
   */
  async deleteMany(keys: string[]): Promise<R2BatchResult<true>> {
    const result: R2BatchResult<true> = {
      successes: [],
      failures: [],
    };

    // Process in batches of 1000 (R2 limit)
    const batchSize = 1000;

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);

      try {
        // Delete the batch
        await this.bucket.delete(batch);

        // Mark all as successful
        for (const key of batch) {
          result.successes.push({
            key,
            result: true,
          });
        }
      } catch (error) {
        // If batch fails, try individual deletes
        for (const key of batch) {
          try {
            await this.bucket.delete(key);
            result.successes.push({
              key,
              result: true,
            });
          } catch (err) {
            result.failures.push({
              key,
              error: err.message || "Unknown error",
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if multiple objects exist
   *
   * @param keys Array of object keys to check
   * @returns Batch operation result
   */
  async existsMany(keys: string[]): Promise<R2BatchResult<boolean>> {
    const result: R2BatchResult<boolean> = {
      successes: [],
      failures: [],
    };

    // Process in parallel with a concurrency limit
    const concurrencyLimit = 50;
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < keys.length; i += concurrencyLimit) {
      batches.push(keys.slice(i, i + concurrencyLimit));
    }

    // Process each batch in parallel
    for (const batch of batches) {
      const batchPromises = batch.map(async (key) => {
        try {
          const exists = await this.exists(key);
          return {
            key,
            success: true,
            exists,
          };
        } catch (error) {
          return {
            key,
            success: false,
            error: error.message || "Unknown error",
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Process batch results
      for (const item of batchResults) {
        if (item.success) {
          result.successes.push({
            key: item.key,
            result: item.exists,
          });
        } else {
          result.failures.push({
            key: item.key,
            error: item.error,
          });
        }
      }
    }

    return result;
  }

  // ----------------
  // Helper Methods
  // ----------------

  /**
   * Map an R2Object to our R2ObjectInfo format
   */
  private mapObjectHeadToInfo(
    key: string,
    obj: R2Object | R2ObjectBody
  ): R2ObjectInfo {
    return {
      key,
      size: obj.size,
      etag: obj.etag,
      uploaded: obj.uploaded,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
      checksums: {
        md5: obj.checksums?.md5
          ? this.bytesToHex(obj.checksums.md5)
          : undefined,
        sha1: obj.checksums?.sha1
          ? this.bytesToHex(obj.checksums.sha1)
          : undefined,
        sha256: obj.checksums?.sha256
          ? this.bytesToHex(obj.checksums.sha256)
          : undefined,
        sha512: obj.checksums?.sha512
          ? this.bytesToHex(obj.checksums.sha512)
          : undefined,
      },
    };
  }

  /**
   * Convert a Uint8Array to a hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Wrap an error with context information
   */
  private wrapError(operation: string, key: string, error: any): Error {
    const message = error.message || "Unknown error";
    const wrappedError = new Error(
      `R2 ${operation} operation failed for '${key}': ${message}`
    );
    wrappedError.cause = error;
    return wrappedError;
  }
}

// ----------------
// Factory Functions
// ----------------

/**
 * Create a new R2 client from a bucket name and binding
 *
 * @param bucketName Name of the bucket (for error reporting)
 * @param bucketBinding R2 bucket binding from environment
 * @param publicUrlBase Optional base URL for public access
 * @returns R2Client instance
 */
export function createR2Client(
  bucketName: string,
  bucketBinding: R2Bucket,
  publicUrlBase?: string
): R2Client {
  return new R2Client(bucketBinding, publicUrlBase);
}

/**
 * Get the content type from a filename
 *
 * @param filename Filename or path
 * @returns MIME type
 */
export function getContentTypeFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  // Common MIME types map
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    xml: "application/xml",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    ico: "image/x-icon",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

export default {
  createR2Client,
  getContentTypeFromFilename,
};
