"""`BANTER_TRIGGERS` must equal what the code actually emits.

The declaration is only worth something if it cannot drift from the call sites.
It is read by `scripts/validate_content_packs.py` to decide whether an authored
line is reachable — so a stale declaration would bless dead content again, which
is the defect this whole thing exists to prevent (Befund D6: 131 of 302 lines
unreachable).

The scan therefore reads the code, not the prose: every literal handed to
`emit_banter`/`select_banter`, every string assigned to `banter_trigger`, and
every string an archetype's `apply_drain` returns.
"""

from __future__ import annotations

import ast
from functools import cache
from pathlib import Path

import pytest

from backend.services.dungeon.dungeon_banter import BANTER_TRIGGERS

_BACKEND = Path(__file__).resolve().parents[2]
_STRATEGIES = _BACKEND / "services/dungeon/archetype_strategies.py"
#: Emitters live in the service layer. `test_no_emitter_outside_services`
#: keeps that true, so the scan can stay off the rest of the tree —
#: `backend/` also carries a stale `.venv` with 10 000 files in it.
_SCAN_ROOT = _BACKEND / "services"

_EMITTERS = ("emit_banter", "select_banter")


@cache
def _drain_triggers() -> frozenset[str]:
    """Strings returned by any archetype's `apply_drain`."""
    tree = ast.parse(_STRATEGIES.read_text(encoding="utf-8"))
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "apply_drain":
            for inner in ast.walk(node):
                if (
                    isinstance(inner, ast.Return)
                    and isinstance(inner.value, ast.Constant)
                    and isinstance(inner.value.value, str)
                ):
                    found.add(inner.value.value)
    return frozenset(found)


@cache
def _call_site_triggers() -> frozenset[str]:
    """Literals passed to an emitter, and literals assigned to `banter_trigger`."""
    found: set[str] = set()
    for path in _SCAN_ROOT.rglob("*.py"):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if (
                        isinstance(target, ast.Name)
                        and target.id == "banter_trigger"
                        and isinstance(node.value, ast.Constant)
                    ):
                        found.add(node.value.value)
            if isinstance(node, ast.Call):
                func = node.func
                name = (
                    func.id
                    if isinstance(func, ast.Name)
                    else (func.attr if isinstance(func, ast.Attribute) else None)
                )
                if name not in _EMITTERS:
                    continue
                for arg in [*node.args, *(kw.value for kw in node.keywords)]:
                    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                        found.add(arg.value)
                    # `emit_banter(..., "a" if cond else "b")`
                    if isinstance(arg, ast.IfExp):
                        for branch in (arg.body, arg.orelse):
                            if isinstance(branch, ast.Constant) and isinstance(branch.value, str):
                                found.add(branch.value)
    return frozenset(found)


@cache
def emitted() -> frozenset[str]:
    return _drain_triggers() | _call_site_triggers()


class TestTheScanReadsSomething:
    """Four measurements went green pointing at the wrong thing in one week.

    A scan that finds nothing must fail loudly rather than agree with any
    declaration at all.
    """

    def test_strategies_file_exists(self):
        assert _STRATEGIES.is_file()

    def test_drain_scan_is_not_empty(self):
        found = _drain_triggers()
        assert len(found) >= 15, f"Nur {len(found)} Drain-Trigger gefunden: {sorted(found)}"

    def test_call_site_scan_is_not_empty(self):
        found = _call_site_triggers()
        assert len(found) >= 10, f"Nur {len(found)} Aufrufstellen-Trigger: {sorted(found)}"

    def test_scan_finds_a_known_pair(self):
        """One from each half, so a half that silently stops reading is caught."""
        found = emitted()
        assert "room_entered" in found, "Aufrufstellen-Hälfte liest nicht"
        assert "visibility_zero" in found, "Drain-Hälfte liest nicht"


    def test_no_emitter_outside_services(self):
        """The scan root is an assumption; this is the assumption's test."""
        stray = []
        for path in _BACKEND.rglob("*.py"):
            parts = path.parts
            if ".venv" in parts or "tests" in parts:
                continue
            if _SCAN_ROOT in path.parents:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            if any(name in text for name in _EMITTERS):
                stray.append(str(path.relative_to(_BACKEND)))
        assert not stray, (
            f"Banter wird außerhalb von backend/services/ gesendet: {stray}. "
            f"_SCAN_ROOT erweitern, sonst übersieht der Vergleich diese Trigger."
        )


class TestDeclarationMatchesTheCode:
    def test_every_emitted_trigger_is_declared(self):
        undeclared = sorted(emitted() - BANTER_TRIGGERS)
        assert not undeclared, (
            f"Der Code sendet diese Trigger, BANTER_TRIGGERS kennt sie nicht: {undeclared}. "
            f"Der Validator würde Inhalt dafür als unerreichbar ablehnen."
        )

    def test_every_declared_trigger_is_emitted(self):
        unemitted = sorted(BANTER_TRIGGERS - emitted())
        assert not unemitted, (
            f"Deklariert, aber von nichts gesendet: {unemitted}. "
            f"Inhalt dafür wäre tot und der Validator ließe ihn durch."
        )


class TestTheThreeTriggersThatUsedToBeUnreachable:
    """The biggest groups from Befund D6, pinned by name.

    A future refactor that drops one of these call sites would otherwise silently
    return 29, 18 or 17 lines to the dead pile.
    """

    @pytest.mark.parametrize(
        "trigger",
        ["combat_won", "rest_start", "loot_found", "agent_stressed", "dungeon_completed"],
    )
    def test_is_emitted(self, trigger):
        assert trigger in emitted()
