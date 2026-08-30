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
