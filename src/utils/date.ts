// src/utils/date.ts
/**
 * Formats a date into YYYY-MM-DD string using UTC methods, suitable for HTML date input fields.
 * This helps avoid timezone-related issues where the date might shift by a day.
 * * @param date - The date to format (Date object, string, or Unix timestamp in milliseconds). Optional.
 * @returns A string representing the date in YYYY-MM-DD format, or an empty string if input is invalid/null.
 */
export function formatDateForInput(date?: Date | string | number): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn(`formatDateForInput received an invalid date input: ${date}`);
    return '';
  }
  
  // Use UTC methods to ensure the date is not affected by local timezone offsets.
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the start and end dates for predefined or custom date ranges.
 * For 'custom' ranges, input strings are assumed to be YYYY-MM-DD.
 * All start/end dates are set to represent the full day in UTC (start: 00:00:00.000Z, end: 23:59:59.999Z).
 * * @param range - The type of date range to calculate.
 * @param customStartStr - The start date for a 'custom' range (YYYY-MM-DD string).
 * @param customEndStr - The end date for a 'custom' range (YYYY-MM-DD string).
 * @returns An object containing the start and end Date objects for the range (representing UTC boundaries).
 */
export function getDateRange(
  range: 'current-month' | 'last-month' | 'current-year' | 'last-year' | 'custom' | 'today' | 'ytd' | 'quarter',
  customStartStr?: string,
  customEndStr?: string
): { start: Date; end: Date } {
  const now = new Date(); // Current date in local timezone
  let start: Date;
  let end: Date;

  switch (range) {
    case 'today':
      // For 'today', use local date parts but then set to UTC midnight
      start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      break;
      
    case 'current-month':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      // End of current month: go to start of next month, then subtract 1 millisecond (or day and set time)
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      break;
      
    case 'last-month':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      break;
      
    case 'current-year':
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); // January 1st
      end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31)); // December 31st
      break;
      
    case 'last-year':
      start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31));
      break;
      
    case 'ytd': // Year to date (UTC)
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      break;
      
    case 'quarter': // Current quarter (UTC based on current UTC date)
      const currentUTCMonth = now.getUTCMonth();
      const currentUTCYear = now.getUTCFullYear();
      const quarterStartMonth = Math.floor(currentUTCMonth / 3) * 3;
      start = new Date(Date.UTC(currentUTCYear, quarterStartMonth, 1));
      end = new Date(Date.UTC(currentUTCYear, quarterStartMonth + 3, 0));
      break;
      
    case 'custom':
      if (customStartStr) {
        const [y, m, d] = customStartStr.split('-').map(Number);
        // Create Date object using UTC values to avoid local timezone interpretation of YYYY-MM-DD
        start = new Date(Date.UTC(y, m - 1, d)); 
      } else {
        // Default to current UTC day if customStartStr is not provided
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      }
      
      if (customEndStr) {
        const [y, m, d] = customEndStr.split('-').map(Number);
        end = new Date(Date.UTC(y, m - 1, d));
      } else {
        // Default to current UTC day if customEndStr is not provided
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      }
      
      if (start.getTime() > end.getTime()) { // Compare timestamps for accurate date comparison
        console.warn(`getDateRange 'custom': Start date (${customStartStr}) is after end date (${customEndStr}). Swapping them.`);
        [start, end] = [end, start];
      }
      break;
      
    default:
      // Fallback to current UTC day
      console.error(`getDateRange received an unknown range type: ${range}. Defaulting to today (UTC).`);
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  // Set time to the beginning of the start day (00:00:00.000Z)
  start.setUTCHours(0, 0, 0, 0);
  // Set time to the end of the end day (23:59:59.999Z)
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Converts a Unix timestamp (seconds) to a Date object.
 * The resulting Date object will represent a point in time, and its string representation
 * will depend on the locale of the environment calling methods like .toString() or .toLocaleDateString().
 * * @param timestampSeconds - The Unix timestamp in seconds.
 * @returns A Date object.
 */
export function dateFromUnixTimestamp(timestampSeconds: number): Date {
  return new Date(timestampSeconds * 1000);
}

/**
 * Converts a Date object to a Unix timestamp (seconds).
 * * @param date - The Date object.
 * @returns The Unix timestamp in seconds.
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Safely parses a date string in YYYY-MM-DD format to a Date object,
 * interpreting the input as a UTC date to avoid timezone shifts.
 * The returned Date object will represent midnight UTC on that date.
 * * @param dateStr - The date string in YYYY-MM-DD format.
 * @returns A Date object representing midnight UTC of the parsed date, or null if invalid.
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  const pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(pattern);
  
  if (!match) {
    console.warn(`parseDate: Invalid date string format. Expected YYYY-MM-DD, got ${dateStr}`);
    return null;
  }
  
  const [_, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JavaScript month is 0-indexed
  const day = parseInt(dayStr, 10);
  
  // Validate month and day ranges
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    console.warn(`parseDate: Invalid month or day in ${dateStr}`);
    return null;
  }
  
  // Create a date using UTC values to ensure it's interpreted as midnight UTC
  const date = new Date(Date.UTC(year, month, day));
  
  // Final check: ensure the date components didn't roll over (e.g. Feb 30th -> Mar 2nd)
  // This can happen if, for example, day was 31 for a month with 30 days.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    console.warn(`parseDate: Date components rolled over for ${dateStr}, indicating an invalid date (e.g., Feb 30).`);
    return null;
  }
  
  return date;
}

/**
 * Gets the fiscal quarter of a date.
 * Assumes the input Date object is correctly representing the intended point in time.
 * * @param date - The date.
 * @param fiscalYearStartMonth - The month when the fiscal year starts (0-11, default: 0 = January).
 * @returns The fiscal quarter (1-4).
 */
export function getFiscalQuarter(date: Date, fiscalYearStartMonth: number = 0): 1 | 2 | 3 | 4 {
  // Normalize fiscalYearStartMonth to be within 0-11
  const normalizedFiscalStartMonth = (fiscalYearStartMonth % 12 + 12) % 12;
  
  const month = date.getMonth(); // 0-11
  // Adjust month relative to fiscal year start
  const fiscalMonth = (12 + month - normalizedFiscalStartMonth) % 12;
  return (Math.floor(fiscalMonth / 3) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Gets the fiscal year of a date.
 * Assumes the input Date object is correctly representing the intended point in time.
 * * @param date - The date.
 * @param fiscalYearStartMonth - The month when the fiscal year starts (0-11, default: 0 = January).
 * @returns The fiscal year.
 */
export function getFiscalYear(date: Date, fiscalYearStartMonth: number = 0): number {
  // Normalize fiscalYearStartMonth to be within 0-11
  const normalizedFiscalStartMonth = (fiscalYearStartMonth % 12 + 12) % 12;

  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  // If the current month is before the fiscal year start month,
  // it means we are in the fiscal year that started in the previous calendar year.
  return (month < normalizedFiscalStartMonth) ? year -1 : year;
}