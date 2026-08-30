"""Every call to a GenerationService façade must fit the method it calls.

Finding 24. Two endpoints in `routers/social_media.py` called façade methods with
keyword names those methods do not have:

    gen.generate_social_media_transform(original_text=…, transformation_type=…)
      signature: (post_content, transform_type, locale)

    gen.generate_social_trends_campaign(trend_name=…, trend_platform=…, trend_sentiment=…)
      signature: (trend_data: dict, locale)

Both raise `TypeError` on the first call, so neither endpoint had ever run. Python
does not report this until the line executes, and nothing in the test suite
executed it. This test does, statically, for every call site at once.

It is deliberately structural rather than a fixture for those two endpoints: the
next mismatch will be in a method that does not exist yet.
"""

from __future__ import annotations

import ast
import inspect
import pathlib

import pytest

from backend.services.generation_service import GenerationService

_ROOT = pathlib.Path(__file__).resolve().parents[3]

# The public façade. `_generate` is private by contract (see CLAUDE.md and
# scripts/lint-no-private-generate.sh) and is not called from outside anyway.
_FACADE = {
    name: inspect.signature(member)
    for name, member in inspect.getmembers(GenerationService, inspect.isfunction)
    if not name.startswith("_")
}


def _call_sites() -> list[tuple[pathlib.Path, int, str, list[str], int]]:
    """Every `<something>.<facade method>(...)` in backend, with its keywords."""
    found = []
    for path in sorted((_ROOT / "backend").rglob("*.py")):
        if "tests" in path.parts:
            continue
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
                continue
            name = node.func.attr
            if name not in _FACADE:
                continue
            # A definition inside GenerationService itself is not a call site.
            keywords = [kw.arg for kw in node.keywords if kw.arg]
            found.append((path.relative_to(_ROOT), node.lineno, name, keywords, len(node.args)))
    return found


def test_the_facade_is_not_empty():
    """A guard on the guard: an empty set would make every test below vacuous."""
    assert len(_FACADE) > 10, f"only found {len(_FACADE)} façade methods — inspection is broken"


def test_at_least_one_call_site_is_seen():
    assert _call_sites(), "no GenerationService call sites found — the AST walk is broken"


@pytest.mark.parametrize("site", _call_sites(), ids=lambda s: f"{s[0].name}:{s[1]}:{s[2]}")
def test_call_site_matches_signature(site):
    path, lineno, name, keywords, positional = site
    signature = _FACADE[name]
    params = [p for p in signature.parameters if p != "self"]

    unknown = [kw for kw in keywords if kw not in params]
    assert not unknown, (
        f"{path}:{lineno} calls {name}({', '.join(f'{k}=…' for k in unknown)}) — "
        f"no such parameter. Signature: ({', '.join(params)})"
    )

    required = [
        p
        for i, (p, spec) in enumerate(signature.parameters.items())
        if p != "self" and spec.default is inspect.Parameter.empty and i > positional
    ]
    missing = [p for p in required if p not in keywords]
    assert not missing, f"{path}:{lineno} calls {name} without required {missing}"
