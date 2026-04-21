"""CRUD surface for the ``sentry_rules`` table (P2.3).

Paired with :mod:`backend.services.sentry_rule_cache` — this module owns
writes, the cache module owns reads + rule application. Every mutation
here calls :func:`sentry_rule_cache.reload` so the Sentry ``before_send``
hook picks up the change within the same request (no need to wait for
the 30-second TTL on a single Railway worker — AD-1).

Every mutation also appends to ``ops_audit_log`` via
:func:`OpsLedgerService.log_action` so the Bureau Ops incident drawer
(P2.7) can replay who-did-what. The rule's ``note`` field doubles as
the audit reason: operators already write it as the rationale for the
rule, and requiring a second ``reason`` column would duplicate the
signal without adding value.
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.bureau_ops import SentryRule, SentryRuleUpsertRequest
from backend.services import sentry_rule_cache
from backend.services.ops_ledger_service import OpsLedgerService
from backend.utils.errors import not_found
from backend.utils.responses import extract_list, extract_one
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


def _row_to_rule(row: dict) -> SentryRule:
    return SentryRule.model_validate(row)


class SentryRuleService:
    """CRUD + audit-log operations for ``sentry_rules``."""

    @staticmethod
    async def list_rules(admin_supabase: Client) -> list[SentryRule]:
        """All rows, ordered by created_at ASC (matches the cache order)."""
        resp = await (
            admin_supabase.table("sentry_rules")
            .select("*")
            .order("created_at", desc=False)
            .execute()
        )
        return [_row_to_rule(row) for row in extract_list(resp)]

    @staticmethod
    async def upsert_rule(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        body: SentryRuleUpsertRequest,
        rule_id: UUID | None = None,
    ) -> SentryRule:
        """Create (``rule_id=None``) or update by id.

        Same shape as ``BudgetEnforcementService.upsert_budget`` so the
        admin router can mount POST and PUT against one service method.
        """
        payload = {
            "kind": body.kind,
            "match_exception_type": body.match_exception_type,
            "match_message_regex": body.match_message_regex,
            "match_logger": body.match_logger,
            "fingerprint_template": body.fingerprint_template,
            "downgrade_to": body.downgrade_to,
            "enabled": body.enabled,
            "note": body.note,
            "updated_by_id": str(actor_id),
        }

        if rule_id is not None:
            resp = await (
                admin_supabase.table("sentry_rules")
                .update(payload)
                .eq("id", str(rule_id))
                .execute()
            )
            row = extract_one(resp)
            if row is None:
                raise not_found("Sentry rule", rule_id)
            action = "sentry.rule.update"
        else:
            resp = await (
                admin_supabase.table("sentry_rules")
                .insert(payload)
                .execute()
            )
            row = extract_one(resp)
            if row is None:
                raise RuntimeError("Sentry rule insert returned no rows")
            action = "sentry.rule.create"

        # Refresh the cache so the Sentry before_send hook applies the
        # change on the very next event. A reload failure after a
        # successful write is logged and tolerated: the SentryRuleCacheRefresher
        # scheduler (60s tick) will pick up the change on its next pass, so
        # we never propagate the exception back to the admin UI (the row is
        # already persisted).
        try:
            await sentry_rule_cache.reload(admin_supabase)
        except Exception:  # noqa: BLE001 — cache-refresh must not fail the mutation
            logger.exception("sentry_rule_cache reload failed after upsert")

        await OpsLedgerService.log_action(
            admin_supabase,
            actor_id=actor_id,
            action=action,
            target_scope="sentry",
            target_key=str(row["id"]),
            reason=body.note,
            payload={
                "kind": body.kind,
                "enabled": body.enabled,
                "match_exception_type": body.match_exception_type,
                "match_message_regex": body.match_message_regex,
                "match_logger": body.match_logger,
                "fingerprint_template": body.fingerprint_template,
                "downgrade_to": body.downgrade_to,
            },
        )

        return _row_to_rule(row)

    @staticmethod
    async def delete_rule(
        admin_supabase: Client,
        *,
        actor_id: UUID,
        rule_id: UUID,
        reason: str,
    ) -> None:
        """Delete a rule row by id. Audit entry carries the operator reason."""
        resp = await (
            admin_supabase.table("sentry_rules")
            .delete()
            .eq("id", str(rule_id))
            .execute()
        )
        rows = extract_list(resp)
        if not rows:
            raise not_found("Sentry rule", rule_id)

        try:
            await sentry_rule_cache.reload(admin_supabase)
        except Exception:  # noqa: BLE001 — same tolerance as upsert; scheduler recovers
            logger.exception("sentry_rule_cache reload failed after delete")

        await OpsLedgerService.log_action(
            admin_supabase,
            actor_id=actor_id,
            action="sentry.rule.delete",
            target_scope="sentry",
            target_key=str(rule_id),
            reason=reason,
        )
