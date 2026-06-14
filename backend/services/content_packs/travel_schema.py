"""Pydantic schemas for the DRIFT (travel) content pack.

The drift pack is flat — no archetypes, no per-archetype tiers — so it does
NOT reuse the dungeon `PackLoadResult` shape. It owns exactly one DB table,
`travel_quest_templates`, whose `definition` JSONB carries a Depesche's
mechanical skeleton (cargo + effect specs + author prose). Authors edit
`content/drift/quests/<family>.yaml`; the family is the filename and is
injected by the loader, mirroring how the dungeon loader injects the
archetype from the directory — so it is never repeated per item.

Validation posture mirrors the dungeon packs:
  - Strict: unknown YAML keys raise (catches author typos at load).
  - Per-item invariants (family/vector consistency, effect shape, bilingual
    completeness, prose-token sanity) live in these models.
  - The one cross-item invariant (template_key global uniqueness) lives in
    `scripts/validate_content_packs.py --domain drift`.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import Field, model_validator

from backend.services.content_packs.pack_base import StrictModel, VersionedPack

# ── Canonical drift cargo vocabulary ──────────────────────────────────────
#
# Seven cargo families map 1:1 onto the seven bleed vectors (concept §7.8;
# the DB encodes the same pairing as CHECK constraints in migration 241).
# Co-located with the validator that enforces it, exactly as the dungeon
# schema co-locates ARCHETYPE_SLUG_TO_NAME with the logic that reads it.

CARGO_FAMILY_TO_VECTOR: dict[str, str] = {
    "kontrakte": "commerce",
    "idiome": "language",
    "erinnerungsstuecke": "memory",
    "resonanzkerne": "resonance",
    "blaupausen": "architecture",
    "traumfracht": "dream",
    "sehnsuchtsgut": "desire",
}

CargoFamily = Literal[
    "kontrakte",
    "idiome",
    "erinnerungsstuecke",
    "resonanzkerne",
    "blaupausen",
    "traumfracht",
    "sehnsuchtsgut",
]
BleedVector = Literal[
    "commerce",
    "language",
    "memory",
    "resonance",
    "architecture",
    "dream",
    "desire",
]

# The effect kinds the P0 hospitality gate (fn_apply_quest_effects) dispatches
# on. emit_echo + spawn_event carry a bilingual title; inject_agent_memory
# carries `importance`; spawn_event carries `impact_level`.
EffectKind = Literal["emit_fragment", "emit_echo", "inject_agent_memory", "spawn_event"]
_KINDS_WITH_TITLE: frozenset[str] = frozenset({"emit_echo", "spawn_event"})

# The gate substitutes only these tokens (target world / target agent). Any
# other {placeholder} in prose is an author error that would otherwise ship
# verbatim to a player.
_ALLOWED_TOKENS: frozenset[str] = frozenset({"{sim}", "{agent}"})
_TOKEN_RE = re.compile(r"\{[^}]*\}")


def _reject_unknown_tokens(*texts: str | None) -> None:
    for text in texts:
        if text is None:
            continue
        for token in _TOKEN_RE.findall(text):
            if token not in _ALLOWED_TOKENS:
                raise ValueError(
                    f"unknown prose token {token!r} "
                    f"(only {sorted(_ALLOWED_TOKENS)} are substituted)"
                )


class CargoSpec(StrictModel):
    """The cargo a deliver Depesche carries — one family and its paired vector."""

    family: CargoFamily
    vector: BleedVector

    @model_validator(mode="after")
    def _vector_matches_family(self) -> CargoSpec:
        expected = CARGO_FAMILY_TO_VECTOR[self.family]
        if self.vector != expected:
            raise ValueError(
                f"cargo family '{self.family}' carries vector '{expected}', not '{self.vector}'"
            )
        return self


class EffectSpec(StrictModel):
    """One effect the delivery fires through the hospitality gate.

    Shape is kind-dependent and enforced here so a malformed effect fails at
    pack load, not silently at delivery:
      - emit_echo / spawn_event require a bilingual title.
      - emit_fragment / inject_agent_memory must NOT carry a title.
      - inject_agent_memory requires `importance`; spawn_event requires
        `impact_level`; neither field is valid on any other kind.
      - text_de / text_en are always required (the bilingual floor).
    """

    kind: EffectKind
    text_de: str = Field(min_length=1)
    text_en: str = Field(min_length=1)
    title_de: str | None = None
    title_en: str | None = None
    importance: int | None = Field(default=None, ge=1)
    impact_level: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _shape_by_kind(self) -> EffectSpec:
        wants_title = self.kind in _KINDS_WITH_TITLE
        has_title = self.title_de is not None or self.title_en is not None
        if wants_title and not (self.title_de and self.title_en):
            raise ValueError(f"effect '{self.kind}' requires both title_de and title_en")
        if not wants_title and has_title:
            raise ValueError(f"effect '{self.kind}' must not carry a title")
        if (self.importance is not None) != (self.kind == "inject_agent_memory"):
            raise ValueError("'importance' is required by and exclusive to inject_agent_memory")
        if (self.impact_level is not None) != (self.kind == "spawn_event"):
            raise ValueError("'impact_level' is required by and exclusive to spawn_event")
        _reject_unknown_tokens(self.text_de, self.text_en, self.title_de, self.title_en)
        return self


class ProseSpec(StrictModel):
    """The Depesche's own card text (title + brief), shown when it is offered."""

    title_de: str = Field(min_length=1)
    title_en: str = Field(min_length=1)
    brief_de: str = Field(min_length=1)
    brief_en: str = Field(min_length=1)

    @model_validator(mode="after")
    def _no_unknown_tokens(self) -> ProseSpec:
        _reject_unknown_tokens(self.title_de, self.title_en, self.brief_de, self.brief_en)
        return self


class DeliverQuestTemplate(StrictModel):
    """One deliver Depesche template -> one `travel_quest_templates` row.

    `family` is NOT authored per item — the loader injects it from the
    filename (`deliver.yaml` -> family 'deliver'), so it is absent here.
    """

    template_key: str = Field(min_length=1)
    tier: int = Field(ge=1)
    cargo: CargoSpec
    effects: list[EffectSpec] = Field(min_length=1)
    prose: ProseSpec


class DeliverQuestPack(VersionedPack):
    """A `content/drift/quests/deliver.yaml` file."""

    pack_slug: str = Field(min_length=1)
    quests: list[DeliverQuestTemplate] = Field(min_length=1)


__all__ = [
    "CARGO_FAMILY_TO_VECTOR",
    "BleedVector",
    "CargoFamily",
    "CargoSpec",
    "DeliverQuestPack",
    "DeliverQuestTemplate",
    "EffectKind",
    "EffectSpec",
    "ProseSpec",
]
