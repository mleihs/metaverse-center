"""Bind ``key_source`` to the call sites that spend somebody's key, by AST.

``ai_usage_log.key_source`` answers one question: WHO PAID. It has carried the
value ``'byok'`` in its CHECK constraint since migration 150 and, measured on
production on 2026-09-02, had never once been written — 604 of 604 rows said
``platform``, including every call a user paid for out of their own OpenRouter
account. The default was doing all the talking.

That is not a bookkeeping detail. ``get_budget_states`` weighs the ledger
against ``ai_budget``, and ``BudgetEnforcementService.pre_check`` blocks the
next model call when the period is over the cap. Money the platform never
spent, counted against the platform's cap, would let the most generous group of
users throttle the service for everyone (migration 332 excludes it — but only
if the rows are labelled).

The property checked here is the same shape as property 4 in
``test_ai_purposes.py``, and for the same reason: two facts about one call are
stated in two places, and nothing compared them. If a function builds its agent
with a key it was handed — ``create_forge_agent(api_key=<name>)`` — then every
``run_ai`` in that function must say where that key came from.

Deliberately per-function and deliberately coarse, exactly as the purpose gate
is: a function that builds one agent and makes three calls on it passes when
all three say so. It does not try to follow the variable, and it does not
inspect what the key IS — only that the question was answered at all.
"""

from __future__ import annotations

import ast
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2]
_SOURCE_DIRS = ("services", "routers", "utils", "workers")


def _source_files() -> list[Path]:
    files: list[Path] = []
    for name in _SOURCE_DIRS:
        directory = _BACKEND / name
        if directory.is_dir():
            files.extend(sorted(directory.rglob("*.py")))
    assert files, "no backend source files found — the path constants are wrong"
    return files


def _call_name(node: ast.Call) -> str | None:
    return getattr(node.func, "id", None) or getattr(node.func, "attr", None)


def _keyword(node: ast.Call, name: str) -> ast.expr | None:
    for keyword in node.keywords:
        if keyword.arg == name:
            return keyword.value
    return None


def _carries_a_supplied_key(node: ast.Call) -> bool:
    """Was this agent built with a key the caller handed in?

    ``api_key=None`` (``ops_forecast_service``) and an omitted ``api_key`` both
    mean the platform key from settings — there is nothing to attribute. A name
    or an attribute means a key travelled here from somewhere, and the somewhere
    is what the ledger needs.
    """
    value = _keyword(node, "api_key")
    if value is None:
        return False
    return not (isinstance(value, ast.Constant) and value.value is None)


def test_a_call_that_may_spend_a_personal_key_says_so() -> None:
    problems: list[str] = []

    for path in _source_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        rel = path.relative_to(_BACKEND).as_posix()
        for func in ast.walk(tree):
            if not isinstance(func, ast.AsyncFunctionDef | ast.FunctionDef):
                continue

            supplied_key = False
            runs: list[tuple[int, bool]] = []
            for node in ast.walk(func):
                if not isinstance(node, ast.Call):
                    continue
                name = _call_name(node)
                if name == "create_forge_agent" and _carries_a_supplied_key(node):
                    supplied_key = True
                elif name == "run_ai":
                    runs.append((node.lineno, _keyword(node, "key_source") is not None))

            if not supplied_key:
                continue
            for lineno, answered in runs:
                if not answered:
                    problems.append(f"backend/{rel}:{lineno} (in {func.name}())")

    assert not problems, (
        "run_ai is called with an agent built from a key the caller supplied, without "
        "saying whose key it is. Pass key_source=key_source_for(<the key>) — otherwise "
        "the row lands in ai_usage_log as 'platform' and counts against a cap on money "
        "the platform did not spend:\n" + "\n".join(f"  {p}" for p in problems)
    )
