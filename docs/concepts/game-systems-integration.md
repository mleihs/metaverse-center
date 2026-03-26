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

## Part IV: MUD Interface Assessment

### 4.1 The Proposition

Add a text-based MUD (Multi-User Dungeon) interface as an alternative way to interact with the simulation. Instead of clicking through dashboard panels, the player types commands in a Bureau terminal:

```
> look
REGIERUNGSVIERTEL — Government Quarter
Stability: 17% [CRITICAL]
Weather: Steady rain at 10°C. The Bureau's watchtowers survey
the district through sheets of water.
Agents present: General Aldric Wolf, Inspektor Mueller, Lena Kray
Active events: 2 (elemental_surge escalation, cascade_spawn)

> examine General Wolf
GENERAL ALDRIC WOLF — Militärakademie Wolf
Influence: 72%  Mood: +8 (Content)  Stress: 120 (Calm)
Needs: Social ██░░░ 34  Purpose █████ 89  Safety █░░░░ 18
Active moodlet: zone_weather (rain, -3 distress)

> talk Wolf
You approach General Wolf in the Militärakademie.
"The rain doesn't bother me. What bothers me is the tremor
reports from the northern industrial zone. Something is wrong
with the substrate."

> fortify Regierungsviertel
[ZONE ACTION] Deploying fortification resources to Regierungsviertel.
Effect: -15% event pressure for 48 hours.
Cost: 1 zone action slot (2 remaining).

> weather
CURRENT CONDITIONS — Prague (50.08°N, 14.44°E)
WMO Code 61: Rain | Temperature: 10.1°C | Wind: 12.3 km/h
Visibility: 4,200m | Moon: Waxing Crescent (23%)
Mood effect: -3 distress (all agents in all zones)
```

### 4.2 Game Design Assessment — ✅✅ POTENTIALLY VERY HIGH VALUE

**The Core Insight:** Dashboards show DATA. Terminals accept COMMANDS. The difference is passive observation vs active participation.

The current GUI treats the player as an ANALYST looking at reports. A MUD treats the player as an OPERATIVE in the field. This is the exact Bureau aesthetic the platform is built around.

**Why this works for THIS platform specifically:**
1. The espionage theme demands it — intelligence operatives work through terminals
2. Agent chat already exists as text — MUD commands would wrap it naturally
3. Weather narratives are already prose — they'd read as field reports in a terminal
4. The heartbeat entries are already bilingual text — perfect MUD output
5. Zone actions (fortify, quarantine) are already commands — just need a text interface

**What a MUD adds that the GUI lacks:**
- **Exploration as gameplay.** Moving between zones (`go Altstadt`, `go Industriegebiet`) makes the simulation feel spatial. The GUI flattens everything into tabs.
- **Discovery through interaction.** `examine` commands reveal details that the GUI buries in panels. The act of typing a command is a micro-decision.
- **Narrative immersion.** Reading prose in a terminal is qualitatively different from reading it in a card. The CRT aesthetic + monospace font + classified-document tone creates atmosphere.
- **Conversation as interrogation.** `talk Elena Voss` in a terminal feels like an intelligence briefing, not a chat widget.

**Game Design Reference:**
- **Procedural Realms** (proceduralrealms.com): Modern web MUD combining JRPG combat with procedural generation. Plays directly in browser. Widely regarded as top-tier modern MUD.
- **AI Dungeon** (aidungeon.com): Showed that AI + text interface creates compelling emergent narrative. Our agent chat system + MUD commands would achieve similar effect.
- **Superhuman's Command Palette**: Demonstrated that power users PREFER keyboard-driven interfaces. The broader "command line comeback" (Raycast, Linear, VS Code) creates cultural readiness for text-first game interfaces.
- **Written Realms** (writtenrealms.com): Playable "100% through typed commands OR by clicking, tapping, and using hotkeys." Supports viewports as small as 375px. Has been praised for having "the best text-based UI and presentation." This hybrid model is exactly what we need.

**Commercial Viability — The Numbers:**
- **Torn City**: **$10-15M annual revenue**, 80,000+ daily unique players, running since 2004 (21 years). Creator became a millionaire at age 21. A "graphic-less game" generating substantial profit. 12-person team, custom engine.
- **Iron Realms Entertainment**: **$5.1M annual revenue** (2025). Pioneered the freemium model in 1997. IGDA noted "substantially higher average revenue per customer" than subscription MMOs.
- These are not niche curiosities — they are profitable businesses built on text interfaces.

