# DRIFT Concept Gate-Review — Teilergebnis (Session-Limit-Abbruch)

**Datum:** 2026-06-12 · **Workflow:** `drift-concept-gate-review` · **Run-ID:** `wf_4404dc9e-3db`
**Session:** `ca79adc1-b2ea-4426-82aa-21f5f7aa2d12` · ~4.29M Tokens verbraucht, dann Session-Limit (Reset 21:30 Europe/Vienna).

## Status

- Review-Phase **komplett**: 10 Dimension-Finder, **126 Findings** (alle im Journal persistiert).
- Verify-Phase **abgebrochen**: 45/310 Verifier gelaufen → **38 bestätigt**, **1 widerlegt**, **87 NICHT verifiziert** (im Workflow-Result fälschlich als 'refuted' mit leerem `why` abgelegt — das sind Limit-Ausfälle, keine Widerlegungen).
- Critique-Phase (Completeness-Critic): **nicht gelaufen** (0/1).

Resume-Quellen: Journal `~/.claude/projects/-Users-mleihs-Dev-velgarien-rebuild/ca79adc1-…/subagents/workflows/wf_4404dc9e-3db/journal.jsonl` (55 gecachte Agent-Resultate), Script `drift-concept-gate-review-wf_4404dc9e-3db.js` im Session-`workflows/scripts/`-Ordner.

## Bestätigte Findings (38)

### [MAJOR] Archivist Mossback no longer exists as an agent — renamed to Madam Lacewing in the Gaslit Reach retheme
*Dimension: codebase-tables · Abschnitt: 2 (pillar 3), 8.5, 9.3 (Mossbacks Konkordanz)*

**Claim:** The doc anchors the Gaslit Reach embassy questline on 'Archivist Mossback' ('her documented German-bureaucracy obsession is a ready-made thread bridging to Velgarien', 8.5) and names a launch thread 'Mossbacks Konkordanz' (9.3). KPI 1 requires every quest instance to reference live DB entities by id.

**Evidenz:** supabase/migrations/20260303300000_045_gaslit_reach_retheme.sql:98-104 renames the agent: 'Archivist Mossback → Madam Lacewing' with entirely new character/background ('Chief cartographer of the Reach... her left eye is glass') — the German-bureaucracy obsession is gone from the live agent row. Current canon (20260306101342_062_migrate_hardcoded_lore.sql:145, 20260303500000_047_agent_aptitude_draft.sql:801-802) consistently uses 'Madam Lacewing'; the archive role belongs to 'Archivist Quill'. 'Archivist Mossback' survives only as a stale name string inside embassy_metadata JSONB seeded pre-retheme (20260228200000_028_embassies.sql:489, 560, 584) and in an embassy building description (028:267) that migration 045 never updated. No agents row with that name exists.

**Empfehlung:** Before the plan doc: either re-anchor the thread and embassy questline on Madam Lacewing / Archivist Quill (and rewrite the Velgarien-bridge premise, since the bureaucracy obsession is not in any live row), or ship a canon-repair migration that updates the stale embassy_metadata and resurrects the intended character. Do not let the plan inherit a quest anchor that resolves to zero rows.

### [MAJOR] Embassy 'ambassadors' are unlinked JSONB name strings, not agent references
*Dimension: codebase-tables · Abschnitt: 8.1, 8.7 (ambassador bootstrap), 10 (foreign hires), 18 ('ambassadors as quest anchors')*

**Claim:** The doc treats ambassadors as first-class quest anchors and service brokers ('ambassador services', 'ambassadors broker temporary local guides', 'a new world has no ambassador until its first embassy is approved').

**Evidenz:** embassies.embassy_metadata stores ambassadors as jsonb_build_object('name', ..., 'role', ..., 'quirk', ...) with no agent_id FK (supabase/migrations/20260228200000_028_embassies.sql:489, 19-24 schema). Migration 030 (20260228400000) repairs ambassador ordering by matching a.name = embassy_metadata->'ambassador_a'->>'name' (lines 13-25) — linkage is name-string-based and silently breaks on agent rename, as already happened with Mossback. There is no ambassadors table and no embassy→agent relation anywhere in supabase/migrations/.

**Empfehlung:** The plan must define an ambassador data model: either add agent_id references into embassy_metadata (with a backfill/repair migration resolving current names, flagging the broken Mossback entries) or a proper embassy_ambassadors relation. Quest selectors keying off ambassadors cannot satisfy KPI 1 (reference by id) against the current shape.

### [MAJOR] 'Street connectivity defines adjacency' is unsupported — streets carry a single zone_id and never cross zone borders
*Dimension: codebase-tables · Abschnitt: 8.2, 8.7 ('the zone graph falls out of street connectivity')*

**Claim:** Begehung movement is built on a zone graph where 'street connectivity defines adjacency' (8.2) and 'the zone graph falls out of street connectivity' (8.7).

**Evidenz:** city_streets has exactly one nullable zone_id FK and a geojson LineString — no zone-pair or street-to-street connectivity model (supabase/migrations/20260215000002_geography.sql:37-48; fn_apply_map_geometry inserts streets with that same single zone_id, 20260510130000_236_fn_apply_map_geometry.sql:104-123). Worse, forge-generated streets are produced by recursively subdividing each zone polygon and clipping cut lines to that polygon ('only the part inside this zone is a street', backend/services/forge_map_generators.py:340-345, 374-377) — by construction a street never connects two zones. Zone adjacency therefore does not 'fall out' of anything; it must be derived from zone polygon border-sharing (zones.geojson, added in migration 235).

**Empfehlung:** The plan must specify a zone-adjacency derivation step (shapely polygon-adjacency in the ForgeMapService style, or a materialized zone_adjacency structure refreshed via the map-geometry pipeline) as net-new work, and correct the doc wording. The 8.7 list-shaped fallback for geometry-less sims is fine but is then the path for ALL pre-235 simulations whose zones lack geojson.

### [MAJOR] Docking rules keyed on simulations.status alone would put epoch game-instance clones on the chart
*Dimension: codebase-tables · Abschnitt: 8.7 (status rules), 7.1 (anchor layout)*

**Claim:** 8.7 defines dockability purely by status: 'active simulations are dockable; draft forge worlds are not...; archived simulations remain visible as Verstummte'.

**Evidenz:** simulations carry a second dimension the doc never mentions: simulation_type CHECK ('template','game_instance','archived') (supabase/migrations/20260228900000_035_game_instances.sql:22-23), and epoch clone instances additionally use statuses 'lobby','foundation','competition','reckoning' (backend/services/simulation_service.py:425). Resolved epoch instances are marked simulation_type='archived' (035:429-433) — so 'archived' exists both as a status and as a simulation_type with different meanings. The existing multiverse force map already special-cases this ('template nodes (inner ring) and game instance satellites', frontend/src/components/multiverse/map-force.ts:1-4).

**Empfehlung:** The plan's chart generator and Verstummte rules must filter on simulation_type='template' (plus status) and explicitly decide how epoch instances are excluded; otherwise every running epoch spawns spurious broadcast glows. Update 8.7 to state both dimensions.

### [MINOR] Renderer statements are internally inconsistent and partly superseded by the completed Three.js spike; CartographersDesk is misdescribed as a canvas
*Dimension: architecture-compliance · Abschnitt: 7.7 (Bottom line), 16, 23 (Appendix class A)*

**Claim:** Section 7.7's prose recommendation is Three.js orthographic (line 325, 'revised after LLM-production assessment'), but the same section's closing 'Bottom line' still says 'PixiJS v8 + fixed-timestep client sim...' (line 351), Appendix class A still says 'GLSL shaders + PixiJS scene graph' (line 646), and §16 hedges 'light-DOM render root per the world-map rule if MapLibre/WebGL is used; more likely a custom canvas like CartographersDesk's force graph' (line 546). The spike is done with Three.js (spikes/drift-chart-three/package.json: three 0.184.0, classic WebGL/EffectComposer), which makes the light-DOM rule unconditional, not 'if WebGL is used'. CartographersDesk is also not a canvas precedent — it is a shadow-DOM Lit component with no canvas context.

