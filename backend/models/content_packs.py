"""Admin-facing response models for content-pack read endpoints (A1.7 Phase 3 Option B).

These wrap the outputs of `backend.services.content_packs.read_service` with
typed shapes so the admin UI has stable TS types via codegen.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PackResourceManifest(BaseModel):
    """One row of the pack-resource directory listing.

    `entry_count = -1` signals a YAML parse failure at manifest-build time —
    the admin UI should render a warning indicator on that row.
    """

    pack_slug: str
    resource_path: str
    entry_count: int = Field(
        ...,
        description=(
            "Number of entries in the collection. "
            "Array-backed collections report len; object-backed collections "
            "(e.g. spawns) report the sum of nested-list lengths. -1 = parse error."
        ),
    )
    file_path: str = Field(
        ...,
        description="Display-only relative path from the repo content root.",
    )


class PackResourceContent(BaseModel):
    """Wrapper for the raw YAML content returned from get_pack_resource.

    The YAML shape varies per pack kind, so the payload is an untyped dict.
    Consumer (admin UI) treats it opaquely and forwards it into
    `ContentDraftCreate.base_content`/`.working_content`.
    """

    pack_slug: str
    resource_path: str
    content: dict[str, Any]
