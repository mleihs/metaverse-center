"""Kein Moodlet ohne Deckel (D10-5).

`fn_add_moodlet_capped` prüft den Deckel nur, wenn eine Gruppe genannt ist:

    IF p_stacking_group IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(…);
      SELECT COUNT(*) … WHERE stacking_group = p_stacking_group;
      IF v_current_count >= p_stacking_cap THEN RETURN FALSE; END IF;
    END IF;

Ein Aufruf ohne `stacking_group` umgeht also nicht den Deckel — er umgeht die
ganze Prüfung. Der Name der Funktion sagt „capped", und für diesen Aufruf war
sie es nie. Genau eine Stelle war betroffen: das Moodlet des Angreifers in
`AgentActivityService._execute_interaction` (Zufriedenheit nach einer
Beleidigung, Schuld nach einer Auseinandersetzung). Das Moodlet daneben, das
dasselbe Gespräch beim EMPFÄNGER auslöst, trug seine Gruppe von Anfang an.

WARUM DAS TOR ANDERS AUSSIEHT, ALS MAN ES ZUERST SCHREIBT
---------------------------------------------------------
Der erste Scan dieser Sitzung meldete DREI ungedeckelte Stellen. Zwei davon
waren Fehlalarme: `AutonomousEventService` ruft

    await AgentMoodService.add_moodlet(…, **witness_moodlet, …)

und `stacking_group` steht in dem Wörterbuch, das dort ausgepackt wird. Ein
Scanner, der nur nach Schlüsselwörtern am Aufruf sucht, sieht das nicht — er
sieht ein `**` und schweigt. Das ist J3c in klein: der Filter war zu eng, das
Ergebnis kurz, sauber und falsch.

Dieses Tor löst `**`-Auspackungen deshalb auf, wo die Quelle ein literales
Wörterbuch im selben Modul ist, und meldet jede Auspackung, deren Quelle es
NICHT auflösen kann, als ungeprüft — lieber ein lautes „weiß ich nicht" als ein
stilles „ist in Ordnung".
"""

from __future__ import annotations

import ast
from functools import lru_cache
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260411200000_197_plpgsql_hardening.sql"


def _dict_literals(tree: ast.Module) -> dict[str, ast.Dict]:
    """Every module-level name bound to a dict literal, plus nested dict values.

    ``TRIGGERS = {"stress_breakdown": {"moodlet_for_witnesses": {…}}}`` — the
    unpacked value is a nested dict, reached through a subscript chain, so the
    whole nesting is indexed rather than only the top level.
    """
    found: dict[str, ast.Dict] = {}
    for node in ast.walk(tree):
        # `TRIGGERS: dict[str, dict] = {...}` is an AnnAssign, not an Assign.
        # Missing that branch is why the first version of this gate reported
        # zero resolved unpackings — it walked past every annotated table in
        # the codebase, and every such table is annotated.
        if isinstance(node, ast.AnnAssign) and isinstance(node.value, ast.Dict):
            if isinstance(node.target, ast.Name):
                found[node.target.id] = node.value
        elif isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    found[target.id] = node.value
    return found


def _keys_of_nested_dicts(node: ast.Dict) -> set[str]:
    """All string keys appearing anywhere inside a (possibly nested) dict."""
    keys: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Dict):
            for key in child.keys:
                if isinstance(key, ast.Constant) and isinstance(key.value, str):
                    keys.add(key.value)
    return keys


def _name_bindings(tree: ast.Module) -> dict[str, ast.expr]:
    """Every simple ``name = <expr>`` in the module, at any nesting depth.

    Needed because the unpacked value is usually a local:

        trigger_config  = TRIGGERS.get(trigger, {})
        witness_moodlet = trigger_config.get("moodlet_for_witnesses")
        await AgentMoodService.add_moodlet(…, **witness_moodlet, …)

    A resolver that only knows module-level dict literals stops at
    ``witness_moodlet`` and reports a defect that is not there — which is
    exactly the false positive this gate exists to avoid.
    """
    bindings: dict[str, ast.expr] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign) and node.value is not None:
            if isinstance(node.target, ast.Name) and node.target.id not in bindings:
                bindings[node.target.id] = node.value
        elif isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id not in bindings:
                bindings[target.id] = node.value
    return bindings


class _CallScanner(ast.NodeVisitor):
    def __init__(self, path: Path, module: ast.Module) -> None:
        self.path = path
        self.dicts = _dict_literals(module)
        self.bindings = _name_bindings(module)
        self.capped: list[str] = []
        self.uncapped: list[str] = []
        self.unresolved: list[str] = []

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802 (ast API)
        if getattr(node.func, "attr", None) == "add_moodlet":
            where = f"{self.path.relative_to(REPO)}:{node.lineno}"
            named = {kw.arg for kw in node.keywords if kw.arg is not None}
            if "stacking_group" in named:
                self.capped.append(where)
            else:
                unpacked = [kw.value for kw in node.keywords if kw.arg is None]
                if not unpacked:
                    self.uncapped.append(where)
                elif self._unpacking_supplies_the_group(unpacked):
                    self.capped.append(where)
                else:
                    self.unresolved.append(where)
        self.generic_visit(node)

    def _unpacking_supplies_the_group(self, unpacked: list[ast.expr]) -> bool:
        """Resolve ``**x`` back to a module-level dict literal, through locals.

        Follows ``.get(…)`` calls, subscripts and local re-bindings, with a
        bounded number of hops so a cycle cannot hang the test.
        """
        for value in unpacked:
            root: ast.expr | None = value
            for _ in range(8):
                if root is None:
                    break
                # unwrap  cfg.get("moodlet_for_witnesses")  →  cfg
                if isinstance(root, ast.Call) and isinstance(root.func, ast.Attribute):
                    root = root.func.value
                    continue
                if isinstance(root, ast.Subscript):
                    root = root.value
                    continue
                name = getattr(root, "id", None)
                if name is None:
                    break
                if name in self.dicts:
                    return "stacking_group" in _keys_of_nested_dicts(self.dicts[name])
                if name in self.bindings:
                    root = self.bindings[name]
                    continue
                break
        return False


