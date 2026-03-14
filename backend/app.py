from backend.logging_config import setup_logging

setup_logging()

import logging
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
if app_settings.sentry_dsn:
    sentry_sdk.init(
        dsn=app_settings.sentry_dsn,
        environment=app_settings.sentry_environment,
        traces_sample_rate=app_settings.sentry_traces_sample_rate,
        send_default_pii=False,  # GDPR safe
        enable_tracing=True,
    )

from backend.dependencies import get_admin_supabase
from backend.services.platform_model_config import ensure_loaded as ensure_model_config
from backend.services.resonance_scheduler import ResonanceScheduler
from backend.services.scanning.scanner_service import ScannerService
from backend.middleware.logging_context import LoggingContextMiddleware
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.middleware.seo import enrich_html_for_crawler, get_crawler_redirect, get_prerendered_html, is_crawler
from backend.routers import (
    admin,
    agent_memories,
    agent_professions,
    agents,
    aptitudes,
    bot_players,
    buildings,
    campaigns,
    chat,
    chronicles,
    connections,
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
    invitations,
    locations,
    members,
    operatives,
    prompt_templates,
    public,
    relationships,
    resonances,
    scores,
    seo,
    settings,
    simulations,
    social_media,
    social_trends,
    style_references,
    taxonomies,
    users,
    news_scanner,
    zone_actions,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm the platform model config cache
    admin_sb = await get_admin_supabase()
    await ensure_model_config(admin_sb)

    resonance_task = await ResonanceScheduler.start()
    scanner_task = await ScannerService.start()
    yield
    scanner_task.cancel()
    resonance_task.cancel()


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

# --- Global Exception Handler ---
logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": "INTERNAL_ERROR",
            "message": "An internal server error occurred.",
        },
    )

# --- Routers ---
app.include_router(health.router)
app.include_router(admin.router)
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
app.include_router(chronicles.router)
app.include_router(agent_memories.router)
app.include_router(game_mechanics.router)
app.include_router(epochs.router)
app.include_router(bot_players.router)
app.include_router(epoch_chat.router)
app.include_router(epoch_invitations.router)
app.include_router(operatives.router)
app.include_router(scores.router)
app.include_router(zone_actions.router)
app.include_router(resonances.router)
app.include_router(news_scanner.router)
app.include_router(style_references.router)
app.include_router(public.router)
app.include_router(seo.router)

# --- Static Files (Production SPA) ---
# Serves the built frontend from static/dist/ if available.
# Must be mounted AFTER all API routers so /api/* routes take priority.
_static_dir = Path(__file__).resolve().parent.parent / "static" / "dist"
if _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="static-assets")

    @app.get("/{full_path:path}", response_model=None)
    async def serve_spa(
        request: Request, full_path: str
    ) -> FileResponse | HTMLResponse | RedirectResponse:
        """Serve SPA index.html for all non-API, non-asset routes."""
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"success": False, "message": "API route not found"})

        file_path = _static_dir / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(file_path)
        # For crawlers: serve prerendered HTML or enriched meta tags
        if is_crawler(request.headers.get("user-agent", "")):
            redirect_path = get_crawler_redirect(request.url.path)
            if redirect_path:
                return RedirectResponse(url=redirect_path, status_code=301)
            # Check for prerendered static HTML first
            prerendered = get_prerendered_html(_static_dir, request.url.path)
            if prerendered:
                return FileResponse(prerendered, media_type="text/html")
            # Fallback: dynamic meta enrichment
            enriched = await enrich_html_for_crawler(_static_dir / "index.html", request.url.path)
            if enriched:
                return HTMLResponse(content=enriched)
        return FileResponse(
            _static_dir / "index.html",
            headers={"Cache-Control": "no-cache, must-revalidate"},
        )
