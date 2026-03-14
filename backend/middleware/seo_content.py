"""Server-side entity content builders for crawler SEO enrichment.

Generates semantic HTML snippets and JSON-LD structured data for simulation
entity pages (agents, buildings, lore, chronicle, locations, events).
Used by the SEO middleware to inject content into crawler responses.
"""

import html
import json
import logging

from supabase import Client

logger = logging.getLogger(__name__)

BASE_URL = "https://metaverse.center"


def _esc(text: str | None) -> str:
    """Escape text for safe HTML content insertion."""
    return html.escape(text or "", quote=False)


def _truncate(text: str, limit: int = 200) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "..."


def _safe_jsonld(data: dict) -> str:
    """Serialize JSON-LD and escape for embedding inside <script> tags."""
    raw = json.dumps(data, ensure_ascii=False)
    return raw.replace("<", "\\u003c").replace(">", "\\u003e")


def build_view_content(
    client: Client, sim_id: str, sim_name: str, slug: str, view: str,
) -> tuple[str, str]:
    """Build entity HTML and JSON-LD for a simulation view.

    Returns (entity_html, jsonld_script_content).
    Either may be empty string if the view is unsupported or has no data.
    """
    builders = {
        "agents": _build_agents,
        "buildings": _build_buildings,
        "lore": _build_lore,
        "chronicle": _build_chronicle,
        "locations": _build_locations,
        "events": _build_events,
    }

    builder = builders.get(view)
    if not builder:
        return "", ""

    try:
        return builder(client, sim_id, sim_name, slug)
    except Exception:
        logger.warning(
            "Failed to build entity content for %s/%s",
            slug, view, exc_info=True,
        )
        return "", ""


def _build_agents(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("agents")
        .select("name,character,primary_profession")
        .eq("simulation_id", sim_id)
        .is_("deleted_at", "null")
        .limit(50)
        .execute()
    )
    agents = response.data or []

    parts = [f"<h2>{_esc(sim_name)} — Agents</h2>"]
    for a in agents:
        name = _esc(a.get("name"))
        profession = _esc(a.get("primary_profession"))
        char_text = a.get("character") or ""
        desc = _esc(_truncate(char_text))
        parts.append(
            f'<article><h3>{name}</h3>'
            f'<p class="role">{profession}</p>'
            f'<p>{desc}</p></article>'
        )

    entity_html = "\n".join(parts)

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{sim_name} — Agents",
        "url": f"{BASE_URL}/simulations/{slug}/agents",
        "numberOfItems": len(agents),
        "description": f"All agents in the {sim_name} simulation.",
    })

    return entity_html, jsonld


def _build_buildings(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("buildings")
        .select("name,description,building_type")
        .eq("simulation_id", sim_id)
        .is_("deleted_at", "null")
        .limit(50)
        .execute()
    )
    buildings = response.data or []

    parts = [f"<h2>{_esc(sim_name)} — Buildings</h2>"]
    for b in buildings:
        name = _esc(b.get("name"))
        btype = _esc(b.get("building_type"))
        desc = _esc(_truncate(b.get("description") or ""))
        parts.append(
            f'<article><h3>{name}</h3>'
            f'<p class="type">{btype}</p>'
            f'<p>{desc}</p></article>'
        )

    entity_html = "\n".join(parts)

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{sim_name} — Buildings",
        "url": f"{BASE_URL}/simulations/{slug}/buildings",
        "numberOfItems": len(buildings),
        "description": f"All buildings in the {sim_name} simulation.",
    })

    return entity_html, jsonld


def _build_lore(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("simulations")
        .select("description,banner_url")
        .eq("id", sim_id)
        .limit(1)
        .execute()
    )
    sim = (response.data or [{}])[0]
    desc = sim.get("description") or ""
    banner = sim.get("banner_url") or ""

    entity_html = (
        f"<h2>{_esc(sim_name)} — Lore</h2>\n"
        f"<p>{_esc(desc)}</p>"
    )

    data: dict = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": sim_name,
        "description": desc,
        "url": f"{BASE_URL}/simulations/{slug}/lore",
    }
    if banner:
        data["image"] = banner
    jsonld = _safe_jsonld(data)

    return entity_html, jsonld


def _build_chronicle(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("chronicles")
        .select("title,headline,content,edition_number,published_at")
        .eq("simulation_id", sim_id)
        .order("edition_number", desc=True)
        .limit(1)
        .execute()
    )
    editions = response.data or []

    if not editions:
        entity_html = f"<h2>{_esc(sim_name)} — Chronicle</h2>\n<p>No editions published yet.</p>"
        return entity_html, ""

    latest = editions[0]
    title = _esc(latest.get("title") or "")
    headline = _esc(latest.get("headline") or "")
    content = latest.get("content") or ""
    truncated = _esc(_truncate(content, 500))

    entity_html = (
        f"<h2>{_esc(sim_name)} — Chronicle</h2>\n"
        f"<article><h3>{title}</h3>\n"
        f"<p><strong>{headline}</strong></p>\n"
        f"<p>{truncated}</p></article>"
    )

    data: dict = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": latest.get("title") or sim_name,
        "url": f"{BASE_URL}/simulations/{slug}/chronicle",
        "articleBody": _truncate(content, 500),
    }
    if latest.get("published_at"):
        data["datePublished"] = latest["published_at"]

    jsonld = _safe_jsonld(data)

    return entity_html, jsonld


def _build_locations(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    zones_resp = (
        client.table("zones")
        .select("name,description")
        .eq("simulation_id", sim_id)
        .limit(50)
        .execute()
    )
    zones = zones_resp.data or []

    streets_resp = (
        client.table("city_streets")
        .select("name")
        .eq("simulation_id", sim_id)
        .limit(50)
        .execute()
    )
    streets = streets_resp.data or []

    parts = [f"<h2>{_esc(sim_name)} — Locations</h2>"]
    if zones:
        parts.append("<h3>Zones</h3>")
        for z in zones:
            desc = _esc(_truncate(z.get("description") or ""))
            parts.append(f"<article><h4>{_esc(z.get('name', ''))}</h4><p>{desc}</p></article>")
    if streets:
        parts.append("<h3>Streets</h3><ul>")
        for s in streets:
            parts.append(f"<li>{_esc(s.get('name', ''))}</li>")
        parts.append("</ul>")

    entity_html = "\n".join(parts)

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{sim_name} — Locations",
        "url": f"{BASE_URL}/simulations/{slug}/locations",
        "numberOfItems": len(zones) + len(streets),
        "description": f"Zones and streets in the {sim_name} simulation.",
    })

    return entity_html, jsonld


def _build_events(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("events")
        .select("title,description,event_type")
        .eq("simulation_id", sim_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    events = response.data or []

    parts = [f"<h2>{_esc(sim_name)} — Events</h2>"]
    for ev in events:
        title = _esc(ev.get("title") or "")
        desc = _esc(_truncate(ev.get("description") or ""))
        parts.append(f"<article><h3>{title}</h3><p>{desc}</p></article>")

    if not events:
        parts.append(f"<p>Live events and happenings in {_esc(sim_name)}.</p>")

    entity_html = "\n".join(parts)

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{sim_name} — Events",
        "url": f"{BASE_URL}/simulations/{slug}/events",
        "numberOfItems": len(events),
        "description": f"Recent events in the {sim_name} simulation.",
    })

    return entity_html, jsonld
