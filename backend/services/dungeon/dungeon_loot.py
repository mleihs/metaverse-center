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
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS

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


# ── Prometheus Loot ───────────────────────────────────────────────────────
# Loot reflects the pharmakon principle: every item carries benefit + cost.
# Tier 1: Workshop byproducts (stress heal, buffs, memories).
# Tier 2: Partially crafted items with dual effects.
# Tier 3: Innovation Blueprint (boss loot, spec-defined choices).

PROMETHEUS_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="prometheus_spark_residue",
        name_en="Spark Residue",
        name_de="Funkenrückstand",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en=(
            "Crystallized energy from a defeated construct. "
            "It hums at a frequency that calms the nervous system."
        ),
        description_de=(
            "Kristallisierte Energie eines besiegten Konstrukts. "
            "Sie summt auf einer Frequenz, die das Nervensystem beruhigt."
        ),
        drop_weight=40,
    ),
    LootItem(
        id="prometheus_workshop_insight",
        name_en="Workshop Insight",
        name_de="Werkstatterkenntnis",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 5,
            "content_en": "Observed the workshop's self-organizing principles. Matter has preferences.",
            "content_de": "Die Selbstorganisationsprinzipien der Werkstatt beobachtet. Materie hat Präferenzen.",
        },
        description_en="A fragment of understanding: how the workshop thinks. How materials choose their partners.",
        description_de="Ein Fragment des Verständnisses: wie die Werkstatt denkt. Wie Materialien ihre Partner wählen.",
        drop_weight=30,
    ),
    LootItem(
        id="prometheus_calibration_shard",
        name_en="Calibration Shard",
        name_de="Kalibrierungssplitter",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en="A precisely fractured crystal. Saboteur checks +5% \u2013 the workshop approves of hands that build.",
        description_de="Ein präzise gebrochener Kristall. Saboteur-Proben +5% \u2013 die Werkstatt billigt Hände, die bauen.",
        drop_weight=20,
    ),
    LootItem(
        id="prometheus_forge_ember",
        name_en="Forge Ember",
        name_de="Schmiedeglut",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"stress_damage_bonus": 0.5, "aptitude": "infiltrator", "scope": "this_dungeon"},
        description_en="A contained ember from the workshop's forge. It makes delicate work easier \u2013 and more dangerous.",
        description_de="Eine eingedämmte Glut aus der Schmiede der Werkstatt. Sie macht feine Arbeit leichter \u2013 und gefährlicher.",
        drop_weight=10,
    ),
]

PROMETHEUS_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="prometheus_tempered_lens",
        name_en="Tempered Observation Lens",
        name_de="Gehärtete Beobachtungslinse",
        tier=2,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "spy", "boost": 1},
        description_en=(
            "A lens forged in the workshop's crucible. It reveals patterns "
            "invisible to the unaugmented eye. Spy aptitude +1."
        ),
        description_de=(
            "Eine in der Werkstattschmelze geschmiedete Linse. Sie enthüllt "
            "Muster, die für das unverstärkte Auge unsichtbar sind. Spion-Aptitude +1."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="prometheus_catalytic_compound",
        name_en="Catalytic Compound",
        name_de="Katalytische Verbindung",
        tier=2,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "saboteur", "boost": 1},
        description_en=(
            "A compound that accelerates material reactions. "
            "The workshop's gift to hands that dare to combine. Saboteur aptitude +1."
        ),
        description_de=(
            "Eine Verbindung, die Materialreaktionen beschleunigt. "
            "Das Geschenk der Werkstatt an Hände, die es wagen zu kombinieren. "
            "Saboteur-Aptitude +1."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="prometheus_resonance_tuner",
        name_en="Resonance Tuner",
        name_de="Resonanzstimmer",
        tier=2,
        effect_type="moodlet",
        effect_params={
            "mood_delta": 15,
            "description_en": "The satisfaction of creation \u2013 something new exists because of what you did.",
            "description_de": "Die Befriedigung der Schöpfung \u2013 etwas Neues existiert wegen dem, was ihr getan habt.",
        },
        description_en=(
            "A device that harmonizes with the bearer's frequency. "
            "It provides comfort. It also provides dependency."
        ),
        description_de=(
            "Ein Gerät, das mit der Frequenz des Trägers harmoniert. "
            "Es bietet Trost. Es bietet auch Abhängigkeit."
        ),
        drop_weight=20,
    ),
    LootItem(
        id="prometheus_alloy_fragment",
        name_en="Experimental Alloy Fragment",
        name_de="Experimentelles Legierungsfragment",
        tier=2,
        effect_type="next_dungeon_bonus",
        effect_params={
            "bonus_type": "insight_start",
            "value": 15,
            "description_en": "Next dungeon run starts with 15 insight.",
            "description_de": "Nächster Dungeon-Run beginnt mit 15 Insight.",
        },
        description_en=(
            "A fragment of alloy that remembers being part of something larger. "
            "Carry it into the next workshop \u2013 the fire will recognize it."
        ),
        description_de=(
            "Ein Legierungsfragment, das sich erinnert, Teil von etwas Größerem "
            "gewesen zu sein. Tragt es in die nächste Werkstatt \u2013 das Feuer wird es erkennen."
        ),
        drop_weight=15,
    ),
    LootItem(
        id="prometheus_pharmakon_vial",
        name_en="Pharmakon Vial",
        name_de="Pharmakon-Phiole",
        tier=2,
        effect_type="event_modifier",
        effect_params={
            "modifier": "dual_effect",
            "benefit": {"stress_heal": 80},
            "cost": {"aptitude_penalty": {"saboteur": -1, "scope": "temporary", "duration_hours": 24}},
        },
        description_en=(
            "A vial containing a substance that is simultaneously remedy and poison. "
            "Heals 80 stress. Temporarily reduces Saboteur aptitude by 1 for 24h."
        ),
        description_de=(
            "Eine Phiole mit einer Substanz, die gleichzeitig Heilmittel und Gift ist. "
            "Heilt 80 Stress. Reduziert Saboteur-Aptitude temporär um 1 für 24h."
        ),
        drop_weight=15,
    ),
]

