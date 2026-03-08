---
title: "Game Design Document"
id: game-design-document
version: "1.3"
date: 2026-03-07
lang: en
type: explanation
status: active
tags: [game-design, analysis, balance, vision]
---

# metaverse.center — Game Design Document

---

## Table of Contents

1. [Executive Summary](#i-executive-summary)
2. [What This Game Is](#ii-what-this-game-is)
3. [Core Design Philosophy](#iii-core-design-philosophy)
4. [Platform Architecture Overview](#iv-platform-architecture-overview)
5. [The Eight Systems — Deep Dive](#v-the-eight-systems--deep-dive)
6. [Agent Aptitudes & Draft Phase](#vi-agent-aptitudes--draft-phase)
7. [Cross-System Interaction Design](#vii-cross-system-interaction-design)
8. [Player Archetypes & Session Flow](#viii-player-archetypes--session-flow)
9. [Economy Design & Balancing](#ix-economy-design--balancing)
10. [Competitive Tension Design](#x-competitive-tension-design)
11. [Design Pattern Analysis](#xi-design-pattern-analysis)
12. [Comparative Analysis — Similar Games](#xii-comparative-analysis--similar-games)
13. [What Makes This Interesting](#xiii-what-makes-this-interesting)
14. [What Could Go Wrong — Honest Critique](#xiv-what-could-go-wrong--honest-critique)
15. [Technical Implementation Reality](#xv-technical-implementation-reality)
16. [Extensibility Roadmap](#xvi-extensibility-roadmap)
17. [Open Questions for Designers](#xvii-open-questions-for-designers)

---

## I. Executive Summary

metaverse.center is a **multiplayer worldbuilding platform** where each player owns and curates a simulation — a living world populated by AI-driven agents, buildings, events, and social dynamics. The platform operates on two layers:

- **PvE Layer (always active):** A simulation economy where ~160 editable parameters create feedback loops. Agent professions affect building readiness, building condition shapes zone stability, stability influences event generation, and events ripple across simulations through "Bleed" — a cross-world event echo mechanic channeled through embassy connections.

- **PvP Layer (during Epochs):** Time-limited competitive seasons where simulation owners deploy covert operatives through embassies to sabotage, spy on, and propagandize against rival simulations, while defending their own worlds and competing for a composite score across five dimensions.

The game sits at an unusual intersection: it's part **city builder** (staffing, infrastructure), part **diplomatic strategy** (embassies, alliances, bleed), part **espionage game** (operatives, counter-intelligence), and part **collaborative fiction engine** (AI-generated narratives, worldbuilding). The competitive layer is built entirely on top of the creative tools — there are no "game-only" entities. Every operative is a real agent, every sabotaged building is a real building, every propaganda event is a real event.

**Current state:** 5 flagship simulations (Velgarien, The Gaslit Reach, Station Null, Speranza, Cite des Dames), each with distinct themes and ~25 entities. New simulations can be created via the **Simulation Forge** — a 4-phase AI-assisted worldbuilding pipeline (Astrolabe → Drafting Table → Darkroom → Ignition) that generates philosophical anchors, geography, agents, buildings, themes, lore, and images from a single seed prompt. Full competitive layer implemented (backend services, frontend UI, database schema) with agent aptitude system and draft phase. Production deployed. Bot players available for solo/low-player epochs.

---

## II. What This Game Is

### The Elevator Pitch

"You are a demiurge — the unseen hand shaping a living world. Your agents have professions, your buildings have conditions, your streets have stories. Every edit is an act of creation with mechanical consequences. And when the Epoch begins, your creation is tested against others."

### Genre Classification

This game doesn't fit cleanly into a single genre. The closest classification is:

**Asynchronous Multiplayer Strategy + Collaborative Worldbuilding + AI-Augmented Narrative**

Individual genre elements:
- **4X Lite** — eXplore (build your world), eXpand (embassies), eXploit (bleed), eXterminate (operatives) — but without the eXplore component being procedural; it's hand-authored
- **Grand Strategy** — long time horizons (epochs last days to weeks), macro-level decisions, diplomatic web
- **Social Deduction** — operatives create hidden information; betrayal within alliances
- **City Builder** — staffing economy, building condition, zone stability
- **Play-by-Mail** — asynchronous cycles (every 2-24 hours), no real-time interaction required
- **Emergent Narrative** — AI transforms events as they bleed between worlds, creating unique cross-simulation stories

### Target Audience

- **Primary:** Creative worldbuilders who enjoy the simulation-as-canvas aspect and want mechanical depth beneath their narratives
- **Secondary:** Strategy gamers who enjoy asymmetric competition and long-horizon planning
- **Tertiary:** AI/narrative enthusiasts interested in watching emergent stories unfold across connected worlds

### Session Structure

Unlike traditional games with discrete play sessions, metaverse.center operates on a **continuous maintenance + periodic spike** pattern:

- **Maintenance sessions** (5-15 min, daily): Check notifications, review zone stability, adjust agent assignments, approve incoming echoes
- **Strategic sessions** (30-60 min, during Epochs): Deploy operatives, analyze rival simulations, coordinate with allies, plan offensive/defensive moves
- **Creative sessions** (variable): Add new agents, write event descriptions, craft building backstories, design new zones
- **Cycle resolution** (automated): Every 2-24 hours during an Epoch, missions resolve, scores update, RP allocates

This is closer to **Diplomacy** or **Neptune's Pride** than it is to Civilization or StarCraft. The game rewards thought and planning over reflexes and APM.

---

## III. Core Design Philosophy

### "Every number tells a story, every story changes a number."

This is the foundational principle. The platform started as a pure narrative tool — agents, buildings, and events with text descriptions fed into AI generation pipelines. The game systems layer transforms these decorative fields into **mechanically meaningful inputs** without removing their creative function.

A building's `condition` field ("good", "moderate", "poor", "ruined") was originally a flavor tag for AI image generation. Now it's a direct multiplier on Building Readiness (1.0 / 0.75 / 0.5 / 0.2), which feeds zone stability, which feeds event generation probability, which feeds scoring. But it still drives AI image generation too. The creative and mechanical functions coexist.

### Four Design Laws

1. **No Orphan Attributes** — Every editable field influences at least one computed metric. If a field exists that doesn't affect anything, it's either a design debt or should be removed.

2. **Bidirectional Influence** — Entities affect each other in both directions. Agents shape buildings (staffing), buildings shape agents (working conditions affect morale). This creates the feedback loops that make the system feel alive.

3. **Cross-Simulation Bleed is Earned** — You don't get multiverse influence for free. It scales with embassy investment, ambassador quality, and event magnitude. This prevents passive players from accidentally dominating the narrative.

4. **Tension Through Asymmetry** — Every offensive capability has a defensive counter. Every resource spent abroad is a resource not spent at home. This is the core design tension of the competitive layer.

### Why These Laws Matter

Law 4 is the most important for competitive design. Without it, the game degenerates into a "stack offense" meta where the optimal play is always aggression. The asymmetry creates **meaningful decisions**: Do I deploy my best agent as an operative (gaining military score but losing building readiness at home)? Do I keep my embassy open (enabling both diplomacy and the risk of enemy operatives)? Do I betray my ally (massive military potential but catastrophic diplomatic risk)?

Every advantage has a cost. Every defensive choice is an offensive opportunity missed. This is what separates interesting strategy from solved optimization.

---

## IV. Platform Architecture Overview

### Entity Hierarchy

```
Platform Level
├── Simulations (5 active: Velgarien, The Gaslit Reach, Station Null, Speranza, Cité des Dames)
│   ├── Agents (~6 per sim, unlimited)
│   │   ├── Professions (qualification_level 1-10, specialization)
│   │   ├── Aptitudes (6 scores: spy/guardian/saboteur/propagandist/infiltrator/assassin, 3-9 each, budget 36)
│   │   └── Relationships (typed, weighted, directional graph)
│   ├── Buildings (~7 per sim, unlimited)
│   │   ├── Assigned Agents (staffing)
│   │   ├── Building Condition (good/moderate/poor/ruined)
│   │   └── Special Type: Embassy (cross-sim links)
│   ├── Events (unlimited)
│   │   ├── Impact Level (1-10, determines ripple radius)
│   │   ├── Tags (freeform, trigger vector resonance)
│   │   └── Echoes (cross-sim bleed instances)
│   ├── Locations
│   │   ├── Cities → Zones → Streets
│   │   └── Zone Security Level (fortress...lawless)
│   ├── Embassies (cross-sim, ~3 per sim)
│   │   ├── Bleed Vector (7 types)
│   │   ├── Ambassador Agents (2 per embassy)
│   │   └── The Question (existential framing)
│   └── Settings
│       ├── World (bleed_enabled, bleed_min_impact, etc.)
│       ├── AI (model, temperature, max_tokens)
│       └── Design (theme tokens, colors, typography)
│
├── Simulation Connections (complete graph between all sims)
│   ├── Strength (0-1 float)
│   └── Bleed Vectors (array of active channels)
│
└── Epochs (competitive seasons)
    ├── Participants (simulations enrolled)
    ├── Teams (alliances)
    ├── Operative Missions (deployed agents)
    ├── Scores (per-cycle snapshots)
    └── Battle Log (narrative event feed)
```

### Scale Context

The platform currently runs 4 simulations with ~25 entities each (agents + buildings). This is deliberately small — the game is designed for **depth over breadth**. A single simulation with 6 agents, 7 buildings, and 4 zones can generate enormous strategic complexity when every attribute feeds into mechanical calculations.

The game is **not** designed for hundreds of players or thousands of entities per simulation. It's designed for 4-12 simulation owners playing a slow, thoughtful, narratively rich competitive game over days or weeks.

---

## V. The Eight Systems — Deep Dive

Systems 1-5 form the **simulation economy** (PvE, always active). Systems 6-8 are the **competitive layer** (PvP, active during Epochs). The competitive layer is built entirely on top of the economy — it doesn't introduce new entity types, it weaponizes existing ones.

### System 1: Staffing Economy

**Design intent:** Transform the relationship between agents and buildings from decorative ("Agent X works at Building Y") to mechanical ("Building Y needs 3 agents with medical professions to function, has 1, and is therefore operating at 32% readiness").

**Inputs:**
- `population_capacity` (building) — how many agents the building can support
- `professions` (agent) — qualification_level 1-10, specialization
- `profession_requirements` (building) — what professions the building needs
- `building_condition` (building) — physical state: good/moderate/poor/ruined

**Core formula:**
```
Building Readiness = Staffing Ratio × Qualification Match × Condition Factor

Where:
  Staffing Ratio = assigned_agents / population_capacity (0% to 100%+)
  Qualification Match = avg(matching_profession_levels) / required_level
    - Unqualified agents count at 0.3× weight
  Condition Factor = { good: 1.0, moderate: 0.75, poor: 0.5, ruined: 0.2 }
```

**Why this formula works:**

The multiplicative structure means that ALL three factors matter. A fully staffed building with perfect qualifications but "ruined" condition still operates at only 20%. A pristine building with no staff operates at 0%. There's no single "fix" — you need staffing AND qualification AND maintenance.

The 0.3× weight for unqualified agents is a deliberately generous floor. It means warm bodies help, but specialists help much more. A hospital with 10 random citizens operates at ~30% of what it would with 10 doctors. This creates a soft skill requirement without making unqualified agents useless.

**Downstream cascade:**
- Building Readiness → Zone Stability (System 2)
- Low readiness on critical buildings (hospital, power plant) → direct zone security reduction
- Readiness feeds AI generation: low-readiness buildings get grimmer descriptions
- During Epochs: deploying an agent as operative **removes them from their building post**, directly reducing readiness

This last point is the key competitive design. The Staffing Economy isn't just a PvE system — it's the **cost function for military action**. Every spy you deploy is an employee your simulation loses.

### System 2: District Health

**Design intent:** Aggregate building-level metrics into zone-level health scores that create emergent geography — some districts thrive, others fail, and the difference has consequences.

**Core formula:**
```
Zone Stability = (Infrastructure Score × 0.5) + (Security Factor × 0.3) - (Event Pressure × 0.2)

Where:
  Infrastructure Score = weighted_avg(Building Readiness) by criticality:
    Critical (hospital, power, barracks): 2.0×
    Important (market, school, government): 1.5×
    Standard (residential, workshop, tavern): 1.0×
    Luxury (theater, garden, shrine): 0.5×

  Security Factor = taxonomy mapping:
    fortress: 1.0, high: 0.85, guarded: 0.7, moderate: 0.55, low: 0.4, lawless: 0.2

  Event Pressure = count(impact_level ≥ 6 events in last 30 days) / 10
    Capped at 1.0
```

**Why the weighting matters:**

The criticality weights create a hierarchy of importance. A failing hospital has 4× the stability impact of a failing theater. This means strategic sabotage during Epochs targets high-criticality buildings for maximum zone destabilization.

Event Pressure is deliberately lagging (30-day window). This means a single bad event doesn't immediately crash a zone, but sustained pressure (from, say, repeated propaganda attacks) accumulates into instability. Recovery requires TIME, not just a single repair action.

**Stability thresholds:**
- < 0.3: **Critical** — cascading crises likely, bleed threshold reduced
- 0.3-0.5: **Unstable** — one shock away from failure
- 0.5-0.7: **Functional** — holding together
- 0.7-0.9: **Stable** — thriving
- > 0.9: **Exemplary** — model district

**Simulation Health** = avg(zone_stability) across all zones. This is the headline metric for the simulation, displayed on dashboards and the Cartographer's Map.

### System 3: Diplomatic Influence

**Design intent:** Make embassies mechanically significant, not just decorative links. An embassy's effectiveness depends on its building condition, its ambassador's quality, and its alignment with the connection's bleed vectors.

**Core formula:**
```
Embassy Effectiveness = Building Health × 0.4 + Ambassador Quality × 0.4 + Vector Alignment × 0.2

Where:
  Building Health = avg(readiness of both embassy buildings): 0-1
  Ambassador Quality = f(diplomatic_profession, character_depth, relationship_count): 0-1
  Vector Alignment = 1 if embassy's bleed_vector in connection's bleed_vectors[], else 0
```

**Diplomatic Reach** (per simulation) = sum(embassy_effectiveness) across all active embassies.

**Why 0.4/0.4/0.2:**

The equal weighting of building health and ambassador quality means both the physical infrastructure and the human element matter. You can't just assign a great ambassador to a ruined building and expect results. The 0.2 for vector alignment is a bonus for thematic coherence — it rewards players who think about which bleed vectors their embassies channel.

**Strategic implications for Epochs:**

Embassy Effectiveness directly feeds:
- Operative success probability (+0.15 at max effectiveness)
- Bleed echo strength (more effective embassies = louder cultural voice)
- Diplomatic Score dimension
- Embassy Effectiveness < 0.3 = dormant (no bleed, no operative deployment)

This means a player who neglects their embassies can't effectively attack OR influence other simulations. Embassy maintenance is a prerequisite for both peaceful and aggressive playstyles.

### System 4: Crisis & Opportunity Engine

**Design intent:** Events aren't random — they emerge from system state. The `impact_level` a player assigns to their events determines how far the consequences ripple.

**Event Ripple Mechanics:**

```
Impact Level → Ripple Radius:
  1-3: Event's zone only
  4-6: Adjacent zones (same city)
  7-8: Entire city
  9-10: All cities in simulation

Relationship Cascade:
  Intensity ≥ 7: Always reacts
  Intensity 4-6: Reacts if impact ≥ 5
  Intensity 1-3: Reacts only if impact ≥ 8
```

**Bleed Threshold Modification:**

The base bleed threshold (default: impact 8) can be lowered by:
- Zone Stability < 0.3: threshold -1 (desperate realities bleed easier)
- Embassy Effectiveness > 0.8: threshold -1 (strong diplomatic channels)
- Both stack; floor of 5

This creates a feedback loop: unstable zones bleed more easily, and that bleed can destabilize connected simulations, which bleed back. It's a **contagion mechanic** — instability propagates through the multiverse.

**Tag-Based Resonance:**

Tags on events serve as mechanical triggers:
- Tag matches a bleed vector name → +0.2 echo strength for that channel
- Tag matches an agent's `system` → increased reaction probability
- Tag matches a building type → condition change trigger (e.g., "fire" + "residential")

This is an unusual design choice. Most games would use explicit event types with hardcoded effects. By using freeform tags that resonate with existing entity attributes, we create a **soft coupling** system where creative tagging has mechanical consequences. A player who tags their events thoughtfully gains mechanical advantages.

### System 5: Bleed Permeability

**Design intent:** Give the `bleed_strength_decay` setting (which was stored but unused) a real function, and create a nuanced permeability model where simulations aren't equally porous.

**Core formula:**
```
Bleed Permeability (per simulation) =
  bleed_enabled ? 1.0 : 0.0          (master gate)
  × avg(connection.strength)           (how connected are you?)
  × (1 - avg_zone_stability × 0.3)    (unstable = more porous)
  × diplomatic_reach_factor            (more embassies = more channels)

Echo Cascade Probability = base × source_permeability × target_permeability × connection_strength
Bleed Strength Decay = bleed_strength_decay ^ echo_depth
```

**The 7 Bleed Vectors:**

| Vector | Resonates With | Thematic Effect |
|--------|---------------|-----------------|
| **Commerce** | Market/workshop buildings, trade-tagged events | Economic disruption/opportunity |
| **Language** | Diplomatic agents with high qualification | Linguistic drift, communication changes |
| **Memory** | Impact ≥ 9 events (traumatic/monumental) | Deja vu, prophetic dreams, false memories |
| **Resonance** | Relationships with intensity ≥ 8 | Parallel relationships form in target |
| **Architecture** | Buildings with construction_year/style | Architectural elements bleed through |
| **Dream** | Agents with mystical/spiritual character | Visions, subjective and unreliable |
| **Desire** | Events matching unfulfilled needs | Yearning for what the other world has |

Each vector creates a different narrative experience when events echo between simulations. A commerce-vector echo transforms a "building collapse" into "market crash" or "supply chain disruption". A dream-vector echo transforms it into "a collective nightmare of falling structures". The AI generation layer uses these vectors to rewrite event narratives.

### System 6: Epochs — Competitive Time Structure

**Design intent:** Create a structured competitive framework that activates the PvP layer on top of the PvE economy. Epochs are seasons with distinct phases that shift the strategic landscape.

**Lifecycle:**
```
LOBBY → DRAFT → FOUNDATION (20%) → COMPETITION (65%) → RECKONING (15%) → COMPLETED
```

**Phase design rationale:**

- **Draft:** Players select which agents from their template to bring into the match (up to `max_agents_per_player`, default 6). This roster selection locks in strategic posture before the first cycle. See Section VI for full draft mechanics.

- **Foundation (first ~20%):** +50% RP income, no offensive operatives. This is the "arms race" phase — everyone builds infrastructure, establishes embassies, forms alliances. It prevents early rushes from overwhelming players who haven't prepared.

- **Competition (middle ~65%):** Full mechanics. This is the main strategic period. Long enough for multi-cycle plans to unfold, for intelligence to be gathered, for sabotage campaigns to have cascading effects.

- **Reckoning (final ~15%):** Bleed permeability doubled, thresholds -2, cascade depth +1. This is deliberately chaotic — a dramatic escalation that can upset established rankings. It rewards adaptability and punishes brittle strategies.

**Why phases matter:**

Without phases, the game would be a pure arms race from turn 1. The Foundation phase prevents "rush" strategies and gives every player time to establish a baseline. The Reckoning phase prevents "turtle" strategies where a player builds an impenetrable defense and coasts to victory. Together, the phases enforce a **strategic arc**: build → compete → survive.

**Resonance Points (RP) — The Action Economy:**

- Default: 12 RP/cycle, cap 40 RP (foundation: 18 RP/cycle)
- Costs: Spy 3, Guardian 4, Propagandist 4, Saboteur 5, Infiltrator 5, Assassin 7
- Counter-intelligence sweep: 4 RP

The RP cap (default 40 = ~3.3 cycles of income) prevents hoarding and forces regular spending. A player who saves for 4+ cycles loses accumulated RP. This creates a "spend it or lose it" pressure that keeps the game dynamic.

The RP costs are deliberately varied to create **opportunity cost decisions**. 7 RP for an assassin means you can do little else that cycle. 3 RP for a spy means you can still afford a guardian and a counter-intel sweep. The pricing creates natural build diversity — you can't just spam the most powerful unit.

### System 7: Operatives — Covert Warfare

**Design intent:** Create an espionage system where every operative is a real agent with real skills, deployed through real embassies, affecting real buildings. No "game-only" abstractions.

**The 6 Operative Types:**

| Type | RP | Deploy | Duration | Effect | Score Value |
|------|-----|--------|----------|--------|-------------|
| **Spy** | 3 | Instant | 3 cycles | Reveals zone security + guardian count (battle log intel). +2 Inf, +1 Dip, −2 Sov | +2 |
| **Saboteur** | 5 | 1 cycle | Single | Zone security −1 tier + building −1 step. −6 Sta, −8 Sov | +5 |
| **Propagandist** | 4 | 1 cycle | 2 cycles | Generates destabilizing event (impact 6-8). −6 Sov | +5 |
| **Assassin** | 7 | 2 cycles | Single | Wounds agent (relationships -2, ambassador removed). −5 Sta, −12 Sov | +8 |
| **Guardian** | 4 | Instant | Permanent | −6% enemy success per guardian, max −15% (self-deploy) | — |
| **Infiltrator** | 5 | 2 cycles | 3 cycles | Embassy effectiveness −65% | +6 |

**Success Probability Formula:**
```
P(success) = 0.55
  + operative_aptitude × 0.03          (+0.09 to +0.27)
  - target_zone_security × 0.05       (-0.00 to -0.50)
  - min(0.15, guardian_count × 0.06)   (-0.06 per guardian, cap 0.15)
  + embassy_effectiveness × 0.15       (+0.00 to +0.15)

Clamped to [0.05, 0.95]
```

**Why the formula works:**

The base 0.55 puts an average operative (aptitude 6, contributing +0.18) at ~0.73 against an undefended target — strong enough to encourage action, weak enough that defenses matter. From there, each factor shifts the probability:

- **Agent aptitude** (+0.27 max): The operative's typed skill score (see Section VI). An aptitude-9 specialist has an 18pp edge over an aptitude-3 generalist. Meaningful but bounded — aptitude alone can't overcome a well-defended zone.
- **Zone security** (-0.50 max): The single biggest negative modifier. High-security zones are genuinely hard to infiltrate. This remains the primary defensive lever.
- **Guardians** (-0.06 each, cap −0.15): Two guardians reduce by 0.12, three reach −0.15 (cap). Guardians cost 4 RP and don't attack — pure defense.
- **Embassy effectiveness** (+0.15 max): A smaller bonus, but it rewards embassy maintenance.

The clamp at [0.05, 0.95] means nothing is ever certain. Even a perfect setup can fail (5% chance), and even a terrible one can succeed (5% chance). This preserves tension.

**Failure consequences cascade:**

Undetected failure = no consequences. Detected failure (probability: 1 - P(success)):
- Operative captured (removed for entire epoch)
- Diplomatic Incident event in BOTH simulations (impact 7)
- Embassy effectiveness -0.3 for 3 cycles
- Attacker identity revealed publicly

The detection spiral is intentional: a failed operation weakens the embassy used for deployment, making future operations through that embassy less likely to succeed, which makes detection more likely, which further weakens the embassy. This punishes reckless aggression and rewards careful target selection.

**The Embassy Requirement:**

The most important design decision in the operative system: **you cannot attack a simulation you don't have an embassy with**. This means:

1. Aggression requires diplomatic investment (establishing and maintaining embassies)
2. Severing diplomatic ties (dissolving an embassy) is both a defensive AND offensive action — it stops enemy operatives but also your own
3. The diplomatic network IS the battlefield map
4. There's no anonymous aggression — your embassy connections reveal your potential attack vectors

This creates the **Embassy Paradox** (see feedback loops below).

### System 8: Scoring & Victory

**Design intent:** Reward multiple playstyles with a multi-dimensional scoring system where no single strategy dominates.

**Five Dimensions:**

1. **Stability** (25% default) — avg(zone_stability) across all cycles. Rewards builders and defenders.
2. **Influence** (20%) — Outbound echo strength. Rewards cultural exporters.
3. **Sovereignty** (20%) — Resistance to foreign bleed. Rewards isolationists and defenders.
4. **Diplomatic** (15%) — Embassy effectiveness × alliance count. Rewards networkers.
5. **Military** (20%) — Successful operations minus detected failures. Rewards skilled aggressors.

**Normalization:**

Each dimension is rescaled 0-100 relative to the highest scorer in that dimension. This means scores are always relative — a "stability score of 80" means "80% as stable as the most stable simulation."

**Composite Score** = weighted sum of normalized dimensions.

**Victory Conditions:**
- **Overall Victory:** Highest composite at epoch end
- **Dimension Titles:** Best in each dimension earns a title ("The Unshaken", "The Resonant", "The Sovereign", "The Architect", "The Shadow")
- **Team Victory:** Highest team composite (if teams exist)

**Weight presets:**
- **Balanced:** 25/20/20/15/20 (default)
- **Builder:** 40/15/15/10/20 (emphasizes stability)
- **Warmonger:** 15/15/15/15/40 (emphasizes military)
- **Diplomat:** 15/20/20/30/15 (emphasizes diplomatic network)

**Why 5 dimensions instead of 1:**

A single composite score would make the game solvable — find the optimal strategy and execute it. Five dimensions with configurable weights create a multi-objective optimization problem where the Pareto frontier is broad. A player who maximizes military score necessarily sacrifices stability (sending agents abroad). A player who maximizes sovereignty necessarily limits influence (closing bleed channels). This forces genuine strategic choice, not solved optimization.

---

## VI. Agent Aptitudes & Draft Phase

### The Problem with Qualification

In v1.0, operative success probability used `qualification_level × 0.05` — the same profession quality score that drives building readiness. This created two design problems:

1. **Flat agents.** An agent with qualification 10 was equally good at every operative type. There was no reason to prefer Agent A as a spy over Agent B — whoever had the highest qualification went. Agent identity was irrelevant beyond a single number.

2. **Double duty without tension.** Qualification already matters for building readiness (staffing ratio × qualification match). Using the same number for operative success meant that the "best" agent for combat was also the "best" agent for staffing. The Guns vs. Butter tension existed (deploy vs. staff), but the CHOICE of which agent to deploy didn't. You always sent the highest-qualified agent because there was no reason not to.

3. **Unbounded swing.** `qualification × 0.05` on a 1-10 scale meant up to +0.50 probability — a massive modifier that dominated zone security and guardians. A qualification-10 operative against a lawless zone had near-guaranteed success regardless of defenses.

Agent aptitudes solve all three problems by making each agent a distinct strategic asset with typed strengths.

### Aptitude Scores

Each agent has **6 aptitude scores**, one per operative type:

| Aptitude | Operative Type | What It Represents |
|----------|---------------|-------------------|
| `apt_spy` | Spy | Surveillance tradecraft, information extraction, cover maintenance |
| `apt_guardian` | Guardian | Counter-intelligence instinct, threat recognition, zone defense discipline |
| `apt_saboteur` | Saboteur | Technical demolition skill, infrastructure analysis, covert entry |
| `apt_propagandist` | Propagandist | Rhetorical ability, cultural manipulation, narrative seeding |
| `apt_infiltrator` | Infiltrator | Long-term cover, institutional subversion, diplomatic erosion |
| `apt_assassin` | Assassin | Targeted disruption, high-value asset neutralization, clean extraction |

**Score range:** 3-9 per aptitude. The floor of 3 ensures no agent is completely useless at any role. The ceiling of 9 prevents any single agent from being an unstoppable operative.

**Budget constraint:** Each agent has a **total budget of 36 points** across all 6 aptitudes. The average score is exactly 6.0 (the midpoint of the 3-9 range). This forces a zero-sum allocation: raising one aptitude requires lowering another.

**Aptitudes are set on the simulation template.** They are part of the pre-match strategic design — the world you build before an epoch begins. During game instance cloning, aptitude scores are copied unchanged from the template. This makes agent composition the central strategic decision of pre-match preparation.

### The Specialist vs. Generalist Tradeoff

The 36-point budget creates a fundamental design tension in agent composition:

**The Specialist** (e.g., 9/3/3/9/3/9):
- Three aptitudes at maximum, three at minimum
- Devastating when deployed in their specialty (+0.27 probability from aptitude alone)
- Crippled when forced into a non-specialty role (+0.09)
- Predictable — opponents who identify the specialization can anticipate deployments
- Vulnerable to draft pressure (if match rules force fewer agents, a hyper-specialist might not make the cut)

**The Generalist** (e.g., 6/6/6/6/6/6):
- All aptitudes at the average
- Serviceable in any role (+0.18 probability from aptitude)
- Never optimal, never terrible
- Flexible — opponents can't predict deployment patterns
- Safe draft pick (useful regardless of match meta)

**The Hybrid** (e.g., 8/4/8/4/8/4):
- Two "good at" categories and one "great at"
- A balance between specialization depth and deployment flexibility
- The most common optimal build for serious play

In practice, the most interesting compositions will mix agent profiles. A roster of 6 agents might include 2 specialists (the assassin and the master spy), 2 hybrids (versatile operatives who can flex between roles), and 2 generalists (reliable building staff who can serve as emergency operatives). The composition decision is made during template design — long before any epoch begins — which means it reflects the player's strategic identity and game philosophy.

### Formula Change: Qualification to Aptitude

The operative success probability formula changes from:

```
v1.0: + qualification × 0.05     (+0.05 to +0.50, based on 1-10 scale)
v1.1: + aptitude × 0.03          (+0.09 to +0.27, based on 3-9 scale)
```

**Updated formula:**
```
P(success) = clamp(0.05, 0.95,
  0.55
  + aptitude × 0.03               (+0.09 to +0.27)
  - target_zone_security × 0.05   (-0.00 to -0.50)
  - min(0.15, guardians × 0.06)   (-0.06 per guardian, cap 0.15)
  + embassy_effectiveness × 0.15  (+0.00 to +0.15)
)
```

**Why 0.03:**

The aptitude contribution is bounded to an 18 percentage point swing (0.27 - 0.09 = 0.18). Compare this to the v1.0 qualification swing of 45pp (0.50 - 0.05). The reduced swing means aptitude is **meaningful but doesn't dominate**. A max-aptitude operative (9) against a fortress zone with 3 guardians can still fail. A min-aptitude operative (3) against a lawless zone with no guardians can still succeed. The other factors — zone security, guardians, embassy effectiveness — retain their strategic weight.

The 0.03 coefficient also creates clean probability breakpoints:

| Aptitude | Contribution | Interpretation |
|----------|-------------|----------------|
| 3 (minimum) | +0.09 | Barely trained — marginal advantage |
| 5 (below average) | +0.15 | Competent but not reliable |
| 6 (average) | +0.18 | Solid operative — the baseline |
| 7 (above average) | +0.21 | Good operative — noticeable edge |
| 9 (maximum) | +0.27 | Elite specialist — significant advantage |

Each point of aptitude is worth exactly 3pp of success probability. This makes aptitude investment intuitive and calculable without requiring a spreadsheet.

### The Draft Phase

The Draft Phase is a new addition to the epoch lifecycle, inserted between the lobby and the first competitive cycle:

```
LOBBY → DRAFT → FOUNDATION (20%) → COMPETITION (65%) → RECKONING (15%) → COMPLETED
```

**Design intent:** A simulation template might have 10 agents, but a match might only allow 6. The draft phase forces players to choose which agents to bring — a roster selection decision that locks in their strategic posture for the entire epoch.

**Epoch configuration:**

The epoch creator sets `max_agents_per_player` in the epoch config:

| Setting | Range | Default | Effect |
|---------|-------|---------|--------|
| `max_agents_per_player` | 4-8 | 6 | Maximum agents each player can draft from their template |

**Draft mechanics:**

During the Draft Phase, each participant sees their template's full agent roster — all agents with their aptitude scores, professions, and current building assignments. They select up to `max_agents_per_player` agents to include in their game instance.

Non-drafted agents are **excluded from the game instance entirely**. They don't appear in the cloned simulation, can't staff buildings, can't serve as ambassadors, and can't be deployed as operatives. This is a hard cutoff, not a bench — there's no substitution during the epoch.

**Why the draft matters:**

The draft turns agent composition from a fixed property of the simulation into an active strategic decision. A template might contain:

- 2 spy specialists (apt_spy 9)
- 2 builder generalists (all aptitudes 6, high building qualifications)
- 2 military hybrids (high saboteur + assassin)
- 2 diplomatic agents (high propagandist + infiltrator)
- 2 guardian specialists (apt_guardian 9)

With `max_agents_per_player = 6`, the player must cut 4. Which 4? The answer depends on:

1. **Score weights** — If the epoch emphasizes Military, draft the combat specialists. If Stability, draft the builders.
2. **Opponent analysis** — If a rival is known for aggressive sabotage, draft guardian specialists. If they turtle, draft infiltrators and propagandists.
3. **Alliance plans** — If you're planning to play diplomat, draft agents with high propagandist and infiltrator aptitudes for embassy-based influence.
4. **Building coverage** — Drafted agents must also staff buildings. Cutting too many generalists leaves buildings understaffed, tanking stability.

The draft creates a **commitment moment** — a point of no return where the player's strategy crystallizes. Post-draft, there's no going back. If you drafted wrong, you adapt or lose. This mirrors the draft phase in MOBAs (League of Legends ban/pick) and TCG deck construction (choosing which 60 of your 200 cards to play).

**Bot auto-draft:**

Bot players draft automatically based on their personality archetype:

| Archetype | Draft Strategy |
|-----------|---------------|
| **Sentinel** | Prioritizes guardian aptitude + building qualifications. Drafts defensively. |
| **Warlord** | Prioritizes saboteur + assassin aptitudes. Drafts offensively, accepts domestic gaps. |
| **Diplomat** | Prioritizes propagandist + infiltrator aptitudes + ambassador quality. Balanced draft. |
| **Strategist** | Analyzes epoch score weights and drafts to maximize composite. Adaptive. |
| **Chaos** | Semi-random draft with bias toward extreme specialists. Unpredictable. |

Bot draft strategies are deterministic given the epoch config and template roster, ensuring reproducible behavior for testing and balance analysis.

**Draft timer:**

The draft phase has a configurable duration (default: 24 hours). If a player doesn't submit their draft by the deadline, the system auto-drafts their top `max_agents_per_player` agents ranked by total aptitude sum — a reasonable default that doesn't punish inactivity too harshly but rewards active drafting.

### Interaction with Existing Systems

Agent aptitudes integrate with, but don't replace, existing mechanical attributes:

| Attribute | Role | Affected By Aptitude? |
|-----------|------|----------------------|
| `qualification_level` | Building readiness (staffing quality) | No — unchanged |
| `professions` | Building staffing match | No — unchanged |
| `character_depth` | Ambassador quality | No — unchanged |
| `aptitudes` (new) | Operative success probability | Yes — replaces qualification in formula |

This separation is deliberate. An agent can be an excellent doctor (qualification 10 in medical) and a terrible spy (apt_spy 3). The building economy and the operative economy now pull from **different dimensions of agent quality**, deepening the Guns vs. Butter tension: your best building staffer might be your worst operative, and vice versa.

---

## VII. Cross-System Interaction Design

### Feedback Loops

The game's depth comes from **10 feedback loops** — 4 in the PvE economy, 6 in the PvP competitive layer. These are the engine that makes the game interesting.

#### PvE Loops (Always Active)

**Loop 1: Death Spiral**
```
Low staffing → Low building readiness → Low zone stability
→ Crisis events → Building damage → Even lower readiness → ...
```
A neglected simulation degrades. This is the "maintenance pressure" that keeps players engaged between Epochs. Without active management, your simulation slowly falls apart.

**Severity:** High. Without intervention, a critical building failure can cascade into full zone collapse within a few event cycles. The 30-day event pressure window means recovery takes time even after the root cause is fixed.

**Counter:** Assign agents to critical buildings first. Repair damaged buildings. The multiplier structure means fixing any one factor helps — going from "poor" to "moderate" condition gains 50% more readiness (0.5 → 0.75).

**Loop 2: Diplomatic Amplifier**
```
Good embassies → High diplomatic reach → Echo strength multiplier
→ More cultural export → More narrative influence → ...
```
Investment in diplomacy compounds. Well-maintained embassies create stronger echoes, which shape other simulations, which can destabilize them (making YOUR embassies there even more effective, since unstable zones lower bleed thresholds).

**Loop 3: Bleed Cascade**
```
Unstable zone → Lower bleed threshold → Events bleed easier
→ Target destabilized → THEIR events bleed back → ...
```
Instability is contagious. If Simulation A has a zone collapse, those crisis events bleed to Simulation B (where A has an embassy). If the echoed events destabilize B's zone, B's events bleed to C. And so on.

**This is the most dangerous loop in the system.** It can create runaway instability across the entire multiverse. The `bleed_strength_decay` setting is the primary damper — each cascade hop reduces strength exponentially.

**Loop 4: Recovery Loop**
```
High readiness → Stable zone → Opportunity events → Positive narratives
→ Attract agents → Even higher readiness → ...
```
The virtuous counterpart to the Death Spiral. Stable simulations attract better outcomes. This rewards proactive maintenance and makes recovery feel meaningful.

#### PvP Loops (Epoch-Only)

**Loop 5: Guns vs. Butter**
```
Deploy operatives abroad → Agents leave domestic posts → YOUR readiness drops
→ YOUR zone stability drops → YOUR stability score drops
```
**This is the core tension of the competitive layer.** Every operative deployment has a domestic cost. Sending your best doctor as a spy means your hospital is understaffed. A player who goes "all in" on military spending cripples their own stability score.

The trade-off is quantifiable: deploying an agent with aptitude 8 adds +0.24 to operative success probability but removes them from a critical building post, potentially reducing readiness by 10-30%. Is that worth it? Depends on the epoch's score weights, the target's vulnerability, and how much your own stability can absorb the hit.

**Loop 6: Embassy Paradox**
```
Embassy enables diplomacy (scoring) AND warfare (operatives)
Closing embassy → Safe from enemy operatives BUT kills your own offense AND diplomatic score
```
This is an **intentional dilemma** with no "correct" answer. The optimal play depends on context:
- Is this simulation actively attacking you? Close the embassy.
- Are you planning a sabotage campaign? Keep it open (you need it for deployment).
- Is the Diplomatic score weight high? Keep it open (closing hurts your score).
- Are you in the Reckoning phase? Maybe keep it open (bleed amplification can earn Influence points).

**Loop 7: Sabotage Cascade**
```
Successful sabotage → Building degraded → Zone unstable
→ Bleed threshold lowered → YOUR propaganda events bleed back to YOU
```
Aggressive action can backfire. If you sabotage a building in a zone that's already unstable, the resulting instability lowers the bleed threshold, which means YOUR propagandist events in that zone might echo back to your OWN simulation through other connections. Aggression in an interconnected network has unpredictable consequences.

**Loop 8: Detection Spiral**
```
Failed covert op → Diplomatic incident → Embassy effectiveness -0.3
→ Future ops have lower success → More failures → More incidents → ...
```
Reckless aggression is self-destructive. Each failed operation weakens the embassy used for deployment, creating a vicious cycle that can render an entire embassy chain useless within 2-3 failed operations.

**Loop 9: Alliance Tension**
```
Form alliance → Share team score bonus → Build trust via embassy investment
→ Betrayal option exists → Detected betrayal = catastrophic diplomatic penalty
→ Should I betray? Should I trust?
```
If `allow_betrayal = true`, alliances become a prisoner's dilemma. Cooperating builds diplomatic score. Betraying can eliminate a competitor. But detected betrayal (-25% Diplomatic Score + alliance dissolution) is catastrophic. This creates genuine social tension between allied players.

**Loop 10: Reckoning Chaos**
```
Reckoning phase → Bleed doubled, thresholds -2, depth +1
→ Massive cross-simulation event cascade → Scores swing wildly
→ Trailing players can catch up → Leaders must defend
```
The Reckoning phase is a deliberate destabilizer. It prevents leaders from coasting and gives trailing players a shot at comeback through the amplified bleed mechanics.

### Cross-System Matrix

```
                Staff  District  Diplo   Crisis  Bleed   Epochs  Operatives  Scoring
Staffing Econ     —     ★★★       ★       ★★      ·       ·      ★★★         ★★
District Health  ★★      —        ★★      ★★★     ★★      ·      ★★          ★★★
Diplomatic Inf    ·     ★★         —       ★      ★★★     ·      ★★★         ★★
Crisis Engine   ★★      ★★★       ★★       —      ★★★     ★       ★           ★★
Bleed Perm       ·       ★        ★★      ★★★      —      ★★      ★          ★★★
Epochs           ·       ·         ·       ★★      ★★       —     ★★★         ★★★
Operatives     ★★★      ★★★       ★★      ★★       ★      ★★★     —          ★★★
Scoring          ·       ·         ·        ·       ·      ★★★     ★            —
```

The densest interactions are between Operatives and the core economy systems. This is by design — the competitive layer doesn't exist in isolation, it USES the economy as its playing field.

### Resonance-Combat Bridge

Substrate resonances create a ninth interaction axis that connects the platform's narrative layer directly to competitive mechanics. When a resonance is active, its archetype modifies the 8-term success probability formula through three channels: zone pressure in the target simulation (up to +0.04), archetype-operative affinities where aligned operatives gain effectiveness and opposed ones lose it (net -0.04 to +0.04), and an attacker pressure penalty where a destabilized attacker's own zone instability reduces their outbound mission effectiveness (up to -0.04). This means a real-world event translated into an archetype like "The Shadow" doesn't just spawn narrative events — it mechanically advantages spies and assassins while disadvantaging propagandists across every active epoch, creating strategic windows that players must read and exploit. See [Substrate Resonances](../specs/substrate-resonances.md) for the full archetype-operative affinity table and function documentation.

---

## VIII. Player Archetypes & Session Flow

### Four Strategic Archetypes

Based on the 5-dimension scoring system and the trade-offs between domestic investment and foreign action, four natural player archetypes emerge:

#### 1. The Builder (Stability + Sovereignty focus)

**Strategy:** Maximize domestic infrastructure. Staff all buildings with qualified agents. Maintain building conditions. Keep zone stability above 0.7 everywhere.

**Session flow during Epoch:**
1. Check zone stability dashboard
2. Reassign agents to maintain critical building readiness
3. Repair any sabotaged buildings (1 RP each)
4. Deploy guardians in vulnerable zones
5. Run counter-intelligence sweep if threats detected
6. Approve/reject incoming echoes carefully (protect sovereignty)

**Strengths:** Resistant to sabotage (high readiness = fast recovery). High Stability and Sovereignty scores. Difficult to destabilize.

**Weaknesses:** Low Influence and Military scores. No offensive capability. Relies on others for information. Can be out-scored by aggressive players if Military weight is high.

**Counter:** Sustained propaganda campaigns erode Sovereignty over time. Infiltrators can weaken embassy effectiveness without triggering domestic instability.

#### 2. The Diplomat (Diplomatic + Influence focus)

**Strategy:** Build the largest embassy network possible. Assign the best agents as ambassadors. Maximize bleed reach. Form and maintain alliances.

**Session flow:**
1. Check embassy effectiveness scores
2. Ensure ambassador agents maintain high qualifications
3. Create high-impact events aligned with bleed vectors (boost echo strength)
4. Coordinate with allies via team communication
5. Manage incoming echoes (approve selectively to control narrative)
6. Deploy spies for intelligence, avoid aggressive operations

**Strengths:** High Diplomatic and Influence scores. Team bonus from alliances. Strong echo generation. Good intelligence from spy network.

**Weaknesses:** Embassy-heavy investment means more surface area for enemy infiltrators. Ambassador agents can't serve as operatives or staff buildings. Vulnerable to betrayal.

**Counter:** Infiltrators reduce embassy effectiveness. Assassins wound ambassadors. Closing an embassy cuts the diplomat's network.

#### 3. The Shadow (Military + Influence focus)

**Strategy:** Aggressive covert operations. Deploy operatives through carefully maintained embassies. Target high-criticality buildings in rival simulations to cascade zone instability.

**Session flow:**
1. Review intelligence from active spies
2. Identify highest-value targets (critical buildings in already-stressed zones)
3. Deploy saboteurs and propagandists to maximize cascade damage
4. Use assassins sparingly against key ambassadors
5. Monitor embassy effectiveness (must maintain for continued operations)
6. Accept domestic readiness loss as cost of war

**Strengths:** High Military score from successful operations. Can create Sabotage Cascades that devastate rival stability. Propaganda events boost Influence.

**Weaknesses:** Domestic readiness drops as agents are deployed abroad. High risk of Detection Spiral if operations fail. Embassy effectiveness degrades from diplomatic incidents.

**Counter:** Guardians in target zones. High zone security. Closing embassies cuts the Shadow's attack vectors.

#### 4. The Opportunist (Balanced / Adaptive)

**Strategy:** Read the meta, exploit gaps. If everyone's turtling, go aggressive. If everyone's fighting, build infrastructure. Maximize the least-contested scoring dimensions.

**Session flow:** Varies entirely by context. The Opportunist is the hardest archetype to play well because it requires understanding all systems simultaneously.

**Strengths:** Flexible. Can pivot between strategies as the epoch progresses. Can exploit over-investment by rivals.

**Weaknesses:** Master of none. Vulnerable to specialists who commit fully to one dimension.

### The Alliance Meta-Game

When teams are enabled, the archetype interactions become richer:

- **Builder + Shadow alliance:** Builder maintains domestic stability while Shadow conducts operations. The Builder's high stability offsets the Shadow's domestic neglect. The Shadow's military score adds to the team total.

- **Diplomat + Diplomat alliance:** Maximum embassy network, maximum team bonus, maximum Influence. Vulnerable to military aggression but scores well in 3 of 5 dimensions.

- **Betrayal dynamics:** The Opportunist in an alliance is the most dangerous teammate. They benefit from alliance while calculating the optimal betrayal timing. If betrayal is enabled, every alliance contains an implicit prisoner's dilemma.

---

## IX. Economy Design & Balancing

### Resource Flows

The game has **one explicit resource** (RP) and **multiple implicit resources** (agent time, building condition, zone stability, embassy effectiveness). The implicit resources are more strategically interesting because they can't be "saved" — they degrade naturally and require continuous investment.

#### Explicit: Resonance Points (RP)

```
Income: 12 RP/cycle (foundation: 18)
Cap: 40 RP
Costs: 3-7 RP per operative, 1-4 RP for utility actions
```

At default settings (12 RP/cycle, 8h cycles = 3 cycles/day), a player receives 36 RP/day and can store at most 40. This means:

- **1-2 major operations per day** (7 RP assassin + spy or guardian)
- **2-3 medium operations per day** (spy + saboteur + counter-intel)
- **3-4 minor operations per day** (spies + guardians)

The RP economy is deliberately **tight**. You can't do everything. Every operation chosen is another operation NOT chosen.

#### Implicit: Agent Time

The most constrained resource. Your simulation has ~6-10 agents. Each agent can be:
- Staffing a building (boosting readiness, zone stability, Stability score)
- Serving as an ambassador (boosting embassy effectiveness, Diplomatic score)
- Deployed as an operative (boosting Military score, reducing readiness and Stability)

An agent can only do ONE of these at a time. The "agent budget" creates a zero-sum tension between domestic health and foreign operations that RP alone can't capture.

#### Implicit: Building Condition

Buildings degrade from sabotage (one step per hit). Repair costs 1 RP and restores one step. But repair doesn't happen instantly — it takes effect next cycle. This means sabotage has **lingering effects** that cost both RP and time to fix.

A sustained sabotage campaign against a single high-criticality building can:
1. Degrade it from good → moderate → poor → ruined over 3 successful operations
2. At "ruined", the building operates at 20% effectiveness regardless of staffing
3. Repairing back to "good" costs 3 RP and 3 cycles minimum
4. During those 3 cycles, zone stability is depressed
5. During depressed stability, bleed threshold is lowered, inviting more cross-sim chaos

### Balancing Considerations

#### Is military too strong?

The military scoring dimension rewards successful operations (+2 to +8 per success) and punishes detected failures (-2). At first glance, a skilled player could farm military score by spamming cheap spies (3 RP, +2 on success, low risk).

**Balancing factors:**
- Detection penalty applies regardless of operative type (-3 for any detection)
- Detection spiral weakens the embassy, reducing future success probability
- Every deployed agent reduces domestic readiness (Stability cost)
- Spy information is only valuable if you ACT on it (costing more RP)

**Potential concern:** If a player drafts multiple high-aptitude spy specialists (apt_spy 8-9), their success probability is strong (base 0.55 + 0.24-0.27 from aptitude). However, the reduced coefficient (0.03 vs. the original 0.05) and the bounded 3-9 range cap the maximum aptitude contribution at +0.27 — meaningful but no longer dominating. The draft phase further constrains this: loading up on spy specialists means sacrificing agents with other aptitudes or high building qualifications.

**Recommendation for tuning:** Monitor first real epoch. If spy spam dominates, consider: (a) diminishing returns on spy score after N successful missions in same target, (b) increasing spy RP cost to 4, or (c) adding a "counterintelligence fatigue" mechanic where repeated sweeps in the same zone have diminishing returns.

#### Is turtling too safe?

A pure Builder who never engages with the competitive layer scores well on Stability (25%) and Sovereignty (20%) = 45% of composite without doing anything offensive. At "Balanced" weights, they'd need the other 55% from Influence + Diplomatic + Military, where they'd score near zero.

**Balancing factors:**
- Sovereignty is relative (normalized 0-100). If everyone has good sovereignty, a Builder's advantage shrinks.
- Influence requires active event creation and bleed management, not just defense.
- The Reckoning phase doubles bleed permeability, making sovereignty harder to maintain.
- Other players can chip away at the Builder's stability through sustained sabotage.

**Assessment:** At "Balanced" weights, turtling is a viable but not dominant strategy. At "Builder" weights (40% stability), it might be too strong. Epoch creators should adjust weights based on desired playstyle emphasis.

#### Is betrayal too punishing?

Detected betrayal = -25% Diplomatic Score + alliance dissolution. For a player with strong diplomatic investment, this is devastating.

**By design:** Betrayal SHOULD be risky. It's meant to be a dramatic, game-defining move, not a routine tactic. The -25% penalty is designed to make betrayal a credible threat (you COULD do it) without making it a dominant strategy (you probably SHOULDN'T unless the payoff is enormous).

**Potential concern:** If the penalty is too high, no one will ever betray, making the `allow_betrayal` toggle meaningless. If too low, everyone will betray, making alliances meaningless.

**Assessment:** -25% provides a stronger deterrent while remaining recoverable over multiple cycles. It's roughly equivalent to losing 1.25 dimensions' contribution to your composite score, validated through 215-game simulation analysis.

---

## X. Competitive Tension Design

### The Three Tensions

Every interesting competitive game creates tensions — moments where the player faces a genuine choice with no obviously correct answer. metaverse.center creates three structural tensions:

#### Tension 1: Domestic vs. Foreign Investment (Guns vs. Butter)

Every agent deployed abroad is an agent not staffing a building at home. Every RP spent on operatives is RP not spent repairing sabotaged buildings. Every embassy maintained for offensive capability is an embassy that could be closed for defense.

This tension is **always present** during an Epoch. There's no "free" military action. The question is always: "Is the military value of this operation worth the domestic cost?"

**Why this works:** It prevents "free" aggression. In many games, attacking an opponent has no cost to the attacker (only risk of failure). Here, the cost is structural and immediate. Your simulation PHYSICALLY weakens when you deploy operatives.

#### Tension 2: Openness vs. Security (The Embassy Paradox)

Embassies enable both diplomacy and warfare. An open embassy with a rival is both a weapon and a vulnerability. Closing it protects you but also disarms you.

**Why this works:** It prevents the "arms race → cold war → stalemate" pattern where players defensively build up and never engage. Because embassies are REQUIRED for both offense and defense, complete isolation isn't viable (you lose Diplomatic score and Influence reach).

#### Tension 3: Trust vs. Opportunity (Alliance Betrayal)

If betrayal is enabled, every alliance is simultaneously cooperative AND competitive. You benefit from your ally's strength (team score) but also compete against them (individual rankings). You could betray them (eliminating a competitor) but risk catastrophic punishment if detected.

**Why this works:** It adds a social/psychological dimension to what would otherwise be a pure optimization game. The math might say "betray now" but the relationship says "this person will never trust me again." This mirrors real-world diplomatic dynamics.

### What Creates Drama

The most dramatic moments in the game will emerge from:

1. **The failed assassination** — You send your best agent to wound a rival's ambassador. The mission fails. Your agent is captured. A Diplomatic Incident erupts. Your embassy effectiveness plummets. The rival now knows you attacked them. Your alliance wonders if you're trustworthy.

2. **The Reckoning cascade** — Three simulations are close in score entering Reckoning. Bleed doubles. A crisis event in Simulation A echoes to B, which echoes to C. All three zones destabilize simultaneously. Scores shift wildly. The leader going into Reckoning might not be the leader coming out.

3. **The betrayal reveal** — Your ally has been sending spies to your simulation for 3 cycles. You run a counter-intelligence sweep and discover them. Do you confront them publicly (destroying the alliance but gaining sympathy from other players)? Do you quietly close the embassy (cutting their intelligence pipeline without drama)?

4. **The diplomatic incident chain** — Player A attacks Player B through their embassy. B retaliates through the same embassy. Both operations fail, both are detected. The embassy effectiveness drops to near zero from accumulated diplomatic incidents. Both players are now locked in a useless diplomatic relationship that benefits neither.

---

## XI. Design Pattern Analysis

### Patterns Used

#### 1. Resource Triangle (established pattern, used correctly)

The classic strategy game pattern where three resource types create tension:
- **Economy** (building readiness, zone stability)
- **Military** (operatives, RP)
- **Technology/Diplomacy** (embassies, bleed vectors)

Each investment in one area reduces investment in the others (through shared agent pool and RP). This is the foundational pattern of RTS games (StarCraft's minerals/gas/supply) and 4X games (Civilization's food/production/gold).

**Assessment:** Used correctly. The shared agent pool ensures the triangle has teeth — you can't just "build more resource generators" to fund all three simultaneously.

#### 2. Information Asymmetry (established pattern, used with twist)

Players don't have complete information about rival simulations. Spy operatives reveal metrics; counter-intelligence sweeps reveal enemy operatives; public battle log reveals detected events.

**The twist:** Information costs RP to acquire (spy deployment) and RP to defend against (counter-intelligence sweep). Information is a resource, not a free mechanic.

**Assessment:** Good implementation. The cost of information prevents perfect-information gameplay while giving players agency over how much they know.

#### 3. Attrition vs. Alpha Strike (established tension)

Some operative types are attrition weapons (propagandist: sustained destabilization over 2 cycles) while others are alpha strikes (assassin: single devastating action). The RP cost reflects this — attrition is cheaper per-cycle but less impactful per-action.

**Assessment:** Well balanced in theory. Saboteurs (5 RP, single action, permanent condition change) are the most efficient attrition weapon because building condition doesn't auto-recover. This might make saboteur spam dominant against builders.

#### 4. Asymmetric Scoring (uncommon pattern, innovative)

Most competitive games have a single win condition (most points, first to finish, last standing). Five independently-scored dimensions with configurable weights create a game where different players can pursue different definitions of "winning."

**Assessment:** This is the game's most distinctive design feature. It enables genuine playstyle diversity. However, it's also the most fragile — if one dimension is consistently easier to score than others, the meta will converge toward it regardless of weights.

#### 5. Phase Structure (established pattern from TCG/MOBA)

The Foundation → Competition → Reckoning arc mirrors patterns from:
- **TCG games** (Magic: early game → midgame → late game, each favoring different strategies)
- **MOBAs** (laning → teamfight → late game scaling)
- **Board games** (Twilight Imperium's action/political/agenda phases)

**Assessment:** Well applied. The Foundation phase prevents cheese strategies. The Reckoning phase prevents turtling. The three phases create a natural narrative arc.

### Patterns Potentially Broken or Strained

#### 1. Meaningful Choices (strained)

The principle that every decision should have interesting trade-offs is strained in some areas:

- **Guardian deployment** has no downside except RP cost. There's no reason NOT to deploy a guardian in every zone if you can afford it. This could become an "obvious best play" that reduces strategic variety.

**Potential fix:** Guardians could have a maintenance cost (1 RP per cycle) or could reduce zone's bleed OUTPUT (guardians suppress all reality manipulation, including your own echoes).

- **Closing embassies** is almost always correct if you're being actively attacked and don't plan to attack back. There's no "diplomatic reputation" cost to embassy closure.

**Potential fix:** Closing an embassy could impose a Diplomatic Score penalty, creating a cost for isolationism.

#### 2. Player Engagement During Off-Cycles (potentially broken)

Between cycle resolutions, there's nothing for players to DO in the competitive layer. The game becomes "set up operations, wait 2-24 hours, see results." This creates dead time.

**Why this might be intentional:** The game targets a "play-by-mail" audience that prefers slow, thoughtful play. Dead time is thinking time.

**Why this might be a problem:** Modern players expect continuous engagement. Without something to do between cycles, players might lose interest during a 14-day epoch.

**Potential fix:** Allow intra-cycle "tactical" actions (redistribute agents between buildings, manage bleed approvals, write event narratives) that affect the NEXT cycle resolution without requiring real-time interaction.

#### 3. Rich-Get-Richer (partially addressed)

A simulation that starts an epoch with better infrastructure (more agents, higher qualifications, more embassies) has a structural advantage. The game doesn't have a catch-up mechanic beyond the Reckoning phase.

**Partially addressed by:** Normalization (scores relative to best player, not absolute), Reckoning phase chaos, and the Guns vs. Butter trade-off (strong simulations deploying operatives weakens them domestically).

**Substantially addressed by:** The Draft Phase (Section VI). The `max_agents_per_player` cap ensures every participant enters the epoch with the same agent count regardless of template size. A simulation with 20 agents and one with 6 both draft to the same limit. The strategic advantage shifts from "who has more agents" to "who composed better agents and drafted more wisely."

---

## XII. Comparative Analysis — Similar Games

### Direct Comparisons

#### Neptune's Pride (2010, Iron Helmet Games)

**Similarity:** Asynchronous multiplayer strategy with real-time (but slow) execution. Diplomacy, alliances, betrayal. Long games (days to weeks). "Set orders and wait" mechanic.

**Differences:** Neptune's Pride is spatial (star map), metaverse.center is structural (entity graph). NP has real-time fleet movement; MC has cycle-based resolution. NP has no creative/narrative layer.

**Lesson from NP:** Neptune's Pride proved that asynchronous multiplayer strategy works and that the "check twice a day" engagement model is viable. But NP also showed that **kingmaking** (where eliminated players can gift their assets to a friend) and **early elimination** (where a player is effectively out of the game after day 2) are serious problems. metaverse.center's scoring system avoids early elimination (you can always earn stability/sovereignty points even while losing military) but kingmaking via alliance manipulation is still possible.

#### Diplomacy (1959, Allan Calhamer / 2020s, webDiplomacy/Backstabbr)

**Similarity:** Alliance formation, betrayal, asynchronous play, no randomness in core mechanics. Diplomatic communication is the primary strategic tool.

**Differences:** Diplomacy is purely military (unit movement on a map). metaverse.center has an economic layer underneath the military. Diplomacy has simultaneous move resolution; MC has sequential cycle resolution.

**Lesson from Diplomacy:** Diplomacy is the gold standard for alliance/betrayal dynamics. Its genius is that communication between players IS the gameplay. metaverse.center captures this with the alliance system but might benefit from more **in-game communication tools** (secure messaging between simulation owners, diplomatic proposals, alliance chat).

#### Cultist Simulator / Book of Hours (Weather Factory)

**Similarity:** Opaque systems where player actions cascade through interconnected mechanics. Narrative-driven with emergent storytelling. Entity management (followers/agents) with typed attributes.

**Differences:** Single-player. Real-time (though pauseable). Much more narrative-focused, less strategic.

**Lesson from CS:** Cultist Simulator proved that **opacity is a feature, not a bug**. Players enjoy discovering how systems interact. metaverse.center could benefit from NOT showing all formulas upfront — let players discover that "my spy failed more often after the diplomatic incident" through experience rather than formula documentation.

#### Stellaris (Paradox Interactive)

**Similarity:** Grand strategy with diplomacy, espionage, alliances, and multi-dimensional victory. Federation mechanics (team play). Espionage system with operative types and success probability.

**Differences:** Single-player (with multiplayer option). Real-time with pause. Much larger scale. No creative/narrative worldbuilding.

**Lesson from Stellaris:** Stellaris's espionage system (added in Nemesis DLC) was widely criticized for being **too passive** — you set up operations and wait, with little player agency in the outcome. metaverse.center has the same structure (deploy and wait for cycle resolution). The mitigation is that MC operations have more dramatic consequences (captured operatives, diplomatic incidents, embassy degradation) which create narrative engagement even when the mechanical interaction is passive.

#### Fallen London / Sunless Sea / Sunless Skies (Failbetter Games)

**Similarity:** Narrative-driven world with interconnected locations, mysterious factions, and strong thematic voice. Quality-based narrative (attribute checks determine story outcomes). The Gaslit Reach simulation in metaverse.center is directly inspired by Fallen London's Unterzee.

**Differences:** Single-player narrative. Action-based (spend actions to advance stories). No competitive multiplayer.

**Lesson from FL:** Fallen London proved that **dense, interconnected worldbuilding** sustains player engagement for years. The platform's lore depth (concept.md is 9300 words of Tarot-structured meta-lore) follows this model. The key insight is that lore ISN'T just decoration — it's the framework that makes mechanical systems feel meaningful. "Bleed between simulations" is a game mechanic, but "the walls between realities are thinning because the Fracture shattered the unified world into Shards" is a reason to CARE about that mechanic.

#### Dwarf Fortress (Bay 12 Games)

**Similarity:** Simulation where every entity has detailed attributes that mechanically interact. Emergent narrative from system interactions. Building + staffing + zone management.

**Differences:** Single-player. Procedurally generated. Much deeper simulation (individual dwarf needs, pathfinding, combat). No multiplayer competition.

**Lesson from DF:** Dwarf Fortress proved that **emergence from simple rules** creates the best stories. The interaction between building readiness, zone stability, event generation, and bleed creates a space for emergent narratives that no designer could script. The AI generation layer then gives these emergent events a narrative voice.

### No Direct Analog

There is no game that combines all of metaverse.center's elements:
- Persistent world you own and curate creatively
- AI-augmented narrative generation
- Cross-world event propagation (Bleed)
- Asynchronous competitive seasons with espionage
- Multi-dimensional scoring with configurable emphasis

The closest concept is probably a **massively multiplayer play-by-mail game with world simulation**, which doesn't really exist in the current market. This is both the game's greatest strength (unique value proposition) and greatest risk (no proven market for this exact formula).

---

## XIII. What Makes This Interesting

### 1. The Creative-Competitive Fusion

Most competitive games separate creation from competition. You build a deck, then play it. You train units, then fight. In metaverse.center, creation IS competition. The agent you write a backstory for is the same agent you deploy as a spy. The building you describe in loving detail is the same building your enemy tries to sabotage. This creates emotional investment that purely mechanical games can't match.

When your rival sabotages "The Iron Hospital" — a building you named, described, and staffed with carefully chosen agents — it HURTS differently than losing HP on a generic unit. This emotional attachment to game state is extraordinarily rare in competitive multiplayer.

### 2. The Diplomacy Is Physical

Embassies exist as actual buildings in your simulation. Ambassador agents walk the streets of your world. Bleed vectors have visible effects (events appearing in your simulation from another world). Diplomacy isn't an abstract menu — it's buildings and people in your world.

This physicality means diplomatic actions have aesthetic consequences. A simulation with many embassies looks different from an isolationist one. The Cartographer's Map visualizes the diplomatic network as a living graph with connection thickness and node stability.

### 3. No Clear Optimal Strategy

The 5-dimension scoring system with configurable weights means the "best strategy" changes per epoch. A Warmonger-weight epoch rewards aggression. A Builder-weight epoch rewards infrastructure. A Diplomat-weight epoch rewards networking. And within each weight configuration, the interaction between systems creates enough complexity that theoretical optimization is extremely difficult.

In practice, the best strategy will be **reading the other players** — understanding their archetypes, their strengths, their vulnerabilities — and adapting. This is the lesson of Diplomacy applied to a richer mechanical substrate.

### 4. Narrative as Mechanic

The AI generation layer means that game mechanics produce narratives. A successful sabotage doesn't just reduce a number — it generates an event with a story that the target player reads, reacts to, and that might bleed to other simulations. The narrative is mechanically generated but experientially rich.

The Bleed mechanic is the purest expression of this: an event in one simulation becomes a different story in another simulation, filtered through the bleed vector's thematic lens. A "building collapse" in a dystopian simulation becomes a "prophetic vision of falling towers" in a fantasy simulation via the Dream vector. The mechanics create the stories, and the stories create emotional engagement with the mechanics.

### 5. The Embassy Paradox Is Genuinely Novel

The idea that your offensive and diplomatic channels are the same physical infrastructure — and that your enemy can cut both by dissolving their side of the embassy — creates a strategic dilemma I haven't seen in any other competitive game. It's a deeply interconnected design where attack, defense, diplomacy, and intelligence all flow through the same chokepoint (the embassy network).

---

## XIV. What Could Go Wrong — Honest Critique

### 1. Complexity Barrier

The game has 8 interconnected systems, 10 feedback loops, 5 scoring dimensions, 6 operative types, 7 bleed vectors, and ~160 editable parameters. This is a LOT. Even experienced strategy gamers may be overwhelmed.

**Risk:** New players give up before understanding how the systems interact.

**Mitigation needed:** Progressive disclosure (show simple metrics first, reveal formulas on hover/click), guided first epoch with restricted options, extensive tooltip/info bubble system (partially implemented).

**Assessment:** The info bubble system in edit modals is a good start, but the game probably needs an interactive tutorial or a "training epoch" mode where a single player can practice mechanics against AI-controlled simulations.

### 2. Player Count Sensitivity

The game is designed for 4-12 players. With fewer than 4, the diplomatic network is too sparse (only 6 possible connections between 4 simulations, and each player has embassies with at most 3 others). With more than 12, the complexity of tracking all connections, operatives, and bleed cascades becomes unmanageable.

**Risk:** The game might not find exactly 4-12 committed players willing to engage asynchronously for weeks.

**Mitigation needed:** Clear communication of ideal player count. Possibly AI-controlled simulations to fill gaps. Auto-matching for epoch enrollment.

### 3. Asynchronous Engagement Decay

A 14-day epoch requires sustained engagement over two weeks. If a player loses interest after day 3, their simulation degrades (Death Spiral), their team suffers, and the competitive landscape becomes lopsided.

**Risk:** Player attrition during a long epoch makes the experience worse for remaining players.

**Mitigation needed:** Push notifications (implemented), shorter epoch options (minimum 3 days), auto-management for inactive simulations (not yet designed), victory conditions that end the epoch early (not yet designed).

### 4. Balance Is Untested

All the formulas, RP costs, score weights, and feedback loop parameters are **theoretical**. No live competitive play has occurred. The actual meta might be wildly different from the designed one.

**Risk:** One strategy dominates (spy spam, pure turtling, early-rush sabotage), making the game feel solved.

**Mitigation needed:** Rapid iteration capability. The configurable epoch weights help — if military is too strong, the next epoch can reduce Military weight. But core formula changes (success probability, RP costs, condition decay) require code changes.

**Recommendation:** Run at least 5 test epochs with varied configurations before considering the balance "stable." Track metrics per epoch: which dimension had the highest variance? Which operatives were deployed most/least? Was there a dominant strategy?

### 5. Griefer Vulnerability

A player who joins an epoch with no intention of competing can:
- Open embassies with everyone (creating attack surface)
- Then close all embassies (cutting multiple diplomatic connections simultaneously)
- Spam cheap operatives to trigger diplomatic incidents
- Betray their alliance immediately for maximum disruption

**Risk:** A single bad-faith player can significantly disrupt a weeks-long game for everyone.

**Mitigation needed:** Reputation system, epoch creator moderation tools (kick player), minimum investment threshold to join epoch, post-epoch rating/review system.

### 6. The Creative Destruction Problem

When an enemy saboteur degrades your lovingly crafted building from "good" to "ruined," it mechanically works. But it might FEEL terrible. You spent time writing that building's description, choosing its architectural style, assigning its agents. Having it mechanically degraded by a game action might feel like vandalism against your creative work.

**Risk:** Players who are primarily worldbuilders (creative motivation) may resent the competitive layer's ability to "damage" their creations.

**Mitigation needed:** Clear visual/narrative framing — sabotage is "in-world" damage (the building is damaged in the simulation's fiction), not "out-of-world" damage (the building's creative content isn't changed). Repair is always possible (1 RP per step). Perhaps the AI could generate a narrative of the sabotage event that adds to the building's story rather than subtracting from it.

### 7. Snowball Risk in the Bleed System

The Bleed Cascade loop (unstable zone → lower threshold → more bleed → more instability) is the most dangerous feedback loop. In theory, `bleed_strength_decay` dampens it. In practice, if the decay setting is too high (say 0.8), cascades can amplify. If too low (say 0.3), bleed becomes irrelevant.

**Risk:** Bleed cascades either dominate the game (everything is chaos) or are irrelevant (no cross-simulation effects).

**Mitigation needed:** Careful tuning of default `bleed_strength_decay` (currently 0.6), per-epoch override options, automatic circuit breakers (e.g., max N bleed events per simulation per cycle).

---

## XV. Technical Implementation Reality

### What Exists (Implemented)

| Layer | Component | Status | Lines |
|-------|-----------|--------|-------|
| **Database** | 6 competitive tables + 4 materialized views | Applied locally (migrations 031-032) | ~400 SQL |
| **Backend** | 3 routers (epochs, operatives, scores) + game_mechanics | Complete | 663 lines |
| **Backend** | 5 services (epoch, operative, scoring, battle_log, game_mechanics) | Complete | 2018 lines |
| **Backend** | 17 Pydantic models | Complete | ~200 lines |
| **Backend** | 8 public API endpoints | Complete | ~100 lines |
| **Frontend** | 5 epoch components | Complete | 4571 lines |
| **Frontend** | 1 API service (27 methods) | Complete | 203 lines |
| **Frontend** | 12 TypeScript interfaces + 3 union types | Complete | 163 lines |
| **Frontend** | i18n (EN + DE) | Complete | 1322 strings |

### What Doesn't Exist Yet

| Component | Importance | Complexity |
|-----------|------------|------------|
| **Cycle resolver (background task)** | Critical — without this, cycles don't auto-resolve | Medium — needs scheduler (APScheduler or similar) |
| **Real-time notifications for cycle events** | High — players need to know when cycles resolve | Low — existing NotificationCenter + RealtimeService can be extended |
| **Simulation Health Dashboard UI** | Medium — shows materialized view data | Medium — new route + components |
| **Building Readiness badges on existing UI** | Medium — visual indicator on building cards | Low — CSS badge + computed property |
| **Agent Aptitude UI in AgentDetailsPanel** | Medium — shows 6 aptitude scores + operative status | Low — new section in existing component |
| **Draft Phase UI** | High — roster selection during lobby→draft transition | Medium — new component + epoch lifecycle change |
| **Enhanced Cartographer's Map for epochs** | Low — competitive overlay during active epoch | Medium — new data layer + tooltip additions |
| **AI integration (prompt context injection)** | Low (v1 can work without) — computed metrics in AI prompts | Medium — prompt template modifications |
| **Automated balance testing** | Low (deferred to live play) | High — simulation framework needed |

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | FastAPI + Uvicorn | Async Python, Pydantic validation, auto-docs |
| Frontend | Lit 3.3 + Preact Signals | Web Components (framework-agnostic), reactive state |
| Database | Supabase (PostgreSQL + RLS) | Row-level security, real-time subscriptions, storage |
| Auth | Supabase Auth (JWT) | Integrated with RLS, handles user management |

The competitive layer uses **materialized views** (PostgreSQL) for expensive aggregate calculations (building readiness, zone stability, embassy effectiveness, simulation health). These refresh on data changes via triggers, avoiding per-request recomputation.

---

## XVI. Extensibility Roadmap

### Near-Term Extensions (Within Current Architecture)

#### 1. Automated Cycle Resolution
Add an APScheduler background task that triggers cycle resolution automatically based on `cycle_hours`. Currently cycles are manually triggered via API call. This is the single most important missing piece for live play.

#### 2. Spectator Mode Enhancement
The public API already serves leaderboard, battle log, and epoch info. A dedicated spectator UI with live-updating scores (via Supabase Realtime subscriptions) would let non-participants follow an epoch as entertainment.

#### 3. Diplomatic Communication
Secure in-game messaging between simulation owners. Diplomatic proposals (alliance, ceasefire, trade agreements). Negotiation chat tied to embassy connections (you can only message people you have embassies with).

#### 4. Event-Driven Narrative Generation
When an operative succeeds/fails, automatically generate AI narrative for the battle log entry. Currently, battle log entries use template-based narratives. AI generation would make each event unique and thematically appropriate.

#### 5. Post-Epoch Analysis
After an epoch completes, generate a comprehensive report: score progression charts, key moments (highest-impact events, dramatic betrayals), per-player statistics, "highlights reel" of the most interesting battle log entries.

### Medium-Term Extensions (Architectural Additions)

#### 6. Dynamic Bleed Vector Discovery
Currently, the 7 bleed vectors are hardcoded. Allow simulations to discover or CREATE new vectors through gameplay (e.g., "a new vector appeared when two simulations experienced the same crisis simultaneously"). This would make the Bleed system feel more emergent.

#### 7. Tech/Research Trees
Buildings could have upgrade paths that unlock new capabilities. A hospital upgraded to "advanced medical center" might grant agents faster recovery from assassination wounds. A watchtower upgraded to "surveillance center" might increase counter-intelligence range.

#### 8. NPC Simulations
AI-controlled simulations that participate in epochs. They follow predetermined strategic archetypes (builder, aggressor, diplomat) with tunable difficulty. This solves the player count problem and provides practice opponents.

#### 9. Persistent Consequences
Currently, epoch effects reset when an epoch ends. Persistent consequences would carry over: a building sabotaged to "ruined" during an epoch stays ruined afterward. Ambassador assassinations have lasting relationship effects. This would make epochs feel like they matter beyond the score.

#### 10. Economic Trade
Allow simulations to trade agents during epochs (loaning a specialist to an ally in exchange for RP or diplomatic concessions). This adds an economic layer to alliances beyond simple score sharing.

### Long-Term Vision

#### 11. Procedural World Generation
Instead of hand-authored simulations, generate simulation foundations procedurally based on selected themes. This would allow the platform to scale beyond the current 4 hand-crafted worlds.

#### 12. Player-Created Operative Types
Allow epoch creators to define custom operative types with custom costs, durations, and effects. This would make each epoch mechanically unique.

#### 13. Real-Time Crisis Events
During the Reckoning phase, introduce real-time elements: a ticking timer where players must make immediate decisions (evacuate zone, deploy emergency guardians, seal embassy). This breaks the asynchronous mold for the most dramatic moments.

#### 14. Cross-Epoch Narrative
Build a meta-narrative across multiple epochs. The winner of each epoch gains a persistent advantage (title, unique building, narrative influence). The lore of the multiverse evolves based on competitive outcomes.

---

## XVII. Open Questions for Designers

These are unresolved design questions where external feedback would be most valuable:

### 1. Optimal Cycle Length

The default is 8 hours (3 cycles/day). Is this right? Shorter cycles (2-4 hours) create more decision points but require more frequent check-ins. Longer cycles (12-24 hours) create a more relaxed pace but less strategic depth per epoch (fewer total cycles = fewer decisions).

**Question:** What's the sweet spot for "enough decision points to be interesting" vs. "not so frequent that it's a chore"?

### 2. Should Guardian Deployment Have a Downside?

Currently, guardians are pure upside (RP cost aside). They deploy instantly, last permanently, and have no domestic penalty (they deploy to your OWN simulation). Should they have a cost beyond RP? Options:
- Guardians reduce bleed OUTPUT from their zone (trade security for influence)
- Guardians require a specific profession (not any agent)
- Guardians have a per-cycle maintenance cost

### 3. Sovereignty vs. Influence Tension

Sovereignty (resisting foreign bleed) and Influence (projecting bleed outward) are partially opposed but not fully. A player can have high Sovereignty (low incoming echoes) AND high Influence (high outgoing echoes) by simply having strong embassies and stable zones.

**Question:** Should there be a harder trade-off? For example: the more bleed you PROJECT, the more permeable your own simulation becomes to incoming bleed (a "the louder you shout, the more you can be heard" mechanic).

### 4. What Happens to Losing Players?

In a 14-day epoch, a player who falls behind by day 3 faces 11 more days of losing. There's no elimination (by design — you always have stability/sovereignty to pursue), but the FEELING of losing for 11 days straight is poor game design.

**Question:** What catch-up mechanics, if any, should exist beyond the Reckoning phase? Options:
- Underdog bonus (trailing players get +X RP per cycle)
- Desperation mechanics (unstable simulations gain access to powerful but risky actions)
- Dynamic scoring (dimensions re-weight based on current standings)

### 5. Creative Protection

How much should the competitive layer be allowed to "damage" a player's creative work? Currently, sabotage degrades building condition (mechanical only — the creative description, name, and images are unchanged). Propaganda generates foreign events in your simulation.

**Question:** Is mechanical damage to creative entities acceptable? Should there be a "creative immunity" mode where buildings can't be degraded but the player accepts a score penalty? Or is the creative-competitive tension a FEATURE that should be preserved?

### 6. Epoch Variety

With configurable weights and settings, epochs can vary significantly. But should there be more structural variety? Options:
- **Asymmetric epochs** — each player gets a different secret objective worth bonus points
- **Limited resource epochs** — reduced RP, forcing prioritization
- **Fog of war epochs** — no public leaderboard until completion
- **Race epochs** — first to reach a score threshold wins (no fixed duration)

### 7. Solo Engagement

Between epochs, the PvE layer runs but has no competitive stakes. Players maintain their simulations for creative satisfaction and to prepare for the next epoch. Is this enough?

**Question:** Should there be solo objectives (achievements, challenges, milestones) that reward maintenance play independently of competitive seasons?

---

## Appendix A: Complete Formula Reference

### Building Readiness
```
readiness = staffing_ratio × qualification_match × condition_factor

staffing_ratio = assigned_agents / population_capacity
qualification_match = avg(matching_professions.qualification_level) / required_level
  (unqualified agents: 0.3× weight)
condition_factor = { good: 1.0, moderate: 0.75, poor: 0.5, ruined: 0.2 }
```

### Zone Stability
```
stability = (infrastructure × 0.5) + (security × 0.3) - (event_pressure × 0.2)

infrastructure = weighted_avg(building_readiness) by criticality
  { critical: 2.0, important: 1.5, standard: 1.0, luxury: 0.5 }
security = taxonomy_map(security_level)
  { fortress: 1.0, maximum: 1.0, high: 0.85, guarded: 0.7, moderate: 0.55, low: 0.4, contested: 0.3, lawless: 0.2 }
event_pressure = min(1.0, count(impact ≥ 6 events in 30d) / 10)
```

### Embassy Effectiveness
```
effectiveness = building_health × 0.4 + ambassador_quality × 0.4 + vector_alignment × 0.2

building_health = avg(both_embassy_buildings.readiness)
ambassador_quality = f(diplomatic_profession, character_depth, relationships)
vector_alignment = embassy.bleed_vector in connection.bleed_vectors ? 1 : 0
```

### Bleed Permeability
```
permeability = (bleed_enabled ? 1 : 0)
  × avg(connection.strength)
  × (1 - avg_zone_stability × 0.3)
  × diplomatic_reach_factor

echo_probability = base × source_perm × target_perm × connection_strength
strength_decay = bleed_strength_decay ^ depth
```

### Agent Aptitudes
```
Each agent: 6 aptitude scores (apt_spy, apt_guardian, apt_saboteur,
  apt_propagandist, apt_infiltrator, apt_assassin)

Per-aptitude range: [3, 9]
Total budget: sum(all_6_aptitudes) = 36
Average per aptitude: 6.0

Operative success uses: aptitude matching deployed operative type
  e.g., spy mission uses apt_spy, saboteur mission uses apt_saboteur
```

### Operative Success
```
P(success) = clamp(0.05, 0.95,
  0.55
  + aptitude × 0.03
  - zone_security × 0.05
  - min(0.15, guardians × 0.06)
  + embassy_effectiveness × 0.15
)
```

### Scoring Dimensions
```
stability = avg(zone_stability) × 100                    [0-100]
influence = sum(completed_outbound_echo_strength)         [0-∞]
sovereignty = 100 × (1 - inbound_echo_impact / total_event_impact)  [0-100]
diplomatic = (sum(embassy_effectiveness × 10) + spy_bonus) × (1 + 0.15 × alliance_count) × (1 - betrayal_penalty) [0-∞]
military = sum(success_values) - sum(detection_penalties)  [-∞ to +∞]
  spy_success: +2, saboteur: +5, propagandist: +5, assassin: +8, infiltrator: +6
  any_detection: -3

composite = weighted_sum(normalized(dim_i) × weight_i)
  where normalized(dim) = dim / max(dim across all participants) × 100
```

---

## Appendix B: File Inventory

### Competitive Layer Files

**Backend (2681 lines total):**
```
backend/routers/epochs.py          (268)  Epoch CRUD + lifecycle
backend/routers/operatives.py      (145)  Deploy/recall/list
backend/routers/scores.py           (79)  Leaderboard/history
backend/routers/game_mechanics.py  (171)  Health/readiness/stability
backend/services/epoch_service.py  (172)  CRUD: list, get, create, update
backend/services/epoch_lifecycle_service.py (243) Lifecycle: start, advance, cancel
backend/services/epoch_participation_service.py (447) Join, leave, draft, bots, teams
backend/services/cycle_resolution_service.py (389) Full cycle resolution + bot execution
backend/services/operative_service.py (142) Operative CRUD: list, get, recall
backend/services/operative_mission_service.py (1089) Deploy, resolve, effects, probability
backend/services/constants.py (111) Shared constants: RP costs, security, operative metadata
backend/services/scoring_service.py (389)  5-dimension scoring
backend/services/battle_log_service.py (259) Event narratives
backend/services/game_mechanics_service.py (310) Materialized view queries
```

**Frontend (4774 lines total):**
```
frontend/src/components/epoch/EpochCommandCenter.ts  (1288)
frontend/src/components/epoch/EpochCreationWizard.ts (1141)
frontend/src/components/epoch/DeployOperativeModal.ts (1469)
frontend/src/components/epoch/EpochLeaderboard.ts     (411)
frontend/src/components/epoch/EpochBattleLog.ts       (262)
frontend/src/services/api/EpochsApiService.ts         (203)
```

**Database (migrations 031-032):**
```
supabase/migrations/20260228500000_031_game_mechanics_materialized_views.sql
supabase/migrations/20260228600000_032_competitive_layer.sql
```

**Types:**
```
frontend/src/types/index.ts  (lines 792-953: competitive types)
backend/models/epoch.py      (Pydantic models)
```

### Pre-Existing Systems Referenced

```
backend/services/echo_service.py        Bleed mechanic
backend/services/embassy_service.py     Embassy CRUD + ambassador logic
backend/services/relationship_service.py Agent relationship graph
backend/routers/connections.py          Simulation connection topology
frontend/src/components/multiverse/     Cartographer's Map (5 files)
frontend/src/components/buildings/      Embassy UI (EmbassyCreateModal, EmbassyLink)
```

---

*This document is intended as a comprehensive reference for game designers evaluating the metaverse.center competitive system. It reflects the designed and implemented state as of 2026-03-03. All formulas and mechanics are subject to tuning based on live playtesting data.*
