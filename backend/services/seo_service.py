"""SEO notification service — IndexNow pings for search engine discovery."""

import logging

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

SITE_HOST = "metaverse.center"
SITE_URL = f"https://{SITE_HOST}"

SIMULATION_VIEWS = ["lore", "agents", "buildings", "events", "locations", "social", "chat", "trends", "health"]


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
    except Exception:
        logger.warning("IndexNow ping failed", extra={"slug": slug}, exc_info=True)
