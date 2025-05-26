// src/types/validation.d.ts
import { z } from 'zod';

/**
 * Reusable validation schemas for common data types
 */

// Money and financial values
export const MoneySchema = z.number().min(0).multipleOf(0.01);
export const PercentageSchema = z.number().min(0).max(100);
export const InterestRateSchema = z.number().min(0).max(100);

// Identifiers
export const UUIDSchema = z.string().uuid();
export const EINSchema = z.string().regex(/^\d{2}-\d{7}$/);
export const SSNSchema = z.string().regex(/^\d{3}-\d{2}-\d{4}$/);
export const PhoneSchema = z.string().regex(/^\+?1?\d{10,14}$/);

// Addresses
export const PropertyAddressSchema = z.object({
  street: z.string().min(1).max(200),
  unit: z.string().optional(),
  city: z.string().min(1).max(100),
  state: z.string().length(2).toUpperCase(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US')
});

// Date/Time
export const UnixTimestampSchema = z.number().int().positive();
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const FiscalYearEndSchema = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

// Real Estate specific
export const PropertyTypeSchema = z.enum(['residential', 'commercial', 'mixed', 'land']);
export const UnitStatusSchema = z.enum(['available', 'occupied', 'maintenance', 'reserved']);
export const LeaseStatusSchema = z.enum(['draft', 'active', 'expired', 'terminated']);

// Accounting specific
export const AccountSystemTypeSchema = z.enum(['asset', 'liability', 'equity', 'income', 'expense']);
export const TransactionStatusSchema = z.enum(['pending', 'posted', 'voided']);

// Entity validation
export const EntityInputSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['individual', 'company', 'trust', 'partnership', 'property', 'tenant', 'vendor']),
  description: z.string().max(1000).optional().nullable(),
  ein: EINSchema.optional().nullable(),
  legalName: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  legalAddress: z.string().max(500).optional().nullable(),
  businessType: z.string().optional().nullable(),
  propertyDetails: z.object({
    propertyType: PropertyTypeSchema.optional(),
    propertyAddress: z.string().optional(),
    parcelNumber: z.string().optional(),
    yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
    squareFootage: z.number().positive().optional(),
    unitCount: z.number().int().positive().optional(),
    lotSize: z.number().positive().optional(),
    zoning: z.string().optional(),
    taxId: z.string().optional(),
    purchaseDate: DateStringSchema.optional(),
    purchasePrice: MoneySchema.optional(),
    currentValue: MoneySchema.optional(),
    propertyManagerId: UUIDSchema.optional()
  }).optional().nullable(),
  tenantInfo: z.object({
    leaseStartDate: DateStringSchema.optional(),
    leaseEndDate: DateStringSchema.optional(),
    monthlyRent: MoneySchema.optional(),
    securityDeposit: MoneySchema.optional(),
    propertyId: UUIDSchema.optional()
  }).optional().nullable(),
  vendorInfo: z.object({
    serviceTypes: z.array(z.string()).optional(),
    taxIdType: z.enum(['EIN', 'SSN', 'Other']).optional(),
    w9OnFile: z.boolean().optional(),
    insuranceExpiry: DateStringSchema.optional(),
    licenseNumber: z.string().optional()
  }).optional().nullable(),
  registeredAgent: z.object({
    name: z.string(),
    address: z.string()
  }).optional().nullable(),
  formationDate: DateStringSchema.optional().nullable(),
  jurisdiction: z.string().max(100).optional().nullable(),
  parentId: UUIDSchema.optional().nullable(),
  isActive: z.boolean().default(true),
  allowsSubEntities: z.boolean().default(false),
  customFields: z.record(z.unknown()).optional().nullable()
});

// Transaction validation
export const TransactionLineInputSchema = z.object({
  entity_account_id: UUIDSchema,
  amount: MoneySchema,
  is_debit: z.boolean(),
  memo: z.string().max(500).optional().nullable(),
  tax_code: z.string().max(50).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  property_id: UUIDSchema.optional().nullable()
});

export const TransactionInputSchema = z.object({
  entity_id: UUIDSchema,
  journal_id: UUIDSchema.optional().nullable(),
  date: UnixTimestampSchema,
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional().nullable(),
  status: TransactionStatusSchema.default('pending'),
  is_reconciled: z.boolean().default(false),
  document_url: z.string().url().optional().nullable(),
  transaction_type: z.string().optional(),
  related_entity_id: UUIDSchema.optional().nullable(),
  lines: z.array(TransactionLineInputSchema).min(2).refine(
    (lines) => {
      const totalDebits = lines.filter(l => l.is_debit).reduce((sum, l) => sum + l.amount, 0);
      const totalCredits = lines.filter(l => !l.is_debit).reduce((sum, l) => sum + l.amount, 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    { message: "Transaction must balance (debits must equal credits)" }
  )
});

// Property management validation
export const CreatePropertyRequestSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  propertyType: PropertyTypeSchema,
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  purchasePrice: MoneySchema.optional(),
  units: z.array(z.object({
    unitNumber: z.string().min(1).max(50),
    bedrooms: z.number().int().min(0).max(10).optional(),
    bathrooms: z.number().min(0).max(10).optional(),
    squareFootage: z.number().positive().optional(),
    monthlyRent: MoneySchema
  })).optional()
});

export const CreateLeaseRequestSchema = z.object({
  propertyId: UUIDSchema,
  unitId: UUIDSchema,
  tenantId: UUIDSchema,
  startDate: DateStringSchema,
  endDate: DateStringSchema,
  monthlyRent: MoneySchema,
  securityDeposit: MoneySchema,
  terms: z.record(z.unknown()).optional()
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: "End date must be after start date" }
);

// Loan validation
export const LoanInputSchema = z.object({
  entity_id: UUIDSchema,
  borrower_name: z.string().max(200).optional().nullable(),
  lender_name: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  loan_type: z.string(),
  original_principal: MoneySchema,
  interest_rate: InterestRateSchema,
  interest_rate_type: z.enum(['fixed', 'variable']),
  calculation_method: z.enum(['simple', 'compound']),
  origination_date: UnixTimestampSchema,
  maturity_date: UnixTimestampSchema,
  payment_frequency: z.enum(['monthly', 'quarterly', 'annually', 'lump_sum', 'custom']),
  payment_amount: MoneySchema,
  status: z.enum(['active', 'pending_approval', 'paid_off', 'defaulted', 'cancelled', 'draft']).optional(),
  collateral_description: z.string().max(1000).optional().nullable(),
  collateral_value: MoneySchema.optional().nullable(),
  next_payment_date: UnixTimestampSchema.optional().nullable(),
  principal_account_id: UUIDSchema.optional().nullable(),
  interest_account_id: UUIDSchema.optional().nullable(),
  is_receivable: z.boolean(),
  property_id: UUIDSchema.optional().nullable(),
  original_ltv: PercentageSchema.optional().nullable(),
  dscr: z.number().positive().optional().nullable()
});

// Helper function to create custom validators
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}