"""Database query utilities for supabase-py.

Addresses a well-documented footgun in postgrest-py:
``maybe_single().execute()`` returns ``None`` (the entire response object,
not just ``.data``) when PostgREST returns 0 rows (HTTP 406).  Every
downstream ``resp.data.get(...)`` is therefore a latent NoneType crash.

See: https://github.com/supabase/supabase-py/issues/1207
     https://github.com/supabase/postgrest-py/issues/94
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from backend.utils.responses import extract_list

if TYPE_CHECKING:
    from postgrest import AsyncMaybeSingleRequestBuilder

    from supabase import AsyncClient as Client


async def maybe_single_data(
    builder: AsyncMaybeSingleRequestBuilder,
) -> dict | None:
    """Execute a ``maybe_single()`` query, returning the row dict or None.

    Collapses the two-layer Optional that supabase-py produces
    (``resp`` itself can be ``None`` when 0 rows match, AND ``resp.data``
    can be ``None``) into a single ``Optional[dict]``.

    Usage::

        data = await maybe_single_data(
            supabase.table("t").select("*").eq("id", x).maybe_single()
        )
        if data:
            value = data["field"]
    """
    resp = await builder.execute()
    return resp.data if resp else None


async def resolve_epoch_sim_names(
    admin_supabase: Client,
    sim_ids: list[str],
) -> dict[str, dict]:
    """Resolve display names for epoch simulation IDs.

    Game instances (cloned sims) get their *template* name via
    ``source_template_id``, so "Conventional Memory (Epoch 15)" becomes
    "Conventional Memory".  Templates and non-epoch sims return their
    own name unchanged.

    Uses the admin client to bypass RLS — epoch leaderboards, alliances,
    and results must show all participants regardless of membership.

    Returns ``{sim_id: {"name": display_name, "slug": slug_or_none}}``.
    """
    if not sim_ids:
        return {}

    sims_resp = await (
        admin_supabase.table("simulations")
        .select("id, name, slug, source_template_id")
        .in_("id", sim_ids)
        .execute()
    )
    sims = extract_list(sims_resp)

    # Batch-fetch template names for game instances
    template_ids = list({s["source_template_id"] for s in sims if s.get("source_template_id")})
    template_map: dict[str, str] = {}
    if template_ids:
        templates_resp = await (
            admin_supabase.table("simulations")
            .select("id, name")
            .in_("id", template_ids)
            .execute()
        )
        template_map = {t["id"]: t["name"] for t in extract_list(templates_resp)}

    result: dict[str, dict] = {}
    for s in sims:
        template_id = s.get("source_template_id")
        display_name = template_map.get(template_id, s["name"]) if template_id else s["name"]
        result[s["id"]] = {"name": display_name, "slug": s.get("slug")}

    return result