**Evidenz:** Doc lines 325 vs 351 vs 546 vs 646. /Users/mleihs/Dev/velgarien-rebuild/spikes/drift-chart-three/package.json (three 0.184.0). /Users/mleihs/Dev/velgarien-rebuild/frontend/src/components/map/CartographersDesk.ts — no getContext/canvas usage (grep over file returned none); standard LitElement (lines 1-10). CLAUDE.md: 'Never put MapLibre or other canvas-heavy WebGL components inside Shadow DOM.'

**Empfehlung:** Before the plan doc: rewrite 7.7 'Bottom line' and Appendix class A to Three.js (keep PixiJS as the documented alternative track), and change §16 to state unconditionally that the drift chart component family uses a light-DOM render root with getRootNode()-scoped style injection per the SimulationWorldMap reference pattern.

### [MINOR] Effect-vocabulary schema touchpoints are wrong or unresolved: agent_loot_effects does not exist; journal_fragments source_type CHECK is closed; chronicle_mention has no write target
*Dimension: architecture-compliance · Abschnitt: 11 (effect table)*

**Claim:** The effect table maps grant_agent_effect → 'agent_loot_effects' (line 466), but no such table exists — the actual table is agent_dungeon_loot_effects. emit_fragment → journal_fragments 'new source_type travel' (line 468) requires altering a closed CHECK constraint (current values: dungeon, epoch, simulation, bond, achievement, bleed). chronicle_mention → 'chronicle aggregation' (line 469) names no table or mechanism at all.

**Evidenz:** /Users/mleihs/Dev/velgarien-rebuild/supabase/migrations/20260327200000_164_resonance_dungeon_rpcs.sql:23 (CREATE TABLE IF NOT EXISTS agent_dungeon_loot_effects); /Users/mleihs/Dev/velgarien-rebuild/supabase/migrations/20260421600000_232_journal_foundation.sql:97-102 (source_type CHECK IN ('dungeon','epoch','simulation','bond','achievement','bleed')).

**Empfehlung:** Fix the table name in the doc (and decide whether reusing a dungeon-named table for travel boons is acceptable or whether a rename/general table is needed); the plan must include the journal_fragments CHECK-constraint migration and name the concrete chronicle_mention write path (table/RPC feeding chronicle generation).

### [MINOR] Hospitality setting absence semantics undefined: doc default 'nur Echos' vs fail-closed contract when the settings row is missing
*Dimension: architecture-compliance · Abschnitt: 8.7, 11*

**Claim:** 8.7 sets the hospitality default for new worlds to 'nur Echos' (line 398) and ch. 11 stores it in per-sim simulation_settings (line 473). Nothing defines behavior when the row is absent (pre-existing simulations never seeded, migration-lag window). The platform's hard-learned settings rules (CLAUDE.md F7/F32) require fail-closed reads and upsert-based writes; a missing-row read silently defaulting to 'nur Echos' (mid-scale) instead of 'geschlossen' would grant trace permissions no owner opted into.

**Evidenz:** Doc lines 398, 473. CLAUDE.md NEVER rules on platform_settings upsert (F7) and fail-closed parse_setting_bool (F32) document the project's missing-row/None-value failure class; simulation_settings is the same key-value pattern (ADR-002, docs/adr/002-settings-key-value-store.md).

**Empfehlung:** Plan must specify: hospitality reads fail-closed to 'geschlossen' when the key is absent, plus a migration seeding 'nur Echos' for all existing active simulations (making the 8.7 default explicit data, not code fallback), with writes via the established settings upsert path.

### [MINOR] Geisterinsel source 'abandoned forge drafts' has no operational definition in the forge_drafts status model
*Dimension: architecture-compliance · Abschnitt: 7.3, 8.7*

**Claim:** Geisterinseln are sourced from 'a never-materialized forge draft' (line 250) and 8.7 distinguishes 'draft forge worlds... (abandoned ones surface as Geisterinseln)' (line 397). The forge_drafts status CHECK only knows 'draft', 'processing', 'completed', 'failed' — there is no 'abandoned' state, so the doc's distinction between an in-progress draft (not on chart) and an abandoned one (ghost island) is undefined, and surfacing a draft a user is actively still editing as explorable content would leak work-in-progress.

**Evidenz:** /Users/mleihs/Dev/velgarien-rebuild/supabase/migrations/20260305500000_055_forge_infrastructure.sql:57-58 (status CHECK IN ('draft','processing','failed','completed') — no 'abandoned'). Doc lines 250-251, 397.

**Empfehlung:** Plan must define 'abandoned' operationally (e.g., status='draft' AND updated_at older than N days, or status='failed'), decide whether draft owners can opt out, and confirm which forge_drafts blueprint fields the ghost-island storylet generator may read (privacy: drafts are user-owned rows).

### [MINOR] Generation façade claims are sound but misname the budget table and ignore that GenerationService is simulation-scoped — Zwischenraum content has no simulation
*Dimension: codebase-systems · Abschnitt: §9.1, §17 Generation façade ("budget purposes travel_narrative / dispatch_flavor under existing ai_budget_caps + circuit breaker")*

**Claim:** New façade methods slot into existing per-sim prompt templates, ai_budget_caps purposes, and the circuit breaker.

**Evidenz:** Façade pattern, per-sim prompt overrides (ADR-004, prompt_templates with simulation_id-null platform defaults — backend/services/prompt_template_service.py:36-60), budget enforcement and circuit breaker all verified. But: the budget table is ai_budget, not ai_budget_caps (supabase/migrations/20260421200000_228_bureau_ops.sql:55-57); the budget purpose actually billed is the TEMPLATE TYPE, not a free-chosen purpose string (GenerationService._generate passes purpose=template_type to BudgetContext, backend/services/generation_service.py:1038 and 1071-1075); and GenerationService/PromptResolver/ModelResolver are constructed with a required simulation_id (generation_service.py:48-60) — generate_wreck_log and drift-storylet dressing happen between simulations, where no sim context exists.

