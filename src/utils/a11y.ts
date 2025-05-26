// src/utils/a11y.ts
/**
 * Accessibility (a11y) utilities
 * 
 * This module provides utilities for improving application accessibility
 * including focus management, ARIA attributes, keyboard navigation,
 * announcements for screen readers, and more.
 */

// ----------------
// Focus Management
// ----------------

/**
 * Traps focus within a specified element
 * 
 * @param element The element within which to trap focus
 * @returns Function to remove the focus trap
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = getFocusableElements(element);
  
  if (focusableElements.length === 0) {
    console.warn('No focusable elements found within the trap container');
    return () => {};
  }
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (event: KeyboardEvent) => {
    // If Tab key is pressed
    if (event.key === 'Tab') {
      // If Shift + Tab on first element, move to last element
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // If Tab on last element, move to first element
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    
    // If Escape key is pressed, release focus trap
    if (event.key === 'Escape') {
      removeTrap();
    }
  };
  
  // Set initial focus if no element inside is focused
  if (!element.contains(document.activeElement)) {
    firstElement.focus();
  }
  
  // Add event listener
  element.addEventListener('keydown', handleKeyDown);
  
  // Return function to remove the trap
  const removeTrap = () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
  
  return removeTrap;
}

/**
 * Gets all focusable elements within a container
 * 
 * @param container The container element
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]:not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    'details:not([tabindex="-1"])',
    'summary:not([tabindex="-1"])',
    '[contenteditable="true"]:not([tabindex="-1"])'
  ].join(',');
  
  return Array.from(container.querySelectorAll<HTMLElement>(selectors));
}

/**
 * Saves the current focus state and returns a function to restore it
 * 
 * @returns Function to restore focus
 */
export function saveFocus(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement;
  
  return () => {
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}

// --------------------------
// ARIA and Semantic Helpers
// --------------------------

/**
 * Creates ARIA live region for announcements
 * 
 * @param politeness Politeness level ('polite' or 'assertive')
 * @returns The created live region element
 */
export function createLiveRegion(
  politeness: 'polite' | 'assertive' = 'polite'
): HTMLElement {
  const region = document.createElement('div');
  
  region.setAttribute('aria-live', politeness);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('class', 'sr-only');
  region.setAttribute('data-a11y-live', 'true');
  
  document.body.appendChild(region);
  
  return region;
}

/**
 * Announces a message to screen readers
 * 
 * @param message Message to announce
 * @param politeness Politeness level ('polite' or 'assertive')
 */
export function announce(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
): void {
  // Look for existing live region with the desired politeness
  let liveRegion = document.querySelector(
    `[data-a11y-live][aria-live="${politeness}"]`
  ) as HTMLElement;
  
  // Create it if it doesn't exist
  if (!liveRegion) {
    liveRegion = createLiveRegion(politeness);
  }
  
  // Update the message
  liveRegion.textContent = '';
  
  // Use setTimeout to ensure the update is registered by screen readers
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * Creates an accessible description connection between elements
 * 
 * @param element Element to be described
 * @param description Description text
 * @returns ID of the description element
 */
export function createAccessibleDescription(
  element: HTMLElement,
  description: string
): string {
  // Check if element already has a description
  const existingId = element.getAttribute('aria-describedby');
  
  if (existingId) {
    const existingElement = document.getElementById(existingId);
    if (existingElement) {
      existingElement.textContent = description;
      return existingId;
    }
  }
  
  // Create new description element
  const id = `desc-${generateId()}`;
  const descriptionElement = document.createElement('div');
  
  descriptionElement.id = id;
  descriptionElement.className = 'sr-only';
  descriptionElement.textContent = description;
  
  // Add it to the DOM
  element.parentNode?.appendChild(descriptionElement);
  
  // Connect it to the element
  element.setAttribute('aria-describedby', id);
  
  return id;
}

// ------------------------
// Keyboard Accessibility
// ------------------------

/**
 * Makes an element activate on Space key like a button
 * 
 * @param element Element to make space-activatable
 * @param callback Function to call when activated
 * @returns Function to remove the listener
 */
export function makeSpaceActivatable(
  element: HTMLElement,
  callback: () => void
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      callback();
    }
  };
  
  element.addEventListener('keydown', handleKeyDown);
  
  // Ensure element is focusable
  if (!element.getAttribute('tabindex')) {
    element.setAttribute('tabindex', '0');
  }
  
  // Add role button if no role is present
  if (!element.getAttribute('role')) {
    element.setAttribute('role', 'button');
  }
  
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Enables arrow key navigation within a group of elements
 * 
 * @param container Container element
 * @param selector CSS selector for navigable elements
 * @param orientation Navigation orientation ('horizontal' or 'vertical')
 * @returns Function to remove the listeners
 */
export function enableArrowNavigation(
  container: HTMLElement,
  selector: string,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Only process arrow keys
    if (
      event.key !== 'ArrowUp' && 
      event.key !== 'ArrowDown' && 
      event.key !== 'ArrowLeft' && 
      event.key !== 'ArrowRight'
    ) {
      return;
    }
    
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (elements.length === 0) return;
    
    const currentIndex = elements.findIndex(element => 
      element === document.activeElement
    );
    
    let nextIndex = currentIndex;
    
    // Handle different arrow keys based on orientation
    if (orientation === 'horizontal') {
      if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % elements.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + elements.length) % elements.length;
      }
    } else { // vertical
      if (event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % elements.length;
      } else if (event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + elements.length) % elements.length;
      }
    }
    
    if (nextIndex !== currentIndex && elements[nextIndex]) {
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
 * Creates a skip link for keyboard navigation
 * 
 * @param targetId ID of the target element to skip to
 * @param label Text label for the skip link
 * @returns The created skip link element
 */
export function createSkipLink(
  targetId: string,
  label = 'Skip to main content'
): HTMLElement {
  const skipLink = document.createElement('a');
  
  skipLink.href = `#${targetId}`;
  skipLink.className = 'skip-link';
  skipLink.textContent = label;
  
  // Add styling that keeps it hidden until focused
  skipLink.style.position = 'absolute';
  skipLink.style.top = '-40px';
  skipLink.style.left = '0';
  skipLink.style.padding = '8px';
  skipLink.style.zIndex = '100';
  skipLink.style.background = '#fff';
  skipLink.style.transition = 'top 0.2s';
  
  // Show the link when it receives focus
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });
  
  // Hide the link when it loses focus
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  // Insert at the beginning of the body
  if (document.body.firstChild) {
    document.body.insertBefore(skipLink, document.body.firstChild);
  } else {
    document.body.appendChild(skipLink);
  }
  
  return skipLink;
}

