"""Async OpenRouter service for LLM text generation and image generation."""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# Retry config
MAX_RETRIES = 1
TIMEOUT_SECONDS = 60
IMAGE_TIMEOUT_SECONDS = 120  # Image generation takes longer

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterError(Exception):
    """Base error for OpenRouter API issues."""


class RateLimitError(OpenRouterError):
    """Raised when OpenRouter returns 429."""


class ModelUnavailableError(OpenRouterError):
    """Raised when the requested model is unavailable (503)."""


class OpenRouterService:
    """Async client for OpenRouter LLM API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.openrouter_api_key
        self.last_usage: dict | None = None  # Set after each generate() call

    async def generate(
        self,
        model: str,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> str:
        """Generate text using the specified model.

        Raises:
            OpenRouterError: If no API key is configured.

        Args:
            model: OpenRouter model ID (e.g. "deepseek/deepseek-chat-v3-0324")
            messages: Chat messages in OpenAI format [{"role": "...", "content": "..."}]
            temperature: Sampling temperature (0.0-2.0)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text content.

        Raises:
            RateLimitError: On 429 responses
            ModelUnavailableError: On 503 responses
            OpenRouterError: On other API errors
        """
        if not self.api_key:
            raise OpenRouterError(
                "OpenRouter API key is not configured. "
                "Set OPENROUTER_API_KEY in .env or in simulation settings."
            )

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://velgarien.app",
            "X-Title": "Velgarien Platform",
        }
        last_error: Exception | None = None

        purpose = messages[0].get("content", "")[:60] if messages else ""
        logger.info(
            "OpenRouter request",
            extra={"model": model, "purpose": purpose, "max_tokens": max_tokens},
        )
        t0 = time.monotonic()

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                if response.status_code == 429:
                    logger.error(
                        "OpenRouter rate limited",
                        extra={"model": model, "status": 429},
                    )
                    raise RateLimitError(
                        f"Rate limited by OpenRouter (model: {model})"
                    )

                if response.status_code == 503:
                    logger.error(
                        "OpenRouter model unavailable",
                        extra={"model": model, "status": 503},
                    )
                    raise ModelUnavailableError(
                        f"Model '{model}' is currently unavailable"
                    )

                if response.status_code != 200:
                    error_body = response.text
                    if attempt < MAX_RETRIES:
                        logger.warning(
                            "OpenRouter %d error (attempt %d/%d): %s",
                            response.status_code,
                            attempt + 1,
                            MAX_RETRIES + 1,
                            error_body[:200],
                        )
                        last_error = OpenRouterError(
                            f"API error {response.status_code}: {error_body[:200]}"
                        )
                        continue
                    logger.error(
                        "OpenRouter request failed",
                        extra={"model": model, "status": response.status_code, "error": error_body[:200]},
                    )
                    raise OpenRouterError(
                        f"API error {response.status_code}: {error_body[:200]}"
                    )

                data = response.json()
                duration_ms = int((time.monotonic() - t0) * 1000)

                # Extract usage data (prompt_tokens, completion_tokens, total_tokens)
                usage = data.get("usage", {})
                self.last_usage = {
                    "model": model,
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "duration_ms": duration_ms,
                }

                logger.info(
                    "OpenRouter response",
                    extra={
                        "model": model, "status": 200, "duration_ms": duration_ms,
                        "prompt_tokens": self.last_usage["prompt_tokens"],
                        "completion_tokens": self.last_usage["completion_tokens"],
                    },
                )
                return _extract_content(data)

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < MAX_RETRIES:
                    logger.warning(
                        "OpenRouter connection error (attempt %d/%d): %s",
                        attempt + 1,
                        MAX_RETRIES + 1,
                        str(e),
                    )
                    last_error = e
                    continue
                logger.error(
                    "OpenRouter connection failed",
                    extra={"model": model, "error": str(e), "attempts": MAX_RETRIES + 1},
                )
                raise OpenRouterError(f"Connection failed after {MAX_RETRIES + 1} attempts") from e

        raise OpenRouterError("All retry attempts exhausted") from last_error

    async def generate_with_system(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> str:
        """Convenience method: generate with system + user message."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return await self.generate(
            model, messages, temperature=temperature, max_tokens=max_tokens,
        )

    async def generate_image(
        self,
        model: str,
        prompt: str,
        *,
        aspect_ratio: str = "16:9",
        image_size: str = "2K",
    ) -> bytes:
        """Generate an image using an OpenRouter image model.

        Args:
            model: OpenRouter image model ID (e.g. "black-forest-labs/flux.2-pro",
                   "openai/gpt-5-image", "google/gemini-3-pro-image-preview").
            prompt: Text description of the image to generate.
            aspect_ratio: Aspect ratio — "1:1", "2:3", "3:2", "4:3", "9:16", "16:9", "21:9".
            image_size: Resolution tier — "0.5K", "1K", "2K", "4K".

        Returns:
            Raw image bytes (PNG or JPEG depending on model).

        Raises:
            RateLimitError: On 429 responses.
            ModelUnavailableError: On 503 responses.
            OpenRouterError: On other API errors or missing image data.
        """
        if not self.api_key:
            raise OpenRouterError(
                "OpenRouter API key is not configured. "
                "Set OPENROUTER_API_KEY in .env or in simulation settings."
            )

        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image"],
            "image_config": {
                "aspect_ratio": aspect_ratio,
                "image_size": image_size,
            },
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://velgarien.app",
            "X-Title": "Velgarien Platform",
        }

        logger.info(
            "OpenRouter image request",
            extra={"model": model, "prompt": prompt[:80], "aspect": aspect_ratio, "size": image_size},
        )
        t0 = time.monotonic()

        last_error: Exception | None = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=IMAGE_TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                if response.status_code == 429:
                    raise RateLimitError(f"Rate limited by OpenRouter (model: {model})")
                if response.status_code == 503:
                    raise ModelUnavailableError(f"Model '{model}' is currently unavailable")
                if response.status_code != 200:
                    error_body = response.text
                    if attempt < MAX_RETRIES:
                        last_error = OpenRouterError(f"API error {response.status_code}: {error_body[:200]}")
                        continue
                    raise OpenRouterError(f"API error {response.status_code}: {error_body[:200]}")

                data = response.json()
                duration_ms = int((time.monotonic() - t0) * 1000)

                usage = data.get("usage", {})
                self.last_usage = {
                    "model": model,
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "duration_ms": duration_ms,
                }

                logger.info(
                    "OpenRouter image response",
                    extra={"model": model, "status": 200, "duration_ms": duration_ms},
                )
                return _extract_image_bytes(data)

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < MAX_RETRIES:
                    last_error = e
                    continue
                raise OpenRouterError(
                    f"Connection failed after {MAX_RETRIES + 1} attempts"
                ) from e

        raise OpenRouterError("All retry attempts exhausted") from last_error


