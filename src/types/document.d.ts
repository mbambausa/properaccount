// src/types/document.d.ts
/**
 * Document type definitions
 * 
 * This module defines TypeScript interfaces for document management
 * including metadata, storage, permissions, and processing states
 * specific to financial and accounting documents.
 */

// ----------------
// Document Types and Categories
// ----------------

/**
 * All supported document types
 */
export type DocumentType = 
  // Financial documents
  | 'invoice' 
  | 'receipt'
  | 'bank-statement'
  | 'credit-card-statement'
  | 'loan-agreement'
  | 'loan-statement'
  
  // Tax documents
  | 'tax-return'
  | 'w2'
  | 'w9'
  | '1099'
  | 'k1'
  
  // Legal documents
  | 'contract'
  | 'lease-agreement'
  | 'incorporation-document'
  | 'business-license'
  
  // Entity documents
  | 'chart-of-accounts'
  | 'financial-statement'
  | 'audit-report'
  
  // Other document types
  | 'policy'
  | 'correspondence'
  | 'general-attachment'
  | 'custom';

/**
 * Document categories for organization
 */
export type DocumentCategory =
  | 'financial'
  | 'tax'
  | 'legal'
  | 'entity'
  | 'compliance'
  | 'correspondence'
  | 'other';

/**
 * Document storage provider
 */
export type StorageProvider = 
  | 'local'
  | 'cloudflare-r2'
  | 'aws-s3'
  | 'google-drive'
  | 'onedrive'
  | 'dropbox';

/**
 * Document file format
 */
export type DocumentFormat = 
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'csv'
  | 'txt'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'tiff'
  | 'html'
  | 'xml'
  | 'json'
  | 'zip'
  | 'other';

/**
 * Document processing status
 */
export type DocumentProcessingStatus = 
  | 'pending'        // Uploaded but not processed
  | 'processing'     // Currently being processed
  | 'processed'      // Successfully processed
  | 'error'          // Error in processing
  | 'needs-review'   // Human review needed
  | 'approved'       // Approved after review
  | 'rejected'       // Rejected after review
  | 'archived';      // Archived document

// ----------------
// Core Document Interfaces
// ----------------

/**
 * Base document metadata
 */
export interface DocumentMetadata {
  /** Unique document ID */
  id: string;
  /** Document name/title */
  name: string;
  /** Document type */
  type: DocumentType;
  /** Category for organization */
  category: DocumentCategory;
  /** Document format/extension */
  format: DocumentFormat;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Original filename */
  originalFilename: string;
  /** Document creation date */
  createdAt: string;
  /** Last modification date */
  updatedAt: string;
  /** Document uploader user ID */
  uploadedBy: string;
  /** Whether document is marked as favorite */
  isFavorite?: boolean;
  /** User-provided tags */
  tags?: string[];
  /** Processing status */
  status: DocumentProcessingStatus;
  /** Entity ID the document is associated with */
  entityId?: string;
  /** Parent folder ID if in a folder structure */
  folderId?: string;
  /** Custom document properties */
  properties?: Record<string, any>;
}

/**
 * Document storage information
 */
export interface DocumentStorage {
  /** Storage provider */
  provider: StorageProvider;
  /** Storage location/path */
  location: string;
  /** Storage-specific identifiers */
  storageId: string;
  /** Whether document is encrypted at rest */
  encrypted: boolean;
  /** Encryption information if applicable */
  encryption?: {
    /** Encryption algorithm */
    algorithm: string;
    /** Initialization vector (if applicable) */
    iv?: string;
  };
  /** File checksum for integrity */
  checksum?: string;
  /** Checksum algorithm (e.g., 'sha256') */
  checksumAlgorithm?: string;
  /** Document version tracking */
  version: string | number;
  /** Total versions count */
  totalVersions: number;
}

/**
 * Document access control
 */
export interface DocumentAccess {
  /** Owner user ID */
  ownerId: string;
  /** Is document publicly accessible */
  isPublic: boolean;
  /** User permissions by user ID */
  userPermissions?: Record<string, DocumentPermission>;
  /** Group permissions by group ID */
  groupPermissions?: Record<string, DocumentPermission>;
  /** Role permissions by role name */
  rolePermissions?: Record<string, DocumentPermission>;
  /** Expiration date for time-limited access */
  expiresAt?: string;
  /** Audit trail of access events */
  accessLog?: Array<{
    userId: string;
    action: 'view' | 'download' | 'edit' | 'delete' | 'share';
    timestamp: string;
    ip?: string;
  }>;
}

/**
 * Permission level for document access
 */
export type DocumentPermission = 
  | 'view'       // Can only view
  | 'download'   // Can view and download
  | 'edit'       // Can view, download, and edit
  | 'manage'     // Can view, download, edit, and manage permissions
  | 'owner';     // Full control

/**
 * Complete document record
 */
export interface Document {
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Storage information */
  storage: DocumentStorage;
  /** Access control */
  access: DocumentAccess;
  /** OCR data if processed */
  ocr?: DocumentOCR;
  /** Related transactions */
  transactions?: string[];
  /** Related accounts */
  accounts?: string[];
  /** Related entities */
  relatedEntities?: string[];
  /** Parent document ID if this is a version or derivative */
  parentDocumentId?: string;
  /** Child document IDs for composite documents */
  childDocumentIds?: string[];
  /** Custom document data specific to document type */
  customData?: Record<string, any>;
}

