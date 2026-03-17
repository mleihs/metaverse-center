# metaverse.center

**Worlds collide. One fracture. A multiplayer worldbuilding platform where literary simulations compete, bleed into each other, and evolve.**

[![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Lit 3.3](https://img.shields.io/badge/Lit-3.3-324FFF?logo=lit&logoColor=white)](https://lit.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Sentry](https://img.shields.io/badge/Sentry-Error_Tracking-362D59?logo=sentry&logoColor=white)](https://sentry.io)

> **Live:** [metaverse.center](https://metaverse.center) &mdash; anonymous browsing, no account required

---

## What Is This?

metaverse.center is a multiplayer worldbuilding platform where users create and manage literary simulations &mdash; each a distinct fictional world with its own agents, buildings, locations, events, and political dynamics. The platform ships with five richly detailed flagship worlds, but any user can forge new simulations with custom lore, themes, and entity hierarchies. Players shape their worlds through AI-assisted content generation and compete in **Epochs**: structured PvP campaigns where operatives are deployed, alliances form and fracture, and scoring spans five strategic dimensions.

A **cross-simulation diplomacy layer** connects worlds through embassies, ambassadors carry influence across borders, and "Event Echoes" bleed narrative consequences from one simulation into another. A force-directed **Cartographer's Map** visualizes the entire multiverse &mdash; simulation nodes, diplomatic connections, active game instances, operative trails, and real-time battle feeds.

Every number tells a story. Every story changes a number. Agent aptitudes shape operative success probabilities. Zone stability degrades under sabotage. Embassy effectiveness drops when infiltrators compromise diplomatic channels. The game balance is calibrated through deterministic simulation of hundreds of epoch matches, with statistical analysis driving each tuning pass.

A **simulation heartbeat system** drives narrative arcs forward through configurable tick cycles, with philosophical anchors, attunement tuning, and automated bureau responses keeping each world's story coherent as it evolves.

The **landing page** doubles as a showcase &mdash; real AI characters from live simulations are displayed as "Intercepted Dossiers" with holographic foil effects, rarity badges, and TCG-style cards. The world *is* the ad: visitors see actual game content before they sign up. The page is viewport-responsive, scaling from 6 agents on mobile to 12 at 4K, with more worlds filling wider screens.

The entire platform is bilingual (English/German), fully themed per-simulation with WCAG 2.1 AA contrast validation, and browsable without authentication via a public-first architecture.

---

## Screenshots

**Draft Roster** — Pre-match deckbuilding phase. Players select agents from a fanned card hand into deployment slots. The stats bar tracks cumulative aptitude totals across all six operative types (SPY, GRD, SAB, PRP, INF, ASN), strongest/weakest analysis, and team synergy. Pip counter shows 2/6 slots filled. "Lock In Roster" commits the selection.

![Draft Roster panel showing 2 deployed agents in slots, team aptitude stats bar, 2/6 drafted counter, and a fanned hand of 7 available agent cards](docs/screenshots/draft-roster-card-hand-speranza.png)

*Speranza — post-apocalyptic survival simulation (warm parchment theme)*

**Buildings** — TCG card grid with AI-generated art, capacity stat gems, security dot indicators, type/condition badges, and embassy markers. Each card is a tactile 5:7 collectible with 3D tilt and light reflection on hover.

![The Gaslit Reach buildings view showing 8 building cards in a responsive grid with AI-generated subterranean Gothic artwork, stat gems, condition indicators, and embassy badges](docs/screenshots/tcg-building-cards-grid-gaslit-reach.png)

**Agents** — Lineup Overview strip (mini portraits with 6-row aptitude bar charts for at-a-glance team comparison) above the full agent card grid. Cards display AI portraits, color-coded aptitude pips per operative type, profession/gender subtitles, and rarity-driven border treatments.

![Speranza agents view showing the Lineup Overview strip with aptitude charts and 7 agent cards with AI portraits, aptitude pips, and profession badges](docs/screenshots/tcg-agent-cards-lineup-speranza.png)

*Velgarien — brutalist dystopia simulation (dark concrete theme)*

**Agents** — The same card system in Velgarien's dark theme: 9 agents with AI portraits, color-coded aptitude pips, profession/system badges, and the Lineup Overview strip for cross-agent aptitude comparison. Ambassador badges visible on Inspektor Mueller.

![Velgarien agents view showing 9 agent cards in dark brutalist theme with AI portraits, aptitude pips, profession badges, and Lineup Overview strip](docs/screenshots/tcg-agent-cards-lineup-velgarien.png)

**Cartographer's Map** — Force-directed multiverse graph showing simulations as nodes with diplomatic connections (orange embassy links), energy pulses along edges, starfield background, and a minimap viewport. Supports 2D SVG and WebGL 3D rendering modes with search, zoom-to-cluster, and 30-second auto-refresh during active epochs. The graph grows dynamically as users create new simulations.

![Cartographer's Map showing the force-directed multiverse graph with simulation nodes, diplomatic connections, energy pulses, and minimap](docs/screenshots/cartographers-map-multiverse-graph.png)

**Intelligence Report** — How-to-Play guide section with Elo power rankings across the flagship simulations (188 Monte Carlo games), methodology callout, and interactive Apache ECharts radar chart comparing simulation performance across 2P/3P/4P/5P player counts. Dark military-console aesthetic with "CLASSIFIED" headers and SIGINT classification labels.

![Intelligence Report showing Elo power rankings bar chart for 5 simulations and radar chart comparing performance across player counts](docs/screenshots/intelligence-report-elo-radar.png)

---

## The Flagship Simulations

The platform ships with five richly detailed seed worlds. Users can create additional simulations with custom lore, themes, and entity data through the Simulation Forge.

| Simulation | Theme | Literary DNA | Aesthetic |
|:-----------|:------|:-------------|:----------|
| **Velgarien** | Brutalist dystopia | Kafka, Zamyatin, Bulgakov, Strugatsky | Dark concrete, surveillance state, Le Corbusier meets Rodchenko |
| **The Gaslit Reach** | Subterranean Gothic | Fallen London, Gormenghast, Mieville | Bioluminescent caverns, amber light, Victorian fungal decay |
| **Station Null** | Deep space horror | Lem (*Solaris*), Watts (*Blindsight*), Tarkovsky | Sterile corridors, impossible geometry, signal corruption |
| **Speranza** | Post-apocalyptic survival | Arc Raiders, collective governance fiction | Warm parchment, golden amber, reclaimed infrastructure |
| **Cite des Dames** | Feminist literary utopia | Christine de Pizan, Bluestocking salons | Illuminated manuscripts, ultramarine & gold, vellum cream |

Each simulation has its own CSS theme preset, lore (~5,000 words of in-world narrative), AI prompt templates, and entity data (agents, buildings, zones, streets). Cite des Dames is the first light-themed simulation; the others use dark palettes.

---

## Gameplay: The Competitive Layer

### Epoch Lifecycle

```
LOBBY ──► FOUNDATION ──► COMPETITION ──► RECKONING ──► COMPLETED
  │         │                │               │
  │         │                │               └─ Final scoring, archival
  │         │                └─ All operative types, full warfare
  │         └─ Spy + Guardian deployment, zone fortification, +50% RP
  └─ Open join (any user + any sim), draft agents, form teams, add bots
```

### Agent Aptitudes & Draft

Each agent has aptitude scores (3&ndash;9) across all six operative types, with a fixed budget of 36 points per agent. Before a match begins, players draft a subset of their simulation's agents into their roster. Aptitude directly modifies operative success probability: a score of 9 gives +27% success over a score of 3.

### Operative Types

| Type | RP Cost | Effect on Success | Scoring Impact |
|:-----|:--------|:------------------|:---------------|
| **Spy** | 3 | Reveals zone security, guardians, and hidden fortifications | +2 Influence, +1 Diplomatic/success |
| **Guardian** | 4 | Reduces enemy operative success by 6%/unit (cap 15%) | +4 Sovereignty |
| **Saboteur** | 5 | Downgrades random target zone security by 1 tier | -6 Stability to target |
| **Propagandist** | 4 | Creates narrative event in target simulation | +5 Influence, -6 Sovereignty to target |
| **Infiltrator** | 5 | Reduces target embassy effectiveness by 65% for 3 cycles | +3 Influence, -8 Sovereignty to target |
| **Assassin** | 7 | Blocks target ambassador for 3 cycles | -5 Stability to target, -12 Sovereignty to target |

### Five Scoring Dimensions

**Stability** &middot; **Influence** &middot; **Sovereignty** &middot; **Diplomatic** &middot; **Military**

Each dimension aggregates from materialized views (building readiness, zone stability, embassy effectiveness) and operative outcomes. Alliance bonuses (+15% diplomatic per ally), betrayal penalties (-25% diplomatic), and spy intelligence all feed into the final composite score.

### Bot AI

Five personality archetypes &mdash; **Sentinel**, **Warlord**, **Diplomat**, **Strategist**, **Chaos** &mdash; each at three difficulty levels (easy/medium/hard). Bots make fog-of-war-compliant decisions using the same `OperativeService.deploy()` pipeline as human players. Dual-mode chat: instant template-based messages or LLM-generated tactical banter via OpenRouter.

### Results Screen &amp; Commendations

When an epoch completes, the fog of war lifts and a **DECLASSIFIED** results view presents the full picture:
- **Top-3 podium** with gold/silver/bronze accents, score count-up animations, and dimension titles
- **Personal operation report** &mdash; total operations, successes, detections, and success rate with animated stat bars
- **MVP commendations** &mdash; Master Spy (military), Iron Guardian (sovereignty), The Diplomat (diplomatic), Most Lethal (success rate), Cultural Domination (influence)
- **5-dimension comparison bars** &mdash; Stability, Influence, Sovereignty, Diplomacy, Military with per-participant animated breakdowns
- Full standings table with your own row highlighted

All animations respect `prefers-reduced-motion`. API: `GET /api/v1/epochs/{epoch_id}/results-summary`.

### Alliance System

Alliances are proposal-based during competition: any participant can propose, but all existing members must unanimously approve before a new team joins. Once formed, allies share intelligence &mdash; battle log entries from allied operations are visible to all members, giving coalitions an information edge.

Alliances carry a resource cost: **1 RP per member per cycle** in upkeep, deducted automatically at cycle resolution. Overlapping attacks between allies build **tension** (incremented when allies target the same simulation in the same cycle); if tension reaches 80, the alliance auto-dissolves. Allies receive a **+15% diplomatic score bonus** per ally; betrayal (leaving an alliance mid-epoch, if enabled) applies a **-25% diplomatic penalty**. The alliance tab surfaces unaligned players for recruitment and displays current tension levels.

### Academy Mode

Solo training against 2&ndash;4 AI bot opponents in a sprint format (3-day duration, 4-hour cycles). One-click creation from the dashboard auto-joins the player's simulation, adds bots with rotated personalities, and starts the match. One active academy epoch per player.

> See [`docs/guides/epoch-gameplay-guide.md`](docs/guides/epoch-gameplay-guide.md) for the full player-facing gameplay guide.

---

## TCG Card System

Every agent and building in the platform is rendered as a collectible card &mdash; a unified `<velg-game-card>` component inspired by Hearthstone, MTG Arena, Marvel Snap, and Balatro. Cards are tactile objects, not flat list items.

### Card Anatomy

```
┌─────────────────────────────────┐
│ ┌─┐                        ┌─┐ │  Stat gems (diamond-rotated)
│ │36│  ┌───────────────────┐ │ 8│ │  Left: power level / capacity
│ └─┘  │                   │ └─┘ │  Right: best aptitude / condition
│      │    CARD ARTWORK   │     │
│      │    (60% height)   │     │  Art frame with inner glow
│      │                   │     │
│      └───────────────────┘     │
│ ┌─────────────────────────────┐│  Name plate with gradient divider
│ │    ✦ AGENT NAME ✦          ││
│ └─────────────────────────────┘│
│  ▪7 ▪5 ▪8 ▪4 ▪6 ▪6            │  Aptitude pips (operative-colored)
│  SPY GRD SAB PRP INF ASN      │  or building type / condition badges
│  Profession · Gender           │  Subtitle + capacity bar
└─────────────────────────────────┘
```

### Rarity Tiers

| Tier | Criteria | Visual Treatment |
|:-----|:---------|:-----------------|
| **Common** | Standard agent/building | Plain border |
| **Rare** | Has relationships, AI-generated, or embassy | Gradient border (type-colored) |
| **Legendary** | Ambassador, aptitude 9, or embassy in good condition | Animated glow + holographic rainbow shimmer on hover |

### Interactions

- **3D Tilt** &mdash; Mouse-tracking `rotateX/Y` via CSS custom properties (`--mx`, `--my`), 800px perspective, spring-back on leave
- **Light Reflection** &mdash; Radial gradient overlay follows cursor position with `mix-blend-mode: overlay`
- **Holographic Foil** &mdash; Legendary cards only: rainbow shimmer via `color-dodge` blend mode, tracks mouse
- **Card Deal** &mdash; Staggered entrance: `translateY(60px) scale(0.8) rotateZ(8deg)` &rarr; rest, 400ms spring easing, 50ms stagger
- **Idle Sway** &mdash; Micro `translateY` oscillation (1px, 4s cycle), phased per card index
- **Four Sizes** &mdash; `xs` (80&times;112), `sm` (120&times;168), `md` (200&times;280), `lg` (280&times;392) &mdash; 5:7 TCG aspect ratio

### Draft Phase &mdash; "The Hand"

During pre-match drafting, the DraftRosterPanel presents available agents as a fanned hand of cards. Players select which agents to deploy into their match roster, seeing aptitude pips and rarity at a glance. Drafted cards receive a "DEPLOYED" stamp and dim. The card system makes agent composition feel like deckbuilding.

---

## Game Balance & Intelligence Gathering

Balance is calibrated through deterministic simulation, not intuition.

### Methodology

The epoch simulation library (`scripts/epoch_sim_lib.py`) runs 50&ndash;200 complete epoch matches per tuning pass, varying player counts (2&ndash;5), strategy distributions, and alliance configurations. Each run produces win rates, operative success distributions, and scoring breakdowns.

### Balance Evolution

| Version | Key Changes | Result |
|:--------|:------------|:-------|
| **v2.0** | Initial release | Guardian-heavy defense dominated (~100% win rate for `ci_defensive`) |
| **v2.1** | Guardian 0.10&rarr;0.08/unit, cap 0.25&rarr;0.20, alliance +15%, betrayal -25% | `ci_defensive` dropped to ~64% |
| **v2.2** | Guardian 0.08&rarr;0.06, cap 0.20&rarr;0.15, cost 3&rarr;4 RP; Infiltrator/Assassin rework; RP 10&rarr;12/cycle | Nash equilibrium convergence, operative success rates ~55-58% |
| **v2.3** | Agent aptitudes (3-9 scores), draft phase, formula `aptitude*0.03` | 18pp success swing between best/worst agents; strategic agent selection matters |
| **v2.4** | Foundation redesign: spy+guardian+fortification; open epoch participation | Hidden defensive layer, early intel, any user can join any epoch |
| **v2.5** | The Chronicle (AI newspaper) + Agent Memory & Reflection (pgvector) | Living world systems: worlds narrate themselves, agents remember |
| **v2.6** | Substrate resonance integration: 8-term success formula, archetype-operative affinities, zone pressure modifier, attacker penalty, saboteur diminishing returns; automatic resonance impact processing via background scheduler; How-to-Play restructured to 28 sections in 4 categories | Shared narrative layer feeds into competitive mechanics; caps reduced for tighter balance; auto-processing eliminates manual admin intervention |
| **v2.7** | Alliance redesign: proposal-based joining, shared intelligence, upkeep (1 RP/member/cycle), tension mechanic (auto-dissolve at 80) | Alliances become strategic cost-benefit decisions, not free bonuses |

### Intelligence Report

The How-to-Play page includes an interactive **Intelligence Report** built with Apache ECharts:
- **Radar chart** &mdash; simulation profile comparisons across scoring dimensions
- **Heatmap** &mdash; head-to-head 2-player duel win rates
- **Grouped bar** &mdash; strategy tiers with Wilson 95% confidence interval whiskers
- **Multi-line** &mdash; win rate evolution by player count

---

## Architecture

```
┌─────────────────────────────────┐
│   Browser (Lit Web Components)      │
│   Preact Signals state              │
│   Supabase JS (Auth/Realtime)       │
│   GA4 (Consent Mode v2)            │
│   Sentry (Error Tracking)          │
└──────────┬────────┬─────────────┘
           │        │
     REST API    Realtime
           │     (WebSocket)
           ▼        │
┌────────────────┐    │
│   FastAPI       │    │
│  ~500 endpoints │    │
│   43 routers    │    │
│   PyJWT auth    │    │
│   Sentry SDK    │    │
└──────┬─────────┘    │
       │              │
       ▼              ▼
┌──────────────────────────────┐
│   Supabase (PostgreSQL)          │
│   70 tables + pgvector            │
│   75+ functions, 59 triggers      │
│   246 RLS policies               │
│   4 materialized views           │
│   Realtime channels              │
│   Auth (ES256/HS256)             │
│   Storage (4 buckets)            │
└──────────────────────────────┘
```

### Key Patterns

- **Public-First Architecture** &mdash; All simulation data is browsable without authentication. Frontend API services route to `/api/v1/public/*` (anon RLS policies) for unauthenticated visitors and authenticated non-members alike.
- **Hybrid Supabase** &mdash; Frontend talks to Supabase directly for Auth, Storage, and Realtime. Business logic routes through FastAPI, which forwards the user's JWT so RLS is always enforced.
- **Defense in Depth** &mdash; FastAPI `Depends()` validates roles (layer 1), Supabase RLS validates row-level access (layer 2). Neither layer trusts the other.
- **Per-Simulation Theming** &mdash; CSS custom properties cascade through shadow DOM. Each simulation gets its own theme preset, all validated against WCAG 2.1 AA contrast ratios.
- **Structured Logging** &mdash; structlog on top of stdlib logging. JSON output in production, console renderer locally. Request context (user_id, request_id, method, path) injected via middleware. All mutations log with structured `extra={}` fields for observability.
- **Game Instance Isolation** &mdash; When an epoch starts, participating simulations are atomically cloned into balanced game instances. Templates remain untouched. Clones are archived on completion, deleted on cancellation.
- **Database-First Logic** &mdash; Business invariants enforced in PostgreSQL via 75+ functions and 25 trigger functions. Complex operations like epoch cloning (~250 lines PL/pgSQL) and forge materialization run as atomic transactions. Derived game metrics computed via 4 materialized views with stale-notification triggers.
- **Admin-Configurable AI** &mdash; LLM model selection (default, fallback, research, forge) configurable at runtime via platform admin panel with environment-specific overrides (dev uses cheap/free models). In-process caching with automatic invalidation on settings change.
- **Token Economy** &mdash; Atomic SECURITY DEFINER RPCs for token purchases, grants, and feature unlocks. BYOK bypass system with 3 control levels (none/all/per_user) lets power users bring their own API keys.

---

## Tech Stack

### Backend

| Library | Version | Purpose |
|:--------|:--------|:--------|
| FastAPI | 0.135 | Async web framework, auto-generated OpenAPI docs, ~490 endpoints across 42 routers |
| Pydantic v2 | 2.12 | Request/response validation, settings management |
| structlog | 25.5 | Structured logging (JSON production, console dev) |
| Supabase Python | 2.25 | PostgreSQL client with RLS enforcement |
| PyJWT | 2.11 | JWT verification (ES256 production, HS256 local) |
| Sentry SDK | 2.29 | Error tracking and performance monitoring (FastAPI integration) |
| Pillow | 12.1 | Image processing, AVIF conversion |
| Replicate | 1.0 | AI image generation (Flux, Stable Diffusion) |
| httpx | 0.28 | Async HTTP client for OpenRouter AI calls |
| slowapi | 0.1 | Tiered rate limiting (30/hr AI, 100/min standard) |
| cryptography | 46.0 | AES-256 encryption for sensitive settings |
| cachetools | 7.0 | JWKS + model resolution + map data caching |
| pydantic-ai-slim | 1.66 | AI agent framework for structured generation (OpenAI provider only) |
| tavily-python | 0.5 | Web research for AI-assisted content generation |

### Frontend

| Library | Version | Purpose |
|:--------|:--------|:--------|
| Lit | 3.3 | Web Components framework (186 custom elements) |
| Preact Signals | 1.8 | Fine-grained reactive state management |
| Supabase JS | 2.45 | Auth, Storage, Realtime channels |
| Apache ECharts | 6.0 | Intelligence Report charts (radar, heatmap, bar, line) |
| 3d-force-graph | 1.79 | Cartographer's Map force-directed visualization |
| web-vitals | 5.1 | Core Web Vitals reporting (CLS, LCP, INP, TTFB) |
| Zod | 4.3 | Runtime schema validation |
| TypeScript | 5.9 | Type safety |
| Vite | 7.3 | Build tool with HMR |
| Vitest | 4.0 | Unit/component testing framework |

### Infrastructure

| Component | Technology |
|:----------|:-----------|
| Database | PostgreSQL via Supabase (70 tables, 75+ functions, 246 RLS policies, pgvector embeddings) |
| Auth | Supabase Auth (JWT with ES256 in production, HS256 locally) |
| Email | SMTP SSL (bilingual tactical briefing emails, fog-of-war compliant) |
| AI Text | OpenRouter (admin-configurable model chain with env-specific fallbacks) |
| AI Images | Replicate (Flux, Stable Diffusion) |
| Hosting | Railway (3-stage Docker build with SEO prerender) + Cloudflare (CDN/DNS) |
| Error Tracking | Sentry (backend + frontend, FastAPI integration) |
| Analytics | Google Analytics 4 (consent mode v2, 44 custom events, web vitals) |
| Testing | pytest + pytest-cov + vitest + Playwright 1.58 |
| Linting | Ruff (backend) + Biome 2.4 (frontend) + lit-analyzer (template checking) |

---

## Project Statistics

| Metric | Count |
|:-------|------:|
| Database tables | 67 |
| PostgreSQL functions | 75+ |
| Database trigger functions | 23 (59 triggers total) |
| Views (regular + materialized) | 12 + 4 |
| RLS policies | 246 |
| SQL migrations | 117 |
| API endpoints | ~490 across 42 routers |
| Web Components | 186 custom elements |
| Localized UI strings | 3,837 (EN/DE, 0 missing) |
| GA4 custom events | 44 (DOM + service-level tracking) |
| Documentation files | 55 (Divio structure + ADRs) |
| Flagship simulations | 5 + 1 joke preset (users can create more) |
| Operative types | 6 |
| Scoring dimensions | 5 |
| Bot personalities | 5 archetypes x 3 difficulty levels |
| Theme presets | 6 (WCAG 2.1 AA validated, 1 exempt joke preset) |
| Email templates | 7 (bilingual, per-simulation themed + signup confirmation + clearance granted/denied) |

---

## Features

- **Simulation worldbuilding** &mdash; agents, buildings, events, locations, zones, streets, social media, campaigns, chat
- **Simulation Forge** &mdash; 4-phase AI worldbuilding pipeline (Astrolabe research &rarr; Drafting Table entity generation &rarr; Darkroom theme tuning &rarr; Ignition materialization). Pydantic AI structured output with typed zone/street/agent/building models, chunk-specific prompts with word-count guidance and image-ready hints, geographic context injection, and BYOK API key support
- **TCG card system** &mdash; unified collectible card component with 3D tilt, holographic foil, rarity tiers, stat gems, aptitude pips, card-deal animations
- **Cross-simulation diplomacy** &mdash; embassies, ambassadors, event echoes (narrative bleed between worlds)
- **Cartographer's Map** &mdash; force-directed multiverse graph with operative trails, health arcs, sparklines, battle feed, leaderboard
- **Competitive Epochs** &mdash; operative deployment, 5-dimension scoring, cycle-based resolution, proposal-based alliances with shared intel &amp; tension mechanic, betrayal penalties, open participation (any user + any sim), DECLASSIFIED results screen with podium/MVP commendations, academy solo training mode
- **Foundation phase ("Nebelkrieg")** &mdash; spies + guardians in early game, hidden zone fortification (+1 security for 5 cycles), intel dossier tab
- **Agent aptitudes & draft phase** &mdash; pre-match deckbuilding with card-hand draft UI and aptitude-weighted success rates
- **Bot AI opponents** &mdash; 5 personality archetypes, 3 difficulty levels, fog-of-war compliant, dual-mode chat
- **The Chronicle** &mdash; AI-generated per-simulation broadsheet newspaper; aggregates events, echoes, battle log, agent reactions into narrative prose with broadsheet front-page layout (CSS multi-columns, drop cap, theme-responsive masthead)
- **Agent Memory & Reflection** &mdash; Stanford Generative Agents-style memory loop; pgvector embeddings (1536-dim), retrieval via cosine similarity + importance + recency decay, memories injected into agent chat context
- **AI content generation** &mdash; portraits, building images, descriptions, event reactions, relationship suggestions, invitation lore, chronicle editions, memory reflections
- **Bilingual email notifications** &mdash; cycle briefings, phase changes, epoch completion (fog-of-war compliant, per-player data)
- **Per-simulation theming** &mdash; CSS presets per world with WCAG 2.1 AA contrast validation, light & dark modes
- **Structured logging** &mdash; JSON production logs with request context, structured extra fields, per-service observability
- **Full i18n** &mdash; English + German (3,834 localized strings, 0 missing translations)
- **How-to-Play tutorial** &mdash; 28-section interactive guide (World, Competitive Play, Advanced Mechanics, Reference), worked match replays, changelog, ECharts Intelligence Report
- **Substrate Resonances** &mdash; platform-level event propagation through 8 archetypes that modify operative effectiveness during competitive epochs, with zone pressure bonuses, attacker penalties, and bot awareness
- **Forge access control** &mdash; three-tier account system (Field Observer &rarr; Reality Architect &rarr; Director) with request/approve/reject workflow, admin clearance management panel, bilingual email notifications, atomic SECURITY DEFINER RPC approval
- **Breadcrumb simulation switcher** &mdash; dropdown in the simulation shell breadcrumb for quick switching between simulations while staying on the current tab; keyboard-navigable (arrow keys, Home/End, Escape), ARIA listbox pattern
- **Classified Dossier System** &mdash; 6-section Bureau dossier (ALPHA&ndash;ZETA arcanums) with theatrical reveal ceremony (4-phase animation: stamp drop, typewriter effect, section declassification, BEGIN READING), tabbed Case File viewer with TOC sidebar and entity cross-reference tagging, prophetic fragment rendering (5 visual types: parchment, typewriter, dream, memo, stone), threat level badge (1&ndash;10 scale) in simulation header, living dossier evolution (incremental updates when entities change)
- **Post-ceremony image tracking** &mdash; real-time polling for AI-generated images with shimmer placeholder animations on TCG cards and lore sections, dramatic brightness-flash reveal on arrival, cross-simulation leak prevention
- **Admin model configuration** &mdash; platform-level LLM model settings (default, fallback, research, forge) configurable via admin panel with in-process caching and automatic cache invalidation
- **Environment sync tooling** &mdash; bidirectional simulation sync between local and production Supabase (`scripts/sync_simulation.py`) with dry-run mode, table group filtering, image storage mirroring
- **Platform admin panel** &mdash; user/membership management, runtime cache TTL controls, resonance auto-processing scheduler, forge clearance request management with pending badge, LLM model configuration
- **Bureau auth terminals** &mdash; themed login/register screens with scanlines, corner brackets, amber glow, blinking cursor, styled signup confirmation email
- **Landing page** &mdash; full-screen immersive intro with hero section, animated feature grid, live platform stats, and call-to-action for unauthenticated visitors
- **Substrate Scanner** &mdash; automated real-world event detection via 10 source adapters (USGS, NOAA, NASA EONET, GDACS, disease.sh, WHO, Guardian, NewsAPI, GDELT, Hacker News); 4-stage pipeline (fetch &rarr; pre-filter &rarr; classify &rarr; create) with batched LLM classification; admin candidate review queue; auto-creates substrate resonances from real earthquakes, pandemics, and geopolitical events
- **Forge token economy** &mdash; mock-monetization layer with token bundles, atomic purchase RPC, admin grant tools, economy stats view, BYOK free access system (3 control levels), and feature purchases (Darkroom Pass, Classified Dossier, Recruitment Office, Chronicle Printing Press)
- **Simulation lore** &mdash; per-simulation narrative sections (~5,000 words each) with AI-generated lore images, living dossier evolution (incremental updates when entities change), and post-ceremony shimmer-to-reveal image tracking
- **Social media simulation** &mdash; in-world social media feed with AI-generated trends, posts, and news articles; transform/integrate/analyze actions that feed into zone stability and event generation
- **Threshold actions** &mdash; emergency interventions when simulation health crosses critical (&lt;0.25) or ascendant (&gt;0.85) thresholds: scorched earth, emergency draft, reality anchor
- **GA4 analytics** &mdash; 44 custom events (entity views, CRUD, chat, social, funnel, landing, web vitals), consent mode v2, GDPR cookie consent banner, user property segmentation, enhanced link attribution
- **Sentry error tracking** &mdash; backend + frontend integration with FastAPI middleware, request context enrichment
- **SEO** &mdash; JSON-LD structured data, dynamic sitemap, slug-based URLs, crawler meta injection
- **Public-first browsing** &mdash; full read access without authentication

---

## Development

### Prerequisites

- Python 3.13
- Node.js 22+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for local Supabase)

### Quick Start

```bash
# Database
supabase start                           # Start local PostgreSQL + Auth + Storage + Realtime

# Backend
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn backend.app:app --reload         # API on http://localhost:8000

# Frontend
cd frontend
npm install
npm run dev                              # Dev server on http://localhost:5173
```

### Testing

```bash
# Backend (from project root, venv activated)
python -m pytest backend/tests/ -v
python -m pytest backend/tests/ --cov           # With coverage report
python -m ruff check backend/                   # Lint

# Frontend (from frontend/)
npx vitest run
npx tsc --noEmit                         # Type check (Railway CI fails on errors)
npx biome check src/                     # Lint
npx lit-analyzer src/                    # Template type checking

# E2E (requires backend + frontend running)
npx playwright test
```

### Project Structure

```
backend/
  app.py                    # FastAPI entry (42 routers registered)
  logging_config.py         # structlog setup (JSON/console, noisy logger suppression)
  dependencies.py           # JWT auth, Supabase clients, role checking
  routers/                  # 42 route modules (public, admin, entity, epoch, forge, scanner)
  models/                   # Pydantic model files
  services/                 # Service modules (BaseService CRUD, AI, email, bots, scanning)
  middleware/               # SEO injection, security headers, logging context
  tests/                    # pytest (unit + integration + performance)
frontend/
  src/
    app-shell.ts            # Router + auth + simulation context
    components/             # 186 Lit web components across 24 directories
    services/               # API services, state, theme, i18n, realtime, SEO, analytics
    styles/tokens/          # CSS design tokens (8 files)
    types/                  # TypeScript interfaces + Zod schemas
    locales/                # i18n (XLIFF source + generated output)
supabase/
  migrations/               # 117 SQL migration files
  seed/                     # Seed data (19 files)
scripts/                    # Image generation, epoch simulation, doc index, env sync
docs/                       # 55 documents (Divio structure)
  specs/                    # 15 hard contracts ("this is how it works")
  references/               # 5 canonical data ("look it up here")
  guides/                   # 11 procedural ("how to do X")
  explanations/             # 5 understanding ("why it's this way")
  analysis/                 # 7 epoch balance + accessibility analysis reports
  audits/                   # 1 live playthrough audit
  adr/                      # 8 Architecture Decision Records
  archive/                  # 2 legacy docs
  INDEX.md                  # Auto-generated catalog from frontmatter
  llms.txt                  # AI-friendly doc index
e2e/                        # Playwright E2E tests (13 spec files)
```

---

## Documentation

The `docs/` directory contains 55 documents organized in [Divio](https://docs.divio.com/documentation-system/) structure with YAML frontmatter. See [`docs/INDEX.md`](docs/INDEX.md) for the full catalog or [`docs/llms.txt`](docs/llms.txt) for AI-friendly consumption. See [`CHANGELOG.md`](CHANGELOG.md) for recent changes.

| Category | Count | Contents |
|:---------|------:|:---------|
| **specs/** | 15 | Platform Architecture, API (~490 endpoints), Auth, AI, Theming, Embassies, Epochs, Game Systems, Substrate Resonances, Substrate Scanner, Microanimations |
| **references/** | 5 | Database Schema (v3.6, 70 tables), Domain Models, Feature Catalog, Components, Design System |
| **guides/** | 11 | Deployment (infrastructure + procedures), Testing, Migration, Simulation Creation, Simulation Blueprint, Playtest, Epoch Gameplay, SEO &amp; GA4, Public Access, Local DB Reset |
| **explanations/** | 5 | Project Overview, Techstack, Game Design Document, Concept Lore, TCG Card System |
| **analysis/** | 7 | Epoch balance reports (2P-5P + cross-reference + playthrough) + accessibility analysis |
| **audits/** | 1 | Simulation Forge live playthrough audit (UX, content quality, game design) |
| **adr/** | 8 | Architecture Decision Records (multi-tenancy, settings, taxonomies, templates, cloning, admin, DB logic, resonance caps) |
| **archive/** | 2 | Legacy documents (old schema, implementation plan) |

---

## License

All rights reserved. This repository is source-available for review and reference. See [LICENSE](LICENSE) for details.

---

<sub>Built with FastAPI, Lit, Supabase, and an unreasonable amount of lore.</sub>
