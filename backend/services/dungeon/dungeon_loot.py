"""Dungeon loot tables — 3-tier loot system for all archetypes.

Tier 1 (Minor): combat rooms, 30% drop chance
Tier 2 (Major): elite/treasure rooms
Tier 3 (Legendary): boss room, guaranteed

Review #20: Permanent aptitude bonuses capped at +2 per agent total.
This prevents unbounded power creep from repeated dungeon runs.
"""

from __future__ import annotations

import random

from backend.models.resonance_dungeon import LootItem

# ── Tier 1: Minor Loot ──────────────────────────────────────────────────────

SHADOW_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="shadow_residue",
        name_en="Shadow Residue",
        name_de="Schattenrückstand",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en="Crystallized shadow. Absorbs stress when handled carefully.",
        description_de="Kristallisierter Schatten. Absorbiert Stress bei vorsichtiger Handhabung.",
        drop_weight=40,
    ),
    LootItem(
        id="dark_insight",
        name_en="Dark Insight",
        name_de="Dunkle Erkenntnis",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned to sense movement in darkness",
            "content_de": "Gelernt, Bewegung in der Dunkelheit zu spüren",
        },
        description_en="A fragment of understanding gained in the dark.",
        description_de="Ein Fragment des Verständnisses, gewonnen in der Dunkelheit.",
        drop_weight=30,
    ),
    LootItem(
        id="silenced_step",
        name_en="Silenced Step",
        name_de="Lautloser Schritt",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "infiltrator", "scope": "this_dungeon"},
        description_en="A technique of movement that the shadows themselves taught.",
        description_de="Eine Technik der Bewegung, die die Schatten selbst gelehrt haben.",
        drop_weight=20,
    ),
    LootItem(
        id="fear_extract",
        name_en="Fear Extract",
        name_de="Furchtextrakt",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"stress_damage_bonus": 0.5, "aptitude": "propagandist", "scope": "this_dungeon"},
        description_en="Distilled dread in a vial. Not your fear \u2013 someone else's, concentrated until it weighs something. Applied to words, they cut deeper.",
        description_de="Destillierter Schrecken in einer Phiole. Nicht eure Angst \u2013 die eines anderen, verdichtet bis sie wiegt. Auf Worte aufgetragen, schneiden sie tiefer.",
        drop_weight=10,
    ),
    LootItem(
        id="shadow_whisper",
        name_en="Shadow Whisper",
        name_de="Schattengeflüster",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "infiltrator", "scope": "this_dungeon"},
        description_en="A captured whisper that teaches movement without presence. Infiltrator checks +5%.",
        description_de="Ein eingefangenes Flüstern, das Bewegung ohne Präsenz lehrt. Infiltrator-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="dark_adaptation",
        name_en="Dark Adaptation",
        name_de="Dunkelanpassung",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="Prolonged exposure to shadow \u2013 the eyes adjust, the mind follows. Spy checks +5%.",
        description_de="Längere Exposition gegenüber Schatten \u2013 die Augen passen sich an, der Geist folgt. Spion-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="echo_shard",
        name_en="Echo Shard",
        name_de="Echosplitter",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 30, "when": "immediate"},
        description_en="A shard of resolved conflict. Holding it quiets the noise \u2013 briefly, but enough.",
        description_de="Ein Splitter gelösten Konflikts. Ihn zu halten beruhigt den Lärm \u2013 kurz, aber genug.",
        drop_weight=25,
    ),
    LootItem(
        id="void_shard",
        name_en="Void Shard",
        name_de="Leerensplitter",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="Crystallized emptiness. It absorbs impact before the body does. Guardian checks +5%.",
        description_de="Kristallisierte Leere. Sie absorbiert Einschlag, bevor es der Körper tut. Wächter-Proben +5%.",
        drop_weight=15,
    ),
]

# ── Tier 2: Major Loot ──────────────────────────────────────────────────────

