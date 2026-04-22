# Onboarding Tier-1 Bug-Fix — Handover (2026-04-22)

## Status

**Tier-1 PR is code-complete, lint-clean, typecheck-clean. NOT committed. NOT browser-tested yet.**

The plan file: `/Users/mleihs/.claude/plans/wild-singing-cerf.md`

## Context

Fresh-user UX playtest on 2026-04-22 surfaced five findings. Three were hard bugs fixed atomically in this PR; two were deferred to Tier-2/3.

The three bugs shared one root cause: **routing decisions were being made in multiple layers that didn't coordinate.** This PR installs the discipline that each routing decision lives at exactly one layer per flow.

## Changes landed (uncommitted)

| File | Change |
|------|--------|
| `frontend/src/components/onboarding/OnboardingWizard.ts` | `extends SignalWatcher(LitElement)`. Imports `navigate` helper. New `_intent: 'browse' \| 'create' \| null` state. Rewrote `_handlePathSelect` — always stores intent, always calls `_goForward()`. New `_completeAndNavigate(target)` helper. Rewrote `_renderMission` with intent-aware primary CTA via `_resolveIntentCta()`. New `.mission-card--intent-primary` modifier with two microanimations (`intent-reveal` 420ms fade+translate, `intent-accent-slide` 280ms accent-bar scaleY). `@media (prefers-reduced-motion: reduce)` guarded. |
| `frontend/src/app-shell.ts` | Removed `_handleOnboardingBrowse` + `_handleOnboardingCreateSim` handlers. Removed `@onboarding-browse` + `@onboarding-create-simulation` bindings from `<velg-onboarding-wizard>`. `/forge` route now conditionally renders `<velg-forge-wizard>` (cleared) or `<velg-forge-clearance-required>` (not cleared) — no more silent redirect. Lazy-loads both chunks. |
| `frontend/src/components/forge/VelgForgeClearanceRequired.ts` | **NEW**, 245 LOC. `SignalWatcher(LitElement)`, `@localized()`. Brutalist heading with `clip-path` scan-reveal. Explainer paragraph. Embedded `<velg-clearance-card>` (reuses existing). Alternative-paths section: BYOK link → `/how-to-play/guide/byok`, Academy button → `epochsApi.createQuickAcademy()` + navigate. Staggered cascade entry via `--i` on each child. Hover glow via `box-shadow: inset + outer` with `--_accent-dim`. Tier 1/2/3 tokens only. Reduced-motion guarded. |
| `frontend/src/components/platform/SimulationsDashboard.ts` | Dropped `this._simulations.length > 0` condition on `<velg-clearance-card>`. Card already self-hides for cleared/approved/rejected. |

## Verified gates (all PASS)

- `bash frontend/scripts/lint-color-tokens.sh`
- `bash frontend/scripts/lint-llm-content.sh`
- `bash frontend/scripts/lint-no-empty-catch.sh`
- `bash frontend/scripts/lint-no-cast-unknown.sh`
- `bash frontend/scripts/lint-no-appstate-access-reads.sh`
- `bash frontend/scripts/lint-bureau-panel-frame-last.sh`
- `cd frontend && npx tsc --noEmit` (clean, no output)

## Pending verification (WebMCP, 4 scenarios)

Before commit, verify end-to-end:

1. **Fresh signup → Browse path.** Sign up with fresh email, confirm via emailed link. Wizard appears. Click "Browse Existing Worlds". **Verify wizard advances to Step 2 (Systems Overview — 5 tiles)**, advance to Step 3, confirm primary CTA reads "Browse Shards". Click → lands on `/dashboard`, onboarding completed.
2. **Fresh signup → Create path (non-architect).** Same up to Step 1, click "Create New World", **verify advance to Step 2**, advance to Step 3. Confirm primary CTA reads "Request Clearance". Click → lands on `/forge` which renders the clearance-required page (not redirect to `/dashboard`). Confirm BYOK link + Academy link both functional.
3. **Direct `/forge` visit as non-architect.** Paste `http://127.0.0.1:5175/forge`. Confirm clearance-required page renders (no silent redirect). Confirm "Apply for Clearance" button opens the existing `VelgForgeAccessModal` via the embedded `<velg-clearance-card>`.
4. **Dashboard clearance card visibility.** Fresh authenticated user with zero simulations. Confirm `<velg-clearance-card>` is visible in the right column of `/dashboard` (was hidden previously).

Regression checks:
- Existing architect → `/forge` renders the Forge wizard as before.
- Existing architect → dashboard → clearance card is hidden (internal `canForge` check still works).
- `Skip all` button on wizard step 0 → closes wizard, lands on `/dashboard`.
- `onboarding-complete` + `onboarding-start-academy` events still handled correctly.

## Hinterkopf — subtle things the next phase should know

### 1. `ClearanceApplicationCard` has a latent reactivity issue

