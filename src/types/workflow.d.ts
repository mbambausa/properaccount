// src/types/workflow.d.ts
/**
 * Defines TypeScript interfaces for managing multi-step workflows
 * within the ProperAccount application, including state, steps,
 * and specific workflow implementations for key business processes.
 */

import type { z } from 'zod'; // For typing validationSchema

/**
 * Represents a single step within a workflow.
 */
export interface WorkflowStep {
  /** Unique identifier for this step within the workflow definition. */
  id: string;
  name: string; // User-friendly name for the step
  description?: string | null;
  /** Is this step mandatory to complete the workflow? */
  required?: boolean; // Defaults to true if not specified
  /** Optional Zod schema for validating data collected at this step. */
  validationSchema?: z.ZodTypeAny; // Using z.ZodTypeAny for flexibility
  /** Order of this step in the workflow. */
  order?: number;
  /** UI component to render for this step. */
  componentPath?: string; // e.g., path to an Astro component
  /** Permissions required to complete this step. */
  requiredPermissions?: string[]; // Using string from Permission enum in auth.d.ts
}

/**
 * Generic state for a workflow instance.
 * @template TData The shape of the data collected by this workflow.
 */
export interface WorkflowState<TData = Record<string, any>> {
  /** Unique identifier (UUID) for this specific workflow instance. */
  readonly workflowInstanceId: string; // Renamed from workflowId for clarity
  /** Identifier of the WorkflowTemplate this instance is based on. */
  readonly workflowDefinitionId: string; // Renamed from workflowId (was ambiguous)
  /** ID of the user who initiated or is currently working on this workflow. */
  userId: string;
  /** Optional: ID of the entity this workflow pertains to. */
  entityId?: string | null;

  /** ID of the current active step in the workflow. */
  currentStepId: string; // Renamed from currentStep
  /** Array of step IDs that have been completed. */
  completedStepIds: string[]; // Renamed from completedSteps
  /** Array of step IDs that have been intentionally skipped. */
  skippedStepIds?: string[] | null; // Renamed from skippedSteps

  /** Data collected throughout the workflow, specific to TData. */
  formData: Partial<TData>; // Renamed from data for clarity
  /** Validation errors for the current step's data. Key is field path. */
  currentStepValidationErrors?: Record<string, string[]> | null; // Renamed from validationErrors
  /** General warnings related to the workflow state or data. Key is field or general area. */
  workflowWarnings?: Record<string, string[]> | null; // Renamed from warnings

  // Navigation and status flags
  canProceedToNextStep: boolean; // Renamed from canProceed
  canGoBackToPreviousStep: boolean; // Renamed from canGoBack
  canCurrentStepBeSkipped?: boolean; // Renamed from canSkip
  isWorkflowComplete: boolean; // True if all required steps are completed
  isWorkflowTerminated?: boolean; // If workflow was manually terminated before completion

  /** Unix timestamp (seconds) when the workflow instance was completed. */
  completedAtTimestamp?: number | null; // Renamed from completedAt
  /** Unix timestamp (seconds) when the workflow instance was started. */
  readonly startedAtTimestamp: number; // Renamed from startedAt
  /** Unix timestamp (seconds) when any data in this workflow state was last updated. */
  lastUpdatedAtTimestamp: number; // Renamed from lastUpdatedAt
  workflowInstanceStatus?: 'in_progress' | 'completed' | 'paused' | 'terminated' | 'error';
}

// --- Specific Workflow Implementations ---
// These extend the generic WorkflowState with data specific to each business process.

/**
 * Data structure for the Lease Creation Workflow.
 */
