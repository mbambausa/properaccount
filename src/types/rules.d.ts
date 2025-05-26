// src/types/rules.d.ts
/**
 * Defines TypeScript interfaces for the business rules and automation engine,
 * including rule structure, conditions, actions, triggers, execution logs,
 * and approval workflows.
 */

/**
 * The type or purpose of an automation rule.
 */
export type RuleType =
  | 'transaction_categorization_suggestion' // Suggests or auto-applies category to transactions
  | 'transaction_account_assignment'      // Assigns transactions to specific accounts
  | 'approval_workflow_trigger'         // Initiates an approval process
  | 'user_notification_alert'           // Sends notifications based on criteria
  | 'data_validation_flagging'          // Flags data that violates specific business rules
  | 'automated_reconciliation_matching' // Helps in auto-matching reconciliation items
  | 'document_routing_tagging'          // Routes or tags uploaded documents
  | 'rent_escalation_reminder'          // Real estate: Reminds about upcoming rent increases
  | 'lease_expiration_alert'            // Real estate: Alerts on lease expirations
  | 'maintenance_threshold_trigger';    // Real estate: Triggers action based on maintenance costs/frequency

/**
 * Events that can trigger the evaluation of an automation rule.
 */
export type RuleTriggerEvent = // Renamed from RuleTrigger for clarity
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_imported' // From bank feed or file
  | 'document_uploaded'
  | 'document_ocr_completed'
  | 'invoice_received_payable'
  | 'payment_due_soon' // e.g., 7 days before
  | 'payment_overdue'
  | 'account_balance_threshold_crossed' // Exceeded or dropped below
  | 'period_ended_month'
  | 'period_ended_quarter'
  | 'period_ended_year'
  | 'manual_invocation_by_user'
  | 'scheduled_time_cron'; // For rules that run on a schedule

/**
 * Operators used in rule conditions to compare field values.
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains_string' // Renamed from contains
  | 'does_not_contain_string' // Renamed from not_contains
  | 'starts_with_string' // Renamed from starts_with
  | 'ends_with_string'   // Renamed from ends_with
  | 'greater_than_number' // Renamed from greater_than
  | 'less_than_number'    // Renamed from less_than
  | 'greater_than_or_equal_to_number' // Renamed from greater_or_equal
  | 'less_than_or_equal_to_number'    // Renamed from less_or_equal
  | 'is_between_numbers' // Renamed from between (value is min, value2 is max)
  | 'is_in_list'         // Value is an array of options
  | 'is_not_in_list'
  | 'matches_regex_pattern' // Renamed from regex
  | 'is_empty_or_null'     // Renamed from is_empty
  | 'is_not_empty_or_null' // Renamed from is_not_empty
  | 'date_is_before'
  | 'date_is_after'
  | 'date_is_between';

/**
 * Types of actions that a rule can execute if its conditions are met.
 */
export type RuleActionType = // Renamed from ActionType
  | 'auto_categorize_transaction' // Renamed from categorize
  | 'assign_transaction_to_account' // Renamed from assign_account
  | 'add_tag_to_item'               // Renamed from add_tag (item could be transaction, document, entity)
  | 'set_field_value'             // Sets a specific field on an item
  | 'send_email_notification'     // Renamed from send_notification
  | 'send_in_app_notification'
  | 'initiate_approval_workflow'  // Renamed from require_approval
  | 'create_follow_up_task'       // Renamed from create_task
  | 'trigger_external_webhook'    // Renamed from trigger_webhook
  | 'execute_calculation_script'  // Renamed from run_calculation (e.g., for complex allocations)
  | 'flag_for_review'
  | 'archive_item';

/**
 * Defines a business automation rule.
 */
