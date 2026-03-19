"""Server-side entity content builders for crawler SEO enrichment.

Generates semantic HTML snippets and JSON-LD structured data for simulation
entity pages (agents, buildings, lore, chronicle, locations, events).
Used by the SEO middleware to inject content into crawler responses.
"""

import html
import json
import logging
import re

from supabase import Client

logger = logging.getLogger(__name__)

BASE_URL = "https://metaverse.center"
_UUID_RE = re.compile(r"^[a-f0-9-]{36}$")


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
        "trends": _build_trends,
        "health": _build_health,
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


def build_entity_detail_content(
    client: Client, sim_id: str, sim_name: str, slug: str,
    view: str, entity_id: str,
) -> tuple[str, str]:
    """Build HTML and JSON-LD for an individual entity detail page.

    Returns (entity_html, jsonld_script_content).
    """
    detail_builders: dict[str, callable] = {
        "agents": _build_agent_detail,
        "buildings": _build_building_detail,
    }

    builder = detail_builders.get(view)
    if not builder:
        return "", ""

    try:
        return builder(client, sim_id, sim_name, slug, entity_id)
    except Exception:
        logger.warning(
            "Failed to build entity detail for %s/%s/%s",
            slug, view, entity_id, exc_info=True,
        )
        return "", ""


def _build_agent_detail(
    client: Client, sim_id: str, sim_name: str, slug: str,
    entity_id: str,
) -> tuple[str, str]:
    """Build Person schema for an individual agent."""
    query = (
        client.table("agents")
        .select("name,slug,character,primary_profession,portrait_image_url,gender")
        .eq("simulation_id", sim_id)
        .is_("deleted_at", "null")
    )
    if _UUID_RE.match(entity_id):
        query = query.eq("id", entity_id)
    else:
        query = query.eq("slug", entity_id)

    agents = (query.limit(1).execute()).data or []
    if not agents:
        return "", ""

    a = agents[0]
    name = a.get("name", "")
    entity_slug = a.get("slug", entity_id)
    profession = a.get("primary_profession", "")
    character = a.get("character", "")
    portrait = a.get("portrait_image_url", "")
    gender = a.get("gender", "")

    entity_html = (
        f"<h2>{_esc(name)}</h2>\n"
        f"<p class=\"role\">{_esc(profession)}"
        f"{f' · {_esc(gender)}' if gender else ''}</p>\n"
        f"<p>{_esc(_truncate(character, 500))}</p>\n"
        f"<p>From the simulation <em>{_esc(sim_name)}</em>.</p>"
    )

    person: dict = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": name,
        "description": _truncate(character, 300),
        "url": f"{BASE_URL}/simulations/{slug}/agents/{entity_slug}",
    }
    if profession:
        person["jobTitle"] = profession
    if portrait:
        person["image"] = portrait
    if gender:
        person["gender"] = gender

    return entity_html, _safe_jsonld(person)


def _build_building_detail(
    client: Client, sim_id: str, sim_name: str, slug: str,
    entity_id: str,
) -> tuple[str, str]:
    """Build Place schema for an individual building."""
    query = (
        client.table("buildings")
        .select("name,slug,description,building_type,image_url")
        .eq("simulation_id", sim_id)
        .is_("deleted_at", "null")
    )
    if _UUID_RE.match(entity_id):
        query = query.eq("id", entity_id)
    else:
        query = query.eq("slug", entity_id)

    buildings = (query.limit(1).execute()).data or []
    if not buildings:
        return "", ""

    b = buildings[0]
    name = b.get("name", "")
    entity_slug = b.get("slug", entity_id)
    desc = b.get("description", "")
    btype = b.get("building_type", "")
    image = b.get("image_url", "")

    entity_html = (
        f"<h2>{_esc(name)}</h2>\n"
        f"<p class=\"type\">{_esc(btype)}</p>\n"
        f"<p>{_esc(_truncate(desc, 500))}</p>\n"
        f"<p>Located in <em>{_esc(sim_name)}</em>.</p>"
    )

    place: dict = {
        "@context": "https://schema.org",
        "@type": "Place",
        "name": name,
        "description": _truncate(desc, 300),
        "additionalType": btype,
        "url": f"{BASE_URL}/simulations/{slug}/buildings/{entity_slug}",
    }
    if image:
        place["image"] = image

    return entity_html, _safe_jsonld(place)


