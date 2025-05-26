// src/types/dashboard.d.ts
/**
 * Defines TypeScript interfaces for dynamic dashboards, widgets,
 * data sources, and visualization configurations, tailored for
 * real estate accounting and financial data display.
 */

export type DashboardType =
  | 'portfolio_overview'       // High-level summary of all entities/properties
  | 'property_performance'     // Detailed metrics for a single property
  | 'financial_summary'        // Key financial statements and KPIs for an entity
  | 'tenant_management'        // Overview of tenants, leases, rent roll
  | 'maintenance_tracker'      // Status of work orders and maintenance tasks
  | 'investment_analysis'      // For analyzing property investments
  | 'custom';                  // User-defined dashboard

export type WidgetType =
  | 'metric_kpi'             // Single important Key Performance Indicator
  | 'chart_visual'           // Various chart types (line, bar, pie, etc.)
  | 'data_table'             // Grid for displaying detailed data
  | 'alert_notification'     // For important status updates or warnings
  | 'property_map'           // Geographic map view of properties
  | 'event_calendar'         // Upcoming deadlines, lease expirations, etc.
  | 'activity_feed'          // Recent system or user activities
  | 'task_list'              // To-do items or pending actions
  | 'text_block';            // For notes or rich text content

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'gauge'        // For single metrics against a target
  | 'waterfall'    // For financial statements like cash flow
  | 'heatmap'
  | 'treemap'
  | 'funnel';

export type MetricTrendIndicator = 'up' | 'down' | 'stable' | 'neutral';

/**
 * Represents the configuration and content of a dashboard.
 */
export interface Dashboard {
  /** Unique identifier (UUID) for this dashboard. */
  readonly id: string;
  /** ID of the user who owns this dashboard. */
  readonly user_id: string;
  /** Optional: ID of the entity this dashboard is primarily associated with. */
  entity_id?: string | null;
  name: string;
  type: DashboardType;
  description?: string | null;
  is_default: boolean; // Is this a default dashboard for the user or entity?
  is_shared: boolean;  // Is this dashboard shared with others?
  layout_config: {
    columns: number; // Number of columns in the grid layout
    row_height: number; // Height of a single row in pixels
    breakpoints?: Record<string, number>; // e.g., { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
    // Could also include margin, padding, responsive layouts here
  };
  widgets: DashboardWidget[];
  filters?: DashboardFilter[]; // Global filters applicable to multiple widgets
  /** Auto-refresh interval in seconds. 0 or undefined means no auto-refresh. */
  refresh_interval?: number | null;
  theme?: 'light' | 'dark' | 'system'; // Theme preference for this dashboard
  /** Unix timestamp (seconds) when the dashboard was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when the dashboard was last updated. */
  updated_at: number;
  /** Unix timestamp (seconds) when the dashboard was last accessed. */
  last_accessed_at?: number | null;
  access_count?: number; // How many times this dashboard has been viewed
  tags?: string[];
  is_favorite?: boolean;
}

/**
 * Represents an individual widget within a dashboard.
 */
export interface DashboardWidget {
  /** Unique identifier (UUID) for this widget instance. */
  readonly id: string;
  type: WidgetType;
  title: string;
  subtitle?: string | null;
  /** Configuration specific to the widget type and its data. */
  config: WidgetConfig;
  /** Position and size of the widget within the dashboard's grid layout. */
  position: GridPosition;
  /** Widget-specific auto-refresh interval in seconds. Overrides dashboard default. */
  refresh_interval?: number | null;
  is_visible?: boolean; // Default true
  custom_styles?: Record<string, any>; // For custom CSS overrides if needed
  interactions?: WidgetInteraction[]; // Define how user can interact with widget
}

/**
 * Defines the position and size of a widget in a grid layout.
 * (e.g., compatible with react-grid-layout or similar libraries)
 */
export interface GridPosition {
  x: number; // Horizontal position (column)
  y: number; // Vertical position (row)
  w: number; // Width in grid units (columns)
  h: number; // Height in grid units (rows)
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean; // If true, widget cannot be moved or resized
  isDraggable?: boolean;
  isResizable?: boolean;
}

/**
 * Generic configuration structure for a widget, tailored by its type.
 */
