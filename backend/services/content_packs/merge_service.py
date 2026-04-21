"""3-way merge for content-draft conflict resolution (A1.7 Phase 5 + D1).

When a draft is marked 'conflict' (default-branch drift detected at publish
time), the admin's edits need to be reconciled with what landed on main in
the meantime. This module performs a semantic 3-way merge between:

    base    = content_drafts.base_content        (snapshot at draft-open)
    ours    = content_drafts.working_content     (admin's edits)
    theirs  = YAML fetched fresh from main       (what landed in between)

and produces:

    merged     = dict                            (auto-resolved where safe)
    conflicts  = list[EntryConflict]             (need admin resolution)

Granularity: **field-level** (D1). For list-of-dicts with a stable `id` field,
the merge still keys on id for the entry slot, but WITHIN each entry the
merge recurses into nested dicts, emitting conflicts at the finest path
where the two sides actually collide (e.g. ``.banter[id=sb_01].trigger.emotion``
rather than the whole entry object). Two admins touching DIFFERENT fields of
the same entry therefore auto-merge; only same-field collisions require
admin resolution. Recursion applies at any depth as long as all three sides
have a dict at the same path; lists (id-list or otherwise) remain opaque to
recursion — list-element merging is a separate problem.

Auto-resolved cases (no admin prompt):
    - Only one side changed → take the changed side.
    - Both sides made the SAME change → take it (convergent edit).
    - Both sides added DIFFERENT entries (distinct ids) → union.
    - Both sides deleted the same entry → stay deleted.
    - Base had X; one side deleted; the other left it untouched → delete.
    - Both sides modified DIFFERENT fields of the same entry/dict → union
      at the field level (D1).

Conflict cases (admin must choose):
    MODIFY_MODIFY      — both sides modified the same leaf value differently.
    MODIFY_DELETE      — ours modified, theirs deleted (at entry or field level).
    DELETE_MODIFY      — ours deleted, theirs modified (at entry or field level).
    ADD_ADD_DIFFERENT  — both added the same key with different bodies
                         (recursion does not apply when base is absent).

Default-to-ours policy:
    When a conflict is surfaced, `merged` still carries a value — ours for
    MODIFY_MODIFY / MODIFY_DELETE / ADD_ADD_DIFFERENT, theirs for
    DELETE_MODIFY (preserves the non-destructive side). A naive admin who
    blindly accepts `merged` preserves their intent rather than silently
    losing upstream changes.

Ordering:
    Id-list slots follow `ours` order for entries present there, then append
    `theirs`-only entries (newly-added upstream) in their `theirs` order.
    Dict-field recursion preserves key-insertion order via the natural
    all-keys iteration (ours-first would require a separate pass — deferred
    since insertion order in JSON-serialised content is cosmetic).

Comment preservation:
    NOT supported. Draft working_content is JSONB (comments already stripped
    at save-time); the merge operates on dicts. Phase 2 publish.py uses
    yaml.safe_dump which also drops comments, so there is no lossy step
    introduced here — just continuation of the existing lossiness.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

# Sentinel for "key not present in this side". Distinct from `None` so we can
# tell "explicitly set to null" apart from "absent". Module-level so identity
# comparisons (`is _MISSING`) work across helpers.
_MISSING: Any = object()


class ConflictKind(StrEnum):
    """Taxonomy of admin-gated merge conflicts."""

    MODIFY_MODIFY = "modify_modify"
    MODIFY_DELETE = "modify_delete"
    DELETE_MODIFY = "delete_modify"
    ADD_ADD_DIFFERENT = "add_add_different"


class EntryConflict(BaseModel):
    """One admin-gated conflict surfaced by the merge.

    `path` addresses the conflict location in the content tree. Formats:
      - `.banter[id=sb_01].text_de`   — field-level conflict inside an entry
      - `.banter[id=sb_01]`           — whole-entry conflict (one side deleted)
      - `.name`                       — top-level scalar
      - `.metadata.tier`              — nested dict field (D1 recursion)

    The path is always rooted at the top of ``working_content`` (leading
    ``.``), so the frontend's grouping logic can split on ``[id=...]`` +
    the following ``.`` to identify the entry that a field-level conflict
    belongs to.
    """

    path: str = Field(..., description="Conflict location in the content tree.")
    kind: ConflictKind
    base: Any | None = Field(
        default=None,
        description="Value in base (None when add/add or base didn't have this key).",
    )
    ours: Any | None = Field(
        default=None,
        description="Value in working_content (None when ours deleted).",
    )
    theirs: Any | None = Field(
        default=None,
        description="Value on main (None when theirs deleted).",
    )


class MergeResult(BaseModel):
    """Outcome of a 3-way merge.

    `merged` is always returned (defaults picked where conflicts exist — see
    module docstring §"Default-to-ours policy"). `conflicts` enumerates items
    that require admin attention; `auto_resolved_count` is an informational
    counter for audit + UI affordance ("42 changes auto-merged, 3 need review").
    """

    merged: dict[str, Any]
    conflicts: list[EntryConflict]
    auto_resolved_count: int = Field(default=0, ge=0)


# ── Public API ────────────────────────────────────────────────────────────


def merge_content(
    base: dict[str, Any],
    ours: dict[str, Any],
    theirs: dict[str, Any],
) -> MergeResult:
    """Field-level 3-way merge of three top-level dicts.

    Dispatch per top-level key:
      - If any of the three sides carries a list-of-dicts-with-`id`, treat
        the key as an id-list and delegate to `_merge_id_list`, which in
        turn recurses per entry.
      - If ALL THREE sides carry a dict at the key, recurse via
        `_merge_dict_fields` so changes to disjoint nested fields
        auto-merge and only same-field collisions surface.
      - Otherwise (missing, scalar, list-of-non-id-dicts, one-sided dict…),
        resolve atomically via `_merge_scalar`.

    The "all three dicts → recurse" branch is new in D1 and replaces the
    old opaque whole-dict comparison for nested structures like
    ``metadata: {...}``.
    """
    merged: dict[str, Any] = {}
    conflicts: list[EntryConflict] = []
    auto_resolved = 0

    all_keys = set(base) | set(ours) | set(theirs)
    for key in all_keys:
        b = base[key] if key in base else _MISSING
        o = ours[key] if key in ours else _MISSING
        t = theirs[key] if key in theirs else _MISSING

        if _any_is_id_list(b, o, t):
            list_merged, list_conflicts, list_auto = _merge_id_list(key, b, o, t)
            if list_merged is not _MISSING:
                merged[key] = list_merged
            conflicts.extend(list_conflicts)
            auto_resolved += list_auto
        elif _all_three_dicts(b, o, t):
            # Recurse: top-level dict like `metadata: {...}` with all three
            # sides present. Yields field-level conflicts (e.g. `.metadata.tier`).
            sub_merged, sub_conflicts, sub_auto = _merge_dict_fields(
                f".{key}", b, o, t,
            )
            merged[key] = sub_merged
            conflicts.extend(sub_conflicts)
            auto_resolved += sub_auto
        else:
            scalar_value, scalar_conflict, scalar_auto = _merge_scalar(key, b, o, t)
            if scalar_value is not _MISSING:
                merged[key] = scalar_value
            if scalar_conflict is not None:
                conflicts.append(scalar_conflict)
            auto_resolved += scalar_auto

    return MergeResult(
        merged=merged,
        conflicts=conflicts,
        auto_resolved_count=auto_resolved,
    )


# ── Id-list merge ─────────────────────────────────────────────────────────


def _any_is_id_list(*values: Any) -> bool:
    """True if any present value is a non-empty list of dicts carrying `id`.

    Empty lists are ambiguous (scalar-shaped or id-list-shaped?); we treat
    them as scalar so that base=[], ours=[], theirs=[entry] is a one-sided
    add via scalar replacement rather than a spurious id-list merge on nothing.
    """
    return any(_is_id_list(v) for v in values)


def _is_id_list(value: Any) -> bool:
    if value is _MISSING:
        return False
    if not isinstance(value, list) or not value:
        return False
    return all(isinstance(x, dict) and "id" in x for x in value)


def _to_id_map(value: Any) -> dict[str, dict[str, Any]]:
    """Flatten an id-list into {id: entry}. Absent/non-list → empty map.

    Order invariant: Python dicts preserve insertion order (language
    guarantee since 3.7), and we iterate `value` in its native list order.
    `_restore_order` relies on this to emit the merged output in the
    admin's original sequence.
    """
    if value is _MISSING or not isinstance(value, list):
        return {}
    return {x["id"]: x for x in value if isinstance(x, dict) and "id" in x}


def _merge_id_list(
    key: str,
    base: Any,
    ours: Any,
    theirs: Any,
) -> tuple[Any, list[EntryConflict], int]:
    """Merge three id-lists entry-by-entry, keyed on `id`.

    Returns (merged_value, conflicts, auto_resolved_count) where merged_value
    is either a list or `_MISSING` (latter means: the key should be absent in
    the output, not set to `[]`).
    """
    base_map = _to_id_map(base)
    ours_map = _to_id_map(ours)
    theirs_map = _to_id_map(theirs)

    # Output entries keyed by id for ordering step; a side-table makes it
    # trivial to emit ours-order then theirs-only tail.
    resolved: dict[str, dict[str, Any]] = {}
    conflicts: list[EntryConflict] = []
    auto = 0

    all_ids = set(base_map) | set(ours_map) | set(theirs_map)
    for entry_id in all_ids:
        b = base_map.get(entry_id)
        o = ours_map.get(entry_id)
        t = theirs_map.get(entry_id)
        path = f".{key}[id={entry_id}]"

        entry, entry_conflicts, entry_auto = _merge_one_entry(path, b, o, t)
        if entry is not None:
            resolved[entry_id] = entry
        conflicts.extend(entry_conflicts)
        auto += entry_auto

    # Drop the key entirely when BOTH sides signal "no collection here"
    # (either missing or empty) and no entry survived the merge. Reached
    # when base had the id-list and ours+theirs both dropped it — without
    # this guard we'd emit an empty list, re-introducing the key with a
    # surprising default. Empty-list inputs are already routed to the
    # scalar path via `_any_is_id_list`, so `not ours_map and not theirs_map`
    # cleanly classifies "neither side kept any entries of this id-list".
    if not resolved and not ours_map and not theirs_map:
        return _MISSING, conflicts, auto

    ordered = _restore_order(resolved, ours_map, theirs_map)
    return ordered, conflicts, auto


def _merge_one_entry(
    path: str,
    base: dict[str, Any] | None,
    ours: dict[str, Any] | None,
    theirs: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, list[EntryConflict], int]:
    """Case analysis for one id-keyed entry, with field-level recursion.

    When all three sides are dicts, recurse into `_merge_dict_fields` so
    disjoint field-edits auto-merge and only same-field collisions surface
    as conflicts (D1).

    Entry-level edges (one side deleted the entry, one-sided add, convergent
    delete) still resolve at the whole-entry granularity via
    `_three_way_resolve` — recursion only makes sense when all three have a
    concrete dict to recurse into.

    Returns (resolved_entry | None_if_deleted, conflicts, auto_count).
    The conflicts list may be empty, singleton, or carry multiple items
    when recursion discovers several field-level collisions inside one entry.
    """
    if base is not None and ours is not None and theirs is not None and _all_three_dicts(base, ours, theirs):
        merged, conflicts, auto = _merge_dict_fields(path, base, ours, theirs)
        return merged, conflicts, auto

    value, conflict, auto = _three_way_resolve(
        path, base, ours, theirs, missing=None,
    )
    return value, ([conflict] if conflict is not None else []), auto


def _restore_order(
    resolved: dict[str, dict[str, Any]],
    ours_map: dict[str, dict[str, Any]],
    theirs_map: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Emit entries in: [ours-order for ours-present, then theirs-only tail].

    Admin's sequencing wins for entries they touched; upstream additions
    appear at the end so the admin can see them as a discrete "and these are
    new" block.

    Invariant: every id in `resolved` appears in either `ours_map` or
    `theirs_map` — `_merge_one_entry` never returns a non-None entry unless
    at least one of ours/theirs held it. So the two loops exhaust `resolved`
    and we don't need a third "present only in resolved" fallback.
    """
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry_id in ours_map:
        if entry_id in resolved:
            out.append(resolved[entry_id])
            seen.add(entry_id)
    for entry_id in theirs_map:
        if entry_id in resolved and entry_id not in seen:
            out.append(resolved[entry_id])
            seen.add(entry_id)
    return out


