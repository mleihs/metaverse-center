import logging
import re
from pathlib import Path

from backend.config import settings
from supabase import Client, create_client

logger = logging.getLogger(__name__)

_CRAWLER_RE = re.compile(
    r"Googlebot|bingbot|Twitterbot|facebookexternalhit|LinkedInBot|Slackbot"
    r"|Discordbot|WhatsApp|TelegramBot|Applebot"
    r"|GPTBot|ChatGPT-User|ClaudeBot|Bytespider|CCBot|PerplexityBot|Amazonbot",
    re.IGNORECASE,
)

# Regex to extract simulation ID (UUID) and view from URL path
_SIM_UUID_RE = re.compile(r"^/simulations/([a-f0-9-]{36})/(\w+)$")
# Regex to extract simulation slug and view from URL path
_SIM_SLUG_RE = re.compile(r"^/simulations/([a-z0-9][a-z0-9-]*)/(\w+)$")

# Cache the raw index.html contents (read once per process)
_index_html_cache: str | None = None

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
        client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
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
        logger.warning("Failed to resolve slug for crawler redirect: %s", simulation_id)

    return None


async def enrich_html_for_crawler(index_path: Path, url_path: str) -> str | None:
    """Return enriched HTML with dynamic meta tags for crawlers, or None to fall through."""
    global _index_html_cache  # noqa: PLW0603

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

    # Fetch simulation data
    try:
        client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
        query = client.table("simulations").select("slug,name,description,banner_url")
        if is_uuid:
            query = query.eq("id", id_or_slug)
        else:
            query = query.eq("slug", id_or_slug)
        response = query.limit(1).execute()
        if not response.data:
            return None
        sim = response.data[0]
    except Exception:
        logger.warning("Failed to fetch simulation %s for crawler enrichment", id_or_slug)
        return None

    slug = sim.get("slug", id_or_slug)
    sim_name = sim.get("name", "")
    sim_desc = sim.get("description", "")
    banner_url = sim.get("banner_url", "")

    title = f"{view_label} — {sim_name} | metaverse.center" if sim_name else f"{view_label} | metaverse.center"
    description = sim_desc or "Build and explore simulated worlds on metaverse.center."
    canonical = f"https://metaverse.center/simulations/{slug}/{view}"

    html = _index_html_cache

    # Replace title
    html = re.sub(r"<title>[^<]*</title>", f"<title>{_escape(title)}</title>", html)

    # Replace meta description
    html = re.sub(
        r'<meta name="description" content="[^"]*"',
        f'<meta name="description" content="{_escape(description)}"',
        html,
    )

    # Replace OG tags
    html = _replace_meta(html, 'property', 'og:title', _escape(title))
    html = _replace_meta(html, 'property', 'og:description', _escape(description))
    html = _replace_meta(html, 'property', 'og:url', _escape(canonical))
    if banner_url:
        html = _replace_meta(html, 'property', 'og:image', _escape(banner_url))

    # Replace Twitter tags
    html = _replace_meta(html, 'name', 'twitter:title', _escape(title))
    html = _replace_meta(html, 'name', 'twitter:description', _escape(description))
    if banner_url:
        html = _replace_meta(html, 'name', 'twitter:image', _escape(banner_url))

    # Replace canonical
    html = re.sub(r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{_escape(canonical)}"', html)

    return html


def _replace_meta(html: str, attr: str, key: str, value: str) -> str:
    """Replace a meta tag's content attribute value."""
    pattern = f'<meta {attr}="{key}" content="[^"]*"'
    replacement = f'<meta {attr}="{key}" content="{value}"'
    return re.sub(pattern, replacement, html)


def _escape(text: str) -> str:
    """Escape text for safe HTML attribute insertion."""
    return (
        text.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
