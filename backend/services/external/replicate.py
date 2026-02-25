"""Async Replicate service for image generation using the official SDK."""

from __future__ import annotations

import logging
from typing import Any

import replicate

from backend.config import settings

logger = logging.getLogger(__name__)


class ReplicateError(Exception):
    """Base error for Replicate API issues."""


class ReplicateService:
    """Async client for Replicate image generation using the official SDK.

    Supports both official models (e.g. "black-forest-labs/flux-dev")
    and version-hash models (e.g. "stability-ai/stable-diffusion:ac732d...").
    The SDK handles polling, retries, and API routing automatically.
    """

    def __init__(self, api_key: str | None = None):
        self._client = replicate.Client(
            api_token=api_key or settings.replicate_api_token,
        )

    async def generate_image(
        self,
        model: str,
        prompt: str,
        **params: Any,
    ) -> bytes:
        """Generate an image and return raw bytes.

        Args:
            model: Model identifier. Accepts two formats:
                - Official: "black-forest-labs/flux-dev" (no version needed)
                - Version-hash: "stability-ai/stable-diffusion:ac732d..." (SDK convention)
            prompt: Text prompt for image generation.
            **params: Model-specific parameters (guidance_scale, width, height, etc.).

        Returns:
            Raw image bytes.

        Raises:
            ReplicateError: On API errors, model errors, or timeout.
        """
        try:
            logger.info("Replicate generation: model=%s, prompt=%s...", model, prompt[:80])

            output = await self._client.async_run(
                model,
                input={"prompt": prompt, **params},
            )

            # Output is either a FileOutput or a list of FileOutput
            if isinstance(output, list):
                if not output:
                    raise ReplicateError("Model returned empty output list")
                image_bytes = await output[0].aread()
            else:
                image_bytes = await output.aread()

            logger.info("Replicate generation complete: %d bytes", len(image_bytes))
            return image_bytes

        except replicate.exceptions.ModelError as e:
            raise ReplicateError(f"Model error: {e}") from e
        except replicate.exceptions.ReplicateError as e:
            raise ReplicateError(f"Replicate API error: {e}") from e