export interface LeaseCreationWorkflowData {
  propertyId?: string | null; // Selected property ID
  unitId?: string | null;     // Selected unit ID
  tenantPrimaryContactInfo?: { // Renamed from tenantInfo
    name: string;
    email: string;
    phone?: string | null;
    // SSN should be handled with extreme care, consider if needed at this stage or only for background checks
    // ssnOrTaxId?: string | null; 
    currentAddress?: string | null;
    employerName?: string | null; // Renamed from employer
    monthlyGrossIncome?: number | null; // Renamed from monthlyIncome
  } | null;
  coApplicants?: Array<LeaseCreationWorkflowData['tenantPrimaryContactInfo']>;
  leaseTermsAndConditions?: { // Renamed from leaseTerms
    /** Lease start date (ISO 8601 string: YYYY-MM-DD). */
    startDate: string;
    /** Lease end date (ISO 8601 string: YYYY-MM-DD). */
    endDate: string;
    monthlyRentAmount: number; // Renamed from monthlyRent
    securityDepositAmount: number; // Renamed from securityDeposit
    petDepositAmount?: number | null; // Renamed from petDeposit
    includedUtilities?: string[] | null; // e.g., ["water", "trash"]
    specialLeaseTermsOrAddenda?: string | null; // Renamed from specialTerms
    leaseType?: 'fixed_term' | 'month_to_month';
    lateFeePolicy?: string;
  } | null;
  supportingDocuments?: { // Renamed from documents
    leaseApplicationFormId?: string | null; // ID of stored document
    creditReportDocumentId?: string | null;
    incomeVerificationDocumentIds?: string[] | null;
    referenceLetterDocumentIds?: string[] | null;
    signedLeaseAgreementId?: string | null; // After signing
  } | null;
  digitalSignatures?: { // Renamed from signatures
    tenantSignatureDataUrl?: string | null; // Renamed from tenantSignature
    /** Unix timestamp (seconds). */
    tenantSignedAtTimestamp?: number | null; // Renamed from tenantSignedAt
    landlordOrAgentSignatureDataUrl?: string | null; // Renamed from landlordSignature
    /** Unix timestamp (seconds). */
    landlordOrAgentSignedAtTimestamp?: number | null; // Renamed from landlordSignedAt
  } | null;
  moveInChecklistCompleted?: boolean;
  firstMonthRentAndDepositPaid?: boolean;
}
export interface LeaseCreationWorkflowState extends WorkflowState<LeaseCreationWorkflowData> {
  // Additional state specific to this workflow instance, if any
  availablePropertyOptions?: Array<{ id: string; name: string; address: string }>;
  availableUnitOptionsForSelectedProperty?: Array<{ id: string; unitNumber: string; monthlyRent: number; status: string }>;
  creditCheckRequestStatus?: 'not_started' | 'pending' | 'completed_approved' | 'completed_denied' | 'failed_to_run';
  backgroundCheckRequestStatus?: 'not_started' | 'pending' | 'completed_clear' | 'completed_issues_found' | 'failed_to_run';
  leaseDocumentGeneratedUrl?: string | null; // URL to the generated lease PDF for review/signing
}

/**
 * Data structure for the Property Acquisition Workflow.
 */
