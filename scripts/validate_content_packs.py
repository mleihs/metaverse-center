"""CI validator for content packs.

Runs after every change to `content/**/*.yaml`. Enforces invariants that
Pydantic schema-validation alone cannot catch:

  - Globally unique IDs per content type (banter, encounters, enemies,
    loot, abilities). The legacy generator silently renamed duplicates —
    here we fail loudly.
  - FK integrity: every `combat_encounter_id` on an encounter must exist
    in the same archetype's `spawns.yaml`.
  - Archetype completeness: each of the 8 archetypes must provide at
    least one boss, rest, and treasure encounter (Deluge ships two rest
    + two treasure because of its deeper layout; strict "exactly one"
    was loosened in A1.3e).
  - Enemy art paths: an `image_path` must be a bucket-relative object
    path naming its own creature. A creature with no art is fine (the
    graphical view draws a silhouette); a creature pointing at another
    creature's picture is not, and nothing downstream would notice.
  - Choice integrity (advisory): a choice with `check_aptitude` should
    have `partial_narrative_en` because the check can resolve to
    partial. Warning-level; promoted to failure via --strict.

Exit codes:
  0 — valid
  1 — one or more invariants violated (hard failure)
  2 — structural error (YAML parse, Pydantic schema validation)

Usage:
    python scripts/validate_content_packs.py
    python scripts/validate_content_packs.py --strict
    python scripts/validate_content_packs.py --root /path/to/content/dungeon
    python scripts/validate_content_packs.py --domain drift --strict
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path
from typing import get_args

# Make `backend.*` importable when invoked directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.content_packs.loader import (  # noqa: E402
    PackLoadResult,
    load_packs,
)
from backend.services.content_packs.schemas import (  # noqa: E402
    ARCHETYPE_NAME_TO_SLUG,
    ARCHETYPE_SLUG_TO_NAME,
)
from backend.services.content_packs.travel_loader import (  # noqa: E402
    DriftPackContent,
    load_drift_content,
)
from backend.services.content_packs.travel_schema import (  # noqa: E402
    INTERACTIVE_SIGNAL_CLASSES,
    SignalClass,
)
from backend.services.dungeon_loot_contracts import (  # noqa: E402
    BUFF_SHAPES,
    LOOT_EFFECT_CONTRACTS,
    unknown_params,
)
from backend.services.dungeon.dungeon_banter import BANTER_TRIGGERS  # noqa: E402


REQUIRED_ROOM_TYPES_AT_LEAST_ONCE: tuple[str, ...] = ("boss", "rest", "treasure")


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
    violations.extend(_check_enemy_art_paths(result))
    violations.extend(_check_loot_effect_contract(result))
    violations.extend(_check_banter_triggers(result))
    warnings.extend(_check_choice_narrative_coverage(result))
    warnings.extend(_check_enemy_art_coverage(result))
    warnings.extend(_check_banter_trigger_coverage(result))

    return violations, warnings


def validate_drift(content: DriftPackContent) -> tuple[list[str], list[str]]:
    """Cross-file invariants for the drift (travel) pack.

    Per-item invariants (family/vector pairing, effect shape, bilingual
    completeness, prose-token sanity, signal option/auto shape) are enforced by
    the Pydantic models at load time. What only a whole-pack view can see:

      - `template_key` global uniqueness, per table — the soft FK target that
        `travel_quest_instances` / a run's `pending_signal` reference by key.
        A duplicate key does not fail the INSERT (ON CONFLICT DO UPDATE): the
        second row silently overwrites the first, and one authored signal
        vanishes from the game with no error anywhere.
      - Every signal class has at least one template. `fn_travel_move` (267)
        picks a CLASS from the tuned per-band weights and THEN a template
        within it; a class with no templates would make that draw fall through
        to silence, so an empty class is a hole in the engine, not just in the
        content.
    """
    violations: list[str] = []

    for label, keys in (
        ("quest", [record.template_key for record in content.quests]),
        ("signal", [record.template_key for record in content.signals]),
    ):
        for dup, count in Counter(keys).items():
            if count > 1:
                violations.append(
                    f"{label} template_key '{dup}' appears {count}× (must be globally unique)"
                )

    if content.signals:
        per_class = Counter(record.signal_class for record in content.signals)
        for signal_class in get_args(SignalClass):
            if not per_class[signal_class]:
                violations.append(
                    f"signal class '{signal_class}' has no templates — the draw in "
                    "fn_travel_move can select it and would find nothing"
                )
        for signal_class in sorted(INTERACTIVE_SIGNAL_CLASSES):
            if per_class[signal_class] < 2:
                violations.append(
                    f"signal class '{signal_class}' stops the run and has only "
                    f"{per_class[signal_class]} template(s) — a decision the player has "
                    "already seen is not a decision"
                )

    return violations, []


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


def _check_banter_triggers(result: PackLoadResult) -> list[str]:
    """No line may answer a trigger the runtime never sends.

    131 of 302 lines did exactly that until 2026-08-30 — written, translated,
    seeded and unreachable, because nothing compared the authored triggers with
    the emitted ones (Befund D6). Several were near-miss spellings of a live
    trigger (`combat_victory` for `combat_won`, `ambush` for `rest_ambush`),
    which is precisely the kind of drift a diff of two sets catches and a
    reader does not.
    """
    violations: list[str] = []
    for archetype, lines in result.banter.items():
        for line in lines:
            trigger = line.get("trigger")
            if trigger not in BANTER_TRIGGERS:
                violations.append(
                    f"banter '{line.get('id')}' ({archetype}) answers trigger "
                    f"'{trigger}', which nothing emits — either wire an emitter "
                    f"and declare it in BANTER_TRIGGERS, or use one of the "
                    f"existing triggers"
                )
    return violations


def _check_banter_trigger_coverage(result: PackLoadResult) -> list[str]:
    """The other direction: a trigger the runtime sends into silence.

    Advisory, not a failure — it is a content gap (an archetype's dramatic
    moment with nothing to say), not a broken pipeline.
    """
    used = {line.get("trigger") for lines in result.banter.values() for line in lines}
    return [
        f"trigger '{trigger}' is emitted by the runtime but no archetype has a line for it"
        for trigger in sorted(BANTER_TRIGGERS - used)
    ]


def _check_loot_effect_contract(result: PackLoadResult) -> list[str]:
    """Every loot effect names a consumer, and every parameter has a reader.

    The Systemprüfung found 39 of 105 loot items with no effect path at all
    (Bericht §3.1 D4) — and, worse, no way to notice: the RPC had no ELSE, so an
    unknown effect_type produced neither an `applied` nor a `skipped` entry.
    `backend/services/dungeon_loot_contracts.py` is the declaration; this is the
    gate that holds content to it.

    Parameters that are knowingly unread are listed in `UNREAD_PARAMS` with a
    reason, so this stays a hard gate without silently blessing the gap.
    """
    violations: list[str] = []

    for archetype, tiers in result.loot.items():
        for tier, items in tiers.items():
            for item in items:
                where = f"loot '{item.id}' ({archetype} T{tier})"

                if item.effect_type not in LOOT_EFFECT_CONTRACTS:
                    violations.append(
                        f"{where}: effect_type '{item.effect_type}' has no contract — "
                        f"declare it in backend/services/dungeon_loot_contracts.py "
                        f"(known: {', '.join(sorted(LOOT_EFFECT_CONTRACTS))})"
                    )
                    continue

                params = item.effect_params or {}
                extra = unknown_params(item.effect_type, params)
                if extra:
                    violations.append(
                        f"{where}: parameter(s) {', '.join(extra)} are read by nobody — "
                        f"wire a consumer, rename to a declared parameter, or list them "
                        f"in UNREAD_PARAMS with a reason"
                    )

                # `dungeon_buff` is the one type whose consumer depends on WHICH
                # parameter is present, so an unrecognised shape is its own defect.
                if item.effect_type == "dungeon_buff" and not (set(params) & set(BUFF_SHAPES)):
                    violations.append(
                        f"{where}: dungeon_buff carries none of the known shape keys "
                        f"({', '.join(sorted(BUFF_SHAPES))}) — it would take hold nowhere"
                    )

    return violations


def _check_spawn_fk_integrity(result: PackLoadResult) -> list[str]:
    violations: list[str] = []
    for archetype, encounters in result.encounters.items():
        spawns_for_archetype = set(result.spawns.get(archetype, {}))
        slug = ARCHETYPE_NAME_TO_SLUG.get(archetype, archetype)
        for enc in encounters:
            if enc.combat_encounter_id and enc.combat_encounter_id not in spawns_for_archetype:
                violations.append(
                    f"encounter '{enc.id}' ({archetype}) references combat_encounter_id="
                    f"'{enc.combat_encounter_id}' but no matching spawn config exists "
                    f"under archetypes/{slug}/spawns.yaml"
                )
    return violations


def _check_archetype_completeness(result: PackLoadResult) -> list[str]:
    """Every archetype must carry at least one boss / rest / treasure encounter.

    Boss is the run-end trigger, rest gates healing, treasure gates tier-2
    loot. Archetypes may have more (Deluge ships 2 rest + 2 treasure rooms
    because its 17-encounter layout calls for it) but never fewer.
    """
    violations: list[str] = []
    for archetype in ARCHETYPE_SLUG_TO_NAME.values():
        encounters = result.encounters.get(archetype, [])
        if not encounters:
            # Archetype not yet externalized (A1.2-A1.3 in progress) — skip.
            continue
        by_type = Counter(enc.room_type for enc in encounters)
        for required in REQUIRED_ROOM_TYPES_AT_LEAST_ONCE:
            count = by_type.get(required, 0)
            if count < 1:
                violations.append(
                    f"archetype '{archetype}' has no {required} encounter; at least 1 required"
                )
    return violations


#: Shape of `EnemyTemplate.image_path`. Bucket-relative (a host here would bake
#: one environment into the seed migration, which also runs against local
#: Supabase and CI), and carrying the creature's own id.
#:
#: The rendition size is left open on purpose: the pack states WHICH creature an
#: image shows, not how many pixels the renderer wants. Which sizes actually
#: exist is the publishing pipeline's business — `scripts/ingest_dungeon_enemy_art.py`
#: refuses a path whose rendition it cannot produce.
ENEMY_ART_PATH = re.compile(r"dungeon-enemies/(?P<enemy_id>[a-z0-9_]+)-\d+\.avif")


def _check_enemy_art_paths(result: PackLoadResult) -> list[str]:
    """Every declared creature image is well-formed and belongs to its creature.

    A creature WITHOUT art is not a violation: `image_path` is optional and the
    graphical scene falls back to a clip-path silhouette, which is how a creature
    authored ahead of its artwork is meant to look.

    The failure this catches is the silent one. Every path is a copy of the
    creature's own id, so a copy-paste while authoring a new enemy hands two
    creatures the same face — and nothing downstream can tell, because the
    wrong image loads perfectly.
    """
    violations: list[str] = []
    for archetype in sorted(result.enemies):
        for enemy_id, tmpl in sorted(result.enemies[archetype].items()):
            if tmpl.image_path is None:
                continue
            match = ENEMY_ART_PATH.fullmatch(tmpl.image_path)
            if match is None:
                violations.append(
                    f"enemy '{enemy_id}' ({archetype}) has image_path "
                    f"'{tmpl.image_path}', which is not a bucket-relative "
                    f"'dungeon-enemies/<enemy_id>-<size>.avif' path"
                )
            elif match.group("enemy_id") != enemy_id:
                violations.append(
                    f"enemy '{enemy_id}' ({archetype}) points at "
                    f"'{tmpl.image_path}' — that is "
                    f"'{match.group('enemy_id')}'s artwork"
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


def _check_enemy_art_coverage(result: PackLoadResult) -> list[str]:
    """Creatures with no scene art. Advisory, not a violation.

    The graphical view draws a clip-path silhouette for these, so the game is
    correct without art and content work never blocks on an image existing. But
    a creature authored today and forgotten tomorrow is how the band ends up
    half-illustrated, and nothing else surfaces it — the silhouette looks
    deliberate. All 42 creatures carried art when this check was written, so
    anything listed here is new and unillustrated.
    """
    return [
        f"enemy '{enemy_id}' ({archetype}) has no image_path — "
        f"it will render as a silhouette in the graphical view"
        for archetype in sorted(result.enemies)
        for enemy_id, tmpl in sorted(result.enemies[archetype].items())
        if tmpl.image_path is None
    ]


# ── CLI ──────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate content packs.")
    parser.add_argument(
        "--domain",
        choices=("dungeon", "drift"),
        default="dungeon",
        help="Which content domain to validate (default: dungeon).",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Pack root (defaults to the domain's content/ root).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings (missing partial narratives, etc.) as failures.",
    )
    args = parser.parse_args(argv)

    try:
        if args.domain == "drift":
            content = load_drift_content(args.root)
            violations, warnings = validate_drift(content)
            summary = (
                f"{len(content.quests)} drift quest template(s), "
                f"{len(content.signals)} signal template(s)"
            )
        else:
            result = load_packs(args.root)
            violations, warnings = validate(result)
            summary = result.summary()
    except Exception as exc:  # pydantic.ValidationError or yaml.YAMLError
        print(f"STRUCTURAL ERROR: {exc}", file=sys.stderr)
        return 2

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

    print(f"OK: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
