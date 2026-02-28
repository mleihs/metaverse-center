"""Audit logging service for tracking entity changes."""

from uuid import UUID

from supabase import Client


class AuditService:
    """Service for recording audit trail entries in the audit_log table."""

    @staticmethod
    async def log_action(
        supabase: Client,
        simulation_id: UUID | None,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID | str | None,
        action: str,
        details: dict | None = None,
    ) -> None:
        """Record an audit log entry.

        Args:
            supabase: Supabase client with user JWT.
            simulation_id: The simulation this action belongs to (None for platform-level).
            user_id: The user who performed the action.
            entity_type: Table/entity name (e.g. "agents", "buildings").
            entity_id: The ID of the affected entity (None for bulk operations).
            action: One of "create", "update", "delete", "restore".
            details: Optional jsonb with old_value/new_value pairs or context.
        """
        entry = {
            "user_id": str(user_id),
            "entity_type": entity_type,
            "action": action,
            "details": details or {},
        }
        if simulation_id is not None:
            entry["simulation_id"] = str(simulation_id)
        if entity_id is not None:
            entry["entity_id"] = str(entity_id)
        supabase.table("audit_log").insert(entry).execute()
