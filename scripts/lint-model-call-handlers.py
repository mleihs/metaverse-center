#!/usr/bin/env python3
"""Every `try` around a model call must catch what a model call actually raises.

Run: `python3 scripts/lint-model-call-handlers.py`  (also wrapped by the bash gate
next to it, which is what CI invokes).
Exit code: 0 = pass, 1 = a handler cannot catch a model error.

WHAT THIS GUARDS
----------------
`run_ai` calls pydantic-ai. A pydantic-ai run raises `ModelAPIError` for a
timeout or a connection failure, `ModelHTTPError` (a SUBCLASS of it) for a status
error, and `UnexpectedModelBehavior` when the output-validation retries are
exhausted. None of them is an `httpx.HTTPError`, a `KeyError`, a `TypeError` or a
`ValueError`.

Measured with a real call at `timeout=0.001`: the exception that reaches the
caller is `pydantic_ai.exceptions.ModelAPIError`, MRO `(ModelAPIError,
AgentRunError, RuntimeError, Exception)`. Before this gate existed, the name
`ModelAPIError` appeared ZERO times in the backend, while `PYDANTIC_AI_TIMEOUTS`
configured eleven timeout budgets and the comment above them stated that a firing
timeout is "caught by existing except blocks". Fourteen handlers that were written
to degrade gracefully could not see the failure they were written for. See
finding 33.

Note that `except ModelHTTPError` does NOT cover a timeout: `ModelAPIError` is the
parent, not the child.

WHAT THIS DOES NOT SEE
----------------------
It matches the `try` that lexically encloses a direct `run_ai(...)` call. Two
things are therefore out of reach, deliberately, rather than papered over:

  * An INDIRECT call — a handler around a service method that calls `run_ai`
    somewhere below. `_auto_translate_entity` in `translation_service.py` is one:
    it wraps `TranslationService.translate_fields`, three frames above the model
    call. It carried the same defect and was fixed by hand.
  * A call site with NO `try` at all. That is often correct: six such sites exist
    and every one of them propagates into a caller that does handle the error.
    A gate that demanded a local `try` would force a pointless one.

So this gate proves a handler is not blind; it does not prove a call is handled.
"""

from __future__ import annotations

import ast
import pathlib
import sys

# A handler covers a `run_ai` error if it names one of these. `MODEL_CALL_ERRORS`
# is the tuple in `backend/services/ai_utils.py`; the rest are the superclasses
# that genuinely include `ModelAPIError`.
COVERING = {"MODEL_CALL_ERRORS", "ModelAPIError", "AgentRunError", "RuntimeError", "Exception"}

# The second family of model calls: `OpenRouterService.generate*`. Its error
# hierarchy is its own and does not overlap with pydantic-ai's at all:
#
#   OpenRouterError            <- raised for "API error 500", "Connection failed
#   ├── RateLimitError            after N attempts" and "All retry attempts
#   ├── ModelUnavailableError     exhausted" -- i.e. the COMMON failures
#   └── CreditExhaustedError
#
# Only the BASE class (or `Exception`) covers it. A handler listing
# `RateLimitError, ModelUnavailableError` looks careful and misses every
# connection failure -- the same parent/child confusion this gate was written
# for on the pydantic-ai side.
OPENROUTER_COVERING = {"OpenRouterError", "Exception"}

# Method names on OpenRouterService that reach the network.
OPENROUTER_METHODS = {
    "generate",
    "generate_with_system",
    "generate_stream",
    "generate_image",
    "generate_json",
}

ROOT = pathlib.Path(__file__).resolve().parent.parent


def handler_names(handler: ast.ExceptHandler) -> list[str]:
    """Names a single `except` clause catches, including `*SPREAD` entries."""
    node = handler.type
    if node is None:
        return ["<bare>"]
    entries = node.elts if isinstance(node, ast.Tuple) else [node]
    names: list[str] = []
    for entry in entries:
        target = entry.value if isinstance(entry, ast.Starred) else entry
        if isinstance(target, ast.Name):
            names.append(target.id)
        elif isinstance(target, ast.Attribute):
            names.append(ast.unparse(target))
    return names


def enclosing_try(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> ast.Try | None:
    current = node
    while current in parents:
        current = parents[current]
        if isinstance(current, ast.Try):
            return current
    return None


def main() -> int:
    violations: list[str] = []
    checked = 0

    for path in sorted((ROOT / "backend").rglob("*.py")):
        if "tests" in path.parts:
            continue
        try:
            tree = ast.parse(path.read_text())
        except SyntaxError as exc:
            # Almost always the wrong interpreter rather than broken source:
            # macOS still ships `python3` as 3.9, which cannot parse `match`.
            # Say that, instead of pointing a SyntaxError at somebody else's file.
            print(f"FAIL: cannot parse {path.relative_to(ROOT)} with Python {sys.version.split()[0]}: {exc}")
            print("")
            print("If that reads like a version problem, it is one: the project is 3.13")
            print("everywhere. Run this through the repo venv (.venv/bin/python), which")
            print("is what scripts/lint-model-call-handlers.sh does for you.")
            return 1
        parents: dict[ast.AST, ast.AST] = {}
        for node in ast.walk(tree):
            for child in ast.iter_child_nodes(node):
                parents[child] = node

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            if isinstance(node.func, ast.Name) and node.func.id == "run_ai":
                covering, kind = COVERING, "run_ai"
            elif isinstance(node.func, ast.Attribute) and node.func.attr in OPENROUTER_METHODS:
                covering, kind = OPENROUTER_COVERING, f"OpenRouter.{node.func.attr}"
            else:
                continue

            block = enclosing_try(node, parents)
            if block is None:
                continue  # propagates on purpose — see the module docstring
            checked += 1
            names = [n for handler in block.handlers for n in handler_names(handler)]
            if "<bare>" in names or covering.intersection(names):
                continue
            rel = path.relative_to(ROOT)
            violations.append(f"  {rel}:{node.lineno}  [{kind}] catches only: {', '.join(names)}")

    if violations:
        print("FAIL: a try around a model call cannot catch a model error.")
        print("")
        print("\n".join(violations))
        print("")
        print("A pydantic-ai run raises ModelAPIError (timeout / connection),")
        print("ModelHTTPError (a subclass of it) or UnexpectedModelBehavior. None of")
        print("them is an httpx.HTTPError, KeyError, TypeError or ValueError, and")
        print("`except ModelHTTPError` does not cover a timeout either.")
        print("")
        print("An OpenRouterService.generate* call raises OpenRouterError for an API")
        print("error, a failed connection and exhausted retries. Its three subclasses")
        print("cover none of those, so a handler must name the BASE class.")
        print("")
        print("Fix: add `*MODEL_CALL_ERRORS` from backend/services/ai_utils.py (run_ai)")
        print("or `OpenRouterError` (OpenRouter) to the except tuple, keeping the")
        print("non-model classes it already lists.")
        return 1

    print(f"PASS: all {checked} guarded model call sites catch model errors.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
