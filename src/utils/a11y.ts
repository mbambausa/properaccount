// src/utils/a11y.ts
/**
 * Accessibility (a11y) utilities
 *
 * This module provides client-side utilities for improving application accessibility
 * including focus management, ARIA attributes, keyboard navigation,
 * announcements for screen readers, and more.
 * These are primarily for enhancing plain HTML or for use within Alpine.js components
 * where direct DOM manipulation or specific a11y patterns are needed.
 */

// ----------------
// Focus Management
// ----------------

/**
 * Traps focus within a specified HTMLElement.
 * Useful for modals, dialogs, and other overlay components.
 *
 * @param element The HTMLElement within which to trap focus.
 * @returns A function to call to remove the focus trap and event listeners.
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = getFocusableElements(element);

  if (focusableElements.length === 0) {
    console.warn('[a11y] No focusable elements found within the trap container:', element);
    return () => {}; // Return a no-op function
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      if (event.shiftKey) { // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else { // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    } else if (event.key === 'Escape') {
      // Optionally, the component using trapFocus can decide what Escape does (e.g., close modal)
      // For now, we just ensure the trap can be removed.
      // Consider adding a callback for Escape if needed: e.g., trapFocus(element, onEscapeCallback)
      // removeTrap(); // This would remove it on Escape, which might not always be desired from here.
    }
  };

  // Set initial focus to the first focusable element if no element inside the trap is currently focused.
  if (!element.contains(document.activeElement)) {
    firstElement.focus();
  }

  element.addEventListener('keydown', handleKeyDown);

  const removeTrap = () => {
    element.removeEventListener('keydown', handleKeyDown);
  };

  return removeTrap;
}

/**
 * Gets all focusable elements within a given container HTMLElement.
 *
 * @param container The HTMLElement to search within.
 * @returns An array of focusable HTMLElements.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]:not([tabindex="-1"]):not([disabled])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])', // Elements with explicit positive tabindex
    'details:not([tabindex="-1"]) > summary:first-of-type:not([tabindex="-1"])', // Focus summary of details
    '[contenteditable="true"]:not([tabindex="-1"])'
  ].join(',');

  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(el => {
    // Additional check for visibility, as querySelectorAll doesn't consider computed styles.
    // This is a basic check; more robust visibility checking can be complex.
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });
}

/**
 * Saves the currently focused HTMLElement and returns a function to restore focus to it.
 * Useful for when opening modals or temporary UI elements.
 *
 * @returns A function that, when called, attempts to restore focus to the previously active element.
 */
export function saveFocus(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  return () => {
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch (e) {
        // Element might no longer be focusable or exist in the DOM
        console.warn('[a11y] Could not restore focus to previously active element:', previouslyFocused, e);
      }
    }
  };
}

// --------------------------
// ARIA and Semantic Helpers
// --------------------------

/**
 * Creates and appends an ARIA live region to the document body for screen reader announcements.
 * If a region with the same politeness already exists (created by this system), it's reused.
 *
 * @param politeness The politeness level for the live region ('polite' or 'assertive'). Defaults to 'polite'.
 * @returns The created or existing HTMLElement for the live region.
 */
