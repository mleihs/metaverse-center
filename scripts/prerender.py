"""
Build-time prerenderer: generates static HTML snapshots for crawler consumption.

Fetches data from Supabase (anon key) and produces semantic HTML files
under static/dist/prerendered/. No headless browser required.

Usage:
    SUPABASE_URL=... SUPABASE_ANON_KEY=... python scripts/prerender.py
"""

import html
import os
import re
import sys
from pathlib import Path

import httpx

BASE_URL = "https://metaverse.center"
DIST_DIR = Path(__file__).resolve().parent.parent / "static" / "dist"
OUT_DIR = DIST_DIR / "prerendered"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# View labels mirror backend/seo/registry.py — keep keys in sync when adding a view.
# Not wired in this script (runtime middleware still covers them on request):
#   chronicle   — requires chronicle table fetch via REST
#   broadsheet  — requires simulation_broadsheets table fetch via REST
# Deliberately NOT included:
#   chat        — member-only route, never indexable
#   trends      — legacy URL, no frontend route
VIEW_LABELS: dict[str, str] = {
    "lore": "Lore",
    "agents": "Agents",
    "buildings": "Buildings",
    "events": "Events",
    "social": "Social",
    "locations": "Locations",
    "health": "Simulation Health",
}

# Platform routes with static content (no DB query)
PLATFORM_PAGES: dict[str, dict[str, str]] = {
    "index": {
        "title": "metaverse.center — a worldbuilding framework",
        "description": (
            "Build and explore simulated worlds. Create agents, buildings,"
            " events, and social dynamics in interconnected shards of reality."
        ),
        "canonical": f"{BASE_URL}/",
        "content": (
            "<h1>metaverse.center</h1>"
            "<p>Build and explore simulated worlds. Create agents, buildings, events, "
            "and social dynamics in interconnected shards of reality.</p>"
        ),
    },
    "dashboard": {
        "title": "Dashboard | metaverse.center",
        "description": (
            "Explore simulated worlds \u2014 Velgarien, The Gaslit Reach,"
            " Station Null, Speranza, and Cit\u00e9 des Dames."
        ),
        "canonical": f"{BASE_URL}/dashboard",
        "content": (
            "<h1>Dashboard</h1>"
            "<p>Explore simulated worlds — Velgarien, The Gaslit Reach, "
            "Station Null, Speranza, and Cit\u00e9 des Dames.</p>"
        ),
    },
    "multiverse": {
        "title": "Cartographer's Map | metaverse.center",
        "description": "Interactive force-directed graph of the multiverse — simulation connections and epoch battles.",
        "canonical": f"{BASE_URL}/multiverse",
        "content": (
            "<h1>Cartographer's Map</h1>"
            "<p>Interactive force-directed graph of the multiverse — "
            "simulation connections and epoch battles.</p>"
        ),
    },
    "how-to-play": {
        "title": "How to Play | metaverse.center",
        "description": "Complete guide to epoch gameplay — operatives, scoring, alliances, and strategy.",
        "canonical": f"{BASE_URL}/how-to-play",
        "content": (
            "<h1>How to Play</h1>"
            "<p>Complete guide to epoch gameplay — operatives, scoring, "
            "alliances, and strategy.</p>"
        ),
    },
    "epoch": {
        "title": "Epochs | metaverse.center",
        "description": "Competitive cross-simulation battles — form alliances, deploy operatives, and claim victory.",
        "canonical": f"{BASE_URL}/epoch",
        "content": (
            "<h1>Epochs</h1>"
            "<p>Competitive cross-simulation battles — form alliances, "
            "deploy operatives, and claim victory.</p>"
        ),
    },
    "worlds": {
        "title": "Explore Living Worlds | metaverse.center",
        "description": (
            "Browse player-created civilizations — each with AI-powered"
            " characters, evolving cities, and stories that write themselves."
        ),
        "canonical": f"{BASE_URL}/worlds",
        "content": (
            "<h1>Explore Living Worlds</h1>"
            "<p>Browse player-created civilizations — each with AI-powered characters, "
            "evolving cities, and stories that write themselves. Every world started as "
            "a single sentence.</p>"
        ),
    },
    "chronicles": {
        "title": "The Chronicle Feed | metaverse.center",
        "description": (
            "Every world writes its own newspaper. Read AI-generated broadsheets"
            " from active simulations — fiction tied to real gameplay events."
        ),
        "canonical": f"{BASE_URL}/chronicles",
        "content": (
            "<h1>The Chronicle Feed</h1>"
            "<p>Every world writes its own newspaper. Read AI-generated broadsheets "
            "from active simulations — fiction tied to real gameplay events.</p>"
        ),
    },
}


