---
title: "Alpha Suite — Bureau-Dispatch Indicators for Pre-Release Builds"
version: "1.0"
date: "2026-04-19"
type: guide
status: active
lang: en
---

# Alpha Suite

## Overview

While Velgarien is in pre-release, four Bureau-flavored indicators tell visitors that the build is alpha:

1. **Bureau Stamp** — Diagonal rubber-stamp fixed to the top-right corner with one of four rotating Bureau phrases, keyed deterministically to the build SHA.
2. **Build Strip** — Terminal-style footer showing `VELG.ALPHA · {sha} · {date} · transmission noise detected` with a Braille spinner.
3. **First-Contact Modal** — One-time Bureau-Dispatch dialog for non-member first-time visitors. Scramble-title, scanline sweep, literary German body.
4. **Redacted Marker** (`<velg-redacted>`) — Inline ARG-vocabulary utility that hides text behind a black bar. Outlives alpha; stays for the cipher ARG.

All four are gated by a **single build-time flag**. Flipping `VITE_IS_ALPHA=false` causes Vite to tree-shake the entire suite out of the production bundle — no code refactor required at release cut.

---

## Build-Time Gate

`frontend/vite.config.ts` reads `VITE_IS_ALPHA` via `loadEnv(mode, '..', '')` (respecting `envDir: '..'` — the env lives at project root alongside existing Supabase and Sentry vars) and injects it as a const via `define`:

```ts
define: {
  'import.meta.env.VITE_IS_ALPHA': JSON.stringify(String(isAlpha)),
  'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
  'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
}
```

The `app-shell.ts` render branch:

```ts
${import.meta.env.VITE_IS_ALPHA === 'true'
  ? html`<velg-alpha-suite></velg-alpha-suite>`
  : nothing}
```

Vite const-evaluates the comparison at build time. When the flag is `'false'`, Rollup removes the `html\`...\`` branch and tree-shakes every module only reachable through `VelgAlphaSuite`.

**Local dev**: `VITE_IS_ALPHA=true npm run dev` inside `frontend/`. Without the flag, the suite stays dormant even in development.

**CI / production**: set `VITE_IS_ALPHA=true` in the Railway build environment. On release, flip to `false`.

---

## Runtime Control: `platform_settings`

Two keys drive the first-contact modal's server-side behaviour (migration `20260419200000_223_alpha_first_contact_settings.sql`):

| Key | Type | Purpose |
|-----|------|---------|
| `alpha_first_contact_modal_enabled` | bool | Render the modal to non-member visitors at all. |
| `alpha_first_contact_modal_version` | string | Bump to retrigger the modal for everyone who dismissed an older version. |

`platform_settings` has no anon RLS policy — the backend reads via `service_role` and projects onto a narrow public DTO (`AlphaStatePublic` — `{ first_contact: { enabled, version } }`). Nothing sensitive crosses the boundary.

Admin writes go through the existing `PUT /admin/settings/{key}` endpoint (`AdminApiService.updateSetting`). A new **Announcements** sub-tab under **Admin → Platform → Announcements** (`AdminAnnouncementsTab`) exposes three controls:

- **Toggle enabled** — flips `alpha_first_contact_modal_enabled`.
- **Bump version** — stamps `alpha_first_contact_modal_version` to today's ISO date. Appends `.N` suffixes for multiple bumps on the same day.
- **Open modal** — admin-only preview that opens the modal without touching `localStorage`, so inspection does not affect the live dismiss state.

---

## Frontend State: `AlphaStatusService`

Singleton (`frontend/src/services/AlphaStatusService.ts`). Four signals, one computed, one public endpoint:

```ts
class AlphaStatusService {
  readonly isAlphaBuild: boolean;            // from VITE_IS_ALPHA
  readonly gitSha: string;                   // from VITE_GIT_SHA
  readonly buildDate: string;                // from VITE_BUILD_DATE

  readonly firstContactEnabled: Signal<boolean>;
  readonly firstContactVersion: Signal<string>;
  readonly firstContactAcked: Signal<string>;      // from localStorage
  readonly firstContactPreviewing: Signal<boolean>; // admin preview

  readonly shouldShowFirstContact: ReadonlySignal<boolean>;
  // = isAlphaBuild && !isAuthenticated && enabled && acked !== version

  refresh(): Promise<void>;      // GET /api/v1/public/alpha-state
  acknowledge(): void;           // writes localStorage, updates signal
  openPreview(): void;           // admin-only
  closePreview(): void;
}
```

Kept **separate from `AppStateManager`** — alpha is orthogonal to identity/routing, and this separation makes the release-cut deletion path trivial: removing `services/AlphaStatusService.ts` and `components/alpha/` breaks nothing else.

---

## Components

### `<velg-alpha-suite>` — single mount point

Single tag in `app-shell.ts`. Hydrates `AlphaStatusService.refresh()` on connect. Renders stamp + build-strip + modal.

### `<velg-alpha-stamp>` (A)

`position: fixed` top-right, `z-index: var(--z-sticky)`. Inline `<filter id="alpha-stamp-bleed">` SVG (cross-shadow-DOM `url(#...)` doesn't work — each component carries its own filter). Deterministic phrase selection:

```ts
function pickPhraseIndex(sha: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < sha.length; i++) hash = (hash * 31 + sha.charCodeAt(i)) >>> 0;
  return hash % buckets;
}
```

Phrases (EN source, DE via `msg()`):
- `Vorabübertragung · Fragment 42 von ???`
- `Bureau-Dossier · nicht freigegeben`
- `Spezimen · Signatur unvollständig`
- `Alpha-Manifest · Störungen erwartet`

Animation: `stamp-thud` 420ms `cubic-bezier(0.34, 1.56, 0.64, 1)` with 500ms delay (scale/blur overshoot). `prefers-reduced-motion: reduce` degrades to a plain 320ms fade-in. Print media: hidden.

### `<velg-build-strip>` (B)

Fixed-bottom 24px monospace strip. Content:

```
VELG.ALPHA · {git-sha-7} · {build-date} · transmission noise detected · [dispatch]
```

Braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, 90ms interval) rotates in a `width: 1ch` monospace-aligned slot. `prefers-reduced-motion: reduce` pins to static `⠿`. `role="status" aria-live="off"` — readable on focus but never announces frame changes.

