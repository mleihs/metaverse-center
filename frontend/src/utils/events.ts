/**
 * Dispatch a composed, bubbling CustomEvent from a host element.
 *
 * Replaces the verbose pattern:
 *   this.dispatchEvent(new CustomEvent('name', { detail, bubbles: true, composed: true }))
 *
 * Usage:
 *   fire(this, 'modal-close');
 *   fire(this, 'item-selected', { id: '123' });
 */
export function fire<T = unknown>(host: EventTarget, name: string, detail?: T): void {
  host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