def _extract_content(data: dict[str, Any]) -> str:
    """Extract the generated text from the OpenRouter response."""
    choices = data.get("choices", [])
    if not choices:
        raise OpenRouterError("No choices in response")

    message = choices[0].get("message", {})
    content = message.get("content", "")
    if not content:
        raise OpenRouterError("Empty content in response")

    return content


def _extract_image_bytes(data: dict[str, Any]) -> bytes:
    """Extract image bytes from an OpenRouter image generation response.

    OpenRouter returns images as base64 data URLs in the message content
    (inline_data format) or in a top-level ``images`` array.
    """
    choices = data.get("choices", [])
    if not choices:
        raise OpenRouterError("No choices in image response")

    message = choices[0].get("message", {})

    # Format 1: message.content contains inline image parts
    content = message.get("content")
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "image_url":
                url = part.get("image_url", {}).get("url", "")
                if url.startswith("data:"):
                    return _decode_data_url(url)
            if isinstance(part, dict) and part.get("type") == "inline_data":
                b64 = part.get("data", "")
                if b64:
                    return base64.b64decode(b64)

    # Format 2: message.images array (FLUX models via OpenRouter)
    # Shape: [{"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}]
    # or:    ["data:image/png;base64,..."]
    images = message.get("images", [])
    if images:
        item = images[0]
        if isinstance(item, str):
            url = item
        elif isinstance(item, dict):
            url = item.get("image_url", {}).get("url", "") or item.get("url", "")
        else:
            url = ""
        if url.startswith("data:"):
            return _decode_data_url(url)
        if url:
            return base64.b64decode(url)

    # Format 3: top-level images array
    top_images = data.get("images", [])
    if top_images:
        url = top_images[0] if isinstance(top_images[0], str) else top_images[0].get("url", "")
        if url.startswith("data:"):
            return _decode_data_url(url)
        return base64.b64decode(url)

    raise OpenRouterError("No image data found in response")


def _decode_data_url(data_url: str) -> bytes:
    """Decode a base64 data URL (e.g. 'data:image/png;base64,...') to bytes."""
    if ";base64," in data_url:
        _, b64 = data_url.split(";base64,", 1)
        return base64.b64decode(b64)
    raise OpenRouterError(f"Unsupported data URL format: {data_url[:60]}...")
