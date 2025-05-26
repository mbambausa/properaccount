// src/types/intelligence.d.ts
/**
 * Defines TypeScript interfaces for AI/ML features, intelligent automation,
 * predictions, anomaly detection, and insights within the ProperAccount system.
 */

/**
 * Types of machine learning models used or planned within the system.
 */
export type MLModelType =
  | 'transaction_categorization'
  | 'anomaly_detection_financial'
  | 'cash_flow_forecasting'
  | 'expense_budget_prediction'
  | 'tenant_risk_scoring'         // For real estate: predicting payment behavior, lease renewal
  | 'property_maintenance_prediction' // Predicting when maintenance might be needed
  | 'market_rent_optimization'    // For real estate: suggesting optimal rent prices
  | 'document_data_extraction'    // AI model for extracting info from PDFs/images
  | 'fraud_detection';

/**
 * Confidence level associated with a prediction or suggestion.
 */
export type PredictionConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'certain';

/**
 * Types of anomalies that can be detected in financial data.
 */
export type AnomalyType =
  | 'unusual_transaction_amount'
  | 'duplicate_transaction_detected'
  | 'break_in_recurring_pattern' // e.g., a recurring payment stops unexpectedly
  | 'suspicious_transaction_timing' // e.g., payment at odd hours
  | 'mismatched_category_to_payee'
  | 'missing_expected_transaction' // e.g., expected rent payment not received
  | 'potential_fraudulent_activity'
  | 'budget_variance_alert';

/**
 * Prediction for transaction categorization.
 */
export interface CategoryPrediction {
  /** ID of the transaction being categorized. */
  readonly transaction_id: string;
  /** Array of suggested categories, ordered by confidence. */
  suggested_categories: CategorySuggestion[];
  model_version_used: string; // Renamed for clarity
  model_type: MLModelType; // Should be 'transaction_categorization'
  /** Features used by the model for this prediction (e.g., "description_keyword_match", "amount_range"). */
  features_used?: string[] | null;
  /** Unix timestamp (seconds) when the prediction was made. */
  readonly predicted_at: number;
  /** Overall confidence score for the top suggestion (0.0 to 1.0). */
  overall_confidence_score: number; // Renamed for clarity
  /** Plain text explanation or justification for the top suggestion. */
  explanation_text?: string | null; // Renamed from explanation
  /** User feedback on the prediction. */
  user_feedback_status?: 'accepted_suggestion' | 'rejected_all' | 'manually_categorized' | 'pending_review'; // Renamed from user_feedback
  /** ID of the category ultimately chosen by the user or system. */
  final_category_id?: string | null;
}

export interface CategorySuggestion {
  category_id: string; // ID of the suggested ChartOfAccount entry
  category_name: string;
  /** Path if categories are hierarchical (e.g., ["Expenses", "Utilities", "Electricity"]). */
  category_path?: string[] | null;
  /** Confidence score for this specific suggestion (0.0 to 1.0). */
  confidence_score: number; // Renamed from confidence
  // score field removed as confidence_score seems to cover it.
  /** Reasons or rules that led to this suggestion. */
  reasoning_details?: string[] | null; // Renamed from reasoning
  /** Example similar transactions that influenced this suggestion. */
  example_similar_transactions?: Array<{
    transaction_id: string; // Renamed from id
    transaction_description: string; // Renamed from description
    similarity_metric: number; // e.g., cosine similarity, 0.0 to 1.0
  }> | null;
}

/**
 * Details of a detected financial anomaly.
 */
export interface AnomalyDetectionResult { // Renamed from AnomalyDetection
  /** Unique identifier (UUID) for this anomaly instance. */
  readonly id: string;
  entity_id: string; // Entity to which this anomaly pertains
  type: AnomalyType;
  severity_level: 'informational' | 'low' | 'medium' | 'high' | 'critical'; // Renamed from severity
  /** Confidence score of the detection (0.0 to 1.0). */
  detection_confidence: number; // Renamed from confidence
  /** IDs of transactions involved in or constituting this anomaly. */
  affected_transaction_ids: string[]; // Renamed from affected_transactions
  monetary_value_involved?: number | null; // Renamed from amount_involved
  anomaly_description: string; // Renamed from description
  /** Specific details or data points that define the anomaly. */
  anomaly_details_data: AnomalyPatternDetails; // Renamed from details and AnomalyDetails
  suggested_investigation_actions?: string[] | null; // Renamed from suggested_actions
  /** Unix timestamp (seconds) when the anomaly was detected. */
  readonly detected_at: number;
  /** Unix timestamp (seconds) when the anomaly was reviewed. */
  reviewed_at?: number | null;
  reviewed_by_user_id?: string | null; // Renamed from reviewed_by
  resolution_status?: 'new' | 'under_investigation' | 'false_positive' | 'action_taken_corrected' | 'acknowledged_no_action' | 'escalated'; // Renamed from resolution
  resolution_notes_text?: string | null; // Renamed from resolution_notes
}

