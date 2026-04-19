"""Admin read-only routes for on-disk content packs (A1.7 Phase 3 Option B).

Two endpoints, both gated by `require_platform_admin()`:

    GET /api/v1/admin/content-packs
        → SuccessResponse[list[PackResourceManifest]]
        Lists every archetype YAML under content/dungeon/archetypes/ so the
        admin UI can populate a cascading pack → resource selector.

    GET /api/v1/admin/content-packs/{pack_slug}/{resource_path}
        → SuccessResponse[PackResourceContent]
        Returns the current on-disk content of one resource so the admin can
        materialize a draft pre-populated with real content instead of an
        empty seed.

No write routes here. Mutations flow through content_drafts (PATCH /admin/
content-drafts/{id}) and publish.py (POST /admin/content-drafts/publish).
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request

from backend.dependencies import require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.content_packs import PackResourceContent, PackResourceManifest
from backend.services.content_packs.read_service import (
    get_pack_resource,
    list_pack_resources,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/content-packs",
    tags=["Admin / Content Packs"],
)


@router.get("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_content_pack_manifest(
    request: Request,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse[list[PackResourceManifest]]:
    """Enumerate every archetype YAML resource with a quick entry count."""
    rows = list_pack_resources()
    return SuccessResponse(
        data=[PackResourceManifest.model_validate(r) for r in rows],
    )


@router.get("/{pack_slug}/{resource_path}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def read_content_pack_resource(
    request: Request,
    pack_slug: Annotated[
        str,
        Path(
            min_length=1,
            max_length=128,
            pattern=r"^[a-z][a-z0-9_]{0,127}$",
            description="Pack identifier (same regex as ContentDraftCreate).",
        ),
    ],
    resource_path: Annotated[
        str,
        Path(
            min_length=1,
            max_length=128,
            pattern=r"^[a-z][a-z0-9_]{0,127}$",
            description=(
                "YAML stem under content/dungeon/archetypes/{pack_slug}/. "
                "Restricted to lowercase [a-z0-9_] — bracket-notation "
                "resource_paths (e.g. banter[ab_01]) are NOT accepted here "
                "because the read is file-scoped."
            ),
        ),
    ],
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
) -> SuccessResponse[PackResourceContent]:
    """Read a single pack resource from disk.

    Malformed YAML surfaces as 400; missing files as 404. Path-traversal
    attempts are blocked by both the regex above and a defense-in-depth
    `.is_relative_to()` check in read_service.
    """
    content = get_pack_resource(pack_slug, resource_path)
    return SuccessResponse(
        data=PackResourceContent(
            pack_slug=pack_slug,
            resource_path=resource_path,
            content=content,
        ),
    )
