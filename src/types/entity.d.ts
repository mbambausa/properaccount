// src/types/entity.d.ts
/**
 * Defines interfaces and types related to business entities,
 * including general company information and specific details for
 * properties, tenants, and vendors in a real estate context.
 */

/**
 * Broad classification of an entity within the system.
 */
export type EntityType =
  | 'individual'          // A person, could be owner, tenant, contact
  | 'company'             // A general business entity (LLC, Corp, etc.)
  | 'trust'               // A legal trust entity
  | 'partnership'         // A partnership entity
  | 'property'            // A physical real estate property being managed or accounted for
  | 'tenant'              // A tenant entity (can be individual or company)
  | 'vendor'              // A supplier or service provider
  | 'portfolio'           // A grouping of properties or investments
  | 'financial_institution';// e.g., a bank or lender

/**
 * More granular classification for real estate property entities.
 * Used within `PropertyDetails.propertyType`.
 */
export type RealEstateEntityType =
  | 'residential_single_family'
  | 'residential_multi_family' // e.g., Duplex, Apartment Complex
  | 'commercial_office'
  | 'commercial_retail'
  | 'commercial_industrial'
  | 'mixed_use_property'
  | 'vacant_land'
  | 'property_unit'          // An individual unit within a multi-unit property
  | 'common_area'            // e.g., HOA common area, shared facilities
  | 'other_real_estate';

/**
 * Detailed legal/business structure classification.
 */
export type DetailedBusinessType =
  | 'sole_proprietorship'
  | 'general_partnership'
  | 'limited_partnership'     // LP
  | 'limited_liability_partnership' // LLP
  | 'llc_single_member'
  | 'llc_multi_member_partnership_taxed'
  | 'llc_multi_member_scorp_taxed'
  | 'llc_multi_member_ccorp_taxed'
  | 's_corporation'
  | 'c_corporation'
  | 'non_profit_501c3'
  | 'other_non_profit'
  | 'trust_revocable'
  | 'trust_irrevocable'
  | 'estate'
  | 'reit'                      // Real Estate Investment Trust
  | 'property_management_company'
  | 'real_estate_syndication'
  | 'joint_venture'
  | 'other_legal_structure';

/**
 * Specific details for entities that are real estate properties.
 */
export interface PropertyDetails {
  /** Granular type of the real estate property. */
  propertyType?: RealEstateEntityType | null;
  /** Full street address of the property. */
  streetAddress?: string | null; // Consider breaking into structured address if needed elsewhere
  city?: string | null;
  stateOrProvince?: string | null; // e.g., "CA", "Ontario"
  postalCode?: string | null;
  country?: string | null; // ISO 3166-1 alpha-2 code, e.g., "US"
  /** Assessor's Parcel Number or equivalent property tax identifier. */
  parcelNumber?: string | null;
  /** Year the property was built. */
  yearBuilt?: number | null;
  /** Total interior square footage/meterage. */
  squareFootage?: number | null;
  squareFootageUnit?: 'sqft' | 'sqm' | null;
  /** Number of distinct rentable/usable units (e.g., apartments, office suites). */
  unitCount?: number | null;
  /** Size of the land lot. */
  lotSize?: number | null;
  lotSizeUnit?: 'acres' | 'sqft' | 'hectares' | 'sqm' | null;
  zoningClassification?: string | null; // e.g., "R-1", "C-2"
  /** Property tax identification number if different from parcel number. */
  propertyTaxId?: string | null;
  /** Date the property was acquired. ISO 8601 date string (YYYY-MM-DD). */
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  /** Current estimated market value or appraised value. */
  currentMarketValue?: number | null;
  /** Date of the last valuation/appraisal. ISO 8601 date string (YYYY-MM-DD). */
  lastValuationDate?: string | null;
  /** ID of the entity or user responsible for managing this property. */
  propertyManagerEntityId?: string | null;
  insurancePolicyNumber?: string | null;
  schoolDistrict?: string | null;
}

/**
 * Specific details for entities that are tenants.
 */
export interface TenantDetails { // Renamed from tenantInfo for clarity
  /** ID of the primary property this tenant is associated with via a lease. */
  primaryPropertyId?: string | null;
  /** ID of the specific unit this tenant occupies/leases. */
  primaryUnitId?: string | null;
  /** Current active lease ID for this tenant. */
  activeLeaseId?: string | null;
  /** Date the tenant moved in. ISO 8601 date string (YYYY-MM-DD). */
  moveInDate?: string | null;
  /** Expected or actual move-out date. ISO 8601 date string (YYYY-MM-DD). */
  moveOutDate?: string | null;
  currentMonthlyRent?: number | null;
  securityDepositHeld?: number | null;
  contactEmail?: string | null; // May differ from primary entity email if tenant is a company
  contactPhone?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  preferredCommunicationMethod?: 'email' | 'phone' | 'sms' | 'portal' | null;
}

