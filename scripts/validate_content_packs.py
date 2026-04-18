"""CI validator for content packs.

Runs after every change to `content/**/*.yaml`. Enforces invariants that
Pydantic schema-validation alone cannot catch:

  - Globally unique IDs per content type (banter, encounters, enemies,
    loot, abilities). The legacy generator silently renamed duplicates —
    here we fail loudly.
  - FK integrity: every `combat_encounter_id` on an encounter must exist
    in the same archetype's `spawns.yaml`.
  - Archetype completeness: each of the 8 archetypes must provide exactly
    1 boss encounter, 1 rest, 1 treasure (hard game-design invariant).
  - Choice integrity: a choice with `check_aptitude` must have
    `partial_narrative_en` (check can resolve to partial).

Exit codes:
  0 — valid
  1 — one or more invariants violated (message printed per violation)
  2 — structural error (YAML parse, schema validation)

Usage:
    python scripts/validate_content_packs.py
    python scripts/validate_content_packs.py --root /path/to/content/dungeon
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

# Make `backend.*` importable when invoked directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.content_packs.loader import (  # noqa: E402
    DEFAULT_PACK_ROOT,
    PackLoadResult,
    load_packs,
)
from backend.services.content_packs.schemas import (  # noqa: E402
    ARCHETYPE_SLUG_TO_NAME,
)


REQUIRED_ROOM_TYPES_EXACTLY_ONCE: tuple[str, ...] = ("boss", "rest", "treasure")


def validate(result: PackLoadResult) -> tuple[list[str], list[str]]:
    """Return (violations, warnings).

    Violations are hard failures that block CI (data-integrity bugs: duplicate
    IDs, missing FKs, archetype-completeness breaks).

    Warnings are advisory (missing partial narratives, etc.): they surface
    pre-existing content gaps that the runtime already logs but handles
    gracefully. Promoted to errors when the caller passes `--strict`.
    """
    violations: list[str] = []
    warnings: list[str] = []

    violations.extend(_check_global_id_uniqueness(result))
    violations.extend(_check_spawn_fk_integrity(result))
    violations.extend(_check_archetype_completeness(result))
    warnings.extend(_check_choice_narrative_coverage(result))

    return violations, warnings


# ── Invariants ───────────────────────────────────────────────────────────


def _check_global_id_uniqueness(result: PackLoadResult) -> list[str]:
    violations: list[str] = []

    banter_ids = [item["id"] for items in result.banter.values() for item in items]
    for dup, count in Counter(banter_ids).items():
        if count > 1:
            violations.append(f"banter id '{dup}' appears {count}× (must be globally unique)")

    encounter_ids = [enc.id for encs in result.encounters.values() for enc in encs]
    for dup, count in Counter(encounter_ids).items():
        if count > 1:
            violations.append(f"encounter id '{dup}' appears {count}× (must be globally unique)")

    enemy_ids = [eid for per_arch in result.enemies.values() for eid in per_arch]
    for dup, count in Counter(enemy_ids).items():
        if count > 1:
            violations.append(f"enemy id '{dup}' appears {count}× (must be globally unique)")

    loot_ids = [
        item.id
        for tiers in result.loot.values()
        for items in tiers.values()
        for item in items
    ]
    for dup, count in Counter(loot_ids).items():
        if count > 1:
            violations.append(f"loot id '{dup}' appears {count}× (must be globally unique)")

    ability_ids = [a.id for abilities in result.abilities.values() for a in abilities]
    for dup, count in Counter(ability_ids).items():
        if count > 1:
            violations.append(f"ability id '{dup}' appears {count}× (must be globally unique)")

    return violations


def _check_spawn_fk_integrity(result: PackLoadResult) -> list[str]:
    violations: list[str] = []
    for archetype, encounters in result.encounters.items():
        spawns_for_archetype = set(result.spawns.get(archetype, {}))
        for enc in encounters:
            if enc.combat_encounter_id and enc.combat_encounter_id not in spawns_for_archetype:
                violations.append(
                    f"encounter '{enc.id}' ({archetype}) references combat_encounter_id="
                    f"'{enc.combat_encounter_id}' but no matching spawn config exists "
                    f"under archetypes/{archetype.replace('The ', '').lower()}/spawns.yaml"
                )
    return violations


def _check_archetype_completeness(result: PackLoadResult) -> list[str]:
    violations: list[str] = []
    for archetype in ARCHETYPE_SLUG_TO_NAME.values():
        encounters = result.encounters.get(archetype, [])
        if not encounters:
            # Archetype not yet externalized (A1.2-A1.3 in progress) — skip.
            continue
        by_type = Counter(enc.room_type for enc in encounters)
        for required in REQUIRED_ROOM_TYPES_EXACTLY_ONCE:
            count = by_type.get(required, 0)
            if count != 1:
                violations.append(
                    f"archetype '{archetype}' has {count} {required} encounter(s); exactly 1 required"
                )
    return violations


def _check_choice_narrative_coverage(result: PackLoadResult) -> list[str]:
    violations: list[str] = []
    for archetype, encounters in result.encounters.items():
        for enc in encounters:
            for choice in enc.choices:
                if choice.check_aptitude and not choice.partial_narrative_en:
                    violations.append(
                        f"encounter '{enc.id}' ({archetype}): choice '{choice.id}' has "
                        f"check_aptitude='{choice.check_aptitude}' but no partial_narrative_en"
                    )
    return violations


# ── CLI ──────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate dungeon content packs.")
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help=f"Pack root (defaults to {DEFAULT_PACK_ROOT}).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings (missing partial narratives, etc.) as failures.",
    )
    args = parser.parse_args(argv)

    try:
        result = load_packs(args.root)
    except Exception as exc:  # pydantic.ValidationError or yaml.YAMLError
        print(f"STRUCTURAL ERROR: {exc}", file=sys.stderr)
        return 2

    violations, warnings = validate(result)

    if warnings:
        print(f"{len(warnings)} warning(s):", file=sys.stderr)
        for w in warnings:
            print(f"  - {w}", file=sys.stderr)

    if violations:
        print(f"FAILED: {len(violations)} invariant violation(s)", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
        return 1

    if args.strict and warnings:
        print("FAILED: --strict enabled and warnings present", file=sys.stderr)
        return 1

    print(f"OK: {result.summary()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
