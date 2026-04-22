"""Journal attunement catalog + unlock service (P3).

Attunements are meta-progression rewards that crystallize when the
player's composed constellation matches a starter-set resonance type.
The 3 starter attunements live in ``journal_attunements`` (seeded by
migration 232):

    emotional    → Einstimmung des Zögerns  (Hesitation → Dungeon option)
    archetype    → Einstimmung der Gnade    (Mercy → Epoch operative)
    temporal     → Einstimmung des Bebens   (Tremor → Simulation bleed signature)

contradiction does not unlock anything in the starter set (plan §2 AD-9
+ migration 232 comment). Future 4th attunement can cover it.

This service is split from ``constellation_service`` so its budget /
admin-client plumbing stays contained — the CRUD surface of the
constellation stays free of meta-progression concerns.

Consumer APIs:

* ``evaluate(supabase, resonance_type)`` — catalog lookup. Called from
  ``insight_service.crystallize``.
* ``unlock(admin, user_id, attunement_id, constellation_id)`` —
  idempotent insert. Returns ``True`` when the row is newly added
  (first unlock), ``False`` when the user already had it. Uses the
  composite PK ``(user_id, attunement_id)`` to dedupe; race-safe.
* ``has(supabase, user_id, slug)`` — the fast-path query the game
  hooks consume (dungeon threshold code, epoch operative dispatch,
  bleed-signature emission) to decide whether the attunement's
  effect applies. Kept small so it can land inside tight loops.
* ``list_catalog`` / ``list_unlocks`` — read paths for the Attunements
  tab.
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.journal import (
    AttunementCatalogEntry,
    AttunementResponse,
    UserAttunementResponse,
)
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


def _attunement_from_row(row: dict) -> AttunementResponse:
    return AttunementResponse(
        id=row["id"],
        slug=row["slug"],
        name_de=row["name_de"],
        name_en=row["name_en"],
        description_de=row["description_de"],
        description_en=row["description_en"],
        system_hook=row["system_hook"],
        effect=row.get("effect") or {},
        required_resonance=row.get("required_resonance") or {},
        required_resonance_type=row.get("required_resonance_type"),
        enabled=bool(row.get("enabled", True)),
    )


def _unlock_from_row(row: dict, slug: str | None = None) -> UserAttunementResponse:
    return UserAttunementResponse(
        attunement_id=row["attunement_id"],
        attunement_slug=slug or row.get("attunement_slug") or "",
        constellation_id=row.get("constellation_id"),
        unlocked_at=row["unlocked_at"],
    )


class AttunementService:
    """Catalog + per-user unlock surface for the journal's attunements."""

    _CATALOG = "journal_attunements"
    _UNLOCKS = "user_attunements"

    # ── Catalog reads ──────────────────────────────────────────────────

    @classmethod
    async def list_catalog(cls, supabase: Client) -> list[AttunementResponse]:
        """Return every enabled attunement in catalog order (seeded_at).

        Explicit ``.eq('enabled', True)`` is defense-in-depth against
        a future policy change — the catalog table's RLS already
        filters by enabled for authenticated readers, but the filter
        is cheap and makes the intent obvious at the call site.
        """
        resp = await (
            supabase.table(cls._CATALOG)
            .select("*")
            .eq("enabled", True)
            .order("seeded_at")
            .execute()
        )
        return [_attunement_from_row(r) for r in extract_list(resp)]

    @classmethod
    async def list_unlocks(
        cls, supabase: Client, user_id: UUID
    ) -> list[UserAttunementResponse]:
        """Return the caller's unlock log with slugs pre-joined.

        Single query via Postgrest's nested-select: the foreign key on
        ``user_attunements.attunement_id`` points to
        ``journal_attunements.id``, so ``.select('*,
        journal_attunements(slug)')`` returns the catalog slug in a
        nested object. Cleaner than doing a second fetch + in-process
        join.
        """
        resp = await (
            supabase.table(cls._UNLOCKS)
            .select("*, journal_attunements(slug)")
            .eq("user_id", str(user_id))
            .order("unlocked_at", desc=True)
            .execute()
        )
        out: list[UserAttunementResponse] = []
        for row in extract_list(resp):
            nested = row.get("journal_attunements") or {}
            slug = nested.get("slug") if isinstance(nested, dict) else None
            out.append(_unlock_from_row(row, slug))
        return out

    @classmethod
    async def list_catalog_with_status(
        cls, supabase: Client, user_id: UUID
    ) -> list[AttunementCatalogEntry]:
        """Single-shot view model for ``GET /journal/attunements``.

        Composes catalog rows with the caller's unlock log so the
        frontend can render locked + unlocked state without a second
        round trip. Two parallel queries, joined in Python by
        attunement_id. The join logic lives here (not the router) so
        the router stays transport-only and so future consumers can
        reuse the same shape.
        """
        catalog = await cls.list_catalog(supabase)
        unlocks = await cls.list_unlocks(supabase, user_id)
        unlocks_by_id = {u.attunement_id: u for u in unlocks}

        entries: list[AttunementCatalogEntry] = []
        for att in catalog:
            unlock = unlocks_by_id.get(att.id)
            entries.append(
                AttunementCatalogEntry(
                    id=att.id,
                    slug=att.slug,
                    name_de=att.name_de,
                    name_en=att.name_en,
                    description_de=att.description_de,
                    description_en=att.description_en,
                    system_hook=att.system_hook,
                    effect=att.effect,
                    required_resonance_type=att.required_resonance_type,
                    enabled=att.enabled,
                    unlocked=unlock is not None,
                    unlocked_at=unlock.unlocked_at if unlock else None,
                    constellation_id=unlock.constellation_id if unlock else None,
                )
            )
        return entries

    # ── Unlock orchestration ───────────────────────────────────────────

    @classmethod
    async def evaluate(
        cls, supabase: Client, resonance_type: str
    ) -> AttunementResponse | None:
        """Return the attunement that unlocks on crystallizing a
        constellation of the given resonance type, or ``None`` if no
        starter attunement matches.

        Deterministic pick: ``.order('seeded_at').limit(1)``. The
        starter set has a 1:1 mapping (emotional/archetype/temporal →
        Hesitation/Mercy/Tremor), but future migrations may add more
        per-type attunements; the oldest seeded wins until an explicit
        priority column justifies a change.
        """
        resp = await (
            supabase.table(cls._CATALOG)
            .select("*")
            .eq("enabled", True)
            .eq("required_resonance_type", resonance_type)
            .order("seeded_at")
            .limit(1)
            .execute()
        )
        rows = extract_list(resp)
        return _attunement_from_row(rows[0]) if rows else None

    @classmethod
    async def unlock(
        cls,
        admin: Client,
        user_id: UUID,
        attunement_id: UUID,
        constellation_id: UUID,
    ) -> bool:
        """Idempotent unlock insert. Returns True on first unlock,
        False when the user already had the attunement.

        Uses ``.upsert(..., ignore_duplicates=True)`` which maps to
        PostgREST's ``resolution=ignore-duplicates`` + PostgreSQL's
        ``ON CONFLICT DO NOTHING``. Only inserted rows appear in the
        representation, so ``len(rows) > 0`` cleanly signals "new".

        Race-safe under concurrent crystallize-of-same-type calls: the
        composite primary key ``(user_id, attunement_id)`` serialises
        the insert, and the loser silently no-ops rather than raising.
        The admin client is required because user_attunements RLS
        authorises INSERT only via ``TO service_role``.
        """
        row = {
            "user_id": str(user_id),
            "attunement_id": str(attunement_id),
            "constellation_id": str(constellation_id),
        }
        resp = await (
            admin.table(cls._UNLOCKS)
            .upsert(row, on_conflict="user_id,attunement_id", ignore_duplicates=True)
            .execute()
        )
        inserted = extract_list(resp)
        newly = len(inserted) > 0
        if newly:
            logger.info(
                "journal_attunement_unlocked",
                extra={
                    "user_id": str(user_id),
                    "attunement_id": str(attunement_id),
                    "constellation_id": str(constellation_id),
                },
            )
        return newly

    # ── Hook consumer API (dungeon / epoch / simulation) ───────────────

    @classmethod
    async def has(cls, supabase: Client, user_id: UUID, slug: str) -> bool:
        """Fast-path: does the user have the attunement identified by
        ``slug``? Used by the game-system hooks (plan §9 P3 P4) to
        decide whether an attunement-gated option is available.

        One query via the PostgREST nested-select on the FK pair. A
        concrete row wins; absence returns False. RLS on
        user_attunements restricts results to the caller's own rows.
        """
        resp = await (
            supabase.table(cls._UNLOCKS)
            .select("attunement_id, journal_attunements!inner(slug)")
            .eq("user_id", str(user_id))
            .eq("journal_attunements.slug", slug)
            .limit(1)
            .execute()
        )
        return bool(extract_list(resp))


__all__ = [
    "AttunementService",
]
