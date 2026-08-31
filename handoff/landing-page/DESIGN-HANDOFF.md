# Handoff: Metaverse.Center Landing Page (Variant 3a — "Editorial Brutalist")

## Overview
Public landing page for metaverse.center — the multi-simulation platform ("Bureau of Impossible Geography"). Goal: communicate the six core systems (World Forge, Epochs, Resonance Dungeons, Drift, Substrate, Bureau Terminal), show living example worlds and agent dossier cards, and drive one primary action: **Forge a World**. Includes an SEO footer with crawlable link columns.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate this design in the existing `velgarien-rebuild/frontend` codebase** (Lit 3 + Preact Signals + TypeScript) using its established patterns:

- All colors via design tokens from `src/styles/tokens/` (`var(--color-*)`) — **never raw hex/rgba in components** (the hex values in this README identify which token to use, they are not to be hardcoded).
- Headings: `var(--font-brutalist)` (Courier), uppercase, `var(--tracking-brutalist)`.
- Every user-facing string through `msg('…')` (DE/EN). No em-dashes in msg() strings (use en-dash).
- Icons only from `src/utils/icons.ts`.
- WCAG AA.

The reference implementation is `Landing Redesign.dc.html` in this folder. **Only the section with the `id="3a"` badge is in scope** — the file also contains older exploration variants (1a/1b/2a/2b and 3b) below it; ignore them. In the 3a markup all styles are inline, so any question this README doesn't answer can be resolved by reading that section's markup directly.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final and match the platform's token system. Recreate pixel-perfectly (desktop 1440px reference width; responsive behavior is NOT designed yet — see Open Points).

## Page Structure (top to bottom)

Page background `#0a0a0a` (--color-surface), text `#e5e5e5` (--color-text-primary), 48px horizontal page padding, borders `#222`/`#333`.

### 1. Nav bar
- Flex row, space-between, `18px 48px` padding, bottom border `#222`.
- Left: wordmark `Metaverse.Center` — Courier 700, 15px, uppercase, tracking .12em; `.Center` in amber `#f59e0b`.
- Center: 3 links (Worlds, Systems, Chronicle) — 11px, tracking 2px, uppercase, `#888`; hover → amber.
- Right: primary button **Forge a World** — amber bg, `#0a0a0a` text, Courier 700 11px tracking 2px uppercase, border `#b45309`, offset shadow `3px 3px 0 #000`, padding `10px 22px`. No border radius (radius 0 everywhere on this page). Hover: translate(-1px,-1px), shadow grows to 4px 4px.

### 2. Hero (full-bleed artwork + display typography)
- Background image `assets/hero-bureau.jpeg`, cover, position `center 62%`, `brightness(.72) saturate(.95)`.
- Slow Ken-Burns zoom: `scale(1) → scale(1.08)`, 34s ease-in-out, infinite alternate.
- Overlays (stacked): linear-gradient 96deg from `rgba(10,10,10,.97)` 24% → `.7` 55% → `.22` 100%; vertical gradient top `.7` → transparent 32%/58% → bottom `.5`; CRT scanlines `repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.13) 3px 6px)`.
- Content padding `130px 48px 88px`:
  - Kicker: green pulsing dot (7px, `#4ade80`, glow, 2.2s opacity pulse) + `SIGNAL LOCKED // {n} WORLDS TRANSMITTING` — Courier 700 11px tracking 4px uppercase amber.
  - H1 `LIVING` / `WORLDS.` (amber period) — Courier 700, **158px**, line-height .94, uppercase, text-shadow `0 6px 50px rgba(0,0,0,.7)`. Both lines staggered entrance: fade + translateY(26px→0), .8s ease, delays .08s/.22s (kicker .7s/0s, bottom row .4s).
  - Bottom row (flex, space-between, align-end, margin-top 48px): left — serif subline (Spectral italic 500, 27px, line-height 1.5, `#a0a0a0`, max-width 600px): "Forged from a single sentence. Playing while you sleep. Populated by citizens who remember what you did." Right — CTA **Build Your World →** (amber button, 18px 40px padding, 13px) + text link "Or just watch one →" (Courier 700 11px, `#888`, arrow slides right on hover).
