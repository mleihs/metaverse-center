"""Derive a world's own controlled vocabularies from the entities it generated.

Every simulation is supposed to carry its vocabularies in ``simulation_taxonomies``
— ``building_condition``, ``building_type``, ``zone_type``, ``profession``,
``system``, ``gender`` — and the frontend reads them to render badges, filters
and dropdowns. ``fn_materialize_shard`` has always known how to write them: step
8 of the RPC loops over ``forge_drafts.taxonomies`` and inserts one row per
value, singularising the key (``building_conditions`` -> ``building_condition``).

Nothing ever filled that column.

Measured on production 2026-08-30:

* **All 26 forge drafts carry ``taxonomies = {}``.** The RPC loops zero times and
  inserts nothing, faithfully. Every world the Forge has ever built was created
  with no vocabulary of any kind.
* 16 of 41 simulations have no ``building_condition`` taxonomy at all — including
  ``state-pathography-legibility-as-biopolitical-metabolism``, the world whose
  generation this analysis documents.
* **115 of 314 buildings hold a condition value their own simulation does not
  define** (68 of 78 ``fair``, all 6 ``pristine``, all 4 ``ruined``, 20 of 189
  ``good``, 15 of 20 ``poor``). Every value that *did* come from a world's own
  taxonomy — ``sealed``, ``anomalous``, ``thriving``, ``illuminated`` and the
  rest — matches, all 17 of them. The gap is entirely the hardcoded list.
* The German side is worse: the model invents a fresh ``building_condition_de``
  per building, so ``fair`` came back as *mittelmässig, mässig, befriedigend,
  akzeptabel, mittel, ordentlich, in Ordnung, brauchbar* and *angemessen* —
  thirteen strings for five values — while the frontend branches on the English
  value and prints the German one.

So finding 30 is not "the generator ignores the taxonomy". The taxonomy does not
exist, and the field meant to carry it has been dead since it was added.

Why derive rather than dictate
------------------------------
The obvious alternative is to generate the vocabulary first and constrain the
buildings to it — a second model call, and a second thing that can fail. But the
model already produces exactly the thematic vocabulary the design wants (a world
about sealed archives says ``sealed``; the hardcoded list would have said
``fair``). Deriving the taxonomy from what was actually generated is therefore
not a compromise: it is consistent **by construction** — a building cannot carry
a value its own world does not define, because the world's values *are* the ones
its buildings carry — and it costs no call, adds no failure mode, and needs no
prompt change.

What it does not do is invent. If a draft has no buildings, it yields no
``building_conditions`` key, and the RPC writes nothing for it — the same as
today, rather than a plausible-looking default nobody chose.

Canonicalisation
----------------
Two entities may write ``Good`` and ``good``, or give one English value two
German labels. The English value is casefolded to become the taxonomy ``value``;
the label keeps the most common surface form, ties broken by first appearance so
the result is deterministic. :func:`normalize_entity_terms` then rewrites the
entities to match, which is what collapses thirteen German strings into five.

Pure: no I/O, no database, no logging policy. See
``docs/analysis/forge-prod-run-2026-08-30.md`` finding 30.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

__all__ = [
    "TAXONOMY_SOURCES",
    "TaxonomySource",
    "derive_taxonomies",
    "normalize_entity_terms",
]


class TaxonomySource:
    """One taxonomy: where its values live, and what the RPC should call it.

    ``draft_key`` is the key written into ``forge_drafts.taxonomies``. It is
    plural because ``fn_materialize_shard`` singularises it with
    ``regexp_replace(key, 's$', '')`` — so ``building_conditions`` becomes the
    ``building_condition`` taxonomy_type, matching what production already holds.
    """

    __slots__ = ("collection", "draft_key", "de_field", "en_field")

    def __init__(self, draft_key: str, collection: str, en_field: str, de_field: str | None) -> None:
        self.draft_key = draft_key
        self.collection = collection
        self.en_field = en_field
        self.de_field = de_field


# The six vocabularies the draft can supply. `gender` and `system` have no `_de`
# sibling on `ForgeAgentDraft`, so their label carries the English surface form
# in both slots rather than a German string invented here — a missing
# translation is a visible gap; a fabricated one is not.
TAXONOMY_SOURCES: tuple[TaxonomySource, ...] = (
    TaxonomySource("building_conditions", "buildings", "building_condition", "building_condition_de"),
    TaxonomySource("building_types", "buildings", "building_type", "building_type_de"),
    TaxonomySource("zone_types", "zones", "zone_type", "zone_type_de"),
    TaxonomySource("professions", "agents", "primary_profession", "primary_profession_de"),
    TaxonomySource("systems", "agents", "system", None),
    TaxonomySource("genders", "agents", "gender", None),
)


def _as_text(value: Any) -> str:
    """A trimmed string, or empty for anything that is not usable text."""
    if isinstance(value, str):
        return value.strip()
    return ""


def _get(entity: Any, field: str) -> str:
    """Read ``field`` off a dict or a pydantic model, as trimmed text."""
    if isinstance(entity, Mapping):
        return _as_text(entity.get(field))
    return _as_text(getattr(entity, field, None))


def _canonical(surface_forms: Sequence[str]) -> str:
    """Pick the label for a value: most common form, ties by first appearance.

    ``Counter.most_common`` is insertion-ordered for equal counts in CPython,
    which is exactly the tie-break wanted here — but relying on that quietly
    would make the function's determinism an implementation detail of the
    interpreter, so the first-appearance index is used explicitly.
    """
    counts = Counter(surface_forms)
    first_seen = {form: i for i, form in enumerate(reversed(surface_forms))}
    return max(counts, key=lambda form: (counts[form], first_seen[form]))


def _collect(entities: Iterable[Any], en_field: str, de_field: str | None) -> list[dict[str, Any]]:
    """One taxonomy's entries, in order of first appearance."""
    order: list[str] = []
    english: dict[str, list[str]] = {}
    german: dict[str, list[str]] = {}

    for entity in entities:
        surface = _get(entity, en_field)
        if not surface:
            continue
        value = surface.casefold()
        if value not in english:
            order.append(value)
            english[value] = []
            german[value] = []
        english[value].append(surface)
        if de_field:
            de_surface = _get(entity, de_field)
            if de_surface:
                german[value].append(de_surface)

    entries: list[dict[str, Any]] = []
    for value in order:
        label_en = _canonical(english[value])
        label_de = _canonical(german[value]) if german[value] else label_en
        entries.append({"value": value, "label": {"en": label_en, "de": label_de}})
    return entries