SHADOW_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="shadow_attunement_shard",
        name_en="Shadow Attunement Shard",
        name_de="Schatteneinstimmungssplitter",
        tier=2,
        effect_type="moodlet",
        effect_params={
            "moodlet_type": "shadow_attuned",
            "emotion": "fascination",
            "strength": 8,
            "decay_type": "permanent",
            "description_en": "Drawn to darkness. Stimulation need decays faster.",
            "description_de": "Angezogen von der Dunkelheit. Stimulationsbedarf sinkt schneller.",
        },
        description_en="Permanent: agent gains 'shadow_attuned' moodlet.",
        description_de="Permanent: Agent erhält 'schatteneingestimmt' Moodlet.",
        drop_weight=30,
    ),
    LootItem(
        id="echo_fragment",
        name_en="Echo Fragment",
        name_de="Echofragment",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 7,
            "content_en": "Experienced the shadows of the simulation's unconscious. Gained perspective on unresolved conflicts.",
            "content_de": "Die Schatten des Unbewussten der Simulation erfahren. Perspektive auf ungelöste Konflikte gewonnen.",
        },
        description_en="Creates a high-importance Reflection Memory about the dungeon experience.",
        description_de="Erzeugt eine hochbedeutende Reflexionserinnerung über die Dungeon-Erfahrung.",
        drop_weight=25,
    ),
    LootItem(
        id="darkened_lens",
        name_en="Darkened Lens",
        name_de="Verdunkelte Linse",
        tier=2,
        effect_type="permanent_dungeon_bonus",
        effect_params={"aptitude": "spy", "bonus": 1, "scope": "shadow_dungeons_only"},
        description_en="Permanent: +1 Spy aptitude passive in ALL future Shadow dungeons.",
        description_de="Permanent: +1 Spion-Eignung passiv in ALLEN zukünftigen Schatten-Dungeons.",
        drop_weight=20,
    ),
    LootItem(
        id="conflict_residue",
        name_en="Conflict Residue",
        name_de="Konfliktresiduums",
        tier=2,
        effect_type="event_modifier",
        effect_params={"impact_level_reduction": 1, "scope": "one_event"},
        description_en="Can reduce one Event's impact_level by 1.",
        description_de="Kann den Einflussgrad eines Ereignisses um 1 senken.",
        drop_weight=15,
    ),
    LootItem(
        id="shadow_map",
        name_en="Shadow Map",
        name_de="Schattenkarte",
        tier=2,
        effect_type="next_dungeon_bonus",
        effect_params={"all_rooms_revealed": True, "start_visibility": 3, "scope": "next_shadow_dungeon"},
        description_en="Next Shadow dungeon: all rooms pre-revealed, Visibility starts at max.",
        description_de="Nächster Schatten-Dungeon: AlleRäume vorher enthüllt, Sicht beginnt auf Maximum.",
        drop_weight=10,
    ),
]

# ── Tier 3: Legendary Loot (Boss) ───────────────────────────────────────────

SHADOW_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="shadow_attunement",
        name_en="Shadow Attunement",
        name_de="Schatteneinstimmung",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={
            "aptitude_choices": ["spy", "assassin"],
            "bonus": 1,
            "max_total_bonus": 2,  # Review #20: cap at +2 per agent
        },
        description_en="Permanent: one agent gains +1 Spy OR Assassin aptitude. Capped at +2 total.",
        description_de="Permanent: Ein Agent erhält +1 Spion ODER Assassinen-Eignung. Maximal +2 gesamt.",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="shadow_memory",
        name_en="Shadow Memory",
        name_de="Schattenerinnerung",
        tier=3,
        effect_type="memory",
        effect_params={
            "importance": 9,
            "content_en": "Confronted the darkness and prevailed. The experience fundamentally altered how they perceive threat and fear.",
            "content_de": "Der Dunkelheit entgegengetreten und bestanden. Die Erfahrung veränderte grundlegend, wie sie Bedrohung und Angst wahrnehmen.",
            "behavior_effect": "more_brave_less_avoidant",
        },
        description_en="High-importance Memory: affects agent autonomous behavior (more brave, less avoidant).",
        description_de="Hochbedeutende Erinnerung: beeinflusst autonomes Verhalten (mutiger, weniger vermeidend).",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="scar_tissue_reduction",
        name_en="Scar Tissue Reduction",
        name_de="Narbengewebe-Reduktion",
        tier=3,
        effect_type="arc_modifier",
        effect_params={"pressure_reduction": 0.15, "scope": "matching_arc"},
        description_en="If matching narrative arc exists: pressure reduced.",
        description_de="Falls passender Erzählbogen existiert: Druck reduziert.",
        drop_weight=50,  # conditional on arc existing
    ),
]

# ── Loot Tables Registry ────────────────────────────────────────────────────

SHADOW_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: SHADOW_LOOT_TIER_1,
    2: SHADOW_LOOT_TIER_2,
    3: SHADOW_LOOT_TIER_3,
}

# ── Tower Tier 1: Minor Loot ──────────────────────────────────────────────

