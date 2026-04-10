"""Async Replicate service for image generation using the official SDK."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

import replicate
import sentry_sdk

from backend.config import settings

# Max time for a single image generation (model run + output download).
# Flux-dev typically completes in 20-60s; 5 min covers cold starts + queue.
_GENERATION_TIMEOUT_S = 300

# E005: Replicate's content safety filter. Triggers on benign historical
# figure descriptions (nuns' habits, skin colour, period clothing).
# Strategy: strip physical descriptors and reframe as art historical reference.
_E005_MAX_RETRIES = 2

logger = logging.getLogger(__name__)


def _soften_prompt_for_safety(prompt: str, attempt: int) -> str:
    """Progressively strip trigger-prone descriptors from an image prompt.

    Attempt 1: remove explicit physical descriptors (skin, age, body).
    Attempt 2: additionally prepend museum-framing and strip clothing details.
    """
    text = prompt
    # Strip age references ("mid-fifties", "60 years old", "late thirties")
    text = re.sub(r",?\s*\b(?:mid-|late |early )?\w+-?\w*(?:ies|ties|ies old|years? old)\b", "", text)
    text = re.sub(r",?\s*\b\d{1,2}\s*years?\s*old\b", "", text)
    # Strip skin colour / complexion descriptors
    skin_re = r",?\s*\b(?:dark brown|light|pale|olive|brown|black|white|fair|weathered)\s+skin\b"
    text = re.sub(skin_re, "", text, flags=re.IGNORECASE)
    # Strip body build descriptors
    build_re = r",?\s*\b(?:tall|short|slender|strong|thin|heavyset)\s+(?:and\s+)?\w+\b"
    text = re.sub(build_re, "", text, flags=re.IGNORECASE)

    if attempt >= 2:
        # Prepend art-historical framing
        text = f"Museum oil painting, historical portrait. {text}"
        # Strip clothing details that may trigger filters
        text = re.sub(r",?\s*\b(?:nun'?s?\s+habit|wimple|bonnet|modest dress|shawl)\b", "", text, flags=re.IGNORECASE)

    # Collapse double spaces/commas
    text = re.sub(r",\s*,", ",", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


class ReplicateError(Exception):
    """Base error for Replicate API issues."""


class ReplicateBillingError(ReplicateError):
    """Raised when Replicate rejects a request due to billing/credit issues.

    Callers should abort the entire batch — retrying individual images
    will fail with the same error.
    """


class ReplicateService:
    """Async client for Replicate image generation using the official SDK.

    Supports both official models (e.g. "black-forest-labs/flux-dev")
    and version-hash models (e.g. "stability-ai/stable-diffusion:ac732d...").
    The SDK handles polling, retries, and API routing automatically.
    """

    def __init__(self, api_key: str | None = None):
        token = api_key or settings.replicate_api_token
        if not token:
            raise ReplicateError(
                "No Replicate API token configured. "
                "Set REPLICATE_API_TOKEN env var or provide a BYOK key via Forge Wallet."
            )
        self._client = replicate.Client(api_token=token)

    async def generate_image(
        self,
        model: str,
        prompt: str,
        prompt_key: str = "prompt",
        **params: Any,
    ) -> bytes:
        """Generate an image and return raw bytes.

        Args:
            model: Model identifier. Accepts two formats:
                - Official: "black-forest-labs/flux-dev" (no version needed)
                - Version-hash: "stability-ai/stable-diffusion:ac732d..." (SDK convention)
            prompt: Text prompt for image generation.
            prompt_key: Input parameter name for the prompt (default "prompt").
                Some models use "positive_prompt" instead.
            **params: Model-specific parameters (guidance_scale, width, height, etc.).

        Returns:
            Raw image bytes.

        Raises:
            ReplicateError: On API errors, model errors, or timeout.
        """
        current_prompt = prompt
        for attempt in range(_E005_MAX_RETRIES + 1):
            t0 = time.monotonic()
            try:
                logger.info(
                    "Replicate request",
                    extra={
                        "model": model,
                        "prompt": current_prompt[:80],
                        "prompt_key": prompt_key,
                        "attempt": attempt,
                    },
                )

                output = await asyncio.wait_for(
                    self._client.async_run(
                        model,
                        input={prompt_key: current_prompt, **params},
                    ),
                    timeout=_GENERATION_TIMEOUT_S,
                )

                # Output is either a FileOutput or a list of FileOutput
                if isinstance(output, list):
                    if not output:
                        raise ReplicateError("Model returned empty output list")
                    image_bytes = await output[0].aread()
                else:
                    image_bytes = await output.aread()

                duration_ms = int((time.monotonic() - t0) * 1000)
                logger.info(
                    "Replicate response",
                    extra={"model": model, "bytes": len(image_bytes), "duration_ms": duration_ms},
                )
                return image_bytes

            except TimeoutError:
                duration_ms = int((time.monotonic() - t0) * 1000)
                logger.error(
                    "Replicate timeout",
                    extra={"model": model, "timeout_s": _GENERATION_TIMEOUT_S, "duration_ms": duration_ms},
                )
                raise ReplicateError(f"Replicate generation timed out after {_GENERATION_TIMEOUT_S}s") from None
            except replicate.exceptions.ModelError as e:
                duration_ms = int((time.monotonic() - t0) * 1000)
                err_str = str(e).lower()
                # E005 safety filter — retry with softened prompt
                if "e005" in err_str or "flagged as sensitive" in err_str:
                    next_attempt = attempt + 1
                    if next_attempt <= _E005_MAX_RETRIES:
                        current_prompt = _soften_prompt_for_safety(prompt, next_attempt)
                        logger.warning(
                            "E005 safety filter — retrying with softened prompt",
                            extra={"model": model, "attempt": next_attempt, "prompt": current_prompt[:80]},
                        )
                        continue
                logger.error(
                    "Replicate model error",
                    extra={"model": model, "error": str(e), "duration_ms": duration_ms},
                )
                sentry_sdk.capture_exception(e)
                raise ReplicateError(f"Model error: {e}") from e
            except replicate.exceptions.ReplicateError as e:
                duration_ms = int((time.monotonic() - t0) * 1000)
                err_str = str(e).lower()
                if any(kw in err_str for kw in ("billing", "payment", "spending limit", "out of credit", "402")):
                    logger.error(
                        "Replicate billing error",
                        extra={"model": model, "error": str(e), "duration_ms": duration_ms},
                    )
                    raise ReplicateBillingError(
                        f"Replicate billing error — check credits at replicate.com/account/billing: {e}"
                    ) from e
                # E005 safety filter — retry with softened prompt
                if "e005" in err_str or "flagged as sensitive" in err_str:
                    next_attempt = attempt + 1
                    if next_attempt <= _E005_MAX_RETRIES:
                        current_prompt = _soften_prompt_for_safety(prompt, next_attempt)
                        logger.warning(
                            "E005 safety filter — retrying with softened prompt",
                            extra={"model": model, "attempt": next_attempt, "prompt": current_prompt[:80]},
                        )
                        continue
                logger.error(
                    "Replicate API error",
                    extra={"model": model, "error": str(e), "duration_ms": duration_ms},
                )
                sentry_sdk.capture_exception(e)
                raise ReplicateError(f"Replicate API error: {e}") from e

        # Should not reach here, but satisfy the type checker
        raise ReplicateError("E005 safety filter: all retry attempts exhausted")
