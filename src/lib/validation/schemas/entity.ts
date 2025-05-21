// src/lib/validation/schemas/entity.ts
/**
 * Entity Validation Schemas
 *
 * This module provides Zod validation schemas for entity-related operations
 * including creating, updating, and validating entity records.
 * It should align with the D1 'entities' table and the Zod schema
 * presented in the ProperAccount Technical Reference Guide (pages 8 & 39).
 */

import { z } from 'zod';

// ----------------
// Shared Sub-Schemas (Can be expanded as needed)
// ----------------

/**
 * Validation schema for a structured address.
 */
export const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required').max(191, "Street address is too long."),
  street2: z.string().max(191, "Street address (line 2) is too long.").optional().nullable(),
  city: z.string().min(1, 'City is required').max(100, "City name is too long."),
  state_province: z.string().min(1, 'State/Province is required').max(100, "State/Province is too long."), // Renamed for clarity
  postal_code: z.string().min(1, 'Postal code is required').max(20, "Postal code is too long."), // Renamed for clarity
  country_code: z.string().length(2, 'Country code must be 2 characters (ISO 3166-1 alpha-2)').default('US'), // Renamed for clarity
  is_primary: z.boolean().optional().default(false),
  address_type: z.enum(['physical', 'mailing', 'billing', 'registered']).optional(),
});

/**
 * Validation schema for contact information associated with an entity.
 */
export const contactInfoSchema = z.object({ // Renamed from contactSchema
  email: z.string().email('Invalid email address').max(191).optional().nullable(),
  phone_number: z.string().regex(/^[\d\s+()-.ext]{7,30}$/, 'Invalid phone number format').optional().nullable(), // Renamed
  website_url: z.string().url('Invalid website URL').max(191).optional().nullable(), // Renamed
  contact_person_name: z.string().max(100).optional().nullable(), // Renamed
  contact_person_title: z.string().max(100).optional().nullable(), // Renamed
});

/**
 * Validation schema for tax identification numbers.
 */
export const taxIdentifierSchema = z.object({ // Renamed from taxIdSchema
  type: z.enum(['EIN', 'SSN', 'ITIN', 'VAT', 'GST', 'OTHER_TAX_ID'], {
    errorMap: () => ({ message: "Invalid tax ID type." })
  }),
  value: z.string().min(1, 'Tax ID value is required').max(50, "Tax ID value is too long."),
  // country_code: z.string().length(2, 'Country code for tax ID must be 2 characters').optional(), // Often implicit
  // is_verified: z.boolean().optional().default(false), // Verification status handled elsewhere
});

// ----------------
// Entity Type Schema (Aligning with Tech Ref Guide, page 39)
// ----------------

/**
 * Valid entity types, matching the Zod enum in the Technical Reference Guide.
 */
export const entityTypeEnum = z.enum(['individual', 'company', 'trust', 'partnership'], {
  errorMap: () => ({ message: "Invalid entity type specified." })
});
export type EntityType = z.infer<typeof entityTypeEnum>;

// This broader list can be used for a different classification field if needed,
// but the primary 'type' field should use entityTypeEnum.
export const detailedBusinessTypes = [
  'SOLE_PROPRIETORSHIP', 'LLC_SINGLE_MEMBER', 'LLC_MULTI_MEMBER',
  'S_CORPORATION', 'C_CORPORATION', 'NON_PROFIT', 'FOUNDATION',
  'ESTATE', 'GOVERNMENT_ENTITY', 'PROPERTY_OWNERSHIP', 'OTHER_BUSINESS_TYPE',
] as const;
export const detailedBusinessTypeSchema = z.enum(detailedBusinessTypes).optional().nullable();


// ----------------
// Main Entity Schema (Aligning with Tech Ref Guide for core D1 fields)
// ----------------

/**
 * Base entity schema for creation, reflecting D1 modifiable fields
 * and core application logic.
 * Ref: ProperAccount Technical Reference Guide, page 39 (entitySchema), page 8 (D1 'entities' table)
 */
