---
title: "Game Systems Integration — Connecting the Living World"
version: "2.0"
date: "2026-03-25"
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
| A1 | Agent Influence | → | Building Readiness | ❌ Influence is frontend-only, used nowhere in backend | ✅ HIGH — creates agent placement decisions |
| A2 | Zone Stability | → | Event Probability | ❌ Stability is displayed, not mechanically consequential | ✅ HIGH — creates urgency and resource allocation |
| A3 | Resonance | → | Agent Mood | ❌ Resonance is decorative, doesn't affect agents | ⚠️ MEDIUM — abstract, hard to communicate |
| A4 | Events | → | Agent Needs | ❌ Events age passively, don't affect agents | ❌ LOW — no player decision, purely automatic |
| A5 | Autonomy | → | Everything | ❌ OFF by default, never activated for most simulations | ✅ PREREQUISITE — nothing works without this |

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

**The Consequence:** Building readiness directly feeds zone stability. A well-staffed government building with qualified, well-connected agents makes the whole zone more stable. A poorly staffed one drags it down.

**The New Situation:** "My Industriegebiet Nord is failing. Do I move General Wolf from the stable Regierungsviertel to save it? But that weakens the Regierungsviertel..."

**Game Design Reference:** This mirrors Crusader Kings 3's council system, where placing the right advisor on the right position directly affects realm stability. CK3's prestige/piety system makes every assignment feel consequential because the numbers visibly change (GDC Vault: CK3 character system design). The key insight from CK3: **influence must be VISIBLE in the readiness number, not hidden**.

**UX Requirement:** The building detail panel must show: "Readiness: 72% (staffing 3/8 × qualification 85% × condition 0.75 × **avg influence 62%**)". The influence factor must be explicitly named, not buried in a formula.

**Architect Note:** Influence currently exists only in frontend TypeScript. Moving it to PostgreSQL requires either:
- A PostgreSQL function `fn_compute_agent_influence(agent_id)` that JOINs relationships, professions, and ambassador status
- OR a denormalized `influence_score` column updated by trigger
The function approach is cleaner (ADR-007: database logic in database). Performance: one extra JOIN per agent per MV refresh. With 270 agents, negligible.

---

#### A2: Zone Stability → Event Probability — ✅ HIGH VALUE

**The Decision:** "How do I handle this unstable zone?" The player must decide: fortify (zone action), assign better agents, or triage and let it fail.

**The Consequence:** Unstable zones attract more negative events. Stable zones attract fewer (and occasionally positive) events. This creates a **positive feedback loop** that must be carefully balanced to avoid death spirals.

**The New Situation:** "Altstadt is at 17% stability. Two new events just spawned there. If I fortify now, I spend resources. If I don't, it could cascade into the other zones."

**Game Design Reference:** This is Frostpunk's Hope/Discontent system. Frostpunk's key design decision: discontent increases event frequency, but the player ALWAYS has a tool to respond (laws, buildings, expeditions). RimWorld uses a similar pattern where colony wealth attracts raids, but the player can build defenses. The critical lesson: **the feedback loop must have a BRAKE** — a player action that slows or reverses the spiral.

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

**Game Design Reference:** Dwarf Fortress's tantrum spiral is the canonical example of system-to-system feedback without player agency becoming a PROBLEM. A dwarf sees a corpse → gets sad → tantrums → attacks another dwarf → that dwarf gets sad → tantrum spiral → everyone dies. This is a known design flaw, not a feature. (Theseus thesis: "Systems-Based Game Design in Dwarf Fortress", 2024)

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

---

## Part III: UX Information Architecture

### 3.1 The "Victoria 3 Tooltip" Pattern

