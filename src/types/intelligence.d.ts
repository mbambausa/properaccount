// src/types/intelligence.d.ts
/**
 * AI/ML and intelligent automation type definitions
 */

export type MLModelType = 
  | 'categorization'
  | 'anomaly_detection'
  | 'cash_flow_prediction'
  | 'expense_prediction'
  | 'tenant_scoring'
  | 'maintenance_prediction'
  | 'rent_optimization';

export type PredictionConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type AnomalyType = 
  | 'unusual_amount'
  | 'duplicate_transaction'
  | 'pattern_break'
  | 'suspicious_timing'
  | 'category_mismatch'
  | 'missing_expected'
  | 'fraud_risk';

/**
 * Transaction categorization prediction
 */
export interface CategoryPrediction {
  readonly transaction_id: string;
  suggested_categories: CategorySuggestion[];
  model_version: string;
  model_type: MLModelType;
  features_used: string[];
  readonly predicted_at: number;
  confidence_score: number;
  explanation?: string;
  user_feedback?: 'accepted' | 'rejected' | 'modified';
  final_category_id?: string;
}

export interface CategorySuggestion {
  category_id: string;
  category_name: string;
  category_path: string[];
  confidence: number;
  score: number;
  reasoning?: string[];
  similar_transactions?: Array<{
    id: string;
    description: string;
    similarity: number;
  }>;
}

/**
 * Anomaly detection results
 */
export interface AnomalyDetection {
  readonly id: string;
  entity_id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affected_transactions: string[];
  amount_involved?: number;
  description: string;
  details: AnomalyDetails;
  suggested_actions?: string[];
  readonly detected_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  resolution?: 'false_positive' | 'corrected' | 'acknowledged' | 'investigating';
  resolution_notes?: string;
}

export interface AnomalyDetails {
  expected_range?: { min: number; max: number };
  actual_value?: number;
  deviation_percentage?: number;
  pattern_description?: string;
  historical_context?: {
    average: number;
    std_deviation: number;
    sample_size: number;
  };
  related_anomalies?: string[];
}

/**
 * Cash flow predictions
 */
export interface CashFlowPrediction {
  readonly entity_id: string;
  prediction_date: number;
  horizon_days: number;
  predictions: CashFlowPredictionPoint[];
  confidence_intervals: ConfidenceInterval[];
  model_accuracy: ModelAccuracy;
  influencing_factors: InfluencingFactor[];
  readonly generated_at: number;
  model_version: string;
}

export interface CashFlowPredictionPoint {
  date: number;
  predicted_inflow: number;
  predicted_outflow: number;
  net_cash_flow: number;
  confidence: PredictionConfidence;
  components?: {
    recurring_income: number;
    recurring_expenses: number;
    seasonal_adjustments: number;
    trend_adjustments: number;
  };
}

export interface ConfidenceInterval {
  date: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: number; // e.g., 0.95 for 95%
}

export interface InfluencingFactor {
  factor: string;
  impact: 'positive' | 'negative';
  weight: number;
  description?: string;
}

/**
 * Expense prediction for budgeting
 */
export interface ExpensePrediction {
  category_id: string;
  category_name: string;
  predicted_amount: number;
  confidence: PredictionConfidence;
  based_on_months: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trend_percentage?: number;
  seasonal_pattern?: SeasonalPattern;
  outlier_risk?: 'low' | 'medium' | 'high';
}

export interface SeasonalPattern {
  pattern_type: 'monthly' | 'quarterly' | 'annual';
  peak_periods: Array<{
    period: string;
    multiplier: number;
  }>;
  low_periods: Array<{
    period: string;
    multiplier: number;
  }>;
}

/**
 * Real estate specific predictions
 */
export interface TenantScoring {
  tenant_id: string;
  score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high';
  factors: TenantRiskFactor[];
  payment_prediction: {
    on_time_probability: number;
    default_risk: number;
    expected_delays_days?: number;
  };
  renewal_probability?: number;
  recommended_actions?: string[];
  scored_at: number;
}

export interface TenantRiskFactor {
  factor: string;
  score_impact: number;
  current_value: any;
  optimal_range?: any;
  weight: number;
}

export interface MaintenancePrediction {
  property_id: string;
  unit_id?: string;
  component: string;
  predicted_failure_date?: number;
  maintenance_needed_probability: number;
  estimated_cost: number;
  cost_confidence_interval: { min: number; max: number };
  priority: 'routine' | 'important' | 'urgent' | 'critical';
  preventive_actions?: string[];
  based_on_history: boolean;
}

export interface RentOptimization {
  property_id: string;
  unit_id?: string;
  current_rent: number;
  market_rent_estimate: number;
  optimal_rent_suggestion: number;
  confidence: PredictionConfidence;
  factors_considered: MarketFactor[];
  expected_occupancy_impact: number;
  revenue_impact_estimate: number;
  implementation_timing?: string;
}

export interface MarketFactor {
  factor: string;
  weight: number;
  current_value: any;
  market_average: any;
  impact_on_rent: number;
}

/**
 * Pattern recognition results
 */
export interface TransactionPattern {
  pattern_id: string;
  pattern_type: 'recurring' | 'seasonal' | 'trending' | 'irregular';
  description: string;
  transactions: string[];
  frequency?: string;
  amount_range: { min: number; max: number };
  next_expected?: number;
  confidence: number;
}

/**
 * Model performance tracking
 */
export interface ModelAccuracy {
  model_type: MLModelType;
  accuracy_score: number;
  precision: number;
  recall: number;
  f1_score: number;
  last_evaluated: number;
  evaluation_sample_size: number;
  performance_trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Intelligent insights
 */
export interface InsightSuggestion {
  id: string;
  type: 'cost_saving' | 'revenue_opportunity' | 'risk_alert' | 'optimization';
  title: string;
  description: string;
  potential_impact?: {
    amount: number;
    percentage: number;
    timeframe: string;
  };
  confidence: PredictionConfidence;
  action_required?: string;
  priority: 'low' | 'medium' | 'high';
  expires_at?: number;
}

/**
 * Automated learning feedback
 */
export interface LearningFeedback {
  prediction_id: string;
  prediction_type: MLModelType;
  was_correct: boolean;
  user_correction?: any;
  feedback_at: number;
  feedback_by: string;
  improve_model: boolean;
}