"""Lightweight embedding service using OpenRouter / OpenAI-compatible endpoint."""

from __future__ import annotations

import logging

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIMS = 1536
ZERO_VECTOR = [0.0] * EMBEDDING_DIMS


class EmbeddingService:
    """Generate text embeddings via OpenRouter."""

    @classmethod
    async def embed(cls, text: str, api_key: str | None = None) -> list[float]:
        """Return a 1536-dim embedding vector for the given text.

        Returns zero vector in mock mode or on failure.
        """
        if settings.forge_mock_mode:
            return ZERO_VECTOR

        key = api_key or settings.openrouter_api_key
        if not key:
            logger.warning("No API key for embeddings — returning zero vector")
            return ZERO_VECTOR

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": EMBEDDING_MODEL,
                        "input": text[:8000],  # Truncate to avoid token limits
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception:
            logger.exception("Embedding request failed — returning zero vector")
            return ZERO_VECTOR
