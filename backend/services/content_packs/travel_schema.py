"""Pydantic schemas for the DRIFT (travel) content pack.

The drift pack is flat — no archetypes, no per-archetype tiers — so it does
NOT reuse the dungeon `PackLoadResult` shape. It owns two DB tables:

  - `travel_quest_templates` — a Depesche's mechanical skeleton (cargo +
    effect specs + author prose). Authors edit
    `content/drift/quests/<family>.yaml`; the family is the filename and is
    injected by the loader, mirroring how the dungeon loader injects the
    archetype from the directory — so it is never repeated per item.
  - `travel_signal_templates` — a Signal's skeleton (M1): what the Drift does
    to a traveller on the move it did not ask for. Authors edit
    `content/drift/signals/<class>.yaml`; unlike the quest family, the class
    IS authored (once, at the top of the file) because the per-class shape
    invariant — interactive classes offer options, passive classes resolve
    themselves — has to be checkable inside the model, and a filename is not
    data a Pydantic validator can see. The loader cross-checks stem == class.

Validation posture mirrors the dungeon packs:
  - Strict: unknown YAML keys raise (catches author typos at load).
  - Per-item invariants (family/vector consistency, effect shape, bilingual
    completeness, prose-token sanity, signal option/auto shape) live in these
    models.
  - Cross-item invariants (template_key global uniqueness, class coverage)
    live in `scripts/validate_content_packs.py --domain drift`.
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

# The quest gate substitutes only these tokens (target world / target agent).
# Any other {placeholder} in prose is an author error that would otherwise ship
# verbatim to a player. Signals may additionally name a building (KPI-1: the
# Drift points at real rows of a real world).
_ALLOWED_TOKENS: frozenset[str] = frozenset({"{sim}", "{agent}"})
_SIGNAL_TOKENS: frozenset[str] = _ALLOWED_TOKENS | {"{building}"}
_TOKEN_RE = re.compile(r"\{[^}]*\}")


def _reject_unknown_tokens(*texts: str | None, allowed: frozenset[str] = _ALLOWED_TOKENS) -> None:
    for text in texts:
        if text is None:
            continue
        for token in _TOKEN_RE.findall(text):
            if token not in allowed:
                raise ValueError(f"unknown prose token {token!r} (only {sorted(allowed)} are substituted)")


class CargoSpec(StrictModel):
    """The cargo a deliver Depesche carries — one family and its paired vector."""

    family: CargoFamily
    vector: BleedVector

    @model_validator(mode="after")
    def _vector_matches_family(self) -> CargoSpec:
        expected = CARGO_FAMILY_TO_VECTOR[self.family]
        if self.vector != expected:
            raise ValueError(f"cargo family '{self.family}' carries vector '{expected}', not '{self.vector}'")
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


# ══════════════════════════════════════════════════════════════════════════
# Signals (M1) — what the Drift does on the move the traveller did not ask for
# ══════════════════════════════════════════════════════════════════════════
#
# Five classes. Two of them (stoerung, begegnung) STOP the run and wait for a
# decision (`fn_signal_resolve`); the other three resolve the instant they are
# drawn and only write a log line. The split is not cosmetic — it is the
# per-template shape invariant: an interactive class MUST offer options, a
# passive class MUST carry exactly one `auto` outcome. A "Fund" that opens a
# modal with a single OK button is a Fund that wastes the player's attention.

SignalClass = Literal["stoerung", "fund", "geruecht", "begegnung", "stille"]
INTERACTIVE_SIGNAL_CLASSES: frozenset[str] = frozenset({"stoerung", "begegnung"})

DistanceBand = Literal["near", "mid", "deep"]
_BANDS: tuple[str, ...] = ("near", "mid", "deep")

# ── Resource bands: the run's live state, rendered as words (concept R9) ──
#
# A template may REQUIRE a band, which is how "the Drift reads your condition"
# becomes authorable content: a signal that only fires on a battered hull, a
# rumour that only a traveller with room in the manifest can act on. The bands
# are computed in SQL (migration 267) from `drift_tuning.signal_bands` — these
# literals are the shared vocabulary, not the thresholds.

KhBand = Literal["kritisch", "angeschlagen", "intakt"]
DzBand = Literal["ruhig", "erhoeht", "kritisch"]
WindowBand = Literal["knapp", "mittel", "weit"]

# Sondierung marker classes (M2, migration 268) — a signal may push one onto
# the current node's stack, which is how a Störung can poison a dig site.
MarkerClass = Literal["resonanz", "statik", "echo"]


class SignalRequirements(StrictModel):
    """When a template is eligible to be drawn at all.

    Every listed constraint must hold (AND). An absent constraint means "any".
    An EMPTY list would mean "no value is acceptable" — a template that can
    never be drawn — so it is rejected rather than silently benched.
    """

    kh_band: list[KhBand] | None = None
    dz_band: list[DzBand] | None = None
    window_band: list[WindowBand] | None = None
    overload: bool | None = None

    @model_validator(mode="after")
    def _no_empty_lists(self) -> SignalRequirements:
        for name in ("kh_band", "dz_band", "window_band"):
            value = getattr(self, name)
            if value is not None and not value:
                raise ValueError(f"requires.{name} is empty – the template could never fire")
            if value is not None and len(set(value)) != len(value):
                raise ValueError(f"requires.{name} lists a band twice")
        return self


class CargoGrant(CargoSpec):
    """A Fund that puts real freight in the manifest.

    Inherits the family<->vector pairing check. `haul` is the Vermessung the
    freight is worth on Entladung — it rides the same haul economy as a
    surveyed node, so a Fund is income the run can still LOSE (Havarie,
    Zerfaserung). Salvage you have not brought home is not salvage.
    """

    haul: int = Field(ge=1, le=6)


class RumorReveal(StrictModel):
    """A rumour that lifts one undiscovered node out of the fog (R12).

    `band` narrows which node the Drift points at; absent = any undiscovered
    node. The pick is deterministic and server-side (migration 267).
    """

    band: DistanceBand | None = None


class SignalDeltas(StrictModel):
    """The CLOSED outcome vocabulary. Anything a signal can do, it does here.

    Sign conventions follow the run's own bookkeeping, so an author never has
    to remember an inversion:
      - `kh` / `bb` / `takt` are POOLS   — negative takes away, positive gives.
      - `dz` is a BURDEN                 — positive is worse.
      - `siegel` is a CREDIT             — awarded via fn_drift_award, never a
        fine (traveler_profiles.siegel carries CHECK >= 0; a debt is a NOTE on
        the record, as migration 265's notruf established).
      - `cargo_grant` / `rumor_reveal` / `marker_add` are the three non-numeric
        outcomes: freight, knowledge, and a mark on the node.

    Bounds are deliberately tight. They are not balance — balance lives in the
    authored numbers — they are the blast radius of a typo: no single signal
    may end a run outright (kh floor -40 against a 100-point hull) or hand out
    a rank (siegel ceiling 30 against a 100-VP promotion).
    """

    kh: int | None = Field(default=None, ge=-40, le=40)
    bb: int | None = Field(default=None, ge=-5, le=5)
    dz: int | None = Field(default=None, ge=-20, le=20)
    takt: int | None = Field(default=None, ge=-4, le=4)
    siegel: int | None = Field(default=None, ge=0, le=30)
    cargo_grant: CargoGrant | None = None
    rumor_reveal: RumorReveal | None = None
    marker_add: MarkerClass | None = None

    @model_validator(mode="after")
    def _no_zero_deltas(self) -> SignalDeltas:
        # A numeric key that is present and zero is either a typo or noise in
        # the delta list the HUD renders. Say nothing instead of saying "0".
        for name in ("kh", "bb", "dz", "takt", "siegel"):
            if getattr(self, name) == 0:
                raise ValueError(f"delta '{name}' is 0 – omit the key instead")
        return self


class SignalCost(StrictModel):
    """What an option costs BEFORE it is rolled — paid whatever the outcome.

    Separate from the outcome deltas on purpose: the HUD promises this cost on
    the chip, and a promise that only holds on success is a lie. Costs are
    positive magnitudes (the RPC subtracts them).
    """

    bb: int | None = Field(default=None, ge=1, le=5)
    kh: int | None = Field(default=None, ge=1, le=20)
    takt: int | None = Field(default=None, ge=1, le=3)

    @model_validator(mode="after")
    def _not_empty(self) -> SignalCost:
        if self.bb is None and self.kh is None and self.takt is None:
            raise ValueError("cost is empty – omit the key instead")
        return self


class SignalCheck(StrictModel):
    """A vector check. Formula (implemented in `fn_signal_resolve`, 267):

        roll = drift_rand_int(seed, 1, 10)          -- salted, unforgeable
             + affinities[vector]                   -- 0..5, traveler_profiles
             - floor(dissonanz / 10)                -- the Drift's grip
        success := roll >= difficulty

    So difficulty 6 is a coin flip for an unattuned, unstrained traveller, and
    the same 6 is a near-certainty at affinity 5 — and creeps back out of reach
    as Dissonanz climbs. `risky` is what the option chip says out loud; the
    odds themselves are never numbered for the player (concept R4).
    """

    vector: BleedVector
    difficulty: int = Field(ge=2, le=14)


class SignalOutcome(StrictModel):
    """One resolved branch: what happened, in prose, and what it cost or gave."""

    text_de: str = Field(min_length=1)
    text_en: str = Field(min_length=1)
    deltas: SignalDeltas = Field(default_factory=SignalDeltas)

    @model_validator(mode="after")
    def _no_unknown_tokens(self) -> SignalOutcome:
        _reject_unknown_tokens(self.text_de, self.text_en, allowed=_SIGNAL_TOKENS)
        return self


class SignalOption(StrictModel):
    """One thing the traveller may do about a Störung or a Begegnung.

    Shape is check-dependent, enforced here so a half-authored option cannot
    reach a player as a dead button:
      - with `check`  -> `success` AND `failure`, no `result`.
      - without check -> `result` only (a certain outcome: a price paid, a
        thing refused). Certainty is a legitimate option — the trade IS the
        decision (concept R4: the safe door must be a real door).
    """

    key: str = Field(min_length=1, pattern=r"^[a-z][a-z0-9_]*$")
    label_de: str = Field(min_length=1)
    label_en: str = Field(min_length=1)
    cost: SignalCost | None = None
    check: SignalCheck | None = None
    success: SignalOutcome | None = None
    failure: SignalOutcome | None = None
    result: SignalOutcome | None = None

    @model_validator(mode="after")
    def _shape_by_check(self) -> SignalOption:
        if self.check is not None:
            if not (self.success and self.failure):
                raise ValueError(f"option '{self.key}' has a check and therefore needs both success and failure")
            if self.result is not None:
                raise ValueError(f"option '{self.key}' has a check – use success/failure, not result")
        else:
            if self.result is None:
                raise ValueError(f"option '{self.key}' has no check and therefore needs a result")
            if self.success is not None or self.failure is not None:
                raise ValueError(f"option '{self.key}' has no check – use result, not success/failure")
        _reject_unknown_tokens(self.label_de, self.label_en, allowed=_SIGNAL_TOKENS)
        return self


class SignalProse(StrictModel):
    """The scene the panel shows: an eyebrow title and the body of the report."""

    title_de: str = Field(min_length=1)
    title_en: str = Field(min_length=1)
    body_de: str = Field(min_length=1)
    body_en: str = Field(min_length=1)

    @model_validator(mode="after")
    def _no_unknown_tokens(self) -> SignalProse:
        _reject_unknown_tokens(self.title_de, self.title_en, self.body_de, self.body_en, allowed=_SIGNAL_TOKENS)
        return self


class SignalTemplate(StrictModel):
    """One signal skeleton -> one `travel_signal_templates` row.

    `band_weights` is this template's relative draw weight per distance band —
    it is how "the deep Drift is a different place" becomes content rather than
    a constant: a skeleton may be common near home and unheard-of in the deep,
    or exist only past the last relay. The CLASS mix per band lives in
    `drift_tuning.signal_weights`; this is the pick WITHIN a class. Weight 0 in
    every band would be an unreachable template, so at least one must be > 0.

    `signal_class` is NOT authored per item — it is the pack's, not the
    template's (see the module docstring).
    """

    template_key: str = Field(min_length=1)
    band_weights: dict[str, int]
    requires: SignalRequirements | None = None
    prose: SignalProse
    options: list[SignalOption] = Field(default_factory=list, max_length=3)
    auto: SignalOutcome | None = None

    @model_validator(mode="after")
    def _weights_are_reachable(self) -> SignalTemplate:
        unknown = sorted(set(self.band_weights) - set(_BANDS))
        if unknown:
            raise ValueError(f"band_weights has unknown band(s) {unknown} (expected {list(_BANDS)})")
        if any(weight < 0 or weight > 100 for weight in self.band_weights.values()):
            raise ValueError("band_weights must be in [0, 100]")
        if not any(weight > 0 for weight in self.band_weights.values()):
            raise ValueError(f"template '{self.template_key}' has weight 0 in every band – it could never be drawn")
        keys = [option.key for option in self.options]
        if len(set(keys)) != len(keys):
            raise ValueError(f"template '{self.template_key}' repeats an option key")
        return self


class SignalPack(VersionedPack):
    """A `content/drift/signals/<class>.yaml` file — one class per file.

    The class-shape invariant lives here because it is the pack's contract with
    the engine: `fn_travel_move` (267) applies a passive signal on the spot and
    hands an interactive one to `fn_signal_resolve`. A passive template with
    options would strand the run waiting for a decision the HUD never offers.
    """

    pack_slug: str = Field(min_length=1)
    signal_class: SignalClass
    signals: list[SignalTemplate] = Field(min_length=1)

    @model_validator(mode="after")
    def _shape_by_class(self) -> SignalPack:
        interactive = self.signal_class in INTERACTIVE_SIGNAL_CLASSES
        for template in self.signals:
            if interactive:
                if not template.options:
                    raise ValueError(
                        f"'{template.template_key}': class '{self.signal_class}' stops the run "
                        "and must offer at least one option"
                    )
                if template.auto is not None:
                    raise ValueError(
                        f"'{template.template_key}': class '{self.signal_class}' is interactive – "
                        "it resolves through options, not 'auto'"
                    )
            else:
                if template.auto is None:
                    raise ValueError(
                        f"'{template.template_key}': class '{self.signal_class}' resolves itself "
                        "and must carry an 'auto' outcome"
                    )
                if template.options:
                    raise ValueError(
                        f"'{template.template_key}': class '{self.signal_class}' never asks – it must not carry options"
                    )
        return self


__all__ = [
    "CARGO_FAMILY_TO_VECTOR",
    "INTERACTIVE_SIGNAL_CLASSES",
    "BleedVector",
    "CargoFamily",
    "CargoGrant",
    "CargoSpec",
    "DeliverQuestPack",
    "DeliverQuestTemplate",
    "DistanceBand",
    "EffectKind",
    "EffectSpec",
    "MarkerClass",
    "ProseSpec",
    "RumorReveal",
    "SignalCheck",
    "SignalClass",
    "SignalCost",
    "SignalDeltas",
    "SignalOption",
    "SignalOutcome",
    "SignalPack",
    "SignalProse",
    "SignalRequirements",
    "SignalTemplate",
]
