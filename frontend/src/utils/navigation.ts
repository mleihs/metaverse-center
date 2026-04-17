/**
 * Navigation helpers — the sole legitimate point for URL manipulation
 * outside the router itself. All components must route through one of these
 * two functions; direct `window.history.pushState` is forbidden by
 * `frontend/scripts/lint-no-pushstate.sh`.
 *
 * Two distinct semantics:
 *
 * 1. `navigate(path)` — trigger a route change. The router re-evaluates the
 *    URL, the matching view remounts, side effects in `enter` callbacks run.
 *    Use when leaving the current view (header link, CTA button, onboarding
 *    flow terminus, cross-entity deep-link).
 *
 * 2. `updateUrl(path)` — update the address bar without triggering the router.
 *    Use when the view stays mounted and you only want the URL to reflect
 *    in-view state (opening a detail panel inside a list view, tab selection
 *    that should be deep-linkable). Browser back-button pops the pushed
 *    state — perfect for panel-close behaviour.
 */

/**
 * Trigger a route change. Dispatches the `navigate` custom event on `<velg-app>`,
 * which `app-shell.ts:_handleNavigate` routes through `updateUrl()` +
 * `_router.goto()`.
 *
 * No source element needed — the helper resolves `<velg-app>` internally and
 * is safe to call from any context (components, utilities, event handlers).
 * If `<velg-app>` isn't mounted (pre-bootstrap or teardown), the call is a
 * silent no-op — in that state there's no router to drive anyway.
 */
export function navigate(path: string): void {
  document.querySelector('velg-app')?.dispatchEvent(
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
