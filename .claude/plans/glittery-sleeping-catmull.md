# Fix: Dev Account Switcher Hidden on Mobile

## Context

The `DevAccountSwitcher` component is invisible on mobile screens because its own CSS contains `@media (max-width: 640px) { :host { display: none; } }` (line 465-469). This hides **all** instances of the component — including the one intentionally placed inside the mobile hamburger menu panel (`PlatformHeader.ts:836-838`). The dev button should always be visible regardless of auth state or viewport.

## Root Cause

`DevAccountSwitcher.ts` line 465-469:
```css
@media (max-width: 640px) {
  :host {
    display: none;
  }
}
```

The component is rendered in two places in `PlatformHeader.ts`:
1. **Desktop SYS dropdown** (line 748-750) — already hidden on mobile by the dropdown's own CSS
2. **Mobile menu panel** (line 836-838) — should be visible, but the component's media query kills it

## Fix

**File:** `frontend/src/components/platform/DevAccountSwitcher.ts`

Remove the `@media (max-width: 640px)` block (lines 465-469). The desktop SYS dropdown container is already hidden on mobile via PlatformHeader's `.cluster` media query, so there's no double-show risk.

## Verification

1. `cd frontend && npx tsc --noEmit` — type check
2. Open mobile viewport (~390px), verify dev switcher appears in hamburger menu
3. Open desktop viewport, verify dev switcher still appears in SYS dropdown
4. Verify no duplicate switcher on either viewport