export interface AutomationRule {
  /** Unique identifier (UUID) for this rule. */
  readonly id: string;
  /** ID of the user who created/owns this rule. */
  readonly user_id: string;
  /** Optional: ID of the entity this rule is scoped to. If null, may be global for user. */
  entity_id?: string | null;
  name: string;
  description?: string | null;
  type: RuleType;
  is_active: boolean;
  /** True if this is a system-defined rule that cannot be deleted by users. */
  is_system_rule: boolean; // Renamed from is_system
  /** Execution priority (lower numbers processed first). */
  priority: number;

  /** Events that trigger this rule's evaluation. */
  trigger_events: RuleTriggerEvent[]; // Renamed from triggers

  /** Conditions that must be met for actions to execute. */
  conditions: RuleCondition[];
  /** Logic for combining multiple conditions ('all' means AND, 'any' means OR). */
  condition_evaluation_logic?: 'all_must_be_true' | 'any_can_be_true' | 'custom_expression'; // Renamed from condition_logic
  /** Custom logic expression if condition_evaluation_logic is 'custom_expression' (e.g., "(1 AND 2) OR 3"). */
  custom_condition_logic_expression?: string | null; // Renamed from custom_logic

  /** Actions to execute if conditions are met. */
  actions_to_execute: RuleAction[]; // Renamed from actions

  // Scope and limitations
  /** Primary type of item this rule applies to. */
  applies_to_resource_type: 'transactions' | 'documents' | 'entities' | 'leases' | 'work_orders' | 'all_applicable'; // Renamed from applies_to
  // Further scoping by sub-types, if needed
  applicable_entity_types?: string[] | null; // e.g., only for 'property' entities
  applicable_account_types?: string[] | null; // e.g., only for 'expense' accounts
  amount_filter_range?: { min_amount?: number; max_amount?: number } | null; // Renamed from amount_range

  // Execution control
  /** Maximum number of times this rule can be executed (e.g., per day, total). 0 or null for unlimited. */
  max_executions_limit?: { count: number; per_period: 'day' | 'week' | 'month' | 'total_lifetime' } | null; // Renamed from max_executions
  /** Minimum time in minutes before this rule can be triggered again for the same item/context. */
  cooldown_period_minutes?: number | null; // Renamed from cooldown_minutes
  /** Rule is effective from this date. Unix timestamp (seconds). */
  effective_from_date?: number | null; // Renamed from valid_from
  /** Rule is effective until this date. Unix timestamp (seconds). */
  effective_until_date?: number | null; // Renamed from valid_until

  // Stats and audit
  /** Unix timestamp (seconds) when the rule was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when the rule was last updated. */
  updated_at: number;
  /** Unix timestamp (seconds) when the rule was last triggered. */
  last_triggered_at_timestamp?: number | null; // Renamed from last_triggered_at
  total_trigger_count: number; // Renamed from trigger_count
  successful_execution_count: number; // Renamed from success_count
  failed_execution_count: number; // Renamed from failure_count

  // Real estate specific applicability
  applicable_property_ids?: string[] | null; // Renamed from property_ids
  applicable_unit_ids?: string[] | null; // Renamed from unit_ids
  tags?: string[]; // For organizing rules
}

/**
 * Defines a single condition within an automation rule.
 */
export interface RuleCondition {
  /** Optional client-side ID for managing conditions in a UI before saving. */
  readonly client_id?: string; // Renamed from id
  /** Path to the field in the target data object to evaluate (e.g., "transaction.amount", "document.metadata.tags"). */
  field_path: string; // Renamed from field
  /** Data type of the field being evaluated, helps in choosing operators and validating values. */
  field_data_type: 'string' | 'number' | 'date_iso_string' | 'unix_timestamp' | 'boolean' | 'string_array' | 'number_array'; // Renamed from field_type
  operator: ConditionOperator;
  /**
   * The value(s) to compare against. Type depends on `field_data_type` and `operator`.
   * For 'is_in_list' or 'is_not_in_list', this would be an array.
   * For 'is_between_numbers' or 'date_is_between', this is the lower bound.
   */
  comparison_value: any; // Consider a more specific union type if possible, or validate based on field_data_type
  /** Second value for range operators like 'is_between_numbers' or 'date_is_between' (upper bound). */
  comparison_value2?: any | null; // Renamed from value2
  is_case_sensitive_for_string?: boolean; // Renamed from case_sensitive

