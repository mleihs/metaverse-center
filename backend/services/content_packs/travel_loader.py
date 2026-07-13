"""Loader for the DRIFT (travel) content pack.

Reads `content/drift/quests/<family>.yaml` and `content/drift/signals/
<class>.yaml`, validates each through its Pydantic pack model, and flattens
the templates into records ready for SQL row building.

For quests the filename stem IS the family (injected, not authored per item),
mirroring the dungeon loader's archetype-from-dir injection. For signals the
class is authored once at the top of the file — the class-shape invariant has
to be checkable inside the model (see travel_schema) — and the loader only
cross-checks it against the filename, so the two can never drift apart.

Unknown YAML keys trigger a `pydantic.ValidationError` (pack models carry
`extra="forbid"`), so author typos surface at load time, not at runtime.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from backend.services.content_packs.travel_schema import DeliverQuestPack, SignalPack

logger = logging.getLogger(__name__)

# ── Canonical on-disk root ────────────────────────────────────────────────

DEFAULT_DRIFT_PACK_ROOT: Path = Path(__file__).resolve().parents[3] / "content" / "drift"

# filename stem -> pack model. One source of truth for "which quest family
# lives in which file and validates against which model". Only the deliver
# family ships in P0c; fetch / survey / ... register here as they land.
_QUEST_PACK_FOR_FAMILY: dict[str, type[DeliverQuestPack]] = {
    "deliver": DeliverQuestPack,
}


@dataclass(frozen=True)
class QuestTemplateRecord:
    """Flattened `travel_quest_templates` row (pre-SQL).

    `definition` is the exact JSONB shape the runtime reads — `_compute_offers`
    (drift_service) reads `cargo`/`prose`; `fn_apply_quest_effects` reads each
    `effects[]` element. Built with `exclude_none=True` so absent optional keys
    (a title on emit_fragment, importance off inject) match migration 252.
    """

    template_key: str
    family: str
    tier: int
    pack_slug: str
    definition: dict[str, Any]


@dataclass(frozen=True)
class SignalTemplateRecord:
    """Flattened `travel_signal_templates` row (pre-SQL).

    `band_weights` and `requires` are hoisted OUT of `definition` into their
    own columns: they are what the draw in `fn_travel_move` (migration 267)
    filters and weights on, every single move. Leaving them buried in the
    definition JSONB would make the hot path dig through the same blob it is
    about to ship to the client. `definition` keeps what only the panel needs:
    prose plus the options (or the single auto outcome).
    """

    template_key: str
    signal_class: str
    pack_slug: str
    band_weights: dict[str, int]
    requires: dict[str, Any]
    definition: dict[str, Any]


@dataclass(frozen=True)
class DriftPackContent:
    """Everything `content/drift/**` holds — one object per load, one per table."""

    quests: list[QuestTemplateRecord] = field(default_factory=list)
    signals: list[SignalTemplateRecord] = field(default_factory=list)


def load_drift_content(root: Path | None = None) -> DriftPackContent:
    """Load + validate the whole drift pack (quests and signals)."""
    root = (root or DEFAULT_DRIFT_PACK_ROOT).resolve()
    return DriftPackContent(
        quests=load_quest_templates(root),
        signals=load_signal_templates(root),
    )


def load_quest_templates(root: Path | None = None) -> list[QuestTemplateRecord]:
    """Load + validate every quest pack under `root/quests/`.

    Raises `pydantic.ValidationError` on a malformed template and `ValueError`
    on a non-mapping YAML file or an unknown family filename. Does NOT enforce
    the cross-file `template_key` uniqueness invariant — that is the
    validator's job (`validate_content_packs.py --domain drift`).
    """
    root = (root or DEFAULT_DRIFT_PACK_ROOT).resolve()
    quests_dir = root / "quests"
    records: list[QuestTemplateRecord] = []
    if not quests_dir.is_dir():
        logger.debug("no drift quests directory at %s — nothing to load", quests_dir)
        return records

    for file in sorted(quests_dir.iterdir()):
        if file.suffix not in {".yaml", ".yml"}:
            continue
        family = file.stem
        pack_cls = _QUEST_PACK_FOR_FAMILY.get(family)
        if pack_cls is None:
            msg = f"{file}: unknown quest family '{family}' (no pack model registered)"
            raise ValueError(msg)
        pack = pack_cls.model_validate(_read_yaml(file))
        for template in pack.quests:
            dumped = template.model_dump(exclude_none=True)
            definition = {
                "cargo": dumped["cargo"],
                "effects": dumped["effects"],
                "prose": dumped["prose"],
            }
            records.append(
                QuestTemplateRecord(
                    template_key=template.template_key,
                    family=family,
                    tier=template.tier,
                    pack_slug=pack.pack_slug,
                    definition=definition,
                )
            )

    logger.info(
        "drift content pack loaded from %s: %d quest template(s)", root, len(records)
    )
    return records


def load_signal_templates(root: Path | None = None) -> list[SignalTemplateRecord]:
    """Load + validate every signal pack under `root/signals/`.

    Raises `pydantic.ValidationError` on a malformed template and `ValueError`
    when a file's authored `signal_class` disagrees with its filename (the two
    are the same fact stated twice; a disagreement means one of them is a lie
    and we cannot know which).
    """
    root = (root or DEFAULT_DRIFT_PACK_ROOT).resolve()
    signals_dir = root / "signals"
    records: list[SignalTemplateRecord] = []
    if not signals_dir.is_dir():
        logger.debug("no drift signals directory at %s — nothing to load", signals_dir)
        return records

    for file in sorted(signals_dir.iterdir()):
        if file.suffix not in {".yaml", ".yml"}:
            continue
        pack = SignalPack.model_validate(_read_yaml(file))
        if pack.signal_class != file.stem:
            msg = (
                f"{file}: signal_class '{pack.signal_class}' does not match the filename "
                f"'{file.stem}' — one file per class"
            )
            raise ValueError(msg)
        for template in pack.signals:
            dumped = template.model_dump(exclude_none=True)
            definition: dict[str, Any] = {"prose": dumped["prose"]}
            if template.options:
                definition["options"] = dumped["options"]
            if template.auto is not None:
                definition["auto"] = dumped["auto"]
            records.append(
                SignalTemplateRecord(
                    template_key=template.template_key,
                    signal_class=pack.signal_class,
                    pack_slug=pack.pack_slug,
                    band_weights=dumped["band_weights"],
                    requires=dumped.get("requires", {}),
                    definition=definition,
                )
            )

    logger.info(
        "drift content pack loaded from %s: %d signal template(s)", root, len(records)
    )
    return records


def _read_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        msg = f"{path}: expected a top-level YAML mapping, got {type(data).__name__}"
        raise ValueError(msg)
    return data


__all__ = [
    "DEFAULT_DRIFT_PACK_ROOT",
    "DriftPackContent",
    "QuestTemplateRecord",
    "SignalTemplateRecord",
    "load_drift_content",
    "load_quest_templates",
    "load_signal_templates",
]