/**
 * Specific details for entities that are vendors/suppliers.
 */
export interface VendorDetails { // Renamed from vendorInfo
  serviceCategory: // Broader categories
    | 'maintenance_repair' // Plumbing, Electrical, HVAC, General Repairs
    | 'landscaping_groundskeeping'
    | 'cleaning_janitorial'
    | 'property_management_services' // If contracting out PM
    | 'legal_professional_services'  // Accounting, Legal
    | 'financial_services'           // Banking, Insurance
    | 'utilities_telecom'            // Gas, Electric, Water, Internet
    | 'construction_renovation'
    | 'supplies_materials'
    | 'other_services';
  specificServiceTypes?: string[]; // e.g., ["HVAC Repair", "Roofing"]
  taxIdType?: 'EIN' | 'SSN' | 'ITIN' | 'Other' | null;
  taxId?: string | null;
  isW9OnFile?: boolean; // Form W-9 (Request for Taxpayer Identification Number and Certification)
  /** Date when general liability insurance expires. ISO 8601 date string (YYYY-MM-DD). */
  generalLiabilityInsuranceExpiry?: string | null;
  generalLiabilityInsuranceAmount?: number | null;
  /** Date when worker's compensation insurance expires. ISO 8601 date string (YYYY-MM-DD). */
  workersCompInsuranceExpiry?: string | null;
  workersCompInsuranceAmount?: number | null;
  professionalLicenseNumber?: string | null;
  /** Date professional license expires. ISO 8601 date string (YYYY-MM-DD). */
  professionalLicenseExpiry?: string | null;
  userRating?: number | null; // 1-5 scale
  preferredPaymentMethod?: 'check' | 'ach' | 'credit_card' | 'wire_transfer' | 'cash' | 'online_platform' | null;
  paymentTerms?: 'net_15' | 'net_30' | 'net_60' | 'due_on_receipt' | 'custom' | null;
  customPaymentTermsDetails?: string | null;
  hourlyRate?: number | null;
  isInsuredAndBonded?: boolean;
  certificationsAndAffiliations?: string[] | null;
  accountNumberWithVendor?: string | null; // Your account number with this vendor
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
}

/**
 * Core Entity interface. Represents a distinct business, individual, property,
 * tenant, or vendor being tracked in the system.
 */
export interface Entity {
  /** Unique identifier (UUID) for this entity. */
  readonly id: string;
  /** ID of the user who owns/manages this entity record. */
  readonly userId: string;

  /** User-friendly display name for the entity. */
  name: string;
  /** Formal legal name, if different from the display name. */
  legalName?: string | null;
  /** Employer Identification Number (EIN) or other Tax ID. */
  einOrTaxId?: string | null; // Renamed from ein for generality
  /** Primary mailing or business address (full string or structured object). */
  primaryAddress?: string | null; // Consider structured address type later
  /** Primary legal address, if different. */
  legalRegisteredAddress?: string | null;

  /**
   * Broad classification of the entity (e.g., 'company', 'property').
   * If this is 'property', `propertyDetails.propertyType` provides finer classification.
   */
  type: EntityType;
  /** Detailed business structure (e.g., 'llc_single_member', 's_corporation'). */
  detailedBusinessType?: DetailedBusinessType | null;

  /** Specific details if the entity `type` is 'property'. */
  propertyDetails?: PropertyDetails | null;
  /** Specific details if the entity `type` is 'tenant'. */
  tenantDetails?: TenantDetails | null;
  /** Specific details if the entity `type` is 'vendor'. */
  vendorDetails?: VendorDetails | null;

  /** ID of a parent entity in a hierarchy (e.g., a property unit belonging to a property). */
  parentId?: string | null;
  /** Materialized path for hierarchical display, e.g., "ParentCo/Subsidiary/PropertyA". */
  hierarchicalPath?: string | null;

  isActive: boolean; // Whether the entity is currently active or archived/inactive
  /** Can this entity own or manage other sub-entities? */
  allowsSubEntities?: boolean; // Default based on type, e.g., company might, individual might not

  /** Unix timestamp (seconds) when this entity record was created. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when this entity record was last updated. */
  updatedAt: number;

  descriptionOrNotes?: string | null; // Renamed from description for clarity
  /** For companies/trusts: registered agent information. */
  registeredAgentInfo?: { name: string; address: string; email?: string; phone?: string; } | null;
  /** Date of formation or incorporation. ISO 8601 date string (YYYY-MM-DD). */
  formationDate?: string | null;
  /** State or country of formation/registration. */
  jurisdictionOfFormation?: string | null;

  /** Custom user-defined fields for this entity. */
  customFields?: Record<string, any> | null; // Flexible key-value store
  tags?: string[] | null; // For categorization and filtering
  defaultCurrency?: string | null; // ISO 4217 code, e.g., "USD"
  defaultLanguage?: string | null; // e.g., "en-US"
}