def _esc(text: str | None) -> str:
    """Escape for HTML attribute context."""
    return html.escape(text or "", quote=True)


def _esc_content(text: str | None) -> str:
    """Escape for HTML content context."""
    return html.escape(text or "", quote=False)


def _supabase_get(table: str, select: str, filters: dict[str, str] | None = None) -> list[dict]:
    """Fetch rows from Supabase REST API using anon key."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    if filters:
        for col, val in filters.items():
            if val == "null":
                url += f"&{col}=is.null"
            else:
                url += f"&{col}=eq.{val}"
    resp = httpx.get(
        url,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _extract_head_and_scripts(index_html: str) -> tuple[str, str, str]:
    """Extract <head> content, the script/modulepreload tags, and CSS link from index.html.

    Returns (head_content, script_tags, body_close).
    """
    head_match = re.search(r"<head>(.*?)</head>", index_html, re.DOTALL)
    head_content = head_match.group(1) if head_match else ""

    # Extract script and modulepreload tags
    script_tags = []
    for match in re.finditer(r'<script type="module"[^>]*src="[^"]*"[^>]*></script>', index_html):
        script_tags.append(match.group(0))
    for match in re.finditer(r'<link rel="modulepreload"[^>]*>', index_html):
        script_tags.append(match.group(0))
    # Extract CSS link
    for match in re.finditer(r'<link rel="stylesheet" crossorigin[^>]*>', index_html):
        script_tags.append(match.group(0))

    return head_content, "\n    ".join(script_tags)


def _inject_meta(head_content: str, *, title: str, description: str, canonical: str, og_image: str = "") -> str:
    """Replace meta tags in head content for this specific page."""
    h = head_content
    h = re.sub(r"<title>[^<]*</title>", f"<title>{_esc(title)}</title>", h)
    h = re.sub(
        r'<meta name="description" content="[^"]*"',
        f'<meta name="description" content="{_esc(description)}"',
        h,
    )
    h = re.sub(r'<meta property="og:title" content="[^"]*"', f'<meta property="og:title" content="{_esc(title)}"', h)
    h = re.sub(
        r'<meta property="og:description" content="[^"]*"',
        f'<meta property="og:description" content="{_esc(description)}"',
        h,
    )
    h = re.sub(r'<meta property="og:url" content="[^"]*"', f'<meta property="og:url" content="{_esc(canonical)}"', h)
    if og_image:
        h = re.sub(
            r'<meta property="og:image" content="[^"]*"', f'<meta property="og:image" content="{_esc(og_image)}"', h
        )
    h = re.sub(
        r'<meta name="twitter:title" content="[^"]*"', f'<meta name="twitter:title" content="{_esc(title)}"', h
    )
    h = re.sub(
        r'<meta name="twitter:description" content="[^"]*"',
        f'<meta name="twitter:description" content="{_esc(description)}"',
        h,
    )
    if og_image:
        h = re.sub(
            r'<meta name="twitter:image" content="[^"]*"', f'<meta name="twitter:image" content="{_esc(og_image)}"', h
        )
    h = re.sub(r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{_esc(canonical)}"', h)
    return h


def _build_page(head_content: str, script_tags: str, *, title: str, description: str,
                 canonical: str, content_html: str, og_image: str = "") -> str:
    """Build a complete prerendered HTML page."""
    head = _inject_meta(head_content, title=title, description=description, canonical=canonical, og_image=og_image)
    # Remove the script/modulepreload/css tags from head — we place them after content
    head = re.sub(r'\s*<script type="module" crossorigin[^>]*></script>', "", head)
    head = re.sub(r'\s*<link rel="modulepreload"[^>]*>', "", head)
    head = re.sub(r'\s*<link rel="stylesheet" crossorigin[^>]*>', "", head)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>{head}</head>
<body>
  <main id="prerendered-content">
    {content_html}
  </main>
  <velg-app></velg-app>
    {script_tags}
</body>
</html>"""


def _write_page(rel_path: str, content: str) -> None:
    """Write a prerendered HTML file."""
    out_file = OUT_DIR / f"{rel_path}.html"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(content, encoding="utf-8")
    print(f"  -> {out_file.relative_to(DIST_DIR)}")