export interface WidgetConfig {
  data_source: DataSource;
  filters?: Record<string, any>; // Widget-specific filters, applied after global dashboard filters
  time_range?: TimeRange; // Widget-specific time range, overrides dashboard default
  visualization_options?: VisualizationConfig; // For chart widgets
  thresholds?: ThresholdConfig[]; // For KPI/metric widgets to show color coding
  display_options?: DisplayOptions; // General display formatting
  drill_down_config?: DrillDownConfig; // Configuration for drill-down behavior

  // Real estate specific context
  property_ids?: string[]; // Array of property UUIDs this widget relates to
  unit_ids?: string[];     // Array of unit UUIDs
  tenant_ids?: string[];   // Array of tenant UUIDs
  comparison_mode?: 'period_over_period' | 'property_vs_property' | 'actual_vs_budget';
}

/**
 * Defines the source of data for a widget.
 */
export interface DataSource {
  type: 'api_query' | 'predefined_report' | 'calculated_metric' | 'static_data' | 'real_time_feed';
  source_id?: string; // e.g., report ID, metric ID, API endpoint name
  query_params?: Record<string, any>; // Parameters for API query or report
  aggregation_method?: 'sum' | 'average' | 'count' | 'min' | 'max' | 'latest';
  group_by_fields?: string[];
  metrics_to_fetch?: string[]; // Specific metrics if source provides many
  real_time_topic?: string; // For WebSocket/real-time feeds
}

/**
 * Defines a time range for data fetching and display.
 */
export interface TimeRange {
  type: 'fixed_dates' | 'relative_to_now' | 'rolling_window';
  /** Unix timestamp (seconds) for start, if type is 'fixed_dates'. */
  start_date?: number;
  /** Unix timestamp (seconds) for end, if type is 'fixed_dates'. */
  end_date?: number;
  relative_range_key?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'year_to_date';
  rolling_window_config?: {
    value: number;
    unit: 'days' | 'weeks' | 'months' | 'years';
  };
  comparison_period?: {
    enabled: boolean;
    type: 'previous_period' | 'same_period_last_year' | 'custom_offset';
    offset_value?: number; // For custom_offset, in units of the main period
    offset_unit?: 'days' | 'weeks' | 'months' | 'years';
  };
}

/**
 * Configuration for chart visualizations.
 */
export interface VisualizationConfig {
  chart_type: ChartType;
  options: ChartSpecificOptions; // Could be a discriminated union based on chart_type
  color_scheme?: ColorScheme;
  enable_animations?: boolean;
}

// Example for ChartSpecificOptions (can be expanded or made a discriminated union)
export interface ChartSpecificOptions {
  x_axis_key?: string; // Key from data source for x-axis
  y_axis_keys?: string[]; // Key(s) from data source for y-axis
  x_axis_config?: AxisConfig;
  y_axis_config?: AxisConfig;
  legend_config?: LegendConfig;
  show_data_labels?: boolean;
  stacked_bars_or_areas?: boolean; // For bar/area charts
  line_smoothing?: 'none' | 'cubic' | 'step'; // For line charts
  show_target_line?: boolean; // e.g., occupancy target
  highlight_critical_dates?: boolean; // e.g., maintenance due
}

export interface AxisConfig {
  label?: string | null;
  type?: 'category' | 'value' | 'time';
  value_format?: string; // e.g., "currency", "percent", date format string
  min_value?: number;
  max_value?: number;
  tick_interval?: number;
  show_gridlines?: boolean;
}

export interface LegendConfig {
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  orientation?: 'horizontal' | 'vertical';
}

export interface ColorScheme {
  palette_name?: string; // Name of a predefined palette
  custom_colors?: string[]; // Array of hex color codes
  semantic_colors?: { // Colors for specific meanings
    positive_trend: string;
    negative_trend: string;
    neutral: string;
    warning_threshold: string;
    critical_threshold: string;
  };
}

/**
 * Configuration for conditional formatting or alerts based on thresholds.
 */
export interface ThresholdConfig {
  metric_key: string; // Which metric this threshold applies to
  condition_value: number;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  result_color?: string; // Hex color or semantic color key
  alert_label?: string;
  enable_alert_notification?: boolean;
}

