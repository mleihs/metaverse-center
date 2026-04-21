# Resonance Journal — Design Direction

**Status**: Research synthesis 2026-04-21. Consumes 4 research streams (internal DnD survey, Warburg/Red Book/commonplace craft lessons, game UI craft, UX craft + a11y). Companion to `resonance-journal-implementation-plan.md`; this is the *how it feels*, that is the *how it ships*.

This is a CONTRACT. Every future design decision inside the journal inherits from this document. If a design choice contradicts it, that choice is wrong — or this document is — and either way gets surfaced before code ships.

---

## 1. Executive summary — three findings + one revision

**Finding 1 — Velgarien's existing design system already carries 90% of what the journal needs.**
Dark surfaces, amber accent, Courier + Spectral split, bureau/brutalist voice, Stagger cascade pattern, SvgFilters (`#ink-bleed`, `#parchment-noise`), SvgFilters, VelgTooltip / VelgToast / DataLoaderMixin — the journal fits *inside* this system with literary nuance, not alongside it as a different product. We add voice differentiation (italic / mono / amber-rule / illuminated) and three Tier-3 components (fragment card, constellation canvas, palimpsest reader). No new Tier-1 tokens.

**Finding 2 — The craft reference set is Obra Dinn + Disco Elysium + Heptabase + tldraw + Obsidian Canvas.**
Not Dribbble luxury inspiration. These are the shipped UIs that proved the patterns we want: batch validation (Obra Dinn rule-of-three), commitment friction + deferred reveal (DE Thought Cabinet), zoom-stable cluster labels (Heptabase sections), SVG-content + Canvas-indicator split (tldraw performance architecture), side-anchor + auto-side routing (Obsidian Canvas connections).

**Finding 3 — 12 design principles distilled from Warburg / Red Book / Commonplace books** (§2). These are rules, not flavor. They constrain every subsequent choice — sparse/dense equivalence, proximity before lines, voice-via-typography, no progress bars, margin as first-class, unfinished as valid terminal state.

**Revision to AD-3 — Pointer Events instead of HTML5 native DnD.**
Three independent 2024-2026 research streams converge on the same conclusion: HTML5 native DnD is the wrong primitive in 2026. `aria-grabbed`/`aria-dropeffect` are deprecated with effectively no screen-reader support, DnD events don't fire on mobile touch browsers (requires polyfill), and for a 2D spatial canvas Pointer Events + `setPointerCapture()` gives strictly more control with strictly better a11y. **Atlassian's Pragmatic DnD (2024 open-source rewrite) and GitHub's sortable lists both migrated off HTML5 DnD to Pointer Events.** tldraw uses Pointer Events. No external library needed. **Revise AD-3** to: "Constellation canvas uses Pointer Events + `setPointerCapture()` with a keyboard-equivalent Move-dialog (`M` key) as the a11y path." Same scope, better foundation.

---

## 2. Design principles (from Warburg / Red Book / Commonplace research)

These 12 rules constrain every journal UI decision. They are **not** aesthetic aspirations; they are operational constraints.