export interface PropertyAcquisitionWorkflowData {
  targetPropertyInfo?: { // Renamed from propertyInfo
    fullAddress: string; // Renamed from address
    propertyType: string; // e.g., 'Single Family', 'Multi-Family (4 units)'
    askingPrice?: number | null;
    yearConstructed?: number | null; // Renamed from yearBuilt
    totalSquareFootage?: number | null; // Renamed from squareFootage
    numberOfUnits?: number | null; // Renamed from units
    initialNotes?: string | null;
  } | null;
  dueDiligenceFinancialAnalysis?: { // Renamed from financialAnalysis
    offerPrice?: number | null; // Renamed from purchasePrice to distinguish from final
    estimatedDownPayment: number;
    anticipatedLoanAmount: number;
    anticipatedInterestRatePercent: number; // Renamed from interestRate
    estimatedClosingCosts: number;
    projectedMonthlyRentalIncome?: number | null;
    projectedMonthlyOperatingExpenses?: number | null;
    calculatedCapRate?: number | null;
    calculatedCashOnCashReturn?: number | null;
    marketCompsDocumentId?: string | null; // Link to comps analysis document
  } | null;
  propertyInspectionDetails?: { // Renamed from inspection
    /** Inspection date (ISO 8601 string: YYYY-MM-DD). */
    inspectionScheduledDate?: string | null; // Renamed from inspectionDate
    inspectorNameOrCompany?: string | null; // Renamed from inspectorName
    majorIssuesIdentified?: string[] | null; // Renamed from majorIssues
    estimatedRepairCosts?: number | null; // Renamed from estimatedRepairs
    inspectionReportDocumentId?: string | null; // Renamed from reportUrl
    inspectionContingencyDeadline?: string | null; // ISO Date
  } | null;
  financingDetails?: { // Renamed from financing
    lenderName?: string | null; // Renamed from lender
    loanTypeAppliedFor?: string | null; // Renamed from loanType
    isFinancingApproved?: boolean; // Renamed from approved
    approvalConditionsOrTerms?: string[] | null; // Renamed from conditions
    financingContingencyDeadline?: string | null; // ISO Date
    loanCommitmentLetterDocumentId?: string | null;
  } | null;
  closingProcessDetails?: { // Renamed from closing
    /** Scheduled closing date (ISO 8601 string: YYYY-MM-DD). */
    scheduledClosingDate?: string | null; // Renamed from closingDate
    titleCompanyName?: string | null; // Renamed from titleCompany
    finalWalkthroughCompleted?: boolean; // Renamed from finalWalkthrough
    closingStatementDocumentId?: string | null;
    keysReceived?: boolean;
    fundsTransferred?: boolean;
  } | null;
  offerDetails?: {
    offerAmount: number;
    /** Offer date (ISO 8601 string: YYYY-MM-DD). */
    offerDate: string;
    contingencies?: string[]; // e.g., "inspection", "financing", "appraisal"
    offerStatus?: 'submitted' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
    acceptanceDeadline?: string | null; // ISO Date
  };
}
export interface PropertyAcquisitionWorkflowState extends WorkflowState<PropertyAcquisitionWorkflowData> {
  // Additional state
  comparableSalesData?: Array<{
    address: string;
    soldPrice: number;
    /** Sold date (ISO 8601 string: YYYY-MM-DD). */
    soldDate: string;
    squareFootage?: number | null;
    pricePerSqFt?: number | null;
  }> | null;
  appraisalValue?: number | null;
  /** Appraisal date (ISO 8601 string: YYYY-MM-DD). */
  appraisalDate?: string | null;
}

/**
 * Data structure for the Month-End Close Workflow.
 */
