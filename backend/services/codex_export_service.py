"""PDF codex generation and export for simulations (Chronicle Printing Press)."""

from __future__ import annotations

import io
import logging
import re
import zipfile
from datetime import UTC, datetime
from uuid import UUID

import httpx
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class CodexExportService:
    """PDF codex generation and high-res image export."""

    @staticmethod
    async def generate_codex_pdf(
        admin_supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        purchase_id: str,
    ) -> None:
        """Generate simulation codex as PDF, upload to storage, return URL.

        Background task. Fetches all simulation data, renders HTML via
        inline template, converts to PDF via WeasyPrint, uploads to
        Supabase Storage.
        """
        structlog.contextvars.bind_contextvars(simulation_id=str(simulation_id))
        from backend.services.forge_feature_service import ForgeFeatureService

        try:
            # 1. Fetch all simulation data
            sim_resp = (
                await admin_supabase.table("simulations")
                .select("name, slug, description, created_at")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim = sim_resp.data

            agents_resp = (
                await admin_supabase.table("agents")
                .select("name, gender, primary_profession, character, background, portrait_image_url")
                .eq("simulation_id", str(simulation_id))
                .order("name")
                .execute()
            )
            agents = agents_resp.data or []

            buildings_resp = (
                await admin_supabase.table("buildings")
                .select("name, building_type, description, building_condition, image_url")
                .eq("simulation_id", str(simulation_id))
                .order("name")
                .execute()
            )
            buildings = buildings_resp.data or []

            zones_resp = (
                await admin_supabase.table("zones")
                .select("name, zone_type, description")
                .eq("simulation_id", str(simulation_id))
                .order("name")
                .execute()
            )
            zones = zones_resp.data or []

            lore_resp = (
                await admin_supabase.table("simulation_lore")
                .select("chapter, arcanum, title, epigraph, body, image_slug, image_caption")
                .eq("simulation_id", str(simulation_id))
                .order("sort_order")
                .execute()
            )
            lore = lore_resp.data or []

            # Fetch theme settings
            settings_resp = (
                await admin_supabase.table("simulation_settings")
                .select("setting_key, setting_value")
                .eq("simulation_id", str(simulation_id))
                .eq("category", "design")
                .execute()
            )
            theme = {s["setting_key"]: s["setting_value"] for s in (settings_resp.data or [])}

            # 2. Render HTML
            html_content = CodexExportService._render_codex_html(
                sim,
                agents,
                buildings,
                zones,
                lore,
                theme,
            )

            # 3. Convert to PDF via WeasyPrint
            content_type = "application/pdf"
            ext = "pdf"
            try:
                from weasyprint import HTML as WEASY_HTML

                pdf_bytes = WEASY_HTML(string=html_content).write_pdf()
            except ImportError:
                logger.warning("WeasyPrint not available, generating HTML codex instead")
                pdf_bytes = html_content.encode("utf-8")
                content_type = "text/html"
                ext = "html"

            # 4. Upload to Supabase Storage
            slug = sim.get("slug", str(simulation_id)[:8])
            date_str = datetime.now(UTC).strftime("%Y%m%d")
            filename = f"codex-{slug}-{date_str}.{ext}"

            download_url = ""
            try:
                await admin_supabase.storage.from_("simulation.assets").upload(
                    f"{simulation_id}/exports/{filename}",
                    pdf_bytes,
                    {"content-type": content_type},
                )
                download_url = await admin_supabase.storage.from_("simulation.assets").get_public_url(
                    f"{simulation_id}/exports/{filename}"
                )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
                logger.exception("Storage upload failed for codex")

            # 5. Mark feature purchase completed
            await ForgeFeatureService.complete_feature(
                admin_supabase,
                purchase_id,
                result={
                    "download_url": download_url,
                    "filename": filename,
                    "agents": len(agents),
                    "buildings": len(buildings),
                    "lore_sections": len(lore),
                },
            )
            logger.info(
                "Chronicle codex generated",
                extra={
                    "simulation_id": str(simulation_id),
                    "filename": filename,
                },
            )

        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError) as exc:
            logger.exception("Chronicle generation failed")
            await ForgeFeatureService.fail_feature(
                admin_supabase,
                purchase_id,
                str(exc),
            )

    @staticmethod
    async def generate_hires_archive(
        admin_supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        purchase_id: str,
    ) -> None:
        """Package all simulation images at full native resolution into a ZIP.

        Background task. Downloads .full.avif originals (falling back to
        thumbnail .avif on 404), organises into folders, uploads ZIP to
        Supabase Storage.
        """
        structlog.contextvars.bind_contextvars(simulation_id=str(simulation_id))
        from backend.services.forge_feature_service import ForgeFeatureService

        try:
            # 1. Fetch simulation metadata
            sim_resp = (
                await admin_supabase.table("simulations")
                .select("name, slug, banner_url")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim = sim_resp.data
            slug = sim.get("slug", str(simulation_id)[:8])

            # 2. Fetch entities
            agents_resp = (
                await admin_supabase.table("agents")
                .select("name, portrait_image_url")
                .eq("simulation_id", str(simulation_id))
                .order("name")
                .execute()
            )
            agents = agents_resp.data or []

            buildings_resp = (
                await admin_supabase.table("buildings")
                .select("name, image_url")
                .eq("simulation_id", str(simulation_id))
                .order("name")
                .execute()
            )
            buildings = buildings_resp.data or []

            lore_resp = (
                await admin_supabase.table("simulation_lore")
                .select("image_slug")
                .eq("simulation_id", str(simulation_id))
                .order("sort_order")
                .execute()
            )
            lore = [s for s in (lore_resp.data or []) if s.get("image_slug")]

            # 3. Build download manifest: (full_url, fallback_url, zip_path)
            manifest: list[tuple[str, str | None, str]] = []
            safe_name = _sanitize_filename(sim["name"])

            # Banner
            if sim.get("banner_url"):
                full = sim["banner_url"].replace(".avif", ".full.avif")
                manifest.append((full, sim["banner_url"], f"{safe_name}-fullres/banner.avif"))

            # Agents
            seen_agents: dict[str, int] = {}
            for agent in agents:
                url = agent.get("portrait_image_url")
                if not url:
                    continue
                fname = _dedup_name(seen_agents, _sanitize_filename(agent["name"]))
                full = url.replace(".avif", ".full.avif")
                manifest.append((full, url, f"{safe_name}-fullres/agents/{fname}.avif"))

            # Buildings
            seen_buildings: dict[str, int] = {}
            for b in buildings:
                url = b.get("image_url")
                if not url:
                    continue
                fname = _dedup_name(seen_buildings, _sanitize_filename(b["name"]))
                full = url.replace(".avif", ".full.avif")
                manifest.append((full, url, f"{safe_name}-fullres/buildings/{fname}.avif"))

            # Lore
            base_storage = f"{settings.supabase_url}/storage/v1/object/public/simulation.assets/{slug}/lore"
            for section in lore:
                img_slug = section["image_slug"]
                full = f"{base_storage}/{img_slug}.full.avif"
                thumb = f"{base_storage}/{img_slug}.avif"
                manifest.append((full, thumb, f"{safe_name}-fullres/lore/{img_slug}.avif"))

            # 4. Download all images and write ZIP
            buf = io.BytesIO()
            image_count = 0
            async with httpx.AsyncClient(timeout=30.0) as client:
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
                    for full_url, fallback_url, zip_path in manifest:
                        data = await _download_with_fallback(client, full_url, fallback_url)
                        if data:
                            zf.writestr(zip_path, data)
                            image_count += 1

            zip_bytes = buf.getvalue()

            # 5. Upload ZIP to Supabase Storage
            date_str = datetime.now(UTC).strftime("%Y%m%d")
            filename = f"hires-{slug}-{date_str}.zip"
            storage_path = f"{simulation_id}/exports/{filename}"

            download_url = ""
            try:
                await admin_supabase.storage.from_("simulation.assets").upload(
                    storage_path,
                    zip_bytes,
                    {"content-type": "application/zip"},
                )
                download_url = await admin_supabase.storage.from_("simulation.assets").get_public_url(storage_path)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
                logger.exception("Storage upload failed for hires archive")

            # 6. Mark completed
            await ForgeFeatureService.complete_feature(
                admin_supabase,
                purchase_id,
                result={
                    "download_url": download_url,
                    "filename": filename,
                    "image_count": image_count,
                },
            )
            logger.info(
                "Hi-res archive generated",
                extra={
                    "simulation_id": str(simulation_id),
                    "filename": filename,
                    "image_count": image_count,
                },
            )

        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError) as exc:
            logger.exception("Hi-res archive generation failed")
            await ForgeFeatureService.fail_feature(
                admin_supabase,
                purchase_id,
                str(exc),
            )

    @staticmethod
    def _render_codex_html(
        sim: dict,
        agents: list[dict],
        buildings: list[dict],
        zones: list[dict],
        lore: list[dict],
        theme: dict,
    ) -> str:
        """Render simulation data into styled HTML for PDF conversion."""
        primary = theme.get("color_primary", "#f59e0b")
        bg = theme.get("color_background", "#0a0a0a")
        text_color = theme.get("color_text", "#e5e5e5")
        heading_font = theme.get("font_heading", "Georgia, serif")
        body_font = theme.get("font_body", "Georgia, serif")

        lore_html = ""
        for section in lore:
            classified = "CLASSIFIED" in (section.get("chapter") or "")
            cls = "classified" if classified else ""
            epigraph_html = ""
            if section.get("epigraph"):
                epigraph_html = f'<blockquote class="epigraph">{_esc(section["epigraph"])}</blockquote>'
            lore_html += f"""
            <div class="lore-section {cls}">
                <h3>{_esc(section.get("arcanum", ""))}
                    &mdash; {_esc(section["title"])}</h3>
                {epigraph_html}
                <div class="lore-body">{_nl2p(section["body"])}</div>
            </div>"""

        agents_html = ""
        for agent in agents:
            img = (
                f'<img src="{agent["portrait_image_url"]}" class="portrait" />'
                if agent.get("portrait_image_url")
                else ""
            )
            agents_html += f"""
            <div class="agent-card">
                {img}
                <h4>{_esc(agent["name"])}</h4>
                <p class="profession">
                    {_esc(agent.get("primary_profession", ""))}</p>
                <p>{_esc(agent.get("character", ""))}</p>
                <p class="background">{_esc(agent.get("background", ""))}</p>
            </div>"""

        buildings_html = ""
        for b in buildings:
            img = f'<img src="{b["image_url"]}" class="building-img" />' if b.get("image_url") else ""
            buildings_html += f"""
            <div class="building-card">
                {img}
                <h4>{_esc(b["name"])}</h4>
                <p class="type">{_esc(b.get("building_type", ""))}
                    &mdash; {_esc(b.get("building_condition", ""))}</p>
                <p>{_esc(b.get("description", ""))}</p>
            </div>"""

        now_str = datetime.now(UTC).strftime("%Y-%m-%d")

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{_esc(sim["name"])} &mdash; Bureau Codex</title>
<style>
@page {{ size: A4; margin: 2cm; }}
body {{
  background: {bg}; color: {text_color};
  font-family: {body_font}; font-size: 11pt; line-height: 1.6;
}}
h1, h2, h3, h4 {{ font-family: {heading_font}; color: {primary}; }}
h1 {{ font-size: 28pt; text-align: center; margin-top: 3cm; }}
h2 {{
  font-size: 18pt; border-bottom: 2px solid {primary};
  padding-bottom: 8pt; page-break-before: always;
}}
h3 {{ font-size: 14pt; }}
.subtitle {{
  text-align: center; font-size: 12pt; color: {primary}; opacity: 0.7;
}}
.stamp {{
  text-align: center; font-family: monospace; font-size: 10pt;
  letter-spacing: 0.3em; text-transform: uppercase;
  color: {primary}; margin-top: 1cm; opacity: 0.5;
}}
.epigraph {{
  font-style: italic; border-left: 3px solid {primary};
  padding-left: 12pt; margin: 16pt 0; opacity: 0.8;
}}
.lore-section {{ margin-bottom: 24pt; }}
.classified {{ border-left: 4px solid {primary}; padding-left: 12pt; }}
.agent-card, .building-card {{
  margin-bottom: 20pt; page-break-inside: avoid;
}}
.portrait, .building-img {{
  max-width: 200px; float: right; margin: 0 0 12pt 16pt;
}}
.profession, .type {{
  font-family: monospace; font-size: 9pt;
  text-transform: uppercase; letter-spacing: 0.1em; color: {primary};
}}
.background {{ font-style: italic; opacity: 0.8; }}
.toc {{ list-style: none; padding: 0; }}
.toc li {{
  padding: 4pt 0; border-bottom: 1px dotted rgba(255,255,255,0.1);
}}
</style>
</head>
<body>
<h1>{_esc(sim["name"])}</h1>
<p class="subtitle">{_esc(sim.get("description", ""))}</p>
<p class="stamp">Bureau of Impossible Geography &mdash; Classified Codex</p>

