/**
 * Shared focus trap utilities for modal/panel components.
 *
 * Combines shadow DOM and light DOM focusable elements to create
 * a Tab-key focus loop within a container element.
 */

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab/Shift+Tab focus within a container element.
 * Searches both the shadow root container and the host's light DOM children.
 */
export function trapFocus(
  e: KeyboardEvent,
  container: Element | null | undefined,
  host: Element,
): void {
  if (!container) return;

  const focusable = [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ...(host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []),
  ];
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * Focus the first focusable element within a shadow root, deferred to next frame.
 */
export function focusFirstElement(shadowRoot: ShadowRoot | null | undefined): void {
  requestAnimationFrame(() => {
    const focusable = shadowRoot?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.focus();
  });
}
