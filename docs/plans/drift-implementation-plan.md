# DRIFT — Implementation Plan

**Plan v1.1 — 2026-06-12**
Status: PLAN (derived from concept v0.4; supersedes nothing — the concept stays the design contract, this doc is the build contract).
Revision note: v1.1 closes all gaps from the post-draft adversarial review (run-termination RPCs, unified SECURITY-DEFINER grant model, P0 effect set 3→4 for the failure-floor scatter, admin hospitality override vs owner UI phasing, gate-scoped race-test sets, cross-city transit adjacency, callsign schema home, prompt-template/budget seed placement, cadence + reputation Zahlenwerk, Helm ×5, plan-level KPI 14, canonical DSL bind notation, `fn_apply_zone_adjacencies` decoupled from the forge-draft contract).

**Binding inputs:**

1. `docs/concepts/drift-zwischenraum-travel-game-concept.md` v0.4 — the design contract. Decisions §22 (naming, membership-required anchor, cosmetic-only monetization, epochs invisible until P4, hybrid trace moderation, Takt-first/Helm-P3) are binding and not re-opened here.
2. `docs/analysis/drift-concept-gate-review-final-2026-06-12.md` + `docs/analysis/drift-concept-gate-review-partial-2026-06-12.md` — 122 confirmed findings. Every "plan must define X" finding is addressed in this doc; §23 carries the traceability map.
3. `spikes/drift-chart-three/README.md` — renderer carry-over list, binding (see §11.2).
4. Platform contract: `CLAUDE.md` (all NEVER rules apply; the ones DRIFT touches are restated inline where they bind a decision).

**Phase overview:** P0 vertical slice (detailed, §19) → P1a worlds / P1b economy & presence → P2 people (companions, full failure loop, Rettung/Mitfahrt) → P3 weather & frontier (storms, ghost islands, Helm-Modus) → P4 society (Spuren, seasons, convoys, epoch advisories). P1–P4 scaffold in §20.

---

## 1. Architecture Summary

- **Backend:** new domain `backend/services/travel/` — `TravelEngineService` (state machine + checkpoints), `DriftChartService` (generation + queries), `TravelQuestService` (selectors + instantiation), `EffectResolverService` (closed vocabulary, service_role), `TravelStoryletService` (pack registry), `TravelLifecycleScheduler` (BaseSchedulerMixin). One router `backend/routers/travel.py` (HTTP only, `get_effective_supabase`, `SuccessResponse[T]` / `PaginatedResponse[T]` return annotations, no `response_model=`).
- **State authority (resolves gate-review U1):** numeric resources (Kohärenz, Bandbreite, Dissonanz, Siegel) are columns on `travel_runs`/`traveler_profiles` mutated **only** via CAS RPCs (ADR-007). Narrative/positional state is a `checkpoint JSONB` written by the **same RPC in the same transaction**. The dungeon engine's sole-writer assumption is **not** inherited: a `run_version` optimistic-lock column governs multi-device access (§6.2). The two layers are complementary by construction — one writer per call, enforced at the row, not assumed at the client.
- **Frontend:** new component family `frontend/src/components/drift/` (light-DOM render root, Three.js classic WebGL per spike). Begehung extends `SimulationWorldMap` with a presence layer. State via a `DriftStateManager` signal singleton — deliberately separate from `AppStateManager` on the `AlphaStatusService` precedent: DRIFT is phase-gated and must be disable-able/removable as a single-file operation; auth/routing signals stay in `AppStateManager` and are never duplicated. All API calls through `frontend/src/services/api/travelApi.ts` with the explicit `mode` parameter rule (member-only surfaces pass `'member'`; routing signals never read inside `api/`).
- **Content:** `content/drift/**/*.yaml` through the **generalized** pack pipeline (§9.1 — named work, not drop-in).
- **Realtime:** Supabase Realtime presence channels (P1b+), sharded `drift:freq:<vector>:cell:<region>`, plus unsharded `drift:beacons` (P2) and `drift:convoy:<id>` (P4). Authoritative state never travels over presence channels.

---

## 2. Zahlenwerk — tuning tables (initial values; all live in `content/drift/tuning.yaml`, loaded into the registry, never hardcoded in Python)

All values below are launch defaults. They are data (pack-owned), surfaced read-only in the admin Drift tab, and changed only by pack release — satisfying "never hardcode mappings that should be configurable."

### 2.1 Resource ranges & per-Takt deltas

| Resource | Range | Start | Notes |
|---|---|---|---|
| Kohärenz (KH) | 0–100 | 100 | 0 → failure flow (P0 floor §19.4; full Zerfaserung P2) |
| Bandbreite (BB) | 0–class max | class max | 0 → Notfrequenz only (§2.3) |
| Dissonanz (DZ) | 0–100 | 0 | bands per concept §6.3; P0 hard-caps at 74 (Doppelt) |
| Siegel | ≥ 0 | 0 | no player-to-player transfer channel exists anywhere |

**Kohärenz damage:** Umstimmung −5 · failed risky storylet check −5 to −10 (template-owned) · hazard node contact −10 · storm-edge riding −8/Takt (P3) · hostile encounter −10 to −20 (P3). **Restore:** home +10/Takt to full · embassy patch +25 for 15 Siegel (once per visit) · rare storylet outcomes +10 to +20. **Binding rule: no field hull repair** — relays restore zero KH. The frontier retune budget is tuned against this: a baseline frontier run budgets 4–6 Umstimmungen (20–30 KH) before the limp-home decision dominates. This is deliberate (limp-home loop) and recorded as a design rule, not an oversight.

**Bandbreite:** move cost = edge weight × frequency multiplier (§2.2) · scan 5 BB · heavy cargo slot +1 BB/move each. Regen: home +10/Takt. Purchase: relay 1 Siegel = 2 BB, embassy 1 Siegel = 3 BB.

**Dissonanz sources (per Takt unless noted):** deep Drift +1 near a broadcast glow / +2 mid / +3 deep (distance bands from the chart generator) · restricted zone abroad +2 · dream or desire cargo aboard +1 each · storm cell +2 (P3) · overstay beyond window +5 · idle wall-clock trickle +1 per 10 min on the open chart (P3, ships with weather — prices weather-camping). **Sinks:** home −5 · sanctuary building −5 (P0: Chapel of Silence hardcoded via the `sanctuary` flag seed; Cité Reason quarter joins in P1a) · bonded companion aura −1 (P2) · specific storylets −10 to −25 · Cité des Dames world modifier: all sinks ×1.5 while in-sim (P1a).

### 2.2 Edges & frequency multipliers

Edge weight: corridor (Strömungsband) 1 · interstitial 2 · deep Drift 3. Frequency multiplier: on-vector ×1 · off-vector ×2 at affinity 0–1, ×1.5 at affinity 2–3, ×1.25 at affinity 4–5 · low-permeability ×3 · impassable on that vector = no edge (Frequenzfenster geometry). Umstimmung: −5 KH + 1 Takt; free at relays.

### 2.3 Notfrequenz (KPI 11 — never softlocked)

At BB 0: movement allowed **only** along edges the player knows (personally surveyed, purchased, or passive route knowledge from Mitfahrt §12.3) at 2 KH per edge, no scans, no storylet entry except `rescue`-tagged ones. Server-checked in `fn_travel_move`. From any reachable position the home glow is reachable this way — the chart generator asserts connectivity to a corridor at generation time (CI check on the seed, §8.3).

### 2.4 Bandwidth classes

| Class | BB max | Cargo slots | Scan range (hops) | Companions | Unlock |
|---|---|---|---|---|---|
| I Feldgerät | 60 | 2 | 1 | 1 | start |
| II Standardträger | 80 | 3 | 2 | 1 | Feldkartograph + 50 Siegel |
| III Weitband | 100 | 4 | 2 | 1 | Vermesser + 150 Siegel |
| IV Doppelband | 120 | 6 | 3 | 2 | Grenzgänger + 400 Siegel |

P0 ships classes I–II.

### 2.5 Takt costs

Chart move 1 · scan 1 · Umstimmung 1 · zone move (Begehung) 1 · Stadtfahrt (inter-city transit edge, §3.7) 2 · Erkundung 1 · major storylet entry 1 · minor option 0. Autopilot: 0 Takte of attention, full resource cost (P1b).

### 2.6 Aufenthaltsfenster

Base 12 Takte. Modifiers: embassy arrival +2 · lodging +4 (10 Siegel, once per visit, diegetic — **never** purchasable with forge_tokens, decision §22.3, carried as hard invariant) · bond shelter +4 (depth ≥ 3 agent in this sim, P2) · clearance Vermesser+ +2 · hospitality `offen` +2. Overstay: +5 DZ per Takt, embassy services refuse, `overstay`-flagged storylet variants unlock. Window counts **Takte, not wall-clock** — it freezes on checkpoint and resumes on re-entry by construction (resolves finding 44; no separate suspend mechanic needed).

### 2.7 Clearance (Vermessungspunkte, VP)

| Rank | VP | Exam fee | Gates |
|---|---|---|---|
| Aspirant | 0 | — | home pair vectors, tier-1 dispatches, P0 corridor |
| Feldkartograph | 100 | 25 Siegel | +2 vectors (guided choice), tier-2 dispatches, autopilot license, route publishing |
| Vermesser | 300 | 50 | +2 vectors, legal restricted-zone papers, window +2, class III |
| Grenzgänger | 700 | 100 | all 7 vectors, tier-3 dispatches, class IV, deep-Drift advisories |
| Kartograph 1. Klasse | 1500 | 200 | prestige stamp line, relay-arc access (P3), mentor flag |

VP sources: personal-first node survey 5 · Erstvermessung (platform-first) 25 · dispatch tier 1/2/3 = 10/20/40 · thread milestone 50 · Echo-Jagd hop 10. The exam is a storylet at the Bureau (home), fee in Siegel — **not** on the first-session critical path (Aspirant suffices for the P0 corridor; KPI 3 time budget §19.6).

### 2.8 Frequenzprofil

Affinity 0–5 per vector. Raise by use: +1 at cumulative 10 / 30 / 75 / 150 / 300 vector-Takte (Takte spent tuned to that vector). Affinity feeds the off-vector multiplier (§2.2) and storylet checks. **Progressive disclosure (finding 43):** players start with their home sim's two dominant vectors visible (P0: memory + architecture — the pair the seeded Velgarien↔Gaslit-Reach corridor actually carries; `language` is seeded on Velgarien↔Speranza and is explicitly NOT in P0); further vectors unlock per the clearance ladder with a guided first-tuning prompt (a one-time storylet, not a cold 7-way choice).