PROMETHEUS_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="prometheus_innovation_blueprint",
        name_en="Innovation Blueprint",
        name_de="Innovationsblaupause",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "any", "boost": 1},
        description_en=(
            "The workshop's final gift. A blueprint that imprints itself on "
            "the bearer \u2013 permanent knowledge, paid for in fire. "
            "+1 to one aptitude of the bearer's highest."
        ),
        description_de=(
            "Das letzte Geschenk der Werkstatt. Eine Blaupause, die sich dem "
            "Träger einprägt \u2013 permanentes Wissen, bezahlt in Feuer. "
            "+1 auf eine Aptitude des höchsten Werts des Trägers."
        ),
        drop_weight=50,
    ),
    LootItem(
        id="prometheus_prototype_core",
        name_en="Prototype Core",
        name_de="Prototyp-Kern",
        tier=3,
        effect_type="permanent_dungeon_bonus",
        effect_params={
            "bonus_type": "crafting_mastery",
            "description_en": "All future Prometheus dungeon crafting checks +10%.",
            "description_de": "Alle zukünftigen Prometheus-Dungeon-Crafting-Proben +10%.",
        },
        description_en=(
            "The core of The Prototype. It pulses with unfinished potential. "
            "Whoever carries this understands the workshop better than the workshop "
            "understands itself."
        ),
        description_de=(
            "Der Kern des Prototypen. Er pulsiert mit unfertigem Potential. "
            "Wer dies trägt, versteht die Werkstatt besser, als die Werkstatt "
            "sich selbst versteht."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="prometheus_stolen_fire",
        name_en="Stolen Fire",
        name_de="Gestohlenes Feuer",
        tier=3,
        effect_type="arc_modifier",
        effect_params={
            "arc_effect": "innovation_catalyst",
            "description_en": "The agent who carries this generates +0.15 Building Readiness per cycle.",
            "description_de": "Der Agent, der dies trägt, erzeugt +0,15 Gebäudebereitschaft pro Zyklus.",
        },
        description_en=(
            "Fire from the gods. Not a metaphor \u2013 a substance. "
            "It does not burn the hand that carries it. "
            "It burns everything the hand touches."
        ),
        description_de=(
            "Feuer der Götter. Keine Metapher \u2013 eine Substanz. "
            "Es verbrennt nicht die Hand, die es trägt. "
            "Es verbrennt alles, was die Hand berührt."
        ),
        drop_weight=20,
    ),
]

PROMETHEUS_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: PROMETHEUS_LOOT_TIER_1,
    2: PROMETHEUS_LOOT_TIER_2,
    3: PROMETHEUS_LOOT_TIER_3,
}


# ── The Deluge: Loot ─────────────────────────────────────────────────────

DELUGE_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="deluge_brine_residue",
        name_en="Brine Residue",
        name_de="Salzrückstand",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en=(
            "Crystallized from evaporated floodwater. Holding it steadies "
            "the pulse. A mineral memory of when the water was calm."
        ),
        description_de=(
            "Kristallisiert aus verdunstetem Flutwasser. Es in der Hand zu "
            "halten beruhigt den Puls. Eine mineralische Erinnerung daran, "
            "als das Wasser ruhig war."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="deluge_tide_reading",
        name_en="Tide Reading",
        name_de="Gezeitenablesung",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned to read the intervals between surges. Not prediction \u2013 recognition.",
            "content_de": "Gelernt, die Intervalle zwischen den Fluten zu lesen. Keine Vorhersage \u2013 Wiedererkennung.",
        },
        description_en="Learned to read the intervals between surges. Not prediction \u2013 recognition.",
        description_de="Gelernt, die Intervalle zwischen den Fluten zu lesen. Keine Vorhersage \u2013 Wiedererkennung.",
        drop_weight=25,
    ),
    LootItem(
        id="deluge_seal_fragment",
        name_en="Seal Fragment",
        name_de="Dichtungsfragment",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="A piece of whatever held the water back before the party arrived. Guardian checks +5%.",
        description_de="Ein Stück dessen, was das Wasser zurückhielt, bevor die Gruppe ankam. Wächter-Proben +5%.",
        drop_weight=25,
    ),
    LootItem(
        id="deluge_current_map",
        name_en="Current Map",
        name_de="Strömungskarte",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 5, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="A trace of the water's preferred paths. Spy checks +5%.",
        description_de="Eine Spur der bevorzugten Wege des Wassers. Spion-Proben +5%.",
        drop_weight=20,
    ),
]

