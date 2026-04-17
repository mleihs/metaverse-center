"""SEO registry and builder dispatch for crawler HTML enrichment + sitemap generation.

This package is the single source of truth for publicly-indexable simulation views.
It replaces the previously parallel registrations in routers/seo.py (SIMULATION_VIEWS),
middleware/seo.py (VIEW_LABELS), and middleware/seo_content.py (builders dict).

Private/member-only views (chat, settings, bonds, terminal) and dashboard-only views
(pulse) are intentionally absent — the registry enumerates what Google should index,
nothing more.
"""

from backend.seo.registry import (
    PUBLIC_SIMULATION_VIEWS,
    PublicSimulationView,
    build_entity_detail_content,
    build_view_content,
    get_view,
)

__all__ = [
    "PUBLIC_SIMULATION_VIEWS",
    "PublicSimulationView",
    "build_entity_detail_content",
    "build_view_content",
    "get_view",
]