TOWER_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="structural_dust",
        name_en="Structural Dust",
        name_de="Strukturstaub",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en="Pulverized load-bearing material. Inhaling it settles something fundamental.",
        description_de="Pulverisiertes Tragwerk. Das Einatmen beruhigt etwas Grundlegendes.",
        drop_weight=40,
    ),
    LootItem(
        id="market_insight",
        name_en="Market Insight",
        name_de="Markterkenntnis",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned to read the mathematics of failing structures",
            "content_de": "Gelernt, die Mathematik versagender Strukturen zu lesen",
        },
        description_en="A fragment of understanding: how markets fall, and why the fall is always overdue.",
        description_de="Ein Fragment des Verständnisses: wie Märkte fallen und warum der Fall immer überfällig ist.",
        drop_weight=30,
    ),
    LootItem(
        id="load_bearing_fragment",
        name_en="Load-Bearing Fragment",
        name_de="Tragwerkfragment",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="A shard that remembers how to hold things together. Guardian checks +5%.",
        description_de="Ein Splitter, der sich erinnert, wie man Dinge zusammenhält. Wächter-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="leverage_extract",
        name_en="Leverage Extract",
        name_de="Hebelextrakt",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"stress_damage_bonus": 0.5, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en="Consumable: one Saboteur ability deals +50% stress damage this dungeon.",
        description_de="Verbrauchsgegenstand: Eine Saboteur-Fähigkeit verursacht +50% Stressschaden in diesem Dungeon.",
        drop_weight=10,
    ),
    LootItem(
        id="structural_insight",
        name_en="Structural Insight",
        name_de="Strukturelle Einsicht",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="Understanding of load paths and hidden passages. Spy checks +5%.",
        description_de="Verständnis von Lastpfaden und verborgenen Durchgängen. Spion-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="load_bearing_knowledge",
        name_en="Load-Bearing Knowledge",
        name_de="Tragendes Wissen",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="Intuition for what holds and what breaks \u2013 and how to be on the right side. Guardian checks +5%.",
        description_de="Intuition für das, was hält, und das, was bricht \u2013 und wie man auf der richtigen Seite steht. Wächter-Proben +5%.",
        drop_weight=15,
    ),
    LootItem(
        id="collapse_resonance",
        name_en="Collapse Resonance",
        name_de="Einsturzresonanz",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 30, "when": "immediate"},
        description_en="A frequency captured from a controlled demolition. Hearing it resets the nervous system \u2013 the body forgets its fear of falling.",
        description_de="Eine Frequenz, eingefangen bei einem kontrollierten Abriss. Sie zu hören setzt das Nervensystem zurück \u2013 der Körper vergisst seine Angst vor dem Fallen.",
        drop_weight=25,
    ),
    LootItem(
        id="demolition_echo",
        name_en="Demolition Echo",
        name_de="Abrissecho",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en="The resonance of a perfectly placed charge. Saboteur checks +5%.",
        description_de="Die Resonanz einer perfekt platzierten Ladung. Saboteur-Proben +5%.",
        drop_weight=20,
    ),
]

# ── Tower Tier 2: Major Loot ──────────────────────────────────────────────

TOWER_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="foundation_attunement_shard",
        name_en="Foundation Attunement Shard",
        name_de="Fundamenteinstimmungssplitter",
        tier=2,
        effect_type="moodlet",
        effect_params={
            "moodlet_type": "structurally_attuned",
            "emotion": "determination",
            "strength": 8,
            "decay_type": "permanent",
            "description_en": "Attuned to structural stress. Senses instability before instruments do.",
            "description_de": "Eingestimmt auf strukturellen Stress. Spürt Instabilität vor den Instrumenten.",
        },
        description_en="Permanent: agent gains 'structurally_attuned' moodlet.",
        description_de="Permanent: Agent erhält 'strukturell_eingestimmt' Moodlet.",
        drop_weight=30,
    ),
    LootItem(
        id="collapse_fragment",
        name_en="Collapse Fragment",
        name_de="Einsturzfragment",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 7,
            "content_en": "Witnessed the mathematics of structural failure. Gained intuition for when systems are past the point of rescue.",
            "content_de": "Die Mathematik des Strukturversagens bezeugt. Intuition gewonnen für den Moment, ab dem Systeme nicht mehr zu retten sind.",
        },
        description_en="Creates a high-importance Reflection Memory about structural collapse.",
        description_de="Erzeugt eine hochbedeutende Reflexionserinnerung über strukturellen Zusammenbruch.",
        drop_weight=25,
    ),
    LootItem(
        id="reinforced_lens",
        name_en="Reinforced Lens",
        name_de="Verstärkte Linse",
        tier=2,
        effect_type="permanent_dungeon_bonus",
        effect_params={"aptitude": "guardian", "bonus": 1, "scope": "tower_dungeons_only"},
        description_en="Permanent: +1 Guardian aptitude passive in ALL future Tower dungeons.",
        description_de="Permanent: +1 Wächter-Eignung passiv in ALLEN zukünftigen Turm-Dungeons.",
        drop_weight=20,
    ),
    LootItem(
        id="stability_residue",
        name_en="Stability Residue",
        name_de="Stabilitätsrückstand",
        tier=2,
        effect_type="event_modifier",
        effect_params={"impact_level_reduction": 1, "scope": "one_event"},
        description_en="Can reduce one Event's impact_level by 1.",
        description_de="Kann den Einflussgrad eines Ereignisses um 1 senken.",
        drop_weight=15,
    ),
    LootItem(
        id="structural_blueprint",
        name_en="Structural Blueprint",
        name_de="Struktureller Bauplan",
        tier=2,
        effect_type="next_dungeon_bonus",
        effect_params={"all_rooms_revealed": True, "start_stability": 100, "scope": "next_tower_dungeon"},
        description_en="Next Tower dungeon: all rooms pre-revealed, Stability starts at max.",
        description_de="Nächster Turm-Dungeon: Alle Räume vorher enthüllt, Stabilität beginnt auf Maximum.",
        drop_weight=10,
    ),
]

