"""Async Replicate service for image generation using the official SDK."""

from __future__ import annotations

import logging
import time
from typing import Any

import replicate

from backend.config import settings

logger = logging.getLogger(__name__)


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
        t0 = time.monotonic()
        try:
            logger.info(
                "Replicate request",
                extra={"model": model, "prompt": prompt[:80], "prompt_key": prompt_key},
            )

            output = await self._client.async_run(
                model,
                input={prompt_key: prompt, **params},
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

        except replicate.exceptions.ModelError as e:
            duration_ms = int((time.monotonic() - t0) * 1000)
            logger.error(
                "Replicate model error",
                extra={"model": model, "error": str(e), "duration_ms": duration_ms},
            )
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
            logger.error(
                "Replicate API error",
                extra={"model": model, "error": str(e), "duration_ms": duration_ms},
            )
            raise ReplicateError(f"Replicate API error: {e}") from e