1. **Proximity encodes resonance before lines make it explicit.** The Atlas works because the eye finds the cluster *first*; connection lines are confirmation, not announcement. The canvas must be readable as pattern BEFORE any edges are drawn.
2. **Gap space is content.** Warburg's *Zwischenräume* is where the reader thinks. Reject the impulse to fill sparse canvases — density is an achievement, not a default.
3. **Scale has three tiers, not infinite zoom.** Large = claim, medium = support, small = echo. A fragment's size is a declared function, not a formatting accident. This maps directly to the plan's `rarity` column (`common` = small, `uncommon`/`rare` = medium, `singular` = large).
4. **Pathways are overlays, not spines.** Base mode is free scan; curated walks (LLM- or user-authored) are additive toggleable lenses. No forced reading order. No "next entry" arrows.
5. **Juxtaposition must earn itself.** Recognition happens in a flash or not at all. Weak resonances fade quietly rather than persisting as clutter. Avoid Jameson's trap where "any juxtaposition becomes a constellation" — the rule-based detector MUST be strict enough to produce real silence when nothing resonates.
6. **Voices are typography, not products.** User voice, LLM-mirrored voice, agent voice, system voice differ in *register* (serif/mono, weight, italic, rule) — never in chrome. They cohabit one page like the Red Book's dual calligraphy. Concrete mapping in §4.
7. **The LLM addresses the user back.** Palimpsest is Philemon, not summary: uses the user's prior fragments as source, speaks in second person, carries apparent otherness. Provenance is always visible.
8. **Provenance marks quotation.** Machine-generated text wears a faint "from the archive" register (muted color + small caps byline) so authorship — the user's selection and arrangement — stays legible as the creative act.
9. **No progress, no completion.** No percent-full bar, no "draft / published" binary, no streak count, no "complete your constellation!" prompts. Sections are ritual divisions, not chapters. An unfinished fragment mid-thought is a valid terminal state.
10. **Fragment weight is content, not container.** One line and a multi-paragraph reflection share the canvas; length is set by the thought, never by a template. Accept Sei Shōnagon's heterogeneity.
11. **The margin is first-class.** A persistent side-lane for user attention marks (manicules ☞), cross-references, dated re-annotations — distinct from comments, lighter-weight than a note. Revisitation writes beside the original, never overwrites it.
12. **Sparse and dense are equal aesthetic states.** Early journal = 2 cards on near-black. Mature journal = 40 cards in clusters with 12 connections. Neither is broken. Both render with the same grace.

---

## 3. Visual language — tokens and surfaces

**No new Tier-1 tokens.** The journal inherits from Velgarien's existing system (`--color-surface`, `--color-text-primary`, `--color-accent-amber`, `--font-brutalist`, `--font-prose`, `--space-*`, `--duration-*`, `--ease-*`). Tier-3 per-component variables layer on top via `color-mix()` and existing SVG filters.

**Fragment card surface.**
- Background: `color-mix(in oklch, var(--color-surface-raised) 92%, var(--color-accent-amber) 2%)` — near-black with the faintest warmth, like parchment-affected ink.
- Border: 1px `color-mix(in oklch, var(--color-border) 100%, var(--color-accent-amber) 15%)`.
- Texture (optional, sparse rarity): `filter: url(#parchment-noise)` on a `::before` overlay at 8% opacity. Existing filter, no new asset.
- Torn edge (singular rarity only): SVG `<clipPath>` with deckle, applied only on `rarity=singular` cards so the treatment stays rare.

**Canvas surface (Constellation).**
- Background: `var(--color-surface-sunken)` — the blackest surface we have (near-black `#060606`).
- Overlay: a ~3% noise pattern (existing `#parchment-noise` filter on a full-canvas `::before`) to prevent dead-black flatness. Below 5% so it never becomes texture-forward.
- **No gridlines.** Warburg refused them; we refuse them.

**Connection lines.**
- Base stroke: `var(--color-accent-amber-dim)` (already in tokens).
- Active/hover: `var(--color-accent-amber)`.
- Path: SVG `<path>` cubic bezier, control-point offset = `0.5 × |x2 - x1|` from each endpoint.
- Stroke width: `1.5px`, linecap round.
- Label (Kinopio pattern): resonance type word mid-line (`echo`, `contradicts`, `anchors`, `returns`) — `--font-brutalist` (Courier), uppercase, `--text-xs`, `--color-text-muted`. Appears at 60% draw-in progress.

**Palimpsest surface.**
- Background: `var(--color-surface-raised)` with a subtle left-border gold rule.
- Typography: `--font-prose` (Spectral) Medium 500 for body, Regular 400 for marginalia. Body size 18px, line-height 1.65, measure 65ch. Color `color-mix(in oklch, var(--color-text-primary) 92%, transparent)` — never pure #e5e5e5 on dark, to avoid halation.
- Optional decorative initial (drop cap, Medium weight, amber color) on the FIRST paragraph of each Palimpsest entry only — this is the Red Book illumination reference, used sparingly so it reads as ceremony, not ornament.

