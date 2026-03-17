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
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from backend.dependencies import get_admin_supabase
from backend.services.game_mechanics_service import GameMechanicsService
from supabase import Client

logger = logging.getLogger(__name__)

# Defaults (overridable via platform_settings)
_DEFAULT_ENABLED = True
_DEFAULT_INTERVAL = 28800  # 8 hours
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
            rows = (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "heartbeat_enabled",
                    "heartbeat_interval_seconds",
                ])
                .execute()
            ).data or []
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
        """Load all heartbeat-related platform settings."""
        config: dict = {
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
        }
        try:
            rows = (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .like("setting_key", "heartbeat_%")
                .execute()
            ).data or []
            for row in rows:
                key = row["setting_key"].replace("heartbeat_", "")
                val = row["setting_value"]
                if key == "event_aging_rules":
                    try:
                        import json
                        parsed = json.loads(val) if isinstance(val, str) else val
                        if isinstance(parsed, dict):
                            config["event_aging_rules"] = parsed
                    except (ValueError, TypeError):
                        pass
                elif key in config:
                    try:
                        if isinstance(config[key], bool):
                            config[key] = str(val).strip('"').lower() not in ("false", "0", "no")
                        elif isinstance(config[key], int):
                            config[key] = int(val)
                        elif isinstance(config[key], float):
                            config[key] = float(val)
                    except (ValueError, TypeError):
                        pass
        except Exception:
            logger.warning("Failed to load full heartbeat config, using defaults")
        return config

    @classmethod
    async def _load_sim_overrides(cls, admin: Client, sim_id: UUID) -> dict:
        """Load per-simulation heartbeat overrides from simulation_settings."""
        overrides: dict = {}
        try:
            rows = (
                admin.table("simulation_settings")
                .select("setting_key, setting_value")
                .eq("simulation_id", str(sim_id))
                .eq("category", "heartbeat")
                .execute()
            ).data or []
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
        response = (
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

        # Idempotency check
        existing = (
            admin.table("simulation_heartbeats")
            .select("id")
            .eq("simulation_id", str(sim_id))
            .eq("tick_number", tick_number)
            .limit(1)
            .execute()
        ).data
        if existing:
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
            epoch_resp = (
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

        # Create heartbeat record
        heartbeat_id = uuid4()
        admin.table("simulation_heartbeats").insert({
            "id": str(heartbeat_id),
            "simulation_id": str(sim_id),
            "tick_number": tick_number,
            "status": "processing",
        }).execute()

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
                entries.append(cls._make_entry(
                    heartbeat_id, sim_id, tick_number, "zone_shift",
                    f"{expired} zone action(s) expired.",
                    f"{expired} Zonenaktion(en) abgelaufen.",
                    severity="info",
                    metadata={"expired_count": expired},
                ))

            # Phase 2: Age events
            aging_rules = overrides.get("event_aging_rules", config["event_aging_rules"])
            if isinstance(aging_rules, str):
                import json
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
                admin, sim_id, tick_number, heartbeat_id,
            )
            tick_stats["resonance_pressure_delta"] = pressure_delta
            entries.extend(pressure_entries)

            # Phase 4: Detect narrative arcs (escalation, cascade, convergence)
            from backend.services.narrative_arc_service import NarrativeArcService
            arc_entries, cascade_spawned, convergence = await NarrativeArcService.detect_and_advance(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            tick_stats["cascade_events_spawned"] = cascade_spawned
            tick_stats["convergence_detected"] = convergence
            entries.extend(arc_entries)

            # Phase 5: Resolve bureau responses
            from backend.services.bureau_response_service import BureauResponseService
            resolved_count, bureau_entries = await BureauResponseService.resolve_at_tick(
                admin, sim_id, tick_number, heartbeat_id, config=config,
            )
            tick_stats["bureau_responses_resolved"] = resolved_count
            entries.extend(bureau_entries)

            # Phase 6: Deepen attunements
            from backend.services.attunement_service import AttunementService
            attunement_entries = await AttunementService.deepen_at_tick(
                admin, sim_id, tick_number, heartbeat_id, config,
            )
            entries.extend(attunement_entries)

            # Phase 7: Strengthen anchors
            from backend.services.anchor_service import AnchorService
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

            # Phase 9: Refresh materialized views
            await GameMechanicsService.refresh_metrics(admin)

            # Phase 10: Produce chronicle entries
            if not entries:
                entries.append(cls._make_entry(
                    heartbeat_id, sim_id, tick_number, "system_note",
                    "All quiet in the districts. No significant substrate activity.",
                    "Alles ruhig in den Bezirken. Keine nennenswerte Substrataktivitaet.",
                    severity="info",
                ))

            # Tag entries with epoch context if active
            if active_epoch_id:
                for entry in entries:
                    meta = entry.get("metadata") or {}
                    meta["epoch_id"] = active_epoch_id
                    entry["metadata"] = meta

            # Batch insert entries
            admin.table("heartbeat_entries").insert(entries).execute()

            # Build dispatch summary
            dispatch_en = cls._build_dispatch(entries, tick_number, "en")
            dispatch_de = cls._build_dispatch(entries, tick_number, "de")

            # Phase 11: Finalize
            effective_interval = int(overrides.get("interval_override_seconds", interval))
            next_at = datetime.now(UTC) + timedelta(seconds=effective_interval)

            admin.table("simulation_heartbeats").update({
                "status": "completed",
                "dispatch_en": dispatch_en,
                "dispatch_de": dispatch_de,
                "summary": {"phases_completed": 11, "entry_count": len(entries)},
                **tick_stats,
            }).eq("id", str(heartbeat_id)).execute()

            admin.table("simulations").update({
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
            admin.table("simulation_heartbeats").update({
                "status": "failed",
                "summary": {"error": "See server logs"},
            }).eq("id", str(heartbeat_id)).execute()

            # Still advance next_heartbeat_at to prevent retry storms
            next_at = datetime.now(UTC) + timedelta(seconds=interval)
            admin.table("simulations").update({
                "next_heartbeat_at": next_at.isoformat(),
            }).eq("id", str(sim_id)).execute()

    # ── Phase 1: Expire Zone Actions ───────────────────────────

    @classmethod
    async def _phase_expire_zone_actions(cls, admin: Client, sim_id: UUID) -> int:
        """Soft-delete zone actions past their expires_at."""
        now = datetime.now(UTC).isoformat()
        response = (
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
        """Increment ticks_in_status, auto-transition event statuses."""
        entries: list[dict] = []
        aged = 0
        escalated = 0
        resolved = 0

        # Get all non-archived events
        response = (
            admin.table("events")
            .select("id, title, title_de, event_status, ticks_in_status, impact_level")
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .neq("event_status", "archived")
            .execute()
        )
        events = response.data or []
        if not events:
            return aged, escalated, resolved, entries

        transitions = {
            "active": ("escalating", aging_rules.get("active_to_escalating", 4)),
            "escalating": ("resolving", aging_rules.get("escalating_to_resolving", 6)),
            "resolving": ("resolved", aging_rules.get("resolving_to_resolved", 3)),
            "resolved": ("archived", aging_rules.get("resolved_to_archived", 8)),
        }

        for event in events:
            event_id = event["id"]
            current_status = event["event_status"]
            ticks = (event.get("ticks_in_status") or 0) + 1
            title = event.get("title", "Unknown event")

            # Always increment ticks_in_status
            update_data: dict = {"ticks_in_status": ticks}
            aged += 1

            # Check for auto-transition
            if current_status in transitions:
                new_status, threshold = transitions[current_status]
                if ticks >= threshold:
                    update_data["event_status"] = new_status
                    update_data["ticks_in_status"] = 0

                    if new_status == "escalating":
                        escalated += 1
                        update_data["heartbeat_pressure"] = round(
                            float(event.get("heartbeat_pressure", 0)) * 1.3, 4,
                        )
                        entries.append(cls._make_entry(
                            heartbeat_id, sim_id, tick_number, "event_escalation",
                            f"'{title}' escalated. Zone pressure increasing.",
                            f"'{title}' eskaliert. Zonendruck steigt.",
                            severity="warning",
                            metadata={"event_id": event_id, "old_status": current_status,
                                      "new_status": new_status},
                        ))
                    elif new_status in ("resolving", "resolved"):
                        resolved += 1
                        if new_status == "resolving":
                            update_data["heartbeat_pressure"] = round(
                                float(event.get("heartbeat_pressure", 0)) * 0.9, 4,
                            )
                        entry_type = "event_resolution" if new_status == "resolved" else "event_aging"
                        pressure_msg = "removed" if new_status == "resolved" else "decaying"
                        druck_msg = "entfernt" if new_status == "resolved" else "abklingend"
                        entries.append(cls._make_entry(
                            heartbeat_id, sim_id, tick_number, entry_type,
                            f"'{title}' transitioned to {new_status}. Pressure contribution {pressure_msg}.",
                            f"'{title}' wechselte zu {new_status}. Druckbeitrag {druck_msg}.",
                            severity="positive" if new_status == "resolved" else "info",
                            metadata={"event_id": event_id, "old_status": current_status,
                                      "new_status": new_status},
                        ))
                    elif new_status == "archived":
                        entries.append(cls._make_entry(
                            heartbeat_id, sim_id, tick_number, "event_aging",
                            f"'{title}' archived. No longer contributing to substrate pressure.",
                            f"'{title}' archiviert. Traegt nicht mehr zum Substratdruck bei.",
                            severity="info",
                            metadata={"event_id": event_id, "old_status": current_status,
                                      "new_status": new_status},
                        ))
                else:
                    # Log aging progress for active/escalating events
                    remaining = threshold - ticks
                    if current_status in ("active", "escalating") and remaining <= 2:
                        auto_en = "escalating" if current_status == "active" else "resolving"
                        auto_de = "Eskalation" if current_status == "active" else "Loesung"
                        entries.append(cls._make_entry(
                            heartbeat_id, sim_id, tick_number, "event_aging",
                            f"'{title}' has been {current_status} for {ticks} ticks. "
                            f"Auto-{auto_en} in {remaining} more tick(s).",
                            f"'{title}' ist seit {ticks} Ticks {current_status}. "
                            f"Automatische {auto_de} in {remaining} weiteren Tick(s).",
                            severity="warning" if current_status == "active" else "info",
                            metadata={"event_id": event_id, "ticks_in_status": ticks,
                                      "remaining": remaining},
                        ))

            admin.table("events").update(update_data).eq("id", event_id).execute()

        return aged, escalated, resolved, entries

    # ── Phase 3: Compute Resonance Pressure ────────────────────

    @classmethod
    async def _phase_compute_pressure(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
    ) -> tuple[float, list[dict]]:
        """Accumulate pressure from active/escalating events, compute delta."""
        entries: list[dict] = []

        # Get active + escalating events with their pressure values
        response = (
            admin.table("events")
            .select("id, title, event_status, heartbeat_pressure, impact_level, tags")
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .in_("event_status", ["active", "escalating"])
            .execute()
        )
        events = response.data or []

        # Calculate total simulation pressure
        total_pressure = 0.0
        for event in events:
            base = float(event.get("impact_level", 5)) / 10.0
            status_mult = 1.3 if event["event_status"] == "escalating" else 1.0
            pressure = round(base * status_mult, 4)
            total_pressure += pressure

            # Update per-event pressure tracking
            admin.table("events").update({
                "heartbeat_pressure": pressure,
            }).eq("id", event["id"]).execute()

        # Produce entry if pressure is significant
        if total_pressure > 0.3:
            severity = "critical" if total_pressure > 0.8 else "warning" if total_pressure > 0.5 else "info"
            entries.append(cls._make_entry(
                heartbeat_id, sim_id, tick_number, "resonance_pressure",
                f"Substrate pressure from {len(events)} active event(s): {total_pressure:.2f}.",
                f"Substratdruck von {len(events)} aktiven Ereignis(sen): {total_pressure:.2f}.",
                severity=severity,
                metadata={"total_pressure": total_pressure, "event_count": len(events)},
            ))

        return total_pressure, entries

    # ── Phase 8: Scar Tissue Drift ─────────────────────────────

    @classmethod
    async def _phase_drift_scar_tissue(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> tuple[float, list[dict]]:
        """Grow scar tissue from active arcs, decay from healed ones."""
        entries: list[dict] = []
        scar_delta = 0.0
        decay_rate = config.get("scar_decay_rate", 0.02)

        # Get active arcs and their scar tissue
        arcs = (
            admin.table("narrative_arcs")
            .select("id, arc_type, primary_signature, status, pressure, scar_tissue_deposited")
            .eq("simulation_id", str(sim_id))
            .in_("status", ["active", "climax", "resolving", "resolved"])
            .execute()
        ).data or []

        for arc in arcs:
            arc_id = arc["id"]
            arc_status = arc["status"]
            current_scar = float(arc.get("scar_tissue_deposited", 0))

            if arc_status in ("active", "climax"):
                # Grow scar tissue proportional to pressure
                growth = float(arc.get("pressure", 0)) * 0.05
                new_scar = round(current_scar + growth, 4)
                scar_delta += growth
            elif arc_status in ("resolving", "resolved"):
                # Decay scar tissue
                decay = round(current_scar * decay_rate, 4)
                new_scar = round(max(0, current_scar - decay), 4)
                scar_delta -= decay
            else:
                continue

            admin.table("narrative_arcs").update({
                "scar_tissue_deposited": new_scar,
            }).eq("id", arc_id).execute()

        if abs(scar_delta) > 0.001:
            direction = "deepening" if scar_delta > 0 else "healing"
            entries.append(cls._make_entry(
                heartbeat_id, sim_id, tick_number, "scar_tissue",
                f"Substrate scar tissue {direction} ({scar_delta:+.4f}).",
                f"Substrat-Narbengewebe {direction} ({scar_delta:+.4f}).",
                severity="warning" if scar_delta > 0 else "positive",
                metadata={"scar_delta": scar_delta, "arc_count": len(arcs)},
            ))

        return scar_delta, entries

    # ── Force Tick (Admin) ──────────────────────────────────────

    @classmethod
    async def force_tick(cls, admin: Client, sim_id: UUID) -> dict:
        """Manually trigger a tick for a simulation (admin action)."""
        response = (
            admin.table("simulations")
            .select("id, name, slug, last_heartbeat_tick, next_heartbeat_at")
            .eq("id", str(sim_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            from fastapi import HTTPException
            from fastapi import status as http_status

            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Simulation not found.",
            )

        sim = response.data[0]
        _, interval = await cls._load_config(admin)
        await cls._tick_simulation(admin, sim, interval)

        # Return the completed heartbeat record
        tick_number = (sim.get("last_heartbeat_tick") or 0) + 1
        result = (
            admin.table("simulation_heartbeats")
            .select("*")
            .eq("simulation_id", str(sim_id))
            .eq("tick_number", tick_number)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {"tick_number": tick_number, "status": "completed"}

    # ── Helpers ─────────────────────────────────────────────────

    @staticmethod
    def _make_entry(
        heartbeat_id: UUID, sim_id: UUID, tick_number: int,
        entry_type: str, narrative_en: str, narrative_de: str,
        severity: str = "info", metadata: dict | None = None,
    ) -> dict:
        """Build a heartbeat_entries row dict."""
        return {
            "id": str(uuid4()),
            "heartbeat_id": str(heartbeat_id),
            "simulation_id": str(sim_id),
            "tick_number": tick_number,
            "entry_type": entry_type,
            "narrative_en": narrative_en,
            "narrative_de": narrative_de,
            "metadata": metadata or {},
            "severity": severity,
        }

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