# ── Tower Tier 3: Legendary Loot (Boss) ───────────────────────────────────

TOWER_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="stability_catalyst",
        name_en="Stability Catalyst",
        name_de="Stabilitätskatalysator",
        tier=3,
        effect_type="simulation_modifier",
        effect_params={
            "overall_health_bonus": 0.05,
            "scope": "permanent",
        },
        description_en="Permanent: +0.05 simulation Overall Health. The tower's sacrifice stabilizes reality.",
        description_de="Permanent: +0.05 Gesamtgesundheit der Simulation. Das Opfer des Turms stabilisiert die Realität.",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="tower_memory",
        name_en="Tower Memory",
        name_de="Turmerinnerung",
        tier=3,
        effect_type="memory",
        effect_params={
            "importance": 9,
            "content_en": "Witnessed a structure let go of itself. Understood that permanence is a confidence game, and collapse is not failure but release.",
            "content_de": "Ein Bauwerk beobachtet, das sich selbst losließ. Verstanden, dass Beständigkeit ein Vertrauensspiel ist und Einsturz nicht Versagen, sondern Loslassen.",
            "behavior_effect": "more_pragmatic_less_rigid",
        },
        description_en="High-importance Memory: affects agent autonomous behavior (more pragmatic, less rigid).",
        description_de="Hochbedeutende Erinnerung: beeinflusst autonomes Verhalten (pragmatischer, weniger starr).",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="foundation_attunement",
        name_en="Foundation Attunement",
        name_de="Fundamenteinstimmung",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={
            "aptitude_choices": ["guardian", "saboteur"],
            "bonus": 1,
            "max_total_bonus": 2,  # Review #20: cap at +2 per agent
        },
        description_en="Permanent: one agent gains +1 Guardian OR Saboteur aptitude. Capped at +2 total.",
        description_de="Permanent: Ein Agent erhält +1 Wächter ODER Saboteur-Eignung. Maximal +2 gesamt.",
        drop_weight=100,  # guaranteed
    ),
]

# ── Tower Loot Tables ──────────────────────────────────────────────────────

TOWER_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: TOWER_LOOT_TIER_1,
    2: TOWER_LOOT_TIER_2,
    3: TOWER_LOOT_TIER_3,
}

# ── Entropy Tier 1: Minor Loot ──────────────────────────────────────────

ENTROPY_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="entropy_residue",
        name_en="Entropy Residue",
        name_de="Entropierückstand",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en="Crystallized sameness. Holding it removes the anxiety of distinction. That should worry you.",
        description_de="Kristallisierte Gleichheit. Sie zu halten nimmt die Angst der Unterscheidung. Das sollte euch beunruhigen.",
        drop_weight=40,
    ),
    LootItem(
        id="dissolution_insight",
        name_en="Dissolution Insight",
        name_de="Auflösungserkenntnis",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned to read the rate at which things cease to be distinct",
            "content_de": "Gelernt, die Geschwindigkeit abzulesen, mit der Dinge aufhören, unterscheidbar zu sein",
        },
        description_en="A fragment of understanding: how systems equalize, and why equalization is the default.",
        description_de="Ein Fragment des Verständnisses: wie Systeme sich angleichen und warum Angleichung der Normalzustand ist.",
        drop_weight=30,
    ),
    LootItem(
        id="preservation_fragment",
        name_en="Preservation Fragment",
        name_de="Bewahrungsfragment",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="A shard that remembers how to keep things separate. Guardian checks +5%.",
        description_de="Ein Splitter, der sich erinnert, wie man Dinge getrennt hält. Wächter-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="decay_redirect",
        name_en="Decay Redirect",
        name_de="Verfallsumleitung",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"stress_damage_bonus": 0.5, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en="Redirected entropy in a stable container. Applied to sabotage, the dissolution cuts both ways.",
        description_de="Umgeleitete Entropie in stabilem Behälter. Auf Sabotage angewendet schneidet die Auflösung in beide Richtungen.",
        drop_weight=10,
    ),
    LootItem(
        id="equilibrium_shard",
        name_en="Equilibrium Shard",
        name_de="Gleichgewichtssplitter",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="Understanding of how sameness spreads \u2013 and where the last differences hide. Spy checks +5%.",
        description_de="Verständnis davon, wie Gleichheit sich ausbreitet \u2013 und wo die letzten Unterschiede sich verbergen. Spion-Proben +5%.",
        drop_weight=20,
    ),
    LootItem(
        id="rust_inoculation",
        name_en="Rust Inoculation",
        name_de="Rostimpfung",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="Controlled exposure to decay builds resistance. Temporarily. Guardian checks +5%.",
        description_de="Kontrollierte Exposition gegenüber Verfall baut Widerstand auf. Vorübergehend. Wächter-Proben +5%.",
        drop_weight=15,
    ),
    LootItem(
        id="vestige_of_purpose",
        name_en="Vestige of Purpose",
        name_de="Überrest des Zwecks",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Found an object that still knew what it was for. The memory of purpose persists longer than purpose itself.",
            "content_de": "Einen Gegenstand gefunden, der noch wusste, wofür er war. Die Erinnerung an Zweck überdauert den Zweck selbst.",
        },
        description_en="A fragment of understanding gained from something that refused to forget.",
        description_de="Ein Fragment des Verständnisses, gewonnen von etwas, das sich weigerte zu vergessen.",
        drop_weight=25,
    ),
    LootItem(
        id="fading_resonance",
        name_en="Fading Resonance",
        name_de="Verblassende Resonanz",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 30, "when": "immediate"},
        description_en="A vibration from when things were more. Holding it reminds you of difference. Briefly.",
        description_de="Eine Vibration aus der Zeit, als Dinge mehr waren. Sie zu halten erinnert an Unterschied. Kurz.",
        drop_weight=25,
    ),
]

