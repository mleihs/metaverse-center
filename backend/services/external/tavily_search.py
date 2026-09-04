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
from backend.services.research_source_policy import SourceRow

logger = logging.getLogger(__name__)

# Die vier Domainlisten standen bis 2026-09-04 auch hier, als Kopie der
# Vorgabewerte in ``platform_research_domains``. Zwei Orte fuer dieselbe Liste,
# von denen nur einer gelesen wurde: die Kopien waren seit Migration 124 tot.
# Der eine Ort ist jetzt ``platform_research_domains.HARDCODED_DEFAULTS``.


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
    exclude_domains: list[str] = field(default_factory=list)


#: Tavilys Betriebsart fuer ``include_domains``. ``filter`` schliesst alles
#: andere AUS; ``boost`` gewichtet die Liste nur und durchsucht das uebrige Netz
#: weiter. Gemessen am 2026-09-04, identische Anfrage, identische drei Domains
#: (``en.wikipedia.org``, ``plato.stanford.edu``, ``britannica.com``):
#: ohne diesen Parameter kamen **2 von 5** Treffern aus der Liste — darunter
#: ``facebook.com`` —, mit ihm **5 von 5**. Die Doku nennt ``filter`` als
#: Vorgabewert; das Verhalten der API tut es nicht. Also steht er hier.
_INCLUDE_DOMAINS_MODE = "filter"


def _domains_mode(request: TavilySearchRequest) -> dict[str, str]:
    """Die Betriebsart, aber nur wenn es eine Liste gibt, die sie betrifft.

    Ohne ``include_domains`` waere ``include_domains_mode`` ein Parameter ohne
    Gegenstand. Der Client 0.7.27 fuehrt ihn nicht in seiner Signatur und reicht
    ihn ueber ``**kwargs`` durch — was heute geht und morgen eine Fehlermeldung
    sein kann. Ihn nur dann zu senden, wenn er etwas bewirkt, macht diesen
    Bruch klein und sichtbar statt gross und still.
    """
    return {"include_domains_mode": _INCLUDE_DOMAINS_MODE} if request.include_domains else {}


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
                        exclude_domains=request.exclude_domains or None,
                        **_domains_mode(request),
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
        tasks = [cls.search(req, timeout_s=timeout_s, max_retries=max_retries) for req in requests]
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
    def to_rows(
        cls, results: list[TavilySearchResult], *, per_axis: int = 5, snippet_len: int = 500
    ) -> list[SourceRow]:
        """Die gefundenen Quellen als ``SourceRow`` — die gemeinsame Form.

        Bis 2026-09-04 gab es hier zwei Wege aus demselben Treffer heraus:
        ``collect_sources`` baute die Zeilen fuer die Ankerkarte,
        ``format_results`` baute daneben die Prosa fuer das Modell. Ein Filter,
        der nur den einen Weg saeubert, laesst den Fanwiki-Artikel weiterhin
        die Lore praegen — er verschwindet bloss aus der Anzeige. Darum gibt es
        jetzt nur noch diesen einen Weg: Zeilen raus, Filter drauf, und die
        Prosa entsteht aus dem, was uebrig ist (``ResearchService``).

        Der Textausschnitt landet in ``abstract`` und wird deshalb NICHT
        gespeichert — er ist Lesestoff fuer das Modell, kein Nachweis.
        Nichts hier geht durch ein Modell; das ist der Zweck dieser Zeilen.
        """
        rows: list[SourceRow] = []
        for result in results:
            for src in result.sources[:per_axis]:
                url = str(src.get("url", "")).strip()
                if not url:
                    continue
                title = str(src.get("title", "")).strip()
                rows.append(
                    SourceRow(
                        axis=result.axis,
                        title=title or url,
                        url=url,
                        provider="tavily",
                        abstract=str(src.get("content", "") or "")[:snippet_len],
                    )
                )
        return rows

    @staticmethod
    def answers(results: list[TavilySearchResult]) -> list[tuple[str, str]]:
        """Tavilys eigene Zusammenfassung je Achse, sofern es eine gibt.

        Sie wird aus dem Treffersatz gebildet, den Tavily geliefert hat — und
        der ist seit ``include_domains_mode="filter"`` bereits auf die Freiliste
        beschraenkt. Die Zusammenfassung erbt also die Schranke der Suche, nicht
        die des Hauses: eine Achse ohne ``include_domains`` (es gibt keine mehr)
        haette eine ungefilterte Zusammenfassung.
        """
        return [(r.axis, r.answer) for r in results if r.answer]
