// src/utils/date.ts

/**
 * Formats a date into MM/DD/YYYY string.
 * Note: `toLocaleDateString` uses the system's local timezone by default.
 * For timezone-sensitive applications, ensure dates are handled consistently (e.g., by always working in UTC
 * or by explicitly passing a timezone to `toLocaleDateString` if needed, though direct timezone support
 * in `toLocaleDateString` can vary by JS environment).
 *
 * @param date - The date to format, can be a Date object, string, or number (timestamp).
 * @returns A string representing the date in MM/DD/YYYY format.
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  // Ensure the date is valid before formatting to avoid "Invalid Date" string
  if (isNaN(d.getTime())) {
    console.warn(`formatDate received an invalid date input: ${date}`);
    return 'Invalid Date';
  }
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formats a date into YYYY-MM-DD string, suitable for HTML date input fields.
 * Note: `toISOString()` converts the date to UTC before formatting.
 * If the input `Date` object was created from a local time string without timezone info,
 * it might represent a different UTC day than the local day.
 * Example: '2023-05-19' (local) could become '2023-05-18' if local timezone is ahead of UTC.
 * For consistency, ensure date inputs are handled with timezone awareness.
 *
 * @param date - The date to format, can be a Date object, string, or number (timestamp).
 * @returns A string representing the date in YYYY-MM-DD format (UTC date part).
 */
export function formatDateForInput(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn(`formatDateForInput received an invalid date input: ${date}`);
    return ''; // Return empty string or handle as appropriate for invalid input
  }
  // `toISOString()` returns a string like "2023-05-19T10:00:00.000Z".
  // We only need the date part.
  return d.toISOString().split('T')[0];
}

/**
 * Calculates the start and end dates for predefined or custom date ranges.
 * All calculations are based on the system's current local timezone.
 *
 * @param range - The type of date range to calculate.
 * @param customStart - The start date for a 'custom' range (YYYY-MM-DD string).
 * @param customEnd - The end date for a 'custom' range (YYYY-MM-DD string).
 * @returns An object containing the start and end Date objects for the range.
 * For 'custom' range, if start/end are invalid, they default to the current date.
 */
export function getDateRange(
  range: 'current-month' | 'last-month' | 'current-year' | 'last-year' | 'custom',
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (range) {
    case 'current-month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      // Last day of the current month
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last-month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      // Last day of the previous month
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'current-year':
      start = new Date(now.getFullYear(), 0, 1); // January 1st
      end = new Date(now.getFullYear(), 11, 31); // December 31st
      break;
    case 'last-year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      break;
    case 'custom':
      // For custom dates, parse the input strings.
      // Ensure that if only one is provided, the other defaults reasonably,
      // or handle as an error/specific logic.
      // The Date constructor with a YYYY-MM-DD string parses it as UTC midnight.
      // To treat it as local, one might need to parse manually or adjust.
      // For simplicity, new Date('YYYY-MM-DD') is used, which can have timezone implications.
      const parsedCustomStart = customStart ? new Date(customStart) : null;
      const parsedCustomEnd = customEnd ? new Date(customEnd) : null;

      start = parsedCustomStart && !isNaN(parsedCustomStart.getTime()) ? parsedCustomStart : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Default to today if invalid
      end = parsedCustomEnd && !isNaN(parsedCustomEnd.getTime()) ? parsedCustomEnd : new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Default to today if invalid
      
      // Ensure start is not after end for custom ranges
      if (start > end) {
        console.warn(`getDateRange 'custom': Start date (${customStart}) is after end date (${customEnd}). Swapping them.`);
        [start, end] = [end, start]; // Swap them
      }
      break;
    default:
      // Should not happen with TypeScript, but good for robustness
      console.error(`getDateRange received an unknown range type: ${range}`);
      // Default to current day for safety
      start = new Date(now.setHours(0,0,0,0));
      end = new Date(now.setHours(23,59,59,999));
  }

  // Set time to the beginning of the start day and end of the end day for full day inclusion.
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Converts a Unix timestamp (seconds) to a Date object.
 * @param timestampSeconds - The Unix timestamp in seconds.
 * @returns A Date object.
 */
export function dateFromUnixTimestamp(timestampSeconds: number): Date {
  return new Date(timestampSeconds * 1000);
}

/**
 * Converts a Date object to a Unix timestamp (seconds).
 * @param date - The Date object.
 * @returns The Unix timestamp in seconds.
 */
export function dateToUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