---

## 4. Voice-through-typography mapping (Principle 6)

Six fragment sources must cohabit one canvas without looking like six products stapled together. One typeface family, modulated by style:

| Fragment type | Source | Face | Style | Signal |
|---|---|---|---|---|
| **Imprint** (Abdruck) | Dungeon run | Spectral | **Italic 400** | Interior speech, reported to self |
| **Signature** (Signatur) | Epoch cycle | Courier New | **Regular, small-caps label** | Historian/dispatch voice — we already have this register in alpha-suite + dispatch components |
| **Echo** (Widerhall) | Simulation heartbeat | Spectral | **Regular 400, centered-italic `first-line`** | Collective voice — the italic first-line signals "we" |
| **Impression** (Eindruck) | Agent bond whisper | Spectral | **Regular 400, 3px amber left-rule + 16px indent** | Blockquote register — the agent speaks |
| **Mark** (Brandmal) | Achievement | Courier New | **Uppercase, wide-tracked, tiny** | Carved-in, impersonal — like a stamp |
| **Tremor** (Beben) | Cross-sim bleed | Spectral | **Regular 400, letter-spacing `0.01em`, color `--color-text-muted`** | Passive voice — colorless by design, no identifiable speaker |

**Consequence**: a player scanning 12 cards on the canvas can distinguish WHO is speaking purely by register, before reading the text. No icons, no colored dots, no labels — typography alone carries source.

---

## 5. Interaction specification

### 5.1 Drag-and-drop (revised AD-3)

**Technology**: Pointer Events + `setPointerCapture()`. Not HTML5 native DnD.

**Pickup**
- `pointerdown` on fragment card → `setPointerCapture(e.pointerId)` on the card element.
- Card transitions: `transform: translateY(-2px) scale(1.02)` + shadow on a **leaf wrapper** (CLAUDE.md forbids `filter` on layout containers, so the shadow applies to an inner element). Transition: 180ms `--ease-out`.
- Cursor: `grab` → `grabbing`.
- `will-change: transform` added on `pointerenter`, removed on `pointerleave`.
- `touch-action: none` on the card while dragging to suppress scroll.

**Move**
- `pointermove` listener on the card itself (due to `setPointerCapture`, it still receives events when pointer leaves the element).
- rAF-throttled position update — coords live in a Preact signal, so connection lines reflow automatically.
- Drop-zone hover: other fragment cards within ~120px radius show a 1px amber border + `color-mix(var(--color-accent-amber) 8%, transparent)` bg tint.

**Drop**
- `pointerup` releases capture.
- Card eases to final position over 250ms `cubic-bezier(0.4, 0, 0.2, 1)`.
- Resonance detector runs (rule-based, O(1)); if match, connection line draws in (see §5.3).
- No sound on drop — the drop is not the moment. The resonance is.

**Cancel**
- `Escape` during drag → card returns to origin in 300ms ease-in-out, capture released.
- `pointercancel` (system interruption) → same as Escape.

### 5.2 Keyboard equivalent (a11y)

Per Atlassian Pragmatic + GitHub pattern. HTML5 arrow-key DnD is unshippable in 2026.

- Card has `tabindex=0`, visible focus ring via `outline: 2px solid var(--color-border-focus)` (not `box-shadow` — respects CLAUDE.md filter rule).
- Focused card: press `M` → opens `<dialog>` listing all valid targets (other fragments on canvas, or an "empty canvas area" option). User navigates with Tab / Arrow, activates with Enter.
- This is the **same mental model as GitHub's sortable-list move dialog** and Atlassian's Pragmatic form-based alternative. It is also faster than arrow-key dragging for many power users.
- `aria-live="assertive"` region at app-shell level, 100ms debounce, with scripted announcements:
  - pickup: `"Fragment {title} selected. Press M to move, Escape to cancel."`
  - drop via dialog: `"Fragment {title} placed near {target}. Connection: {resonance type}."` or `"Fragment {title} placed. No resonance detected."`
