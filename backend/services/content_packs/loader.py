"""YAML content-pack loader.

Walks `content/dungeon/` and produces a `PackLoadResult` whose shape is
byte-compatible with `backend.services.dungeon_content_service._ContentCache`.
This means test seeding (`load_packs_for_tests`) and the runtime
cache-populate path both consume the same in-memory structure.

Directory layout expected:

    content/
      dungeon/
        archetypes/
          shadow/
            encounters.yaml
            banter.yaml
            loot.yaml
            enemies.yaml
            spawns.yaml
            anchors.yaml
            entrance_texts.yaml
            barometer_texts.yaml
          tower/
          mother/
          entropy/
          prometheus/
          deluge/
          awakening/
          overthrow/
        abilities/
          {school}.yaml

Files are individually optional during A1.1-A1.3: if a pack for an
archetype-slot does not exist yet, the loader silently skips it. This lets
the pilot (A1.2 Shadow) land before the other seven archetypes are
externalized.

Unknown YAML keys trigger a `pydantic.ValidationError` (pack models carry
`extra="forbid"`) so author typos surface at load time, not at runtime.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from backend.services.combat.ability_schools import Ability
from backend.services.content_packs.schemas import (
    ABILITY_PACK_SLUG,
    ARCHETYPE_NAME_TO_SLUG,
    ARCHETYPE_SLUG_TO_NAME,
    PACK_KIND_FOR_FILENAME,
    AbilityItem,
    AbilityPack,
    AnchorPack,
    BanterPack,
    BarometerTextPack,
    EncounterPack,
    EnemyPack,
    EntranceTextPack,
    LootPack,
    SpawnPack,
)

logger = logging.getLogger(__name__)

# ── Canonical on-disk root ────────────────────────────────────────────────

DEFAULT_PACK_ROOT: Path = Path(__file__).resolve().parents[3] / "content" / "dungeon"


# ── Load result (shape mirrors dungeon_content_service._ContentCache) ─────


@dataclass
class PackLoadResult:
    """In-memory snapshot of all content packs.

    Fields mirror `dungeon_content_service._ContentCache` so that the test
    harness can populate the runtime cache directly without shape
    translation.
    """

    banter: dict[str, list[dict]] = field(default_factory=dict)
    encounters: dict[str, list[Any]] = field(default_factory=dict)
    encounter_index: dict[str, Any] = field(default_factory=dict)
    enemies: dict[str, dict[str, Any]] = field(default_factory=dict)
    spawns: dict[str, dict[str, list[dict]]] = field(default_factory=dict)
    loot: dict[str, dict[int, list[Any]]] = field(default_factory=dict)
    anchors: dict[str, list[dict]] = field(default_factory=dict)
    entrance_texts: dict[str, list[dict]] = field(default_factory=dict)
    barometer_texts: dict[str, list[dict]] = field(default_factory=dict)
    abilities: dict[str, list[Any]] = field(default_factory=dict)

    def summary(self) -> str:
        return (
            f"banter={sum(len(v) for v in self.banter.values())} "
            f"enemies={sum(len(v) for v in self.enemies.values())} "
            f"encounters={sum(len(v) for v in self.encounters.values())} "
            f"choices={sum(len(e.choices) for lst in self.encounters.values() for e in lst)} "
            f"loot={sum(len(items) for tiers in self.loot.values() for items in tiers.values())} "
            f"anchors={sum(len(v) for v in self.anchors.values())} "
            f"entrance={sum(len(v) for v in self.entrance_texts.values())} "
            f"barometer={sum(len(v) for v in self.barometer_texts.values())} "
            f"abilities={sum(len(v) for v in self.abilities.values())}"
        )


# ── Overlay type alias ────────────────────────────────────────────────────

# Maps (pack_slug, resource_path) → raw YAML dict. Entries in an overlay
# take precedence over on-disk files for the same key; entries whose key
# has no on-disk counterpart are ingested as if the file existed.
OverlayMap = dict[tuple[str, str], dict[str, Any]]


# ── Public API ────────────────────────────────────────────────────────────


def load_packs(root: Path | None = None) -> PackLoadResult:
    """Load every YAML pack under `root` and return a validated result.

    Raises `pydantic.ValidationError` on structural problems. Does not
    perform cross-file invariant checks (FK integrity, global ID dedup,
    archetype completeness) — those live in
    `scripts/validate_content_packs.py`.
    """
    return load_packs_with_overlay(root, overlay={})


def load_packs_with_overlay(
    root: Path | None = None,
    *,
    overlay: OverlayMap,
) -> PackLoadResult:
    """Load packs from disk, substituting `overlay` entries before ingestion.

    For each `(pack_slug, resource_path)` key in `overlay`, the mapped
    dict replaces what would have been read from
    `content/dungeon/archetypes/{pack_slug}/{resource_path}.yaml`.
    Keys whose file does NOT exist on disk are still ingested (the overlay
    can introduce new pack files that haven't been written yet).

    Used by A1.7 publish flow to regenerate the dungeon_content_seed
    migration in the same PR as the YAML change — without writing the
    draft's working_content to disk first.

    Note: ingestors mutate the passed-in raw dict in-place (e.g.
    `_ingest_encounters` injects `archetype` via `setdefault`). Mutation
    is idempotent (setdefault no-ops on subsequent calls), but callers
    should not rely on overlay dict identity after this call.
    """
    root = (root or DEFAULT_PACK_ROOT).resolve()
    result = PackLoadResult()
    consumed: set[tuple[str, str]] = set()

    _load_archetype_trees(
        root / "archetypes", result, overlay=overlay, consumed=consumed,
    )
    _load_abilities_tree(
        root / "abilities", result, overlay=overlay, consumed=consumed,
    )
    # Orphans (overlay entries with no on-disk counterpart) are ingested LAST
    # so both tree-walkers have had their chance to match + mark entries as
    # consumed. New-file drafts for both archetype packs and ability schools
    # flow through the same orphan path; the orphan handler dispatches on
    # slug to pick the right ingestor.
    _ingest_overlay_orphans(overlay, consumed, result)
    _index_encounters(result)

    logger.info(
        "content packs loaded from %s (overlay=%d): %s",
        root, len(overlay), result.summary(),
    )
    return result


def load_packs_for_tests(root: Path | None = None) -> None:
    """Populate the dungeon_content_service cache from YAML packs.

    Used by `backend/tests/conftest.py` (A1.4+). After this call, the
    existing runtime getters (`get_encounter_registry()`, etc.) return
    pack-derived data without touching the DB.

    In A1.1-A1.3 this coexists with the Python-dict-backed test seeder;
    A1.4 switches conftest to call this exclusively.
    """
    from backend.services import dungeon_content_service as _dcs

    result = load_packs(root)
    _dcs._content = _dcs._ContentCache(  # noqa: SLF001 - deliberate cache swap
        banter=result.banter,
        encounters=result.encounters,
        encounter_index=result.encounter_index,
        enemies=result.enemies,
        spawns=result.spawns,
        loot=result.loot,
        anchors=result.anchors,
        entrance_texts=result.entrance_texts,
        barometer_texts=result.barometer_texts,
        abilities=result.abilities,
    )


# ── Internals: archetype tree ─────────────────────────────────────────────


def _load_archetype_trees(
    archetypes_root: Path,
    result: PackLoadResult,
    *,
    overlay: OverlayMap,
    consumed: set[tuple[str, str]],
) -> None:
    if not archetypes_root.is_dir():
        logger.debug("no archetypes directory at %s — skipping", archetypes_root)
        return

    for child in sorted(archetypes_root.iterdir()):
        if not child.is_dir():
            continue
        slug = child.name
        archetype = ARCHETYPE_SLUG_TO_NAME.get(slug)
        if archetype is None:
            logger.warning("unknown archetype slug '%s' under %s — skipping", slug, archetypes_root)
            continue
        _load_one_archetype(
            child, slug, archetype, result, overlay=overlay, consumed=consumed,
        )


def _load_one_archetype(
    folder: Path,
    slug: str,
    archetype: str,
    result: PackLoadResult,
    *,
    overlay: OverlayMap,
    consumed: set[tuple[str, str]],
) -> None:
    for file in sorted(folder.iterdir()):
        if file.suffix not in {".yaml", ".yml"}:
            continue
        stem = file.stem
        pack_cls = PACK_KIND_FOR_FILENAME.get(stem)
        if pack_cls is None:
            logger.warning("unknown pack file '%s' in %s — skipping", file.name, folder)
            continue
        ingest = _INGEST_DISPATCH.get(pack_cls)
        if ingest is None:
            # Defensive: a schema added to PACK_KIND_FOR_FILENAME without a
            # matching ingestor would silently no-op. Fail loudly instead.
            msg = f"no ingestor registered for pack class {pack_cls.__name__}"
            raise RuntimeError(msg)
        overlay_key = (slug, stem)
        if overlay_key in overlay:
            raw = overlay[overlay_key]
            consumed.add(overlay_key)
        else:
            raw = _read_yaml(file)
        ingest(raw, archetype, result)


def _ingest_overlay_orphans(
    overlay: OverlayMap,
    consumed: set[tuple[str, str]],
    result: PackLoadResult,
) -> None:
    """Ingest overlay entries that had no on-disk file counterpart.

    This handles the "new pack file" case — an overlay can introduce a
    `(slug, resource_path)` pair that has not been written to disk yet.
    Orphan entries are validated through the same ingestor pipeline as
    on-disk files, so Pydantic schema errors surface identically.

    Two slug dispatches:
      - Archetype slug (shadow, tower, ...) → look up the PACK_KIND from
        the resource_path stem, dispatch to the archetype-scoped ingestor.
      - `ABILITY_PACK_SLUG` ("abilities") → the resource_path is the school
        stem; validate via `AbilityPack` and append to `result.abilities`.
    """
    for key in sorted(set(overlay) - consumed):
        slug, stem = key
        if slug == ABILITY_PACK_SLUG:
            # Ability orphan: new-school draft without an on-disk file yet.
            # The ingestor is archetype-agnostic (AbilityItem carries `school`
            # as a first-class field), so we don't need an archetype lookup.
            _ingest_ability_pack(overlay[key], result)
            continue
        archetype = ARCHETYPE_SLUG_TO_NAME.get(slug)
        if archetype is None:
            msg = f"overlay references unknown archetype slug: {slug!r}"
            raise ValueError(msg)
        pack_cls = PACK_KIND_FOR_FILENAME.get(stem)
        if pack_cls is None:
            msg = f"overlay references unknown pack kind: {stem!r}"
            raise ValueError(msg)
        ingest = _INGEST_DISPATCH.get(pack_cls)
        if ingest is None:
            msg = f"no ingestor for overlay pack class {pack_cls.__name__}"
            raise RuntimeError(msg)
        ingest(overlay[key], archetype, result)


# ── Internals: per-pack ingestion ─────────────────────────────────────────


def _ingest_encounters(raw: dict, archetype: str, result: PackLoadResult) -> None:
    # Inject archetype on each encounter — saves author repetition in YAML.
    for item in raw.get("encounters", []):
        item.setdefault("archetype", archetype)
    pack = EncounterPack.model_validate(raw)
    result.encounters.setdefault(archetype, []).extend(pack.encounters)


def _ingest_banter(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = BanterPack.model_validate(raw)
    # Runtime cache stores banter as list[dict], not list[BanterItem], so
    # mirror that directly. The Pydantic step was the validation gate.
    result.banter.setdefault(archetype, []).extend(
        item.model_dump() for item in pack.banter
    )


def _ingest_loot(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = LootPack.model_validate(raw)
    tiers: dict[int, list] = defaultdict(list)
    for item in pack.loot:
        tiers[item.tier].append(item)
    per_archetype = result.loot.setdefault(archetype, {})
    for tier, items in tiers.items():
        per_archetype.setdefault(tier, []).extend(items)


def _ingest_enemies(raw: dict, archetype: str, result: PackLoadResult) -> None:
    for item in raw.get("enemies", []):
        item.setdefault("archetype", archetype)
    pack = EnemyPack.model_validate(raw)
    per_archetype = result.enemies.setdefault(archetype, {})
    for enemy in pack.enemies:
        per_archetype[enemy.id] = enemy


def _ingest_spawns(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = SpawnPack.model_validate(raw)
    per_archetype = result.spawns.setdefault(archetype, {})
    for spawn_id, entries in pack.spawns.items():
        per_archetype[spawn_id] = [e.model_dump() for e in entries]


def _ingest_anchors(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = AnchorPack.model_validate(raw)
    result.anchors.setdefault(archetype, []).extend(
        {
            "id": obj.id,
            "phases": {name: phase.model_dump() for name, phase in obj.phases.items()},
        }
        for obj in pack.anchors
    )


def _ingest_entrance_texts(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = EntranceTextPack.model_validate(raw)
    result.entrance_texts.setdefault(archetype, []).extend(
        {"text_en": t.text_en, "text_de": t.text_de} for t in pack.entrance_texts
    )


def _ingest_barometer_texts(raw: dict, archetype: str, result: PackLoadResult) -> None:
    pack = BarometerTextPack.model_validate(raw)
    result.barometer_texts.setdefault(archetype, []).extend(
        {"tier": t.tier, "text_en": t.text_en, "text_de": t.text_de} for t in pack.barometer_texts
    )


# Dispatch table: pack class → (raw_dict, archetype, result) ingestor. One
# source of truth for "which pack type uses which ingestion routine" — adding
# a new pack type is a two-line change (schema + dispatch row).

_Ingestor = Callable[[dict, str, "PackLoadResult"], None]

_INGEST_DISPATCH: dict[type, _Ingestor] = {
    EncounterPack: _ingest_encounters,
    BanterPack: _ingest_banter,
    LootPack: _ingest_loot,
    EnemyPack: _ingest_enemies,
    SpawnPack: _ingest_spawns,
    AnchorPack: _ingest_anchors,
    EntranceTextPack: _ingest_entrance_texts,
    BarometerTextPack: _ingest_barometer_texts,
}


# ── Internals: ability tree ───────────────────────────────────────────────


def _load_abilities_tree(
    abilities_root: Path,
    result: PackLoadResult,
    *,
    overlay: OverlayMap,
    consumed: set[tuple[str, str]],
) -> None:
    """Walk `content/dungeon/abilities/` and ingest each school YAML.

    Overlay addressing: ability drafts use `(ABILITY_PACK_SLUG, school_stem)`
    as their key (`pack_slug="abilities"`, `resource_path="spy"` etc.). When
    an overlay key matches an on-disk school, the overlay dict replaces the
    file read. New-school drafts that have no on-disk file yet are picked
    up by `_ingest_overlay_orphans` after this pass.
    """
    if not abilities_root.is_dir():
        logger.debug("no abilities directory at %s — skipping", abilities_root)
        # Overlay entries targeting abilities can still be ingested as orphans
        # even if the directory doesn't exist yet (first-time author scenario).
        return

    for file in sorted(abilities_root.iterdir()):
        if file.suffix not in {".yaml", ".yml"}:
            continue
        stem = file.stem
        overlay_key = (ABILITY_PACK_SLUG, stem)
        if overlay_key in overlay:
            raw = overlay[overlay_key]
            consumed.add(overlay_key)
        else:
            raw = _read_yaml(file)
        _ingest_ability_pack(raw, result)


def _ingest_ability_pack(raw: dict, result: PackLoadResult) -> None:
    """Validate + append one ability-pack raw dict into the load result.

    Separated from `_load_abilities_tree` so the orphan path can reuse it
    without re-implementing the per-item school dispatch.
    """
    pack = AbilityPack.model_validate(raw)
    for item in pack.abilities:
        result.abilities.setdefault(item.school, []).append(_to_runtime_ability(item))


def _to_runtime_ability(item: AbilityItem) -> Ability:
    """Convert a Pydantic `AbilityItem` to the runtime `Ability` dataclass.

    The runtime dataclass is the contract that combat code depends on;
    packs validate through Pydantic then flow through this adapter.
    """
    return Ability(
        id=item.id,
        name_en=item.name_en,
        name_de=item.name_de,
        school=item.school,
        description_en=item.description_en,
        description_de=item.description_de,
        min_aptitude=item.min_aptitude,
        cooldown=item.cooldown,
        effect_type=item.effect_type,
        effect_params=dict(item.effect_params),
        is_ultimate=item.is_ultimate,
        targets=item.targets,
    )


# ── Internals: shared helpers ─────────────────────────────────────────────


def _index_encounters(result: PackLoadResult) -> None:
    """Build `encounter_index` (id → template) for O(1) lookup."""
    for encounters in result.encounters.values():
        for enc in encounters:
            result.encounter_index[enc.id] = enc


def _read_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        msg = f"{path}: expected a top-level YAML mapping, got {type(data).__name__}"
        raise ValueError(msg)
    return data


__all__ = [
    "ARCHETYPE_NAME_TO_SLUG",
    "ARCHETYPE_SLUG_TO_NAME",
    "DEFAULT_PACK_ROOT",
    "OverlayMap",
    "PackLoadResult",
    "load_packs",
    "load_packs_for_tests",
    "load_packs_with_overlay",
]