/**
 * Input payload for creating or updating an Entity.
 * Excludes read-only fields like `id`, `userId`, `createdAt`, `updatedAt`.
 */
export interface EntityInput {
  name: string;
  type: EntityType;
  legalName?: string | null;
  einOrTaxId?: string | null;
  primaryAddress?: string | null;
  legalRegisteredAddress?: string | null;
  detailedBusinessType?: DetailedBusinessType | null;
  propertyDetails?: PropertyDetails | null; // Or Partial<PropertyDetails> for updates
  tenantDetails?: TenantDetails | null;   // Or Partial<TenantDetails>
  vendorDetails?: VendorDetails | null;     // Or Partial<VendorDetails>
  parentId?: string | null;
  isActive?: boolean;
  allowsSubEntities?: boolean;
  descriptionOrNotes?: string | null;
  registeredAgentInfo?: { name: string; address: string; email?: string; phone?: string; } | null;
  formationDate?: string | null; // YYYY-MM-DD
  jurisdictionOfFormation?: string | null;
  customFields?: Record<string, any> | null;
  tags?: string[] | null;
  defaultCurrency?: string | null;
  defaultLanguage?: string | null;
}

/**
 * Defines types of relationships between entities.
 */
export interface EntityRelationship {
  /** Unique identifier for this relationship instance. */
  readonly id: string;
  fromEntityId: string; // ID of the source entity
  toEntityId: string;   // ID of the target entity
  /** Type of relationship. */
  relationshipType:
    | 'owns_property'            // e.g., Company owns Property
    | 'manages_property'         // e.g., PMCompany manages Property
    | 'tenant_leases_unit'       // e.g., Tenant leases Unit (Unit is an Entity)
    | 'vendor_provides_service_to_entity' // e.g., Vendor services Property or Company
    | 'is_subsidiary_of'         // e.g., PropertyLLC is_subsidiary_of HoldingCompany
    | 'is_partner_in'            // e.g., Individual is_partner_in Partnership
    | 'is_member_of'             // e.g., Individual is_member_of LLC
    | 'is_shareholder_of'
    | 'is_beneficiary_of'        // For trusts
    | 'is_guarantor_for'
    | 'other_relationship';
  /** Date relationship started. ISO 8601 date string (YYYY-MM-DD). */
  startDate?: string | null;
  /** Date relationship ended. ISO 8601 date string (YYYY-MM-DD). */
  endDate?: string | null;
  /** Additional details or attributes of the relationship (e.g., ownership percentage). */
  details?: Record<string, any> | null;
  isActive?: boolean; // Is the relationship currently active
}

/**
 * Filters for querying a list of entities.
 */
export interface EntityQueryFilters {
  type?: EntityType | EntityType[];
  isActive?: boolean;
  parentId?: string | null | 'IS_NULL' | 'IS_NOT_NULL'; // Allow special strings for null checks
  searchTerm?: string; // Search across name, legalName, description, etc.
  userId?: string; // Filter by owning user (for admin views)
  detailedBusinessType?: DetailedBusinessType | DetailedBusinessType[];
  propertyType?: RealEstateEntityType | RealEstateEntityType[]; // If filtering properties
  hasOpenWorkOrders?: boolean; // Example real estate specific filter
  managedByPropertyManagerId?: string;
  locationCriteria?: { // For properties
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  tags?: string[]; // Match any of these tags
  createdAfter?: number; // Unix timestamp (seconds)
  createdBefore?: number; // Unix timestamp (seconds)
}

/**
 * Represents an Entity along with its direct child entities, for hierarchical display.
 */
export interface EntityWithChildren extends Entity {
  children?: EntityWithChildren[]; // Recursively include children
  // Add level, path if needed for tree, similar to ChartOfAccountNode
}

/**
 * A summary of an entity, often used in lists or cards, including key metrics.
 */
export interface EntitySummary extends Pick<Entity, 'id' | 'name' | 'type' | 'isActive' | 'primaryAddress'> {
  // Denormalized counts or key metrics for quick display
  subEntityCount?: number;
  activePropertyCount?: number; // If entity is a portfolio or owner
  activeLeaseCount?: number;    // If entity is a property or landlord
  totalUnitsManaged?: number;   // If entity is a property manager or property
  currentOccupancyRate?: number; // If entity is a property or portfolio (as decimal)
  totalPortfolioValue?: number; // If entity is a portfolio or owner
  netOperatingIncomeYTD?: number; // Year-to-date NOI if applicable
}

/*
NOTE: Runtime helper functions and type guards previously in this file
(e.g., isPropertyEntity, isTenantEntity, isVendorEntity, hasActiveLeases)
should be moved to a regular .ts utility file, for example:
`src/lib/entities/entityUtils.ts`.
This keeps .d.ts files strictly for type declarations.
*/