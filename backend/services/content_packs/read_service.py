"""Admin read-only access to on-disk content packs (A1.7 Phase 3 Option B).

Sibling to `loader.py` (batch-loads ALL packs into a PackLoadResult for
runtime cache population) — this service exposes individual resources to
the admin UI so authors can open an existing YAML, see its current state,
and materialize a draft from it.

Scope for MVP:

  - `list_pack_resources()` walks `content/dungeon/archetypes/{slug}/*.yaml`
    and returns one manifest row per on-disk YAML with a quick entry count.
    Ability-school packs under `content/dungeon/abilities/` are NOT exposed
    yet — the publish pipeline's file-path composition for those needs
    separate work (tracked as a Phase 4 item).

  - `get_pack_resource(pack_slug, resource_path)` reads a single archetype
    YAML and returns its parsed dict (including the top-level
    `schema_version` key). No pydantic validation here — if the file is
    malformed, the yaml parser raises and the caller surfaces 500.

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
from backend.utils.errors import bad_request, not_found

logger = logging.getLogger(__name__)

_ARCHETYPES_ROOT = DEFAULT_PACK_ROOT / "archetypes"


def _count_entries(content: dict, resource_path: str) -> int:
    """Best-effort entry count for the manifest row.

    The collection lives under `content[resource_path]` for well-formed
    packs. Supports both array-backed collections (banter, encounters,
    enemies, loot, anchors, entrance_texts, barometer_texts) and object-
    backed (`spawns: {spawn_id: [entries]}`) layouts.
    """
    value = content.get(resource_path)
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
    candidate = (_ARCHETYPES_ROOT / pack_slug / f"{resource_path}.yaml").resolve()
    # Defense-in-depth: ensure the resolved path stays inside the archetypes
    # root even if the regex missed something exotic.
    if not candidate.is_relative_to(_ARCHETYPES_ROOT.resolve()):
        raise bad_request("Resolved path escapes the archetypes content root.")
    return candidate


def list_pack_resources() -> list[dict[str, Any]]:
    """Walk archetypes/ and yield one manifest row per YAML file.

    Returns a list of dicts with shape:
        {
          "pack_slug": str,
          "resource_path": str,
          "entry_count": int,
          "file_path": str,  # for admin display, relative to content/
        }
    Results are sorted by pack_slug, then resource_path for stable output.
    """
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
            resource_path = yaml_file.stem
            entry_count = 0
            try:
                with yaml_file.open("r", encoding="utf-8") as f:
                    content = yaml.safe_load(f) or {}
                if isinstance(content, dict):
                    entry_count = _count_entries(content, resource_path)
            except yaml.YAMLError as err:
                # Bad YAML makes entry counting impossible — surface -1 so
                # the admin UI can render a warning indicator rather than
                # crashing the whole manifest endpoint.
                logger.warning(
                    "Failed to parse %s for manifest: %s", yaml_file, err,
                )
                entry_count = -1
            rows.append(
                {
                    "pack_slug": pack_slug,
                    "resource_path": resource_path,
                    "entry_count": entry_count,
                    # Relative to the repo root so admins see
                    # `content/dungeon/archetypes/{slug}/{path}.yaml` — the
                    # path they'd git-edit if they wanted to bypass the UI.
                    "file_path": str(
                        yaml_file.relative_to(DEFAULT_PACK_ROOT.parent.parent),
                    ),
                },
            )
    return rows


def get_pack_resource(pack_slug: str, resource_path: str) -> dict[str, Any]:
    """Read a single archetype YAML file and return its parsed dict.

    Raises 404 when the file is missing (no packs are auto-created from
    admin read requests), 400 on path-resolve failures.
    """
    candidate = _resource_file_path(pack_slug, resource_path)
    if not candidate.is_file():
        raise not_found(
            "content_pack_resource",
            f"{pack_slug}/{resource_path}",
            context="No matching YAML under content/dungeon/archetypes.",
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
