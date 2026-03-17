import logging
import re
from pathlib import Path

from cachetools import TTLCache

from backend.config import settings
from backend.middleware import seo_content
from backend.services.cache_config import get_ttl
from supabase import Client, create_client

logger = logging.getLogger(__name__)

_anon_client: Client | None = None


def _get_anon_client() -> Client:
    """Get a cached anonymous Supabase client for SEO middleware."""
    global _anon_client  # noqa: PLW0603
    if _anon_client is None:
        _anon_client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _anon_client


_CRAWLER_RE = re.compile(
    r"Googlebot|bingbot|Twitterbot|facebookexternalhit|LinkedInBot|Slackbot"
    r"|Discordbot|WhatsApp|TelegramBot|Applebot"
    r"|GPTBot|ChatGPT-User|ClaudeBot|Bytespider|CCBot|PerplexityBot|Amazonbot"
    r"|YandexBot|DuckDuckBot|SemrushBot|AhrefsBot|MJ12bot",
    re.IGNORECASE,
)

# Regex to extract simulation ID (UUID) and view from URL path
_SIM_UUID_RE = re.compile(r"^/simulations/([a-f0-9-]{36})/(\w+)$")
# Regex to extract simulation slug and view from URL path
_SIM_SLUG_RE = re.compile(r"^/simulations/([a-z0-9][a-z0-9-]*)/(\w+)$")

# Cache the raw index.html contents (read once per process)
_index_html_cache: str | None = None

# TTL cache for simulation metadata lookups (slug/UUID → sim data)
# TTL is read from platform_settings; cache is rebuilt when admin changes the value.
_sim_meta_cache: TTLCache = TTLCache(maxsize=64, ttl=get_ttl("cache_seo_metadata_ttl"))

# TTL cache for entity content (per view per simulation)
_entity_cache: TTLCache = TTLCache(maxsize=128, ttl=get_ttl("cache_seo_metadata_ttl"))

VIEW_LABELS: dict[str, str] = {
    "lore": "Lore",
    "agents": "Agents",
    "buildings": "Buildings",
    "events": "Events",
    "chat": "Chat",
    "social": "Social",
    "locations": "Locations",
    "settings": "Settings",
}


def is_crawler(user_agent: str) -> bool:
    return bool(_CRAWLER_RE.search(user_agent))


def get_crawler_redirect(url_path: str) -> str | None:
    """If a crawler hits a UUID-based simulation URL, return the slug-based redirect URL.

    Returns the 301 redirect target, or None if no redirect is needed.
    """
    match = _SIM_UUID_RE.match(url_path)
    if not match:
        return None

    simulation_id = match.group(1)
    view = match.group(2)

    try:
        client = _get_anon_client()
        response = (
            client.table("simulations")
            .select("slug")
            .eq("id", simulation_id)
            .limit(1)
            .execute()
        )
        if response.data and response.data[0].get("slug"):
            slug = response.data[0]["slug"]
            return f"/simulations/{slug}/{view}"
    except Exception:
        logger.warning(
            "Failed to resolve slug for crawler redirect",
            extra={"simulation_id": simulation_id},
            exc_info=True,
        )

    return None


# Static meta tags for platform-level routes (no DB query needed)
_PLATFORM_META: dict[str, dict[str, str]] = {
    "/": {
        "title": "metaverse.center — Multiplayer Worldbuilding & Strategy Platform",
        "description": (
            "Build civilizations, deploy operatives, shape the multiverse."
            " A multiplayer worldbuilding and strategy platform with AI-powered agents,"
            " competitive epochs, and real-world resonances."
        ),
        "canonical": "https://metaverse.center/",
    },
    "/dashboard": {
        "title": "Operative Terminal | metaverse.center",
        "description": (
            "Your operative command center — monitor active epochs,"
            " browse simulation worlds, and track substrate anomalies."
        ),
        "canonical": "https://metaverse.center/dashboard",
    },
    "/multiverse": {
        "title": "Multiverse Map | metaverse.center",
        "description": "Interactive force-directed graph of the multiverse — simulation connections and epoch battles.",
        "canonical": "https://metaverse.center/multiverse",
    },
    "/how-to-play": {
        "title": "How to Play | metaverse.center",
        "description": "Complete guide to epoch gameplay — operatives, scoring, alliances, and strategy.",
        "canonical": "https://metaverse.center/how-to-play",
    },
    "/epoch": {
        "title": "Epoch Command Center | metaverse.center",
        "description": (
            "Join competitive PvP epochs — deploy operatives,"
            " form alliances, and compete for multiverse dominance."
        ),
        "canonical": "https://metaverse.center/epoch",
    },
    "/archives": {
        "title": "Bureau Archives | metaverse.center",
        "description": (
            "Declassified archives of the Bureau of Impossible Geography"
            " — the complete mythology of the Fracture, the Bleed,"
            " and the Convergence."
        ),
        "canonical": "https://metaverse.center/archives",
    },
}


