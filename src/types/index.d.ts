// src/types/index.d.ts
/**
 * Central export point for all shared type definitions across the ProperAccount application.
 * Also defines globally useful branded types and composite data structures.
 */

// Re-export all types from domain-specific definition files
export * from './accounting';
export * from './api';       // Defines DTOs and API response structures
export * from './auth';
export * from './calculations';
export * from './dashboard';
export * from './document';
export * from './entity';
export * from './export';
export * from './import';
export * from './intelligence'; // For AI/ML features
export * from './loan';
export * from './mojo';         // For planned Mojo Wasm integration
export * from './reconciliation';
export * from './report';
export * from './rules';        // For business automation rules
export * from './tax';
export * from './transaction';
export * from './validation';   // May export types inferred from Zod schemas or common validation shapes
export * from './workflow';     // For multi-step process management

// --- Branded Primitive Types for Enhanced Type Safety ---
// These help distinguish different kinds of string IDs at compile time.

export type UserId = string & { readonly __brand: 'UserId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type PropertyId = string & { readonly __brand: 'PropertyId' };
export type UnitId = string & { readonly __brand: 'UnitId' };
export type TenantId = string & { readonly __brand: 'TenantId' };
export type LeaseId = string & { readonly __brand: 'LeaseId' };
export type AccountId = string & { readonly __brand: 'AccountId' }; // Chart of Account ID
export type TransactionId = string & { readonly __brand: 'TransactionId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type LoanId = string & { readonly __brand: 'LoanId' };
export type VendorId = string & { readonly __brand: 'VendorId' };
export type ReportId = string & { readonly __brand: 'ReportId' };
export type RuleId = string & { readonly __brand: 'RuleId' };
export type WorkOrderId = string & { readonly __brand: 'WorkOrderId' };
// Add more branded IDs as needed (e.g., InvoiceId, PaymentId, etc.)


// --- Composite Types (Aggregating data from multiple domains for specific views/purposes) ---

// Forward-declare imported types for composite structures to satisfy TypeScript compiler
// Actual DTOs/types are imported from their respective files.
import type { PropertyDto, LeaseDto, TenantDto as ApiTenantDto, PaymentDto, WorkOrderDto } from './api';
import type { IncomeStatementReport, BalanceSheetReport } from './report';
import type { PropertyAccountBalance } from './accounting';
import type { MetricTrendIndicator } from './dashboard';
import type { Document } from './document';
import type { Entity } from './entity';
import type { LoanSummary } from './loan';
import type { TaxEstimate } from './tax';

export interface PropertyFinancialSummary {
  property: PropertyDto;
  currentPeriodIncomeStatement?: IncomeStatementReport; // Changed from currentMonthPL for generality
  yearToDatePerformanceMetrics?: PropertyAccountBalance; // Or a more specific performance DTO
  occupancyTrend?: MetricTrendIndicator;
  openMaintenanceRequests?: WorkOrderDto[]; // Changed from maintenanceBacklog
  upcomingLeaseExpirations?: Array<{
    lease: LeaseDto;
    daysUntilExpiration: number;
    tenantNames: string[]; // Tenants can be multiple on a lease
  }>;
  keyFinancialRatios?: {
    noi?: number;
    capRate?: number; // Based on current value or purchase price
    cashFlow?: number;
    operatingExpenseRatio?: number;
  };
}

export interface TenantPortfolioView { // Renamed from TenantPortfolio
  tenant: ApiTenantDto; // Using the DTO from api.d.ts
  activeLeases: LeaseDto[];
  recentPayments: PaymentDto[]; // Last N payments or payments in current period
  openMaintenanceRequests: WorkOrderDto[];
  sharedDocuments?: Document[]; // Documents specifically shared with this tenant
  currentAccountBalance: number; // Positive if owes, negative if credit
  // creditScore?: number; // Consider privacy implications and source of this data
  leaseSummaries?: Array<{
    leaseId: LeaseId;
    propertyAddress: string;
    unitNumber: string;
    rentAmount: number;
    leaseEndDate: string; // ISO Date
  }>;
}

export interface EntityFinancialOverview { // Renamed from EntityFinancialPosition
  entity: Entity; // Core entity details
  currentBalanceSheet?: BalanceSheetReport;
  keyCashMetrics?: {
    cashOnHand: number;
    accountsReceivable: number;
    accountsPayable: number;
    cashBurnRate?: number; // If applicable
  };
  propertyPortfolioSummary?: {
    totalProperties: number;
    totalUnits: number;
    overallOccupancyRate?: number;
    totalEstimatedValue?: number;
    aggregateNOI?: number;
  };
  loanOverview?: {
    totalOutstandingLoanBalance: number;
    upcomingPrincipalPayments: number;
    weightedAverageInterestRate?: number;
  };
  taxSnapshot?: {
    estimatedCurrentYearLiability?: number;
    lastFiledYear?: number;
  };
  // Consider adding summary of recent financial activity or alerts
}


/**
 * Context for a SaaS tenant (if ProperAccount itself becomes a multi-tenant platform for accounting firms).
 * For the MVP targeting solo users, this might be less relevant initially but good for future planning.
 */
export interface SaaSTenantContext {
  /** Unique identifier for the SaaS tenant (e.g., an accounting firm). */
  saasTenantId: string;
  /** Subscription plan for this SaaS tenant. */
  subscriptionPlan: 'free_tier' | 'start_tier_mvp' | 'pro_tier' | 'enterprise_custom';
  featureLimits: {
    maxEntities: number;          // Max number of business entities they can manage
    maxProperties: number;        // Max properties across all their entities
    maxTransactionsPerMonth: number;
    maxDocumentStorageBytes: number;
    maxUsersPerEntity: number;    // Users they can invite to their managed entities
    maxAutomationRules?: number;
    apiAccessRateLimit?: number; // Requests per minute
  };
  currentUsage: {
    entitiesCount: number;
    propertiesCount: number;
    transactionsThisBillingCycle: number;
    documentStorageUsedBytes: number;
    totalUsersInManagedEntities: number;
  };
  enabledFeatures: { // Boolean flags for features available under their plan
    aiCategorization: boolean;
    bankReconciliationAutomation: boolean;
    advancedTaxPlanning: boolean;
    apiAccessEnabled: boolean;
    customReportingBuilder: boolean;
    multiCurrencySupport: boolean;
    advancedUserRoles: boolean;
    mojoPoweredCalculations?: boolean; // For Pro tier
  };
  billingInfo?: {
    nextBillingDate?: string; // ISO Date
    paymentMethodStatus?: 'valid' | 'requires_update';
  };
}

/**
 * Global application configuration, potentially loaded at startup.
 */
export interface ApplicationConfig { // Renamed from AppConfig for clarity
  readonly environment: 'development' | 'preview' | 'production' | 'test';
  /** Flags for globally toggling major application features. */
  readonly globalFeatureToggles: Record<string, boolean>;
  readonlyisInMaintenanceMode: boolean;
  readonly applicationVersion: string; // e.g., "1.0.0"
  readonly buildTimestamp?: string; // ISO DateTime
  readonly publicApiUrl?: string; // Base URL for public facing parts of the API
  readonly supportEmail?: string;
  readonly termsOfServiceUrl?: string;
  readonly privacyPolicyUrl?: string;
}