export function createLiveRegion(
  politeness: 'polite' | 'assertive' = 'polite'
): HTMLElement {
  const liveRegionId = `a11y-live-region-${politeness}`;
  let region = document.getElementById(liveRegionId);

  if (!region) {
    region = document.createElement('div');
    region.id = liveRegionId;
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true'); // Ensures the entire region is announced
    // Use UnoCSS sr-only class if available and consistently applied, or define styles.
    // For self-contained utility, direct styling or a minimal class is okay.
    region.className = 'sr-only'; // Assuming 'sr-only' is globally available (e.g., via UnoCSS)
    // If not, apply styles directly:
    // Object.assign(region.style, { position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0' });
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Announces a message to screen readers using an ARIA live region.
 *
 * @param message The message string to announce.
 * @param politeness The politeness level ('polite' or 'assertive'). Defaults to 'polite'.
 */
export function announce(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
): void {
  const liveRegion = createLiveRegion(politeness); // Ensures region exists

  // Clear previous message and set new one.
  // Timeout helps ensure screen readers pick up the change consistently.
  liveRegion.textContent = '';
  setTimeout(() => {
    if (liveRegion) { // Check if liveRegion is still in the DOM, though createLiveRegion should ensure it.
        liveRegion.textContent = message;
    }
  }, 50); // Small delay for screen reader announcement
}

/**
 * Creates an accessible description for an element using `aria-describedby`.
 * Appends a visually hidden div containing the description text.
 *
 * @param element The HTMLElement to be described.
 * @param description The description text.
 * @returns The ID of the created description element.
 */
export function createAccessibleDescription(
  element: HTMLElement,
  description: string
): string {
  const existingDescId = element.getAttribute('aria-describedby');
  if (existingDescId) {
    const existingDescElement = document.getElementById(existingDescId);
    if (existingDescElement) {
      existingDescElement.textContent = description;
      return existingDescId;
    }
  }

  const newDescId = `desc-${generateId()}`;
  const descriptionElement = document.createElement('div');
  descriptionElement.id = newDescId;
  descriptionElement.className = 'sr-only'; // Use UnoCSS sr-only class
  descriptionElement.textContent = description;

  // Append near the element, typically after it, for DOM order relevance if styles fail.
  element.insertAdjacentElement('afterend', descriptionElement);
  element.setAttribute('aria-describedby', newDescId);

  return newDescId;
}

// ------------------------
// Keyboard Accessibility
// ------------------------

/**
 * Makes an element activatable with the Space key, similar to a button.
 * Also ensures `tabindex="0"` and `role="button"` if not already set.
 *
 * @param element The HTMLElement to make space-activatable.
 * @param callback The function to call when the element is activated by Space or Enter.
 * @returns A function to remove the event listener.
 */
export function makeActivatable( // Renamed for clarity (Space or Enter)
  element: HTMLElement,
  callback: (event: KeyboardEvent | MouseEvent) => void // Callback can receive event
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
      event.preventDefault(); // Prevent scrolling on Space or form submission on Enter
      callback(event);
    }
  };

  // For consistency, also trigger on click
  const handleClick = (event: MouseEvent) => {
      callback(event);
  };

  element.addEventListener('keydown', handleKeyDown);
  element.addEventListener('click', handleClick);


  if (element.getAttribute('tabindex') === null) {
    element.setAttribute('tabindex', '0');
  }
  if (!element.hasAttribute('role')) {
    // Only add role="button" if it's not a native button or link,
    // or if its existing role isn't conflicting.
    const tagName = element.tagName.toLowerCase();
    if (tagName !== 'button' && tagName !== 'a' && !['menuitem', 'tab', 'checkbox', 'radio'].includes(element.getAttribute('role') || '')) {
        element.setAttribute('role', 'button');
    }
  }

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
    element.removeEventListener('click', handleClick);
  };
}

/**
 * Enables arrow key navigation (horizontal or vertical) within a group of elements.
 *
 * @param container The HTMLElement containing the navigable items.
 * @param selector CSS selector for the navigable child elements.
 * @param orientation Navigation orientation ('horizontal' or 'vertical'). Defaults to 'horizontal'.
 * @param loop Whether navigation should loop around. Defaults to true.
 * @returns A function to remove the event listener.
 */
