"""SEO service — sitemap entity queries + IndexNow pings."""

import logging

import httpx

from backend.config import settings
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

SITE_HOST = "metaverse.center"
SITE_URL = f"https://{SITE_HOST}"

SIMULATION_VIEWS = ["lore", "agents", "buildings", "events", "locations", "social", "chat", "trends", "health"]


class SeoService:
    """Database queries for sitemap entity discovery."""

    @classmethod
    async def get_lore_sections(cls, supabase: Client, simulation_id: str) -> list[dict]:
        """Fetch lore section slugs and timestamps for a simulation's sitemap entries."""
        resp = await (
            supabase.table("simulation_lore")
            .select("slug, updated_at")
            .eq("simulation_id", simulation_id)
            .order("sort_order")
            .limit(20)
            .execute()
        )
        return resp.data or []

    @classmethod
    async def get_agents_for_sitemap(cls, supabase: Client, simulation_id: str) -> list[dict]:
        """Fetch agent slugs and timestamps for a simulation's sitemap entries."""
        resp = await (
            supabase.table("agents")
            .select("id, slug, name, updated_at")
            .eq("simulation_id", simulation_id)
            .is_("deleted_at", "null")
            .limit(50)
            .execute()
        )
        return resp.data or []

    @classmethod
    async def get_buildings_for_sitemap(cls, supabase: Client, simulation_id: str) -> list[dict]:
        """Fetch building slugs and timestamps for a simulation's sitemap entries."""
        resp = await (
            supabase.table("buildings")
            .select("id, slug, name, updated_at")
            .eq("simulation_id", simulation_id)
            .is_("deleted_at", "null")
            .limit(50)
            .execute()
        )
        return resp.data or []


async def notify_search_engines(slug: str) -> None:
    """Notify search engines of a newly materialized simulation.

    Best-effort — failures are logged but never raised.
    Submits individual page URLs via IndexNow (Bing, Yandex, Seznam, Naver).
    Google discovery relies on sitemap.xml (ping endpoint deprecated 2023).
    """
    key = settings.indexnow_key
    if not key:
        logger.debug("IndexNow skipped: INDEXNOW_KEY not configured")
        return

    urls = [
        f"{SITE_URL}/simulations/{slug}/{view}"
        for view in SIMULATION_VIEWS
    ]
    urls.append(f"{SITE_URL}/worlds")

    payload = {
        "host": SITE_HOST,
        "key": key,
        "keyLocation": f"{SITE_URL}/{key}.txt",
        "urlList": urls,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post("https://api.indexnow.org/indexnow", json=payload)
        logger.info(
            "IndexNow notified: %d URLs, status %d",
            len(urls), resp.status_code,
            extra={"slug": slug},
        )
    except (httpx.HTTPError, OSError):
        logger.warning("IndexNow ping failed", extra={"slug": slug}, exc_info=True)