**Empfehlung:** Fix the table name in the doc. The plan must (a) name the new template_types so they double as the intended budget purposes (e.g. 'travel_narrative', 'dispatch_flavor'), (b) seed platform-default prompt_templates rows for them, and (c) decide the scoping rule for Zwischenraum generation (bill/resolve against the Träger's home simulation is the obvious default — state it).

### [MINOR] No seed-deterministic force layout exists; "same force-layout family as CartographersDesk" names the wrong component and non-reusable code
*Dimension: codebase-systems · Abschnitt: §7.1 (Topology — anchor layout), §16*

**Claim:** Chart is "generated deterministically from a seed" with simulations "positioned via the same force-layout family as CartographersDesk".

**Evidenz:** CartographersDesk.ts is the per-simulation zone-schematic wrapper around CartographicMap (frontend/src/components/map/CartographersDesk.ts:9-14), not a force layout. The actual multiverse force layout is frontend/src/components/multiverse/map-force.ts — client-side, initialized from viewport width/height (initializePositions, lines 22-35), with Math.random() jitter for coincident nodes (lines 122-123) and rAF-driven convergence; MapGraph3D uses d3-force-3d, also client-side. Nothing existing is seeded, server-side, or run-to-run deterministic, while §17 requires drift_chart_nodes/edges to be seeded and versioned in the DB.

**Empfehlung:** The plan must scope a NEW server-side deterministic layout generator (Python, seeded PRNG, fixed iteration count, viewport-independent coordinate space) for chart generation/regeneration under chart_version. Correct the doc's component reference so the plan doesn't look for reusable layout code that isn't there.

### [MINOR] The existing dispatch ticker is an admin-only ops audit crawl, not a player-facing platform news feed
*Dimension: codebase-systems · Abschnitt: §13 (forecasts "in the Bureau dispatch ticker"), §14 (ticker mentions Träger feats), §17 Reuse ("dispatch ticker (travel news)")*

**Claim:** Doc lists the dispatch ticker as an existing system that travel news plugs into.

**Evidenz:** DispatchTicker is an admin cockpit footer that polls /admin/ops/audit (ops_audit_log) every 30s and renders the last 20 admin audit entries (frontend/src/components/admin/ops/DispatchTicker.ts:1-31). It is not visible to players and its data source is operator audit actions. Only the shared UI primitive VelgDispatchTicker (frontend/src/components/shared/VelgDispatchTicker.ts) is genuinely reusable.

**Empfehlung:** The plan must add a player-facing travel-news feed (data model + public/member endpoint + placement) and reuse only the VelgDispatchTicker primitive for rendering. Re-label §17's reuse entry accordingly so the feed isn't assumed to exist.

### [MINOR] Four 'reuse' integration points are closed CHECK/ENUM constraints requiring schema migrations the doc presents as drop-in
*Dimension: codebase-tables · Abschnitt: 11 (emit_fragment, inject_agent_memory), 14 (attunements travel_option), 17 ('achievement system (travel category)')*

**Claim:** Travel feeds journal_fragments via 'new source_type travel'; attunements 'get a travel_option system hook'; achievements get a 'travel category'; inject_agent_memory writes agent_memories.

**Evidenz:** (1) journal_fragments.source_type AND fragment_type are both closed CHECKs — 6 values each, no 'travel' (supabase/migrations/20260421600000_232:84-101); a new source_type also needs a fragment_type mapping decision. (2) agent_memories.source_type is a Postgres ENUM memory_source_type ('chat','event_reaction','system','reflection') (20260306152755_067:8) — needs ALTER TYPE ADD VALUE or masquerading as 'system'; additionally agent_memories.embedding vector(1536) must be populated at write time for the promised semantic recall (retrieve_agent_memories weights embedding similarity 0.4, 067:36-60), meaning each inject_agent_memory implies an embedding API call — an AI cost class not covered by the 'prose-only generation' mitigation in section 20. (3) journal_attunements.system_hook CHECK allows only dungeon_option/epoch_option/simulation_option (232:57-63). (4) achievement_definitions.category CHECK has 7 values, no 'travel' (20260410400000_190:21-24).

**Empfehlung:** The plan should carry one consolidated 'constraint extension' migration work package listing all four, plus the fragment_type mapping and the embedding-generation write path (route through AgentMemoryService, budget the embedding cost under a purpose row).

### [MINOR] event_echoes shape constrains emit_echo and Zerfaserung scatter: NOT NULL source event, depth cap 3, no self-echo
*Dimension: codebase-tables · Abschnitt: 11 (emit_echo), 12 (Zerfaserung step 1), 9.4 (Echo-Jagd)*

**Claim:** Zerfaserung 'scatters cargo as event_echoes addressed to random reachable simulations'; emit_echo is a standalone effect ('vector + strength'); Echo-Jagd traces 'each hop (echo_depth)'.

**Evidenz:** event_echoes.source_event_id is NOT NULL REFERENCES events (supabase/migrations/20260228000000_026:34) — an echo cannot exist without first creating a source events row, so 'scatter as echoes' is really 'spawn event(s) + echoes'. echo_depth is CHECK BETWEEN 1 AND 3 (026:40), capping Echo-Jagd chains at 3 hops. no_self_echo forbids addressing the Träger's home sim (026:47). Writes are service_role-only by design (026:148-149). Column names are echo_vector/echo_strength, not vector/strength.

**Empfehlung:** Plan the effect resolver so emit_echo composes spawn_event + echo rows in one RPC; design Echo-Jagd around the hard 3-hop ceiling; document that scatter targets exclude the home simulation.

### [MINOR] Force-layout precedent misattributed: CartographersDesk is an SVG zone schematic, not the multiverse force graph
*Dimension: codebase-tables · Abschnitt: 7.1 (anchor layout), 16 (Drift chart UI)*

**Claim:** 'simulations positioned via the same force-layout family as CartographersDesk' (7.1) and 'a custom canvas like CartographersDesk's force graph' (16).

**Evidenz:** frontend/src/components/map/CartographersDesk.ts is an atmospheric container around CartographicMap, which renders ZoneTopology[] (one simulation's zones) as SVG with procedural placement — no force code (CartographicMap.ts:6, 330, 366-371, 607-636). The actual multiverse force layout lives in frontend/src/components/multiverse/map-force.ts ('Force-directed layout for multiverse map... Coulomb repulsion + Hooke attraction', lines 1-5), consumed by multiverse/CartographerMap.ts (which is SVG/3D, not canvas).

**Empfehlung:** The plan should reference components/multiverse/map-force.ts + CartographerMap.ts as the seed-layout precedent and place the new chart under components/drift/ as the doc says; fix the two component-name references so implementers fork the right code.

### [MINOR] AI budget mechanism misnamed: 'ai_budget_caps' does not exist
*Dimension: codebase-tables · Abschnitt: 17 (Generation façade), 22.5*

**Claim:** Budget purposes travel_narrative / dispatch_flavor run 'under existing ai_budget_caps + circuit breaker'; 22.5 references 'ai_budget_caps' for the Spuren LLM filter.

**Evidenz:** The actual mechanism (migration 228, Bureau Ops) is the ai_budget table with scope IN ('global','purpose','simulation','user') and seeded purpose rows ('forge','heartbeat','chat_memory') plus ai_circuit_state for the kill switch (supabase/migrations/20260421200000_228:37-77, 138-140); enforcement is BudgetEnforcementService (referenced at 228:78). No object named ai_budget_caps exists in migrations or backend/.

**Empfehlung:** Correct the name in the doc so the plan targets ai_budget purpose rows + BudgetEnforcementService + ai_circuit_state directly (the pattern itself is fully reusable — new purpose rows are data, not schema).

### [MINOR] P0 frequency pair (memory/language) does not match the seeded Velgarien↔Gaslit-Reach corridor
*Dimension: codebase-tables · Abschnitt: 19 (P0 vertical slice)*

**Claim:** P0 is 'Velgarien ↔ Gaslit Reach via the seeded Threshold embassy... one frequency pair (memory/language)'.

**Evidenz:** The seeded Velgarien↔Gaslit-Reach (ex Capybara Kingdom) connection has bleed_vectors = ARRAY['memory','architecture'] (supabase/migrations/20260228000000_026:286-289) and the Threshold embassy's bleed_vector is 'memory' (20260228200000_028:477-495, value at the insert). 'language' is seeded on the Velgarien↔Speranza connection (ARRAY['commerce','language'], 026:296-299). Since 7.2 derives edge permeability from connection bleed_vectors, the language layer would have no seeded support on the P0 corridor.

**Empfehlung:** Either change P0's pair to memory/architecture (matching seeded data) or have the plan explicitly state that the language frequency on this corridor is procedurally thin by design. Don't let the plan copy the pair verbatim.

### [MINOR] KPI 7 (Peacock-Wind: two levers in tension) is violated by the doc's own storm and node-type examples
*Dimension: consistency · Abschnitt: §21 KPI 7 vs §13 and §7.3*

**Claim:** KPI 7 demands 'every named chart phenomenon (storm, node type, cargo family) pulls at least two resource levers in tension'. The doc's own examples fail it: The Prometheus gives two pure benefits (scan range ↑, ghost islands more stable — no tension), The Tower pulls one lever (corridor collapses), and node types Relais (rest + free retune + quests), Echo-Untiefe (harvest) and Träger-Wrack (salvage) are written as benefit-only. If the plan doc copies these definitions, the 'testable contract' is failed on day one.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:619 (KPI 7 text), :492 ('The Tower (a corridor collapses for the duration ...), The Prometheus (scan range ↑, ghost islands more stable)'), :248-253 (node-type table: Relais/Echo-Untiefe/Träger-Wrack rows list no cost/risk lever).

**Empfehlung:** Either add the tension lever to each example (e.g. Prometheus: scan ↑ but false-ping rate ↑; Relais: rest attracts Splitterfänger; Echo-Untiefe: harvesting raises Dissonanz) or scope KPI 7 to storms + cargo families only. Resolve before the plan doc copies the tables verbatim.

### [MINOR] The `sanctuary` building attribute is 'to-be-defined' in §6.3 but absent from the §17 architecture mapping
*Dimension: consistency · Abschnitt: §6.3 sinks vs §17*

**Claim:** Dissonance sinks depend on 'any building with a to-be-defined `sanctuary` special attribute' — a schema change to platform building data (or a new special_type value) that the architecture section never lists among new tables/columns. P0's loop already needs dissonance sinks; if the plan doc builds its schema list from §17, this dependency is silently dropped.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:203 ('any building with a to-be-defined `sanctuary` special attribute'), :559-564 (§17 lists new tables/RPCs/services — no buildings change, no sanctuary mention).

**Empfehlung:** Add the sanctuary mechanism to §17 (likely a `special_type` value or building metadata flag, noting the CLAUDE.md rule that any `buildings` column addition must refresh the `active_buildings` view in the same migration) and decide whether P0 ships it or hardcodes the two named sanctuary buildings.

### [MINOR] No in-field Kohärenz restoration at any price makes frequency-layer exploration double-pay; the 7.2 retune economy has no counterpart sink-relief
*Dimension: design-economy · Abschnitt: 6.1 (line 185), 7.2 (line 237), 7.3 (line 248)*

**Claim:** Kohärenz is restored only fully at home, partially at embassies (Siegel), and via 'rare storylet outcomes'. Umstimmung (retuning) costs Kohärenz, and 7.2's whole promise — seven exploration layers over one topology, route puzzles that demand frequency switching — requires frequent retunes at the frontier, exactly where no embassy exists. Relais offer free retunes and dissonance rest but no Kohärenz, so multi-layer frontier exploration burns hull with no recovery option at any price until home. This may be intended (limp-home loop), but the doc neither affirms it as a rule nor gives the plan a retunes-per-run envelope to tune against.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:185 — 'Restored: fully at home (over Takte), partially at embassies (Siegel cost), rare storylet outcomes'; :237 — 'Retuning (Umstimmung) … costs Kohärenz + 1 Takt; some relays retune for free'; :248 — Relais: 'rest (dissonance −), free retune' (no Kohärenz).

**Empfehlung:** Plan should either add a capped Kohärenz patch at Relais (Siegel or storylet-priced) or explicitly state 'no field hull repair' as a design rule with a target retune budget per frontier run, so 7.2's layer-hopping and 6.1's costs are tuned against each other deliberately.

### [MINOR] Autopilot vs global-wall-clock weather interaction is undefined — the commute click can become storm-immunity
*Dimension: design-economy · Abschnitt: 7.4 (line 261) vs 13 (line 492), 15.2 (line 516)*

**Claim:** Weather advances on server wall-clock and storms impose costs/hazards (Deluge raises bandwidth costs, Resonanzsturm cells damage Kohärenz, Tower collapses corridors). Autopilot traverses a whole surveyed route 'in one action' — the doc never says whether that action samples weather along the path, pays storm-modified costs, can pass through an active storm cell without hazard contact, or is blocked by a Tower-collapsed corridor. If autopilot ignores en-route weather, the commute click neutralizes the entire weather economy on known space, which is most of where veterans travel.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:261 — 'traversed in one action at full resource cost'; :492 — storm archetype economy effects; :516 — 'storms advance on server time; a player's Takt samples current global weather' (single-sample semantics for a multi-edge instant traversal left undefined).

**Empfehlung:** Plan must define autopilot weather semantics: route is re-priced edge-by-edge against current weather at execution time, autopilot refuses to enter active hazard cells (forcing manual play or reroute), and collapsed corridors invalidate the route. One paragraph in the plan prevents a veteran-facing economy hole.

### [MINOR] Cosmetic stamps are double-sold: a Siegel sink in 6.4 and a forge_token product in Decision 3
*Dimension: design-economy · Abschnitt: 6.4 (line 209) vs 22.3 (line 631)*

**Claim:** 6.4 lists 'cosmetic stamps' as a Siegel sink — structurally important because cosmetics are the only unbounded endgame Siegel sink in the design (see the window-extension finding). Decision 3 then assigns 'stamps' to forge_tokens ('forge_tokens buy cosmetics only (stamps, callsign flair, wreck-log styling)'). If the same stamp catalog is purchasable with real-money-adjacent forge_tokens, the Siegel cosmetic sink is cannibalized and late-game Siegel has nowhere to go; it also blurs the 'strictly cosmetic' boundary audit (which currency bought what).

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:209 — Siegel spent on 'cosmetic stamps'; :631 — 'forge_tokens buy cosmetics only (stamps, callsign flair, wreck-log styling). No bandwidth, no window extensions, no Siegel purchasable.'

**Empfehlung:** Plan should split the catalogs explicitly: Bureau-earned stamps (clearance/feat-gated, Siegel-priced, the prestige line) vs forge_token vanity flair (never overlapping items), and state that no item exists in both currencies.

### [MINOR] Mixed-frequency convoy sight contradicts 15.2's load-bearing law at both the fiction and the transport layer: the sharded channel scheme cannot deliver cross-frequency visibility
*Dimension: design-multiplayer · Abschnitt: 15.6 / 15.2 / 15.8*

**Claim:** 15.2 (line 514) declares same-frequency-only sighting 'the load-bearing original idea' where fiction, social texture, and the scaling story 'are the same mechanism'. 15.6 (line 532) then grants linked Träger sight 'regardless of tuning' with no diegetic justification, and 15.8's transport design (line 540: channels sharded `drift:freq:<vector>:cell:<region>`) makes it technically impossible as specified — convoy members tuned to different vectors sit in different presence channels and never receive each other's broadcasts. The platform's RealtimeService precedent (frontend/src/services/realtime/RealtimeService.ts:12-17) is one channel per scope, so the plan will inherit this gap verbatim.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md lines 514, 532, 540; frontend/src/services/realtime/RealtimeService.ts:12-17 (channel-per-scope pattern, Presence/Broadcast in real use at lines 152/171).

**Empfehlung:** Two sentences fix both layers: diegetically, the convoy link IS a mutual attunement (members carry each other's frequencies as a side-band — consistent with 'company keeps a self coherent'); technically, a convoy subscribes its members to an additional `drift:convoy:<id>` channel for intra-convoy presence while frequency/cell channels remain the public layer. State this in 15.8 so the plan's channel design includes it.

### [MINOR] Section 6.5 'Weather advances per Takt' directly contradicts the binding global wall-clock decision in 15.2/17
*Dimension: design-multiplayer · Abschnitt: 6.5 vs 15.2 / 17*

**Claim:** 6.5 (line 213) states 'Weather advances per Takt', while 15.2 (line 516) fixes as a prerequisite that 'the weather clock is global wall-clock, not per-player Takte — storms advance on server time; a player's Takt samples current global weather', and 17 (line 560) repeats 'never per-player'. A plan author implementing from chapter 6 (the resources chapter, the natural first read) would build per-player weather — the exact model the multiplayer chapter forbids.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md line 213 vs lines 516 and 560.

**Empfehlung:** Fix the stale sentence in 6.5 to 'Weather is sampled per Takt from the global wall-clock weather state (see 15.2)'. One-line doc edit; do it before the plan doc is drafted.

### [MINOR] KPI 9 as written is untestable and already violated by every opt-in group feature in chapter 15 — it needs an explicit consent carve-out
*Dimension: design-multiplayer · Abschnitt: 21 (KPI 9) / 15.1 / 15.5 / 15.6*

**Claim:** KPI 9 (line 621) and 15.1 (line 510) state 'no player action can ever block, damage or slow another player's run' as an absolute, but chapter 15's own opt-in features violate the letter: convoy members wait on each other's commits up to a 'generous timeout' (slowing, line 532), storm effects 'hit the group jointly' (damage caused by another's route commit, line 532), and a passenger's progress depends entirely on the ferry's choices (line 528). A plan team treating KPI 9 as a testable contract (the section is titled 'testable contracts') will either fail these features against it or quietly ignore the KPI — both bad outcomes.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md lines 621, 510 vs 532, 528.

**Empfehlung:** Amend KPI 9 with a consent clause: 'outside explicitly opted-in groupings (Konvoi, Mitfahrt, Rettung donation); within a grouping, any member can unilaterally exit at any time at no cost beyond their current position'. The exit guarantee is what makes the carve-out safe and testable — and it dovetails with the lockstep and abandonment findings above.

### [MINOR] Doc contradicts itself on the renderer in three places despite the spike being resolved
*Dimension: game-design-ux · Abschnitt: Sections 7.7 ('Bottom line'), 16, Appendix 23*

**Claim:** The 7.7 recommendation paragraph picks Three.js, but the same section's 'Bottom line' still reads 'PixiJS v8 + fixed-timestep client sim + checkpoint-validating RPCs'; Appendix 23 class A specifies 'GLSL shaders + PixiJS scene graph' and class C says 'the Pixi canvas reads its palette from CSS custom properties'; section 16 hedges a third way ('more likely a custom canvas like CartographersDesk's force graph'). The spike has since resolved this definitively to Three.js on the classic WebGL/EffectComposer path (explicitly NOT WebGPU/TSL, re-evaluate at P3). A plan author skimming 7.7's bottom line or Appendix 23 could inherit the stale choice.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md lines 325 (Three.js recommendation), 351 ('Bottom line: PixiJS v8 ...'), 546 ('more likely a custom canvas'), 646/648 (Appendix 23 'PixiJS scene graph' / 'the Pixi canvas'). Resolution: spikes/drift-chart-three/README.md lines 16-25 (all spike criteria verified incl. 5000 nodes @ 120fps) and 36-48 (classic WebGL path decision, sRGB gotcha, what ports to production).

**Empfehlung:** Before the plan doc, update 7.7's bottom line, section 16, and Appendix 23 to Three.js/WebGL as decided, and fold the spike README's production-relevant decisions (classic render path with P3 WebGPU re-evaluation, bitmask crossfade technique, controller/bloom constants, the sRGB background trap) into the doc or reference the README from 7.7 as the binding decision record.

### [MINOR] Ceremony inventory incomplete: the doc's biggest dramatic moments have no UI specification
*Dimension: game-design-ux · Abschnitt: Sections 16, 8.1, 12, 7.1, 15.4*

**Claim:** Section 16 names exactly two ceremonial moments (Entladung, Erstvermessung) for the 480-900ms ceremonial animation tier, and Entladung's spec is five words ('ceremony UI, one reveal per item'). Moments the doc hypes harder than either are never specified as UI at all: arrival/docking (8.1 - the threshold moment of the entire travel fantasy, crossing from chart into a living world, has zero presentation language); the Zerfaserung sequence itself (pillar 5's signature, specified only as a 'death modal' for log composition); Erstkontakt ('the rarest chart flag', 7.1); Bergung (15.4); and Umstimmung (the 'physical dial' frequency retune, 16). Per the project's microanimation contract (180-280ms reactive / 480-900ms ceremonial, prefers-reduced-motion honored), the ceremonial tier needs a complete inventory before component planning.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md lines 551 (only two ceremonial moments named), 498 (Entladung's five-word spec), 357-359 (8.1 arrival - mechanics only, no presentation), 482 (death modal as the only Zerfaserung UI), 229 (Erstkontakt flag), 524 (Bergung). User feedback memory mandates the two-tier microanimation language for state changes.