  // For nested conditions (creating AND/OR groups within conditions)
  nested_conditions_group?: RuleCondition[] | null; // Renamed from nested_conditions
  nested_conditions_logic?: 'all_must_be_true' | 'any_can_be_true'; // Renamed from nested_logic
}

/**
 * Defines a single action to be executed by an automation rule.
 */
export interface RuleAction {
  /** Optional client-side ID for managing actions in a UI before saving. */
  readonly client_id?: string; // Renamed from id
  type: RuleActionType;

  // Action-specific parameters
  /** Target field path for 'set_field_value' action. */
  target_field_path?: string | null; // Renamed from field
  /** Value for 'set_field_value' or 'add_tag_to_item' (if tag is the value). */
  action_value?: any; // Renamed from value; type depends on target_field_path

  // Parameters for specific action types
  auto_categorization_config?: { // Renamed from category_id
    target_category_id: string; // ID of the CoA category
    set_as_reviewed?: boolean;
    confidence_threshold_for_auto_apply?: number; // 0-1, apply only if rule confidence is high
  } | null;

  assign_account_config?: { // Renamed from account_id
    target_account_id: string; // ID of the CoA account
  } | null;

  notification_action_config?: { // Renamed from notification_config
    recipient_type: 'specific_user' | 'user_role' | 'email_address' | 'entity_contact_point';
    recipient_identifier?: string | null; // User ID, Role Name, or Email Address
    message_subject_template?: string | null;
    message_body_template: string; // Can use placeholders like {{transaction.amount}}
    include_direct_link_to_item?: boolean;
  } | null;

  approval_workflow_config?: { // Renamed from approval_config
    workflow_definition_id: string; // ID of a predefined approval workflow
    initial_approver_type?: 'user' | 'role' | 'reporting_manager';
    initial_approver_identifier?: string | null;
    escalation_timeout_hours?: number | null;
    reminder_frequency_hours?: number | null;
  } | null;

  external_webhook_config?: { // Renamed from webhook_config
    target_url: string;
    http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH'; // Default POST
    custom_headers?: Record<string, string> | null;
    payload_body_template?: string | null; // JSON template with placeholders
    max_retry_attempts?: number; // Default 0 or 1
    success_criteria_http_status?: number[]; // e.g. [200, 201, 204]
  } | null;

  follow_up_task_config?: { // Renamed from task_config
    task_title_template: string;
    task_description_template?: string | null;
    assignee_type: 'specific_user' | 'user_role' | 'rule_owner';
    assignee_identifier?: string | null;
    due_in_days_from_trigger?: number | null;
    task_priority?: 'low' | 'medium' | 'high' | 'urgent';
  } | null;
  delay_execution_minutes?: number; // Optional delay before this action runs
}

/**
 * Log entry for a single execution of an automation rule.
 */
export interface RuleExecutionLogEntry { // Renamed from RuleExecutionLog
  /** Unique identifier (UUID) for this log entry. */
  readonly id: string;
  rule_id: string;
  rule_name_at_execution: string; // Renamed from rule_name (captures name at time of execution)
  /** ID of the item (transaction, document, etc.) that triggered the rule. */
  target_item_id: string; // Renamed from target_id
  /** Type of the item that triggered the rule. */
  target_item_type: string; // Renamed from target_type
  triggering_event: RuleTriggerEvent; // Renamed from trigger

  // Execution details
  were_conditions_evaluated: boolean; // Renamed from conditions_evaluated
  were_all_conditions_met: boolean;   // Renamed from conditions_met
  were_actions_attempted: boolean;    // Renamed from actions_executed (indicates attempt)

