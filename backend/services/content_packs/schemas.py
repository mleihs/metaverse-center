"""Pydantic schemas for YAML content packs.

Each pack file contains a `schema_version` and one top-level collection
(e.g. `encounters:`, `banter:`, `loot:`). Filename and path determine the
content_type and archetype — the loader injects archetype based on the
parent directory (`content/dungeon/archetypes/shadow/...`), so author YAML
does NOT repeat the archetype name per item.

Where possible we reuse the existing runtime models from
`backend.models.resonance_dungeon` — changes there flow automatically into
the pack schema and avoid drift.

Validation posture:
  - Strict: unknown fields raise (catches typos early).
  - Bilingual pairs are required when a feature is used (e.g. a choice with
    `check_aptitude` MUST have a `partial_narrative_*`).
  - Cross-file invariants (FK integrity, global ID uniqueness, archetype
    completeness) are enforced by `validate_content_packs.py`, not by
    individual pack-model validators.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Re-use runtime models where possible: EncounterTemplate / EncounterChoice /
# EnemyTemplate / LootItem already exist in backend.models.resonance_dungeon.
# Changes to those models flow automatically into the pack schema.
from backend.models.resonance_dungeon import (
    EncounterChoice,
    EncounterTemplate,
    EnemyTemplate,
    LootItem,
)

# ── Archetype path mapping ────────────────────────────────────────────────
#
# Authors place YAML under `content/dungeon/archetypes/<slug>/*.yaml`. The
# loader maps slug → the canonical archetype name used everywhere in the
# runtime (`"The Shadow"`, `"The Devouring Mother"`, ...). Having a single
# mapping here prevents the legacy `_TIER_FIELD_FOR_ARCHETYPE` pattern
# where every generator re-declared the list.

ARCHETYPE_SLUG_TO_NAME: dict[str, str] = {
    "shadow": "The Shadow",
    "tower": "The Tower",
    "mother": "The Devouring Mother",
    "entropy": "The Entropy",
    "prometheus": "The Prometheus",
    "deluge": "The Deluge",
    "awakening": "The Awakening",
    "overthrow": "The Overthrow",
}

ARCHETYPE_NAME_TO_SLUG: dict[str, str] = {v: k for k, v in ARCHETYPE_SLUG_TO_NAME.items()}

# Tier field per archetype — extracted from legacy
# `_TIER_FIELD_FOR_ARCHETYPE` in the old extract script. Banter can be
# gated on an archetype-specific tier (decay_tier for Entropy,
# attachment_tier for Mother, etc.). Shadow and Tower do not use this.
TIER_FIELD_FOR_ARCHETYPE: dict[str, str] = {
    "The Entropy": "decay_tier",
    "The Devouring Mother": "attachment_tier",
    "The Prometheus": "insight_tier",
    "The Deluge": "water_tier",
    "The Awakening": "awareness_tier",
    "The Overthrow": "fracture_tier",
}


# ── Forbid-extra base ─────────────────────────────────────────────────────


class _StrictModel(BaseModel):
    """Base class: unknown YAML keys raise ValidationError.

    Catches author typos at load time (e.g. `desciption_en` → fail).
    """

    model_config = ConfigDict(extra="forbid")


# ── Pack-level items (one per DB table) ───────────────────────────────────


class BanterItem(_StrictModel):
    """One between-encounter banter template.

    `personality_filter` is intentionally a loose dict: values can be
    `[min, max]` tuples for a Big-Five dimension (e.g.
    `neuroticism: [0.6, 1.0]`) OR `True`/`False` flags for non-trait
    matchers like `opinion_positive_pair`. Runtime filter logic in
    `dungeon_banter.select_banter` dispatches on the value type.
    """

    id: str
    trigger: str
    personality_filter: dict[str, list[float] | bool | None] = Field(default_factory=dict)
    text_en: str
    text_de: str
    decay_tier: int | None = None
    attachment_tier: int | None = None
    insight_tier: int | None = None
    water_tier: int | None = None
    awareness_tier: int | None = None
    fracture_tier: int | None = None


class SpawnEntry(_StrictModel):
    """One enemy placement within a spawn config."""

    template_id: str
    count: int = 1


class AnchorPhase(_StrictModel):
    """One phase of an objektanker (discovery / echo / mutation / climax)."""

    text_en: str
    text_de: str
    state_effect: dict = Field(default_factory=dict)


class AnchorObject(_StrictModel):
    """An objektanker — a named object migrating through a dungeon in phases."""

    id: str
    phases: dict[Literal["discovery", "echo", "mutation", "climax"], AnchorPhase]


class BilingualText(_StrictModel):
    """A pair of bilingual strings (entrance atmosphere, etc.)."""

    text_en: str
    text_de: str


class BarometerEntry(_StrictModel):
    """One archetype-state-to-prose mapping row."""

    tier: int = Field(ge=0, le=3)
    text_en: str
    text_de: str


class AbilityItem(_StrictModel):
    """A combat ability. Mirrors the Ability @dataclass in
    `backend.services.combat.ability_schools`; the loader constructs the
    runtime dataclass instance.
    """

    id: str
    name_en: str
    name_de: str
    school: str
    description_en: str
    description_de: str
    min_aptitude: int = 3
    cooldown: int = 0
    effect_type: str = "damage"
    effect_params: dict = Field(default_factory=dict)
    is_ultimate: bool = False
    targets: Literal[
        "single_enemy", "all_enemies", "single_ally", "all_allies", "self"
    ] = "single_enemy"


# ── Pack root types (one class per YAML file layout) ──────────────────────
#
# Every pack has `schema_version` so the loader can reject future
# incompatible schemas explicitly. Increment on breaking changes; migrate
# old packs in-place or write a one-shot upgrade script.

_CURRENT_SCHEMA_VERSION: int = 1


class _VersionedPack(_StrictModel):
    schema_version: int = _CURRENT_SCHEMA_VERSION


class EncounterPack(_VersionedPack):
    encounters: list[EncounterTemplate]


class BanterPack(_VersionedPack):
    banter: list[BanterItem]


class LootPack(_VersionedPack):
    loot: list[LootItem]


class EnemyPack(_VersionedPack):
    enemies: list[EnemyTemplate]


class SpawnPack(_VersionedPack):
    """Spawn configs keyed by combat_encounter_id.

    YAML shape:
        spawns:
          shadow_whispers_spawn:
            - {template_id: shadow_wisp, count: 2}
            - {template_id: shadow_tendril, count: 1}
    """

    spawns: dict[str, list[SpawnEntry]]


class AnchorPack(_VersionedPack):
    anchors: list[AnchorObject]


class EntranceTextPack(_VersionedPack):
    entrance_texts: list[BilingualText]


class BarometerTextPack(_VersionedPack):
    barometer_texts: list[BarometerEntry]


class AbilityPack(_VersionedPack):
    abilities: list[AbilityItem]


# ── Pack kind registry ────────────────────────────────────────────────────
#
# Maps filename stem → (pack model class, content_type tag). A single
# source of truth — loader and validator both import from here.

PACK_KIND_FOR_FILENAME: dict[str, type[_VersionedPack]] = {
    "encounters": EncounterPack,
    "banter": BanterPack,
    "loot": LootPack,
    "enemies": EnemyPack,
    "spawns": SpawnPack,
    "anchors": AnchorPack,
    "entrance_texts": EntranceTextPack,
    "barometer_texts": BarometerTextPack,
}

# Abilities live under content/dungeon/abilities/<school>.yaml and are NOT
# per-archetype. Separate registry so the loader can dispatch correctly.
ABILITY_PACK_CLASS: type[AbilityPack] = AbilityPack


# ── Re-exports (for loader / generator / validator convenience) ───────────

__all__ = [
    "ARCHETYPE_NAME_TO_SLUG",
    "ARCHETYPE_SLUG_TO_NAME",
    "TIER_FIELD_FOR_ARCHETYPE",
    "ABILITY_PACK_CLASS",
    "AbilityItem",
    "AbilityPack",
    "AnchorObject",
    "AnchorPack",
    "AnchorPhase",
    "BanterItem",
    "BanterPack",
    "BarometerEntry",
    "BarometerTextPack",
    "BilingualText",
    "EncounterChoice",
    "EncounterPack",
    "EncounterTemplate",
    "EnemyPack",
    "EnemyTemplate",
    "EntranceTextPack",
    "LootItem",
    "LootPack",
    "PACK_KIND_FOR_FILENAME",
    "SpawnEntry",
    "SpawnPack",
]
