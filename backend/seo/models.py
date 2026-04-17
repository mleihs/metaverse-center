"""Data models for SEO content builders.

The detail builders (agents, buildings, lore) return an EntityDetailResult
containing both the semantic content (html + jsonld) and optional meta
overrides (EntityMeta). The middleware consumes these to produce an
entity-specific crawler response — so /agents/alice-smith renders with
title "Alice Smith — Station Null | metaverse.center" instead of the
generic "Agents — Station Null".
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntityMeta:
    """Entity-specific meta overrides.

    Populated by detail builders; consumed by the crawler middleware when an
    entity_id is present on the URL. Empty / None fields fall back to the
    surrounding simulation-level meta — the builder only has to declare what
    it wants to override.
    """

    title: str | None = None
    """Full <title> including the "| metaverse.center" brand suffix, e.g.
    "Alice Smith — Station Null | metaverse.center". The builder owns the
    suffix so the middleware can regex-replace in a single step."""

    description: str | None = None
    """Meta description text (≤160 chars recommended). Used for <meta
    name="description">, og:description, twitter:description."""

    og_image: str = ""
    """Absolute URL of the entity's primary image (agent portrait, building
    image). Empty string falls back to the simulation banner."""

    og_image_alt: str = ""
    """Accessible alt text for og_image (e.g. "Alice Smith — portrait").
    Empty falls back to the simulation-level platform alt."""

    og_type: str = ""
    """Open Graph content type — 'website' | 'article' | 'profile'.
    Empty falls back to 'website' (the platform default)."""


@dataclass(frozen=True)
class EntityDetailResult:
    """Output of a detail_builder: content + optional meta overrides."""

    html: str = ""
    """Semantic HTML fragment injected into <body> as <div id="seo-content">."""

    jsonld: str = ""
    """Already-escaped JSON-LD script content (use _safe_jsonld to build)."""

    meta: EntityMeta | None = None
    """Optional entity-specific meta tag overrides. None = no overrides
    (middleware uses sim-level meta)."""