# ── Recursive dict-field merge (D1) ───────────────────────────────────────


def _all_three_dicts(base: Any, ours: Any, theirs: Any) -> bool:
    """True iff all three sides are **present** (not `_MISSING`) and dicts.

    The recursion guard for `_merge_dict_fields`. A side that's absent, a
    scalar, a list, or `None` fails this check and falls back to the
    entry/scalar comparison path. Importantly, `dict` excludes `list`
    instances — id-lists are dispatched separately at the layer above.
    """
    return (
        base is not _MISSING
        and ours is not _MISSING
        and theirs is not _MISSING
        and isinstance(base, dict)
        and isinstance(ours, dict)
        and isinstance(theirs, dict)
    )


def _merge_dict_fields(
    path_prefix: str,
    base: dict[str, Any],
    ours: dict[str, Any],
    theirs: dict[str, Any],
) -> tuple[dict[str, Any], list[EntryConflict], int]:
    """Recursive field-level merge of three dicts at the same path.

    Caller MUST have verified all three are dicts (`_all_three_dicts`).
    For each key in the union:

      - All three sides still dicts at that key → recurse.
      - Otherwise → delegate to `_three_way_resolve` with `_MISSING` as the
        absence sentinel (a `None` field value is a legitimate scalar).

    Notes:
      * Id-lists are NOT re-detected inside this function. Our packs don't
        nest id-lists inside entries (banter/encounter/loot/etc. are all
        top-level); `_merge_id_list` handles those, and its callback into
        `_merge_one_entry` still routes back here for within-entry dicts.
      * The merged dict may be empty when every field was deleted on both
        sides. The caller decides whether to drop the key (handled by
        scalar fallback emission `_MISSING`) or keep the empty container —
        we always return a concrete dict here because the recursion only
        fires when all three sides had SOMETHING at this path.
    """
    merged: dict[str, Any] = {}
    conflicts: list[EntryConflict] = []
    auto = 0

    all_keys = set(base) | set(ours) | set(theirs)
    for key in all_keys:
        b = base.get(key, _MISSING)
        o = ours.get(key, _MISSING)
        t = theirs.get(key, _MISSING)
        field_path = f"{path_prefix}.{key}"

        if _all_three_dicts(b, o, t):
            sub_merged, sub_conflicts, sub_auto = _merge_dict_fields(
                field_path, b, o, t,
            )
            merged[key] = sub_merged
            conflicts.extend(sub_conflicts)
            auto += sub_auto
            continue

        value, conflict, n = _three_way_resolve(
            field_path, b, o, t, missing=_MISSING,
        )
        if value is not _MISSING:
            merged[key] = value
        if conflict is not None:
            conflicts.append(conflict)
        auto += n

    return merged, conflicts, auto


