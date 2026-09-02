"""Base adapter interface and ScanResult dataclass for source adapters."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ScanResult:
    """Normalized result from any source adapter."""

    source_id: str
    source_name: str
    title: str
    url: str | None = None
    description: str | None = None
    raw_data: dict[str, Any] = field(default_factory=dict)
    # Pre-classified for structured sources, None for unstructured
    source_category: str | None = None
    magnitude: float | None = None
    classification_reason: str | None = None
    is_structured: bool = False

    #: Nur BELEG, nie eigene Zeile — vom Adapter gestempelt (`is_supporting`).
    #:
    #: Der Bauplan der Schleuse stellt eine Regel auf, die nicht verhandelbar
    #: ist: eine Quelle, die nur Tempo und Reichweite zu einer bestehenden
    #: Geschichte liefert, wird KEINE eigene Zeile. Bei der Buendelung
    #: entscheidet dieses Feld, wer Traeger sein darf.
    is_supporting: bool = False

    #: Die Quellen, die dieselbe Geschichte gemeldet haben (Story-Buendelung).
    #: Leer, bis `bundle_within_batch` sie fuellt; danach enthaelt sie IMMER
    #: auch den Traeger selbst — eine Geschichte ohne Quelle gibt es nicht.
    sources: list[dict[str, Any]] = field(default_factory=list)

    #: Zustimmung im Netz zu dieser Geschichte, aus den beitragenden
    #: Sozialquellen aufsummiert (Likes + Reposts). 0 heisst „keine gemessen",
    #: nicht „niemand hat reagiert".
    social_volume: int = 0


class SourceAdapter(ABC):
    """Base class for all event source adapters."""

    name: str
    display_name: str
    categories: list[str]
    is_structured: bool
    requires_api_key: bool
    api_key_setting: str | None = None
    default_interval: int  # seconds between polls

    #: Ist diese Quelle nur BELEG, nie eigene Zeile?
    #:
    #: Der Bauplan: „Eine Sozialquelle liefert nur Tempo und Reichweite zu einer
    #: BESTEHENDEN Geschichte, nie ein eigenes Signal." Ein Adapter, der das von
    #: sich sagt, wird bei der Buendelung nie Traeger, solange eine andere
    #: Quelle dieselbe Geschichte meldet.
    #:
    #: WARUM AM ADAPTER UND NICHT IN EINER LISTE IM DEDUPLIZIERER: eine Liste
    #: von Adapternamen an einer zweiten Stelle laeuft auseinander, sobald
    #: jemand einen Adapter umbenennt. Der Adapter weiss selbst, was er ist.
    is_supporting: bool = False

    #: Further `platform_settings` keys this adapter needs, beyond its API key.
    #:
    #: WHY THIS EXISTS: `api_key_setting` assumes one secret per source, which
    #: held while every source was a URL plus a token. Bluesky is not — it
    #: authenticates with a HANDLE and an app password, and a handle is not an
    #: API key. Rather than bend one field to carry two meanings, an adapter
    #: names whatever else it needs and the scanner hands it over.
    extra_settings: tuple[str, ...] = ()

    @abstractmethod
    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        """Fetch and normalize events.

        Returns ScanResult with pre-classification for structured sources.
        """

    async def is_available(self) -> bool:
        """Check if adapter is configured and reachable."""
        if self.requires_api_key and not self._api_key:
            return False
        return True

    @property
    def _api_key(self) -> str | None:
        """Resolved API key (set by the scanner before fetch)."""
        return getattr(self, "_resolved_api_key", None)

    @_api_key.setter
    def _api_key(self, value: str | None) -> None:
        self._resolved_api_key = value

    @property
    def _settings(self) -> dict[str, Any]:
        """Resolved `extra_settings` (set by the scanner before fetch).

        Empty when the scanner has not injected anything — an adapter that
        reads from here must therefore treat a missing key as "not configured"
        and say so through `is_available()`, not fail inside `fetch()`.
        """
        return getattr(self, "_resolved_settings", {})

    @_settings.setter
    def _settings(self, value: dict[str, Any]) -> None:
        self._resolved_settings = value
