"""Async Tavily web search service for Forge research grounding.

Provides structured, axis-targeted web searches that feed the
BUREAU_ARCHIVIST_PROMPT's three grounding axes:
  1. Literary genealogy
  2. Philosophical framework
  3. Architectural / visual vocabulary

Follows the external service pattern (see replicate.py): lazy init,
async-native, structured logging, graceful degradation.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Domain target lists ───────────────────────────────────────────────
# Steer Tavily toward high-quality sources that match what the Archivist needs.
ENCYCLOPEDIC_DOMAINS: list[str] = [
    "en.wikipedia.org",
    "plato.stanford.edu",
    "britannica.com",
]
LITERARY_DOMAINS: list[str] = [
    "en.wikipedia.org",
    "britannica.com",
    "theparisreview.org",
]
PHILOSOPHY_DOMAINS: list[str] = [
    "plato.stanford.edu",
    "iep.utm.edu",
    "en.wikipedia.org",
]
ARCHITECTURE_DOMAINS: list[str] = [
    "en.wikipedia.org",
    "dezeen.com",
    "designboom.com",
]


@dataclass
class TavilySearchResult:
    """A single search result with axis label."""

    axis: str
    answer: str
    sources: list[dict]
    elapsed_ms: float


@dataclass
class TavilySearchRequest:
    """Parameters for a single Tavily search call."""

    axis: str
    query: str
    search_depth: str = "advanced"
    max_results: int = 5
    include_domains: list[str] = field(default_factory=list)


class TavilySearchService:
    """Async Tavily wrapper: lazy init, timeout, retry, structured logging."""

    _client = None

    @classmethod
    def _get_client(cls):
        """Lazy-init AsyncTavilyClient on first use."""
        if cls._client is None:
            if not settings.tavily_api_key:
                return None
            from tavily import AsyncTavilyClient

            cls._client = AsyncTavilyClient(api_key=settings.tavily_api_key)
            logger.info("AsyncTavilyClient initialized (lazy)")
        return cls._client

    @classmethod
    def is_available(cls) -> bool:
        """Check whether Tavily is configured and available."""
        return bool(settings.tavily_api_key)

    @classmethod
    async def search(
        cls,
        request: TavilySearchRequest,
        *,
        timeout_s: float = 15.0,
        max_retries: int = 0,
    ) -> TavilySearchResult | None:
        """Execute a single Tavily search with timeout and optional retry.

        Returns None on failure (timeout, API error, missing key).
        """
        client = cls._get_client()
        if client is None:
            return None

        last_error: Exception | None = None
        for attempt in range(max_retries + 1):
            if attempt > 0:
                await asyncio.sleep(2.0)
                logger.info(
                    "Tavily retry",
                    extra={
                        "axis": request.axis,
                        "attempt": attempt + 1,
                        "query_preview": request.query[:60],
                    },
                )

            t0 = time.monotonic()
            try:
                async with asyncio.timeout(timeout_s):
                    result = await client.search(
                        query=request.query,
                        search_depth=request.search_depth,
                        include_answer=True,
                        max_results=request.max_results,
                        include_domains=request.include_domains or None,
                    )
                elapsed_ms = (time.monotonic() - t0) * 1000

                sources = result.get("results") or []
                answer = result.get("answer", "")

                logger.info(
                    "Tavily search completed",
                    extra={
                        "axis": request.axis,
                        "query_preview": request.query[:60],
                        "source_count": len(sources),
                        "elapsed_ms": round(elapsed_ms, 1),
                    },
                )
                return TavilySearchResult(
                    axis=request.axis,
                    answer=answer,
                    sources=sources,
                    elapsed_ms=elapsed_ms,
                )

            except TimeoutError:
                elapsed_ms = (time.monotonic() - t0) * 1000
                last_error = TimeoutError(f"Tavily search timed out after {timeout_s}s")
                logger.warning(
                    "Tavily search timed out",
                    extra={
                        "axis": request.axis,
                        "timeout_s": timeout_s,
                        "elapsed_ms": round(elapsed_ms, 1),
                    },
                )
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                elapsed_ms = (time.monotonic() - t0) * 1000
                last_error = exc
                logger.warning(
                    "Tavily search failed",
                    extra={
                        "axis": request.axis,
                        "error": str(exc)[:200],
                        "elapsed_ms": round(elapsed_ms, 1),
                    },
                )

        logger.error(
            "Tavily search exhausted retries",
            extra={
                "axis": request.axis,
                "attempts": max_retries + 1,
                "last_error": str(last_error)[:200] if last_error else None,
            },
        )
        return None

    @classmethod
    async def parallel_search(
        cls,
        requests: list[TavilySearchRequest],
        *,
        timeout_s: float = 15.0,
        max_retries: int = 0,
    ) -> list[TavilySearchResult]:
        """Execute multiple searches in parallel, returning partial results on partial failure."""
        tasks = [
            cls.search(req, timeout_s=timeout_s, max_retries=max_retries)
            for req in requests
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        results: list[TavilySearchResult] = []
        for i, raw in enumerate(raw_results):
            if isinstance(raw, TavilySearchResult):
                results.append(raw)
            elif isinstance(raw, Exception):
                logger.warning(
                    "Parallel search task raised",
                    extra={
                        "axis": requests[i].axis,
                        "error": str(raw)[:200],
                    },
                )
            # None results (from single search failures) are silently skipped

        return results

    @classmethod
    def format_result(cls, result: TavilySearchResult, *, snippet_len: int = 500) -> str:
        """Format a single search result into labeled text block."""
        parts: list[str] = []
        if result.answer:
            parts.append(result.answer)

        source_lines: list[str] = []
        for src in result.sources[:5]:
            title = src.get("title", "")
            url = src.get("url", "")
            content = src.get("content", "")
            if content:
                source_lines.append(f"- {title} ({url})\n  {content[:snippet_len]}")
        if source_lines:
            parts.append("Sources:\n" + "\n".join(source_lines))

        return "\n\n".join(parts)

    @classmethod
    def format_results(
        cls,
        results: list[TavilySearchResult],
        *,
        snippet_len: int = 500,
    ) -> str:
        """Format multiple search results into axis-labeled sections."""
        sections: list[str] = []
        for result in results:
            body = cls.format_result(result, snippet_len=snippet_len)
            if body:
                sections.append(f"[{result.axis}]\n{body}")

        return "\n\n".join(sections)
