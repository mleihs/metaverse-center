---
title: "The Deluge — Full Archetype Design"
version: "1.0"
date: "2026-04-01"
type: design
status: ready-for-implementation
lang: en
tags: [dungeon, archetype, deluge, game-design, flood, water, rising-water, inverted-dungeon]
---

# The Deluge — Full Archetype Design

> **Perspectives:** Senior Web Application Architect (FastAPI + Supabase + Lit), Senior Game Designer / MUD Specialist, UX Designer, Literary Researcher
>
> **Literary Research:** See `docs/research/deluge-literary-research.md` (19 authors + 4 philosophical sources)
>
> **Resonance Signature:** `elemental_surge`
> **German Title:** "Die Steigende Flut"
> **Tagline EN:** "The world reminds its inhabitants that they are guests, not owners."
> **Tagline DE:** "Die Welt erinnert ihre Bewohner, dass sie Gäste sind, nicht Eigentümer."

---

## 1. Literary Foundation (Summary)

**Primary DNA:** Ballard (regression), Bachelard (water dissolves distinctions), Woolf (tidal rhythm), McCarthy (terminal compression), Sebald (slow erosion), Tarkovsky (Zone-beauty), Conrad (pragmatic seamanship), Coleridge (water as covenant), Carson (deep-time precision), Herzog (dissolution of order), Le Guin (Taoist acceptance), von Trier (approaching inevitable).

**Deep cuts:** Lispector (prose as water), Ransmayr (dissolving reality), Abe Kōbō (accepting the engulfing), Ogawa (memory dissolves into river), Stifter (gentle law / catastrophic patience), Matt Elliott (The Kursk — cold intimate report), Mandel (survival is insufficient — triage as meaning).

**Mythological:** Gilgamesh (divine regret), Ovid/Deucalion (categorical dissolution), Noah (covenant), Manu (save the small), Nüwa (sky broke — structural failure above).

**Philosophical engine:** Bachelard's material imagination — water dissolves distinctions. Not horror (Shadow), not dread (Tower), not resignation (Entropy), not dependence (Mother), not creation-vertigo (Prometheus). The Deluge is **elemental urgency + subaquatic awe**.

**Tone:** The water rises. The water is beautiful. The water does not care. The mathematics of the waterline is the dungeon's clock.

**Prose style:** Tidal rhythm. Precision over metaphor. Compression with water level. The dungeon described as filling, carrying, revealing. Banter that pulses — short/long/short — like waves.

---

## 2. Core Mechanic: RISING WATER (Inverted Ascent)

### 2.1 Design Philosophy

The Deluge inverts the standard dungeon pattern. All other archetypes proceed deeper (deeper = harder). The Deluge's party **starts at the bottom and ascends**. The lowest floors have the best loot — but they flood first. Every room the party spends exploring is a room that may be underwater when they try to return.

The `water_level` counter (0→100) tracks how much of the dungeon is submerged. Unlike Entropy's decay (which counts up monotonically), the Deluge's water level follows a **tidal pattern**: it surges, partially recedes, then surges higher. This creates windows of opportunity — the party can time their exploration to tidal recessions.