# ── Entropy Tier 2: Major Loot ──────────────────────────────────────────

ENTROPY_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="entropy_attunement_shard",
        name_en="Entropy Attunement Shard",
        name_de="Entropieeinstimmungssplitter",
        tier=2,
        effect_type="moodlet",
        effect_params={
            "moodlet_type": "entropy_attuned",
            "emotion": "calm",
            "strength": 8,
            "decay_type": "permanent",
            "description_en": "Attuned to dissolution. Finds peace in equalization. Stress tolerance increases.",
            "description_de": "Eingestimmt auf Auflösung. Findet Frieden in der Angleichung. Stresstoleranz steigt.",
        },
        description_en="Permanent: agent gains 'entropy_attuned' moodlet. Calm in the face of sameness.",
        description_de="Permanent: Agent erhält 'entropieeingestimmt' Moodlet. Gelassenheit angesichts der Gleichheit.",
        drop_weight=30,
    ),
    LootItem(
        id="dissolution_fragment",
        name_en="Dissolution Fragment",
        name_de="Auflösungsfragment",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 7,
            "content_en": "Witnessed entropy firsthand. Understood that preservation is not the opposite of decay \u2013 it is decay, slower.",
            "content_de": "Entropie aus erster Hand bezeugt. Verstanden, dass Bewahrung nicht das Gegenteil von Verfall ist \u2013 sie ist Verfall, langsamer.",
        },
        description_en="Creates a high-importance Reflection Memory about dissolution and persistence.",
        description_de="Erzeugt eine hochbedeutende Reflexionserinnerung über Auflösung und Beharrung.",
        drop_weight=25,
    ),
    LootItem(
        id="preservation_lens",
        name_en="Preservation Lens",
        name_de="Bewahrungslinse",
        tier=2,
        effect_type="permanent_dungeon_bonus",
        effect_params={"aptitude": "guardian", "bonus": 1, "scope": "entropy_dungeons_only"},
        description_en="Permanent: +1 Guardian aptitude passive in ALL future Entropy dungeons.",
        description_de="Permanent: +1 Wächter-Eignung passiv in ALLEN zukünftigen Entropie-Dungeons.",
        drop_weight=20,
    ),
    LootItem(
        id="entropy_catalyst",
        name_en="Entropy Catalyst",
        name_de="Entropiekatalysator",
        tier=2,
        effect_type="event_modifier",
        effect_params={"impact_level_reduction": 1, "scope": "one_event"},
        description_en="Can reduce one Event's impact_level by 1. What dissolves boundaries can also dissolve consequences.",
        description_de="Kann den Einflussgrad eines Ereignisses um 1 senken. Was Grenzen auflöst, kann auch Konsequenzen auflösen.",
        drop_weight=15,
    ),
    LootItem(
        id="restoration_blueprint",
        name_en="Restoration Blueprint",
        name_de="Restaurierungsbauplan",
        tier=2,
        effect_type="next_dungeon_bonus",
        effect_params={"all_rooms_revealed": True, "start_decay": 0, "scope": "next_entropy_dungeon"},
        description_en="Next Entropy dungeon: all rooms pre-revealed. Knowledge persists where matter cannot.",
        description_de="Nächster Entropie-Dungeon: Alle Räume vorher enthüllt. Wissen besteht, wo Materie es nicht kann.",
        drop_weight=10,
    ),
]

