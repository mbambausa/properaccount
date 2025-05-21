// src/utils/format.ts
/**
 * Format utility functions
 * 
 * This module provides utilities for formatting different types of data
 * including numbers, currencies, dates, and financial values.
 */

// Cache formatters for better performance
const formatters: Record<string, Intl.NumberFormat> = {};

/**
 * Formats a number according to the specified options
 * 
 * @param value Number to format
 * @param options Formatting options
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  const locale = getLocale();
  
  // Create a cache key based on options and locale
  const cacheKey = getCacheKey(mergedOptions, locale);
  
  if (!formatters[cacheKey]) {
    formatters[cacheKey] = new Intl.NumberFormat(locale, mergedOptions);
  }
  
  return formatters[cacheKey].format(value);
}

/**
 * Formats a number as currency
 * 
 * @param value Amount to format
 * @param currency Currency code (default: 'USD')
 * @param options Additional formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  options: Intl.NumberFormatOptions = {}
): string {
  const currencyOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  };
  
  return formatNumber(value, currencyOptions);
}

/**
 * Formats a number as a percentage
 * 
 * @param value Decimal value to format as percentage (e.g., 0.25 for 25%)
 * @param fractionDigits Number of fraction digits to display
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number,
  fractionDigits = 2
): string {
  const percentOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  };
  
  return formatNumber(value, percentOptions);
}

/**
 * Format a date for display
 * 
 * @param date Date to format
 * @param format Format style ('short', 'medium', 'long', 'full')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  format: 'short' | 'medium' | 'long' | 'full' = 'medium'
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = getLocale();
  
  return new Intl.DateTimeFormat(locale, { dateStyle: format }).format(dateObj);
}

/**
 * Format a date and time for display
 * 
 * @param date Date to format
 * @param dateFormat Format style for date
 * @param timeFormat Format style for time
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: Date | string | number,
  dateFormat: 'short' | 'medium' | 'long' | 'full' = 'medium',
  timeFormat: 'short' | 'medium' | 'long' | 'full' = 'short'
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = getLocale();
  
  return new Intl.DateTimeFormat(locale, { 
    dateStyle: dateFormat,
    timeStyle: timeFormat
  }).format(dateObj);
}

// Financial formatting utilities

/**
 * Formats account numbers according to standard accounting practice
 * 
 * @param accountNumber Account number to format
 * @returns Formatted account number
 */
export function formatAccountNumber(accountNumber: string): string {
  // Remove any non-digit characters
  const digits = accountNumber.replace(/\D/g, '');
  
  // Group digits in sets of 4 for readability
  return digits.replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Formats large numbers with appropriate thousand separators
 * and abbreviations for millions, billions, etc.
 * 
 * @param value Number to format
 * @param abbreviate Whether to abbreviate large numbers (e.g., "1.2M")
 * @returns Formatted number string
 */
export function formatLargeNumber(
  value: number, 
  abbreviate = false
): string {
  if (!abbreviate || Math.abs(value) < 1_000_000) {
    return formatNumber(value);
  }
  
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (abs >= 1_000_000_000_000) {
    return `${sign}${formatNumber(abs / 1_000_000_000_000, { maximumFractionDigits: 1 })}T`;
  } else if (abs >= 1_000_000_000) {
    return `${sign}${formatNumber(abs / 1_000_000_000, { maximumFractionDigits: 1 })}B`;
  } else {
    return `${sign}${formatNumber(abs / 1_000_000, { maximumFractionDigits: 1 })}M`;
  }
}

/**
 * Formats a financial amount with proper accounting notation
 * (parentheses for negative values)
 * 
 * @param value Amount to format
 * @param currency Currency code
 * @returns Formatted amount with accounting notation
 */
export function formatAccountingValue(
  value: number,
  currency = 'USD'
): string {
  if (value >= 0) {
    return formatCurrency(value, currency);
  }
  
  // Use accounting notation (parentheses) for negative values
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencySign: 'accounting'
  };
  
  return formatNumber(value, options);
}

/**
 * Formats a financial ratio (e.g., P/E ratio, current ratio)
 * 
 * @param value Ratio value
 * @param decimals Number of decimal places
 * @returns Formatted ratio
 */
export function formatRatio(
  value: number,
  decimals = 2
): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Formats an interest rate for display
 * 
 * @param rate Interest rate as a decimal (e.g., 0.0525 for 5.25%)
 * @param decimals Number of decimal places
 * @returns Formatted interest rate
 */
export function formatInterestRate(
  rate: number,
  decimals = 2
): string {
  return formatPercent(rate, decimals);
}

/**
 * Creates a cache key for formatters based on options and locale
 */
function getCacheKey(
  options: Intl.NumberFormatOptions,
  locale: string
): string {
  return `${locale}|${JSON.stringify(options)}`;
}

/**
 * Gets the current locale from the environment or falls back to default
 */
function getLocale(): string {
  // Try to get locale from various sources
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  
  // Fall back to en-US if locale can't be determined
  return 'en-US';
}

/**
 * Formats a number with a specific number of decimal places
 * 
 * @param value Number to format
 * @param decimalPlaces Number of decimal places
 * @returns Formatted number string
 */
export function formatDecimal(
  value: number,
  decimalPlaces = 2
): string {
  return formatNumber(value, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
}

/**
 * Formats a value as compact notation (e.g., 1.2K, 4.5M)
 * 
 * @param value Number to format
 * @returns Formatted compact number
 */
export function formatCompact(value: number): string {
  const options: Intl.NumberFormatOptions = {
    notation: 'compact',
    compactDisplay: 'short'
  };
  
  return formatNumber(value, options);
}

/**
 * Formats a duration in months as years and months
 * 
 * @param months Total number of months
 * @returns Formatted duration string
 */
export function formatLoanTerm(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (years === 0) {
    return `${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
  } else if (remainingMonths === 0) {
    return `${years} year${years === 1 ? '' : 's'}`;
  } else {
    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
  }
}