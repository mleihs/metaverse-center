# Resonance Journal — Implementation Plan

**Status**: Draft pending review. Concept doc `docs/concepts/resonance-journal-agent-bonds-concept.md` is the authoritative design.
**Scope**: The journal half only. Agent Bonds are already implemented (memory `agent-bonds-implementation.md`, 10 commits landed 2026-04-17).
**Plan author**: 2026-04-21 session.

This is the CONTRACT. The concept doc is the *what*; this plan is the *how + in what order*. Decisions (§2) resolve concept ambiguities inline so later phases don't stall on "wait, we never decided X."

---

## 1. Executive summary

Build the Resonance Journal in **6 sequential phases** (P0–P5) over an estimated 6–8 sessions. Each phase ships independently useful value.

| Phase | Deliverable | Minimum viable outcome |
|---|---|---|
| **P0** | Foundation + first integration | Player can see Impression Fragments from existing agent-bond whispers in a journal UI. Zero cross-system integrations except Bonds. |
| **P1** | Cross-system fragment generation | Dungeon runs emit Imprints, epoch cycles emit Signatures, sim events emit Echoes, achievements emit Marks, bleed events emit Tremors. All 6 fragment types live. |
| **P2** | Constellations + Insights | Player can drag fragments onto a canvas, detect resonances, crystallize constellations, receive an Insight. No gameplay effect yet. |
| **P3** | Attunements as gameplay options | Crystallized constellations unlock Attunements; 3 starter attunements (Hesitation / Mercy / Tremor) are threaded into dungeon / epoch / simulation as new player options. |
| **P4** | Palimpsest + Resonance Profile | Periodic Palimpsest reflection generation + profile snapshot. Hidden 8D profile tracks thematic tags. |
| **P5** | Polish + ethical guardrails + E2E playtest | Warburg / Red Book visual polish, salience tuning, no-FOMO verification, WebMCP cockpit-equivalent playtest. |

**P0–P2** are the MVP that proves the concept. **P3–P5** add depth and the closed-loop feedback the concept promises.

---

## 2. Architectural Decisions

Each decision is resolved **now**. Any of these the user can still override — but the plan assumes these resolutions.

### AD-1 — Fragment generation is asynchronous, not inline

**Problem**: LLM calls take 1–2 s. Generating an Imprint inline at dungeon completion would add visible latency to a UX-critical moment.

**Decision**: Fragments are generated **out-of-band** via a new background task (`fragment_generation_scheduler`, heartbeat-like phase 0). The source system (dungeon, epoch, etc.) enqueues a `fragment_generation_request` row; the scheduler processes the queue every ~60s with budget-enforced concurrency. Players see the fragment appear in the journal a few minutes after the triggering event — which matches the concept's "the journal develops a voice" framing.

**Exception**: **Singular** fragments (first dungeon completion, first bond farewell, etc.) generate **inline** with a loading indicator — they're rare and the moment deserves the wait.

### AD-2 — Resonance detection is rule-based, not LLM

**Problem**: The concept lists 4 resonance types (archetype / emotional / temporal / contradiction). Detecting "emotional alignment" via LLM would cost one call per placement, which is untenable at constellation-building frequency.

**Decision**: Detection is rule-based using the **thematic_tags** already attached to every fragment at generation time (tags come from the LLM prompt, cheap to re-use). Four detection rules:

1. **Archetype alignment**: both fragments reference the same dungeon archetype (stored as explicit tag).
2. **Emotional alignment**: overlap in valence tags (grief, joy, fear, etc.) ≥ 2 tags.
3. **Temporal alignment**: fragments created within 72 h of each other AND sharing ≥ 1 non-valence tag.
4. **Contradiction**: explicit antonym pairs (victory vs defeat, hesitation vs decisiveness, …) defined in a small lookup.

Rule-based detection is **O(1) per placement**. LLM is used only for **Insight generation** — triggered once when a constellation crystallizes (2–3 crystallizations per active player per week max, budget-affordable).

### AD-3 — Constellation canvas is drag-and-drop, 2D, spatial (Pointer Events, not HTML5 DnD)