**Empfehlung:** The plan doc's UI section should carry a full ceremony inventory table: moment, tier (reactive/ceremonial), duration band, reduced-motion fallback - covering at minimum docking/arrival, Entladung, Erstvermessung, Erstkontakt, Umstimmung, Zerfaserung (scatter -> wreck -> wake-at-anchor as a staged sequence), Bergung, and first crossing of the home broadcast edge on return.

### [MINOR] Renderer decision internally inconsistent and stale versus the completed spike
*Dimension: gaps-planreadiness · Abschnitt: 7.7 (Bottom line), Appendix 23*

**Claim:** Section 7.7's table recommends Three.js orthographic, but its own 'Bottom line' still says 'PixiJS v8 + fixed-timestep client sim', and Appendix 23 asset classes A and C still say 'PixiJS scene graph' / 'the Pixi canvas reads its palette'. Meanwhile the spike is done and locked further decisions (classic WebGL/EffectComposer path, NOT WebGPU/TSL; GLSL1 bitmask crossfade; sRGB background constraint; bespoke pan/zoom constants) that the concept doesn't carry.

**Evidenz:** Concept line 325 (Three.js recommendation), line 351 ('Bottom line: PixiJS v8 + …'), lines 646/648 (Pixi in Appendix classes A and C). spikes/drift-chart-three/README.md — all spike criteria verified 2026-06-12 (5000 nodes @ 120fps, bloom, crossfade, dissonance grade pass), decision 'Klassischer Render-Pfad (WebGLRenderer + EffectComposer + GLSL), NICHT WebGPURenderer/TSL', plus the production-carryover list.

