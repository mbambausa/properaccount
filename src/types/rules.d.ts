// src/types/rules.d.ts
/**
 * Business rules and automation type definitions
 */

export type RuleType = 
  | 'categorization'
  | 'account_assignment'
  | 'approval_workflow'
  | 'notification'
  | 'data_validation'
  | 'reconciliation'
  | 'document_routing';

export type RuleTrigger = 
  | 'transaction_created'
  | 'transaction_updated'
  | 'document_uploaded'
  | 'invoice_received'
  | 'payment_due'
  | 'threshold_exceeded'
  | 'period_end'
  | 'manual';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'between'
  | 'in_list'
  | 'not_in_list'
  | 'regex'
  | 'is_empty'
  | 'is_not_empty';

export type ActionType = 
  | 'categorize'
  | 'assign_account'
  | 'add_tag'
  | 'set_field'
  | 'send_notification'
  | 'require_approval'
  | 'create_task'
  | 'trigger_webhook'
  | 'run_calculation';

/**
 * Business automation rule
 */
export interface AutomationRule {
  readonly id: string;
  readonly user_id: string;
  entity_id?: string;
  name: string;
  description?: string;
  type: RuleType;
  is_active: boolean;
  is_system: boolean; // System rules can't be deleted
  priority: number;   // Lower number = higher priority
  
  // Trigger configuration
  triggers: RuleTrigger[];
  
  // Conditions (all must be true)
  conditions: RuleCondition[];
  condition_logic?: 'all' | 'any' | 'custom';
  custom_logic?: string; // e.g., "(1 AND 2) OR (3 AND 4)"
  
  // Actions to execute
  actions: RuleAction[];
  
  // Scope and limitations
  applies_to: 'transactions' | 'documents' | 'entities' | 'all';
  entity_types?: string[];
  account_types?: string[];
  amount_range?: { min?: number; max?: number };
  
  // Execution control
  max_executions?: number;
  cooldown_minutes?: number;
  valid_from?: number;
  valid_until?: number;
  
  // Stats and audit
  readonly created_at: number;
  updated_at: number;
  last_triggered_at?: number;
  trigger_count: number;
  success_count: number;
  failure_count: number;
  
  // Real estate specific
  property_ids?: string[];
  unit_ids?: string[];
}

/**
 * Rule condition definition
 */
export interface RuleCondition {
  id?: string;
  field: string;
  field_type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  operator: ConditionOperator;
  value: any;
  value2?: any; // For 'between' operator
  case_sensitive?: boolean;
  
  // Nested conditions
  nested_conditions?: RuleCondition[];
  nested_logic?: 'all' | 'any';
}

/**
 * Rule action definition
 */
export interface RuleAction {
  id?: string;
  type: ActionType;
  
  // Action-specific parameters
  field?: string;
  value?: any;
  
  // Categorization action
  category_id?: string;
  
  // Account assignment
  account_id?: string;
  
  // Notification action
  notification_config?: {
    recipient_type: 'user' | 'role' | 'email';
    recipient_id?: string;
    email_address?: string;
    subject?: string;
    message_template?: string;
    include_link?: boolean;
  };
  
  // Approval workflow
  approval_config?: {
    approver_type: 'user' | 'role' | 'manager';
    approver_id?: string;
    escalation_hours?: number;
    reminder_frequency?: number;
  };
  
  // Webhook action
  webhook_config?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body_template?: string;
    retry_count?: number;
  };
  
  // Task creation
  task_config?: {
    title: string;
    description?: string;
    assignee_type: 'user' | 'role';
    assignee_id?: string;
    due_days?: number;
    priority?: 'low' | 'medium' | 'high';
  };
}

/**
 * Rule execution log
 */
export interface RuleExecutionLog {
  readonly id: string;
  rule_id: string;
  rule_name: string;
  target_id: string;
  target_type: string;
  trigger: RuleTrigger;
  
  // Execution details
  conditions_evaluated: boolean;
  conditions_met: boolean;
  actions_executed: boolean;
  
  // Results
  executed_actions: Array<{
    action_type: ActionType;
    success: boolean;
    error?: string;
    result?: any;
  }>;
  
  // Timing
  readonly executed_at: number;
  execution_time_ms: number;
  
  // Context
  executed_by: 'system' | 'user';
  user_id?: string;
  dry_run: boolean;
}

/**
 * Rule template for common scenarios
 */
export interface RuleTemplate {
  readonly id: string;
  name: string;
  description: string;
  category: 'accounting' | 'real_estate' | 'compliance' | 'workflow';
  
  // Template configuration
  rule_config: Partial<AutomationRule>;
  
  // Customization points
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'select' | 'account' | 'category';
    label: string;
    required: boolean;
    default_value?: any;
    options?: Array<{ value: any; label: string }>;
  }>;
  
  // Usage
  is_public: boolean;
  usage_count: number;
  rating?: number;
  tags?: string[];
}

/**
 * Approval workflow state
 */
export interface ApprovalWorkflow {
  readonly id: string;
  rule_id: string;
  target_id: string;
  target_type: string;
  
  // Workflow state
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  
  // Approval chain
  approval_steps: Array<{
    step_number: number;
    approver_type: 'user' | 'role';
    approver_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'skipped';
    responded_at?: number;
    comments?: string;
  }>;
  
  current_step: number;
  
  // Metadata
  readonly created_at: number;
  due_at?: number;
  completed_at?: number;
  escalated_at?: number;
  
  // Context
  context_data?: Record<string, any>;
  requestor_id: string;
  justification?: string;
}

/**
 * Notification preference
 */
export interface NotificationPreference {
  user_id: string;
  rule_id?: string;
  
  // Channels
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled?: boolean;
  
  // Frequency
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  
  // Filters
  min_severity?: 'low' | 'medium' | 'high';
  categories?: string[];
  
  // Quiet hours
  quiet_hours?: {
    enabled: boolean;
    start_time: string; // HH:MM
    end_time: string;
    timezone: string;
  };
}

/**
 * Rule testing/simulation
 */
export interface RuleTestResult {
  rule_id: string;
  test_data: any;
  
  // Results
  would_trigger: boolean;
  conditions_evaluation: Array<{
    condition: RuleCondition;
    result: boolean;
    actual_value?: any;
  }>;
  
  planned_actions: Array<{
    action: RuleAction;
    would_execute: boolean;
    simulated_result?: any;
  }>;
  
  warnings?: string[];
  estimated_matches?: number;
}