export interface AnomalyPatternDetails { // Renamed from AnomalyDetails
  expected_value_range?: { min_val: number; max_val: number } | null; // Renamed for clarity
  actual_observed_value?: number | null; // Renamed for clarity
  deviation_percentage_from_norm?: number | null; // Renamed for clarity
  pattern_description_text?: string | null; // Renamed for clarity
  historical_data_context?: {
    average_value: number;
    standard_deviation: number;
    data_sample_size: number;
    time_period_analyzed_days?: number;
  } | null;
  related_anomaly_ids?: string[] | null; // Renamed for clarity
}

/**
 * Cash flow forecast for an entity.
 */
export interface CashFlowForecast { // Renamed from CashFlowPrediction
  readonly entity_id: string;
  /** Unix timestamp (seconds) when the forecast was generated. */
  forecast_generation_date: number; // Renamed from prediction_date
  /** Number of days into the future the forecast extends. */
  forecast_horizon_days: number; // Renamed from horizon_days
  /** Array of predicted cash flow points. */
  daily_cash_flow_predictions: CashFlowForecastPoint[]; // Renamed from predictions and CashFlowPredictionPoint
  /** Confidence intervals for the net cash flow predictions. */
  prediction_confidence_intervals?: ConfidenceIntervalBand[] | null; // Renamed from confidence_intervals and ConfidenceInterval
  model_performance_metrics?: ModelPerformanceMetrics | null; // Renamed from model_accuracy and ModelAccuracy
  key_influencing_factors?: KeyInfluencingFactor[] | null; // Renamed from influencing_factors and InfluencingFactor
  /** Unix timestamp (seconds) when this forecast record was created. */
  readonly generated_at_timestamp: number; // Renamed from generated_at
  model_version_used: string; // Renamed from model_version
  scenario_name?: string | null; // If this forecast is for a specific scenario
}

export interface CashFlowForecastPoint {
  /** Date for this point (YYYY-MM-DD string, for easier charting). */
  date_iso: string; // Renamed from date (which was number)
  predicted_total_inflow: number; // Renamed from predicted_inflow
  predicted_total_outflow: number; // Renamed from predicted_outflow
  predicted_net_cash_flow: number; // Renamed from net_cash_flow
  prediction_confidence_level?: PredictionConfidence | null; // Renamed from confidence
  inflow_outflow_components?: { // Renamed from components
    recurring_income_sources_total: number;
    one_time_income_sources_total: number;
    recurring_expense_sources_total: number;
    one_time_expense_sources_total: number;
    seasonal_adjustment_value?: number;
    trend_adjustment_value?: number;
  } | null;
  cumulative_cash_balance_forecast?: number;
}

export interface ConfidenceIntervalBand {
  date_iso: string; // Date for this interval (YYYY-MM-DD string)
  net_cash_flow_lower_bound: number; // Renamed from lower_bound
  net_cash_flow_upper_bound: number; // Renamed from upper_bound
  /** Confidence level for this interval (e.g., 0.95 for 95%). */
  confidence_level_percent: number; // Renamed from confidence_level
}

export interface KeyInfluencingFactor {
  factor_name: string; // e.g., "Seasonal Sales Uplift", "Upcoming Large Expense"
  impact_direction: 'positive_cash_flow' | 'negative_cash_flow'; // Renamed from impact
  impact_weight_normalized?: number | null; // Normalized weight (0-1) if applicable
  factor_description_text?: string | null; // Renamed from description
}

/**
 * Prediction for future expenses, useful for budgeting.
 */
export interface ExpenseForecast { // Renamed from ExpensePrediction
  expense_category_id: string; // Link to ChartOfAccount
  expense_category_name: string;
  predicted_expense_amount: number; // Renamed from predicted_amount
  forecast_period_iso?: string; // e.g. "2025-07" for July 2025
  prediction_confidence_level?: PredictionConfidence | null; // Renamed from confidence
  /** Number of past months' data used for this forecast. */
  historical_data_months_used: number; // Renamed from based_on_months
  observed_trend?: 'increasing' | 'stable' | 'decreasing' | 'seasonal' | null;
  trend_strength_percentage?: number | null; // Renamed from trend_percentage
  seasonal_influence_pattern?: SeasonalInfluencePattern | null; // Renamed from seasonal_pattern and SeasonalPattern
  outlier_risk_level?: 'low' | 'medium' | 'high' | null; // Renamed from outlier_risk
}