**Empfehlung:** Update 7.7's bottom line and Appendix 23 to Three.js classic-WebGL, and import the spike's locked decisions (renderer path, shader technique, controller/bloom constants, sRGB lesson, re-evaluate WebGPU at P3) into the concept or directly into the plan as fixed inputs, so the plan doesn't quote the stale Pixi stack.

### [MINOR] Schema-name drift: effect vocabulary and infra references name tables/columns that don't exist as written
*Dimension: gaps-planreadiness · Abschnitt: 11, 17, 20*

**Claim:** Four references will send the plan author hunting for the wrong objects: (a) `grant_agent_effect` targets 'agent_loot_effects' — the real table is `agent_dungeon_loot_effects` with a closed dungeon-specific effect_type CHECK and an FK to resonance_dungeon_runs, so reuse needs a constraint/FK migration or a new table; (b) the budget infra is the `ai_budget` table, not 'ai_budget_caps'; (c) journal_fragments' source_type CHECK does not include 'travel' — adding it is a migration, not just a new value; (d) the events cap column is `impact_level` (1–10), not 'impact'.

**Evidenz:** Concept line 466 (`agent_loot_effects`), line 563 ('ai_budget_caps'), line 468 ('new source_type `travel`'), line 463 ('impact-capped'). supabase/migrations/20260327200000_164_resonance_dungeon_rpcs.sql:23-33 (`agent_dungeon_loot_effects`, effect_type CHECK IN ('aptitude_boost','permanent_dungeon_bonus','next_dungeon_bonus','event_modifier','arc_modifier'), source_run_id FK); 20260421200000_228_bureau_ops.sql:57 (`CREATE TABLE ai_budget`); 20260421600000_232_journal_foundation.sql:97-102 (source_type CHECK IN ('dungeon','epoch','simulation','bond','achievement','bleed')); 20260215000003_entities.sql:89 (`impact_level integer ... CHECK (impact_level >= 1 AND impact_level <= 10)`).

**Empfehlung:** Correct the four names in the doc; the plan must budget two constraint migrations (journal source_type + loot-effects reuse decision) and decide reuse-vs-new-table for travel boons explicitly.

### [MINOR] Traveler-UGC moderation decision covers Spuren only, but the concept creates three more freeform UGC surfaces
*Dimension: gaps-planreadiness · Abschnitt: 12, 15.2, 15.7, 22.5*

**Claim:** Decision 22.5 (hybrid auto-filter + post-moderation) is scoped to Spuren. But wreck final logs are 'player-composed in the death modal' and readable by every salvager; callsigns render to all same-frequency players; Erstvermessung names and published-route listings render permanently on the shared chart. No filter or report path is specified for any of these, and no wordlist infrastructure exists in the repo today to reuse.