def _build_agents(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("agents")
        .select("id,slug,name,character,primary_profession,portrait_image_url")
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
        "@type": "ItemList",
        "name": f"{sim_name} — Agents",
        "url": f"{BASE_URL}/simulations/{slug}/agents",
        "numberOfItems": len(agents),
        "description": (
            f"AI characters in the {sim_name} simulation"
            f" — each with unique personalities, professions, and memories."
        ),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "item": {
                    "@type": "Person",
                    "name": a.get("name", ""),
                    "jobTitle": a.get("primary_profession", ""),
                    "description": _truncate(a.get("character") or "", 300),
                    "url": f"{BASE_URL}/simulations/{slug}/agents/{a.get('slug', a.get('id', ''))}",
                    **({"image": a["portrait_image_url"]} if a.get("portrait_image_url") else {}),
                },
            }
            for i, a in enumerate(agents[:20])
        ],
    })

    return entity_html, jsonld


def _build_buildings(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    response = (
        client.table("buildings")
        .select("id,slug,name,description,building_type,image_url")
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
        "@type": "ItemList",
        "name": f"{sim_name} — Buildings",
        "url": f"{BASE_URL}/simulations/{slug}/buildings",
        "numberOfItems": len(buildings),
        "description": f"Architecture and infrastructure in the {sim_name} simulation.",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "item": {
                    "@type": "Place",
                    "name": b.get("name", ""),
                    "additionalType": b.get("building_type", ""),
                    "description": _truncate(b.get("description") or "", 300),
                    "url": f"{BASE_URL}/simulations/{slug}/buildings/{b.get('slug', b.get('id', ''))}",
                    **({"image": b["image_url"]} if b.get("image_url") else {}),
                },
            }
            for i, b in enumerate(buildings[:20])
        ],
    })

    return entity_html, jsonld


def _build_lore(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    sim_resp = (
        client.table("simulations")
        .select("description,banner_url")
        .eq("id", sim_id)
        .limit(1)
        .execute()
    )
    sim = (sim_resp.data or [{}])[0]
    desc = sim.get("description") or ""
    banner = sim.get("banner_url") or ""

    # Fetch actual lore chapters for rich content
    lore_resp = (
        client.table("simulation_lore")
        .select("chapter,title,body")
        .eq("simulation_id", sim_id)
        .order("sort_order")
        .limit(12)
        .execute()
    )
    chapters = lore_resp.data or []

    parts = [
        f"<h2>{_esc(sim_name)} — Lore</h2>",
        f"<p>{_esc(desc)}</p>",
    ]
    for ch in chapters:
        chapter_name = _esc(ch.get("chapter", ""))
        title = _esc(ch.get("title", ""))
        body = ch.get("body") or ""
        # First 300 chars of body as preview
        preview = _esc(_truncate(body, 300))
        parts.append(
            f'<article><h3>{chapter_name}: {title}</h3>'
            f'<p>{preview}</p></article>'
        )

    entity_html = "\n".join(parts)

    data: dict = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": sim_name,
        "description": desc,
        "url": f"{BASE_URL}/simulations/{slug}/lore",
        "genre": "Interactive Fiction",
    }
    if banner:
        data["image"] = banner
    if chapters:
        data["hasPart"] = [
            {
                "@type": "Chapter",
                "name": f"{ch.get('chapter', '')}: {ch.get('title', '')}",
                "position": i + 1,
            }
            for i, ch in enumerate(chapters)
        ]
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
        "author": {"@type": "Organization", "name": sim_name},
        "publisher": {
            "@type": "Organization",
            "name": "metaverse.center",
            "url": BASE_URL,
        },
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


def _build_trends(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    entity_html = (
        f"<h2>{_esc(sim_name)} — Social Trends</h2>\n"
        f"<p>Real-world news transformed into simulation events."
        f" AI-driven narrative integration for {_esc(sim_name)}.</p>"
    )

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": f"{sim_name} — Social Trends",
        "url": f"{BASE_URL}/simulations/{slug}/trends",
        "description": (
            f"Real-world news transformed into simulation events in {sim_name}."
        ),
    })

    return entity_html, jsonld


def _build_health(
    client: Client, sim_id: str, sim_name: str, slug: str,
) -> tuple[str, str]:
    entity_html = (
        f"<h2>{_esc(sim_name)} — Simulation Health</h2>\n"
        f"<p>Building Readiness, Zone Stability, Embassy Effectiveness,"
        f" and overall health metrics for {_esc(sim_name)}.</p>"
    )

    jsonld = _safe_jsonld({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": f"{sim_name} — Simulation Health",
        "url": f"{BASE_URL}/simulations/{slug}/health",
        "description": (
            f"Game metrics dashboard for {sim_name}:"
            f" building readiness, zone stability, embassy effectiveness."
        ),
    })

    return entity_html, jsonld