export interface SeasonalInfluencePattern {
  pattern_type: 'monthly_cycle' | 'quarterly_cycle' | 'annual_cycle';
  peak_value_periods: Array<{ // Renamed from peak_periods
    period_identifier: string; // e.g., "January", "Q1"
    expected_multiplier_effect: number; // e.g., 1.2 for 20% increase
  }>;
  low_value_periods?: Array<{ // Renamed from low_periods
    period_identifier: string;
    expected_multiplier_effect: number; // e.g., 0.8 for 20% decrease
  }> | null;
}

/**
 * Real estate specific predictions and scorings.
 */
export interface TenantRiskScore { // Renamed from TenantScoring
  tenant_id: string; // UUID
  /** Overall risk score (e.g., 0-1000, where higher might be better or worse depending on definition). */
  overall_risk_score: number; // Renamed from score
  risk_level_assessment: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'; // Renamed from risk_level
  contributing_risk_factors: TenantContributingRiskFactor[]; // Renamed from factors and TenantRiskFactor
  payment_behavior_prediction?: {
    on_time_payment_probability_percent: number; // Renamed from on_time_probability
    potential_default_risk_percent: number; // Renamed from default_risk
    expected_payment_delay_days?: number | null; // Renamed from expected_delays_days
  } | null;
  lease_renewal_probability_percent?: number | null; // Renamed from renewal_probability
  recommended_mitigation_actions?: string[] | null; // Renamed from recommended_actions
  /** Unix timestamp (seconds) when this score was calculated. */
  score_calculated_at: number; // Renamed from scored_at
}

export interface TenantContributingRiskFactor {
  factor_name: string; // e.g., "Payment History", "Credit Score Range", "Income-to-Rent Ratio"
  factor_score_impact: number; // How much this factor contributed to the overall score (positive or negative)
  current_observed_value: any; // The actual value of the factor for this tenant
  optimal_value_range?: string | null; // e.g., ">700" for credit score
  factor_weight_in_model?: number | null; // Normalized weight (0-1)
}

export interface PropertyMaintenancePrediction { // Renamed from MaintenancePrediction
  property_id: string; // UUID
  unit_id?: string | null; // UUID, if component is unit-specific
  /** Specific component or system (e.g., "HVAC Unit", "Roof", "Water Heater"). */
  component_name: string; // Renamed from component
  /** Predicted date of next required significant maintenance or potential failure. Unix timestamp (seconds). */
  predicted_service_or_failure_date?: number | null; // Renamed from predicted_failure_date
  /** Probability of requiring maintenance within a defined future window (e.g., next 6 months). */
  maintenance_needed_soon_probability_percent: number; // Renamed from maintenance_needed_probability
  estimated_maintenance_cost?: number | null; // Renamed from estimated_cost
  cost_estimation_confidence_interval?: { min_cost: number; max_cost: number } | null; // Renamed from cost_confidence_interval
  recommended_priority_level: 'routine_check' | 'preventive_action' | 'monitor_closely' | 'urgent_attention'; // Renamed from priority
  suggested_preventive_actions?: string[] | null; // Renamed from preventive_actions
  /** Was this prediction based on historical maintenance data for this component/property? */
  is_based_on_historical_data: boolean; // Renamed from based_on_history
  last_serviced_date?: number | null; // Unix timestamp (seconds)
  component_age_years?: number | null;
}

export interface MarketRentAnalysisResult { // Renamed from RentOptimization
  property_id: string; // UUID
  unit_id?: string | null; // UUID, if analysis is unit-specific
  current_actual_rent: number; // Renamed from current_rent
  estimated_current_market_rent: number; // Renamed from market_rent_estimate
  suggested_optimal_rent_range?: { low: number; high: number; target: number } | null; // Renamed from optimal_rent_suggestion
  analysis_confidence_level?: PredictionConfidence | null; // Renamed from confidence
  market_factors_considered: MarketInfluenceFactor[]; // Renamed from factors_considered and MarketFactor
  /** Estimated impact on vacancy rate if rent is adjusted to suggested target. Percentage. */
  expected_vacancy_impact_at_target_rent_percent?: number | null; // Renamed from expected_occupancy_impact
  /** Estimated net revenue impact if rent is adjusted. */
  estimated_net_revenue_impact?: number | null; // Renamed from revenue_impact_estimate
  recommended_timing_for_adjustment?: 'immediate' | 'next_lease_renewal' | 'phased_in' | null; // Renamed from implementation_timing
  /** Unix timestamp (seconds) of this analysis. */
  analysis_performed_at: number;
}

export interface MarketInfluenceFactor {
  factor_name: string; // e.g., "Comparable Rents", "Neighborhood Amenities", "Property Condition"
  factor_weight_in_analysis?: number | null; // Normalized (0-1)
  observed_value_for_subject: any; // Value for the property being analyzed
  market_average_or_benchmark_value?: any | null;
  /** Estimated monetary impact of this factor on the optimal rent. */
  estimated_rent_impact_value: number;
}

