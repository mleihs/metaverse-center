"""Service layer for event echo (bleed) operations.

Cross-simulation, uses admin client for writes — does NOT extend BaseService.
"""

from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from uuid import UUID

from cachetools import TTLCache
from fastapi import HTTPException, status

from backend.services.base_service import serialize_for_json
from backend.services.cache_config import get_ttl
from backend.services.game_mechanics_service import GameMechanicsService
from supabase import Client

logger = logging.getLogger(__name__)

# Bleed vector → resonant tag keywords. Events with tags matching a vector
# increase echo strength for that channel by +20% per matching tag (capped at 3).
VECTOR_TAG_MAP: dict[str, set[str]] = {
    "commerce": {"commerce", "trade", "economy", "market", "merchant", "gold"},
    "language": {"language", "linguistic", "communication", "translation", "dialect"},
    "memory": {"memory", "trauma", "history", "echo", "past", "loss"},
    "resonance": {"resonance", "relationship", "parallel", "mirror", "bond"},
    "architecture": {"architecture", "building", "construction", "structure", "ruin"},
    "dream": {"dream", "vision", "prophecy", "mystical", "spiritual", "sleep"},
    "desire": {"desire", "yearning", "longing", "need", "hunger", "want"},
}


class EchoService:
    """Event echo operations — cross-simulation bleed mechanics."""

    table_name = "event_echoes"

    @classmethod
    async def list_for_simulation(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        direction: str = "incoming",
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List echoes for a simulation (incoming or outgoing)."""
        sim_str = str(simulation_id)
        col = "target_simulation_id" if direction == "incoming" else "source_simulation_id"

        query = (
            supabase.table(cls.table_name)
            .select("*", count="exact")
            .eq(col, sim_str)
            .order("created_at", desc=True)
        )

        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        return response.data or [], total

    @classmethod
    async def list_for_event(
        cls,
        supabase: Client,
        event_id: UUID,
    ) -> list[dict]:
        """List all echoes originating from a specific event."""
        response = (
            supabase.table(cls.table_name)
            .select("*")
            .eq("source_event_id", str(event_id))
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    @classmethod
    async def get(
        cls,
        supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Get a single echo by ID."""
        response = (
            supabase.table(cls.table_name)
            .select("*")
            .eq("id", str(echo_id))
            .single()
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Echo '{echo_id}' not found.",
            )
        return response.data

    # --- Echo strength computation ---

    @staticmethod
    def compute_echo_strength(
        *,
        connection_strength: float,
        embassy_effectiveness: float = 0.0,
        tag_resonance_count: int = 0,
        echo_depth: int = 1,
        strength_decay: float = 0.6,
        source_instability: float = 0.0,
    ) -> float:
        """Compute echo strength from game metrics.

        Formula:
          base = connection_strength
            × (1 + embassy_eff × 0.3)        — embassy boost (up to +30%)
            × (1 + tag_resonance × 0.2)      — vector alignment (+20%/tag, max 3)
            × decay^depth                     — cascade weakening
            × (1 + instability × 0.2)         — unstable zones bleed louder

        Returns a float clamped to [0.0, 1.0].
        """
        base = connection_strength
        base *= 1 + embassy_effectiveness * 0.3
        base *= 1 + min(tag_resonance_count, 3) * 0.2
        base *= strength_decay ** echo_depth
        base *= 1 + source_instability * 0.2
        return max(0.0, min(1.0, base))

    @staticmethod
    def count_tag_resonance(event_tags: list[str], echo_vector: str) -> int:
        """Count how many event tags resonate with a bleed vector."""
        resonant_tags = VECTOR_TAG_MAP.get(echo_vector, set())
        if not resonant_tags or not event_tags:
            return 0
        return sum(1 for tag in event_tags if tag.lower() in resonant_tags)

    # --- Echo candidate evaluation ---

    @classmethod
    async def evaluate_echo_candidates(
        cls,
        supabase: Client,
        event: dict,
        simulation_id: UUID,
    ) -> list[dict]:
        """Determine which simulations this event should echo to.

        Enhanced with game mechanics:
        - Threshold modified by zone stability + embassy effectiveness
        - Probabilistic bleed for events 1-2 below modified threshold
        - Echo strength computed per candidate from connection, embassy, tags
        - Strength decay applied per cascade depth

        Returns list of dicts with: target_simulation_id, connection, depth,
        echo_vector, echo_strength.
        """
        sim_str = str(simulation_id)

        # Check if event qualifies (basic impact check)
        impact = event.get("impact_level") or 0
        if impact < 1:
            return []

        # Get source sim bleed settings
        settings_resp = (
            supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", sim_str)
            .eq("category", "world")
            .in_("setting_key", [
                "bleed_enabled", "bleed_min_impact", "bleed_max_depth",
                "bleed_strength_decay",
            ])
            .execute()
        )
        settings = {s["setting_key"]: s["setting_value"] for s in (settings_resp.data or [])}

        if not settings.get("bleed_enabled", True):
            return []

        base_min_impact = int(settings.get("bleed_min_impact", 8))
        strength_decay = float(settings.get("bleed_strength_decay", 0.6))

        # Campaign events have a slightly higher bar
        if event.get("campaign_id"):
            base_min_impact += 1

        # Check cascade depth for bleed events
        current_depth = 0
        if event.get("data_source") == "bleed":
            refs = event.get("external_refs") or {}
            current_depth = refs.get("echo_depth", 1)
            max_depth = int(settings.get("bleed_max_depth", 2))
            if current_depth >= max_depth:
                return []

        # Early exit: event far below any possible threshold
        if impact < max(5, base_min_impact - 2):
            return []

        # Get active connections from this simulation
        conn_resp = (
            supabase.table("simulation_connections")
            .select("*")
            .eq("is_active", True)
            .or_(
                f"simulation_a_id.eq.{sim_str},simulation_b_id.eq.{sim_str}"
            )
            .execute()
        )
        if not conn_resp.data:
            return []

        # Fetch game metrics for threshold modification + strength calculation
        source_health = await GameMechanicsService.get_simulation_health(
            supabase, simulation_id,
        )
        source_instability = 0.0
        if source_health:
            source_instability = max(0.0, 1.0 - source_health.get("overall_health", 0.5))

        # Embassy effectiveness per target simulation (best per target)
        embassy_data = await GameMechanicsService.list_embassy_effectiveness(
            supabase, simulation_id,
        )
        embassy_map: dict[str, float] = {}
        for emb in embassy_data:
            other_sim = (
                emb.get("simulation_b_id")
                if emb.get("simulation_a_id") == sim_str
                else emb.get("simulation_a_id")
            )
            if other_sim:
                embassy_map[other_sim] = max(
                    embassy_map.get(other_sim, 0.0),
                    float(emb.get("effectiveness", 0.0)),
                )

        event_tags = event.get("tags") or []

        # Build candidate list with per-target threshold + strength
        candidates = []
        for conn in conn_resp.data:
            target_sim = (
                conn["simulation_b_id"]
                if conn["simulation_a_id"] == sim_str
                else conn["simulation_a_id"]
            )
            connection_strength = float(conn.get("strength", 0.5))
            emb_eff = embassy_map.get(target_sim, 0.0)
            conn_vectors = conn.get("bleed_vectors") or []

            # Per-target threshold modification
            modified_threshold = base_min_impact
            if source_instability > 0.7:  # zone stability < 0.3
                modified_threshold -= 1
            if emb_eff > 0.8:
                modified_threshold -= 1
            modified_threshold = max(5, modified_threshold)  # Floor of 5

            # Pick the best-matching vector for this connection
            best_vector = conn_vectors[0] if conn_vectors else "resonance"
            best_resonance = 0
            for vector in conn_vectors:
                r = cls.count_tag_resonance(event_tags, vector)
                if r > best_resonance:
                    best_resonance = r
                    best_vector = vector

            echo_strength = cls.compute_echo_strength(
                connection_strength=connection_strength,
                embassy_effectiveness=emb_eff,
                tag_resonance_count=best_resonance,
                echo_depth=current_depth + 1,
                strength_decay=strength_decay,
                source_instability=source_instability,
            )

            # Deterministic: impact meets modified threshold
            if impact >= modified_threshold:
                candidates.append({
                    "target_simulation_id": target_sim,
                    "connection": conn,
                    "depth": current_depth + 1,
                    "echo_vector": best_vector,
                    "echo_strength": echo_strength,
                })
            # Probabilistic: events 1-2 below threshold may still bleed
            elif impact >= modified_threshold - 2:
                bleed_prob = (
                    0.15
                    * connection_strength
                    * (1 + emb_eff * 0.5)
                    * (1 + source_instability * 0.3)
                )
                if random.random() < bleed_prob:  # noqa: S311
                    candidates.append({
                        "target_simulation_id": target_sim,
                        "connection": conn,
                        "depth": current_depth + 1,
                        "echo_vector": best_vector,
                        "echo_strength": echo_strength * 0.7,  # weaker
                    })

        return candidates

    @classmethod
    async def create_echo(
        cls,
        admin_supabase: Client,
        source_event: dict,
        source_simulation_id: UUID,
        target_simulation_id: UUID,
        echo_vector: str,
        echo_strength: float,
        echo_depth: int,
        root_event_id: UUID | None = None,
    ) -> dict:
        """Create an echo record (uses admin client — bypasses RLS)."""
        source_event_id = source_event["id"]
        root_id = str(root_event_id) if root_event_id else source_event_id

        insert_data = serialize_for_json({
            "source_event_id": source_event_id,
            "source_simulation_id": str(source_simulation_id),
            "target_simulation_id": str(target_simulation_id),
            "echo_vector": echo_vector,
            "echo_strength": echo_strength,
            "echo_depth": echo_depth,
            "root_event_id": root_id,
            "status": "pending",
            "bleed_metadata": {
                "source_title": source_event.get("title"),
                "source_impact": source_event.get("impact_level"),
            },
        })

        response = (
            admin_supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create echo record.",
            )
        return response.data[0]

    @classmethod
    async def update_echo_status(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
        new_status: str,
        *,
        target_event_id: UUID | None = None,
        metadata_update: dict | None = None,
    ) -> dict:
        """Update echo status (uses admin client)."""
        update_data: dict = {
            "status": new_status,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if target_event_id:
            update_data["target_event_id"] = str(target_event_id)
        if metadata_update:
            update_data["bleed_metadata"] = metadata_update

        response = (
            admin_supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(echo_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Echo '{echo_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def approve_echo(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Approve a pending echo — marks as 'generating'."""
        echo = await cls.get(admin_supabase, echo_id)
        if echo["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve echo with status '{echo['status']}'.",
            )
        return await cls.update_echo_status(admin_supabase, echo_id, "generating")

    @classmethod
    async def reject_echo(
        cls,
        admin_supabase: Client,
        echo_id: UUID,
    ) -> dict:
        """Reject a pending echo."""
        echo = await cls.get(admin_supabase, echo_id)
        if echo["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject echo with status '{echo['status']}'.",
            )
        return await cls.update_echo_status(admin_supabase, echo_id, "rejected")

    # --- Echo transformation (AI-powered) ---

    @classmethod
    async def transform_and_complete_echo(
        cls,
        admin_supabase: Client,
        supabase: Client,
        echo: dict,
        gen_service: object,
        *,
        game_context: dict | None = None,
    ) -> dict:
        """Transform a pending/generating echo into a target event using AI.

        Orchestrates the full echo lifecycle:
        1. Mark echo as 'generating'
        2. Fetch source event + target simulation info
        3. AI-transform the source event through the bleed vector lens
        4. Create the target event in the target simulation
        5. Mark echo as 'completed' with target_event_id

        Args:
            admin_supabase: Admin client for cross-simulation writes.
            supabase: User client for reads.
            echo: Echo dict (must include source_event_id, target_simulation_id,
                echo_vector, echo_strength, echo_depth, bleed_metadata).
            gen_service: A ``GenerationService`` instance (typed as ``object``
                to avoid circular import).
            game_context: Optional game metrics for narrative shaping.

        Returns:
            Updated echo dict with status 'completed' and target_event_id set.
        """
        echo_id = UUID(echo["id"])
        target_sim_id = echo["target_simulation_id"]
        source_event_id = echo["source_event_id"]

        # 1. Mark as generating (idempotent if already generating)
        if echo["status"] == "pending":
            await cls.update_echo_status(admin_supabase, echo_id, "generating")

        try:
            # 2. Fetch source event
            source_event_resp = (
                supabase.table("events")
                .select("*")
                .eq("id", source_event_id)
                .single()
                .execute()
            )
            if not source_event_resp.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Source event no longer exists.",
                )
            source_event = source_event_resp.data

            # Fetch target simulation info
            target_sim_resp = (
                supabase.table("simulations")
                .select("name, description")
                .eq("id", target_sim_id)
                .single()
                .execute()
            )
            target_sim = target_sim_resp.data or {}

            # 3. AI transformation through bleed vector
            transformed = await gen_service.generate_echo_transformation(
                source_event=source_event,
                target_simulation_name=target_sim.get("name", ""),
                target_description=target_sim.get("description", ""),
                echo_vector=echo["echo_vector"],
                game_context=game_context,
            )

            # 4. Create target event in target simulation
            source_tags = list(source_event.get("tags") or [])
            echo_vector = echo["echo_vector"]
            if echo_vector not in source_tags:
                source_tags.append(echo_vector)

            # Impact scales with echo strength — weaker echoes are less impactful
            target_impact = max(1, round(
                (source_event.get("impact_level") or 5) * float(echo["echo_strength"])
            ))

            target_event_data = serialize_for_json({
                "simulation_id": target_sim_id,
                "title": transformed.get("title", source_event.get("title", "")),
                "description": transformed.get("description", ""),
                "event_type": source_event.get("event_type", "echo"),
                "data_source": "bleed",
                "impact_level": min(10, target_impact),
                "occurred_at": datetime.now(UTC).isoformat(),
                "tags": source_tags,
                "external_refs": {
                    "echo_id": str(echo_id),
                    "source_event_id": source_event_id,
                    "source_simulation_id": echo["source_simulation_id"],
                    "echo_depth": echo["echo_depth"],
                    "echo_vector": echo_vector,
                    "model_used": transformed.get("model_used"),
                },
            })

            event_resp = (
                admin_supabase.table("events")
                .insert(target_event_data)
                .execute()
            )
            if not event_resp.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create target event from echo.",
                )
            target_event = event_resp.data[0]

            # 5. Mark echo as completed
            metadata = dict(echo.get("bleed_metadata") or {})
            metadata.update({
                "transformed_title": transformed.get("title"),
                "model_used": transformed.get("model_used"),
                "target_impact": target_impact,
            })

            return await cls.update_echo_status(
                admin_supabase, echo_id, "completed",
                target_event_id=UUID(target_event["id"]),
                metadata_update=metadata,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Echo transformation failed for echo %s", echo_id)
            await cls.update_echo_status(
                admin_supabase, echo_id, "failed",
                metadata_update={
                    **(echo.get("bleed_metadata") or {}),
                    "error": type(e).__name__,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Echo transformation failed. Please try again.",
            ) from e

    @classmethod
    async def compute_strength_for_manual_trigger(
        cls,
        supabase: Client,
        source_simulation_id: UUID,
        target_simulation_id: UUID,
        echo_vector: str,
        event_tags: list[str],
        user_strength: float,
    ) -> float:
        """Compute echo strength for a manually triggered echo.

        Combines user-provided strength with game metrics (connection
        strength, embassy effectiveness, tag resonance). The user's
        override is treated as the connection_strength input, allowing
        the other factors to modify it.
        """
        sim_str = str(source_simulation_id)

        # Get source instability
        source_health = await GameMechanicsService.get_simulation_health(
            supabase, source_simulation_id,
        )
        source_instability = 0.0
        if source_health:
            source_instability = max(0.0, 1.0 - source_health.get("overall_health", 0.5))

        # Get embassy effectiveness for this pair
        embassy_data = await GameMechanicsService.list_embassy_effectiveness(
            supabase, source_simulation_id,
        )
        target_str = str(target_simulation_id)
        emb_eff = 0.0
        for emb in embassy_data:
            other = (
                emb.get("simulation_b_id")
                if emb.get("simulation_a_id") == sim_str
                else emb.get("simulation_a_id")
            )
            if other == target_str:
                emb_eff = max(emb_eff, float(emb.get("effectiveness", 0.0)))

        # Get strength decay
        settings_resp = (
            supabase.table("simulation_settings")
            .select("setting_value")
            .eq("simulation_id", sim_str)
            .eq("category", "world")
            .eq("setting_key", "bleed_strength_decay")
            .execute()
        )
        strength_decay = 0.6
        if settings_resp.data:
            strength_decay = float(settings_resp.data[0].get("setting_value", 0.6))

        tag_resonance = cls.count_tag_resonance(event_tags, echo_vector)

        return cls.compute_echo_strength(
            connection_strength=user_strength,
            embassy_effectiveness=emb_eff,
            tag_resonance_count=tag_resonance,
            echo_depth=1,
            strength_decay=strength_decay,
            source_instability=source_instability,
        )


class ConnectionService:
    """Simulation connection operations."""

    table_name = "simulation_connections"

    # In-process TTL cache for get_map_data
    _map_data_cache: TTLCache = TTLCache(maxsize=1, ttl=get_ttl("cache_map_data_ttl"))

    @classmethod
    async def list_all(
        cls,
        supabase: Client,
        *,
        active_only: bool = True,
    ) -> list[dict]:
        """List all simulation connections."""
        query = (
            supabase.table(cls.table_name)
            .select(
                "*, simulation_a:simulations!simulation_a_id(id, name, slug, theme, banner_url, description),"
                " simulation_b:simulations!simulation_b_id(id, name, slug, theme, banner_url, description)"
            )
            .order("created_at", desc=False)
        )
        if active_only:
            query = query.eq("is_active", True)

        response = query.execute()
        return response.data or []

    @classmethod
    async def get_map_data(
        cls,
        supabase: Client,
    ) -> dict:
        """Get aggregated data for the Cartographer's Map.

        Includes game instances (simulation_type, epoch_id, source_template_id)
        and epoch status for live map rendering. Excludes archived instances.
        Results are cached in-process for 15 seconds.
        """
        cached = cls._map_data_cache.get("map_data")
        if cached is not None:
            return cached

        simulations = await cls._fetch_map_simulations(supabase)
        connections = await cls.list_all(supabase, active_only=True)

        from backend.services.embassy_service import EmbassyService
        embassies = await EmbassyService.list_all_active(supabase)

        active_instance_counts = cls._compute_active_instance_counts(simulations)
        operative_flow = await cls._fetch_operative_flow(supabase)

        instance_ids = [s["id"] for s in simulations if s.get("simulation_type") == "game_instance"]
        score_dimensions = await cls._fetch_score_dimensions(supabase, instance_ids)

        template_ids = [s["id"] for s in simulations if s.get("simulation_type") in (None, "template")]
        sparklines = await cls._fetch_sparklines(supabase, template_ids)

        echo_counts = await cls._fetch_echo_counts(supabase)

        result = {
            "simulations": simulations,
            "connections": connections,
            "echo_counts": echo_counts,
            "embassies": embassies,
            "active_instance_counts": active_instance_counts,
            "operative_flow": operative_flow,
            "score_dimensions": score_dimensions,
            "sparklines": sparklines,
        }

        cls._map_data_cache["map_data"] = result
        return result

    @classmethod
    async def _fetch_map_simulations(cls, supabase: Client) -> list[dict]:
        """Fetch simulations with epoch status and dashboard counts."""
        sims_resp = (
            supabase.table("simulations")
            .select(
                "id, name, slug, theme, description, banner_url, status,"
                " simulation_type, source_template_id, epoch_id"
            )
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=False)
            .execute()
        )
        simulations = sims_resp.data or []

        # Enrich with epoch status
        epoch_ids = {s["epoch_id"] for s in simulations if s.get("epoch_id")}
        epoch_status_map: dict[str, str] = {}
        if epoch_ids:
            epoch_resp = (
                supabase.table("game_epochs")
                .select("id, status")
                .in_("id", list(epoch_ids))
                .execute()
            )
            for ep in epoch_resp.data or []:
                epoch_status_map[ep["id"]] = ep["status"]
        for sim in simulations:
            sim["epoch_status"] = epoch_status_map.get(sim.get("epoch_id"), None)

        # Enrich with dashboard counts
        dash_resp = (
            supabase.table("simulation_dashboard")
            .select("simulation_id, agent_count, building_count, event_count")
            .execute()
        )
        counts_map = {d["simulation_id"]: d for d in (dash_resp.data or [])}
        for sim in simulations:
            counts = counts_map.get(sim["id"], {})
            sim["agent_count"] = counts.get("agent_count", 0)
            sim["building_count"] = counts.get("building_count", 0)
            sim["event_count"] = counts.get("event_count", 0)

        return simulations

    @staticmethod
    def _compute_active_instance_counts(simulations: list[dict]) -> dict[str, int]:
        """Count active game instances per template simulation."""
        counts: dict[str, int] = {}
        for sim in simulations:
            if (
                sim.get("simulation_type") == "game_instance"
                and sim.get("source_template_id")
                and sim.get("epoch_status") in ("lobby", "foundation", "competition", "reckoning")
            ):
                tid = sim["source_template_id"]
                counts[tid] = counts.get(tid, 0) + 1
        return counts

    @classmethod
    async def _fetch_echo_counts(cls, supabase: Client) -> dict[str, int]:
        """Fetch incoming completed echo counts per simulation."""
        echo_resp = (
            supabase.table("event_echoes")
            .select("target_simulation_id", count="exact")
            .eq("status", "completed")
            .execute()
        )
        counts: dict[str, int] = {}
        for row in echo_resp.data or []:
            sid = row["target_simulation_id"]
            counts[sid] = counts.get(sid, 0) + 1
        return counts

    @classmethod
    async def _fetch_operative_flow(cls, supabase: Client) -> dict[str, dict]:
        """Fetch active operative flow between simulations."""
        flow: dict[str, dict] = {}
        try:
            op_resp = (
                supabase.table("operative_missions")
                .select("source_simulation_id, target_simulation_id, operative_type")
                .in_("status", ["deployed", "active", "en_route"])
                .execute()
            )
            for op in op_resp.data or []:
                src = op.get("source_simulation_id")
                tgt = op.get("target_simulation_id")
                if src and tgt:
                    key = f"{src}|{tgt}"
                    if key not in flow:
                        flow[key] = {"count": 0, "types": []}
                    flow[key]["count"] += 1
                    op_type = op.get("operative_type")
                    if op_type and op_type not in flow[key]["types"]:
                        flow[key]["types"].append(op_type)
        except Exception:
            logger.debug("Operative flow query skipped (table may be empty)")
        return flow

    @classmethod
    async def _fetch_score_dimensions(cls, supabase: Client, instance_ids: list[str]) -> dict[str, dict]:
        """Fetch latest cycle score dimensions per game-instance simulation."""
        if not instance_ids:
            return {}
        dimensions: dict[str, dict] = {}
        try:
            score_resp = (
                supabase.table("epoch_scores")
                .select(
                    "simulation_id, stability_score, influence_score,"
                    " sovereignty_score, diplomatic_score, military_score,"
                    " cycle_number"
                )
                .in_("simulation_id", instance_ids)
                .order("cycle_number", desc=True)
                .execute()
            )
            seen: set[str] = set()
            for row in score_resp.data or []:
                sid = row["simulation_id"]
                if sid in seen:
                    continue
                seen.add(sid)
                dimensions[sid] = {
                    "stability": row.get("stability_score", 0),
                    "influence": row.get("influence_score", 0),
                    "sovereignty": row.get("sovereignty_score", 0),
                    "diplomatic": row.get("diplomatic_score", 0),
                    "military": row.get("military_score", 0),
                }
        except Exception:
            logger.debug("Score dimensions query skipped")
        return dimensions

    @classmethod
    async def _fetch_sparklines(cls, supabase: Client, template_ids: list[str]) -> dict[str, list[float]]:
        """Fetch last 10 composite scores per template (sparkline data)."""
        if not template_ids:
            return {}
        sparklines: dict[str, list[float]] = {}
        try:
            spark_resp = (
                supabase.table("epoch_scores")
                .select(
                    "simulation_id, composite_score, cycle_number,"
                    " simulations!inner(source_template_id)"
                )
                .order("cycle_number", desc=True)
                .limit(200)
                .execute()
            )
            template_scores: dict[str, list[float]] = {}
            for row in spark_resp.data or []:
                sim_data = row.get("simulations")
                if not sim_data:
                    continue
                tmpl_id = sim_data.get("source_template_id")
                if tmpl_id and tmpl_id in template_ids:
                    if tmpl_id not in template_scores:
                        template_scores[tmpl_id] = []
                    if len(template_scores[tmpl_id]) < 10:
                        template_scores[tmpl_id].append(float(row.get("composite_score", 0)))
            for tid, scores_list in template_scores.items():
                sparklines[tid] = list(reversed(scores_list))
        except Exception:
            logger.debug("Sparkline data query skipped")
        return sparklines

    @classmethod
    async def create_connection(
        cls,
        admin_supabase: Client,
        data: dict,
    ) -> dict:
        """Create a simulation connection (admin only)."""
        response = (
            admin_supabase.table(cls.table_name)
            .insert(serialize_for_json(data))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create connection.",
            )
        return response.data[0]

    @classmethod
    async def update_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
        data: dict,
    ) -> dict:
        """Update a simulation connection (admin only)."""
        update_data = {**serialize_for_json(data), "updated_at": datetime.now(UTC).isoformat()}
        response = (
            admin_supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
        return response.data[0]

    @classmethod
    async def delete_connection(
        cls,
        admin_supabase: Client,
        connection_id: UUID,
    ) -> dict:
        """Delete a simulation connection (admin only)."""
        response = (
            admin_supabase.table(cls.table_name)
            .delete()
            .eq("id", str(connection_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connection '{connection_id}' not found.",
            )
        return response.data[0]
