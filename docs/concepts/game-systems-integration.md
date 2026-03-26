---
title: "Game Systems Integration — Connecting the Living World"
version: "3.2"
date: "2026-03-26"
type: concept
status: active
lang: en
tags: [architecture, game-design, integration, autonomy, living-world, mud, ux]
---

# Game Systems Integration — Connecting the Living World

> **Priority: CRITICAL.** This is the single most important architectural document of the project.
> Every future feature builds on the foundation defined here.
>
> Authored from four specialist perspectives:
> - **Senior Web Application Architect** — database, performance, migrations, rollback
> - **Senior Game Designer / World Building Specialist** — mechanics, balance, feedback loops, pacing
> - **Senior UX Specialist** — information architecture, affordances, progressive disclosure
> - **Research Evidence** — GDC talks, academic papers, reference implementations

---

## Part I: The Diagnosis

### 1.1 What the Audit Found

A comprehensive systems audit (2026-03-25) traced every causal chain in the platform from input to output. The finding: **the platform's game mechanics are architecturally complete but operationally disconnected.**

Each system works individually. They don't work together.

### 1.2 The Five Disconnections

| # | System A | Should affect | System B | Connected? | Gameplay value if connected? |
|---|----------|--------------|----------|------------|------------------------------|
| A1 | Agent Influence | → | Building Readiness | ✅ `fn_compute_agent_influence` (mig 158) + `fn_bootstrap_building_relations` (mig 160) | ✅ HIGH — creates agent placement decisions |
| A2 | Zone Stability | → | Event Probability | ✅ Stability multiplier in autonomous_event_service (2026-03-25) | ✅ HIGH — creates urgency and resource allocation |
| A3 | Resonance | → | Agent Mood | ❌ Resonance is decorative, doesn't affect agents | ⚠️ MEDIUM — abstract, hard to communicate |
| A4 | Events | → | Agent Needs | ❌ Events age passively, don't affect agents | ❌ LOW — no player decision, purely automatic |
| A5 | Autonomy | → | Everything | ✅ ON by default (mig 157), zone/building bootstrap | ✅ PREREQUISITE — nothing works without this |

### 1.3 The Core Problem: Vanity Metrics

Two of the platform's most prominent metrics are purely cosmetic:

**Agent Influence** — computed as `Relationships(40%) + Professions(30%) + Diplomatic(30%)`. Displayed prominently on every agent detail page. Used in ZERO backend calculations. Not in building readiness, not in epoch scoring, not in activity selection, not anywhere. 100% vanity.

**Zone Stability** — computed as `infrastructure(50%) + security(30%) - pressure(25%)`. Displayed on zone cards and health view. Used in only TWO places: epoch stability scoring and a single cascade threshold check at 0.3. Does not affect event probability, agent mood, or any other mechanic.

### 1.4 The Dormant Orchestration Layer

The heartbeat Phase 9 (Agent Autonomy) is the system that connects everything: needs decay → mood evolution → activity selection → social interactions → opinion changes → relationship formation. But it's gated on `agent_autonomy_enabled`, which defaults to `false`. Only one simulation (Velgarien) was manually enabled during this session.

**Code location:** `backend/services/heartbeat_service.py` line 386
```python
overrides.get("agent_autonomy_enabled", "false")  # THIS IS THE GATE
```

---

## Part II: The Gameplay Value Test

### 2.1 The Decision-Consequence-Situation Framework

