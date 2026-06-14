# DRIFT Concept Gate-Review — Final Verification Report (2026-06-12)

**Scope:** 87 findings verified across 10 dimensions. **Result: 84 confirmed, 2 refuted, 1 unclear. 4 critical findings — all confirmed.**

**Workflow:** `wf_4404dc9e-3db` (Review, 126 findings) + `wf_e35437d7-193` (Verify, 87 open findings, Fable 5 synthesis).
**Total confirmed findings:** 38 (prior session) + 84 (this session) = **122 confirmed**, 3 refuted, 1 unclear of 126 total.

## Summary

| Dimension | Confirmed | Refuted | Unclear | Critical-Confirmed |
|---|---|---|---|---|
| architecture-compliance | 8 | 0 | 0 | 0 |
| codebase-systems | 5 | 1 | 1 | 0 |
| codebase-tables | 2 | 0 | 0 | 0 |
| consistency | 9 | 0 | 0 | 1 |
| design-economy | 8 | 1 | 0 | 0 |
| design-multiplayer | 11 | 0 | 0 | 1 |
| game-design-ux | 12 | 0 | 0 | 0 |
| gaps-planreadiness | 6 | 0 | 0 | 1 |
| kpi-testability | 11 | 0 | 0 | 0 |
| phasing-scope | 12 | 0 | 0 | 1 |
| **Total** | **84** | **2** | **1** | **4** |

---

## CRITICAL — Confirmed (4)

### C1. Cargo system entirely unspecified; all cross-references dangle [gaps-planreadiness] ✅ CONFIRMED
**Evidence:** §7.3 is "Node types" — every cargo cross-reference (§7.2, §3.1, §3.3, §12) lands on the node-type table. `travel_cargo` listed in §17 without schema; "cargo twists" invoked as KPI (§21) without specification.
**Recommendation:** Add a dedicated cargo section (families, acquisition, twists, spoilage, `travel_cargo` schema) before the plan doc.

### C2. Generic storylet layer (QBN engine, content/drift packs, panel) assigned to no phase [phasing-scope] ✅ CONFIRMED
**Evidence:** §19 P0–P4 never mentions the QBN engine, `content/drift/**/*.yaml` packs, or the storylet panel — all foundational per §5 and §9.2.
**Recommendation:** Assign the storylet pipeline (packs, CI validation, runtime registry, panel) to P0 or P1 with explicit deliverables.

### C3. §7.7 "Bottom line" still recommends PixiJS, contradicting the revised recommendation and the completed spike [consistency] ✅ CONFIRMED
**Evidence:** Line 351: "PixiJS v8 + fixed-timestep client sim…" vs line 325: "Three.js with an orthographic camera"; spike completed 2026-06-12 chose Three.js.
**Recommendation:** Rewrite the §7.7 bottom line to "Three.js (orthographic) + …" to match spike outcome and §22.6.

### C4. Erstvermessung race point undefined; §7.7's "cheating only inflates your own progress" premise is false for the shared survey economy [design-multiplayer] ✅ CONFIRMED
**Evidence:** §7.4: platform-first discoveries flagged on the shared chart, but no simultaneous-arrival semantics. Line 331's client-sim justification is false for Erstvermessung flags, royalties, and the §15.7 leaderboard.
**Recommendation:** First-write-wins server-side for Erstvermessung; scope client-sim justification to resources only.

---

## MAJOR — Confirmed (80)

### architecture-compliance (8/8)

