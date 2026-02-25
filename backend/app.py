import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.config import settings as app_settings
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.routers import (
    agent_professions,
    agents,
    buildings,
    campaigns,
    chat,
    events,
    generation,
    health,
    invitations,
    locations,
    members,
    prompt_templates,
    settings,
    simulations,
    social_media,
    social_trends,
    taxonomies,
    users,
)

app = FastAPI(
    title="Velgarien Platform API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# --- Middleware (applied in reverse order) ---

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS
origins = [origin.strip() for origin in app_settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Global Exception Handler ---
_logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    _logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
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
app.include_router(users.router)
app.include_router(simulations.router)
app.include_router(agents.router)
app.include_router(buildings.router)
app.include_router(events.router)
app.include_router(agent_professions.router)
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

# --- Static Files (Production SPA) ---
# Serves the built frontend from static/dist/ if available.
# Must be mounted AFTER all API routers so /api/* routes take priority.
_static_dir = Path(__file__).resolve().parent.parent / "static" / "dist"
if _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        """Serve SPA index.html for all non-API, non-asset routes."""
        file_path = _static_dir / full_path
        if file_path.is_file() and ".." not in full_path:
            return FileResponse(file_path)
        return FileResponse(_static_dir / "index.html")