export interface MonthEndCloseWorkflowData {
  bankAccountReconciliations?: Record<string, { // Key is Account ID
    accountId: string;
    accountName?: string;
    status: 'not_started' | 'in_progress' | 'completed_balanced' | 'completed_with_discrepancy';
    unreconciledDifference?: number | null;
    reconciliationReportDocumentId?: string | null;
  }> | null;
  accrualEntriesToPost?: Array<{ // Renamed from accruals
    entryDescription: string; // Renamed from description
    amountToAccrue: number; // Renamed from amount
    debitAccountId: string;
    creditAccountId: string; // Renamed from accountId
    isPosted: boolean; // Renamed from completed
    reversalDate?: string | null; // ISO Date, if it's a reversing accrual
  }> | null;
  depreciationAndAmortization?: { // Renamed from depreciation
    isCalculatedAndPosted: boolean; // Renamed from calculated
    depreciationEntries?: Array<{ assetIdOrDescription: string; depreciationAmount: number; expenseAccountId: string; accumulatedDepreciationAccountId: string; }> | null;
  } | null;
  financialReportsGeneration?: { // Renamed from reports
    trialBalanceGenerated: boolean;
    incomeStatementGenerated: boolean;
    balanceSheetGenerated: boolean;
    cashFlowStatementGenerated?: boolean;
    rentRollGenerated?: boolean; // Real estate specific
    supportingSchedulesGenerated?: string[]; // e.g., AR Aging, AP Aging
  } | null;
  finalReviewAndAdjustments?: { // Renamed from review
    reviewedByUserId?: string | null; // Renamed from reviewedBy
    /** Unix timestamp (seconds). */
    reviewedAtTimestamp?: number | null; // Renamed from reviewedAt
    reviewNotes?: string | null;
    finalAdjustingJournalEntries?: Array<{ description: string; debitAccountId: string; creditAccountId: string; amount: number; }> | null;
  } | null;
  periodLockConfirmation?: {
    isPeriodLocked: boolean;
    /** Unix timestamp (seconds). */
    lockedAtTimestamp?: number | null;
    lockedByUserId?: string | null;
  };
}
export interface MonthEndCloseWorkflowState extends WorkflowState<MonthEndCloseWorkflowData> {
  /** Period being closed, e.g., { month: 6, year: 2025 } for June 2025. */
  closingPeriod: { month: number; year: number }; // 1-12 for month
  entityId: string; // Entity for which month-end is being closed
  predefinedChecklistItems?: Array<{
    taskDescription: string; // Renamed from task
    isRequiredTask: boolean; // Renamed from required
    isCompletedTask: boolean; // Renamed from completed
    completedByUserId?: string | null;
    /** Unix timestamp (seconds). */
    completedAtTimestamp?: number | null;
  }> | null;
}

/**
 * Data structure for the Tenant Move-Out Workflow.
 */
export interface TenantMoveOutWorkflowData {
  tenantDetails?: { // Renamed from tenant
    tenantId: string; // Renamed from id
    tenantName: string; // Renamed from name
    unitId: string;
    unitAddress?: string;
    /** Original lease end date (ISO 8601 string: YYYY-MM-DD). */
    scheduledLeaseEndDate: string; // Renamed from leaseEndDate
    /** Actual move-out date (ISO 8601 string: YYYY-MM-DD). */
    actualMoveOutDate?: string | null;
  } | null;
  moveOutInspectionDetails?: { // Renamed from moveOutInspection
    /** Scheduled inspection date (ISO 8601 string: YYYY-MM-DD). */
    inspectionScheduledDate?: string | null;
    /** Actual inspection date (ISO 8601 string: YYYY-MM-DD). */
    inspectionCompletedDate?: string | null;
    inspectorNameOrCompany?: string | null; // Renamed from inspector
    damagesIdentified?: Array<{
      itemDescription: string; // Renamed from description
      estimatedRepairCost: number; // Renamed from estimatedCost
      photoDocumentIds?: string[] | null; // Renamed from photos
      tenantResponsibilityPercent?: number; // 0-100
    }> | null;
    cleaningRequiredByTenant?: boolean;
    overallUnitConditionNotes?: string;
    totalEstimatedDeductionsFromDeposit?: number | null;
  } | null;
  finalAccountSettlement?: { // Renamed from finalAccounting
    finalRentProrationAmount?: number | null;
    outstandingUtilityCharges?: number | null;
    damageRepairCharges?: number | null; // Renamed from damages
    cleaningCharges?: number | null; // Renamed from cleaning
    originalSecurityDepositAmount: number; // Renamed from securityDeposit
    interestOnDepositIfApplicable?: number | null;
    totalDeductions?: number;
    securityDepositRefundAmount?: number | null; // Renamed from refundAmount
    balanceOwedByTenant?: number | null; // Renamed from amountOwed
    /** Date final settlement statement sent (ISO 8601 string: YYYY-MM-DD). */
    settlementStatementSentDate?: string | null;
    /** Date refund issued or payment received (ISO 8601 string: YYYY-MM-DD). */
    settlementFinalizedDate?: string | null;
  } | null;
  unitTurnoverAndPreparation?: { // Renamed from unitTurnover
    cleaningScheduledDate?: string | null; // ISO Date
    repairsScheduledCompletionDate?: string | null; // ISO Date
    paintingRequired?: boolean;
    flooringReplacementOrCleaning?: 'replace' | 'clean' | 'none';
    /** Estimated date unit will be ready for new tenant (ISO 8601 string: YYYY-MM-DD). */
    estimatedReadyForOccupancyDate?: string | null; // Renamed from estimatedReadyDate
    keysReturnedAndLocksChanged?: boolean;
  } | null;
  moveOutDocumentationIds?: { // Renamed from documentation
    tenantMoveOutNoticeDocumentId?: string | null; // Renamed from moveOutForm
    moveOutInspectionReportDocumentId?: string | null; // Renamed from inspectionReport
    finalAccountSettlementStatementDocumentId?: string | null; // Renamed from finalStatement
    proofOfSecurityDepositRefundDocumentId?: string | null; // Renamed from refundReceipt
    forwardingAddressConfirmationDocumentId?: string | null;
  } | null;
}
export interface TenantMoveOutWorkflowState extends WorkflowState<TenantMoveOutWorkflowData> {
  // Additional state
  /** Calculated days until scheduled move-out. */
  daysUntilScheduledMoveOut?: number | null;
  tenantForwardingAddress?: string | null;
  finalDispositionOfKeys?: 'returned' | 'not_returned' | 'pending';
}