**4-Perspective validation:**
- **Architect:** Reuses the accumulation-counter pattern (like Entropy's 0→100) with the tidal-pulse twist handled in `apply_drain`. No new infrastructure.
- **Game Designer:** The inverted dungeon + tidal pulse creates a unique risk/reward loop: go deeper for better loot, but risk getting caught. Strategic depth exceeds all other archetypes' resource management.
- **UX:** Water level is the most intuitive timer possible. The gauge fills blue. Rooms below the waterline grey out on the map. Zero explanation needed.
- **Research:** Matches Carson (tidal pulse), Stifter (gentle law), Ballard (loot in the deep), Conrad (pragmatic timing).

### 2.2 Mechanic Config (Python dict)

```python
"The Deluge": {
    "signature": "elemental_surge",
    "title_en": "Die Steigende Flut",
    "title_de": "Die Steigende Flut",
    "tagline_en": "The world reminds its inhabitants that they are guests, not owners.",
    "tagline_de": "Die Welt erinnert ihre Bewohner, dass sie Gäste sind, nicht Eigentümer.",
    "prose_style": (
        "Tidal rhythm. Precision over metaphor. The dungeon described as "
        "filling, carrying, revealing. Water-as-actor. Banter pulses "
        "short/long/short like waves. Grammar compresses as water rises."
    ),
    "mechanic": "rising_water",
    "mechanic_config": {
        "start_water_level": 0,
        "max_water_level": 100,
        # ── Tidal surge (per room entry, by depth) ──
        # Water rises faster in deeper sections (already partially flooded).
        # The INVERTED direction means depth 1 = top floor, depth N = bottom.
        # But water_level represents global flood, not party position.
        "surge_depth_1_2": 5,       # early: slow rise
        "surge_depth_3_4": 8,       # mid: accelerating
        "surge_depth_5_plus": 12,   # deep: fast — the flood remembers
        # ── Tidal recession ──
        # Every 3rd room entry, the water recedes slightly (tidal pulse).
        # This creates exploration windows the party can learn to exploit.
        "recession_interval": 3,    # every 3rd room
        "recession_amount": 8,      # partial pullback
        # ── Event-driven water changes ──
        "surge_per_combat_round": 3,     # combat delays = water rises
        "surge_on_failed_check": 5,      # failed skill check = breach
        "surge_per_enemy_hit": 2,        # each hit = disrupted seals
        # ── Water reduction ──
        "reduce_on_combat_win": 0,       # victory doesn't push water back
        "reduce_on_rest": 5,             # rest = temporary pumping
        "reduce_on_treasure": 0,         # salvage doesn't affect level
        "reduce_on_seal_action": 10,     # Guardian "Seal Breach" ability
        # ── Thresholds ──
        "ankle_threshold": 25,           # water at ankle height
        "waist_threshold": 50,           # water at waist — movement penalty
        "chest_threshold": 75,           # water at chest — critical
        "submerged_threshold": 100,      # fully submerged — wipe
        # ── Threshold effects ──
        # Below waist: skill checks in flooded rooms cost +10% stress
        # Above waist: movement between rooms costs 1 condition step
        # Above chest: only 2 rooms visible on map, ambush chance doubles
        "flooded_room_stress_penalty": 0.10,
        "deep_water_condition_cost": True,
        "critical_vision_radius": 2,
        # ── Stress multipliers ──
        "stress_multiplier_50": 1.15,    # waist-deep: slight increase
        "stress_multiplier_75": 1.40,    # chest-deep: significant
        "submerged_stress_multiplier": 2.0,  # submerged: panic
        # ── Ambush modification ──
        "high_water_ambush_50": 0.15,    # things approach from underwater
        "high_water_ambush_75": 0.35,    # the water conceals everything
        # ── Loot mechanics ──
        # Rooms below current water_level have submerged loot:
        # retrievable but requires skill check (Guardian/Spy aptitude)
        "submerged_loot_check_aptitude": "guardian",
        "submerged_loot_check_bonus": 10,
        # Low water bonus: if party keeps water below 25, loot quality +50%
        "low_water_loot_bonus_threshold": 25,
        "low_water_loot_bonus_chance": 0.50,
        # ── Tidal memory ──
        # Each tidal recession is smaller than the last
        "recession_decay_per_cycle": 2,  # recession shrinks by 2 each cycle
    },
    "aptitude_weights": {
        "guardian": 30,       # critical: sealing breaches, physical endurance
        "spy": 25,            # high: reading the tides, navigating flooded rooms
        "saboteur": 15,       # medium: building barriers, redirecting flow
        "assassin": 12,       # medium: speed through flooded corridors
        "propagandist": 10,   # lower: morale in rising water
        "infiltrator": 8,     # lower: precision work underwater is difficult
    },
    "atmosphere_enter_en": "",
    "atmosphere_enter_de": "",
}
```

### 2.3 Accumulation Rules

| Event | Water Level Delta | Notes |
|---|---|---|
| Room entry (depth 1–2) | +5 | Slow early rise (Stifter's gentle law) |
| Room entry (depth 3–4) | +8 | Accelerating |
| Room entry (depth 5+) | +12 | Fast — the flood has momentum |
| Every 3rd room entry | −8 (recession) | Tidal pulse — exploitable window |
| Per combat round | +3 | Delay = drowning |
| Failed skill check | +5 | Breach in containment |
| Enemy hit on agent | +2 | Physical disruption of seals |
| Rest room | −5 | Temporary pumping |
| Guardian "Seal Breach" | −10 | Active water management |
| Recession decay | −2 per cycle | Each recession is smaller |

**Net water gain per 3-room cycle (depth 1–2):** 5+5+5−8 = **+7**
**Net water gain per 3-room cycle (depth 3–4):** 8+8+8−8 = **+16**
**Net water gain per 3-room cycle (depth 5+):** 12+12+12−8 = **+28**

At difficulty 1 (4 floors, ~12 rooms), expected water at completion: ~28–40 (manageable **with active Seal Breach use**; ~55–60 without).
At difficulty 3 (5 floors, ~15 rooms), expected water at completion: ~55–70 (challenging; requires tidal timing + Seal Breach).
At difficulty 5 (7 floors, ~21 rooms), expected water at completion: ~80–95 (critical; recession effectively 0 after cycle 4).

**Note:** Estimates assume 3–4 Seal Breach uses per run. Without active Guardian management, water level reaches ~20 higher. This is intentional: the Deluge rewards Guardian investment more than any other archetype.

### 2.4 Threshold Effects

| Water Level | Name | Effects |
|---|---|---|
| 0–24 | **Dry** | Normal operation. Low-water loot bonus active (+50% quality). The water is a fact, not yet a threat. |
| 25–49 | **Shallow** | Flooded rooms cost +10% ambient stress. Splash sounds in movement. Water carries first debris. |
| 50–74 | **Rising** | Movement in flooded rooms costs 1 condition step. Ambush chance +15%. Stress multiplier 1.15×. Some abilities restricted (deploy trap, fortify). Map reveals less. |
| 75–99 | **Critical** | Only 2 rooms visible on map. Ambush chance +35%. Stress multiplier 1.40×. All flooded rooms require skill check to enter. Combat in water: evasion halved. |
| 100 | **Submerged** | Wipe equivalent. The dungeon is fully flooded. All agents lost (same as incorporation/dissolution in other archetypes). |

### 2.5 Unique Twists

**Tidal Pulse:** Unlike all other archetypes (monotonic drain or accumulation), the Deluge has a tidal rhythm. Every 3rd room entry, the water recedes by 8 (minus 2 per cycle). This creates strategic windows: the party can time risky exploration to coincide with recession. But each recession is smaller — the tide always wins eventually.

**Inverted Loot Gradient:** Lower floors (the first rooms the party enters, before ascending) have better loot — but they flood first. The party must decide: explore the deep rooms quickly for Tier 2/3 loot, or ascend immediately for safety. This creates a risk/reward tension unique to The Deluge.

**Salvage Mechanic:** Rooms that are below the current water level are "submerged" — their loot is still there but requires a Guardian/Spy skill check to retrieve. Failed salvage = +5 water level. The party can return to submerged rooms, but at a cost.

**The Current Carries:** Every 2nd room entry, the water deposits a random debris item (minor buff or consumable) in the current room. The flood is not only a threat — it is a delivery mechanism (Bachelard's Charon Complex). This prevents the Deluge from feeling purely punitive.

### 2.6 Archetype-Specific Ability: "Seal Breach" (Guardian)

| Field | Value |
|---|---|
| Name EN | Seal Breach |
| Name DE | Bresche abdichten |
| School | Guardian |
| Min Aptitude | 40 |
| Target | Self (party-level effect) |
| Effect | −10 water level, +15 stress to caster |
| Cooldown | Once per 3 rooms |

**Design rationale:** Parallels the Shadow's "Observe" (spy), the Tower's "Reinforce" (guardian), and the Entropy's "Preserve" (guardian). Gives the party active water management but at a stress cost — sealing breaches is exhausting work.

### 2.7 Boss Pre-Combat: Barrier Construction

Before the boss fight with "The Current," the party has a deployment phase (using `get_boss_deployment_choices`):

**Choice 1: "Construct Barrier" (Saboteur check)**
- Success: Party gains "Barricade" buff — 50% damage reduction for 3 rounds
- Partial: "Fragile Barricade" — 25% reduction for 2 rounds
- Fail: No barrier, +15 water level

**Choice 2: "Read the Current" (Spy check)**
- Success: Party learns boss's attack pattern — first 2 rounds, enemies have telegraphed_intent = True
- Partial: First round only
- Fail: No intel, +10 stress

**Choice 3: "Brace for Impact" (Guardian check)**
- Success: All agents gain +1 condition threshold for the fight
- Partial: 2 agents gain the bonus
- Fail: +20 stress, no bonus

---

## 3. Enemies

### 3.1 Enemy Templates

#### Riptide Tendril (Minion)

```python
"deluge_riptide_tendril": EnemyTemplate(
    id="deluge_riptide_tendril",
    name_en="Riptide Tendril",
    name_de="Sogranke",
    archetype="The Deluge",
    condition_threshold=1,
    stress_resistance=20,
    threat_level="minion",
    attack_aptitude="assassin",
    attack_power=2,
    stress_attack_power=3,
    telegraphed_intent=True,
    evasion=40,
    resistances=["infiltrator"],
    vulnerabilities=["guardian"],
    action_weights={"attack": 40, "drag": 30, "evade": 20, "ambient": 10},
    special_abilities=["drag"],
    description_en=(
        "A current given form. It does not strike \u2013 it pulls. "
        "The direction is always down, always toward deeper water."
    ),
    description_de=(
        "Eine Strömung, die Form angenommen hat. Sie schlägt nicht zu \u2013 "
        "sie zieht. Die Richtung ist immer abwärts, immer in tieferes Wasser."
    ),
    ambient_text_en=[
        "The tendril tests the space between {agent}'s feet and the floor.",
        "Something in the current reaches. Not aggressively \u2013 patiently.",
    ],
    ambient_text_de=[
        "Die Ranke prüft den Raum zwischen {agent}s Füßen und dem Boden.",
        "Etwas in der Strömung greift. Nicht aggressiv \u2013 geduldig.",
    ],
)
```

#### Pressure Surge (Standard)

```python
"deluge_pressure_surge": EnemyTemplate(
    id="deluge_pressure_surge",
    name_en="Pressure Surge",
    name_de="Druckwelle",
    archetype="The Deluge",
    condition_threshold=2,
    stress_resistance=100,
    threat_level="standard",
    attack_aptitude="guardian",
    attack_power=4,
    stress_attack_power=5,
    telegraphed_intent=True,
    evasion=10,
    resistances=["assassin"],
    vulnerabilities=["saboteur", "spy"],
    action_weights={"attack": 45, "flood_pulse": 30, "stress_attack": 15, "ambient": 10},
    special_abilities=["flood_pulse"],
    description_en=(
        "The water's memory of what it once displaced. It arrives as a wall \u2013 "
        "not tall, not dramatic, but dense. The kind of force that moves "
        "furniture and doesn't notice."
    ),
    description_de=(
        "Die Erinnerung des Wassers an das, was es einst verdrängte. Es kommt "
        "als Wand \u2013 nicht hoch, nicht dramatisch, aber dicht. Die Art Kraft, "
        "die Möbel verschiebt und es nicht bemerkt."
    ),
    ambient_text_en=[
        "The water level in the room rises 2cm. Then 2cm more. Then stops.",
        "The pressure surge gathers. {agent} feels it in the floor before seeing it.",
    ],
    ambient_text_de=[
        "Der Pegel im Raum steigt um 2cm. Dann nochmal 2cm. Dann hört es auf.",
        "{agent} spürt die Druckwelle im Boden, bevor sie sichtbar wird.",
    ],
)
```

#### Silt Revenant (Standard)

```python
"deluge_silt_revenant": EnemyTemplate(
    id="deluge_silt_revenant",
    name_en="Silt Revenant",
    name_de="Schlickwiedergänger",
    archetype="The Deluge",
    condition_threshold=3,
    stress_resistance=60,
    threat_level="standard",
    attack_aptitude="propagandist",
    attack_power=3,
    stress_attack_power=6,
    telegraphed_intent=True,
    evasion=15,
    resistances=["spy"],
    vulnerabilities=["propagandist", "guardian"],
    action_weights={"stress_attack": 40, "obscure": 30, "attack": 20, "ambient": 10},
    special_abilities=["obscure"],
    description_en=(
        "It emerged from the sediment when the water reached this level. "
        "A shape made of what the flood deposited \u2013 silt, mineral, "
        "the residue of dissolved rooms. It does not speak. "
        "It broadcasts the sound of water in enclosed spaces."
    ),
    description_de=(
        "Es stieg aus dem Sediment, als das Wasser diesen Pegel erreichte. "
        "Eine Gestalt aus dem, was die Flut ablagerte \u2013 Schlick, Mineral, "
        "der Rückstand aufgelöster Räume. Es spricht nicht. "
        "Es sendet das Geräusch von Wasser in geschlossenen Räumen."
    ),
    ambient_text_en=[
        "The revenant shifts. Silt falls from it like memory from a dream.",
        "{agent} recognizes something in the revenant's shape. A doorframe. A railing.",
    ],
    ambient_text_de=[
        "Der Wiedergänger bewegt sich. Schlick fällt von ihm wie Erinnerung aus einem Traum.",
        "{agent} erkennt etwas in der Form des Wiedergängers. Einen Türrahmen. Ein Geländer.",
    ],
)
```

#### Undertow Warden (Elite)

```python
"deluge_undertow_warden": EnemyTemplate(
    id="deluge_undertow_warden",
    name_en="Undertow Warden",
    name_de="Sogwächter",
    archetype="The Deluge",
    condition_threshold=4,
    stress_resistance=200,
    threat_level="elite",
    attack_aptitude="guardian",
    attack_power=5,
    stress_attack_power=6,
    telegraphed_intent=True,
    evasion=5,
    resistances=["assassin", "infiltrator"],
    vulnerabilities=["saboteur"],
    action_weights={"attack": 35, "drag": 25, "flood_pulse": 20, "stress_attack": 10, "ambient": 10},
    special_abilities=["drag", "flood_pulse"],
    description_en=(
        "The water's enforcer. Not an entity that lives in water \u2013 "
        "an entity that IS water, given mass and purpose. "
        "It does not guard a door. It guards a depth."
    ),
    description_de=(
        "Der Vollstrecker des Wassers. Keine Entität, die im Wasser lebt \u2013 "
        "eine Entität, die Wasser IST, mit Masse und Absicht versehen. "
        "Es bewacht keine Tür. Es bewacht eine Tiefe."
    ),
    ambient_text_en=[
        "The warden does not approach. The water level in the room rises to meet it.",
        "Its shape changes with the current. {agent} cannot determine where it begins.",
    ],
    ambient_text_de=[
        "Der Wächter nähert sich nicht. Der Pegel im Raum steigt, um ihm entgegenzukommen.",
        "Seine Form ändert sich mit der Strömung. {agent} kann nicht bestimmen, wo er beginnt.",
    ],
)
```

#### The Current (Boss)

```python
"deluge_the_current": EnemyTemplate(
    id="deluge_the_current",
    name_en="The Current",
    name_de="Die Strömung",
    archetype="The Deluge",
    condition_threshold=6,
    stress_resistance=350,
    threat_level="boss",
    attack_aptitude="guardian",
    attack_power=6,
    stress_attack_power=8,
    telegraphed_intent=False,
    evasion=0,
    resistances=["assassin", "infiltrator", "spy"],
    vulnerabilities=["saboteur", "guardian"],
    action_weights={"attack": 30, "flood_pulse": 25, "drag": 20, "tidal_wave": 15, "ambient": 10},
    special_abilities=["flood_pulse", "drag", "tidal_wave"],
    description_en=(
        "Not an enemy. A direction. The Current is the flood's final argument: "
        "that everything flows downward, that every barrier is temporary, "
        "that what the water claims, the water keeps. "
        "It does not attack. It arrives."
    ),
    description_de=(
        "Kein Feind. Eine Richtung. Die Strömung ist das letzte Argument der Flut: "
        "dass alles abwärts fließt, dass jede Barriere vorübergehend ist, "
        "dass was das Wasser beansprucht, das Wasser behält. "
        "Sie greift nicht an. Sie kommt."
    ),
    ambient_text_en=[
        "The Current fills the room. Not like water entering \u2013 like water remembering it was always here.",
        "The walls are underwater. The ceiling is not. For now.",
    ],
    ambient_text_de=[
        "Die Strömung füllt den Raum. Nicht wie einströmendes Wasser \u2013 wie Wasser, das sich erinnert, schon immer hier gewesen zu sein.",
        "Die Wände sind unter Wasser. Die Decke nicht. Noch nicht.",
    ],
)
```

### 3.2 Special Abilities

| Ability | Effect | Thematic Source |
|---|---|---|
| **drag** | Force target 1 room "deeper" (toward flooded rooms) on next movement. Evadable with Spy check. | Herzog's river pulling the expedition downstream |
| **flood_pulse** | +5 water level. Not damage — environmental. The enemy IS the flood. | Woolf's wave-beat: each pulse brings the water higher |
| **obscure** | Reduces party visibility for 2 rounds (fog/mist from water). Same as ambush conditions. | Tarkovsky's Zone: water hides what's beneath |
| **tidal_wave** (Boss only) | AoE: all agents take stress damage + 1 condition step. +8 water level. Once per 3 rounds. | Gilgamesh: "The storm was pounding, the flood was a war" |

### 3.3 Spawn Configurations

```python
DELUGE_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "deluge_trickle_spawn": [
        {"template_id": "deluge_riptide_tendril", "count": 2},
    ],
    "deluge_surge_patrol_spawn": [
        {"template_id": "deluge_pressure_surge", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_sediment_spawn": [
        {"template_id": "deluge_silt_revenant", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_deep_water_spawn": [
        {"template_id": "deluge_pressure_surge", "count": 1},
        {"template_id": "deluge_silt_revenant", "count": 1},
    ],
    "deluge_warden_spawn": [
        {"template_id": "deluge_undertow_warden", "count": 1},
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
    "deluge_rest_ambush_spawn": [
        {"template_id": "deluge_riptide_tendril", "count": 1},
    ],
}
```

---

## 4. Encounters

### 4.1 Combat Encounters (6)

| ID | Depth | Spawn | Description |
|---|---|---|---|
| `dc_trickle_probe` | 1–3 | `deluge_trickle_spawn` | First currents testing the party's resolve. |
| `dc_surge_corridor` | 2–4 | `deluge_surge_patrol_spawn` | A corridor where the water moves with purpose. |
| `dc_sediment_ambush` | 2–5 | `deluge_sediment_spawn` | The silt remembers shapes. Some of them fight back. |
| `dc_deep_water_clash` | 3–6 | `deluge_deep_water_spawn` | Waist-deep. Every step costs something. |
| `dc_warden_chamber` | 4–7 | `deluge_warden_spawn` | The water has posted a guard at this depth. |
| `dc_whirlpool_room` | 3–5 | `deluge_deep_water_spawn` | The current circles. The party is in the center. |

### 4.2 Narrative Encounters (5)

#### "The Watermark" (depth 1–3)
> *"A line on the wall. Faint. Mineral-white. The watermark shows how high the water reached last time."*

- **Choice A: "Study the watermark" (Spy check)** — Success: learn tidal pattern (+1 recession next cycle). Partial: general sense of timing. Fail: wasted time, +3 water.
- **Choice B: "Seal below the mark" (Guardian check)** — Success: −8 water level. Partial: −4. Fail: breach, +5 water.
- **Choice C: "Ignore it and move"** — No effect. Fastest option.

#### "The Submerged Cache" (depth 2–4)
> *"Through the water below — shapes. Containers. Something the flood deposited here from a room that no longer exists."*

- **Choice A: "Dive for it" (Guardian check)** — Success: Tier 2 loot. Partial: Tier 1 loot + 10 stress. Fail: 20 stress + 1 condition step.
- **Choice B: "Send the sharpest eyes" (Spy check)** — Success: identify best container (Tier 2 guaranteed). Partial: random Tier 1. Fail: nothing found.
- **Choice C: "Leave it. The water owns it now."** — +0 water, slight stress reduction (−5). The Taoist choice.

#### "The Breach" (depth 2–5)
> *"A crack in the wall. Water doesn't pour through it — it persuades. A thin, persistent line of moisture that widens as you watch."*

- **Choice A: "Seal it" (Saboteur check)** — Success: −10 water. Partial: −5. Fail: the breach widens, +8 water.
- **Choice B: "Redirect it" (Spy check)** — Success: water flows into an adjacent corridor (no longer threatens this path). Partial: partial redirect. Fail: +5 water.
- **Choice C: "Use it" (Assassin check)** — Success: weaponize the breach (next combat: enemies take 1 condition step from water). Partial: minor splash damage. Fail: +10 water.

#### "The Survivors' Message" (depth 3–5)
> *"Carved into the wall above the current waterline. Recent. Someone else tried this. The message is incomplete — the water reached it before they finished."*

- **Choice A: "Read what remains" (Propagandist check)** — Success: party gains intel (map reveals 2 extra rooms + their types). Partial: 1 room revealed. Fail: the message is unsettling, +15 stress.
- **Choice B: "Add to it" (Spy check)** — Success: carve your own observations (permanent: future parties in this simulation gain +5 to first skill check). Partial: minor note. Fail: wasted time, +3 water.

#### "The Sound of Depth" (depth 3–6)
> *"The water below has reached a resonance. A low hum. Not mechanical — geological. The sound the planet makes when it remembers it is mostly ocean."*

- **Choice A: "Listen" (Propagandist check)** — Success: the resonance reveals the boss's weakness (boss fight: first attack auto-crits). Partial: vague sense of the boss. Fail: the sound is disorienting, +10 stress.
- **Choice B: "Measure it" (Spy check)** — Success: precise water-rise calculation (party knows exact rooms until submerged threshold). Partial: approximate. Fail: instruments damaged.
- **Choice C: "Block it out"** — No effect but no risk.

### 4.3 Elite Encounter (1)

#### "Tidal Gate" (depth 4–6)
> *"A mechanism. Ancient. Not built by anyone in this simulation. The gate controls a section of the flood — open it and the water surges through, closed it holds. But the mechanism requires a sacrifice."*

- **Combat:** `deluge_warden_spawn` (the mechanism is guarded)
- **Post-combat choice:** Open the gate (−20 water in current section, +15 water elsewhere) or leave it (no change)

### 4.4 Boss Encounter (1)

#### "The Current" (final room)
> *"The water has found its shape. It fills the room from below, from the walls, from the ceiling. The Current is not something IN the water. The Current IS the water, organized into purpose."*

- **Pre-combat deployment:** See §2.7 (Barrier Construction, Read the Current, or Brace for Impact)
- **Combat:** `deluge_the_current` (boss) — fight while water level rises +3/round
- **Victory condition:** Reduce The Current to 0 condition OR survive 8 rounds (the storm passes)
- **Unique mechanic:** Every 3rd round, tidal_wave (AoE + water level surge). Party must time defensive abilities.

### 4.5 Rest Encounters (2)

#### "Dry Shelf" (any depth)
> *"A ledge. Above the current waterline. Dry, for now. The mathematical certainty of the rising water makes this rest temporary, but temporary is enough."*

- Standard rest healing (40 stress)
- Water level −5 (pumping)
- 15% ambush chance: `deluge_rest_ambush_spawn`

#### "The Air Pocket" (depth 3+)
> *"A pocket of trapped air in a partially flooded section. The ceiling is close. The water is at chest height. But the air is breathable and the current is still."*

- Reduced rest healing (25 stress) — not comfortable
- Water level −3
- No ambush — too small for enemies to reach
- But: +5 stress from claustrophobia

### 4.6 Treasure Encounters (2)

#### "Flotsam Cache"
> *"The current deposited this. From where? From a room that is no longer above the waterline. The objects are waterlogged but intact."*

- Standard Tier 1 loot roll
- Flavor: the loot's description references its origin room

#### "The Preserved Chamber"
> *"Someone sealed this room. The seal held — until now. Inside, everything is dry. The dust on the surfaces has not been disturbed by water. A time capsule from before the flood."*

- Tier 2 loot guaranteed
- The room's description is distinctly dry (contrast with the rest of the dungeon)
- Opening it: +3 water level (the seal is now broken; the room will flood on next tidal surge)

---

## 5. Banter System

### 5.1 Room Entry (by water level)

| ID | Water Level | Trigger | Text EN | Text DE |
|---|---|---|---|---|
| `db_01` | 0–24 | `room_entered` | "The floor is damp. Not wet \u2013 damp. The kind of moisture that precedes a statement." | "Der Boden ist feucht. Nicht nass \u2013 feucht. Die Art Feuchtigkeit, die einer Aussage vorausgeht." |
| `db_02` | 0–24 | `room_entered` | "Water at 12cm. Clear. The room is legible through it. That will change." | "Wasser bei 12cm. Klar. Der Raum ist hindurch lesbar. Das wird sich ändern." |
| `db_03` | 25–49 | `room_entered` | "12cm now. The sound of movement has changed \u2013 each action announces itself." | "12cm jetzt. Das Geräusch der Bewegung hat sich verändert \u2013 jede Aktion kündigt sich an." |
| `db_04` | 25–49 | `room_entered` | "The waterline on the wall is 7cm higher than when the party entered this floor. The arithmetic is not complicated." | "Die Wasserlinie an der Wand ist 7cm höher als beim Betreten dieser Etage. Die Arithmetik ist nicht kompliziert." |
| `db_05` | 50–74 | `room_entered` | "Half-submerged. The water is cold and has opinions about which direction the party should move." | "Halb überflutet. Das Wasser ist kalt und hat Meinungen darüber, in welche Richtung sich die Gruppe bewegen sollte." |
| `db_06` | 50–74 | `room_entered` | "The current carries debris from rooms below. Fragments of encounters that are now depths." | "Die Strömung trägt Trümmer aus Räumen darunter. Fragmente von Begegnungen, die jetzt Tiefen sind." |
| `db_07` | 75–99 | `room_entered` | "The surface is close. {agent} keeps the instruments above the waterline. Everything below is concession." | "Die Oberfläche ist nah. {agent} hält die Instrumente über der Wasserlinie. Alles darunter ist Zugeständnis." |
| `db_08` | 75–99 | `room_entered` | "Three rooms above the waterline. Two hours ago there were five. The mathematics has not changed, only the denominator." | "Drei Räume über der Wasserlinie. Vor zwei Stunden waren es fünf. Die Mathematik hat sich nicht geändert, nur der Nenner." |

### 5.2 Combat

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_09` | `combat_start` | "The water shifts. Something in the current organizes itself into opposition." | "Das Wasser verlagert sich. Etwas in der Strömung ordnet sich zum Widerstand." |
| `db_10` | `combat_start` | "Combat in water. Every action costs twice \u2013 once for the act, once for the medium." | "Kampf im Wasser. Jede Aktion kostet doppelt \u2013 einmal für die Tat, einmal für das Medium." |
| `db_11` | `combat_victory` | "The current relents. Not defeated \u2013 redirected. It will find another path." | "Die Strömung gibt nach. Nicht besiegt \u2013 umgelenkt. Sie wird einen anderen Weg finden." |
| `db_12` | `combat_victory` | "Quiet. The water level drops 2cm. The flood acknowledges the party's right to this room. Temporarily." | "Stille. Der Pegel sinkt um 2cm. Die Flut erkennt das Recht der Gruppe auf diesen Raum an. Vorübergehend." |

### 5.3 Discovery / Treasure

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_13` | `loot_found` | "The current brought this. From below. From a room that is no longer a room \u2013 it is a depth." | "Die Strömung brachte dies. Von unten. Aus einem Raum, der kein Raum mehr ist \u2013 er ist eine Tiefe." |
| `db_14` | `loot_found` | "Salvaged. The water will want it back." | "Geborgen. Das Wasser wird es zurückverlangen." |

### 5.4 Rest

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_15` | `rest_start` | "Dry. The word has become a luxury. {agent} remains above the waterline and measures the silence." | "Trocken. Das Wort ist zum Luxus geworden. {agent} verharrt über der Wasserlinie und misst die Stille." |
| `db_16` | `rest_start` | "For a moment the water level stabilizes. Not recedes \u2013 stabilizes. In the Deluge, that is rest." | "Für einen Moment stabilisiert sich der Pegel. Sinkt nicht \u2013 stabilisiert sich. In der Flut ist das Ruhe." |

### 5.5 Tidal Events

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_17` | `tidal_recession` | "The water pulls back. 8cm. A breath. Not generosity \u2013 mechanics. The tide returns." | "Das Wasser zieht sich zurück. 8cm. Ein Atemzug. Keine Großzügigkeit \u2013 Mechanik. Die Flut kommt wieder." |
| `db_18` | `tidal_recession` | "Recession. The watermarks on the wall tell two stories: how high the water was, and how high it will be." | "Rückgang. Die Wasserzeichen an der Wand erzählen zwei Geschichten: wie hoch das Wasser war und wie hoch es sein wird." |
| `db_19` | `tidal_surge` | "The tide returns. Higher. It always returns higher." | "Die Flut kehrt zurück. Höher. Sie kehrt immer höher zurück." |

### 5.6 Threshold Triggers

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_20` | `ankle_threshold` | "The water has reached the third step. It does not rush. It has been doing this for longer than the stairwell has existed." | "Das Wasser hat die dritte Stufe erreicht. Es eilt nicht. Es tut dies seit länger als das Treppenhaus existiert." |
| `db_21` | `waist_threshold` | "Half-submerged. The operational vocabulary contracts. Salvage. Seal. Ascend." | "Halb überflutet. Das operative Vokabular schrumpft. Bergen. Abdichten. Aufsteigen." |
| `db_22` | `chest_threshold` | "»Der Pegel steigt. Nicht schnell. Er hat Zeit. Er hatte immer Zeit.«" | "»Der Pegel steigt. Nicht schnell. Er hat Zeit. Er hatte immer Zeit.«" |
| `db_23` | `flood_imminent` | "Cold. Rising. {agent} adjusts. There is nothing else to adjust." | "Kalt. Steigend. {agent} passt sich an. Es gibt nichts anderes anzupassen." |

### 5.7 Retreat

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_24` | `retreat` | "The party ascends. Behind them, the water fills what they leave. No sound of pursuit \u2013 only the sound of level." | "Die Gruppe steigt auf. Hinter ihnen füllt das Wasser, was sie verlassen. Kein Geräusch der Verfolgung \u2013 nur das Geräusch des Pegels." |

### 5.8 Submerged Room

| ID | Trigger | Text EN | Text DE |
|---|---|---|---|
| `db_25` | `submerged_room_entered` | "The submerged corridor is beautiful. {agent} was not prepared for that." | "Der überflutete Korridor ist schön. {agent} war darauf nicht vorbereitet." |
| `db_26` | `submerged_room_entered` | "Under the surface, the room has reorganized itself. What was ceiling is now a mirror. What was door is now a passage to somewhere the map does not name." | "Unter der Oberfläche hat sich der Raum neu geordnet. Was Decke war, ist jetzt ein Spiegel. Was Tür war, ist jetzt ein Durchgang zu etwas, das die Karte nicht benennt." |

---

## 6. Loot

### 6.1 Tier 1 (Minor)

| ID | Name EN / DE | Effect | Description EN | Weight |
|---|---|---|---|---|
| `deluge_brine_residue` | Brine Residue / Salzrückstand | `stress_heal` (50, after_dungeon) | "Crystallized from evaporated floodwater. Holding it steadies the pulse. A mineral memory of when the water was calm." | 30 |
| `deluge_tide_reading` | Tide Reading / Gezeitenablesung | `memory` (importance 4) | "Learned to read the intervals between surges. Not prediction \u2013 recognition." | 25 |
| `deluge_seal_fragment` | Seal Fragment / Dichtungsfragment | `dungeon_buff` (check_bonus 5, guardian) | "A piece of whatever held the water back before the party arrived. Guardian checks +5%." | 25 |
| `deluge_current_map` | Current Map / Strömungskarte | `dungeon_buff` (check_bonus 5, spy) | "A trace of the water's preferred paths. Spy checks +5%." | 20 |

### 6.2 Tier 2 (Major)

| ID | Name EN / DE | Effect | Description EN | Weight |
|---|---|---|---|---|
| `deluge_pressure_ward` | Pressure Ward / Druckschutz | `stress_heal` (120, after_dungeon) | "Equalized pressure from a sealed chamber. The relief is physical \u2013 the tension in the chest that was always there, gone." | 30 |
| `deluge_salvage_record` | Salvage Record / Bergungsprotokoll | `memory` (importance 7) | "A complete record of what the flood carried and where it deposited. Understanding the flood's logic changes the agent's relationship to loss." | 25 |
| `deluge_flood_barrier_shard` | Flood Barrier Shard / Flutsperrensplitter | `dungeon_buff` (stress_damage_bonus 0.5, saboteur) | "A fragment of the barrier that held for 200 years. Applied to sabotage, the particle physics of resistance." | 25 |
| `deluge_tidal_insight` | Tidal Insight / Gezeiteneinsicht | `dungeon_buff` (check_bonus 10, spy) | "The tide's pattern, internalized. Spy checks +10%." | 20 |

### 6.3 Tier 3 (Legendary)

| ID | Name EN / DE | Effect | Description EN | Weight |
|---|---|---|---|---|
| `deluge_covenant_fragment` | Covenant Fragment / Bundesfragment | `permanent_aptitude` (+1 guardian) | "A fragment of the promise the water made: to recede, eventually. Carrying it changes how {agent} relates to protection. Guardian aptitude +1." | 40 |
| `deluge_deep_time_core` | Deep-Time Core / Tiefzeitkern | `permanent_aptitude` (+1 spy) | "Compressed sediment from the lowest floor. It contains the memory of every room the water passed through. Perception sharpened. Spy aptitude +1." | 35 |
| `deluge_elemental_warding` | Elemental Warding / Elementarschutz | special: `building_protection` | "One building in the simulation becomes immune to condition degradation below 'moderate' for 10 heartbeat ticks. The flood's inverse: preservation." | 25 |

---

## 7. Strategy Implementation

### 7.1 DelugeStrategy Class

```python
class DelugeStrategy(ArchetypeStrategy):
    """The Deluge: Rising water mechanic (0→100, tidal pulse, inverted dungeon).

    Water rises on room entry (depth-scaled), surges in combat, partially
    recedes every 3rd room (tidal rhythm). Unlike monotonic archetypes,
    the Deluge oscillates — creating strategic exploration windows.

    Unique hooks:
        on_combat_round  — water rises during combat (urgency)
        on_failed_check  — breach: failed checks accelerate flooding
        on_enemy_hit     — structural disruption per hit
        get_boss_deployment_choices — barrier construction before boss
    """

    def init_state(self) -> dict:
        return {
            "water_level": self.mechanic_config["start_water_level"],
            "max_water_level": self.mechanic_config["max_water_level"],
            "rooms_entered": 0,      # for tidal recession tracking
            "recession_cycle": 0,    # how many recessions have occurred
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        state = instance.archetype_state
        state["rooms_entered"] = state.get("rooms_entered", 0) + 1

        # Tidal recession check (every Nth room)
        interval = self.mechanic_config["recession_interval"]
        if state["rooms_entered"] % interval == 0:
            cycle = state.get("recession_cycle", 0)
            decay = self.mechanic_config["recession_decay_per_cycle"]
            recession = max(0, self.mechanic_config["recession_amount"] - (cycle * decay))
            state["water_level"] = max(0, state.get("water_level", 0) - recession)
            state["recession_cycle"] = cycle + 1

        # Room entry surge
        self._apply_room_entry_surge(instance)

        # Threshold check
        water = state.get("water_level", 0)
        if water >= self.mechanic_config["submerged_threshold"]:
            return "submerged"
        if water >= self.mechanic_config["chest_threshold"]:
            return "flood_imminent"
        if water >= self.mechanic_config["waist_threshold"]:
            return "waist_threshold"
        if water >= self.mechanic_config["ankle_threshold"]:
            return "ankle_threshold"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["water_level"] = max(
                0,
                instance.archetype_state.get("water_level", 0)
                - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        water_delta = effects.get("water_level", 0)
        if water_delta:
            instance.archetype_state["water_level"] = max(
                0,
                min(
                    self.mechanic_config["max_water_level"],
                    instance.archetype_state.get("water_level", 0) + water_delta,
                ),
            )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        water = instance.archetype_state.get("water_level", 0)
        if water >= self.mechanic_config["submerged_threshold"]:
            return self.mechanic_config.get("submerged_stress_multiplier", 2.0)
        if water >= self.mechanic_config["chest_threshold"]:
            return self.mechanic_config.get("stress_multiplier_75", 1.40)
        if water >= self.mechanic_config["waist_threshold"]:
            return self.mechanic_config.get("stress_multiplier_50", 1.15)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0)
            + self.mechanic_config["surge_per_enemy_hit"],
        )

    def get_boss_deployment_choices(self, instance: DungeonInstance) -> list[dict] | None:
        """3 deployment choices before The Current boss fight.

        See §2.7: Barrier Construction, Read the Current, Brace for Impact.
        Implementation: return list of dicts with id, description_en/de,
        check_aptitude, effects for success/partial/fail.
        """
        water = instance.archetype_state.get("water_level", 0)
        return [
            {
                "id": "construct_barrier",
                "description_en": "Construct a barrier against the current.",
                "description_de": "Eine Barriere gegen die Strömung errichten.",
                "check_aptitude": "saboteur",
                "effects_success": {"buff": "barricade", "duration": 3},
                "effects_partial": {"buff": "fragile_barricade", "duration": 2},
                "effects_fail": {"water_level": 15},
            },
            {
                "id": "read_the_current",
                "description_en": "Study the current's pattern.",
                "description_de": "Das Muster der Strömung studieren.",
                "check_aptitude": "spy",
                "effects_success": {"reveal_intent": 2},
                "effects_partial": {"reveal_intent": 1},
                "effects_fail": {"stress": 10},
            },
            {
                "id": "brace_for_impact",
                "description_en": "Brace the party for what comes.",
                "description_de": "Die Gruppe auf das Kommende vorbereiten.",
                "check_aptitude": "guardian",
                "effects_success": {"condition_bonus": 1, "targets": "all"},
                "effects_partial": {"condition_bonus": 1, "targets": 2},
                "effects_fail": {"stress": 20},
            },
        ]

    def _apply_room_entry_surge(self, instance: DungeonInstance) -> None:
        depth = instance.depth
        if depth <= 2:
            surge = self.mechanic_config["surge_depth_1_2"]
        elif depth <= 4:
            surge = self.mechanic_config["surge_depth_3_4"]
        else:
            surge = self.mechanic_config["surge_depth_5_plus"]
        instance.archetype_state["water_level"] = min(
            self.mechanic_config["max_water_level"],
            instance.archetype_state.get("water_level", 0) + surge,
        )
```

### 7.2 Registry Entry

```python
_ARCHETYPE_STRATEGIES["The Deluge"] = DelugeStrategy(ARCHETYPE_CONFIGS["The Deluge"])
```

---

## 8. Frontend Integration

### 8.1 Water Level Gauge

A vertical gauge (like the existing stability/attachment gauges) but with a **blue fill from bottom to top**. Four distinct color stages:

| Range | Color | Label |
|---|---|---|
| 0–24 | `var(--color-info)` / blue-dim | DRY |
| 25–49 | `var(--color-info-bright)` | SHALLOW |
| 50–74 | `var(--color-warning)` | RISING |
| 75–99 | `var(--color-danger)` | CRITICAL |
| 100 | `var(--color-danger)` + pulse | SUBMERGED |

### 8.2 Map Visualization

- Rooms below the waterline: blue-tinted overlay with wave animation (`@keyframes water-ripple`)
- Rooms at current water level: partially blue (gradient from bottom)
- Tidal recession: brief "drain" animation when water level drops
- Boss room: pulsing blue glow (existing boss-pulse pattern, re-colored)

### 8.3 Protocol Briefing

```
╔══════════════════════════════════════════════╗
║  DELUGE PROTOCOL                             ║
║                                              ║
║  The water is rising.                        ║
║                                              ║
║  Lower floors contain better salvage.        ║
║  Lower floors flood first.                   ║
║  The tide recedes — briefly — every 3 rooms. ║
║  Each recession is smaller than the last.    ║
║                                              ║
║  Monitor the gauge. Read the waterline.      ║
║  At 100: submersion. Total loss.             ║
║                                              ║
║  »Was die Flut bringt, gehört der Flut.      ║
║   Was die Flut nimmt, gehörte ihr schon      ║
║   immer.«                                    ║
╚══════════════════════════════════════════════╝
```

### 8.4 Terminal Formatters

- `formatWaterLevel(level: number)` → "Water: 47/100 [RISING]"
- `formatTidalStatus(roomsEntered: number, interval: number)` → "Tide: 2/3 (recession in 1 room)"
- Room entry includes water depth in cm (calculated from water_level percentage)

---

## 9. Objektanker Integration

### 9.1 Wandernde Dinge (8 objects)

| Object | Phase 1: Discovery | Phase 2: Echo | Phase 3: Mutation | Phase 4: Climax |
|---|---|---|---|---|
| **watermark** | A line. Mineral-white. Evidence. | {agent} checks the watermark. It's higher. | The watermark moves while the party watches. | Both watermarks converge at the ceiling. |
| **seal** | A seal. Intact. Holding something back. | The seal shows hairline cracks. {agent} examines. | The seal is wet on the inside. | The seal dissolves. What it held is here. |
| **raft** | A piece of a raft. Someone planned. | The raft fragment floats in the current. Familiar. | The raft has been repaired. By the water. | The raft is whole. It was always whole. |
| **compass** | A compass. The needle points down. | {agent} consults the compass. It still points down. | The compass needle has rusted to its position. | The compass is underwater. The needle is still. |
| **bottle** | A sealed bottle. Air inside. | The bottle has drifted to the other side of the room. | The seal is degrading. Bubbles escape. | The bottle is empty. The air is in the water now. |
| **depth_gauge** | A gauge. Calibrated for a depth this room hasn't reached. Yet. | The gauge reads higher. {agent} didn't touch it. | The gauge is calibrated for THIS room now. | The gauge reads exactly 100. It was always going to. |
| **photograph** | A photograph. Water-damaged. A room that looks like this one, dry. | The photograph shows more water than before. {agent} looks closer. | The photograph and the room are the same image. | The photograph IS the room. The room is the photograph, submerged. |
| **stone** | A stone. Smooth. River-polished over centuries. | {agent} feels the stone's weight differently. Heavier. | The stone is wet even above the waterline. | The stone sinks through the floor. The floor is water. |

### 9.2 Resonanz-Barometer

**"Der Pegel" (The Level)** — 4 tiers, displays only on tier change:

| Tier | Water Level | Text DE | Text EN |
|---|---|---|---|
| 1 | 0–24 | "Der Pegel schweigt." | "The level is silent." |
| 2 | 25–49 | "Der Pegel spricht." | "The level speaks." |
| 3 | 50–74 | "Der Pegel besteht." | "The level insists." |
| 4 | 75–99 | "Der Pegel hat Recht." | "The level is correct." |

---

## 10. Balance Considerations

### 10.1 Difficulty Scaling

| Difficulty | Floors | Expected Rooms | Expected Final Water | Risk Assessment |
|---|---|---|---|---|
| 1 | 4 | ~12 | 28–40 | Comfortable. Party has margin. |
| 2 | 5 | ~15 | 40–55 | Moderate. Triage begins. |
| 3 | 5 | ~15 | 55–70 | Challenging. Flooded-room checks matter. |
| 4 | 6 | ~18 | 65–85 | Hard. Boss fight near chest threshold. |
| 5 | 7 | ~21 | 80–95 | Extreme. Submerged rooms are the norm. |

### 10.2 Comparison to Other Archetypes

| Metric | Shadow | Tower | Entropy | Mother | Prometheus | **Deluge** |
|---|---|---|---|---|---|---|
| Counter direction | drain down | drain down | accumulate up | accumulate up | accumulate up | **accumulate up + tidal pulse** |
| Wipe condition | N/A (no wipe) | N/A | dissolution (100) | incorporation (100) | N/A | **submersion (100)** |
| Active management | Observe (spy) | Reinforce (guard) | Preserve (guard) | Sever (guard) | Craft (sab) | **Seal Breach (guard)** |
| Combat interaction | ambush at VP 0 | drain per round | decay per round + hit | attachment per hit | insight per round | **water per round + hit** |
| Unique twist | fog of war | structural failure mode | contagious decay | inverted healing | pharmakon items | **tidal recession windows** |
| Loot gradient | standard | stability bonus | decay degrades loot | acceptance costs attachment | crafting produces loot | **inverted: deep = better, floods first** |

### 10.3 Known Design Risks

1. **Tidal recession could be too exploitable.** If the party learns the 3-room rhythm perfectly, they can time all risky exploration to recession windows. **Mitigation:** recession_decay_per_cycle ensures each recession is smaller. After 4 cycles, recession is 0.

2. **Rising water + combat rounds = double pressure.** A long combat (8+ rounds) adds +24 water on top of room entry surge. **Mitigation:** Combat victory doesn't reduce water (unlike rest). This is intentional: the Deluge punishes slow combat more than any other archetype. Parties should prioritize fast resolution or retreat.

3. **Inverted loot gradient creates FOMO.** Players may feel forced to explore deep rooms first, creating anxiety. **Mitigation:** "The Current Carries" mechanic deposits debris items every 2nd room, ensuring the party gets some loot even if they ascend immediately. Tier 1 loot is accessible at all depths.

4. **Guardian dominance.** Guardian aptitude is heavily weighted (Seal Breach, salvage checks, barrier construction). **Mitigation:** Spy aptitude is weighted 25 (second highest) and is critical for tide-reading, navigation, and several encounter choices. The optimal party is Guardian + Spy focused, not Guardian-only.

---

## 11. Implementation Reference (File Paths + Registry Patterns)

### 11.1 File Map

| Step | File | What to do | Registry variable |
|---|---|---|---|
| 1 | `backend/services/dungeon/dungeon_archetypes.py` | Replace empty `mechanic_config: {}` stub (line ~175) with full config dict from §2.2 | `ARCHETYPE_CONFIGS["The Deluge"]` |
| 2 | `backend/services/dungeon/archetype_strategies.py` | Add `DelugeStrategy` class (from §7.1) after last strategy class | Register in `_ARCHETYPE_STRATEGIES` dict at file bottom |
| 3 | `backend/services/dungeon/dungeon_combat.py` | Add `DELUGE_ENEMIES` dict (5 templates) + `DELUGE_SPAWN_CONFIGS` dict (6 configs) | Register in `_ENEMY_REGISTRIES["The Deluge"]` AND `_SPAWN_REGISTRIES["The Deluge"]` at file bottom (~line 1202+) |
| 4 | `backend/services/dungeon/dungeon_encounters.py` | Add `DELUGE_COMBAT_ENCOUNTERS`, `DELUGE_NARRATIVE_ENCOUNTERS`, `DELUGE_ELITE_ENCOUNTERS`, `DELUGE_BOSS_ENCOUNTERS`, `DELUGE_REST_ENCOUNTERS`, `DELUGE_TREASURE_ENCOUNTERS` lists + `ALL_DELUGE_ENCOUNTERS` combined list | Register in `_ENCOUNTER_REGISTRIES["The Deluge"]` at file bottom |
| 5 | `backend/services/dungeon/dungeon_banter.py` | Add `DELUGE_BANTER` list (26 dicts) | Register in `_BANTER_REGISTRIES["The Deluge"]` at file bottom |
| 6 | `backend/services/dungeon/dungeon_loot.py` | Add `DELUGE_LOOT_TIER_1` (4 items), `DELUGE_LOOT_TIER_2` (4), `DELUGE_LOOT_TIER_3` (3) + `DELUGE_LOOT_TABLES` dict | Register in `_LOOT_REGISTRIES["The Deluge"]` (if exists) or use `DELUGE_LOOT_TABLES` pattern |
| 7 | `backend/services/dungeon/dungeon_objektanker.py` | Add 8 entries to `ANCHOR_OBJECTS["The Deluge"]` + 4 entries to `BAROMETER_TEXTS["The Deluge"]` | Follow existing archetype patterns |
| 8 | `frontend/src/types/dungeon.ts` | Add `DelugeArchetypeState` interface (`water_level`, `max_water_level`, `rooms_entered`, `recession_cycle`) | — |
| 9 | `frontend/src/utils/dungeon-formatters.ts` | Add `formatWaterLevel()`, `formatTidalStatus()` | — |

### 11.2 Model Structures (for reference)

**EnemyTemplate** fields (from `backend/models/resonance_dungeon.py:563`):
```
id, name_en, name_de, archetype, condition_threshold, stress_resistance,
threat_level ("minion"|"standard"|"elite"|"boss"), attack_aptitude,
attack_power, stress_attack_power, telegraphed_intent, evasion,
resistances: list[str], vulnerabilities: list[str],
action_weights: dict[str, int], special_abilities: list[str],
description_en, description_de, ambient_text_en: list[str], ambient_text_de: list[str]
```

**LootItem** fields (from `backend/models/resonance_dungeon.py:588`):
```
id, name_en, name_de, tier (1|2|3),
effect_type ("stress_heal"|"memory"|"dungeon_buff"|"permanent_aptitude"),
effect_params: dict, description_en, description_de, drop_weight: int
```

**EncounterTemplate** fields (from `backend/models/resonance_dungeon.py:545`):
```
id, archetype, room_type, min_depth, max_depth, min_difficulty,
description_en, description_de,
combat_encounter_id (for combat/elite/boss),
choices: list[EncounterChoice] (for narrative/rest/treasure)
```

**EncounterChoice** fields (from `backend/models/resonance_dungeon.py:524`):
```
id, label_en, label_de, check_aptitude (optional),
effects_success: dict, effects_partial: dict, effects_fail: dict
```

**Banter dict** structure:
```python
{
    "id": "db_01",
    "trigger": "room_entered",  # room_entered|combat_start|combat_victory|rest_start|loot_found|retreat|...
    "personality_filter": {"openness": (0.6, 1.0)},  # optional
    "text_en": "...",
    "text_de": "...",
}
```

**Objektanker** structure:
```python
ANCHOR_OBJECTS["The Deluge"] = [
    {
        "id": "deluge_watermark",
        "name_en": "The Watermark", "name_de": "Das Wasserzeichen",
        "phases": {
            "discovery": {"en": "...", "de": "..."},
            "echo": {"en": "...", "de": "..."},      # {agent} placeholder only here
            "mutation": {"en": "...", "de": "..."},
            "climax": {"en": "...", "de": "..."},
        },
    },
    # ... 7 more
]
BAROMETER_TEXTS["The Deluge"] = {
    "object_name_en": "The Level", "object_name_de": "Der Pegel",
    "tiers": [
        {"threshold": 25, "text_en": "...", "text_de": "..."},
        # ... 3 more
    ],
}
```

### 11.3 Implementation Order (dependency chain)

1. **Config** (`dungeon_archetypes.py`) — no dependencies, do first
2. **Strategy** (`archetype_strategies.py`) — depends on config
3. **Enemies + Spawns** (`dungeon_combat.py`) — independent of strategy
4. **Encounters** (`dungeon_encounters.py`) — references spawn config IDs
5. **Banter** (`dungeon_banter.py`) — independent
6. **Loot** (`dungeon_loot.py`) — independent
7. **Objektanker** (`dungeon_objektanker.py`) — independent
8. **Frontend types + formatters** — after backend is working
9. **Frontend gauge + map overlay** — after types
10. **Tests** — after all backend code

### 11.4 Known Implementation Notes

- **`building_protection` effect_type** (Tier 3 Elemental Warding): New effect type not yet in codebase. Must implement in loot application logic or use an existing type with creative `effect_params`. Check how Prometheus's "Innovation Blueprint" handles multi-choice Tier 3 effects.
- **Tidal recession in `apply_drain`**: The recession check MUST happen BEFORE the surge. Otherwise the net effect per recession room is wrong (surge then recede vs recede then surge). The strategy code in §7.1 has this correct.
- **`reduce_on_seal_action`**: The Guardian "Seal Breach" ability isn't in the standard `apply_restore` event map. It needs a custom code path in the engine — either a new event type or handled via `apply_encounter_effects` with a special effects dict. Check how Tower's "Reinforce" and Shadow's "Observe" are routed.
- **Body-specific vocabulary**: ALL banter was audited for body-part references. Threshold names in config remain "ankle/waist/chest" (internal), but ALL user-facing text uses environmental descriptions (Shallow/Rising/Critical). See triplecheck audit.
- **Tagline DE**: The existing stub has "Gaeste" (missing ä). The design doc corrects to "Gäste sind, nicht Eigentümer."
- **`formatWaterLevel` gauge label**: Uses RISING not WAIST (triplecheck fix). Update if referencing old label.

## 12. Implementation Checklist

- [ ] Update `dungeon_archetypes.py`: replace stub with full config dict (§2.2)
- [ ] Create `DelugeStrategy` class in `archetype_strategies.py` + register (§7.1)
- [ ] Add 5 enemy templates + 6 spawn configs to `dungeon_combat.py` + register (§3)
- [ ] Add 16 encounter templates to `dungeon_encounters.py` + register (§4)
- [ ] Add 26 banter lines to `dungeon_banter.py` + register (§5)
- [ ] Add 10 loot items (4+4+3 tiers) to `dungeon_loot.py` + register (§6)
- [ ] Add 8 anchor objects + 1 barometer to `dungeon_objektanker.py` (§9)
- [ ] Investigate `building_protection` effect_type or find alternative (§11.4)
- [ ] Route "Seal Breach" ability through engine (check Reinforce/Observe pattern)
- [ ] Frontend: `DelugeArchetypeState` type + water level gauge + map water overlay (§8)
- [ ] Frontend: protocol briefing + terminal formatters (§8.3, §8.4)
- [ ] Tests: strategy unit tests, enemy/encounter validation, banter coverage
- [ ] German text quality review (umlauts, en-dashes, Guillemets, Kafka-register)
- [ ] Content lint: `lint-color-tokens.sh`, `lint-llm-content.sh`
- [ ] Fix tagline in existing stub: "Gaeste" → "Gäste"
