import logging
from datetime import UTC, datetime
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse

from backend.config import settings
from backend.dependencies import get_anon_supabase
from backend.services.simulation_service import SimulationService
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["seo"])

ROBOTS_TXT = """User-agent: *
Allow: /
Allow: /dashboard
Allow: /multiverse
Allow: /how-to-play
Allow: /epoch
Allow: /archives
Allow: /worlds
Allow: /chronicles
Allow: /simulations/
Disallow: /login
Disallow: /register
Disallow: /profile
Disallow: /new-simulation
Disallow: /epoch/join
Disallow: /admin
Disallow: /forge
Disallow: /api/

Sitemap: https://metaverse.center/sitemap.xml
"""

SIMULATION_VIEWS = ["lore", "agents", "buildings", "events", "locations", "social", "chat", "trends", "health"]


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt() -> PlainTextResponse:
    return PlainTextResponse(content=ROBOTS_TXT.strip() + "\n")


@router.get("/sitemap.xml")
async def sitemap_xml(supabase: Client = Depends(get_anon_supabase)) -> Response:
    simulations = await SimulationService.list_active_slugs(supabase)

    urlset = Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    now = datetime.now(UTC).strftime("%Y-%m-%d")

    # Homepage
    _add_url(urlset, "https://metaverse.center/", now, "1.0", "weekly")

    # Dashboard
    _add_url(urlset, "https://metaverse.center/dashboard", now, "0.9", "daily")

    # Multiverse map
    _add_url(urlset, "https://metaverse.center/multiverse", now, "0.8", "weekly")

    # How to Play guide
    _add_url(urlset, "https://metaverse.center/how-to-play", now, "0.7", "monthly")

    # Epoch lobby
    _add_url(urlset, "https://metaverse.center/epoch", now, "0.6", "daily")

    # Bureau Archives
    _add_url(urlset, "https://metaverse.center/archives", now, "0.5", "monthly")

    # Worlds Gallery (public simulation browser)
    _add_url(urlset, "https://metaverse.center/worlds", now, "0.8", "daily")

    # Chronicle Feed (cross-simulation AI newspaper)
    _add_url(urlset, "https://metaverse.center/chronicles", now, "0.7", "daily")

    # Per-simulation views + individual entities
    for sim in simulations:
        slug = sim["slug"]
        sim_id = sim.get("id", "")
        sim_updated = sim.get("updated_at", now)
        if isinstance(sim_updated, str) and "T" in sim_updated:
            sim_updated = sim_updated[:10]

        for view in SIMULATION_VIEWS:
            _add_url(
                urlset,
                f"https://metaverse.center/simulations/{slug}/{view}",
                sim_updated,
                "0.7",
                "weekly",
            )

        # Individual agents (cool content — AI characters with personalities)
        if sim_id:
            try:
                agents = (
                    supabase.table("agents")
                    .select("id, name, updated_at")
                    .eq("simulation_id", sim_id)
                    .is_("deleted_at", "null")
                    .limit(50)
                    .execute()
                ).data or []
                for agent in agents:
                    agent_updated = agent.get("updated_at", sim_updated)
                    if isinstance(agent_updated, str) and "T" in agent_updated:
                        agent_updated = agent_updated[:10]
                    _add_url(
                        urlset,
                        f"https://metaverse.center/simulations/{slug}/agents/{agent['id']}",
                        agent_updated,
                        "0.6",
                        "weekly",
                    )
            except Exception:
                logger.warning("Failed to fetch agents for sitemap: %s", slug)

            # Individual buildings (world infrastructure)
            try:
                buildings = (
                    supabase.table("buildings")
                    .select("id, name, updated_at")
                    .eq("simulation_id", sim_id)
                    .is_("deleted_at", "null")
                    .limit(50)
                    .execute()
                ).data or []
                for bldg in buildings:
                    bldg_updated = bldg.get("updated_at", sim_updated)
                    if isinstance(bldg_updated, str) and "T" in bldg_updated:
                        bldg_updated = bldg_updated[:10]
                    _add_url(
                        urlset,
                        f"https://metaverse.center/simulations/{slug}/buildings/{bldg['id']}",
                        bldg_updated,
                        "0.6",
                        "weekly",
                    )
            except Exception:
                logger.warning("Failed to fetch buildings for sitemap: %s", slug)

    xml_bytes = tostring(urlset, encoding="unicode", xml_declaration=False)
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml_bytes

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get(f"/{settings.indexnow_key}.txt", response_class=PlainTextResponse)
async def indexnow_key() -> PlainTextResponse:
    return PlainTextResponse(content=settings.indexnow_key)


def _add_url(parent: Element, loc: str, lastmod: str, priority: str, changefreq: str) -> None:
    url = SubElement(parent, "url")
    SubElement(url, "loc").text = loc
    SubElement(url, "lastmod").text = lastmod
    SubElement(url, "priority").text = priority
    SubElement(url, "changefreq").text = changefreq
