# Handoff: Metaverse.Center Dashboard (Variant 4a — "Command Stage")

## Overview
The logged-in operative dashboard ("Operative Terminal") for metaverse.center. Priorities in order: (1) the next epoch deadline and what the player must do before it, (2) their own worlds, (3) the community registry, (4) identity/status (agent dossiers, substrate, commendations). Pattern: cinematic "continue"-stage on top (launcher-style), action queue, then content rows plus a right rail.

## About the Design Files
These files are **design references created in HTML** — a prototype showing intended look and behavior, not production code. Recreate the design in the existing `velgarien-rebuild/frontend` codebase (Lit 3 + Preact Signals + TypeScript) using its established patterns:
- Colors only via tokens from `src/styles/tokens/` (`var(--color-*)`) — hex values in this README identify tokens, never hardcode them.
- Headings: `var(--font-brutalist)` (Courier), uppercase, `var(--tracking-brutalist)`.
- Every user string through `msg('…')` (DE/EN mixed copy is intentional); no em-dashes in msg() strings.
- Icons only from `src/utils/icons.ts`. WCAG AA.

Reference file: `Dashboard Redesign.dc.html`. **In scope: section `id="4a"` (primary) and section `id="3a"` (the "Alle Simulationen" index screen it links to). Section `id="5a"` is the wide-screen sample of 4a, not a separate screen. Ignore 1a/2a/2b (earlier explorations).** All styles are inline in the markup; anything this README doesn't answer is in the file.

## Fidelity
**High-fidelity** at the 1440px desktop reference. Wide-screen behavior specified below (with 5a as visual proof); mobile is an open point.

## Screen: 4a Command Stage (top to bottom)
Frame: `#060606` page, text `#e5e5e5`, borders `#222`/`#333`, 40px horizontal padding in sections. Radius 0 everywhere except TCG cards (~6px, per TCG spec). Offset shadows only (`4px 4px 0 #000` etc.). **No colored left-border accent stripes anywhere — status is communicated by dots + text color.**

### 1. Command strip (44px)
`// Operative Terminal // k.mercer | Shards: 3 | Active Ops: 2 | Substrate: {Anomalous|Stable}` left; timestamp right. 10px mono, tracking 2px, `#888`; values `#e5e5e5`, substrate value red `#ef4444` when anomalous / green `#4ade80` when stable. Below it, when anomalous: a red alert line (blinking 6px dot, `rgba(239,68,68,.07)` bg).

### 2. Priority stage (cinematic)
- Full-bleed war-room artwork (`uploads/Gemini_Generated_Image_v68o98v68o98v68o.jpeg`), cover at `center 42%`, `brightness(.75)`, slow Ken-Burns (scale 1→1.07, 32s, alternate).
- Scrims: 94deg gradient (dark left `.96` → `.2` right), vertical top/bottom fades, CRT scanlines (3px/6px repeating, `.12` alpha).
- Content (padding `56px 40px 48px`), staggered rise-in (fade + translateY 22px, delays 0/.1s/.25s):
  - Kicker: 22px amber rule + `PRIORITY // CYCLE 7 RESOLVES IN` (Courier 700 10px tracking 4px amber).
  - Live countdown `HH:MM:SS` — Courier 700 **60px**, tabular-nums, ticking every second.
  - Bottom row: left — epoch name (Courier 700 24px uppercase) + status line 11px (`The Chitinous Mandate · Active · RP 3/5 · Orders placed 1/3`; keep `RP 3/5` and `Orders placed 1/3` nowrap) + cycle segment bar (12 segments 22×8px: done amber, current amber-outline **pulsing** (2.4s), todo `#1a1a1a`); right — CTA **Enter War Room →** (amber button) + text link "Review standing orders →".

### 3. "Requires You" queue
Kicker `REQUIRES YOU // sorted by deadline`. 3 equal cells (grid 3×1fr, gap 14): each `#0a0a0a`, border `#222`, hover `#0d0d0d`. Cell anatomy: title (Courier 700 12.5px) | status chip right (colored dot + label — amber "Window open" (blinking), blue "Scoring", green "Active"); context line 10px `#888`; footer: metric left, arrow-CTA right (arrow slides 5px on hover). Cell 1 is the epoch order task ("2 of 3 orders unplaced → Order"), cells 2–3 come from active operations (Ergebnis/Fortsetzen).

### 4. Meine Welten — switcher (landing-page pattern)
Grid `1fr 620px`, gap 48, `align-items:stretch`, bottom border.
- **Left list**: header "Simulation Roster / Meine Welten 3". Rows (flex:1 each so the column fills the preview height; grid `52px 1fr auto`, padding 27px, top border `#222`): index `01–03`, title row (name Courier 700 24px + theme tag in world tint) — **on hover the whole title row shifts 10px right and turns amber** (never just the name; it would collide with the tag), serif desc below; right column: status dot+label, `role · stats`. Hovering a row switches the preview (`wSel`). Last row: "+ Fracture a New Shard" with serif sub "One sentence in. A civilization out."
- **Right preview** (padding-top 52px to align with first row): 16:9 panel (620×349), border `#333`, shadow `6px 6px 0 #000`, world art (crossfade .45s on switch) + scanlines + bottom gradient; bottom-left tag `OWNER // INSECTILE // ACTIVE · CYCLE 7` (amber 9.5px) + world name (Courier 700 24px); bottom-right counter `01 / 03`. Below (flex:1, `#0a0a0a`, border `#222`, padding 24px 28px, space-between): lore paragraph (Spectral 15px lh 1.75 `#a0a0a0`, 2–3 sentences), then top-rule (`1px #222`, **no left accent bar**) quote block: quote (Spectral italic 14px `#e5e5e5`), bottom row `align-items:flex-end; min-height:26px` with attribution (mono 9px uppercase `#888`) left and **Enter world →** right (must not jump when the attribution wraps). Full lore/quote copy per world is in the logic class (`MY` array).