**Accessibility — A Strategic Advantage:**
- At Materia Magica, blind players constitute **50% of online users on some nights**
- MUDRammer (iOS MUD client) discovered that **14% of its players were blind** — only after implementing VoiceOver support
- A MUD interface would IMPROVE our WCAG AA compliance by providing an accessible alternative to graphical components (EchartsCharts, maps) that are harder to make screen-reader-friendly
- This is not just ethics — it's a market differentiator

**The Multiplayer Dimension:**
During epochs, multiple players' operatives occupy the same simulation. A MUD would let them:
- See each other's agents in zones (`look` shows "Foreign operative detected")
- Interact indirectly (deploy spy → opponent sees "Intelligence activity detected in zone")
- This creates emergent PvP tension through information asymmetry

### 4.3 Architecture Assessment — ✅ FEASIBLE, LOW DISRUPTION

**Senior Web Architect perspective:**

The MUD would be a **thin presentation layer** over existing APIs:

```
MUD Command        →  API Call                          →  Existing Service
─────────────────────────────────────────────────────────────────────────
look               →  GET /simulations/{id}/zones/{zid} →  LocationsView data
examine {agent}    →  GET /simulations/{id}/agents/{id} →  AgentDetailsPanel data
talk {agent}       →  POST /simulations/{id}/chat       →  ChatAIService
weather            →  GET /heartbeat/entries?type=weather → HeartbeatApiService
fortify {zone}     →  POST /zone-actions                →  ZoneActionService
status             →  GET /simulations/{id}/health      →  SimulationHealthView data
```

**No new backend endpoints needed.** The MUD command parser would:
1. Parse typed input into verb + arguments
2. Map to existing API calls
3. Format the API response as prose text
4. Display in a terminal component

**Implementation options:**

- **jQuery Terminal** (terminal.jcubic.pl): JavaScript library purpose-built for browser command-line interpreters. Supports custom command objects (each method becomes a command), **nested interpreters** (enter a zone → command context changes), tab completion, command history, Bash shortcuts, ANSI escape codes, typing effects. Includes built-in games. Can auto-call JSON-RPC services when users type commands. **Best fit for our use case** — the nested interpreter pattern maps perfectly to simulation navigation.

- **xterm.js** (xtermjs.org): Full terminal emulator (used in VS Code). Has dedicated **screen reader mode** with ARIA live regions, virtual list navigation, and intelligent input echo suppression. Overkill for our needs but best accessibility story.

- **Custom Lit component**: Simple `<pre>` with typewriter effect + input field. Lightest, matches existing patterns, but requires building command routing from scratch.

**Recommendation:** `<velg-bureau-terminal>` LitElement wrapping **jQuery Terminal** for command routing + tab completion, with **CSS CRT effects** (scanlines via `linear-gradient` pseudo-element, subtle chromatic aberration via `text-shadow` with RGB channel separation, amber-on-dark color scheme from existing design tokens). The CRT aesthetic should be SUBTLE — atmospheric enhancement, not retro gimmick.