- Marquee ticker directly under hero content (inside hero block, top border `#222`, bg `rgba(6,6,6,.94)`, 13px vertical padding): items 11px tracking 3px uppercase `#888`, separated by amber `✦`, numbers in green 700. Content: `{n} living worlds · 3 epochs in play · 128 resonances absorbed · Velgarien · Saltmeridian · The Chitinous Mandate · The Gilded Hollow` (duplicated for seamless loop). Animation: translateX 0 → −50%, 30s linear infinite.

### 3. The Six Systems (index list + live preview panel)
Grid `1fr 640px`, gap 56px, `align-items:stretch`, padding `110px 48px`.

**Left — index list.** Section kicker "THE SIX SYSTEMS" (amber, 24px rule + label). Six rows, each: grid `72px 1fr auto`, padding `26px 10px`, top border `#222` (last also bottom border):
- Index number `01…06` — 13px `#666`.
- Title — Courier 700 32px uppercase tracking .08em `#e5e5e5` + hidden arrow `→`.
- One-line description — Spectral 15px `#888`, margin-top 8px.
- Right tag — 10px tracking 2px `#555`: `SIM-CONSTRUCT / EPOCH-OPS / DEPTH-SIGNAL / ZWISCHENRAUM / SUB-MONITOR / TTY-ACCESS`.
- Hover (row): bg `#0f0f0f`; title → amber + translateX(12px); arrow fades in and slides to 0 (from −8px); all .22s. Hovering a row switches the preview panel (state `sys = 0…5`).

Row copy (title / description):
1. Forge a World / "One sentence becomes a civilization — geography, citizens, lore. Minutes, not months."
2. Compete in Seasons / "Timed epochs where civilizations clash: deploy operatives, forge alliances, betray on time."
3. Send Agents Below / "Eight literary descents where stress is real. Agents return changed — or not at all."
4. Travel the In-Between / "The node-sea between worlds is playable. Dock at a foreign broadcast edge, haul home cargo."
5. Reality Bleeds In / "Real events echo through every simulation as resonances. The boundary is thinner than you think."
6. Play It as Text / "A command-line window into your world. Local perspective, narrative prose, no mercy."

**Right — preview column** (flex column, padding-top 52px to align with first row):
- **16:9 image panel** (640×360): active system's artwork (see Assets), border `#333`, offset shadow `6px 6px 0 #000`. Art swap animated (crossfade/slide ~.45s ease). Bottom gradient `transparent 55% → rgba(6,6,6,.94)`. Bottom-left: tag (10px tracking 3px amber, e.g. `SYSTEM 03 // RESONANCE DUNGEONS`) + name (Courier 700 26px uppercase). Bottom-right: counter `01 / 06` (Courier 700 13px `#888`).
- **Thumbnail strip** (margin-top 18px): 6 thumbs, flex 1, 16:9, gap 10px; active: amber 1px border, full brightness; inactive: border `#2a2a2a`, `brightness(.4) saturate(.5)`; hover switches preview; transition .3s.
- **Lore box** (margin-top 26px, `flex:1`, border `#222`, bg `#060606`, padding `30px 32px`, flex column, `justify-content:space-between`, gap 20px):
  - Description — Spectral 16.5px line-height 1.8 `#a0a0a0`, 3–4 sentences per system (full copy in `renderVals()` of the reference file, `DESCS` array).
  - Quote block, separated by a **top rule** `1px #222`, padding-top 20px (NO left accent bar): quote — Spectral italic 15.5px `#e5e5e5`; below it a bottom-aligned row (`align-items:flex-end`, min-height 30px): attribution — SF Mono 9.5px tracking .14em uppercase `#888` (e.g. "— Complaint lodged by the Chitinous Mandate, unanswered") | link **Enter the system →** (Courier 700 11px, nowrap, must not jump when attribution wraps to 2 lines).

