"""One-shot extractor: Python dict registries → YAML content packs.

Runs once per archetype during phase A1.2 (pilot: Shadow) and A1.3 (the
remaining seven). After extraction, the YAML packs become the canonical
source; the Python dicts stay in place until A1.5 as a diff-test anchor.

Usage:
    python scripts/extract_python_to_pack.py --archetype shadow
    python scripts/extract_python_to_pack.py --archetype tower --output-root content/dungeon
    python scripts/extract_python_to_pack.py --all   # all 8 archetypes + abilities
    python scripts/extract_python_to_pack.py --abilities-only

This script imports the legacy Python registries. It is intentionally
scoped to the A1 migration window — once A1.5 removes the registries, this
file should be deleted along with them.

All YAML output uses:
  - Block-style scalars (`|`) for multi-line prose.
  - `allow_unicode=True` so en-dashes and German umlauts land verbatim.
  - `sort_keys=False` to preserve the field order that matches the
    Pydantic model declaration (readability > alphabetization).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.content_packs.schemas import (  # noqa: E402
    ARCHETYPE_NAME_TO_SLUG,
    TIER_FIELD_FOR_ARCHETYPE,
)

DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "content" / "dungeon"


# ── YAML formatting helpers ──────────────────────────────────────────────


class _LiteralStr(str):
    """Marker class: dump this string as a `|` block scalar (preserves newlines)."""


def _literal_representer(dumper: yaml.Dumper, data: _LiteralStr) -> yaml.ScalarNode:
    return dumper.represent_scalar("tag:yaml.org,2002:str", str(data), style="|")


yaml.add_representer(_LiteralStr, _literal_representer, Dumper=yaml.SafeDumper)


def _as_literal_if_multiline(s: str | None) -> str | _LiteralStr | None:
    """Wrap in LiteralStr when the body contains a newline — otherwise leave as plain."""
    if s is None:
        return None
    if "\n" in s:
        return _LiteralStr(s)
    return s


def _clean_value(v: Any) -> Any:
    """Recursively wrap multi-line strings; coerce tuples → lists for YAML."""
    if isinstance(v, str):
        return _as_literal_if_multiline(v)
    if isinstance(v, tuple):
        return [_clean_value(x) for x in v]
    if isinstance(v, list):
        return [_clean_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _clean_value(val) for k, val in v.items() if val is not None or k in _KEEP_NONE_KEYS}
    return v


# Keep optional keys that carry semantic meaning even when None (rare).
_KEEP_NONE_KEYS: set[str] = set()


def _dump_yaml(data: dict, path: Path, schema_comment: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        if schema_comment:
            fh.write(f"# yaml-language-server: $schema={schema_comment}\n")
        yaml.safe_dump(
            data,
            fh,
            allow_unicode=True,
            sort_keys=False,
            width=96,
            default_flow_style=False,
        )


# ── Extractors (one per content type) ────────────────────────────────────


def extract_archetype_encounters(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_encounters import _ENCOUNTER_REGISTRIES

    encounters = _ENCOUNTER_REGISTRIES.get(archetype, [])
    if not encounters:
        return 0

    items = []
    for enc in encounters:
        raw = enc.model_dump(exclude={"archetype"})  # archetype implicit via path
        items.append(_clean_value(raw))

    _dump_yaml({"schema_version": 1, "encounters": items}, out_path)
    return len(items)


def extract_archetype_banter(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_banter import _BANTER_REGISTRIES

    banter = _BANTER_REGISTRIES.get(archetype, [])
    if not banter:
        return 0

    tier_field = TIER_FIELD_FOR_ARCHETYPE.get(archetype)
    items = []
    seen_ids: set[str] = set()
    for b in banter:
        if b["id"] in seen_ids:
            # Legacy data has duplicate IDs papered over at generation time
            # (`sb_30_dup0` etc.). Extraction refuses to emit duplicates —
            # the validator will then surface the underlying data bug so an
            # author fixes the source instead of preserving the workaround.
            print(
                f"WARNING: duplicate banter id '{b['id']}' in {archetype}"
                " — dropping later occurrence",
                file=sys.stderr,
            )
            continue
        seen_ids.add(b["id"])

        # Normalize personality_filter tuples → lists.
        pf = {
            k: (list(v) if isinstance(v, tuple) else v)
            for k, v in (b.get("personality_filter") or {}).items()
        }
        cleaned: dict[str, Any] = {
            "id": b["id"],
            "trigger": b["trigger"],
            "personality_filter": pf,
            "text_en": _as_literal_if_multiline(b["text_en"]),
            "text_de": _as_literal_if_multiline(b["text_de"]),
        }
        if b.get("decay_tier") is not None:
            cleaned["decay_tier"] = b["decay_tier"]
        if b.get("attachment_tier") is not None:
            cleaned["attachment_tier"] = b["attachment_tier"]
        if tier_field and tier_field not in ("decay_tier", "attachment_tier") and b.get(tier_field) is not None:
            cleaned[tier_field] = b[tier_field]
        items.append(cleaned)

    _dump_yaml({"schema_version": 1, "banter": items}, out_path)
    return len(items)


def extract_archetype_loot(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_loot import _LOOT_REGISTRIES

    per_archetype = _LOOT_REGISTRIES.get(archetype, {})
    if not per_archetype:
        return 0

    # Flatten tiers into a single list ordered by tier → in-tier index.
    # The loader re-groups by tier on load.
    items = []
    for tier in sorted(per_archetype):
        for item in per_archetype[tier]:
            raw = item.model_dump()
            items.append(_clean_value(raw))

    _dump_yaml({"schema_version": 1, "loot": items}, out_path)
    return len(items)


def extract_archetype_enemies(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_combat import _ENEMY_REGISTRIES

    per_archetype = _ENEMY_REGISTRIES.get(archetype, {})
    if not per_archetype:
        return 0

    items = [
        _clean_value(tmpl.model_dump(exclude={"archetype"}))
        for tmpl in per_archetype.values()
    ]
    _dump_yaml({"schema_version": 1, "enemies": items}, out_path)
    return len(items)


def extract_archetype_spawns(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_combat import _SPAWN_REGISTRIES

    per_archetype = _SPAWN_REGISTRIES.get(archetype, {})
    if not per_archetype:
        return 0

    spawns_cleaned: dict[str, list[dict]] = {}
    for spawn_id, entries in per_archetype.items():
        spawns_cleaned[spawn_id] = [_clean_value(dict(e)) for e in entries]

    _dump_yaml({"schema_version": 1, "spawns": spawns_cleaned}, out_path)
    return sum(len(v) for v in spawns_cleaned.values())


def extract_archetype_anchors(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_objektanker import ANCHOR_OBJECTS

    objects = ANCHOR_OBJECTS.get(archetype, [])
    if not objects:
        return 0

    items = [_clean_value({"id": o["id"], "phases": o.get("phases", {})}) for o in objects]
    _dump_yaml({"schema_version": 1, "anchors": items}, out_path)
    return len(items)


def extract_archetype_entrance_texts(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_objektanker import ENTRANCE_TEXTS

    entries = ENTRANCE_TEXTS.get(archetype, [])
    if not entries:
        return 0

    items = [
        _clean_value({"text_en": e["text_en"], "text_de": e["text_de"]})
        for e in entries
    ]
    _dump_yaml({"schema_version": 1, "entrance_texts": items}, out_path)
    return len(items)


def extract_archetype_barometer_texts(archetype: str, out_path: Path) -> int:
    from backend.services.dungeon.dungeon_objektanker import BAROMETER_TEXTS

    entries = BAROMETER_TEXTS.get(archetype, [])
    if not entries:
        return 0

    items = [
        _clean_value({"tier": e["tier"], "text_en": e["text_en"], "text_de": e["text_de"]})
        for e in entries
    ]
    _dump_yaml({"schema_version": 1, "barometer_texts": items}, out_path)
    return len(items)


def extract_abilities(out_root: Path) -> dict[str, int]:
    from backend.services.combat.ability_schools import ALL_ABILITIES

    counts: dict[str, int] = {}
    abilities_dir = out_root / "abilities"
    for school, abilities in ALL_ABILITIES.items():
        items = []
        for ability in abilities:
            raw = {
                "id": ability.id,
                "name_en": ability.name_en,
                "name_de": ability.name_de,
                "school": ability.school,
                "description_en": ability.description_en,
                "description_de": ability.description_de,
                "min_aptitude": ability.min_aptitude,
                "cooldown": ability.cooldown,
                "effect_type": ability.effect_type,
                "effect_params": dict(ability.effect_params),
                "is_ultimate": ability.is_ultimate,
                "targets": ability.targets,
            }
            items.append(_clean_value(raw))
        _dump_yaml({"schema_version": 1, "abilities": items}, abilities_dir / f"{school}.yaml")
        counts[school] = len(items)
    return counts


# ── Orchestration ────────────────────────────────────────────────────────


def extract_one_archetype(archetype: str, out_root: Path) -> dict[str, int]:
    slug = ARCHETYPE_NAME_TO_SLUG[archetype]
    folder = out_root / "archetypes" / slug

    return {
        "encounters": extract_archetype_encounters(archetype, folder / "encounters.yaml"),
        "banter": extract_archetype_banter(archetype, folder / "banter.yaml"),
        "loot": extract_archetype_loot(archetype, folder / "loot.yaml"),
        "enemies": extract_archetype_enemies(archetype, folder / "enemies.yaml"),
        "spawns": extract_archetype_spawns(archetype, folder / "spawns.yaml"),
        "anchors": extract_archetype_anchors(archetype, folder / "anchors.yaml"),
        "entrance_texts": extract_archetype_entrance_texts(archetype, folder / "entrance_texts.yaml"),
        "barometer_texts": extract_archetype_barometer_texts(archetype, folder / "barometer_texts.yaml"),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extract Python dict registries to YAML content packs.")
    parser.add_argument(
        "--archetype",
        type=str,
        help="Canonical archetype name (e.g. 'The Shadow') or slug (e.g. 'shadow').",
    )
    parser.add_argument("--all", action="store_true", help="Extract all 8 archetypes and abilities.")
    parser.add_argument("--abilities-only", action="store_true", help="Extract only the abilities tree.")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    args = parser.parse_args(argv)

    out_root: Path = args.output_root

    if args.abilities_only:
        counts = extract_abilities(out_root)
        for school, n in counts.items():
            print(f"  abilities/{school:<20} {n:>4}")
        return 0

    if args.all:
        names = list(ARCHETYPE_NAME_TO_SLUG)
    elif args.archetype:
        archetype = _resolve_archetype_name(args.archetype)
        names = [archetype]
    else:
        parser.error("specify --archetype NAME, --all, or --abilities-only")

    for archetype in names:
        slug = ARCHETYPE_NAME_TO_SLUG[archetype]
        counts = extract_one_archetype(archetype, out_root)
        print(f"archetype {archetype} (slug={slug}):")
        for kind, n in counts.items():
            print(f"  {kind:<20} {n:>4}")

    if args.all:
        ability_counts = extract_abilities(out_root)
        print("abilities:")
        for school, n in ability_counts.items():
            print(f"  {school:<20} {n:>4}")

    return 0


def _resolve_archetype_name(query: str) -> str:
    if query in ARCHETYPE_NAME_TO_SLUG:
        return query
    for name, slug in ARCHETYPE_NAME_TO_SLUG.items():
        if slug == query:
            return name
    raise SystemExit(f"Unknown archetype '{query}'. Valid: {sorted(ARCHETYPE_NAME_TO_SLUG)}")


if __name__ == "__main__":
    raise SystemExit(main())
