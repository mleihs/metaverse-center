# How to Play Restructure — Complete Progress Log

## Overview

Restructuring the monolithic HowToPlayView (8,239 LOC, 33 sections, 1,237 i18n strings) into a persona-targeted "Three Doors" architecture.

**Research basis:** EVE Online ("never overwhelm"), RimWorld (adaptive learning helper), Dwarf Fortress (three-tier docs: tutorial → quickstart → wiki), Civilization VI (Civilopedia: tabs + sidebar, 2-level hierarchy), Stripe Docs (content as data, three-column layout, interactive components), Linear (motion that communicates state), Path of Exile wiki (hub-and-spoke, role-based pages, 800-2000 words), Cognitive Load Theory (max 2 disclosure levels, fish-tank model, information hierarchy).

**Design system:** Brutalist dark theme. Zero border-radius. Offset shadows (3px 3px 0). Thick borders (3px). Amber primary (#f59e0b via --color-primary). Monospace headings (--font-brutalist: Courier/Monaco). Serif body (--font-prose: Spectral). All colors from Tier 1/2/3 token system — zero hardcoded hex/rgba.

---

## Architecture

```
/how-to-play                → HowToPlayLanding ("Three Doors")
/how-to-play/quickstart     → HowToPlayQuickstart (5-step timeline)
/how-to-play/guide          → HowToPlayGuideHub (12 topic card grid)
/how-to-play/guide/:topic   → HowToPlayTopic (shared template, dynamic)
/how-to-play/competitive    → HowToPlayWarRoom (tabs: tactics/matches/intel/demo/updates)
/how-to-play/legacy         → Old HowToPlayView (temporary, remove in Phase 5)
```

---

## Mandatory Quality Standards (EVERY phase)

- **frontend-design skill**: MUST invoke before writing any new component
- **Zero hardcoded colors**: All via design tokens. Run `frontend/scripts/lint-color-tokens.sh`
- **i18n**: Every user-facing string in `msg()`. No em dashes (U+2014) — use en dashes (U+2013). Run `frontend/scripts/lint-llm-content.sh`
- **Accessibility**: `prefers-reduced-motion: reduce` disables all animations. Focus-visible states on all interactive elements. ARIA labels. Keyboard navigation.
- **SEO**: `seoService.setTitle/setDescription/setCanonical/setBreadcrumbs` in every component's `connectedCallback`. Structured data where appropriate.
- **TypeScript**: `npx tsc --noEmit` must pass before marking phase complete
- **Build**: `npm run build` (from frontend/) must succeed
- **Architecture**: Reuse shared components (Lightbox, EchartsChart, Toast). Import icons from `utils/icons.ts`. Navigation via `CustomEvent('navigate')`. No inline API services.
- **Content quality**: No LLM-isms (tapestry, delve, unleash, seamlessly, holistic, multifaceted, bustling, game-changer, cutting-edge)

---

## Completed Phases

### Pre-Phase: Content Discrepancies (DONE)

**Code reality audit** verified 14 game systems against backend code. Found 4 stale values:

| Fix | File | Change |
|---|---|---|
| Spy scoreValue | `htp-content-rules.ts:108` | 2 → 3 (matches `constants.py MISSION_SCORE_VALUES`) |
| Propagandist scoreValue | `htp-content-rules.ts:134` | 3 → 4 (matches `constants.py`) |
| Bureau Terminal tiers | `htp-content-features.ts:1055` | "19 across 3 tiers" → "30 across 4 tiers" |
| Bureau Terminal Tier 4 | `htp-content-features.ts` (new block) | Added Tier 4: Epoch Operations section (sitrep, dossier, threats, intercept, deploy, ally, broadcast, encrypt) |

**Utility extraction — fuzzy-search.ts:**
- Extracted `levenshtein()` + `fuzzyMatch()` from `terminal-commands.ts` into `utils/fuzzy-search.ts`
- `terminal-commands.ts` now imports from shared module
- `fuzzyMatch` accepts configurable `maxDistance` parameter (default 2)
- Will be reused by Guide search (Phase 3)

**Everything else verified accurate:** 6 operative types, 5 scoring dimensions, 5 phases, RP economy, bot players (5 archetypes × 3 difficulties), alliances, ambient weather (16 categories), agent memory (pgvector), chronicle, academy mode, embassy/ambassador, zone dynamics.

### Phase 1: Route Architecture + Landing Page (DONE)

**New files:**
- `frontend/src/components/how-to-play/HowToPlayLanding.ts` — "Three Doors" entry page
- `frontend/src/components/how-to-play/HowToPlayGuideHub.ts` — Stub (Phase 3)
- `frontend/src/components/how-to-play/HowToPlayTopic.ts` — Stub with dynamic `:topic` param (Phase 3)
- `frontend/src/components/how-to-play/HowToPlayWarRoom.ts` — Stub (Phase 4)

**Modified:**
- `frontend/src/app-shell.ts` — 6 new routes replacing single `/how-to-play` route
- `frontend/src/utils/icons.ts` — Added `search` icon (magnifying glass, Tabler style)

**Landing page design decisions:**
- Three cards: Quick Start (--color-success green), Game Guide (--color-info blue), War Room (--color-primary amber)
- Staggered entrance animation (120ms delay per card, `ease-dramatic`)
- Hover: `translateY(-4px)` + offset shadow + border-color accent + top accent stripe reveal
- Fuzzy search bar below cards (navigates to `/how-to-play/guide?q=...`)
- Popular topics links below search
- "FIELD MANUAL" eyebrow badge
- Fully responsive (3-col → 1-col at 768px)
- All animations disabled with `prefers-reduced-motion: reduce`

### Phase 2: Quick Start Page (DONE)

**File:** `frontend/src/components/how-to-play/HowToPlayQuickstart.ts`

**Design: "Field Briefing" — vertical timeline with numbered steps**
- Visual contrast to Landing (cards = choice, timeline = progression)
- Amber vertical line on left connecting numbered circles (01-05)
- Typography pairing: --font-brutalist for step titles (authoritative), --font-prose for body (warm, readable)
- "ORIENTATION BRIEFING" eyebrow badge
- Back link "◂ How to Play" at top
- Footer nav "Ready for more? Browse the Game Guide ▸" as brutalist button

**5 steps (radically compressed from existing content):**
1. "This is metaverse.center" — AI-driven simulations, agents with memories, generated everything
2. "Create your world" — Forge turns idea → complete world in 15 minutes
3. "Talk to anyone" — Agents remember conversations, develop over time
4. "Compete in Epochs" — PvP seasons, 5 dimensions, original world untouched
5. "Your first moves" — 5 concrete actions (numbered checklist sub-list)

**Content distillation principle (from Dwarf Fortress quickstart):** Each step says WHAT exists + WHERE to find it. Never HOW it works — that's the Game Guide's job.

### Bonus: Date Formatting Extraction (DONE)

**Background agent** extracted all private date formatters into shared module:

**Created:** `frontend/src/utils/date-format.ts` — 12 exported functions:
- `formatDate`, `formatDateTime`, `formatDateTimeShort`, `formatDateFull`
- `formatTime`, `formatTimestamp`, `formatElapsedMs`
- `formatRelativeTime`, `formatRelativeTimeVerbose`, `formatDateLabel`
- `formatDateRange`, `formatShortDateRange`
- `getDateLocale()` — maps app locale to BCP-47

**22 components updated** to import from shared module, all private `_formatDate`/`_formatTime`/etc. methods removed.

### Phase 3: Game Guide Hub + 12 Topic Pages + Fuzzy Search (DONE)

**Completed:** 2026-03-26, commit d45a35e

**The LARGEST phase.** Full content migration from the monolith into a hub-and-spoke architecture.

**New files created:**
- `htp-topic-data.ts` — Content data organized by topic (12 topics, migrated from htp-content-features.ts + htp-content-rules.ts)
- `htp-search.ts` — Fuzzy search system reusing `utils/fuzzy-search.ts`, debounced input, keyboard nav, highlighted matches
- `htp-shared-styles.ts` — Shared style module extracted from duplicated CSS (~400 LOC eliminated)
- `HowToPlayGuideHub.ts` — Full implementation: 12 topic card grid, glassmorphism cards, staggered entrance, search bar
- `HowToPlayTopic.ts` — Full implementation: shared template for all 12 topics, two-column layout, TL;DR box, breadcrumb, prev/next nav

**Refactored:**
- `HowToPlayLanding.ts` — Updated to use shared styles
- `HowToPlayQuickstart.ts` — Updated to use shared styles
- `app-shell.ts` — Route config updates

**Quality pass integrated:**
- Typography: `--heading-weight: 700` (no faux bold), `--tracking-brutalist: 0.08em` (relative), Spectral 500 for dark mode
- Unified breakpoints: 768/1024/1440/2560px across all HTP components
- 11 audit issues found and fixed during implementation

**12 Topics (content migration map):**

| # | Slug | Title | Source sections | Source file(s) |
|---|---|---|---|---|
| 1 | `world` | The Simulation World | intro, simulation-lore, simulation-health, simulation-pulse | rules + features |
| 2 | `forge` | The Simulation Forge | forge-guide | features |
| 3 | `agents` | Agents & Chat | agent-chat, agent-memory | features |
| 4 | `events` | Events & Dynamics | events, social-trends, zone-dynamics | features + rules |
| 5 | `living-world` | The Living World | living-world, ambient-weather, chronicle | features |
| 6 | `map` | The Multiverse Map | multiverse-map | features |
| 7 | `epochs` | Epochs: The Basics | epochs, getting-started, phases, academy-mode | rules |
| 8 | `operatives` | Operatives & Missions | operatives, embassies | rules |
| 9 | `scoring` | Scoring & Economy | rp, scoring | rules |
| 10 | `diplomacy` | Alliances & Diplomacy | alliances, bot-players | rules |
| 11 | `advanced` | Advanced Mechanics | bleed, resonance-guide, results-screen, epoch-comms | rules + features |
| 12 | `terminal` | Bureau Terminal | bureau-terminal | features |
| 13 | `dungeons` | Resonance Dungeons | resonance-dungeons, 8-archetypes, shadow, tower | features + rules |
| 14 | `commendations` | Commendations & Badges | achievement system (35 badges, 7 categories, 5 rarity tiers) | features (new) |

**Each topic page consistent template:**
```
Breadcrumb → TL;DR box (3-4 bullets) → "How it works" → "Tips" → "Related Topics" → Prev/Next nav
```

---

## Pending Phases

### Phase 4: War Room (Competitive Reference)

**File:** `HowToPlayWarRoom.ts` — Replace stub.

**Design:** Military aesthetic AMPLIFIED. "EYES ONLY" hero. CRT scanlines. Dark background --color-surface-dark. Classified badges.

**Tabs (animated indicator bar, Linear-style):**
1. Tactics — existing tactics grid (30+ strategy cards, 5 categories)
2. Matches — existing 5 match replays with accordion expand
3. Intelligence — existing 200-game analytics, Elo ratings, radar charts (lazy-loaded EchartsChart)
4. Demo Run — existing 6-phase walkthrough
5. Updates — existing changelog with expandable entries

**Implementation:** Mostly cut-and-paste from existing `HowToPlayView.ts` render methods. Data files (`htp-content-matches.ts`, tactics from `htp-content-rules.ts`) stay as-is, used directly.

**Pending topic addition:** Topic 14 (`commendations`) for the Achievement & Badge System. Content: 35 badges across 7 categories (Initiation, Dungeon Mastery, Epoch Warfare, Collection, Social & Bleed, Challenge, Secret), 5 rarity tiers (Common → Legendary), how badges are earned (automatic via triggers/hooks), `/commendations` grid, dashboard summary card, Realtime toast notifications. Source: Migration 190–195, `DungeonAchievementService`, frontend `VelgAchievementGrid`/`VelgAchievementBadge`.

### Phase 5: Cleanup + HelpTip + Deprecate Monolith

1. **Delete** `HowToPlayView.ts` after all content migrated and verified
2. **Refactor** `htp-styles.ts` — extract shared styles used across new components into a shared style module
3. **Update** SEO pre-rendering config for new routes
4. **Update** structured data (per-topic FAQPage schemas instead of one giant FAQ)
5. **Create** `frontend/src/components/shared/HelpTip.ts`:
   ```typescript
   // <velg-help-tip topic="operatives" label="What are operatives?">
   // Renders: ? icon linking to /how-to-play/guide/operatives
   @customElement('velg-help-tip')
   export class VelgHelpTip extends LitElement {
     @property() topic = '';
     @property() label = '';
   }
   ```
6. **Verify** content parity: every one of the 1,237 `msg()` strings accounted for
7. **Verify** old `#anchor` URLs redirect to new routes
8. **Update** `docs/guides/how-to-play-restructure.md` with final status

---

## Research Findings (Distilled, for reference in future phases)

### Game Tutorial UX (from deep web research)

1. **EVE Online**: "Never overwhelm" — UI revealed gradually, anchored in story beats, drip-feed information
2. **RimWorld**: Adaptive learning helper watches player actions, teaches what's missing, skips what's known
3. **Dwarf Fortress**: Three-tier docs (tutorial → quickstart → wiki), each serves different intent
4. **Civilization VI**: Civilopedia — tabs for categories, sidebar for entries, max 2 levels deep, `?` button opens contextually
5. **Path of Exile wiki**: Hub-and-spoke (one hub → many focused intent pages), 800-2000 words per page, max 2-3 URL levels
6. **Cognitive Load Theory**: Max 2 disclosure levels before usability collapses. "Fish tank" model (simplified before full complexity). Information hierarchy: essential first, detail on demand.
7. **Stripe Docs**: Content as data (Markdoc AST), three-column layout, interactive components, personalized examples
8. **Linear**: Motion communicates state/structure, not decoration. High-density yet scannable. Clean scanning.

### Modern UI Design (from deep web research)

1. **View Transitions API** (Chrome 111+, Safari 18+): `document.startViewTransition()` for SPA page changes, `view-transition-name` for element morphing
2. **Glassmorphism**: Only for key elements (cards, TL;DR boxes), low blur (4-8px), never animate blur (expensive)
3. **Animation budget**: Only composite properties (transform, opacity, box-shadow). No layout-triggering animations. `prefers-reduced-motion` mandatory.
4. **Card interactions**: `translateY(-4px)` + shadow deepen + border glow = modern standard
5. **Search UX**: Debounced input, keyboard nav, highlighted matches, animated dropdown
6. **Typography**: `max-width: 72ch` for body text (optimal line length), generous whitespace
7. **Game Wiki IA**: Hub-and-spoke, role-based pages, question-based H2s, internal cross-linking

### Anti-Patterns Identified in Current Page

| Anti-Pattern | Evidence | Fix |
|---|---|---|
| Wall of text | 8,500 words on one scroll | Split into 15+ focused pages |
| No persona targeting | Same page for newbies and veterans | Three entry points by intent |
| Flat hierarchy | 33 sections at same level | 4 categories, 12 topic pages |
| Everything page | One URL for all intents | Hub-and-spoke routing |
| Reference mixed with tutorial | Quickstart next to Monte Carlo analytics | Separated into Quick Start vs War Room |
| All-or-nothing loading | 1,237 strings + ECharts in one bundle | Lazy-loaded per route |

---

## Files Created/Modified (Complete List)

### New files:
- `frontend/src/utils/fuzzy-search.ts` — Shared Levenshtein + fuzzyMatch
- `frontend/src/utils/date-format.ts` — Shared date/time formatters (12 functions)
- `frontend/src/components/how-to-play/HowToPlayLanding.ts` — Three Doors landing
- `frontend/src/components/how-to-play/HowToPlayQuickstart.ts` — 5-step timeline
- `frontend/src/components/how-to-play/HowToPlayGuideHub.ts` — 12 topic card grid (Phase 3)
- `frontend/src/components/how-to-play/HowToPlayTopic.ts` — Shared topic template (Phase 3)
- `frontend/src/components/how-to-play/HowToPlayWarRoom.ts` — Stub (Phase 4)
- `frontend/src/components/how-to-play/htp-topic-data.ts` — Topic content data (Phase 3)
- `frontend/src/components/how-to-play/htp-search.ts` — Fuzzy search system (Phase 3)
- `frontend/src/components/how-to-play/htp-shared-styles.ts` — Shared CSS module (Phase 3)
- `docs/guides/how-to-play-restructure.md` — This file

### Modified files:
- `frontend/src/app-shell.ts` — 6 new HTP routes
- `frontend/src/utils/icons.ts` — Added `search` icon
- `frontend/src/utils/terminal-commands.ts` — Imports from fuzzy-search.ts
- `frontend/src/components/how-to-play/htp-content-rules.ts` — Spy/Propagandist score fixes
- `frontend/src/components/how-to-play/htp-content-features.ts` — Terminal tiers fix + Tier 4 section
- `frontend/src/styles/tokens/_typography.css` — font-weight 700, letter-spacing 0.08em (Typography pass)
- 22 component files — Date formatter migration (see date-format.ts section above)
