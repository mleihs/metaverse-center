"""The world's vocabulary must be derivable from the world's own entities.

Finding 30. These are pure-function tests: no database, no model, no mocking.
The properties they hold are the ones that make the fix a fix rather than a
rearrangement — above all that a building cannot end up carrying a condition its
own world does not define, which on production was true of 115 of 314 buildings.
"""

from __future__ import annotations

from backend.services.forge_taxonomies import (
    TAXONOMY_SOURCES,
    derive_taxonomies,
    normalize_entity_terms,
)


def _draft(**overrides):
    draft = {
        "buildings": [
            {
                "name": "Sealed Archive",
                "building_type": "Archive",
                "building_type_de": "Archiv",
                "building_condition": "sealed",
                "building_condition_de": "Versiegelt",
            },
            {
                "name": "Records Office",
                "building_type": "archive",
                "building_type_de": "Archiv",
                "building_condition": "Fair",
                "building_condition_de": "mittelmässig",
            },
            {
                "name": "Ledger Vault",
                "building_type": "Vault",
                "building_type_de": "Gewölbe",
                "building_condition": "fair",
                "building_condition_de": "befriedigend",
            },
            {
                "name": "Second Vault",
                "building_type": "Vault",
                "building_type_de": "Gewölbe",
                "building_condition": "fair",
                "building_condition_de": "befriedigend",
            },
        ],
        "agents": [
            {
                "name": "Registrar",
                "gender": "female",
                "system": "Bureau",
                "primary_profession": "Clerk",
                "primary_profession_de": "Beamtin",
            }
        ],
        "geography": {"zones": [{"name": "Bezirk", "zone_type": "Archive District", "zone_type_de": "Archivbezirk"}]},
    }
    draft.update(overrides)
    return draft


def test_every_entity_term_is_a_member_of_its_own_worlds_vocabulary() -> None:
    """The property the whole fix exists for.

    On production 115 of 314 buildings carried a condition value absent from
    their simulation's taxonomy, because the taxonomy did not exist and the
    generator wrote a hardcoded list. Derived vocabularies make that
    unrepresentable: the world's values ARE its entities' values.
    """
    draft = _draft()
    taxonomies = derive_taxonomies(draft)
    normalized = normalize_entity_terms(draft, taxonomies)

    for source in TAXONOMY_SOURCES:
        entries = taxonomies.get(source.draft_key, [])
        allowed = {entry["value"] for entry in entries}
        collection = normalized.get(source.collection, [])
        for entity in collection:
            term = entity.get(source.en_field)
            if term:
                assert term in allowed, (
                    f"{source.collection}.{source.en_field}={term!r} is not in the "
                    f"derived {source.draft_key} vocabulary {sorted(allowed)}"
                )


def test_case_variants_collapse_to_one_value() -> None:
    """`Archive` and `archive` are one type, not two."""
    taxonomies = derive_taxonomies(_draft())
    types = [entry["value"] for entry in taxonomies["building_types"]]
    assert types == ["archive", "vault"], types
    conditions = [entry["value"] for entry in taxonomies["building_conditions"]]
    assert conditions == ["sealed", "fair"], conditions


def test_one_german_label_per_value_not_one_per_entity() -> None:
    """Nine German words for `fair` become one.

    The label is the most common surface form: `befriedigend` appears twice,
    `mittelmässig` once.
    """
    draft = _draft()
    taxonomies = derive_taxonomies(draft)
    labels = {entry["value"]: entry["label"] for entry in taxonomies["building_conditions"]}
    assert labels["fair"]["de"] == "befriedigend"
    assert labels["sealed"]["de"] == "Versiegelt"

    normalized = normalize_entity_terms(draft, taxonomies)
    german = {b["building_condition_de"] for b in normalized["buildings"] if b["building_condition"] == "fair"}
    assert german == {"befriedigend"}, german


def test_a_value_without_a_german_sibling_keeps_the_english_label() -> None:
    """`gender` and `system` have no `_de` field on the draft model.

    Writing an invented German string here would be worse than the gap: a
    missing translation is visible, a fabricated one is not.
    """
    taxonomies = derive_taxonomies(_draft())
    genders = {entry["value"]: entry["label"] for entry in taxonomies["genders"]}
    assert genders["female"] == {"en": "female", "de": "female"}


def test_empty_collections_yield_no_taxonomy() -> None:
    """No buildings means no vocabulary — not a plausible-looking default.

    The RPC then writes nothing for that key, which is exactly today's
    behaviour rather than a guess nobody made.
    """
    assert derive_taxonomies({}) == {}
    assert derive_taxonomies({"buildings": [], "agents": [], "geography": {}}) == {}
    assert "zone_types" not in derive_taxonomies({"geography": {"zones": []}})


def test_blank_and_non_string_terms_are_skipped() -> None:
    """A missing field must not become an empty taxonomy value."""
    draft = {
        "buildings": [
            {"name": "A", "building_condition": "", "building_condition_de": "x"},
            {"name": "B", "building_condition": None},
            {"name": "C", "building_condition": "  good  ", "building_condition_de": " Gut "},
        ]
    }
    taxonomies = derive_taxonomies(draft)
    assert [entry["value"] for entry in taxonomies["building_conditions"]] == ["good"]
    assert taxonomies["building_conditions"][0]["label"] == {"en": "good", "de": "Gut"}


def test_derivation_is_deterministic_and_ordered_by_first_appearance() -> None:
    """The same draft must always produce the same rows, in the same order."""
    draft = _draft()
    first = derive_taxonomies(draft)
    assert first == derive_taxonomies(draft)
    assert [entry["value"] for entry in first["building_conditions"]] == ["sealed", "fair"]


def test_normalize_does_not_mutate_the_draft() -> None:
    """A caller that decides not to persist has changed nothing."""
    draft = _draft()
    before = draft["buildings"][1]["building_condition"]
    taxonomies = derive_taxonomies(draft)
    normalize_entity_terms(draft, taxonomies)
    assert draft["buildings"][1]["building_condition"] == before == "Fair"


def test_geography_zones_are_read_one_level_down() -> None:
    """Zones do not sit at the draft root; the collection resolver knows that."""
    taxonomies = derive_taxonomies(_draft())
    assert [entry["value"] for entry in taxonomies["zone_types"]] == ["archive district"]
    assert taxonomies["zone_types"][0]["label"]["de"] == "Archivbezirk"


def test_draft_keys_singularise_to_the_taxonomy_types_production_uses() -> None:
    """The RPC strips one trailing `s`; the result must match existing rows.

    Production carries `building_condition`, `building_type`, `zone_type`,
    `profession`, `system`, `gender`. A `draft_key` that singularises to
    anything else would create a second, parallel vocabulary nobody reads.
    """
    expected = {
        "building_condition",
        "building_type",
        "zone_type",
        "profession",
        "system",
        "gender",
    }
    actual = {source.draft_key.removesuffix("s") for source in TAXONOMY_SOURCES}
    assert actual == expected, actual
