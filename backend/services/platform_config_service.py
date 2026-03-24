"""PlatformConfigService — single source of truth for platform_settings access.

Replaces duplicated config-loading patterns across HeartbeatService,
AttunementService, ResearchDomain, and ForgeDraft services.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class PlatformConfigService:
    """Read platform_settings with type coercion and defaults."""

    @classmethod
    async def get(
        cls,
        supabase: Client,
        key: str,
        default: Any = None,
    ) -> Any:
        """Fetch a single platform setting by key.

        Handles JSON parsing, type coercion to match the default's type.
        Returns default on any failure.
        """
        try:
            row = (
                await supabase.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", key)
                .limit(1)
                .execute()
            ).data
            if not row:
                return default
            return cls._coerce(row[0]["setting_value"], default)
        except (PostgrestAPIError, httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.warning(
                "Failed to load platform setting '%s', using default",
                key,
                extra={"setting_key": key},
            )
            return default

    @classmethod
    async def get_multiple(
        cls,
        supabase: Client,
        defaults: dict[str, Any],
        *,
        prefix: str | None = None,
    ) -> dict[str, Any]:
        """Fetch multiple platform settings at once.

        Args:
            supabase: Supabase client.
            defaults: Dict of {key: default_value}. Keys are the setting_key values
                (or the suffix after prefix if prefix is set).
            prefix: If set, prepends this to each key for the DB lookup and
                strips it from the returned dict keys.

        Returns:
            Dict with same keys as defaults, values from DB or defaults.
        """
        config = dict(defaults)
        try:
            db_keys = [f"{prefix}{k}" if prefix else k for k in defaults]
            rows = (
                await supabase.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", db_keys)
                .execute()
            ).data or []

            for row in rows:
                raw_key = row["setting_key"]
                key = raw_key.removeprefix(prefix) if prefix else raw_key
                if key in defaults:
                    config[key] = cls._coerce(row["setting_value"], defaults[key])
        except (PostgrestAPIError, httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            logger.warning(
                "Failed to load platform settings batch, using defaults",
                extra={"keys": list(defaults.keys())},
            )

        return config

    @staticmethod
    def _coerce(raw: Any, default: Any) -> Any:
        """Coerce a raw setting_value (JSON) to match the default's type."""
        if default is None:
            return raw

        # Handle JSON-encoded strings
        if isinstance(raw, str):
            raw = raw.strip('"')

        target_type = type(default)

        if target_type is bool:
            return str(raw).lower() not in ("false", "0", "no", "")
        if target_type is int:
            try:
                return int(raw)
            except (ValueError, TypeError):
                return default
        if target_type is float:
            try:
                return float(raw)
            except (ValueError, TypeError):
                return default
        if target_type is dict:
            if isinstance(raw, dict):
                return raw
            try:
                parsed = json.loads(raw) if isinstance(raw, str) else raw
                return parsed if isinstance(parsed, dict) else default
            except (ValueError, TypeError):
                return default
        if target_type is list:
            if isinstance(raw, list):
                return raw
            try:
                parsed = json.loads(raw) if isinstance(raw, str) else raw
                return parsed if isinstance(parsed, list) else default
            except (ValueError, TypeError):
                return default
        if target_type is str:
            return str(raw)

        return raw