  // Results of executed actions
  executed_action_results: Array<{
    action_type: RuleActionType;
    was_successful: boolean; // Renamed from success
    error_message?: string | null; // Renamed from error
    result_data?: any; // Renamed from result (e.g., ID of created task)
  }>;

  /** Unix timestamp (seconds) when the rule was executed. */
  readonly executed_at_timestamp: number; // Renamed from executed_at
  /** Duration of the rule execution in milliseconds. */
  execution_duration_ms: number; // Renamed from execution_time_ms

  executed_by_context: 'system_automation' | 'manual_user_trigger' | 'test_simulation'; // Renamed from executed_by
  triggering_user_id?: string | null; // Renamed from user_id (if manually triggered)
  was_dry_run_simulation: boolean; // Renamed from dry_run
  input_data_snapshot?: any; // Snapshot of the data that triggered the rule, for debugging
}

/**
 * Template for creating common automation rules.
 */
export interface AutomationRuleTemplate { // Renamed from RuleTemplate
  /** Unique identifier for this template. */
  readonly id: string;
  template_name: string; // Renamed from name
  template_description: string; // Renamed from description
  template_category: 'accounting_automation' | 'real_estate_operations' | 'compliance_alerts' | 'workflow_enhancement' | 'data_quality'; // Renamed from category

  /** Base configuration for the AutomationRule to be created from this template. */
  base_rule_config: Partial<Omit<AutomationRule, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_triggered_at_timestamp' | 'total_trigger_count' | 'successful_execution_count' | 'failed_execution_count'>>; // Renamed from rule_config

  /** Parameters that the user needs to fill in when using this template. */
  customizable_parameters: Array<{
    parameter_name: string; // e.g., "targetAccountId", "notificationEmail"
    parameter_type: 'string_input' | 'number_input' | 'boolean_toggle' | 'select_option' | 'coa_account_picker' | 'category_picker' | 'user_picker' | 'role_picker'; // Renamed from type
    display_label: string; // Renamed from label
    is_required: boolean; // Renamed from required
    default_value_for_parameter?: any; // Renamed from default_value
    select_options_list?: Array<{ value: any; label: string }> | null; // Renamed from options
    parameter_description?: string;
  }>;

  // Usage metadata
  is_public_template: boolean; // Renamed from is_public
  template_usage_count?: number; // Renamed from usage_count
  template_average_rating?: number | null; // Renamed from rating (e.g., 1-5 stars)
  template_tags?: string[] | null; // Renamed from tags
  icon_url?: string;
}

/**
 * State and details of an approval workflow instance, typically initiated by a rule.
 */
export interface ApprovalWorkflowInstance { // Renamed from ApprovalWorkflow
  /** Unique identifier (UUID) for this workflow instance. */
  readonly id: string;
  /** ID of the AutomationRule that triggered this workflow, if any. */
  initiating_rule_id?: string | null; // Renamed from rule_id
  /** ID of the item requiring approval (e.g., transaction ID, document ID). */
  target_item_id: string; // Renamed from target_id
  /** Type of the item requiring approval. */
  target_item_type: string; // Renamed from target_type

  // Workflow state
  current_status: 'pending_approval' | 'approved_fully' | 'rejected_fully' | 'partially_approved' | 'escalated_for_review' | 'expired_no_response' | 'cancelled_by_requestor'; // Renamed from status

  // Approval chain/steps
  approval_chain_steps: Array<{ // Renamed from approval_steps
    step_order_number: number; // Renamed from step_number
    approver_type: 'specific_user' | 'user_role' | 'dynamic_manager_lookup'; // Renamed from approver_type
    approver_identifier: string; // User ID, Role Name, or criteria for dynamic lookup
    step_status: 'pending_action' | 'approved_step' | 'rejected_step' | 'skipped_by_logic' | 'delegated'; // Renamed from status
    /** Unix timestamp (seconds) when this approver responded. */
    response_timestamp?: number | null; // Renamed from responded_at
    response_comments?: string | null; // Renamed from comments
    delegated_to_user_id?: string | null;
  }>;

