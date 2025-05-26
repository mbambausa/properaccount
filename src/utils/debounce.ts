// src/utils/debounce.ts
/**
 * Debounce and throttle utilities
 */

/**
 * Creates a debounced version of a function that delays invoking the function
 * until after `delay` milliseconds have elapsed since the last time the
 * debounced function was invoked.
 *
 * @template T A function type.
 * @param {T} fn The function to debounce.
 * @param {number} delay The number of milliseconds to delay.
 * @returns {(...args: Parameters<T>) => void} The new debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Creates a throttled version of a function that only invokes the function
 * at most once per every `limit` milliseconds.
 *
 * @template T A function type.
 * @param {T} fn The function to throttle.
 * @param {number} limit The minimum time interval between invocations in milliseconds.
 * @returns {(...args: Parameters<T>) => void} The new throttled function.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null; // To store `this` context if needed

  return function(this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this; // Store `this` context
    if (!inThrottle) {
      fn.apply(lastThis, lastArgs); // Apply stored `this` and arguments
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        // Optionally, call fn again here with the lastArgs if it was invoked during the throttle period
        // if (lastArgs) {
        //   fn.apply(lastThis, lastArgs);
        //   lastArgs = null; // Reset lastArgs
        // }
      }, limit);
    }
  };
}