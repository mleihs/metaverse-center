"""Adapter registry — self-registering via decorator."""

from __future__ import annotations

import logging
from typing import Any

from backend.services.scanning.base_adapter import SourceAdapter

logger = logging.getLogger(__name__)

_ADAPTERS: dict[str, type[SourceAdapter]] = {}


def register_adapter(cls: type[SourceAdapter]) -> type[SourceAdapter]:
    """Decorator: register a SourceAdapter subclass by its `name` attribute."""
    _ADAPTERS[cls.name] = cls
    return cls


def get_adapter(name: str) -> SourceAdapter:
    """Instantiate a registered adapter by name."""
    cls = _ADAPTERS.get(name)
    if not cls:
        raise KeyError(f"Unknown adapter: {name}")
    return cls()


def get_all_adapters() -> dict[str, SourceAdapter]:
    """Instantiate all registered adapters."""
    return {name: cls() for name, cls in _ADAPTERS.items()}


def get_adapter_names() -> list[str]:
    """Return all registered adapter names."""
    return list(_ADAPTERS.keys())


def get_adapter_info() -> list[dict[str, Any]]:
    """Return metadata for all registered adapters."""
    result = []
    for name, cls in _ADAPTERS.items():
        result.append(
            {
                "name": name,
                "display_name": cls.display_name,
                "categories": cls.categories,
                "is_structured": cls.is_structured,
                "requires_api_key": cls.requires_api_key,
                "api_key_setting": cls.api_key_setting,
                "default_interval": cls.default_interval,
            }
        )
    return result
