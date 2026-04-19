# content-allowed: DELUGE_DEBRIS_POOL — tier-0 auto-apply pool not in DB content tables
"""Dungeon loot — runtime roll helpers + the Deluge debris pool.

Tiered loot content (Shadow/Tower/Entropy/Mother/Prometheus/Deluge/
Awakening/Overthrow tables × tiers 1-3) lives in
`content/dungeon/archetypes/{slug}/loot.yaml` (A1 externalization,
committed 2026-04-19). The per-archetype `*_LOOT_TIER_{1,2,3}` lists,
`*_LOOT_TABLES` maps, and the `_LOOT_REGISTRIES` dispatch table were
deleted in A1.5b. Runtime reads via
`dungeon_content_service.get_loot_registry()`.

The **Deluge debris pool** (`DELUGE_DEBRIS_POOL`) stays here: it is a
tier-0 auto-apply pool that does not go through the DB content tables
(migration 170 has no `tier=0` concept, no `dungeon_debris_pool` table).
The pool is consumed directly by `roll_debris()`, which is called by
`archetype_strategies.py` as part of the Deluge memory-toll mechanic.
Future work may externalize this to a separate pack (out of scope for
A1).

Review #20 context: permanent aptitude bonuses remain capped at +2 per
agent total; this limit is enforced in the loot-application code, not in
this file.
"""

from __future__ import annotations

import random

from backend.models.resonance_dungeon import LootItem
from backend.services.dungeon.dungeon_archetypes import ARCHETYPE_CONFIGS

# ── Deluge: Debris Pool (Tier 0, auto-apply, deposited by the current) ──────
#
# NOT stored in the DB content tables (no tier=0 schema in migration 170).
# The pool is consumed directly by `roll_debris()` below; packs may absorb
# it in a future phase.

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
        description_de="Ein Schutz gegen Druck, noch funktionsf\u00e4hig. Die Inschrift ist unleserlich, aber die Absicht besteht fort. W\u00e4chter-Proben +3%.",
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
        description_de="Von etwas, das einmal ein Werkzeug war. Die Kante h\u00e4lt noch. Saboteur-Proben +3%.",
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
