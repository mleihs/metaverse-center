"""Tests for the shared AI failure guard (backend.utils.ai_guard).

The seven AI-generation endpoints share one ``@asynccontextmanager`` that maps
upstream failures to HTTP responses and records a tagged Sentry context. These
tests pin that contract directly (the endpoints carry no other logic in the
failure path):

1. Clean pass-through when the body succeeds.
2. ``OpenRouterError`` (and its subclasses) -> 503 + capture_exception.
3. Any other exception -> 500 with the endpoint's ``fail_detail`` + capture.
4. An ``HTTPException`` raised inside the block propagates unchanged, with NO
   capture (it is an expected control-flow signal, e.g. a 404 lookup miss).
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from backend.services.external.openrouter import OpenRouterError, RateLimitError
from backend.utils.ai_guard import ai_generation_guard

SIM = UUID("22222222-2222-2222-2222-222222222222")


async def test_guard_success_passes_through() -> None:
    """A succeeding body runs to completion and raises nothing."""
    ran = False
    async with ai_generation_guard("generate_agent", simulation_id=SIM, fail_detail="x"):
        ran = True
    assert ran is True


async def test_guard_openrouter_error_maps_to_503() -> None:
    with patch("backend.utils.ai_guard.sentry_sdk") as mock_sentry:
        with pytest.raises(HTTPException) as exc_info:
            async with ai_generation_guard(
                "generate_agent",
                simulation_id=SIM,
                fail_detail="Agent generation failed. Please try again.",
                context={"agent_name": "Tessa"},
            ):
                raise OpenRouterError("upstream timeout")

    assert exc_info.value.status_code == 503
    assert "temporarily unavailable" in exc_info.value.detail
    mock_sentry.capture_exception.assert_called_once()
    # The Sentry scope is tagged with the endpoint name + generation context.
    scope = mock_sentry.push_scope.return_value.__enter__.return_value
    scope.set_tag.assert_called_once_with("generation_endpoint", "generate_agent")
    scope.set_context.assert_called_once_with("generation", {"simulation_id": str(SIM), "agent_name": "Tessa"})


async def test_guard_openrouter_subclass_also_maps_to_503() -> None:
    """A RateLimitError (subclass) takes the same 503 path, not the 500 path."""
    with patch("backend.utils.ai_guard.sentry_sdk"):
        with pytest.raises(HTTPException) as exc_info:
            async with ai_generation_guard("generate_event", simulation_id=SIM, fail_detail="x"):
                raise RateLimitError("429")
    assert exc_info.value.status_code == 503


async def test_guard_generic_exception_maps_to_500_with_detail() -> None:
    with patch("backend.utils.ai_guard.sentry_sdk") as mock_sentry:
        with pytest.raises(HTTPException) as exc_info:
            async with ai_generation_guard(
                "generate_image",
                simulation_id=SIM,
                fail_detail="Image generation failed. Please try again.",
            ):
                raise ValueError("boom")

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Image generation failed. Please try again."
    mock_sentry.capture_exception.assert_called_once()


async def test_guard_http_exception_propagates_without_capture() -> None:
    """A 404 raised by a pre-flight lookup must reach the client unchanged."""
    with patch("backend.utils.ai_guard.sentry_sdk") as mock_sentry:
        with pytest.raises(HTTPException) as exc_info:
            async with ai_generation_guard("generate_relationships", simulation_id=SIM, fail_detail="x"):
                raise HTTPException(status_code=404, detail="Agent not found")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Agent not found"
    mock_sentry.capture_exception.assert_not_called()


async def test_guard_context_defaults_to_simulation_id_only() -> None:
    """With no ``context`` supplied, the Sentry scope still carries simulation_id."""
    with patch("backend.utils.ai_guard.sentry_sdk") as mock_sentry:
        with pytest.raises(HTTPException):
            async with ai_generation_guard("generate_lore_image", simulation_id=SIM, fail_detail="x"):
                raise ValueError("boom")
    scope = mock_sentry.push_scope.return_value.__enter__.return_value
    scope.set_context.assert_called_once_with("generation", {"simulation_id": str(SIM)})


@pytest.mark.asyncio
async def test_guard_works_without_a_simulation_id():
    """The War Room SITREP spans an epoch, not one simulation (E13).

    The guard used to require a ``simulation_id``, which is why the one endpoint
    that could not supply one had no guard at all and answered a model outage
    with a bare 500.
    """
    with patch("backend.utils.ai_guard.sentry_sdk") as mock_sentry:
        with pytest.raises(HTTPException) as exc:
            async with ai_generation_guard(
                "epoch_sitrep",
                fail_detail="Failed to generate situation report.",
                context={"epoch_id": "abc", "cycle_number": 3},
            ):
                raise OpenRouterError("Connection failed after 3 attempts")

    assert exc.value.status_code == 503
    scope = mock_sentry.push_scope.return_value.__enter__.return_value
    scope.set_context.assert_called_once_with("generation", {"epoch_id": "abc", "cycle_number": 3})
