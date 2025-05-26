// src/types/index.d.ts
/**
 * Central export point for all type definitions
 */

// Core type exports
export * from './accounting';
export * from './api';
export * from './auth';
export * from './dashboard';
export * from './document';
export * from './entity';
export * from './export';
export * from './import';
export * from './intelligence';
export * from './loan';
export * from './reconciliation';
export * from './report';
export * from './rules';
export * from './tax';
export * from './transaction';

// New type exports
export * from './validation';
export * from './workflow';
export * from './calculations';
export * from './mojo';

// Branded types for type safety
export type UserId = string & { __brand: 'UserId' };
export type EntityId = string & { __brand: 'EntityId' };
export type PropertyId = string & { __brand: 'PropertyId' };
export type TenantId = string & { __brand: 'TenantId' };
export type AccountId = string & { __brand: 'AccountId' };
export type TransactionId = string & { __brand: 'TransactionId' };
export type DocumentId = string & { __brand: 'DocumentId' };

// Composite types that span multiple domains
export interface PropertyFinancialSummary {
  property: import('./api').PropertyDto;
  currentMonthPL: import('./report').IncomeStatementReport;
  ytdPerformance: import('./accounting').PropertyAccountBalance;
  occupancyTrend: import('./dashboard').MetricTrend;
  maintenanceBacklog: import('./api').WorkOrderDto[];
  upcomingLeaseExpirations: Array<{
    lease: import('./api').LeaseDto;
    daysUntilExpiration: number;
    tenant: import('./api').TenantDto;
  }>;
}

export interface TenantPortfolio {
  tenant: import('./api').TenantDto;
  activeLeases: import('./api').LeaseDto[];
  paymentHistory: import('./api').PaymentDto[];
  maintenanceRequests: import('./api').WorkOrderDto[];
  documents: import('./document').Document[];
  accountBalance: number;
  creditScore?: number;
}

export interface EntityFinancialPosition {
  entity: import('./entity').Entity;
  balanceSheet: import('./report').BalanceSheetReport;
  cashPosition: number;
  receivables: number;
  payables: number;
  properties?: PropertyFinancialSummary[];
  loans?: import('./loan').LoanSummary[];
  taxLiability?: import('./tax').TaxEstimate;
}

// Multi-tenancy support (if needed in future)
export interface TenantContext {
  tenantId: string;
  subscription: 'free' | 'pro' | 'enterprise';
  limits: {
    maxEntities: number;
    maxProperties: number;
    maxTransactionsPerMonth: number;
    maxDocumentStorage: number; // bytes
    maxUsers: number;
  };
  usage: {
    entities: number;
    properties: number;
    transactionsThisMonth: number;
    documentStorage: number;
    users: number;
  };
  features: {
    aiCategorization: boolean;
    bankReconciliation: boolean;
    taxPlanning: boolean;
    apiAccess: boolean;
    customReports: boolean;
    multiCurrency: boolean;
  };
}

// Global app state types
export interface AppConfig {
  environment: 'development' | 'preview' | 'production';
  features: Record<string, boolean>;
  maintenanceMode: boolean;
  version: string;
}