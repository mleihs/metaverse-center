"""Resonance Dungeon archetype SEO metadata.

The eight archetypes are stable, code-defined content (not per-simulation
data). They mirror the frontend dungeon-showcase-data.ts entries so crawlers
without JavaScript get the same title / description / image the SPA renders.

Single source of truth — consumed by:
  - backend/routers/seo.py        — sitemap URLs for /archetypes/:id
  - backend/middleware/seo.py     — _PLATFORM_META crawler enrichment

Frontend parity: ArchetypeDetailView.ts sets the same title / description
/ CreativeWork JSON-LD client-side. Crawler and SPA emit identical meta.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from backend.config import settings


@dataclass(frozen=True)
class ArchetypeSeo:
    """Seed metadata for a Resonance Dungeon archetype."""

    id: str  # URL slug, e.g. "shadow"
    name: str  # English display name, e.g. "The Shadow"
    subtitle: str  # German subtitle, e.g. "Die Tiefe Nacht"
    tagline: str  # One-sentence hook used as meta description + og:description


# Literary content mirrors frontend/src/components/landing/dungeon-showcase-data.ts.
# When editing, update both files together.
ARCHETYPES: tuple[ArchetypeSeo, ...] = (
    ArchetypeSeo(
        id="shadow",
        name="The Shadow",
        subtitle="Die Tiefe Nacht",
        tagline="Darkness is not absence. It is presence.",
    ),
    ArchetypeSeo(
        id="tower",
        name="The Tower",
        subtitle="Der Fallende Turm",
        tagline="The building is alive. You are its nervous system.",
    ),
    ArchetypeSeo(
        id="mother",
        name="The Devouring Mother",
        subtitle="Das Lebendige Labyrinth",
        tagline="That which sustains you consumes you.",
    ),
    ArchetypeSeo(
        id="entropy",
        name="The Entropy",
        subtitle="Der Verfall-Garten",
        tagline="Decay is not destruction \u2013 it is equalization.",
    ),
    ArchetypeSeo(
        id="prometheus",
        name="The Prometheus",
        subtitle="Die Werkstatt der G\u00f6tter",
        tagline="Innovation demands perpetual suffering. The gift cannot be ungiven.",
    ),
    ArchetypeSeo(
        id="deluge",
        name="The Deluge",
        subtitle="Die Steigende Flut",
        tagline="The world reminds its inhabitants: guests, not owners.",
    ),
    ArchetypeSeo(
        id="awakening",
        name="The Awakening",
        subtitle="Das Kollektive Unbewusste",
        tagline="The dungeon is not a container for memories \u2013 it IS memory.",
    ),
    ArchetypeSeo(
        id="overthrow",
        name="The Overthrow",
        subtitle="Der Spiegelpalast",
        tagline="Power changes hands. The old order does not die \u2013 it metamorphoses.",
    ),
)

ARCHETYPES_BY_ID: dict[str, ArchetypeSeo] = {a.id: a for a in ARCHETYPES}


def archetype_image_url(archetype_id: str) -> str:
    """Storage URL for the archetype's preview image (matches the frontend)."""
    return (
        f"{settings.supabase_url}/storage/v1/object/public"
        f"/simulation.assets/showcase/dungeon-{archetype_id}.avif"
    )


def _build_creative_work_jsonld(a: ArchetypeSeo) -> str:
    """Build already-escaped CreativeWork JSON-LD for the archetype detail page."""
    data: dict = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": f"{a.name} \u2013 {a.subtitle}",
        "description": a.tagline,
        "url": f"https://metaverse.center/archetypes/{a.id}",
        "image": archetype_image_url(a.id),
        "genre": "Interactive Fiction",
        "keywords": f"Resonance Dungeon, {a.name}, {a.subtitle}",
        "author": {"@type": "Organization", "name": "metaverse.center"},
        "inLanguage": ["en", "de"],
    }
    raw = json.dumps(data, ensure_ascii=False)
    return raw.replace("<", "\\u003c").replace(">", "\\u003e")


def build_archetype_platform_meta() -> dict[str, dict[str, str]]:
    """Return {url_path: _inject_meta kwargs} for every archetype.

    The result is merged into _PLATFORM_META in seo.py at module load time,
    which folds archetype handling into the existing platform-route crawler
    enrichment path (single check, zero added branches).
    """
    return {
        f"/archetypes/{a.id}": {
            "title": f"{a.name} \u2013 {a.subtitle} | metaverse.center",
            "description": a.tagline,
            "canonical": f"https://metaverse.center/archetypes/{a.id}",
            "og_image": archetype_image_url(a.id),
            "og_image_alt": f"{a.name} \u2013 {a.subtitle}",
            "og_type": "article",
            "extra_jsonld": _build_creative_work_jsonld(a),
        }
        for a in ARCHETYPES
    }
