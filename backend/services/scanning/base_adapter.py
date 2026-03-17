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


class SourceAdapter(ABC):
    """Base class for all event source adapters."""

    name: str
    display_name: str
    categories: list[str]
    is_structured: bool
    requires_api_key: bool
    api_key_setting: str | None = None
    default_interval: int  # seconds between polls

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
        """Resolved API key (set by registry before fetch)."""
        return getattr(self, "_resolved_api_key", None)

    @_api_key.setter
    def _api_key(self, value: str | None) -> None:
        self._resolved_api_key = value
