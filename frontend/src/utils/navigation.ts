/**
 * Navigation helpers — the single legitimate point for URL manipulation
 * outside the router itself. All components must route through one of these
 * two functions; direct `window.history.pushState` is forbidden by
 * `frontend/scripts/lint-no-pushstate.sh`.
 *
 * Two distinct semantics:
 *
 * 1. `navigate(source, path)` — trigger a route change. The router re-evaluates
 *    the URL, the matching view remounts, side effects in `enter` callbacks
 *    run. Use when leaving the current view (e.g. header link, CTA button,
 *    onboarding flow terminus).
 *
 * 2. `updateUrl(path)` — update the address bar without triggering the router.
 *    Use when the view stays mounted and you only want the URL to reflect
 *    in-view state (e.g. opening a detail panel inside a list view, tab
 *    selection that should be deep-linkable). Browser back-button will pop
 *    the pushed state — perfect for panel-close behaviour.
 */

/**
 * Trigger a route change. Dispatches the `navigate` custom event from `source`,
 * which bubbles up to the app-shell's handler — the single point that calls
 * `_router.goto()` + `pushState`.
 *
 * `source` must be a connected descendant of the app-shell (any LitElement
 * component qualifies). Events dispatched from detached elements won't bubble
 * to the handler.
 */
export function navigate(source: HTMLElement, path: string): void {
  source.dispatchEvent(
    new CustomEvent('navigate', {
      detail: path,
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * Update the address bar without triggering the router. Pushes a new history
 * entry so the browser back-button can undo the URL change (closing a detail
 * panel that was deep-linked, for instance).
 *
 * No-op when the path already matches the current URL — avoids polluting the
 * history with duplicate entries.
 *
 * Reserved for in-view deep-linking only. If the visible view should change,
 * use `navigate()` instead.
 */
export function updateUrl(path: string): void {
  const current = window.location.pathname + window.location.search;
  if (path !== current) {
    window.history.pushState({}, '', path);
  }
}