### `<velg-first-contact-modal>` (C)

Wraps `<velg-base-modal>`. Signal-driven visibility (`SignalWatcher(LitElement)`):

- **Live mode** — driven by `alphaStatus.shouldShowFirstContact`. Ack writes `localStorage['velg.firstContact.ack'] = version`.
- **Preview mode** — driven by `alphaStatus.firstContactPreviewing`. Close does **not** write localStorage.

The **scramble animation starts on the open transition**, not on mount. The component watches the hidden→visible transition in `updated()` so the animation runs the first time the user actually sees the modal — the async `alpha-state` fetch doesn't race the scramble away.

Microanimations:
- **Title scramble-to-final** (12 steps × 26ms, skipped under reduced motion).
- **Scanline sweep** (900ms vertical gradient, single pass, skipped under reduced motion).
- **Static RGB channel-shift** on the title via `text-shadow` — no animation, pure CSS, suppressed under reduced motion.

Copy (DE source of truth):

> Velgarien ist eine Vorausschau. Welten, Agenten, Epochen – manches ist endgültig, vieles wird sich verschieben. Spielstände können zurückgesetzt werden, Routen brechen, Signaturen wandern.
>
> Wenn du das trägst: willkommen im Vorlauf. Wenn nicht: komm später wieder, wenn die Übertragung stabiler ist.

Two buttons: `Dispatch öffnen` (SPA-navigates to `/bureau/dispatch` via `navigate()`, also acks) and primary `Verstanden – weiter zur Übertragung`.

### `<velg-redacted>` (D)

Lives in `components/shared/` (not `alpha/`) because the redacted aesthetic is part of the persistent Bureau/cipher vocabulary and survives beyond alpha.

```html
<velg-redacted label="freigegeben in epoche iii">Prophezeiung</velg-redacted>
```

Inline `<filter id="velg-redacted-grain">`. Hover/focus reveals the label in `--color-accent-amber`. ARIA: `role="mark" aria-label="redacted: {label}"`, `tabindex="0"`.

---

## API: `GET /api/v1/public/alpha-state`

Defined in `backend/routers/public.py`, delegates to `PlatformSettingsService.get_alpha_first_contact_config` (`backend/services/platform_settings_service.py`). DTOs live in `backend/models/alpha_state.py`:

```python
class FirstContactPublic(BaseModel):
    enabled: bool
    version: str

class AlphaStatePublic(BaseModel):
    first_contact: FirstContactPublic
```

Falls back to `enabled=False`, `version=""` when the seed rows are missing so fresh databases never 500. Uses `get_admin_supabase` (service_role) because `platform_settings` has no anon policy; the Pydantic projection drops every internal column (ID, `updated_by_id`, timestamps).

Tests: `backend/tests/test_alpha_state_public.py` — four mock-based cases covering enabled / disabled / missing-rows / no-auth.

---

## Release Cut

When Velgarien exits alpha:

1. Set `VITE_IS_ALPHA=false` (or unset it) in the Railway build environment.
2. Optionally, disable the modal: `UPDATE platform_settings SET setting_value = 'false' WHERE setting_key = 'alpha_first_contact_modal_enabled';`
3. Optionally (follow-up PR), delete `frontend/src/components/alpha/` and `frontend/src/services/AlphaStatusService.ts` — nothing else references them. `<velg-redacted>` stays.

The `platform_settings` rows can stay in the database indefinitely; disabled modal does nothing at runtime.

---

## Locale Handling

All user-visible strings use `msg()` with English source text and DE translations in `frontend/src/locales/xliff/de.xlf`. After adding or editing strings:

```sh
cd frontend
npx lit-localize extract
sed -i '' 's/—/–/g' src/locales/xliff/de.xlf   # maintainer-prescribed em-dash normalization
```

The `lint-llm-content.sh` gate (Section 3) enforces the em-dash cleanup.

---

## CLAUDE.md Rules Referenced

The implementation respects every contract from `CLAUDE.md`:

- **Public endpoint uses return-type annotations** (`-> SuccessResponse[AlphaStatePublic]`), never `response_model=`.
- **Tier-3 `--_*` tokens in `:host`** for component-local colors; Tier-1 `--color-accent-amber` for the non-themeable alpha accent.
- **No `as unknown as T`** casts; `ImportMetaEnv` extended via `src/types/env.d.ts`.
- **No raw hex or rgba** — `color-mix()` everywhere.
- **No em dashes or LLM-isms** in `msg()` strings.
- **Error observability** — `captureError` on the `refresh()` failure path and around `localStorage` access.
- **A11y** — `aria-hidden` on decorative stamp art + `visually-hidden` screen-reader text; `role="status"` polite on the strip; `role="dialog" aria-modal` on the modal; all animations guarded by `prefers-reduced-motion`.
- **No business logic in routers** — the alpha endpoint delegates to `PlatformSettingsService`.
- **Never use `get_supabase` directly in routers** — the public endpoint uses `get_admin_supabase` for read-only service-role access, consistent with other `platform_settings` readers (e.g. `/dungeons/clearance-config`).
