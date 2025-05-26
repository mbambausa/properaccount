// src/lib/cloudflare/r2.ts
/**
 * Cloudflare R2 Utilities
 *
 * This module provides utilities for working with Cloudflare R2 object storage,
 * including CRUD operations, presigned URLs, and metadata handling.
 */
import type {
    R2Bucket,
    R2Object,
    R2ObjectBody,
    R2PutOptions,
    R2HTTPMetadata,
    R2Checksums,
} from '@cloudflare/workers-types';

export interface R2UploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  checksum?: {
    algorithm: "md5" | "sha1" | "sha256" | "sha512";
    value: string; // hex string
  };
}

export interface R2PresignedUrlOptions {
  expiresIn?: number; // in seconds
  method?: 'GET' | 'PUT';
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  uploaded: Date;
  checksums?: R2Checksums;
  version?: string;
}

export class R2Client {
  private bucket: R2Bucket;
  public publicUrlBase?: string;

  constructor(bucket: R2Bucket, publicUrlBase?: string) {
    this.bucket = bucket;
    this.publicUrlBase = publicUrlBase;
  }

  async upload(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options: R2UploadOptions = {}
  ): Promise<R2ObjectInfo> {
    try {
      const uploadOptions: R2PutOptions = {};

      const httpMetadata: R2HTTPMetadata = {};
      if (options.contentType) httpMetadata.contentType = options.contentType;
      if (options.cacheControl) httpMetadata.cacheControl = options.cacheControl;
      if (options.contentDisposition) httpMetadata.contentDisposition = options.contentDisposition;
      if (options.contentEncoding) httpMetadata.contentEncoding = options.contentEncoding;
      if (options.contentLanguage) httpMetadata.contentLanguage = options.contentLanguage;

      if (Object.keys(httpMetadata).length > 0) {
        uploadOptions.httpMetadata = httpMetadata;
      }
      if (options.customMetadata) {
        uploadOptions.customMetadata = options.customMetadata;
      }
      if (options.checksum) {
        (uploadOptions as any)[options.checksum.algorithm] = options.checksum.value;
      }
      // The 'range' option is not part of the standard R2PutOptions for a single PUT.
      // Ranged uploads usually involve multipart uploads or S3-compatible features.
      // if (options.range) {
      //   uploadOptions.range = options.range; // This line was problematic
      // }
      
      const result: R2Object | null = await this.bucket.put(key, value as any, uploadOptions);
      if (!result) {
        throw new Error('Upload failed - no result returned from R2 put operation');
      }
      return this.mapR2ObjectToInfo(result);

    } catch (error) {
      throw this.wrapError("upload", key, error);
    }
  }

  async download(key: string): Promise<R2ObjectBody | null> {
    try {
      const obj = await this.bucket.get(key);
      return obj ?? null;
    } catch (error) {
      throw this.wrapError("download", key, error);
    }
  }

  async getPresignedUrl(
    key: string,
    _options: R2PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      console.warn(
        `R2Client.getPresignedUrl for key "${key}" is a placeholder. ` +
        `True presigned URL generation requires a signing mechanism not available here.`
      );
      
      if ((!_options.method || _options.method === 'GET') && this.publicUrlBase) {
        const publicUrl = this.getPublicUrl(key);
        if (publicUrl) return publicUrl;
      }
      
      throw new Error('Presigned URL generation is not fully implemented for R2 in this client.');
    } catch (error) {
      throw this.wrapError("getPresignedUrl", key, error);
    }
  }
  
  getPublicUrl(key: string): string | null {
    if (!this.publicUrlBase) {
      return null;
    }
    const base = this.publicUrlBase.endsWith("/") ? this.publicUrlBase : `${this.publicUrlBase}/`;
    return `${base}${key.startsWith("/") ? key.substring(1) : key}`;
  }

  private mapR2ObjectToInfo(obj: R2Object): R2ObjectInfo {
    return {
      key: obj.key,
      size: obj.size,
      etag: obj.etag,
      uploaded: obj.uploaded,
      httpMetadata: obj.httpMetadata,
      customMetadata: obj.customMetadata,
      checksums: obj.checksums,
      version: obj.version,
    };
  }

  private wrapError(operation: string, key: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const wrappedError = new Error(`R2 ${operation} operation failed for key '${key}': ${message}`);
    if (error instanceof Error) {
        wrappedError.cause = error;
    }
    return wrappedError;
  }
}