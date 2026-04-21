"""Unit tests for the 3-way merge service (A1.7 Phase 5).

Coverage targets:
    - All auto-resolvable cases (both id-list entries and top-level scalars)
    - All four conflict kinds × both shapes (entry + scalar)
    - Ordering semantics (ours-first, theirs-only appended)
    - Mixed content (some conflicts + some auto-resolutions in one tree)
    - Edge cases: empty list, list without id, base/ours/theirs all missing
    - Default-to-ours/theirs policy per conflict kind
"""

from __future__ import annotations

from backend.services.content_packs.merge_service import (
    ConflictKind,
    MergeResult,
    merge_content,
)


def _entry(entry_id: str, text: str) -> dict:
    return {"id": entry_id, "text_de": text}


# ── Auto-resolvable: no-change + one-sided ────────────────────────────────


def test_no_changes_anywhere() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    result = merge_content(base, dict(base), dict(base))
    assert result.conflicts == []
    assert result.merged == base
    assert result.auto_resolved_count == 0


def test_only_ours_modified() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x-ours")]}
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x-ours")]}
    assert result.auto_resolved_count == 1


def test_only_theirs_modified() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = dict(base)
    theirs = {"banter": [_entry("a", "x-theirs")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x-theirs")]}
    assert result.auto_resolved_count == 1


def test_convergent_edit_auto_resolves() -> None:
    base = {"banter": [_entry("a", "x")]}
    same_edit = {"banter": [_entry("a", "x-shared")]}
    result = merge_content(base, same_edit, dict(same_edit))
    assert result.conflicts == []
    assert result.merged == same_edit
    assert result.auto_resolved_count == 1


def test_ours_adds_entry_theirs_unchanged() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x"), _entry("b", "y")]}
    assert result.auto_resolved_count == 1


def test_theirs_adds_entry_ours_unchanged() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = dict(base)
    theirs = {"banter": [_entry("a", "x"), _entry("c", "z")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x"), _entry("c", "z")]}
    assert result.auto_resolved_count == 1


def test_both_sides_add_disjoint_entries() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x"), _entry("b", "by-ours")]}
    theirs = {"banter": [_entry("a", "x"), _entry("c", "by-theirs")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    # Output preserves ours-order for "a" + "b"; theirs-only "c" appended.
    assert result.merged == {
        "banter": [
            _entry("a", "x"),
            _entry("b", "by-ours"),
            _entry("c", "by-theirs"),
        ]
    }
    assert result.auto_resolved_count == 2


def test_both_sides_add_same_entry_same_content() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x"), _entry("b", "same")]}
    theirs = {"banter": [_entry("a", "x"), _entry("b", "same")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == theirs
    assert result.auto_resolved_count == 1


def test_both_sides_delete_same_entry() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    ours = {"banter": [_entry("a", "x")]}
    theirs = {"banter": [_entry("a", "x")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x")]}
    assert result.auto_resolved_count == 1


def test_ours_deletes_theirs_unchanged_auto_deletes() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    ours = {"banter": [_entry("a", "x")]}
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x")]}
    assert result.auto_resolved_count == 1


def test_theirs_deletes_ours_unchanged_auto_deletes() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    ours = dict(base)
    theirs = {"banter": [_entry("a", "x")]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"banter": [_entry("a", "x")]}
    assert result.auto_resolved_count == 1


# ── Conflicts: id-list entry ──────────────────────────────────────────────


def test_modify_modify_entry_conflict_defaults_to_ours() -> None:
    # D1 field-level recursion drills into the entry: id is unchanged
    # across all sides (auto-resolves as a no-change field), only the
    # diverging text_de scalar surfaces as a conflict.
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x-ours")]}
    theirs = {"banter": [_entry("a", "x-theirs")]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.MODIFY_MODIFY
    assert c.path == ".banter[id=a].text_de"
    assert c.base == "x"
    assert c.ours == "x-ours"
    assert c.theirs == "x-theirs"
    # Default-to-ours policy preserves the admin's scalar value at the field.
    assert result.merged == {"banter": [_entry("a", "x-ours")]}
    assert result.auto_resolved_count == 0


def test_modify_delete_entry_defaults_to_ours() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    ours = {"banter": [_entry("a", "x"), _entry("b", "y-edited")]}
    theirs = {"banter": [_entry("a", "x")]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.MODIFY_DELETE
    assert c.path == ".banter[id=b]"
    assert c.theirs is None
    # Ours wins by default (preserve admin's edit):
    assert result.merged == {"banter": [_entry("a", "x"), _entry("b", "y-edited")]}


def test_delete_modify_entry_defaults_to_theirs() -> None:
    base = {"banter": [_entry("a", "x"), _entry("b", "y")]}
    ours = {"banter": [_entry("a", "x")]}
    theirs = {"banter": [_entry("a", "x"), _entry("b", "y-theirs")]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.DELETE_MODIFY
    assert c.path == ".banter[id=b]"
    assert c.ours is None
    # Theirs wins by default (preserve non-destructive side):
    assert result.merged == {"banter": [_entry("a", "x"), _entry("b", "y-theirs")]}


def test_add_add_different_entry_defaults_to_ours() -> None:
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "x"), _entry("new", "by-ours")]}
    theirs = {"banter": [_entry("a", "x"), _entry("new", "by-theirs")]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.ADD_ADD_DIFFERENT
    assert c.path == ".banter[id=new]"
    assert c.base is None
    assert result.merged == {
        "banter": [_entry("a", "x"), _entry("new", "by-ours")]
    }


# ── Conflicts: top-level scalar ───────────────────────────────────────────


def test_scalar_modify_modify_conflict() -> None:
    base = {"name": "original"}
    ours = {"name": "ours-name"}
    theirs = {"name": "theirs-name"}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.MODIFY_MODIFY
    assert c.path == ".name"
    assert result.merged == {"name": "ours-name"}


def test_scalar_add_add_different_conflict() -> None:
    base: dict = {}
    ours = {"description": "written-by-ours"}
    theirs = {"description": "written-by-theirs"}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.ADD_ADD_DIFFERENT
    assert c.base is None
    assert result.merged == {"description": "written-by-ours"}


def test_scalar_modify_delete_conflict() -> None:
    base = {"name": "original"}
    ours = {"name": "ours-changed"}
    theirs: dict = {}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.MODIFY_DELETE
    assert c.theirs is None
    assert result.merged == {"name": "ours-changed"}


def test_scalar_delete_modify_conflict() -> None:
    base = {"name": "original"}
    ours: dict = {}
    theirs = {"name": "theirs-changed"}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.kind == ConflictKind.DELETE_MODIFY
    assert c.ours is None
    # Default-to-theirs (preserve non-destructive side):
    assert result.merged == {"name": "theirs-changed"}


# ── Ordering ──────────────────────────────────────────────────────────────


def test_ordering_ours_first_theirs_only_appended() -> None:
    base = {"banter": [_entry("a", "a"), _entry("b", "b")]}
    # Ours reorders: b before a, plus adds d at position 0
    ours = {
        "banter": [
            _entry("d", "d-ours"),
            _entry("b", "b"),
            _entry("a", "a"),
        ]
    }
    # Theirs adds c at the end
    theirs = {
        "banter": [
            _entry("a", "a"),
            _entry("b", "b"),
            _entry("c", "c-theirs"),
        ]
    }
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    # Ours order for d,b,a (all present in ours); theirs-only "c" appended:
    assert [x["id"] for x in result.merged["banter"]] == ["d", "b", "a", "c"]


# ── Mixed tree ────────────────────────────────────────────────────────────


def test_mixed_tree_some_conflicts_some_auto() -> None:
    base = {
        "name": "shadow",
        "banter": [_entry("a", "a"), _entry("b", "b")],
        "encounters": [{"id": "e1", "room": 1}],
    }
    ours = {
        "name": "shadow-ours",  # modify-modify
        "banter": [_entry("a", "a"), _entry("b", "b-ours-edit")],  # modify-modify
        "encounters": [
            {"id": "e1", "room": 1},
            {"id": "e2", "room": 2},  # ours adds
        ],
    }
    theirs = {
        "name": "shadow-theirs",
        "banter": [_entry("a", "a"), _entry("b", "b-theirs-edit")],
        "encounters": [
            {"id": "e1", "room": 1},
            {"id": "e3", "room": 3},  # theirs adds
        ],
    }
    result = merge_content(base, ours, theirs)
    # Conflicts: .name (top-level scalar), .banter[id=b].text_de (D1
    # field-level: id matches, only text_de diverges). encounters[e2]
    # and encounters[e3] are disjoint adds → auto-resolved.
    kinds = sorted(c.path for c in result.conflicts)
    assert kinds == [".banter[id=b].text_de", ".name"]
    assert result.merged["name"] == "shadow-ours"  # default-to-ours
    # Banter: a (unchanged) + b (defaults to ours)
    assert result.merged["banter"] == [
        _entry("a", "a"),
        _entry("b", "b-ours-edit"),
    ]
    # Encounters: e1 unchanged + e2 ours-add + e3 theirs-add (appended)
    assert [x["id"] for x in result.merged["encounters"]] == ["e1", "e2", "e3"]


# ── Edge cases ────────────────────────────────────────────────────────────


def test_empty_list_treated_as_scalar_value() -> None:
    # Empty list on all sides is ambiguous; we treat it as a scalar value.
    # No change → no conflict, no auto-count increment.
    base = {"banter": []}
    result = merge_content(base, dict(base), dict(base))
    assert result.conflicts == []
    assert result.merged == {"banter": []}


def test_list_without_id_treated_as_scalar() -> None:
    # A list-of-strings isn't an id-list; treat as atomic.
    base = {"tags": ["a", "b"]}
    ours = {"tags": ["a", "b", "c"]}
    theirs = {"tags": ["a", "b"]}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"tags": ["a", "b", "c"]}


def test_list_of_dicts_without_id_treated_as_scalar() -> None:
    # A list of dicts where not every entry has `id` is treated as atomic.
    base = {"misc": [{"foo": 1}, {"bar": 2}]}
    ours = {"misc": [{"foo": 1}, {"bar": 2}, {"baz": 3}]}
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == ours


def test_nested_dict_disjoint_fields_auto_merge() -> None:
    # D1 reversal of the old Phase-5 "nested dict is opaque" behavior:
    # top-level dicts are now recursed when all three sides have a dict
    # at the key. Ours bumped tier, theirs bumped difficulty — disjoint
    # fields, so the merge unions them silently.
    base = {"metadata": {"tier": 1, "difficulty": 2}}
    ours = {"metadata": {"tier": 2, "difficulty": 2}}
    theirs = {"metadata": {"tier": 1, "difficulty": 3}}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"metadata": {"tier": 2, "difficulty": 3}}
    assert result.auto_resolved_count == 2


def test_key_present_only_in_base_both_sides_dropped() -> None:
    # base had key, neither side has it — treat as both-deleted.
    base = {"legacy": "x", "keep": "y"}
    ours = {"keep": "y"}
    theirs = {"keep": "y"}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == {"keep": "y"}


def test_merge_result_model_serializes() -> None:
    # Round-trip sanity for API transport (FastAPI will JSON-serialize this).
    base = {"banter": [_entry("a", "x")]}
    ours = {"banter": [_entry("a", "y")]}
    theirs = {"banter": [_entry("a", "z")]}
    result = merge_content(base, ours, theirs)
    json_dict = result.model_dump()
    reloaded = MergeResult.model_validate(json_dict)
    assert reloaded.conflicts[0].kind == ConflictKind.MODIFY_MODIFY
    assert reloaded.merged == {"banter": [_entry("a", "y")]}


def test_both_sides_deleted_entry_not_in_base() -> None:
    # Neither base nor ours nor theirs has the entry — vacuous case.
    # Mostly a defensive test: set operations should never produce this path.
    base = {"banter": [_entry("a", "x")]}
    ours = dict(base)
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert result.merged == base


# ── D1: Field-level recursion inside id-list entries ──────────────────────


def _nested_entry(entry_id: str, trigger: dict, response: dict) -> dict:
    """Helper for D1 tests: a banter-shape entry with nested trigger/response."""
    return {"id": entry_id, "trigger": trigger, "response": response}


def test_entry_field_level_disjoint_modify_auto_merges() -> None:
    # Alice modifies `.trigger.emotion`, Bob modifies `.response.speaker` —
    # D1 unions them without asking. Pre-D1 this would have been a whole-
    # entry MODIFY_MODIFY because `ours != theirs` at the entry level.
    base = {
        "banter": [
            _nested_entry(
                "sb_01",
                {"emotion": "fear", "threshold": 0.7},
                {"speaker": "boss", "text_de": "you don't get it"},
            ),
        ],
    }
    ours = {
        "banter": [
            _nested_entry(
                "sb_01",
                {"emotion": "rage", "threshold": 0.7},  # Alice bumps emotion
                {"speaker": "boss", "text_de": "you don't get it"},
            ),
        ],
    }
    theirs = {
        "banter": [
            _nested_entry(
                "sb_01",
                {"emotion": "fear", "threshold": 0.7},
                {"speaker": "mother", "text_de": "you don't get it"},  # Bob bumps speaker
            ),
        ],
    }
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    merged_entry = result.merged["banter"][0]
    assert merged_entry["trigger"]["emotion"] == "rage"
    assert merged_entry["response"]["speaker"] == "mother"
    # Everything else untouched.
    assert merged_entry["trigger"]["threshold"] == 0.7
    assert merged_entry["response"]["text_de"] == "you don't get it"


def test_entry_field_level_same_field_conflict_emits_sub_path() -> None:
    # Same-field collision inside an entry: Alice and Bob both changed
    # `.trigger.emotion` to different values. Conflict surfaces at the
    # nested path, NOT the entry root.
    base = {"banter": [_nested_entry("sb_01", {"emotion": "fear"}, {"speaker": "boss"})]}
    ours = {"banter": [_nested_entry("sb_01", {"emotion": "rage"}, {"speaker": "boss"})]}
    theirs = {"banter": [_nested_entry("sb_01", {"emotion": "shame"}, {"speaker": "boss"})]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.path == ".banter[id=sb_01].trigger.emotion"
    assert c.kind == ConflictKind.MODIFY_MODIFY
    assert c.base == "fear"
    assert c.ours == "rage"
    assert c.theirs == "shame"
    # Default-to-ours at the leaf: merged dict carries "rage".
    assert result.merged["banter"][0]["trigger"]["emotion"] == "rage"


def test_entry_field_level_mixed_auto_and_conflict() -> None:
    # Same entry: one field auto-merges (theirs-only edit), another
    # conflicts (both sides edited the same leaf).
    base = {"banter": [_nested_entry("sb_01", {"emotion": "fear", "threshold": 0.5}, {"speaker": "boss"})]}
    ours = {"banter": [_nested_entry("sb_01", {"emotion": "rage", "threshold": 0.5}, {"speaker": "boss"})]}
    theirs = {"banter": [_nested_entry("sb_01", {"emotion": "fear", "threshold": 0.8}, {"speaker": "mother"})]}
    # Ours: emotion fear→rage.
    # Theirs: threshold 0.5→0.8, speaker boss→mother.
    # No same-field collision — all disjoint. Auto-merges.
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    merged = result.merged["banter"][0]
    assert merged["trigger"]["emotion"] == "rage"
    assert merged["trigger"]["threshold"] == 0.8
    assert merged["response"]["speaker"] == "mother"


def test_entry_deep_nested_conflict_emits_full_path() -> None:
    # 3-level nesting to verify the path builds correctly without truncation.
    base = {"banter": [{"id": "sb_01", "cfg": {"ai": {"model": "opus", "temp": 0.5}}}]}
    ours = {"banter": [{"id": "sb_01", "cfg": {"ai": {"model": "sonnet", "temp": 0.5}}}]}
    theirs = {"banter": [{"id": "sb_01", "cfg": {"ai": {"model": "haiku", "temp": 0.5}}}]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    assert result.conflicts[0].path == ".banter[id=sb_01].cfg.ai.model"


def test_entry_nested_convergent_edit_auto_resolves() -> None:
    # Both sides made the SAME nested change — convergent, auto-merged
    # without counting as a conflict.
    base = {"banter": [_nested_entry("sb_01", {"emotion": "fear"}, {"speaker": "boss"})]}
    convergent = {"banter": [_nested_entry("sb_01", {"emotion": "rage"}, {"speaker": "boss"})]}
    result = merge_content(base, convergent, dict(convergent))
    assert result.conflicts == []
    assert result.merged["banter"][0]["trigger"]["emotion"] == "rage"


def test_entry_nested_one_side_deletes_field_auto_merges() -> None:
    # Ours removed a nested key; theirs left it alone → the key is dropped
    # at the sub-field level (safe delete). No conflict.
    base = {"banter": [{"id": "sb_01", "trigger": {"emotion": "fear", "obsolete": True}}]}
    ours = {"banter": [{"id": "sb_01", "trigger": {"emotion": "fear"}}]}
    theirs = dict(base)
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert "obsolete" not in result.merged["banter"][0]["trigger"]


def test_entry_nested_modify_delete_at_field_level() -> None:
    # Ours modified `.trigger.emotion`; theirs deleted it. Classic
    # MODIFY_DELETE now surfaces at the FIELD path, not the entry.
    base = {"banter": [{"id": "sb_01", "trigger": {"emotion": "fear"}}]}
    ours = {"banter": [{"id": "sb_01", "trigger": {"emotion": "rage"}}]}
    theirs = {"banter": [{"id": "sb_01", "trigger": {}}]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.path == ".banter[id=sb_01].trigger.emotion"
    assert c.kind == ConflictKind.MODIFY_DELETE


def test_top_level_nested_dict_same_key_conflict() -> None:
    # Counterpart to the flipped `test_nested_dict_disjoint_fields_auto_merge`:
    # when both sides modify the SAME nested key, the conflict surfaces
    # at the field path.
    base = {"metadata": {"tier": 1, "difficulty": 2}}
    ours = {"metadata": {"tier": 2, "difficulty": 2}}
    theirs = {"metadata": {"tier": 3, "difficulty": 2}}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    assert result.conflicts[0].path == ".metadata.tier"
    assert result.conflicts[0].kind == ConflictKind.MODIFY_MODIFY
    # Default-to-ours at the leaf.
    assert result.merged == {"metadata": {"tier": 2, "difficulty": 2}}


def test_entry_nested_one_side_replaces_dict_with_scalar_falls_back() -> None:
    # Ours and theirs no longer agree on the shape at a nested path: ours
    # keeps it as a dict, theirs replaced it with a scalar. The recursion
    # guard (`_all_three_dicts`) fails — we fall back to the whole-value
    # compare at that field path.
    base = {"banter": [{"id": "sb_01", "trigger": {"emotion": "fear"}}]}
    ours = {"banter": [{"id": "sb_01", "trigger": {"emotion": "rage"}}]}
    theirs = {"banter": [{"id": "sb_01", "trigger": "legacy-string"}]}
    result = merge_content(base, ours, theirs)
    assert len(result.conflicts) == 1
    c = result.conflicts[0]
    assert c.path == ".banter[id=sb_01].trigger"
    assert c.kind == ConflictKind.MODIFY_MODIFY
    assert c.ours == {"emotion": "rage"}
    assert c.theirs == "legacy-string"


def test_merged_dict_preserves_ours_first_key_order() -> None:
    # Determinism guard: `set()` iteration is order-undefined; if merge
    # relies on it, the serialised YAML shuffles across runs and produces
    # spurious git diffs on every publish. Ours-first insertion order
    # matches the admin's mental model for top-level keys.
    base = {"a": 1, "b": 2}
    ours = {"a": 1, "b": 2, "c_ours_add": 3}
    theirs = {"a": 1, "b": 2, "d_theirs_add": 4}
    result = merge_content(base, ours, theirs)
    assert list(result.merged.keys()) == ["a", "b", "c_ours_add", "d_theirs_add"]


def test_merged_nested_dict_preserves_ours_first_key_order() -> None:
    # Same determinism guarantee inside the recursion path: nested field
    # order must follow ours-first insertion, not set() iteration.
    base = {"metadata": {"tier": 1, "difficulty": 2}}
    ours = {"metadata": {"tier": 2, "difficulty": 2, "ours_only": "x"}}
    theirs = {"metadata": {"tier": 1, "difficulty": 3, "theirs_only": "y"}}
    result = merge_content(base, ours, theirs)
    keys = list(result.merged["metadata"].keys())
    assert keys == ["tier", "difficulty", "ours_only", "theirs_only"]


def test_id_list_key_present_only_in_base_both_sides_dropped() -> None:
    # Regression for the drop-key guard: when base has an id-list under a
    # key AND neither ours nor theirs keeps any entries for it (the admin
    # and main both removed the collection entirely), the merged tree must
    # omit the key rather than emitting an empty list.
    base = {"banter": [_entry("a", "x")], "meta": {"v": 1}}
    ours = {"meta": {"v": 1}}
    theirs = {"meta": {"v": 1}}
    result = merge_content(base, ours, theirs)
    assert result.conflicts == []
    assert "banter" not in result.merged
    assert result.merged == {"meta": {"v": 1}}
