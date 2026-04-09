"""Lightweight embedding service using OpenRouter / OpenAI-compatible endpoint."""

from __future__ import annotations

import logging

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.utils.responses import extract_list

logger = logging.getLogger(__name__)

# Defaults (overridden by platform_settings keys embedding_model / embedding_dims)
_DEFAULT_MODEL = "openai/text-embedding-3-small"
_DEFAULT_DIMS = 1536

# Lazy-loaded from platform_settings on first embed() call
_cached_model: str | None = None
_cached_dims: int | None = None


async def _load_embedding_config() -> tuple[str, int]:
    """Load embedding model/dims from platform_settings (once, then cached)."""
    global _cached_model, _cached_dims
    if _cached_model is not None:
        return _cached_model, _cached_dims  # type: ignore[return-value]

    model, dims = _DEFAULT_MODEL, _DEFAULT_DIMS
    try:
        from backend.dependencies import get_admin_supabase

        admin = await get_admin_supabase()
        resp = await (
            admin.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", ["embedding_model", "embedding_dims"])
            .execute()
        )
        for row in extract_list(resp):
            key, val = row["setting_key"], row["setting_value"]
            if key == "embedding_model":
                model = str(val).strip('"')
            elif key == "embedding_dims":
                try:
                    dims = int(val)
                except (ValueError, TypeError):
                    pass
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
        logger.warning("Failed to load embedding config from platform_settings, using defaults")

    _cached_model, _cached_dims = model, dims
    return model, dims


class EmbeddingService:
    """Generate text embeddings via OpenRouter."""

    @classmethod
    async def embed(cls, text: str, api_key: str | None = None) -> list[float]:
        """Return an embedding vector for the given text.

        Returns zero vector in mock mode or on failure.
        """
        model, dims = await _load_embedding_config()
        zero_vector = [0.0] * dims

        if settings.forge_mock_mode:
            return zero_vector

        key = api_key or settings.openrouter_api_key
        if not key:
            logger.warning("No API key for embeddings — returning zero vector")
            return zero_vector

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "input": text[:8000],  # Truncate to avoid token limits
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["data"][0]["embedding"]
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            logger.exception("Embedding request failed — returning zero vector")
            sentry_sdk.capture_exception(exc)
            return zero_vector
