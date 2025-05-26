// src/types/entity.d.ts
// EntityType provides broad classification of an entity.
export type EntityType = 
  | 'individual' 
  | 'company' 
  | 'trust' 
  | 'partnership'
  | 'property'        // Physical property
  | 'tenant'          // Tenant entity
  | 'vendor';         // Service provider

/**
 * Real estate specific entity subtypes
 */
export type RealEstateEntityType = 
  | 'rental_property'
  | 'commercial_property'
  | 'residential_property'
  | 'mixed_use_property'
  | 'vacant_land'
  | 'property_unit'    // Individual units within a property
  | 'property_group';  // Portfolio or group of properties

/**
 * DetailedBusinessType supports more granular business structure distinction.
 */
export type DetailedBusinessType =
  | 'sole_proprietorship'
  | 'partnership'
  | 'llc_single_member'
  | 'llc_multi_member'
  | 's_corporation'
  | 'c_corporation'
  | 'non_profit'
  | 'trust'
  | 'estate'
  | 'reit'                      // Real Estate Investment Trust
  | 'property_management'       // Property management company
  | 'real_estate_syndicate'     // Syndicated real estate investment
  | 'real_estate_partnership'   // Specific RE partnership
  | 'other';

/**
 * Property details for real estate entities
 */
export interface PropertyDetails {
  propertyType?: RealEstateEntityType;
  propertyAddress?: string;
  parcelNumber?: string;
  yearBuilt?: number;
  squareFootage?: number;
  unitCount?: number;
  lotSize?: number;
  zoning?: string;
  taxId?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  propertyManagerId?: string;
}

/**
 * Enhanced vendor information
 */
export interface VendorInfo {
  category: 'maintenance' | 'landscaping' | 'cleaning' | 'professional' | 'utility' | 'other';
  serviceTypes?: string[];
  taxIdType?: 'EIN' | 'SSN' | 'Other';
  taxId?: string;
  w9OnFile?: boolean;
  insuranceExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  rating?: number;
  preferredPaymentMethod?: 'check' | 'ach' | 'wire' | 'cash';
  paymentTerms?: 'net30' | 'net60' | 'due_on_receipt' | 'custom';
  hourlyRate?: number;
  isInsured?: boolean;
  insuranceAmount?: number;
  certifications?: string[];
}

/**
 * Updated Entity interface with real estate fields
 */
export interface Entity {
  /** Unique identifier (UUID) for this entity */
  id: string;

  /** User who owns or created this entity */
  userId: string;

  /** Entity display name */
  name: string;

  /** Legal/formal name as registered (if different from display name) */
  legalName?: string | null;

  /** Employer Identification Number / Tax ID */
  ein?: string | null;

  /** Mailing/business address */
  address?: string | null;

  /** Legal address (if different from business address) */
  legalAddress?: string | null;

  /** Business type classification */
  businessType?: DetailedBusinessType | null;

  /** Primary classification of the entity */
  type?: EntityType; // Optional if you support legacy records

  /** For real estate entities: property-specific details */
  propertyDetails?: PropertyDetails | null;

  /** For tenant entities: lease details */
  tenantInfo?: {
    leaseStartDate?: string;
    leaseEndDate?: string;
    monthlyRent?: number;
    securityDeposit?: number;
    propertyId?: string; // Link to property entity
  } | null;

  /** For vendor entities: enhanced service info */
  vendorInfo?: VendorInfo | null;

  /** Hierarchical parent entity */
  parentId?: string | null;

  /** Is entity active? */
  isActive: boolean;

  /** Allows sub-entities? */
  allowsSubEntities: boolean;

  /** Creation timestamp (Unix seconds) */
  createdAt: number;

  /** Last updated timestamp (Unix seconds) */
  updatedAt: number;

  /** Optional description of entity */
  description?: string | null;

  /** Registered agent information, if applicable */
  registeredAgent?: { name: string; address: string } | null;

  /** Date of formation (ISO string) */
  formationDate?: string | null;

  /** Jurisdiction of formation */
  jurisdiction?: string | null;

  /** Custom user-defined fields */
  customFields?: Record<string, any> | null;

  /** Hierarchical path string, e.g., "parent/child" */
  path?: string | null;
}

/**
 * Entity input payload for create/update (excluding read-only fields).
 */
export interface EntityInput {
  name: string;
  type: EntityType;
  description?: string | null;
  ein?: string | null;
  legalName?: string | null;
  address?: string | null;
  legalAddress?: string | null;
  businessType?: DetailedBusinessType | null;
  propertyDetails?: PropertyDetails | null;
  tenantInfo?: {
    leaseStartDate?: string;
    leaseEndDate?: string;
    monthlyRent?: number;
    securityDeposit?: number;
    propertyId?: string;
  } | null;
  vendorInfo?: VendorInfo | null;
  registeredAgent?: { name: string; address: string } | null;
  formationDate?: string | null;
  jurisdiction?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  allowsSubEntities?: boolean;
  customFields?: Record<string, any> | null;
}

/**
 * Entity relationship types for real estate and business logic
 */
export interface EntityRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: 
    | 'owns'              // Owner owns property
    | 'manages'           // Manager manages property
    | 'leases_from'       // Tenant leases from property
    | 'provides_service'  // Vendor provides service to entity
    | 'subsidiary_of'     // Corporate structure
    | 'partner_in';       // Partnership relationship
  startDate?: string;
  endDate?: string;
  details?: Record<string, any>;
}

/**
 * Filters for querying entities, now including real estate–specific filters.
 */
export interface EntityQueryFilters {
  type?: EntityType;
  isActive?: boolean;
  parentId?: string | null;
  searchTerm?: string;
  userId?: string;
  businessType?: DetailedBusinessType;
  propertyType?: RealEstateEntityType;
  hasVacancy?: boolean;
  managedBy?: string;
  location?: {
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

/**
 * Entity with possible child entities for hierarchical display.
 */
export interface EntityWithChildren extends Entity {
  children?: Entity[];
}

/**
 * Entity summary with key metrics
 */
export interface EntitySummary extends Entity {
  accountCount?: number;
  totalBalance?: number;
  occupancyRate?: number;
  monthlyIncome?: number;
  activeLeases?: number;
  childEntityCount?: number;
}

/**
 * Type guards for entities
 */
export function isPropertyEntity(entity: Entity): entity is Entity & { propertyDetails: PropertyDetails } {
  return entity.type === 'property' && entity.propertyDetails != null;
}

export function isTenantEntity(entity: Entity): boolean {
  return entity.type === 'tenant' && entity.tenantInfo != null;
}

export function isVendorEntity(entity: Entity): entity is Entity & { vendorInfo: VendorInfo } {
  return entity.type === 'vendor' && entity.vendorInfo != null;
}

export function hasActiveLeases(entity: Entity): boolean {
  if (entity.type !== 'tenant' || !entity.tenantInfo) return false;
  const now = new Date().toISOString();
  return entity.tenantInfo.leaseEndDate ? entity.tenantInfo.leaseEndDate > now : false;
}