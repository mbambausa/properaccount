// src/types/dashboard.d.ts
/**
 * Dashboard and widget type definitions for real estate accounting visualization
 */

export type DashboardType = 
  | 'portfolio_overview'
  | 'property_performance' 
  | 'financial_summary'
  | 'tenant_management'
  | 'maintenance_tracker'
  | 'custom';

export type WidgetType = 
  | 'metric'          // Single value KPI
  | 'chart'           // Various chart types
  | 'table'           // Data grid
  | 'alert'           // Status/warning widget
  | 'map'             // Property map view
  | 'calendar'        // Events/deadlines
  | 'activity_feed';  // Recent activities

export type ChartType = 
  | 'line' 
  | 'bar' 
  | 'pie' 
  | 'donut' 
  | 'area' 
  | 'scatter' 
  | 'gauge' 
  | 'waterfall' 
  | 'heatmap';

export type MetricTrend = 'up' | 'down' | 'stable';

/**
 * Dashboard configuration
 */
export interface Dashboard {
  readonly id: string;
  readonly user_id: string;
  entity_id?: string;
  name: string;
  type: DashboardType;
  description?: string;
  is_default: boolean;
  is_shared: boolean;
  layout_config: {
    columns: number;
    row_height: number;
    breakpoints?: Record<string, number>;
  };
  widgets: DashboardWidget[];
  filters?: DashboardFilter[];
  refresh_interval?: number; // seconds
  theme?: 'light' | 'dark' | 'auto';
  readonly created_at: number;
  updated_at: number;
  last_accessed_at?: number;
  access_count: number;
  tags?: string[];
}

/**
 * Individual dashboard widget
 */
export interface DashboardWidget {
  readonly id: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  config: WidgetConfig;
  position: GridPosition;
  refresh_interval?: number;
  is_visible: boolean;
  custom_styles?: Record<string, any>;
  interactions?: WidgetInteraction[];
}

/**
 * Widget positioning in grid
 */
export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

/**
 * Widget configuration based on type
 */
export interface WidgetConfig {
  data_source: DataSource;
  filters?: Record<string, any>;
  time_range?: TimeRange;
  visualization?: VisualizationConfig;
  thresholds?: ThresholdConfig[];
  display_options?: DisplayOptions;
  drill_down?: DrillDownConfig;
  // Real estate specific
  property_ids?: string[];
  unit_ids?: string[];
  comparison_mode?: 'period' | 'property' | 'portfolio';
}

/**
 * Data source configuration
 */
export interface DataSource {
  type: 'query' | 'report' | 'metric' | 'custom' | 'live';
  source_id?: string;
  query?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  group_by?: string[];
  metrics?: string[];
  real_time?: boolean;
}

/**
 * Time range configuration
 */
export interface TimeRange {
  type: 'fixed' | 'relative' | 'rolling';
  start?: number;
  end?: number;
  relative_range?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  rolling_window?: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
  };
  comparison?: {
    enabled: boolean;
    type: 'previous_period' | 'same_period_last_year';
  };
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  type: ChartType;
  options: ChartOptions;
  colors?: ColorScheme;
  animations?: boolean;
}

export interface ChartOptions {
  x_axis?: AxisConfig;
  y_axis?: AxisConfig;
  legend?: LegendConfig;
  data_labels?: boolean;
  stacked?: boolean;
  smooth?: boolean;
  area_fill?: boolean;
  // Property-specific
  show_occupancy_target?: boolean;
  highlight_maintenance_due?: boolean;
}

export interface AxisConfig {
  label?: string;
  type?: 'category' | 'value' | 'time';
  format?: string;
  min?: number;
  max?: number;
  tick_interval?: number;
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  orientation?: 'horizontal' | 'vertical';
}

export interface ColorScheme {
  palette?: string[];
  semantic?: {
    positive: string;
    negative: string;
    neutral: string;
    warning: string;
  };
}

/**
 * Threshold configuration for alerts
 */
export interface ThresholdConfig {
  value: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  color: string;
  label?: string;
  alert_enabled?: boolean;
  alert_message?: string;
}

/**
 * Display options
 */
export interface DisplayOptions {
  format?: 'number' | 'currency' | 'percent' | 'date';
  precision?: number;
  prefix?: string;
  suffix?: string;
  null_text?: string;
  trend_arrows?: boolean;
  sparkline?: boolean;
  comparison_display?: 'value' | 'percentage' | 'both';
}

/**
 * Drill-down configuration
 */
export interface DrillDownConfig {
  enabled: boolean;
  target_dashboard_id?: string;
  target_report_type?: string;
  pass_filters?: boolean;
  parameter_mapping?: Record<string, string>;
}

/**
 * Widget interactions
 */
export interface WidgetInteraction {
  type: 'click' | 'hover' | 'filter';
  action: 'navigate' | 'filter' | 'export' | 'custom';
  config?: Record<string, any>;
}

/**
 * Dashboard filters
 */
export interface DashboardFilter {
  id: string;
  field: string;
  label: string;
  type: 'select' | 'multi_select' | 'date_range' | 'search';
  options?: FilterOption[];
  default_value?: any;
  required?: boolean;
  affects_widgets?: string[];
}

export interface FilterOption {
  value: any;
  label: string;
  count?: number;
}

/**
 * Real estate specific metric widgets
 */
export interface PropertyMetrics {
  occupancy_rate: number;
  total_units: number;
  occupied_units: number;
  monthly_revenue: number;
  delinquency_rate: number;
  average_rent: number;
  maintenance_backlog: number;
  ytd_noi: number;
}

/**
 * Dashboard sharing configuration
 */
export interface DashboardShare {
  dashboard_id: string;
  shared_with_type: 'user' | 'role' | 'public';
  shared_with_id?: string;
  permissions: 'view' | 'edit';
  shared_by: string;
  shared_at: number;
  expires_at?: number;
}

/**
 * Dashboard template for quick setup
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  type: DashboardType;
  preview_url?: string;
  widgets: Omit<DashboardWidget, 'id'>[];
  default_filters?: Omit<DashboardFilter, 'id'>[];
  recommended_for?: string[];
}