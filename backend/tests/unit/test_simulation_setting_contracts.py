"""A control that writes into a drawer nobody opens.

Every slider on the Autonomy screen was inert until 30.08.2026, and nothing
anywhere said so. The panel wrote its rows under ``category='autonomy'``; the
heartbeat read ``category='heartbeat'``. The rows saved, the screen showed them
back after a reload, and the tick quietly used its hard-coded defaults. The bond
whisper budget had the same shape under ``'bonds'``.

The knowledge that failed was "which drawer does this key live in", held in two
files that could not see each other. It now lives in
``services/simulation_setting_contracts`` and this test binds it to the code that
reads it, by AST — the pattern ``test_prompt_contracts`` established.

The scan is measured, not trusted: the first test asserts the scan finds
something at all. W4 cost a day to the opposite mistake — a green gate that was
looking at the wrong argument and reporting zero findings as success.
"""

from __future__ import annotations

import ast
from pathlib import Path

from backend.services.simulation_setting_contracts import (
    HEARTBEAT_OVERRIDE_KEYS,
    SETTING_CATEGORIES,
    heartbeat_override_categories,
)

_BACKEND = Path(__file__).resolve().parents[2]

#: Every module that reads a value out of the tick's ``overrides`` dict. The
#: weather service is on the list because the heartbeat hands it the same dict.
_READER_FILES = (
    _BACKEND / "services" / "heartbeat_service.py",
    _BACKEND / "services" / "ambient_weather_service.py",
)


def _overrides_keys(path: Path) -> set[str]:
    """Literal keys read as ``overrides.get("…")`` / ``overrides["…"]`` in one module."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found: set[str] = set()

    for node in ast.walk(tree):
        # overrides.get("key", default)
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "overrides"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            found.add(node.args[0].value)
        # overrides["key"]
        elif (
            isinstance(node, ast.Subscript)
            and isinstance(node.value, ast.Name)
            and node.value.id == "overrides"
            and isinstance(node.slice, ast.Constant)
            and isinstance(node.slice.value, str)
        ):
            found.add(node.slice.value)

    return found


def _all_read_keys() -> set[str]:
    keys: set[str] = set()
    for path in _READER_FILES:
        keys |= _overrides_keys(path)
    return keys


def test_the_scan_finds_something():
    """A gate that reports nothing must fail loudly, not pass quietly."""
    for path in _READER_FILES:
        assert path.exists(), path
    keys = _all_read_keys()
    assert len(keys) >= 10, f"the AST scan found only {sorted(keys)} — it is pointing at the wrong thing"


def test_every_key_the_tick_reads_is_declared():
    """A value read without a declaration is read out of a guessed category."""
    undeclared = _all_read_keys() - set(HEARTBEAT_OVERRIDE_KEYS)
    assert not undeclared, (
        f"read from overrides but not declared in simulation_setting_contracts: {sorted(undeclared)}. "
        "Declare the key with the category the writing panel uses."
    )


def test_every_declared_key_is_actually_read():
    """A declaration nothing reads is a control with no effect, written down as if it had one."""
    unread = set(HEARTBEAT_OVERRIDE_KEYS) - _all_read_keys()
    assert not unread, f"declared but never read: {sorted(unread)}"


def test_every_declared_category_is_a_known_category():
    unknown = set(HEARTBEAT_OVERRIDE_KEYS.values()) - SETTING_CATEGORIES
    assert not unknown, f"declared under unknown categories: {sorted(unknown)}"


def test_the_loader_asks_for_every_category_the_declaration_names():
    """The query must cover the drawers, or a declared key is still invisible."""
    assert set(heartbeat_override_categories()) == set(HEARTBEAT_OVERRIDE_KEYS.values())


def test_the_loader_no_longer_hard_codes_a_single_category():
    """The defect itself: one literal category in the override query."""
    source = (_BACKEND / "services" / "heartbeat_service.py").read_text(encoding="utf-8")
    start = source.index("async def _load_sim_overrides")
    body = source[start : start + 1600]
    assert '.eq("category"' not in body, "the override loader is filtering on one hard-coded category again"
    assert "heartbeat_override_categories()" in body


def test_the_panels_write_the_declared_categories():
    """The other half of the pair: what the settings screens actually store under.

    Read out of the panel sources rather than trusted, because this is precisely
    the knowledge that drifted apart.
    """
    panels = _BACKEND.parent / "frontend" / "src" / "components" / "settings"
    expected = {
        "AutonomySettingsPanel.ts": "heartbeat",
        "WeatherSettingsPanel.ts": "heartbeat",
        "BondSettingsPanel.ts": "bonds",
    }
    for filename, category in expected.items():
        source = (panels / filename).read_text(encoding="utf-8")
        assert f"return '{category}' as const;" in source, (
            f"{filename} no longer writes category '{category}' — "
            "update HEARTBEAT_OVERRIDE_KEYS in the same change, or the tick stops seeing it"
        )
