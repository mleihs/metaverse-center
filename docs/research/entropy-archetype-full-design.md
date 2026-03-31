---
title: "The Entropy — Full Archetype Design Document"
version: "1.0"
date: "2026-03-31"
type: research
status: implemented
lang: en
tags: [dungeon, archetype, entropy, design-document]
---

# The Entropy — Resonance Dungeon Design Document

## 1. Literary Foundation

### 1.1 Primary Influences

**Thomas Pynchon -- "Entropy" (1960) and The Crying of Lot 49 (1966)**

Pynchon's short story "Entropy" is the ur-text. Two simultaneous stories: upstairs, a lease-breaking party that has been going on for forty hours and is winding down without anyone deciding to end it; downstairs, a man watches his hermetically sealed environment slowly reach thermal equilibrium. The key insight is that entropy is not dramatic -- it is the absence of drama. Things do not explode; they equalize. The party does not end; it simply stops being a party. The crucial technical concept: a system moving toward maximum entropy has maximum disorder at the micro level but maximum predictability at the macro level. Everything becomes the same temperature. All differences dissolve.

For the dungeon: the environment is not hostile in the traditional sense. It is indifferent. It is *winding down*. Rooms were once distinct; they are becoming the same room. Enemies were once threatening; they are becoming residual patterns of former threat.

**Samuel Beckett -- Endgame (1957) and Waiting for Godot (1953)**

Beckett's contribution is tonal, not structural. His characters exist in a world where things have already happened. The catastrophe is behind them. What remains is the afterimage: dialogue that shrinks, hope that evaporates not through betrayal but through simple thermodynamic inevitability. "Something is taking its course." The humor -- and there must be humor -- comes from the absurdity of continuing to observe formalities as the world reduces.

For the dungeon: as `decay` rises, banter compresses. Early rooms produce full sentences. Mid-rooms produce fragments. Late rooms produce single words or silences. Agent quotes grow shorter not because something is attacking language but because there is less language left to use.

**Stanislaw Lem -- Solaris (1961)**

Lem's contribution is epistemological. Solaris is about an intelligence so alien that human categories of understanding dissolve on contact. The scientists' instruments work, but what they measure becomes meaningless. This is entropy of understanding -- not noise replacing signal, but the distinction between noise and signal becoming incoherent.

For the dungeon: skill checks in The Entropy degrade. Not because agents become weaker, but because the criteria for success erode. A spy observes a corridor, but the corridor is 70% the same as the last corridor. What does "observation" mean when distinctiveness itself is decaying?

### 1.2 Tone and Style

**Minimalism. Futility. Things winding down.** Not horror. Not even dread. Existential resignation with dry humor.

The Shadow uses *absence as presence* (the darkness is intentional). The Tower uses *architecture as debt* (the building keeps a ledger). The Entropy uses *sameness as dissolution* (things do not break; they become indistinguishable).

The emotional register is closer to a scientist's lab notebook written during the heat death of the universe: "Day 4. Measured ambient temperature. Same as yesterday. Same as the day before. Recording this is itself a form of entropy."

### 1.3 Key Vocabulary

**Primary:** decay, erosion, diminish, fade, unravel, dissolve, residual, remnant, vestige

**Secondary:** equalize, homogenize, flatten, blur, converge, dissipate, attenuate, subside, exhaust

