// src/utils/file.ts
/**
 * File validation and handling utilities for client-side operations.
 */

/** Default maximum file size: 10MB. This can be overridden by environment variables for specific upload contexts. */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Default allowed MIME types for document uploads.
 * Align this with backend validation and R2 storage policies.
 */
export const DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  // Consider adding other common document types if needed:
  // 'application/msword', // .doc
  // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  // 'text/plain',
];

export interface FileValidationOptions {
  maxSize?: number; // Max size in bytes
  allowedTypes?: readonly string[]; // Array of allowed MIME types
}

export interface FileValidationResult {
  valid: boolean;
  error?: 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'NO_FILE';
  message?: string;
}

/**
 * Validates a file based on size and MIME type.
 *
 * @param file The File object to validate.
 * @param options Optional validation parameters (maxSize, allowedTypes).
 * @returns An object indicating if the file is valid and any error message.
 */
export function validateFile(
  file: File | null | undefined,
  options?: FileValidationOptions
): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'NO_FILE',
      message: 'No file selected.',
    };
  }

  const maxSize = options?.maxSize ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const allowedTypes = options?.allowedTypes ?? DEFAULT_ALLOWED_DOCUMENT_MIME_TYPES;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'FILE_TOO_LARGE',
      message: `File size exceeds the limit of ${formatFileSize(maxSize)}. Maximum allowed size is ${formatFileSize(maxSize)}.`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'INVALID_FILE_TYPE',
      message: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}. Detected type: ${file.type || 'unknown'}.`,
    };
  }

  return { valid: true };
}

/**
 * Reads a file as a Data URL (Base64 encoded string).
 * Useful for previewing images or embedding small files client-side.
 *
 * @param file The File object to read.
 * @returns A promise that resolves with the Data URL string.
 * @throws Rejects the promise if file reading fails.
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) { // File inherits from Blob
        reject(new TypeError("Invalid input: Expected a File or Blob object."));
        return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Formats a file size in bytes into a human-readable string (KB, MB, GB).
 *
 * @param bytes The file size in bytes.
 * @param decimals The number of decimal places for the formatted size (default is 2).
 * @returns A human-readable file size string.
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (isNaN(bytes) || bytes < 0) {
    return 'Invalid size';
  }
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i >= sizes.length) {
    // Handle extremely large sizes beyond YB if necessary, or cap at YB
    return parseFloat((bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)) + ' ' + sizes[sizes.length -1];
  }

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Extracts the file extension from a filename.
 * @param filename The name of the file.
 * @returns The file extension in lowercase, without the leading dot, or an empty string if no extension.
 */
export function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0 || lastDotIndex === filename.length - 1) {
    return ''; // No extension, or dot is at the beginning/end
  }
  return filename.substring(lastDotIndex + 1).toLowerCase();
}