# ── Entropy Tier 3: Legendary Loot (Boss) ───────────────────────────────

ENTROPY_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="restoration_fragment",
        name_en="Restoration Fragment",
        name_de="Restaurierungsfragment",
        tier=3,
        effect_type="building_repair",
        effect_params={
            "condition_improvement": 1,
            "scope": "one_building",
        },
        description_en="Improves one building's condition by one tier. Salvaged from the Verfall-Garten \u2013 proof that entropy can be reversed, once, at great cost.",
        description_de="Verbessert den Zustand eines Gebäudes um eine Stufe. Geborgen aus dem Verfall-Garten \u2013 Beweis, dass Entropie umkehrbar ist, einmal, unter großen Kosten.",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="garden_memory",
        name_en="Garden Memory",
        name_de="Gartenerinnerung",
        tier=3,
        effect_type="memory",
        effect_params={
            "importance": 9,
            "content_en": "Walked through the Verfall-Garten and returned. Learned that patience is not passivity \u2013 it is the disciplined refusal to accept the given rate of dissolution.",
            "content_de": "Durch den Verfall-Garten gegangen und zurückgekehrt. Gelernt, dass Geduld nicht Passivität ist \u2013 sie ist die disziplinierte Weigerung, die gegebene Verfallsrate zu akzeptieren.",
            "behavior_effect": "more_patient_less_impulsive",
        },
        description_en="High-importance Memory: affects agent autonomous behavior (more patient, less impulsive).",
        description_de="Hochbedeutende Erinnerung: beeinflusst autonomes Verhalten (geduldiger, weniger impulsiv).",
        drop_weight=100,  # guaranteed
    ),
    LootItem(
        id="entropy_attunement",
        name_en="Entropy Attunement",
        name_de="Entropieeinstimmung",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={
            "aptitude_choices": ["guardian", "saboteur"],
            "bonus": 1,
            "max_total_bonus": 2,  # Review #20: cap at +2 per agent
        },
        description_en="Permanent: one agent gains +1 Guardian OR Saboteur aptitude. Capped at +2 total.",
        description_de="Permanent: Ein Agent erhält +1 Wächter ODER Saboteur-Eignung. Maximal +2 gesamt.",
        drop_weight=50,
    ),
]

# ── Entropy Loot Tables ──────────────────────────────────────────────────

ENTROPY_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: ENTROPY_LOOT_TIER_1,
    2: ENTROPY_LOOT_TIER_2,
    3: ENTROPY_LOOT_TIER_3,
}


# ── Devouring Mother Loot ──────────────────────────────────────────────────

MOTHER_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="mother_nutrient_concentrate",
        name_en="Nutrient Concentrate",
        name_de="Nährstoffkonzentrat",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 60, "when": "after_dungeon"},
        description_en=(
            "A warm capsule of biological material. Your instruments read it as "
            "vitamins, minerals, amino acids. Your body reads it as comfort."
        ),
        description_de=(
            "Eine warme Kapsel biologischen Materials. Eure Instrumente lesen "
            "Vitamine, Minerale, Aminosäuren. Euer Körper liest Geborgenheit."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="mother_binding_insight",
        name_en="Symbiosis Insight",
        name_de="Symbioseerkenntnis",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned how the Mother reads the body's needs and responds before being asked",
            "content_de": "Gelernt, wie die Mutter die Bedürfnisse des Körpers liest und reagiert, bevor man fragt",
        },
        description_en=(
            "A fragment of understanding: how biological systems learn to anticipate "
            "needs. The knowledge is useful. The knowledge is also the mechanism."
        ),
        description_de=(
            "Ein Fragment des Verständnisses: wie biologische Systeme lernen, "
            "Bedürfnisse zu antizipieren. Das Wissen ist nützlich. Das Wissen "
            "ist auch der Mechanismus."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="mother_warmth_fragment",
        name_en="Warmth Fragment",
        name_de="Wärmefragment",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "propagandist", "scope": "this_dungeon"},
        description_en=(
            "A shard that radiates warmth. It resists the Mother's emotional pull. "
            "Propagandist checks +5%."
        ),
        description_de=(
            "Ein Splitter, der Wärme abstrahlt. Er widersteht dem emotionalen Sog "
            "der Mutter. Propagandist-Proben +5%."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="mother_tissue_sample",
        name_en="Living Tissue Sample",
        name_de="Lebendgewebeprobe",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"rest_bonus": 0.25, "scope": "this_dungeon"},
        description_en=(
            "A sample of the Mother's tissue, still alive. Still warm. "
            "It enhances rest healing by 25%. It does not stop growing."
        ),
        description_de=(
            "Eine Probe des Gewebes der Mutter, noch lebendig. Noch warm. "
            "Sie verstärkt Rastheilung um 25%. Sie hört nicht auf zu wachsen."
        ),
        drop_weight=25,
    ),
]

