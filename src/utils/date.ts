// src/utils/date.ts

/**
 * Formats a date into MM/DD/YYYY string using the 'en-US' locale.
 * 
 * @param date - The date to format
 * @param options - Optional formatting options
 * @returns A string representing the date in MM/DD/YYYY format
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }
): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn(`formatDate received an invalid date input: ${date}`);
    return 'Invalid Date';
  }
  return d.toLocaleDateString('en-US', options);
}

/**
 * Formats a date into YYYY-MM-DD string, suitable for HTML date input fields.
 * 
 * @param date - The date to format
 * @returns A string representing the date in YYYY-MM-DD format
 */
export function formatDateForInput(date?: Date | string | number): string {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn(`formatDateForInput received an invalid date input: ${date}`);
    return '';
  }
  
  // Use UTC methods to avoid timezone issues in date input fields
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the start and end dates for predefined or custom date ranges.
 * 
 * @param range - The type of date range to calculate
 * @param customStartStr - The start date for a 'custom' range (YYYY-MM-DD string)
 * @param customEndStr - The end date for a 'custom' range (YYYY-MM-DD string)
 * @returns An object containing the start and end Date objects for the range
 */
export function getDateRange(
  range: 'current-month' | 'last-month' | 'current-year' | 'last-year' | 'custom' | 'today' | 'ytd' | 'quarter',
  customStartStr?: string,
  customEndStr?: string
): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (range) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
      
    case 'current-month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
      
    case 'last-month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
      
    case 'current-year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
      
    case 'last-year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      break;
      
    case 'ytd': // Year to date
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
      
    case 'quarter': // Current quarter
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      break;
      
    case 'custom':
      // Parse custom dates from YYYY-MM-DD strings
      if (customStartStr) {
        const [y, m, d] = customStartStr.split('-').map(Number);
        start = new Date(Date.UTC(y, m - 1, d)); // Use UTC to avoid timezone issues
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      
      if (customEndStr) {
        const [y, m, d] = customEndStr.split('-').map(Number);
        end = new Date(Date.UTC(y, m - 1, d));
      } else {
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
      
      if (start > end) {
        console.warn(`getDateRange 'custom': Start date (${customStartStr}) is after end date (${customEndStr}). Swapping them.`);
        [start, end] = [end, start];
      }
      break;
      
    default:
      console.error(`getDateRange received an unknown range type: ${range}`);
      const todayStart = new Date(now);
      todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23,59,59,999);
      start = todayStart;
      end = todayEnd;
  }

  // Set time to the beginning of the start day and end of the end day for full day inclusion
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Converts a Unix timestamp (seconds) to a Date object.
 * 
 * @param timestampSeconds - The Unix timestamp in seconds
 * @returns A Date object
 */
export function dateFromUnixTimestamp(timestampSeconds: number): Date {
  return new Date(timestampSeconds * 1000);
}

/**
 * Converts a Date object to a Unix timestamp (seconds).
 * 
 * @param date - The Date object
 * @returns The Unix timestamp in seconds
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Safely parses a date string in YYYY-MM-DD format to a Date object.
 * 
 * @param dateStr - The date string in YYYY-MM-DD format
 * @returns A Date object or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // For YYYY-MM-DD format
  const pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateStr.match(pattern);
  
  if (!match) return null;
  
  const [_, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  
  // Validate date components
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  
  const date = new Date(year, month, day);
  
  // Check if the date is valid (e.g., not Feb 30)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  
  return date;
}

/**
 * Gets the fiscal quarter of a date.
 * 
 * @param date - The date
 * @param fiscalYearStartMonth - The month when the fiscal year starts (0-11, default: 0 = January)
 * @returns The fiscal quarter (1-4)
 */
export function getFiscalQuarter(date: Date, fiscalYearStartMonth: number = 0): number {
  const month = date.getMonth();
  const fiscalMonth = (12 + month - fiscalYearStartMonth) % 12;
  return Math.floor(fiscalMonth / 3) + 1;
}

/**
 * Gets the fiscal year of a date.
 * 
 * @param date - The date
 * @param fiscalYearStartMonth - The month when the fiscal year starts (0-11, default: 0 = January)
 * @returns The fiscal year
 */
export function getFiscalYear(date: Date, fiscalYearStartMonth: number = 0): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // If the current month is before the fiscal year start month, we're in the previous fiscal year
  return (month < fiscalYearStartMonth) ? year - 1 : year;
}