### 5. Community + right rail
Grid `1fr 356px`, gap 28.
- **Community** (left): header "Shard Registry / Community 44" + link "Alle 44 Welten →" (→ index screen 3a). 2×3 card grid (gap 14): image card 172px high (art `.72` opacity, zooms 1.06 on hover), REC badge + coordinate top-left (blinking red), theme tag top-right, name + `NN AG · NN BLDG` (nowrap) on the bottom gradient. Below: full-width bar `+38 weitere Welten im Register | Index öffnen →`.
- **Right rail**:
  1. **Dossier carousel** — kicker `DOSSIER // OPERATIVES` aligned with "Shard Registry", second line: counter `01 / 03` (aligned with "Community") + ←/→ buttons (30px, amber on hover). One TCG agent card (300×420, per `docs/explanations/tcg-card-system.md`): mouse-tilt + glare, deal-in on every switch, wrap-around in both directions. Legendary (Ilsabet Voss): amber tint, foil ring, legendary-pulse. Rares (Corvin Fenn, Marta Wolf): tint = best-type operative color (SPY `#64748b`, GRD `#10b981`, SAB `#ef4444`, PRP `#f59e0b`, INF `#a78bfa`, ASN `#dc2626`), no foil ring. Pips: ≤5 dimmed 38%, ≥8 glow.
  2. **Substrate Monitor**: 3 resonance rows (dot, name, mini-bar, age). Bars **grow in** (0.9s ease-out, staggered 150ms).
  3. **Commendations**: 12/48 + 25% amber progress + last unlock.
- **Footer ticker**: lore sentence marquee (40s), full-bleed.

## Screen: 3a Simulation Index
Registry screen the community links point to: header + "Fracture" CTA, live search input, theme filter chips + sort chips (amber active state), 4-col card grid of all 44 worlds, empty state ("Keine Welt gefunden"). Behavior: search filters by name (case-insensitive), theme chips filter, sorts: Zuletzt aktiv / Meiste Agenten / A–Z. See section `id="3a"` in the reference file.

## Interactions & State (summary)
- `countdown` — 1s interval to a target timestamp.
- `wSel: 0–2` — world switcher (hover), drives preview art/tag/name/lore/quote with .45s crossfade.
- `spotSel: int` — agent carousel, modulo wrap both directions; deal-in animation on change.
- Index screen: `q`, `theme`, `sort`, plus infinite-scroll state for the 2b carousel (ignore).
- Tweak prop: `substrate: anomalous|stable` toggles alert line + strip value.
- Hover inventory: queue cells bg-shift + arrow slide; world rows bg + title-row shift; community cards lift + image zoom; card tilt/holo; buttons amber hover. No scroll-triggered animation — the terminal stays calm.

## Wide-Screen & 4K (≥1920) — see section `id="5a"` for the built 2560px sample
Dashboard rule: **centered content container, full-bleed chrome** (unlike the landing, which scales fluidly — the dashboard is an instrument, not a poster).
- Full-bleed at every width: command strip, alert line, stage artwork + scrims, footer ticker.
- All section content in a centered container: `max-width:1920px`, side padding 40px → 64px at ≥1920.
- Type scales ~×1.15 at ≥2560 (countdown 60→69px, epoch name 24→28px, H2s 24→27px, body +1–1.5px). Never more — density is the point.
- Grids: worlds preview column 620→760px; community 2×3 → 3×2 (`repeat(3,1fr)`, cards 190px); rail 356→380px; queue stays 3 columns.
- ≥3840: container stays 1920, type stays at the 2560 values; the stage artwork simply shows more world.
- Mobile/tablet: not designed (open point). Suggested stacking order: strip → stage (countdown+CTA) → queue → my worlds (list only, preview collapses) → community → rail sections.

## Design Tokens
Same palette as the landing handoff: surfaces `#060606`/`#0a0a0a`/`#0d0d0d` hover; borders `#333`/`#222`/`#1a1a1a`; text `#e5e5e5`/`#a0a0a0`/`#888`/`#666`/`#555`; amber `#f59e0b` (border `#b45309`, hover `#fbbf24`); status green `#4ade80`, blue `#3b82f6`, red `#ef4444`; operative colors above. Courier 700 uppercase headings / Spectral serif (italic = narrative/lore) / SF Mono micro-labels. Offset-only shadows, radius 0 (TCG cards 6px).

## Assets
- `uploads/Gemini_Generated_Image_v68o98v68o98v68o.jpeg` — stage artwork (war room), final.
- `assets/e-*.png`, `assets/b-*.png`, `assets/deluge-art-1200.png` — **placeholder** world art (crops; themes don't always match, e.g. the insect world currently shows ocean art). Replace with real per-world artwork from the backend.
- `assets/portrait-0/1/2.png` — placeholder agent portraits; replace with backend portraits.

## Files
- `Dashboard Redesign.dc.html` — reference prototype (sections 4a, 3a in scope; 5a = wide-screen sample). Logic class at the bottom holds all data arrays (`MY` worlds incl. lore/quotes, `AGENTS4`, ops, resonance feed, 44-world pool generator, countdown).
- `support.js`, `_ds/…` — runtime + tokens so the prototype opens directly in a browser.
