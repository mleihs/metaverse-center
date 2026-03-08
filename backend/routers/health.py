from datetime import UTC, datetime

from fastapi import APIRouter

from backend.config import settings

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": datetime.now(UTC).isoformat(),
        "mock_mode": settings.forge_mock_mode,
    }