- `role="application"` scoped **only to the focused card**, never to the canvas — GitHub's lesson: full-canvas application role eats screen-reader reading commands.

### 5.3 Resonance detection feedback — quiet, not loud

When proximity + rule-based detection finds a resonance:
- Both involved cards: border warms to `var(--color-accent-amber)` over 400ms.
- Short chime (low-gain, ~200ms) — the system NOTICED, it did not CELEBRATE.
- Connection line draws in over 400-500ms using `stroke-dasharray` + `stroke-dashoffset` (length computed via `path.getTotalLength()`), `cubic-bezier(0.16, 1, 0.3, 1)` ease-out.
- Mid-line label (resonance type word) fades in at 60% draw progress over 150ms.
- No modal. No toast. No screen flash. The canvas itself is the stage.

If the resonance is later broken (user moves a card away): line fades out 300ms, borders cool to `--color-border` over 400ms. No chime on reversal — removing attention is quiet, same as giving it.

### 5.4 Crystallization moment (constellation → insight)

This is the **ceremony**. Borrows from Obra Dinn's rule-of-three batch stamp + DE's gestation beat + Hades' boon reveal.

Timeline (total ~2200ms, skippable):

| t | Beat |
|---|---|
| 0 ms | User clicks "Crystallize" (explicit, never auto). All cards lock (non-draggable). Cursor → default. |
| 0-180 ms | Cards dim to 70% opacity (DE commitment tell — the pause before anything moves). |
| 180-900 ms | Connection lines draw in sequentially, 120ms per line with 60ms overlap. |
| 900-1100 ms | Insight frame appears (empty, no text) — fade + 4px translateY from below. |
| 1100-2200 ms | Insight text types in letter-by-letter in Courier mono at ~30 cps. No scramble — scrambling would feel generated; typing feels authored. |
| 2200 ms | Final chime. Cards warm to amber border over 800ms. State becomes read-only. |

**Skippable**: `Space` or `Escape` fast-forwards to t=2200. Same chime, same final state, same screen-reader announcement. Never a different outcome.

**Screen-reader**: on crystallization complete, the live region announces the full Insight text verbatim (skip-the-type, never mid-animation).

**Never**: no modal, no full-screen dim, no particle effects, no confetti. Reveal happens on the canvas itself.

### 5.5 Card overlap

Permitted (Heptabase, Obsidian, tldraw, Kinopio all permit it). No auto-nudge — users own their space.

- Z-order by last interaction. Most-recent drag brings card to front.
- Top card's drop-shadow intensifies slightly (`color-mix(var(--color-surface) 100%, black 30%)` on the leaf wrapper, not the container) to communicate stack depth.
- Keyboard `.` (period) triggers a user-invoked "spread" action: offsets overlapping neighbors by 24px in 180ms. Never automatic.

---

## 6. Connection-line rendering — technical spec

**Technology choice**: SVG `<path>` overlay in the DOM, parallel to the card layer. This is the **tldraw split** — SVG for authored geometry, Canvas 2D reserved for ephemeral indicator glows if we ever need them (not in P0-P2).

**Why not Canvas 2D**: At ≤100 paths per canvas, SVG wins on authoring ergonomics, a11y (each path carries a `<title>` for screen readers), style-sheet addressability, and reactive integration with Lit's rendering model.

**Path math**: cubic bezier with both control points offset along the horizontal axis:

```
M {x1},{y1} C {x1 + dx},{y1} {x2 - dx},{y2} {x2},{y2}
where dx = Math.abs(x2 - x1) * 0.5
```

