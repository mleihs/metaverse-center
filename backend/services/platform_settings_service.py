"""Service for platform-level settings (cache TTLs, dungeon global config, etc.).

Uses admin (service_role) client — platform_settings has RLS enabled with no
anon/authenticated policies, so only service_role can read/write.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import TypedDict, cast, get_args
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.platform_appearance import DEFAULT_PLATFORM_SKIN, PlatformSkin
from backend.models.settings import is_sensitive_key
from backend.services.platform_gate_contracts import (
    GATE_GROUPS,
    PLATFORM_GATES,
    gate_keys,
)
from backend.utils.db import maybe_single_data
from backend.utils.encryption import decrypt, mask
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from backend.utils.settings import parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Default cache TTL values (used as fallback before DB is queried)
DEFAULT_SETTINGS: dict[str, int] = {
    "cache_map_data_ttl": 15,
    "cache_seo_metadata_ttl": 300,
    "cache_http_simulations_max_age": 60,
    "cache_http_map_data_max_age": 15,
    "cache_http_battle_feed_max_age": 10,
    "cache_http_connections_max_age": 60,
    "cache_http_drift_chart_max_age": 300,
}


_ALPHA_FC_ENABLED = "alpha_first_contact_modal_enabled"
_ALPHA_FC_VERSION = "alpha_first_contact_modal_version"

_DEFAULT_SKIN = "platform_default_skin"


class PlatformSettingsService:
    """CRUD for platform_settings table (admin-only)."""

    table_name = "platform_settings"

    @classmethod
    async def list_all(
        cls,
        admin_supabase: Client,
        *,
        mask_sensitive: bool = False,
    ) -> list[dict]:
        """Fetch all platform settings.

        When mask_sensitive=True, sensitive keys show masked values (for admin UI).
        """
        response = await admin_supabase.table(cls.table_name).select("*").order("setting_key").execute()
        rows = extract_list(response)
        if not mask_sensitive:
            return rows

        for row in rows:
            key = row.get("setting_key", "")
            if not is_sensitive_key(key):
                continue
            raw = str(row.get("setting_value", "")).strip('"')
            if not raw:
                row["setting_value"] = ""
                continue
            # Decrypt if encrypted, then mask
            if raw.startswith("gAAAAA"):
                try:
                    decrypted = decrypt(raw)
                    row["setting_value"] = mask(decrypted)
                except (ValueError, Exception):
                    row["setting_value"] = "***"
            else:
                row["setting_value"] = mask(raw)
        return rows

    @classmethod
    async def get(cls, admin_supabase: Client, key: str) -> dict:
        """Fetch a single platform setting by key."""
        response = await admin_supabase.table(cls.table_name).select("*").eq("setting_key", key).limit(1).execute()
        if not response.data:
            raise not_found(detail=f"Platform setting '{key}' not found.")
        return response.data[0]

    @classmethod
    async def update(
        cls,
        admin_supabase: Client,
        key: str,
        value: str | int | float,
        user_id: UUID,
    ) -> dict:
        """Update or create a platform setting value."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin_supabase.table(cls.table_name)
            .upsert(
                {
                    "setting_key": key,
                    "setting_value": str(value),
                    "updated_by_id": str(user_id),
                    "updated_at": now,
                },
                on_conflict="setting_key",
            )
            .execute()
        )
        if not response.data:
            raise server_error(f"Failed to save platform setting '{key}'.")
        return response.data[0]

    @classmethod
    async def list_feature_gates(cls, admin_supabase: Client) -> dict:
        """Jedes erklärte Merkmalstor mit seinem wirksamen Zustand.

        Zwei Quellen, eine Antwort: die Erklärung aus
        ``platform_gate_contracts`` und die Zeilen aus ``platform_settings``.
        Der wirksame Zustand ist NICHT einfach der Tabellenwert — fehlt die
        Zeile, gilt ``default_when_missing``, und der ist nicht überall gleich
        (Herzschlag und Resonanzverarbeitung laufen ohne Zeile weiter, das
        Journal nicht). Genau diese Ungleichheit hat ``journal_enabled``
        monatelang unsichtbar ausgeschaltet gelassen.

        ``undeclared`` trägt jede ``*_enabled``-Zeile der Tabelle, für die es
        keine Erklärung gibt. Ohne diese Liste könnte ein Schlüssel sich
        dadurch verstecken, dass niemand ihn aufgeschrieben hat — und das ist
        der Zustand, aus dem dieser ganze Abschnitt entstanden ist.
        """
        response = await admin_supabase.table(cls.table_name).select("setting_key, setting_value").execute()
        rows = {str(row["setting_key"]): row.get("setting_value") for row in extract_list(response)}

        def _raw(value: object) -> str | None:
            if value is None:
                return None
            return str(value).strip().strip('"')

        gates = []
        for gate in PLATFORM_GATES:
            has_row = gate.key in rows
            raw = rows.get(gate.key)
            gates.append(
                {
                    "key": gate.key,
                    "group": gate.group,
                    "label": gate.label,
                    "turns_on": gate.turns_on,
                    "absence_costs": gate.absence_costs,
                    "reader": gate.reader,
                    "default_when_missing": gate.default_when_missing,
                    "wired": gate.wired,
                    "has_row": has_row,
                    "enabled": parse_setting_bool(raw) if has_row else gate.default_when_missing,
                    "raw_value": _raw(raw),
                },
            )

        declared = gate_keys()
        undeclared = [
            {
                "key": key,
                "enabled": parse_setting_bool(value),
                "raw_value": _raw(value),
            }
            for key, value in sorted(rows.items())
            if key.endswith("_enabled") and key not in declared
        ]

        return {"gates": gates, "undeclared": undeclared, "groups": list(GATE_GROUPS)}

    @classmethod
    async def get_cache_ttls(cls, admin_supabase: Client) -> dict[str, int]:
        """Load all cache TTL values as a dict. Returns defaults on error."""
        try:
            rows = await cls.list_all(admin_supabase)
            result = dict(DEFAULT_SETTINGS)
            for row in rows:
                key = row["setting_key"]
                if key in result:
                    try:
                        result[key] = int(row["setting_value"])
                    except (ValueError, TypeError):
                        pass
            return result
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.warning("Failed to load platform settings, using defaults")
            return dict(DEFAULT_SETTINGS)

    # ── Dungeon Global Config ──────────────────────────────────────────

    # Platform-settings keys for global dungeon configuration.
    _DG_MODE = "dungeon_global_mode"
    _DG_ARCHETYPES = "dungeon_global_archetypes"
    _DG_CLEARANCE_MODE = "dungeon_clearance_mode"
    _DG_CLEARANCE_THRESHOLD = "dungeon_clearance_threshold"

    @classmethod
    def _parse_dungeon_global(cls, by_key: dict[str, str]) -> DungeonGlobalConfig:
        """Parse raw platform_settings key-value pairs into typed config."""
        archetypes_raw = by_key.get(cls._DG_ARCHETYPES, "[]")
        try:
            archetypes = json.loads(archetypes_raw) if isinstance(archetypes_raw, str) else archetypes_raw
        except (json.JSONDecodeError, TypeError):
            archetypes = []

        threshold_raw = by_key.get(cls._DG_CLEARANCE_THRESHOLD, "10")
        try:
            threshold = int(threshold_raw)
        except (ValueError, TypeError):
            threshold = 10

        mode = by_key.get(cls._DG_MODE, "off")
        if mode not in ("off", "supplement", "override"):
            mode = "off"

        clearance = by_key.get(cls._DG_CLEARANCE_MODE, "standard")
        if clearance not in ("off", "standard", "custom"):
            clearance = "standard"

        return DungeonGlobalConfig(
            override_mode=mode,
            override_archetypes=archetypes if isinstance(archetypes, list) else [],
            clearance_mode=clearance,
            clearance_threshold=threshold,
        )

    @classmethod
    async def get_dungeon_global_config(
        cls,
        admin_supabase: Client,
    ) -> DungeonGlobalConfig:
        """Full dungeon global config (admin panel). Reads 4 keys."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_(
                "setting_key",
                [
                    cls._DG_MODE,
                    cls._DG_ARCHETYPES,
                    cls._DG_CLEARANCE_MODE,
                    cls._DG_CLEARANCE_THRESHOLD,
                ],
            )
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        return cls._parse_dungeon_global(by_key)

    @classmethod
    async def get_dungeon_clearance_config(
        cls,
        admin_supabase: Client,
    ) -> DungeonClearanceConfig:
        """Clearance-only subset (public endpoint). Reads 2 keys."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_("setting_key", [cls._DG_CLEARANCE_MODE, cls._DG_CLEARANCE_THRESHOLD])
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        parsed = cls._parse_dungeon_global(by_key)
        return DungeonClearanceConfig(
            clearance_mode=parsed["clearance_mode"],
            clearance_threshold=parsed["clearance_threshold"],
        )

    @classmethod
    async def get_dungeon_override_config(
        cls,
        admin_supabase: Client,
    ) -> tuple[str, set[str]]:
        """Override-only subset (engine service). Returns (mode, archetypes)."""
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_("setting_key", [cls._DG_MODE, cls._DG_ARCHETYPES])
            .execute()
        )
        by_key = {r["setting_key"]: r["setting_value"] for r in (extract_list(response))}
        parsed = cls._parse_dungeon_global(by_key)
        return (parsed["override_mode"], set(parsed["override_archetypes"]))

    # ── Erscheinungsbild ───────────────────────────────────────────────

    @classmethod
    async def get_default_skin(cls, admin_supabase: Client) -> PlatformSkin:
        """Welche Ausgabe ein Besucher ohne eigene Wahl bekommt.

        Fällt auf ``DEFAULT_PLATFORM_SKIN`` zurück, wenn die Zeile fehlt (frische
        Datenbank, Migrationslücke) ODER einen Namen trägt, den es nicht gibt.
        Beides ist derselbe Fall: die Plattform weiß nicht, was gemeint war, und
        rät nicht — sie nimmt die Vorgabe. Ein unbekannter Name wird protokolliert,
        denn er ist ein Tippfehler in der Verwaltung und kein Betriebszustand.

        Der Admin-Client, weil ``platform_settings`` keine anon-Richtlinie hat;
        heraus geht nur der Name der Ausgabe.
        """
        row = await maybe_single_data(
            admin_supabase.table(cls.table_name).select("setting_value").eq("setting_key", _DEFAULT_SKIN).maybe_single()
        )
        if row is None:
            return DEFAULT_PLATFORM_SKIN

        # jsonb kommt als '"dark"' oder als dark, je nach Schreibweg.
        raw = str(row.get("setting_value", "")).strip().strip('"')
        if raw in get_args(PlatformSkin):
            return cast(PlatformSkin, raw)

        logger.warning(
            "platform_default_skin trägt %r, das ist keine Ausgabe – es gilt %s",
            raw,
            DEFAULT_PLATFORM_SKIN,
        )
        return DEFAULT_PLATFORM_SKIN

    # ── Alpha First-Contact Modal ──────────────────────────────────────

    @classmethod
    async def get_alpha_first_contact_config(
        cls,
        admin_supabase: Client,
    ) -> AlphaFirstContactConfig:
        """Read the two alpha-first-contact keys as a typed public config.

        Falls back to ``enabled=False`` + empty version when the rows are
        missing so public clients never crash on a fresh database. Uses
        admin_supabase because platform_settings has no anon RLS policy.
        """
        response = await (
            admin_supabase.table(cls.table_name)
            .select("setting_key, setting_value")
            .in_("setting_key", [_ALPHA_FC_ENABLED, _ALPHA_FC_VERSION])
            .execute()
        )
        by_key = {row["setting_key"]: str(row.get("setting_value", "")).strip('"') for row in (response.data or [])}
        enabled_raw = by_key.get(_ALPHA_FC_ENABLED, "false").lower()
        return AlphaFirstContactConfig(
            enabled=enabled_raw in ("true", "1", "yes"),
            version=by_key.get(_ALPHA_FC_VERSION, ""),
        )

    @classmethod
    async def update_dungeon_global_config(
        cls,
        admin_supabase: Client,
        user_id: UUID,
        *,
        override_mode: str,
        override_archetypes: list[str],
        clearance_mode: str,
        clearance_threshold: int,
    ) -> DungeonGlobalConfig:
        """Batch-upsert all 4 dungeon global config keys atomically."""
        now = datetime.now(UTC).isoformat()
        rows = [
            {
                "setting_key": key,
                "setting_value": value,
                "updated_by_id": str(user_id),
                "updated_at": now,
            }
            for key, value in {
                cls._DG_MODE: override_mode,
                cls._DG_ARCHETYPES: json.dumps(override_archetypes),
                cls._DG_CLEARANCE_MODE: clearance_mode,
                cls._DG_CLEARANCE_THRESHOLD: str(clearance_threshold),
            }.items()
        ]
        response = await admin_supabase.table(cls.table_name).upsert(rows, on_conflict="setting_key").execute()
        if not response.data:
            raise server_error("Failed to save global dungeon configuration.")
        return DungeonGlobalConfig(
            override_mode=override_mode,
            override_archetypes=override_archetypes,
            clearance_mode=clearance_mode,
            clearance_threshold=clearance_threshold,
        )


class DungeonGlobalConfig(TypedDict):
    """Full global dungeon configuration."""

    override_mode: str  # "off" | "supplement" | "override"
    override_archetypes: list[str]
    clearance_mode: str  # "off" | "standard" | "custom"
    clearance_threshold: int


class DungeonClearanceConfig(TypedDict):
    """Clearance-only subset (public API)."""

    clearance_mode: str
    clearance_threshold: int


class AlphaFirstContactConfig(TypedDict):
    """Projection of the alpha-first-contact-modal settings (public API)."""

    enabled: bool
    version: str