MOTHER_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="mother_symbiont_shard",
        name_en="Symbiont Shard",
        name_de="Symbiontsplitter",
        tier=2,
        effect_type="moodlet",
        effect_params={
            "moodlet_id": "mother_attuned",
            "emotion": "serene",
            "strength": 8,
        },
        description_en=(
            "A fragment of symbiotic tissue that bonds with the carrier. "
            "It provides a profound sense of calm. The calm is genuine."
        ),
        description_de=(
            "Ein Fragment symbiotischen Gewebes, das sich mit dem Träger verbindet. "
            "Es vermittelt eine tiefe Ruhe. Die Ruhe ist echt."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="mother_membrane_key",
        name_en="Membrane Key",
        name_de="Membranschlüssel",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 7,
            "content_en": "Understands the Mother's vascular architecture — how nutrients flow, how attachment deepens",
            "content_de": "Versteht die vaskuläre Architektur der Mutter — wie Nährstoffe fließen, wie Bindung sich vertieft",
        },
        description_en=(
            "A biological key that reads the Mother's circulatory map. "
            "Knowing the architecture does not make it less effective."
        ),
        description_de=(
            "Ein biologischer Schlüssel, der die Kreislaufkarte der Mutter liest. "
            "Die Architektur zu kennen macht sie nicht weniger wirksam."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="mother_guardian_graft",
        name_en="Guardian Graft",
        name_de="Wächterpfropf",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"aptitude_boost": 1, "aptitude": "guardian", "scope": "archetype", "archetype": "The Devouring Mother"},
        description_en=(
            "Tissue grafted from a former Guardian host. It remembers how to sever. "
            "Permanent +1 Guardian aptitude in Devouring Mother dungeons."
        ),
        description_de=(
            "Gewebe, gepfropft von einem ehemaligen Wächter-Wirt. Es erinnert sich, "
            "wie man durchtrennt. Permanent +1 Wächter-Eignung in Verschlingende-Mutter-Dungeons."
        ),
        drop_weight=20,
    ),
    LootItem(
        id="mother_spore_catalyst",
        name_en="Spore Catalyst",
        name_de="Sporenkatalysator",
        tier=2,
        effect_type="event_modifier",
        effect_params={"impact_level": -1},
        description_en=(
            "A concentrated spore extract. When released into a simulation's ecosystem, "
            "it dampens the severity of the next negative event."
        ),
        description_de=(
            "Ein konzentrierter Sporenextrakt. In das Ökosystem einer Simulation "
            "freigesetzt, dämpft er die Schwere des nächsten negativen Ereignisses."
        ),
        drop_weight=15,
    ),
    LootItem(
        id="mother_cradle_map",
        name_en="Cradle Map",
        name_de="Wiegenkarte",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"reveal_rest_rooms": True, "scope": "next_run", "archetype": "The Devouring Mother"},
        description_en=(
            "A biological diagram grown into living tissue. It maps the locations "
            "of rest sites in the next Devouring Mother dungeon."
        ),
        description_de=(
            "Ein biologisches Diagramm, gewachsen in lebendes Gewebe. Es kartiert "
            "die Standorte der Raststätten im nächsten Verschlingende-Mutter-Dungeon."
        ),
        drop_weight=10,
    ),
]

MOTHER_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="mother_restoration_organ",
        name_en="Restoration Organ",
        name_de="Restaurierungsorgan",
        tier=3,
        effect_type="building_repair",
        effect_params={"condition_tiers": 1},
        description_en=(
            "A living organ, pulsing with restorative compounds. When applied to "
            "damaged infrastructure, it grows repair tissue into the structure. "
            "The repair is permanent. The organ continues to pulse."
        ),
        description_de=(
            "Ein lebendes Organ, pulsierend mit restaurativen Verbindungen. "
            "Auf beschädigte Infrastruktur angewendet, wächst es Reparaturgewebe "
            "in die Struktur. Die Reparatur ist permanent. Das Organ pulsiert weiter."
        ),
        drop_weight=100,
    ),
    LootItem(
        id="mother_nursery_memory",
        name_en="Nursery Memory",
        name_de="Kinderstubenerinnerung",
        tier=3,
        effect_type="memory",
        effect_params={
            "importance": 9,
            "behavior_effect": "more_nurturing_less_aggressive",
            "content_en": "Remembers the nursery — the pods, the warmth, the things that were once people. The memory changes how they treat others.",
            "content_de": "Erinnert sich an die Kinderstube — die Hülsen, die Wärme, die Dinge, die einst Menschen waren. Die Erinnerung verändert, wie sie andere behandeln.",
        },
        description_en=(
            "The memory of the nursery: what it means to be cared for completely, "
            "and what that care costs. The agent becomes more nurturing, less aggressive."
        ),
        description_de=(
            "Die Erinnerung an die Kinderstube: was es bedeutet, vollständig "
            "umsorgt zu werden, und was diese Fürsorge kostet. Der Agent wird "
            "fürsorglicher, weniger aggressiv."
        ),
        drop_weight=100,
    ),
    LootItem(
        id="mother_symbiont_attunement",
        name_en="Symbiont Attunement",
        name_de="Symbionteneinstimmung",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "guardian|propagandist", "boost": 1, "max_total_boost": 2},
        description_en=(
            "Deep attunement with the Mother's symbiotic systems. The carrier's "
            "capacity for protection or persuasion permanently increases. "
            "+1 Guardian OR Propagandist aptitude (max +2 cap)."
        ),
        description_de=(
            "Tiefe Einstimmung mit den symbiotischen Systemen der Mutter. Die "
            "Fähigkeit des Trägers für Schutz oder Überzeugung steigt permanent. "
            "+1 Wächter- ODER Propagandist-Eignung (max. +2 Grenze)."
        ),
        drop_weight=50,
    ),
]