**Command Parser Architecture** (Richard Bartle's six-stage model):
1. Tokenization → 2. Dictionary lookup → 3. Grammar parsing → 4. Binding (match objects to nouns) → 5. Dispatch → 6. Execution. For our bounded command space (~15 verbs, ~50 nouns), a simple verb-noun parser with synonym resolution is sufficient. Full Bartle parsing is overkill.

**Real-time Updates:** Use existing Supabase Realtime subscriptions to push heartbeat entries, weather changes, and agent activities to the terminal as they happen. The MUD output scrolls with new events — the world narrates itself while the player watches.

### 4.4 UX Assessment — ⚠️ REQUIRES CAREFUL ONBOARDING

**Senior UX Specialist perspective:**

**Strengths:**
- Text interfaces are inherently accessible (screen readers work perfectly with text)
- No learning curve for the concepts (it's the same data, different format)
- Power users love command interfaces (Superhuman, Slack /commands, VS Code palette)

**Risks:**
- Discoverability: new users don't know what commands exist
- Mobile: typing commands on phones is painful
- Fragmentation: two interfaces means two things to maintain

**Mitigations:**
- **Command autocomplete**: Type `ex` → suggests `examine {agent name}` with tab completion
- **Help system**: `help` command lists all available commands with descriptions
- **Quick-action buttons**: Below the terminal, show 4-6 context-sensitive buttons ("Look", "Status", "Weather") that type the command for you — bridging MUD and GUI
- **Mobile**: Show buttons prominently, input field secondary
- **Progressive disclosure**: Start with 5 commands (look, examine, talk, weather, status). Advanced commands (fortify, ceremony, deploy) unlock as player learns

### 4.5 Where Should the MUD Live?

**Option 1: Template Simulations Only (Sandbox)**
- Bureau observation terminal for exploring your world
- Commands: look, examine, talk, weather, status, ceremony
- Atmospheric, contemplative, no competitive pressure
- ✅ Easy to implement, low risk

**Option 2: Epoch Instances Only (Competitive)**
- Bureau operations terminal for commanding operatives
- Commands: deploy, intercept, scout, ally, betray
- Fast-paced, high-stakes PvP through text
- ⚠️ Higher complexity, requires epoch-specific command set

**Option 3: Unified Terminal (Recommended)**
- One terminal component that adapts to context:
  - **Template mode**: "OBSERVATION MODE" — explore, observe, interact with agents
  - **Epoch mode**: "OPERATIONAL MODE" — same terminal, expanded command set for competitive actions
- The transition is seamless — you're always at the same Bureau workstation
- Template observations inform epoch decisions (you SAW the instability via MUD, now you EXPLOIT it in the epoch)

**Game Design Verdict:** Option 3 is the strongest. The MUD becomes the **connective tissue** between sandbox and competition. It's the ONE interface where all systems converge: weather reports, agent status, zone stability, operative deployment. Instead of navigating between 10 tabs, the player stays in one terminal and the WORLD comes to them.

**Implementation priority:** Start with Option 1 (template only, 5 commands). If it proves engaging, extend to Option 3 with epoch commands.

---

## Part V: Implementation Roadmap

### Priority Order (by gameplay value)

| Priority | Item | Gameplay Value | Effort | Dependencies | Status |
|----------|------|---------------|--------|-------------|--------|
| 1 | **A5: Autonomy ON** | ✅✅ Prerequisite | Tiny (1 line change + agent bootstrapping) | Agent zone assignment for all sims | **DONE** (migration 157, 2026-03-25). **Post-audit (2026-03-26):** Fixed division-by-zero in zone/building assignment for sims with 0 zones |
| 2 | **A1: Influence → Readiness** | ✅✅ High | Medium (PG function + MV update) | A5 must be active | **DONE** (migration 158 + Pydantic/TS types, 2026-03-25). UX display → B1-B3. **Post-audit (2026-03-26):** Fixed cross-simulation data leak (simulation_id filter on agent_professions). **Data pipeline fix (2026-03-26):** Migration 160 — `fn_bootstrap_building_relations` populates building_agent_relations from agents.current_building_id (blocker: MV showed 0% readiness because relation table was empty) |
| 3 | **A2: Stability → Events** | ✅✅ High | Small (multiplier in event service) | A5 must be active | **DONE** (autonomous_event_service.py + catharsis mechanic, 2026-03-25). UX display → B1-B3. **Post-audit (2026-03-26):** 10 defensive access fixes, try-except on _get_agent_data, nested error handler in heartbeat tick |
| 4 | **B1-B3: Info Bubbles + UX** | ✅ High (communication) | Medium (6 components, ~80 lines) | A1+A2 must be real first | **DONE** (2026-03-26). B3: Zone event risk display (RimWorld threshold markers + CRITICAL/HIGH/MEDIUM/LOW tier badges + multiplier + actionable hints + critical zone wash). B2: Building readiness factor pipeline (4-gauge Victoria 3 pattern, bottleneck detection with red accent, influence tier badge WEAK/AVG/STRONG). B1: Agent influence panel redesign (natural language breakdown: "3 allies avg 6/10" instead of "60%", profession names + levels, actionable hint for WEAK tier). Also fixed: diamond badge overflow on VelgGameCard (4+ digit numbers now show "1K" format). |
| 5 | **MUD (Template, 5 commands)** | ✅✅ Potentially highest | Medium-Large (new component) | Existing APIs sufficient | Pending |
| 6 | **A3: Resonance → Mood** | ⚠️ Medium | Medium | A5 must be active | Pending |
| 7 | **MUD (Epoch extension)** | ✅ High | Medium | MUD template must work first | Pending |
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