This produces a gentle S-curve when endpoints are horizontally offset and a near-straight line when vertically stacked. No perpendicular lift needed (Warburg panels don't arc lines above content; they run between images).

**Draw-in animation**:

```ts
const L = path.getTotalLength();
path.style.strokeDasharray = String(L);
path.style.strokeDashoffset = String(L);
path.animate(
  [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
  { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
);
```

**Position tracking**: card positions are Preact signals (we already have these). `<velg-connection>` component subscribes to both endpoints' signals; on signal change during drag, rAF-throttled path-`d`-rewrite. No ResizeObserver — positions don't resize, they translate.

**A11y**: each `<path>` has an `<title>` child with the resonance type + involved fragment titles. Focusable via Tab if the user wants to introspect a connection.

**Performance budget**: ≤100 fragments per canvas. At C(100,2) = 4950 possible pairs but real-world resonances cap around 20-40 active paths. Well within SVG's smooth range (Genie benchmark: ~500 nodes smooth in SVG).

---

## 7. Existing-component leverage

From the internal survey, these shared pieces are either used directly or the pattern is copied:

**Direct use:**
- `DataLoaderMixin` — fragment grid async load (Fragments tab).
- `VelgTooltip` — connection-line hover labels, fragment metadata on hover.
- `VelgToast` — only for errors (fragment generation failed, etc.). NEVER for success events (violates Principle 9 — no completion celebration).
- `BaseModal` — the "Move..." a11y dialog, the constellation rename dialog.
- `SvgFilters` — `#ink-bleed` for crystallization moment's Insight text, `#parchment-noise` for fragment card `::before` overlays.
- Stagger cascade pattern (`--i: ${index}`) — fragment grid entrance.

**Pattern copy (not direct use):**
- `setPointerCapture` usage — from VelgForgeTable pattern, applied correctly to canvas cards.
- Typography tokens — Spectral for prose, Courier for dispatch/system voices, already in `--font-prose` + `--font-brutalist`.
- Alpha-suite scramble → **NOT** used for Insight reveal. Scramble codes "generated"; typewriter codes "authored." The Palimpsest must feel authored.

**What we build new:**
- `VelgFragmentCard` — no existing card primitive is right (VelgGameCard is TCG-specific, too ornamented).
- `VelgConstellationCanvas` — no existing canvas component.
- `VelgConnection` — no existing connection-line renderer.
- `VelgPalimpsestReader` — no existing long-form prose reader (chat messages are short; Palimpsest is 3-5 paragraphs).

---

## 8. Typography settings (final)

**Body prose** (Fragment text, Palimpsest body):
- Face: `var(--font-prose)` (Spectral).
- Weight: 400 (Regular) default; 500 (Medium) for Palimpsest body (bumps visual weight on dark).
- Size: 16-17px fragments, 18px Palimpsest.
- Line-height: 1.6 (opens up serif on dark — research confirms).
- Letter-spacing: `0.005em` (tiny positive tracking, reverses dark-mode compression).
- Measure: 65ch, clamped `min(65ch, 100%)`.
- Color: `color-mix(in oklch, var(--color-text-primary) 92%, transparent)`. Never pure.

**System voices** (Signature, Mark, metadata):
- Face: `var(--font-brutalist)` (Courier New).
- All-caps for Mark + small caps for metadata attributions (`font-variant: all-small-caps`).
- Tracking: `var(--tracking-brutalist)` (0.08em, already defined).

**Decorative initials** (Palimpsest first-paragraph drop cap only):
- 3-line drop cap via CSS `initial-letter: 3` with fallback `float: left` + calculated size.
- Color: `var(--color-accent-amber)`.
- Weight: 500.

**Reader controls**: Font-size A / A+ toggle + width Narrow / Wide toggle on Palimpsest reader. Two discrete steps, not a slider (iA Writer pattern). Persisted in `localStorage`.

---

## 9. Animation posture

**Durations** (from existing `--duration-*` tokens):
- `--duration-fast` (100ms): focus ring
- `--duration-normal` (200ms): card lift, drop zone highlight
- `--duration-slow` (300ms): card return from cancel, text fade
- 450ms custom: connection line draw-in
- 2200ms composed: crystallization ceremony

**Easings** (from existing `--ease-*` tokens):
- `--ease-default` (ease-out) for entrances
- `--ease-in-out` for in-place state changes
- `cubic-bezier(0.16, 1, 0.3, 1)` for connection-line draw-in — tighter than default ease-out, feels like ink settling

**`prefers-reduced-motion`** — all non-informational animations collapse to 0.01ms. State-carrying transitions (focus ring, drop confirmation) retain the transition event lifecycle.

**Never animate**: layout-dependent properties (top/left/width/height). Only `transform` and `opacity` on compositor-animated elements.

---

## 10. Performance posture

- Fragment grid: virtualize if >100 fragments (P0 MVP: simple list, revisit in P1 if tests show jank).
- Constellation canvas: ≤100 fragments budget. Above that, show a "This constellation is very dense — archive some fragments to see clearly" prompt. Not a hard limit, a user-facing soft ceiling.
- Connection paths: SVG works to ≤500 paths; we expect ≤50 active paths per canvas.
- `getTotalLength()` cache: compute once per path creation, recompute only on endpoint change, never every frame.

---

## 11. Accessibility posture

- **Keyboard-first parity.** Every canvas action has a keyboard equivalent — Move dialog for placement, Tab + focus ring for connection inspection, Enter/Space for crystallize.
- **Screen-reader parity.** Live region at app-shell level, assertive, 100ms debounced. All state changes announced per §5.2.
- **Reduced-motion.** Per §9.
- **Color-contrast.** All text meets WCAG AA on all surfaces. Amber-accent-on-dark meets 3:1 for large text only; small amber labels (metadata) use `--color-text-muted` + small caps, not amber, to preserve contrast.
- **Touch.** Pointer Events handle touch automatically. Long-press (400ms) on a card enters drag mode. `touch-action: none` during drag.
- **Zoom.** Canvas supports browser zoom to 200% without clipping. Fragment grid responsive to 320px viewport.

---

## 12. What we refuse (anti-patterns)

- **No progress bars.** No "0/30 fragments to next Palimpsest." Principle 9.
- **No streaks.** Never a "you've journaled 7 days in a row" indicator. Principle 9 + ethical commitment §5 of concept doc.
- **No toasts for success events.** Errors only. Principle 9.
- **No modal celebrations.** Crystallization is on-canvas. Never a full-screen takeover.
- **No loss-aversion cues.** Fragments never expire. Never an "expires in 3 days" timer on anything.
- **No forced reading order.** Next/previous arrows between fragments? Refused. Principle 4.
- **No AI prose that announces its AI-ness.** No "the AI has observed you" narration. The Palimpsest speaks as itself, cited if quoting.
- **No decorative animation.** Breathing cards, idle shimmers, parallax — refused.
- **No HTML5 native DnD.** See revised AD-3 in §1.
- **No external DnD library.** Pointer Events + keyboard dialog + live region = zero library dependency.

---

## 13. Open decisions for user

**AD-3 revision (Pointer Events, not HTML5 DnD)** — §1 Finding 4. Proposed; awaiting explicit user ack before P2 implementation. (P0 doesn't touch the canvas, so this decision can wait, but earlier is better.)

Nothing else is open. The other 11 principles + voice mapping + interaction spec are committed as the design brief.

---

## 14. What happens next

This document is the brief for the **velg-frontend-design skill** (per CLAUDE.md: "MUST invoke velg-frontend-design skill before writing any component code"). The skill consumes this brief and returns component-level design specs for:

- `VelgFragmentCard` (P0)
- `VelgFragmentGrid` (P0)
- `VelgResonanceJournal` shell + tabs (P0)
- `VelgConstellationCanvas` + `VelgConnection` (P2)
- `VelgPalimpsestReader` (P4)
- `VelgInsightReveal` (P2 crystallization)
- `VelgAttunementPanel` (P3)

After the skill runs, P0 implementation begins.
