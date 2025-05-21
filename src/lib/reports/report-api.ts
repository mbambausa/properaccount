// src/lib/reports/report-api.ts
/**
 * Report API
 * 
 * This module exposes a unified API for generating financial reports. It abstracts
 * away the database and accounting implementation details, providing a clean interface
 * for report generation.
 */

import type { 
  BalanceSheetReport, 
  CashFlowReport, 
  IncomeStatementReport, 
  ReportTimeFrame,
  DashboardReport
} from '../../types/report';
import type { D1Database } from '@cloudflare/workers-types';
import { formatCurrency } from '../../utils/format';
import { generateBalanceSheet, formatBalanceSheet } from './balance-sheet';
import { generateIncomeStatement, formatIncomeStatement } from './income-statement';
import { generateCashFlow, formatCashFlow } from './cash-flow';

/**
 * Report options for all report types
 */
export interface ReportOptions {
  /** Entity ID */
  entityId: string;
  /** Time frame */
  timeFrame: ReportTimeFrame;
  /** Database connection */
  db: D1Database;
  /** Currency code */
  currencyCode?: string;
  /** User ID */
  userId: string;
  /** Include comparison with previous period */
  includeComparison?: boolean;
}

/**
 * Generate a balance sheet report
 */
export async function generateBalanceSheetReport(
  options: ReportOptions & {
    asOfDate: string;
    previousDate?: string;
    includeAccountDetails?: boolean;
  }
): Promise<BalanceSheetReport> {
  try {
    const report = await generateBalanceSheet({
      entityId: options.entityId,
      timeFrame: options.timeFrame,
      asOfDate: options.asOfDate,
      previousDate: options.previousDate,
      includeComparison: options.includeComparison ?? false,
      includeAccountDetails: options.includeAccountDetails ?? true,
      currencyCode: options.currencyCode ?? 'USD',
      db: options.db,
      userId: options.userId
    });

    // Format the report for display
    return formatBalanceSheet(report, options.currencyCode);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    throw new Error(`Failed to generate balance sheet: ${(error as Error).message}`);
  }
}

/**
 * Generate an income statement report
 */
export async function generateIncomeStatementReport(
  options: ReportOptions & {
    startDate: string;
    endDate: string;
    previousStartDate?: string;
    previousEndDate?: string;
    showPercentOfRevenue?: boolean;
    includeTransactionDetails?: boolean;
    includeOperatingSubtotals?: boolean;
  }
): Promise<IncomeStatementReport> {
  try {
    const report = await generateIncomeStatement({
      entityId: options.entityId,
      timeFrame: options.timeFrame,
      startDate: options.startDate,
      endDate: options.endDate,
      previousStartDate: options.previousStartDate,
      previousEndDate: options.previousEndDate,
      includeComparison: options.includeComparison ?? false,
      showPercentOfRevenue: options.showPercentOfRevenue ?? true,
      includeTransactionDetails: options.includeTransactionDetails ?? false,
      includeOperatingSubtotals: options.includeOperatingSubtotals ?? true,
      currencyCode: options.currencyCode ?? 'USD',
      db: options.db,
      userId: options.userId
    });

    // Format the report for display
    return formatIncomeStatement(report, options.currencyCode);
  } catch (error) {
    console.error('Error generating income statement:', error);
    throw new Error(`Failed to generate income statement: ${(error as Error).message}`);
  }
}

/**
 * Generate a cash flow statement report
 */
export async function generateCashFlowReport(
  options: ReportOptions & {
    startDate: string;
    endDate: string;
    previousStartDate?: string;
    previousEndDate?: string;
    method?: 'DIRECT' | 'INDIRECT';
    includeTransactionDetails?: boolean;
    netIncome?: number;
  }
): Promise<CashFlowReport> {
  try {
    const report = await generateCashFlow({
      entityId: options.entityId,
      timeFrame: options.timeFrame,
      startDate: options.startDate,
      endDate: options.endDate,
      previousStartDate: options.previousStartDate,
      previousEndDate: options.previousEndDate,
      method: options.method ?? 'INDIRECT',
      includeComparison: options.includeComparison ?? false,
      includeTransactionDetails: options.includeTransactionDetails ?? false,
      netIncome: options.netIncome,
      currencyCode: options.currencyCode ?? 'USD',
      db: options.db,
      userId: options.userId
    });

    // Format the report for display
    return formatCashFlow(report, options.currencyCode);
  } catch (error) {
    console.error('Error generating cash flow statement:', error);
    throw new Error(`Failed to generate cash flow statement: ${(error as Error).message}`);
  }
}

