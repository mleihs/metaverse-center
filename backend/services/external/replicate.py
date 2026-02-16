"""Async Replicate service for image generation."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

REPLICATE_BASE_URL = "https://api.replicate.com/v1"
POLL_INTERVAL_SECONDS = 2
MAX_POLL_SECONDS = 600


class ReplicateError(Exception):
    """Base error for Replicate API issues."""


class ReplicateService:
    """Async client for Replicate image generation API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.replicate_api_token

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate_image(
        self,
        model: str,
        version: str,
        prompt: str,
        *,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        guidance_scale: float = 7.5,
        num_inference_steps: int = 50,
        scheduler: str = "K_EULER",
    ) -> bytes:
        """Generate an image and return raw bytes.

        Args:
            model: Replicate model owner/name
            version: Model version hash
            prompt: Text prompt for image generation
            negative_prompt: Things to avoid in the image
            width: Image width in pixels
            height: Image height in pixels
            guidance_scale: CFG scale
            num_inference_steps: Number of denoising steps
            scheduler: Diffusion scheduler

        Returns:
            Raw image bytes.

        Raises:
            ReplicateError: On API errors or timeout.
        """
        # 1. Create prediction
        prediction = await self._create_prediction(
            version=version,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            scheduler=scheduler,
        )

        prediction_id = prediction["id"]
        logger.info("Replicate prediction created: %s (model: %s)", prediction_id, model)

        # 2. Poll until complete
        result = await self._poll_prediction(prediction_id)

        # 3. Download image
        output = result.get("output")
        if not output:
            raise ReplicateError(f"No output from prediction {prediction_id}")

        image_url = output[0] if isinstance(output, list) else output
        return await self._download_image(image_url)

    async def _create_prediction(
        self,
        version: str,
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        guidance_scale: float,
        num_inference_steps: int,
        scheduler: str,
    ) -> dict[str, Any]:
        """Create a new Replicate prediction."""
        payload = {
            "version": version,
            "input": {
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": width,
                "height": height,
                "guidance_scale": guidance_scale,
                "num_inference_steps": num_inference_steps,
                "scheduler": scheduler,
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{REPLICATE_BASE_URL}/predictions",
                json=payload,
                headers=self._headers(),
            )

        if response.status_code not in (200, 201):
            raise ReplicateError(
                f"Failed to create prediction: {response.status_code} — {response.text[:200]}"
            )

        return response.json()

    async def _poll_prediction(self, prediction_id: str) -> dict[str, Any]:
        """Poll a prediction until it completes or fails."""
        elapsed = 0.0

        async with httpx.AsyncClient(timeout=30) as client:
            while elapsed < MAX_POLL_SECONDS:
                response = await client.get(
                    f"{REPLICATE_BASE_URL}/predictions/{prediction_id}",
                    headers=self._headers(),
                )

                if response.status_code != 200:
                    raise ReplicateError(
                        f"Failed to poll prediction: {response.status_code}"
                    )

                data = response.json()
                status = data.get("status")

                if status == "succeeded":
                    return data

                if status in ("failed", "canceled"):
                    error = data.get("error", "Unknown error")
                    raise ReplicateError(
                        f"Prediction {prediction_id} {status}: {error}"
                    )

                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                elapsed += POLL_INTERVAL_SECONDS

        raise ReplicateError(
            f"Prediction {prediction_id} timed out after {MAX_POLL_SECONDS}s"
        )

    async def _download_image(self, url: str) -> bytes:
        """Download image from URL."""
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url)

        if response.status_code != 200:
            raise ReplicateError(
                f"Failed to download image: {response.status_code}"
            )

        return response.content
