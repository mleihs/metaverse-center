---
title: "TCG Card System — Unified Design Concept"
id: tcg-card-system
version: "0.1"
date: 2026-03-07
lang: en
type: explanation
status: draft
tags: [tcg, cards, design, game-ui]
---

# TCG Card System — Unified Design Concept

## Context

The DraftRosterPanel needs a card-game-style redesign ("The Hand" direction), but this is bigger than one component. We're designing a **unified TCG card system** that transforms how agents and buildings look across the entire platform — AgentsView, BuildingsView, DraftRosterPanel, and anywhere cards appear. Think of it as introducing a shared visual language inspired by Hearthstone, MTG Arena, Marvel Snap, and Balatro.

## Part 1: The Card — Universal TCG Card Design

### Card Anatomy (shared by agents AND buildings)

Every card follows the same physical structure — a standardized "metaverse.center card" that feels like a real collectible:

```
┌─────────────────────────────────┐
│ ┌─┐                        ┌─┐ │ ← Top corners: stat gems
│ │7│  ┌───────────────────┐ │4│ │    (left = primary stat,
│ └─┘  │                   │ └─┘ │     right = secondary stat)
│      │                   │     │
│      │    CARD ARTWORK   │     │ ← Art frame: 60% of card height
│      │    (portrait or   │     │    2px inner border (--color-border)
│      │     building img) │     │    Slight inner shadow for depth
│      │                   │     │
│      └───────────────────┘     │
│ ┌─────────────────────────────┐│ ← Name plate: dark banner
│ │    ✦ AGENT NAME ✦          ││    Centered, brutalist uppercase
│ └─────────────────────────────┘│    Decorative divider glyphs
│                                │
│  [SPY] [GUARD] [SAB]          │ ← Type row: operative aptitude
│  [PROP] [INF] [ASSN]          │    dots or mini-bars (agent)
│                                │    OR condition/type badges
│  Profession · Gender           │ ← Subtitle: secondary info
│                                │    small, muted text
│ ┌─────────────────────────────┐│
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░ ││ ← Bottom bar: aptitude summary
│ └─────────────────────────────┘│    or capacity bar
│ ┌─┐                            │
│ │★│ RARITY INDICATOR           │ ← Bottom-left: rarity gem
│ └─┘                            │
└─────────────────────────────────┘
   Card border: 3px with subtle
   gradient (type-colored edges)
```

### Card Dimensions & Proportions

- **Aspect ratio: 5:7** (standard TCG ratio, ~0.714)
- Grid view size: **200px × 280px** (desktop), scales down responsively
- Draft hand size: **120px × 168px** (compact for fanning)
- Hover preview: **280px × 392px** (enlarged detail)
- Border-radius: 12px (softer than current brutalist 0px — cards need to feel physical)

### Agent Cards — Stat Mapping

```
┌─────────────────────────────────┐
│ ┌──┐                      ┌──┐ │
│ │36│                      │ 8│ │  Left gem: total aptitude budget (36)
│ └──┘ ┌─────────────────┐  └──┘ │  Right gem: best aptitude value
│      │                 │       │
│      │   PORTRAIT      │       │  Art frame: portrait_image_url
│      │   (cover crop)  │       │  Inner glow border in best-type color
│      │                 │       │
│      └─────────────────┘       │
│ ┌─────────────────────────────┐│
│ │  ✦ COMMISSAR VOLKOV ✦      ││  Name plate
│ └─────────────────────────────┘│
│                                │
│  ▪7 ▪5 ▪8 ▪4 ▪6 ▪6            │  Aptitude pips: colored dots
│  SPY GRD SAB PRP INF ASN      │  with value, in operative colors
│                                │
│  Enforcer · Male               │  Profession + gender
│                                │
│ [SYSTEM] [AMBASSADOR] [AI]     │  Existing badges preserved
│                                │
│ ★ 3 connections                │  Relationship indicator
└─────────────────────────────────┘
  Border: gradient from best-type
  color (top) to --color-gray-800
  (bottom)
```

**Stat gems** (top corners):
- Left: total aptitude sum (always 36, shown as "power level")
- Right: highest single aptitude value (the "specialization" number)
- Gem shape: rounded square (8px, slightly rotated 45deg = diamond)
- Color: best operative type color
- Font: --font-mono, bold, 14px

