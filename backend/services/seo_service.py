"""SEO notification service — search engine discovery on content changes."""

import logging

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

SITE_HOST = "metaverse.center"
SITE_URL = f"https://{SITE_HOST}"
SITEMAP_URL = f"{SITE_URL}/sitemap.xml"

SIMULATION_VIEWS = ["lore", "agents", "buildings", "events", "locations", "social", "chat", "trends", "health"]


async def notify_search_engines(slug: str) -> None:
    """Notify search engines of a newly materialized simulation.

    Best-effort — failures are logged but never raised.

    1. IndexNow (Bing, Yandex, Seznam, Naver) — submits individual page URLs.
    2. Google Sitemap Ping — tells Google to re-crawl the sitemap.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        await _ping_indexnow(client, slug)
        await _ping_google_sitemap(client)


async def _ping_indexnow(client: httpx.AsyncClient, slug: str) -> None:
    """Submit new simulation URLs to IndexNow."""
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
        resp = await client.post("https://api.indexnow.org/indexnow", json=payload)
        logger.info(
            "IndexNow notified: %d URLs, status %d",
            len(urls), resp.status_code,
            extra={"slug": slug},
        )
    except Exception:
        logger.warning("IndexNow ping failed", extra={"slug": slug}, exc_info=True)


async def _ping_google_sitemap(client: httpx.AsyncClient) -> None:
    """Ping Google to re-crawl the sitemap."""
    try:
        resp = await client.get("https://www.google.com/ping", params={"sitemap": SITEMAP_URL})
        logger.info("Google sitemap ping: status %d", resp.status_code)
    except Exception:
        logger.warning("Google sitemap ping failed", exc_info=True)