export function enableArrowNavigation(
  container: HTMLElement,
  selector: string,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
  loop = true
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const isVertical = orientation === 'vertical';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

    if (event.key !== prevKey && event.key !== nextKey) {
      if (!((event.key === 'ArrowUp' || event.key === 'ArrowDown') && isHorizontal) &&
          !((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isVertical)) {
        // Allow non-directional arrow keys if orientation doesn't match
        return;
      }
      if (!((isHorizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
            (isVertical && (event.key === 'ArrowUp' || event.key === 'ArrowDown')))) {
          return; // Only act on relevant arrow keys for the orientation
      }
    }
    
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0 // Filter for visible elements
    );
    if (elements.length === 0) return;

    const currentIndex = elements.findIndex(element => element === document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === nextKey) {
      nextIndex = currentIndex + 1;
      if (nextIndex >= elements.length) {
        if (loop) nextIndex = 0;
        else nextIndex = elements.length - 1; // Stay on last
      }
    } else if (event.key === prevKey) {
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        if (loop) nextIndex = elements.length - 1;
        else nextIndex = 0; // Stay on first
      }
    }

    if (nextIndex !== -1 && nextIndex !== currentIndex && elements[nextIndex]) {
      event.preventDefault();
      elements[nextIndex].focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

// ------------------------
// Skip Links
// ------------------------

/**
 * Creates and prepends a skip link to the document body for keyboard navigation.
 * Clicking the link will focus the target element.
 * Styling Note: For consistency with your project's styling (UnoCSS),
 * consider applying UnoCSS utility classes instead of direct style manipulation,
 * or define a dedicated class in your global CSS.
 *
 * @param targetId The ID of the HTMLElement to skip to (e.g., "main-content").
 * @param label The text label for the skip link. Defaults to "Skip to main content".
 * @returns The created skip link HTMLElement.
 */
export function createSkipLink(
  targetId: string,
  label = 'Skip to main content'
): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = label;

  // Recommended: Use CSS classes for styling for better maintainability & UnoCSS integration.
  // Example: skipLink.className = 'absolute z-100 p-2 bg-white transition-top focus:top-0 -top-10 left-0';
  // For self-contained utility, direct styles are functional:
  Object.assign(skipLink.style, {
    position: 'absolute',
    top: '-40px', // Hidden off-screen
    left: '0',
    padding: '8px',
    zIndex: '99999', // Ensure it's on top
    backgroundColor: 'white', // Ensure visibility against various backgrounds
    color: 'black',
    textDecoration: 'underline',
    transition: 'top 0.1s ease-out',
  });

  const showLink = () => { skipLink.style.top = '0'; };
  const hideLink = () => { skipLink.style.top = '-40px'; };

  skipLink.addEventListener('focus', showLink);
  skipLink.addEventListener('blur', hideLink);

  // Focus the target element when the skip link is clicked
  skipLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent URL hash change if not desired
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.setAttribute('tabindex', '-1'); // Make non-interactive elements focusable
      targetElement.focus();
      // Optionally remove tabindex after focus if it was temporarily added:
      // targetElement.addEventListener('blur', () => targetElement.removeAttribute('tabindex'), { once: true });
    }
    hideLink(); // Hide link after click
  });

  if (document.body) {
    document.body.insertBefore(skipLink, document.body.firstChild);
  } else {
    // Fallback if body isn't ready (less likely for typical client-side usage)
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertBefore(skipLink, document.body.firstChild);
    });
  }
  return skipLink;
}

// ------------------------
// Form Accessibility
// ------------------------

/**
 * Validates a form field and provides accessible error messaging using `aria-invalid` and `aria-errormessage`.
 * Note: In component-based UIs (Alpine.js, Astro components), prefer declarative error display
 * tied to component state rather than direct DOM manipulation from this utility, unless enhancing
 * plain, non-componentized HTML.
 *
 * @param field The form field (HTMLInputElement, HTMLSelectElement, or HTMLTextAreaElement).
 * @param validationFn A function that takes the field's value and returns true if valid, false otherwise.
 * @param errorMessage The error message to display/announce if validation fails.
 * @param errorElementId Optional ID of an existing element to display the error message.
 * If not provided, one will be created.
 * @returns True if the field is valid, false otherwise.
 */