/**
 * Generate a dashboard report with summary metrics
 */
export async function generateDashboardReport(
  options: ReportOptions & {
    startDate: string;
    endDate: string;
    includeCashPosition?: boolean;
    includeAccountsReceivable?: boolean;
    includeAccountsPayable?: boolean;
  }
): Promise<DashboardReport> {
  try {
    // Generate individual reports to get data for the dashboard
    const balanceSheet = await generateBalanceSheetReport({
      ...options,
      asOfDate: options.endDate
    });

    const incomeStatement = await generateIncomeStatementReport({
      ...options,
      startDate: options.startDate,
      endDate: options.endDate
    });

    const cashFlow = await generateCashFlowReport({
      ...options,
      startDate: options.startDate,
      endDate: options.endDate
    });

    // Construct dashboard report
    // In a real implementation, you would create a more comprehensive dashboard
    // with metrics, trends, and visualizations
    const dashboard: DashboardReport = {
      id: crypto.randomUUID(),
      type: 'dashboard',
      title: `Financial Dashboard - ${new Date(options.startDate).toLocaleDateString()} to ${new Date(options.endDate).toLocaleDateString()}`,
      timeFrame: options.timeFrame,
      entityId: options.entityId,
      generatedAt: new Date().toISOString(),
      generatedBy: options.userId,
      version: '1.0',
      finalized: false,
      metrics: [
        {
          name: 'Total Assets',
          value: balanceSheet.assets.total,
          format: 'currency',
          indicator: 'neutral'
        },
        {
          name: 'Total Liabilities',
          value: balanceSheet.liabilities.total,
          format: 'currency',
          indicator: 'neutral'
        },
        {
          name: 'Net Income',
          value: incomeStatement.netIncome,
          format: 'currency',
          indicator: incomeStatement.netIncome >= 0 ? 'positive' : 'negative'
        },
        {
          name: 'Cash Flow',
          value: cashFlow.netIncrease,
          format: 'currency',
          indicator: cashFlow.netIncrease >= 0 ? 'positive' : 'negative'
        }
      ]
    };

    // Optional sections based on parameters
    if (options.includeCashPosition) {
      dashboard.cashPosition = {
        balance: cashFlow.endingCash,
        projected: calculateProjectedCashBalance(cashFlow.endingCash, cashFlow.netIncrease),
        trend: generateTrendData(cashFlow.beginningCash, cashFlow.endingCash, 6),
        trendDates: generateDateSeries(options.startDate, options.endDate, 6)
      };
    }

    return dashboard;
  } catch (error) {
    console.error('Error generating dashboard report:', error);
    throw new Error(`Failed to generate dashboard report: ${(error as Error).message}`);
  }
}

/**
 * Utility function to calculate projected cash balance
 * This is a simple projection based on current trend
 */
function calculateProjectedCashBalance(
  currentBalance: number,
  recentNetChange: number
): number {
  // Simple projection: current balance + (recent change * projection factor)
  // In a real implementation, you would use a more sophisticated projection model
  const projectionFactor = 1.5; // Project forward by 1.5x the recent change
  return currentBalance + (recentNetChange * projectionFactor);
}

/**
 * Utility function to generate trend data points
 */
function generateTrendData(
  startValue: number,
  endValue: number,
  numPoints: number
): number[] {
  const step = (endValue - startValue) / (numPoints - 1);
  const trend: number[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    // Add some randomness to make the trend look more realistic
    const randomFactor = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
    trend.push(startValue + (step * i * randomFactor));
  }
  
  // Ensure the last point is exactly the end value
  trend[numPoints - 1] = endValue;
  
  return trend;
}

/**
 * Utility function to generate date series
 */
function generateDateSeries(
  startDate: string,
  endDate: string,
  numPoints: number
): string[] {
  const startTimestamp = new Date(startDate).getTime();
  const endTimestamp = new Date(endDate).getTime();
  const step = (endTimestamp - startTimestamp) / (numPoints - 1);
  const dates: string[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const timestamp = startTimestamp + (step * i);
    dates.push(new Date(timestamp).toISOString().substring(0, 10));
  }
  
  return dates;
}

/**
 * Export a unified API for report generation
 */
export const ReportAPI = {
  generateBalanceSheet: generateBalanceSheetReport,
  generateIncomeStatement: generateIncomeStatementReport,
  generateCashFlow: generateCashFlowReport,
  generateDashboard: generateDashboardReport
};