def _build_agents_content(sim_id: str, sim_name: str) -> str:
    """Build HTML content for agents view."""
    agents = _supabase_get(
        "agents", "name,character,primary_profession",
        {"simulation_id": sim_id, "deleted_at": "null"},
    )
    sections = []
    for a in agents:
        name = _esc_content(a.get("name"))
        char_text = a.get("character") or ""
        desc = _esc_content(char_text[:200] + "..." if len(char_text) > 200 else char_text)
        profession = _esc_content(a.get("primary_profession"))
        sections.append(f'<article><h2>{name}</h2><p class="role">{profession}</p><p>{desc}</p></article>')
    return f"<h1>{_esc_content(sim_name)} — Agents</h1>\n" + "\n".join(sections)


def _build_buildings_content(sim_id: str, sim_name: str) -> str:
    """Build HTML content for buildings view."""
    buildings = _supabase_get(
        "buildings", "name,description,building_type",
        {"simulation_id": sim_id, "deleted_at": "null"},
    )
    sections = []
    for b in buildings:
        name = _esc_content(b.get("name"))
        desc_text = b.get("description") or ""
        desc = _esc_content(desc_text[:200] + "..." if len(desc_text) > 200 else desc_text)
        btype = _esc_content(b.get("building_type"))
        sections.append(f'<article><h2>{name}</h2><p class="type">{btype}</p><p>{desc}</p></article>')
    return f"<h1>{_esc_content(sim_name)} — Buildings</h1>\n" + "\n".join(sections)


def _build_locations_content(sim_id: str, sim_name: str) -> str:
    """Build HTML content for locations view."""
    zones = _supabase_get("zones", "name,description", {"simulation_id": sim_id})
    streets = _supabase_get("city_streets", "name", {"simulation_id": sim_id})
    parts = [f"<h1>{_esc_content(sim_name)} — Locations</h1>"]
    if zones:
        parts.append("<h2>Zones</h2>")
        for z in zones:
            desc_text = z.get("description") or ""
            desc = _esc_content(desc_text[:200] + "..." if len(desc_text) > 200 else desc_text)
            parts.append(f"<article><h3>{_esc_content(z.get('name', ''))}</h3><p>{desc}</p></article>")
    if streets:
        parts.append("<h2>Streets</h2>")
        parts.append("<ul>")
        for s in streets:
            parts.append(f"<li>{_esc_content(s.get('name', ''))}</li>")
        parts.append("</ul>")
    return "\n".join(parts)


def _build_lore_content(sim_name: str, sim_desc: str) -> str:
    """Build HTML content for lore view."""
    return f"<h1>{_esc_content(sim_name)} — Lore</h1>\n<p>{_esc_content(sim_desc)}</p>"


def _build_events_content(sim_name: str) -> str:
    """Build minimal HTML for events view (mostly dynamic)."""
    return f"<h1>{_esc_content(sim_name)} — Events</h1>\n<p>Live events and happenings in {_esc_content(sim_name)}.</p>"


def _build_social_content(sim_name: str) -> str:
    """Build minimal HTML for social view."""
    return (
        f"<h1>{_esc_content(sim_name)} \u2014 Social</h1>\n"
        f"<p>Social interactions and trends in {_esc_content(sim_name)}.</p>"
    )