# ── Deluge: Debris Pool (Tier 0, auto-apply, deposited by the current) ──────

DELUGE_DEBRIS_POOL: list[LootItem] = [
    LootItem(
        id="debris_driftwood_splint",
        name_en="Driftwood Splint",
        name_de="Treibholzschiene",
        tier=0,
        effect_type="stress_heal",
        effect_params={"stress_heal": 15, "when": "immediate"},
        description_en="Smoothed by transit. It fits the palm like it was carved for it. The wood remembers a surface the party has not seen in hours.",
        description_de="Glattgeschliffen durch die Strömung. Es passt in die Handfläche, als wäre es dafür geschnitzt. Das Holz erinnert sich an eine Oberfläche, die die Gruppe seit Stunden nicht gesehen hat.",
        drop_weight=25,
    ),
    LootItem(
        id="debris_waterlogged_charm",
        name_en="Waterlogged Charm",
        name_de="Durchnässter Talisman",
        tier=0,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 3, "aptitude": "guardian", "scope": "this_dungeon"},
        description_en="A ward against pressure, still functional. The inscription is illegible but the intent persists. Guardian checks +3%.",
        description_de="Ein Schutz gegen Druck, noch funktionsfähig. Die Inschrift ist unleserlich, aber die Absicht besteht fort. Wächter-Proben +3%.",
        drop_weight=20,
    ),
    LootItem(
        id="debris_silt_crusted_lens",
        name_en="Silt-Crusted Lens",
        name_de="Schlickverkrustete Linse",
        tier=0,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 3, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="Clears when wiped. Through it, the water's movements become legible \u2013 not transparent, but grammatical. Spy checks +3%.",
        description_de="Wird klar, wenn man sie abwischt. Durch sie werden die Bewegungen des Wassers lesbar \u2013 nicht durchsichtig, aber grammatisch. Spion-Proben +3%.",
        drop_weight=18,
    ),
    LootItem(
        id="debris_brackish_tonic",
        name_en="Brackish Tonic",
        name_de="Brackwasser-Tonikum",
        tier=0,
        effect_type="stress_heal",
        effect_params={"stress_heal": 20, "when": "immediate"},
        description_en="Tastes of salt and iron and a depth the tongue cannot name. The calm it brings is not comfort \u2013 it is resignation's quieter cousin.",
        description_de="Schmeckt nach Salz und Eisen und einer Tiefe, die die Zunge nicht nennen kann. Die Ruhe, die es bringt, ist kein Trost \u2013 sie ist die leisere Verwandte der Resignation.",
        drop_weight=22,
    ),
    LootItem(
        id="debris_flotsam_shard",
        name_en="Flotsam Shard",
        name_de="Treibgutsplitter",
        tier=0,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 3, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en="From something that was once a tool. The edge still holds. Saboteur checks +3%.",
        description_de="Von etwas, das einmal ein Werkzeug war. Die Kante hält noch. Saboteur-Proben +3%.",
        drop_weight=18,
    ),
    LootItem(
        id="debris_current_worn_stone",
        name_en="Current-Worn Stone",
        name_de="Strömungsstein",
        tier=0,
        effect_type="stress_heal",
        effect_params={"stress_heal": 10, "when": "immediate"},
        description_en="Perfectly round. The water took its time. Holding it is like holding a completed argument \u2013 there is nothing left to remove.",
        description_de="Perfekt rund. Das Wasser hat sich Zeit gelassen. Ihn zu halten ist wie ein vollendetes Argument \u2013 es gibt nichts mehr zu entfernen.",
        drop_weight=25,
    ),
]


def roll_debris() -> LootItem:
    """Roll a random debris item from the Deluge pool (auto-apply, tier 0)."""
    weights = [item.drop_weight for item in DELUGE_DEBRIS_POOL]
    return random.choices(DELUGE_DEBRIS_POOL, weights=weights, k=1)[0]


