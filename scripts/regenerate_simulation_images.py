#!/usr/bin/env python3
"""Generic image (re)generation pipeline for ANY simulation — new or existing.

One configurable entry point that drives the production ``ForgeImageService``
pipeline. Works equally for:

  * **existing** simulations — refresh outdated/low-quality images, and
  * **new** simulations — first-time generation right after seeding.

It replaces the per-simulation ad-hoc scripts (``_velgarien_deluxe_regen.py``,
``generate_station_null_images.py``, …).

Design contract (why this is the clean tool, not a hack)
───────────────────────────────────────────────────────
* The **image model is not chosen here.** It is resolved per image type from
  each simulation's ``simulation_settings`` (category ``ai``,
  ``image_model_<purpose>``), falling back to the platform default in
  ``model_resolver.PLATFORM_DEFAULT_IMAGE_MODELS`` (flux-2-pro). To change
  quality/cost, change the *setting*, not this script.
* **Lore drives the prompts.** Each prompt is grounded in the DB — per-entity
  ``character``/``background``/``description`` plus a ``world_context`` built
  from ``simulation_lore`` rows. The DB is the runtime source of truth (it is
  seeded from the design-time master lore in
  ``docs/explanations/concept-lore.md``; that markdown is *not* read at runtime).
* **Maximum quality is opt-in, not hardcoded.** Handcrafted per-entity prompts
  (Playbook Phase 4, e.g. distilled from ``concept-lore.md``) plug in via
  ``--prompts-module`` — the script stays world-agnostic.
* **Pre-flight audit** mirrors the Phase 0 checks of
  ``docs/guides/simulation-image-upgrade-playbook.md`` (flux params, style
  prompts, thin descriptions, missing lore) so misconfiguration is caught
  *before* spending money.

────────────────────────────────────────────────────────────────────────────
Usage
─────
    source .venv/bin/activate
    # 1) Always preview first — free. Lists entities, resolved model + flux
    #    params, lore context, and Phase-0 red flags:
    PYTHONPATH=. python scripts/regenerate_simulation_images.py \
        --sim station-null --types portraits,lore,banner --env prod --dry-run

    # 2) Real run. PROD requires --yes. The FIRST image doubles as the credit
    #    test — a Replicate billing/credit error aborts the whole run at once:
    PYTHONPATH=. python scripts/regenerate_simulation_images.py \
        --sim station-null --types portraits,lore,banner --env prod --yes

    # New simulation, full first-time generation incl. buildings + A.6 templates,
    # production-grade prompt authoring:
    PYTHONPATH=. python scripts/regenerate_simulation_images.py \
        --sim my-new-world --types portraits,buildings,lore,banner \
        --regenerate-templates --llm-env production --env prod --yes

Arguments
─────────
    --sim SLUG_OR_UUID   Simulation slug or UUID. Repeatable (--sim a --sim b).
    --types LIST         Comma list of {portraits,buildings,lore,banner}.
                         Default: portraits,lore,banner  (buildings excluded;
                         pass them explicitly for a full/new-sim run).
    --env {prod,local}   Target Supabase environment. Default: local (safe).
    --llm-env {development,production}
                         Which model tier authors the prompt *descriptions*
                         (image model is unaffected). Default: development
                         (cheap). Use production for max-quality auto prompts.
    --dry-run            Audit + list only; generate nothing, spend nothing.
    --yes                Required to actually write to PROD (guards accidents).
    --limit N            Cap entities per type (cheap testing). 0 = no cap.
    --regenerate-templates  Run A.6 (ForgeThemeService) first to (re)build the
                            world-specific prompt templates from lore. Recommended
                            for NEW simulations.
    --prompts-module MOD    Importable module exposing AGENT_PROMPTS /
                            BUILDING_PROMPTS / LORE_PROMPTS dicts (handcrafted
                            per-entity overrides). E.g. scripts._velgarien_image_prompts
    --lore-sections N    Lore sections folded into world_context. Default 8.
    --lore-chars N       Max chars per lore section in world_context. Default 1000.
    --sleep S            Delay between generations (rate-limit courtesy). Default 2.0.

Credentials (from .env unless noted)
────────────────────────────────────
    REPLICATE_API_TOKEN        required for generation
    OPENROUTER_API_KEY         used to author prompt descriptions
    env=prod: SUPABASE_SERVICE_ROLE_KEY (or `railway variables` fallback),
              SUPABASE_URL (defaults to the project's prod URL)
    env=local: standard local Supabase URL + demo service key
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("regen")

# Canonical project production Supabase (override via SUPABASE_URL env).
DEFAULT_PROD_URL = "https://bffjoupddfjaljqrwqck.supabase.co"
LOCAL_URL = "http://127.0.0.1:54321"
# Well-known local Supabase demo service-role key (same as other repo scripts).
LOCAL_SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
)

# Canonical design-lore markdown (per-simulation sections). Folded into
# world_context so prompts reflect the curated art direction + image-prompt
# guidance, not only the in-world DB documents.
DEFAULT_LORE_MD = "docs/explanations/concept-lore.md"

VALID_TYPES = ("portraits", "buildings", "lore", "banner")
# type → resolve_image_model() purpose key (drives image_model_<purpose> setting)
TYPE_PURPOSE = {
    "portraits": "agent_portrait",
    "buildings": "building_image",
    "lore": "lore_image",
    "banner": "banner",
}
# type → resolve_style_prompt() purpose key. NOTE: these differ from the image
# purposes above — ForgeImageService passes portrait/building/lore/banner (which
# map to image_style_prompt_<key>), not the agent_portrait/lore_image variants.
STYLE_PURPOSE = {
    "portraits": "portrait",
    "buildings": "building",
    "lore": "lore",
    "banner": "banner",
}
# Flux-optimal params per the image-upgrade playbook (Phase 1.2).
FLUX_OPTIMAL_GUIDANCE = 3.5
FLUX_OPTIMAL_STEPS = 28
# Playbook Phase 0.2: descriptions thinner than this hurt image quality.
THIN_DESCRIPTION_CHARS = 120
# Rough per-image price (~1 MP) for cost estimation only.
PRICE_BY_MODEL = {
    "flux-2-max": 0.07,
    "flux-2-flex": 0.06,
    "flux-1.1-pro": 0.04,
    "flux-2-pro": 0.03,
    "flux-2-dev": 0.012,
    "flux-dev": 0.012,
}


def estimate_price(model: str) -> float:
    low = model.lower()
    for needle, price in PRICE_BY_MODEL.items():
        if needle in low:
            return price
    return 0.04  # conservative default for unknown models


def resolve_supabase_config(env: str) -> tuple[str, str]:
    """Return (url, service_role_key) for the target environment."""
    if env == "local":
        return (
            os.environ.get("LOCAL_SUPABASE_URL", LOCAL_URL),
            os.environ.get("LOCAL_SUPABASE_SERVICE_KEY", LOCAL_SERVICE_KEY),
        )
    # prod
    url = os.environ.get("SUPABASE_URL", DEFAULT_PROD_URL)
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        try:
            out = subprocess.check_output(["railway", "variables", "--json"], timeout=20)
            key = json.loads(out).get("SUPABASE_SERVICE_ROLE_KEY")
            if key:
                logger.info("Resolved prod service key via railway")
        except Exception as e:  # noqa: BLE001 — fallback path, surfaced below
            logger.warning("railway fallback failed: %s", e)
    if not key:
        raise SystemExit(
            "No prod service key. Set SUPABASE_SERVICE_ROLE_KEY (e.g. from "
            "velgarien-coolify.env) or link the railway project."
        )
    return url, key


def load_overrides(module_path: str | None) -> tuple[dict, dict, dict]:
    """Load optional handcrafted prompt-override dicts from a module."""
    if not module_path:
        return {}, {}, {}
    mod = importlib.import_module(module_path)
    return (
        getattr(mod, "AGENT_PROMPTS", {}) or {},
        getattr(mod, "BUILDING_PROMPTS", {}) or {},
        getattr(mod, "LORE_PROMPTS", {}) or {},
    )


async def resolve_simulation(supabase, ident: str) -> dict:
    """Resolve a simulation by UUID or slug → row dict (raises if missing)."""
    try:
        UUID(ident)
        column = "id"
    except ValueError:
        column = "slug"
    resp = await (
        supabase.table("simulations").select("id, name, slug, description").eq(column, ident).maybe_single().execute()
    )
    row = resp.data if resp else None
    if not row:
        raise SystemExit(f"Simulation not found by {column}={ident!r}")
    return row


async def build_world_context(supabase, sim_id: str, max_sections: int, max_chars: int) -> str:
    """Assemble lore context (title + truncated body) for prompt grounding."""
    resp = await (
        supabase.table("simulation_lore")
        .select("title, body")
        .eq("simulation_id", sim_id)
        .order("sort_order")
        .limit(max_sections)
        .execute()
    )
    rows = resp.data or []
    return "\n".join(f"{r['title']}: {(r.get('body') or '')[:max_chars]}" for r in rows)


def extract_md_lore(md_path: str, sim_name: str, max_chars: int) -> str:
    """Extract a simulation's canonical design-lore block from a structured
    markdown file (e.g. docs/explanations/concept-lore.md).

    Matches headers of the form '## / ### / #### <token>. <SimName> — …' and
    returns the richest (longest) matching block — concept-lore.md carries both a
    brief (section II) and a detailed (section IV) write-up per world; the detailed
    one wins. Returns '' if the file or section is absent (graceful fall-back to
    DB lore). Generic across all simulations; no per-world hardcoding.
    """
    if not md_path:
        return ""
    p = Path(md_path)
    if not p.is_file():
        logger.warning("  ⚠ lore-md not found: %s (DB lore only)", md_path)
        return ""
    lines = p.read_text(encoding="utf-8").splitlines()
    header_re = re.compile(r"^(#{2,4})\s+[0-9A-Za-z]+\.\s+(.*)$")
    any_header_re = re.compile(r"^(#{1,6})\s")
    name_l = sim_name.strip().lower()
    sections: list[str] = []
    for i, line in enumerate(lines):
        m = header_re.match(line)
        if not m or not m.group(2).strip().lower().startswith(name_l):
            continue
        level = len(m.group(1))
        body: list[str] = []
        for nxt in lines[i + 1 :]:
            hm = any_header_re.match(nxt)
            if hm and len(hm.group(1)) <= level:
                break
            body.append(nxt)
        sections.append((line + "\n" + "\n".join(body)).strip())
    if not sections:
        logger.info("  ℹ no '%s' section in %s — DB lore only", sim_name, md_path)
        return ""
    return max(sections, key=len)[:max_chars]


class BillingAbortError(Exception):
    """Raised to stop the entire run when Replicate signals a billing/credit failure."""


async def audit_types(resolver, supabase, sim_id: str, types: list[str], results: dict) -> None:
    """Phase-0 pre-flight audit: resolved model, flux params, style prompts.

    Mirrors docs/guides/simulation-image-upgrade-playbook.md §0. Records the
    model/price into ``results`` and logs red-flag warnings so misconfiguration
    surfaces before any spend.
    """
    # Which per-sim style prompts exist (vs. falling back to the generic platform
    # style). A platform default always exists, so the meaningful signal is
    # whether THIS world customised its art direction.
    sres = await (
        supabase.table("simulation_settings")
        .select("setting_key")
        .eq("simulation_id", sim_id)
        .eq("category", "ai")
        .like("setting_key", "image_style_prompt_%")
        .execute()
    )
    sim_style_keys = {r["setting_key"] for r in (sres.data or [])}

    for t in types:
        rm = await resolver.resolve_image_model(TYPE_PURPOSE[t])
        results[t]["model"] = rm.model
        results[t]["price"] = estimate_price(rm.model)

        is_flux = "flux" in rm.model.lower()
        guidance = getattr(rm, "guidance_scale", None)
        steps = getattr(rm, "num_inference_steps", None)
        has_custom_style = f"image_style_prompt_{STYLE_PURPOSE[t]}" in sim_style_keys
        logger.info(
            "  %-10s → %-30s ~$%.3f  guidance=%s steps=%s style=%s  (source=%s)",
            t,
            rm.model,
            results[t]["price"],
            guidance,
            steps,
            "custom" if has_custom_style else "platform-default",
            rm.source,
        )
        # Playbook red flags.
        if is_flux and guidance is not None and guidance > FLUX_OPTIMAL_GUIDANCE + 0.01:
            logger.warning(
                "    ⚠ %s guidance=%s > flux-optimal %s (SD-era value; lower for natural results)",
                t,
                guidance,
                FLUX_OPTIMAL_GUIDANCE,
            )
        if is_flux and steps is not None and steps != FLUX_OPTIMAL_STEPS:
            logger.warning("    ⚠ %s steps=%s (flux-optimal is %s)", t, steps, FLUX_OPTIMAL_STEPS)
        if not has_custom_style:
            logger.info(
                "    ℹ %s has no per-sim image_style_prompt_%s — using generic platform style",
                t,
                STYLE_PURPOSE[t],
            )


def audit_thin_descriptions(kind: str, rows: list, fields: tuple[str, ...]) -> None:
    """Warn about entities whose source text is too thin for quality images."""
    thin = [r.get("name", "?") for r in rows if sum(len(r.get(f) or "") for f in fields) < THIN_DESCRIPTION_CHARS]
    if thin:
        logger.warning(
            "    ⚠ %d %s with thin descriptions (<%d chars) — consider enriching: %s",
            len(thin),
            kind,
            THIN_DESCRIPTION_CHARS,
            ", ".join(thin[:8]) + ("…" if len(thin) > 8 else ""),
        )


async def regenerate_one(
    supabase,
    sim: dict,
    types: list[str],
    overrides: tuple[dict, dict, dict],
    *,
    dry_run: bool,
    limit: int,
    regenerate_templates: bool,
    lore_sections: int,
    lore_chars: int,
    lore_md_path: str,
    lore_md_chars: int,
    sleep_s: float,
    replicate_key: str,
    openrouter_key: str | None,
) -> dict:
    """(Re)generate selected image types for a single simulation."""
    from backend.services.forge_image_service import ForgeImageService
    from backend.services.model_resolver import ModelResolver
    from backend.utils.responses import extract_list

    agent_overrides, building_overrides, lore_overrides = overrides
    sim_id = sim["id"]
    sim_slug = sim["slug"]
    results = {t: {"ok": 0, "fail": 0, "model": "", "price": 0.0} for t in types}

    logger.info("\n%s", "═" * 72)
    logger.info("SIMULATION: %s  (slug=%s  id=%s)", sim["name"], sim_slug, sim_id)
    logger.info("%s", "═" * 72)

    # ── Lore context (the grounding the new images will reflect) ───────────
    # Two sources, combined: (1) the canonical design lore from concept-lore.md
    # (curated art direction + per-entity visual detail + image-prompt guidance),
    # and (2) the in-world DB documents (simulation_lore). The .md is the source
    # the user authors; the DB is what the runtime app reads — folding both in
    # gives the richest grounding.
    db_lore = await build_world_context(supabase, sim_id, lore_sections, lore_chars)
    md_lore = extract_md_lore(lore_md_path, sim["name"], lore_md_chars)
    parts = []
    if md_lore:
        parts.append("CANONICAL DESIGN LORE (concept-lore.md):\n" + md_lore)
    if db_lore:
        parts.append("IN-WORLD DOCUMENTS (simulation_lore):\n" + db_lore)
    world_context = "\n\n".join(parts)
    logger.info(
        "Lore world_context: %d chars  (md=%d from %s, db=%d)",
        len(world_context),
        len(md_lore),
        lore_md_path or "—",
        len(db_lore),
    )
    if not world_context:
        logger.warning(
            "  ⚠ no lore (neither concept-lore.md section nor simulation_lore rows) — prompts will be generic."
        )
    elif dry_run:
        logger.info("  preview: %s…", world_context[:400].replace("\n", " | "))

    # ── Phase-0 audit: model + flux params + style prompts per type ────────
    resolver = ModelResolver(supabase, UUID(sim_id))
    logger.info("Resolved targets:")
    await audit_types(resolver, supabase, sim_id, types, results)

    # ── A.6 templates (optional; recommended for new sims) ─────────────────
    if regenerate_templates and not dry_run:
        from backend.services.forge_theme_service import ForgeThemeService

        logger.info("\n— A.6: regenerating world-specific prompt templates —")
        await ForgeThemeService.generate_simulation_templates(supabase, UUID(sim_id), openrouter_key=openrouter_key)
        logger.info("✓ templates regenerated")
    elif regenerate_templates:
        logger.info("[DRY RUN] would regenerate A.6 prompt templates")

    image_service = ForgeImageService(
        supabase,
        UUID(sim_id),
        replicate_api_key=replicate_key,
        openrouter_api_key=openrouter_key,
        world_context=world_context,
    )

    def capped(rows: list) -> list:
        return rows[:limit] if limit else rows

    async def run_entity(type_key: str, label: str, coro_factory) -> None:
        """Execute one generation with billing fail-fast + bookkeeping."""
        if dry_run:
            logger.info("[DRY RUN] %s: %s", type_key, label)
            return
        from backend.services.external.replicate import ReplicateBillingError

        logger.info("Generating %s: %s …", type_key, label)
        try:
            url = await coro_factory()
            logger.info("  ✓ %s → %s", label, url)
            results[type_key]["ok"] += 1
        except ReplicateBillingError as e:
            logger.error("  ✗ BILLING/CREDIT failure on %s: %s", label, e)
            raise BillingAbortError(str(e)) from e
        except Exception as e:  # noqa: BLE001 — per-entity isolation, logged + counted
            logger.error("  ✗ %s FAILED: %s", label, e)
            results[type_key]["fail"] += 1
        await asyncio.sleep(sleep_s)

    # ── Banner ────────────────────────────────────────────────────────────
    if "banner" in types:
        logger.info("\n— BANNER —")
        await run_entity(
            "banner",
            sim["name"],
            lambda: image_service.generate_banner_image(sim["name"], sim.get("description") or "", anchor_data=None),
        )

    # ── Portraits ─────────────────────────────────────────────────────────
    if "portraits" in types:
        agents_resp = await (
            supabase.table("agents")
            .select("*")
            .eq("simulation_id", sim_id)
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        agents = capped(extract_list(agents_resp))
        have = sum(1 for a in agents if a.get("portrait_image_url"))
        logger.info("\n— PORTRAITS (%d; %d already have an image, %d missing) —", len(agents), have, len(agents) - have)
        audit_thin_descriptions("agents", agents, ("character", "background"))
        for agent in agents:
            name = agent["name"]
            override = agent_overrides.get(name)
            await run_entity(
                "portraits",
                f"{name}{' [handcrafted]' if override else ''}",
                lambda a=agent, o=override: image_service.generate_agent_portrait(
                    UUID(a["id"]),
                    a["name"],
                    agent_data={
                        "character": a.get("character") or "",
                        "background": a.get("background") or "",
                        "is_ambassador": a.get("is_ambassador"),
                    },
                    description_override=o,
                ),
            )

    # ── Buildings ─────────────────────────────────────────────────────────
    if "buildings" in types:
        buildings_resp = await (
            supabase.table("buildings")
            .select("*")
            .eq("simulation_id", sim_id)
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        buildings = capped(extract_list(buildings_resp))
        have = sum(1 for b in buildings if b.get("image_url"))
        logger.info(
            "\n— BUILDINGS (%d; %d already have an image, %d missing) —", len(buildings), have, len(buildings) - have
        )
        audit_thin_descriptions("buildings", buildings, ("description",))
        for bldg in buildings:
            name = bldg["name"]
            override = building_overrides.get(name)
            await run_entity(
                "buildings",
                f"{name}{' [handcrafted]' if override else ''}",
                lambda b=bldg, o=override: image_service.generate_building_image(
                    UUID(b["id"]),
                    b["name"],
                    b.get("building_type") or "government",
                    building_data={
                        "description": b.get("description") or "",
                        "building_condition": b.get("building_condition") or "",
                        "special_type": b.get("special_type"),
                    },
                    description_override=o,
                ),
            )

    # ── Lore ──────────────────────────────────────────────────────────────
    if "lore" in types:
        lore_resp = await (
            supabase.table("simulation_lore")
            .select("*")
            .eq("simulation_id", sim_id)
            .neq("image_slug", "")
            .order("sort_order")
            .execute()
        )
        sections = capped([s for s in extract_list(lore_resp) if s.get("image_slug")])
        have = sum(1 for s in sections if s.get("image_generated_at"))
        logger.info("\n— LORE (%d; %d already generated, %d missing) —", len(sections), have, len(sections) - have)
        for section in sections:
            title = section.get("title", "?")
            slug = section.get("image_slug", "")
            override = lore_overrides.get(slug)
            await run_entity(
                "lore",
                f"{title} (slug={slug}){' [handcrafted]' if override else ''}",
                lambda s=section, sl=slug, o=override: image_service.generate_lore_image(
                    section_title=s.get("title", ""),
                    section_body=(s.get("body") or "")[:500],
                    image_slug=sl,
                    sim_slug=sim_slug,
                    section_id=s.get("id"),
                    image_caption=o or s.get("image_caption"),
                ),
            )

    return results


def print_summary(all_results: dict[str, dict], *, dry_run: bool) -> None:
    logger.info("\n%s", "═" * 72)
    logger.info("SUMMARY%s", "  [DRY RUN — nothing generated]" if dry_run else "")
    logger.info("%s", "═" * 72)
    grand_ok = grand_fail = 0
    grand_cost = 0.0
    for sim_slug, by_type in all_results.items():
        for t, r in by_type.items():
            cost = r["ok"] * r["price"]
            grand_ok += r["ok"]
            grand_fail += r["fail"]
            grand_cost += cost
            logger.info(
                "  %-16s %-10s ok=%-3d fail=%-3d  %-26s ~$%.2f",
                sim_slug,
                t,
                r["ok"],
                r["fail"],
                r["model"],
                cost,
            )
    logger.info("%s", "─" * 72)
    logger.info("  TOTAL  ok=%d  fail=%d  ~$%.2f", grand_ok, grand_fail, grand_cost)
    logger.info("%s", "═" * 72)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generic per-simulation image (re)generation")
    parser.add_argument("--sim", action="append", required=True, help="Simulation slug or UUID (repeatable)")
    parser.add_argument("--types", default="portraits,lore,banner", help=f"Comma list: {','.join(VALID_TYPES)}")
    parser.add_argument("--env", choices=("prod", "local"), default="local")
    parser.add_argument(
        "--llm-env",
        choices=("development", "production"),
        default="development",
        help="Model tier that authors prompt descriptions (image model unaffected)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="Required to write to PROD")
    parser.add_argument("--limit", type=int, default=0, help="Cap entities per type (0 = no cap)")
    parser.add_argument("--regenerate-templates", action="store_true")
    parser.add_argument("--prompts-module", default=None)
    parser.add_argument("--lore-sections", type=int, default=8)
    parser.add_argument("--lore-chars", type=int, default=1000)
    parser.add_argument(
        "--lore-md", default=DEFAULT_LORE_MD, help="Markdown design-lore file folded into world_context; '' to disable"
    )
    parser.add_argument("--lore-md-chars", type=int, default=6000, help="Max chars from the .md lore section")
    parser.add_argument("--sleep", type=float, default=2.0)
    args = parser.parse_args()

    types = [t.strip() for t in args.types.split(",") if t.strip()]
    bad = [t for t in types if t not in VALID_TYPES]
    if bad:
        raise SystemExit(f"Invalid --types {bad}; valid: {', '.join(VALID_TYPES)}")

    if args.env == "prod" and not args.dry_run and not args.yes:
        raise SystemExit("Refusing to write to PROD without --yes (use --dry-run to preview).")

    # backend.config reads the environment from the RAILWAY_ENVIRONMENT alias
    # (config.py: environment = Field(alias="RAILWAY_ENVIRONMENT")), NOT "ENVIRONMENT".
    # Must be set before backend.config is first imported; all backend imports below
    # are late, so setting it here (after arg parsing) is honoured by the
    # description-authoring LLM tier selection.
    os.environ["RAILWAY_ENVIRONMENT"] = args.llm_env

    replicate_key = os.environ.get("REPLICATE_API_TOKEN")
    if not replicate_key and not args.dry_run:
        raise SystemExit("REPLICATE_API_TOKEN not set (needed for generation).")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_key:
        logger.warning("OPENROUTER_API_KEY not set — auto prompt descriptions may be degraded.")

    url, key = resolve_supabase_config(args.env)
    overrides = load_overrides(args.prompts_module)

    logger.info(
        "ENV=%s  LLM_ENV=%s  URL=%s  types=%s  dry_run=%s  limit=%s",
        args.env,
        args.llm_env,
        url,
        types,
        args.dry_run,
        args.limit or "∞",
    )
    if args.prompts_module:
        logger.info("Prompt overrides from: %s", args.prompts_module)

    from supabase import acreate_client

    supabase = await acreate_client(url, key)

    # Load DB-backed platform model config into the in-process cache so prompt
    # descriptions resolve to the configured models (not the hardcoded fallbacks).
    from backend.services import platform_model_config

    await platform_model_config.ensure_loaded(supabase)

    all_results: dict[str, dict] = {}
    try:
        for ident in args.sim:
            sim = await resolve_simulation(supabase, ident)
            all_results[sim["slug"]] = await regenerate_one(
                supabase,
                sim,
                types,
                overrides,
                dry_run=args.dry_run,
                limit=args.limit,
                regenerate_templates=args.regenerate_templates,
                lore_sections=args.lore_sections,
                lore_chars=args.lore_chars,
                lore_md_path=args.lore_md,
                lore_md_chars=args.lore_md_chars,
                sleep_s=args.sleep,
                replicate_key=replicate_key or "",
                openrouter_key=openrouter_key,
            )
    except BillingAbortError as e:
        logger.error("\n*** ABORTED — Replicate billing/credit failure: %s", e)
        logger.error("*** Check credits at replicate.com/account/billing. Nothing further generated.")
        print_summary(all_results, dry_run=args.dry_run)
        sys.exit(2)

    print_summary(all_results, dry_run=args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
