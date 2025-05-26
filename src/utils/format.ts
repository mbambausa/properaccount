// src/utils/format.ts
/**
 * Format utility functions
 *
 * This module provides utilities for formatting different types of data
 * including numbers, currencies, dates, and financial values, primarily using Intl APIs.
 */

// Cache for Intl.NumberFormat instances to improve performance.
const numberFormatters: Record<string, Intl.NumberFormat> = {};
// Cache for Intl.DateTimeFormat instances.
const dateTimeFormatters: Record<string, Intl.DateTimeFormat> = {};

/**
 * Gets the current locale.
 * Client-side: Attempts to use navigator.language.
 * Server-side (or if navigator is unavailable): Falls back to 'en-US'.
 * For proper server-side i18n, the locale should ideally be determined from
 * request context (e.g., Astro.currentLocale, Accept-Language header) and passed explicitly.
 */
function getLocale(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
  } catch (e) {
    // navigator might not be defined (e.g. server-side)
  }
  return 'en-US'; // Default fallback locale
}

/**
 * Creates a cache key for Intl formatters.
 * Note: JSON.stringify on objects doesn't guarantee property order.
 * For a highly robust cache key with many dynamic options, consider canonicalizing the options object (e.g., by sorting keys).
 * However, for typical usage with a limited set of option combinations, this is often sufficient.
 */
function getFormatterCacheKey(
  options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions,
  locale: string,
  type: 'number' | 'datetime'
): string {
  // Simple approach: stringify sorted keys to ensure consistent key for same options
  const sortedOptionsString = JSON.stringify(
    Object.entries(options).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
  );
  return `${type}|${locale}|${sortedOptionsString}`;
}

/**
 * Formats a number according to the specified options and locale.
 * @param value Number to format.
 * @param options Intl.NumberFormatOptions.
 * @param locale Optional locale string. Defaults to detected or 'en-US'.
 * @returns Formatted number string.
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale?: string
): string {
  const currentLocale = locale || getLocale();
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options // User options override defaults
  };

  const cacheKey = getFormatterCacheKey(defaultOptions, currentLocale, 'number');

  if (!numberFormatters[cacheKey]) {
    try {
      numberFormatters[cacheKey] = new Intl.NumberFormat(currentLocale, defaultOptions);
    } catch (e) {
      console.error(`Error creating Intl.NumberFormat for locale "${currentLocale}" with options:`, defaultOptions, e);
      // Fallback to en-US with basic options if formatter creation fails for the given locale
      const fallbackKey = getFormatterCacheKey({ minimumFractionDigits: 2, maximumFractionDigits: 2 }, 'en-US', 'number');
      if (!numberFormatters[fallbackKey]) {
        numberFormatters[fallbackKey] = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return numberFormatters[fallbackKey].format(value);
    }
  }
  return numberFormatters[cacheKey].format(value);
}

/**
 * Formats a number as currency.
 * @param value Amount to format.
 * @param currency Currency code (default: 'USD').
 * @param options Additional Intl.NumberFormatOptions.
 * @param locale Optional locale string.
 * @returns Formatted currency string.
 */
export function formatCurrency(
  value: number,
  currency = 'USD',
  options: Intl.NumberFormatOptions = {},
  locale?: string
): string {
  const currencyOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 2, // Default for most currencies
    maximumFractionDigits: 2,
    ...options
  };
  return formatNumber(value, currencyOptions, locale);
}

/**
 * Formats a number as a percentage.
 * @param value Decimal value to format as percentage (e.g., 0.25 for 25%).
 * @param fractionDigits Number of fraction digits to display. Defaults to 2.
 * @param locale Optional locale string.
 * @returns Formatted percentage string.
 */
export function formatPercent(
  value: number,
  fractionDigits = 2,
  locale?: string
): string {
  const percentOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  };
  return formatNumber(value, percentOptions, locale);
}

/**
 * Formats a date for display using Intl.DateTimeFormat dateStyle.
 * @param date Date object,parsable date string, or Unix timestamp (milliseconds).
 * @param format Intl.DateTimeFormatOptions dateStyle ('short', 'medium', 'long', 'full'). Defaults to 'medium'.
 * @param locale Optional locale string.
 * @returns Formatted date string.
 */
