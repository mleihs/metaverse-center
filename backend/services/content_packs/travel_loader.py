"""Loader for the DRIFT (travel) content pack.

Reads `content/drift/quests/<family>.yaml`, validates through the family's
Pydantic pack model, and flattens each template into a `QuestTemplateRecord`
ready for SQL row building. The filename stem is the quest family (injected,
not authored per item), mirroring the dungeon loader's archetype-from-dir
injection.

Unknown YAML keys trigger a `pydantic.ValidationError` (pack models carry
`extra="forbid"`), so author typos surface at load time, not at runtime.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from backend.services.content_packs.travel_schema import DeliverQuestPack

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


def _read_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        msg = f"{path}: expected a top-level YAML mapping, got {type(data).__name__}"
        raise ValueError(msg)
    return data


__all__ = ["DEFAULT_DRIFT_PACK_ROOT", "QuestTemplateRecord", "load_quest_templates"]