/**
 * Results of transaction pattern recognition.
 */
export interface DetectedTransactionPattern { // Renamed from TransactionPattern
  /** Unique identifier for this detected pattern instance. */
  pattern_instance_id: string; // Renamed from pattern_id
  pattern_type_identified: 'recurring_payment_or_income' | 'seasonal_expense_variation' | 'gradual_increase_decrease_trend' | 'irregular_high_value_transactions'; // Renamed from pattern_type
  pattern_description_text: string; // Renamed from description
  /** IDs of transactions that form this pattern. */
  constituent_transaction_ids: string[]; // Renamed from transactions
  detected_frequency_description?: string | null; // e.g., "Monthly, around the 5th", "Quarterly"
  typical_amount_range?: { min_amount: number; max_amount: number } | null; // Renamed from amount_range
  /** Predicted date of next occurrence based on pattern. Unix timestamp (seconds). */
  next_expected_occurrence_date?: number | null; // Renamed from next_expected
  /** Confidence in the detected pattern (0.0 to 1.0). */
  pattern_detection_confidence: number; // Renamed from confidence
  entity_id?: string; // Entity this pattern belongs to
}

/**
 * Performance metrics for a specific ML model.
 */
export interface ModelPerformanceMetrics { // Renamed from ModelAccuracy
  model_type: MLModelType;
  model_version_tag?: string;
  accuracy_score_percent?: number | null; // e.g., classification accuracy
  precision_score?: number | null; // For classification
  recall_score?: number | null;    // For classification
  f1_score_value?: number | null;      // For classification
  mae_or_mse_value?: number | null; // Mean Absolute Error or Mean Squared Error for regression
  r_squared_value?: number | null;  // For regression
  /** Unix timestamp (seconds) when the model was last evaluated. */
  last_evaluation_timestamp: number; // Renamed from last_evaluated
  evaluation_data_sample_size: number; // Renamed from evaluation_sample_size
  performance_over_time_trend?: 'improving' | 'stable' | 'degrading' | 'not_enough_data' | null; // Renamed from performance_trend
  key_metrics_tracked?: Record<string, number>; // Other relevant metrics
}

/**
 * Actionable insight or suggestion generated by the intelligent system.
 */
export interface IntelligentInsight { // Renamed from InsightSuggestion
  readonly id: string; // UUID
  type: 'cost_saving_opportunity' | 'revenue_enhancement_opportunity' | 'operational_risk_alert' | 'efficiency_optimization_suggestion' | 'compliance_flag';
  title: string;
  description_details: string; // Renamed from description
  potential_financial_impact?: {
    estimated_amount: number;
    currency_code?: string;
    impact_type: 'savings' | 'gain';
    timeframe_for_impact_months?: number; // e.g., 12 for annual impact
  } | null;
  /** Confidence that this insight is accurate and actionable. */
  insight_confidence_level?: PredictionConfidence | null; // Renamed from confidence
  recommended_action_steps?: string[] | null; // Renamed from action_required
  priority_level: 'low' | 'medium' | 'high' | 'critical'; // Renamed from priority
  /** Unix timestamp (seconds) when this insight expires or may no longer be relevant. */
  expires_at_timestamp?: number | null; // Renamed from expires_at
  /** Unix timestamp (seconds) when this insight was generated. */
  generated_at_timestamp: number;
  related_entity_id?: string | null; // Entity this insight relates to
  related_resource_ids?: Array<{type: string; id: string}> | null; // e.g., [{type: 'transaction', id: '...'}, {type: 'property', id: '...'}]
  is_acknowledged_by_user?: boolean;
  user_feedback_on_insight?: 'helpful' | 'not_helpful' | 'implemented' | null;
}

/**
 * Feedback provided by a user on an AI prediction or suggestion, used for model retraining.
 */
export interface AutomatedLearningFeedback { // Renamed from LearningFeedback
  /** ID of the prediction/suggestion this feedback pertains to. */
  source_prediction_or_insight_id: string; // Renamed from prediction_id
  source_model_type: MLModelType; // Renamed from prediction_type
  /** Did the user find the AI output correct or helpful? */
  is_suggestion_correct_or_helpful: boolean; // Renamed from was_correct
  /** The correction or actual value provided by the user, if applicable. */
  user_provided_correction_data?: any; // Renamed from user_correction
  /** Unix timestamp (seconds) when the feedback was submitted. */
  feedback_submitted_at: number; // Renamed from feedback_at
  feedback_submitted_by_user_id: string; // Renamed from feedback_by
  /** Should this feedback be used to improve the model? */
  use_for_model_improvement: boolean; // Renamed from improve_model
  feedback_notes?: string | null; // Optional textual feedback
}