DELUGE_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="deluge_pressure_ward",
        name_en="Pressure Ward",
        name_de="Druckschutz",
        tier=2,
        effect_type="stress_heal",
        effect_params={"stress_heal": 120, "when": "after_dungeon"},
        description_en=(
            "Equalized pressure from a sealed chamber. The relief is physical "
            "\u2013 the tension in the chest that was always there, gone."
        ),
        description_de=(
            "Ausgeglichener Druck aus einer versiegelten Kammer. Die Erleichterung "
            "ist physisch \u2013 die Spannung in der Brust, die immer da war, weg."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="deluge_salvage_record",
        name_en="Salvage Record",
        name_de="Bergungsprotokoll",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 7,
            "content_en": (
                "A complete record of what the flood carried and where it deposited. "
                "Understanding the flood's logic changes the agent's relationship to loss."
            ),
            "content_de": (
                "Ein vollständiges Protokoll dessen, was die Flut trug und wo sie es ablagerte. "
                "Das Verständnis der Logik der Flut verändert die Beziehung des Agenten zum Verlust."
            ),
        },
        description_en=(
            "A complete record of what the flood carried and where it deposited. "
            "Understanding the flood's logic changes the agent's relationship to loss."
        ),
        description_de=(
            "Ein vollständiges Protokoll dessen, was die Flut trug und wo sie es ablagerte. "
            "Das Verständnis der Logik der Flut verändert die Beziehung des Agenten zum Verlust."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="deluge_flood_barrier_shard",
        name_en="Flood Barrier Shard",
        name_de="Flutsperrensplitter",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"stress_damage_bonus": 0.5, "aptitude": "saboteur", "scope": "this_dungeon"},
        description_en=(
            "A fragment of the barrier that held for 200 years. Applied to "
            "sabotage, the particle physics of resistance."
        ),
        description_de=(
            "Ein Fragment der Sperre, die 200 Jahre hielt. Auf Sabotage "
            "angewandt, die Teilchenphysik des Widerstands."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="deluge_tidal_insight",
        name_en="Tidal Insight",
        name_de="Gezeiteneinsicht",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"check_bonus": 10, "aptitude": "spy", "scope": "this_dungeon"},
        description_en="The tide's pattern, internalized. Spy checks +10%.",
        description_de="Das Muster der Gezeiten, verinnerlicht. Spion-Proben +10%.",
        drop_weight=20,
    ),
]

DELUGE_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="deluge_covenant_fragment",
        name_en="Covenant Fragment",
        name_de="Bundesfragment",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "guardian", "boost": 1},
        description_en=(
            "A fragment of the promise the water made: to recede, eventually. "
            "Carrying it changes how {agent} relates to protection. "
            "Guardian aptitude +1."
        ),
        description_de=(
            "Ein Fragment des Versprechens, das das Wasser gab: sich "
            "zurückzuziehen, irgendwann. Es zu tragen verändert, wie "
            "{agent} sich zu Schutz verhält. Wächter-Aptitude +1."
        ),
        drop_weight=40,
    ),
    LootItem(
        id="deluge_deep_time_core",
        name_en="Deep-Time Core",
        name_de="Tiefzeitkern",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "spy", "boost": 1},
        description_en=(
            "Compressed sediment from the lowest floor. It contains the memory "
            "of every room the water passed through. Perception sharpened. "
            "Spy aptitude +1."
        ),
        description_de=(
            "Komprimiertes Sediment vom tiefsten Stockwerk. Es enthält die "
            "Erinnerung an jeden Raum, den das Wasser durchquerte. "
            "Wahrnehmung geschärft. Spion-Aptitude +1."
        ),
        drop_weight=35,
    ),
    LootItem(
        id="deluge_elemental_warding",
        name_en="Elemental Warding",
        name_de="Elementarschutz",
        tier=3,
        effect_type="simulation_modifier",
        effect_params={
            "building_protection": True,
            "duration_ticks": 10,
            "min_condition": "moderate",
            "description_en": (
                "One building becomes immune to condition degradation below "
                "'moderate' for 10 heartbeat ticks. The flood's inverse: preservation."
            ),
            "description_de": (
                "Ein Gebäude wird immun gegen Zustandsverschlechterung unter "
                "'moderat' für 10 Herzschlag-Ticks. Das Inverse der Flut: Bewahrung."
            ),
        },
        description_en=(
            "One building in the simulation becomes immune to condition "
            "degradation below 'moderate' for 10 heartbeat ticks. "
            "The flood's inverse: preservation."
        ),
        description_de=(
            "Ein Gebäude in der Simulation wird immun gegen "
            "Zustandsverschlechterung unter »moderat« für 10 "
            "Herzschlag-Ticks. Das Inverse der Flut: Bewahrung."
        ),
        drop_weight=25,
    ),
]

DELUGE_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: DELUGE_LOOT_TIER_1,
    2: DELUGE_LOOT_TIER_2,
    3: DELUGE_LOOT_TIER_3,
}


# ── The Awakening: Loot ──────────────────────────────────────────────────

