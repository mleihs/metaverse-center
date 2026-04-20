"""3-way merge for content-draft conflict resolution (A1.7 Phase 5).

When a draft is marked 'conflict' (default-branch drift detected at publish
time), the admin's edits need to be reconciled with what landed on main in
the meantime. This module performs a semantic 3-way merge between:

    base    = content_drafts.base_content        (snapshot at draft-open)
    ours    = content_drafts.working_content     (admin's edits)
    theirs  = YAML fetched fresh from main       (what landed in between)

and produces:

    merged     = dict                            (auto-resolved where safe)
    conflicts  = list[EntryConflict]             (need admin resolution)

Granularity: **entry-level** for MVP. For list-of-dicts with a stable `id`
field (our pack convention), the unit of conflict is one entry object.
Scalar values (top-level strings, numbers, opaque nested dicts) are merged
as whole values. Field-level merge inside an entry is Phase 5+.

Auto-resolved cases (no admin prompt):
    - Only one side changed → take the changed side.
    - Both sides made the SAME change → take it (convergent edit).
    - Both sides added DIFFERENT entries (distinct ids) → union.
    - Both sides deleted the same entry → stay deleted.
    - Base had X; one side deleted; the other left it untouched → delete.

Conflict cases (admin must choose):
    MODIFY_MODIFY      — both sides modified the same entry differently.
    MODIFY_DELETE      — ours modified, theirs deleted.
    DELETE_MODIFY      — ours deleted, theirs modified.
    ADD_ADD_DIFFERENT  — both added an entry with the same id, different bodies.

Default-to-ours policy:
    When a conflict is surfaced, `merged` still returns a value — the admin's
    version (`ours`) for MODIFY_MODIFY / MODIFY_DELETE / ADD_ADD_DIFFERENT,
    `theirs` for DELETE_MODIFY (preserves the non-destructive side). The admin
    then flips to `theirs` via the resolve UI where appropriate. This means a
    naive admin who blindly accepts `merged` preserves their intent rather
    than silently losing upstream changes.

Ordering:
    Output list ordering follows `ours` for entries present there, then
    appends `theirs`-only entries (newly-added upstream) in their `theirs`
    order. Deletions drop the slot. This keeps the admin's hand-crafted
    sequencing visible while making upstream adds visible at the tail.

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
      - `.banter[id=sb_01]`   — conflicting id-list entry
      - `.name`               — conflicting top-level scalar
      - `.metadata`           — conflicting opaque nested value
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
    """Entry-level 3-way merge of three top-level dicts.

    Dispatch per top-level key:
      - If the value in any of the three sides is a list-of-dicts-with-`id`,
        treat the key as an id-list and delegate to `_merge_id_list`.
      - Otherwise, treat the value as atomic and delegate to `_merge_scalar`.

    "Atomic" includes nested dicts: they're compared structurally via `==`.
    A change anywhere inside `metadata: {...}` flags the whole `metadata`
    key as changed. This is a deliberate MVP simplification — the common
    pattern in our packs is id-list content (banter, encounters, loot,
    abilities, enemies, objektanker), with only small scalar/metadata
    keys alongside. Adding recursive dict-merge is Phase 5+.
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

        entry, entry_conflict, entry_auto = _merge_one_entry(path, b, o, t)
        if entry is not None:
            resolved[entry_id] = entry
        if entry_conflict is not None:
            conflicts.append(entry_conflict)
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
) -> tuple[dict[str, Any] | None, EntryConflict | None, int]:
    """Case analysis for one id-keyed entry.

    Returns (resolved_entry | None_if_deleted, conflict_or_none, auto_count).
    """
    # Case 1: base missing — entry is new on one or both sides.
    if base is None:
        if ours is None:
            return theirs, None, 1  # theirs-only add
        if theirs is None:
            return ours, None, 1  # ours-only add
        if ours == theirs:
            return ours, None, 1  # same add on both sides
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

    # Case 2: base present, both sides deleted — stay deleted.
    if ours is None and theirs is None:
        return None, None, 1

    # Case 3: base present, ours deleted, theirs present.
    if ours is None:
        if theirs == base:
            return None, None, 1  # theirs unchanged, safe to delete
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

    # Case 4: base present, ours present, theirs deleted.
    if theirs is None:
        if ours == base:
            return None, None, 1  # ours unchanged, safe to delete
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

    # Case 5: all three present — standard 3-way scalar merge on the entry.
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


# ── Scalar / opaque merge ─────────────────────────────────────────────────


def _merge_scalar(
    key: str,
    base: Any,
    ours: Any,
    theirs: Any,
) -> tuple[Any, EntryConflict | None, int]:
    """3-way merge for a top-level scalar or opaque (non-id-list) value.

    Returns (resolved_value, conflict_or_none, auto_count). `resolved_value`
    of `_MISSING` means "key should be absent in output".
    """
    path = f".{key}"
    b_pres = base is not _MISSING
    o_pres = ours is not _MISSING
    t_pres = theirs is not _MISSING

    # Case: base absent, one or both sides add.
    if not b_pres:
        if o_pres and t_pres:
            if ours == theirs:
                return ours, None, 1
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
        if o_pres:
            return ours, None, 1
        if t_pres:
            return theirs, None, 1
        return _MISSING, None, 0  # vacuous (shouldn't reach here)

    # Case: base present, both absent — treat as both-deleted (vacuous).
    if not o_pres and not t_pres:
        return _MISSING, None, 1

    # Case: base present, ours absent.
    if not o_pres:
        if theirs == base:
            return _MISSING, None, 1  # theirs unchanged → safe delete
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

    # Case: base present, theirs absent.
    if not t_pres:
        if ours == base:
            return _MISSING, None, 1  # ours unchanged → safe delete
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

    # Case: all three present — standard 3-way.
    o_changed = ours != base
    t_changed = theirs != base
    if not o_changed and not t_changed:
        return base, None, 0
    if o_changed and not t_changed:
        return ours, None, 1
    if not o_changed and t_changed:
        return theirs, None, 1
    if ours == theirs:
        return ours, None, 1  # convergent
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