1. **RPC catalog (§17) omits most world-mutating concurrent-access operations (ADR-007 CAS mandate).** Only 7 RPCs listed; convoy state, noticeboard rotation, Spuren, royalty crediting, frequency-profile updates all missing. → Enumerate complete RPC catalog with CAS annotations.
2. **RLS posture is one sentence; cross-user writes unaddressed (ADR-006).** §17: "per-user rows user-scoped" — silent on rescue donation, convoy shared state, royalty credits, trace moderation. → Per-table RLS + identify SECURITY DEFINER RPCs under ADR-006 grant restriction.
3. **Hospitality chokepoint bypassed by Zerfaserung echo-scatter (§12) and Spuren direct writes (§15.7).** Neither routes through `fn_apply_quest_effects`, the only hospitality gate (§11). → Route all cross-sim writes through hospitality validation or define explicit per-path caps.
4. **Public-first chart reads contradict FoW + paid survey economy; public endpoint surface unenumerated.** §17 vs §7.4 (`traveler_discoveries`, royalties); no public/member split defined. → Define exact endpoint split for all DRIFT routes.
5. **Chart tables "seeded, versioned" but design requires runtime mutation from 4 sources** (forge broadcasts, Wrack nodes, ghost islands, Resonanzsturm — §7.1/§7.3/§12/§13). → Design tables for runtime mutation; specify TTL vs permanent rows.
6. **Content-pack pipeline reuse overstated: both CI guards are dungeon-scoped.** `lint-no-content-in-python.sh` scopes to `backend/services/dungeon/`; `validate_content_packs.py` hardcodes `DEFAULT_PACK_ROOT = content/dungeon` (loader.py:74). → Extend both guards + loader for `content/drift/**` first.
7. **Audit logging specified only for effect application; no mechanism inside SQL RPCs.** `audit_service.py:72` is Python-only; migration 228's `ops_audit_log` is Bureau-Ops-scoped. → Define RPC audit strategy (in-RPC INSERT, trigger, or backend wrapper).
8. **Timed lifecycles have no execution owner; rescue-vs-finalize is an unguarded CAS race.** §15.4 ~10-min window, no scheduler assigned; no CAS guard between `fn_zerfaserung` finalization and `fn_rescue_stabilize`. → Named scheduler + explicit state machine with `WHERE status = 'distress'` CAS.

### codebase-systems (5/7)

9. **Whisper pipeline reuse materially harder than "new trigger contexts".** `whisper_service.py:42-48` hardwires `_DEPTH_WHISPER_TYPES`; `_should_generate` reads bond-scoped state; no pluggable extension point. → Extract trigger-selection strategy or define `TravelWhisperService` subclass.
10. **Operative aptitude formula is epoch-entangled; wrong reuse target.** `operative_mission_service.py:42-99` requires active epoch + `epoch_config`; `combat/skill_checks.py:24` is the documented epoch-free primitive. → Use `resolve_skill_check`; do not port the operative formula.
11. **A1.5 content-pack pipeline is dungeon-hardwired — content/drift is not drop-in.** loader.py:74 hardcoded root; validator enforces dungeon invariants (boss/rest/treasure, archetype completeness). → Plan a parallel travel loader + schema module.
12. **"Street connectivity defines adjacency" is false.** `city_streets` has single nullable `zone_id` (migration 026:41); no from/to pair; `fn_apply_map_geometry` (236:102-122) inserts one zone per street. → Explicit `zone_connections` table or boundary-intersection-derived graph.
13. **Effect-vocabulary/schema mismatch: `agent_loot_effects` doesn't exist; `event_echoes` constraints block scatter.** Real table is `agent_dungeon_loot_effects` (164:23); `event_echoes` requires NOT NULL `source_event_id` FK + `UNIQUE(source_event_id, target_simulation_id)` (026:34/48), blocking multi-scatter. → New `travel_echoes`/`travel_traces` table decoupled from `events` FK; fix table name.

### codebase-tables (2/2)

14. **`chronicle_mention` has no structured target — chronicles are a single text blob.** `simulation_chronicles.content TEXT` (migration 066:2-20); single LLM call returns `{title, headline, content}`. → Add `mentions JSONB` + prompt-template section for structured Träger credits.
15. **`grant_agent_effect` targets nonexistent table; real table has closed dungeon-only `effect_type` CHECK** (164:27-30: only 5 dungeon-scoped types). → Extend CHECK or create `agent_travel_effects` without dungeon coupling.

### consistency (8 major confirmed; C3 above)

