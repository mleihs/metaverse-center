"""Simulation Heartbeat — periodic tick system that gives simulations a metabolism.

Runs as an asyncio background task (same pattern as ResonanceScheduler).
Each tick processes: zone action expiry, event aging, resonance pressure,
narrative arc detection, bureau response resolution, attunement deepening,
anchor strengthening, scar tissue drift, MV refresh, and chronicle entries.

Critical constraints:
- No AI calls in the tick loop (pure DB ops + template strings).
- Idempotent: checks last_heartbeat_tick before proceeding.
- Parallel with concurrency limit (max 3 simultaneous simulations).
- All active simulations tick, even quiet ones.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import sentry_sdk
import structlog
from fastapi import HTTPException
from fastapi import status as http_status

from backend.dependencies import get_admin_supabase
from backend.services.agent_activity_service import AgentActivityService
from backend.services.agent_mood_service import AgentMoodService
from backend.services.agent_needs_service import AgentNeedsService
from backend.services.agent_opinion_service import AgentOpinionService
from backend.services.anchor_service import AnchorService
from backend.services.attunement_service import AttunementService
from backend.services.autonomous_event_service import AutonomousEventService
from backend.services.bureau_response_service import BureauResponseService
from backend.services.game_mechanics_service import GameMechanicsService
from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from backend.services.narrative_arc_service import NarrativeArcService
from backend.services.platform_config_service import PlatformConfigService
from backend.utils.encryption import decrypt
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_ENABLED = True
_DEFAULT_INTERVAL = 14400  # 4 hours (was 8h, reduced for engagement)
_DEFAULT_EVENT_AGING_RULES = {
    "active_to_escalating": 4,
    "escalating_to_resolving": 6,
    "resolving_to_resolved": 3,
    "resolved_to_archived": 8,
}
_MAX_CONCURRENT_TICKS = 3
_SYSTEM_ACTOR = UUID("00000000-0000-0000-0000-000000000000")


class HeartbeatService:
    """Periodic background task that drives simulation heartbeats."""

    _task: asyncio.Task | None = None

    # ── Lifecycle ───────────────────────────────────────────────

    @classmethod
    async def start(cls) -> asyncio.Task:
        """Launch the heartbeat loop. Called from app lifespan."""
        cls._task = asyncio.create_task(cls._run_loop())
        logger.info("Heartbeat service started")
        return cls._task

    @classmethod
    async def _run_loop(cls) -> None:
        """Infinite loop: sleep → find due simulations → tick each."""
        while True:
            interval = _DEFAULT_INTERVAL
            try:
                admin = await get_admin_supabase()
                enabled, interval = await cls._load_config(admin)
                if enabled:
                    await cls._tick_due_simulations(admin, interval)
            except asyncio.CancelledError:
                logger.info("Heartbeat service shutting down")
                raise
            except Exception as exc:
                if type(exc).__name__ in ("ConnectError", "ConnectTimeout"):
                    logger.warning(
                        "Heartbeat service: database unavailable, retrying in %ds",
                        interval,
                    )
                else:
                    logger.exception("Heartbeat service loop error")
            # Check every 60s for due simulations (not the full interval)
            await asyncio.sleep(min(60, interval))

    # ── Configuration ───────────────────────────────────────────

    @classmethod
    async def _load_config(cls, admin: Client) -> tuple[bool, int]:
        """Read heartbeat config from platform_settings."""
        enabled = _DEFAULT_ENABLED
        interval = _DEFAULT_INTERVAL
        try:
            _resp = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "heartbeat_enabled",
                    "heartbeat_interval_seconds",
                ])
                .execute()
            )
            rows = _resp.data or []
            for row in rows:
                key = row["setting_key"]
                val = row["setting_value"]
                if key == "heartbeat_enabled":
                    enabled = str(val).strip('"').lower() not in ("false", "0", "no")
                elif key == "heartbeat_interval_seconds":
                    try:
                        interval = max(7200, int(val))
                    except (ValueError, TypeError):
                        pass
        except Exception:
            logger.warning("Failed to load heartbeat config, using defaults")
        return enabled, interval

    @classmethod
    async def _load_full_config(cls, admin: Client) -> dict:
        """Load all heartbeat-related platform settings via PlatformConfigService."""
        defaults: dict = {
            "enabled": _DEFAULT_ENABLED,
            "interval_seconds": _DEFAULT_INTERVAL,
            "scar_decay_rate": 0.02,
            "attunement_growth_rate": 0.05,
            "anchor_growth_per_sim": 0.03,
            "escalation_threshold": 3,
            "cascade_pressure_trigger": 0.60,
            "event_aging_rules": _DEFAULT_EVENT_AGING_RULES.copy(),
            "bureau_contain_multiplier": 0.30,
            "bureau_remediate_multiplier": 0.60,
            "bureau_adapt_multiplier": 0.50,
            "bureau_max_agents": 5,
            "positive_event_probability": 0.20,
            "max_attunements": 2,
            "switching_cooldown_ticks": 3,
            "anchor_protection_cap": 0.70,
            "scar_growth_rate": 0.05,
            "scar_susceptibility_multiplier": 0.50,
            "attunement_passive_growth_rate": 0.01,
            "bureau_adapt_scar_reduction": 0.20,
            "zone_stability_event_pressure_weight": 0.40,
            "health_baseline_floor": 0.10,
            "resonance_warning_ticks": 2,
        }
        return await PlatformConfigService.get_multiple(
            admin, defaults, prefix="heartbeat_",
        )

    @classmethod
    async def _load_sim_overrides(cls, admin: Client, sim_id: UUID) -> dict:
        """Load per-simulation heartbeat overrides from simulation_settings."""
        overrides: dict = {}
        try:
            _resp = await (
                admin.table("simulation_settings")
                .select("setting_key, setting_value")
                .eq("simulation_id", str(sim_id))
                .eq("category", "heartbeat")
                .execute()
            )
            rows = _resp.data or []
            for row in rows:
                overrides[row["setting_key"]] = row["setting_value"]
        except Exception:
            logger.warning(
                "Failed to load sim heartbeat overrides for %s", sim_id,
                extra={"simulation_id": str(sim_id)},
            )
        return overrides

    # ── Orchestration ───────────────────────────────────────────

    @classmethod
    async def _tick_due_simulations(cls, admin: Client, interval: int) -> None:
        """Find and tick all simulations whose next_heartbeat_at has passed."""
        now = datetime.now(UTC)

        # Find active template simulations due for a tick
        response = await (
            admin.table("simulations")
            .select("id, name, slug, last_heartbeat_tick, next_heartbeat_at")
            .eq("status", "active")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .execute()
        )
        all_sims = response.data or []

        # Filter to those that are due
        due_sims = []
        for sim in all_sims:
            next_at = sim.get("next_heartbeat_at")
            if next_at is None:
                # Never ticked — initialize and mark as due
                due_sims.append(sim)
            else:
                try:
                    next_dt = datetime.fromisoformat(next_at.replace("Z", "+00:00"))
                    if next_dt <= now:
                        due_sims.append(sim)
                except (ValueError, TypeError):
                    due_sims.append(sim)

        if not due_sims:
            return

        logger.info(
            "Heartbeat: %d simulation(s) due for tick",
            len(due_sims),
            extra={"due_count": len(due_sims)},
        )

        # Tick with concurrency limit
        semaphore = asyncio.Semaphore(_MAX_CONCURRENT_TICKS)

        async def _tick_with_limit(sim: dict) -> None:
            async with semaphore:
                await cls._tick_simulation(admin, sim, interval)

        await asyncio.gather(
            *[_tick_with_limit(sim) for sim in due_sims],
            return_exceptions=True,
        )

    # ── Core Tick Pipeline ──────────────────────────────────────

    @classmethod
    async def _tick_simulation(
        cls, admin: Client, sim: dict, interval: int,
    ) -> None:
        """Execute the full tick pipeline for one simulation."""
        sim_id = UUID(sim["id"])
        tick_number = (sim.get("last_heartbeat_tick") or 0) + 1
        sim_name = sim.get("name", "Unknown")
        config = await cls._load_full_config(admin)
        overrides = await cls._load_sim_overrides(admin, sim_id)

        # Check per-sim enable
        if str(overrides.get("enabled", "true")).lower() in ("false", "0"):
            logger.debug(
                "Heartbeat: sim %s disabled, skipping", sim_name,
                extra={"simulation_id": str(sim_id)},
            )
            return

        # Create heartbeat record (idempotent via UNIQUE(simulation_id, tick_number))
        heartbeat_id = uuid4()
        try:
            await admin.table("simulation_heartbeats").insert({
                "id": str(heartbeat_id),
                "simulation_id": str(sim_id),
                "tick_number": tick_number,
                "status": "processing",
            }).execute()
        except Exception:
            # UNIQUE constraint violation → tick already processed (concurrent tick or retry)
            logger.warning(
                "Heartbeat: tick %d already exists for %s, skipping",
                tick_number, sim_name,
                extra={"simulation_id": str(sim_id), "tick_number": tick_number},
            )
            return

        logger.info(
            "Heartbeat: ticking %s (tick #%d)",
            sim_name, tick_number,
            extra={"simulation_id": str(sim_id), "tick_number": tick_number},
        )

        # Check for active epoch (for tagging entries with epoch context)
        active_epoch_id: str | None = None
        try:
            epoch_resp = await (
                admin.table("epoch_participants")
                .select("epoch_id, game_epochs!inner(status)")
                .eq("simulation_id", str(sim_id))
                .in_("game_epochs.status", ["foundation", "competition", "reckoning"])
                .limit(1)
                .execute()
            )
            if epoch_resp.data:
                active_epoch_id = epoch_resp.data[0]["epoch_id"]
        except Exception:
            logger.debug("Epoch lookup unavailable for heartbeat tagging")

        entries: list[dict] = []
        tick_stats = {
            "events_aged": 0,
            "events_escalated": 0,
            "events_resolved": 0,
            "zone_actions_expired": 0,
            "scar_tissue_delta": 0.0,
            "resonance_pressure_delta": 0.0,
            "bureau_responses_resolved": 0,
            "cascade_events_spawned": 0,
            "convergence_detected": False,
        }

        try:
            # Phase 1: Expire zone actions
            expired = await cls._phase_expire_zone_actions(admin, sim_id)
            tick_stats["zone_actions_expired"] = expired
            if expired > 0:
                entries.append(make_heartbeat_entry(
                    heartbeat_id, sim_id, tick_number, "zone_shift",
                    f"{expired} zone action(s) expired.",
                    f"{expired} Zonenaktion(en) abgelaufen.",
                    severity="info",
                    metadata={"expired_count": expired},
                ))

            # Phase 2: Age events
            aging_rules = overrides.get("event_aging_rules", config["event_aging_rules"])
            if isinstance(aging_rules, str):
                aging_rules = json.loads(aging_rules)
            aged, escalated, resolved, aging_entries = await cls._phase_age_events(
                admin, sim_id, tick_number, heartbeat_id, aging_rules,
            )
            tick_stats["events_aged"] = aged
            tick_stats["events_escalated"] = escalated
            tick_stats["events_resolved"] = resolved
            entries.extend(aging_entries)

            # Phase 3: Compute resonance pressure
            pressure_delta, pressure_entries = await cls._phase_compute_pressure(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            tick_stats["resonance_pressure_delta"] = pressure_delta
            entries.extend(pressure_entries)

            # Phase 4: Detect narrative arcs (escalation, cascade, convergence)
            arc_entries, cascade_spawned, convergence = await NarrativeArcService.detect_and_advance(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            tick_stats["cascade_events_spawned"] = cascade_spawned
            tick_stats["convergence_detected"] = convergence
            entries.extend(arc_entries)

            # Phase 5: Resolve bureau responses
            resolved_count, bureau_entries = await BureauResponseService.resolve_at_tick(
                admin, sim_id, tick_number, heartbeat_id, config=config,
            )
            tick_stats["bureau_responses_resolved"] = resolved_count
            entries.extend(bureau_entries)

            # Phase 6: Deepen attunements
            attunement_entries = await AttunementService.deepen_at_tick(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            entries.extend(attunement_entries)

            # Phase 7: Strengthen anchors
            anchor_entries = await AnchorService.strengthen_at_tick(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            entries.extend(anchor_entries)

            # Phase 8: Drift scar tissue
            scar_delta, scar_entries = await cls._phase_drift_scar_tissue(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            tick_stats["scar_tissue_delta"] = scar_delta
            entries.extend(scar_entries)

            # Phase 9: Agent Autonomy — 3-tier gating:
            #   1. Global: platform_settings.autonomy_feature_enabled
            #   2. Per-sim: simulation_settings.agent_autonomy_enabled
            #   3. Key: admin override (platform key) OR owner BYOK key
            autonomy_sim_enabled = str(
                overrides.get("agent_autonomy_enabled", "false")
            ).lower() in ("true", "1")
            autonomy_global = str(
                config.get("autonomy_feature_enabled", "true")
            ).lower() in ("true", "1")
            autonomy_admin_override = str(
                overrides.get("autonomy_admin_override", "false")
            ).lower() in ("true", "1")
            autonomy_stats: dict = {}

            if autonomy_sim_enabled and autonomy_global:
                try:
                    structlog.contextvars.bind_contextvars(autonomy_phase="active")

                    # Gate 3: Resolve API key for LLM calls
                    byok_key, owner_has_key = await cls._resolve_autonomy_key(
                        admin, sim_id, autonomy_admin_override,
                    )

                    # 9a: Decay agent needs
                    rate_mult = float(overrides.get("autonomy_needs_decay_rate", 1.0))
                    needs_updated = await AgentNeedsService.decay_all(admin, sim_id, rate_mult)

                    # 9b: Mood housekeeping (expire moodlets, decay strengths, recalculate)
                    mood_summary = await AgentMoodService.process_tick(admin, sim_id)

                    # 9c: Opinion recalculation + relationship threshold checks
                    opinion_summary = await AgentOpinionService.process_tick(admin, sim_id)

                    autonomy_stats = {
                        "needs_decayed": needs_updated,
                        "mood": mood_summary,
                        "opinions": opinion_summary,
                    }

                    # Generate entries for breakdowns
                    breakdowns = mood_summary.get("breakdowns", [])
                    for agent_id in breakdowns:
                        entries.append(make_heartbeat_entry(
                            heartbeat_id, sim_id, tick_number, "agent_crisis",
                            f"Agent {agent_id[:8]}... is experiencing a stress breakdown.",
                            f"Agent {agent_id[:8]}... erlebt einen Stresszusammenbruch.",
                            severity="critical",
                            metadata={"agent_id": agent_id, "type": "stress_breakdown"},
                        ))

                    # Generate entries for relationship threshold events
                    for rel_event in opinion_summary.get("relationship_events", []):
                        evt_type = rel_event["type"]
                        sev = "warning" if "breakdown" in evt_type else "info"
                        a_id = rel_event["agent_id"][:8]
                        t_id = rel_event["target_agent_id"][:8]
                        entries.append(make_heartbeat_entry(
                            heartbeat_id, sim_id, tick_number,
                            "relationship_shift",
                            f"Relationship {evt_type}: {a_id}... / {t_id}...",
                            f"Beziehung ({evt_type}): {a_id}... / {t_id}...",
                            severity=sev, metadata=rel_event,
                        ))

                    # 9d: Activity selection + execution (Utility AI + Boltzmann)
                    activity_results = await AgentActivityService.select_and_execute(
                        admin, sim_id, tick_id=heartbeat_id,
                    )
                    autonomy_stats["activities"] = len(activity_results)

                    # 9e: Social interactions (co-located agents)
                    interaction_rate = float(
                        overrides.get("autonomy_social_interaction_rate", 1.0)
                    )
                    social_results = (
                        await AgentActivityService.generate_social_interactions(
                            admin, sim_id, interaction_rate, tick_id=heartbeat_id,
                        )
                    )
                    autonomy_stats["social_interactions"] = len(social_results)

                    # Generate entries for significant social interactions
                    for si in social_results:
                        if si.get("significance", 0) >= 5:
                            entries.append(make_heartbeat_entry(
                                heartbeat_id, sim_id, tick_number,
                                "social_event",
                                f"Social interaction: {si['type']}",
                                f"Soziale Interaktion: {si['type']}",
                                severity="info",
                                metadata=si,
                            ))

                    # 9f: Autonomous event generation (Tier 3 LLM)
                    # Requires BYOK key — rule-based phases above run without it
                    auto_events: list[dict] = []
                    if owner_has_key:
                        llm_budget = int(
                            overrides.get("autonomy_llm_budget_per_tick", 5)
                        )
                        tick_ctx = {
                            "breakdowns": mood_summary.get("breakdowns", []),
                            "relationship_events": opinion_summary.get(
                                "relationship_events", [],
                            ),
                            "social_interactions": [
                                s for s in social_results
                                if s.get("can_trigger_event")
                            ],
                        }
                        auto_events = (
                            await AutonomousEventService.check_and_generate(
                                admin, sim_id, tick_ctx,
                                llm_budget=llm_budget,
                                openrouter_api_key=byok_key,
                            )
                        )
                    autonomy_stats["autonomous_events"] = len(auto_events)
                    autonomy_stats["byok_available"] = owner_has_key

                    for ae in auto_events:
                        entries.append(make_heartbeat_entry(
                            heartbeat_id, sim_id, tick_number,
                            "autonomous_event",
                            ae.get("title", "Autonomous event"),
                            ae.get("title_de", "Autonomes Ereignis"),
                            severity="warning"
                            if ae.get("impact_level", 0) >= 4
                            else "info",
                            metadata={
                                "event_id": ae.get("id"),
                                "trigger": ae.get("metadata", {}).get(
                                    "trigger",
                                ),
                            },
                        ))

                except Exception:
                    logger.exception("Agent autonomy phase failed")
                    sentry_sdk.capture_exception()

            tick_stats["autonomy"] = autonomy_stats

            # Phase 10: Refresh materialized views
            await GameMechanicsService.refresh_metrics(admin)

            # Phase 11: Produce chronicle entries (peacetime content if quiet)
            if not entries:
                entries.extend(await cls._generate_peacetime_entries(
                    admin, sim_id, tick_number, heartbeat_id,
                ))

            # Tag entries with epoch context if active
            if active_epoch_id:
                for entry in entries:
                    meta = entry.get("metadata") or {}
                    meta["epoch_id"] = active_epoch_id
                    entry["metadata"] = meta

            # Batch insert entries
            await admin.table("heartbeat_entries").insert(entries).execute()

            # Build dispatch summary
            dispatch_en = cls._build_dispatch(entries, tick_number, "en")
            dispatch_de = cls._build_dispatch(entries, tick_number, "de")

            # Phase 12: Finalize
            effective_interval = int(overrides.get("interval_override_seconds", interval))
            next_at = datetime.now(UTC) + timedelta(seconds=effective_interval)

            # Move non-column keys into the summary JSONB field
            summary_data = {
                "phases_completed": 12,
                "entry_count": len(entries),
                "autonomy": tick_stats.pop("autonomy", {}),
            }
            await admin.table("simulation_heartbeats").update({
                "status": "completed",
                "dispatch_en": dispatch_en,
                "dispatch_de": dispatch_de,
                "summary": summary_data,
                **tick_stats,
            }).eq("id", str(heartbeat_id)).execute()

            await admin.table("simulations").update({
                "last_heartbeat_tick": tick_number,
                "last_heartbeat_at": datetime.now(UTC).isoformat(),
                "next_heartbeat_at": next_at.isoformat(),
            }).eq("id", str(sim_id)).execute()

            logger.info(
                "Heartbeat: tick #%d completed for %s — %d entries",
                tick_number, sim_name, len(entries),
                extra={
                    "simulation_id": str(sim_id),
                    "tick_number": tick_number,
                    "entry_count": len(entries),
                    "stats": tick_stats,
                },
            )

        except Exception:
            logger.exception(
                "Heartbeat: tick #%d failed for %s",
                tick_number, sim_name,
                extra={"simulation_id": str(sim_id), "tick_number": tick_number},
            )
            await admin.table("simulation_heartbeats").update({
                "status": "failed",
                "summary": {"error": "See server logs"},
            }).eq("id", str(heartbeat_id)).execute()

            # Still advance next_heartbeat_at to prevent retry storms
            next_at = datetime.now(UTC) + timedelta(seconds=interval)
            await admin.table("simulations").update({
                "next_heartbeat_at": next_at.isoformat(),
            }).eq("id", str(sim_id)).execute()

    # ── Autonomy Key Resolution ─────────────────────────────────

    @classmethod
    async def _resolve_autonomy_key(
        cls, admin: Client, sim_id: UUID, admin_override: bool,
    ) -> tuple[str | None, bool]:
        """Resolve the API key for autonomy LLM calls.

        Returns (api_key, has_key):
        - Admin override active → (None, True) — platform key handles cost
        - Owner has BYOK key → (decrypted_key, True)
        - No key available → (None, False) — LLM phases skipped
        """
        if admin_override:
            return None, True

        try:
            owner_resp = await (
                admin.table("simulation_members")
                .select("user_id")
                .eq("simulation_id", str(sim_id))
                .eq("role", "owner")
                .limit(1)
                .execute()
            )
            if not owner_resp.data:
                return None, False

            wallet_resp = await (
                admin.table("user_wallets")
                .select("encrypted_openrouter_key")
                .eq("user_id", owner_resp.data[0]["user_id"])
                .maybe_single()
                .execute()
            )
            enc_key = (wallet_resp.data or {}).get("encrypted_openrouter_key")
            if enc_key:
                return decrypt(enc_key), True
        except Exception:
            logger.debug("BYOK key resolution failed for autonomy")

        return None, False

    # ── Phase 1: Expire Zone Actions ───────────────────────────

    @classmethod
    async def _phase_expire_zone_actions(cls, admin: Client, sim_id: UUID) -> int:
        """Soft-delete zone actions past their expires_at."""
        now = datetime.now(UTC).isoformat()
        response = await (
            admin.table("zone_actions")
            .update({"deleted_at": now})
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .lte("expires_at", now)
            .execute()
        )
        expired = len(response.data) if response.data else 0
        if expired > 0:
            logger.debug(
                "Heartbeat phase 1: expired %d zone actions for sim %s",
                expired, sim_id,
                extra={"simulation_id": str(sim_id), "expired": expired},
            )
        return expired

    # ── Phase 2: Age Events ────────────────────────────────────

    @classmethod
    async def _phase_age_events(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        aging_rules: dict,
    ) -> tuple[int, int, int, list[dict]]:
        """Increment ticks_in_status, auto-transition event statuses via batch RPC."""
        entries: list[dict] = []
        aged = 0
        escalated = 0
        resolved = 0

        # Single RPC call replaces O(N) individual UPDATEs
        result = await admin.rpc("fn_age_events_batch", {
            "p_sim_id": str(sim_id),
            "p_active_to_escalating": aging_rules.get("active_to_escalating", 4),
            "p_escalating_to_resolving": aging_rules.get("escalating_to_resolving", 6),
            "p_resolving_to_resolved": aging_rules.get("resolving_to_resolved", 3),
            "p_resolved_to_archived": aging_rules.get("resolved_to_archived", 8),
        }).execute()

        changes = result.data or []
        if isinstance(changes, str):
            changes = json.loads(changes)

        for change in changes:
            event_id = change["event_id"]
            title = change.get("title") or "Unknown event"
            old_status = change["old_status"]
            new_status = change["new_status"]
            transitioned = change.get("transitioned", False)
            remaining = change.get("remaining", 0)
            ticks = change.get("ticks_in_status", 0)

            aged += 1

            if transitioned:
                if new_status == "escalating":
                    escalated += 1
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "event_escalation",
                        f"'{title}' escalated. Zone pressure increasing.",
                        f"'{title}' eskaliert. Zonendruck steigt.",
                        severity="warning",
                        metadata={"event_id": event_id, "old_status": old_status,
                                  "new_status": new_status},
                    ))
                elif new_status in ("resolving", "resolved"):
                    resolved += 1
                    entry_type = "event_resolution" if new_status == "resolved" else "event_aging"
                    pressure_msg = "removed" if new_status == "resolved" else "decaying"
                    druck_msg = "entfernt" if new_status == "resolved" else "abklingend"
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, entry_type,
                        f"'{title}' transitioned to {new_status}. Pressure contribution {pressure_msg}.",
                        f"'{title}' wechselte zu {new_status}. Druckbeitrag {druck_msg}.",
                        severity="positive" if new_status == "resolved" else "info",
                        metadata={"event_id": event_id, "old_status": old_status,
                                  "new_status": new_status},
                    ))
                elif new_status == "archived":
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "event_aging",
                        f"'{title}' archived. No longer contributing to substrate pressure.",
                        f"'{title}' archiviert. Traegt nicht mehr zum Substratdruck bei.",
                        severity="info",
                        metadata={"event_id": event_id, "old_status": old_status,
                                  "new_status": new_status},
                    ))
            else:
                # Approaching threshold warning
                auto_en = "escalating" if old_status == "active" else "resolving"
                auto_de = "Eskalation" if old_status == "active" else "Loesung"
                entries.append(make_heartbeat_entry(
                    heartbeat_id, sim_id, tick_number, "event_aging",
                    f"'{title}' has been {old_status} for {ticks} ticks. "
                    f"Auto-{auto_en} in {remaining} more tick(s).",
                    f"'{title}' ist seit {ticks} Ticks {old_status}. "
                    f"Automatische {auto_de} in {remaining} weiteren Tick(s).",
                    severity="warning" if old_status == "active" else "info",
                    metadata={"event_id": event_id, "ticks_in_status": ticks,
                              "remaining": remaining},
                ))

        return aged, escalated, resolved, entries

    # ── Phase 3: Compute Resonance Pressure ────────────────────

    @classmethod
    async def _phase_compute_pressure(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict | None = None,
    ) -> tuple[float, list[dict]]:
        """Accumulate pressure from active/escalating events via batch RPC."""
        entries: list[dict] = []

        # Single RPC call computes and updates all event pressures
        result = await admin.rpc("fn_compute_event_pressure_batch", {
            "p_sim_id": str(sim_id),
        }).execute()

        data = result.data or {}
        if isinstance(data, str):
            data = json.loads(data)

        total_pressure = float(data.get("total_pressure", 0))
        event_count = int(data.get("event_count", 0))

        # Scar tissue amplifies total pressure (accumulated damage = higher susceptibility)
        scar_susceptibility = (config or {}).get("scar_susceptibility_multiplier", 0.50)
        if scar_susceptibility > 0:
            try:
                _resp = await (
                    admin.table("narrative_arcs")
                    .select("scar_tissue_deposited")
                    .eq("simulation_id", str(sim_id))
                    .gt("scar_tissue_deposited", 0)
                    .execute()
                )
                scar_arcs = _resp.data or []
                scar_total = sum(float(a.get("scar_tissue_deposited", 0)) for a in scar_arcs)
                if scar_total > 0:
                    scar_mult = round(scar_total * scar_susceptibility, 4)
                    total_pressure = round(total_pressure * (1 + scar_mult), 4)
            except Exception:
                logger.debug("Failed to load scar tissue for pressure computation")

        # Produce entry if pressure is significant
        if total_pressure > 0.3:
            severity = "critical" if total_pressure > 0.8 else "warning" if total_pressure > 0.5 else "info"
            entries.append(make_heartbeat_entry(
                heartbeat_id, sim_id, tick_number, "resonance_pressure",
                f"Substrate pressure from {event_count} active event(s): {total_pressure:.2f}.",
                f"Substratdruck von {event_count} aktiven Ereignis(sen): {total_pressure:.2f}.",
                severity=severity,
                metadata={"total_pressure": total_pressure, "event_count": event_count},
            ))

        return total_pressure, entries

    # ── Phase 8: Scar Tissue Drift ─────────────────────────────

    @classmethod
    async def _phase_drift_scar_tissue(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> tuple[float, list[dict]]:
        """Grow scar tissue from active arcs, decay from healed ones — via batch RPC."""
        entries: list[dict] = []

        # Single RPC call handles all arc scar tissue updates
        result = await admin.rpc("fn_drift_scar_tissue_batch", {
            "p_sim_id": str(sim_id),
            "p_growth_rate": config.get("scar_growth_rate", 0.05),
            "p_decay_rate": config.get("scar_decay_rate", 0.02),
        }).execute()

        data = result.data or {}
        if isinstance(data, str):
            data = json.loads(data)

        scar_delta = float(data.get("scar_delta", 0))

        if abs(scar_delta) > 0.001:
            direction = "deepening" if scar_delta > 0 else "healing"
            entries.append(make_heartbeat_entry(
                heartbeat_id, sim_id, tick_number, "scar_tissue",
                f"Substrate scar tissue {direction} ({scar_delta:+.4f}).",
                f"Substrat-Narbengewebe {direction} ({scar_delta:+.4f}).",
                severity="warning" if scar_delta > 0 else "positive",
                metadata={"scar_delta": scar_delta},
            ))

        return scar_delta, entries

    # ── Router-Facing Queries ─────────────────────────────────

    @classmethod
    async def get_heartbeat_overview(cls, supabase: Client, simulation_id: UUID) -> dict:
        """Get latest heartbeat tick + summary counts for a simulation."""
        _resp = await (
            supabase.table("simulations")
            .select("last_heartbeat_tick, last_heartbeat_at, next_heartbeat_at")
            .eq("id", str(simulation_id))
            .limit(1)
            .execute()
        )
        sim = _resp.data
        if not sim:
            return {"last_tick": 0}

        sim = sim[0]
        last_tick = sim.get("last_heartbeat_tick", 0)

        # Count active arcs
        arcs = await (
            supabase.table("narrative_arcs")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .in_("status", ["building", "active", "climax"])
            .execute()
        )

        # Count pending bureau responses
        pending = await (
            supabase.table("bureau_responses")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .eq("status", "pending")
            .execute()
        )

        # Count active attunements
        attunements = await (
            supabase.table("substrate_attunements")
            .select("id", count="exact")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )

        # Count active anchors
        anchors = await (
            supabase.table("collaborative_anchors")
            .select("id", count="exact")
            .in_("status", ["forming", "active", "reinforcing"])
            .contains("anchor_simulation_ids", [str(simulation_id)])
            .execute()
        )

        return {
            "simulation_id": str(simulation_id),
            "last_tick": last_tick,
            "last_heartbeat_at": sim.get("last_heartbeat_at"),
            "next_heartbeat_at": sim.get("next_heartbeat_at"),
            "active_arcs": arcs.count or 0,
            "pending_responses": pending.count or 0,
            "active_attunements": attunements.count or 0,
            "active_anchors": anchors.count or 0,
        }

    @classmethod
    async def list_heartbeat_entries(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        entry_type: str | None = None,
        tick_number: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Paginated chronicle feed (heartbeat entries).

        Returns (data, total) tuple.
        """
        query = (
            supabase.table("heartbeat_entries")
            .select("*", count="exact")
            .eq("simulation_id", str(simulation_id))
            .order("tick_number", desc=True)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if entry_type:
            query = query.eq("entry_type", entry_type)
        if tick_number is not None:
            query = query.eq("tick_number", tick_number)

        response = await query.execute()
        return response.data or [], response.count or 0

    @classmethod
    async def list_cascade_rules(cls, admin: Client) -> list[dict]:
        """List all cascade rules from the resonance_cascade_rules table."""
        response = await (
            admin.table("resonance_cascade_rules")
            .select("*")
            .order("source_signature")
            .execute()
        )
        return response.data or []

    # ── Admin Dashboard ────────────────────────────────────────

    @classmethod
    async def get_admin_dashboard(cls, admin: Client) -> dict:
        """Build admin heartbeat dashboard data. Moved from router for SoC."""
        enabled, interval = await cls._load_config(admin)

        # Load active systems
        _resp = await (
            admin.table("platform_settings")
            .select("setting_value")
            .eq("setting_key", "heartbeat_systems")
            .limit(1)
            .execute()
        )
        systems_row = _resp.data
        active_systems = []
        if systems_row:
            val = systems_row[0]["setting_value"]
            active_systems = json.loads(val) if isinstance(val, str) else val

        # Get all active simulations with heartbeat state
        _resp = await (
            admin.table("simulations")
            .select("id, name, slug, last_heartbeat_tick, last_heartbeat_at, next_heartbeat_at, status")
            .eq("status", "active")
            .eq("simulation_type", "template")
            .is_("deleted_at", "null")
            .order("name")
            .execute()
        )
        sims = _resp.data or []

        # Batch-fetch arc counts, scar tissue, and pending responses for ALL sims at once
        # (replaces N*3 queries with 2 queries)
        sim_ids = [sim["id"] for sim in sims]

        all_arcs_resp = await (
            admin.table("narrative_arcs")
            .select("simulation_id, scar_tissue_deposited, status")
            .in_("simulation_id", sim_ids)
            .in_("status", ["building", "active", "climax"])
            .execute()
        )
        # Build per-sim arc counts + scar totals
        arc_counts: dict[str, int] = {}
        scar_totals: dict[str, float] = {}
        for arc in all_arcs_resp.data or []:
            sid = arc["simulation_id"]
            arc_counts[sid] = arc_counts.get(sid, 0) + 1
            scar = float(arc.get("scar_tissue_deposited", 0))
            if scar > 0:
                scar_totals[sid] = scar_totals.get(sid, 0) + scar

        all_pending_resp = await (
            admin.table("bureau_responses")
            .select("simulation_id")
            .in_("simulation_id", sim_ids)
            .eq("status", "pending")
            .execute()
        )
        pending_counts: dict[str, int] = {}
        for resp_row in all_pending_resp.data or []:
            sid = resp_row["simulation_id"]
            pending_counts[sid] = pending_counts.get(sid, 0) + 1

        sim_data = []
        for sim in sims:
            sid = sim["id"]
            total_scar = scar_totals.get(sid, 0)

            sim_data.append({
                "simulation_id": sid,
                "simulation_name": sim.get("name", ""),
                "slug": sim.get("slug", ""),
                "last_tick": sim.get("last_heartbeat_tick", 0),
                "last_heartbeat_at": sim.get("last_heartbeat_at"),
                "next_heartbeat_at": sim.get("next_heartbeat_at"),
                "status": "active",
                "active_arcs": arc_counts.get(sid, 0),
                "scar_tissue_level": round(total_scar, 4),
                "pending_responses": pending_counts.get(sid, 0),
            })

        return {
            "global_enabled": enabled,
            "interval_seconds": interval,
            "active_systems": active_systems,
            "simulations": sim_data,
        }

    # ── Daily Briefing ────────────────────────────────────────

    @classmethod
    async def get_daily_briefing(cls, supabase: Client, sim_id: UUID) -> dict:
        """Build a daily briefing summary for a simulation.

        Returns health delta, recent event counts, active arcs, and
        notable entries since the last briefing.
        """
        # Get current health
        _resp = await (
            supabase.table("mv_simulation_health")
            .select("overall_health, health_label, avg_zone_stability, avg_readiness")
            .eq("simulation_id", str(sim_id))
            .limit(1)
            .execute()
        )
        health = _resp.data
        health_data = health[0] if health else {}

        # Get last 24h of heartbeat entries (summary counts)
        last_day = (datetime.now(UTC) - timedelta(hours=24)).isoformat()
        _resp = await (
            supabase.table("heartbeat_entries")
            .select("entry_type, severity")
            .eq("simulation_id", str(sim_id))
            .gte("created_at", last_day)
            .execute()
        )
        entries = _resp.data or []

        type_counts: dict[str, int] = {}
        critical_count = 0
        positive_count = 0
        for e in entries:
            t = e.get("entry_type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1
            if e.get("severity") == "critical":
                critical_count += 1
            elif e.get("severity") == "positive":
                positive_count += 1

        # Active arcs
        arcs = await (
            supabase.table("narrative_arcs")
            .select("arc_type, primary_signature, status, pressure", count="exact")
            .eq("simulation_id", str(sim_id))
            .in_("status", ["building", "active", "climax"])
            .execute()
        )

        return {
            "health": health_data,
            "entries_24h": len(entries),
            "entry_type_counts": type_counts,
            "critical_events": critical_count,
            "positive_events": positive_count,
            "active_arcs": arcs.count or 0,
            "arc_details": arcs.data or [],
        }

    # ── Force Tick (Admin) ──────────────────────────────────────

    @classmethod
    async def force_tick(cls, admin: Client, sim_id: UUID) -> dict:
        """Manually trigger a tick for a simulation (admin action)."""
        response = await (
            admin.table("simulations")
            .select("id, name, slug, last_heartbeat_tick, next_heartbeat_at")
            .eq("id", str(sim_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Simulation not found.",
            )

        sim = response.data[0]
        _, interval = await cls._load_config(admin)
        await cls._tick_simulation(admin, sim, interval)

        # Return the completed heartbeat record
        tick_number = (sim.get("last_heartbeat_tick") or 0) + 1
        result = await (
            admin.table("simulation_heartbeats")
            .select("*")
            .eq("simulation_id", str(sim_id))
            .eq("tick_number", tick_number)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {"tick_number": tick_number, "status": "completed"}

    # ── Peacetime Content ──────────────────────────────────────

    @classmethod
    async def _generate_peacetime_entries(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
    ) -> list[dict]:
        """Generate ambient content when no significant activity occurred."""

        entries: list[dict] = []

        # Check simulation health for prosperity flavor
        try:
            _resp = await (
                admin.table("mv_simulation_health")
                .select("overall_health, health_label")
                .eq("simulation_id", str(sim_id))
                .limit(1)
                .execute()
            )
            health = _resp.data
            if health:
                h = float(health[0].get("overall_health", 0.5))
                label = health[0].get("health_label", "functional")

                if h >= 0.7:
                    prosperity = random.choice([  # noqa: S311
                        ("Trade routes hum with quiet commerce. The districts prosper.",
                         "Handelsrouten summen vor stillem Handel. Die Bezirke gedeihen."),
                        ("Citizens report a rare sense of optimism in the streets.",
                         "Buerger berichten von seltener Zuversicht in den Strassen."),
                        ("Building occupancy is high. The simulation breathes steadily.",
                         "Die Gebaeudebelegung ist hoch. Die Simulation atmet gleichmaessig."),
                    ])
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "system_note",
                        prosperity[0], prosperity[1],
                        severity="positive",
                        metadata={"health": h, "label": label, "peacetime": True},
                    ))
                elif h >= 0.5:
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "system_note",
                        "The substrate holds steady. No significant disturbances detected.",
                        "Das Substrat haelt sich stabil. Keine nennenswerten Stoerungen erkannt.",
                        severity="info",
                        metadata={"health": h, "label": label, "peacetime": True},
                    ))
                else:
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "system_note",
                        "An uneasy calm. The substrate's silence may not last.",
                        "Eine unruhige Stille. Das Schweigen des Substrats duerfte nicht anhalten.",
                        severity="warning",
                        metadata={"health": h, "label": label, "peacetime": True},
                    ))
        except Exception:
            logger.debug("Failed to generate peacetime content from health data")

        # Fallback if no entries generated
        if not entries:
            entries.append(make_heartbeat_entry(
                heartbeat_id, sim_id, tick_number, "system_note",
                "All quiet in the districts. No significant substrate activity.",
                "Alles ruhig in den Bezirken. Keine nennenswerte Substrataktivitaet.",
                severity="info",
            ))

        return entries

    # ── Helpers ─────────────────────────────────────────────────

    @staticmethod
    def _build_dispatch(entries: list[dict], tick_number: int, locale: str) -> str:
        """Build a human-readable dispatch summary from entries."""
        field = "narrative_en" if locale == "en" else "narrative_de"
        lines = [f"=== SUBSTRATE PULSE — TICK #{tick_number} ==="]
        for entry in entries[:10]:  # Cap at 10 for readability
            text = entry.get(field) or entry.get("narrative_en", "")
            severity = entry.get("severity", "info")
            prefix = {"critical": "[!]", "warning": "[*]", "positive": "[+]"}.get(severity, "[-]")
            lines.append(f"{prefix} {text}")
        if len(entries) > 10:
            lines.append(f"... and {len(entries) - 10} more entries.")
        return "\n".join(lines)