/**
 * General display options for widget content.
 */
export interface DisplayOptions {
  number_value_format?: 'number' | 'currency' | 'percent' | 'compact_number'; // Compact e.g., 1.2K, 3M
  currency_code?: string; // e.g., "USD", "CAD"
  decimal_places?: number;
  date_display_format?: string; // e.g., "MM/DD/YYYY", "MMM D, YYYY"
  text_for_null_values?: string;
  show_trend_indicator?: boolean; // e.g., up/down arrow for KPI
  show_sparkline_chart?: boolean; // For KPI widgets
  comparison_result_display?: 'absolute_change' | 'percentage_change' | 'both';
}

/**
 * Configuration for what happens when a user interacts with a widget (e.g., drill-down).
 */
export interface DrillDownConfig {
  enabled: boolean;
  target_type: 'dashboard' | 'report_page' | 'external_url';
  target_id_or_url?: string; // Dashboard ID, report type ID, or external URL
  pass_current_filters?: boolean;
  parameter_mapping?: Record<string, string>; // Map widget data field to target parameter
}

/**
 * Defines possible interactions with a widget.
 */
export interface WidgetInteraction {
  interaction_type: 'click_on_datapoint' | 'hover_on_series' | 'filter_change_event';
  action_type: 'navigate_to_target' | 'apply_dashboard_filter' | 'export_widget_data' | 'custom_event';
  action_config?: Record<string, any>; // Configuration for the action
}

/**
 * Defines a global filter available on the dashboard.
 */
export interface DashboardFilter {
  /** Unique identifier for this filter instance on the dashboard. */
  id: string;
  /** Data field this filter operates on. */
  field_key: string;
  label: string;
  type: 'select_dropdown' | 'multi_select_list' | 'date_range_picker' | 'search_input_text' | 'slider_range';
  options_source?: 'static_list' | 'dynamic_query'; // Where to get options for select/multi-select
  static_options?: FilterOption[];
  dynamic_options_query?: DataSource; // To fetch options if dynamic
  default_value?: any;
  is_required?: boolean;
  /** Array of widget IDs this filter should affect. If empty/undefined, affects all compatible widgets. */
  affected_widget_ids?: string[];
}

export interface FilterOption {
  value: any;
  label: string;
  count?: number; // Optional: number of items matching this option
}

/**
 * Specific metrics commonly displayed for real estate properties.
 */
export interface PropertyMetricsWidgetData {
  occupancy_rate_percent: number;
  total_active_units: number;
  total_occupied_units: number;
  current_monthly_scheduled_revenue: number;
  delinquency_rate_percent?: number; // Tenants overdue on rent
  average_rent_per_unit?: number;
  maintenance_requests_open: number;
  year_to_date_noi?: number; // Net Operating Income
  trend_indicator?: MetricTrendIndicator;
}

/**
 * Configuration for sharing a dashboard.
 */
export interface DashboardShareSettings {
  dashboard_id: string;
  share_type: 'user_specific' | 'role_based' | 'public_link';
  shared_with_identifier?: string; // User ID, Role Name, or null for public
  access_level: 'view_only' | 'can_edit' | 'full_control'; // 'full_control' might include sharing rights
  shared_by_user_id: string;
  /** Unix timestamp (seconds) when sharing was configured. */
  shared_at: number;
  /** Unix timestamp (seconds) when the share link or access expires. */
  expires_at?: number | null;
  is_password_protected?: boolean; // For public links
  allow_data_export?: boolean; // For view-only shares
}

/**
 * Template for creating pre-configured dashboards quickly.
 */
export interface DashboardTemplate {
  readonly id: string; // Unique ID for the template
  name: string;
  description: string;
  type: DashboardType; // e.g., 'property_performance'
  preview_image_url?: string;
  /** Widget configurations without instance IDs or grid positions. */
  default_widgets: Array<Omit<DashboardWidget, 'id' | 'position'>>;
  /** Default filter configurations for this template. */
  default_filters?: Array<Omit<DashboardFilter, 'id'>>;
  recommended_for_roles?: string[]; // e.g., ['property_manager', 'owner']
  tags?: string[];
}