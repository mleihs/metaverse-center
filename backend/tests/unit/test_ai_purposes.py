"""Bind ``ai_purposes.AI_PURPOSES`` to the call sites that use it, by AST.

The declaration in ``backend/services/ai_purposes.py`` is only worth having if
it cannot drift from the code. Nothing here mocks a model or makes a call — the
whole point is that these are *static* facts about the source tree, checkable
without a network and without a database.

Four properties, each of which was false at some point on 2026-08-30:

1. Every purpose passed to ``run_ai`` is declared.
   Was false for ``style_refine``, ``templates`` and ``ops_forecast``.
2. Every declared purpose is used at least once.
   Was false for ``ascii_art``, which had a budget and a timeout and makes no
   model call at all.
3. Every ``create_forge_agent`` call passes ``purpose=``.
   Was true at 1 of 9 call sites (finding 11).
4. The purpose an agent is built with is the purpose its ``run_ai`` uses.
   Was false at 8 of 9 call sites: the model came from ``"forge"`` while the
   budget, the timeout and the thinking level came from the real purpose.

Property 4 is the one that needs explaining. It is checked per function: within
one function body, the set of purposes given to ``create_forge_agent`` must
equal the set given to ``run_ai``. That is deliberately coarser than following
the variable — a function that builds one agent and runs three ``chunk`` calls
on it passes, which is the real shape at
``forge_orchestrator_service._generate_chunk`` — and it is strict enough to
catch the defect that actually occurred, where the two sets were disjoint.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from backend.services.ai_purposes import AI_PURPOSES, UNDECLARED_PURPOSE, purpose_names

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


def _literal(node: ast.expr | None) -> str | None:
    """Return a string literal's value, or ``None`` for anything computed."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _resolve_module_constant(tree: ast.Module, name: str) -> str | None:
    """Resolve a module-level ``NAME: Final[str] = "literal"`` assignment.

    ``ops_forecast_service`` passes ``purpose=_FORECAST_PURPOSE``, and a check
    that only understood inline literals would silently skip exactly the call
    site whose configuration this work moved.
    """
    for node in tree.body:
        targets: list[ast.expr] = []
        if isinstance(node, ast.Assign):
            targets = list(node.targets)
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target]
        else:
            continue
        for target in targets:
            if isinstance(target, ast.Name) and target.id == name:
                return _literal(node.value)
    return None


def _call_name(node: ast.Call) -> str | None:
    return getattr(node.func, "id", None) or getattr(node.func, "attr", None)


def _purpose_arg(node: ast.Call, tree: ast.Module, *, positional_index: int | None) -> str | None:
    """The purpose a call names, whether by keyword or by position."""
    raw: ast.expr | None = None
    for keyword in node.keywords:
        if keyword.arg == "purpose":
            raw = keyword.value
    if raw is None and positional_index is not None and len(node.args) > positional_index:
        raw = node.args[positional_index]

    if raw is None:
        return None
    literal = _literal(raw)
    if literal is not None:
        return literal
    if isinstance(raw, ast.Name):
        return _resolve_module_constant(tree, raw.id)
    return None


def _collect() -> tuple[dict[str, list[str]], dict[str, list[str]], list[str]]:
    """Walk the tree once. Returns (run_ai, create_forge_agent, missing purpose).

    Each mapping is ``{purpose: ["file:line", ...]}``; the list is the call sites
    that build an agent without naming a purpose at all.
    """
    run_ai_sites: dict[str, list[str]] = {}
    agent_sites: dict[str, list[str]] = {}
    unnamed: list[str] = []

    for path in _source_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        rel = path.relative_to(_BACKEND).as_posix()
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = _call_name(node)
            where = f"backend/{rel}:{node.lineno}"
            if name == "run_ai":
                # run_ai(agent, prompt, purpose, ...) — third positional.
                purpose = _purpose_arg(node, tree, positional_index=2)
                if purpose is not None:
                    run_ai_sites.setdefault(purpose, []).append(where)
            elif name == "create_forge_agent":
                purpose = _purpose_arg(node, tree, positional_index=None)
                if purpose is None:
                    unnamed.append(where)
                else:
                    agent_sites.setdefault(purpose, []).append(where)

    return run_ai_sites, agent_sites, unnamed


RUN_AI_SITES, AGENT_SITES, UNNAMED_AGENT_SITES = _collect()


