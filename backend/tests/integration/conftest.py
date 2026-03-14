"""Shared fixtures for integration tests that need a live Supabase instance."""

import pytest

from backend.config import settings


def _supabase_available() -> bool:
    """Check if a real Supabase instance is reachable at the configured URL."""
    if not settings.supabase_anon_key:
        return False
    try:
        import httpx
        resp = httpx.get(
            f"{settings.supabase_url}/rest/v1/",
            headers={"apikey": settings.supabase_anon_key},
            timeout=2.0,
        )
        return resp.status_code < 500
    except Exception:
        return False


requires_supabase = pytest.mark.skipif(
    not _supabase_available(),
    reason="Supabase not reachable at configured URL",
)
