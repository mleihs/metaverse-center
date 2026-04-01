---
title: "Dungeon Map — Vertical Sidebar Redesign"
version: "1.0"
date: 2026-03-31
lang: en
type: spec
status: ready-to-implement
tags: [dungeon, map, svg, microanimations, vertical-layout, sidebar, icons]
---

# Dungeon Map — Vertical Sidebar Redesign

**Related:** `../concepts/resonance-dungeons-spec.md` (dungeon system spec), `microanimations.md` (platform animation tokens), `../guides/design-tokens.md` (color token system), `../references/frontend-components.md`

---

## 1. Problem Statement

The current `DungeonMap.ts` renders a **horizontal** FTL-style DAG (left-to-right depth layers) inside a sidebar that is 260–320px wide and max-height 180–280px. This creates severe usability issues:

- **Tiny nodes** (`NODE_R = 18`) with single-character labels are barely readable
- **Horizontal layout** in a vertical sidebar wastes space — the map is wider than tall, forced into a scrollable viewport
- **No room detail panel** — clicking an adjacent room immediately dispatches `move`, with no preview or confirmation
- **Limited animations** — existing reveal-blip and edge-trace are functional but lack the dramatic quality of the rest of the UI
- **No icons** — rooms show single letters (C, !, ?, T, R, B, E, X) instead of thematic visual symbols

The map is the strategic overview of the entire dungeon run. It deserves the same design quality as the rest of the terminal HUD.

---

## 2. Design Goals

1. **Vertical depth-first layout** — depth axis runs top-to-bottom, branches spread left-to-right
2. **Larger, icon-bearing nodes** — 28–32px radius with SVG room-type icons from game-icons.net
3. **Room detail panel** — click to inspect, separate button to move (no accidental navigation)
4. **Rich microanimations** — 12 distinct animation types with full `prefers-reduced-motion` support
5. **Clean architecture** — layout logic extracted to pure function, nodes/edges as sub-components
6. **Performance-budgeted** — all animations compositor-friendly where possible, capped particle counts
7. **WCAG AA** — full keyboard navigation, focus indicators, screen reader labels

---

## 3. Layout: Vertical Depth-First DAG

### 3.1 Coordinate System

```
Depth 0:        [Entrance]
                    |
Depth 1:      [C]     [?]
               |  \  / |
Depth 2:      [C]    [T]
                |
Depth 3:       [!]
                |
Depth 4:       [R]
                |
Depth 5:       [B]
```

- **Y-axis** = depth (top-to-bottom), spaced by `V_GAP = 90px`
- **X-axis** = branching within a depth layer, spaced by `H_GAP = 72px`
- Each depth layer is horizontally centered within the SVG viewBox
- `NODE_R = 30` (up from 18)
- `PAD = 36` (up from 28)

### 3.2 Layout Constants

```typescript
const NODE_R = 30;      // Circle radius (was 18)
const V_GAP = 90;       // Vertical spacing between depth layers (was H_GAP=100 horizontal)
const H_GAP = 72;       // Horizontal spacing within a layer (was V_GAP=60)
const PAD = 36;          // Canvas padding (was 28)
```

### 3.3 Auto-Scroll Behavior

When the current room changes depth, the map container scrolls smoothly to keep the current node vertically centered:

```typescript
// After render, if depth changed:
const currentNodeEl = this.shadowRoot?.querySelector('.node--current');
currentNodeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
```

### 3.4 SVG ViewBox

The SVG grows vertically as the dungeon deepens. The container has `overflow-y: auto` and scrolls naturally. Width fits the sidebar (no horizontal scroll).

```
viewBox="0 0 ${w} ${h}"
preserveAspectRatio="xMidYMin meet"   // Changed from xMidYMid — anchor to top
```

---

## 4. Node Design: Icons + Rings

### 4.1 Node Anatomy

Each node is an SVG `<g>` group containing:

```
<g class="node" transform="translate(x, y)">
  <!-- 1. Outer ring (status indicator) -->
  <circle r="30" class="node__ring" />

  <!-- 2. Inner fill circle -->
  <circle r="24" class="node__fill" />

  <!-- 3. Room-type icon (SVG path, centered) -->
  <g class="node__icon" transform="translate(-10, -10)">
    <svg viewBox="0 0 512 512" width="20" height="20">
      <path d="..." fill="currentColor" />
    </svg>
  </g>

  <!-- 4. Status badge (optional — cleared checkmark, locked icon) -->
  <g class="node__badge" transform="translate(18, -18)">...</g>
</g>
```