MOTHER_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: MOTHER_LOOT_TIER_1,
    2: MOTHER_LOOT_TIER_2,
    3: MOTHER_LOOT_TIER_3,
}


# ── Archetype Loot Registry ──────────────────────────────────────────────

_LOOT_REGISTRIES: dict[str, dict[int, list[LootItem]]] = {
    "The Shadow": SHADOW_LOOT_TABLES,
    "The Tower": TOWER_LOOT_TABLES,
    "The Entropy": ENTROPY_LOOT_TABLES,
    "The Devouring Mother": MOTHER_LOOT_TABLES,
}


def roll_loot(
    tier: int,
    difficulty: int,
    depth: int,
    archetype_state: dict | None = None,
    archetype: str = "The Shadow",
) -> list[LootItem]:
    """Roll for loot drops from the archetype's loot table.

    Args:
        tier: Loot tier (1=minor, 2=major, 3=legendary).
        difficulty: Dungeon difficulty (affects quality multiplier).
        depth: Current dungeon depth.
        archetype_state: Archetype-specific state (e.g. visibility for Shadow).
        archetype: Dungeon archetype for registry lookup.

    Returns:
        List of LootItem drops. Tier 3 returns all guaranteed items.
        Tiers 1-2 return 1 item via weighted random.
    """
    loot_tables = _LOOT_REGISTRIES.get(archetype, {})
    table = loot_tables.get(tier, loot_tables.get(1, []))

    if not table:
        return []

    if tier == 3:
        # Boss loot: all guaranteed items
        return list(table)

    # Weighted random selection (1 item)
    weights = [item.drop_weight for item in table]
    selected = random.choices(table, weights=weights, k=1)

    # Archetype-specific loot bonuses
    if archetype == "The Shadow":
        # Shadow VP 0 bonus (Review #7: brave in the dark = +50% loot)
        visibility = (archetype_state or {}).get("visibility", 3)
        if visibility == 0 and tier == 1 and random.random() < 0.5:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
    elif archetype == "The Tower":
        # Tower high-stability bonus: stability >= 80 → 50% chance Tier 1→Tier 2
        # Rewards careful, efficient play (inverse of Shadow's VP0 risk-reward)
        stability = (archetype_state or {}).get("stability", 100)
        if stability >= 80 and tier == 1 and random.random() < 0.5:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
    elif archetype == "The Entropy":
        decay = (archetype_state or {}).get("decay", 0)
        # Low-decay bonus: decay ≤ 20 → 50% chance Tier 1→Tier 2 (preservation reward)
        if decay <= 20 and tier == 1 and random.random() < 0.5:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
        # High-decay penalty: decay ≥ 60 → 30% chance Tier 2→Tier 1 (decay degrades loot)
        elif decay >= 60 and tier == 2 and random.random() < 0.3:
            tier1_table = loot_tables.get(1, [])
            if tier1_table:
                tier1_weights = [item.drop_weight for item in tier1_table]
                selected = random.choices(tier1_table, weights=tier1_weights, k=1)
    elif archetype == "The Devouring Mother":
        attachment = (archetype_state or {}).get("attachment", 0)
        # High-attachment bonus: attachment ≥ 60 → 30% chance Tier 1→Tier 2
        # (the Mother rewards dependency — better gifts for the attached)
        if attachment >= 60 and tier == 1 and random.random() < 0.3:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
        # Low-attachment penalty: attachment ≤ 15 → 30% chance Tier 2→Tier 1
        # (refusing the Mother's gifts makes her gifts less impressive)
        elif attachment <= 15 and tier == 2 and random.random() < 0.3:
            tier1_table = loot_tables.get(1, [])
            if tier1_table:
                tier1_weights = [item.drop_weight for item in tier1_table]
                selected = random.choices(tier1_table, weights=tier1_weights, k=1)

    return selected