// ------------------------
// Form Accessibility
// ------------------------

/**
 * Validates form field and provides accessible error messaging
 * 
 * @param field Form field element
 * @param validationFn Validation function
 * @param errorMessage Error message
 * @returns Whether the field is valid
 */
export function validateField(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  validationFn: (value: string) => boolean,
  errorMessage: string
): boolean {
  const isValid = validationFn(field.value);
  
  // Get or create error element
  let errorId = field.getAttribute('aria-errormessage');
  let errorElement: HTMLElement | null = null;
  
  if (errorId) {
    errorElement = document.getElementById(errorId);
  }
  
  if (!errorElement) {
    errorId = `error-${generateId()}`;
    errorElement = document.createElement('div');
    errorElement.id = errorId;
    errorElement.className = 'field-error';
    errorElement.setAttribute('aria-live', 'polite');
    
    // Insert after the field
    field.parentNode?.insertBefore(errorElement, field.nextSibling);
    field.setAttribute('aria-errormessage', errorId);
  }
  
  // Update attributes and messages based on validity
  if (isValid) {
    field.setAttribute('aria-invalid', 'false');
    errorElement.textContent = '';
    errorElement.hidden = true;
  } else {
    field.setAttribute('aria-invalid', 'true');
    errorElement.textContent = errorMessage;
    errorElement.hidden = false;
  }
  
  return isValid;
}

/**
 * Adds accessible labels to form fields
 * 
 * @param fieldId ID of the form field
 * @param labelText Text for the label
 * @returns The created label element
 */
export function addAccessibleLabel(
  fieldId: string,
  labelText: string
): HTMLLabelElement {
  const field = document.getElementById(fieldId);
  if (!field) {
    throw new Error(`Field with ID ${fieldId} not found`);
  }
  
  const label = document.createElement('label');
  label.htmlFor = fieldId;
  label.textContent = labelText;
  
  // Insert before the field
  field.parentNode?.insertBefore(label, field);
  
  return label;
}

// ------------------------
// Utility Functions
// ------------------------

/**
 * Generates a unique ID for accessibility attributes
 * 
 * @returns Unique ID string
 */
function generateId(): string {
  return `a11y-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Checks if an element is visible to screen readers
 * 
 * @param element Element to check
 * @returns Whether the element is accessible to screen readers
 */
export function isScreenReaderAccessible(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  
  // Check for conditions that would make element inaccessible
  if (
    styles.display === 'none' ||
    styles.visibility === 'hidden' ||
    element.getAttribute('aria-hidden') === 'true' ||
    (
      styles.position === 'absolute' &&
      styles.width === '1px' &&
      styles.height === '1px' &&
      styles.overflow === 'hidden' &&
      styles.clip === 'rect(0px, 0px, 0px, 0px)'
    )
  ) {
    return false;
  }
  
  return true;
}

/**
 * Class to add to elements that should be visible only to screen readers
 */
export const srOnlyCss = `
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`;

/**
 * Generates HTML for sr-only CSS class inclusion
 */
export function getSrOnlyStyle(): string {
  return `<style>${srOnlyCss}</style>`;
}