File `frontend/src/components/forge/ClearanceApplicationCard.ts:18` extends `LitElement` (NOT `SignalWatcher`) but reads three appState signals in `render()` (`forgeRequestStatus`, `canForge`, `isAuthenticated`). Works today because parent re-renders cascade. Works inside `VelgForgeClearanceRequired` because the `_modalOpen` state change on modal close triggers a local re-render, which re-reads the signals. But if another caller embeds it without a local re-render trigger, `forgeRequestStatus` flipping 'none' → 'pending' after application submit won't update the card's UI until something else re-renders it. **Not a regression** introduced by this PR. Suggested fix (separate PR): `extends SignalWatcher(LitElement)`.

### 2. `onboarding-browse` and `onboarding-create-simulation` events are dispatched but unused

The wizard still fires these as a future analytics hook. `AnalyticsService.ts:192` only maps `onboarding-complete` today. If you want intent-funnel analytics, add two more entries there.

### 3. BYOK discoverability is only half-fixed

The new clearance-required page links to `/how-to-play/guide/byok` — the *explainer* page. The actual BYOK input lives inside `VelgForgeMint.ts:690`, rendered only when `byok.byok_allowed` or `byok.effective_bypass`. A fresh user who reads the guide and wants to enter a key still cannot do so from the UI. P5 in the Tier-2 backlog (BYOK dashboard tile or dedicated `/settings/byok` route) closes this gap. Without it, "Bring Your Own Key" on the clearance page is aspirational.

### 4. Academy handler duplication

`VelgForgeClearanceRequired._handleAcademy` copies `app-shell._handleOnboardingAcademy` (both call `epochsApi.createQuickAcademy()` + `navigate(\`/epochs/${id}\`)`). Fine now. If a third call site appears, extract to `frontend/src/utils/academy.ts`.

### 5. No tests added

No vitest tests added for the wizard changes or the new component. Tier-1 bug fixes can land without; if the next phase wants coverage:
- Wizard: `_handlePathSelect('browse')` stores `_intent='browse'` and advances
- Wizard: `_resolveIntentCta()` returns right CTA for each `(_intent, canForge)` combo
- `VelgForgeClearanceRequired`: renders without crash, BYOK link calls `navigate('/how-to-play/guide/byok')`, Academy button calls `epochsApi.createQuickAcademy`

### 6. Pre-existing raw `rgba(0, 0, 0, 0.85)` in OnboardingWizard.ts:46

Not touched by this PR. Would fail `lint-color-tokens` if `components/onboarding/` were added to the enforced rgba dir list. Consider in a Tier-3 cleanup pass.

### 7. Two playtest findings untouched (Tier-2)

- **Finding 4 ("clearance" copy collision)** — Register CTA says "Request Clearance", dashboard says "Apply for Clearance", email says "Identity Verification". Three things, three words needed.
- **Finding 5 (post-confirm `/#`)** — Supabase's default `emailRedirectTo` lands on origin `/` with hash fragment. Need to configure a dedicated `/welcome` landing (P11).

## Deferred follow-ups (Tier-2/3, not in this PR)

Captured in the plan file; reproduced here for handover continuity:

- **P4.** Resolve "clearance" copy collision (Register / email / dashboard).
- **P5.** BYOK dashboard tile + dedicated entry route.
- **P6.** "How to Play" CTA on dashboard welcome strip (`SimulationsDashboard.ts:1811`).
- **P7.** Rename "Start Training" → Academy tutorial with badge.
- **P8.** Unify 5 tour tiles (`OnboardingWizard.ts:944`) with the 12 guide topics (`htp-topic-data.ts`).
- **P9.** First-run dashboard state (replaces ad-hoc `_simulations.length > 0` gating with a coherent `appState.isFirstRun` signal).
- **P10.** Embed `CreateSimulationWizard` into onboarding as step 4 for the create intent.
- **P11.** Dedicated post-confirm `/welcome` landing.

Recommended sequencing: Day 1 = commit + push Tier-1. Day 2–3 = P4 + P6 + P7 (copy + nav surgery). Week 2 = P5 + P11. Week 3+ = P8/P9/P10 as capacity allows.

## Reference — files touched

Modified:
- `frontend/src/components/onboarding/OnboardingWizard.ts`
- `frontend/src/app-shell.ts`
- `frontend/src/components/platform/SimulationsDashboard.ts`

New:
- `frontend/src/components/forge/VelgForgeClearanceRequired.ts`

## Commit message (drafted, ready to use)

See plan file at `/Users/mleihs/.claude/plans/wild-singing-cerf.md` — final section has the full commit message HEREDOC.

## Next-session resume command

```
Read docs/analysis/onboarding-tier1-handover-2026-04-22.md and the plan at
/Users/mleihs/.claude/plans/wild-singing-cerf.md. The Tier-1 onboarding bug-fix
PR is code-complete and lint/tsc-clean but NOT committed and NOT browser-tested.
Run the 4 WebMCP verification scenarios from the handover doc, fix anything
that breaks, then commit using the message in the plan file and push.
```
