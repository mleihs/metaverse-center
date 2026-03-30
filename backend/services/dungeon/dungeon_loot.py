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
        description_de="Ein Fragment des Verstandnisses, gewonnen in der Dunkelheit.",
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
        description_en="Consumable: one Propagandist ability deals +50% stress damage this dungeon.",
        description_de="Verbrauchsgegenstand: Eine Propagandisten-Fahigkeit verursacht +50% Stressschaden in diesem Dungeon.",
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
            "content_de": "Der Dunkelheit entgegengetreten und bestanden. Die Erfahrung veranderte grundlegend, wie sie Bedrohung und Angst wahrnehmen.",
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
        description_de="Falls passender Erzaehlbogen existiert: Druck reduziert.",
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
        description_de="Permanent: +0.05 Gesamtgesundheit der Simulation. Das Opfer des Turms stabilisiert die Realitaet.",
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

# ── Archetype Loot Registry ──────────────────────────────────────────────

_LOOT_REGISTRIES: dict[str, dict[int, list[LootItem]]] = {
    "The Shadow": SHADOW_LOOT_TABLES,
    "The Tower": TOWER_LOOT_TABLES,
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

    return selected
