"""Dungeon content cache — loads content from DB, caches in memory.

All dungeon content (banter, encounters, enemies, loot, abilities, etc.)
is loaded from DB tables at startup and cached in a module-level dataclass.
Admin CRUD endpoints call invalidate() after mutations to trigger a reload.

Pattern follows cache_config.py: module-level cache, lazy load, invalidate().
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field

import sentry_sdk

from backend.models.resonance_dungeon import (
    EncounterChoice,
    EncounterTemplate,
    EnemyTemplate,
    LootItem,
)
from backend.services.combat.ability_schools import Ability
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Cache dataclass ───────────────────────────────────────────────────────


@dataclass
class _ContentCache:
    """In-memory cache of all dungeon content tables."""

    banter: dict[str, list[dict]] = field(default_factory=dict)
    encounters: dict[str, list[EncounterTemplate]] = field(default_factory=dict)
    encounter_index: dict[str, EncounterTemplate] = field(default_factory=dict)
    enemies: dict[str, dict[str, EnemyTemplate]] = field(default_factory=dict)
    spawns: dict[str, dict[str, list[dict]]] = field(default_factory=dict)
    loot: dict[str, dict[int, list[LootItem]]] = field(default_factory=dict)
    anchors: dict[str, list[dict]] = field(default_factory=dict)
    entrance_texts: dict[str, list[dict]] = field(default_factory=dict)
    barometer_texts: dict[str, list[dict]] = field(default_factory=dict)
    abilities: dict[str, list[Ability]] = field(default_factory=dict)


# ── Module-level cache ────────────────────────────────────────────────────

_content: _ContentCache | None = None


# ── Loading ───────────────────────────────────────────────────────────────


async def load_all_content(supabase: Client) -> None:
    """Load all dungeon content from DB into memory cache.

    Called at app startup (lifespan) and after admin cache reload.
    Uses service_role client — content tables have public-read RLS
    but we use admin client for consistency with other startup loads.
    """
    global _content  # noqa: PLW0603

    try:
        # Parallel queries for all 10 tables
        (
            banter_res,
            enemy_res,
            spawn_res,
            encounter_res,
            choice_res,
            loot_res,
            anchor_res,
            entrance_res,
            barometer_res,
            ability_res,
        ) = await asyncio.gather(
            supabase.table("dungeon_banter").select("*").order("sort_order").execute(),
            supabase.table("dungeon_enemy_templates").select("*").order("sort_order").execute(),
            supabase.table("dungeon_spawn_configs").select("*").execute(),
            supabase.table("dungeon_encounter_templates").select("*").order("sort_order").execute(),
            supabase.table("dungeon_encounter_choices").select("*").order("sort_order").execute(),
            supabase.table("dungeon_loot_items").select("*").order("sort_order").execute(),
            supabase.table("dungeon_anchor_objects").select("*").order("sort_order").execute(),
            supabase.table("dungeon_entrance_texts").select("*").order("sort_order").execute(),
            supabase.table("dungeon_barometer_texts").select("*").order("archetype,tier").execute(),
            supabase.table("combat_abilities").select("*").order("sort_order").execute(),
        )

        cache = _ContentCache()

        # ── Banter ────────────────────────────────────────────────────────
        banter_by_arch: dict[str, list[dict]] = defaultdict(list)
        for row in extract_list(banter_res):
            banter_by_arch[row["archetype"]].append(row)
        cache.banter = dict(banter_by_arch)

        # ── Enemy Templates ───────────────────────────────────────────────
        enemies_by_arch: dict[str, dict[str, EnemyTemplate]] = defaultdict(dict)
        for row in extract_list(enemy_res):
            tmpl = EnemyTemplate(**row)
            enemies_by_arch[row["archetype"]][row["id"]] = tmpl
        cache.enemies = dict(enemies_by_arch)

        # ── Spawn Configs ─────────────────────────────────────────────────
        spawns_by_arch: dict[str, dict[str, list[dict]]] = defaultdict(dict)
        for row in extract_list(spawn_res):
            spawns_by_arch[row["archetype"]][row["id"]] = row["entries"]
        cache.spawns = dict(spawns_by_arch)

        # ── Encounter Templates + Choices ─────────────────────────────────
        # First, group choices by encounter_id
        choices_by_enc: dict[str, list[dict]] = defaultdict(list)
        for row in extract_list(choice_res):
            choices_by_enc[row["encounter_id"]].append(row)

        encounters_by_arch: dict[str, list[EncounterTemplate]] = defaultdict(list)
        encounter_index: dict[str, EncounterTemplate] = {}
        for row in extract_list(encounter_res):
            # Build EncounterChoice objects from joined rows
            choice_rows = choices_by_enc.get(row["id"], [])
            choices = [
                EncounterChoice(
                    id=c["id"],
                    label_en=c["label_en"],
                    label_de=c["label_de"],
                    requires_aptitude=c.get("requires_aptitude"),
                    requires_profession=c.get("requires_profession"),
                    check_aptitude=c.get("check_aptitude"),
                    check_difficulty=c.get("check_difficulty", 0),
                    success_effects=c.get("success_effects", {}),
                    partial_effects=c.get("partial_effects", {}),
                    fail_effects=c.get("fail_effects", {}),
                    success_narrative_en=c.get("success_narrative_en", ""),
                    success_narrative_de=c.get("success_narrative_de", ""),
                    partial_narrative_en=c.get("partial_narrative_en", ""),
                    partial_narrative_de=c.get("partial_narrative_de", ""),
                    fail_narrative_en=c.get("fail_narrative_en", ""),
                    fail_narrative_de=c.get("fail_narrative_de", ""),
                )
                for c in choice_rows
            ]

            enc = EncounterTemplate(
                id=row["id"],
                archetype=row["archetype"],
                room_type=row["room_type"],
                min_depth=row.get("min_depth", 0),
                max_depth=row.get("max_depth", 99),
                min_difficulty=row.get("min_difficulty", 1),
                requires_aptitude=row.get("requires_aptitude"),
                description_en=row.get("description_en", ""),
                description_de=row.get("description_de", ""),
                choices=choices,
                combat_encounter_id=row.get("combat_encounter_id"),
                is_ambush=row.get("is_ambush", False),
                ambush_stress=row.get("ambush_stress", 0),
            )
            encounters_by_arch[row["archetype"]].append(enc)
            encounter_index[row["id"]] = enc

        cache.encounters = dict(encounters_by_arch)
        cache.encounter_index = encounter_index

        # ── Validate narrative coverage ──────────────────────────────────
        # Choices with check_aptitude can resolve to partial — they MUST have
        # partial_narrative_en. Log warnings at startup so gaps are visible.
        for arch, enc_list in encounters_by_arch.items():
            for enc in enc_list:
                for choice in enc.choices:
                    if choice.check_aptitude and not choice.partial_narrative_en:
                        logger.warning(
                            "Encounter choice %s (encounter %s, archetype %s) has "
                            "check_aptitude=%s but no partial_narrative_en",
                            choice.id,
                            enc.id,
                            arch,
                            choice.check_aptitude,
                        )

        # ── Loot Items ────────────────────────────────────────────────────
        loot_by_arch: dict[str, dict[int, list[LootItem]]] = defaultdict(lambda: defaultdict(list))
        for row in extract_list(loot_res):
            item = LootItem(**row)
            loot_by_arch[row["archetype"]][row["tier"]].append(item)
        cache.loot = {arch: dict(tiers) for arch, tiers in loot_by_arch.items()}

        # ── Anchor Objects ────────────────────────────────────────────────
        anchors_by_arch: dict[str, list[dict]] = defaultdict(list)
        for row in extract_list(anchor_res):
            anchors_by_arch[row["archetype"]].append(
                {
                    "id": row["id"],
                    "phases": row["phases"],
                }
            )
        cache.anchors = dict(anchors_by_arch)

        # ── Entrance Texts ────────────────────────────────────────────────
        entrance_by_arch: dict[str, list[dict]] = defaultdict(list)
        for row in extract_list(entrance_res):
            entrance_by_arch[row["archetype"]].append(
                {
                    "text_en": row["text_en"],
                    "text_de": row["text_de"],
                }
            )
        cache.entrance_texts = dict(entrance_by_arch)

        # ── Barometer Texts ───────────────────────────────────────────────
        barometer_by_arch: dict[str, list[dict]] = defaultdict(list)
        for row in extract_list(barometer_res):
            barometer_by_arch[row["archetype"]].append(
                {
                    "tier": row["tier"],
                    "text_en": row["text_en"],
                    "text_de": row["text_de"],
                }
            )
        cache.barometer_texts = dict(barometer_by_arch)

        # ── Combat Abilities ──────────────────────────────────────────────
        abilities_by_school: dict[str, list[Ability]] = defaultdict(list)
        for row in extract_list(ability_res):
            ability = Ability(
                id=row["id"],
                name_en=row["name_en"],
                name_de=row["name_de"],
                school=row["school"],
                description_en=row.get("description_en", ""),
                description_de=row.get("description_de", ""),
                min_aptitude=row.get("min_aptitude", 3),
                cooldown=row.get("cooldown", 0),
                effect_type=row.get("effect_type", "damage"),
                effect_params=row.get("effect_params", {}),
                is_ultimate=row.get("is_ultimate", False),
                targets=row.get("targets", "single_enemy"),
            )
            abilities_by_school[row["school"]].append(ability)
        cache.abilities = dict(abilities_by_school)

        # Swap cache atomically (GIL-safe pointer swap)
        _content = cache

        # Log summary
        total_banter = sum(len(v) for v in cache.banter.values())
        total_enemies = sum(len(v) for v in cache.enemies.values())
        total_encounters = sum(len(v) for v in cache.encounters.values())
        total_choices = sum(len(e.choices) for el in cache.encounters.values() for e in el)
        total_loot = sum(len(items) for tiers in cache.loot.values() for items in tiers.values())
        total_anchors = sum(len(v) for v in cache.anchors.values())
        total_abilities = sum(len(v) for v in cache.abilities.values())
        logger.info(
            "Dungeon content loaded: %d banter, %d enemies, %d encounters (%d choices), "
            "%d loot, %d anchors, %d abilities",
            total_banter,
            total_enemies,
            total_encounters,
            total_choices,
            total_loot,
            total_anchors,
            total_abilities,
        )

        # Warn on empty tables (seed may not have run)
        if total_banter == 0:
            logger.warning("dungeon_banter table is empty — seed data may not be applied")
        if total_encounters == 0:
            logger.warning("dungeon_encounter_templates table is empty — seed data may not be applied")

    except Exception:
        logger.exception("Failed to load dungeon content from DB")
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("service", "dungeon_content")
            scope.set_tag("operation", "load_all_content")
            sentry_sdk.capture_exception()
        raise


def invalidate() -> None:
    """Clear the content cache.

    WARNING: After calling this, all getters will raise RuntimeError until
    load_all_content() is called again. For admin CRUD, prefer calling
    load_all_content() directly — it atomically swaps the cache pointer
    without a window of unavailability.
    """
    global _content  # noqa: PLW0603
    _content = None
    logger.info("Dungeon content cache invalidated")


# ── Getters (lazy reload if cache is None) ────────────────────────────────


def _ensure_loaded() -> _ContentCache:
    """Return the cache, raising if not yet loaded.

    Content is loaded at startup via load_all_content(). If the cache
    was invalidated and not yet reloaded, this raises to prevent
    serving stale or missing data.
    """
    if _content is None:
        msg = "Dungeon content cache is not loaded. Call load_all_content() at startup or after invalidation."
        logger.error(msg)
        raise RuntimeError(msg)
    return _content


def get_banter_registry() -> dict[str, list[dict]]:
    """Archetype → list of banter dicts."""
    return _ensure_loaded().banter


def get_encounter_registry() -> dict[str, list[EncounterTemplate]]:
    """Archetype → list of EncounterTemplate."""
    return _ensure_loaded().encounters


def get_encounter_by_id_cached(encounter_id: str) -> EncounterTemplate | None:
    """Look up encounter template by ID (any archetype)."""
    return _ensure_loaded().encounter_index.get(encounter_id)


def get_enemy_registry() -> dict[str, dict[str, EnemyTemplate]]:
    """Archetype → {enemy_id: EnemyTemplate}."""
    return _ensure_loaded().enemies


def get_spawn_registry() -> dict[str, dict[str, list[dict]]]:
    """Archetype → {spawn_config_id: [{template_id, count}]}."""
    return _ensure_loaded().spawns


def get_loot_registry() -> dict[str, dict[int, list[LootItem]]]:
    """Archetype → {tier: [LootItem]}."""
    return _ensure_loaded().loot


def get_anchor_objects() -> dict[str, list[dict]]:
    """Archetype → list of anchor object dicts with phases."""
    return _ensure_loaded().anchors


def get_entrance_texts() -> dict[str, list[dict]]:
    """Archetype → list of {text_en, text_de}."""
    return _ensure_loaded().entrance_texts


def get_barometer_registry() -> dict[str, list[dict]]:
    """Archetype → list of {tier, text_en, text_de}."""
    return _ensure_loaded().barometer_texts


def get_ability_registry() -> dict[str, list[Ability]]:
    """School → list of Ability."""
    return _ensure_loaded().abilities