def _collection(draft: Mapping[str, Any], name: str) -> list[Any]:
    """The entity list for a source. ``zones`` live one level down in geography."""
    if name == "zones":
        geography = draft.get("geography") or {}
        if not isinstance(geography, Mapping):
            return []
        zones = geography.get("zones") or []
    else:
        zones = draft.get(name) or []
    return list(zones) if isinstance(zones, list) else []


def derive_taxonomies(draft: Mapping[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Build ``forge_drafts.taxonomies`` from the draft's own entities.

    Returns ``{draft_key: [{"value": ..., "label": {"en": ..., "de": ...}}, ...]}``,
    omitting any taxonomy whose source collection is empty. Feeding the result
    back into the draft makes every entity's term a member of its own world's
    vocabulary by construction.
    """
    taxonomies: dict[str, list[dict[str, Any]]] = {}
    for source in TAXONOMY_SOURCES:
        entries = _collect(_collection(draft, source.collection), source.en_field, source.de_field)
        if entries:
            taxonomies[source.draft_key] = entries
    return taxonomies


def normalize_entity_terms(
    draft: Mapping[str, Any],
    taxonomies: Mapping[str, Sequence[Mapping[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    """Rewrite entity terms onto the derived vocabulary.

    The English field becomes the canonical ``value`` and the German field the
    taxonomy's ``label.de``. This is what turns nine German words for ``fair``
    into one, and it is why the frontend can stop rendering whatever the model
    happened to write that time.

    Returns ``{collection: [entity, ...]}`` for the collections it changed, as
    plain dicts ready to be written back to the draft. Entities are copied, not
    mutated, so a caller that decides not to persist has changed nothing.
    """
    labels: dict[str, dict[str, dict[str, str]]] = {}
    for source in TAXONOMY_SOURCES:
        entries = taxonomies.get(source.draft_key) or []
        labels[source.draft_key] = {
            str(entry.get("value", "")): dict(entry.get("label") or {}) for entry in entries if entry.get("value")
        }

    by_collection: dict[str, list[TaxonomySource]] = {}
    for source in TAXONOMY_SOURCES:
        by_collection.setdefault(source.collection, []).append(source)

    updated: dict[str, list[dict[str, Any]]] = {}
    for collection, sources in by_collection.items():
        entities = _collection(draft, collection)
        if not entities:
            continue
        rewritten: list[dict[str, Any]] = []
        for entity in entities:
            row = dict(entity) if isinstance(entity, Mapping) else entity.model_dump()
            for source in sources:
                surface = _get(entity, source.en_field)
                if not surface:
                    continue
                value = surface.casefold()
                label = labels.get(source.draft_key, {}).get(value)
                if label is None:
                    continue
                row[source.en_field] = value
                if source.de_field:
                    row[source.de_field] = label.get("de") or label.get("en") or value
            rewritten.append(row)
        updated[collection] = rewritten
    return updated