Every proposed system connection must pass this test (inspired by Sid Meier's "interesting decisions" principle and the GDC talk "Systemic Game Design" by Joris Dormans):

1. **Does it create a DECISION for the player?** (Not: does something happen in the background)
2. **Does the decision have CONSEQUENCES the player can observe?**
3. **Do the consequences create a NEW DECISION SITUATION?**
4. **Is the loop SATISFYING?** (Tension → resolution → new tension)

If any answer is "no", the connection is technical complexity without gameplay value.

### 2.2 Chain-by-Chain Gameplay Assessment

#### A1: Influence → Building Readiness — ✅ HIGH VALUE

**The Decision:** "Which agent do I assign to which building?" Agents with high influence (strong relationships + matching profession + ambassador status) contribute more to building readiness.

**Player Agency Analysis (audit 2026-03-25):**

| Component | Weight | Player Control | Mechanism |
|-----------|--------|---------------|-----------|
| Relationships | 40% | INDIRECT | Co-locate agents → autonomy social interactions → opinions → relationships form. Player controls placement, not the relationship itself. |
| Professions | 30% | FUTURE: training mechanic | Currently static. **Must implement:** qualification_level increases when agent works in matching building type over time (e.g., military agent in Militärakademie: +0.2 ql per epoch). This creates the "training assignment" decision. |
| Ambassador | 30% | DIRECT | Player assigns ambassadors via embassy system. Clear, immediate impact. |

**Critical insight:** Without the profession training mechanic, 30% of influence is a dead number the player cannot affect. This MUST be addressed — either by implementing training (preferred) or by reweighting the formula to reduce professions weight in favor of controllable factors.

**Feedback loops the player MUST see:**
1. Agent placed in matching building → qualification increases → influence rises → readiness improves → zone stabilizes (positive loop, 1-3 epochs delay)
2. Agent placed in mismatched building → no qualification growth → influence stagnates → readiness penalized → zone weakens (negative loop, immediate)
3. Co-located agents → social interactions → relationship intensity grows → influence rises (emergent, player discovers through observation)

**How this is communicated to the player (B1-B3 requirement):**
- Agent panel: "General Wolf — Military (Lv. 3/5). Assigned to Militärakademie (+training). Influence: AVERAGE (28%). 3 allies in zone."
- Building panel: "Readiness 72% = Staffing 38% × Qualification 85% × Condition 75% × Influence 62% (AVERAGE tier)"
- Tooltip on influence: "Assign agents with matching professions and strong relationships for higher readiness. Ambassador status gives maximum boost."

**The Consequence:** Building readiness directly feeds zone stability. A well-staffed government building with qualified, well-connected agents makes the whole zone more stable. A poorly staffed one drags it down.

**The New Situation:** "My Industriegebiet Nord is failing. Do I move General Wolf from the stable Regierungsviertel to save it? But that weakens the Regierungsviertel... Or do I train a new agent at the Industriewerk first?"

**Game Design Reference:** This mirrors Crusader Kings 3's council system, where placing the right advisor on the right position directly affects realm stability. CK3's Fame system has 6 tiers with SPECIFIC mechanical breakpoints: Tier 4 (Illustrious, 4,000 Fame) gives +10% feudal opinion and +2 Knights; Tier 5 (Exalted, 8,000) gives +20% and +3; Tier 6 (Living Legend, 16,000) gives +30% and +4. Every tier is mechanically distinct — players FEEL the difference. The key insight: **influence must have CLEAR THRESHOLDS where behavior changes, not a smooth gradient**.

Stellaris's Influence system adds another lesson: it has a **hard cap of 1,000** with specific costs per action (claims, edicts, pacts). Scarcity creates trade-offs. Our influence should similarly GATE specific actions — e.g., only agents with influence >50% can serve as ambassadors, or high-influence agents provide a readiness multiplier while low-influence agents are a penalty.

Mount & Blade Bannerlord shows a third pattern: each fief grant gives +10 to the recipient and -3 to -8 to all other lords. Influence is zero-sum — making one agent more influential weakens others' relative position. This creates genuine dilemmas.

**UX Requirement:** The building detail panel must show: "Readiness: 72% (staffing 3/8 × qualification 85% × condition 0.75 × **avg influence 62%**)". The influence factor must be explicitly named, not buried in a formula.

**Architect Note:** ~~Influence currently exists only in frontend TypeScript.~~ **IMPLEMENTED** (migrations 158+160):
- `fn_compute_agent_influence(agent_id, simulation_id)` — SQL STABLE function, inlined by planner into MV refresh. Formula: relationships(top5) × 0.4 + professions(avg ql) × 0.3 + ambassador × 0.3
- `mv_building_readiness` rebuilt with `avg_influence` + `influence_factor` columns (3-tier: WEAK 0.85 / AVG 1.0 / STRONG 1.15)
- `fn_bootstrap_building_relations(simulation_id)` (migration 160) — populates `building_agent_relations` from `agents.current_building_id`, fixing the data pipeline gap where migration 157 assigned agents to buildings but never created relation records

---

#### A2: Zone Stability → Event Probability — ✅ HIGH VALUE

**The Decision:** "How do I handle this unstable zone?" The player must decide: fortify (zone action), assign better agents, or triage and let it fail.

**The Consequence:** Unstable zones attract more negative events. Stable zones attract fewer (and occasionally positive) events. This creates a **positive feedback loop** that must be carefully balanced to avoid death spirals.

**The New Situation:** "Altstadt is at 17% stability. Two new events just spawned there. If I fortify now, I spend resources. If I don't, it could cascade into the other zones."

**Game Design Reference — Three Stability Models:**

**Civilization 7 (2025):** Per-settlement happiness with escalating consequences. Unhappy: -2% penalty to ALL yields per unhappiness point (caps at -50%). Unrest: cannot purchase buildings, switch focus, or increase population. Revolt: triggered after staying Unhappy for a full turn during Crisis; 10 turns to fix or **permanently lose the settlement**. The escalation is gradual, predictable, and recoverable — but ignoring it is fatal.

**Frostpunk (2018):** Hope/Discontent are two INDEPENDENT bars (not a single spectrum). Hope falls from cold, starvation, death. Discontent rises from overwork, harsh laws, inequality. The game's thesis: "Failure isn't a wave crushing a sandcastle, but the tide grinding a cliff to dust." When Hope drops to zero and stays there — **game over**. The player ALWAYS has tools (laws, buildings, expeditions) but each tool has moral costs.

**Frostpunk 2 (2024):** Replaced Hope/Discontent with a Trust system: Revered → Respected → Accepted → Tolerated → Despised. Low trust causes riots, sabotage, and votes of no confidence (game over). Each faction has independent trust. Funding projects increases trust but costs resources — funding one faction repeatedly makes others suspicious. This is **zero-sum diplomacy**.

**The critical lesson from all three: the feedback loop must have a BRAKE** — a player action that slows or reverses the spiral. Without it, the system becomes a clock counting down to inevitable failure.

**Balance Parameters (Game Designer):**
```
stability 0.9+ → event multiplier 0.5x (very stable = few events)
stability 0.7  → event multiplier 0.8x (stable = normal)
stability 0.5  → event multiplier 1.0x (baseline)
stability 0.3  → event multiplier 1.3x (unstable = more events)
stability 0.1  → event multiplier 1.5x (critical = max, NOT 2.0x)
```
**The cap at 1.5x is critical.** Without it, a death spiral accelerates exponentially: low stability → more events → lower stability → even more events → zone death. The cap ensures that even the worst zones can be saved with intervention.

**Death Spiral Prevention:** Additionally, every negative event should have a 20% chance of spawning a "community response" positive event (people rallying in crisis). This is Frostpunk's key mechanic: extreme adversity generates hope events.

**UX Requirement:** Zone cards must show: "Event Risk: HIGH (stability 17% → 1.3x event chance). Fortify to reduce pressure."

**Architect Note:** The autonomous event service already queries `mv_zone_stability` for the cascade threshold check (line 288-293). The stability value is available. The change is a multiplier, not a new query.

---

#### A3: Resonance → Agent Mood — ⚠️ MEDIUM VALUE, HIGH COMPLEXITY

**The Decision:** Resonances are platform-level events (real-world news transformed into archetypal forces). The player's decision is whether to ATTUNE to a resonance (lean into it) or resist it. Attunement at depth ≥ 0.50 generates positive events. But getting there takes many ticks.

**The Consequence:** Agents in susceptible simulations get mood moodlets. "The Shadow" (conflict) = anxiety. "The Prometheus" (innovation) = inspiration. This creates atmospheric pressure that varies by simulation theme.

**The Problem (Game Designer):** This chain is hard to communicate because:
1. Resonances are abstract — "The Shadow" doesn't obviously connect to agent anxiety
2. Susceptibility is per-simulation and invisible to the player
3. The player can't directly counter resonance effects (no "shield" action)
4. The causal chain is: real-world news → resonance → susceptibility → moodlet → mood → activity — too many indirections

**Game Design Reference:** Victoria 3's "interest groups" are a comparable system: abstract forces that affect population mood based on complex interactions. Victoria 3 makes this work through exhaustive tooltips that show the FULL chain: "Interest Group: Industrialists → Approval: -12 → Because: Tax policy (+3), Working conditions (-8), Trade rights (-7)". The tooltip IS the game — without it, the numbers are meaningless.

**Recommendation (Game Designer):** Implement this LAST. The resonance→mood connection adds atmospheric depth but limited player agency. The player can't DO anything about "The Shadow" except wait for it to pass or attune (which takes weeks of ticks). This is simulation depth, not gameplay depth.

**If implemented:** Keep the moodlet strength LOW (-2 to +2). Resonance should be background pressure, not a dominant force. The weather system already provides zone-level mood effects; resonance should layer on top gently.

---

#### A4: Events → Agent Needs — ❌ LOW VALUE, RECOMMEND SKIP

**The Decision:** None. Events happen, agents' safety needs drop. The agent then autonomously seeks safety activities. The player observes this but doesn't decide anything.

**The Consequence:** Agents in dangerous zones become less effective (their needs drive them toward safety activities instead of productive ones). This is realistic but not fun.

**The Problem (Game Designer):** This is a system-to-system connection with NO player agency. Compare:
- RimWorld: A raid damages buildings → colonists get "saw corpse" debuff → colonists break → you must FIX the situation (build recreation, assign comfort tasks). The FIXING is the gameplay.
- This platform: Event hits zone → agent safety drops → agent seeks safety activity → ??? What does the player DO? There's no "assign comfort tasks" or "build recreation room" equivalent.

**Game Design Reference — Why System-to-System Without Player Agency Fails:**

**Dwarf Fortress Stress System:** Dwarves have long-term stress (-50,000 to +120,000) with thresholds at +25,000 (stressed), +50,000 (haggard), +100,000 (harrowed). At harrowed, observing death causes insanity. Recovery is painfully slow: max -43,564 points/year under PERFECT conditions, but max +20,160/year under stress. The asymmetry means once a dwarf enters the danger zone, it's nearly impossible to save them. The tantrum spiral (tantrum → destroys items → punishment → witnesses get stressed → their tantrums → cascading failure) is widely considered a **design flaw, not a feature.** (Theseus thesis: "Systems-Based Game Design in Dwarf Fortress", 2024)

**RimWorld's Break Thresholds** show the RIGHT way: Minor breaks at mood 35% (food binge, sad wander — annoying but manageable), Major at 20% (tantrum, drug binge — destructive but survivable), Extreme at 5% (berserk rage, fire starting, permanently leaving colony — catastrophic). Critically, after ANY break, the colonist gets a **+40 catharsis mood bonus for 2.5 days** — this PREVENTS cascading spirals. The catharsis mechanic is the key innovation: bad things happen, but recovery is built into the system.

**The lesson for our platform:** If events reduce agent needs, the agent spiral is: low safety → seek safety activity → less productive → zone stability drops → more events → lower safety → deeper spiral. There is NO catharsis mechanic and NO player intervention point. This is the DF tantrum spiral, not the RimWorld break system.

**Recommendation:** Skip A4 entirely. The autonomy system already models agent behavior through needs decay + activity selection. Adding event→needs feedback creates simulation depth that no player can meaningfully interact with. If events should affect agents, do it through MOODLETS (which are already implemented) not NEEDS (which are invisible).

---

#### A5: Default Autonomy ON — ✅ PREREQUISITE

**Not a gameplay decision.** This is infrastructure. Without autonomy ON, none of the other chains function. The Living World is dead.

**Risk Analysis (Architect):**

Production scope:
- 14 active template simulations (verified from earlier query)
- ~7-9 agents per simulation ≈ 100-130 agents total
- Heartbeat ticks every 4 hours = 6 ticks/day
- Operations per tick: ~10 queries per agent = ~1,300 queries per tick
- Daily load: ~7,800 queries — **negligible for Supabase**

Agent zone assignment:
- Only Velgarien agents are currently assigned to zones/buildings
- Other 13 simulations: agents have `current_zone_id = NULL`
- Code handles this gracefully: activity selection returns `[]`, social interactions skip zones with <2 agents
- **No errors, no crashes, just no visible activity** — agents without zones simply don't interact

**Recommendation:** Enable default ON, but monitor the first few ticks via Sentry. If any simulation has issues, the per-sim override (`agent_autonomy_enabled=false`) provides an instant kill switch.

**Data bootstrapping:** Before enabling, all main simulations need agents assigned to zones/buildings (like we did for Velgarien). Otherwise autonomy ticks produce empty results. Write a migration or script that assigns agents to buildings based on zone/building type affinity.

#### A5 Implementation Notes (2026-03-25)

**Implemented in:**
- `backend/services/heartbeat_service.py:386` — default changed from `"false"` to `"true"`
- `supabase/migrations/20260325200000_157_agent_autonomy_bootstrap.sql` — full bootstrapping

**Migration 157 performs 5 steps (all pure SQL, ADR-007 compliant):**

1. **Zone assignment** — affinity-based matching (agent.system to zone.zone_type) with round-robin fallback for even distribution. Maps: politics/military to government/command zones, economy to industrial/commercial, religion to residential/cultural, media to residential/commercial.
2. **Building assignment** — same affinity pattern within assigned zones. Agents get buildings matching their system where available.
3. **agent_needs bootstrap** — creates records with sensible defaults (all needs at 60.0, standard decay rates). PersonalityExtractionService can refine per-agent later.
4. **agent_mood bootstrap** — creates records with neutral baseline (mood_score=0, stress=0, resilience/volatility/sociability=0.5). Personality extraction can refine later.
5. **agent_opinions bootstrap** — creates bidirectional opinion records for all co-simulation agent pairs (base_compatibility=0.0 neutral). PersonalityExtractionService.initialize_opinions() can refine with Big Five compatibility later.

**Kill switch preserved:** Any simulation can opt out via `simulation_settings` row: `(sim_id, 'heartbeat', 'agent_autonomy_enabled', 'false')`.

---

## Part III: UX Information Architecture

### 3.1 The "Victoria 3 Tooltip" Pattern

Victoria 3 (Paradox, 2022) solved the "meaningless numbers" problem with what the community calls "explanation chains": hover over ANY number → tooltip shows the FULL calculation tree with every contributing factor, each one ALSO hoverable. This creates infinite drill-down depth while keeping the surface clean. PC Games N described it as "basically having the game's official wiki sitting right alongside your mouse pointer."

**Implementation detail:** Tooltips are "lockable" — holding the cursor still causes the tooltip to gain a solid border, preventing it from disappearing when you move to hover over highlighted terms inside it. This is critical UX: without locking, nested tooltips would be unusable because moving the cursor to the inner text would dismiss the outer tooltip.

**Dev Diary #74** specifically discusses this as a UX improvement: presenting "breakdowns of the calculations involved" so players can always understand WHY a number is what it is. The key principle from Philip Davis's tooltip analysis: "Advantages: matches cognitive learning patterns, minimal space, progressive learning. Challenges: needs keyboard navigation for accessibility, cursor sensitivity, mobile adaptation."

**Example from Victoria 3:**
```
Population Standard of Living: 12.3
  ├── Base: 10.0
  ├── Wages modifier: +1.5 (from industry employment)
  ├── Goods access: +0.8 (luxury goods available)
  └── Tax burden: -0.0 (no consumption tax)
```

**Our equivalent:**
```
Zone Stability: 17%
  ├── Infrastructure: 45% (3 buildings, avg readiness 45%)
  │     └── Archive Sub-Level C: 62% (staffed 2/4, qualification 85%, condition good)
  │     └── Room 441: 38% (staffed 1/3, qualification 40%, condition moderate)
  │     └── Kanzlerpalast: 35% (staffed 1/5, qualification 30%, condition good)
  ├── Security: 55% (level: medium)
  ├── Event pressure: -62% (2 active events, impact 7+8)
  └── Weather effect: -3% (rain, ambient pressure)
```

**UX Specialist Assessment:** Full Victoria 3 chains are overkill for our platform (their audience is hardcore strategy gamers who WANT spreadsheet depth). But the PRINCIPLE is right: every number should be one click/hover away from its explanation.

**Our approach: Progressive Disclosure (3 levels)**
1. **Surface:** The number itself with a color/label (e.g., "17% CRITICAL" in red)
2. **Info Bubble (hover/click "i"):** One-paragraph explanation: what this is, what it means, what you can do
3. **Detail View (navigate):** Full breakdown with contributing factors (the Health view already does this partially)

### 3.2 The Nine Unexplained Metrics

For each metric, the info bubble should answer THREE questions:
1. What is this? (Definition)
2. Why is it at this value? (Cause — reference ONE specific contributor)
3. What can I do? (Action — link to the relevant feature)

| Metric | Definition | Cause Example | Action |
|--------|-----------|---------------|--------|
| Agent Influence | How effective this agent is in the simulation | "70% from strong relationships with 3 agents" | "Edit agent to set profession, or create relationships" |
| Zone Stability | Zone operational health (0-100%) | "Low because 2 active events create 62% pressure" | "Fortify this zone or resolve events" |
| Zone Pressure | Combined force of events affecting this zone | "62% from events + 8% ambient weather" | "Stability improves as events resolve over time" |
| Agent Mood | Emotional state (-100 to +100) | "Negative because rain moodlet -3 and low safety need" | "Move agent to stable zone or trigger ceremony" |
| Agent Stress | Cumulative pressure (0-1000+) | "Rising because 3 negative moodlets active" | "At 800+, agent breaks down. Improve zone conditions." |
| Needs Radar | Five core drives (0-100 each) | "Social need low — agent will seek companionship" | "Needs fulfill automatically through agent activities" |
| Overall Health | Simulation-wide wellness average | "35% — 2 of 3 zones below 50% stability" | "Focus on the weakest zone first" |
| Building Readiness | Building operational effectiveness | "42% — understaffed (2/6) with no matching professions" | "Assign qualified agents to this building" |
| Entry Types | Heartbeat event categories | "Zone Shift = conditions in a zone changed" | Inline legend in pulse view |

---

## Part IV: Bureau Terminal (MUD Interface) -- Detailed Specification

### 4.1 Design Philosophy

The Bureau Terminal is a text-based command interface for interacting with simulations. The player types commands, receives narrative prose responses, and makes decisions through text. It is not a reskin of the GUI -- it introduces three gameplay mechanics absent from the dashboard:

1. **Local perspective.** The GUI shows all zones simultaneously. The terminal places the player IN a zone. Information beyond the current zone is invisible unless actively gathered. Information becomes a resource to be spent, not data to be consumed. (Design ref: Urban Dead's AP-gated minimap, Subterfuge's sonar-range visibility.)

2. **Interrogation as gameplay.** Agents are not chat partners -- they are intelligence sources. Different agents know different things based on their position, profession, relationships, and mood. The player assembles a picture by questioning multiple sources, identifying contradictions, and deciding who to trust. (Design ref: Her Story's keyword search with 5-result cap, Orwell's contradictory datachunks, Disco Elysium's passive skill checks, CK3's secrets/hooks system.)

3. **Resource-gated actions.** Zone operations (fortify, quarantine) and intelligence gathering (debrief, scan) consume limited points that refresh per heartbeat cycle. The player cannot do everything -- they must prioritize. (Design ref: Victoria 3's multi-pool capacity system, Stellaris's infiltration gates.)

The terminal exists in two modes:
- **OBSERVATION MODE** (template simulations) -- explore, observe, interrogate, manage zones
- **OPERATIONAL MODE** (epoch instances) -- all observation commands plus PvP operations, fog of war, and diplomatic communication

### 4.2 Expansion Stages

Each stage adds new commands, new gameplay mechanics, and a new player role. Later stages depend on earlier ones.

#### Stage 1: Observation Terminal

**Player role:** Analyst. Observe the simulation from a local perspective.

**Commands:** `look`, `go`, `examine`, `talk`, `weather`, `status`, `help`, `map`, `where`

**New mechanics:**
- Local perspective (player has a current zone; `look` shows only that zone)
- Realtime feed (heartbeat events, weather, agent activities stream into terminal)
- Interrogation via `talk` (agent responses are context-driven: mood, relationships, zone knowledge)

**Backend requirements:** None. All data available via existing APIs (`locationsApi`, `agentsApi`, `chatApi`, `heartbeatApi`, `gameMechanicsApi`).

#### Stage 2: Field Operations

**Player role:** Field commander. Observe AND act.

**Commands:** `fortify`, `quarantine`, `assign`, `unassign`, `ceremony`

**New mechanics:**
- Zone Action Budget -- limited Operations Points per heartbeat cycle (see 4.4.3)
- Agent reassignment as a lever -- moving agents between buildings changes readiness
- Consequence feedback -- next heartbeat tick shows results in the live feed

**Backend requirements:** Small. Zone Action Budget needs a new `terminal_action_budgets` table or PG function to track point spending per simulation per user per cycle.

#### Stage 3: Intelligence Network

**Player role:** Intelligence officer. Structured information gathering.

**Commands:** `debrief`, `ask {agent} about {topic}`, `investigate`, `scan`, `report`

**New mechanics:**
- Structured debriefing -- agents give formal reports based on their knowledge scope (see 4.4.2)
- Intelligence Points pool -- debriefs and scans cost Intel Points (see 4.4.3)
- Agent knowledge boundaries -- agents only know about their zone, their building, their relationships

**Backend requirements:** Medium. New AI prompt template for `debrief` responses. Intel Points tracking. Agent knowledge scope logic (which agent knows what).

#### Stage 4: Epoch Operations (PvP)

**Player role:** Operative handler. Command agents against other players.

**Commands:** `deploy`, `scout`, `intercept`, `sabotage`

**New mechanics:**
- Fog of war -- three types: spatial (only current zone visible), temporal (scout reports delayed 1-2 ticks), intentional (opponents can deceive)
- Operative detection -- `look` in epoch shows "Foreign operative detected" without revealing identity
- Noise system -- actions generate detectable "noise" (fortify = loud, scout = quiet, sabotage = medium)

**Backend requirements:** Large. Visibility system (what each player can see per zone), delayed scout report delivery, noise detection triggers. Integrates with existing `operative_mission_service.py`.

#### Stage 5: Spymaster (Multiplayer Diplomacy)

**Player role:** Spymaster. Negotiate, deceive, betray.

**Commands:** `ally`, `betray`, `broadcast`, `encrypt`, `dossier`

**New mechanics:**
- No binding agreements (Diplomacy board game pattern -- promises are just words)
- Broadcast as disinformation tool -- public messages visible to all, content unverifiable
- Encrypted communication -- private messages, but other players see "[ENCRYPTED TRANSMISSION DETECTED]"
- Alliance = shared scout reports; betrayal = reports severed + opponent warned
- Dossier -- accumulated intelligence on a specific player from all sources

**Backend requirements:** Medium. Messaging system for epoch players. Alliance state extension. Dossier aggregation query.

### 4.3 Command Reference

#### Navigation Commands (Stage 1)

**`look`**
- Syntax: `look` (no arguments -- shows current zone)
- API: `GET /api/v1/simulations/{id}/locations/zones/{zone_id}` + `GET /api/v1/simulations/{id}/health/zones/{zone_id}`
- Synonyms: `l`, `observe`, `survey`
- Output:
```
REGIERUNGSVIERTEL -- Government Quarter
Stability: 17% [CRITICAL] | Security: moderate
Weather: Steady rain at 10C. The Bureau watchtowers survey
the district through sheets of water.
Buildings: Rathaus (42% ready), Militaerakademie Wolf (78% ready), Archiv (61% ready)
Agents present: General Aldric Wolf, Inspektor Mueller, Lena Kray
Active events: 2 (elemental_surge [escalating], cascade_spawn [active])
Exits: Industriegebiet [NORTH], Altstadt [EAST], Hafenviertel [SOUTH]
```

**`go {zone}`**
- Syntax: `go {zone_name}` or `go {direction}` (north/south/east/west if zone adjacency exists)
- API: `GET /api/v1/simulations/{id}/locations/zones` (list for name resolution)
- Synonyms: `move`, `walk`, `travel`
- Effect: Sets session `currentZoneId`. Automatically triggers `look` on arrival.

**`where`**
- Syntax: `where`
- Output: "You are in REGIERUNGSVIERTEL (Government Quarter), Velgarien."

**`map`**
- Syntax: `map`
- Output: ASCII zone map with current position marked. Shows stability color per zone.
```
    [INDUSTRIEGEBIET]
         |
  [ALTSTADT]---[*REGIERUNGSVIERTEL*]
         |          |
   [KULTURVIERTEL]  [HAFENVIERTEL]

Legend: * = your location
```

#### Observation Commands (Stage 1)

**`examine {target}`**
- Syntax: `examine {agent_name}` or `examine {building_name}`
- API (agent): `GET /api/v1/simulations/{id}/agents/{agent_id}` + mood + needs
- API (building): `GET /api/v1/simulations/{id}/buildings/{building_id}` + readiness
- Synonyms: `ex`, `inspect`, `x`
- Agent output:
```
GENERAL ALDRIC WOLF -- Militaerakademie Wolf
System: military | Profession: Strategist (Lv 4)
Influence: 72% [STRONG] | Mood: +8 (Content) | Stress: 120 (Calm)
Needs: Social ###-- 34  Purpose ##### 89  Safety #---- 18
Moodlet: zone_weather (rain, -3 distress)
Relationships: 3 allies (avg intensity 7/10), 1 rival
Ambassador: Conventional Memory (active, not blocked)
```

**`weather`**
- Syntax: `weather`
- API: `GET /api/v1/simulations/{id}/heartbeat/entries?entry_type=ambient_weather&limit=1`
- Synonyms: `wx`, `conditions`
- Output:
```
CURRENT CONDITIONS -- Prague (50.08N, 14.44E)
WMO Code 61: Rain | Temperature: 10.1C | Wind: 12.3 km/h
Visibility: 4,200m | Moon: Waxing Crescent (23%)
Mood effect: -3 distress (all agents in all zones)
```

**`status`**
- Syntax: `status`
- API: `GET /api/v1/simulations/{id}/health`
- Synonyms: `sitrep`, `sit`
- Output:
```
SITUATION REPORT -- Velgarien
Overall health: 48% [STRUGGLING]
Zone stability:
  Regierungsviertel  17% [CRITICAL] ####-----------
  Industriegebiet    52% [UNSTABLE]  ########-------
  Altstadt           71% [STABLE]    ###########----
  Hafenviertel       34% [UNSTABLE]  #####----------
  Kulturviertel      68% [STABLE]    ##########-----
Embassies: 2 active (Conventional Memory: operational, Cite: limited)
Operations points: 3/3 | Intel points: 2/2
```

#### Intelligence Commands (Stage 1 + Stage 3)

**`talk {agent}`** (Stage 1)
- Syntax: `talk {agent_name}` then free-form conversation
- API: `POST /api/v1/simulations/{id}/chat/conversations/{conv_id}/messages`
- Synonyms: `speak`, `contact`, `hail`
- Effect: Opens conversation mode. Agent responds via existing `ChatAIService` with terminal context injected into system prompt. Player types freely until `leave` or `bye`.
- Output:
```
You approach General Wolf in the Militaerakademie.
[Entering conversation. Type 'leave' to exit.]

Wolf: "The rain doesn't bother me. What bothers me is the
tremor reports from the northern industrial zone. Something
is wrong with the substrate."

> What kind of tremors?
Wolf: "Low-frequency. The kind you feel in your boots, not
your ears. Inspektor Mueller filed a report yesterday but
it was... vague. I suspect she knows more than she's saying."
```

**`debrief {agent}`** (Stage 3)
- Syntax: `debrief {agent_name}`
- API: New prompt template via `ChatAIService` with structured output format
- Cost: 1 Intel Point
- Effect: Agent gives a formal situational report. Content depends on agent's knowledge scope:
  - Agents report on their current zone, their building, and agents they have relationships with
  - High-influence agents include political context and cross-zone observations
  - Low-mood agents give pessimistic assessments (but may be more honest)
  - Agents can contradict each other -- two debriefs may give conflicting information (Orwell pattern)
- Output:
```
[DEBRIEF] General Aldric Wolf -- Militaerakademie Wolf
Intel cost: 1 point (1 remaining)

ZONE ASSESSMENT: "Regierungsviertel is in serious trouble.
The cascade event from last cycle destabilized the northern
perimeter. I count two active threats and staffing is at 40%."

PERSONNEL NOTE: "Inspektor Mueller has been unusually quiet.
She filed a tremor report but withheld details. I have a
strong working relationship with her -- normally she shares
everything. Something changed."

RECOMMENDATION: "Fortify this zone immediately. If we lose
the Rathaus, administrative capacity drops to zero."
```

**`ask {agent} about {topic}`** (Stage 3)
- Syntax: `ask {agent_name} about {topic}`
- API: New prompt template via `ChatAIService` with topic constraint
- Cost: 0 (uses existing conversation, not a formal debrief)
- Effect: Targeted question. Agent responds only about the topic, filtered by their knowledge.

**`investigate {event}`** (Stage 3)
- Syntax: `investigate {event_name}` or `investigate {event_id}`
- API: `GET /api/v1/simulations/{id}/events/{event_id}`
- Cost: 1 Intel Point
- Output: Event history (creation, escalation, affected zones, involved agents, reaction modifier).

**`scan`** (Stage 3)
- Syntax: `scan`
- API: `GET /api/v1/simulations/{id}/health/zones` (all zones, summarized)
- Cost: 1 Intel Point
- Effect: Breaks local perspective for one command. Shows all zones at reduced detail.
- Output:
```
[SCAN] Radar sweep -- all sectors
  Regierungsviertel  17% CRITICAL  2 events  3 agents
  Industriegebiet    52% UNSTABLE  1 event   4 agents
  Altstadt           71% STABLE    0 events  5 agents
  Hafenviertel       34% UNSTABLE  3 events  2 agents
  Kulturviertel      68% STABLE    0 events  4 agents
Intel cost: 1 point (0 remaining)
```

**`report`** (Stage 3)
- Syntax: `report`
- Effect: Generates a summary of the player's observations this session as a Bureau document.

#### Field Operation Commands (Stage 2)

**`fortify {zone}`**
- Syntax: `fortify {zone_name}` or `fortify` (current zone)
- API: `POST /api/v1/simulations/{id}/zones/{zone_id}/actions` with `action_type=fortify`
- Cost: 1 Operations Point
- Synonyms: `reinforce`, `defend`
- Effect: -15% event pressure for 7 days. Cooldown: 14 days.
- Noise level (Epoch): HIGH -- opponents in adjacent zones detect "Fortification activity detected in {zone}"
- Output:
```
[ZONE ACTION] Deploying fortification resources to Regierungsviertel.
Effect: -15% event pressure for 7 days.
Cost: 1 ops point (2 remaining). Cooldown: 14 days.
```

**`quarantine {zone}`**
- Syntax: `quarantine {zone_name}` or `quarantine` (current zone)
- API: `POST /api/v1/simulations/{id}/zones/{zone_id}/actions` with `action_type=quarantine`
- Cost: 2 Operations Points
- Synonyms: `lockdown`, `isolate`
- Effect: Events cannot spread to/from zone for 14 days. Agents in zone cannot be reassigned.

**`assign {agent} to {building}`**
- Syntax: `assign {agent_name} to {building_name}`
- API: `POST /api/v1/simulations/{id}/buildings/{building_id}/assign-agent?agent_id={id}`
- Cost: 0 (no point cost, but strategic tradeoff -- removing agent from one building affects its readiness)
- Synonyms: `station`, `post`, `transfer`

**`unassign {agent}`**
- Syntax: `unassign {agent_name}`
- API: `DELETE /api/v1/simulations/{id}/buildings/{building_id}/unassign-agent?agent_id={id}`

**`ceremony`**
- Syntax: `ceremony`
- API: `POST /api/v1/forge/drafts`
- Effect: Initiates a Forge ceremony from the terminal. Requires Architect clearance.

#### Epoch PvP Commands (Stage 4)

**`deploy {operative} to {zone}`**
- Syntax: `deploy {operative_type} to {zone_name}`
- Operative types: `spy`, `saboteur`, `propagandist`, `assassin`, `infiltrator`
- API: `POST /api/v1/epochs/{epoch_id}/operatives`
- Effect: Deploys operative to target zone. Mission resolves over 1-2 cycles.
- Noise level: varies by type (spy = LOW, propagandist = MEDIUM, saboteur = HIGH)

**`scout {zone}`**
- Syntax: `scout {zone_name}`
- API: `POST /api/v1/epochs/{epoch_id}/operatives` with `operative_type=spy`
- Effect: Sends recon operative. Report arrives 1-2 ticks later (temporal fog).
- Noise level: LOW

**`intercept`**
- Syntax: `intercept`
- API: `POST /api/v1/epochs/{epoch_id}/operatives/counter-intel`
- Effect: Sweeps current zone for foreign operatives. May detect and capture.

**`sabotage {building}`**
- Syntax: `sabotage {building_name}`
- API: `POST /api/v1/epochs/{epoch_id}/operatives` with `operative_type=saboteur`
- Effect: Damages target building (condition degrades). Noise level: HIGH.

#### Diplomacy Commands (Stage 5)

**`ally {player}`**
- Syntax: `ally {player_name}`
- API: `POST /api/v1/epochs/{epoch_id}/participants/{sim_id}/alliance`
- Effect: Proposes alliance. If accepted, scout reports are shared. No binding enforcement.

**`betray {ally}`**
- Syntax: `betray {player_name}`
- Effect: Dissolves alliance. Former ally receives: "[INTELLIGENCE BREACH] Alliance with {player} terminated. Your zone data may be compromised."

**`broadcast {message}`**
- Syntax: `broadcast {text}`
- Effect: Public message to all epoch participants. Can be used for disinformation.

**`encrypt {message} for {player}`**
- Syntax: `encrypt {text} for {player_name}`
- Effect: Private message. All other participants see: "[ENCRYPTED TRANSMISSION DETECTED between {sender} and {recipient}]"

**`dossier {player}`**
- Syntax: `dossier {player_name}`
- Effect: Shows accumulated intelligence on a player: scout reports, intercepted comms, observed deployments.

#### Utility Commands (All Stages)

**`help`** -- Lists all unlocked commands with one-line descriptions. `help {command}` shows detailed usage.

**`history`** -- Shows last 20 commands entered this session.

**`filter {channel}`** -- Filter realtime feed: `filter intel`, `filter alert`, `filter all`, `filter off`.

**`config {setting}`** -- Terminal personalization: `config color amber|green|white`, `config scanlines on|off`, `config sound on|off`.

### 4.4 Gameplay Mechanics

#### 4.4.1 Local Perspective

The player has a `currentZoneId` stored in session state (not database). `look` shows only the current zone. Events and activities from other zones appear in the realtime feed with a `[DISTANT]` prefix and reduced detail:

```
[DISTANT] [ALERT] Elemental surge detected in Industriegebiet.
```

In OBSERVATION MODE (template), `scan` breaks the local perspective for one command at the cost of 1 Intel Point.

In OPERATIONAL MODE (epoch), the local perspective becomes Fog of War (see 4.4.6).

Design ref: Urban Dead removes the minimap when AP hits 0 -- forcing information blindness. Our local perspective is always-on, creating a fundamentally different relationship with information compared to the GUI.

#### 4.4.2 Interrogation System

Three tiers of agent interaction:

1. **`talk`** (Stage 1) -- Open conversation via existing `ChatAIService`. The terminal injects Bureau context into the system prompt: the agent knows it is being addressed by a Bureau operative, and its responses are colored by its personality, mood, and current circumstances. Free-form, no cost.

2. **`ask {agent} about {topic}`** (Stage 3) -- Targeted query. The agent responds only about the named topic, filtered by what it actually knows. Agents without relevant knowledge say so: "I don't have information on that." Free, but limited by agent knowledge scope.

3. **`debrief {agent}`** (Stage 3) -- Formal structured report. Costs 1 Intel Point. The agent produces a standardized Bureau report with three sections: ZONE ASSESSMENT, PERSONNEL NOTE, RECOMMENDATION. Content quality depends on:
   - **Position**: Agents report on their current zone and building only
   - **Profession**: Military agents emphasize security; economic agents emphasize infrastructure
   - **Influence**: High-influence agents (>55%) include political context and cross-zone observations
   - **Mood**: Low-mood agents give more pessimistic (but sometimes more honest) assessments
   - **Relationships**: Agents mention allies and rivals by name; strained relationships produce guarded reports

**Contradictions as gameplay:** Two agents debriefed about the same situation may give conflicting accounts. Inspektor Mueller says the zone is stable; General Wolf says it is critical. The player must decide who to trust -- or investigate further. This is the Orwell pattern: contradictory information IS the puzzle.

AI integration: `debrief` uses a new prompt template (4-layer architecture):
1. System rules (Bureau context, response format, knowledge boundaries)
2. Dynamic injection (agent personality profile, current mood, relationship graph)
3. Game state (zone stability, active events, building readiness -- serialized)
4. Response format (ZONE ASSESSMENT / PERSONNEL NOTE / RECOMMENDATION)

#### 4.4.3 Zone Action Budget

Multi-pool resource system inspired by Victoria 3:

| Pool | Default | Refresh | Used by |
|------|---------|---------|---------|
| Operations Points | 3 per cycle | Full refresh each heartbeat cycle | `fortify`, `quarantine` |
| Intel Points | 2 per cycle | Full refresh each heartbeat cycle | `debrief`, `investigate`, `scan` |

`fortify` costs 1 ops point. `quarantine` costs 2 ops points. `debrief`, `investigate`, and `scan` each cost 1 intel point. `talk`, `ask`, `examine`, `look` are free.

Pool sizes and refresh rates are stored in `simulation_settings` (configurable per simulation). Default values above are sensible for 4-6 hour heartbeat cycles.

The budget creates the central tradeoff: you cannot fortify every zone AND debrief every agent. You must choose between acting and learning. Torn City's spy career path uses the same pattern -- intelligence-gathering costs the same resource as action-taking.

#### 4.4.4 Progressive Disclosure

Commands unlock in tiers based on terminal usage:

| Tier | Trigger | Commands unlocked |
|------|---------|-------------------|
| 1 | Terminal first opened | `look`, `go`, `examine`, `talk`, `weather`, `status`, `help`, `map`, `where` |
| 2 | After 10 successful commands | `fortify`, `quarantine`, `assign`, `unassign`, `ceremony` |
| 3 | After first `debrief` or 25 commands | `debrief`, `ask`, `investigate`, `scan`, `report` |
| 4 | Epoch context only | `deploy`, `scout`, `intercept`, `sabotage` |
| 5 | After 5 epoch cycles completed | `ally`, `betray`, `broadcast`, `encrypt`, `dossier` |

Unlock notifications are embedded in the narrative:

```
[SYSTEM] Clearance upgraded to LEVEL 2.
New commands available: fortify, quarantine, assign, unassign, ceremony.
Type 'help fortify' for details.
```

Bureau Commendations (optional achievement system):
- "First Contact" -- complete first `talk` conversation
- "Field Report" -- complete first `debrief`
- "Crisis Manager" -- `fortify` a zone below 30% stability
- "Double Agent" -- receive contradictory debriefs from two agents
- "Spymaster" -- complete an epoch with 3+ successful spy deployments

Design ref: Hacknet progressively unlocks entire API layers. Superhuman teaches shortcuts by showing them alongside search results.

#### 4.4.5 Realtime Feed

Events stream into the terminal as they occur, separated by channel (EVE Online pattern):

```
[INTEL] Zone shift: Industriegebiet stability dropped to 48% (was 52%)
[WEATHER] Conditions changed: rain clearing, visibility improving to 8km
[ALERT] CRITICAL: Regierungsviertel stability below 20%. Immediate action recommended.
[DISTANT] [INTEL] Agent activity: Elena Voss completed social interaction in Altstadt
```

Channel types:
- `[INTEL]` -- heartbeat events, zone shifts, agent activities in current zone
- `[WEATHER]` -- ambient weather changes
- `[ALERT]` -- critical stability drops (<30%), event escalations, operative detections (epoch)
- `[DISTANT]` -- events from other zones (reduced detail)
- `[COMMS]` -- epoch player messages (Stage 5)

Feed control: `filter intel` shows only intel; `filter alert` shows only alerts; `filter all` shows everything; `filter off` pauses the feed.

Auto-scroll: terminal scrolls with new events when the player is at the bottom. If the player scrolls up to read history, auto-scroll pauses until they scroll back down.

Design ref: EVE Online's multi-channel chat is the intelligence network. Dwarf Fortress's combat log creates narrative through extreme specificity -- we should aim for the same (specific agent names, building names, numerical changes).

#### 4.4.6 Fog of War (Stage 4 -- Epoch Only)

Three fog types:

1. **Spatial fog.** Player sees only their current zone in full detail. Adjacent zones show stability status only. Distant zones are invisible. `scan` costs Intel Points and reveals a snapshot.

2. **Temporal fog.** `scout` reports arrive 1-2 ticks after deployment, not immediately. The information may be outdated by the time it arrives.

3. **Intentional fog.** Opponents can broadcast disinformation. Encrypted messages are visible but unreadable. Alliance betrayals reveal that your shared data may be compromised.

Operative detection: when a foreign operative is in your zone, `look` appends:
```
[!] Foreign operative detected in this zone. Identity unknown.
    Use 'intercept' to attempt identification and capture.
```

Noise system: every action has a noise level. Adjacent-zone players may detect high-noise actions:
```
[DISTANT] [ALERT] Fortification activity detected in Regierungsviertel.
[DISTANT] [INTEL] Unidentified movement in Hafenviertel. (noise: low)
```

Design ref: Subterfuge's sonar-range visibility, where the post-game replay with fog removed is often the most dramatic moment. We should similarly consider an epoch-end "fog lift" showing what actually happened.

#### 4.4.7 Diplomatic Deception (Stage 5 -- Epoch Only)

Core rule: no binding agreements. An `ally` command creates a formal alliance with shared scout reports, but there is no enforcement mechanism. Either party can `betray` at any time. This follows the Diplomacy board game pattern -- the game's entire tension comes from trust and its violation.

`broadcast` is public and unverifiable. A player broadcasting "Industriegebiet is wide open, no defenses" may be telling the truth or setting a trap. Recipients must decide based on their own intelligence.

`encrypt` creates private channels, but the act of encryption is visible. Other players see `[ENCRYPTED TRANSMISSION DETECTED between Operative A and Operative B]` -- they know communication is happening, creating suspicion.

`dossier {player}` aggregates all intelligence gathered about a specific opponent: scout reports, intercepted transmissions, observed deployments, noise detections. This becomes more valuable over time.

Design ref: Neptune's Pride's slow real-time pace means that launched fleets take days to arrive -- the gap between "he said he wouldn't attack" and "his fleet is 12 hours from my border" is where the entire game lives. Our deploy/scout system creates the same tension with delayed information.

### 4.5 AI Integration

**`talk` prompt injection:** When the player enters conversation mode, the system prompt for `ChatAIService` receives additional context:

```
The agent is being addressed by a Bureau operative via a field terminal.
The agent should respond in character, informed by their current emotional
state and zone conditions. They should volunteer relevant observations
about their zone without being asked -- intelligence operatives expect
proactive reporting.
```

**`debrief` prompt template:** A new structured prompt that produces a three-section Bureau report (ZONE ASSESSMENT / PERSONNEL NOTE / RECOMMENDATION). The prompt includes serialized game state: zone stability, building readiness, active events, agent relationships. The agent's personality profile (Big Five) and mood score influence tone and content.

**Agent knowledge boundaries:** Enforced at the prompt level. The system prompt tells the AI what the agent knows and does not know:
- Current zone conditions (stability, events, weather) -- always known
- Current building (readiness, staffing) -- always known
- Other agents in same zone -- known
- Other agents in different zones -- only known if relationship exists
- Cross-zone events -- only known if agent has >55% influence (political awareness)
- Epoch-specific information -- never (template agents don't know about epoch mechanics)

**Contradiction generation:** Not forced. Contradictions emerge naturally from different agents having different information scopes and personality-driven interpretation. A pessimistic agent with low mood interprets 48% stability as "the zone is collapsing"; an optimistic agent interprets it as "holding steady."

### 4.6 Terminal Placement and Navigation

#### In Template Simulations

- New tab "Terminal" in `SimulationNav.ts` with console icon
- Route: `/simulations/:slug/terminal`
- Lazy-loaded via `sim-view-imports.ts` (existing pattern)
- Component: `<velg-terminal-view>` wrapping `<velg-bureau-terminal>`
- Mode: OBSERVATION MODE (Stage 1-3 commands)
- State persists across tab switches (zone position, command history, clearance level)

#### In Epoch

- New tab "Terminal" in `EpochCommandCenter.ts` alongside existing tabs (overview, operations, war-room, alliances, chat)
- Same `<velg-bureau-terminal>` component with epoch context
- Mode: OPERATIONAL MODE (Stage 4-5 commands additionally available)
- WarRoomPanel battle log events stream into the terminal feed
- Inherits simulation context from the participant's assigned simulation

#### Keyboard Shortcut

- `Ctrl+`` (backtick) toggles a terminal overlay from any simulation or epoch tab
- Overlay: slides up from bottom, 60% viewport height
- `Escape` or `Ctrl+`` again dismisses the overlay
- Full tab view remains primary; overlay is a power-user shortcut

### 4.7 Onboarding and User Guidance

**First-time detection:** `localStorage` flag `bureau_terminal_onboarded_{simulationId}`

**Boot sequence (first visit only):**
```
+----------------------------------------------+
| BUREAU OF IMPOSSIBLE GEOGRAPHY               |
| FIELD TERMINAL v3.7 -- CLASSIFIED            |
|                                              |
| Initializing secure connection...            |
| Operator clearance: LEVEL 1                  |
| Assigned sector: {simulation_name}           |
|                                              |
| Type 'help' for available commands.          |
| Type 'look' to observe your surroundings.    |
+----------------------------------------------+
```

**Guided first 5 commands (Achaea's narrative tutorial pattern):**
1. After first `look`: hint appears -- "Use 'examine {agent name}' to access a dossier."
2. After first `examine`: "Use 'talk {agent name}' to initiate contact."
3. After first `talk`: "Use 'go {zone name}' to move to another sector."
4. After first `go`: "Use 'status' for a full situation report."
5. After first `status`: "Onboarding complete. You have full LEVEL 1 clearance."
6. Hints stop permanently after completing onboarding.

**Quick-action buttons (Written Realms hybrid pattern):**
- Row of 4-6 context-sensitive buttons below the terminal input field
- Template mode: [Look] [Status] [Weather] [Help]
- Epoch mode: [Look] [Status] [Deploy] [Scout]
- Button click TYPES the command into the input field AND executes it -- the user sees the text, learns the syntax naturally
- Mobile: buttons are larger and more prominent; input field is secondary

**Help system:**
- `help` -- lists all unlocked commands with one-line descriptions
- `help {command}` -- detailed usage with syntax and example output
- Unrecognized commands -- "Unknown command '{input}'. Type 'help' for available commands." If a close match exists (Levenshtein distance <= 2), suggest: "Did you mean '{suggestion}'?"

### 4.8 Architecture

#### Component Structure

```
frontend/src/
  components/terminal/
    TerminalView.ts           -- SimulationShell tab wrapper (route context, auth check)
    BureauTerminal.ts         -- Core terminal component (input, output, CRT effects)
    TerminalQuickActions.ts   -- Context-sensitive button row below terminal
  services/
    TerminalStateManager.ts   -- Preact Signals: zone, history, clearance, budgets
  utils/
    terminal-commands.ts      -- Command parser (verb-noun + synonyms + dispatch)
    terminal-formatters.ts    -- API response to prose text conversion
```

#### Technology Decision: Custom LitElement (Not jQuery Terminal)

jQuery Terminal was recommended in the initial assessment but conflicts with the project architecture:
- Shadow DOM incompatibility (jQuery Terminal manipulates light DOM directly)
- jQuery dependency adds ~90KB for a library we would use ~10% of
- Prevents integration with Preact Signals and LitElement lifecycle

Custom LitElement (~500 lines) provides full control over styling, accessibility, and signals integration. Follows the `EchartsChart.ts` pattern: external complexity wrapped in a clean LitElement component.

#### State Management

`TerminalStateManager` as dedicated signal store (follows `ForgeStateManager` pattern):
- `currentZoneId: signal<string | null>`
- `commandHistory: signal<string[]>`
- `clearanceLevel: signal<number>` (1-5, determines unlocked commands)
- `operationsPoints: signal<number>`
- `intelPoints: signal<number>`
- `unlockedCommands: signal<Set<string>>`
- `onboarded: signal<boolean>`

Persisted to `localStorage` per simulation (survives page reload). NOT stored in global `AppStateManager` -- terminal state is scoped to the terminal.

#### Command Parser

Bartle-inspired verb-noun parser with synonym resolution. For our bounded command space (~25 verbs, ~100 nouns from simulation entities), a simple lookup table is sufficient. Full grammar parsing (Bartle stages 3-4) is unnecessary.

```
Input: "ex wolf"
1. Tokenize: ["ex", "wolf"]
2. Dictionary: "ex" -> "examine" (synonym match)
3. Bind: "wolf" -> agent with name containing "wolf" (fuzzy match on sim data)
4. Dispatch: examineCommand(agentId)
5. Execute: API call -> format response -> display
```

Unrecognized verbs suggest closest match. Ambiguous nouns prompt: "Multiple matches: General Aldric Wolf, Wolf-Kaserne. Which one?"

#### CRT Aesthetic

Existing `terminal-theme-styles.ts` provides the foundation (amber tokens, cursor-blink animation, scanline overlay). Additional effects:
- Scanlines: `background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
- Phosphor glow: `text-shadow: 0 0 4px var(--color-accent-amber-glow)`
- Chromatic aberration (subtle): `text-shadow: -0.5px 0 rgba(255,0,0,0.05), 0.5px 0 rgba(0,255,255,0.05)` on headers only
- All effects gated behind `@media (prefers-reduced-motion: no-preference)`

#### Accessibility

- Output area: `role="log"` with `aria-live="polite"`
- Screen reader mode toggle: `config screenreader on` removes CRT effects and adds aria-labels to all output sections
- All color information also conveyed via text labels (e.g., "[CRITICAL]" not just red)
- Tab completion announced via `aria-live="assertive"` region
- Focus management: terminal input always receives focus when tab is active

### 4.9 Game Design References

**MUD Design:**
- Procedural Realms (proceduralrealms.com) -- browser-first MUD with dockable panels
- Written Realms (writtenrealms.com) -- hybrid text+click model, browser-first WebSocket architecture
- Iron Realms / Achaea -- narrative-driven onboarding ("Escape from Miba" tutorial)
- Richard Bartle: Command Parsers (mud.co.uk/richard/commpars.htm)

**Interrogation Mechanics:**
- Her Story -- keyword search with 5-result cap creates skill expression from scarcity
- Orwell -- contradictory datachunks as core puzzle mechanic
- Disco Elysium -- 24 skills as competing internal voices; passive checks inject unsolicited intel
- CK3 -- secrets/hooks system; discovered information becomes leverage

**Strategy Resource Systems:**
- Victoria 3 -- multi-pool capacity (Influence, Bureaucracy, Authority)
- Stellaris -- Intel/Infiltration gates for espionage operations
- Torn City -- intelligence-gathering costs same resource as action-taking

**PvP/Fog of War:**
- Subterfuge -- sonar-range visibility; post-game fog-lift replay
- Diplomacy (board game) -- no binding agreements; trust IS the mechanic
- Neptune's Pride -- slow real-time; irreversible fleet commitment

**Terminal Aesthetics:**
- Afterglow-CRT -- CSS custom properties for CRT effects
- Hacknet / Bitburner -- terminal-as-game-interface with progressive API unlocking

**Accessibility:**
- MUDRammer discovery: 14% of users had VoiceOver enabled
- Materia Magica: 50% blind players on some nights
- xterm.js Screen Reader Mode documentation

---

## Part V: Implementation Roadmap

### Priority Order (by gameplay value)

| Priority | Item | Gameplay Value | Effort | Dependencies | Status |
|----------|------|---------------|--------|-------------|--------|
| 1 | **A5: Autonomy ON** | ✅✅ Prerequisite | Tiny (1 line change + agent bootstrapping) | Agent zone assignment for all sims | **DONE** (migration 157, 2026-03-25). **Post-audit (2026-03-26):** Fixed division-by-zero in zone/building assignment for sims with 0 zones |
| 2 | **A1: Influence → Readiness** | ✅✅ High | Medium (PG function + MV update) | A5 must be active | **DONE** (migration 158 + Pydantic/TS types, 2026-03-25). UX display → B1-B3. **Post-audit (2026-03-26):** Fixed cross-simulation data leak (simulation_id filter on agent_professions). **Data pipeline fix (2026-03-26):** Migration 160 — `fn_bootstrap_building_relations` populates building_agent_relations from agents.current_building_id (blocker: MV showed 0% readiness because relation table was empty) |
| 3 | **A2: Stability → Events** | ✅✅ High | Small (multiplier in event service) | A5 must be active | **DONE** (autonomous_event_service.py + catharsis mechanic, 2026-03-25). UX display → B1-B3. **Post-audit (2026-03-26):** 10 defensive access fixes, try-except on _get_agent_data, nested error handler in heartbeat tick |
| 4 | **B1-B3: Info Bubbles + UX** | ✅ High (communication) | Medium (6 components, ~80 lines) | A1+A2 must be real first | **DONE** (2026-03-26). B3: Zone event risk display (RimWorld threshold markers + CRITICAL/HIGH/MEDIUM/LOW tier badges + multiplier + actionable hints + critical zone wash). B2: Building readiness factor pipeline (4-gauge Victoria 3 pattern, bottleneck detection with red accent, influence tier badge WEAK/AVG/STRONG). B1: Agent influence panel redesign (natural language breakdown: "3 allies avg 6/10" instead of "60%", profession names + levels, actionable hint for WEAK tier). Also fixed: diamond badge overflow on VelgGameCard (4+ digit numbers now show "1K" format). |
| 5 | **MUD Stage 1-2: Observation + Field Ops** | ✅✅ Potentially highest | Medium-Large (new component + command parser) | Existing APIs sufficient, Zone Action Budget needs small backend | **DONE** (2026-03-26). 8 new files + 5 edits (~1,800 LOC). BureauTerminal CRT component, TerminalStateManager, command parser (14 commands, synonym map, Levenshtein fuzzy match), terminal-formatters (20+ format functions), TerminalQuickActions, TerminalView tab wrapper. Route wired at `/simulations/:slug/terminal`. Stage 1: look/go/examine/talk/weather/status/help/map/where/history/filter. Stage 2: fortify/quarantine/assign/unassign/ceremony. Full CRT aesthetic (scanlines, phosphor glow, chromatic aberration), boot sequence, onboarding hints, progressive disclosure (Tier 2 at 10 commands), realtime feed polling, conversation mode. |
| 6 | **A3: Resonance → Mood** | ⚠️ Medium | Medium | A5 must be active | Pending |
| 7 | **MUD Stage 3: Intelligence Network** | ✅ High | Medium (AI debrief prompts) | MUD Stage 1-2 must work first | Pending |
| 8 | **MUD Stage 4-5: Epoch PvP + Diplomacy** | ✅ High | Large (visibility system, messaging) | MUD Stage 3 + Epoch system | Pending |
| — | ~~A4: Events → Needs~~ | ❌ Skip | — | No player agency | Skipped |

### Skip Recommendation: A4 (Events → Needs)

Events should affect agents through MOODLETS (already implemented via weather and social interactions), not through NEEDS (invisible, automatic, no player decision). The existing moodlet system is the correct abstraction. Adding needs feedback creates simulation depth without gameplay depth — the player observes but cannot act.

### B1-B3 Game Design Requirements (from UI audit 2026-03-25)

**Critical finding:** The current influence display on AgentDetailsPanel is **player-hostile**. Showing "Professions: 0%" when the agent's tag reads "MILITARY" is contradictory and confusing. Raw percentages ("Relationships: 60%") give no actionable insight. The player cannot answer: "What should I DO about this?"

**Design principles for B1-B3 (from CK3, Victoria 3, Frostpunk 2 research):**

1. **Qualitative labels on overview, numbers in tooltips.** CK3 shows "Martial: 14 (★★★★☆)", not "Martial: 47%". Our influence section should show: "STRONG" / "AVERAGE" / "WEAK" tier labels, not raw percentages.

2. **Show the WHY, not just the WHAT.** Instead of "Relationships: 60%", show: "3 allies (avg. intensity 6/10)". Instead of "Professions: 0%", show: "Military (Lv. 3/5)". Instead of "Diplomatic: -", show: "Not an ambassador".

3. **Actionable hints.** If an agent is in WEAK tier, show WHY and WHAT the player can do: "Low influence — assign to a building matching their profession to increase readiness." This creates the DECISION from the concept doc A1 gameplay loop.

4. **Building panel: show the formula transparently.** Per original A1 UX requirement: "Readiness: 72% = staffing (38%) x qualification (85%) x condition (75%) x influence (62%)". Each factor should be a labeled bar, not hidden behind a single number.

5. **Zone cards: show event risk.** Per original A2 UX requirement: "Event Risk: HIGH (stability 17% → 1.3x event chance). Fortify to reduce pressure." The multiplier should be visible and explain what it means in plain language.

6. **Influence tier indicator on agent cards.** In the agent list/lineup, show a small icon (shield/star/skull) for STRONG/AVERAGE/WEAK tier next to the agent portrait. Players should see at a glance who their high-influence agents are.

**Data prerequisite:** Migration 159 bootstraps `agent_professions` from `primary_profession` (default qualification_level = 3). Without this, professions contribution is always 0.

---

## Part VI: Death Spiral Modeling

### What Happens After 2 Weeks of Player Inactivity?

With autonomy ON and stability→events feedback:

**Week 1 (6 ticks/day × 7 = 42 ticks):**
- Agent needs decay 42× — all needs drop significantly (social: 60→18, purpose: 60→42)
- Agents with low needs select activities to fulfill them (automatic, healthy behavior)
- Social interactions generate opinions (some positive, some negative)
- Weather applies small moodlets each tick (+3 to -6 range)
- Zone stability stays roughly stable if no major events

**Week 2 (42 more ticks):**
- If stability dropped below 0.5, event probability increases by 1.0-1.3x
- More events → more pressure → stability drops further
- BUT: events also AGE (active → escalating → resolving → resolved → archived)
- The aging pipeline naturally RESOLVES events over ~21 ticks (4+6+3+8 × 4h = ~84h)
- **Equilibrium:** events spawn at ~1.3x rate but resolve at 1.0x rate → net accumulation of ~0.3 events per tick → zone slowly degrades but doesn't death-spiral

**The Key Insight:** The event aging pipeline IS the brake on the death spiral. Events don't stack infinitely — they resolve over time. Even without player intervention, the system reaches a low-but-stable equilibrium around 20-30% zone stability.

**If the player returns after 2 weeks:**
- Zones are unstable (20-30%) but not dead
- Agents are stressed but functional
- Buildings may have degraded (if neglect decay is implemented — Proposal 1)
- The player sees a simulation that NEEDS them — not one that died while they were away
- This is exactly the Tamagotchi effect: "My world missed me"

**Critical balance parameter:** Event aging must be fast enough to prevent death spirals but slow enough to create urgency. Current values (4+6+3+8 = 21 ticks ≈ 3.5 days for full event lifecycle) seem well-tuned.

**Catharsis Mechanic (from RimWorld research):** RimWorld prevents death spirals by giving colonists a +40 mood bonus for 2.5 days after ANY mental break. This is brilliant: the worse things get, the more catharsis events fire, creating natural recovery cycles. **We should implement an equivalent:** when zone stability drops below 20%, there's a 25% chance per tick of a "community resilience" positive event that temporarily boosts stability by +10%. This prevents zones from hitting 0% while still making low stability feel dangerous.

**Dwarf Fortress Anti-Pattern (what NOT to do):** DF's stress system has asymmetric rates: max recovery -43,564/year but max stress gain +20,160/year. This means once a dwarf enters the danger zone, it's nearly impossible to recover. Our system must have **symmetric or recovery-biased rates** — a zone that drops to 15% stability should be able to recover to 40%+ within a few ticks of player attention (fortification + agent assignment + event resolution).

---

## Part VII: Performance Budget

### Database Load Estimation

| Component | Operations/Tick | Ticks/Day | Daily Total |
|-----------|----------------|-----------|-------------|
| Needs decay (14 sims × 9 agents) | 126 | 6 | 756 |
| Mood processing | 126 | 6 | 756 |
| Opinion processing | 126 | 6 | 756 |
| Activity selection | 126 + 126 opinion lookups | 6 | 1,512 |
| Social interactions | ~60 pair checks | 6 | 360 |
| Weather fetch | 14 HTTP calls | 6 | 84 |
| Weather moodlets | 126 | 6 | 756 |
| MV refresh | 14 | 6 | 84 |
| **Total** | | | **~5,064 queries/day** |

Supabase free tier handles millions of queries/day. This is **0.05% of capacity**. Performance is not a concern.

**Benchmark reference:** Screeps (persistent MMO simulation) achieves **30,000 update requests per second** on 160 Xeon cores with MongoDB. Our workload of ~5,000 queries/DAY is roughly 0.003 queries/second. We are six orders of magnitude below a proven simulation game's load. Even scaling to 1,000 simulations × 20 agents would remain trivial for PostgreSQL.

**The bottleneck is not the database — it's the Open-Meteo API calls.** 14 simulations × 6 ticks = 84 calls/day. Open-Meteo allows 10,000/day. We use 0.84%. Also not a concern.

---

## Related Documents

- [10 Proposals zur Tamagotchisierung](tamagotchi-proposals.md) — engagement features building on this foundation
- [Sentry CI/CD Integration](../guides/sentry-cicd-integration.md) — observability for monitoring system health
- [ADR-007: Database Logic in Database](../adr/007-database-logic-in-database.md) — pattern for influence calculation
- [Ambient Weather System](../guides/sentry-cicd-integration.md) — already implemented, first system connection

## Research Sources

### Systemic Game Design
- GDC Vault: "RimWorld — Contrarian, Ridiculous, and Successful" (Tynan Sylvester, 2017) — [gdcvault.com](https://www.gdcvault.com/play/1024232/-RimWorld-Contrarian-Ridiculous-and)
- GDC Vault: "Systemic AI in Just Cause 3" (2017) — [gdcvault.com](https://gdcvault.com/play/1024605/Tree-s-Company-Systemic-AI)
- GDC Vault: "Authored vs Systemic: Finding a Balance in Uncharted 4" (2017) — [gdcvault.com](https://www.gdcvault.com/play/1024467/Authored-vs-Systemic-Finding-a)
- Theseus: "Systems-Based Game Design in Dwarf Fortress" (Niilo Lehner, 2024) — [theseus.fi](https://www.theseus.fi/bitstream/handle/10024/814557/Lehner_Niilo.pdf)
- ResearchGate: "Subverting Historical Cause & Effect: Caves of Qud" (Grinblat & Bucklew, FDG'17) — [researchgate.net](https://www.researchgate.net/publication/319364267)
- Concordia University: "Emergent Narratives in Games" (2025) — [concordia.ca](https://www.concordia.ca/cuevents/offices/provost/fourth-space/2025/02/07/emergent-narratives-in-games.html)
- Tynan Sylvester: "The Simulation Dream" (2013) — [tynansylvester.com](https://tynansylvester.com/2013/06/the-simulation-dream/)
- Unity: "Systems That Create Ecosystems — Emergent Game Design" — [unity.com](https://unity.com/blog/games/systems-that-create-ecosystems-emergent-game-design)
- ArXiv: "Player-Driven Emergence in LLM-Driven Game Narrative" (Microsoft Research, 2024) — [arxiv.org/abs/2404.17027](https://arxiv.org/abs/2404.17027)

### Metrics & UX
- Victoria 3 Nested Tooltip System — [pcgamesn.com](https://www.pcgamesn.com/victoria-3/nested-tooltip-system)
- Victoria 3 Dev Diary #74: UX Improvements — [paradoxinteractive.com](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements)
- Philip Davis: "Tooltips in Tooltips" Design Analysis — [philip.design](https://philip.design/blog/tooltips-in-tooltips/)
- Gamedeveloper: "Informed Decisions and Their Role on Game Design" — [gamedeveloper.com](https://www.gamedeveloper.com/design/informed-decisions-and-their-role-on-game-design)
- Gamedeveloper: "Strategy Game UI Dos and Don'ts" — [gamedeveloper.com](https://www.gamedeveloper.com/design/ui-strategy-game-design-dos-and-don-ts)

### Influence & Stability Reference Games
- CK3 Wiki: Resources (Prestige/Fame Tiers) — [ck3.paradoxwikis.com](https://ck3.paradoxwikis.com/Resources)
- Gamer Empire: CK3 How to Gain Prestige — [gamerempire.net](https://gamerempire.net/crusader-kings-3-how-to-gain-prestige/)
- Stellaris: How to Get Influence — [thegamer.com](https://www.thegamer.com/stellaris-how-to-get-gain-more-political-influence-power-projection/)
- Civilization 7 Happiness Guide — [thegamer.com](https://www.thegamer.com/civilization-7-civ-happiness-guide-explained/)
- Frostpunk Wiki: Hope — [frostpunk.fandom.com](https://frostpunk.fandom.com/wiki/Hope)
- Frostpunk 2 Trust System — [pcgamesn.com](https://www.pcgamesn.com/frostpunk-2/trust)
- RimWorld Wiki: Mood & Mental Breaks — [rimworldwiki.com](https://rimworldwiki.com/wiki/Mood)
- Dwarf Fortress Wiki: Stress — [dwarffortresswiki.org](https://dwarffortresswiki.org/Stress)

### MUD & Terminal Interfaces
- Torn City: 21-Year Public Safety Briefing ($10-15M revenue) — [gamespress.com](https://www.gamespress.com/TORN-CITY-21-YEAR-PUBLIC-SAFETY-BRIEFING)
- Iron Realms Entertainment ($5.1M revenue) — [Wikipedia](https://en.wikipedia.org/wiki/Iron_Realms_Entertainment)
- Iron Realms Nexus 3.0 Client — [ironrealms.com](https://www.ironrealms.com/nexus/)
- Written Realms (hybrid text+click) — [writtenrealms.com](https://writtenrealms.com/)
- Procedural Realms — [proceduralrealms.com](https://proceduralrealms.com/)
- MUD Coders Guild — [mudcoders.com](https://mudcoders.com/)
- jQuery Terminal — [terminal.jcubic.pl](https://terminal.jcubic.pl)
- xterm.js Screen Reader Mode — [github.com/xtermjs](https://github.com/xtermjs/xterm.js/wiki/Design-Document:-Screen-Reader-Mode)
- Richard Bartle: Command Parsers — [mud.co.uk](https://mud.co.uk/richard/commpars.htm)
- LlamaTale (LLM-powered MUD) — [github.com/neph1/LlamaTale](https://github.com/neph1/LlamaTale)
- Superhuman: "How to Build a Remarkable Command Palette" — [superhuman.com](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- Gaby Goldberg: "The Command Line Comeback" — [medium.com](https://gabygoldberg.medium.com/the-command-line-comeback-9857b49c7423)
- Building MUDs for Screen Readers — [writing-games.org](https://writing-games.org/building-a-better-mud/)
- Vice: How Blind Players Made MUDs Accessible — [vice.com](https://www.vice.com/en/article/how-blind-players-made-a-text-only-rpg-more-accessible/)

### Performance
- Screeps Server Architecture (30K updates/sec) — [docs.screeps.com](https://docs.screeps.com/architecture.html)
- Epsio: PostgreSQL Materialized View Refresh Guide — [epsio.io](https://www.epsio.io/blog/postgres-refresh-materialized-view-a-comprehensive-guide)
- Supabase: Processing Large Jobs — [supabase.com](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
- Martin Fowler: Feature Toggles — [martinfowler.com](https://martinfowler.com/articles/feature-toggles.html)
