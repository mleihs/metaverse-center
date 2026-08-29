"""Service layer for prompt template operations."""

from __future__ import annotations

import logging
from uuid import UUID

from backend.services.prompt_contracts import audit_template, get_contract
from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class PromptTemplateService:
    """Prompt template CRUD with platform-default merging.

    Uses ``is_active`` for soft-delete (not ``deleted_at``), so BaseService
    is not a good fit here.
    """

    table_name = "prompt_templates"

    @staticmethod
    def _validate_against_contract(template_type: str | None, data: dict) -> None:
        """Reject a hand-written template that names variables no code supplies.

        The AI write path (Forge phase A.6) *repairs* its output instead — there
        is nobody to tell. Here there is: an admin typing ``{agent_title}`` into
        the editor gets the list of placeholders the renderer would drop, and the
        list of names it does fill, rather than a template that quietly ships an
        invented number to an image model.

        Types the code never renders (``embassy_pair_generation``, the scanner
        prompts) have no contract and are left alone — no declaration, no
        authority to judge.
        """
        contract = get_contract(template_type or "")
        if contract is None:
            return

        offenders: dict[str, list[str]] = {}
        for field_name in ("prompt_content", "system_prompt"):
            text = data.get(field_name)
            if not text:
                continue
            audit = audit_template(str(text), contract)
            problems = sorted(audit.unknown | audit.mustache)
            if problems:
                offenders[field_name] = problems

        if not offenders:
            return

        detail = "; ".join(f"{field}: {', '.join(names)}" for field, names in sorted(offenders.items()))
        allowed = ", ".join(sorted(contract.variables))
        raise bad_request(
            f"Template '{template_type}' uses placeholders no code supplies ({detail}). "
            f"Write them as {{name}}, not {{{{name}}}}, and use only: {allowed}."
        )

    @classmethod
    async def list_templates(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        locale: str | None = None,
        prompt_category: str | None = None,
        include_platform: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List templates for a simulation, optionally merged with platform defaults."""
        query = (
            supabase.table(cls.table_name)
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .eq("is_active", True)
            .order("template_type")
        )
        if locale:
            query = query.eq("locale", locale)
        if prompt_category:
            query = query.eq("prompt_category", prompt_category)

        query = query.range(offset, offset + limit - 1)
        sim_response = await query.execute()

        templates = extract_list(sim_response)
        total = sim_response.count or len(templates)

        if include_platform:
            platform_query = (
                supabase.table(cls.table_name)
                .select("*")
                .is_("simulation_id", "null")
                .eq("is_active", True)
                .order("template_type")
            )
            if locale:
                platform_query = platform_query.eq("locale", locale)
            if prompt_category:
                platform_query = platform_query.eq("prompt_category", prompt_category)

            platform_response = await platform_query.execute()
            platform_templates = extract_list(platform_response)

            # Only include platform templates not overridden by simulation
            sim_types = {(t["template_type"], t["locale"]) for t in templates}
            for pt in platform_templates:
                if (pt["template_type"], pt["locale"]) not in sim_types:
                    templates.append(pt)
                    total += 1

        return templates, total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        template_id: UUID,
    ) -> dict:
        """Get a single prompt template by ID."""
        response = await supabase.table(cls.table_name).select("*").eq("id", str(template_id)).limit(1).execute()
        if not response or not response.data:
            raise not_found(detail=f"Template '{template_id}' not found.")
        return response.data[0]

    @classmethod
    async def create(
        cls,
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Create a new prompt template for a simulation."""
        cls._validate_against_contract(data.get("template_type"), data)

        insert_data = {
            **data,
            "simulation_id": str(simulation_id),
            "created_by_id": str(user_id),
        }

        response = await supabase.table(cls.table_name).insert(insert_data).execute()

        if not response.data:
            raise server_error("Failed to create prompt template.")
        return response.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        simulation_id: UUID,
        template_id: UUID,
        data: dict,
    ) -> dict:
        """Update a prompt template."""
        if not data:
            raise bad_request("No fields to update.")

        # An update may change only the text, so the type comes from the stored
        # row unless the caller is changing it.
        template_type = data.get("template_type")
        if template_type is None:
            existing = await cls.get(supabase, template_id)
            template_type = existing.get("template_type")
        cls._validate_against_contract(template_type, data)

        response = await (
            supabase.table(cls.table_name)
            .update(data)
            .eq("id", str(template_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise not_found(detail=f"Template '{template_id}' not found in simulation.")
        return response.data[0]

    @classmethod
    async def deactivate(
        cls,
        supabase: Client,
        simulation_id: UUID,
        template_id: UUID,
    ) -> dict:
        """Soft-delete a prompt template by setting is_active=False."""
        response = await (
            supabase.table(cls.table_name)
            .update({"is_active": False})
            .eq("id", str(template_id))
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        if not response.data:
            raise not_found(detail=f"Template '{template_id}' not found.")
        return response.data[0]