// ----------------
// OCR and Document Processing
// ----------------

/**
 * OCR processing results
 */
export interface DocumentOCR {
  /** Full extracted text */
  fullText: string;
  /** OCR processing date */
  processedAt: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Structured field extraction results */
  fields?: Record<string, DocumentField>;
  /** Page count if multi-page */
  pageCount?: number;
  /** Per-page text extraction */
  pages?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  /** Detected tables */
  tables?: DocumentTable[];
  /** Image quality assessment */
  quality?: {
    resolution: number;
    contrast: number;
    brightness: number;
    skew: number;
  };
}

/**
 * Extracted document field with structured data
 */
export interface DocumentField {
  /** Field name */
  name: string;
  /** Extracted value */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Field type (e.g., 'date', 'currency', 'text') */
  type?: string;
  /** Normalized value for processing */
  normalizedValue?: any;
  /** Bounding box in the document */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
  };
}

/**
 * Extracted table from document
 */
export interface DocumentTable {
  /** Table identifier */
  id: string;
  /** Page number */
  page: number;
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: Array<string[]>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Bounding box in the document */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ----------------
// Financial Document Specific Data
// ----------------

/**
 * Invoice document specific data
 */
export interface InvoiceDocumentData {
  /** Invoice number */
  invoiceNumber: string;
  /** Invoice date */
  invoiceDate: string;
  /** Due date */
  dueDate?: string;
  /** Vendor/supplier information */
  vendor: {
    name: string;
    id?: string;
    address?: string;
    taxId?: string;
  };
  /** Customer information if different from entity */
  customer?: {
    name: string;
    id?: string;
    address?: string;
  };
  /** Line items */
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    accountCode?: string;
    taxRate?: number;
  }>;
  /** Subtotal amount */
  subtotal: number;
  /** Tax amount */
  tax?: number;
  /** Total amount */
  total: number;
  /** Currency code */
  currency: string;
  /** Payment terms */
  paymentTerms?: string;
  /** Payment status */
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  /** Payment amount if partially paid */
  paidAmount?: number;
  /** Payment date if paid */
  paidDate?: string;
  /** Payment method if paid */
  paymentMethod?: string;
  /** Payment reference if paid */
  paymentReference?: string;
  /** Related purchase order number */
  purchaseOrderNumber?: string;
}

/**
 * Receipt document specific data
 */
export interface ReceiptDocumentData {
  /** Receipt number/identifier */
  receiptNumber?: string;
  /** Receipt date */
  receiptDate: string;
  /** Vendor/merchant information */
  vendor: {
    name: string;
    id?: string;
    address?: string;
    phone?: string;
  };
  /** Line items */
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
    category?: string;
  }>;
  /** Subtotal amount */
  subtotal?: number;
  /** Tax amount */
  tax?: number;
  /** Tip amount if applicable */
  tip?: number;
  /** Total amount */
  total: number;
  /** Currency code */
  currency: string;
  /** Payment method */
  paymentMethod?: string;
  /** Last 4 digits of card if paid by card */
  cardLast4?: string;
  /** Whether this is reimbursable */
  isReimbursable?: boolean;
  /** Expense category */
  expenseCategory?: string;
  /** Business purpose note */
  businessPurpose?: string;
}

// ----------------
// Document Operations
// ----------------

/**
 * Document upload parameters
 */
export interface DocumentUploadParams {
  /** File to upload */
  file: File;
  /** Document type */
  type: DocumentType;
  /** Document name if different from filename */
  name?: string;
  /** Document category */
  category?: DocumentCategory;
  /** Entity to associate with */
  entityId?: string;
  /** Tags to apply */
  tags?: string[];
  /** Whether to process with OCR */
  processOcr?: boolean;
  /** Custom properties */
  properties?: Record<string, any>;
  /** Parent folder ID */
  folderId?: string;
}

/**
 * Document search/filter parameters
 */
export interface DocumentSearchParams {
  /** Full-text search query */
  query?: string;
  /** Filter by type */
  type?: DocumentType | DocumentType[];
  /** Filter by category */
  category?: DocumentCategory | DocumentCategory[];
  /** Filter by entity */
  entityId?: string;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by upload date range */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /** Filter by uploader */
  uploadedBy?: string;
  /** Filter by status */
  status?: DocumentProcessingStatus | DocumentProcessingStatus[];
  /** Filter by content (requires OCR) */
  contentQuery?: string;
  /** Sorting options */
  sort?: {
    field: 'name' | 'createdAt' | 'updatedAt' | 'size';
    direction: 'asc' | 'desc';
  };
  /** Pagination */
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Document folder structure
 */
export interface DocumentFolder {
  /** Folder ID */
  id: string;
  /** Folder name */
  name: string;
  /** Parent folder ID */
  parentId?: string;
  /** Entity ID if entity-specific */
  entityId?: string;
  /** Creation date */
  createdAt: string;
  /** Last updated date */
  updatedAt: string;
  /** Created by user ID */
  createdBy: string;
  /** Number of documents in folder */
  documentCount: number;
  /** Number of subfolders */
  subfolderCount: number;
}

/**
 * Document batch operation result
 */
export interface DocumentBatchResult {
  /** Success count */
  successCount: number;
  /** Error count */
  errorCount: number;
  /** Results by document ID */
  results: Record<string, {
    success: boolean;
    error?: string;
  }>;
}