### 2.9 Siegel price book

**Income:** dispatch tier 1/2/3 = 8–12 / 15–25 / 30–50 · survey delivery 2 per node + 10 personal-first bonus + 40 Erstvermessung · Echo-Jagd resolution 20 · thread milestone 30. **Prices:** BB refill (§2.1) · lodging 10 · embassy KH patch 15 · foreign-hire introduction 20 per visit (P2) · route purchase: seller-priced 5–50, Bureau fee 20%, surveyor royalty 10% (anti-abuse §12.2) · scar-shed ritual 100 (P2) · stamps 50–500 (Bureau prestige line — Siegel-only, clearance/feat-gated, **disjoint by rule** from the forge_token vanity catalog: no item exists in both currencies; the shop schema carries a `currency` CHECK and a CI assert on catalog disjointness).

### 2.10 Failure economics (P2 full loop; P0 floor in §19.4)

Zerfaserung: distress window 10 wall-clock min (TTL on `distress_beacons`) · concede = immediate. Rekonvaleszenz (finding 49 — failure must not dominate limping home): next run opens at KH 60, BB 50%, plus a 10-Siegel re-certification fee (waived for a player's first two Zerfaserungen). Scars: max 3 active · band-gated effects · replacement only via the Siegel ritual · **no scar and no wreck from an empty-manifest Zerfaserung** (anti-farming). Rettung anti-farming: Bergung honor only after ≥ 3 min window elapsed · per-pair rescue credit capped at 2 per season · all rescue pairs visible in the Bureau ledger.

### 2.11 Cadences & TTLs

Noticeboard rotation: every 6 h wall-clock, 4–6 offers per board, offer TTL 24 h · wreck overlay TTL 14 days · distress window 10 min · dressing cache TTL 30 days · telemetry retention 90 days · season length 8 weeks · ghost-island stability re-roll daily (P3).

### 2.12 Reputation tracks (Fährmann / Bergung)

`traveler_reputation` counters, earned: Fährmann +1 per completed ferry leg of ≥ 3 edges ending in a foreign dock with the passenger aboard · Bergung +1 per valid rescue (anti-farming rules of §2.10 apply). Gates — **cosmetic and social only, never mechanical power** (non-interference): Fährmann 10 → title + stamp-line eligibility, 25 → mentor flag (K1K prerequisite waived for ferrying-related stamps) · Bergung 5 → "Bergungsmeister" stamp line · both feed their seasonal leaderboard tracks (P4). No reputation value ever modifies resource math.

---

## 3. Schema — full table catalog

Migration numbers are indicative (head is 238 at time of writing); each package is one migration file. All tables get `created_at`/`updated_at`, FK `ON DELETE` behavior stated per column at implementation. Every JOIN in service queries is LEFT JOIN unless documented.

### 3.1 Migration 239 — `travel_foundation`

| Table | Key columns |
|---|---|
| `traveler_profiles` | `user_id` PK → auth.users, `anchor_simulation_id` NOT NULL → simulations (membership-required, decision §22.2), `callsign text UNIQUE NULL` + `callsign_set_at` (moderated UGC on set/change — §15; visible from P1b presence), `clearance_rank` CHECK (5 values), `vp int`, `siegel int CHECK ≥ 0`, `bandwidth_class CHECK (1–4)`, `affinities jsonb` (7 keys 0–5), `qualities jsonb` (QBN player-quality channel — KPI 5 carve-out), `unlocked_vectors text[]`, `zerfaserung_count int` |
| `travel_runs` | `id`, `user_id`, `status CHECK ('active','frozen','distress','finalizing','completed','abandoned')`, `run_version int NOT NULL DEFAULT 1` (optimistic lock), `kohaerenz int CHECK (0–100)`, `bandbreite int CHECK ≥ 0`, `dissonanz int CHECK (0–100)`, `frequency text CHECK (7 vectors)`, `position_node_id` → drift_chart_nodes, `scale CHECK ('drift','begehung')`, `begehung_simulation_id`, `begehung_zone_id`, `window_remaining int`, `takt_count int`, `checkpoint jsonb` (size budget < 16 KB, asserted in tests), `event_seq int`, `chart_version int`, `opened_at`, `closed_at` |
| | **Partial unique index:** `UNIQUE (user_id) WHERE status IN ('active','frozen','distress')` — the single-active-run CAS (§6.1) |
| `travel_telemetry_events` | `id`, `user_id`, `event_key text` (closed set §14.3), `run_id`, `payload jsonb`, `created_at` — KPI 3/4 instrumentation |
| SQL helper | `travel_audit(p_user uuid, p_action text, p_entity_type text, p_entity_id uuid, p_simulation_id uuid, p_details jsonb)` — INSERTs into the existing `audit_log` (columns verified: simulation_id, user_id, action, entity_type, entity_id, details). Called **inside every mutating travel RPC, in-transaction** — the all-mutations audit rule gets no Python-only escape hatch (finding 7) |
| Seeds | `platform_settings`: `drift_p0_enabled` … `drift_p4_enabled`, `drift_ai_enabled`, `drift_emergency_return` — all `"false"`, canonical lowercase strings, read via fail-closed `parse_setting_bool`. `simulation_settings`: hospitality key `drift_hospitality` = `"nur_echos"` for every existing active template simulation (the 8.7 default as **data, not code fallback**; absent row reads `geschlossen`) |

### 3.2 Migration 240 — `drift_chart`

| Table | Key columns |
|---|---|
| `chart_versions` | `version int PK`, `seed bigint`, `generator_version text`, `applied_at` |
| `drift_chart_nodes` | `id`, `chart_version`, `stable_key text NOT NULL` (survives regeneration — discovery/honor continuity, §8.2), `node_kind CHECK ('seeded','overlay')`, `node_type CHECK ('broadcast_rand','relais','echo_untiefe','geisterinsel','resonanzsturm','traeger_wrack','splitterfaenger_revier','interstitial')`, `simulation_id NULL` (broadcast nodes), `x float, y float` (viewport-independent, server-generated), `frequency_mask int` (7-bit), `region_cell text`, `distance_band CHECK ('near','mid','deep')`, `expires_at timestamptz NULL` (overlay TTL — wrecks, storm projections), `payload jsonb`; **UNIQUE (chart_version, stable_key)** |
| `drift_chart_edges` | `id`, `chart_version`, `from_node`, `to_node`, `weight int CHECK (1–3)`, `permeability jsonb` (per-vector multiplier), `corridor boolean` (Strömungsband), `connection_id NULL` → simulation_connections |
| `traveler_discoveries` | `(user_id, node_stable_key)` PK, `chart_version_first_seen int`, `surveyed boolean`, `survey_delivered boolean`, `source CHECK ('scan','visit','purchase','route_knowledge')` — the per-user FoW layer; **server-filtered, never cached** (§14.4) |
| `chart_honors` | `id`, `kind CHECK ('erstvermessung','erstkontakt')`, `node_stable_key`, `user_id`, `claimed_at`; **UNIQUE (kind, node_stable_key)** — the first-write-wins arbitration row (C4): the INSERT inside `fn_survey_deliver` either wins or conflicts; runner-up gets partial credit, never the flag |

### 3.3 Migration 241 — `travel_quests_cargo`

| Table | Key columns |
|---|---|
| `travel_quest_templates` | `id`, `template_key UNIQUE`, `family CHECK ('deliver','fetch','survey','investigate','escort','introduce')`, `tier int`, `pack_slug`, `definition jsonb` (mechanical skeleton — checks, costs, rewards, effects; pack-generated, TRUNCATE+reseed like dungeon packs) |
| `travel_quest_instances` | `id`, `template_id`, `owner_user_id`, `simulation_id`, `status CHECK ('offered','active','completed','failed','expired')`, `entity_refs jsonb NOT NULL` (the KPI-1 ledger: `[{kind:'agent', id:…}, …]`, CHECK enforced ≥ 2 refs at the service layer + pack CI), `slots jsonb` (resolved selector binds), `clock jsonb`, `dressing_cache_key text`, `effects_applied boolean` |
| `travel_quest_participants` | `(instance_id, user_id)` PK, `checkpoint jsonb`, `credit jsonb` — **in the P0 schema, single-row until P4** (finding 75); shared-instance convoy state is a *view over the initiator's instance*, per-participant credit lives here and survives drop-out |
| `travel_cargo` | `id`, `owner_user_id`, `run_id NULL` (NULL = anchored at home / Andenken), `family CHECK (7 vector families)`, `vector text`, `twists jsonb` (from the **closed catalog**: deklariert/undeklariert, flüchtig, laut, verschränkt, beschriftet, gefälscht — pack-owned enum, CI-validated), `origin_agent_id NULL`, `origin_building_id NULL`, `origin_event_id NULL` (KPI-1 provenance refs), `quest_instance_id NULL`, `manifest_slot int NULL`, `heavy boolean`, `spoils_at_takt int NULL` (flüchtig), `counterpart_cargo_id NULL` (verschränkt) |
| `traveler_scars` | `id`, `user_id`, `scar_key`, `active boolean`, `acquired_at`, `shed_at NULL` — max 3 active enforced in `fn_zerfaserung` |
| `published_routes` | `id`, `surveyor_user_id`, `name text` (moderated UGC §15), `edge_keys text[]`, `price int CHECK (5–50)`, `unique_buyers int`, `season text` |
| `route_purchases` | `(route_id, buyer_user_id)` PK, `price_paid`, `royalty_credited boolean` — per-buyer-once is the PK; self-buy blocked in RPC |

### 3.4 Migration 242 — `travel_effects`

| Table | Key columns |
|---|---|
| `agent_travel_effects` | `id`, `agent_id`, `effect_key`, `payload jsonb`, `expires_at NULL`, `source_quest_instance_id` — **new table**, deliberately NOT reusing `agent_dungeon_loot_effects` (closed dungeon effect_type CHECK + FK to dungeon runs — finding 15) |
| `zone_modifiers` | `id`, `zone_id`, `modifier_key`, `payload jsonb`, `expires_at NOT NULL`, `source CHECK ('travel_quest')` — home-sim only, enforced in the resolver |
| `travel_dressing_cache` | `cache_key text PK` (§6.4 key spec), `prose jsonb`, `locale`, `expires_at` (TTL 30 days) |

### 3.5 Migration 243 — `travel_constraint_extensions` (the consolidated package from concept §17)

One migration, all platform-side constraint work:

1. `journal_fragments.source_type` CHECK + `'travel'` **and** the fragment_type mapping decision: travel fragments map to existing `fragment_type='resonance'`? **No — decision: new fragment_type `'journey'`** added in the same CHECK extension (a travel fragment is neither dungeon nor bond shaped; the journal UI gets one new icon).
2. `memory_source_type` ENUM + `'travel'` (`ALTER TYPE … ADD VALUE` — separate transaction caveat documented in the migration header).
3. `journal_attunements.system_hook` CHECK + `'travel_option'`.
4. `achievement_definitions.category` CHECK + `'travel'`.
5. `buildings.sanctuary boolean DEFAULT false` + **`active_buildings` view refresh in the same migration** (CLAUDE.md view rule) + seed: Chapel of Silence `sanctuary=true`.
6. `simulation_chronicles.mentions jsonb DEFAULT '[]'` — structured Träger credits; the chronicle prompt template gains a mentions section (P0d work, §19.5).

### 3.6 Migration 244 — `embassy_canon_repair`

Adds `agent_id` linkage into `embassy_metadata` ambassadors (backfill resolving current name strings against live agents; the stale "Archivist Mossback" entries re-pointed to **Madam Lacewing** with name-string repair). Quest selectors keying off ambassadors require the FK — KPI 1 cannot be satisfied against name strings (partial-report findings 1–2). The Gaslit-Reach thread anchor is Madam Lacewing ("Lacewings Konkordanz"), per current canon.

### 3.7 Migration 245 — `zone_adjacencies`

| Table | Key columns |
|---|---|
| `zone_adjacencies` | `(zone_a, zone_b)` PK (ordered pair), `simulation_id`, `derivation CHECK ('geometry','transit','fallback')` |

Derivation: shapely polygon border-sharing pass over `zones.geojson` (ForgeMapService style — streets are intra-zone by construction and define nothing; finding 12/54/71). Integration: a new dedicated atomic function **`fn_apply_zone_adjacencies(simulation_id, pairs jsonb)`** owns the write (bumps `simulations.map_geometry_version`, no `forge_drafts` coupling — `fn_apply_map_geometry`'s contract ends in draft-status writes and cannot serve sims that never had a draft); `fn_apply_map_geometry` is extended to call it for new forge output, and migration 245 invokes it directly for the backfill of all existing sims with zone geojson. **Cross-city movement** (finding 71's second half): city polygons share no borders, so intra-city geometry graphs are connected per city only — inter-city pairs within a simulation get `derivation='transit'` rows (all city pairs adjacent, Stadtfahrt cost 2 Takte, derived from `cities` rows in the same pass). Geometry-less sims get no rows at all and fall back to the list-shaped graph (zones grouped by city, all-adjacent, transit between cities) computed at read time in `DriftChartService` — fallback is code, adjacency is data.

### 3.8 Migration 246 — `travel_rpcs` (P0 family, §4) · Migration 247 — `travel_seed`

247 seeds: the generated P0 chart region (§8.3), the pack-generated quest-template rows, **platform-default `prompt_templates` rows** (simulation_id NULL) for the new template_types `travel_narrative` / `dispatch_flavor` (per-sim overrides remain the existing platform feature), and the purpose-scope **`ai_budget` rows** for both — callers and their budget/prompt seeds land in the same migration train (the budget pre-check is fail-open for unseeded purposes; this closes that hole at the source). `wreck_log` (P2) and `travel_identity` (P1a) seed alongside their own callers.

### 3.9 Later packages (indicative)

P1: `noticeboards`, `travel_news_feed` (data model for the player-facing ticker — net-new; only the `VelgDispatchTicker` UI primitive is reused, the admin DispatchTicker is an ops-audit crawl and not a data source), route economy RPCs, `moderation_wordlist` + `content_filter` wiring (callsigns and route names become visible UGC in P1b — the filter ships with its first surface). P2: `distress_beacons` (TTL), `traveler_connections`, `traveler_reputation`, wreck overlay writes, scar catalog seed, `ghost_island_lore` deferred to P3. P3: `ghost_island_lore` (public **projection** table: anonymized, curated fields only; populated by a budget-gated job; `forge_drafts` stays owner-RLS-private and is **never** read by storylet code — finding 58; "abandoned" operational definition: `status='draft'` AND `updated_at` < now()−45 days, or `status='failed'`; owner opt-out flag), weather/storm projection overlays. P4: `travel_traces` (Spuren, rolling cap), `travel_convoys` (+members), leaderboard/season tables.

---

## 4. RPC catalog — CAS semantics + audit

**Security model:** every travel RPC is `SECURITY DEFINER` (the platform's gameplay-RPC pattern — this is also what lets `travel_audit` and telemetry INSERTs work from player-initiated calls), in two grant classes per §5: **player RPCs** (GRANT to `authenticated`, first statement validates `auth.uid()` owns the run/profile — never trusted from parameters) and **arbitration/effect/scheduler RPCs** (REVOKE from `anon, authenticated`, service_role only, per ADR-006). Every mutating RPC calls `travel_audit(…)` in-transaction; every RPC that touches `travel_runs` carries `p_run_version` and fails with `RUN_STALE` on mismatch (client refetches checkpoint). Integration tests per §16.2 race each CAS pair.

| RPC | Phase | Concurrency semantics |
|---|---|---|
| `fn_travel_run_open(user, anchor_sim)` | P0 | INSERT guarded by the partial unique index — a second open anywhere returns the existing run (single-active-run CAS). Applies Rekonvaleszenz penalties if `zerfaserung_count` indicates |
| `fn_travel_move(run, run_version, to_node/zone, mode_payload)` | P0 | run_version CAS; validates adjacency + edge cost + Notfrequenz rule server-side; decrements BB/KH/window, increments takt/event_seq, rewrites checkpoint — one transaction. Helm mode (P3) passes a traversal **segment** validated against a plausibility envelope (elapsed time × edge costs); same RPC |
| `fn_travel_scan(run, run_version, target)` | P0 | run_version CAS; writes `traveler_discoveries` idempotently (PK upsert) |
| `fn_travel_retune(run, run_version, vector)` | P0 | run_version CAS; checks vector unlocked; −5 KH, 1 Takt; free at relais node types |
| `fn_travel_dock(run, run_version, node, direction)` | P0 | run_version CAS; scale transition drift⇄begehung (bidirectional — undock is the same RPC); embassy vs unangemeldet branch (window bonus / +DZ); hospitality read (fail-closed) |
| `fn_travel_complete(run, run_version)` | P0 | run_version + status CAS (`WHERE status='active'`); validates position = home anchor; Entladung in-transaction: each manifest item's redemption effects through the effect family (home = full vocabulary), Andenken re-anchored (`run_id→NULL`), `status='completed'`, audit per item |
| `fn_travel_abandon(run, run_version)` | P0 | run_version + status CAS; "Rückzug": unanchored cargo forfeited (deleted — no scatter, no scar), discoveries kept, `status='abandoned'` |
| `fn_quest_accept / fn_quest_advance(instance, …)` | P0 | status-guard CAS (`WHERE status='offered'/'active'`); skill checks resolved via `combat/skill_checks.resolve_skill_check` in the backend **before** the RPC (the epoch-entangled operative formula is the wrong target — finding 10); RPC persists outcome atomically |
| `fn_apply_quest_effects(instance, effects[])` | P0 | **the single hospitality gate** (§10): validates hospitality + caps per effect, writes all targets, sets `effects_applied` CAS (`WHERE effects_applied=false` — exactly-once), audits each effect row. Zerfaserung scatter (P2) and Spuren (P4) call **the same function family** with `source='zerfaserung'/'trace'` — no second channel exists (finding 3/20) |
| `fn_survey_deliver(user, node_keys[])` | P0 | per-node: discovery row update + VP/Siegel credit; Erstvermessung = INSERT into `chart_honors` — **first-write-wins on the unique index** (C4); conflict → runner-up partial credit (10 VP, "bereits vermessen") in the same transaction |
| `fn_profile_progress(user, deltas)` | P0 | CAS on profile counters; affinity threshold crossings + rank eligibility computed in-RPC |
| `fn_cargo_acquire / fn_cargo_redeem(run, run_version, cargo)` | P0 | run_version CAS; slot-count check against class; twist evaluation (gefälscht reveal, flüchtig spoilage takt check) in-RPC |
| `fn_drift_emergency_return()` | P0 | admin kill-switch: all runs `status IN ('active','distress')` → forced home, resources intact, cargo intact, checkpoint rewritten; idempotent |
| `fn_route_publish / fn_route_purchase` | P1b | purchase: PK = per-buyer-once; `buyer ≠ seller` CHECK; royalty credited only when `unique_buyers` increments and buyer account age > 7 days; royalty capped per route per season (anti-abuse, finding 24) |
| `fn_survey_exchange(a, b, node_keys)` | P1b | dual-consent rows; idempotent per (pair, node) |
| `fn_noticeboard_rotate(embassy)` | P1b | scheduler-called; advisory lock per embassy |
| `fn_zerfaserung(run, run_version, failure_type)` | P2 (P0 floor inline in move/effects path §19.4) | opens distress window (`status='distress'`, TTL); `failure_type='identitaetsbruch'` variant: immediate, no window, no wreck, same scatter + scar pool (concept §6.3); scatter routed through the hospitality gate |
| `fn_rescue_stabilize(beacon, rescuer)` | P2 | CAS `UPDATE distress_beacons SET accepted_by=$r WHERE id=$b AND accepted_by IS NULL AND status='distress'` — first-write-wins; writes `traveler_connections` + reputation |
| `fn_distress_finalize(beacon)` | P2 | scheduler-called; `WHERE status='distress' AND expires_at < now()` — the same status guard the rescue races through; double-finalization impossible (finding 8/33) |
| `fn_trace_write(user, building, text)` | P4 | hospitality check + rolling cap (max 3 per player per building, oldest replaced — single UPSERT-with-delete transaction) |
| `fn_convoy_commit(convoy, member, move)` | P4 | per-member commit rows; convoy advances when all committed OR timeout auto-commits "hold position"; per-member frequency costs; any member exits free (KPI 9 carve-out) |
| `fn_apply_chart_version(new_version)` | P1 (first regeneration event) | migration-style: remaps discoveries/honors by `stable_key`; in-flight run positions remapped to nearest surviving node at zero cost; documented contract before any P0 player data exists (finding 77) |

---

## 5. RLS & security posture (per ADR-006)

EffectResolver ADR (finding 55), stated as the binding rationale: cross-sim effect application is **impossible under user-JWT RLS by design** (a visitor is not a member of the target sim). The resolver therefore executes under `service_role`, and **hospitality + caps + in-RPC audit are the authorization layer**. This is the sanctioned exception, mirrored on ADR-006's register; everything user-scoped stays RLS-enforced.

| Table | SELECT | INSERT/UPDATE/DELETE | RPC grant class (§4) |
|---|---|---|---|
| `traveler_profiles` | own row | own row via RPC only | `fn_profile_progress` player-class |
| `travel_runs` | own rows | RPC only | move/scan/retune/dock/complete/abandon player-class (auth.uid() ownership guard) |
| `drift_chart_nodes/edges`, `chart_versions` | **public read** (topology only — the public landing/spectator surface) | none (backend/scheduler only) | overlay writes via DEFINER (`fn_zerfaserung` wreck, scheduler storm projection) |
| `traveler_discoveries` | own rows; **endpoint additionally server-filters** — undiscovered node payloads never ship (FoW is integrity-relevant for the survey economy) | RPC only | scan player-class |
| `chart_honors` | public read (names on the shared chart) | DEFINER only | `fn_survey_deliver` DEFINER (writes a shared row) |
| `travel_quest_templates` | public read | none (pack seed) | — |
| `travel_quest_instances/participants` | own / participant rows | RPC only | accept/advance player-class; convoy paths backend-only |
| `travel_cargo`, `traveler_scars` | own rows | RPC only | player-class |
| `published_routes` | public read (listing) | own rows via RPC | `fn_route_purchase` DEFINER (credits another user's royalty) |
| `route_purchases` | own rows | DEFINER only | — |
| `agent_travel_effects`, `zone_modifiers`, `travel_traces` | sim-public read (world state) | **service_role resolver only** | `fn_apply_quest_effects` DEFINER, backend-only grant |
| `travel_dressing_cache`, `travel_telemetry_events` | backend only | backend only | — |
| `distress_beacons` | public read (the one all-frequency signal) | DEFINER only | rescue/finalize DEFINER |
| `traveler_connections`, `traveler_reputation` | own + counterpart rows | DEFINER only | `fn_rescue_stabilize` |
| `travel_convoys(+members)` | member rows | DEFINER only | `fn_convoy_commit` |
| `ghost_island_lore` | public read (anonymized projection) | backend job only | — |

**Grant rule (two classes, §4):** player-class RPCs are `GRANT EXECUTE TO authenticated` with a mandatory in-body `auth.uid()` ownership guard as the first statement; backend-only RPCs (`fn_survey_deliver`, `fn_apply_quest_effects` family, rescue/convoy/trace/route-purchase, scheduler finalizers, `fn_drift_emergency_return`) are `REVOKE FROM anon, authenticated; GRANT TO service_role` — callable only via backend with role validation (ADR-006, incident 096→147). `travel_audit` derives `user_id` from `auth.uid()` (never a parameter) and CHECK-constrains actions to the `travel_` prefix, so a direct call can only ever write a truthful row about the caller. RLS policies wrap all function calls and `auth.uid()` in `(SELECT …)` subqueries (initPlan rule, migration 183 precedent).

**Endpoint split (finding 4):**

- Public, unauthenticated: `GET /api/v1/public/drift/state` (phase gates + kill-switch state — alpha-state DTO pattern), `GET /api/v1/public/drift/chart?region=` (topology only, no discovery state, ETag + 5-min cache).
- Member (auth + membership, mode `'member'` explicit): `GET/POST /api/v1/drift/run`, `POST …/run/move|scan|retune|dock|complete|abandon`, `GET …/quests`, `POST …/quests/{id}/accept|advance|complete`, `GET …/cargo|profile|discoveries`, `POST …/surveys/deliver`, P1b: `…/routes`, `…/noticeboards`. No telemetry endpoint exists — all telemetry is written server-side by the owning RPC/service (§14.3). Browsing other DRIFT surfaces never 403s — there are none public beyond the two above; the mode is membership-gated by design (decision §22.2), which is an explicit, documented exception to public-first browsing (the chart topology endpoint is the public face).
- Admin: `GET/PUT /api/v1/admin/drift/gates`, `…/packs`, `…/scheduler`, P4 `…/traces` (ledger + report queue).

---

## 6. Run lifecycle

### 6.1 States & transitions

`active` ⇄ `frozen` (phase-gate off: checkpoint-frozen, resources intact; gate on: thaw) · `active → distress` (KH 0, P2) · `distress → active` (rescued) / `→ finalizing → completed` (TTL expiry or concede — scheduler and player race through the same `WHERE status='distress'` guard) · `active → abandoned` (explicit "Rückzug": run ends, unanchored cargo lost, no scar, discoveries kept) · `active → completed` (home dock + Entladung). Single-active enforced by the partial unique index; `fn_travel_run_open` is the only entry.

### 6.2 Multi-device concurrency

Every mutating call carries `run_version`; a stale client gets `RUN_STALE` (409), refetches the checkpoint, replays nothing (server state is the only truth). No sole-writer assumption anywhere — two tabs are safe, the loser just refreshes. This is the explicit resolution of gate-review U1.

### 6.3 Resume semantics

`GET /drift/run` returns checkpoint + current world overlays. Window: frozen by construction (Takt-based, §2.6). Weather (P3+): re-sampled at current wall-clock, **no retroactive Takt deduction**; if the active resonance set changed since `checkpoint.weather_epoch`, the response includes a one-line Wetterbriefing storylet (finding 45). In-flight runs across a `chart_version` bump: position remapped by `fn_apply_chart_version` (§4).

### 6.4 Dressing cache (LLM cost throttle)

Key: `sha256(template_key · template_version · sorted entity-ref ids · locale · dissonance_band_bucket)`. TTL 30 days, table `travel_dressing_cache`. Hit = zero LLM spend. Per-user spend rides the `ai_budget` purpose rows (§9.3) — unbounded Takte never mean unbounded generation.

### 6.5 Offline finalization

`TravelLifecycleScheduler` (§13) finalizes expired distress windows; a disconnected casualty's window runs to term and finalizes into the normal wreck/scar flow. No presence dependency.

---

## 7. Travel engine — mode-agnostic event stream

`TRAVEL_EVENT_SCHEMA_VERSION = 1`. The engine consumes/produces a canonical, versioned event taxonomy; quest logic, surveying, effects and economy subscribe to events, never to the input method (concept §7.5).

**P0-required subset:** `run_opened`, `node_arrived`, `edge_traversed`, `scan_resolved`, `retuned`, `resource_delta`, `window_tick`, `docked`, `undocked`, `zone_entered`, `erkundung_resolved`, `storylet_entered`, `storylet_resolved`, `quest_advanced`, `cargo_changed`, `run_closed`.

**Declared extension points (typed, unimplemented — finding 76):** `hazard_contact`, `weather_tick`, `storm_moved` (P3) · `beacon_opened`, `beacon_answered` (P2) · `segment_traversed` (P3 Helm) · `convoy_committed` (P4). Adding an emitter never changes consumers; consumers ignore unknown event kinds by contract (forward-compatible). `event_seq` on the run orders the stream; the checkpoint stores the last applied seq.

---

## 8. Chart generation & versioning

### 8.1 Generator

**New server-side seeded deterministic generator** (Python, `backend/services/travel/chart_generator.py`): seeded PRNG, fixed iteration count, viewport-independent coordinates. The client-side `frontend/src/components/multiverse/map-force.ts` is the *layout-family precedent only* (Coulomb/Hooke) — nothing client-side or run-to-run-random survives into `drift_chart_nodes` (partial-report finding; `CartographersDesk` is an SVG schematic and is not referenced). Inputs: active **template** simulations (`status='active' AND simulation_type='template'` — epoch game-instance clones never chart; `archived` templates render as Verstummte, non-dockable), `simulation_connections` (→ corridors), seed. Output: a migration-style seed file (247) — the generator never writes production directly.

### 8.2 Versioning & runtime mutation

Base topology rows are `node_kind='seeded'`, immutable per `chart_version`. The four runtime mutation sources (finding 5) write `node_kind='overlay'` rows: wrecks (TTL 14 days), storm projections (TTL = resonance duration, P3), ghost islands (TTL'd re-roll, P3), new broadcast glows (permanent, written by the forge-publish hook, P1a Erstkontakt flow). Regeneration = explicit `fn_apply_chart_version` event keyed on `stable_key` (§4); Erstvermessung honors and discoveries reference `stable_key`, never node ids.

### 8.3 P0 region & CI assertions

~60 nodes: Velgarien + Gaslit Reach broadcast glows, the Threshold-embassy corridor (5–7 nodes, vectors **memory/architecture** — matching seeded `bleed_vectors`), ~45 interstitial nodes, 1 relay, 1 Echo-Untiefe. Density: a storylet opportunity every 2–4 Takte on frontier routes. CI asserts on the seed: full connectivity to a corridor on at least one vector (KPI 11), density band, no orphan Frequenzfenster.

---

## 9. Content pipeline

### 9.1 Pack pipeline generalization (named P0a work — finding 6/11)

1. `backend/services/content_packs/loader.py`: parameterize pack root (`content/dungeon`, `content/drift`); per-domain registry caches.
2. New `backend/services/content_packs/travel_schema.py`: schemas for `storylet`, `dispatch_template`, `thread`, `node_dressing`, `tuning`, `twist_catalog`, `scar_catalog`, `storm_archetype` (P3).
3. `scripts/validate_content_packs.py`: multi-domain; travel invariants — every selector that can resolve to zero rows declares `fallback:`; every `bind:` consumed; mechanics only in template fields (KPI 5/6); `helm_only:` affordances must declare `takt_equivalent:` (KPI 8 enforcement locus); entity-ref minimum ≥ 2 per quest template (KPI 1); closed twist/storm lists with two tension levers each (KPI 7).
4. `scripts/lint-no-content-in-python.sh`: scope extended to `backend/services/travel/`.
5. `generate_migration`: domain-aware seed output (TRUNCATE + reinsert, pack = single source of truth).

### 9.2 Selector/condition DSL — full grammar (extends concept Appendix 24)

```yaml
select:
  agent.informant:                  # bind name (slot)
    from: agents                    # bounded universe: agents|buildings|zones|events|embassies|connections
    where:                          # AND-list of predicates
      - { col: simulation_id, op: eq, val: $sim }
      - { col: relationship_type, op: in, val: [informant, co_conspirator] }
      - { col: security_level, op: lte, val: 3 }
    sample: { strategy: random_weighted, weight_col: prominence, seed: $instance_seed }
    fallback: { template_text: true }    # or an alternate selector block
require:                            # storylet gate (quality conditions)
  all:
    - { quality: affinity.memory, op: gte, val: 2 }
    - any:
        - { quality: dissonance_band, op: in, val: [doppelt] }
        - { quality: scar, op: contains, val: statisches_ohr }
    - not: { quality: hospitality, op: eq, val: geschlossen }
check:                              # per-option skill check (resolved via resolve_skill_check)
  { quality: affinity.architecture, difficulty: broad|narrow, base: 60 }
```

Operators: `eq neq in nin gte lte contains within_takte` (event recency). Combinators `all/any/not` nest arbitrarily. `$instance_seed` makes sampling deterministic per quest instance (replayable, testable). **Bind notation, canonical:** the selector's mapping key IS the bind name (`agent.informant:` above) — concept Appendix 24's explicit `bind:` keyword is superseded by this grammar; the validator invariant reads "every selector key must be consumed by its template". Validation runs against schema fixtures in pack CI. The grammar is versioned (`dsl_version: 1`) in every pack file.

### 9.3 Generation façade & budget

New `GenerationService` façade methods (each owns its prompt template + model purpose, returns a typed DTO from `backend/models/generation.py`; `_generate` stays private per lint gate): `generate_dispatch_flavor`, `generate_drift_storylet_dressing`, `generate_wreck_log` (P2), `generate_travel_identity` (P1a forge-publish classification), plus a mentions section inside the existing chronicle template (P0d).

- **Budget:** the new template_types double as the billed purposes (`travel_narrative`, `dispatch_flavor`, `wreck_log`, `travel_identity`) — **purpose-scope `ai_budget` rows seeded in the same migration that introduces each caller** (the pre-check is fail-open for unseeded purposes; this closes that hole). `ai_circuit_state` covers them automatically. Embedding writes for `inject_agent_memory` go through `AgentMemoryService` and bill under `travel_narrative`; if budget-blocked, the memory is stored with NULL embedding and a nightly backfill job completes it (recall degrades gracefully, the write never fails).
- **Scoping rule:** Zwischenraum generation (between sims) bills and resolves prompt templates against the Träger's **home** simulation.
- **Locale precedence (finding 51):** Begehung prose → destination sim's `content_locale`; dispatches and Drift-space prose → home sim's locale; `en` fallback. Stated once here, implemented in the façade.

### 9.4 LLM touchpoint list (KPI 6 — bounded and enumerated)

| # | Touchpoint | Phase | Fallback when `drift_ai_enabled=false` or budget-blocked |
|---|---|---|---|
| 1 | `generate_dispatch_flavor` | P0 | template text verbatim |
| 2 | `generate_drift_storylet_dressing` | P0 | pack base text |
| 3 | chronicle mentions section | P0 | plain credits block from `mentions` jsonb |
| 4 | `inject_agent_memory` embedding | P0 | NULL embedding + nightly backfill |
| 5 | `generate_travel_identity` (forge publish) | P1a | deterministic mapping from `theme` |
| 6 | `generate_wreck_log` (auto variant) | P2 | formula line ("Träger <callsign>, zerfasert bei <node>") |
| 7 | ghost-island lore projection build | P3 | curated field subset verbatim |
| 8 | Spuren LLM filter assist | P4 | wordlist-only publish (fail-cheap, still filtered) |

Master gate: the single setting `drift_ai_enabled` checked inside the façade. CI exercises the blocked state end-to-end (§16.5).

---

## 10. Effects & hospitality

Closed vocabulary per concept §11 (9 effects). Resolver: `EffectResolverService`, service_role, called only by `fn_apply_quest_effects`-family RPCs.

**Hospitality matrix (per-sim `simulation_settings` key `drift_hospitality`, fail-closed to `geschlossen` on absent row):**

| Effect | Home | geschlossen | nur_echos | standard | offen |
|---|---|---|---|---|---|
| `spawn_event` | full (impact_level 1–10) | — | — | ≤ 3 | ≤ 3 |
| `emit_echo` (composes spawn_event + echo rows in one RPC; `echo_depth` ≤ 3, `no_self_echo`) | n/a (no self-echo) | — | ✓ | ✓ | ✓ |
| `inject_agent_memory` | full | — | — | importance ≤ 5 | ≤ 5 |
| `chronicle_mention` | ✓ | — | — | ✓ | ✓ |
| `grant_agent_effect` | ✓ home-only | — | — | — | — |
| `zone_modifier` | ✓ home-only, TTL'd | — | — | — | — |
| `propose_embassy` | n/a | — | — | ✓ | ✓ |
| `emit_fragment` (self) | ✓ | ✓ **always** | ✓ | ✓ | ✓ |
| `bond_event` (self) | ✓ | ✓ **always** | ✓ | ✓ | ✓ |

Self-effects are hospitality-exempt by definition (they write the Träger's own journal/bonds) — KPI 2's floor in closed worlds. **Every cross-sim write path** — quest effects, Zerfaserung scatter, Spuren — passes this one gate; scatter targets are filtered to hospitality ≥ `nur_echos`, home excluded by `no_self_echo`. Player-quality writes (affinities, scars, cargo, thread progress) are the QBN layer's declared own channel on `traveler_profiles.qualities` — pack-schema-validated, audited separately, explicitly out of KPI 5's world-state scope.

---

## 11. Frontend

`velg-frontend-design` skill is invoked before any component code (CLAUDE.md hard rule). All strings `msg()`, bilingual de/en. Design tokens only; the canvas reads its palette via the CSS-var→uniform bridge.

### 11.1 Component family

| Component | Notes |
|---|---|
| `drift/DriftChartHost.ts` | light-DOM render root (`createRenderRoot() { return this; }`), `getRootNode()`-scoped style injection + `?inline` CSS per the `SimulationWorldMap` reference pattern; hosts the Three.js scene |
| `drift/scene/*` | ported spike modules: palette bridge, world-signature shaders, instanced nodes, corridors, grade pass |
| `drift/TravelConsole.ts` | resources, manifest with twist indicators, scars (P2), companion card (P2) |
| `drift/StoryletPanel.ts` | Bureau-dossier framing — `bureauPanelFrameStyles` **last** in the styles array (lint-enforced) |
| `drift/DispatchBoard.ts` / `drift/NoticeBoard.ts` (P1b) | rotating offers |
| `drift/CeremonyOverlay.ts` | staged ceremonial sequences (§11.4) |
| `drift/FirstSessionGuide.ts` | the KPI-3 flow (§19.6) |
| `drift/ChartAccessibilityList.ts` | the non-visual chart mode (§11.3) |
| Begehung | `SimulationWorldMap` gains a presence layer: Träger position, window counter, zone-graph affordances, storylet pins — additive, no fork |

### 11.2 Renderer carry-over (binding, from the spike README)

Three.js **0.184.0 pinned**, classic WebGLRenderer + EffectComposer + GLSL (NOT WebGPU/TSL — re-evaluate at the P3/Helm boundary). Carried verbatim: shaders + tuned constants (background/broadcasts/corridors/nodes/particles/grade pass), the 7-bit frequency-crossfade bitmask technique (`mod(floor(mask/2^i),2)` — GLSL1-safe), bespoke pan/zoom controller constants (damping 4.2, zoom smoothing 10, wheel factor 0.0013), UnrealBloom (0.95 / 0.7 / 0.5). **sRGB trap:** deep-Drift background sums stay < 0.01 linear (0.04 reads as 22% grey). Spike scaffolding (Vite standalone, fake chart generator, HUD) is discarded; chart data comes from `drift_chart_nodes/edges`. WebGL2 required; graceful "instrument offline" fallback panel + the accessibility list when context creation fails.

### 11.3 Accessibility contract

- Chart non-visual mode: keyboard/screen-reader traversal exposing current node, adjacency (with per-edge vector + cost), and pings as an ARIA list — this is what "screen-reader-safe rendering" concretely means (finding 47). Available always, not only on failure.
- Seven frequencies: color + **glyph + pattern** redundancy (new `utils/icons.ts` glyph per vector; edge dash patterns on the canvas). WCAG AA covers the canvas via the redundancy channels, not just HTML chrome (finding 48).
- `prefers-reduced-motion`: Takt client default; dissonance distortion off (replaced by a static "Signal unsicher" badge); ceremonies degrade to static stamp reveals.
- **Band-2 resolution protocol (finding 46):** at Doppelt+, one storylet option may be a mirage — selecting it dissolves it at zero resource cost, marked "░ Trugbild"; false pings carry no client-side tell (that's the point) but every ping at Doppelt+ can be verified via a "Gegenprüfung" action (1 Takt); after the band drops below 50, the journal writes a "Rekonstruktion" entry enumerating exactly which pings/options were false — the truth is always recoverable, distortion never silently alters real state. SR mode announces unverified pings as "ungesichert" at all bands (no information asymmetry for SR users).

### 11.4 Ceremony inventory (complete — finding: "ceremony inventory incomplete")

| Moment | Tier | Duration | Reduced-motion fallback |
|---|---|---|---|
| Docking / arrival (chart → Begehung) | ceremonial | 700 ms | crossfade to static arrival stamp |
| Entladung (one reveal per item) | ceremonial | 600 ms/item, staged | item list with stamp-in, no motion |
| Erstvermessung flag | ceremonial | 900 ms | static flag + toast |
| Erstkontakt (rarest) | ceremonial | 900 ms + ticker mention | static seal |
| Umstimmung (frequency dial) | reactive | 250 ms crossfade | instant palette swap |
| Zerfaserung sequence (scatter → wreck → wake-at-anchor) | ceremonial, 3 stages | 3 × 800 ms | three static cards, click-through |
| Bergung (rescue resolution) | ceremonial | 800 ms | static handshake stamp |
| Heimkehr (first re-crossing of home broadcast edge per run) | ceremonial | 600 ms | static glow frame |
| Band transitions (DZ band change) | reactive | 200 ms | badge swap |
| Window-close warning (3 Takte left) | reactive | 200 ms pulse | static counter highlight |

All honor `prefers-reduced-motion`; durations follow the 180–280 ms reactive / 480–900 ms ceremonial contract.

---

## 12. Multiplayer (lifecycles pinned)

### 12.1 Presence (P1b)

Supabase Realtime, channels `drift:freq:<vector>:cell:<region>` + `begehung:<simulation_id>`; positions at 2–4 Hz, ~250 ms interpolation. Convoy side-band `drift:convoy:<id>` (P4) delivers cross-frequency visibility inside a convoy (the mutual-attunement fiction). **Unsharded `drift:beacons`** channel from P2 — distress must be platform-visible or the sharding math makes Rettung unanswerable (finding 39). Signalgruß + survey exchange (consent, no currency) ship with presence.

### 12.2 Survey economy integrity

Erstvermessung/Erstkontakt: server-arbitrated first-write-wins (§4); client trust is scoped to **private resources only** — every shared or competitive write is an arbitrated RPC. Royalties: self-buy excluded, per-buyer-once (PK), account-age floor, per-route seasonal royalty cap (finding 24). Leaderboards (P4) read arbitrated rows only.

### 12.3 Rettung / Mitfahrt / Konvoi (P2 / P2 / P4)

Pinned per concept v0.4 §15.4–15.6 and §2.10 above: distress TTL + first-write-wins `accepted_by` + single status guard; active distress mode (beacon tuning, jettison, wreck-log composition) so the window is playable, concede = one click; Bergung anti-farming (min duration, pair cap, ledger). Mitfahrt: reputation-paid only (no Siegel — no player-to-player currency channel), passenger acquires **passive route knowledge** (`traveler_discoveries.source='route_knowledge'` — Notfrequenz-usable, no survey credit, no Siegel value); abandonment deposits the passenger at the last node with a one-time BB grant to the nearest relay. Konvoi: synchronized turn window, timeout auto-commits "hold position", per-member moves and frequency costs, off-vector edges cost the member but never block the group, free unilateral exit (the KPI 9 consent carve-out's testable guarantee); shared quest state = view over the initiator's instance, per-member credit in `travel_quest_participants` survives drop-out.

---

## 13. Scheduler, phase gates, ops

### 13.1 TravelLifecycleScheduler (BaseSchedulerMixin, the single named owner — finding 8)

Tick 60 s. Duties by phase: distress-window expiry (P2), noticeboard rotation (P1b), embedding backfill (P0), dressing-cache eviction (P0), global weather advance + storm projection overlays (P3), ghost-island stability re-rolls (P3), season rollover (P4). **Every expiry action passes the same CAS guards as player actions** — scheduler-vs-player races resolve deterministically by row state, never by timing. Last-run throttle + Sentry on errors per the 7b scheduler pattern; admin scheduler-panel row + run-now endpoint.

### 13.2 Phase gates & kill-switch

Runtime `platform_settings` keys per phase (`drift_p0_enabled` … `drift_p4_enabled`), read fail-closed via `parse_setting_bool`, surfaced through `GET /api/v1/public/drift/state` (alpha-state DTO pattern — the alpha suite's **runtime** half, not its build-time define). Gates are cumulative: Pn requires Pn−1 on; per-feature sub-keys where operationally independent (`drift_rettung_enabled`, `drift_mitfahrt_enabled` inside P2). **Gate-off semantics:** no new runs start; in-flight runs → `status='frozen'`, checkpoint + resources intact; thaw on re-enable. **Kill-switch `drift_emergency_return`:** `fn_drift_emergency_return()` force-returns all travelers home without loss (Bureau-Ops emergency-brake pattern). Writes via `upsert_platform_setting` only.

### 13.3 Admin surfaces

Admin → Platform → **Drift** tab (P0d): phase gates + kill-switch, scheduler row, `ai_budget` purpose status, tuning (read-only view of `tuning.yaml` values), **per-sim hospitality override** (platform-admin, the P0 instrument until the owner UI ships), chart inspector (P1). Sim settings (P1a): hospitality selector (owner-facing, the four levels with plain-language consequences). P4: trace ledger (owner-visible), Spuren report queue. Content-pack admin: the existing pack browser generalized to the `drift` domain (load & edit, publish → generated migration — A1.7 flow unchanged).

---

## 14. Observability, telemetry, data volume

### 14.1 Sentry tags (per service; `captureError`/`push_scope` on every failure path)

| Service | Fixed tags | Contextual |
|---|---|---|
| TravelEngineService | `service=travel_engine` | `simulation_id`, `run_id`, `rpc` |
| DriftChartService | `service=drift_chart` | `chart_version`, `region_cell` |
| TravelQuestService | `service=travel_quest` | `simulation_id`, `template_key`, `instance_id` |
| EffectResolverService | `service=effect_resolver` | `simulation_id` (target), `effect`, `hospitality` |
| TravelStoryletService | `service=travel_storylet` | `pack_slug`, `storylet_key` |
| TravelLifecycleScheduler | `service=travel_scheduler` | `duty` |
| Frontend | `source='ClassName.methodName'` per the Error Observability contract; no empty catches (lint-enforced) |

### 14.2 Backend logging

stdlib `logging` (injection middleware handles structlog — never convert). Every RPC failure path logs run_id + rpc + Postgres error class.

### 14.3 Telemetry events (closed set, `travel_telemetry_events`)

`drift_first_session_start` (first run-open per user) · `drift_first_foreign_dock` · `drift_run_opened/closed` · `drift_quest_completed` · `drift_decision` (one per player-attention action — emitted by each mutating RPC and by storylet option resolution; the KPI 4 counter) · `drift_zerfaserung` · `drift_rescue`. **Exclusively server-written** in the owning RPC/service (every event corresponds to a server-observed action — no client endpoint, no client-trusted timing). KPI queries in §17.

### 14.4 Data volume & caching

- Public chart topology: region-cell paging, ETag, 5-min public cache — cache-friendly by design.
- FoW (`traveler_discoveries`): per-user, **never cached, server-filtered** — undiscovered node payloads never ship (survey-economy integrity). PK `(user_id, node_stable_key)`; at 5k nodes × alpha users this is small; index-only scans suffice; revisit partitioning at 10⁷ rows.
- `checkpoint jsonb` < 16 KB (test-asserted); `travel_telemetry_events` BRIN on `created_at`, 90-day retention sweep by the scheduler.
- Chart payload budget: ≤ 150 KB gzipped per region cell at 5k-node scale (spike rendered 5k nodes at 120 fps; the wire, not the GPU, is the constraint).

---

## 15. Moderation (decision §22.5, scope: ALL traveler-authored strings)

Surfaces: Spuren (P4), wreck final logs (P2), callsigns (P1b), published route names (P1b). Pipeline: write-time auto-filter — net-new `backend/utils/content_filter.py` + `moderation_wordlist` table (seeded de/en lists; admin-editable) + optional LLM check under the `travel_narrative` purpose (budget-blocked → **wordlist-only publish**, fail-cheap) → publish immediately → report flow + owner-visible ledger as backstop. Hospitality can disable Spuren per sim. Callsign set at profile creation, filter applies on set/change. No pre-moderation queue anywhere.

---

## 16. Test strategy (per layer)

1. **RPC integration tests** (`backend/tests/integration/test_travel_rpcs.py`, migration-221 pattern, real local Supabase): every CAS race exercised, grouped by the sub-milestone that ships the RPC — **P0a set:** `fn_travel_run_open` double-open (single-active index), concurrent `fn_travel_move` from two clients (RUN_STALE), `fn_travel_complete` vs `fn_travel_abandon` status race, emergency-return idempotency · **P0b set:** double `fn_survey_deliver` on one node (exactly one honor) · **P0c set:** double `fn_apply_quest_effects` (exactly-once) · **P2 set:** `fn_rescue_stabilize` vs `fn_distress_finalize` (status guard).
2. **Unit tests** (pytest, mocked Supabase): EffectResolver hospitality matrix (5 levels × 9 effects = the full table in §10 as parametrized cases), Notfrequenz path legality, Zahlenwerk formula functions, selector DSL evaluation against fixtures, locale precedence, dressing-cache keying.
3. **Pack CI** (`validate_content_packs.py --domain drift`): schema + the six travel invariants (§9.1 item 3) on every PR.
4. **Frontend** (vitest): pure-TS modules first (FoW reducer, event-stream consumer, band-state machine, ceremony reduced-motion branching), component tests for StoryletPanel/TravelConsole/AccessibilityList; the Three.js scene is covered by browser playtests, not unit tests.
5. **KPI-6 CI config:** a pytest job runs the full P0 quest loop with `drift_ai_enabled=false` — completes on template text, zero generation calls (asserted via mock).
6. **Acceptance playtests** (WebMCP browser protocol per sub-milestone gate, §19): scripted scenarios + screenshots filed under `docs/analysis/`.
7. **Lint pipeline:** full existing gates + the two extended guards (§9.1) run after every change (`ruff` + `tsc` + `npm run lint:full` before any push).

---

## 17. KPI enforcement table (concept KPIs 1–13 + plan-level 14 — id, phase, method, query/protocol, owner)

| KPI | Phase | Method | Query/protocol | Owner |
|---|---|---|---|---|
| 1 ≥ 2 entity refs | P0c | pack CI + runtime assert | CI invariant on templates; service-layer CHECK on `entity_refs` length; weekly: `SELECT count(*) FROM travel_quest_instances WHERE jsonb_array_length(entity_refs) < 2` = 0 | pack CI + pytest |
| 2 ≥ 1 visible effect | P0c | runtime assert | completion path refuses to close without ≥ 1 applied effect row (self-effect floor in closed worlds); audit query over `audit_log action='travel_effect'` joined to completions | EffectResolver test + admin query |
| 3 < 20 min first foreign dock | P0d | telemetry | median of `drift_first_foreign_dock.ts − drift_first_session_start.ts` over first-session cohort; gate: 5-tester playtest median, then live query | playtest protocol + admin query |
| 4 repeat ≤ 25% attention | P1b | telemetry | `drift_decision` count per route, repeat vs first traversal; autopilot collapses to 1 — measured in decisions, resource cost asserted full in RPC test. Helm (P3): time compression is **×5** (plan deviation from concept's ×4 — 20% lands clear of the 25% boundary instead of exactly on it) | pytest + telemetry query |
| 5 no out-of-vocabulary world writes | P0c | pack CI + grep gate | pack schema forbids effect keys outside the closed set; CI grep: no direct table writes in storylet outcome code; quality writes scoped to `traveler_profiles.qualities` | pack CI + lint |
| 6 playable with AI off | P0c | CI config run | §16.5 job, every PR | CI |
| 7 two levers in tension | P3 | pack CI | `storm_archetype` + node-type pack entries carry `levers: [+x, −y]`, validator requires opposing signs; lists closed per release | pack CI |
| 8 mode parity | P3 | pack CI | `helm_only:` requires `takt_equivalent:` (authoring-time enforcement locus) | pack CI |
| 9 non-interference | P2/P4 | integration tests | RPC tests: no cross-player mutation path outside consent groupings; convoy/Mitfahrt exit-free tests; honors first-write-wins race test | pytest |
| 10 universal visitability | P1a | e2e protocol | scripted: forge-publish a throwaway sim → dock → complete a generic quest, zero hand-authored content | playtest protocol (P1a done-criterion) |
| 11 never softlocked | P0b | generator CI + RPC test | seed connectivity assert (§8.3); Notfrequenz path test from worst-case node incl. ferried-passenger fixture (P2) | CI + pytest |
| 12 solo-completable | P2+ | pack CI | no quest/thread requirement may reference group state; validator rejects `require: convoy` outside convoy-variant packs | pack CI |
| 13 failure is content | P2 | integration test + query | `fn_zerfaserung` test asserts ≥ 1 artifact (wreck/echo set/chronicle line) for non-empty manifests; honors render within one chart refresh (frontend test) | pytest + FE test |
| 14 frontier share (plan-level addition — closes finding 68's fourth implied KPI) | P1b | telemetry | median share of `drift_decision` events on non-autopilot legs per active player-week ≥ 50% over a season — the frontier must stay where the attention is, or content density needs tuning | telemetry query, seasonal review |

---

## 18. Content production table (bilingual de + en; authored as YAML packs, LLM-assisted drafting, owner-reviewed)

| Phase | Type | Count | ~Words/locale | Owner phase gate |
|---|---|---|---|---|
| P0 | dispatch template families (deliver, fetch) + selector configs for 2 sims | 2 × 2 | 1,500 | P0c |
| P0 | generic Drift storylets (node × frequency × band) | 10 | 3,000 | P0c |
| P0 | generic Begehung storylets (taxonomy-keyed) | 12 | 3,500 | P0d |
| P0 | tutorial dispatch + first-session copy + Bureau intro | 1 flow | 1,200 | P0d |
| P0 | node dressing + UI strings | — | 800 | P0b–d |
| P1a | world identity blocks (3 remaining canonical sims) + frequency-unlock guided prompts | 3 + 5 | 2,500 | P1a |
| P1b | noticeboard micro-quests, Echo-Jagd templates, survey/award copy | 10 + 3 | 2,500 | P1b |
| P2 | threads 1–3 (5–8 storylets each) | 3 arcs | 12,000 | P2 |
| P2 | scar catalog, wreck/rescue/distress copy, companion banter triggers | 8 + sets | 3,500 | P2 |
| P3 | threads 4–5 + relay mystery arc | 3 arcs | 14,000 | P3 |
| P3 | storm archetypes (closed list of 4) + ghost-island vignettes + Splitterfänger encounters + Helm tutorial | 4 + 6 + 6 + 1 | 5,000 | P3 |
| P4 | Spuren stationery, season/leaderboard copy, classifieds templates, convoy storylets | sets + 6 | 3,000 | P4 |

Total ≈ 52k words per locale across all phases. No phase's gate passes with its content column unfilled — content is a deliverable, not a follow-up.

---

## 19. P0 — vertical slice, in detail

Scope anchor: Velgarien ↔ Gaslit Reach via the seeded Threshold embassy, frequency pair **memory/architecture**, classes I–II, **4 effects** (`spawn_event`, `inject_agent_memory`, `emit_fragment`, `emit_echo` — the fourth is required by the failure floor's cargo scatter §19.4 and is cheap: it composes `spawn_event`, which P0 ships anyway), DZ capped at 74, failure floor (§19.4). Hospitality live from day one: seed `nur_echos` everywhere; the P0 playtest raises Gaslit Reach to `standard` via the **admin Drift tab's per-sim hospitality override** (a P0d admin surface, §13.3 — the owner-facing UI in sim settings is P1a) — demonstrating the gate, not bypassing it.

### P0a — Schema & engine substrate

Deliverables: migrations 239–246; pack pipeline generalization (§9.1, all five items); selector DSL v1 + validator; `TravelEngineService` with event stream v1 (P0 subset + declared extension points); `TravelStoryletService` registry; RPC core (`run_open`, `move`, `scan`, `retune`, `dock`, `complete`, `abandon`, `profile_progress`, `cargo_*`, `emergency_return`); telemetry table + events; `travel_audit` helper wired into every RPC; Sentry tags.

**Acceptance gate A:** the §16.1 **P0a race set** green on local Supabase · pack CI validates a sample drift pack end-to-end (YAML → validator → generated seed migration → registry load) · both extended lint guards red-team-tested (a planted violation fails CI) · event-stream consumer ignores an unknown future event kind (forward-compat test) · `ruff` + full backend suite green.

### P0b — Chart & travel

Deliverables: chart generator + P0 region seed (§8.3) with CI asserts; `DriftChartHost` + ported spike scene (§11.2); Takt movement, pings/scan, FoW (server-filtered endpoint), Umstimmung between the two vectors; `fn_survey_deliver` + Bureau survey delivery (Vermessung pays from day one); resources HUD (`TravelConsole`); Notfrequenz; Chapel-of-Silence sanctuary sink live; accessibility list mode + frequency glyphs; public chart + drift-state endpoints.

**Acceptance gate B (browser playtest, WebMCP):** cross the corridor both directions with resource deltas matching §2 exactly · the §16.1 **P0b race set** green (double survey delivery → exactly one honor) · network tab shows zero undiscovered-node payloads (FoW integrity) · BB-0 limp-home via Notfrequenz works from the deepest P0 node · reduced-motion run shows no distortion and static ceremonies · `npm run lint:full` + FE tests green.

### P0c — Quests & effects

Deliverables: deliver + fetch templates instantiating against live Velgarien/Gaslit-Reach rows; dispatch board; storylet panel; `TravelQuestService` (selectors, `resolve_skill_check` integration, instance lifecycle); `EffectResolverService` + `fn_apply_quest_effects` with the §10 matrix (4 effects); generation façade methods 1–4 (§9.4) with seeded `ai_budget` purposes + platform-default prompt templates (§3.8), dressing cache, locale rule; KPI 1/2/5 runtime asserts.

**Acceptance gate C:** full quest loop (accept → travel → resolve → effects applied) in the browser · the §16.1 **P0c race set** green (exactly-once effects) · the same loop green in the KPI-6 CI job (`drift_ai_enabled=false`, template text, zero LLM calls) · hospitality matrix unit suite green · effects visible: event in target sim (after the admin-tab hospitality raise to `standard`), agent memory retrievable in chat context, fragment in the journal, echo row composed · audit rows present for every mutation.

### P0d — Begehung & ceremony

Deliverables: zone-graph Begehung in both sims (adjacency from migration 245; window per §2.6; Erkundung; agent chat context tag "ein Träger spricht"); home-port loop (Entladung ceremony over `fn_travel_complete` + Bureau debriefing + dispatch board refresh); admin Drift tab incl. the per-sim hospitality override (§13.3); chronicle `mentions` prompt section + **post-Entladung auto-trigger** (Entladung completion enqueues a chronicle edition for the home sim when pending mentions exist and the last edition predates them — closing finding 52; if generation is budget-blocked, the UI shows the mention in the chronicle queue, the soft fallback); first-session flow (§19.6) + KPI-3 instrumentation; failure floor (§19.4); ceremony inventory rows 1, 2, 5, 8–10 (§11.4).

**Acceptance gate D (the P0 success criterion):** five-tester playtest — each returns home, opens the chronicle, and finds themself in it; median `start → foreign dock` < 20 min · full lint + test pipeline green · gate-off test: disabling `drift_p0_enabled` freezes the run and re-enabling thaws it intact · `drift_emergency_return` exercised once against live test runs.

### 19.4 P0 failure floor (and the P2 upgrade path)

KH 0 in P0: forced return home + carried cargo scattered as echoes via `emit_echo` through the hospitality gate (P0 ships the effect for exactly this — §19 scope anchor; the seeded `nur_echos` default suffices for echo targets, so the floor works with zero hospitality configuration) — **no wreck node, no scar, no distress window**. DZ is hard-capped at 74 (band Fremd and Identitätsbruch are P2; sources clamp at the cap). Upgrade path P2: the floor branch in the move/effects path is replaced by `fn_zerfaserung` (window, wreck overlay, scar draw, Rekonvaleszenz, Identitätsbruch variant) — the RPC seam is in place from P0a so the swap is additive.

### 19.5 Chronicle integration

`chronicle_mention` effect appends to `simulation_chronicles.mentions`; the chronicle prompt template gains a "Träger im Stadtbild" section consuming the structured credits; fallback renders the credits block verbatim (KPI 6 row 3).

### 19.6 First-session flow & KPI-3 time budget (finding 30/42)

Cohort: members opening DRIFT for the first time (`drift_first_session_start` fires at first run-open). Membership is a precondition by decision §22.2 and is **defined** outside the measured window — it is platform onboarding, owned by the existing OnboardingWizard. For the full-chain honesty the finding demanded: a brand-new account reaches membership in ≈ 3 min via that wizard, so even the worst-case full chain (join → first foreign dock) lands ≈ 17 min — inside 20 min, but the KPI contract is the run-open-to-dock window. Budget: Bureau intro (FirstSessionGuide, skippable) 1 min → tutorial dispatch at home (deliver across 2 zones, teaches Begehung + storylet panel) 5 min → provisioning + guided first tuning (memory) 2 min → first crossing (5–7 corridor nodes, one scripted storylet opportunity) 5 min → Threshold dock (`drift_first_foreign_dock`) 1 min. **Total ≈ 14 min median, 6 min margin.** Deliberately NOT in the path: clearance exam (Aspirant suffices), cargo twists beyond the tutorial item, second frequency. No clearance/exam/Siegel gate stands between a new member and their first foreign dock.

---

## 20. P1–P4 scaffold

| Phase | Scope (delta) | Done-criterion (testable) |
|---|---|---|
| **P1a — worlds** | All active template sims dockable via the generic layer (auto travel-identity at forge publish, Erstkontakt flow + provisional thin connection, Verstummte rendering); full 7-frequency system + progressive disclosure ladder; hospitality owner UI; remaining sanctuary seeds; first `fn_apply_chart_version` event (full chart) | A freshly forge-published world with zero hand-authored travel content is docked, surveyed and quested by a playtester (KPI 10 protocol) |
| **P1b — economy & presence** | Vermessung delivery + Erstvermessung honors at scale, autopilot (license-gated; weather semantics pre-recorded for P3: re-priced edge-by-edge at execution, refuses active hazard cells and collapsed corridors — the commute click never grants storm immunity), published routes + royalties (anti-abuse §12.2), embassy noticeboards + rotation, Echo-Jagd, live presence + Signalgruß + survey exchange, callsign moderation, travel-news feed (data model + endpoint + `VelgDispatchTicker` rendering) | Two concurrent playtesters on the same vector sight each other and complete a survey exchange; a published route is purchased and autopiloted by a second account; royalty ledger correct |
| **P2 — people** | Companions: bonded agents via the whisper refactor — extract a `WhisperTriggerStrategy` protocol (trigger selection + eligibility reads) from `whisper_service`; existing bond behavior moves unchanged into a `BondWhisperStrategy`, travel registers a `TravelWhisperStrategy` for the `travel_banter`/`quest_hook` contexts (not a drop-in — finding 9's resolution); foreign hires; threads 1–3, full Zerfaserung loop (wreck overlays, scars, Rekonvaleszenz, Identitätsbruch), Rettung (beacons channel, active distress mode), Mitfahrt, wreck-log moderation, `generate_wreck_log` | A playtester unravels, is rescued by another live player, and both find the Verbindung recorded (and the KPI 13 artifact assert passes) |
| **P3 — weather & frontier** | Global weather clock + storm archetypes (closed list of 4, levers validated), idle trickle, ghost islands (`ghost_island_lore` projection), Splitterfänger + dungeon-run handoff, relay mystery arc, threads 4–5, **Helm-Modus** (segment moves, frequency sweep, Trägerlicht with the Takt-mode beacon-stance parity toggle, **×5 time compression** (plan deviation from concept's ×4, see §17 row 4 — margin under KPI 4's 25% boundary); WebGPU/TSL re-evaluation point) | A storm visibly reroutes the playtest cohort; a Helm run completes a thread with Takt parity verified (KPI 8 pack checks + parity playtest) |
| **P4 — society** | Spuren (rolling cap, report queue, owner ledger), seasonal leaderboards (arbitrated rows only), chronicle classifieds, convoys (side-band channel, shared-instance variants over the P0 participant model), epoch interplay **advisory-only: cost/dissonance modifiers, never impassable** (KPI 9 constraint recorded since concept §18) | A convoy completes a shared Echo-Jagd and every member's record survives a mid-run drop-out |

Each phase ships behind its runtime gate (§13.2); each phase's content column (§18) is part of its definition of done.

---

## 21. Risks (delta to concept §20)

| Risk | Mitigation in this plan |
|---|---|
| P0a is the hidden platform — slippage risk concentrates there | P0a has no UI deliverables; its gate is purely CI/test-green, so it can land PR-by-PR behind the off gate |
| CAS-RPC family grows beyond review capacity | one RPC per PR with its race test in the same PR (the migration-221 discipline) |
| Dressing cache misses explode cost at content-thin launch | template fallback is always free; purpose-scope budget rows hard-stop spend; cache TTL 30 d |
| Chart regeneration with live players | `stable_key` contract + `fn_apply_chart_version` exists **before** any player data (P0a), first exercised at P1a under supervision |
| Bilingual content volume (≈ 52k words/locale) under-resourced | per-phase content table is gate-blocking; LLM-assisted drafting with owner review; generic/procedural layers carry the bulk of play |

---

## 22. Execution order & process notes

- Branch-per-sub-milestone (`feat/drift-p0a-…`), PRs into `main`, all behind `drift_p0_enabled=false` until gate D.
- Full lint pipeline after every change; `npm run lint:full` before every push; most-detailed commit messages; docs + memory updated at every step (not batched).
- `velg-frontend-design` skill before any component code; shared components checked before creating new ones.
- No `supabase db reset` ever without explicit approval; prod migrations applied via the established MCP/`db query --linked` flow after merge.

---

## 23. Gate-review traceability

Mapping of the 122 confirmed findings to plan sections. Final-report IDs (C1–C4, 1–80, U1); partial-report-only items listed by topic.

| Finding(s) | Addressed in |
|---|---|
| C1 cargo | concept §7.8 (v0.4) + §3.3 `travel_cargo`, §2.9 value flow |
| C2 storylet layer phase | §9, §19 P0a/P0c |
| C3 renderer | §11.2 (spike binding) |
| C4 Erstvermessung race | §3.2 `chart_honors`, §4 `fn_survey_deliver`, §12.2 |
| 1 RPC catalog (incl. run termination: complete/abandon, bidirectional dock) | §4 |
| 2 RLS posture | §5 |
| 3, 20 hospitality chokepoint incl. scatter/Spuren | §10, §4 (`fn_apply_quest_effects` family) |
| 4 endpoint split | §5 |
| 5 chart runtime mutation | §8.2 |
| 6, 11 pack pipeline dungeon-hardwired | §9.1 |
| 7 in-RPC audit | §3.1 helper, §4 |
| 8, 33 lifecycle owner + distress CAS | §13.1, §4 |
| 9 whisper reuse | §20 P2 (`WhisperTriggerStrategy` extraction, shape specified) |
| 10 skill-check reuse | §4 quest RPCs |
| 12, 54, 71 zone adjacency (incl. cross-city transit) | §3.7, §2.5 |
| 13 echo constraints / travel tables | §10 (emit_echo composes), §3.4 |
| 14 chronicle mentions | §3.5, §19.5 |
| 15 agent_travel_effects | §3.4 |
| 16–17 stale renderer text | resolved in concept v0.4; §11.2 |
| 18 Identitätsbruch | §4 `fn_zerfaserung` variant, §19.4 |
| 19, 53, 60 self-effects abroad / KPI 2 floor | §10 |
| 21 traveler_connections | §3.9, §12.3 |
| 22 moderation scope | §15 |
| 23, 68 missing KPIs | concept v0.4 KPIs 10–13; §17 (incl. plan-level KPI 14 frontier share) |
| 24 royalty abuse | §12.2, §4 |
| 25–26, 34–35 Mitfahrt | §12.3 |
| 27, 65 KPI 7 levers/closed lists | §17 row 7, §9.1 |
| 28 scar rules | §2.10 |
| 29, 62 KPI 4 (incl. Helm ×5 margin) | §17 row 4, §14.3, §20 P3 |
| 30, 42 KPI 3 flow/budget | §19.6 |
| 31 P0 dissonance sink | §2.1 sinks, §19 (Chapel) |
| 32 Rettung farming | §2.10, §12.3 |
| 36–37 Konvoi | §12.3, §3.3 participants |
| 38 weather camping | §2.1 idle trickle (P3) |
| 39 beacons channel | §12.1 |
| 40 wreck ownership | concept v0.4 §7.3 (forfeiture); §12.3 |
| 41 Spuren cap/budget | §15, §4 `fn_trace_write` |
| 43 frequency disclosure | §2.8 |
| 44 window suspend | §2.6 |
| 45 weather resume | §6.3 |
| 46 band-2 protocol | §11.3 |
| 47–48 a11y | §11.3 |
| 49 failure stakes | §2.10 Rekonvaleszenz |
| 50 distress dead time | §12.3 active distress mode |
| 51 locale | §9.3 |
| 52 chronicle trigger | §19.5/P0d |
| 55 EffectResolver ADR | §5 |
| 56, 77 chart versioning | §8 |
| 57 DSL spec | §9.2 |
| 58 ghost-island privacy | §3.9 |
| 59 KPI 1 universe | §9.2 (`from:` bounded), §17 row 1 |
| 61 KPI 3 instrumentation | §14.3 |
| 63 KPI 5 quality channel | §3.1 (`qualities`), §10 |
| 64 KPI 6 touchpoints | §9.4, §16.5 |
| 66 KPI 8 locus | §9.1, §17 row 8 |
| 67 KPI 9 carve-out | concept v0.4 §15.1; §12.3, §17 row 9 |
| 69 KPI enforcement table | §17 |
| 70 P0 sub-milestones | §19 |
| 72 failure floor | §19.4 |
| 73 P0 hospitality | §3.1 seeds, §19 |
| 74 weather phase | §20 P3 (clock+storms together) |
| 75 participants in P0 | §3.3 |
| 76 event-stream subset | §7 |
| 78 P1 split | §20 P1a/P1b |
| 79 content sizing | §18 |
| 80 phase done-criteria | §20 |
| U1 state authority | §1, §6.2 |
| Partial: Lacewing/ambassador FK | §3.6 |
| Partial: sim_type docking | §8.1 |
| Partial: sanctuary flag + view | §3.5 |
| Partial: ghost-island definition | §3.9 |
| Partial: ai_budget names, fail-open seeding, purposes=template_types, home-sim scoping, prompt-template default seeds | §9.3, §3.8 |
| Partial: layout generator | §8.1 |
| Partial: news-feed vs admin ticker | §3.9, §20 P1b |
| Partial: P0 frequency pair | §19 (memory/architecture) |
| Partial: stamps catalog split | §2.9 |
| Partial: convoy side-band | §12.1 |
| Partial: weather sampling wording | §6.3 (concept v0.4 fixed §6.5) |
| Partial: ceremony inventory | §11.4 |
| Partial: Statisches Ohr band gate | concept v0.4 §12; scar catalog P2 carries band gates |
| Partial: Zahlenwerk bundle (incl. noticeboard cadence §2.11, reputation mechanics §2.12) | §2 |
| Partial: run-lifecycle bundle | §6 |
| Partial: test/Sentry/admin/data-volume bundle | §14, §16, §13.3 |
| Partial: phase-gate semantics | §13.2 |
| Partial: autopilot weather | §20 P1b (rule recorded for P3) |
| Partial: epoch blockades | §20 P4 (advisory-only) |
| Partial: no field hull repair / retune budget | §2.1 |
| R2 (refuted) window-extension invariant | §2.6 (carried as hard invariant) |
