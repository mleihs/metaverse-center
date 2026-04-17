"""Registry of publicly-indexable simulation views — single source of truth.

Consumed by:
  - backend/routers/seo.py        — sitemap generation
  - backend/middleware/seo.py     — crawler HTML enrichment
  - backend/middleware/seo_content.py — (builders themselves live there)

Adding a new public simulation view is a two-line change: add a builder function in
seo_content.py, then register it here with priority/changefreq/label. Both the
sitemap and the crawler middleware pick it up automatically.

Notably absent (intentional):
  - chat, settings, bonds, terminal  — member-only / private
  - pulse                            — live dashboard, thin SEO value
  - trends                           — legacy URL, superseded by /social (commit 4)
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from backend.middleware import seo_content
from backend.seo.models import EntityDetailResult

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

ListBuilder = Callable[..., tuple[str, str]]
"""Signature: (client, sim_id, sim_name, slug) -> (entity_html, jsonld_script)."""

DetailBuilder = Callable[..., EntityDetailResult]
"""Signature: (client, sim_id, sim_name, slug, entity_id) -> EntityDetailResult.

The builder owns both the semantic content (html + jsonld) and the optional
meta overrides (title, description, og_image, og_image_alt, og_type) that the
middleware injects when an entity is resolved."""


@dataclass(frozen=True)
class PublicSimulationView:
    """Registry entry for a publicly-indexable simulation-scoped view.

    Fields:
      key         — URL segment (e.g. "lore", "agents")
      label       — Human label for crawler <title> and breadcrumbs
      priority    — Sitemap <priority> value (string per sitemap.org)
      changefreq  — Sitemap <changefreq> value
      list_builder   — Renders the list page (always present)
      detail_builder — Renders an entity-detail page (only for views with /:entitySlug)
    """

    key: str
    label: str
    priority: str
    changefreq: str
    list_builder: ListBuilder
    detail_builder: DetailBuilder | None = None


PUBLIC_SIMULATION_VIEWS: dict[str, PublicSimulationView] = {
    "lore": PublicSimulationView(
        key="lore",
        label="Lore",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_lore_view,
        detail_builder=seo_content.build_lore_detail,
    ),
    "agents": PublicSimulationView(
        key="agents",
        label="Agents",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_agents_view,
        detail_builder=seo_content.build_agent_detail,
    ),
    "buildings": PublicSimulationView(
        key="buildings",
        label="Buildings",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_buildings_view,
        detail_builder=seo_content.build_building_detail,
    ),
    "events": PublicSimulationView(
        key="events",
        label="Events",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_events_view,
    ),
    "locations": PublicSimulationView(
        key="locations",
        label="Locations",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_locations_view,
    ),
    "chronicle": PublicSimulationView(
        key="chronicle",
        label="Chronicle",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_chronicle_view,
    ),
    "broadsheet": PublicSimulationView(
        key="broadsheet",
        label="Broadsheet",
        priority="0.7",
        changefreq="weekly",
        list_builder=seo_content.build_broadsheet_view,
    ),
    "social": PublicSimulationView(
        key="social",
        label="Social Trends",
        priority="0.6",
        changefreq="weekly",
        list_builder=seo_content.build_social_view,
    ),
    "health": PublicSimulationView(
        key="health",
        label="Health",
        priority="0.5",
        changefreq="weekly",
        list_builder=seo_content.build_health_view,
    ),
}


def get_view(key: str) -> PublicSimulationView | None:
    """Lookup a registered public view by URL segment."""
    return PUBLIC_SIMULATION_VIEWS.get(key)


def build_view_content(
    client: Client, sim_id: str, sim_name: str, slug: str, view: str,
) -> tuple[str, str]:
    """Dispatch to the registered list builder for `view`.

    Returns ("", "") if the view is not publicly indexable or the builder raises —
    crawlers always get a valid response; errors degrade to the base app shell.
    """
    entry = PUBLIC_SIMULATION_VIEWS.get(view)
    if entry is None:
        return "", ""
    try:
        return entry.list_builder(client, sim_id, sim_name, slug)
    except Exception:
        logger.warning(
            "Failed to build view content for %s/%s", slug, view, exc_info=True,
        )
        return "", ""


def build_entity_detail_content(
    client: Client, sim_id: str, sim_name: str, slug: str,
    view: str, entity_id: str,
) -> EntityDetailResult:
    """Dispatch to the registered detail builder for `view` / `entity_id`.

    Returns an empty EntityDetailResult if the view has no detail builder,
    the entity isn't found, or the builder raises — crawlers always get a
    valid response with sim-level meta (entity overrides are opt-in).
    """
    entry = PUBLIC_SIMULATION_VIEWS.get(view)
    if entry is None or entry.detail_builder is None:
        return EntityDetailResult()
    try:
        return entry.detail_builder(client, sim_id, sim_name, slug, entity_id)
    except Exception:
        logger.warning(
            "Failed to build entity detail for %s/%s/%s",
            slug, view, entity_id, exc_info=True,
        )
        return EntityDetailResult()