def test_every_run_ai_purpose_is_declared() -> None:
    """A purpose with no declaration has no budget and no timeout."""
    undeclared = {p: sites for p, sites in RUN_AI_SITES.items() if p not in AI_PURPOSES}
    assert not undeclared, (
        "run_ai is called with purposes that ai_purposes.AI_PURPOSES does not declare. "
        "An undeclared purpose falls back to the conservative floor "
        f"(max_tokens={UNDECLARED_PURPOSE.max_tokens}, timeout={UNDECLARED_PURPOSE.timeout}s) "
        "and logs a warning on every call. Declare it instead:\n"
        + "\n".join(f"  {p}: {', '.join(sites)}" for p, sites in sorted(undeclared.items()))
    )


def test_every_declared_purpose_is_used() -> None:
    """A declaration nobody reads is configuration-shaped decoration.

    ``ascii_art`` carried a 1024-token budget and a 60s timeout for a code path
    that is pyfiglet and a Pillow conversion — no model, no call, no cost.
    """
    unused = [name for name in purpose_names() if name not in RUN_AI_SITES]
    assert not unused, (
        "ai_purposes.AI_PURPOSES declares purposes that no run_ai call site uses: "
        f"{', '.join(unused)}. Remove the declaration, or wire the call site."
    )


def test_every_forge_agent_names_its_purpose() -> None:
    """``purpose=`` decides the model; without it the model follows a default."""
    assert not UNNAMED_AGENT_SITES, (
        "create_forge_agent called without purpose=. The purpose chooses the model, "
        "and it must be the same string the matching run_ai call passes:\n"
        + "\n".join(f"  {site}" for site in UNNAMED_AGENT_SITES)
    )


def test_agent_purposes_are_declared() -> None:
    undeclared = {p: sites for p, sites in AGENT_SITES.items() if p not in AI_PURPOSES}
    assert not undeclared, (
        "create_forge_agent is called with undeclared purposes:\n"
        + "\n".join(f"  {p}: {', '.join(sites)}" for p, sites in sorted(undeclared.items()))
    )


def test_model_and_budget_agree_within_each_function() -> None:
    """The agent and the call it serves must name the same purpose.

    This is finding 11 in gate form. Before 2026-08-30 the agent said ``forge``
    and the call said ``chunk`` / ``entity`` / ``lore`` / ``dossier`` — so the
    model was resolved from one name and everything else about the call from
    another, and nothing anywhere compared the two.
    """
    problems: list[str] = []

    for path in _source_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        rel = path.relative_to(_BACKEND).as_posix()
        for func in ast.walk(tree):
            if not isinstance(func, ast.AsyncFunctionDef | ast.FunctionDef):
                continue
            built: set[str] = set()
            ran: set[str] = set()
            for node in ast.walk(func):
                if not isinstance(node, ast.Call):
                    continue
                name = _call_name(node)
                if name == "create_forge_agent":
                    purpose = _purpose_arg(node, tree, positional_index=None)
                    if purpose:
                        built.add(purpose)
                elif name == "run_ai":
                    purpose = _purpose_arg(node, tree, positional_index=2)
                    if purpose:
                        ran.add(purpose)
            if built and ran and built != ran:
                problems.append(
                    f"backend/{rel}:{func.lineno} {func.name}(): "
                    f"agent built for {sorted(built)}, run_ai called with {sorted(ran)}"
                )

    assert not problems, (
        "The purpose an agent is built with must match the purpose its run_ai call uses — "
        "otherwise the model comes from one configuration row and the budget, timeout and "
        "reasoning level from another:\n" + "\n".join(f"  {p}" for p in problems)
    )


@pytest.mark.parametrize("name", purpose_names())
def test_declaration_is_self_consistent(name: str) -> None:
    """Every declared purpose carries usable numbers and its own justification."""
    purpose = AI_PURPOSES[name]
    assert purpose.max_tokens > 0, f"{name}: max_tokens must be positive"
    assert purpose.timeout > 0, f"{name}: timeout must be positive"
    assert purpose.why.strip(), (
        f"{name}: every purpose records why its numbers are what they are, so the next "
        "author changing one can see what they are arguing against."
    )


def test_undeclared_fallback_is_the_floor_not_the_ceiling() -> None:
    """An unknown purpose must get the smallest budget, never an unbounded one.

    ``PYDANTIC_AI_MAX_TOKENS.get(purpose)`` returned ``None`` for anything it did
    not know, and ``None`` is not a small budget — it hands the model its own
    ceiling, which on the current forge model is 384 000 tokens.
    """
    assert UNDECLARED_PURPOSE.max_tokens == min(p.max_tokens for p in AI_PURPOSES.values())
    assert UNDECLARED_PURPOSE.timeout == min(p.timeout for p in AI_PURPOSES.values())