**Problem**: Drag-and-drop adds ~500 LOC of frontend state management vs a "tag the fragments to group them" flat UI.

**Decision**: Ship drag-and-drop. The **spatial composition** IS the mechanic per concept (Warburg's Mnemosyne Atlas). A flat-tag UI would be a different mechanic with a different emotional register.

**Implementation primitive (revised 2026-04-21 after research)**: Pointer Events + `setPointerCapture()` with a keyboard-equivalent Move dialog (`M` key opens a `<dialog>` listing valid targets). **Not** HTML5 native DnD. Three independent 2024-2026 research streams converged on this: `aria-grabbed`/`aria-dropeffect` are deprecated with effectively no screen-reader support; HTML5 DnD events don't fire on mobile touch browsers (requires polyfill); Atlassian (Pragmatic DnD 2024), GitHub (sortable lists), and tldraw all migrated off HTML5 DnD to Pointer Events for exactly this reason. Same scope (~500 LOC, zero external library), strictly better foundation. Full interaction spec in `docs/plans/resonance-journal-design-direction.md` §5.

The Lit component handles coordinate persistence via `constellation_fragments.position_x/y`.

**Simplification**: No minimap, no zoom, no multi-layer. Single zoomed-in canvas, max 12 fragments per constellation (the concept says "7 active constellations" — that's the outer limit; per-constellation density stays low).

### AD-4 — Palimpsest cadence: fragment-count trigger, not time-based

**Problem**: The concept says "every ~30 fragments" AND "roughly monthly." Both triggers could fire, or neither — the design needs ONE canonical trigger.

**Decision**: Fragment-count only. Palimpsest generates on every **30th fragment**, period. Active players hit that in ~3 weeks; inactive players hit it eventually. This matches the concept's voice ("written when enough has happened, not when enough time has passed").

### AD-5 — Resonance Profile is per-user global, not per-simulation

**Problem**: The concept says "how *you* played." That implies cross-simulation. But journal fragments are tied to source systems that ARE per-simulation.

**Decision**: Profile is **per-user, global**. Fragments stay per-user per-simulation (FKs to `simulation_id`) for narrative grounding, but the profile aggregates across all of them. A player who plays 3 simulations sees a unified Palimpsest about their journey across all 3.

**UX implication**: The journal's top-level URL is `/journal` (not `/simulations/:id/journal`). Simulation-scoped views are accessible via filters, but the canonical journal is global.

### AD-6 — No retroactive fragment generation

**Problem**: Existing dungeon runs, epoch cycles, etc. would be fragment sources if we generated retroactively. But "the journal has always existed" is a lore fiction; at launch, the journal is actually empty.

**Decision**: No retroactive generation. Launch-time journals are empty. The first week of play populates the journal. This matches the concept's "density increases over time" visual principle AND saves the LLM budget explosion of retroactive generation over the full user base.

### AD-7 — LLM budget enforcement via Bureau Ops chokepoint

Every LLM call in this system routes through `run_ai` or `OpenRouterService.*` with a **BudgetContext**. Four new purposes:

- `fragment_generation` — Imprint / Signature / Echo / Impression / Mark / Tremor generation
- `constellation_insight` — generated once per crystallization
- `palimpsest_reflection` — generated every 30 fragments
- `bond_impression` — reuses existing `bond_whisper` purpose (no new purpose)

Budget rows (in `ai_budgets` / admin UI) must cap `fragment_generation` at ~50/day/simulation and `palimpsest_reflection` at ~2/day/user. No-budget-configured defaults to the global cap.

### AD-8 — Bond Impressions: extend existing bond system, do NOT duplicate

The Agent Bonds system already exists (memory verified 2026-04-17, 10 commits). The concept says Depth 2+ bonds generate "Impression Fragments" for the journal. **Don't rebuild this — add a journal-emission side effect to `whisper_service`** so every whisper at Depth 2+ also deposits a journal Fragment. Saves one integration point.

### AD-9 — 3 starter Attunements, each hooked into ONE system

The concept lists 3 examples (Hesitation / Mercy / Tremor). Use those as the **complete** starter set. Each hooks into a different game system so we exercise the cross-system feedback loop:

| Attunement | Hooks into | Effect |
|---|---|---|
| **Hesitation** (`einstimmung_zoegern`) | Dungeon | Adds a "wait and observe" dialogue option at thresholds. Reveals hidden info, costs 1 stress tick. |
| **Mercy** (`einstimmung_gnade`) | Epoch | Unlocks a new operative class: **Observer** (gathers intel without espionage risk or reward). |
| **Tremor** (`einstimmung_beben`) | Simulation | Bleed echoes from this player's simulations carry a subtle emotional signature visible to other players who have Tremor active. |

**Post-launch**: more attunements can be added by inserting rows into `journal_attunements` and implementing their hooks. The P3 work establishes the scaffolding for this expansion.

### AD-10 — No real-time journal UI updates

The journal is deliberately **check-in-and-read**, not **live-feed**. No websockets, no Supabase Realtime subscriptions. On page load, fetch the journal; on refresh, re-fetch. Matches the concept's "constellation over chronology" framing — the journal is not a Twitter feed.

---

## 3. Database schema

Migration `232_journal_foundation.sql`:

```sql
-- Fragments: atomic journal entries
CREATE TABLE journal_fragments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
  fragment_type TEXT NOT NULL CHECK (fragment_type IN (
    'imprint', 'signature', 'echo', 'impression', 'mark', 'tremor'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'dungeon', 'epoch', 'simulation', 'bond', 'achievement', 'bleed'
  )),
  source_id UUID,  -- nullable; FK targets vary by source_type
  content_de TEXT NOT NULL,
  content_en TEXT NOT NULL,
  thematic_tags JSONB NOT NULL DEFAULT '[]',  -- ["mercy","hesitation","shadow",...]
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN (
    'common', 'uncommon', 'rare', 'singular'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_journal_fragments_user ON journal_fragments(user_id, created_at DESC);
CREATE INDEX idx_journal_fragments_source ON journal_fragments(source_type, source_id);

-- Generation request queue (AD-1)
CREATE TABLE fragment_generation_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  fragment_type TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',  -- all inputs needed for LLM prompt
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'done', 'failed'
  )),
  attempts INTEGER NOT NULL DEFAULT 0,
  enqueued_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_fragment_gen_pending ON fragment_generation_requests(enqueued_at)
  WHERE status = 'pending';

-- Constellations (Sternbilder)
CREATE TABLE journal_constellations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_de TEXT,
  name_en TEXT,
  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN (
    'drafting', 'crystallized', 'archived'
  )),
  insight_de TEXT,
  insight_en TEXT,
  resonance_type TEXT,  -- 'archetype' | 'emotional' | 'temporal' | 'contradiction' — null if uncrystallized
  attunement_id UUID REFERENCES journal_attunements(id),  -- populated when crystallized, if attunement-eligible
  created_at TIMESTAMPTZ DEFAULT now(),
  crystallized_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Constellation ↔ Fragment junction with canvas coordinates
CREATE TABLE constellation_fragments (
  constellation_id UUID NOT NULL REFERENCES journal_constellations(id) ON DELETE CASCADE,
  fragment_id UUID NOT NULL REFERENCES journal_fragments(id) ON DELETE CASCADE,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (constellation_id, fragment_id)
);

-- Attunement catalog (seeded with 3 starter attunements)
CREATE TABLE journal_attunements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,  -- 'einstimmung_zoegern', 'einstimmung_gnade', 'einstimmung_beben'
  name_de TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_de TEXT NOT NULL,
  description_en TEXT NOT NULL,
  system_hook TEXT NOT NULL CHECK (system_hook IN (
    'dungeon_option', 'epoch_option', 'simulation_option'
  )),
  effect JSONB NOT NULL,  -- structured effect description (hook identifier, config)
  required_resonance JSONB NOT NULL DEFAULT '{}',  -- min dimension thresholds (optional)
  required_resonance_type TEXT,  -- constellation type (archetype/emotional/...) required to unlock
  seeded_at TIMESTAMPTZ DEFAULT now()
);

-- Per-user attunement unlocks (separate from catalog so unlock is tracked, not duplicated)
CREATE TABLE user_attunements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attunement_id UUID NOT NULL REFERENCES journal_attunements(id) ON DELETE CASCADE,
  constellation_id UUID REFERENCES journal_constellations(id),  -- which crystallization unlocked this
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, attunement_id)
);

-- Hidden 8-dimensional Resonance Profile (per-user global, AD-5)
CREATE TABLE resonance_profiles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  umbra DOUBLE PRECISION NOT NULL DEFAULT 0,
  struktur DOUBLE PRECISION NOT NULL DEFAULT 0,
  nexus DOUBLE PRECISION NOT NULL DEFAULT 0,
  aufloesung DOUBLE PRECISION NOT NULL DEFAULT 0,
  prometheus_dim DOUBLE PRECISION NOT NULL DEFAULT 0,
  flut DOUBLE PRECISION NOT NULL DEFAULT 0,
  erwachen DOUBLE PRECISION NOT NULL DEFAULT 0,
  umsturz DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Palimpsest entries (Das Palimpsest, AD-4 cadence)
CREATE TABLE journal_palimpsests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_de TEXT NOT NULL,
  content_en TEXT NOT NULL,
  fragment_count_at_generation INTEGER NOT NULL,
  resonance_snapshot JSONB NOT NULL,  -- profile snapshot at generation time
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_palimpsests_user ON journal_palimpsests(user_id, created_at DESC);
```

**RLS**: every table above restricts rows to `auth.uid() = user_id`. `journal_attunements` is public-read (catalog). Wrap `auth.uid()` in `(SELECT …)` subqueries (migration-183 initPlan pattern).

**Active view refresh**: not applicable — no changes to `agents`, `buildings`, `simulations`, or `events`.

---

## 4. Backend services

```
backend/services/journal/
  __init__.py
  fragment_service.py              — Fragment CRUD + generation-request enqueue
  fragment_generation_scheduler.py — Background processor (AD-1)
  fragment_prompts.py              — LLM prompt templates per source_type × archetype
  constellation_service.py         — Canvas CRUD, resonance detection, crystallization
  resonance_detector.py            — Rule-based detection (AD-2)
  insight_service.py               — LLM insight generation on crystallization
  palimpsest_service.py            — Palimpsest trigger + generation (AD-4)
  resonance_profile_service.py     — 8D profile updates from thematic tags
  attunement_service.py            — Catalog lookup + unlock + per-user effect queries
```

**Key methods** (not exhaustive):

- `FragmentService.enqueue_request(source_type, source_id, fragment_type, context) -> RequestId` — called by every integration hook.
- `FragmentGenerationScheduler.run_once() -> int` — pops pending requests, calls LLM, inserts `journal_fragments` rows, updates profile. Returns count processed.
- `ConstellationService.place_fragment(constellation_id, fragment_id, x, y)` — updates canvas coords, triggers resonance re-check.
- `ResonanceDetector.detect(fragments: list[Fragment]) -> ResonanceResult | None` — pure function, no DB access.
- `AttunementService.evaluate_crystallization(constellation) -> AttunementId | None` — given a crystallized constellation's resonance type + tags, return matching attunement (or None if no match).
- `ResonanceProfileService.apply_fragment(user_id, fragment)` — reads `thematic_tags`, updates per-dimension scores.
- `PalimpsestService.maybe_generate(user_id) -> PalimpsestId | None` — called after every fragment insert; checks "%30 == 0" trigger; LLM call iff triggered.

All LLM calls pass `admin_supabase` + `BudgetContext` per existing A.2/A.3 pattern.

---

## 5. API contract

Router: `backend/routers/journal.py` — all routes gated by `require_role` (non-public, per "Public-First" rule the journal is a logged-in feature).

```
GET    /api/v1/journal/fragments?simulation_id=&source_type=&rarity=  → SuccessResponse[list[FragmentDto]]
GET    /api/v1/journal/fragments/{id}                                  → SuccessResponse[FragmentDto]
GET    /api/v1/journal/constellations                                  → SuccessResponse[list[ConstellationDto]]
POST   /api/v1/journal/constellations                                  → SuccessResponse[ConstellationDto]   (create draft)
PATCH  /api/v1/journal/constellations/{id}                             → SuccessResponse[ConstellationDto]   (rename, archive)
POST   /api/v1/journal/constellations/{id}/place                       → SuccessResponse[ConstellationDto]   (place / move / remove fragment)
POST   /api/v1/journal/constellations/{id}/crystallize                 → SuccessResponse[ConstellationDto]   (commit draft → crystallized, runs insight LLM, unlocks attunement)
GET    /api/v1/journal/attunements                                     → SuccessResponse[list[AttunementDto]] (catalog + unlock status)
GET    /api/v1/journal/palimpsests                                     → SuccessResponse[list[PalimpsestDto]]
GET    /api/v1/journal/palimpsests/latest                              → SuccessResponse[PalimpsestDto | None]
GET    /api/v1/journal/profile                                         → SuccessResponse[ResonanceProfileDto]  (admin preview only — player never sees raw numbers)
```

All responses use `SuccessResponse[T]` per CLAUDE.md. Models live in `backend/models/journal.py`.

---

## 6. Frontend components

```
frontend/src/components/journal/
  VelgResonanceJournal.ts         — Main shell, tabs (Fragments | Constellations | Palimpsest)
  VelgFragmentCard.ts             — Commonplace-book style, torn-edge aesthetic
  VelgFragmentGrid.ts             — List view with filters (source, rarity, sim)
  VelgConstellationCanvas.ts      — Drag-and-drop canvas (Lit + native DnD, AD-3)
  VelgConstellationList.ts        — Sidebar of drafts + crystallized + archived
  VelgConstellationResonanceBadge — Tiny badge showing detected resonance type pre-crystallize
  VelgInsightReveal.ts            — Dramatic reveal animation when crystallization completes
  VelgAttunementPanel.ts          — Catalog view: locked vs unlocked, per-panel effect description
  VelgPalimpsestReader.ts         — Illuminated-manuscript aesthetic, serif typography, decorative borders
  journal-palimpsest-styles.ts    — Shared style module for the Red Book aesthetic
  journal-commonplace-styles.ts   — Shared style module for the Fragment cards aesthetic
```

**Route**: `/journal` (global, per AD-5). Simulation-scoped filter persists in query string.

**Nav entry**: Top nav (not simulation nav) — the journal is above-simulation. Add to `app-shell.ts` alongside existing "Echoes" or similar links.

**Design tokens**: Reuse existing `--color-accent-amber`, `--color-text-primary`, `--font-bureau` (Spectral) for Palimpsest, `--font-brutalist` for Fragment metadata labels. New Tier 3 tokens per component.

**i18n**: every user-facing string wrapped in `msg()`. No em-dashes. No LLM-ism words. Per CLAUDE.md.

---

## 7. LLM prompt budget

| Purpose | Estimated calls / active user / week | Model (via `platform_model_config`) |
|---|---|---|
| `fragment_generation` | ~10–20 | `model_research` (DeepSeek V3 tier) |
| `constellation_insight` | ~2–3 | `model_research` |
| `palimpsest_reflection` | ~0.3 (1 every 30 fragments, ≈ 3 weeks) | `model_forge` (Claude Sonnet tier — palimpsest is literary) |

Per-simulation budget defaults:
- `fragment_generation`: cap 50/day
- `constellation_insight`: cap 10/day
- `palimpsest_reflection`: cap 2/day

These ship in a seeded migration so the Bureau Ops Ledger shows the new purposes from day 1.

---

## 8. Integration hooks

Each existing service gets a **one-line call** to `FragmentService.enqueue_request(...)` at the appropriate completion point. The journal must NEVER block the source system's response — enqueue-and-return is the contract.

| Source | File | Hook point | fragment_type |
|---|---|---|---|
| Dungeon run | `backend/services/dungeon_service.py` at `complete_run()` | After final state persisted, before response | `imprint` |
| Epoch cycle | `backend/services/epoch_scoring_service.py` at `resolve_cycle()` | After scoring commit | `signature` |
| Simulation heartbeat | `backend/services/autonomous_event_service.py` at significant-event creation | Per concept §2.3 — only events crossing threshold | `echo` |
| Agent bond whisper | `backend/services/bond/whisper_service.py` at whisper persist | When bond depth ≥ 2 (AD-8) | `impression` |
| Achievement unlock | `backend/services/achievement_service.py` at unlock insert | Per achievement definition (hand-authored prompt per achievement) | `mark` |
| Bleed echo | `backend/services/bleed_gazette_service.py` at echo creation | When echo crosses significance threshold | `tremor` |

**Salience filter** lives IN `FragmentService.enqueue_request`: reads source context + user's recent fragments, assigns `common | uncommon | rare | singular` rarity, may **skip** generation entirely if the run is not interesting (e.g. dungeon retreat at depth 1).

**Feature flag**: each integration is gated by `platform_settings.journal_enabled` (default `false` until P5). Flag flip is the launch mechanism.

---

## 9. Phased breakdown

### P0 — Foundation + Bond integration (~1–2 sessions)

- Migration 232 (all tables + RLS).
- `backend/models/journal.py`: DTO models.
- `backend/services/journal/fragment_service.py` + `fragment_generation_scheduler.py` + `fragment_prompts.py`.
- `backend/routers/journal.py`: `GET /fragments` + `GET /fragments/{id}`.
- Hook in `whisper_service.py`: AD-8 side-effect on Depth ≥ 2 whispers (fragment_type=`impression`).
- Frontend: `VelgResonanceJournal` shell (Fragments tab only) + `VelgFragmentCard` + `VelgFragmentGrid`.
- Route `/journal`. Nav entry.
- LLM prompts for Impression generation.
- Salience filter MVP: everything is `common` for now; refine in P5.
- Tests: fragment service unit, router integration, whisper hook integration.

### P1 — Cross-system fragment generation (~1 session)

- 5 remaining integration hooks (dungeon, epoch, simulation, achievement, bleed).
- LLM prompts for each fragment type (literary voice per concept §2.2).
- Rarity classification: heuristics per source (first-of-kind → `singular`, …).
- Thematic tag extraction in the LLM prompt (tag output is structured list).
- Tests: each hook fires once, enqueues correctly, context payload round-trips.

### P2 — Constellations + Insights (~2 sessions)

- Service: `constellation_service.py` + `resonance_detector.py` + `insight_service.py`.
- Router: constellation CRUD + place + crystallize endpoints.
- Frontend: `VelgConstellationCanvas` with HTML5 DnD; `VelgConstellationList`; `VelgInsightReveal` dramatic reveal.
- Rule-based resonance detection (AD-2) with 4 rules.
- LLM insight generation on crystallization, budget-enforced.
- Tests: detection pure-function tests; crystallization flow integration.

### P3 — Attunements + gameplay hooks (~1 session)

- Seeded migration with 3 starter attunements (AD-9).
- `attunement_service.py`: unlock logic, effect query API.
- Dungeon hook: `dungeon_threshold.py` checks `AttunementService.has(user_id, 'einstimmung_zoegern')` → adds wait-option.
- Epoch hook: operative dispatch adds "Observer" class when Mercy unlocked.
- Simulation hook: bleed signature augmentation when Tremor unlocked.
- Frontend: `VelgAttunementPanel` for catalog view.
- Tests: attunement unlock, each hook's new option appears / disappears correctly.

### P4 — Palimpsest + Resonance Profile (~1 session)

- `palimpsest_service.py`: trigger on every 30th fragment, LLM call, row insert.
- `resonance_profile_service.py`: tag → dimension mapping, rolling update.
- Router: palimpsest list + latest endpoints.
- Frontend: `VelgPalimpsestReader` with illuminated-manuscript aesthetic.
- Frontend: optional admin-only `VelgResonanceProfileViz` (non-numeric, abstract — non-ship item for P4).
- Tests: palimpsest fires exactly on count threshold; profile updates from tags.

### P5 — Polish + ethical review + E2E playtest (~1 session)

- Visual polish: Warburg canvas styling, Red Book Palimpsest styling, commonplace-book Fragment cards.
- Salience tuning: review accumulated fragments, adjust rarity heuristics.
- Ethical review: no FOMO, no loss aversion, no guilt-tripping (manual script).
- WebMCP E2E playtest: navigate `/journal`, place fragments, crystallize constellation, read Palimpsest, verify attunement unlocks dungeon option.
- Flip feature flag `journal_enabled = true`.
- Operator handbook section + memory file.

---

## 10. Testing strategy

- **Unit**: pure functions (resonance detector, thematic tag aggregator, rarity classifier).
- **Integration**: router + service + DB. Mock LLM at the `run_ai` seam.
- **Scheduler**: a dedicated test that enqueues 5 requests, runs `FragmentGenerationScheduler.run_once()`, asserts 5 fragments inserted.
- **Migration**: applying `232_journal_foundation.sql` to a fresh DB creates all tables with correct RLS.
- **E2E via WebMCP**: P5-gated end-to-end trip.

Target: +30 new backend tests, +5 frontend vitest.

---

## 11. Risks + open questions

### Open questions for user BEFORE P0 start

**Q1** — Journal at user level or simulation level (AD-5 proposes global)? If global, a user playing 3 simulations has ONE journal. If sim-scoped, each sim has its own.

**Q2** — Attunement scope: AD-9 proposes 3 starter attunements. Is that sufficient for launch, or do you want a fuller catalog (e.g. 1 per archetype = 8 attunements)? The plan can expand the P3 scope accordingly.

**Q3** — Budget ceilings (§7): proposed `fragment_generation` cap of 50/day/simulation. Is that too generous? Too thrifty? (Budget overage in prod will be visible in Bureau Ops Ledger — easy to tune later, but launch cap matters.)

**Q4** — **Constellation UI complexity**: AD-3 proposes drag-and-drop. Fallback is flat-tag selection. Drag-and-drop is significantly more frontend work but matches the concept's Warburg atlas framing. Confirm intent.

**Q5** — Palimpsest trigger: AD-4 proposes every-30-fragments. Alternative: time-based (monthly cron). Or both (whichever fires first). Confirm.

### Risks not resolved by decisions

- **LLM quality**: the Fragment / Insight / Palimpsest texts must feel literary, not generic AI prose. Prompt design is load-bearing. P0 prompt iteration will set the tone; poor tone is a concept-breaker.
- **Drag-and-drop accessibility**: HTML5 DnD is hostile to keyboard users. Mitigation: every canvas action MUST have a keyboard equivalent (select fragment + arrow keys, or "add to constellation" list-mode). Deferred to P5 but flagged now.
- **Palimpsest LLM cost**: the prompt needs the full fragment history + profile snapshot. At Sonnet pricing this is ~$0.01 per generation. Fine per-user but auditable via Ops Ledger.
- **Retroactive-ness**: AD-6 says no retroactive gen. Some users may feel "I've played 3 months, why is my journal empty?" — a one-time catch-up migration could seed their journals with highlights. Deferred to post-launch.

---

## 12. Not in scope

- **Cross-user visibility**: the concept doesn't propose sharing fragments / constellations. Explicitly out of scope.
- **Export / import**: fragment export to PDF / markdown deferred to post-launch.
- **More attunements**: only the 3 starters. Adding a 4th is a 1-hour post-launch task.
- **Journal search**: no free-text search in P0–P5. Could be post-launch polish.
- **Fragment editing by player**: per concept §2.1 "The player cannot edit the Palimpsest" — same applies to Fragments. They are system-generated and immutable.

---

## 13. Starting signal

Once the user approves or amends AD-1 through AD-10 + Q1 through Q5, start P0.

**First commits expected in P0**:

1. `feat(journal): migration 232 — foundation schema (7 tables, RLS, indexes)`
2. `feat(journal): Pydantic models + FragmentService + generation scheduler`
3. `feat(journal): Impression fragments from Bond Depth 2+ whispers (AD-8)`
4. `feat(journal): router + GET /fragments endpoints`
5. `feat(journal): frontend shell + VelgFragmentGrid + /journal route`

After P0 ships, monitor Bureau Ops Ledger for the new `fragment_generation` purpose — if spend is unexpected, tune budgets before P1.
