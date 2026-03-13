# Feature Discovery — 3 Design Proposals

## Context

The 4 premium features (Classified Dossier, Recruitment Office, Darkroom Studio, Chronicle Export) are **already implemented** inside their respective tabs. But they're buried — a simulation owner has no way to discover them unless they scroll to the bottom of Lore, Agents, or Chronicle, or find the Darkroom button deep in Design Settings. There's zero cross-tab awareness.

**The problem:** These features are the core monetization + engagement loop of the Forge economy, yet they're invisible. A simulation owner who never visits the Agents tab will never know they can recruit 3 AI agents for 1 FT.

**Design goal:** Surface all 4 features with drama, urgency, and Bureau aesthetic — without feeling like a SaaS upsell banner. This is a game world. These should feel like unlockable classified services, not subscription tier cards.

**Constraints:**
- Bureau aesthetic (institutional authority, amber #f59e0b, monospace, classification stamps, scanlines)
- Only visible to `canEdit` users (simulation owners/editors)
- Must coexist with existing SimulationShell: breadcrumb → header → nav (10 tabs) → content
- SimulationHeader is currently info-only (name + status badge)
- No simulation overview/home tab exists — Lore is the default entry
- Existing badge pattern: `VelgBadge` (pop animation, semantic variants) + `instance-badge` (purple strip on game instances)
- WCAG AA, `msg()` i18n, design tokens throughout

---

## Proposal A: "The Requisition Ribbon"

### Concept — *Persistent Action Bar (Game Designer: Darkest Dungeon's Town Activities)*

A narrow, always-visible amber ribbon strip between `SimulationHeader` and `SimulationNav`. Four compact service tiles sit in a horizontal row — always visible, always one click away. Like the persistent town activity icons in Darkest Dungeon or the quick-action bar in XCOM's base view.

**The key insight:** In every great strategy game, available services are *always on screen*. You never have to navigate to a hidden menu to discover the blacksmith, the recruitment hall, or the archive. They're persistent affordances.

### Visual Design

```
┌──────────────────────────────────────────────────────────────────────┐
│  SIMULATION HEADER  ·  Velgarien  ·  [active]                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ▓ BUREAU SERVICES ▓                                                │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ 📋 DOSSIER  │ │ 👥 RECRUIT  │ │ 🔬 DARKROOM │ │ 📰 EXPORT   │   │
│  │    2 FT     │ │    1 FT     │ │    2 FT     │ │    1 FT     │   │
│  │  [LOCKED]   │ │ [AUTHORIZE] │ │  [ACTIVE]   │ │ [AUTHORIZE] │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Lore │ Agents │ Buildings │ Chronicle │ Health │ ...  (tabs)        │
└──────────────────────────────────────────────────────────────────────┘
```

### Tile States

Each tile has 4 visual states:
- **LOCKED** — Dimmed, dashed border, "LOCKED" label. Not enough tokens or not yet discovered.
- **AVAILABLE** — Full amber border, gentle glow pulse (2s cycle), "AUTHORIZE" label. Can purchase.
- **ACTIVE** — Solid amber fill, checkmark icon, "ACTIVE" label. Already purchased and usable.
- **COMPLETED** — Green accent, "COMPLETED" stamp. One-time features that are done (Dossier).

### Behavior

- Click a tile → navigates to the relevant tab AND scrolls to the feature component (via `scrollIntoView()`)
- If the feature requires purchase, the tile click opens the confirmation modal directly (no need to navigate first)
- Tiles show a small amber notification dot when a feature becomes affordable (balance changes)
- The entire ribbon collapses to a single "BUREAU SERVICES ▸" button on mobile (< 640px), expanding to a dropdown

### Animation Details

- Ribbon entrance: slides down 200ms with `ease-dramatic` when SimulationShell mounts
- Tiles stagger in left-to-right (50ms each), slight scale-up from 0.95
- Available tiles have a subtle amber box-shadow pulse: `0 0 0px → 0 0 8px rgba(245,158,11,0.3)` on 2s cycle
- Active tiles have a static amber left-border accent (4px) — same pattern as LoreScroll's classified sections
- On hover: tile lifts 2px, border brightens, monospace label gets +0.02em letter-spacing
- Scanline overlay on the entire ribbon at 0.02 opacity

### Architecture

```
SimulationShell.ts (MODIFY)
  └─ renders <velg-bureau-ribbon> between header and nav

VelgBureauRibbon.ts (CREATE)
  ├─ Properties: simulationId, canEdit
  ├─ Loads feature purchase status on mount via forgeStateManager
  ├─ 4 tile renders with state-based styling
  ├─ Click dispatches 'bureau-service-navigate' event with {tab, featureType}
  └─ Mobile: collapses to dropdown

SimulationShell.ts
  └─ Listens for 'bureau-service-navigate' → navigates to tab + scrolls
```

### Tradeoffs

**Pros:** Maximum discoverability — always visible, zero navigation cost, game-like persistent action bar, compact vertical footprint (~56px), works as both discovery AND status dashboard for purchased features.

**Cons:** Adds a permanent UI element consuming vertical space (~56px). Could feel cluttered on simulations where user has no tokens. Must handle the 10-tab nav already being tight on mobile.

---

## Proposal B: "The Classified Dispatch"

### Concept — *First-Visit Briefing + Tab Badges (Game Designer: Persona 5's Velvet Room Reveal)*

Two-pronged approach: a dramatic one-time **Bureau dispatch document** that introduces all services on first visit, plus persistent **amber notification dots on tabs** that have available features. Like how Persona 5 introduces new Velvet Room services with Igor's theatrical dialogue, then marks the menu with a star.

**The key insight:** The most memorable feature discovery moments in games are *scripted reveals*. The first time you enter the Velvet Room and Igor explains fusion. The first time the Darkest Dungeon stagecoach arrives. A one-time dramatic interruption creates a memory anchor, and then subtle persistent indicators maintain awareness.

### Visual Design — The Dispatch (Full-Screen Modal)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│         ╔══════════════════════════════════════════╗              │
│         ║     BUREAU OF IMPOSSIBLE GEOGRAPHY      ║              │
│         ║     ─────────────────────────────        ║              │
│         ║     CLASSIFIED SERVICES DISPATCH         ║              │
│         ║     DIRECTIVE 77-F // SIMULATION OPS     ║              │
│         ╚══════════════════════════════════════════╝              │
│                                                                  │
│  TO: [owner email]                                               │
│  RE: Authorized Services for Shard "[simulation name]"           │
│  CLASSIFICATION: AMBER // BUREAU EYES ONLY                       │
│                                                                  │
│  ───────────────────────────────────────────────────             │
│                                                                  │
│  The Bureau has authorized the following services for            │
│  your Shard. Each requires Forge Token authorization.            │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐            │
│  │  § 1. CLASSIFIED DOSSIER          LORE TAB       │            │
│  │  Six classified intelligence sections. 10,000     │            │
│  │  words of deep pre-arrival history.               │            │
│  │  Authorization: 2 FT          [GO TO LORE →]     │            │
│  ├──────────────────────────────────────────────────┤            │
│  │  § 2. RECRUITMENT OFFICE          AGENTS TAB     │            │
│  │  Deploy 3 new agents with optional focus          │            │
│  │  directive and zone assignment.                   │            │
│  │  Authorization: 1 FT          [GO TO AGENTS →]   │            │
│  ├──────────────────────────────────────────────────┤            │
│  │  § 3. THE DARKROOM                SETTINGS TAB   │            │
│  │  Theme variants, image regeneration (10 uses),    │            │
│  │  card frame customization.                        │            │
│  │  Authorization: 2 FT          [GO TO DESIGN →]   │            │
│  ├──────────────────────────────────────────────────┤            │
│  │  § 4. PRINTING PRESS              CHRONICLE TAB  │            │
│  │  Codex PDF export, hi-res archive, public         │            │
│  │  prospectus generation.                           │            │
│  │  Authorization: 1 FT          [GO TO CHRONICLE →]│            │
│  └──────────────────────────────────────────────────┘            │
│                                                                  │
│  TOTAL AUTHORIZED BUDGET: 6 FT                                   │
│  YOUR BALANCE: [X] FT                                            │
│                                                                  │
│              [ DISPATCH ACKNOWLEDGED ]                            │
│                                                                  │
│  This dispatch will not be shown again.                          │
│  Access via ⬡ icon in simulation header.                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Design — Tab Badges

```
   Lore⬡  │  Agents⬡  │  Buildings  │  Chronicle⬡  │  Health  │ ...
```

Small amber dots (6px diameter) positioned top-right of the tab icon/label on tabs that have available (unpurchased) features. Dots pulse gently. Once a feature is purchased, the dot disappears from that tab.

### Visual Design — Header Re-access Icon

A small ⬡ (hexagon) icon button added to `SimulationHeader`, next to the status badge. Clicking it re-opens the dispatch. Only visible for canEdit users. Styled as a small monospace amber badge.

### Behavior

1. **First visit as owner:** When a canEdit user enters a simulation for the first time (tracked via `localStorage` key `bureau_dispatch_seen_{simId}`), the full-screen dispatch modal appears with a dramatic entrance animation.
2. **"GO TO [TAB]" links:** Each service row has a link that dismisses the dispatch AND navigates to the relevant tab.
3. **"DISPATCH ACKNOWLEDGED":** Dismisses, sets localStorage flag, never auto-shows again.
4. **Tab badges:** Amber dots appear on Lore, Agents, Settings, and Chronicle tabs for all unpurchased features. Dots are reactive — they disappear in real-time when a purchase completes.
5. **Header ⬡ button:** Allows re-opening the dispatch at any time. Shows a subtle pulse if any services remain unpurchased.

### Animation Details

- Dispatch entrance: black backdrop fades in 300ms → document slides up from below with paper-unfold feel (transform: translateY(40px) + scaleY(0.98) → identity, 500ms ease-dramatic)
- Each service row staggers in: 100ms delay between rows, slide-right from left
- Classification stamp in header: typewriter animation (characters appear 15ms apart)
- Tab badges: fade-in with scale bounce (0 → 1.3 → 1, 400ms spring easing), then gentle pulse (opacity 0.6 ↔ 1.0 on 2s cycle)
- Header ⬡: pop-in with badge-pop animation (existing pattern), amber glow on hover
- Dismissed dispatch: slides down + fades out 300ms

### Architecture

```
SimulationShell.ts (MODIFY)
  ├─ renders <velg-bureau-dispatch> (modal, shown once)
  └─ passes canEdit, simulationId

SimulationNav.ts (MODIFY)
  └─ Add badge dot rendering per tab (driven by featurePurchases signal)

SimulationHeader.ts (MODIFY)
  └─ Add ⬡ re-access button (dispatches 'open-bureau-dispatch' event)

VelgBureauDispatch.ts (CREATE)
  ├─ Full-screen modal with classified document styling
  ├─ Service rows with "GO TO" navigation links
  ├─ localStorage tracking for first-visit
  ├─ Properties: simulationId, canEdit, walletBalance
  └─ Events: 'dispatch-navigate' with {tab}
```

### Tradeoffs

**Pros:** Maximum dramatic impact on first discovery — unforgettable "you just got a classified briefing" moment. Tab badges provide persistent subtle reminders without consuming layout space. The dispatch serves as both discovery AND reference document. Re-accessible via header icon.

**Cons:** One-time modal can feel interruptive (though Bureau aesthetic frames it as "you've been cleared for these services" rather than "buy stuff"). Tab badges alone (after first visit) might be too subtle. Requires localStorage management.

---

## Proposal C: "The Bureau Services Wing"

### Concept — *Dedicated Overview Tab (Game Designer: Firelink Shrine / Hades House of Hades)*

Add a new **"Bureau"** tab to SimulationNav — a dedicated full-page services view where all 4 features are showcased as classified authorization forms in a dramatic 2×2 grid. This is the RPG "hub" pattern: every game has a central place where you access all available services (Firelink Shrine's blacksmith/pyromancer/merchant, Hades' contractor/broker/lounge).

**The key insight:** Premium features deserve their own real estate. Burying them inside other tabs communicates "afterthought." A dedicated tab communicates "this is a core part of the experience." Every successful RPG has a dedicated services hub because players need a mental anchor for "where do I go to upgrade?"

### Visual Design

```
┌──────────────────────────────────────────────────────────────────┐
│  Lore │ Agents │ Buildings │ Chronicle │ ... │ ⬡ Bureau         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│       ╔══════════════════════════════════════════╗                │
│       ║  BUREAU OF IMPOSSIBLE GEOGRAPHY          ║                │
│       ║  AUTHORIZED SERVICES REGISTRY             ║                │
│       ╚══════════════════════════════════════════╝                │
│                                                                  │
│       YOUR BALANCE: ⬡ [X] FORGE TOKENS    [OPEN MINT]           │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│  │  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │ │
│  │  │ [CLASSIFIED] LEVEL 4  │  │ │  │ RECRUITMENT FORM 22-B │  │ │
│  │  └───────────────────────┘  │ │  └───────────────────────┘  │ │
│  │                             │ │                             │ │
│  │  CLASSIFIED DOSSIER         │ │  RECRUITMENT OFFICE         │ │
│  │  ──────────────────         │ │  ──────────────────         │ │
│  │                             │ │                             │ │
│  │  Six classified lore        │ │  Deploy 3 new agents with   │ │
│  │  sections. Pre-arrival      │ │  optional focus directive.   │ │
│  │  history, Bureau analysis.  │ │  Zone assignment available.  │ │
│  │                             │ │                             │ │
│  │  DESTINATION: Lore Tab      │ │  DESTINATION: Agents Tab    │ │
│  │  COST: 2 FT                 │ │  COST: 1 FT                 │ │
│  │  STATUS: ● AVAILABLE        │ │  STATUS: ● AVAILABLE        │ │
│  │                             │ │                             │ │
│  │  [ AUTHORIZE & PROCEED → ]  │ │  [ AUTHORIZE & PROCEED → ]  │ │
│  └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│  │  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │ │
│  │  │ DARKROOM PASS // D-7  │  │ │  │ PRINTING PRESS AUTH   │  │ │
│  │  └───────────────────────┘  │ │  └───────────────────────┘  │ │
│  │                             │ │                             │ │
│  │  THE DARKROOM               │ │  CHRONICLE PRINTING PRESS   │ │
│  │  ──────────────────         │ │  ──────────────────         │ │
│  │                             │ │                             │ │
│  │  Theme variants, image      │ │  Codex PDF, hi-res archive, │ │
│  │  regeneration, card frame   │ │  public prospectus with     │ │
│  │  customization.             │ │  Open Graph metadata.       │ │
│  │                             │ │                             │ │
│  │  DESTINATION: Settings Tab  │ │  DESTINATION: Chronicle Tab │ │
│  │  COST: 2 FT                 │ │  COST: 1 FT                 │ │
│  │  STATUS: ✓ ACTIVE (7/10)   │ │  STATUS: ● AVAILABLE        │ │
│  │                             │ │                             │ │
│  │  [ ENTER DARKROOM → ]      │ │  [ AUTHORIZE & PROCEED → ]  │ │
│  └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                  │
│  ────────────────────────────────────────────────                │
│  PURCHASE HISTORY                                                │
│  • Darkroom Pass — 2026-03-12 — ACTIVE (7/10 regens)            │
│  ────────────────────────────────────────────────                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Tab Appearance in SimulationNav

The Bureau tab is special — visually distinct from the other 10 tabs:
- Uses amber color instead of the theme primary color
- Has a ⬡ (hexagon) icon instead of a standard icon
- Gets a subtle amber underline by default (not just on active)
- When any feature is unpurchased: small amber dot badge pulses on the tab
- Positioned as the **last tab** (after Settings, which is already admin-only), or as a **special right-aligned tab** separated by a spacer

### Card States

Each service card has 3 states:
- **AVAILABLE** — Full card, amber border accent, "AUTHORIZE & PROCEED" CTA button, pulsing status dot
- **ACTIVE** — Green status indicator, remaining budget shown (e.g., "7/10 REGENS"), "ENTER [SERVICE]" button navigates directly to the feature
- **COMPLETED** — Green "COMPLETED" stamp overlaid, download links if applicable, dimmed CTA

### Behavior

- "AUTHORIZE & PROCEED" → opens the purchase confirmation modal (reuses existing BaseModal pattern), then on success navigates to the relevant tab
- "ENTER DARKROOM" → opens the darkroom overlay directly
- "OPEN MINT" → opens the Mint overlay for token purchase
- Cards show real-time status from `forgeStateManager.featurePurchases`
- Purchase history section at bottom shows all past feature purchases for this simulation

### Animation Details

- Tab entrance: ⬡ icon has a special hexagonal rotation entrance (rotateZ 360° over 600ms, then settles into the standard float animation)
- Page load: header slides down, then 4 cards stagger in from corners (top-left, top-right, bottom-left, bottom-right) converging to grid positions, 150ms stagger
- Each card has a very subtle parallax tilt on mouse move (±3° via transform perspective)
- Classification stamps at top of each card: typewriter animation on first paint
- Status dots: green = steady, amber = pulse (1.5s cycle), red = flash for failed
- "AUTHORIZE" button: amber glow intensifies on hover, subtle upward float
- Scanline overlay on entire page at 0.015 opacity

### Architecture

```
SimulationNav.ts (MODIFY)
  └─ Add Bureau tab with ⬡ icon, amber styling, badge dot

SimulationShell.ts (MODIFY)
  └─ Add route handler for 'bureau' tab path

app-shell.ts (MODIFY)
  └─ Add route: /simulations/:id/bureau → renders <velg-bureau-services>

VelgBureauServices.ts (CREATE)
  ├─ Full-page view with 2×2 service card grid
  ├─ Service cards with state-based rendering (available/active/completed)
  ├─ Wallet balance display + Mint link
  ├─ Purchase history section
  ├─ Properties: simulationId
  ├─ Loads all feature purchase statuses on mount
  └─ "AUTHORIZE & PROCEED" → modal → navigate to tab on success
```

### Tradeoffs

**Pros:** Maximum real estate for showcasing features — each gets a full card with description, status, and CTA. Clear mental model ("go to Bureau tab for services"). The page itself becomes a status dashboard showing what's active, what's available, and purchase history. Dedicated space means features never compete with tab content. Scales well if more features are added later.

**Cons:** Adds an 11th tab to an already-full nav bar (10 tabs). One more click to reach the actual feature (Bureau tab → click card → navigate to target tab). Might feel disconnected — "why am I in a separate tab instead of just seeing the feature where it lives?" Could be overkill for only 4 features.

---

## Comparison Matrix

| Dimension | A: Requisition Ribbon | B: Classified Dispatch | C: Bureau Services Wing |
|-----------|----------------------|----------------------|------------------------|
| **Discovery** | Always visible | Dramatic first-visit reveal | Dedicated tab with badge |
| **Vertical space** | ~56px permanent | 0px (modal + 6px dots) | 0px (own tab) |
| **Drama** | Medium — compact tiles | Very high — classified memo | High — full page showcase |
| **Click depth** | 1 click (tile → feature) | 1 click (badge/GO TO → feature) | 2 clicks (tab → card → feature) |
| **Mobile** | Collapses to dropdown | Badges on mobile menu items | Extra mobile menu item |
| **Ongoing awareness** | Always visible | Tab dots pulse | Tab dot + full status page |
| **Files to create** | 1 (VelgBureauRibbon) | 1 (VelgBureauDispatch) | 1 (VelgBureauServices) |
| **Files to modify** | 1 (SimulationShell) | 3 (Shell, Nav, Header) | 3 (Nav, Shell, app-shell) |
| **Scalability** | Limited (ribbon gets wide) | Good (dispatch grows, dots scale) | Excellent (grid grows) |
| **RPG parallel** | XCOM base action bar | Persona 5 Velvet Room intro | Firelink Shrine services hub |

---

## Recommendation

**Proposal B + elements of A** is the strongest combination:
- The one-time **Classified Dispatch** creates an unforgettable first-discovery moment
- **Tab badges** provide persistent, zero-cost reminders
- **Header ⬡ button** allows re-access without consuming layout space
- Optionally add Proposal A's **ribbon** as a compact alternative to the full dispatch for ongoing status (but this may be overkill)

However, this is a design decision that depends on how much vertical real estate you want to dedicate and whether the 11th-tab overhead of Proposal C is acceptable for the mental model clarity it provides.

---

## Verification (whichever proposal is chosen)

1. **TypeScript:** `cd frontend && npx tsc --noEmit` passes
2. **Discovery:** New canEdit user enters simulation → feature surfaces are visible/triggered
3. **Navigation:** Clicking feature CTA correctly navigates to the right tab + scrolls to feature
4. **Purchase flow:** Feature CTA → confirmation → processing → completion → UI updates
5. **Mobile:** All surfaces work on < 640px (dropdown/menu adaptation)
6. **Accessibility:** WCAG AA contrast, keyboard navigation, screen reader labels, focus indicators
7. **i18n:** All new strings translated to German
8. **State:** Purchased features show "ACTIVE"/"COMPLETED" instead of purchase CTAs
