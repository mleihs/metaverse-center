"""Shadow loot tables — 3-tier loot system for Phase 0 MVP.

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
        name_de="Schattenrueckstand",
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
            "content_de": "Gelernt, Bewegung in der Dunkelheit zu spueren",
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
        description_de="Permanent: Agent erhaelt 'schatteneingestimmt' Moodlet.",
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
            "content_de": "Die Schatten des Unbewussten der Simulation erfahren. Perspektive auf ungeloeste Konflikte gewonnen.",
        },
        description_en="Creates a high-importance Reflection Memory about the dungeon experience.",
        description_de="Erzeugt eine hochbedeutende Reflexionserinnerung ueber die Dungeon-Erfahrung.",
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
        description_de="Permanent: +1 Spion-Eignung passiv in ALLEN zukuenftigen Schatten-Dungeons.",
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
        description_de="Nachster Schatten-Dungeon: Alle Raume vorher enthuellt, Sicht beginnt auf Maximum.",
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
        description_de="Permanent: Ein Agent erhaelt +1 Spion ODER Assassinen-Eignung. Maximal +2 gesamt.",
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


def roll_loot(
    tier: int,
    difficulty: int,
    depth: int,
    archetype_state: dict | None = None,
) -> list[LootItem]:
    """Roll for loot drops from the Shadow loot table.

    Args:
        tier: Loot tier (1=minor, 2=major, 3=legendary).
        difficulty: Dungeon difficulty (affects quality multiplier).
        depth: Current dungeon depth.
        archetype_state: Archetype-specific state (e.g. visibility for Shadow).

    Returns:
        List of LootItem drops. Tier 3 returns all guaranteed items.
        Tiers 1-2 return 1 item via weighted random.
    """
    table = SHADOW_LOOT_TABLES.get(tier, SHADOW_LOOT_TIER_1)

    if tier == 3:
        # Boss loot: all guaranteed items
        return list(table)

    # Check VP 0 bonus for Shadow (Review #7: brave in the dark = +50% loot)
    visibility = (archetype_state or {}).get("visibility", 3)
    vp0_bonus = visibility == 0

    # Weighted random selection (1 item)
    weights = [item.drop_weight for item in table]
    selected = random.choices(table, weights=weights, k=1)

    # If VP 0 and tier 1, upgrade to tier 2 with 50% chance
    if vp0_bonus and tier == 1 and random.random() < 0.5:
        tier2_table = SHADOW_LOOT_TABLES.get(2, [])
        if tier2_table:
            tier2_weights = [item.drop_weight for item in tier2_table]
            selected = random.choices(tier2_table, weights=tier2_weights, k=1)

    return selected