AWAKENING_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="awakening_echo_trace",
        name_en="Echo Trace",
        name_de="Echospur",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en=(
            "A trace of a memory that was not the party's. "
            "Handling it calms something that was not disturbed."
        ),
        description_de=(
            "Eine Spur einer Erinnerung, die nicht der Gruppe gehörte. "
            "Sie zu berühren beruhigt etwas, das nicht gestört war."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="awakening_deja_vu_fragment",
        name_en="Déjà-vu Fragment",
        name_de="Déjà-vu-Fragment",
        tier=1,
        effect_type="memory",
        effect_params={
            "importance": 4,
            "content_en": "Learned to distinguish memory from perception",
            "content_de": "Gelernt, Erinnerung von Wahrnehmung zu unterscheiden",
        },
        description_en="A crystallized moment of recognition that predates experience.",
        description_de="Ein kristallisierter Moment der Wiedererkennung, der der Erfahrung vorausgeht.",
        drop_weight=25,
    ),
    LootItem(
        id="awakening_lucid_lens",
        name_en="Lucid Lens",
        name_de="Luzide Linse",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"aptitude": "spy", "bonus_pct": 5},
        description_en="Perception sharpened by awareness. Spy checks +5%.",
        description_de="Wahrnehmung geschärft durch Bewusstsein. Spion-Proben +5%.",
        drop_weight=25,
    ),
    LootItem(
        id="awakening_grounding_stone",
        name_en="Grounding Stone",
        name_de="Erdungsstein",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"aptitude": "guardian", "bonus_pct": 5},
        description_en="An anchor for identity. Guardian checks +5%.",
        description_de="Ein Anker für Identität. Wächter-Proben +5%.",
        drop_weight=20,
    ),
]

AWAKENING_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="awakening_mnemosyne_draught",
        name_en="Mnemosyne Draught",
        name_de="Mnemosyne-Trunk",
        tier=2,
        effect_type="stress_heal",
        effect_params={"stress_heal": 100, "when": "after_dungeon"},
        description_en=(
            "From the river of memory. Drinking it restores what the "
            "descent consumed. The taste is of recognition."
        ),
        description_de=(
            "Aus dem Fluss der Erinnerung. Ihn zu trinken stellt wieder "
            "her, was der Abstieg verbrauchte. Der Geschmack ist "
            "Wiedererkennung."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="awakening_collective_impression",
        name_en="Collective Impression",
        name_de="Kollektiver Eindruck",
        tier=2,
        effect_type="memory",
        effect_params={
            "importance": 6,
            "content_en": "Experienced shared consciousness \u2013 perceived through multiple perspectives simultaneously",
            "content_de": "Kollektives Bewusstsein erfahren \u2013 gleichzeitig durch mehrere Perspektiven wahrgenommen",
        },
        description_en="A memory that belongs to no single agent but to the party as gestalt.",
        description_de="Eine Erinnerung, die keinem einzelnen Agenten gehört, sondern der Gruppe als Gestalt.",
        drop_weight=25,
    ),
    LootItem(
        id="awakening_philemon_whisper",
        name_en="Philemon's Whisper",
        name_de="Philemons Flüstern",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"aptitude": "propagandist", "bonus_pct": 10},
        description_en=(
            "Thoughts are like animals in the forest \u2013 not generated by the thinker. "
            "Propagandist checks +10%."
        ),
        description_de=(
            "Gedanken sind wie Tiere im Wald \u2013 nicht vom Denker erzeugt. "
            "Propagandist-Proben +10%."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="awakening_zone_map",
        name_en="Zone Map",
        name_de="Zonenkarte",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"aptitude": "infiltrator", "bonus_pct": 10},
        description_en=(
            "Everything depends not on the Zone, but on the visitor. "
            "A map of the consciousness topology. Infiltrator checks +10%."
        ),
        description_de=(
            "Alles hängt nicht von der Zone ab, sondern vom Besucher. "
            "Eine Karte der Bewusstseinstopologie. Infiltrator-Proben +10%."
        ),
        drop_weight=20,
    ),
]

