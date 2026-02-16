"""Async OpenRouter service for LLM text generation."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# Retry config
MAX_RETRIES = 1
TIMEOUT_SECONDS = 60

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

    async def generate(
        self,
        model: str,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> str:
        """Generate text using the specified model.

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

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        f"{OPENROUTER_BASE_URL}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                if response.status_code == 429:
                    raise RateLimitError(
                        f"Rate limited by OpenRouter (model: {model})"
                    )

                if response.status_code == 503:
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
                    raise OpenRouterError(
                        f"API error {response.status_code}: {error_body[:200]}"
                    )

                data = response.json()
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