// --- Workflow Event and Template Types ---

/**
 * Represents an event that occurred within a workflow instance.
 * Useful for audit trails or triggering other actions.
 */
export interface WorkflowEvent {
  /** ID of the workflow instance this event belongs to. */
  readonly workflowInstanceId: string;
  eventType:
    | 'workflow_started'
    | 'step_begun' // User started working on a step
    | 'step_data_saved' // Data for a step was saved (maybe not completed)
    | 'step_completed_successfully' // Renamed from step_completed
    | 'step_skipped_by_user' // Renamed from step_skipped
    | 'step_validation_failed' // Renamed from validation_failed
    | 'workflow_data_globally_updated' // Renamed from data_updated
    | 'workflow_completed_fully' // Renamed from completed
    | 'workflow_cancelled_or_terminated' // Renamed from cancelled
    | 'workflow_paused'
    | 'workflow_resumed'
    | 'workflow_error_occurred'; // Renamed from error
  /** Unix timestamp (seconds) when the event occurred. */
  readonly eventTimestamp: number; // Renamed from timestamp
  readonly userId: string; // User associated with the event, if applicable
  stepId?: string | null; // ID of the step related to this event
  eventData?: any | null; // Contextual data for the event (e.g., field changed, error details)
  // errorDetails?: string | null; // Renamed from error for specific error context
}

/**
 * Template for creating new workflow instances.
 * Defines the structure, steps, and default data for a reusable workflow.
 */
export interface WorkflowTemplate {
  /** Unique identifier (UUID) for this workflow template. */
  readonly id: string;
  templateName: string; // Renamed from name
  templateDescription?: string | null; // Renamed from description
  workflowCategory: 'lease_management' | 'property_onboarding' | 'financial_closing_process' | 'maintenance_repair' | 'tenant_relations' | 'compliance_legal'; // Renamed from category
  definedSteps: WorkflowStep[]; // Renamed from steps
  initialDefaultData?: any | null; // Renamed from defaultData (Partial<TData> for the workflow)
  /** Permissions required to initiate a workflow from this template. */
  initiationPermissions?: string[] | null; // Renamed from permissions
  /** Estimated typical duration to complete this workflow (e.g., in days or hours). */
  estimatedCompletionDurationValue?: number | null; // Renamed from estimatedDuration
  estimatedCompletionDurationUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
  tags?: string[];
  version?: string; // Template version
  isSystemTemplate?: boolean; // If provided by the application vs. user-created
}