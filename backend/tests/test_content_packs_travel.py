"""Unit tests for the DRIFT (travel) content pack pipeline.

Covers both families the pack owns:

  - the deliver Depeschen that replaced the hand-seeded rows (migration 252 ->
    content/drift/quests/deliver.yaml + migration 254), and
  - the M1 signal skeletons (migration 266 + generated seed 266a ->
    content/drift/signals/<class>.yaml).

The shape is the same for both: the real pack loads and validates, the
per-item Pydantic invariants reject malformed content, the cross-item
invariants fire, and the generator is byte-stable. No DB required.
"""

from __future__ import annotations

from collections import Counter

import pytest
import yaml
from pydantic import ValidationError

from backend.services.content_packs.generate_drift_migration import generate_drift_sql
from backend.services.content_packs.travel_loader import (
    DriftPackContent,
    QuestTemplateRecord,
    SignalTemplateRecord,
    load_drift_content,
    load_quest_templates,
    load_signal_templates,
)
from backend.services.content_packs.travel_schema import (
    CARGO_FAMILY_TO_VECTOR,
    DeliverQuestPack,
    SignalPack,
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


# ══════════════════════════════════════════════════════════════════════════
# Signals (M1, Welle 2)
# ══════════════════════════════════════════════════════════════════════════


def _signal(**overrides) -> dict:
    """A minimal valid INTERACTIVE signal template the tests mutate."""
    template = {
        "template_key": "stoerung_test",
        "band_weights": {"near": 5},
        "prose": {
            "title_de": "t de",
            "title_en": "t en",
            "body_de": "b de",
            "body_en": "b en",
        },
        "options": [
            {
                "key": "warten",
                "label_de": "warten",
                "label_en": "wait",
                "result": {"text_de": "de", "text_en": "en", "deltas": {"dz": 1}},
            }
        ],
    }
    template.update(overrides)
    return template


def _signal_pack(signals: list[dict], signal_class: str = "stoerung") -> dict:
    return {
        "schema_version": 1,
        "pack_slug": "drift_test",
        "signal_class": signal_class,
        "signals": signals,
    }


# ── The real on-disk signal pack ──────────────────────────────────────────


def test_real_signal_pack_loads_the_authored_distribution():
    records = load_signal_templates()
    per_class = Counter(record.signal_class for record in records)
    # Plan §6 content budget: 12 Störung / 7 Fund / 7 Gerücht / 3 Begegnung /
    # 3 Stille. Pinned, because a class quietly losing its last skeleton is a
    # hole in the draw, not a content nit.
    assert per_class == {
        "stoerung": 12,
        "fund": 7,
        "geruecht": 7,
        "begegnung": 3,
        "stille": 3,
    }
    assert len(records) == 32


def test_real_signal_pack_states_conditions_as_content():
    # Concept R9 — "Zustand wird Text": at least 10 skeletons must READ the
    # run's condition, or the resource bands are a mechanic nobody can see.
    records = load_signal_templates()
    with_requirements = [r for r in records if r.requires]
    assert len(with_requirements) >= 10


def test_real_signal_records_match_the_runtime_contract():
    records = {r.template_key: r for r in load_signal_templates()}

    # Interactive: options in the definition, no auto — the run WAITS.
    stoerung = records["stoerung_frequenzscherung"]
    assert stoerung.signal_class == "stoerung"
    assert set(stoerung.band_weights) <= {"near", "mid", "deep"}
    assert "options" in stoerung.definition and "auto" not in stoerung.definition
    assert stoerung.definition["prose"]["title_de"]

    # Passive: one auto outcome, no options — the move applies it and logs.
    stille = records["stille_ruhige_passage"]
    assert "auto" in stille.definition and "options" not in stille.definition

    # Bands/requirements are hoisted OUT of definition (the draw filters on
    # them every move; it must not dig through the payload).
    spiegel = records["begegnung_spiegelgaenger"]
    assert spiegel.requires == {"dz_band": ["erhoeht", "kritisch"]}
    assert "requires" not in spiegel.definition
    assert "band_weights" not in spiegel.definition


# ── Per-item invariants (the model, not the pack) ─────────────────────────


def test_passive_class_with_options_rejected():
    # Auto present, so the "must carry an auto outcome" rule is satisfied —
    # what must still fail is the option list on a class that never asks.
    both = _signal(auto={"text_de": "de", "text_en": "en", "deltas": {"bb": 1}})
    with pytest.raises(ValidationError, match="never asks"):
        SignalPack.model_validate(_signal_pack([both], signal_class="fund"))


def test_passive_class_without_auto_rejected():
    passive = _signal(options=[], auto=None)
    with pytest.raises(ValidationError, match="must carry an 'auto' outcome"):
        SignalPack.model_validate(_signal_pack([passive], signal_class="stille"))


def test_interactive_class_without_options_rejected():
    auto_only = _signal(
        options=[], auto={"text_de": "de", "text_en": "en", "deltas": {"dz": 1}}
    )
    with pytest.raises(ValidationError, match="must offer at least one option"):
        SignalPack.model_validate(_signal_pack([auto_only]))


def test_unreachable_template_rejected():
    with pytest.raises(ValidationError, match="could never be drawn"):
        SignalPack.model_validate(
            _signal_pack([_signal(band_weights={"near": 0, "deep": 0})])
        )


def test_unknown_band_rejected():
    with pytest.raises(ValidationError, match="unknown band"):
        SignalPack.model_validate(_signal_pack([_signal(band_weights={"far": 5})]))


def test_check_without_both_branches_rejected():
    option = {
        "key": "wagen",
        "label_de": "wagen",
        "label_en": "risk it",
        "check": {"vector": "memory", "difficulty": 7},
        "success": {"text_de": "de", "text_en": "en"},
    }
    with pytest.raises(ValidationError, match="needs both success and failure"):
        SignalPack.model_validate(_signal_pack([_signal(options=[option])]))


def test_certain_option_with_success_branch_rejected():
    option = {
        "key": "wagen",
        "label_de": "wagen",
        "label_en": "risk it",
        "result": {"text_de": "de", "text_en": "en"},
        "success": {"text_de": "de", "text_en": "en"},
    }
    with pytest.raises(ValidationError, match="use result, not success/failure"):
        SignalPack.model_validate(_signal_pack([_signal(options=[option])]))


def test_zero_delta_rejected():
    option = {
        "key": "warten",
        "label_de": "warten",
        "label_en": "wait",
        "result": {"text_de": "de", "text_en": "en", "deltas": {"kh": 0}},
    }
    with pytest.raises(ValidationError, match="omit the key instead"):
        SignalPack.model_validate(_signal_pack([_signal(options=[option])]))


def test_delta_out_of_blast_radius_rejected():
    # No single signal may end a run outright (kh floor -40 on a 100 hull).
    option = {
        "key": "warten",
        "label_de": "warten",
        "label_en": "wait",
        "result": {"text_de": "de", "text_en": "en", "deltas": {"kh": -80}},
    }
    with pytest.raises(ValidationError):
        SignalPack.model_validate(_signal_pack([_signal(options=[option])]))


def test_cargo_grant_reuses_the_family_vector_pairing():
    option = {
        "key": "bergen",
        "label_de": "bergen",
        "label_en": "salvage",
        "result": {
            "text_de": "de",
            "text_en": "en",
            "deltas": {
                "cargo_grant": {"family": "traumfracht", "vector": "memory", "haul": 2}
            },
        },
    }
    with pytest.raises(ValidationError, match="carries vector 'dream'"):
        SignalPack.model_validate(_signal_pack([_signal(options=[option])]))


def test_signal_prose_may_name_a_building_but_not_an_unknown_token():
    ok = _signal(
        prose={
            "title_de": "t",
            "title_en": "t",
            "body_de": "Bei {building} in {sim}",
            "body_en": "At {building} in {sim}",
        }
    )
    SignalPack.model_validate(_signal_pack([ok]))  # {building} is a signal token

    bad = _signal(
        prose={
            "title_de": "t",
            "title_en": "t",
            "body_de": "Bei {gebaeude}",
            "body_en": "At {bldg}",
        }
    )
    with pytest.raises(ValidationError, match="unknown prose token"):
        SignalPack.model_validate(_signal_pack([bad]))


def test_empty_requirement_list_rejected():
    with pytest.raises(ValidationError, match="could never fire"):
        SignalPack.model_validate(_signal_pack([_signal(requires={"kh_band": []})]))


def test_signal_class_must_match_filename(tmp_path):
    signals_dir = tmp_path / "signals"
    signals_dir.mkdir()
    (signals_dir / "fund.yaml").write_text(
        yaml.safe_dump(_signal_pack([_signal()], signal_class="stoerung")),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="does not match the filename"):
        load_signal_templates(tmp_path)


# ── Cross-item invariants + generator ─────────────────────────────────────


def _quest_record(key: str = "x") -> QuestTemplateRecord:
    return QuestTemplateRecord(
        template_key=key, family="deliver", tier=1, pack_slug="p", definition={}
    )


def _signal_record(key: str, signal_class: str) -> SignalTemplateRecord:
    return SignalTemplateRecord(
        template_key=key,
        signal_class=signal_class,
        pack_slug="p",
        band_weights={"near": 1},
        requires={},
        definition={},
    )


def _full_signal_set() -> list[SignalTemplateRecord]:
    """One template per class, two for each interactive class (the floor)."""
    return [
        _signal_record("s1", "stoerung"),
        _signal_record("s2", "stoerung"),
        _signal_record("b1", "begegnung"),
        _signal_record("b2", "begegnung"),
        _signal_record("f1", "fund"),
        _signal_record("g1", "geruecht"),
        _signal_record("q1", "stille"),
    ]


def test_template_key_uniqueness_invariant():
    dup = _quest_record()
    violations, _ = validate_drift(DriftPackContent(quests=[dup, dup]))
    assert any("quest template_key 'x'" in v for v in violations)
    assert validate_drift(DriftPackContent(quests=[dup]))[0] == []


def test_signal_key_uniqueness_invariant():
    signals = _full_signal_set()
    signals.append(_signal_record("s1", "stoerung"))  # a key stated twice
    violations, _ = validate_drift(DriftPackContent(signals=signals))
    assert any("signal template_key 's1'" in v for v in violations)


def test_empty_signal_class_is_a_violation():
    signals = [r for r in _full_signal_set() if r.signal_class != "geruecht"]
    violations, _ = validate_drift(DriftPackContent(signals=signals))
    assert any("signal class 'geruecht' has no templates" in v for v in violations)


def test_single_template_interactive_class_is_a_violation():
    signals = [r for r in _full_signal_set() if r.template_key != "b2"]
    violations, _ = validate_drift(DriftPackContent(signals=signals))
    assert any("'begegnung'" in v and "not a decision" in v for v in violations)


def test_real_pack_passes_every_cross_item_invariant():
    violations, warnings = validate_drift(load_drift_content())
    assert violations == []
    assert warnings == []


def test_generator_emits_both_tables_deterministically():
    content = load_drift_content()
    sql1, counts = generate_drift_sql(content)
    sql2, _ = generate_drift_sql(content)
    assert counts == {"travel_quest_templates": 4, "travel_signal_templates": 32}
    assert sql1 == sql2  # byte-stable across runs
    assert sql1.count("INSERT INTO travel_quest_templates") == 4
    assert sql1.count("INSERT INTO travel_signal_templates") == 32
    assert "TRUNCATE TABLE travel_quest_templates, travel_signal_templates" in sql1
    # the generator must NOT expand tokens (runtime substitutes them).
    assert "{sim}" in sql1 and "{agent}" in sql1