AWAKENING_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="awakening_insight",
        name_en="Awakening Insight",
        name_de="Erwachens-Erkenntnis",
        tier=3,
        effect_type="personality_modifier",
        effect_params={"big_five_delta": 0.1, "player_choice": True},
        description_en=(
            "The deepest insight. A shift in personality so fundamental "
            "it cannot be unlearned. Modify one agent's Big Five "
            "personality dimension by 0.1. The choice of which dimension "
            "is yours \u2013 and irreversible."
        ),
        description_de=(
            "Die tiefste Erkenntnis. Eine Persönlichkeitsverschiebung "
            "so fundamental, dass sie nicht verlernt werden kann. "
            "Verändere eine Big-Five-Persönlichkeitsdimension eines "
            "Agenten um 0.1. Die Wahl der Dimension ist deine \u2013 "
            "und unwiderruflich."
        ),
        drop_weight=40,
    ),
    LootItem(
        id="awakening_individuation_key",
        name_en="Individuation Key",
        name_de="Individuationsschlüssel",
        tier=3,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "spy", "boost": 1},
        description_en=(
            "Jung's key to individuation: the conscious integration "
            "of unconscious material. Perception permanently deepened. "
            "Spy aptitude +1."
        ),
        description_de=(
            "Jungs Schlüssel zur Individuation: die bewusste Integration "
            "unbewussten Materials. Wahrnehmung dauerhaft vertieft. "
            "Spion-Aptitude +1."
        ),
        drop_weight=35,
    ),
    LootItem(
        id="awakening_collective_resonance",
        name_en="Collective Resonance",
        name_de="Kollektive Resonanz",
        tier=3,
        effect_type="simulation_modifier",
        effect_params={
            "morale_boost": True,
            "duration_ticks": 10,
            "boost_amount": 0.15,
            "description_en": (
                "The collective consciousness bleeds into the simulation. "
                "All agents gain +15% morale for 10 heartbeat ticks."
            ),
            "description_de": (
                "Das kollektive Bewusstsein sickert in die Simulation. "
                "Alle Agenten erhalten +15% Moral für 10 Herzschlag-Ticks."
            ),
        },
        description_en=(
            "The collective consciousness resonates outward from the "
            "dungeon into the simulation itself. All agents gain "
            "+15% morale for 10 heartbeat ticks."
        ),
        description_de=(
            "Das kollektive Bewusstsein resoniert nach außen "
            "vom Dungeon in die Simulation selbst. Alle Agenten "
            "erhalten +15% Moral für 10 Herzschlag-Ticks."
        ),
        drop_weight=25,
    ),
]

AWAKENING_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: AWAKENING_LOOT_TIER_1,
    2: AWAKENING_LOOT_TIER_2,
    3: AWAKENING_LOOT_TIER_3,
}


# ══════════════════════════════════════════════════════════════════════════
#  THE OVERTHROW — Der Spiegelpalast
#  Political intelligence, faction leverage, authority fragments.
#  Loot reflects the political nature: dossiers, decrees, seals.
# ══════════════════════════════════════════════════════════════════════════

OVERTHROW_LOOT_TIER_1: list[LootItem] = [
    LootItem(
        id="overthrow_faction_dossier",
        name_en="Faction Dossier",
        name_de="Fraktionsdossier",
        tier=1,
        effect_type="stress_heal",
        effect_params={"stress_heal": 50, "when": "after_dungeon"},
        description_en=(
            "Names, alliances, debts. Kadare's Palace of Dreams "
            "made portable. Knowledge is not power — "
            "knowledge is the absence of fear."
        ),
        description_de=(
            "Namen, Bündnisse, Schulden. Kadares Palast der Träume, "
            "tragbar gemacht. Wissen ist nicht Macht — "
            "Wissen ist die Abwesenheit von Furcht."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="overthrow_propaganda_leaflet",
        name_en="Propaganda Leaflet",
        name_de="Propagandaflugblatt",
        tier=1,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "propagandist", "boost": 5, "duration_rooms": 5},
        description_en=(
            "Squealer's latest revision. The words are wrong "
            "but the technique is instructive."
        ),
        description_de=(
            "Schwatzwutz' neueste Überarbeitung. Die Worte sind falsch, "
            "aber die Technik ist lehrreich."
        ),
        drop_weight=30,
    ),
    LootItem(
        id="overthrow_informers_list",
        name_en="Informer's List",
        name_de="Spitzelliste",
        tier=1,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "spy", "boost": 5, "duration_rooms": 5},
        description_en=(
            "A list of names. Some are informers. Some are targets. "
            "The difference is a matter of perspective."
        ),
        description_de=(
            "Eine Namensliste. Manche sind Spitzel. Manche sind Ziele. "
            "Der Unterschied ist eine Frage der Perspektive."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="overthrow_safe_conduct",
        name_en="Safe Conduct Pass",
        name_de="Geleitbrief",
        tier=1,
        effect_type="dungeon_buff",
        effect_params={"stress_resist": 0.10, "duration_rooms": 4},
        description_en=(
            "Signed by a faction leader. Valid until the faction "
            "leader is replaced. Which could be any moment."
        ),
        description_de=(
            "Unterschrieben von einem Fraktionsführer. Gültig, bis der "
            "Fraktionsführer ersetzt wird. Was jederzeit sein könnte."
        ),
        drop_weight=15,
    ),
]

