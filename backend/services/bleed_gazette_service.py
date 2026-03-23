"""Service for the Bleed Gazette — multiverse news wire.

Aggregates cross-simulation activity (echoes, embassies, phase changes) into
a public feed styled as Bureau of Impossible Geography dispatches.
"""

import logging
import time

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# In-process cache: (data, timestamp)
_gazette_cache: tuple[list[dict], float] = ([], 0.0)
_CACHE_TTL = 60  # seconds


class BleedGazetteService:
    """Public multiverse news feed."""

    @classmethod
    async def get_feed(
        cls,
        supabase: Client,
        *,
        limit: int = 20,
    ) -> list[dict]:
        """Get Bleed Gazette entries via Postgres ``get_bleed_gazette_feed`` (migration 065c).

        Uses a 60s in-process cache since multiverse updates are not realtime.
        """
        global _gazette_cache

        now = time.monotonic()
        cached_data, cached_at = _gazette_cache
        if cached_data and (now - cached_at) < _CACHE_TTL:
            return cached_data[:limit]

        response = await supabase.rpc("get_bleed_gazette_feed", {
            "p_limit": limit,
        }).execute()

        entries = response.data or []
        _gazette_cache = (entries, now)
        return entries