**Evidenz:** Concept line 482 (player-composed final log), line 514 (callsign visible to others), line 260 (permanent 'Erstvermessung: <player>' flags, publishable routes), line 633 (decision scoped to Spuren). Repo grep for profanity/wordlist/banned_word/blocklist across backend/ and supabase/migrations/ finds no general-purpose filter (only instagram_content_service surfaced, with no wordlist hits).

**Empfehlung:** Extend decision 5's hybrid filter + report flow to all traveler-authored strings (wreck logs, callsigns, route names); record in the concept that the wordlist source is net-new platform work the plan must scope.

### [MINOR] Plan inputs (bundle 3): testing, observability, admin surfaces and data-volume design are absent from the concept
*Dimension: gaps-planreadiness · Abschnitt: 17, 20, 21 (gaps)*

**Claim:** The concept never mentions a test strategy (its KPIs are called 'testable contracts' but no testing approach exists), Sentry tagging for the five new services (mandatory per project contract), the admin/owner surfaces it implies (hospitality setting UI, owner-visible trace ledger, Spuren report queue, travel content-pack admin), or data-volume design: `traveler_discoveries` grows as users x nodes (index/partition plan needed), chart payload size at ~5k nodes with per-frequency edge data is unbudgeted, and the §20 mitigation 'chart/world reads are cache-friendly' (line 607) does not hold for the per-player FoW layer — FoW reads are per-user by definition and security-relevant (shipping undiscovered node positions to the client undermines the Vermessung economy).

**Evidenz:** Concept line 607 (cache-friendly claim vs. per-user FoW in `traveler_discoveries`, line 559); no occurrence of 'test', 'Sentry', or an admin-surface section anywhere in the 662-line doc. CLAUDE.md requires every layer independently testable and captureError/push_scope tagging on all failure paths.

**Empfehlung:** The plan doc must carry four sections the concept omits: test strategy per layer (RPC integration tests like migration-221 pattern, pack schema CI, frontend component tests), Sentry tags per new service + simulation_id, admin surfaces (hospitality UI in sim settings, trace ledger, report queue), and a data-volume/caching section that separates the public shared chart (cacheable) from per-user FoW (not cacheable, server-filtered).

### [MINOR] Phase gates: composition, ordering, and mid-run shutdown semantics are undefined for stateful gameplay
*Dimension: phasing-scope · Abschnitt: 19 (line 593)*

**Claim:** 'Each phase ships behind a platform setting gate, alpha-suite style' — but the alpha suite gates stateless UI, whereas DRIFT gates persistent runs with resources at stake. Undefined: whether gates are cumulative (can P2 companions be on while P1 presence is off?), what happens to in-flight travel_runs/convoys/distress windows when a gate is turned off, and whether gates are per-phase keys or per-feature keys (Rettung and Mitfahrt are both 'P2' but operationally independent).

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:593. Contrast: the alpha-suite gate is a build-time constant plus a narrow modal toggle (CLAUDE.md Alpha Suite section); nothing analogous exists for runtime-gated stateful game modes. The fail-closed parse_setting_bool semantics (CLAUDE.md NEVER list) mean unseeded keys read as off — good default, but mid-run off-switch behavior still needs a rule.

**Empfehlung:** Plan defines: per-feature gate keys grouped by phase with a documented dependency order; gate-off semantics = no new runs start, in-flight runs complete (or are checkpoint-frozen with resources intact); a single kill-switch key that force-returns all travelers home without loss (the emergency brake pattern already used in Bureau Ops P0).

### [MINOR] Stale renderer 'bottom line' (PixiJS v8) and appendix asset-class text contradict the resolved Three.js spike
*Dimension: phasing-scope · Abschnitt: 7.7 + Appendix 23 vs spike*

**Claim:** 7.7's closing line still reads 'Bottom line: PixiJS v8 + fixed-timestep client sim + checkpoint-validating RPCs + Supabase Realtime presence', and appendix class A still says 'GLSL shaders + PixiJS scene graph' — contradicting both the in-doc recommendation (Three.js orthographic, line 325) and the completed spike, which verified Three.js 0.184.0 (classic WebGL/EffectComposer) at 120fps with 5000 instanced nodes, bloom, frequency crossfade and the dissonance grade pass. A plan author skimming for the decision will land on the PixiJS sentence.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:351 ('Bottom line: PixiJS v8 ...'), :646 (class A: 'PixiJS scene graph') vs :325 (Three.js recommendation) and :659. Spike: spikes/drift-chart-three/package.json:14 ("three": "0.184.0"), spikes/drift-chart-three/README.md (criteria table: 5000 nodes 120fps/0.34ms, UnrealBloomPass, frequency crossfade via vertex-shader bitmask, dissonance grade pass — all verified 2026-06-12).

**Empfehlung:** Before writing the plan, update 7.7's bottom line and appendix class A to 'Three.js orthographic, classic WebGL/EffectComposer (spike-verified, spikes/drift-chart-three)' and mark the PixiJS track as the rejected alternative. The plan should then reference the spike as the renderer baseline and note the production port constraints already listed in the spike README (light-DOM Lit host, design-system token bridge).

### [NOTE] Budget enforcement is fail-open for unseeded purposes; new travel purposes and the Spuren LLM filter need explicit cap rows and a block-behavior decision
*Dimension: architecture-compliance · Abschnitt: 17 (Generation façade), 22.5*

**Claim:** Ch. 17 places generation under 'existing ai_budget_caps + circuit breaker' and 22.5 puts the optional Spuren LLM check 'under ai_budget_caps'. The platform's budget pre-check is explicitly fail-open when no cap row matches — so the new purposes travel_narrative / dispatch_flavor have unlimited spend until purpose-scope rows are seeded. The doc also does not define what the Spuren auto-filter does when the LLM check is budget-blocked (publish on wordlist-only, or hold?).

**Evidenz:** /Users/mleihs/Dev/velgarien-rebuild/backend/services/budget_enforcement_service.py:126-128 ('Fail-open: if no row applies, the call is allowed.'). Doc lines 563, 633.

**Empfehlung:** Plan must seed purpose-scope ai_budget_caps rows for travel_narrative and dispatch_flavor in the same phase that introduces the callers, and state the Spuren degradation rule under budget block (wordlist-only publish is the consistent fail-closed-for-cost / still-shippable choice).

### [NOTE] "Alpha-suite style" phase gates would be build-time constants — phases need runtime platform_settings gates instead
*Dimension: codebase-systems · Abschnitt: §19 ("Each phase ships behind a platform setting gate, alpha-suite style")*

**Claim:** Phase gating can copy the alpha suite's mechanism.

**Evidenz:** The alpha suite's primary gate is a build-time Vite define that tree-shakes the feature out of the bundle (VITE_IS_ALPHA injected in frontend/vite.config.ts:20-29; CLAUDE.md: "Do not add runtime kill-switches"). Only the first-contact modal is runtime-controlled via platform_settings exposed through GET /api/v1/public/alpha-state (backend/routers/public.py:1057). Flipping a DRIFT phase via build-time constant would require a rebuild/redeploy per toggle and per-phase builds.

**Empfehlung:** Specify runtime gating in the plan: platform_settings keys (drift_p0_enabled, …) read fail-closed via parse_setting_bool, surfaced to the frontend through a narrow public state endpoint following the alpha-state DTO pattern — i.e. copy the alpha suite's RUNTIME half (settings + public endpoint + admin tab), not its build-time define.

### [NOTE] §18's epoch vision ('blockades') conflicts with the binding non-interference contract (KPI 9 / 15.1)
*Dimension: consistency · Abschnitt: §18 Epochs row vs §15.1 and KPI 9*

