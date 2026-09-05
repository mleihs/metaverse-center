"""Every ``platform_settings`` key the backend READS must exist in a migration.

Why this gate exists (D10-3, measured 31.08.2026): ``EventService`` read a key
called ``heartbeat_interval``. No migration and no production row has ever
carried that name — the real key is ``heartbeat_interval_seconds``. Because
``PlatformConfigService.get`` returns the caller's default on a miss, the wrong
name produced no error, no log line and no Sentry event. It simply used 300
seconds forever, so a Deluge/Tower T3 ward with ``duration_ticks = 10`` expired
after 50 minutes instead of the ~40 hours it promised.

That is the whole failure class: **a key name that is wrong is indistinguishable
at runtime from a key that is merely unset.** Both take the default branch. The
only place the difference is visible is here, against the migrations.

Scope and its limits, stated on purpose (J3c — a filter that is too narrow is
the more dangerous kind):

* Only reads whose receiver chain is rooted at ``.table("platform_settings")``
  are collected. ``simulation_settings`` carries per-world keys written by the
  Forge (``dungeon_override``, ``design.color_primary``, ``bot_chat_mode``, …);
  those are data, not schema, and must NOT be seeded.
* ``PlatformConfigService.get`` / ``.get_multiple`` always read
  ``platform_settings``, so their literal keys are collected — with the
  ``prefix=`` keyword applied, because ``get_multiple({"max_attunements": …},
  prefix="heartbeat_")`` actually queries ``heartbeat_max_attunements``. A scan
  that ignored the prefix would report two false positives.
* Keys assembled at runtime (f-strings, variables) are invisible here. This gate
  narrows the surface; it does not close it.

And per J3: a scan that finds nothing must fail loudly rather than pass quietly,
so the floors below assert that the scan actually saw something.
"""

from __future__ import annotations

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
SUPABASE = REPO / "supabase"

# Keys that are deliberately absent from every migration, each with the reason.
# A key belongs here only when NOT seeding it is the correct behaviour — never
# to silence a genuine miss.
UNSEEDED_ON_PURPOSE: dict[str, str] = {
    # Operator-entered secrets. Seeding a placeholder would arm a fail-closed
    # gate with an invalid credential, which is worse than an absent row.
    "guardian_api_key": "operator-entered secret, never seeded",
    "newsapi_api_key": "operator-entered secret, never seeded",
    "openrouter_api_key": "operator-entered secret, never seeded",
    # Scheduler gates whose MEASURED default-when-missing is ON.
    #
    # ⚠ The first version of this list said "fail-closed gate, absent row means
    # off". That was wrong, and the way it was wrong is worth keeping:
    # `parse_setting_bool` IS fail-closed (F32), but that governs what happens
    # to a VALUE that arrives. It says nothing about a row that never arrives —
    # then the caller's own default decides, and
    # `resonance_scheduler._DEFAULT_ENABLED` is True. The loop only overrides it
    # when a row comes back, so on production, where no row exists, the
    # scheduler RUNS.
    #
    # **A fail-closed parser is not a fail-closed absence.** Measured
    # 31.08.2026 (found by the parallel session, confirmed here): the single
    # row in `substrate_resonances` stands at `subsiding`, not `detected` — it
    # has been processed. A closed gate would have left it lying there.
    #
    # They stay unseeded because that is the current, deliberate state, not
    # because absence means off. Any entry added below must state its MEASURED
    # default, not the one its name suggests.
    "resonance_auto_process_enabled": "no row on prod; caller default is True, so it runs",
    "resonance_auto_process_interval_seconds": "companion of the key above; caller default 3600",
}


def _table_of_chain(node: ast.AST) -> str | None:
    """Walk a postgrest builder chain back to its ``.table("<name>")`` root.

    ``supabase.table("platform_settings").select(...).eq("setting_key", k)``
    parses as nested Calls; the receiver of each ``.attr`` call is the previous
    Call. Returns the literal table name, or None when the chain is not rooted
    at a literal ``.table(...)``.
    """
    cur: ast.AST | None = node
    while isinstance(cur, ast.Call) and isinstance(cur.func, ast.Attribute):
        if cur.func.attr == "table" and cur.args and isinstance(cur.args[0], ast.Constant):
            value = cur.args[0].value
            return value if isinstance(value, str) else None
        cur = cur.func.value
    return None