**Forbidden (too violent/active):** shatter, explode, collapse (that is the Tower's word), devour (that is the Mother's), flood (the Deluge's)

### 1.4 Writing Technique

Start with a specific observation. End with a generalization that makes the specific irrelevant.

> "The corridor was here yesterday. Today it is mostly here."

Start with agent specificity. End with agent interchangeability.

> "{agent} checks their instruments. The readings are accurate. They are also indistinguishable from the readings in the last room."

### 1.5 S-Tier Reference Sentences

These establish the literary standard. All future Entropy banter must meet this bar:

- "The corridor was here yesterday. Today it is mostly here."
- "There were more of us. I think."
- "{agent} speaks. The words arrive, but they arrive quieter than they left."
- "The instruments read accurately. The accuracy no longer means anything."
- "Nothing happened. This is the most alarming thing so far."
- "The walls are not crumbling. They are *agreeing* with the floor."
- "{agent} stops to rest. The concept of 'stop' requires that something was moving."

### 1.6 Anti-Patterns

- "An ancient evil decays here." -- too Shadow, too active-agent horror
- "The building is falling apart." -- that is The Tower
- "Everything is rotting." -- too biological, too Devouring Mother
- "A terrible silence." -- The Shadow owns silence. Entropy owns *sameness*.
- Body-specific metaphors remain forbidden per existing guidelines.

### 1.7 German Translation Guidelines

**Style reference:** Thomas Bernhard (relentless reduction, sentences that circle the same observation), W.G. Sebald (cataloguing loss with clinical precision).

Key German strengths for Entropy:
- "Angleichung" (equalization) -- stronger than any English equivalent
- "Verblassen" (to fade/pale) -- the visual metaphor is built into the verb
- "Dahinschwindend" (dwindling away) -- compound temporality
- "Restbestand" (remaining stock/residue) -- bureaucratic precision applied to dissolution
- Compound nouns: "Auflösungsgeschwindigkeit" (dissolution velocity), "Gleichförmigkeit" (uniformity/sameness)

---

## 2. Core Mechanic: Decay Counter

### 2.1 Design Philosophy

The Shadow drains *down* (visibility 3 to 0 -- you lose what you had). The Tower drains *down* (stability 100 to 0 -- the structure loses integrity). The Entropy counts *up* (decay 0 to 100 -- dissolution accumulates). This is a deliberate inversion: the threat is not losing something, it is *gaining* something unwanted. Decay is additive, not subtractive. You do not run out of a resource; the resource becomes meaningless.

### 2.2 Mechanic Config

```python
"The Entropy": {
    "signature": "decay_bloom",
    "title_en": "Der Verfall-Garten",
    "title_de": "Der Verfall-Garten",
    "tagline_en": "Decay is not destruction -- it is transformation's dark twin.",
    "tagline_de": "Verfall ist nicht Zerstorung -- er ist der dunkle Zwilling der Verwandlung.",
    "prose_style": "Minimalist. Observational. The dungeon described as losing distinctions. Short sentences that get shorter.",
    "mechanic": "decay_accumulation",
    "mechanic_config": {
        "start_decay": 0,
        "max_decay": 100,
        # Accumulation rates (per room entry, by depth)
        "gain_depth_1_2": 4,
        "gain_depth_3_4": 7,
        "gain_depth_5_plus": 10,
        # Combat accumulation
        "gain_per_combat_round": 2,
        # Failed skill check
        "gain_on_failed_check": 5,
        # Enemy hit = contagious decay (unique twist)
        "gain_per_enemy_hit": 3,
        # Restore (reduction) rates
        "reduce_on_combat_win": 3,
        "reduce_on_treasure": 5,
        "reduce_on_guardian_preserve": 8,
        "reduce_on_rest": 5,
        # Thresholds
        "dissolution_threshold": 100,   # party dissolution (wipe equivalent)
        "critical_threshold": 70,       # degraded abilities, terse banter
        "degraded_threshold": 40,       # first noticeable effects
        # High-decay penalties
        "high_decay_ambush_70": 0.30,   # decay >= 70: 30% ambush
        "high_decay_ambush_85": 0.50,   # decay >= 85: 50% ambush
        # Ability effectiveness reduction at high decay
        "ability_penalty_per_10_decay": 0.02,  # -2% per 10 decay above 40
        # Loot quality degradation
        "loot_downgrade_threshold": 60,  # decay >= 60: 30% chance tier downgrade
        "loot_downgrade_chance": 0.30,
        # Stress multiplier at high decay
        "stress_multiplier_70": 1.25,
        "stress_multiplier_85": 1.50,
        "dissolution_stress_multiplier": 2.0,
    },
    "aptitude_weights": {
        "guardian": 30,   # critical: Preserve ability + tank
        "spy": 20,        # high: observation, pattern recognition
        "saboteur": 20,   # high: redirect decay to enemies
        "propagandist": 15, # medium-high: morale against futility
        "assassin": 8,
        "infiltrator": 7,
    },
    "atmosphere_enter_en": (
        "The air is the same temperature as the walls. The walls are the\n"
        "same color as the floor. The floor is the same texture as the silence.\n\n"
        "Your instruments work. They confirm that everything is becoming\n"
        "everything else. The decay counter reads 0. It will not read 0 again."
    ),
    "atmosphere_enter_de": (
        "Die Luft hat die gleiche Temperatur wie die Wande. Die Wande haben\n"
        "die gleiche Farbe wie der Boden. Der Boden hat die gleiche Textur\n"
        "wie die Stille.\n\n"
        "Eure Instrumente funktionieren. Sie bestatigen, dass alles zu allem\n"
        "anderen wird. Der Verfallszahler zeigt 0. Er wird nicht wieder 0 zeigen."
    ),
}
```

### 2.3 Decay Accumulation Rules

| Event | Decay Gained | Notes |
|-------|-------------|-------|
| Room entry (depth 1-2) | +4 | Base rate |
| Room entry (depth 3-4) | +7 | Mid-game acceleration |
| Room entry (depth 5+) | +10 | Late-game urgency |
| Combat round (each) | +2 | Encourages fast resolution |
| Failed skill check | +5 | Competence degrades with entropy |
| Hit by enemy | +3 per hit | **Contagious decay** -- the unique twist |
| Combat victory | -3 | Small recovery |
| Treasure room | -5 | Moderate recovery |
| Guardian "Preserve" | -8 | Primary decay management tool |
| Rest room | -5 | Standard rest benefit |

### 2.4 Decay Threshold Effects

| Decay Range | Effects |
|-------------|---------|
| 0-39 | Normal operation. Full banter. Crisp descriptions. |
| 40-69 | **Degraded.** Ability checks -2% per 10 decay above 40. Banter shortens. Descriptions lose adjectives. |
| 70-84 | **Critical.** 30% ambush chance. Stress multiplier 1.25x. Loot tier downgrade possible. Banter becomes fragmentary. |
| 85-99 | **Near-dissolution.** 50% ambush chance. Stress multiplier 1.50x. Banter is single words or silences. |
| 100 | **Total dissolution.** Party dissolves. Equivalent to wipe. Partial loot only (Tier 1). |

### 2.5 Contagious Decay (Unique Twist)

Every time an enemy lands a hit on an agent, the *party-level* decay counter increases by 3. This is thematically essential: entropy is contagious. Contact with decaying entities accelerates your own dissolution. This creates a tactical pressure distinct from any other archetype:

- **Shadow:** Being blind (VP 0) is dangerous but you can choose risk/reward.
- **Tower:** Stability drains at a predictable rate tied to depth.
- **Entropy:** Decay rate is *variable* -- bad combat (many hits taken) accelerates decay drastically. A 5-round fight with 3 hits per round adds +30 decay from hits alone (plus +10 from rounds).

This makes Guardian (damage absorption, shielding) and Assassin (fast kills) tactically critical -- minimizing rounds and minimizing hits taken both reduce contagious decay.

### 2.6 Guardian "Preserve" Ability

```python
Ability(
    id="guardian_preserve",
    name_en="Preserve",
    name_de="Bewahren",
    school="guardian",
    description_en="Slow the dissolution. -8 Decay (Entropy archetype only).",
    description_de="Die Auflosung verlangsamen. -8 Verfall (nur Entropie-Archetyp).",
    min_aptitude=3,
    cooldown=2,
    effect_type="utility",
    effect_params={"decay_reduce": 8, "archetype_required": "The Entropy"},
    targets="self",
)
```

This mirrors the pattern of `guardian_reinforce` (Tower: +10 Stability, cooldown 2, archetype_required). Same design: the Guardian's archetype-specific ability is the primary resource management tool.

---

## 3. Enemies

### 3.1 Enemy Design Philosophy

Entropy enemies are not aggressive in the traditional sense. They are *residual*. They are what remains when purpose has decayed. Their threat comes not from malice but from the fact that contact with them accelerates the party's own dissolution. They are the thermodynamic consequence of entering a space where entropy dominates.

### 3.2 Enemy Templates (4 types)

**1. Rust Phantom (Minion)**

| Field | Value |
|-------|-------|
| `id` | `entropy_rust_phantom` |
| `name_en` / `name_de` | Rust Phantom / Rostphantom |
| `condition_threshold` | 1 |
| `stress_resistance` | 30 |
| `threat_level` | minion |
| `attack_aptitude` | infiltrator |
| `attack_power` | 2 |
| `stress_attack_power` | 4 |
| `telegraphed_intent` | True |
| `evasion` | 35 |
| `resistances` | [assassin] |
| `vulnerabilities` | [saboteur] |
| `action_weights` | {stress_attack: 50, evade: 30, corrode: 10, ambient: 10} |
| `special_abilities` | [corrode] |

**Mechanical identity:** Stress damage + evasion. The `corrode` action: instead of attacking, inflicts +5 bonus party decay (on top of normal hit-based decay). Fragile but evasive -- represents the ubiquitous, low-level dissolution that is everywhere.

**Description (en):** "A shape that was something once. Now it is mostly the color of rust and the sound of metal thinning. It does not approach -- it persists."

**Description (de):** "Eine Form, die einst etwas war. Nun ist sie hauptsachlich die Farbe von Rost und das Gerausch von dunner werdendem Metall. Sie nahert sich nicht -- sie verharrt."

**Ambient (en):** ["The phantom flickers. Not like light -- like signal quality.", "You can see through it. You wish you couldn't."]

**Ambient (de):** ["Das Phantom flackert. Nicht wie Licht -- wie Signalqualitat.", "Ihr konnt hindurchsehen. Ihr wunscht, ihr konntet es nicht."]

---

**2. Fade Echo (Minion/Standard)**

| Field | Value |
|-------|-------|
| `id` | `entropy_fade_echo` |
| `name_en` / `name_de` | Fade Echo / Verblassecho |
| `condition_threshold` | 2 |
| `stress_resistance` | 150 |
| `threat_level` | standard |
| `attack_aptitude` | propagandist |
| `attack_power` | 2 |
| `stress_attack_power` | 6 |
| `telegraphed_intent` | True |
| `evasion` | 20 |
| `resistances` | [spy] |
| `vulnerabilities` | [propagandist, guardian] |
| `action_weights` | {stress_attack: 45, diminish: 35, ambient: 20} |
| `special_abilities` | [diminish] |

**Mechanical identity:** Pure stress threat. The `diminish` action: targets one agent and reduces their next skill check by -10% (a temporary debuff). Represents the erosion of competence -- not forgetting, but the *relevance* of knowledge decaying.

**Description (en):** "A sound that is almost a voice. A shape that is almost a figure. It repeats something that was once important. The repetition has worn the meaning away."

**Description (de):** "Ein Klang, der beinahe eine Stimme ist. Eine Gestalt, die beinahe eine Figur ist. Es wiederholt etwas, das einst wichtig war. Die Wiederholung hat die Bedeutung abgetragen."

**Ambient (en):** ["The echo says your name. Approximately.", "{agent}'s shadow and the echo's shape briefly overlap. Neither notices."]

**Ambient (de):** ["Das Echo sagt euren Namen. Ungefahr.", "{agent}s Schatten und die Form des Echos uberlappen sich kurz. Keiner bemerkt es."]

---

**3. Dissolution Swarm (Standard)**

| Field | Value |
|-------|-------|
| `id` | `entropy_dissolution_swarm` |
| `name_en` / `name_de` | Dissolution Swarm / Auflosungsschwarm |
| `condition_threshold` | 3 |
| `stress_resistance` | 50 |
| `threat_level` | standard |
| `attack_aptitude` | saboteur |
| `attack_power` | 4 |
| `stress_attack_power` | 3 |
| `telegraphed_intent` | True |
| `evasion` | 15 |
| `resistances` | [infiltrator] |
| `vulnerabilities` | [spy, assassin] |
| `action_weights` | {attack: 40, scatter: 30, corrode: 20, ambient: 10} |
| `special_abilities` | [scatter, corrode] |

**Mechanical identity:** Condition damage + decay acceleration. The `scatter` ability: when hit, 50% chance to split into 2 additional minion-level instances (each with 1 condition step). This represents entropy's tendency to multiply -- destroying one source of decay creates two smaller ones. `corrode` adds +5 bonus party decay.

**Description (en):** "A cloud of particles that were once a wall, a floor, a ceiling. Now they are nothing in particular, and they move with the purposelessness of dust in a closed room."

**Description (de):** "Eine Wolke aus Partikeln, die einst eine Wand waren, ein Boden, eine Decke. Nun sind sie nichts Bestimmtes, und sie bewegen sich mit der Ziellosigkeit von Staub in einem geschlossenen Raum."

**Ambient (en):** ["The swarm drifts. Not toward you. Not away. Just... redistributing.", "Individual particles detach and reattach. The total mass remains constant."]

**Ambient (de):** ["Der Schwarm treibt. Nicht auf euch zu. Nicht weg. Nur... umverteilend.", "Einzelne Partikel losen sich und heften sich wieder an. Die Gesamtmasse bleibt konstant."]

---

**4. Entropy Warden (Elite)**

| Field | Value |
|-------|-------|
| `id` | `entropy_warden` |
| `name_en` / `name_de` | Entropy Warden / Entropiewachter |
| `condition_threshold` | 5 |
| `stress_resistance` | 300 |
| `threat_level` | elite |
| `attack_aptitude` | guardian |
| `attack_power` | 6 |
| `stress_attack_power` | 4 |
| `telegraphed_intent` | False |
| `evasion` | 10 |
| `resistances` | [propagandist, spy] |
| `vulnerabilities` | [saboteur] |
| `action_weights` | {attack: 30, stress_attack: 20, entropy_pulse: 25, summon_phantoms: 15, ambient: 10} |
| `special_abilities` | [entropy_pulse, summon_phantoms] |

**Mechanical identity:** Multi-threat elite. `entropy_pulse` is an AoE that adds +8 party decay AND +40 stress to all agents. `summon_phantoms` spawns 2 Rust Phantoms. Does not telegraph intents (like Shadow's Paranoia Shade) -- you cannot predict whether the next action is physical or entropic.

The Warden is *not* malicious. It is what remains of whatever once guarded this place. It enforces entropy not because it chooses to, but because its guardianship has decayed into mere pattern repetition. It "protects" by making everything the same.

**Description (en):** "It was a guardian once. The armor remembers. The purpose does not. It stands where it has always stood, performing the motions of protection over nothing. When it notices you, the motions do not change. You have simply become part of what it protects. Or what it dissolves. There is no longer a difference."

**Description (de):** "Es war einst ein Wachter. Die Rustung erinnert sich. Der Zweck nicht. Es steht, wo es immer gestanden hat, und vollzieht die Gesten des Schutzes uber das Nichts. Als es euch bemerkt, andern sich die Gesten nicht. Ihr seid einfach Teil dessen geworden, was es beschutzt. Oder was es auflost. Es gibt keinen Unterschied mehr."

**Ambient (en):** ["The Warden's armor flakes. Each flake contains a memory of structural integrity.", "It swings. Not at you. At the concept of distinction between you and it."]

**Ambient (de):** ["Die Rustung des Wachters blattert. Jede Schuppe enthalt eine Erinnerung an strukturelle Integritat.", "Es schlagt zu. Nicht nach euch. Nach dem Konzept der Unterscheidung zwischen euch und ihm."]

### 3.3 Spawn Configurations

```python
ENTROPY_SPAWN_CONFIGS: dict[str, list[dict]] = {
    "entropy_drift_spawn": [
        {"template_id": "entropy_rust_phantom", "count": 2}
    ],
    "entropy_erosion_patrol_spawn": [
        {"template_id": "entropy_fade_echo", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1}
    ],
    "entropy_swarm_spawn": [
        {"template_id": "entropy_dissolution_swarm", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1}
    ],
    "entropy_dissolution_spawn": [
        {"template_id": "entropy_dissolution_swarm", "count": 2}
    ],
    "entropy_warden_spawn": [
        {"template_id": "entropy_warden", "count": 1},
        {"template_id": "entropy_rust_phantom", "count": 1}
    ],
    "entropy_rest_ambush_spawn": [
        {"template_id": "entropy_rust_phantom", "count": 1}
    ],
}
```

---

## 4. Banter System

### 4.1 Decay-Dependent Banter Degradation

This is the Entropy's most distinctive literary feature. Banter does not merely change in tone -- it *decays structurally*. The banter selection should factor in the current decay level to choose from different pools:

| Decay Range | Banter Style | Example |
|-------------|-------------|---------|
| 0-39 (Normal) | Full, observational sentences. Clinical precision. Beckett's early style. | "The corridor was here yesterday. Today it is mostly here. The walls retain their shape but have forgotten their color." |
| 40-69 (Degraded) | Shorter sentences. Fewer adjectives. Details drop out. | "The corridor. Mostly here. The walls have forgotten something." |
| 70-84 (Critical) | Fragments. Single observations. Lem's scientific despair. | "Corridor. Walls. Less." |
| 85-99 (Near-dissolution) | One or two words. Or silence. Beckett's Endgame. | "Less." / "{agent} opens their mouth. Decides against it." |

Implementation: Add a `decay_tier` field to banter entries (0, 1, 2, 3) and filter based on current decay band. Each trigger needs entries at multiple tiers.

### 4.2 Banter Templates (45+ entries)

New trigger: `decay_critical` (decay >= 70) and `decay_degraded` (decay >= 40).

**Room Entered (Normal, decay 0-39):**
```python
{
    "id": "eb_01",
    "trigger": "room_entered",
    "decay_tier": 0,
    "personality_filter": {"openness": (0.7, 1.0)},
    "text_en": "{agent}: 'The corridor was here yesterday. Today it is mostly here.'",
    "text_de": "{agent}: >>Der Korridor war gestern hier. Heute ist er grösstenteils hier.<<",
},
{
    "id": "eb_02",
    "trigger": "room_entered",
    "decay_tier": 0,
    "personality_filter": {"neuroticism": (0.6, 1.0)},
    "text_en": "{agent} checks the instruments. The readings are accurate. They are also indistinguishable from the last room's readings.",
    "text_de": "{agent} pruft die Instrumente. Die Werte sind genau. Sie sind auch nicht von den Werten des letzten Raums zu unterscheiden.",
},
{
    "id": "eb_03",
    "trigger": "room_entered",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "The air is the temperature of resignation. The instruments confirm it precisely.",
    "text_de": "Die Luft hat die Temperatur der Resignation. Die Instrumente bestatigen es prazise.",
},
{
    "id": "eb_04",
    "trigger": "room_entered",
    "decay_tier": 0,
    "personality_filter": {"conscientiousness": (0.7, 1.0)},
    "text_en": "{agent} catalogs the room's features. Wall. Floor. Ceiling. Door. The same four features as the last room. And the one before.",
    "text_de": "{agent} katalogisiert die Merkmale des Raums. Wand. Boden. Decke. Tur. Dieselben vier Merkmale wie im letzten Raum. Und dem davor.",
},
```

**Room Entered (Degraded, decay 40-69):**
```python
{
    "id": "eb_05",
    "trigger": "room_entered",
    "decay_tier": 1,
    "personality_filter": {"openness": (0.7, 1.0)},
    "text_en": "{agent}: 'Room. Another one.'",
    "text_de": "{agent}: >>Raum. Noch einer.<<",
},
{
    "id": "eb_06",
    "trigger": "room_entered",
    "decay_tier": 1,
    "personality_filter": {},
    "text_en": "The instruments still work. The information they provide has stopped mattering.",
    "text_de": "Die Instrumente funktionieren noch. Die Information, die sie liefern, hat aufgehort, relevant zu sein.",
},
```

**Room Entered (Critical, decay 70-84):**
```python
{
    "id": "eb_07",
    "trigger": "room_entered",
    "decay_tier": 2,
    "personality_filter": {},
    "text_en": "Room. Walls.",
    "text_de": "Raum. Wande.",
},
{
    "id": "eb_08",
    "trigger": "room_entered",
    "decay_tier": 2,
    "personality_filter": {"neuroticism": (0.6, 1.0)},
    "text_en": "{agent} starts to speak. Doesn't.",
    "text_de": "{agent} setzt zum Sprechen an. Tut es nicht.",
},
```

**Room Entered (Near-dissolution, decay 85-99):**
```python
{
    "id": "eb_09",
    "trigger": "room_entered",
    "decay_tier": 3,
    "personality_filter": {},
    "text_en": ".",
    "text_de": ".",
},
```

**Combat Won:**
```python
{
    "id": "eb_10",
    "trigger": "combat_won",
    "decay_tier": 0,
    "personality_filter": {"agreeableness": (0.7, 1.0)},
    "text_en": "{agent}: 'It stopped. Not because we won. Because it ran out of reasons to continue.'",
    "text_de": "{agent}: >>Es hat aufgehort. Nicht weil wir gewonnen haben. Weil ihm die Grunde ausgingen weiterzumachen.<<",
},
{
    "id": "eb_11",
    "trigger": "combat_won",
    "decay_tier": 0,
    "personality_filter": {"extraversion": (0.7, 1.0)},
    "text_en": "{agent}: 'There were more of us. I think.'",
    "text_de": "{agent}: >>Es waren mehr von uns. Glaube ich.<<",
},
{
    "id": "eb_12",
    "trigger": "combat_won",
    "decay_tier": 1,
    "personality_filter": {},
    "text_en": "The enemy dissipates. The party remains. For now, that distinction holds.",
    "text_de": "Der Feind vergeht. Die Gruppe bleibt. Vorerst halt diese Unterscheidung.",
},
{
    "id": "eb_13",
    "trigger": "combat_won",
    "decay_tier": 2,
    "personality_filter": {},
    "text_en": "Resolved. The word feels generous.",
    "text_de": "Erledigt. Das Wort fuhlt sich grosszugig an.",
},
```

**Decay Degraded (new trigger, decay >= 40):**
```python
{
    "id": "eb_14",
    "trigger": "decay_degraded",
    "decay_tier": 1,
    "personality_filter": {},
    "text_en": "The decay counter passes 40. Somewhere, a distinction that existed no longer does.",
    "text_de": "Der Verfallszahler uberschreitet 40. Irgendwo existiert eine Unterscheidung nicht mehr, die es gab.",
},
{
    "id": "eb_15",
    "trigger": "decay_degraded",
    "decay_tier": 1,
    "personality_filter": {"openness": (0.7, 1.0)},
    "text_en": "{agent} notices the edges of things blurring. Not visually. Categorically.",
    "text_de": "{agent} bemerkt, dass die Rander der Dinge verschwimmen. Nicht visuell. Kategorial.",
},
```

**Decay Critical (new trigger, decay >= 70):**
```python
{
    "id": "eb_16",
    "trigger": "decay_critical",
    "decay_tier": 2,
    "personality_filter": {},
    "text_en": "DISSOLUTION INDEX: CRITICAL. The instruments still function. The readings have converged.",
    "text_de": "AUFLOSUNGSINDEX: KRITISCH. Die Instrumente funktionieren noch. Die Werte sind konvergiert.",
},
{
    "id": "eb_17",
    "trigger": "decay_critical",
    "decay_tier": 2,
    "personality_filter": {"neuroticism": (0.6, 1.0)},
    "text_en": "{agent} tries to remember the entrance. The memory has the quality of a rumor.",
    "text_de": "{agent} versucht sich an den Eingang zu erinnern. Die Erinnerung hat die Qualitat eines Geruchts.",
},
{
    "id": "eb_18",
    "trigger": "decay_critical",
    "decay_tier": 2,
    "personality_filter": {},
    "text_en": "Less. Of everything. Less.",
    "text_de": "Weniger. Von allem. Weniger.",
},
```

**Depth Change:**
```python
{
    "id": "eb_19",
    "trigger": "depth_change",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "Deeper. The word implies a direction. Direction implies difference. The difference is becoming theoretical.",
    "text_de": "Tiefer. Das Wort impliziert eine Richtung. Richtung impliziert Unterschied. Der Unterschied wird theoretisch.",
},
{
    "id": "eb_20",
    "trigger": "depth_change",
    "decay_tier": 1,
    "personality_filter": {},
    "text_en": "Deeper. Probably.",
    "text_de": "Tiefer. Wahrscheinlich.",
},
```

**Boss Approach:**
```python
{
    "id": "eb_21",
    "trigger": "boss_approach",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "Something ahead retains more definition than its surroundings. This passes for remarkable.",
    "text_de": "Etwas voraus behalt mehr Definition als seine Umgebung. Das gilt hier als bemerkenswert.",
},
```

**Rest:**
```python
{
    "id": "eb_22",
    "trigger": "rest_start",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "A space where the decay is marginally slower. The instruments call it a sanctuary. The instruments are optimistic.",
    "text_de": "Ein Raum, in dem der Verfall geringfugig langsamer ist. Die Instrumente nennen es ein Refugium. Die Instrumente sind optimistisch.",
},
{
    "id": "eb_23",
    "trigger": "rest_start",
    "decay_tier": 2,
    "personality_filter": {},
    "text_en": "Rest. The concept erodes even as you practice it.",
    "text_de": "Rast. Das Konzept erodiert, wahrend ihr es praktiziert.",
},
```

**Loot Found:**
```python
{
    "id": "eb_24",
    "trigger": "loot_found",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "Something here has resisted the dissolution. Not for long, but long enough.",
    "text_de": "Etwas hier hat der Auflosung widerstanden. Nicht lange, aber lang genug.",
},
{
    "id": "eb_25",
    "trigger": "loot_found",
    "decay_tier": 1,
    "personality_filter": {},
    "text_en": "A remnant. Take it before it isn't.",
    "text_de": "Ein Uberrest. Nehmt ihn, bevor er keiner mehr ist.",
},
```

**Retreat:**
```python
{
    "id": "eb_26",
    "trigger": "retreat",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "The party retreats. The dungeon does not pursue. It does not need to. It is patient. It is also everywhere.",
    "text_de": "Die Gruppe zieht sich zuruck. Der Dungeon verfolgt nicht. Er muss nicht. Er ist geduldig. Er ist auch uberall.",
},
```

**Dungeon Completed:**
```python
{
    "id": "eb_27",
    "trigger": "dungeon_completed",
    "decay_tier": 0,
    "personality_filter": {},
    "text_en": "You leave. The garden remains. It is very patient. It has nothing but time. And less and less of everything else.",
    "text_de": "Ihr geht. Der Garten bleibt. Er ist sehr geduldig. Er hat nichts als Zeit. Und immer weniger von allem anderen.",
},
```

(Full implementation would include 45+ entries covering all standard triggers at multiple decay tiers.)

---

## 5. Encounter Scenarios (5)

### 5.1 "The Catalogue of Former Things" (Narrative Encounter, depth 1-2)

```python
EncounterTemplate(
    id="entropy_catalogue",
    archetype="The Entropy",
    room_type="encounter",
    min_depth=1,
    max_depth=2,
    min_difficulty=1,
    description_en=(
        "A room lined with shelves. Each shelf holds objects that were once distinct: "
        "a tool, a weapon, a musical instrument, a compass. They are becoming the same "
        "object. The labels remain, but the labels are wrong now. Or the objects are. "
        "It is increasingly difficult to tell."
    ),
    description_de=(
        "Ein Raum voller Regale. Jedes Regal enthalt Gegenstande, die einst verschieden "
        "waren: ein Werkzeug, eine Waffe, ein Musikinstrument, ein Kompass. Sie werden "
        "zum selben Gegenstand. Die Beschriftungen bleiben, aber die Beschriftungen "
        "stimmen nicht mehr. Oder die Gegenstande nicht. Es wird zunehmend schwieriger, "
        "das zu unterscheiden."
    ),
    choices=[
        EncounterChoice(
            id="catalogue_preserve",
            label_en="Preserve the most distinct object (Guardian)",
            label_de="Den am meisten unterscheidbaren Gegenstand bewahren (Wachter)",
            check_aptitude="guardian",
            check_difficulty=5,
            success_effects={"decay": -8, "loot": True, "discovery": True},
            partial_effects={"decay": -4},
            fail_effects={"decay": 5, "stress": 30},
            success_narrative_en="You isolate an artifact that still remembers what it is. The shelves groan with envy.",
            success_narrative_de="Ihr isoliert ein Artefakt, das sich noch erinnert, was es ist. Die Regale achzen vor Neid.",
            fail_narrative_en="The object dissolves in your hands. It was already too late. Everything is always already too late here.",
            fail_narrative_de="Der Gegenstand lost sich in euren Handen auf. Es war bereits zu spat. Hier ist alles immer bereits zu spat.",
        ),
        EncounterChoice(
            id="catalogue_analyze",
            label_en="Study the dissolution pattern (Spy)",
            label_de="Das Auflosungsmuster untersuchen (Spion)",
            check_aptitude="spy",
            check_difficulty=5,
            success_effects={"decay": -3, "insight": True, "discovery": True},
            partial_effects={"insight": True},
            fail_effects={"decay": 5, "stress": 20},
            success_narrative_en="You map the rate of dissolution. The data is valuable. Briefly.",
            success_narrative_de="Ihr kartiert die Geschwindigkeit der Auflosung. Die Daten sind wertvoll. Kurz.",
        ),
        EncounterChoice(
            id="catalogue_redirect",
            label_en="Redirect the decay outward (Saboteur)",
            label_de="Den Verfall nach aussen umlenken (Saboteur)",
            check_aptitude="saboteur",
            check_difficulty=6,
            success_effects={"decay": -10, "stress": 20},
            partial_effects={"decay": -5, "stress": 30},
            fail_effects={"decay": 8, "stress": 40},
            success_narrative_en="The decay flows outward, briefly. The room clarifies. For now.",
            success_narrative_de="Der Verfall fliesst nach aussen, kurz. Der Raum klart sich. Vorerst.",
        ),
        EncounterChoice(
            id="catalogue_walk_away",
            label_en="Walk away. Some things cannot be saved.",
            label_de="Weitergehen. Manche Dinge kann man nicht retten.",
            success_effects={"decay": 3},
            success_narrative_en="You leave. The objects continue their convergence. They do not notice.",
            success_narrative_de="Ihr geht. Die Gegenstande setzen ihre Konvergenz fort. Sie bemerken es nicht.",
        ),
    ],
)
```

### 5.2 "The Last Differential" (Combat Encounter, depth 2-3)

```python
EncounterTemplate(
    id="entropy_last_differential",
    archetype="The Entropy",
    room_type="combat",
    min_depth=2,
    max_depth=3,
    min_difficulty=1,
    description_en=(
        "Two shapes drift in the corridor -- a Fade Echo and a Rust Phantom. "
        "They were different once. Now they are converging. When they finish "
        "converging, they will be one thing, and that thing will be nothing. "
        "Until then, they are still dangerous in their own diminishing ways."
    ),
    description_de=(
        "Zwei Formen treiben im Korridor -- ein Verblassecho und ein Rostphantom. "
        "Sie waren einst verschieden. Nun konvergieren sie. Wenn sie fertig "
        "konvergiert sind, werden sie eines sein, und dieses Eine wird nichts sein. "
        "Bis dahin sind sie noch gefährlich, auf ihre jeweils schwindende Weise."
    ),
    combat_encounter_id="entropy_erosion_patrol_spawn",
)
```

### 5.3 "The Residue Archive" (Narrative/Treasure, depth 2-4)

```python
EncounterTemplate(
    id="entropy_residue_archive",
    archetype="The Entropy",
    room_type="encounter",
    min_depth=2,
    max_depth=4,
    min_difficulty=1,
    description_en=(
        "A vault. Something here was preserved -- intentionally, at great cost. "
        "A mechanism still runs, powered by a source that is itself decaying. "
        "The preserved artifacts are 60% intact. The mechanism has perhaps "
        "twelve minutes of operation remaining. Perhaps less."
    ),
    description_de=(
        "Ein Tresor. Etwas hier wurde bewahrt -- absichtlich, unter grossen Kosten. "
        "Ein Mechanismus lauft noch, angetrieben von einer Quelle, die selbst "
        "verfallt. Die bewahrten Artefakte sind zu 60% intakt. Der Mechanismus "
        "hat vielleicht noch zwolf Minuten Betriebszeit. Vielleicht weniger."
    ),
    choices=[
        EncounterChoice(
            id="archive_repair",
            label_en="Repair the mechanism (Guardian, slow decay)",
            label_de="Den Mechanismus reparieren (Wachter, Verfall verlangsamen)",
            check_aptitude="guardian",
            check_difficulty=6,
            success_effects={"decay": -12, "loot": True},
            partial_effects={"decay": -6, "loot": True},
            fail_effects={"decay": 8, "stress": 30},
            success_narrative_en="The mechanism steadies. The artifacts hold. You have bought them -- and yourselves -- more time. Time is the most decaying currency here.",
            success_narrative_de="Der Mechanismus stabilisiert sich. Die Artefakte halten. Ihr habt ihnen -- und euch -- mehr Zeit erkauft. Zeit ist die am schnellsten verfallende Wahrung hier.",
        ),
        EncounterChoice(
            id="archive_extract",
            label_en="Extract the most valuable artifact (Infiltrator)",
            label_de="Das wertvollste Artefakt extrahieren (Infiltrator)",
            check_aptitude="infiltrator",
            check_difficulty=5,
            success_effects={"loot": True, "decay": 3},
            partial_effects={"loot": True, "decay": 6, "loot_tier_penalty": True},
            fail_effects={"decay": 8, "stress": 25},
            success_narrative_en="You take the best of what remains. The mechanism falters. The rest dissolves.",
            success_narrative_de="Ihr nehmt das Beste von dem, was bleibt. Der Mechanismus stockt. Der Rest lost sich auf.",
        ),
        EncounterChoice(
            id="archive_study",
            label_en="Study who built this (Spy)",
            label_de="Untersuchen, wer dies erbaut hat (Spion)",
            check_aptitude="spy",
            check_difficulty=5,
            success_effects={"insight": True, "memory_created": True, "decay": 2},
            partial_effects={"insight": True, "decay": 4},
            fail_effects={"decay": 6},
            success_narrative_en="The mechanism was built by someone who understood what was coming. The notes are partially legible. Enough to learn from. Not enough to replicate.",
            success_narrative_de="Der Mechanismus wurde von jemandem gebaut, der verstand, was kommen wurde. Die Notizen sind teilweise leserlich. Genug, um daraus zu lernen. Nicht genug, um es nachzubauen.",
        ),
    ],
)
```

### 5.4 "The Garden" (Boss, depth 4+)

```python
EncounterTemplate(
    id="entropy_the_garden",
    archetype="The Entropy",
    room_type="boss",
    min_depth=4,
    max_depth=99,
    min_difficulty=1,
    description_en=(
        "The Verfall-Garten. An open space that was once something beautiful -- "
        "a plaza, a courtyard, a park. Now it is all three and none of them. "
        "At its center, a structure: the last thing here that resists dissolution. "
        "An Entropy Warden circles it, performing maintenance gestures on an "
        "artifact that no longer exists in quite the way the Warden remembers.\n\n"
        "The decay counter accelerates. +3 per round. The Warden does not "
        "want to fight. It wants to continue its work. You are interference."
    ),
    description_de=(
        "Der Verfall-Garten. Ein offener Raum, der einst etwas Schones war -- "
        "ein Platz, ein Hof, ein Park. Nun ist er alle drei und keines davon. "
        "In seiner Mitte eine Struktur: das Letzte hier, das sich der Auflosung "
        "widersetzt. Ein Entropiewachter umkreist sie und vollfuhrt Wartungsgesten "
        "an einem Artefakt, das nicht mehr ganz so existiert, wie der Wachter "
        "sich erinnert.\n\n"
        "Der Verfallszahler beschleunigt. +3 pro Runde. Der Wachter will nicht "
        "kampfen. Er will seine Arbeit fortsetzen. Ihr seid eine Storung."
    ),
    combat_encounter_id="entropy_warden_spawn",
)
```

Boss-specific mechanic: Per-round +3 party decay (in addition to the standard +2 per combat round). Total: +5 decay per round during boss fight. This creates extreme time pressure -- a 6-round boss fight adds +30 decay just from rounds, plus hit-based contagious decay. The party must end this fast or dissolve.

Boss narrative on defeat: "The Warden does not fall. It stops. The difference between these two things has been eroding for a long time. It has now eroded completely."

### 5.5 "The Rest That Remains" (Rest Encounter)

```python
EncounterTemplate(
    id="entropy_the_rest",
    archetype="The Entropy",
    room_type="rest",
    min_depth=1,
    max_depth=99,
    min_difficulty=1,
    description_en=(
        "A pocket of slower decay. The walls here retain their texture. "
        "The floor remembers it is a floor. These are luxuries now."
    ),
    description_de=(
        "Eine Tasche langsameren Verfalls. Die Wande hier behalten ihre Textur. "
        "Der Boden erinnert sich, dass er ein Boden ist. Das sind Luxusguter jetzt."
    ),
    choices=[
        EncounterChoice(
            id="rest_heal",
            label_en="Rest (heal stress, 20% ambush chance)",
            label_de="Rasten (Stress heilen, 20% Hinterhaltschance)",
            success_effects={"stress_heal": 40, "ambush_trigger": True},
            success_narrative_en="Rest. The concept holds. Barely.",
            success_narrative_de="Rast. Das Konzept halt. Gerade so.",
        ),
        EncounterChoice(
            id="rest_preserve",
            label_en="Guardian watch (Preserve: -8 Decay, no heal)",
            label_de="Wachter-Wache (Bewahren: -8 Verfall, keine Heilung)",
            requires_aptitude={"guardian": 3},
            success_effects={"decay": -8},
            success_narrative_en="The Guardian holds the line against dissolution. The decay slows. Briefly, something is preserved that would otherwise not be.",
            success_narrative_de="Der Wachter halt die Linie gegen die Auflosung. Der Verfall verlangsamt sich. Kurz wird etwas bewahrt, das sonst nicht ware.",
        ),
        EncounterChoice(
            id="rest_study",
            label_en="Spy assessment (-3 Decay, reveal adjacent rooms)",
            label_de="Spion-Erkundung (-3 Verfall, angrenzende Raume aufdecken)",
            requires_aptitude={"spy": 3},
            success_effects={"decay": -3, "discovery": True},
            success_narrative_en="The Spy maps what remains. The map will be less accurate tomorrow. Today, it helps.",
            success_narrative_de="Der Spion kartiert, was ubrig ist. Die Karte wird morgen weniger genau sein. Heute hilft sie.",
        ),
    ],
)
```

---

## 6. Loot Tables

### 6.1 Tier 1 (Minor, 4 items)

| ID | Name (en/de) | Effect | Drop Weight |
|----|-------------|--------|-------------|
| `entropy_residue` | Entropy Residue / Entropieruckstand | `stress_heal`: 50 (after_dungeon) | 40 |
| `dissolution_insight` | Dissolution Insight / Auflosungserkenntnis | `memory`: importance 4, "Learned to read the rate at which things cease to be distinct" | 30 |
| `preservation_fragment` | Preservation Fragment / Bewahrungsfragment | `dungeon_buff`: Guardian checks +5% | 20 |
| `decay_redirect` | Decay Redirect / Verfallsumleitung | `dungeon_buff`: Saboteur stress_damage +50% | 10 |

### 6.2 Tier 2 (Major, 5 items)

| ID | Name (en/de) | Effect | Drop Weight |
|----|-------------|--------|-------------|
| `entropy_attunement_shard` | Entropy Attunement Shard / Entropieeinstimmungssplitter | `moodlet`: "entropy_attuned", emotion: calm, strength 8 | 30 |
| `dissolution_fragment` | Dissolution Fragment / Auflosungsfragment | `memory`: importance 7 | 25 |
| `preservation_lens` | Preservation Lens / Bewahrungslinse | Permanent +1 Guardian in Entropy dungeons | 20 |
| `entropy_catalyst` | Entropy Catalyst / Entropiekatalysator | `event_modifier`: impact_level -1 | 15 |
| `restoration_blueprint` | Restoration Blueprint / Restaurierungsbauplan | Next Entropy run: rooms pre-revealed | 10 |

### 6.3 Tier 3 (Legendary, guaranteed boss drop, 3 items)

| ID | Name (en/de) | Effect | Drop Weight |
|----|-------------|--------|-------------|
| `restoration_fragment` | **Restoration Fragment** / Restaurierungsfragment | Improves one building's condition by one tier (signature item, per original spec) | 100 (guaranteed) |
| `garden_memory` | Garden Memory / Gartenerinnerung | `memory`: importance 9, behavior_effect "more_patient_less_impulsive" | 100 (guaranteed) |
| `entropy_attunement` | Entropy Attunement / Entropieeinstimmung | `aptitude_boost`: Guardian OR Saboteur +1, max +2 cap | 50 |

### 6.4 Entropy-Specific Loot Logic

**Low-decay bonus:** If `decay <= 20` at loot time, 50% chance Tier 1 upgrades to Tier 2 (rewards careful preservation -- symmetrical to Tower's high-stability bonus).

**High-decay penalty:** If `decay >= 60`, 30% chance Tier 2 downgrades to Tier 1 (decay degrades everything, including rewards).

---

## 7. Strategy Implementation

### 7.1 EntropyStrategy Class

```python
class EntropyStrategy(ArchetypeStrategy):
    """The Entropy: Decay accumulation mechanic (0→100, room-entry + contagion)."""

    def init_state(self) -> dict:
        return {
            "decay": self.mechanic_config["start_decay"],
            "max_decay": self.mechanic_config["max_decay"],
        }

    def apply_drain(self, instance: DungeonInstance) -> str | None:
        """Accumulate decay on room entry (opposite direction to Shadow/Tower drain)."""
        self._apply_room_entry_gain(instance)
        decay = instance.archetype_state.get("decay", 0)
        if decay >= self.mechanic_config["dissolution_threshold"]:
            return "dissolution"
        if decay >= self.mechanic_config["critical_threshold"]:
            return "decay_critical"
        if decay >= self.mechanic_config["degraded_threshold"]:
            return "decay_degraded"
        return None

    def apply_restore(self, instance: DungeonInstance, event: str) -> None:
        reduce_key = {
            "combat_victory": "reduce_on_combat_win",
            "rest": "reduce_on_rest",
            "treasure": "reduce_on_treasure",
        }.get(event)
        if reduce_key and self.mechanic_config.get(reduce_key):
            instance.archetype_state["decay"] = max(
                0,
                instance.archetype_state.get("decay", 0) - self.mechanic_config[reduce_key],
            )

    def apply_encounter_effects(self, instance: DungeonInstance, effects: dict) -> None:
        decay_delta = effects.get("decay", 0)
        if decay_delta:
            instance.archetype_state["decay"] = max(
                0,
                min(
                    self.mechanic_config["max_decay"],
                    instance.archetype_state.get("decay", 0) + decay_delta,
                ),
            )

    def get_ambient_stress_multiplier(self, instance: DungeonInstance) -> float:
        decay = instance.archetype_state.get("decay", 0)
        if decay >= 100:
            return self.mechanic_config.get("dissolution_stress_multiplier", 2.0)
        if decay >= 85:
            return self.mechanic_config.get("stress_multiplier_85", 1.50)
        if decay >= 70:
            return self.mechanic_config.get("stress_multiplier_70", 1.25)
        return 1.0

    def on_combat_round(self, instance: DungeonInstance) -> None:
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_per_combat_round"],
        )

    def on_failed_check(self, instance: DungeonInstance) -> None:
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_on_failed_check"],
        )

    def on_enemy_hit(self, instance: DungeonInstance) -> None:
        """Contagious decay: enemy hits increase party decay."""
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0)
            + self.mechanic_config["gain_per_enemy_hit"],
        )

    def _apply_room_entry_gain(self, instance: DungeonInstance) -> None:
        """Decay gain per room entry: +4/+7/+10 by depth tier."""
        depth = instance.depth
        if depth <= 2:
            gain = self.mechanic_config["gain_depth_1_2"]
        elif depth <= 4:
            gain = self.mechanic_config["gain_depth_3_4"]
        else:
            gain = self.mechanic_config["gain_depth_5_plus"]
        instance.archetype_state["decay"] = min(
            self.mechanic_config["max_decay"],
            instance.archetype_state.get("decay", 0) + gain,
        )
```

### 7.2 New Hook: `on_enemy_hit`

The contagious decay mechanic requires a new hook on `ArchetypeStrategy`:

```python
# In ArchetypeStrategy base class:
def on_enemy_hit(self, instance: DungeonInstance) -> None:
    """Optional hook: called when an enemy lands a hit on an agent.
    Default: no-op. Override for contagion-style mechanics."""
    return None
```

This hook must be called in `combat_engine.py` after each successful enemy attack resolution. The call site in the engine service would be:

```python
# In _resolve_combat(), after enemy hit is applied:
if event.hit and event.actor_is_enemy:
    get_archetype_strategy(instance.archetype).on_enemy_hit(instance)
```

### 7.3 Banter Selection Modification

The `select_banter` function in `dungeon_encounters.py` needs a minor extension to filter by `decay_tier` when the archetype is The Entropy. The current function signature already receives `archetype`; the additional parameter needed is the current archetype state:

```python
def select_banter(
    trigger: str,
    agents: list[dict],
    used_ids: list[str],
    archetype: str = "The Shadow",
    archetype_state: dict | None = None,
) -> dict | None:
```

For The Entropy, calculate `decay_tier` from `archetype_state.get("decay", 0)`:
- 0-39: tier 0
- 40-69: tier 1
- 70-84: tier 2
- 85+: tier 3

Filter banter candidates to only those matching the current tier. For non-Entropy archetypes, `decay_tier` is ignored (existing banter entries have no `decay_tier` field).

---

## 8. Frontend Integration

### 8.1 Types (`frontend/src/types/dungeon.ts`)

```typescript
export const ARCHETYPE_ENTROPY = 'The Entropy';

export interface EntropyArchetypeState {
  decay: number;
  max_decay: number;
}

// Update union type:
export type ArchetypeState =
  | ShadowArchetypeState
  | TowerArchetypeState
  | EntropyArchetypeState
  | Record<string, unknown>;

export function isEntropyState(state: ArchetypeState): state is EntropyArchetypeState {
  return 'decay' in state && typeof state.decay === 'number';
}
```

### 8.2 Dungeon Formatters

```typescript
if (isEntropyState(archetypeState)) {
  const { decay, max_decay } = archetypeState;
  const fillBlocks = Math.round(decay / 5);
  const emptyBlocks = Math.round((max_decay - decay) / 5);
  const bar = '\u2591'.repeat(emptyBlocks) + '\u2588'.repeat(fillBlocks);
  lines.push(systemLine(`DISSOLUTION INDEX: ${bar} [${decay}/${max_decay}]`));
}
```

Note: The bar fills from right to left (empty blocks first, then filled) -- visually, decay *accumulates* as the filled portion grows. This is the opposite of Tower's stability bar which empties.

### 8.3 DungeonHeader Decay Gauge

Horizontal dissolution meter. Design: analog instrument aesthetic matching the existing depth gauge and stability gauge. The meter fills with `var(--color-warning)` at 40+, `var(--color-danger)` at 70+. At 85+, optional slow pulse via `prefers-reduced-motion: no-preference`. WCAG AA: `role="progressbar"`, appropriate ARIA attributes. Icon: something suggesting dissolution (static/noise pattern or `icons.erosion(12)` if available).

---

## 9. Fallback Spawns and Registry Entries

### 9.1 `_FALLBACK_SPAWNS` addition

```python
"The Entropy": {
    "boss": "entropy_warden_spawn",
    "default": "entropy_drift_spawn",
    "rest_ambush": "entropy_rest_ambush_spawn",
},
```

### 9.2 Registry Entries

```python
# dungeon_combat.py
_ENEMY_REGISTRIES["The Entropy"] = ENTROPY_ENEMIES
_SPAWN_REGISTRIES["The Entropy"] = ENTROPY_SPAWN_CONFIGS

# dungeon_encounters.py
_ENCOUNTER_REGISTRIES["The Entropy"] = ALL_ENTROPY_ENCOUNTERS
_BANTER_REGISTRIES["The Entropy"] = ENTROPY_BANTER

# dungeon_loot.py
_LOOT_REGISTRIES["The Entropy"] = ENTROPY_LOOT_TABLES

# archetype_strategies.py
_ARCHETYPE_STRATEGIES["The Entropy"] = EntropyStrategy(ARCHETYPE_CONFIGS["The Entropy"])
```

### 9.3 `check_ambush` addition

```python
elif archetype == "The Entropy":
    entropy_config = ARCHETYPE_CONFIGS["The Entropy"]["mechanic_config"]
    decay = archetype_state.get("decay", 0)
    if decay >= 85:
        return random.random() < entropy_config["high_decay_ambush_85"]
    if decay >= 70:
        return random.random() < entropy_config["high_decay_ambush_70"]
```

---

## 10. Implementation Dependencies and Sequencing

```
Phase A: Strategy + Config (backend/services/dungeon/)
  ├── A1: Complete archetype config in dungeon_archetypes.py
  ├── A2: Add EntropyStrategy to archetype_strategies.py
  ├── A3: Add on_enemy_hit hook to ArchetypeStrategy base class
  └── A4: Wire on_enemy_hit call in combat_engine.py
  → Verify: all existing tests pass

Phase B: Content — Enemies + Spawns (dungeon_combat.py)
  ├── 4 enemy templates (Rust Phantom, Fade Echo, Dissolution Swarm, Entropy Warden)
  ├── 6 spawn configs
  ├── check_ambush Entropy branch
  └── Register in _ENEMY_REGISTRIES, _SPAWN_REGISTRIES

Phase C: Content — Encounters + Banter (dungeon_encounters.py)
  ├── 5+ encounter templates (Catalogue, Last Differential, Residue Archive, The Garden boss, The Rest)
  ├── Additional combat encounters to fill room distribution
  ├── 45+ banter entries with decay_tier field
  ├── select_banter modification for decay_tier filtering
  └── Register in _ENCOUNTER_REGISTRIES, _BANTER_REGISTRIES

Phase D: Content — Loot (dungeon_loot.py)
  ├── 4+5+3 = 12 loot items across 3 tiers
  ├── Low-decay bonus logic
  ├── High-decay downgrade logic
  └── Register in _LOOT_REGISTRIES

Phase E: Engine Integration (dungeon_engine_service.py)
  ├── _FALLBACK_SPAWNS entry
  ├── Effect key "decay" in _effect_narrative()
  └── Guardian "Preserve" ability in ability_schools.py

Phase F: Frontend
  ├── F1: Types (EntropyArchetypeState, isEntropyState)
  ├── F2: DungeonHeader decay gauge (invoke frontend-design skill)
  ├── F3: Formatters (dissolution index bar)
  └── F4: HTP lore content

Phase G: Tests — 100+ new tests

Phase H: Documentation — spec update, literary influences update
```

---

## 11. Key Design Decisions and Trade-offs

**Why decay counts UP instead of DOWN:**
Counting up (0 to 100) rather than draining down (100 to 0 like Tower) creates a distinct psychological experience. Players managing stability feel like they are *preserving* something. Players managing decay feel like something is *accumulating* that they cannot stop, only slow. The entropy metaphor requires the additive model -- entropy always increases.

**Why contagious decay is party-level, not per-agent:**
Per-agent decay would create a more complex system but would undermine the thematic core. Entropy is universal -- it does not care which agent was hit. The whole system decays together. This also avoids creating unfair targeting dynamics where one agent becomes "decayed" and others do not.

**Why banter degrades structurally:**
This is the single most important design decision for The Entropy's literary identity. If banter stayed the same quality throughout, the mechanic would be a number going up but the experience would not change. Structural degradation of language IS the experience. The player should feel entropy through the prose itself, not just the decay counter.

**Why the boss fight has +3 decay per round (total +5):**
This creates a hard time limit. At +5 per round plus contagious decay from hits, a 6-round boss fight adds ~40-50 decay. If the party enters the boss room at decay 50 (reasonable for a careful run), they have roughly 10 rounds before dissolution. This matches the urgency of Tower's stability drain during its boss but through accumulation rather than depletion.

---

### Critical Files for Implementation

- `/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/archetype_strategies.py` -- Add `EntropyStrategy` class and `on_enemy_hit` base hook
- `/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_archetypes.py` -- Complete The Entropy config (replace stub)
- `/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_combat.py` -- Entropy enemies, spawns, ambush logic
- `/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_encounters.py` -- Entropy encounters, banter with decay_tier system
- `/Users/mleihs/Dev/velgarien-rebuild/backend/services/dungeon/dungeon_loot.py` -- Entropy loot tables with low-decay bonus / high-decay penalty