16. **Stale "run the spike first" hedging in §7.7/§22.6/Appendix 23 — spike is DONE, decisions unrecorded.** Appendix 23 line 657 still future-tense; spike README records binding decisions (WebGLRenderer, bespoke pan/zoom, three 0.184.0). → Record spike complete, inline decisions, remove hedging.
17. **Appendix 23 asset tables + §16 still hardcode PixiJS / "custom canvas".** Line 646 "GLSL shaders + PixiJS scene graph"; §16 line 546 "custom canvas". → Name Three.js as decided; demote PixiJS to "considered, not chosen".
18. **Identitätsbruch (Dissonanz 100) is a second failure mode with no spec.** §6.3 line 201 outcome identical to Zerfaserung; no RPC, DB state, UI, or §12/§17 mention. → Specify distinct path or collapse into Zerfaserung explicitly.
19. **§11 "Abroad, only…" excludes traveler-own effects (emit_fragment, bond_event) the doc itself requires abroad** (§10 line 450, §6.1/§14). → Add both to abroad list, annotated "self-directed, hospitality-exempt".
20. **Zerfaserung scatter writes echoes into arbitrary sims with no hospitality interaction defined** — fn_zerfaserung listed separately from §11's quest-only governance. → Specify hospitality check or explicit system-event exemption for scatter.
21. **Rettung's "bond-like memory between two profiles" has no home** — only travel_convoys, distress_beacons, traveler_reputation exist (§15.8/§17); inject_agent_memory targets agents, not profiles. → Add `traveler_connections` table or map to a reputation row with rescuee ref.
22. **Moderation (§22.5) covers Spuren only — wreck logs (§15.4) and callsigns (§15.2) are unmoderated UGC.** → Extend §22.5 to both surfaces.
23. **Pillars 2, 5, 7 have zero KPI coverage — including pillar 7, the headline of P1.** None of the 9 KPIs in §21 maps to them. → Add KPIs (Erstvermessung visibility, Zerfaserung-echo-in-chronicle, forge-sim dockability without hand-authoring).

### design-economy (8/9)

24. **Survey royalty is an undefined player-to-player Siegel channel with an alt/self-buy exploit.** §7.4 royalty trickle, §6.4 sink — no anti-abuse rule anywhere. → Ban self/linked-account purchase; minimum unique-buyer threshold.
25. **Mitfahrt "paid in Siegel" contradicts the no-currency-transfer discipline** (§15.5 vs §6.4 + §22.3). → Reputation-only ferry reward; remove the transfer vector.
26. **"Never softlocked" breaks for ferried passengers: zero surveyed edges → no Notfrequenz** (§6.2 + §7.4 + §15.5 "earns no surveys"). → Grant passengers Notfrequenz access to ferry's edges, or dock-only drop-offs.
27. **KPI 7 already fails the doc's own phenomena: The Prometheus is all-positive** (§13: scan range ↑, ghost islands more stable — no counter-lever); list is open-ended ("…"), so untestable. → Closed phenomenon list with assigned tension pairs before plan doc.
28. **Scar design self-contradicts ("permanent" vs "new scar may replace") and invites empty-cargo Zerfaserung scar-farming** (§12, §6.3). → Drop "permanent"; replacement penalty; no scar from empty-manifest Zerfaserung.
29. **KPI 4 (≤25% wall-clock) trivially satisfied by autopilot; measures the wrong cost** (§7.4: one action, zero Takte). → Reframe in resource cost (Bandbreite vs destination earnings).
30. **KPI 3 (<20 min) sits on an undefined gating chain** — membership + tutorial dispatch + clearance exam fees + embassy, no time budget. → Gating-chain time-budget analysis in plan doc.
31. **Dissonance abroad-sinks structurally sparse; signature band-2 mechanic may be unreachable in P0** (sanctuary attribute "to-be-defined", companions P2). → Ship one concrete sink in the Velgarien↔Gaslit Reach corridor at P0.

### design-multiplayer (10 major confirmed; C4 above)