# ── Scalar / opaque merge ─────────────────────────────────────────────────


def _merge_scalar(
    key: str,
    base: Any,
    ours: Any,
    theirs: Any,
) -> tuple[Any, EntryConflict | None, int]:
    """3-way merge for a top-level scalar or opaque (non-id-list) value.

    Thin wrapper over the generic `_three_way_resolve` with `_MISSING` as the
    "absent" sentinel — top-level dict keys carry `None` as a valid value
    (distinct from "key not present"), so we need a sentinel that's identity-
    comparable and won't collide with author data.

    Returns (resolved_value, conflict_or_none, auto_count). `resolved_value`
    of `_MISSING` means "key should be absent in output".
    """
    return _three_way_resolve(f".{key}", base, ours, theirs, missing=_MISSING)


# ── Generic 3-way resolver (shared by scalar + id-list entry paths) ────────


def _three_way_resolve(
    path: str,
    base: Any,
    ours: Any,
    theirs: Any,
    *,
    missing: Any,
) -> tuple[Any, EntryConflict | None, int]:
    """Case analysis for one 3-way-merge unit.

    `missing` is the caller-chosen sentinel for "not present". It's used both
    to classify inputs (`x is missing`) and as the return value when the
    output key/entry should be absent. Two callers today:

      - `_merge_scalar`     — passes `missing=_MISSING` (unique object), because
                              `None` is a valid scalar value in a dict.
      - `_merge_one_entry`  — passes `missing=None`, because `_to_id_map.get()`
                              naturally returns `None` for absent ids and no
                              entry value itself can be `None`.

    The five cases:
      1. Base absent → new on one or both sides. Same-value on both = auto;
         different-values = ADD_ADD_DIFFERENT (defaults to ours).
      2. Base present, both sides absent → stay deleted (auto, count=1).
      3. Base present, ours absent → safe-delete if theirs unchanged, else
         DELETE_MODIFY (defaults to theirs — preserves the non-destructive side).
      4. Base present, theirs absent → safe-delete if ours unchanged, else
         MODIFY_DELETE (defaults to ours).
      5. All three present → 3-way compare. Single-sided change or convergent
         edit = auto; divergent = MODIFY_MODIFY (defaults to ours).

    Returns (resolved_value, conflict_or_none, auto_count). `auto_count` is
    1 for every case the merger decided without admin input, EXCEPT the
    Case-5 "nothing changed on either side" branch which returns 0 (nothing
    was auto-resolved because nothing diverged in the first place).
    """
    # Case 1: base absent — add on one or both sides.
    if base is missing:
        if ours is missing and theirs is missing:
            return missing, None, 0  # vacuous — caller shouldn't invoke with all-missing
        if ours is missing:
            return theirs, None, 1  # theirs-only add
        if theirs is missing:
            return ours, None, 1  # ours-only add
        if ours == theirs:
            return ours, None, 1  # convergent add
        return (
            ours,
            EntryConflict(
                path=path,
                kind=ConflictKind.ADD_ADD_DIFFERENT,
                base=None,
                ours=ours,
                theirs=theirs,
            ),
            0,
        )

    # Case 2: base present, both sides absent — stay deleted.
    if ours is missing and theirs is missing:
        return missing, None, 1

    # Case 3: base present, ours absent.
    if ours is missing:
        if theirs == base:
            return missing, None, 1  # theirs unchanged → safe delete
        return (
            theirs,
            EntryConflict(
                path=path,
                kind=ConflictKind.DELETE_MODIFY,
                base=base,
                ours=None,
                theirs=theirs,
            ),
            0,
        )

    # Case 4: base present, theirs absent.
    if theirs is missing:
        if ours == base:
            return missing, None, 1  # ours unchanged → safe delete
        return (
            ours,
            EntryConflict(
                path=path,
                kind=ConflictKind.MODIFY_DELETE,
                base=base,
                ours=ours,
                theirs=None,
            ),
            0,
        )

    # Case 5: all three present — standard 3-way compare.
    o_changed = ours != base
    t_changed = theirs != base
    if not o_changed and not t_changed:
        return base, None, 0  # nothing to auto-count — nothing changed
    if o_changed and not t_changed:
        return ours, None, 1
    if not o_changed and t_changed:
        return theirs, None, 1
    if ours == theirs:
        return ours, None, 1  # convergent edit
    return (
        ours,
        EntryConflict(
            path=path,
            kind=ConflictKind.MODIFY_MODIFY,
            base=base,
            ours=ours,
            theirs=theirs,
        ),
        0,
    )