### 4. Already Running (worlds grid)
Padding `96px 48px`, bg `#060606`, top+bottom border `#222`.
- Header row: H2 `ALREADY RUNNING.` (Courier 700 44px uppercase, amber period) | link "All {n} worlds →".
- 4-column grid, gap 28px. Card: image 4:3 (border `#222`, image at `opacity:.72 saturate(.8)`, bottom gradient, coord + agent count bottom-left in 9px `#888`), below: world name (Courier 700 15px uppercase) + 1–2 line serif description 13.5px `#888`.
- Hover: image zooms `scale(1.06)` + brightens, .5s ease (class `hv-lift`/`monitor-img` in reference).
- Data comes from the platform (world name, coordinates, agent count, blurb) — wire to the worlds API.

### 5. They Remember (agent dossier cards)
Padding `110px 48px`. Grid `380px 1fr`, gap 64px, center-aligned.
- Left: kicker "THE CITIZENS", H2 `THEY REMEMBER.` (40px), serif paragraph, link "Meet more characters →".
- Right: **3 fanned TCG agent cards** (rotations ≈ −7°/0°/+7°, slight overlap, hover: lift + tilt-on-mousemove with glare). Cards follow the platform TCG spec exactly — implement with the existing card components / `docs/explanations/tcg-card-system.md` (5:7 ratio, left gem = aptitude sum, right gem = best-skill value in type color, pips row, centered nameplate `✦ Name ✦`, rarity footer). Card radius ~6px is the ONE exception to the no-radius rule (per TCG spec). Content: pull 3 real agents from the reference world.

### 6. Footer CTA ("Transmission Open / Forge Yours.")
Top border `#222`, padding `110px 48px 96px`, flex space-between, **align-items:flex-start** (kicker top-aligns with the prompt box).
- Left: kicker `TRANSMISSION OPEN` (amber) + H2 `FORGE` / `YOURS.` — Courier 700 **96px**, line-height .96, amber period.
- Right column (flex 1, max-width 720px):
  - **Live typing prompt box**: border `#333`, bg `#060606`, shadow `6px 6px 0 #000`, padding `24px 28px`; amber `>` prefix (SF Mono 17px); typed text — Spectral italic 17px line-height 1.55 `#e5e5e5`, **min-height 158px** (reserves the tallest prompt, prevents layout jumping); block cursor 10×20px amber, blink 1.1s steps(1).
  - Typing behavior: 20 world prompts (2–4 sentences each — full list in `componentDidMount` of the reference file, `P` array), type 1 char/34ms, hold ~3.7s when complete, delete 5 chars/34ms, next prompt. Cycle.
  - Below (margin-top 28px): CTA **Forge This World →** (amber, 16px 36px) + caption `FREE · ALIVE IN MINUTES` (10px `#666`).
  - **Philosophical anchor**: the Forge flow requires choosing a philosophical anchor. Add the chip row from variant 3b here (label "Anchor it in a philosophy —" + 6 chips: Stoic Order, The Absurd, Entropy & Decay, Collective Memory, Faustian Ambition, Sacred Bureaucracy; SF Mono 9.5px uppercase; active chip amber border/text/bg `rgba(245,158,11,.08)`, rotates with each new prompt; note "required · shapes every citizen's soul").

### 7. SEO footer
- Link block: bg `#060606`, top border `#222`, padding `64px 48px 56px`, grid `1.3fr 1fr 1fr 1fr` gap 48px:
  - Col 1: wordmark + SEO paragraph (Spectral 13.5px `#888`, max-width 300px): "The Bureau of Impossible Geography. AI-simulated living worlds — forged from a sentence, populated by citizens who remember, playing while you sleep." + `DE / EN` language toggle (active amber).
  - Col 2 **SYSTEMS**: World Forge, Epochs & Seasons, Resonance Dungeons, The Drift, Bureau Terminal.
  - Col 3 **WORLDS**: Velgarien, Saltmeridian, The Chitinous Mandate, All living worlds, Chronicle archive.
  - Col 4 **BUREAU**: About the Bureau, Field manual, Contact, Privacy, Terms of transmission.
  - Column heads: Courier 700 10px tracking 3px amber. Links: 12px `#a0a0a0`, real `<a href>` (crawlable), hover amber.
