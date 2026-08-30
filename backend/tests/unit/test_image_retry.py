"""The image retry, and what it deliberately does not retry.

Finding 8, with an explicit instruction from the project owner: *"there must be
hardening that asks again. This MUST run through."*

Measured on production: one building lost its image to `OpenRouterError: Empty
content in response` — the TEXT model writing the image description returned
nothing — and stayed image-less for good, while the batch task logged success and
the ceremony sat at 15 of 16 forever.

A retry re-runs the whole chain: description (text model) -> Replicate (paid) ->
upload -> DB write. So the split is not "transient vs. permanent" but "can a
second attempt cost a second image", and these tests pin that split rather than
the retry count.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import pytest
from pydantic_ai.exceptions import ModelAPIError

from backend.services.external.openrouter import OpenRouterError
from backend.services.external.replicate import ReplicateBillingError, ReplicateError
from backend.services.forge_orchestrator_service import ForgeOrchestratorService

_SIM = uuid4()


async def _run(generate, failures: list[dict[str, str]]) -> bool:
    return await ForgeOrchestratorService._generate_one_image(  # noqa: SLF001 — the unit under test
        generate,
        entity_type="building",
        entity_name="Gallertkammer der Gerinnenden Lettern",
        entity_id=str(uuid4()),
        simulation_id=_SIM,
        failures=failures,
    )


@pytest.fixture(autouse=True)
def _no_waiting():
    """The backoffs are real seconds in production and noise in a test."""
    with patch("backend.services.forge_orchestrator_service.asyncio.sleep", new=AsyncMock()):
        yield


class TestRetries:
    @pytest.mark.asyncio
    async def test_the_measured_failure_now_recovers(self):
        """The production case: empty completion from the description model."""
        calls = {"n": 0}

        async def generate():
            calls["n"] += 1
            if calls["n"] == 1:
                raise OpenRouterError("Empty content in response")

        failures: list[dict[str, str]] = []
        assert await _run(generate, failures) is True
        assert calls["n"] == 2
        assert failures == []

    @pytest.mark.parametrize(
        "exc",
        [
            OpenRouterError("empty"),
            ModelAPIError(model_name="m", message="timed out"),
            ReplicateError("upstream hiccup"),
            httpx.ConnectError("reset"),
        ],
    )
    @pytest.mark.asyncio
    async def test_three_attempts_before_giving_up(self, exc):
        calls = {"n": 0}

        async def generate():
            calls["n"] += 1
            raise exc

        failures: list[dict[str, str]] = []
        assert await _run(generate, failures) is False
        assert calls["n"] == 3
        assert len(failures) == 1
        assert failures[0]["entity_type"] == "building"
        assert failures[0]["entity_name"] == "Gallertkammer der Gerinnenden Lettern"

    @pytest.mark.asyncio
    async def test_a_late_success_still_counts(self):
        calls = {"n": 0}

        async def generate():
            calls["n"] += 1
            if calls["n"] < 3:
                raise ReplicateError("hiccup")

        failures: list[dict[str, str]] = []
        assert await _run(generate, failures) is True
        assert calls["n"] == 3
        assert failures == []


class TestWhatIsNotRetried:
    @pytest.mark.parametrize("exc", [KeyError("k"), TypeError("t"), ValueError("v"), OSError("encode")])
    @pytest.mark.asyncio
    async def test_a_second_attempt_would_only_cost_a_second_image(self, exc):
        """Programmer errors fail identically; OSError happens after the paid call."""
        calls = {"n": 0}

        async def generate():
            calls["n"] += 1
            raise exc

        failures: list[dict[str, str]] = []
        assert await _run(generate, failures) is False
        assert calls["n"] == 1, "must not retry — a retry buys nothing and costs an image"
        assert len(failures) == 1

    @pytest.mark.asyncio
    async def test_a_billing_error_aborts_everything(self):
        """Retrying with no credit only burns money, so it is re-raised untouched."""
        calls = {"n": 0}

        async def generate():
            calls["n"] += 1
            raise ReplicateBillingError("no credit")

        failures: list[dict[str, str]] = []
        with pytest.raises(ReplicateBillingError):
            await _run(generate, failures)
        assert calls["n"] == 1
        assert failures == []


class TestFailureRecord:
    @pytest.mark.asyncio
    async def test_the_entity_is_named_so_the_surface_can_show_it(self):
        """Until now the only record was a Sentry event nobody in the UI can read."""

        async def generate():
            raise OpenRouterError("Empty content in response")

        failures: list[dict[str, str]] = []
        await _run(generate, failures)
        assert failures[0]["error"].startswith("OpenRouterError")
        assert "Empty content" in failures[0]["error"]