export function validateField(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  validationFn: (value: string) => boolean,
  errorMessage: string,
  errorElementId?: string
): boolean {
  const isValid = validationFn(field.value);
  let errorElement: HTMLElement | null = errorElementId ? document.getElementById(errorElementId) : null;
  const fieldId = field.id || `field-${generateId()}`;
  if (!field.id) field.id = fieldId;

  const SROnlyErrorId = `${fieldId}-sr-error`;
  let srErrorElement = document.getElementById(SROnlyErrorId);

  if (!isValid) {
    field.setAttribute('aria-invalid', 'true');
    let visibleErrorId = errorElementId;

    if (!errorElement) { // Create a visible error message element if one isn't provided
      visibleErrorId = `${fieldId}-visible-error`;
      errorElement = document.getElementById(visibleErrorId);
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = visibleErrorId;
        // errorElement.className = 'field-error-visible'; // Style with CSS
        errorElement.style.color = 'red'; // Basic styling for visibility
        errorElement.style.fontSize = '0.875em';
        field.parentNode?.insertBefore(errorElement, field.nextSibling);
      }
    }
    if (errorElement) {
      errorElement.textContent = errorMessage;
      errorElement.hidden = false;
    }
    // Set aria-describedby to point to the visible error message
    field.setAttribute('aria-describedby', visibleErrorId || '');


    // Announce error for screen readers via a separate, sr-only live region tied to this field
    if (!srErrorElement) {
      srErrorElement = document.createElement('div');
      srErrorElement.id = SROnlyErrorId;
      srErrorElement.className = 'sr-only'; // Assumes sr-only class is available
      srErrorElement.setAttribute('aria-live', 'assertive'); // Assertive for immediate error feedback
      field.parentNode?.insertBefore(srErrorElement, field.nextSibling); // Or another suitable location
    }
    // Change content to trigger announcement
    srErrorElement.textContent = ''; 
    setTimeout(() => { if(srErrorElement) srErrorElement.textContent = errorMessage; }, 50);


  } else {
    field.setAttribute('aria-invalid', 'false');
    field.removeAttribute('aria-describedby'); // Remove if it pointed to an error message

    if (errorElement) {
      errorElement.textContent = '';
      errorElement.hidden = true;
    }
    if (srErrorElement) {
      srErrorElement.textContent = ''; // Clear SR error
    }
  }
  return isValid;
}

/**
 * Ensures a form field has an associated accessible label.
 * If the field doesn't have an id, one is generated.
 * If a label doesn't exist, one is created and prepended.
 *
 * @param field The HTMLInputElement, HTMLSelectElement, or HTMLTextAreaElement.
 * @param labelText The text content for the label.
 * @returns The HTMLLabelElement (either existing or newly created).
 */
export function ensureAccessibleLabel(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  labelText: string
): HTMLLabelElement {
  if (!field.id) {
    field.id = `field-${generateId()}`;
  }

  let label = document.querySelector(`label[for="${field.id}"]`) as HTMLLabelElement | null;
  if (!label) {
    label = document.createElement('label');
    label.htmlFor = field.id;
    label.textContent = labelText;
    field.parentNode?.insertBefore(label, field);
  } else if (label.textContent !== labelText && !label.getAttribute('aria-label')) {
    // If label exists but text is different, update it or consider if this is intended
    // For this utility, we'll assume updating the text if it's not an aria-label
    label.textContent = labelText;
  }
  return label;
}

// ------------------------
// Utility Functions
// ------------------------

/**
 * Generates a more robust unique ID, suitable for accessibility attributes.
 * Uses crypto.randomUUID() if available.
 *
 * @returns A unique ID string.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers, some test envs)
  return `a11y-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Checks if an element is considered visible to users (and potentially screen readers).
 * This is a basic check; robust visibility detection can be complex.
 *
 * @param element The HTMLElement to check.
 * @returns True if the element is likely visible, false otherwise.
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;
  const styles = window.getComputedStyle(element);

  return (
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    styles.opacity !== '0' &&
    element.getAttribute('aria-hidden') !== 'true' &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
  );
}

/**
 * CSS for a screen-reader-only class.
 * Recommendation: Use UnoCSS's 'sr-only' utility class directly in your components/HTML.
 * This constant is provided if you need to programmatically apply these styles
 * or for contexts where UnoCSS classes might not be available.
 */
export const SR_ONLY_CSS_TEXT = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

/**
 * Returns an HTML <style> tag string containing the sr-only CSS.
 * Recommendation: Prefer using UnoCSS's 'sr-only' utility class.
 */
export function getSrOnlyStyleTag(): string {
  return `<style>.sr-only { ${SR_ONLY_CSS_TEXT} }</style>`;
}