export const baseEntitySchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: 'Entity name is required' })
    .max(100, { message: 'Entity name cannot exceed 100 characters' }),

  type: entityTypeEnum,

  description: z.string()
    .max(500, { message: 'Description cannot exceed 500 characters' })
    .optional()
    .nullable(),

  // Tax ID is optional but structured if provided (aligns with taxId in Tech Ref Zod schema)
  tax_id: taxIdentifierSchema.omit({type: true}).extend({value: z.string().max(20).optional().nullable()}).transform(val => val?.value || null).optional().nullable(),
  // If a structured tax_id (with type) is needed, use:
  // tax_identifier: taxIdentifierSchema.optional().nullable(),

  parent_id: z.string().uuid({ message: 'Parent ID must be a valid UUID' }).optional().nullable(),

  // Application-specific fields (not directly in simplified D1 schema of Tech Ref, but common)
  legal_name: z.string().max(191, "Legal name is too long.").optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'ARCHIVED', 'DISSOLVED'])
    .default('ACTIVE'),

  // fiscal_year_end_month_day: z.string() // MM-DD
  //   .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, 'Fiscal year end must be in MM-DD format')
  //   .optional().nullable(),

  default_currency_code: z.string().length(3, 'Currency code must be 3 characters (ISO 4217)').default('USD'), // Renamed
  // chart_of_accounts_template_id: z.string().uuid().optional().nullable(),

  // `addresses` and `contact_info` might be stored in related tables or as JSON in D1 if simple.
  // For now, let's assume they are part of the main entity object for simplicity in Zod.
  // primary_address: addressSchema.optional().nullable(),
  // mailing_address: addressSchema.optional().nullable(),
  // contact_information: contactInfoSchema.optional().nullable(),

  // custom_fields: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for creating a new entity.
 * `id`, `created_at`, `updated_at`, `created_by_user_id` are set by the system.
 */
export const createEntityInputSchema = baseEntitySchema; // user_id for created_by will be from session

/**
 * Schema for updating an existing entity. All fields are optional.
 * `id` is typically a path parameter, not in the body.
 */
export const updateEntityInputSchema = baseEntitySchema.partial();

/**
 * Full entity schema including system-generated fields (for server-side representation or responses).
 * This should reflect the D1 'entities' table from Tech Ref (p.8) plus important related data.
 */
export const entitySchema = baseEntitySchema.extend({
  id: z.string().uuid({ message: 'Entity ID must be a valid UUID' }),
  // user_id: z.string().uuid(), // This was in the user's file, but D1 schema in Tech Ref for 'entities' doesn't have it. Access control is via entity_access table.
  created_by_user_id: z.string().uuid({message: "Creator user ID must be valid."}), // For audit
  created_at: z.preprocess((arg) => {
    if (typeof arg === 'string' || typeof arg === 'number') return new Date(arg);
    return arg;
  }, z.date()),
  updated_at: z.preprocess((arg) => {
    if (typeof arg === 'string' || typeof arg === 'number') return new Date(arg);
    return arg;
  }, z.date()),
});

// Export types
export type EntityInput = z.infer<typeof createEntityInputSchema>;
export type EntityUpdateInput = z.infer<typeof updateEntityInputSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Address = z.infer<typeof addressSchema>;
export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type TaxIdentifier = z.infer<typeof taxIdentifierSchema>;


// Relationship, Filter, Pagination, Export schemas can be kept if they are used.
// For brevity here, focusing on the core entity schema alignment.
// Ensure these are consistent if used:
// export const entityRelationshipSchema = z.object({...});
// export const entityFilterSchema = z.object({...});
// export const entityPaginationSchema = z.object({...});
// export const entityExportSchema = z.object({...});


// Helper validation functions (can be moved to a service layer or kept here)
// export function validateEntityCreation(data: unknown): EntityInput {
//   return createEntityInputSchema.parse(data);
// }
// export function validateEntityUpdate(data: unknown): EntityUpdateInput {
//   // For updates, you might receive partial data.
//   // Ensure that if `id` is part of the body, it's also validated,
//   // or handle `id` separately from path params.
//   return updateEntityInputSchema.parse(data);
// }
// export function validateFullEntity(data: unknown): Entity {
//   return entitySchema.parse(data);
// }

export default {
  baseEntitySchema,
  createEntityInputSchema,
  updateEntityInputSchema,
  entitySchema,
  entityTypeEnum,
  addressSchema,
  contactInfoSchema,
  taxIdentifierSchema,
  // ... other exported schemas if kept
};