@lru_cache(maxsize=1)
def _scan() -> tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]]:
    capped: list[str] = []
    uncapped: list[str] = []
    unresolved: list[str] = []
    for path in sorted(BACKEND.rglob("*.py")):
        if "tests" in path.parts:
            continue
        try:
            module = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:  # pragma: no cover
            continue
        scanner = _CallScanner(path, module)
        scanner.visit(module)
        capped += scanner.capped
        uncapped += scanner.uncapped
        unresolved += scanner.unresolved
    return tuple(capped), tuple(uncapped), tuple(unresolved)


class TestTheGateItself:
    """A scan that finds nothing must be red, not green (J3)."""

    def test_it_actually_finds_the_call_sites(self) -> None:
        capped, uncapped, unresolved = _scan()
        total = len(capped) + len(uncapped) + len(unresolved)
        assert total >= 5, f"nur {total} add_moodlet-Aufrufe gefunden — der Scan ist kaputt"
        assert capped, "keine einzige gedeckelte Stelle gefunden — der Scan ist kaputt"

    def test_it_resolves_the_two_star_star_call_sites(self) -> None:
        """The false positives that made this gate necessary must stay resolved.

        `AutonomousEventService` passes `**witness_moodlet` / `**participant_moodlet`
        out of the module-level TRIGGERS table. A gate that cannot follow that
        would report two defects that do not exist — and the next reader would
        "fix" a table that is already correct.
        """
        capped, _, unresolved = _scan()
        autonomous = [site for site in capped if "autonomous_event_service" in site]
        assert len(autonomous) == 2, (
            f"die beiden **-Stellen in autonomous_event_service sind nicht als gedeckelt erkannt worden: {autonomous}"
        )
        assert not unresolved, (
            "unauflösbare **-Auspackung — der Scanner weiß nicht, ob dort eine "
            f"Gruppe steht, und darf das nicht als in Ordnung durchgehen lassen: {unresolved}"
        )


class TestNoMoodletEscapesTheCap:
    def test_every_call_site_names_a_stacking_group(self) -> None:
        _, uncapped, _ = _scan()
        assert not uncapped, (
            "add_moodlet ohne stacking_group. fn_add_moodlet_capped überspringt "
            "bei NULL die GANZE Deckelprüfung (Migration 197), diese Moodlets "
            "stapeln sich also unbegrenzt:\n  " + "\n  ".join(uncapped)
        )

    def test_every_used_group_has_a_declared_cap(self) -> None:
        """An undeclared group silently inherits DEFAULT_STACKING_CAP.

        That is not wrong, but it is invisible: the number would live nowhere a
        reader looks. Every group a call site names must appear in STACKING_CAPS.
        """
        from backend.services.agent_mood_service import STACKING_CAPS

        used: set[str] = set()
        for path in sorted(BACKEND.rglob("*.py")):
            if "tests" in path.parts:
                continue
            try:
                module = ast.parse(path.read_text(encoding="utf-8"))
            except SyntaxError:  # pragma: no cover
                continue
            for node in ast.walk(module):
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    continue
            for node in ast.walk(module):
                if isinstance(node, ast.Call) and getattr(node.func, "attr", None) == "add_moodlet":
                    for keyword in node.keywords:
                        if keyword.arg == "stacking_group" and isinstance(keyword.value, ast.Constant):
                            used.add(str(keyword.value.value))
                        elif keyword.arg == "stacking_group" and isinstance(keyword.value, ast.IfExp):
                            for branch in (keyword.value.body, keyword.value.orelse):
                                if isinstance(branch, ast.Constant):
                                    used.add(str(branch.value))

        missing = sorted(group for group in used if group not in STACKING_CAPS)
        assert not missing, f"Gruppe benutzt, aber in STACKING_CAPS nicht erklärt: {missing}"

    def test_the_aggressor_moodlet_is_the_one_that_was_missing(self) -> None:
        """Named explicitly, so a revert reads as a regression and not as noise."""
        capped, _, _ = _scan()
        assert any("agent_activity_service" in site for site in capped)
        source = (BACKEND / "services" / "agent_activity_service.py").read_text(encoding="utf-8")
        block = source[source.index("aggressor_effect = interaction.get") :]
        block = block[: block.index("# Fulfill social need")]
        assert 'stacking_group="social_self"' in block


class TestTheSqlActuallySkipsTheCheckOnNull:
    """The premise of this whole file, asserted against the migration."""

    def test_the_cap_check_is_inside_an_is_not_null_branch(self) -> None:
        sql = MIGRATION.read_text(encoding="utf-8")
        start = sql.index("CREATE OR REPLACE FUNCTION fn_add_moodlet_capped")
        body = sql[start : sql.index("$$;", start)]
        guard = body.index("IF p_stacking_group IS NOT NULL THEN")
        count = body.index("SELECT COUNT(*)")
        cap = body.index("IF v_current_count >= p_stacking_cap THEN")
        assert guard < count < cap, (
            "die Deckelprüfung sitzt nicht mehr hinter dem NULL-Tor — dann "
            "beschreibt dieses Tor einen Zustand, den es nicht mehr gibt"
        )
