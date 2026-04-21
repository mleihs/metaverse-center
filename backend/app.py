from backend.logging_config import setup_logging

setup_logging()

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.config import settings as app_settings

# --- Sentry (must initialize before app/middleware creation) ---
# Only send errors to Sentry in deployed environments (production/staging).
# Local development and test runs should not pollute the error tracker.
from backend.services import sentry_rule_cache


def _ops_before_send(event: dict, hint: dict) -> dict | None:
    """Bureau-Ops dedup rules driven by the ``sentry_rules`` cache (P2.1).

    Delegates to :func:`backend.services.sentry_rule_cache.apply_rules`,
    which applies ignore → fingerprint → downgrade rules loaded from the
    DB. The cache is populated at lifespan startup; events that fire
    before the first reload pass through unchanged (the previous P0
    hardcoded rules lived here — they now live in migration 230 as seed
    rows so admins can edit them from the Ops panel).

    Kept thin on purpose: all rule logic belongs to the cache module so
    the admin-panel CRUD path (P2.3) and this before-send hook share one
    source of truth.
    """
    return sentry_rule_cache.apply_rules(event, hint)


if app_settings.sentry_dsn and app_settings.environment not in ("development", "test"):
    sentry_sdk.init(
        dsn=app_settings.sentry_dsn,
        environment=app_settings.sentry_environment,
        release=os.environ.get("SENTRY_RELEASE"),
        traces_sample_rate=app_settings.sentry_traces_sample_rate,
        send_default_pii=False,  # GDPR safe
        enable_tracing=True,
        before_send=_ops_before_send,
    )

from backend.dependencies import get_admin_supabase
from backend.middleware.logging_context import LoggingContextMiddleware
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.middleware.seo import (
    enrich_html_for_crawler,
    get_crawler_redirect,
    get_legacy_redirect,
    is_crawler,
)
from backend.routers import (
    achievements,
    admin,
    admin_content_packs,
    admin_drafts,
    admin_ops,
    agent_autonomy,
    agent_memories,
    agent_professions,
    agents,
    aptitudes,
    bluesky,
    bonds,
    bot_players,
    broadsheets,
    buildings,
    campaigns,
    chat,
    chronicles,
    cipher,
    connections,
    dungeon_content_admin,
    echoes,
    embassies,
    epoch_chat,
    epoch_invitations,
    epochs,
    events,
    forge,
    forge_access,
    game_mechanics,
    generation,
    health,
    heartbeat,
    instagram,
    invitations,
    locations,
    members,
    news_scanner,
    operatives,
    prompt_templates,
    public,
    relationships,
    resonance_dungeons,
    resonances,
    scores,
    seo,
    settings,
    simulations,
    social_media,
    social_stories,
    social_trends,
    style_references,
    taxonomies,
    users,
    webhooks,
    zone_actions,
)
from backend.services.ai_usage_rollup_scheduler import AiUsageRollupScheduler
from backend.services.bluesky_scheduler import BlueskyScheduler
from backend.services.content_packs.orphan_sweeper_scheduler import (
    OrphanSweeperScheduler,
)
from backend.services.dungeon_content_service import load_all_content as load_dungeon_content
from backend.services.dungeon_engine_service import start_instance_cleanup
from backend.services.epoch_cycle_scheduler import EpochCycleScheduler
from backend.services.github_app import check_env_config, close_github_app_client
from backend.services.heartbeat_service import HeartbeatService
from backend.services.instagram_scheduler import InstagramScheduler
from backend.services.platform_model_config import ensure_loaded as ensure_model_config
from backend.services.platform_research_domains import ensure_loaded as ensure_research_domains
from backend.services.resonance_scheduler import ResonanceScheduler
from backend.services.scanning.scanner_service import ScannerService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the platform model config cache
    admin_sb = await get_admin_supabase()
    await ensure_model_config(admin_sb)
    await ensure_research_domains(admin_sb)
    await load_dungeon_content(admin_sb)

    # Populate the Sentry rule cache before normal request traffic begins.
    # A DB failure here is non-fatal — the cache keeps its empty snapshot
    # (events pass through unchanged) and the 30-second TTL picks up
    # again on the next reload trigger (admin mutation or a future
    # poll). Without this, the cache stays empty until the first admin
    # rule edit, which would regress P0-equivalent filtering.
    try:
        await sentry_rule_cache.reload(admin_sb)
    except Exception:  # noqa: BLE001 — must not prevent app startup
        logging.getLogger(__name__).exception(
            "Sentry rule cache initial reload failed; events will pass "
            "through unfiltered until the next successful reload.",
        )

    # Bureau Ops Deferral B: restore in-process circuit-breaker state
    # from the durable ai_circuit_state rows so a worker restart does
    # not silently drop admin-killed scopes. OpsLedgerService swallows
    # DB errors internally so startup never fails because of this.
    from backend.services.ops_ledger_service import OpsLedgerService

    await OpsLedgerService.rehydrate_circuit_kills(admin_sb)

    # GitHub App config sanity check — non-fatal. If the admin-publish
    # path is mis-configured, the public/member traffic still serves.
    missing_github_app_env = check_env_config()
    if missing_github_app_env:
        logging.getLogger(__name__).error(
            "GitHub App env vars incomplete: %s. "
            "Content-draft publishing will fail at runtime until resolved.",
            ", ".join(missing_github_app_env),
        )

    resonance_task = await ResonanceScheduler.start()
    scanner_task = await ScannerService.start()
    heartbeat_task = await HeartbeatService.start()
    instagram_task = await InstagramScheduler.start()
    bluesky_task = await BlueskyScheduler.start()
    epoch_cycle_task = await EpochCycleScheduler.start()
    orphan_sweeper_task = await OrphanSweeperScheduler.start()
    ai_usage_rollup_task = await AiUsageRollupScheduler.start()
    dungeon_cleanup_task = await start_instance_cleanup()
    yield
    dungeon_cleanup_task.cancel()
    ai_usage_rollup_task.cancel()
    orphan_sweeper_task.cancel()
    epoch_cycle_task.cancel()
    bluesky_task.cancel()
    instagram_task.cancel()
    heartbeat_task.cancel()
    scanner_task.cancel()
    resonance_task.cancel()
    # Release the persistent GitHub App httpx client pool.
    await close_github_app_client()