- Legal bar: `© 2026 Metaverse.Center — All worlds reserved` | `SIGNAL STATUS: transmitting` (green) — 9.5px `#555`, top border `#1a1a1a`.
- Giant cropped wordmark: `METAVERSE.CENTER` — Courier 700 225px, color `#161616`, in a 140px-high `overflow:hidden` container (intentionally cut off at the bottom). Use `aria-hidden="true"`.

## Interactions & Behavior (summary)
- System index: hover row OR thumb → set active system (0–5); panel art, tag, name, counter, description, quote all swap; art transition .45s.
- Typing prompt: interval 34ms; type/hold/delete cycle as above; anchor chip advances with each prompt change.
- Marquee: 30s linear infinite, duplicated content, pauses not required.
- Buttons: hover translate(-1px,-1px) + shadow 3→4px (amber) / arrow-links: arrow translateX 4px, color → amber.
- World cards: image scale 1.06 on hover.
- Entrance animations: hero only (staggered rise). No scroll-triggered animations elsewhere (keep it calm).
- Link colors: default `#a0a0a0`/`#888`, hover `#f59e0b`, no underlines except in prose.

## State Management
- `activeSystem: 0–5` (default 0).
- `typedText: string`, `promptIndex`, `phase (typing|holding|deleting)`, `activeAnchor: 0–5`.
- Live platform data: world count ({n}, currently 47 in mock), worlds grid (name/coords/agents/blurb/image), 3 featured agents for the dossier cards, epoch + resonance counters in the ticker.

## Design Tokens (map to `src/styles/tokens/`)
- Surfaces: `#0a0a0a` page / `#060606` sunken sections / `#0f0f0f` hover row / `#111` raised.
- Borders: `#333` (strong, image panels) / `#222` (default) / `#1a1a1a`–`#2a2a2a` (subtle).
- Text: `#e5e5e5` primary / `#a0a0a0` secondary / `#888` tertiary / `#666`,`#555` faint.
- Accent amber `#f59e0b` (+ border `#b45309`); success green `#4ade80`; wordmark ghost `#161616`.
- Type: Courier (--font-brutalist) 700 uppercase for headings/buttons/labels; Spectral serif (italic for narrative) for prose; SF Mono/monospace for micro-labels.
- Shadows: offset only — `3px 3px`, `4px 4px`, `6px 6px 0 #000`. Radius: 0 (except TCG cards ~6px).
- Scale: H1 158 / H2 96 / H2 44 / H3 32 / panel title 26 / prose 15–17 / labels 9.5–11.

## Assets (in `assets/`)
Gemini-generated artwork (16:9, JPEG), final:
- `hero-bureau.jpeg` — hero background (archive hall with amber map table).
- `system-01-forge.jpeg` … `system-06-terminal-crt.jpeg` — preview panel + thumbnails per system (01 forge sphere, 02 war room, 03 flooded descent, 04 drift barge, 05 signal wall, 06 CRT terminal).
Worlds-grid images and agent portraits: use real platform assets (mock uses Supabase showcase images).

## Files
- `Landing Redesign.dc.html` — reference prototype (section `id="3a"` only; template markup + logic class with all copy arrays: `P` prompts, `DESCS` lore, `SYS` systems).
- `assets/` — final artwork.

## Open Points
- Responsive/mobile layout is not designed (reference is fixed 1440px). Derive breakpoints from the token system; the six-systems grid should stack (list above, panel below), hero H1 scale down (~clamp 64–158px).
- All footer/nav link targets need real routes.
- DE localization: all copy here is EN; German versions go through `msg()`.
