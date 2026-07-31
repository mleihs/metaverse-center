# Forge — Phase II "The Table" — UI/UX/Graphic-Design Review (2026-06-19)

> Scope: the Forge wizard's **second step**, where agents and buildings (and geography) are
> generated. Component: `frontend/src/components/forge/VelgForgeTable.ts` (1799 lines),
> rendered by `VelgForgeWizard.ts` (phase `drafting`). Reviewed from a UI/UX/graphic-design
> lens, grounded in the project's brutalist 3-tier-token design system + 10 theme presets.
> This is an analysis only — no code was changed.

## What the step is

Phase II — "The Table" (`velg-forge-table`): a war-room **Command Console** with three
"divisions" — **Cartographic** (zones/streets), **Personnel Bureau** (agents),
**Infrastructure Corps** (buildings). You trigger each division; a **scan overlay**
(`VelgForgeScanOverlay`) plays rotating flavor text + progress/ETA while the AI generates;
results arrive as TCG cards (`VelgGameCard`) into a fanned **Staging Hand**; you **accept (✓)**
or drag each card so it "slams" into a **Deployment Field** slot; a **Dossier** side-panel
edits a card. When all three divisions are stamped complete, "Calibrate Darkroom →" advances to
Phase III.

The 4 wizard phases: **I. The Astrolabe** (concept) → **II. The Table** (this) →
**III. The Darkroom** (imagery) → **IV. The Ignition** (launch).

## Verdict

Concept and feedback-craft are **strong** — one of the more ambitious, characterful surfaces
in the app. The weaknesses are: (a) it visually **secedes from the platform's amber/themeable
identity**; (b) a few **honesty/correctness gaps** (a dead "Mutate" button, hardcoded counts
that contradict config); and (c) **hierarchy/interaction friction** (duplicate animated CTAs,
console detached from output, an unexplained staging step, mouse-only drag-and-drop). Fixing
findings 1–3 has the highest design ROI.

## Strengths (keep)

- **Committed, cohesive concept** — Bureau / card-game / declassified-dossier metaphor is
  consistent (divisions, staging hand, deployment field, scan phases). Not generic AI-card-soup.
- **Rich, legible feedback** for the long-running generation: per-division active (sonar sweep) /
  complete (stamp slam), counter pips (`X/Y Drafted`), scan overlay with entity progress + ETA,
  graceful "Signal recovered" / "Signal Lost… your operatives are safe" recovery.
- **Disciplined motion a11y** — *every* keyframe has a `prefers-reduced-motion` override
  (lines 314, 399, 478, 529, 577, 668, 754…). Better than most of the codebase.
- **Thoughtful touches** — screen Wake Lock during generation (wizard 284–308), dual accept
  affordance (click ✓ *and* drag), card-deal / slot-slam / shockwave micro-moments.

## Findings (prioritized)

### P1 — 1. Off-brand and theme-locked (biggest graphic issue)
Platform identity is **amber on near-black** with **10 themes** inheriting via tokens. This step
discards both:
- Makes **success-green the ambient brand color** (sonar sweeps, beacons, stamps, pips, staging
  borders, "complete" backgrounds all `#22c55e`). Green is the *semantic "success"* token — using
  it as ambient chrome means you can't distinguish "done/success" from "decoration."
- Card surfaces **hardcode a slate palette as raw hex** (`#22c55e/#14b8a6/#556270/#1e293b/
  #283548/#f0f0f0`) with `// lint-color-ok` pragmas bypassing the color-token linter,
  **duplicated across three selectors**: `.deployment-field` (412–419), `.staging-section`
  (597–605), `.dossier-panel` (799–807). These don't adapt to themes → under cyberpunk/
  solarpunk/nordic-noir the forge cards stay slate-blue-and-green while the rest re-themes.
- **Fix:** drive the forge accent from a Tier-3 `--_forge-accent` mapped to a real token; let
  cards inherit theme tokens, or define ONE shared forge-theme token block (not three copies).

### P1 — 2. False affordance: the "AI Mutation" panel is a live-looking dead stub
The Dossier side-panel (1736–1747) renders a labeled "AI Mutation" textarea + a styled primary
**"Mutate Entity"** button — clicking only toasts *"AI-driven entity mutation is a Phase 2
enhancement"* (1203–1208) and discards the typed prompt. Interactive-looking control that
no-ops = textbook false affordance.
- **Fix:** hide behind the feature flag, or render visibly disabled with "coming soon." Don't
  throw away the user's typed text.

### P1 — 3. Helper copy states fixed counts that contradict the real config
Info bubbles say *"Generates 5 zones and 5 streets"* (1286), *"Drafts 6 agents"* (1304),
*"Creates 7 buildings"* (1317) — hardcoded — while the deployment field renders
`genConfig.agent_count` / `building_count` slots (1410, 1510). Any non-default count → the
guidance lies.
- **Fix:** interpolate the real `genConfig` values into the copy.

### P2 — 4. Two competing, perpetually-animated primary CTAs
"Calibrate Darkroom →" is duplicated top (1325–1330) **and** bottom (1605–1611), each with the
full `advance-beacon` + `advance-shimmer` infinite glow. Two pulsing beacons fight for the eye
and break single-primary-action. The **top** one sits *above* the results — inviting advance
before the user has reviewed what they generated.
- **Fix:** one advance CTA at the natural end; if a top affordance is wanted, make it quiet/
  secondary/un-animated.