app = FastAPI(
    title="Velgarien Platform API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# --- Middleware (applied in reverse order — last registered = outermost) ---

# Logging context (outermost — wraps everything)
app.add_middleware(LoggingContextMiddleware)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS
origins = [origin.strip() for origin in app_settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "If-Updated-At"],
)

# --- Rate Limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Global Exception Handlers ---
logger = logging.getLogger(__name__)

# Database connectivity errors are infrastructure failures, not application bugs.
# Return 503 so clients/load balancers can retry instead of logging a false 500.
_CONNECTIVITY_ERRORS = frozenset({"ConnectError", "ConnectTimeout", "PoolTimeout"})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if type(exc).__name__ in _CONNECTIVITY_ERRORS:
        logger.warning("Database unavailable: %s", type(exc).__name__)
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": "Database temporarily unavailable. Please retry shortly.",
                },
            },
            headers={"Retry-After": "5"},
        )
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal server error occurred.",
            },
        },
    )


# --- Routers ---
app.include_router(health.router)
app.include_router(achievements.router)
app.include_router(admin.router)
app.include_router(admin_drafts.router)
app.include_router(admin_content_packs.router)
app.include_router(admin_ops.router)
app.include_router(dungeon_content_admin.router)
app.include_router(users.router)
app.include_router(simulations.router)
app.include_router(agents.router)
app.include_router(buildings.router)
app.include_router(events.router)
app.include_router(agent_professions.router)
app.include_router(aptitudes.router)
app.include_router(locations.router)
app.include_router(taxonomies.router)
app.include_router(settings.router)
app.include_router(chat.router)
app.include_router(members.router)
app.include_router(campaigns.router)
app.include_router(generation.router)
app.include_router(prompt_templates.router)
app.include_router(invitations.router)
app.include_router(social_trends.router)
app.include_router(social_media.router)
app.include_router(relationships.router)
app.include_router(echoes.router)
app.include_router(embassies.router)
app.include_router(connections.router)
app.include_router(forge.router)
app.include_router(forge_access.router)
app.include_router(broadsheets.router)
app.include_router(chronicles.router)
app.include_router(agent_autonomy.router)
app.include_router(agent_memories.router)
app.include_router(game_mechanics.router)
app.include_router(epochs.router)
app.include_router(bonds.router)
app.include_router(bot_players.router)
app.include_router(epoch_chat.router)
app.include_router(epoch_invitations.router)
app.include_router(operatives.router)
app.include_router(scores.router)
app.include_router(zone_actions.router)
app.include_router(heartbeat.router)
app.include_router(resonances.router)
app.include_router(resonance_dungeons.router)
app.include_router(news_scanner.router)
app.include_router(style_references.router)
app.include_router(instagram.router)
app.include_router(bluesky.router)
app.include_router(social_stories.router)
app.include_router(cipher.public_router)
app.include_router(cipher.admin_router)
app.include_router(public.router)
app.include_router(seo.router)
app.include_router(webhooks.router)

# --- Static Files (Production SPA) ---
# Serves the built frontend from static/dist/ if available.
# Must be mounted AFTER all API routers so /api/* routes take priority.
_static_dir = Path(__file__).resolve().parent.parent / "static" / "dist"
if _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="static-assets")

    @app.get("/{full_path:path}", response_model=None)
    async def serve_spa(request: Request, full_path: str) -> FileResponse | HTMLResponse | RedirectResponse:
        """Serve SPA index.html for all non-API, non-asset routes."""
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"success": False, "message": "API route not found"})

        file_path = _static_dir / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(file_path)
        # Legacy WordPress URLs → 301 redirect (all visitors, not just crawlers)
        legacy_target = get_legacy_redirect(request.url.path)
        if legacy_target:
            return RedirectResponse(url=legacy_target, status_code=301)
        # For crawlers: serve enriched HTML with meta tags + semantic content.
        # Cloudflare caches these at the edge via Cache-Control header.
        if is_crawler(request.headers.get("user-agent", "")):
            redirect_path = get_crawler_redirect(request.url.path)
            if redirect_path:
                return RedirectResponse(url=redirect_path, status_code=301)
            enriched = await enrich_html_for_crawler(_static_dir / "index.html", request.url.path)
            if enriched:
                return HTMLResponse(
                    content=enriched,
                    headers={"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"},
                )
        return FileResponse(
            _static_dir / "index.html",
            headers={"Cache-Control": "no-cache, must-revalidate"},
        )