**Aptitude display** (middle):
- 6 colored dots in a row, each showing the value
- Dot color = operative type color (spy=#64748b, guardian=#10b981, etc.)
- Values 3-5 = dim, 6-7 = normal, 8-9 = bright + subtle glow
- Compact: fits in one line, replaces the old badge/meta layout

### Building Cards — Stat Mapping

```
┌─────────────────────────────────┐
│ ┌──┐                      ┌──┐ │
│ │30│                      │HP│ │  Left gem: population capacity
│ └──┘ ┌─────────────────┐  └──┘ │  Right gem: condition indicator
│      │                 │       │  (●=good, ◐=fair, ○=poor)
│      │  BUILDING IMAGE │       │
│      │  (cover crop)   │       │
│      │                 │       │
│      └─────────────────┘       │
│ ┌─────────────────────────────┐│
│ │  ✦ THE IRON CITADEL ✦      ││  Name plate
│ └─────────────────────────────┘│
│                                │
│  [Government] [Good]           │  Type + condition badges
│                                │
│  Fungal Warrens · Glimhaven    │  Zone + City location
│                                │
│ [EMBASSY] [COMPROMISED]        │  Special badges if applicable
│                                │
│ ░░░░░░░░░░░░░░░░░░░░░ 30/50   │  Capacity bar (filled %)
└─────────────────────────────────┘
  Border: condition-colored
  (good=green, fair=amber, poor=red)
```

### Card Rarity System (visual-only, based on data)

Cards get visual rarity tiers that affect their border and idle effects:

| Tier | Criteria (Agent) | Criteria (Building) | Visual |
|------|-------------------|---------------------|--------|
| **Common** | No special flags | Standard type | Plain gray-700 border |
| **Rare** | Has relationships OR AI-generated | Embassy OR critical type | Gradient border (type-colored) |
| **Legendary** | Ambassador OR aptitude 9 in any stat | Embassy + good condition | Animated gradient border + idle glow + holographic shine on hover |

### Card Hover — 3D Tilt + Holographic Effect

Inspired by the Pokemon Cards CSS holographic effect (simeydotme) and Balatro's spring physics:

**Desktop hover behavior:**
1. Card lifts: `translateY(-8px)` + `scale(1.05)` + shadow deepens (150ms ease-out)
2. Mouse-tracking tilt: `rotateX/Y` follows cursor position (+/-12deg max)
   - Container: `perspective: 800px`
   - Card: `transform-style: preserve-3d`
   - JS: track mouse position within card bounds, update CSS custom properties `--mx`, `--my`
   - Transform: `rotateX(calc((0.5 - var(--my)) * 24deg)) rotateY(calc((var(--mx) - 0.5) * 24deg))`
3. Light reflection: radial-gradient overlay follows mouse position
   - `background: radial-gradient(circle at calc(var(--mx)*100%) calc(var(--my)*100%), rgba(255,255,255,0.15), transparent 60%)`
   - `mix-blend-mode: overlay`
4. Legendary cards ONLY: holographic rainbow shimmer
   - Additional overlay with `background: linear-gradient(115deg, transparent 20%, rgba(255,100,100,0.1) 30%, rgba(100,255,100,0.1) 40%, rgba(100,100,255,0.1) 50%, transparent 60%)`
   - `background-size: 300% 300%`
   - Position tracks mouse: `background-position: calc(var(--mx)*100%) calc(var(--my)*100%)`
   - `mix-blend-mode: color-dodge`, `filter: brightness(0.8) contrast(2)`

**Leave behavior:**
- Tilt springs back to 0,0 with `transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot)
- Shadow returns to resting state
- Holographic overlay fades (300ms)

**Mobile:** No tilt (no mouse position). Tap = select/open. Long-press = enlarged preview.

### Card Idle Animations

Nothing should be perfectly still (Balatro principle):

- **All cards:** Micro-sway — subtle `translateY` oscillation (1px amplitude, 4s cycle, sine, phased by `--i` so cards don't sync)
- **Rare cards:** Border gradient slowly rotates (`background-position` animation, 6s linear infinite)
- **Legendary cards:** Glow breathing (box-shadow pulses between 4px and 8px, 3s ease-in-out) + occasional sparkle (a tiny flash at random position on the card, every 5-8s, implemented via `::after` with animation-delay variety)

### Card Entrance Animation

Staggered deal from below (inspired by Hearthstone draw + Balatro deal):

1. Each card starts at `translateY(60px) scale(0.8) rotateZ(8deg) opacity(0)`
2. Deals into position: `translateY(0) scale(1) rotateZ(0) opacity(1)`
3. Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring with overshoot)
4. Duration: 400ms per card
5. Stagger: 50ms between cards
6. On landing: brief `scale(1.02)` bounce (100ms) then settle to `scale(1)`

### Edit/Delete Actions

In grid view, action buttons appear on hover (floating bottom-right of the card frame):
- Small circular buttons (24px) with `backdrop-filter: blur(4px)` + dark semi-transparent bg
- Edit = pencil icon, Delete = trash icon
- Appear with `scale(0) → scale(1)` pop, 150ms, staggered 50ms

---

## Part 2: Per-Simulation Card Themes

**TODO: Deep dive into per-simulation theming (see section below)**

---

## Part 3: "The Hand" — Draft Panel Deep Dive

### Layout Architecture

```
+========================================================================+
| DRAFT ROSTER ─── OPERATION LINEUP                           [✕ CLOSE] |
|  ┌─────────────────────────────────────────────────────────────────┐   |
|  │                     DEPLOYMENT FIELD                            │   |
|  │                                                                 │   |
|  │   ┌────────┐  ┌────────┐  ┌────────┐  ┌ ─ ─ ─ ┐  ┌ ─ ─ ─ ┐   │   |
|  │   │ AGENT  │  │ AGENT  │  │ AGENT  │  │ EMPTY │  │ EMPTY │   │   |
|  │   │ (full  │  │ (full  │  │ (full  │  │  ---  │  │  ---  │   │   |
|  │   │  card) │  │  card) │  │  card) │  │ SLOT  │  │ SLOT  │   │   |
|  │   │        │  │        │  │        │  │  4    │  │  5    │   │   |
|  │   └────────┘  └────────┘  └────────┘  └ ─ ─ ─ ┘  └ ─ ─ ─ ┘   │   |
|  │                                                                 │   |
|  │   ┌──────────── TEAM PROFILE ──────────────────────────────┐    │   |
|  │   │  SPY ██████ 34   GUARD ████████ 44   SAB █████ 28     │    │   |
|  │   │  PROP ██████ 36  INF ████████ 42     ASSN ████ 26     │    │   |
|  │   │                                                        │    │   |
|  │   │  STRONGEST: Infiltrator    WEAKEST: Assassin           │    │   |
|  │   │  AVG TOTAL: 36            SYNERGY: ████████ 82%        │    │   |
|  │   └────────────────────────────────────────────────────────┘    │   |
|  └─────────────────────────────────────────────────────────────────┘   |
|                                                                        |
|════════════════════════════════════════════════════════════════════════|
|  [CANCEL]          ●●●○○ 3/5 DRAFTED          [■ LOCK IN ROSTER ■]   |
|────────────────────────────────────────────────────────────────────────|
|                                                                        |
|         ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                  |
|        ╱│     │╱ │     │╱ │     │╱ │     │╱ │     │                  |
|       ╱ │ A1  │  │ A2  │  │ A3  │  │ A4  │  │ A5  │                  |
|      ╱  │     │  │     │  │     │  │     │  │     │                  |
|     ╱   └─────┘  └─────┘  └─────┘  └─────┘  └─────┘                  |
|                     YOUR HAND                                          |
+========================================================================+
```

### The Hand — Card Fan Mechanics

**Fan geometry:**
- Cards arranged in an arc at the bottom of the screen
- Each card gets: `transform: translateY(var(--fan-y)) rotateZ(var(--fan-rot))` where:
  - `--fan-rot`: ranges from `-15deg` (leftmost) to `+15deg` (rightmost)
  - `--fan-y`: parabolic curve, center cards lower, edge cards higher (creates the arc)
  - Formula: `--fan-rot = (i - (count-1)/2) * (30 / count)` degrees
  - Formula: `--fan-y = abs(i - (count-1)/2) * 8` pixels (edges lift up)
- `transform-origin: bottom center` on each card (fan pivots from bottom)
- Cards overlap slightly (negative margin or absolute positioning with calculated offsets)

**Fan layout (6 agents example):**
```
         ┌───┐
        ╱│   │╲        Card 0: rot=-12.5°, y=20px
       ╱ │   │ ╲       Card 1: rot=-7.5°,  y=8px
    ┌───┐│   │┌───┐    Card 2: rot=-2.5°,  y=2px
   ╱│   ││   ││   │╲   Card 3: rot=+2.5°,  y=2px
  ╱ │   ││   ││   │ ╲  Card 4: rot=+7.5°,  y=8px
 ┌───┐  ││   ││  ┌───┐ Card 5: rot=+12.5°, y=20px
 │   │  │└───┘│  │   │
 │   │  └─────┘  │   │
 └───┘           └───┘
       pivot point ●
```

**Hand hover interaction (Balatro-style):**
1. Hovering over ANY card in the hand triggers a "spread" — adjacent cards push apart by 15px to make room
2. The hovered card:
   - Rises: `translateY(-40px)` (pops above the fan)
   - Scales: `scale(1.25)` (becomes the focus)
   - Un-rotates: `rotateZ(0)` (straightens for readability)
   - Z-index: jumps to top
   - Shows expanded detail: aptitude bars become visible (they're hidden at fan size)
   - 3D tilt activates (mouse-tracking within the card)
   - Transition: 200ms ease-out
3. Adjacent cards smoothly reposition (CSS transition 250ms ease-in-out)
4. Non-adjacent cards dim slightly (opacity 0.7, 200ms)

**Drafted cards in hand:**
- Dim to opacity 0.3
- Grayscale filter: `filter: grayscale(0.8) brightness(0.6)`
- "DEPLOYED" text stamp overlaid at -12deg rotation (amber, 60% opacity)
- Non-interactive: `pointer-events: none`
- Still occupies space in the fan (maintains card positions)

### Hand — Card Deal Entrance Animation

When the draft panel opens, cards are "dealt" into the hand like a poker deal:

**Phase 1 — Deck appears (0-200ms):**
- A small deck icon/stack appears at top-center of screen
- 3 stacked card backs visible, slight offset

**Phase 2 — Deal sequence (200-1200ms):**
- Each card flies from deck position to its fan position
- Start state: `translateX(0) translateY(-200px) rotateZ(180deg) scale(0.5) opacity(0)` (face-down, at deck)
- End state: fan position with `rotateZ(var(--fan-rot)) opacity(1) scale(1)` (face-up, in hand)
- Each card's deal takes 350ms with `cubic-bezier(0.22, 1, 0.36, 1)` (--ease-dramatic)
- Stagger: 100ms between cards (overlapping — next card starts before previous lands)
- Mid-flight flip: at 50% of travel, card flips from back to front (`rotateY(0→180deg)` then art is revealed)

**Phase 3 — Settle (1200-1500ms):**
- All cards do a brief synchronized bounce: `translateY(-4px)` then back, 150ms, --ease-spring
- Hand is ready for interaction

### Deployment Field — Slots

**Empty slot design:**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                     │  Dashed border (2px, --color-gray-700)
│     ┌─────────┐     │  Card silhouette in center (very faint)
│     │  SLOT   │     │  Slot number at bottom
│     │   3     │     │
│     └─────────┘     │
│                     │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

- Same 5:7 aspect ratio as cards
- Dashed border: 2px dashed var(--color-gray-700)
- Faint card silhouette: outline of a card shape at 5% opacity
- Slot number: large, centered, --font-mono, gray-600
- Idle animation: border dashes "march" (stroke-dashoffset animation, 20s linear infinite, very subtle)

**Slot drag-over state:**
- Border: solid amber (--color-epoch-accent), 2px
- Background: color-mix(--color-epoch-accent 6%, --color-gray-900)
- Glow: box-shadow 0 0 20px rgba(245,158,11,0.15)
- Scale: 1.03 (slight grow)
- Transition: 150ms ease-out
- Ghost preview: faint silhouette of the dragged card at 15% opacity inside the slot

### Drag & Drop — Full Interaction Choreography

**Phase 1 — Pickup (0-200ms):**
- Card lifts from hand: `scale(1.15)`, `rotateZ(0)` (un-fans), shadow deepens to `--shadow-2xl`
- Hand re-fans: remaining cards smoothly redistribute (CSS transition 300ms)
- Sound metaphor: the visual equivalent of "card sliding off table" — slight lateral movement before lift
- Custom drag ghost: clone the card into a 1px transparent canvas (hide native ghost), render a `position: fixed` element that tracks `document.dragover` coordinates
- Ghost card: 90% opacity, slight `rotate(-3deg)` tilt, `filter: drop-shadow(0 8px 16px rgba(0,0,0,0.4))`
- Faint amber trail: the ghost leaves a very subtle motion blur (CSS `filter: blur(1px)` on a trailing clone that's 50ms behind, 20% opacity)

**Phase 2 — Travel (ongoing):**
- Ghost card follows cursor with slight spring lag (position interpolation, not rigid attachment)
- Implementation: `requestAnimationFrame` loop that lerps ghost position toward cursor position at 0.15 factor
- As card approaches deployment field: field brightens slightly (`filter: brightness(1.05)`)
- Empty slots begin to subtly "breathe" faster (pulse animation speeds up)

**Phase 3 — Hover over slot (immediate):**
- Slot activates (see drag-over state above)
- Ghost card snaps to slot center with spring: `transition: 100ms cubic-bezier(0.34, 1.56, 0.64, 1)`
- Card preview appears inside slot at 30% opacity (the actual card, ghosted)

**Phase 4 — Drop / Card Slam (0-500ms):**

The signature moment. Inspired by Hearthstone's board impact:

```
  0ms: Card drops into slot position
       scale(1.15) → scale(0.92)  (squash on impact)

 50ms: HIT PAUSE — card freezes at squash state
       This is the single most impactful technique from game feel research

100ms: Impact shockwave begins
       Ring 1: expanding rectangle border (not circle — brutalist), amber
       scale(0.8) opacity(1) → scale(2.5) opacity(0), 400ms

       Ring 2: slightly delayed (50ms), same but larger, dimmer

150ms: Board micro-shake on the deployment field only
       translateX: 0 → 2px → -2px → 1px → -1px → 0  (200ms)
       cubic-bezier(.36,.07,.19,.97)

200ms: Card springs to final size
       scale(0.92) → scale(1.04) → scale(1.0)
       cubic-bezier(0.34, 1.56, 0.64, 1)  (spring overshoot)

300ms: Aptitude pips on the deployed card animate in
       Each pip: scale(0) → scale(1.2) → scale(1), 150ms, staggered 40ms
       Color fills from gray to operative color

400ms: Counter pip flips (see below)

500ms: Card settles into idle breathing
```

**Particle burst on slam (CSS-only):**
- 6 particles (one per operative type color) burst from impact point
- Each particle: `::before` pseudo-element on a wrapper div, `position: absolute`
- Start: center of slot, scale(0)
- End: random direction (achieved by 6 different `@keyframes` with different `translate` endpoints), scale(0.5), opacity(0)
- Duration: 400ms, ease-out
- Implementation: 6 absolutely positioned `<span>` elements with class `particle particle--spy`, `particle--guardian`, etc., each with unique keyframes

### Card Removal from Deployment

**Click to remove (or drag back to hand):**

1. Card lifts: `translateY(-8px)`, `scale(1.05)`, 150ms
2. Card flips and flies back to hand position:
   - `rotateY(180deg)` (shows card back briefly)
   - Translates to hand fan position
   - Duration: 400ms, --ease-dramatic
3. Card back flips to front as it arrives in hand: `rotateY(360deg)` (or `0deg` — full rotation)
4. Hand re-fans to accommodate returning card
5. Slot plays "vacate" animation:
   - Filled card's afterimage lingers for 200ms (ghosted at 10% opacity)
   - Slot border transitions from solid back to dashed (300ms)
   - Glow fades (300ms)
6. Counter pip un-fills (reverse flip animation)

### Counter / Progress Bar

**Card-fan counter** (replacing rectangular pips):

```
  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐
  │▇│ │▇│ │▇│ │ │ │ │   3/5 DRAFTED
  └─┘ └─┘ └─┘ └─┘ └─┘
  ↑ amber   ↑ gray-800
```

- Miniature card silhouettes (20px × 28px), fanned slightly
- Filled: amber solid, with tiny glow
- Empty: gray-800 outline
- Fill animation: `rotateY(0→180deg)` 3D flip (300ms), revealing amber face
- Unfill: reverse flip back to gray
- All filled: brief golden flash across all pips + "ROSTER COMPLETE" text materializes with typewriter effect (letter by letter, 30ms per char, --font-brutalist)

### Team Profile Panel

Below the deployed cards, a summary panel shows team composition:

- 6 horizontal bars (one per operative type) showing aggregate aptitudes across drafted agents
- Each bar: colored by operative type, fill animates on change
- Below bars: text stats — Strongest type, Weakest type, Avg Total, Synergy score
- Synergy: a calculated metric (how well aptitudes complement each other — high variance = specialized team = high synergy vs. flat = generalist = low synergy)
- Panel entrance: slides up from below deployed cards (translateY 20px → 0, 300ms, --ease-dramatic)

### Responsive Design

**Desktop (>1024px):** Full layout as described. Hand fanned at bottom. Deployment field above.

**Tablet (768-1024px):** Hand becomes a horizontal scroll strip (no fan rotation). Deployment field: 3-column grid (wraps to 2 rows for 6 slots). Drag still works on iPad with touch-to-drag polyfill.

**Mobile (<=768px):**
- Hand: vertical scrollable list of compact cards (no fan, no rotation)
- Deployment: horizontal scroll strip above the list
- Interaction: tap to add (no drag)
- Added cards show mini-avatar in deployment strip
- Pull-to-expand on deployment strip shows full cards

### Accessibility

- All cards: `tabindex="0"`, `role="button"`, `aria-label` with agent name + stats
- Keyboard: Tab through hand → Enter/Space to deploy to first empty slot
- Keyboard: Tab through deployment → Enter/Space to remove
- Screen reader: live region announces "Agent X deployed to slot Y" / "Agent X removed"
- `prefers-reduced-motion`: all animations → `animation: none`, transitions → 0ms, cards appear instantly, no tilt effect, no particles, no shockwave. Visual state changes (colors, borders) still apply.

---

## Part 4: Grid View Redesign — Agents & Buildings

### AgentsView with TCG Cards

```
+====================================================================+
| AGENTS                          [+ Create Agent]     12 agents     |
+====================================================================+
| [Search...]  [Filter: All ▼]  [Sort: Name ▼]                      |
+====================================================================+
|                                                                     |
|  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              |
|  │┌──┐  ┌──┐│  │┌──┐  ┌──┐│  │┌──┐  ┌──┐│  │┌──┐  ┌──┐│          |
|  ││36│  │ 8││  ││36│  │ 7││  ││36│  │ 9││  ││36│  │ 6││          |
|  │└──┘  └──┘│  │└──┘  └──┘│  │└──┘  └──┘│  │└──┘  └──┘│          |
|  │┌────────┐│  │┌────────┐│  │┌────────┐│  │┌────────┐│          |
|  ││PORTRAIT││  ││PORTRAIT││  ││PORTRAIT││  ││PORTRAIT││          |
|  ││        ││  ││        ││  ││        ││  ││        ││          |
|  │└────────┘│  │└────────┘│  │└────────┘│  │└────────┘│          |
|  │╔════════╗│  │╔════════╗│  │╔════════╗│  │╔════════╗│          |
|  │║VOLKOV  ║│  │║PETRA   ║│  │║ ZARA   ║│  │║GRIGOR  ║│          |
|  │╚════════╝│  │╚════════╝│  │╚════════╝│  │╚════════╝│          |
|  │ •7•5•8•4 │  │ •6•7•5•6 │  │ •4•5•9•3 │  │ •6•6•6•6 │          |
|  │ •6•6     │  │ •5•7     │  │ •7•8     │  │ •6•6     │          |
|  │Enforcer  │  │Diplomat  │  │Assassin  │  │Guardian  │          |
|  │[SYS][AMB]│  │[AI]     │  │          │  │          │          |
|  └─────────┘  └─────────┘  └─────────┘  └─────────┘              |
|                                                                     |
|  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ...         |
|  │   ...   │  │   ...   │  │   ...   │  │   ...   │              |
|  └─────────┘  └─────────┘  └─────────┘  └─────────┘              |
+====================================================================+
```

**Grid layout:**
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Gap: `var(--space-4)` (16px)
- Cards maintain 5:7 aspect ratio via `aspect-ratio: 5/7`
- Staggered entrance: 50ms per card, deal-from-below animation

**Hover in grid:**
- Card lifts + 3D tilt (mouse tracking)
- Adjacent cards DON'T move (unlike hand fan — grid is stable)
- Enlarged preview tooltip appears offset to the side (if space allows) showing full aptitude bars + description snippet

**Click:** Opens AgentDetailsPanel (VelgSidePanel) — no change to navigation pattern

**Edit/Delete:** Floating circular buttons appear on hover, bottom-right of card frame

### BuildingsView with TCG Cards

Same grid layout, but building cards have different stat presentation:

```
┌─────────────────────────────────┐
│ ┌──┐                      ┌──┐ │
│ │30│                      │●●│ │  Left: capacity number
│ └──┘ ┌─────────────────┐  └──┘ │  Right: condition dots (●●○ = fair)
│      │                 │       │
│      │ BUILDING IMAGE  │       │
│      │                 │       │
│      └─────────────────┘       │
│ ╔═════════════════════════════╗ │
│ ║  THE IRON CITADEL           ║ │
│ ╚═════════════════════════════╝ │
│                                 │
│  [Government]                   │  Type badge (color-coded)
│  Fungal Warrens · Glimhaven     │  Location
│  ░░░░░░░░░░░░░░░░░░ 30/50      │  Capacity bar
│  [EMBASSY]                      │  Special badge if applicable
└─────────────────────────────────┘
```

**Condition indicator (right gem):**
- Good: ●●● (3 green dots)
- Fair: ●●○ (2 amber dots)
- Poor: ●○○ (1 red dot)
- Ruined: ○○○ (0 dots, red outline)

---

## Part 5: Shared Card Component Architecture

### New Component: `<velg-game-card>`

A single shared component used everywhere:

```typescript
// Usage for agent:
<velg-game-card
  type="agent"
  .name=${agent.name}
  .imageUrl=${agent.portrait_image_url}
  .primaryStat=${36}
  .secondaryStat=${bestAptitude.level}
  .rarity=${'legendary'}
  .aptitudes=${aptitudeSet}
  .badges=${badges}
  .subtitle=${'Enforcer · Male'}
  size="md"
  ?interactive=${true}
  @card-click=${this._onAgentClick}
></velg-game-card>

// Usage for building:
<velg-game-card
  type="building"
  .name=${building.name}
  .imageUrl=${building.image_url}
  .primaryStat=${building.population_capacity}
  .conditionDots=${conditionLevel}
  .badges=${badges}
  .subtitle=${'Fungal Warrens · Glimhaven'}
  .capacityBar=${{ current: 30, max: 50 }}
  size="md"
  @card-click=${this._onBuildingClick}
></velg-game-card>
```

**Size variants:**
- `xs`: 80×112px — counter pips, minimap references
- `sm`: 120×168px — hand in draft panel
- `md`: 200×280px — grid views (default)
- `lg`: 280×392px — hover preview, detail focus

**Properties:**
- `type`: 'agent' | 'building' — controls stat layout
- `size`: 'xs' | 'sm' | 'md' | 'lg'
- `rarity`: 'common' | 'rare' | 'legendary' — controls border + idle effects
- `interactive`: enables hover tilt + click events
- `draggable`: enables HTML5 drag (for draft panel)
- `dimmed`: grayscale + low opacity (drafted state)
- `highlighted`: glow border (selected/active state)

---

## Part 6: Per-Simulation Card Themes

### Design Philosophy: Faction Frames

In every major TCG, factions share the same card **anatomy** (dimensions, stat positions, layout) but differentiate through **frame treatment** — the border, textures, name plate, decorative motifs, and idle effects. This is exactly how MTG's 5 colors work (same card layout, but White cards have sunlit stone borders while Black cards have skull-etched obsidian), or how Gwent's 6 factions use the same card size but with completely different border art (Nilfgaard = gold imperial filigree, Skellige = weathered wood and iron).

**What stays the SAME across all simulations:**
- Card dimensions (5:7 aspect ratio)
- Art frame position and size (60% of card)
- Stat gem positions (top-left, top-right)
- Name plate position and height
- Aptitude/badge layout below name
- Font sizes and spacing ratios
- Click/hover/drag behavior
- 3D tilt interaction on hover

**What changes PER SIMULATION:**
- Card frame border (color, width, pattern, texture)
- Card background fill (behind the art frame and below it)
- Name plate styling (background, text treatment, decorative glyphs)
- Corner decorations / watermarks
- Shadow style (glow vs. offset vs. blur)
- Idle animation character (what "breathes" and how)
- Holographic/foil treatment on legendary cards
- Card back design
- Stat gem styling (shape, border treatment)

### Implementation: CSS Custom Properties

Each card reads theme tokens from its simulation context. The `VelgGameCard` component uses CSS custom properties that are inherited from the simulation shell:

```css
/* These come from ThemeService via the simulation shell */
:host {
  --card-frame-primary:    var(--color-primary);
  --card-frame-secondary:  var(--color-secondary);
  --card-frame-accent:     var(--color-accent);
  --card-bg:               var(--color-surface);
  --card-bg-deep:          var(--color-surface-sunken);
  --card-text:             var(--color-text-primary);
  --card-text-dim:         var(--color-text-secondary);
  --card-border:           var(--color-border);
  --card-shadow:           var(--shadow-md);
  --card-radius:           var(--border-radius);
  --card-font-heading:     var(--font-heading);
  --card-heading-weight:   var(--font-heading-weight);
  --card-heading-transform:var(--text-transform-heading);
  --card-ease:             var(--ease-default);
  --card-speed:            var(--animation-speed, 1);
}
```

Additionally, each simulation preset adds **card-specific overrides** via a new `card_frame` section in the theme preset:

```typescript
// In theme-presets.ts, each preset gets:
card_frame: {
  texture: 'circuits' | 'filigree' | 'scanlines' | 'rivets' | 'illumination' | 'none',
  nameplate_style: 'terminal' | 'banner' | 'readout' | 'plate' | 'cartouche',
  corner_motif: 'none' | 'brackets' | 'tentacles' | 'crosshairs' | 'bolts' | 'floral',
  foil_style: 'holographic' | 'aquatic' | 'phosphor' | 'patina' | 'gilded',
  card_back: 'grid' | 'deep' | 'void' | 'leather' | 'manuscript',
}
```

---

### 1. VELGARIEN — "Terminal Card"

**Aesthetic:** Cyberpunk data terminal. The card looks like a piece of glitched hardware — neon orange edge glow, circuit trace patterns, scanline texture, monospace readouts.

```
┌══════════════════════════════════┐  ← 2px border, #ff6b2b (neon orange)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← Scanline texture overlay (2px stripe)
│ ┌──┐                        ┌──┐│     repeating-linear-gradient
│ │36│  ┌───────────────────┐ │ 8││     0deg, transparent 2px,
│ └──┘  │                   │ └──┘│     rgba(255,107,43,0.03) 4px
│  ▓    │   ┊ PORTRAIT ┊   │   ▓ │
│  ▓    │   ┊  (image)  ┊   │   ▓ │  ← Side gutters: circuit trace SVG
│  ▓    │   ┊           ┊   │   ▓ │     pattern (very faint, 4% opacity)
│  ▓    │                   │   ▓ │     Thin orange lines + node dots
│       └───────────────────┘     │
│ ┌──────────────────────────────┐│
│ │> COMMISSAR_VOLKOV            ││  ← Name plate: terminal prompt style
│ │  ████████████████████████    ││     Prefix: ">" character
│ └──────────────────────────────┘│     Underline: gradient bar (orange→cyan)
│                                  │     Font: --font-mono, uppercase
│  [7] [5] [8] [4] [6] [6]       │  ← Stat gems: rounded rect, orange glow
│  SPY GRD SAB PRP INF ASN       │     on values ≥7
│                                  │
│  Enforcer · Male                 │
│  [SYSTEM] [AMBASSADOR]           │
│                                  │
│  ┊ 3 LINKS ┊                    │  ← Relationship: "LINKS" (tech term)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└══════════════════════════════════┘
```

**Frame details:**
- **Border:** 2px solid `#ff6b2b`, with `border-radius: 2px` (near-square, tech feel)
- **Background:** `#0a0a0a` (void black) with scanline texture — `repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,107,43,0.03) 2px, rgba(255,107,43,0.03) 4px)`
- **Art frame inner border:** 1px `#ff6b2b` at 30% opacity (faint orange outline around portrait)
- **Side gutters:** Circuit trace pattern — thin lines connecting small dots, SVG `background-image`, `#ff6b2b` at 5% opacity. Horizontal traces left of portrait, vertical traces right.
- **Name plate:** Dark bg (`#171717`), text in `--font-mono` uppercase. Prefixed with `>` prompt character. Below name: a gradient underline (`linear-gradient(90deg, #ff6b2b, #00d4ff)`, 2px height, 60% width centered).
- **Stat gems:** Rounded rectangles (not diamonds). `#171717` bg, `#ff6b2b` border 1px. Values ≥7 get an orange glow: `box-shadow: 0 0 6px rgba(255,107,43,0.4)`.
- **Corner decorations:** Top-left and bottom-right: small bracket characters `[` and `]` in `#ff6b2b` at 20% opacity.

**Idle animation:**
- Scanline texture slowly scrolls downward: `background-position-y` animates 0→4px, 2s linear infinite
- Border glows: `box-shadow` pulsing 0→4px→0 in orange, 3s ease-in-out
- Occasional "glitch": every 8s, the card jitters `translateX(1px)` for 50ms then back (CSS animation with long delay)

**Legendary foil (holographic):**
- `mix-blend-mode: color-dodge` overlay with fast-moving diagonal gradient (`linear-gradient(115deg, transparent, #00d4ff 30%, #ff6b2b 50%, #a855f7 70%, transparent)`)
- The gradient shifts position tracking mouse on hover (like a holographic sticker catching light)
- `background-size: 400% 400%`, animated position

**Card back:**
- Grid pattern: `#0a0a0a` bg with `#ff6b2b` grid lines at 8% opacity (16px squares)
- Center: geometric simulation logo/emblem at 15% opacity
- Subtle scanline overlay

---

### 2. THE GASLIT REACH — "Sunken Card"

**Aesthetic:** A card pulled from the depths. Organic border with barnacle-like bumps, teal aura glow, watercolor edges, serif name in elegant script. Feels like it's been underwater and is faintly luminescent.

```
┌─·~·─────────────────────────·~·─┐  ← 1px border, #1a3a4a (dark teal)
│                                   │     Border has organic "wave" via
│  ┌─┐                        ┌─┐  │     subtle border-image or clip-path
│  │36│ ┌───────────────────┐ │ 8│  │
│  └─┘  │                   │ └─┘  │  ← Stat gems: rounded, teal glow
│       │                   │      │
│  ≈    │   PORTRAIT        │   ≈  │  ← Side gutters: tentacle/kelp
│  ≈    │   (image)         │   ≈  │     filigree SVG pattern
│  ≈    │                   │   ≈  │     Organic curves, #00e5cc at 6%
│       │                   │      │
│       └───────────────────┘      │
│  ┌────────────────────────────┐  │
│  │  ✧ Commodore Harrowgate ✧ │  │  ← Name plate: dark teal banner
│  │    ─────── ✦ ───────       │  │     Decorative: ✧ and ✦ glyphs
│  └────────────────────────────┘  │     Font: Cormorant Garamond (serif)
│                                   │     Subtitle italic, no uppercase
│   ·7· ·5· ·8· ·4· ·6· ·6·       │  ← Apt pips: round dots with
│   SPY GRD SAB PRP INF ASN       │     teal ring on values ≥7
│                                   │
│   Harbourmaster · Unknown         │
│   [SYSTEM] [AMBASSADOR]          │
│                                   │
│   ⚓ 3 connections                │  ← Relationship: anchor symbol
│                                   │
└─·~·─────────────────────────·~·─┘
```

**Frame details:**
- **Border:** 1px solid `#1a3a4a`, `border-radius: 6px` (soft, organic)
- **Background:** `#0f2236` (deep navy) with subtle watercolor edge — a radial gradient from center (`#0f2236`) to edge (`#081320`), creating vignette depth
- **Art frame inner border:** 1px `#0d7377` at 25% opacity (faint teal glow line)
- **Side gutters:** Organic filigree — curving kelp/tentacle tendrils, SVG path pattern in `#00e5cc` at 6% opacity. Asymmetric (left and right sides have different patterns). Think Art Nouveau + underwater biology.
- **Name plate:** `#0a1628` bg with 1px top border in `#0d7377`. Text in Cormorant Garamond (serif), title case (NOT uppercase). Decorative glyphs: `✧` before and after name, `✦` center of underline divider. The divider is a thin line with a diamond center, `#0d7377` at 40%.
- **Stat gems:** Circular (not square). Dark bg with 1px teal ring. Values ≥7: the ring glows cyan `box-shadow: 0 0 4px rgba(0,228,204,0.3)`.
- **Corner decorations:** Organic curl motifs in all 4 corners — small spiral/tendril shapes (SVG), `#00e5cc` at 8% opacity. Different curl pattern in each corner (asymmetric, natural).

**Idle animation:**
- Gentle luminescence: card border `box-shadow` slowly oscillates between `0 0 8px rgba(0,228,204,0.1)` and `0 0 16px rgba(0,228,204,0.2)`, 4s ease-in-out (slow, underwater rhythm)
- Filigree tendrils sway very subtly: SVG `transform: translateX(±0.5px)` on 6s sine wave
- Vignette edge "breathes": inner shadow depth oscillates slightly

**Legendary foil (aquatic shimmer):**
- `mix-blend-mode: overlay` with a flowing gradient that moves slowly leftward (not tracking mouse — independent, like underwater currents)
- Colors: `#00e5cc` → `#0d7377` → `#00d4ff`, 8s linear infinite
- Combined with subtle caustic light pattern (a `repeating-conic-gradient` that rotates slowly, 15% opacity, simulating light filtering through water)

**Card back:**
- Deep navy `#0a1628` with concentric circle pattern (like sonar/depth rings), `#0d7377` at 5% opacity
- Center: compass rose or nautical emblem at 10% opacity
- Edge: the organic curl motifs from the corners, extended

---

### 3. STATION NULL — "Scanner Card"

**Aesthetic:** An alien ship's scan readout. Hard 0px corners, mint-green phosphor glow, horizontal scan lines, monospace terminal readout. The card looks like it's being displayed on a failing CRT monitor inside a derelict spacecraft.

```
┌──────────────────────────────────┐  ← 1px border, #1a2030 (cold dark)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Heavy scanline overlay
│                                   │     3px stripe, rgba(0,204,136,0.04)
│ ┌──┐                        ┌──┐ │     + CRT vignette (dark corners)
│ │36│  ┌───────────────────┐ │ 8│ │
│ └──┘  │                   │ └──┘ │
│  ╳    │                   │   ╳  │  ← Side: crosshair markers (targeting)
│  │    │   PORTRAIT        │   │  │     Thin cross shapes in mint green
│  ╳    │   (image)         │   ╳  │     at 8% opacity, evenly spaced
│       │                   │      │
│       └───────────────────┘      │
│ ┌────────────────────────────┐   │
│ │ SUBJ: HAVEN_DIAGNOSTIC_03 │   │  ← Name plate: log entry format
│ │ ═══════════════════════════│   │     Prefix: "SUBJ:"
│ └────────────────────────────┘   │     Double-line separator (═)
│                                   │     Font: Space Mono, uppercase
│  [7] [5] [8] [4] [6] [6]        │     Wide letter-spacing (0.12em)
│  SPY GRD SAB PRP INF ASN        │
│                                   │  ← Stat gems: hard square, no radius
│  Diagnostic · Unknown             │     Mint glow on ≥7
│  [SYSTEM]                         │
│                                   │
│  ▸ 3 CONTACTS                    │  ← Relationship: "CONTACTS"
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└──────────────────────────────────┘
```

**Frame details:**
- **Border:** 1px solid `#1a2030`, `border-radius: 0` (absolute hard corners, zero rounding)
- **Background:** `#0c0c14` (barely visible dark) with heavy scanline texture — `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,204,136,0.04) 3px, rgba(0,204,136,0.04) 6px)` + CRT vignette: `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)`
- **Art frame inner border:** 1px `#00cc88` at 15% opacity (faint phosphor green line). Art has slight `filter: contrast(1.1) saturate(0.9)` — cold, clinical color correction.
- **Side gutters:** Targeting crosshairs — small `+` cross shapes in `#00cc88` at 8% opacity, vertically spaced every 40px. Like a targeting scope overlay. Purely geometric, no organic shapes.
- **Name plate:** `#050508` bg, 1px top border in `#00cc88` at 30%. Text in Space Mono, uppercase, 0.12em letter-spacing. Prefixed with `SUBJ:` (log entry format). Below name: double-line separator `═══` in `#1a2030`.
- **Stat gems:** Hard squares (0 radius). `#050508` bg, 1px `#1a2030` border. Values ≥7: mint phosphor glow `box-shadow: 0 0 5px rgba(0,204,136,0.35)`.
- **Corner decorations:** Targeting brackets — `┌` `┐` `└` `┘` characters (or thin SVG L-shapes) in `#00cc88` at 10% opacity, 4px from each corner. Like a scanner viewport.

**Idle animation:**
- Scan line sweep: a single horizontal line (1px, `#00cc88` at 8%) slowly moves from top to bottom of the card (8s linear infinite). When it passes over text/elements, they briefly brighten (not implemented per-element — just the line moving creates the illusion).
- Occasional flicker: every 10s, the entire card's `opacity` jitters `1 → 0.95 → 1 → 0.97 → 1` over 150ms (CRT power fluctuation)
- Scanline texture slowly drifts downward (background-position animation, 4s)

**Legendary foil (phosphor burn):**
- NOT holographic rainbow — instead, a mint-green phosphor burn effect
- `mix-blend-mode: screen` overlay with `radial-gradient(circle at var(--mx) var(--my), rgba(0,204,136,0.15), transparent 50%)`
- On mouse hover, the glow follows the cursor like a failing phosphor monitor where the beam lingers
- Combined with static noise: a `background-image` of tiny random dots (CSS `repeating-conic-gradient` at very small scale) that shifts position on hover

**Card back:**
- Absolute void `#050508` with concentric rings of `#1a2030` at 3% opacity (like sonar pings)
- Center: a simple geometric eye/circle motif in `#00cc88` at 8%
- Scanline overlay (same as card front)
- Corner targeting brackets

---

### 4. SPERANZA — "Salvage Card"

**Aesthetic:** A card made from salvaged materials in a post-apocalyptic world. Warm parchment background, riveted metal frame border, offset shadows (physical weight), rugged sans-serif text. It looks like a real object — something you'd find in a bunker, printed on scrap material, edge-worn.

```
╔══╤══════════════════════════╤══╗  ← 2px border, #8B7D6B (stone)
║⊙ │                          │ ⊙║     Rivet dots in 4 corners
║  │ ┌──┐                ┌──┐ │  ║     Border-radius: 4px (slightly worn)
║  │ │30│ ┌────────────┐ │ 8│ │  ║
║  │ └──┘ │            │ └──┘ │  ║  ← Stat gems: weathered metal plates
║  │      │            │      │  ║     #C08A10 (burnished gold) text
║  │  ◆   │  PORTRAIT  │  ◆   │  ║     Offset shadow (hard, 1px)
║  │  ◆   │  (image)   │  ◆   │  ║
║  │      │            │      │  ║  ← Side gutters: diamond studs (◆)
║  │      └────────────┘      │  ║     In #8B7D6B at 15% opacity
║  │ ╔════════════════════════╗│  ║
║  │ ║  THE IRON BASTION      ║│  ║  ← Name plate: metal plate/plaque
║  │ ║  ───────────────────   ║│  ║     Bold sans-serif (Barlow), uppercase
║  │ ╚════════════════════════╝│  ║     Double border (inner/outer line)
║  │                           │  ║     1px underline rule
║  │  [7] [5] [8] [4] [6] [6] │  ║
║  │  SPY GRD SAB PRP INF ASN │  ║  ← Stat gems: hexagonal shape
║  │                           │  ║     Amber fill on ≥7
║  │  Warden · Male            │  ║
║  │  [SYSTEM]                 │  ║
║  │                           │  ║
║  │  ⚙ 3 connections         │  ║  ← Relationship: gear symbol
║⊙ │                          │ ⊙║
╚══╧══════════════════════════╧══╝
```

**Frame details:**
- **Border:** 2px solid `#8B7D6B` (stone brown), `border-radius: 4px`. The border has a subtle `border-image: linear-gradient(180deg, #9E8E7A, #7A6C5A) 1` (slight gradient, lighter top → darker bottom, like light hitting metal).
- **Background:** `#F5EDE0` (pale parchment) with paper texture — `background-image: url(data:...)` (tiny inline SVG noise pattern at 3% opacity) creating a paper grain feel. LIGHT background theme.
- **Art frame inner border:** 2px `#8B7D6B` (stone), with a 1px inset shadow `inset 0 1px 3px rgba(0,0,0,0.2)` (art is recessed into the card).
- **Side gutters:** Diamond studs `◆` in `#8B7D6B` at 15% opacity, vertically spaced. Or small SVG rivet/bolt circles. Industrial, functional, no ornamentation beyond utility.
- **Name plate:** Recessed metal plate effect — `#ECE2D0` bg with `inset 0 1px 2px rgba(0,0,0,0.15)` shadow (pressed in). Double border: outer 1px `#8B7D6B`, inner 1px `#8B7D6B` at 50% with 2px gap. Text in Barlow bold uppercase, `#130918` (dark brown). 1px underline rule below name.
- **Stat gems:** Hexagonal shape (via `clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`). `#ECE2D0` bg, `#8B7D6B` border. Values ≥7: fill with `#C08A10` (gold) and 1px offset shadow.
- **Corner decorations:** Rivet dots `⊙` — small SVG circles (6px) with metallic gradient fill (`linear-gradient(135deg, #9E8E7A, #6A5C4A)`) + tiny highlight dot. One in each corner of the card frame.

**Idle animation:**
- NO glowing, NO pulsing — this is physical, not digital
- Instead: micro-wobble — the card has a very subtle `rotate(0.2deg)` on a 6s cycle (like a card resting on an uneven surface, shifting slightly)
- Offset shadow slowly oscillates direction: `2px 2px` → `3px 3px` → `2px 2px` (as if the overhead light source shifts)
- On hover: shadow deepens to `4px 4px 0` (lifts off surface physically)

**Legendary foil (patina):**
- NOT holographic — instead, a warm patina/oxidation effect
- `mix-blend-mode: multiply` overlay with `linear-gradient(160deg, transparent 30%, rgba(192,138,16,0.08) 50%, transparent 70%)`
- On hover, the patina shifts position with mouse (like catching warm light on aged metal)
- Combined with subtle emboss: `filter: contrast(1.05)` that activates on hover

**Card back:**
- Leather texture: `#ECE2D0` bg with cross-hatch pattern (45deg lines, `#8B7D6B` at 4% opacity)
- Center: gear/cog emblem (Speranza motif) at 10% opacity
- Corner rivets (same as front)
- Edge wear: slightly darker border-shadow on all edges (vignette, but warm)

---

### 5. CITE DES DAMES — "Illuminated Card"

**Aesthetic:** A page torn from an illuminated manuscript. Cream vellum background, gold leaf border with floral corners, ultramarine and purple ink accents, elegant serif typography. This is the only LIGHT-themed card — it stands in stunning contrast to the four dark-themed simulations. Think medieval Books of Hours meets suffragette broadside.

```
┌─────────────────────────────────┐  ← 1px border, #8B7D6B (ink line)
│ ╭───╮                    ╭───╮ │     Border-radius: 3px
│ │❧  │                    │ ❧│ │  ← Floral corner decorations
│ ╰───╯  ┌─────────────┐   ╰───╯ │     Gold + ultramarine ink motifs
│ ┌─┐    │             │    ┌─┐  │
│ │36│   │             │    │ 8│  │  ← Stat gems: illuminated capitals
│ └─┘    │  PORTRAIT   │    └─┘  │     Gold fill with dark text
│        │  (image)    │         │     Serif font (Libre Baskerville)
│        │             │         │
│        └─────────────┘         │
│ ┌─────────────────────────────┐│
│ │ ❦ Christine de Pizan ❦     ││  ← Name plate: ink banner
│ │   ── ✿ ──                   ││     Floral divider ✿
│ └─────────────────────────────┘│     Font: Libre Baskerville, title case
│                                 │     NO uppercase (literary elegance)
│  ·7· ·5· ·8· ·4· ·6· ·6·      │
│  SPY GRD SAB PRP INF ASN      │  ← Apt pips: circular, ultramarine ink
│                                 │     Values ≥7: gold ring
│  Scholar · Female               │
│  [SYSTEM] [AMBASSADOR]         │
│                                 │
│  ✦ 3 connections               │  ← Relationship: star symbol
│ ╭───╮                    ╭───╮ │
│ │ ❧│                    │❧  │ │  ← Bottom floral corners (mirrored)
│ ╰───╯                    ╰───╯ │
└─────────────────────────────────┘
```

**Frame details:**
- **Border:** 1px solid `#8B7D6B` (ink line), `border-radius: 3px`. On legendary cards: the border becomes `#B8860B` (goldenrod) — a gilded edge.
- **Background:** `#FAF3E6` (off-white parchment) with **paper fiber texture** — a very subtle noise pattern in warm sepia tones at 2% opacity. Slight warmth gradient from center (brighter) to edges (slightly darker, like aged vellum).
- **Art frame inner border:** 1px `#1E3A8A` (ultramarine) at 20% opacity. Art has slight `filter: sepia(0.05) saturate(1.1)` — warm, painterly color correction as if rendered in egg tempera.
- **Side gutters:** Delicate vine/leaf tracery — thin curving lines with small leaf shapes, SVG pattern in `#B8860B` (gold) at 6% opacity. Reminiscent of medieval manuscript marginalia. Each side is slightly different (hand-drawn feel, not perfectly symmetric).
- **Name plate:** `#F5E6CC` bg (cream) with 1px top and bottom borders in `#1E3A8A` at 30% (ink rules). Text in Libre Baskerville (serif), title case, `#1C1008` (dark brown ink). Decorative: `❦` (floral heart) before and after name. Below: `── ✿ ──` floral divider centered.
- **Stat gems:** Circular, with gold-leaf fill (`#B8860B`), dark text (`#1C1008`). Styled like illuminated capital letter medallions from medieval manuscripts. 1px `#8B7D6B` border. Values ≥7: additional thin gold ring 2px outside the gem (`outline: 2px solid #B8860B`).
- **Corner decorations:** Floral corner pieces (all 4 corners) — small botanical/vine motifs in `#B8860B` (gold) and `#1E3A8A` (ultramarine), SVG, ~20px square. Top-left and bottom-right: one design. Top-right and bottom-left: mirrored. Inspired by medieval illuminated manuscript corner flourishes.

**Idle animation:**
- Extremely subtle — literary dignity, not flashiness
- Gold corner flourishes have a barely perceptible shimmer: `opacity` oscillates between 0.9 and 1.0, 5s ease-in-out (gold catching candlelight)
- Paper texture has very gentle warm color shift: `filter: hue-rotate(0→2deg→0deg)` 8s cycle (parchment aging in real-time, barely visible)
- NO bouncing, NO pulsing, NO glitch effects — this is a sacred text, not a machine

**Legendary foil (gilded):**
- `mix-blend-mode: overlay` with warm gold gradient: `linear-gradient(135deg, transparent 25%, rgba(184,134,11,0.12) 40%, rgba(30,58,138,0.08) 55%, transparent 75%)`
- On hover: the gradient shifts to simulate gold leaf catching light at different angles
- Combined with a subtle texture that mimics the raised surface of real gold leaf (slightly mottled opacity)
- NO rainbow, NO holographic — pure warm gold + ultramarine interplay

**Card back:**
- `#F5E6CC` (cream) with centered manuscript page motif
- Repeating pattern of small floral elements in `#B8860B` at 4% opacity (like endpaper)
- Center: an open book or quill emblem in `#1E3A8A` at 8% opacity
- Border: thin ink rule 4px from edge
- Corner flourishes (same as front, rotated inward)

---

### Visual Comparison Table

| Element | Velgarien | Gaslit Reach | Station Null | Speranza | Cité des Dames |
|---------|-----------|--------------|--------------|----------|----------------|
| **Theme** | Dark | Dark | Dark | Light (warm) | Light (cream) |
| **Border** | 2px neon orange | 1px dark teal | 1px cold dark | 2px stone brown | 1px ink line |
| **Radius** | 2px | 6px | 0px | 4px | 3px |
| **Texture** | Scanlines | Watercolor vignette | CRT scanlines + noise | Paper grain | Parchment fiber |
| **Side motif** | Circuit traces | Organic tendrils | Targeting crosshairs | Metal rivets/studs | Vine tracery |
| **Corners** | `[ ]` brackets | Organic curls | `┌ ┐` targeting | `⊙` rivet dots | Floral flourishes |
| **Name font** | Mono, uppercase | Serif, title case | Mono, uppercase | Sans bold, uppercase | Serif, title case |
| **Name prefix** | `>` prompt | `✧` star | `SUBJ:` label | (none) | `❦` floral heart |
| **Stat gems** | Rounded rect | Circle | Hard square | Hexagon | Circle (gold) |
| **Shadow** | Orange glow | Cyan aura glow | Mint phosphor glow | Hard offset (brown) | Soft blur (sepia) |
| **Idle** | Scan drift + glitch | Luminescence breathe | Scan sweep + flicker | Micro-wobble + shadow | Gold shimmer |
| **Foil** | Holographic RGB | Aquatic current | Phosphor burn | Warm patina | Gold leaf |
| **Card back** | Grid pattern | Sonar rings | Concentric rings | Cross-hatch leather | Floral endpaper |
| **Mood** | Cyberpunk terminal | Underwater grimoire | Alien scan readout | Bunker field manual | Illuminated page |

---

### Draft Panel: Mixed Factions

In the draft panel ("The Hand"), players draft agents from their own simulation — so all cards in one player's hand share the same simulation theme. However, in the **Deployment Field**, cards from different players' simulations may be visible on the leaderboard or in spectator mode. The card frames make it instantly clear which simulation each agent belongs to, just like MTG cards are instantly identifiable by color frame.

---

## Part 7: Implementation Plan

### Files to Create
1. `frontend/src/components/shared/VelgGameCard.ts` — new shared TCG card component (~400 lines)

### Files to Modify
1. `frontend/src/components/epoch/DraftRosterPanel.ts` — full rewrite with "The Hand" layout (~900 lines)
2. `frontend/src/components/agents/AgentCard.ts` — replace with `<velg-game-card type="agent">` wrapper
3. `frontend/src/components/buildings/BuildingCard.ts` — replace with `<velg-game-card type="building">` wrapper
4. `frontend/src/components/agents/AgentsView.ts` — update grid + card rendering
5. `frontend/src/components/buildings/BuildingsView.ts` — update grid + card rendering
6. `frontend/src/components/shared/card-styles.ts` — extend with TCG card styles (or replace)
7. `frontend/src/styles/tokens/_animation.css` — add new easing curves (--ease-slam, --ease-settle)
8. `frontend/src/types/index.ts` — add CardRarity type, extend Agent/Building display types if needed
9. `frontend/src/locales/xliff/de.xlf` — new i18n strings (~20-30 new strings)

### Files to Reference (no changes)
- `frontend/src/components/shared/VelgAptitudeBars.ts` — used inside card at sm/xs size
- `frontend/src/components/shared/VelgAvatar.ts` — portrait rendering
- `frontend/src/components/shared/VelgBadge.ts` — badge rendering
- `frontend/src/utils/icons.ts` — icon set

### Execution Order
1. Create `VelgGameCard` component (the foundation — everything depends on this)
2. Update `AgentCard` + `AgentsView` to use new card (validates the component works in grid context)
3. Update `BuildingCard` + `BuildingsView` (parallel validation)
4. Rewrite `DraftRosterPanel` with "The Hand" (the showcase — uses cards in a new context)
5. Add animation tokens + i18n strings
6. Test: theme contrast, responsive breakpoints, reduced-motion, keyboard navigation

### Verification
- `cd frontend && npx tsc --noEmit` — type check
- `cd frontend && npx vitest run` — unit tests
- `cd frontend && npx biome check src/` — lint
- `cd frontend && npx vitest run tests/theme-contrast.test.ts` — WCAG contrast
- Manual: test 3D tilt on desktop, verify no tilt on mobile, verify drag & drop, verify click fallback, verify prefers-reduced-motion, test all 5 simulation themes