def _build_health_content(sim_name: str) -> str:
    """Build minimal HTML for simulation health view."""
    return (
        f"<h1>{_esc_content(sim_name)} — Simulation Health</h1>\n"
        f"<p>Building Readiness, Zone Stability, Embassy Effectiveness,"
        f" and overall health metrics for {_esc_content(sim_name)}.</p>"
    )


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    index_path = DIST_DIR / "index.html"
    if not index_path.is_file():
        print(f"ERROR: {index_path} not found. Run frontend build first.", file=sys.stderr)
        sys.exit(1)

    index_html = index_path.read_text(encoding="utf-8")
    head_content, script_tags = _extract_head_and_scripts(index_html)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Prerendering static HTML snapshots...")

    # 1. Platform pages
    for slug, meta in PLATFORM_PAGES.items():
        page = _build_page(
            head_content, script_tags,
            title=meta["title"],
            description=meta["description"],
            canonical=meta["canonical"],
            content_html=meta["content"],
        )
        _write_page(slug, page)

    # 2. Simulation pages
    sims = _supabase_get("simulations", "id,slug,name,description,banner_url", {"status": "active"})
    print(f"Found {len(sims)} active simulations.")

    view_builders: dict[str, callable] = {
        "lore": lambda sim: _build_lore_content(sim["name"], sim.get("description", "")),
        "agents": lambda sim: _build_agents_content(sim["id"], sim["name"]),
        "buildings": lambda sim: _build_buildings_content(sim["id"], sim["name"]),
        "locations": lambda sim: _build_locations_content(sim["id"], sim["name"]),
        "events": lambda sim: _build_events_content(sim["name"]),
        "social": lambda sim: _build_social_content(sim["name"]),
        "health": lambda sim: _build_health_content(sim["name"]),
    }

    for sim in sims:
        slug = sim.get("slug")
        if not slug:
            continue
        sim_name = sim.get("name", slug)
        sim_desc = sim.get("description", "")
        banner_url = sim.get("banner_url", "")

        print(f"  Simulation: {sim_name} ({slug})")

        for view, builder in view_builders.items():
            view_label = VIEW_LABELS[view]
            title = f"{view_label} — {sim_name} | metaverse.center"
            description = sim_desc or f"Explore {sim_name} on metaverse.center."
            canonical = f"{BASE_URL}/simulations/{slug}/{view}"

            try:
                content_html = builder(sim)
            except Exception as e:
                print(f"    WARN: Failed to build {view} for {slug}: {e}", file=sys.stderr)
                content_html = f"<h1>{_esc_content(sim_name)} — {_esc_content(view_label)}</h1>"

            page = _build_page(
                head_content, script_tags,
                title=title,
                description=description,
                canonical=canonical,
                content_html=content_html,
                og_image=banner_url,
            )
            _write_page(f"simulations/{slug}/{view}", page)

        # 3. Entity detail pages (agents, buildings)
        _prerender_entity_details(head_content, script_tags, sim, slug, sim_name, banner_url)

    print("Done.")


def _prerender_entity_details(
    head_content: str, script_tags: str,
    sim: dict, slug: str, sim_name: str, banner_url: str,
) -> None:
    """Prerender individual agent and building detail pages for a simulation."""
    sim_id = sim["id"]

    # Agent detail pages
    agents = _supabase_get(
        "agents",
        "slug,name,character,primary_profession,portrait_image_url",
        {"simulation_id": sim_id, "deleted_at": "null"},
    )
    for a in agents:
        a_slug = a.get("slug")
        if not a_slug:
            continue
        name = _esc_content(a.get("name", ""))
        profession = _esc_content(a.get("primary_profession", ""))
        char_text = a.get("character") or ""
        desc = _esc_content(char_text[:500] + "..." if len(char_text) > 500 else char_text)
        portrait = a.get("portrait_image_url") or banner_url

        content = (
            f"<h1>{name}</h1>\n"
            f"<p class=\"role\">{profession}</p>\n"
            f"<p>{desc}</p>\n"
            f"<p>From the simulation <em>{_esc_content(sim_name)}</em>.</p>"
        )
        page = _build_page(
            head_content, script_tags,
            title=f"{a.get('name', '')} — {sim_name} | metaverse.center",
            description=char_text[:160] if char_text else f"{a.get('name', '')} in {sim_name}",
            canonical=f"{BASE_URL}/simulations/{slug}/agents/{a_slug}",
            content_html=content,
            og_image=portrait,
        )
        _write_page(f"simulations/{slug}/agents/{a_slug}", page)

    # Building detail pages
    buildings = _supabase_get(
        "buildings",
        "slug,name,description,building_type,image_url",
        {"simulation_id": sim_id, "deleted_at": "null"},
    )
    for b in buildings:
        b_slug = b.get("slug")
        if not b_slug:
            continue
        name = _esc_content(b.get("name", ""))
        btype = _esc_content(b.get("building_type", ""))
        b_desc = b.get("description") or ""
        desc = _esc_content(b_desc[:500] + "..." if len(b_desc) > 500 else b_desc)
        image = b.get("image_url") or banner_url

        content = (
            f"<h1>{name}</h1>\n"
            f"<p class=\"type\">{btype}</p>\n"
            f"<p>{desc}</p>\n"
            f"<p>Located in <em>{_esc_content(sim_name)}</em>.</p>"
        )
        page = _build_page(
            head_content, script_tags,
            title=f"{b.get('name', '')} — {sim_name} | metaverse.center",
            description=b_desc[:160] if b_desc else f"{b.get('name', '')} in {sim_name}",
            canonical=f"{BASE_URL}/simulations/{slug}/buildings/{b_slug}",
            content_html=content,
            og_image=image,
        )
        _write_page(f"simulations/{slug}/buildings/{b_slug}", page)


if __name__ == "__main__":
    main()
