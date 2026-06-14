"""Shared base models for YAML content packs (domain-agnostic).

Both the dungeon pack schemas (`schemas.py`) and the drift/travel pack
schemas (`travel_schema.py`) build on these:

  - `StrictModel` rejects unknown YAML keys, so an author typo fails at load
    time rather than silently dropping the field.
  - `VersionedPack` carries an explicit `schema_version`, so the loader can
    reject a future incompatible pack instead of mis-parsing it.

Extracted into its own module so a second content domain reuses the
convention without importing private (`_StrictModel`) names from the dungeon
schema module — the two domains share the pack contract, not each other.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

# Bump on a breaking change to any pack file layout; migrate old packs
# in-place or write a one-shot upgrade script.
CONTENT_PACK_SCHEMA_VERSION: int = 1


class StrictModel(BaseModel):
    """Base model: unknown YAML keys raise ValidationError (catches typos)."""

    model_config = ConfigDict(extra="forbid")


class VersionedPack(StrictModel):
    """A pack-root model carrying an explicit `schema_version`."""

    schema_version: int = CONTENT_PACK_SCHEMA_VERSION


__all__ = ["CONTENT_PACK_SCHEMA_VERSION", "StrictModel", "VersionedPack"]
