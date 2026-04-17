import logging
from datetime import UTC, datetime
from typing import Annotated
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse

from backend.config import settings
from backend.dependencies import get_anon_supabase
from backend.seo.registry import PUBLIC_SIMULATION_VIEWS
from backend.services.seo_service import SeoService
from backend.services.simulation_service import SimulationService
from supabase import AsyncClient as Client

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
Allow: /worldbuilding
Allow: /ai-characters
Allow: /strategy-game
Allow: /perspectives/
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

# Public simulation views are enumerated centrally in backend/seo/registry.py.
# Adding a view (with sitemap + crawler SSR) is a single registry entry.


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt() -> PlainTextResponse:
    return PlainTextResponse(content=ROBOTS_TXT.strip() + "\n")


@router.get("/sitemap.xml")
async def sitemap_xml(supabase: Annotated[Client, Depends(get_anon_supabase)]) -> Response:
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

    # Content pages — landing pages (high priority, topical authority)
    _add_url(urlset, "https://metaverse.center/worldbuilding", now, "0.9", "monthly")
    _add_url(urlset, "https://metaverse.center/ai-characters", now, "0.9", "monthly")
    _add_url(urlset, "https://metaverse.center/strategy-game", now, "0.9", "monthly")

    # Content pages — perspective articles
    _add_url(urlset, "https://metaverse.center/perspectives/what-is-the-metaverse", now, "0.8", "monthly")
    _add_url(urlset, "https://metaverse.center/perspectives/ai-powered-worldbuilding", now, "0.8", "monthly")
    _add_url(urlset, "https://metaverse.center/perspectives/digital-sovereignty", now, "0.8", "monthly")
    _add_url(urlset, "https://metaverse.center/perspectives/virtual-civilizations", now, "0.8", "monthly")
    _add_url(urlset, "https://metaverse.center/perspectives/competitive-strategy", now, "0.8", "monthly")

    # Per-simulation views + individual entities
    for sim in simulations:
        slug = sim["slug"]
        sim_id = sim.get("id", "")
        sim_updated = sim.get("updated_at", now)
        if isinstance(sim_updated, str) and "T" in sim_updated:
            sim_updated = sim_updated[:10]

        for view_key, view_entry in PUBLIC_SIMULATION_VIEWS.items():
            _add_url(
                urlset,
                f"https://metaverse.center/simulations/{slug}/{view_key}",
                sim_updated,
                view_entry.priority,
                view_entry.changefreq,
            )

        # Individual lore chapters (long-form narrative content)
        if sim_id:
            try:
                lore_sections = await SeoService.get_lore_sections(supabase, sim_id)
                for section in lore_sections:
                    section_updated = section.get("updated_at", sim_updated)
                    if isinstance(section_updated, str) and "T" in section_updated:
                        section_updated = section_updated[:10]
                    section_slug = section.get("slug", "")
                    if section_slug:
                        _add_url(
                            urlset,
                            f"https://metaverse.center/simulations/{slug}/lore/{section_slug}",
                            section_updated,
                            "0.7",
                            "monthly",
                        )
            except Exception:
                logger.warning("Failed to fetch lore for sitemap: %s", slug)

        # Individual agents (cool content — AI characters with personalities)
        if sim_id:
            try:
                agents = await SeoService.get_agents_for_sitemap(supabase, sim_id)
                for agent in agents:
                    agent_updated = agent.get("updated_at", sim_updated)
                    if isinstance(agent_updated, str) and "T" in agent_updated:
                        agent_updated = agent_updated[:10]
                    agent_slug = agent.get("slug") or agent["id"]
                    _add_url(
                        urlset,
                        f"https://metaverse.center/simulations/{slug}/agents/{agent_slug}",
                        agent_updated,
                        "0.6",
                        "weekly",
                    )
            except Exception:
                logger.warning("Failed to fetch agents for sitemap: %s", slug)

            # Individual buildings (world infrastructure)
            try:
                buildings = await SeoService.get_buildings_for_sitemap(supabase, sim_id)
                for bldg in buildings:
                    bldg_updated = bldg.get("updated_at", sim_updated)
                    if isinstance(bldg_updated, str) and "T" in bldg_updated:
                        bldg_updated = bldg_updated[:10]
                    bldg_slug = bldg.get("slug") or bldg["id"]
                    _add_url(
                        urlset,
                        f"https://metaverse.center/simulations/{slug}/buildings/{bldg_slug}",
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
