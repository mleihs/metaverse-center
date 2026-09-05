"""What a model call raises, and whether the handlers around it can see it.

Finding 33. `PYDANTIC_AI_TIMEOUTS` configured eleven timeout budgets and the
comment above them stated that a firing timeout is "caught by existing except
blocks". It never was: pydantic-ai raises `ModelAPIError` for a timeout, the name
appeared zero times in the backend, and `except ModelHTTPError` does not cover it
because `ModelAPIError` is the parent, not the child.

These tests pin the class relationships themselves rather than the fix, because
the fix is only correct as long as the relationships hold. A pydantic-ai upgrade
that re-parents these exceptions should turn this file red, not production.
"""

from __future__ import annotations

import httpx
import openai
import pytest
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError, UnexpectedModelBehavior

from backend.services.ai_utils import MODEL_CALL_ERRORS, ai_error_to_http

# The tuple that was written at call site after call site, and was wrong at every
# one of them.
_THE_OLD_TUPLE = (httpx.HTTPError, KeyError, TypeError, ValueError)


class TestWhatAModelCallRaises:
    def test_a_timeout_is_not_an_http_error(self):
        """The measured case: `timeout=0.001` surfaces as ModelAPIError."""
        assert not issubclass(ModelAPIError, _THE_OLD_TUPLE)
        assert not issubclass(ModelAPIError, ModelHTTPError)

    def test_catching_the_child_does_not_catch_the_parent(self):
        """`except ModelHTTPError` misses every timeout and connection failure."""
        assert issubclass(ModelHTTPError, ModelAPIError)
        assert not issubclass(ModelAPIError, ModelHTTPError)

    def test_the_openai_timeout_is_not_an_httpx_error_either(self):
        """The claim the old comment rested on, checked at the source."""
        assert not issubclass(openai.APITimeoutError, _THE_OLD_TUPLE)
        assert issubclass(openai.APITimeoutError, openai.APIConnectionError)

    @pytest.mark.parametrize("exc", [ModelAPIError, ModelHTTPError, UnexpectedModelBehavior])
    def test_the_shared_tuple_covers_every_one(self, exc):
        assert issubclass(exc, MODEL_CALL_ERRORS)


class TestAiErrorToHttp:
    def test_a_timeout_becomes_504_not_an_attribute_error(self):
        """A timeout carries no status code; reading one used to raise inside the handler."""
        exc = ModelAPIError(model_name="deepseek/deepseek-v4-flash-0731", message="Request timed out.")
        assert getattr(exc, "status_code", None) is None
        result = ai_error_to_http(exc)
        assert result.status_code == 504

    @pytest.mark.parametrize(
        ("code", "expected"),
        [(402, 402), (429, 429), (503, 503), (500, 502)],
    )
    def test_status_errors_keep_their_mapping(self, code, expected):
        exc = ModelHTTPError(status_code=code, model_name="m", body=None)
        assert ai_error_to_http(exc).status_code == expected


# ── The OpenRouter family ─────────────────────────────────────────────────


class TestWhatAnOpenRouterCallRaises:
    """The second model client, with a hierarchy of its own (E11).

    ``OpenRouterService`` does not go through pydantic-ai, so none of the classes
    above apply to it. It raises its OWN base class for the three most common
    failures — an API error, a failed connection, exhausted retries — and three
    subclasses for the specific ones. Two handlers in `generation_service.py`
    listed only subclasses: they looked careful and could not see a dropped
    connection, inside the very retry ladder written to survive one.
    """

    def test_the_base_class_is_what_the_common_failures_raise(self):
        from backend.services.external.openrouter import (
            CreditExhaustedError,
            ModelUnavailableError,
            OpenRouterError,
            RateLimitError,
        )

        for child in (RateLimitError, ModelUnavailableError, CreditExhaustedError):
            assert issubclass(child, OpenRouterError)
            # ...and therefore: naming the child does NOT catch the parent.
            assert not issubclass(OpenRouterError, child)

    def test_it_is_not_an_httpx_error(self):
        from backend.services.external.openrouter import OpenRouterError

        assert not issubclass(OpenRouterError, _THE_OLD_TUPLE)

    def test_it_is_not_a_pydantic_ai_error(self):
        """The two families do not overlap; a handler must name both."""
        from backend.services.external.openrouter import OpenRouterError

        assert not issubclass(OpenRouterError, ModelAPIError)
        assert not issubclass(ModelAPIError, OpenRouterError)


class TestTheGateItself:
    """A gate that scans call sites needs a test that fails when the scan finds
    nothing — otherwise a rename turns it green while it points at an empty set.

    The lesson is paid for: the first AST scan written for `run_ai` found ZERO
    call sites, because `entry_type` was a positional argument and the scan
    searched keywords. It passed.
    """

    def _run_gate(self, source: str) -> tuple[int, str]:
        import subprocess
        import sys
        import tempfile
        from pathlib import Path

        root = Path(__file__).resolve().parents[3]
        script = root / "scripts" / "lint-model-call-handlers.py"
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "backend" / "services"
            fake.mkdir(parents=True)
            (fake / "probe.py").write_text(source)
            patched = script.read_text().replace(
                "ROOT = pathlib.Path(__file__).resolve().parent.parent",
                f"ROOT = pathlib.Path({str(tmp)!r})",
            )
            probe_script = Path(tmp) / "gate.py"
            probe_script.write_text(patched)
            result = subprocess.run(  # noqa: S603
                [sys.executable, str(probe_script)], capture_output=True, text=True
            )
        return result.returncode, result.stdout

    def test_it_sees_an_openrouter_handler_that_names_only_a_subclass(self):
        code, out = self._run_gate(
            "async def f(client):\n"
            "    try:\n"
            "        await client.generate_with_system(model='m')\n"
            "    except RateLimitError:\n"
            "        pass\n"
        )
        assert code == 1, out
        assert "OpenRouter.generate_with_system" in out

    def test_the_base_class_satisfies_it(self):
        code, out = self._run_gate(
            "async def f(client):\n"
            "    try:\n"
            "        await client.generate_with_system(model='m')\n"
            "    except OpenRouterError:\n"
            "        pass\n"
        )
        assert code == 0, out

    def test_it_reports_how_many_sites_it_actually_looked_at(self):
        """The number is the guard against a scan that matches nothing."""
        code, out = self._run_gate(
            "async def f(client):\n"
            "    try:\n"
            "        await client.generate(model='m')\n"
            "    except OpenRouterError:\n"
            "        pass\n"
        )
        assert code == 0
        assert "all 1 guarded model call sites" in out