### P2 — 5. Controls detached from output; flow leans on heavy auto-scroll
Triggers cluster top in the Console; results stack far below in separate sections. The code
compensates with stacked programmatic scrolls — `firstUpdated` scrolls to console + 3s "beckon"
(924–935), then `_generateChunk` scrolls to section, then scrolls again to reveal (1107–1130).
Viewport moving out from under the user is disorienting and fights manual scroll.
- **Fix:** co-locate each division's trigger with its result (one panel per division, inline
  generate button) OR make the Console a sticky control rail; cut the redundant scroll calls.

### P2 — 6. Staging-Hand → Deploy two-step adds unexplained friction
After generating 6 agents you get 6 fanned staging cards **and** 6 empty numbered slots, and must
accept each individually. Curation is intentional ("Curated Proceduralism"), but it's unexplained
and there's **no "Accept all."** Also: the fan uses `perspective: 800px` on a *container* (627) —
the design rules flag `perspective`/`transform` on containers as fixed-positioning hazards (the
Dossier panel is a fixed overlay); the 36px accept/edit buttons sit at `bottom: -8px` under
overlapping cards with a `!important` hover transform (645) → fiddly to hit, especially on touch
(where the fan degrades to horizontal scroll, losing the metaphor).
- **Fix:** add "Accept all / Reject all," explain the staging step in one line, move actions out
  from under the overlap, reconsider container `perspective`.

### P2 — 7. Accessibility gaps (notable, given the good motion discipline)
- **Drag-and-drop has no keyboard path**; slots carry no `role`/`aria` drop semantics
  (1414–1419). The ✓ button is the only keyboard route (OK fallback) but the primary affordance
  is mouse-only and unannounced.
- **Raw glyph "icons"** as content — ✓ `&#10003;`, ✎ `&#9998;`, ⚠ `&#x26A0;` (1475, 1576, 1259).
  Design system mandates `icons.ts`; glyphs render inconsistently and aren't reliably sized.
- **No `aria-busy`/live region** on sections during generation; empty deploy slots labeled with a
  bare number (`${i+1}`, 1437) reads ambiguously — should be "Empty operative slot 1."
- Status leans on **green-vs-muted color**; the stamp's "✓ Surveyed" text is the one good
  non-color cue — extend that pattern (pips, active panels).

### P2 — 8. Hand-rolled states instead of the shared three-state components
`.section-empty` ("Awaiting cartographic survey…") and the `.generation-failed` "Signal Lost"
block (538–579, 1756–1773) reinvent `<velg-empty-state>` and `<velg-error-state show-retry>`
(the system *requires* the shared state components). The empty state is also flat — numbered
dashed boxes read as empty form fields, not an enticing "roster to fill," with no preview of a
filled card.

### P3 — 9. Motion reads anxious rather than confident
On load: auto-scroll + three staggered green "beckon" pulses (2–3s) + phase-bar sweep + CRT
scanlines. At rest: the advance button beacons + shimmers **infinitely**; the active panel
sonar-sweeps. Perpetual looping glows (even with reduced-motion handled for opt-in users) read as
nervous/busy and fatigue the eye, drowning out the genuinely good beats (`stamp-slam`,
`hand-deal`, `slot-slam`/shockwave).
- **Fix:** reserve motion for transitions/confirmations; drop the infinite idle beacons.

### P3 — 10. Content-design + wayfinding nits
- **~144 i18n flavor strings** (48 each: geography/agents/buildings, 937–1097) for decorative
  scan text that flashes by — a large, low-value translation burden. A smaller curated pool (or
  do-not-translate) would do.
- **Placeholder imagery looks real:** cards show `getOperativeSet`/`getBuildingSet` placeholder
  art (865–880); real portraits come in Phase III. Users may read the placeholder as their
  agent's actual face.
- **"Calibrate Darkroom →"** is opaque as a forward action (it's the next phase's themed name) —
  thematic but thin on wayfinding for a first-timer.
- Three nouns for the agent set on one screen — division "Personnel Bureau," stamp "Recruited,"
  section "Operative Roster" — rich, but taxes learnability.

## Open question (verify before acting)
**"Re-draft" / "Re-scan"** on a completed division (button label flips to regen when `isComplete`,
1657–1661): does it *replace* accepted + manually-edited entities, and is there any **confirm** or
**credit-cost** shown at the click? The forge has a wallet economy but the generate buttons
surface no cost here. Destructive regen with no confirmation would be a real risk. Lives in
`ForgeStateManager.generateChunk` (not read in this review).

## Highest-ROI next steps
1. **#1 theming** — replace the green-as-brand + raw-hex slate overrides with a single themeable
   `--_forge-accent` block so the step rejoins the platform identity across all 10 themes.
2. **#2 Mutation stub** — gate/disable it (stop the false affordance + prompt loss).
3. **#3 counts** — interpolate `genConfig` into the helper copy.

All three are small, lint-clean, and high-value. Before any code: invoke `velg-frontend-design`
and run `frontend/scripts/lint-color-tokens.sh` + `lint-llm-content.sh`. (#1 also relates to the
deferred frontend audit finding "ForgeStateManager god-object" in
`full-stack-audit-findings-2026-06-15.md`.)