async def enrich_html_for_crawler(index_path: Path, url_path: str) -> str | None:
    """Return enriched HTML with dynamic meta tags for crawlers, or None to fall through."""
    global _index_html_cache  # noqa: PLW0603

    # Platform-level routes (static meta, no DB query)
    platform_meta = _PLATFORM_META.get(url_path)
    if platform_meta:
        if _index_html_cache is None:
            try:
                _index_html_cache = index_path.read_text(encoding="utf-8")
            except FileNotFoundError:
                return None
        return _inject_meta(_index_html_cache, **platform_meta)

    # Try UUID path first, then slug path
    uuid_match = _SIM_UUID_RE.match(url_path)
    slug_match = _SIM_SLUG_RE.match(url_path) if not uuid_match else None

    if not uuid_match and not slug_match:
        return None

    id_or_slug = (uuid_match or slug_match).group(1)  # type: ignore[union-attr]
    view = (uuid_match or slug_match).group(2)  # type: ignore[union-attr]
    view_label = VIEW_LABELS.get(view, view.capitalize())
    is_uuid = uuid_match is not None

    # Read and cache index.html
    if _index_html_cache is None:
        try:
            _index_html_cache = index_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None

    # Fetch simulation data (with TTL cache)
    cache_key = f"{'uuid' if is_uuid else 'slug'}:{id_or_slug}"
    sim = _sim_meta_cache.get(cache_key)
    if sim is None:
        try:
            client = _get_anon_client()
            query = client.table("simulations").select("id,slug,name,description,banner_url")
            if is_uuid:
                query = query.eq("id", id_or_slug)
            else:
                query = query.eq("slug", id_or_slug)
            response = query.limit(1).execute()
            if not response.data:
                return None
            sim = response.data[0]
            _sim_meta_cache[cache_key] = sim
        except Exception:
            logger.warning(
                "Failed to fetch simulation for crawler enrichment",
                extra={"simulation_id": id_or_slug},
                exc_info=True,
            )
            return None

    slug = sim.get("slug", id_or_slug)
    sim_name = sim.get("name", "")
    sim_desc = sim.get("description", "")
    banner_url = sim.get("banner_url", "")

    title = f"{view_label} — {sim_name} | metaverse.center" if sim_name else f"{view_label} | metaverse.center"
    theme = sim.get("theme", "")
    if sim_desc:
        description = sim_desc
    elif sim_name:
        description = f"Explore {sim_name}{f', a {theme}' if theme else ''} simulation world on metaverse.center."
    else:
        description = "Build and explore simulated worlds on metaverse.center."
    canonical = f"https://metaverse.center/simulations/{slug}/{view}"

    # Build breadcrumb JSON-LD for simulation pages
    breadcrumb_json = _build_breadcrumb_json(sim_name, slug, view, view_label)

    enriched = _inject_meta(
        _index_html_cache, title=title, description=description, canonical=canonical,
        og_image=banner_url, extra_jsonld=breadcrumb_json,
    )

    # Inject entity content for supported views
    enriched = _inject_entity_content(enriched, view, sim.get("id", id_or_slug), sim_name, slug)

    return enriched