32. **Rettung is farmable: zero rescued-side cost, no cooldown/gate; honors + memories + leaderboard reward Zerfaserung-trading** (§15.4). → Minimum distress duration, per-pair cooldown, seasonal Bergung cap.
33. **Distress-window lifecycle undefined: offline casualty, rescue-vs-expiry race, dual rescuers** (§15.4/§17). → First-write-wins `accepted_by` on distress_beacons; TTL auto-finalize; documented CAS invariant.
34. **Mitfahrt abandonment (ferry logoff/Zerfaserung) strands the passenger — non-interference violation, no recovery semantics** (§15.5 vs §15.1). → Deposit at last node + one-time Bandbreite grant to nearest relay.
35. **Passenger "earns no surveys" conflates credit with discovery — ferried newcomer can't autopilot home** (§15.5 + §7.4). → Passive route-knowledge (not survey credit) for traversed edges.
36. **Konvoi lockstep ill-defined: timeout, route authority, mixed-frequency edge impassability all unresolved** (§15.6). → Explicit timeout + auto-commit, leader route authority, per-member frequency costs.
37. **Shared-instance convoy quest state conflicts with per-player thread persistence; member-drop undefined** (§15.6 vs §12). → Shared state = view over leader's instance; per-participant checkpoint credit.
38. **Weather-camping unaddressed: global storms + per-player Takt + zero idle cost = free dominant strategy** (§15.2 + §6.5). → Idle/overstay cost or navigable-storm risk-reward.
39. **Presence math: ÷7 frequencies × region cells at alpha concurrency → near-zero sightings; 10-min Rettung window practically unanswerable** (§15.2 sharding vs §15.4 beacon never reconciled). → Beacon notification outside shard-filtered channel.
40. **Wreck salvage ownership undefined — FCFS salvage vs non-interference contract** (§12, §7.3, §15.1). → Zerfaserung = explicit forfeiture; wreck cargo = open shared pool.
41. **Spuren spam: unbounded per repeat visit, no home-sim throttle, LLM-budget-exhaustion failure mode unspecified** (§15.7, §22.5). → Per-player-per-building cap (oldest replaced); budget exhaustion falls back to wordlist-only.

### game-design-ux (12/12)

42. **KPI 3 has no supporting first-session design** — only a one-line risk mitigation in §20; existing OnboardingWizard covers sim membership only. → Dedicated P0 first-session flow spec.
43. **Seven frequencies have no progressive disclosure; minute-1 tuning unowned** (§7.2, §14 clearance unmapped). → Unlock ladder keyed to Clearance + guided first-tuning prompt.
44. **Aufenthaltsfenster suspend semantics undefined — "5-min chunks" vs 12-Takt visits** (§7.6 vs §6.5/§8.6). → Window freezes on checkpoint; resumes on re-entry.
45. **Global wall-clock weather vs player-clock Takte breaks fairness at resume** (§15.2 vs §6.5). → Re-sample weather on resume, no retroactive Takt deduction; optional weather-briefing storylet.
46. **Band-2 "the game lies" has no resolution rules** — mirage marking, false-ping reconstruction window, UI affordance all unspecified (§6.3). → Add a Band-2 resolution protocol subsection.
47. **"Screen-reader-safe rendering" asserted but unspecified; canvas chart has no non-visual access story** (§6.3, §16). → Keyboard/SR mode exposing chart as aria node list with adjacency.
48. **Seven frequency colors are the primary channel with no colorblind plan; WCAG AA claim doesn't cover the canvas** (§7.2, §16, §23). → Per-frequency glyph + pattern/label redundancy.
49. **Residual failure stakes near zero; Zerfaserung doubles as a free teleport home** (§12: surveys preserved, wake at anchor). → Recuperation window or re-certification cost so Notfrequenz limping dominates.
50. **Rettung window = 10 min of unspecified dead time; instant-concede is the rational default** (§15.4). → Active distress mode (beacon management, jettison, wreck-log composition).
51. **Generated-prose language unresolved: per-sim `content_locale` vs user locale never reconciled for cross-sim quests** (§9/§17; simulation.py:14,40,72; prompt_template_service.py:30,44). → Locale precedence rule (destination locale for Begehung, home locale for dispatches, en fallback).
52. **Chronicle payoff arrives late or never: editions are editor-triggered on-demand (chronicles.py:28-59), so the P0 success criterion is currently unachievable in-session.** → Auto-generation trigger post-Entladung, or soften criterion to chronicle-queue visibility.
53. **Hospitality geschlossen/nur-Echos contradicts pillar 4 and KPI 2 for quests abroad** (§11, §8.7 default). → Narrow to home-sim visibility + guaranteed `emit_fragment` fallback.

