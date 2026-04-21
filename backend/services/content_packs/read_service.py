"""Admin read-only access to on-disk content packs (A1.7 Phase 3 Option B).

Sibling to `loader.py` (batch-loads ALL packs into a PackLoadResult for
runtime cache population) — this service exposes individual resources to
the admin UI so authors can open an existing YAML, see its current state,
and materialize a draft from it.

Scope:

  - `list_pack_resources()` walks `content/dungeon/archetypes/{slug}/*.yaml`
    AND `content/dungeon/abilities/*.yaml`, returning one manifest row per
    on-disk YAML with a quick entry count. Ability-pack rows carry the
    sentinel `pack_slug = ABILITY_PACK_SLUG = "abilities"`; the school
    name lives in `resource_path` so the `(pack_slug, resource_path)`
    uniqueness constraint on drafts covers every school cleanly.

  - `get_pack_resource(pack_slug, resource_path)` reads a single YAML
    (archetype OR ability, dispatched on pack_slug) and returns its
    parsed dict (including the top-level `schema_version` key). No
    Pydantic validation here — if the file is malformed the yaml parser
    raises and the caller surfaces 500.

Path safety: `pack_slug` and `resource_path` are validated by the router's
Pydantic Query regex (same as `ContentDraftCreate`). This service is
trusted; any traversal attempt would have been rejected before reaching
here, but we still `.is_relative_to(root)` as defense-in-depth before
touching disk.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from backend.services.content_packs.loader import DEFAULT_PACK_ROOT
from backend.services.content_packs.schemas import ABILITY_PACK_SLUG
from backend.utils.errors import bad_request, not_found

logger = logging.getLogger(__name__)

_ARCHETYPES_ROOT = DEFAULT_PACK_ROOT / "archetypes"
_ABILITIES_ROOT = DEFAULT_PACK_ROOT / "abilities"


def _count_entries(content: dict, pack_slug: str, resource_path: str) -> int:
    """Best-effort entry count for the manifest row.

    For archetype packs the top-level key equals `resource_path` (a banter
    YAML has a `banter:` key, an encounters YAML has `encounters:`, etc.).
    For ability packs the top-level key is always the literal `abilities:`
    regardless of which school the file represents — dispatch on pack_slug.

    Supports both array-backed collections (banter, encounters, enemies,
    loot, anchors, entrance_texts, barometer_texts, abilities) and object-
    backed (`spawns: {spawn_id: [entries]}`) layouts.
    """
    top_key = "abilities" if pack_slug == ABILITY_PACK_SLUG else resource_path
    value = content.get(top_key)
    if value is None:
        return 0
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict):
        total = 0
        for v in value.values():
            if isinstance(v, list):
                total += len(v)
        return total
    return 0


def _resource_file_path(pack_slug: str, resource_path: str) -> Path:
    """Resolve `(pack_slug, resource_path)` to an absolute YAML path.

    Dispatches on pack_slug: ability drafts live one directory shallower
    than archetype drafts. Defense-in-depth checks that the resolved path
    stays inside the intended root even if the router regex missed
    something exotic.
    """
    if pack_slug == ABILITY_PACK_SLUG:
        candidate = (_ABILITIES_ROOT / f"{resource_path}.yaml").resolve()
        if not candidate.is_relative_to(_ABILITIES_ROOT.resolve()):
            raise bad_request("Resolved path escapes the abilities content root.")
        return candidate
    candidate = (_ARCHETYPES_ROOT / pack_slug / f"{resource_path}.yaml").resolve()
    if not candidate.is_relative_to(_ARCHETYPES_ROOT.resolve()):
        raise bad_request("Resolved path escapes the archetypes content root.")
    return candidate


def list_pack_resources() -> list[dict[str, Any]]:
    """Walk archetypes/ + abilities/ and yield one manifest row per YAML file.

    Returns a list of dicts with shape:
        {
          "pack_slug": str,         # archetype stub OR ABILITY_PACK_SLUG
          "resource_path": str,     # banter / encounters / ... OR school name
          "entry_count": int,
          "file_path": str,         # for admin display, relative to content/
        }
    Results are sorted by pack_slug, then resource_path for stable output.
    """
    rows: list[dict[str, Any]] = []
    rows.extend(_walk_archetype_rows())
    rows.extend(_walk_ability_rows())
    rows.sort(key=lambda r: (r["pack_slug"], r["resource_path"]))
    return rows


def _walk_archetype_rows() -> list[dict[str, Any]]:
    """Emit one manifest row per archetype-pack YAML (archetypes/<slug>/*.yaml)."""
    if not _ARCHETYPES_ROOT.is_dir():
        logger.warning(
            "Archetypes root missing at %s — returning empty manifest.",
            _ARCHETYPES_ROOT,
        )
        return []

    rows: list[dict[str, Any]] = []
    for pack_dir in sorted(p for p in _ARCHETYPES_ROOT.iterdir() if p.is_dir()):
        pack_slug = pack_dir.name
        for yaml_file in sorted(pack_dir.glob("*.yaml")):
            rows.append(_build_manifest_row(yaml_file, pack_slug, yaml_file.stem))
    return rows


def _walk_ability_rows() -> list[dict[str, Any]]:
    """Emit one manifest row per ability-pack YAML (abilities/*.yaml).

    `pack_slug` is the sentinel `ABILITY_PACK_SLUG`; `resource_path` is
    the school name (the YAML file stem). First-time authors with no
    abilities dir yet get an empty list — not an error.
    """
    if not _ABILITIES_ROOT.is_dir():
        logger.debug(
            "Abilities root missing at %s — no ability-pack manifest rows.",
            _ABILITIES_ROOT,
        )
        return []

    rows: list[dict[str, Any]] = []
    for yaml_file in sorted(_ABILITIES_ROOT.glob("*.yaml")):
        rows.append(_build_manifest_row(yaml_file, ABILITY_PACK_SLUG, yaml_file.stem))
    return rows


def _build_manifest_row(
    yaml_file: Path, pack_slug: str, resource_path: str,
) -> dict[str, Any]:
    """Read one YAML file + return its manifest row.

    On YAML-parse failure surfaces entry_count=-1 so the admin UI can show
    a warning indicator rather than crashing the whole manifest endpoint.
    """
    entry_count = 0
    try:
        with yaml_file.open("r", encoding="utf-8") as f:
            content = yaml.safe_load(f) or {}
        if isinstance(content, dict):
            entry_count = _count_entries(content, pack_slug, resource_path)
    except yaml.YAMLError as err:
        logger.warning(
            "Failed to parse %s for manifest: %s", yaml_file, err,
        )
        entry_count = -1
    return {
        "pack_slug": pack_slug,
        "resource_path": resource_path,
        "entry_count": entry_count,
        # Relative to the repo root so admins see
        # `content/dungeon/{archetypes/<slug>|abilities}/{path}.yaml` — the
        # path they'd git-edit if they wanted to bypass the UI.
        "file_path": str(
            yaml_file.relative_to(DEFAULT_PACK_ROOT.parent.parent),
        ),
    }


def get_pack_resource(pack_slug: str, resource_path: str) -> dict[str, Any]:
    """Read a single pack YAML file and return its parsed dict.

    Dispatches on `pack_slug`: archetype slugs resolve to
    `archetypes/<slug>/<resource>.yaml`, `ABILITY_PACK_SLUG` resolves to
    the flat `abilities/<resource>.yaml`. The 404 `context` names the
    correct root so admins see a hint pointing at the right filesystem
    location.

    Raises 404 when the file is missing (no packs are auto-created from
    admin read requests), 400 on path-resolve / YAML-parse failures.
    """
    candidate = _resource_file_path(pack_slug, resource_path)
    if not candidate.is_file():
        root_hint = (
            "content/dungeon/abilities"
            if pack_slug == ABILITY_PACK_SLUG
            else "content/dungeon/archetypes"
        )
        raise not_found(
            "content_pack_resource",
            f"{pack_slug}/{resource_path}",
            context=f"No matching YAML under {root_hint}.",
        )
    try:
        with candidate.open("r", encoding="utf-8") as f:
            content = yaml.safe_load(f)
    except yaml.YAMLError as err:
        logger.exception(
            "YAML parse error while reading %s (pack=%s, resource=%s)",
            candidate, pack_slug, resource_path,
        )
        raise bad_request(
            f"YAML parse error in {pack_slug}/{resource_path}.yaml: {err}",
        ) from err
    if not isinstance(content, dict):
        # Defensive: YAML files for content packs are always top-level
        # mappings. A scalar or list here means the file is malformed.
        raise bad_request(
            f"Content pack {pack_slug}/{resource_path} is not a YAML mapping.",
        )
    return content