### 4.2 Ring Indicators

| State | Ring Style |
|-------|-----------|
| **Current** | 3px stroke, room-type color, pulsing glow animation |
| **Adjacent (reachable)** | 2px stroke, room-type color, slight glow on hover |
| **Cleared** | 1px stroke, dimmed color (65% opacity), no glow |
| **Fog (unrevealed)** | 1.5px dashed stroke, `--_phosphor-dim` at 25% opacity |
| **Boss** | 2.5px stroke, `--color-danger`, pulsing red glow |

### 4.3 Icons: game-icons.net (CC BY 3.0)

**Source:** [game-icons.net](https://game-icons.net/) — 4,170+ RPG-specific icons, CC BY 3.0 license.

**Icon Quality Mandate:** Icons must be hand-selected for maximum thematic clarity at 20x20px rendering size. Each icon path is extracted from game-icons.net SVGs and integrated into the existing `icons.ts` factory pattern using Lit's `svg` tag. No icon fonts, no external dependencies.

**Room Type → Icon Mapping:**

| Room Type | Icon | game-icons.net Name | Rationale |
|-----------|------|---------------------|-----------|
| `combat` | Crossed swords | `crossed-swords` | Universal combat symbol |
| `elite` | Skull with lightning | `skull-bolt` | Already in icons.ts as `skullBolt` |
| `encounter` | Question in circle | `uncertainty` or `perspective-dice-six-faces-random` | Mystery/unknown event |
| `treasure` | Open treasure chest | `open-treasure-chest` | Unmistakable loot signal |
| `rest` | Campfire | `campfire` | Already in icons.ts as `campfire` |
| `boss` | Crowned skull | `overlord-helm` or `crowned-skull` | Authority + danger |
| `entrance` | Gate/archway | `castle-gate` or `dungeon-gate` | Entry point |
| `exit` | Open door with light | `exit-door` or `open-gate` | Escape/completion |

**Selection criteria for each icon:**
1. Instantly recognizable at 20x20px (simple silhouette, no fine detail)
2. Reads well in monochrome (fill-only, no stroke dependency)
3. Thematically unambiguous (a treasure chest IS treasure, not "storage")
4. Visually distinct from every other room-type icon at any distance

**Integration pattern:**

```typescript
// In icons.ts — extracted path data from game-icons.net SVGs
dungeonCombat: (size = 20) => svg`
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
    viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
    <path d="M..." />
  </svg>
`,
```

**Attribution:** CC BY 3.0 requires attribution. Add to app footer or about/credits page:
> Game icons by [game-icons.net](https://game-icons.net/) contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

### 4.4 Fog Nodes

Unrevealed nodes show a stylized `?` icon with animated fog overlay:

- Dashed ring stroke (`stroke-dasharray: 6 4`)
- SVG `feTurbulence` fog filter (animated via SMIL) applied to a semi-transparent overlay
- Subtle opacity pulse (`0.15 → 0.25 → 0.15`, 6s cycle)

---

## 5. Room Detail Panel

### 5.1 Interaction Flow

**Current:** Click adjacent node → immediate `move` command.

**New:**
1. Click any **revealed** node → **detail panel** slides in below the clicked node
2. Panel shows room info (type, status, loot preview if cleared)
3. If room is **adjacent**: panel includes a **"Move Here"** action button
4. If room is **current**: panel shows current room context
5. If room is **cleared**: panel shows loot summary and cleared status
6. Click elsewhere or press `Escape` → panel closes

### 5.2 Panel Content

```
┌─────────────────────────┐
│ ⚔ COMBAT ROOM #4       │  ← icon + type + index
│ Status: CLEARED         │  ← condition badge
│ Depth: 2                │
│ ─────────────────────── │
│ Loot: +2 Tactics        │  ← if cleared, loot summary
│       Cipher Fragment   │
│                         │
│ [  MOVE HERE  ]         │  ← only if adjacent
└─────────────────────────┘
```

### 5.3 Panel Positioning

The panel renders as an absolutely positioned element within the map SVG container, anchored to the clicked node's screen position. On mobile (fullscreen map dialog), the panel slides up from the bottom as a sheet.

### 5.4 Panel Architecture

Separate `DungeonRoomPanel.ts` component:
- Input: `RoomNodeClient` data, adjacency state, position coordinates
- Output: `terminal-command` event on "Move Here" click
- Keyboard: `Tab` cycles panel content, `Escape` closes, `Enter` on button activates

---

## 6. Microanimations (12 Types)

All animations follow the platform convention from `specs/microanimations.md`: CSS-only where possible, token-driven durations, `prefers-reduced-motion` safe.

### 6.1 Animation Catalog

| # | Name | Trigger | Technique | Duration | Reduced-Motion Fallback |
|---|------|---------|-----------|----------|------------------------|
| 1 | **Node Reveal** | Room transitions from fog to revealed | CSS: `scale(0→1.12→1)` + `opacity(0→1)` + ripple ring expansion | 400ms | Instant opacity fade (150ms) |
| 2 | **Reveal Ripple** | Accompanies Node Reveal | SVG circle animating `r` from NODE_R to NODE_R*2 with opacity fade | 600ms | Disabled |
| 3 | **Edge Trace** | New connection revealed | CSS: `stroke-dashoffset` with `pathLength="100"` | 500ms | Instant opacity (150ms) |
| 4 | **Edge Spark** | Accompanies Edge Trace | CSS `offset-path`: small golden circle travels along edge path | 600ms | Disabled |
| 5 | **Depth Transition** | Party moves to new depth | Auto-scroll + sonar ping on all revealed nodes at new depth | 500ms | Auto-scroll only |
| 6 | **Boss Proximity** | Party is adjacent to boss room | Boss node: CSS `tremble` shake + red glow pulse intensification | Infinite (0.5s shake cycle, 1.5s glow cycle) | Static red glow, no shake |
| 7 | **Room Cleared** | Room marked as cleared | SVG path-draw checkmark + ring fade to dimmed | 400ms | Instant state change |
| 8 | **Fog Drift** | Persistent on unrevealed nodes | SVG SMIL: `feTurbulence baseFrequency` animate (slow organic drift) | 8s cycle | Static noise texture |
| 9 | **Current Beacon** | Persistent on current room | Pulsing glow ring (existing) + conic-gradient radar sweep every 4s | 2s glow + 4s sweep | Static glow at mid-intensity |
| 10 | **Hover Focus** | Mouse/keyboard focus on node | CSS: `scale(1→1.08)` + glow intensification | 150ms | Glow only, no scale |
| 11 | **Click Ripple** | Node clicked | SVG circle appended at click point, expanding + fading | 500ms | Opacity flash (100ms) |
| 12 | **Treasure Shimmer** | Persistent on uncleared treasure rooms | 5–8 SVG circles with staggered `twinkle` keyframes (scale+opacity) | 1.8s staggered cycle | 2 static gold dots |

### 6.2 SVG Filter Definitions

Shared `<defs>` block at the top of the map SVG (rendered once):

```xml
<defs>
  <!-- Fog overlay for unrevealed nodes -->
  <filter id="dungeon-fog" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3"
                  seed="42" result="noise">
      <animate attributeName="baseFrequency" values="0.015;0.025;0.015"
               dur="8s" repeatCount="indefinite" />
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="12"
                       xChannelSelector="R" yChannelSelector="G" />
  </filter>

  <!-- Breathing glow for current room -->
  <filter id="beacon-glow">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur">
      <animate attributeName="stdDeviation" values="2;5;2" dur="2.5s"
               repeatCount="indefinite" />
    </feGaussianBlur>
    <feFlood flood-color="var(--_phosphor)" flood-opacity="0.3" result="color" />
    <feComposite in="color" in2="blur" operator="in" result="glow" />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
```

**SMIL note:** SMIL is NOT deprecated. Chrome reversed the deprecation in 2019. Full support in Chrome, Firefox, Safari, Edge. Required here because `feTurbulence` attributes cannot be animated via CSS keyframes.

### 6.3 Performance Budget

| Budget Item | Max Concurrent |
|-------------|---------------|
| CSS transform animations | 50 elements |
| CSS filter/drop-shadow animations | 8–10 elements |
| `feTurbulence` animated filters | 2–3 regions |
| Sparkle/shimmer particles (total) | 30 SVG circles |
| Path trace animations | 5–8 paths |
| SMIL `<animate>` elements | 10–15 |

On mobile, halve these limits. Test on mid-range Android (Moto G series equivalent).

### 6.4 prefers-reduced-motion

CSS animations: killed via the global `_global.css` rule (`animation-duration: 0.01ms !important`).

SMIL animations: handled in component JS:

```typescript
private _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

connectedCallback() {
  super.connectedCallback();
  this._reducedMotion.addEventListener('change', this._handleMotionPref);
}

private _handleMotionPref = (mq: MediaQueryListEvent) => {
  const anims = this.shadowRoot?.querySelectorAll('animate, animateTransform');
  anims?.forEach(el => {
    mq.matches
      ? (el as SVGAnimateElement).endElement()
      : (el as SVGAnimateElement).beginElement();
  });
};
```

---

## 7. Architecture: Component Decomposition

### 7.1 File Structure

```
frontend/src/components/dungeon/
├── DungeonMap.ts              → Orchestrator (SVG root, defs, event coordination)
├── DungeonMapNode.ts          → Single node (<g> with icon, rings, animations)
├── DungeonMapEdge.ts          → Single edge (line, trace animation, spark)
├── DungeonRoomPanel.ts        → Detail panel (slide-in on node click)
└── dungeon-map-layout.ts      → Pure function: (rooms, config) → NodePosition[]
```

### 7.2 dungeon-map-layout.ts (Pure Function)

```typescript
export interface MapLayoutConfig {
  nodeRadius: number;
  vGap: number;      // vertical (depth axis)
  hGap: number;      // horizontal (branch axis)
  padding: number;
}

export interface NodePosition {
  room: RoomNodeClient;
  x: number;
  y: number;
}

export interface MapLayout {
  nodes: NodePosition[];
  width: number;
  height: number;
}

/** Pure layout — no DOM, no Lit, fully unit-testable. */
export function layoutDungeonMap(
  rooms: RoomNodeClient[],
  config: MapLayoutConfig,
): MapLayout;
```

**Algorithm:**
1. Group rooms by `depth`
2. For each depth layer (sorted ascending): compute horizontal positions centered within max width
3. Y = `padding + depth * vGap`
4. X = centered within `padding + (maxNodesInAnyLayer - 1) * hGap`
5. Return `{ nodes, width, height }`

### 7.3 DungeonMapNode.ts

Lit sub-component rendered per room. Owns:
- Its own CSS animations (reveal, pulse, shimmer, fog)
- SVG icon rendering
- Click/keyboard handlers
- Accessibility attributes

Properties:
```typescript
@property({ type: Object }) room!: RoomNodeClient;
@property({ type: Number }) x = 0;
@property({ type: Number }) y = 0;
@property({ type: Boolean }) current = false;
@property({ type: Boolean }) adjacent = false;
@property({ type: Boolean }) justRevealed = false;
@property({ type: Boolean }) depthHighlight = false;
@property({ type: Boolean }) selected = false;
```

### 7.4 DungeonMapEdge.ts

Lit sub-component per edge. Owns:
- Line geometry (shortened to node ring edge)
- Trace animation state
- Spark particle lifecycle

### 7.5 DungeonMap.ts (Orchestrator)

Responsibilities:
- Calls `layoutDungeonMap()` to compute positions
- Renders shared SVG `<defs>` (filters, gradients)
- Renders `DungeonMapEdge` instances for all connections
- Renders `DungeonMapNode` instances for all rooms
- Manages animation diff state (willUpdate/updated pattern — already exists)
- Manages selected node state → renders `DungeonRoomPanel`
- Auto-scroll on depth change

### 7.6 DungeonRoomPanel.ts

Standalone Lit component, positioned absolutely within the map container:
- Input: selected room data + adjacency boolean
- Dispatches `terminal-command` on "Move Here"
- Dispatches `room-deselect` on close
- Keyboard: `Escape` closes, `Enter` on action button

---

## 8. Responsive Behavior

### 8.1 Sidebar (1440px+)

- Map lives in `grid-column: 3` of the HUD grid (260–320px wide)
- Vertical scroll, no max-height constraint (`persistent` mode)
- Room panel appears inline below the node

### 8.2 Medium (1200–1439px)

- Map in column 2, below party panel
- Same vertical layout, slightly constrained width

### 8.3 Small (<1200px)

- Map hidden in grid, accessible via FAB → fullscreen dialog (already implemented)
- In dialog: vertical layout fills available space
- Room panel slides up from bottom as a sheet

### 8.4 Mobile (<768px)

- Dialog is fullscreen (`width: 100vw; height: 100vh`)
- Touch-optimized: minimum 44px tap targets on nodes
- Pinch-to-zoom support (future enhancement, not in v1.0)

---

## 9. Accessibility

- All nodes are focusable (`tabindex="0"` for adjacent, `-1` for others)
- Arrow keys navigate between nodes (Up/Down = depth, Left/Right = branch)
- `Enter` on a node opens the room panel
- `Space` on the "Move Here" button activates navigation
- `Escape` closes the room panel
- Screen reader: each node has `aria-label` with room type, status, and index
- SVG has `role="img"` with `aria-label="Dungeon map"`
- Live region announces depth changes and room reveals

---

## 10. Migration Strategy

### 10.1 Incremental Approach

1. **Extract layout function** — move `layoutNodes()` to `dungeon-map-layout.ts`, flip to vertical
2. **Add icons to icons.ts** — extract game-icons.net SVG paths for 8 room types
3. **Increase node size** — update constants, add icon rendering
4. **Create DungeonMapNode sub-component** — extract from monolithic render
5. **Create DungeonMapEdge sub-component** — extract edge rendering
6. **Add room detail panel** — `DungeonRoomPanel.ts`
7. **Add microanimations** — layer in SVG filters, SMIL, new CSS keyframes
8. **Polish + test** — responsive testing, a11y audit, performance profiling

### 10.2 Backwards Compatibility

The map's external API (`<velg-dungeon-map persistent>`) and event contract (`terminal-command` CustomEvent) remain unchanged. The refactor is purely internal. No changes needed in `DungeonTerminalView.ts` or any parent component.

---

## 11. Testing

- **Unit:** `dungeon-map-layout.ts` — pure function, test all depth/branch configurations
- **Visual:** Verify node rendering for all 8 room types × all states (current, cleared, fog, adjacent, boss-adjacent)
- **Animation:** Manual verification of all 12 animation types + reduced-motion mode
- **Accessibility:** axe-core scan + manual keyboard navigation test
- **Performance:** Chrome DevTools Performance panel — verify no jank during reveal cascades on 15+ room dungeons

---

## 12. Open Questions

1. **Pinch-to-zoom** — defer to v1.1? Current sidebar width may not need it.
2. **Edge routing** — should edges curve (quadratic Bezier) or remain straight lines? Curves look better but add complexity.
3. **Minimap within map** — for deep dungeons (8+ depths), add a scroll position indicator?

---

## Appendix A: Animation Technology Matrix

| Technique | Approach | Rationale |
|-----------|----------|-----------|
| Node reveal (scale, opacity) | CSS keyframes | Compositor-thread, no JS |
| Path tracing (dashoffset) | CSS keyframes + `pathLength` | Paint-tier but unavoidable |
| Particle along path | CSS `offset-path` | 96.5% browser support, declarative |
| Fog/noise | SVG SMIL `<animate>` | `feTurbulence` attrs not CSS-animatable |
| Glow pulse | CSS keyframes | `drop-shadow()` for SVG elements |
| Ripple feedback | JS + CSS animation | Needs click coordinates |
| Shimmer | CSS keyframes on SVG circles | <30 elements = negligible |
| Shake/tremble | CSS keyframes (transform) | Compositor-only, variable intensity |
| Radar sweep | CSS `transform: rotate` + `conic-gradient` | Compositor-only |

## Appendix B: Icon Sources & Attribution

**Primary source:** [game-icons.net](https://game-icons.net/) — community-contributed RPG icons under CC BY 3.0.

**Fallback** for any missing icons: hand-drawn SVG paths matching the existing Tabler-style stroke aesthetic in `icons.ts`.

**Integration convention:** All icons added to the dedicated "Dungeon Icons" section in `frontend/src/utils/icons.ts` (starting at line ~837), using the `svg` tagged template literal pattern.