def _build_breadcrumb_json(sim_name: str, slug: str, view: str, view_label: str) -> str:
    """Build BreadcrumbList JSON-LD for a simulation page."""
    import json
    items = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://metaverse.center/"},
        {"@type": "ListItem", "position": 2, "name": "Dashboard", "item": "https://metaverse.center/dashboard"},
    ]
    if sim_name:
        items.append({
            "@type": "ListItem", "position": 3, "name": sim_name,
            "item": f"https://metaverse.center/simulations/{slug}/lore",
        })
        items.append({
            "@type": "ListItem", "position": 4, "name": view_label,
            "item": f"https://metaverse.center/simulations/{slug}/{view}",
        })
    else:
        items.append({
            "@type": "ListItem", "position": 3, "name": view_label,
            "item": f"https://metaverse.center/simulations/{slug}/{view}",
        })
    breadcrumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}
    raw = json.dumps(breadcrumb)
    # Escape < and > for safe embedding inside HTML <script> tags
    return raw.replace("<", "\\u003c").replace(">", "\\u003e")


def _inject_entity_content(
    html_str: str, view: str, sim_id: str, sim_name: str, slug: str,
) -> str:
    """Inject entity content HTML and JSON-LD into crawler response."""
    cache_key = f"{slug}:{view}"
    cached = _entity_cache.get(cache_key)
    if cached is not None:
        entity_html, entity_jsonld = cached
    else:
        client = _get_anon_client()
        entity_html, entity_jsonld = seo_content.build_view_content(
            client, sim_id, sim_name, slug, view,
        )
        _entity_cache[cache_key] = (entity_html, entity_jsonld)

    if entity_html:
        seo_div = f'<div id="seo-content" style="display:none">{entity_html}</div>'
        html_str = html_str.replace("</body>", f"    {seo_div}\n  </body>")

    if entity_jsonld:
        jsonld_tag = f'<script type="application/ld+json">{entity_jsonld}</script>'
        html_str = html_str.replace("</head>", f"    {jsonld_tag}\n  </head>")

    return html_str


def _inject_meta(
    base_html: str,
    *,
    title: str,
    description: str,
    canonical: str,
    og_image: str = "",
    extra_jsonld: str = "",
) -> str:
    """Inject meta tags into cached index.html."""
    html = base_html
    html = re.sub(r"<title>[^<]*</title>", f"<title>{_escape(title)}</title>", html)
    html = re.sub(
        r'<meta name="description" content="[^"]*"',
        f'<meta name="description" content="{_escape(description)}"',
        html,
    )
    html = _replace_meta(html, 'property', 'og:title', _escape(title))
    html = _replace_meta(html, 'property', 'og:description', _escape(description))
    html = _replace_meta(html, 'property', 'og:url', _escape(canonical))
    if og_image:
        html = _replace_meta(html, 'property', 'og:image', _escape(og_image))
    html = _replace_meta(html, 'name', 'twitter:title', _escape(title))
    html = _replace_meta(html, 'name', 'twitter:description', _escape(description))
    if og_image:
        html = _replace_meta(html, 'name', 'twitter:image', _escape(og_image))
    html = re.sub(r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{_escape(canonical)}"', html)
    # Inject extra JSON-LD (breadcrumbs) before </head>
    if extra_jsonld:
        jsonld_tag = f'<script type="application/ld+json">{extra_jsonld}</script>'
        html = html.replace("</head>", f"    {jsonld_tag}\n  </head>")
    return html


def _replace_meta(html: str, attr: str, key: str, value: str) -> str:
    """Replace a meta tag's content attribute value."""
    pattern = f'<meta {attr}="{key}" content="[^"]*"'
    replacement = f'<meta {attr}="{key}" content="{value}"'
    return re.sub(pattern, replacement, html)


def get_prerendered_html(static_dir: Path, url_path: str) -> Path | None:
    """Check if a prerendered HTML file exists for this URL path."""
    prerendered_dir = static_dir / "prerendered"
    clean = url_path.strip("/")
    if not clean:
        clean = "index"
    if ".." in clean:
        return None
    candidate = prerendered_dir / f"{clean}.html"
    if candidate.is_file():
        return candidate
    return None


def _escape(text: str) -> str:
    """Escape text for safe HTML attribute insertion."""
    return (
        text.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