export function formatDate(
  date: Date | string | number,
  format: 'short' | 'medium' | 'long' | 'full' = 'medium',
  locale?: string
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.warn(`formatDate received an invalid date input: ${date}`);
    return 'Invalid Date';
  }
  const currentLocale = locale || getLocale();
  const options: Intl.DateTimeFormatOptions = { dateStyle: format };
  const cacheKey = getFormatterCacheKey(options, currentLocale, 'datetime');

  if (!dateTimeFormatters[cacheKey]) {
    try {
      dateTimeFormatters[cacheKey] = new Intl.DateTimeFormat(currentLocale, options);
    } catch (e) {
      console.error(`Error creating Intl.DateTimeFormat for locale "${currentLocale}" with options:`, options, e);
      const fallbackOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      const fallbackKey = getFormatterCacheKey(fallbackOptions, 'en-US', 'datetime');
      if (!dateTimeFormatters[fallbackKey]) {
        dateTimeFormatters[fallbackKey] = new Intl.DateTimeFormat('en-US', fallbackOptions);
      }
      return dateTimeFormatters[fallbackKey].format(dateObj);
    }
  }
  return dateTimeFormatters[cacheKey].format(dateObj);
}

/**
 * Formats a date and time for display.
 * @param date Date object, parsable date string, or Unix timestamp (milliseconds).
 * @param dateFormat Intl.DateTimeFormatOptions dateStyle. Defaults to 'medium'.
 * @param timeFormat Intl.DateTimeFormatOptions timeStyle. Defaults to 'short'.
 * @param locale Optional locale string.
 * @returns Formatted date and time string.
 */
export function formatDateTime(
  date: Date | string | number,
  dateFormat: 'short' | 'medium' | 'long' | 'full' = 'medium',
  timeFormat: 'short' | 'medium' = 'short', // 'long' & 'full' for timeStyle are less common
  locale?: string
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    console.warn(`formatDateTime received an invalid date input: ${date}`);
    return 'Invalid Date';
  }
  const currentLocale = locale || getLocale();
  const options: Intl.DateTimeFormatOptions = { dateStyle: dateFormat, timeStyle: timeFormat };
  const cacheKey = getFormatterCacheKey(options, currentLocale, 'datetime');
  
  if (!dateTimeFormatters[cacheKey]) {
     try {
      dateTimeFormatters[cacheKey] = new Intl.DateTimeFormat(currentLocale, options);
    } catch (e) {
      console.error(`Error creating Intl.DateTimeFormat for locale "${currentLocale}" with options:`, options, e);
      const fallbackOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
      const fallbackKey = getFormatterCacheKey(fallbackOptions, 'en-US', 'datetime');
      if(!dateTimeFormatters[fallbackKey]) {
        dateTimeFormatters[fallbackKey] = new Intl.DateTimeFormat('en-US', fallbackOptions);
      }
      return dateTimeFormatters[fallbackKey].format(dateObj);
    }
  }
  return dateTimeFormatters[cacheKey].format(dateObj);
}

/**
 * Formats account numbers. Example: groups digits in sets of 4.
 * Adjust regex if specific account number formats are required.
 * @param accountNumber Account number string.
 * @returns Formatted account number string.
 */
export function formatAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';
  const digits = accountNumber.replace(/\D/g, ''); // Remove non-digit characters
  // Example formatting: "1234 5678 9012". Adjust if needed.
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim(); 
}

/**
 * Formats large numbers with abbreviations (M for millions, B for billions, T for trillions).
 * @param value Number to format.
 * @param abbreviate Whether to abbreviate. Defaults to false.
 * @param locale Optional locale string.
 * @returns Formatted large number string.
 */