  current_approval_step_number: number; // Renamed from current_step

  // Metadata
  /** Unix timestamp (seconds) when this approval workflow was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) by which approval is ideally needed. */
  response_due_at?: number | null; // Renamed from due_at
  /** Unix timestamp (seconds) when the workflow was fully completed (approved/rejected). */
  completed_at_timestamp?: number | null; // Renamed from completed_at
  /** Unix timestamp (seconds) if/when this workflow was escalated. */
  escalated_at_timestamp?: number | null; // Renamed from escalated_at

  /** Snapshot of relevant data for the approver at time of request. */
  approval_context_data?: Record<string, any> | null; // Renamed from context_data
  requestor_user_id: string; // Renamed from requestor_id
  request_justification_text?: string | null; // Renamed from justification
  workflow_definition_id?: string; // Link to a reusable workflow definition/template
}

/**
 * User's notification preferences for rule-based alerts.
 */
export interface UserNotificationPreferences { // Renamed from NotificationPreference
  readonly user_id: string; // User these preferences belong to
  /** Optional: Rule ID if preferences are per-rule, null for global/default. */
  applies_to_rule_id?: string | null; // Renamed from rule_id

  // Notification channels
  enable_email_notifications: boolean; // Renamed from email_enabled
  enable_in_app_notifications: boolean; // Renamed from in_app_enabled
  enable_sms_notifications?: boolean; // Renamed from sms_enabled (ensure consent for SMS)
  sms_phone_number_e164?: string | null; // If SMS enabled

  // Delivery frequency / batching
  notification_delivery_frequency: 'immediate_on_trigger' | 'hourly_digest' | 'daily_digest' | 'weekly_summary'; // Renamed from frequency

  // Content filters
  minimum_alert_severity_to_notify?: 'low' | 'medium' | 'high' | 'critical' | null; // Renamed from min_severity
  /** Notify only for rules/alerts in these categories (if applicable). */
  subscribed_alert_categories?: string[] | null; // Renamed from categories

  // Quiet hours configuration
  quiet_hours_config?: {
    is_enabled: boolean; // Renamed from enabled
    start_time_local_hhmm: string; // e.g., "22:00"
    end_time_local_hhmm: string;   // e.g., "07:00"
    user_timezone_iana: string;    // e.g., "America/Denver"
  } | null;
  /** Unix timestamp (seconds) last updated. */
  preferences_last_updated_at: number;
}

/**
 * Results of testing or simulating an automation rule with sample data.
 */
export interface RuleTestSimulationResult { // Renamed from RuleTestResult
  rule_id_tested: string; // Renamed from rule_id
  /** Snapshot of the input data used for this test run. */
  input_test_data_snapshot: any; // Renamed from test_data

  // Results
  would_rule_have_triggered: boolean; // Renamed from would_trigger
  condition_evaluation_details: Array<{
    condition_snapshot: RuleCondition; // The condition as defined
    evaluation_result_boolean: boolean; // Renamed from result
    actual_value_from_data?: any; // Value of condition.field_path from test_data
    notes?: string; // e.g., "Operator 'contains' matched 'Invoice'"
  }>;

  planned_actions_if_triggered: Array<{ // Renamed from planned_actions
    action_definition: RuleAction; // Renamed from action
    would_action_execute: boolean; // Renamed from would_execute
    simulated_action_result_or_effect?: any; // Renamed from simulated_result (e.g., "Category set to 'Utilities'")
  }>;

  execution_warnings_or_errors?: string[] | null; // Renamed from warnings (e.g., "Field 'transaction.vendorName' not found in test data")
  estimated_items_matched_in_period?: number | null; // If simulation was run against historical data
  /** Unix timestamp (seconds) of simulation. */
  simulation_run_at: number;
}