// src/types/workflow.d.ts
/**
 * Workflow state management types
 */

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  validationSchema?: any; // Zod schema
}

export interface WorkflowState<T> {
  workflowId: string;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  data: Partial<T>;
  validationErrors?: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  canProceed: boolean;
  canGoBack: boolean;
  canSkip: boolean;
  completedAt?: number;
  startedAt: number;
  lastUpdatedAt: number;
}

// Specific workflow implementations

export interface LeaseCreationWorkflow extends WorkflowState<{
  propertyId: string;
  unitId: string;
  tenantInfo: {
    name: string;
    email: string;
    phone?: string;
    ssn?: string;
    currentAddress?: string;
    employer?: string;
    monthlyIncome?: number;
  };
  leaseTerms: {
    startDate: string;
    endDate: string;
    monthlyRent: number;
    securityDeposit: number;
    petDeposit?: number;
    utilities: string[];
    specialTerms?: string;
  };
  documents: {
    application?: string;
    creditReport?: string;
    incomeVerification?: string[];
    references?: string[];
  };
  signatures: {
    tenantSignature?: string;
    tenantSignedAt?: number;
    landlordSignature?: string;
    landlordSignedAt?: number;
  };
}> {
  steps: ['property_selection', 'unit_selection', 'tenant_info', 'lease_terms', 'documents', 'review', 'signatures'];
  propertyOptions?: Array<{ id: string; name: string; address: string }>;
  unitOptions?: Array<{ id: string; unitNumber: string; monthlyRent: number; status: string }>;
  creditCheckStatus?: 'pending' | 'completed' | 'failed';
  backgroundCheckStatus?: 'pending' | 'completed' | 'failed';
}

export interface PropertyAcquisitionWorkflow extends WorkflowState<{
  propertyInfo: {
    address: string;
    type: string;
    askingPrice: number;
    yearBuilt?: number;
    squareFootage?: number;
    units?: number;
  };
  financialAnalysis: {
    purchasePrice: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    closingCosts: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    capRate?: number;
    cashOnCashReturn?: number;
  };
  inspection: {
    inspectionDate?: string;
    inspectorName?: string;
    majorIssues?: string[];
    estimatedRepairs?: number;
    reportUrl?: string;
  };
  financing: {
    lender?: string;
    loanType?: string;
    approved?: boolean;
    conditions?: string[];
  };
  closing: {
    closingDate?: string;
    titleCompany?: string;
    finalWalkthrough?: boolean;
    documentsReceived?: string[];
  };
}> {
  steps: ['property_info', 'financial_analysis', 'offer', 'inspection', 'financing', 'closing'];
  comparables?: Array<{
    address: string;
    soldPrice: number;
    soldDate: string;
    squareFootage: number;
    pricePerSqFt: number;
  }>;
}

export interface MonthEndCloseWorkflow extends WorkflowState<{
  reconciliations: Record<string, {
    accountId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    discrepancies?: number;
  }>;
  accruals: Array<{
    description: string;
    amount: number;
    accountId: string;
    completed: boolean;
  }>;
  depreciation: {
    calculated: boolean;
    entries?: Array<{ assetId: string; amount: number }>;
  };
  reports: {
    trialBalance: boolean;
    incomeStatement: boolean;
    balanceSheet: boolean;
    rentRoll: boolean;
  };
  review: {
    reviewedBy?: string;
    reviewedAt?: number;
    notes?: string;
    adjustments?: Array<{ description: string; amount: number }>;
  };
}> {
  steps: ['reconciliations', 'accruals', 'depreciation', 'adjustments', 'reports', 'review', 'lock_period'];
  period: { month: number; year: number };
  entityId: string;
  checklistItems?: Array<{
    task: string;
    required: boolean;
    completed: boolean;
    completedBy?: string;
    completedAt?: number;
  }>;
}

export interface TenantMoveOutWorkflow extends WorkflowState<{
  tenant: {
    id: string;
    name: string;
    unitId: string;
    leaseEndDate: string;
  };
  moveOutInspection: {
    scheduledDate?: string;
    completedDate?: string;
    inspector?: string;
    damages?: Array<{
      description: string;
      estimatedCost: number;
      photos?: string[];
    }>;
    cleaningRequired?: boolean;
    totalDeductions?: number;
  };
  finalAccounting: {
    finalRentAmount?: number;
    utilities?: number;
    damages?: number;
    cleaning?: number;
    securityDeposit: number;
    refundAmount?: number;
    amountOwed?: number;
  };
  unitTurnover: {
    cleaningScheduled?: boolean;
    repairsScheduled?: boolean;
    paintingRequired?: boolean;
    carpetCleaning?: boolean;
    estimatedReadyDate?: string;
  };
  documentation: {
    moveOutForm?: string;
    inspectionReport?: string;
    finalStatement?: string;
    refundReceipt?: string;
  };
}> {
  steps: ['notice_received', 'schedule_inspection', 'conduct_inspection', 'final_accounting', 'process_refund', 'unit_turnover'];
  daysUntilMoveOut?: number;
  forwardingAddress?: string;
}

// Workflow event types
export interface WorkflowEvent {
  workflowId: string;
  type: 'started' | 'step_completed' | 'step_skipped' | 'validation_failed' | 'data_updated' | 'completed' | 'cancelled';
  timestamp: number;
  userId: string;
  stepId?: string;
  data?: any;
  error?: string;
}

// Workflow template for creating new workflows
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'lease' | 'property' | 'accounting' | 'maintenance' | 'tenant';
  steps: WorkflowStep[];
  defaultData?: any;
  permissions?: string[];
  estimatedDuration?: number; // minutes
}