export function formatLargeNumber(
  value: number,
  abbreviate = false,
  locale?: string
): string {
  if (!abbreviate || Math.abs(value) < 1_000_000) {
    // For numbers less than 1M or if not abbreviating, use standard number formatting.
    return formatNumber(value, { maximumFractionDigits: 0 }, locale); // Example: whole numbers
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  let numPart: number;
  let suffix: string;

  if (absValue >= 1_000_000_000_000) {
    numPart = absValue / 1_000_000_000_000;
    suffix = 'T';
  } else if (absValue >= 1_000_000_000) {
    numPart = absValue / 1_000_000_000;
    suffix = 'B';
  } else { // absValue >= 1_000_000
    numPart = absValue / 1_000_000;
    suffix = 'M';
  }
  // Format the numeric part with one decimal place, then add sign and suffix.
  return `${sign}${formatNumber(numPart, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, locale)}${suffix}`;
}

/**
 * Formats a financial amount with accounting notation (parentheses for negative values for some locales).
 * @param value Amount to format.
 * @param currency Currency code. Defaults to 'USD'.
 * @param locale Optional locale string.
 * @returns Formatted amount with accounting notation.
 */
export function formatAccountingValue(
  value: number,
  currency = 'USD',
  locale?: string
): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    currencySign: 'accounting', // This enables accounting-specific formatting, like (100.00) for negatives in en-US
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  return formatNumber(value, options, locale);
}

/**
 * Formats a financial ratio.
 * @param value Ratio value.
 * @param decimals Number of decimal places. Defaults to 2.
 * @param locale Optional locale string.
 * @returns Formatted ratio string.
 */
export function formatRatio(
  value: number,
  decimals = 2,
  locale?: string
): string {
  return formatNumber(value, {
    minimumFractionDigits: decimals, // Show at least these decimals
    maximumFractionDigits: decimals  // Show at most these decimals
  }, locale);
}

/**
 * Formats an interest rate for display as a percentage.
 * @param rate Interest rate as a decimal (e.g., 0.0525 for 5.25%).
 * @param decimals Number of decimal places for the percentage. Defaults to 2.
 * @param locale Optional locale string.
 * @returns Formatted interest rate string (e.g., "5.25%").
 */
export function formatInterestRate(
  rate: number, // Expects rate as a decimal, e.g., 0.0525 for 5.25%
  decimals = 2,
  locale?: string
): string {
  return formatPercent(rate, decimals, locale);
}

/**
 * Formats a number with a specific number of decimal places.
 * @param value Number to format.
 * @param decimalPlaces Number of decimal places. Defaults to 2.
 * @param locale Optional locale string.
 * @returns Formatted number string.
 */
export function formatDecimal(
  value: number,
  decimalPlaces = 2,
  locale?: string
): string {
  return formatNumber(value, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }, locale);
}

/**
 * Formats a value using compact notation (e.g., 1.2K, 4.5M).
 * @param value Number to format.
 * @param locale Optional locale string.
 * @returns Formatted compact number string.
 */
export function formatCompact(value: number, locale?: string): string {
  const options: Intl.NumberFormatOptions = {
    notation: 'compact',
    compactDisplay: 'short', // "short" (e.g., 1.2K) or "long" (e.g., 1.2 thousand)
    // You might want to set min/max fraction digits for compact notation too.
    // minimumFractionDigits: 1, 
    // maximumFractionDigits: 1,
  };
  return formatNumber(value, options, locale);
}

/**
 * Formats a duration in months as a human-readable string (e.g., "2 years, 3 months").
 * @param totalMonths Total number of months.
 * @returns Formatted duration string.
 */
export function formatLoanTerm(totalMonths: number): string {
  if (isNaN(totalMonths) || totalMonths < 0) {
    return 'Invalid term';
  }
  if (totalMonths === 0) {
    return '0 months';
  }

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  const yearString = years > 0 ? `${years} year${years === 1 ? '' : 's'}` : '';
  const monthString = remainingMonths > 0 ? `${remainingMonths} month${remainingMonths === 1 ? '' : 's'}` : '';

  if (years > 0 && remainingMonths > 0) {
    return `${yearString}, ${monthString}`;
  } else if (years > 0) {
    return yearString;
  } else {
    return monthString;
  }
}