OVERTHROW_LOOT_TIER_2: list[LootItem] = [
    LootItem(
        id="overthrow_decoded_cipher",
        name_en="Decoded Cipher",
        name_de="Entschlüsselte Chiffre",
        tier=2,
        effect_type="stress_heal",
        effect_params={"stress_heal": 100, "when": "after_dungeon"},
        description_en=(
            "Faction communications, decoded. The content is less "
            "important than the fact of decoding. Manuscripts "
            "don't burn. But codes can be broken."
        ),
        description_de=(
            "Fraktionskommunikation, entschlüsselt. Der Inhalt ist "
            "weniger wichtig als die Tatsache der Entschlüsselung. "
            "Manuskripte brennen nicht. Aber Codes können geknackt werden."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="overthrow_seal_of_office",
        name_en="Seal of Office",
        name_de="Amtssiegel",
        tier=2,
        effect_type="aptitude_boost",
        effect_params={"aptitude": "propagandist", "boost": 10, "duration_rooms": 8},
        description_en=(
            "An official seal. The office no longer exists. "
            "The seal still carries weight — authority persists "
            "after the authority is gone."
        ),
        description_de=(
            "Ein Amtssiegel. Das Amt existiert nicht mehr. "
            "Das Siegel hat noch Gewicht — Autorität besteht fort, "
            "nachdem die Autorität vergangen ist."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="overthrow_double_agents_testimony",
        name_en="Double Agent's Testimony",
        name_de="Aussage des Doppelagenten",
        tier=2,
        effect_type="dungeon_buff",
        effect_params={"stress_resist": 0.15, "duration_rooms": 6},
        description_en=(
            "Ngũgĩ's informer-hero: the traitor whose confession "
            "is the most heroic act. This testimony protects "
            "because it reveals — and revelation is armor."
        ),
        description_de=(
            "Ngũgĩs Spitzel-Held: der Verräter, dessen Geständnis "
            "die heldenhafteste Tat ist. Diese Aussage schützt, "
            "weil sie enthüllt — und Enthüllung ist Rüstung."
        ),
        drop_weight=25,
    ),
    LootItem(
        id="overthrow_erased_photograph",
        name_en="Erased Photograph",
        name_de="Gelöschtes Foto",
        tier=2,
        effect_type="memory",
        effect_params={
            "memory_text_en": "A photograph with a scratched-out face. The hat remains.",
            "memory_text_de": "Ein Foto mit ausgekratztem Gesicht. Die Mütze bleibt.",
        },
        description_en=(
            "Kundera's Clementis photograph. The body erased, "
            "the fur hat remaining on Gottwald's head. "
            "Evidence that something was, before it was unmade."
        ),
        description_de=(
            "Kunderas Clementis-Foto. Der Körper gelöscht, "
            "die Pelzmütze noch auf Gottwalds Kopf. "
            "Beweis, dass etwas war, bevor es ungemacht wurde."
        ),
        drop_weight=25,
    ),
]

OVERTHROW_LOOT_TIER_3: list[LootItem] = [
    LootItem(
        id="overthrow_authority_fragment",
        name_en="Authority Fragment",
        name_de="Autoritätsfragment",
        tier=3,
        effect_type="simulation_modifier",
        effect_params={
            "security_boost": True,
            "duration_ticks": 10,
            "boost_amount": 1,
            "description_en": (
                "A fragment of legitimate authority, salvaged from the "
                "Spiegelpalast. Upgrades one zone's security level "
                "by 1 tier for 10 heartbeat ticks."
            ),
            "description_de": (
                "Ein Fragment legitimer Autorität, aus dem Spiegelpalast "
                "geborgen. Erhöht die Sicherheitsstufe einer Zone "
                "um 1 Stufe für 10 Herzschlag-Ticks."
            ),
        },
        description_en=(
            "Spec loot: upgrades one zone's security_level by 1 tier "
            "for 10 heartbeat ticks. Authority, portable."
        ),
        description_de=(
            "Spezifikationsbeute: erhöht die Sicherheitsstufe einer Zone "
            "um 1 Stufe für 10 Herzschlag-Ticks. Autorität, tragbar."
        ),
        drop_weight=40,
    ),
    LootItem(
        id="overthrow_colossus_splinter",
        name_en="Colossus Splinter",
        name_de="Koloss-Splitter",
        tier=3,
        effect_type="simulation_modifier",
        effect_params={
            "morale_boost": True,
            "duration_ticks": 10,
            "boost_amount": 0.15,
            "description_en": (
                "La Boétie's Colossus: the tyrant whose pedestal was "
                "pulled away. A splinter of the fallen. All agents "
                "gain +15% morale for 10 heartbeat ticks."
            ),
            "description_de": (
                "La Boéties Koloss: der Tyrann, dessen Sockel weggezogen "
                "wurde. Ein Splitter des Gefallenen. Alle Agenten "
                "erhalten +15% Moral für 10 Herzschlag-Ticks."
            ),
        },
        description_en=(
            "A splinter from the Colossus that fell of its own weight. "
            "La Boétie's proof: tyranny requires consent. "
            "All agents gain +15% morale for 10 heartbeat ticks."
        ),
        description_de=(
            "Ein Splitter des Kolosses, der unter seinem eigenen Gewicht "
            "fiel. La Boéties Beweis: Tyrannei braucht Zustimmung. "
            "Alle Agenten erhalten +15% Moral für 10 Herzschlag-Ticks."
        ),
        drop_weight=35,
    ),
    LootItem(
        id="overthrow_mirror_shard",
        name_en="Mirror Shard of the Spiegelpalast",
        name_de="Spiegelscherbe des Spiegelpalasts",
        tier=3,
        effect_type="personality_modifier",
        effect_params={
            "trait": "openness",
            "delta": 5,
            "description_en": "The mirror shows what the viewer wants, not what the viewer is. Openness +5.",
            "description_de": "Der Spiegel zeigt, was der Betrachter will, nicht was er ist. Offenheit +5.",
        },
        description_en=(
            "A shard of the Spiegelpalast's central mirror. "
            "It still reflects — but what it reflects "
            "is no longer the room."
        ),
        description_de=(
            "Eine Scherbe des zentralen Spiegels im Spiegelpalast. "
            "Sie reflektiert noch — aber was sie reflektiert, "
            "ist nicht mehr der Raum."
        ),
        drop_weight=20,
    ),
]

OVERTHROW_LOOT_TABLES: dict[int, list[LootItem]] = {
    1: OVERTHROW_LOOT_TIER_1,
    2: OVERTHROW_LOOT_TIER_2,
    3: OVERTHROW_LOOT_TIER_3,
}


# ── Archetype Loot Registry ──────────────────────────────────────────────

_LOOT_REGISTRIES: dict[str, dict[int, list[LootItem]]] = {
    "The Shadow": SHADOW_LOOT_TABLES,
    "The Tower": TOWER_LOOT_TABLES,
    "The Entropy": ENTROPY_LOOT_TABLES,
    "The Devouring Mother": MOTHER_LOOT_TABLES,
    "The Prometheus": PROMETHEUS_LOOT_TABLES,
    "The Deluge": DELUGE_LOOT_TABLES,
    "The Awakening": AWAKENING_LOOT_TABLES,
    "The Overthrow": OVERTHROW_LOOT_TABLES,
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
    from backend.services.dungeon_content_service import get_loot_registry

    loot_tables = get_loot_registry().get(archetype, {})
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
    elif archetype == "The Deluge":
        water_level = (archetype_state or {}).get("water_level", 0)
        mc = ARCHETYPE_CONFIGS.get("The Deluge", {}).get("mechanic_config", {})
        threshold = mc.get("low_water_loot_bonus_threshold", 25)
        bonus_chance = mc.get("low_water_loot_bonus_chance", 0.50)
        # Low-water bonus: water ≤ threshold → bonus_chance to upgrade T1→T2
        # Rewards water management discipline — keep levels low, find richer salvage
        if water_level <= threshold and tier == 1 and random.random() < bonus_chance:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
        # Depth bonus: deep rooms (depth ≤ 2) always roll T2 (inverted dungeon —
        # lower depth numbers are physically deeper, flood first, contain better loot)
        elif depth <= 2 and tier == 1:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
    elif archetype == "The Awakening":
        awareness = (archetype_state or {}).get("awareness", 0)
        mc = ARCHETYPE_CONFIGS.get("The Awakening", {}).get("mechanic_config", {})
        # Lucid bonus: awareness ≥ 70 → 40% chance T1→T2
        # High awareness = deeper perception = richer insights
        bonus_threshold = mc.get("lucid_loot_bonus_threshold", 70)
        bonus_chance = mc.get("lucid_loot_bonus_chance", 0.40)
        if awareness >= bonus_threshold and tier == 1 and random.random() < bonus_chance:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
        # Dissolution penalty: awareness ≥ 90 → 30% chance T2→T1
        # Too much awareness = Funes's curse — overload degrades loot quality
        downgrade_threshold = mc.get("dissolution_loot_downgrade_threshold", 90)
        downgrade_chance = mc.get("dissolution_loot_downgrade_chance", 0.30)
        if awareness >= downgrade_threshold and tier == 2 and random.random() < downgrade_chance:
            tier1_table = loot_tables.get(1, [])
            if tier1_table:
                tier1_weights = [item.drop_weight for item in tier1_table]
                selected = random.choices(tier1_table, weights=tier1_weights, k=1)

    elif archetype == "The Overthrow":
        fracture = (archetype_state or {}).get("fracture", 0)
        mc = ARCHETYPE_CONFIGS.get("The Overthrow", {}).get("mechanic_config", {})
        # Low fracture bonus: political stability rewards quality intelligence
        bonus_threshold = mc.get("low_fracture_loot_bonus_threshold", 20)
        bonus_chance = mc.get("low_fracture_loot_bonus_chance", 0.40)
        if fracture <= bonus_threshold and tier == 1 and random.random() < bonus_chance:
            tier2_table = loot_tables.get(2, [])
            if tier2_table:
                tier2_weights = [item.drop_weight for item in tier2_table]
                selected = random.choices(tier2_table, weights=tier2_weights, k=1)
        # High fracture penalty: chaos degrades loot quality
        downgrade_threshold = mc.get("high_fracture_loot_downgrade_threshold", 80)
        downgrade_chance = mc.get("high_fracture_loot_downgrade_chance", 0.30)
        if fracture >= downgrade_threshold and tier == 2 and random.random() < downgrade_chance:
            tier1_table = loot_tables.get(1, [])
            if tier1_table:
                tier1_weights = [item.drop_weight for item in tier1_table]
                selected = random.choices(tier1_table, weights=tier1_weights, k=1)

    return selected