class _KeyCollector(ast.NodeVisitor):
    def __init__(self, path: Path) -> None:
        self.path = path
        self.keys: list[tuple[str, int]] = []
        self.sites = 0

    def _record(self, node: ast.AST, key: object) -> None:
        if isinstance(key, str) and key:
            self.keys.append((key, getattr(node, "lineno", 0)))

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802 (ast API)
        func = node.func
        attr = getattr(func, "attr", None)

        # (a) .eq("setting_key", "x") / .in_("setting_key", ["x", "y"])
        if (
            attr in {"eq", "in_"}
            and len(node.args) == 2
            and isinstance(node.args[0], ast.Constant)
            and node.args[0].value == "setting_key"
            and _table_of_chain(node) == "platform_settings"
        ):
            self.sites += 1
            arg = node.args[1]
            if isinstance(arg, ast.Constant):
                self._record(arg, arg.value)
            elif isinstance(arg, ast.List | ast.Tuple):
                for element in arg.elts:
                    if isinstance(element, ast.Constant):
                        self._record(element, element.value)

        # (b) PlatformConfigService.get(client, "key", default)
        if (
            attr == "get"
            and isinstance(func, ast.Attribute)
            and getattr(func.value, "id", "") == "PlatformConfigService"
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
        ):
            self.sites += 1
            self._record(node.args[1], node.args[1].value)

        # (c) PlatformConfigService.get_multiple(client, {...}, prefix="…")
        if attr == "get_multiple":
            prefix = ""
            for keyword in node.keywords:
                if keyword.arg == "prefix" and isinstance(keyword.value, ast.Constant):
                    prefix = str(keyword.value.value or "")
            for arg in node.args:
                if isinstance(arg, ast.Dict):
                    self.sites += 1
                    for key_node in arg.keys:
                        if isinstance(key_node, ast.Constant) and isinstance(key_node.value, str):
                            self._record(key_node, f"{prefix}{key_node.value}")

        self.generic_visit(node)


def _collect() -> tuple[dict[str, list[str]], int, int]:
    keys: dict[str, list[str]] = {}
    sites = 0
    files = 0
    for path in sorted(BACKEND.rglob("*.py")):
        if "tests" in path.parts:
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:  # pragma: no cover — a broken file fails elsewhere
            continue
        files += 1
        collector = _KeyCollector(path)
        collector.visit(tree)
        sites += collector.sites
        for key, lineno in collector.keys:
            keys.setdefault(key, []).append(f"{path.relative_to(REPO)}:{lineno}")
    return keys, sites, files


def _seeded_keys() -> str:
    """All SQL under supabase/, concatenated once — migrations and seed."""
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(SUPABASE.rglob("*.sql")))


class TestTheGateItself:
    """A scan that finds nothing must be red, not green (J3)."""

    def test_scan_sees_call_sites(self) -> None:
        keys, sites, files = _collect()
        assert files > 200, f"only {files} backend modules parsed — the walk is broken"
        assert sites >= 20, f"only {sites} platform_settings read sites found — the scan is broken"
        assert len(keys) >= 30, f"only {len(keys)} distinct keys found — the scan is broken"

    def test_sql_corpus_is_readable(self) -> None:
        sql = _seeded_keys()
        assert len(sql) > 100_000, "supabase/**.sql came back nearly empty — wrong path?"
        assert "'heartbeat_interval_seconds'" in sql, "the known-good key is missing from the corpus"

    def test_a_bogus_key_would_be_caught(self) -> None:
        """The comparison must actually reject an unknown name."""
        assert "'heartbeat_interval_no_such_key'" not in _seeded_keys()


class TestEveryReadKeyIsSeeded:
    def test_no_unseeded_platform_settings_key(self) -> None:
        keys, _, _ = _collect()
        sql = _seeded_keys()
        missing = {
            key: sites
            for key, sites in sorted(keys.items())
            if f"'{key}'" not in sql and key not in UNSEEDED_ON_PURPOSE
        }
        assert not missing, (
            "platform_settings keys are read in code but seeded by no migration.\n"
            "A wrong name is silent: PlatformConfigService returns the caller's "
            "default and nothing logs.\n"
            + "\n".join(f"  {key}\n      {', '.join(sites)}" for key, sites in missing.items())
        )

    def test_allowlist_carries_no_stale_entries(self) -> None:
        """An allowlisted key that IS seeded no longer needs the exception."""
        sql = _seeded_keys()
        stale = [key for key in UNSEEDED_ON_PURPOSE if f"'{key}'" in sql]
        assert not stale, f"seeded after all — drop from UNSEEDED_ON_PURPOSE: {stale}"


class TestHeartbeatIntervalHasOneName:
    """D10-3 in particular: two consumers, one key, one default."""

    def test_both_consumers_use_the_shared_constant(self) -> None:
        from backend.utils.settings import (
            HEARTBEAT_INTERVAL_DEFAULT_SECONDS,
            HEARTBEAT_INTERVAL_SETTING,
        )

        assert HEARTBEAT_INTERVAL_SETTING == "heartbeat_interval_seconds"
        assert HEARTBEAT_INTERVAL_DEFAULT_SECONDS == 14400

        from backend.services import heartbeat_service

        assert heartbeat_service._DEFAULT_INTERVAL == HEARTBEAT_INTERVAL_DEFAULT_SECONDS

    def test_event_service_no_longer_names_the_key_itself(self) -> None:
        """The literal must be gone from the ward-expiry block, not merely fixed.

        Asserted against the enclosing function, not the whole file (J3) — a
        file-wide search would also match the comment that explains the defect
        (J3b), which names the wrong key on purpose.
        """
        source = (BACKEND / "services" / "event_service.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        # String CONSTANTS only. Identifiers are excluded on purpose: the local
        # variable is still called `heartbeat_interval`, which is correct — it
        # holds an interval, it does not name a settings key. Comments are gone
        # by construction, since ast never carries them (J3b).
        literals = [
            node.value for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str)
        ]
        assert "heartbeat_interval" not in literals, (
            "event_service.py still carries the bare key name 'heartbeat_interval' "
            "as a string literal — it must read HEARTBEAT_INTERVAL_SETTING"
        )
