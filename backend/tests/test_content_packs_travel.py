"""Unit tests for the DRIFT (travel) content pack pipeline.

Covers the pack that replaces the hand-seeded deliver Depeschen (migration
252 -> content/drift/quests/deliver.yaml + migration 254): the real pack
loads and validates, the per-item Pydantic invariants reject malformed
content, the cross-item uniqueness invariant fires, and the generator is
deterministic. No DB required.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.services.content_packs.generate_drift_migration import generate_drift_sql
from backend.services.content_packs.travel_loader import (
    QuestTemplateRecord,
    load_quest_templates,
)
from backend.services.content_packs.travel_schema import (
    CARGO_FAMILY_TO_VECTOR,
    DeliverQuestPack,
)
from scripts.validate_content_packs import validate_drift


def _valid_template(**overrides) -> dict:
    """A minimal valid deliver template the tests mutate per invariant."""
    template = {
        "template_key": "deliver_test",
        "tier": 1,
        "cargo": {"family": "erinnerungsstuecke", "vector": "memory"},
        "effects": [{"kind": "emit_fragment", "text_de": "de", "text_en": "en"}],
        "prose": {
            "title_de": "t de",
            "title_en": "t en",
            "brief_de": "b de",
            "brief_en": "b en",
        },
    }
    template.update(overrides)
    return template


def _pack(quests: list[dict]) -> dict:
    return {"schema_version": 1, "pack_slug": "drift_test", "quests": quests}


# ── The real on-disk pack ─────────────────────────────────────────────────


def test_real_deliver_pack_loads_four_templates():
    records = load_quest_templates()
    assert {r.template_key for r in records} == {
        "deliver_memory_parcel",
        "deliver_sealed_contract",
        "deliver_borrowed_idiom",
        "deliver_dream_cargo",
    }
    for record in records:
        assert record.family == "deliver"
        assert record.pack_slug == "drift_p0c_seed"
        assert record.tier >= 1


def test_real_pack_definition_matches_runtime_contract():
    records = {r.template_key: r for r in load_quest_templates()}
    parcel = records["deliver_memory_parcel"].definition
    # _compute_offers (drift_service) reads cargo + prose:
    assert parcel["cargo"] == {"family": "erinnerungsstuecke", "vector": "memory"}
    assert parcel["prose"]["title_de"].startswith("Depesche")
    assert "brief_de" in parcel["prose"]
    # fn_apply_quest_effects reads each effects[] element, in this order:
    assert [e["kind"] for e in parcel["effects"]] == [
        "emit_fragment",
        "emit_echo",
        "inject_agent_memory",
        "spawn_event",
    ]
    # exclude_none: emit_fragment carries no title key (matches migration 252).
    fragment = parcel["effects"][0]
    assert "title_de" not in fragment and "title_en" not in fragment
    # tokens survive verbatim for runtime substitution.
    assert "{sim}" in parcel["effects"][1]["text_de"]
    assert "{agent}" in parcel["effects"][2]["text_de"]


# ── Per-item invariants (Pydantic, at load) ───────────────────────────────


def test_cargo_pairing_table_is_one_to_one():
    assert len(CARGO_FAMILY_TO_VECTOR) == 7
    assert len(set(CARGO_FAMILY_TO_VECTOR.values())) == 7


def test_cargo_family_vector_mismatch_rejected():
    bad = _valid_template(cargo={"family": "kontrakte", "vector": "memory"})
    with pytest.raises(ValidationError, match="carries vector"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_emit_fragment_with_title_rejected():
    bad = _valid_template(
        effects=[
            {
                "kind": "emit_fragment",
                "text_de": "d",
                "text_en": "e",
                "title_de": "x",
                "title_en": "y",
            }
        ]
    )
    with pytest.raises(ValidationError, match="must not carry a title"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_emit_echo_without_title_rejected():
    bad = _valid_template(effects=[{"kind": "emit_echo", "text_de": "d", "text_en": "e"}])
    with pytest.raises(ValidationError, match="requires both title"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_spawn_event_without_impact_level_rejected():
    bad = _valid_template(
        effects=[
            {
                "kind": "spawn_event",
                "text_de": "d",
                "text_en": "e",
                "title_de": "x",
                "title_en": "y",
            }
        ]
    )
    with pytest.raises(ValidationError, match="impact_level"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_importance_exclusive_to_inject_memory():
    bad = _valid_template(
        effects=[{"kind": "emit_fragment", "text_de": "d", "text_en": "e", "importance": 4}]
    )
    with pytest.raises(ValidationError, match="importance"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_unknown_prose_token_rejected():
    bad = _valid_template(
        effects=[{"kind": "emit_fragment", "text_de": "Hallo {welt}", "text_en": "Hi {world}"}]
    )
    with pytest.raises(ValidationError, match="unknown prose token"):
        DeliverQuestPack.model_validate(_pack([bad]))


def test_unknown_yaml_key_rejected():
    with pytest.raises(ValidationError):
        DeliverQuestPack.model_validate(_pack([_valid_template(saboteur="oops")]))


# ── Cross-item invariant + generator ──────────────────────────────────────


def test_template_key_uniqueness_invariant():
    dup = QuestTemplateRecord(
        template_key="x", family="deliver", tier=1, pack_slug="p", definition={}
    )
    violations, _ = validate_drift([dup, dup])
    assert any("template_key 'x'" in v for v in violations)
    assert validate_drift([dup])[0] == []


def test_generator_emits_four_rows_deterministically():
    records = load_quest_templates()
    sql1, counts = generate_drift_sql(records)
    sql2, _ = generate_drift_sql(records)
    assert counts == {"travel_quest_templates": 4}
    assert sql1 == sql2  # byte-stable across runs
    assert sql1.count("INSERT INTO travel_quest_templates") == 4
    assert "TRUNCATE TABLE travel_quest_templates" in sql1
    # the generator must NOT expand tokens (runtime substitutes them).
    assert "{sim}" in sql1 and "{agent}" in sql1