**Claim:** The future epoch coupling is sketched as 'epochs as chart-visible wars (travel advisories, blockades)'. Epochs are player-driven; a blockade that closes or slows a route is, transitively, player action blocking/slowing another player's run — which KPI 9 declares can 'never' happen. Not a v1 problem (22.4 defers coupling to P4), but the contradiction should be recorded so the P4 design doesn't inherit an impossible pair of constraints.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:580 ('Later: epochs as chart-visible wars (travel advisories, blockades)'), :621 (KPI 9: 'no player action can ever block, damage or slow another player's run'), :510 (§15.1 same contract).

**Empfehlung:** Annotate the §18 row: blockades must be cost/dissonance modifiers or advisory-only (never impassable), or KPI 9 must be explicitly scoped to direct player-to-player interaction before P4 design starts.

### [NOTE] Scar 'Statisches Ohr' (permanent +10% false pings) undercuts §6.3's 'truth always reconstructable / lies start at Doppelt' contract
*Dimension: consistency · Abschnitt: §12.3 scar examples vs §6.3*

**Claim:** §6.3 frames interface lies as the Doppelt-band signature ('chart pings may be false' only at 50–74+) and promises distortion is 'strictly cosmetic ... the truth is always reconstructable after recovery'. The scar example makes false pings permanent at any band including Klar, with no recovery point after which truth is reconstructable — diluting the signature mechanic and the honesty/accessibility contract built on it.

**Evidenz:** docs/concepts/drift-zwischenraum-travel-game-concept.md:483 ('*Statisches Ohr* (hear pings one hop further; false-ping rate +10%)'), :199 (Doppelt band: 'chart pings may be false'), :205 ('never silently alters real state; the truth is always reconstructable after recovery').

**Empfehlung:** Either give Statisches Ohr a band condition (false pings only at Verstimmt+) or state explicitly in §12 that scars are a sanctioned, permanent exception to the 6.3 reconstructability promise and must be flagged in the scar's UI description.

### [NOTE] Plan inputs (bundle 1): all progression and economy numbers are unspecified
*Dimension: gaps-planreadiness · Abschnitt: 6.4, 7.4, 14, 15.4-15.5*

**Claim:** Deferable to the plan, but the plan needs a dedicated numbers section for: Frequenzprofil raise-by-use formula and caps; clearance rank thresholds and what each of the five ranks concretely gates; bandwidth classes (slots/scan values); window-extension magnitudes per source (lodging/bond/clearance/hospitality); Siegel price book and survey payout curve; what a Vermessung actually captures (survey data model for `published_routes`); noticeboard rotation cadence; Bergung/Fährmann reputation mechanics (table named at line 540, mechanics absent); scar catalog beyond the two examples (line 483).

**Evidenz:** Concept line 500 names the five clearance ranks and 'raised by use' with no formulas; lines 260, 536, 540 name the survey/route/reputation artifacts without data models.

**Empfehlung:** Open the plan doc with a 'Zahlenwerk' section enumerating these as explicit tuning tables; none blocks architecture, but discovering them mid-plan would stall the RPC and table designs.

### [NOTE] Plan inputs (bundle 2): operational/idle semantics of a run are undefined
*Dimension: gaps-planreadiness · Abschnitt: 6.5, 7.5, 15.2, 15.4, 20*

**Claim:** The plan must define: run persistence across sessions/days (Takt is player-clock, weather is wall-clock per line 516 — a resumed week-old run samples different weather and possibly different active resonances); multi-device concurrency on an open `travel_runs` row (ADR-007 CAS is asserted for resource mutations but not for run-open/ownership); any per-session Takt or LLM-cost throttle (unbounded Takte = unbounded storylet dressing; line 602's 'cache dressing per (template, entity-tuple)' has no keying/TTL spec); and distress-window behavior when the dying player disconnects mid-window (15.4 assumes presence).

**Evidenz:** Concept lines 213 (Takt definition, no daily budget), 516 (global weather clock), 524 (10-minute wall-clock distress window), 602 (cache assertion).

**Empfehlung:** Treat as a 'run lifecycle' section in the plan: open/resume/abandon semantics, single-active-run-per-user constraint with CAS, dressing-cache key spec, and offline finalization rule for distress windows.

## Echt widerlegt (1)

### Ghost islands would expose private, owner-scoped forge drafts; forge_drafts also has no 'lore' field
*Dimension: codebase-tables · ursprüngliche Severity: major*

**Begründung:** All three factual legs verified against the codebase. (1) forge_drafts RLS is strictly owner-only: single policy "Architects can manage their own drafts" FOR ALL USING (auth.uid() = user_id OR is_platform_admin()) at supabase/migrations/20260305500000_055_forge_infrastructure.sql:68-73, with no late

## Unverifiziert — offen (87)

Diese Findings sind weder bestätigt noch widerlegt; die Verify-Panels fielen dem Session-Limit zum Opfer.

### architecture-compliance
- [major] RPC catalog in ch. 17 omits most world-mutating operations, several of which are concurrent-access and mandate Postgres CAS per ADR-007
- [major] RLS posture is one sentence; cross-user reads/writes (route purchase, rescue donation, convoy shared quest state, beacons, traces) are unaddressed and imply SECURITY DEFINER functions governed by ADR-006
- [major] Hospitality chokepoint (fn_apply_quest_effects) is bypassed by Zerfaserung echo-scatter and by the Spuren write path
- [major] Public-first chart reads contradict fog-of-war and the paid survey economy; the public endpoint surface is unenumerated despite membership-required play
- [major] Chart tables described as 'seeded, versioned' but the design requires runtime chart mutation from four sources
- [major] Content-pack pipeline reuse is overstated: both CI guards are dungeon-scoped and must be extended for content/drift/**
- [major] Audit logging specified only for effect application; CLAUDE.md requires it for all mutations, and the mechanism inside SQL RPCs is undefined
- [major] Timed lifecycles (distress expiry, noticeboard rotation, ghost-island instability) have no execution owner; rescue-vs-finalize is an unaddressed CAS race against a 5-minute scheduler tick

### codebase-systems
- [major] "Dungeon-engine checkpoint pattern" and ADR-007 CAS RPCs are two conflicting state authorities — the doc asserts both for the same Träger state
- [major] Whisper pipeline reuse for travel banter and quest hooks is materially harder than "new trigger contexts"
- [major] The "operative aptitude probability formula" is epoch-entangled and is the wrong reuse target; the actual shared check primitive is combat/skill_checks.py
- [major] The A1.5 content-pack pipeline is hard-wired to the dungeon domain — content/drift/** is not a drop-in
- [major] "Street connectivity defines adjacency" is false for forge-generated geometry — streets never span two zones
- [major] "Chart reads public-first" contradicts per-player fog-of-war and the survey-data economy
- [major] Effect-vocabulary table claims don't match the schema: agent_loot_effects doesn't exist, and event_echoes constraints block the Zerfaserung scatter as described

### codebase-tables
- [major] chronicle_mention has no structured target — chronicles are a single LLM-generated text blob
- [major] grant_agent_effect targets a nonexistent table; the real table is dungeon-coupled with a closed effect_type enum

### consistency
- [critical] 7.7 'Bottom line' still recommends PixiJS, contradicting the section's own revised recommendation and the completed spike
- [major] Stale 'run the spike first' hedging in 7.7, 22.6 and Appendix 23 — the spike is DONE and its decisions are unrecorded in the doc
- [major] Appendix 23 production tables and §16 still hardcode PixiJS / 'custom canvas' as the implementation
- [major] Identitätsbruch (Dissonanz 100) is a second failure mode with no mechanical or architectural specification
- [major] §11 'Abroad, only …' clause excludes traveler-own effects (emit_fragment, bond_event) that the doc itself requires abroad
- [major] Zerfaserung cargo scatter writes echoes into arbitrary simulations with no hospitality interaction defined, outside the vocabulary's quest-only governance
- [major] Rettung's 'bond-like memory between the two profiles' is player↔player state with no home in the vocabulary or the three multiplayer tables
- [major] Moderation decision (22.5) covers Spuren only — player-composed wreck logs and callsigns are unmoderated UGC surfaces
- [major] Pillars 2, 5 and 7 have zero KPI coverage — including pillar 7, the headline of P1

### design-economy
- [major] Survey royalty economy is an undefined player-to-player Siegel channel with an obvious alt/self-buy exploit surface
- [major] Mitfahrt 'paid in Siegel' contradicts the doc's own no-currency-transfer discipline and widens the alt-funnel
- [major] 'Never softlocked' guarantee breaks in the doc's own promoted scenario: a ferried passenger has no surveyed edges for Notfrequenz
- [major] KPI 7 (Peacock-Wind rule) already fails against the doc's own named phenomena — as written it is an untestable contract
- [major] Uncapped Siegel-purchasable window extensions erode the core Aufenthaltsfenster tension as Siegel accumulates
- [major] Scar design contradicts itself ('permanent quality' vs 'new scar may replace') and replacement plus cargo-only stakes invites deliberate Zerfaserung scar-farming
- [major] KPI 4 (repeat journey ≤ 25% wall-clock) is trivially satisfied by autopilot and measures the wrong cost — the real commute cost is resources plus regen wait
- [major] KPI 3 (<20 min to a foreign sim) sits on an undefined gating chain: membership + tutorial dispatch + clearance + possible exam fee
- [major] Dissonance abroad-sinks are structurally sparse (sanctuary attribute 'to-be-defined', companions are P2) while the signature band-2 mechanic may be unreachable in the P0 slice

### design-multiplayer
- [critical] Erstvermessung race point undefined; 7.7's 'cheating only inflates your own progress' premise is false for the shared survey economy
- [major] Rettung is farmable: zero specified cost for the rescued, unspecified cost for the rescuer, and Bergung honors + bond memories + leaderboard credit reward deliberate Zerfaserung-trading
- [major] Distress-window lifecycle has no specified finalizer or race semantics: offline casualty, rescue-vs-expiry race, and two racing rescuers are all undefined
- [major] Mitfahrt abandonment: ferry logoff or ferry Zerfaserung mid-deep-Drift strands the passenger — a direct non-interference violation with no specified disembark/recovery semantics
- [major] Passenger 'earns no surveys' conflates survey credit with personal discovery — ferried newcomers arrive at a far world with no route knowledge and no autopilot home, undermining the stated onboarding purpose
- [major] Konvoi lockstep movement is ill-defined: timeout semantics, route authority, and per-vector edge impassability for mixed-frequency convoys are all unresolved — several readings violate the non-interference contract
- [major] Shared-instance convoy quest state ('one quest state, all participants credited') conflicts with the per-player thread persistence guarantee and is undefined on member drop
- [major] Weather-camping is unaddressed: global wall-clock storms + per-player Takt + zero idle cost makes 'wait out the storm' a free dominant strategy
- [major] Presence population math: ÷7 frequencies × region cells at alpha-scale concurrency makes same-frequency sightings statistically near-zero and the 10-minute Rettung window practically unanswerable
- [major] Wreck salvage ownership is undefined: shared-pool salvage of another player's remnants either violates the non-interference contract or requires an explicit forfeiture rule the doc lacks
- [major] Spuren spam surface: 'per player per building per visit' is unbounded across repeat visits, home sims have no window to throttle it, and the auto-filter's budget-exhaustion failure mode is unspecified

### game-design-ux
- [major] KPI 3 (foreign sim in < 20 min) has no supporting first-session design
- [major] Seven-frequency system has no per-player progressive disclosure; minute-1 tuning is unowned
- [major] Aufenthaltsfenster suspend semantics undefined - '5-min chunks' claim conflicts with 12-Takt visits
- [major] Global wall-clock weather vs player-clock Takte breaks fairness at resume
- [major] Band-2+ 'the game lies' has no resolution rules: mirage options and false-ping reconstruction unspecified
- [major] 'Screen-reader-safe rendering' is asserted but unspecified, and the Drift chart has no non-visual access story at all
- [major] Seven frequency colors are the primary information channel with no colorblind plan; WCAG AA claim does not cover the canvas
- [major] Residual failure stakes are near zero and Zerfaserung doubles as a free teleport home
- [major] Rettung distress window: 10 minutes of unspecified dead time for the failing player, with instant-concede as the rational default
- [major] Language of generated travel prose is unresolved: per-sim content_locale vs user locale never reconciled
- [major] Chronicle payoff arrives late or never: editions are on-demand today, so the P0 success criterion is currently unachievable in-session
- [major] Hospitality 'geschlossen'/'nur Echos' contradicts pillar 4 and KPI 2 for quests completed abroad

### gaps-planreadiness
- [critical] Cargo system is entirely unspecified; all cargo cross-references dangle to the wrong section
- [major] Begehung zone-graph derivation rule contradicts the actual schema — streets do not connect zones
- [major] Cross-sim effect writes by non-members are impossible under current RLS; the concept's 'Never bypass RLS' sentence is self-contradictory
- [major] Chart generation/versioning underspecified: 'additive' growth conflicts with force layout, permanent honors, and in-flight runs; force layout misattributed to CartographersDesk
- [major] Selector/condition DSL has zero specification despite being declared the binding investment
- [major] Geisterinseln expose private forge-draft content to all players

### kpi-testability
- [major] KPI 1 (>=2 live DB entities) has no defined entity universe and is contradicted by the survey template family
- [major] KPI 2 ('visible outside the game mode') is undefined and violated by design for quests completed in 'geschlossen' worlds
- [major] KPI 3 (<20 min to foreign simulation) has no start/end event, no population statistic, and no instrumentation layer exists on the platform
- [major] KPI 4 (repeat journey <= 25% wall-clock) is ill-defined in Takt mode and sits at exactly the boundary in Helm mode
- [major] KPI 5 (no state mutation outside the effect vocabulary) is violated by every storylet as written — quality writes are a second, unvocabularied mutation channel
- [major] KPI 6 ('entire game playable with AI hard-blocked') is unfalsifiable without an enumerated touchpoint list, and 'hard-blocked' is a constructed config state, not a switch
- [major] KPI 7 (Peacock-Wind: every named phenomenon pulls 2+ levers in tension) is contradicted by the doc's own node-type table
- [major] KPI 8 (mode parity) has no enforcement locus, and 7.6 already contains a Helm-only mechanic (Trägerlicht) with no declared Takt equivalent
- [major] KPI 9 (non-interference) is universally quantified with no consent carve-out and is contradicted by the convoy and rescue designs
- [major] Four KPIs the concept's own promises imply are missing from ch. 21
- [major] Ch. 21 claims 'testable contracts' but specifies no enforcement locus, phase, or measurement method for any KPI — the plan doc needs a KPI-to-enforcement table

### phasing-scope
- [critical] Generic storylet layer (QBN engine, content/drift packs, storylet panel) is never assigned to any phase
- [major] P0 'vertical slice' is a hidden platform: ~12 tables, 2+ RPC families, a new content-pack family, an LLM façade, a full-screen canvas component family, and a tutorial — presented as one bullet
- [major] Begehung zone-graph claim contradicts the actual schema and generator: streets are intra-zone, never zone-connecting; cross-city movement is undefined; P0-world geometry existence is unverified
- [major] Resource failure states are undefined for two whole phases: Kohärenz 0 → Zerfaserung and Dissonanz 100 → scar both reference P2 systems
- [major] P0 writes effects into a foreign simulation one phase before the hospitality (Gastfreundschaft) sovereignty control exists
- [major] P1 ships a 'global weather clock' with nothing visible to drive: storms are P3 and the archetype global modifiers are never phased
- [major] Convoy is P4 but 15.6 requires shared-instance variants of threads (P2/P3) and Echo-Jagd (P1) — the quest-instance participant model must be decided in the P0 schema
- [major] The 'mode-agnostic engine is a P0 architectural requirement' is not specified to a buildable level — and its event taxonomy includes emitters that don't exist until P1/P3
- [major] P0 'one chart region' → P1 full chart transition semantics are unspecified — the first chart_version event happens with live player data
- [major] P1 is 2–3× the size of P0 but framed as one phase — it contains at least six separable feature clusters including two new dispatch template families
- [major] Bilingual authoring volume is never sized or assigned to phases: the generic storylet pool, all template prose, and the tutorial have no owner phase
- [major] Only P0 has a success criterion; P1–P4 have no testable definition of done