### gaps-planreadiness (5 major confirmed; C1 above)

54. **Begehung zone-graph derivation contradicts schema — streets don't connect zones** (geography.sql:41, single `zone_id`). → from/to columns or fallback derivation rule.
55. **Cross-sim effect writes by non-members impossible under current RLS; "Never bypass RLS" is self-contradictory.** `agent_memories` INSERT is service_role-only (067:32-33); `event_echoes` has no user INSERT policy (026 comment). → ADR: EffectResolver runs under service_role with hospitality+caps as the authorization layer.
56. **Chart generation/versioning underspecified; force layout misattributed to CartographersDesk** (actual: `map-force.ts`/`MapGraph3D.ts`); additive growth unresolved vs honors + in-flight run coordinates. → Fix attribution; specify chart_version interaction with runs and Erstvermessung records.
57. **Selector/condition DSL has zero specification despite being the declared binding investment** (§3.4, §9.6 rule 5). → Minimal DSL spec appendix before plan doc.
58. **Geisterinseln expose private forge-draft content.** `forge_drafts` RLS = owner OR platform admin only (055:68-73); §7.3 reads draft lore for storylets. → Public `ghost_island_lore` projection or anonymized cache table.

### kpi-testability (11/11)

59. **KPI 1 has no entity universe; survey templates contradict it** (§9.1 survey family references no entity IDs). → Bounded entity universe + chart-node carve-out.
60. **KPI 2 "visible outside the game mode" undefined; violated by geschlossen worlds** (§11). → Hospitality carve-out + concrete visibility definition.
61. **KPI 3 has no start/end event, population statistic, or instrumentation layer** (§17 lists no telemetry; Sentry is error-focused). → Define events + telemetry hook + sample method.
62. **KPI 4 ill-defined in Takt mode (autopilot = one action) and exactly at boundary in Helm mode (×4 compression = exactly 25%).** → Restate in decision/action count; ×5 compression for margin.
63. **KPI 5 violated by every storylet: quality writes are a second, unvocabularied mutation channel** (§9.2 vs §11's 9 effects). → Add `write_quality` effect or scope KPI 5 to world-state only.
64. **KPI 6 unfalsifiable: no enumerated LLM touchpoint list; "hard-blocked" is a constructed config state, not a switch.** → Bounded touchpoint list + single `drift_ai_enabled: false` setting.
65. **KPI 7 contradicted by the doc's own node-type table: Träger-Wrack and Relais have no tension levers** (§7.3). → Assign cost/risk levers to both.
66. **KPI 8 has no enforcement locus; Trägerlicht is Helm-only with no Takt equivalent** (§7.6). → Takt-mode signal toggle + authoring-time `helm_only` gate.
67. **KPI 9 universally quantified with no consent carve-out; contradicted by convoy and rescue designs** (§15.4/§15.6). → Add explicit-consent carve-out.
68. **Four implied KPIs missing from §21:** frontier-vs-commute balance (§7.4), forge-sim visitability (§8.7), zero-bandwidth non-softlock (§6.2), solo-completability (§15.1). → Add them.
69. **§21 claims "testable contracts" but specifies no enforcement locus, phase, or measurement method for any KPI.** → KPI-to-enforcement table (id, phase, method, query/protocol, owner) in plan doc.

### phasing-scope (11 major confirmed; C2 above)

70. **P0 "vertical slice" is a hidden platform: ~12 tables, 2+ RPC families, content-pack family, LLM façade, canvas component family, tutorial — one bullet** (§17, §9.1, §7.5, §16). → Sub-milestones P0a–P0d with acceptance gates.
71. **Begehung zone-graph contradicts schema AND generator: streets are intra-zone** (geography.sql:41; forge_map_generators.py:338-396); cross-city movement undefined. → `zone_adjacencies` table or polygon-overlap derivation in P0 schema.
72. **Failure states undefined for two phases: Kohärenz 0 and Dissonanz 100 reference P2 systems from P0** (§6.1/§6.3 vs §19). → Minimal P0 failure state + documented P0→P2 upgrade path.
73. **P0 writes foreign-sim effects one phase before hospitality exists** — spawn_event at P0, hospitality at P1; zero migration matches for hospitality settings. → "nur Echos" default in P0 schema, or restrict P0 to emit_echo.
74. **P1 ships a global weather clock with nothing visible to drive — storms are P3; archetype modifiers never phased** (substrate_resonances exists, migration 074/078, but gameplay unphased). → Move clock to P3 or define P1-visible weather output.
75. **Convoy is P4 but shared-instance quests require the participant model in the P0 schema** (§15.6; travel_quest_instances is P0 per §17). → `quest_instance_participants` join table in P0, empty until P4.
76. **Mode-agnostic engine "P0 requirement" not specified to buildable level; its event taxonomy includes P1/P3 emitters** (§7.5). → Versioned event-stream interface with a P0-required subset + extension points.
77. **P0 one-region → P1 full-chart transition unspecified — first chart_version event hits live player data** (§7.1). → Specify discovery preservation semantics + `fn_apply_chart_version` contract before P0 writes.
78. **P1 is 2–3× P0's size: at least six separable feature clusters in one phase.** → Split into P1a/P1b with separate criteria.
79. **Bilingual authoring volume never sized or phased: five threads + generic pool + tutorial have no owner phase** (§9.3, §9.2, §20). → Per-phase content production table (types, counts, word volume, owner).
80. **Only P0 has a success criterion; P1–P4 have no testable definition of done** (§21 KPIs are invariants, not phase gates). → One concrete playtest criterion per phase.

---

## REFUTED (2)

### R1. "Chart reads public-first contradicts per-player FoW and the survey economy" [codebase-systems] ❌ REFUTED
**Evidence:** Doc line 559 defines two distinct tables — shared `drift_chart_nodes`/`drift_chart_edges` (public topology) and `traveler_discoveries` (personal FoW layer). The survey economy pays for Bureau delivery, not chart-read gating. Internally consistent.
**Note:** The architecture-compliance finding #4 remains valid on a different axis (endpoint enumeration + royalty/FoW reconciliation in §17 itself).

### R2. "Uncapped Siegel-purchasable window extensions erode Aufenthaltsfenster tension" [design-economy] ❌ REFUTED
**Evidence:** Decision §22.3 explicitly states "No bandwidth, no window extensions, no Siegel purchasable"; §8.6 confirms extensions are purely diegetic. Already resolved by the doc.
**Recommendation:** Carry the constraint into the plan doc as a hard invariant.

---

## UNCLEAR (1)

### U1. "Dungeon checkpoint pattern and ADR-007 CAS RPCs are two conflicting state authorities for Träger state" [codebase-systems] ❓ UNCLEAR
**Evidence:** Dungeon `checkpoint_state JSONB` (migration 163:52) explicitly assumes sole-writer (163:209); doc lines 331/560 propose `fn_travel_move` with "idempotent CAS". The two patterns may apply to different scopes (structural JSONB vs numeric resource fields) — the doc is ambiguous on whether they are complementary layers or a conflict.
**Recommendation:** Plan doc must specify per-field CAS vs atomic-write semantics on `travel_runs` so the dungeon's sole-writer assumption is not silently inherited into the multi-client travel context.

---

## Gate Verdict

**Concept is NOT plan-ready.** 4 confirmed criticals (cargo spec, storylet-layer phasing, stale renderer decision, Erstvermessung race) plus systemic gaps in RPC/RLS/audit architecture, KPI testability (all 11 confirmed), and phase scoping (12/12 confirmed) must be resolved in a doc revision before writing the implementation plan.

**Required pre-plan doc fixes (minimum):**
1. Add cargo section (C1)
2. Assign storylet pipeline to a phase (C2)
3. Fix §7.7 bottom line + Appendix 23 renderer references (C3)
4. Specify Erstvermessung first-write-wins server-side semantics (C4)
5. Extend §17 RPC catalog with CAS annotations (#1)
6. Add §17 per-table RLS + SECURITY DEFINER decision (#2)
7. Route Zerfaserung + Spuren through hospitality (#3)
8. Fix §22.5 moderation scope to cover wreck logs + callsigns (#22)
9. Resolve §6.5 weather-per-Takt contradiction vs §15.2 (#45)
10. Add selector/condition DSL appendix (#57)