Victoria 3 (Paradox, 2022) solved the "meaningless numbers" problem with what the community calls "explanation chains": hover over ANY number → tooltip shows the FULL calculation tree with every contributing factor, each one ALSO hoverable. This creates infinite drill-down depth while keeping the surface clean.

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
- **Procedural Realms** (proceduralrealms.com): Modern web MUD with procedural content. Proves the format is commercially viable in 2024+.
- **AI Dungeon** (aidungeon.com): Showed that AI + text interface creates compelling emergent narrative. Our agent chat system + MUD commands would achieve similar effect.
- **Superhuman's Command Palette**: Demonstrated that power users PREFER keyboard-driven interfaces over point-and-click. The MUD is essentially a domain-specific command palette.

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
- **xterm.js**: Full terminal emulator, supports ANSI colors, cursor positioning. Overkill but beautiful.
- **Custom Lit component**: Simple `<pre>` with typewriter effect + input field. Lighter, matches existing patterns.
- **Hybrid**: Input field at bottom, scrolling output above. Like Discord but monospace.

**Recommendation:** Custom Lit component (`<velg-bureau-terminal>`). No need for full terminal emulation. The aesthetic comes from CSS (CRT glow, scanlines, monospace font), not from terminal protocols.

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

| Priority | Item | Gameplay Value | Effort | Dependencies |
|----------|------|---------------|--------|-------------|
| 1 | **A5: Autonomy ON** | ✅✅ Prerequisite | Tiny (1 line change + agent bootstrapping) | Agent zone assignment for all sims |
| 2 | **A1: Influence → Readiness** | ✅✅ High | Medium (PG function + MV update) | A5 must be active |
| 3 | **A2: Stability → Events** | ✅✅ High | Small (multiplier in event service) | A5 must be active |
| 4 | **B1-B3: Info Bubbles + UX** | ✅ High (communication) | Medium (6 components, ~80 lines) | A1+A2 must be real first |
| 5 | **MUD (Template, 5 commands)** | ✅✅ Potentially highest | Medium-Large (new component) | Existing APIs sufficient |
| 6 | **A3: Resonance → Mood** | ⚠️ Medium | Medium | A5 must be active |
| 7 | **MUD (Epoch extension)** | ✅ High | Medium | MUD template must work first |
| — | ~~A4: Events → Needs~~ | ❌ Skip | — | No player agency |

### Skip Recommendation: A4 (Events → Needs)

Events should affect agents through MOODLETS (already implemented via weather and social interactions), not through NEEDS (invisible, automatic, no player decision). The existing moodlet system is the correct abstraction. Adding needs feedback creates simulation depth without gameplay depth — the player observes but cannot act.

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

**The bottleneck is not the database — it's the Open-Meteo API calls.** 14 simulations × 6 ticks = 84 calls/day. Open-Meteo allows 10,000/day. We use 0.84%. Also not a concern.

---

## Related Documents

- [10 Proposals zur Tamagotchisierung](tamagotchi-proposals.md) — engagement features building on this foundation
- [Sentry CI/CD Integration](../guides/sentry-cicd-integration.md) — observability for monitoring system health
- [ADR-007: Database Logic in Database](../adr/007-database-logic-in-database.md) — pattern for influence calculation
- [Ambient Weather System](../guides/sentry-cicd-integration.md) — already implemented, first system connection

## Research Sources

- GDC Vault: "RimWorld — Contrarian, Ridiculous, and Successful" (Tynan Sylvester, 2017)
- GDC Vault: "Systemic AI in Just Cause 3" (2017)
- GDC Vault: "Authored vs Systemic: Finding a Balance in Uncharted 4" (2017)
- Theseus: "Systems-Based Game Design in Dwarf Fortress" (Niilo Lehner, 2024)
- ResearchGate: "Subverting Historical Cause & Effect: Caves of Qud" (Grinblat & Bucklew, FDG'17)
- Concordia University: "Emergent Narratives in Games" (2025)
- MUD Coders Guild: mudcoders.com — modern MUD development community
- Procedural Realms: proceduralrealms.com — modern web MUD reference
- Superhuman: "How to Build a Remarkable Command Palette" (2023)