<h2>Table of Contents</h2>
<ul class="toc">
  <li>Agent Registry ({len(agents)} operatives)</li>
  <li>Building Catalogue ({len(buildings)} structures)</li>
  <li>Zone Survey ({len(zones)} districts)</li>
  <li>Lore Archive ({len(lore)} sections)</li>
</ul>

<h2>Agent Registry</h2>
{agents_html}

<h2>Building Catalogue</h2>
{buildings_html}

<h2>Lore Archive</h2>
{lore_html}

<p class="stamp">End of Codex &mdash; Generated {now_str}</p>
</body>
</html>"""


def _esc(text: str) -> str:
    """Basic HTML escaping."""
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _nl2p(text: str) -> str:
    """Convert double newlines to paragraph tags."""
    paragraphs = (text or "").split("\n\n")
    return "".join(f"<p>{_esc(p.strip())}</p>" for p in paragraphs if p.strip())


def _sanitize_filename(name: str) -> str:
    """Replace non-alphanumeric chars with underscores, collapse runs."""
    sanitized = re.sub(r"[^\w\-]", "_", name.strip())
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    return sanitized[:80] or "unnamed"


def _dedup_name(seen: dict[str, int], name: str) -> str:
    """Return unique filename, appending numeric suffix on collision."""
    if name not in seen:
        seen[name] = 1
        return name
    seen[name] += 1
    return f"{name}_{seen[name]}"


async def _download_with_fallback(
    client: httpx.AsyncClient,
    primary_url: str,
    fallback_url: str | None,
) -> bytes | None:
    """Download from primary URL, falling back on 404/error."""
    try:
        resp = await client.get(primary_url)
        if resp.status_code == 200:
            return resp.content
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
        logger.debug("Primary download failed: %s", primary_url)

    if fallback_url:
        try:
            resp = await client.get(fallback_url)
            if resp.status_code == 200:
                return resp.content
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError, OSError):
            logger.debug("Fallback download failed: %s", fallback_url)

    return None
