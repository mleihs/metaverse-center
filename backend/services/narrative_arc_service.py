"""Narrative Arc Service — detects escalation, cascade, and convergence patterns.

Called from HeartbeatService Phase 4. Pure DB computations, no AI.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from backend.models.resonance import RESONANCE_SIGNATURES
from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from supabase import Client

logger = logging.getLogger(__name__)


class NarrativeArcService:
    """Detects and advances narrative arcs during heartbeat ticks."""

    # ── Phase 4 Entry Point ─────────────────────────────────────

    @classmethod
    async def detect_and_advance(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> tuple[list[dict], int, bool]:
        """Run arc detection and advancement. Returns (entries, cascade_spawned, convergence_detected)."""
        entries: list[dict] = []
        cascade_spawned = 0
        convergence_detected = False

        # Advance existing arcs
        advance_entries = await cls._advance_arcs(admin, sim_id, tick_number, heartbeat_id)
        entries.extend(advance_entries)

        # Detect escalation
        esc_entries = await cls._detect_escalation(admin, sim_id, tick_number, heartbeat_id, config)
        entries.extend(esc_entries)

        # Detect cascade
        cas_entries, spawned = await cls._detect_cascade(
            admin, sim_id, tick_number, heartbeat_id, config,
        )
        entries.extend(cas_entries)
        cascade_spawned = spawned

        # Detect convergence
        conv_entries, detected = await cls._detect_convergence(
            admin, sim_id, tick_number, heartbeat_id, config,
        )
        entries.extend(conv_entries)
        convergence_detected = detected

        return entries, cascade_spawned, convergence_detected

    # ── Escalation Detection ────────────────────────────────────

    @classmethod
    async def _detect_escalation(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> list[dict]:
        """When 3+ events with the same resonance_signature tag are active, create/advance an escalation arc."""
        entries: list[dict] = []
        threshold = config.get("escalation_threshold", 3)

        # Get active events with resonance tags
        response = (
            admin.table("events")
            .select("id, title, tags, event_status")
            .eq("simulation_id", str(sim_id))
            .is_("deleted_at", "null")
            .in_("event_status", ["active", "escalating"])
            .execute()
        )
        events = response.data or []
        if not events:
            return entries

        # Group by resonance signature tag
        sig_events: dict[str, list[dict]] = {}
        for event in events:
            tags = event.get("tags") or []
            for tag in tags:
                if tag in RESONANCE_SIGNATURES:
                    sig_events.setdefault(tag, []).append(event)

        # Check each signature against threshold
        for signature, sig_event_list in sig_events.items():
            if len(sig_event_list) < threshold:
                continue

            # Check if an escalation arc already exists for this signature
            existing = (
                admin.table("narrative_arcs")
                .select("id, status, pressure")
                .eq("simulation_id", str(sim_id))
                .eq("arc_type", "escalation")
                .eq("primary_signature", signature)
                .in_("status", ["building", "active", "climax"])
                .limit(1)
                .execute()
            ).data

            if existing:
                # Arc already tracked — advancement happens in _advance_arcs
                continue

            # Create new escalation arc
            event_ids = [e["id"] for e in sig_event_list]
            arc_id = uuid4()
            initial_pressure = round(min(1.0, 0.1 * (len(sig_event_list) - threshold + 1)), 4)

            admin.table("narrative_arcs").insert({
                "id": str(arc_id),
                "simulation_id": str(sim_id),
                "arc_type": "escalation",
                "primary_signature": signature,
                "status": "building",
                "pressure": initial_pressure,
                "peak_pressure": initial_pressure,
                "started_at_tick": tick_number,
                "last_active_tick": tick_number,
                "ticks_active": 1,
                "source_event_ids": event_ids,
            }).execute()

            entries.append(make_heartbeat_entry(
                heartbeat_id, sim_id, tick_number, "narrative_arc",
                f"NARRATIVE ARC DETECTED: {len(sig_event_list)} '{signature}' events "
                f"converging \u2013 escalation pattern building (pressure {initial_pressure:.2f}).",
                f"NARRATIVER BOGEN ERKANNT: {len(sig_event_list)} '{signature}'-Ereignisse "
                f"konvergieren \u2013 Eskalationsmuster bildet sich (Druck {initial_pressure:.2f}).",
                severity="warning",
                metadata={
                    "arc_id": str(arc_id), "arc_type": "escalation",
                    "signature": signature, "event_count": len(sig_event_list),
                    "pressure": initial_pressure,
                },
            ))

            logger.info(
                "Narrative arc created: escalation/%s (pressure %.2f, %d events)",
                signature, initial_pressure, len(sig_event_list),
                extra={"simulation_id": str(sim_id), "arc_id": str(arc_id)},
            )

        return entries

    # ── Cascade Detection ───────────────────────────────────────

    @classmethod
    async def _detect_cascade(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> tuple[list[dict], int]:
        """When an escalation arc reaches cascade_pressure_trigger, check cascade rules."""
        entries: list[dict] = []
        spawned = 0
        trigger = config.get("cascade_pressure_trigger", 0.60)

        # Get active arcs above trigger
        arcs = (
            admin.table("narrative_arcs")
            .select("id, primary_signature, pressure, status")
            .eq("simulation_id", str(sim_id))
            .eq("arc_type", "escalation")
            .in_("status", ["active", "climax"])
            .gte("pressure", trigger)
            .execute()
        ).data or []

        if not arcs:
            return entries, spawned

        # Load cascade rules
        rules = (
            admin.table("resonance_cascade_rules")
            .select("*")
            .eq("is_active", True)
            .execute()
        ).data or []

        if not rules:
            return entries, spawned

        now = datetime.now(UTC)

        for arc in arcs:
            source_sig = arc["primary_signature"]

            for rule in rules:
                if rule["source_signature"] != source_sig:
                    continue

                target_sig = rule["target_signature"]

                # Check cooldown
                last_triggered = rule.get("last_triggered_at")
                if last_triggered:
                    try:
                        lt = datetime.fromisoformat(last_triggered.replace("Z", "+00:00"))
                        cooldown_end = lt + timedelta(hours=rule.get("cooldown_hours", 72))
                        if cooldown_end > now:
                            continue
                    except (ValueError, TypeError):
                        pass

                # Check if cascade arc already exists
                existing_cascade = (
                    admin.table("narrative_arcs")
                    .select("id")
                    .eq("simulation_id", str(sim_id))
                    .eq("arc_type", "cascade")
                    .eq("primary_signature", source_sig)
                    .eq("secondary_signature", target_sig)
                    .in_("status", ["building", "active", "climax"])
                    .limit(1)
                    .execute()
                ).data
                if existing_cascade:
                    continue

                # Check depth cap
                depth_count = len((
                    admin.table("narrative_arcs")
                    .select("id")
                    .eq("simulation_id", str(sim_id))
                    .eq("arc_type", "cascade")
                    .in_("status", ["building", "active", "climax"])
                    .execute()
                ).data or [])
                if depth_count >= rule.get("depth_cap", 5):
                    continue

                # Spawn cascade arc
                transfer = float(rule.get("transfer_rate", 0.5))
                child_pressure = round(float(arc["pressure"]) * transfer, 4)
                cascade_id = uuid4()

                admin.table("narrative_arcs").insert({
                    "id": str(cascade_id),
                    "simulation_id": str(sim_id),
                    "arc_type": "cascade",
                    "primary_signature": source_sig,
                    "secondary_signature": target_sig,
                    "status": "building",
                    "pressure": child_pressure,
                    "peak_pressure": child_pressure,
                    "started_at_tick": tick_number,
                    "last_active_tick": tick_number,
                    "ticks_active": 1,
                }).execute()

                # Update cooldown on rule
                admin.table("resonance_cascade_rules").update({
                    "last_triggered_at": now.isoformat(),
                }).eq("id", rule["id"]).execute()

                spawned += 1

                narrative_en = rule.get("narrative_en", f"{source_sig} cascading into {target_sig}")
                narrative_de = rule.get("narrative_de", f"{source_sig} kaskadiert in {target_sig}")

                entries.append(make_heartbeat_entry(
                    heartbeat_id, sim_id, tick_number, "cascade_spawn",
                    f"NARRATIVE ARC: {narrative_en} (cascade pressure {child_pressure:.2f})",
                    f"NARRATIVER BOGEN: {narrative_de} (Kaskadendruck {child_pressure:.2f})",
                    severity="critical",
                    metadata={
                        "arc_id": str(cascade_id), "arc_type": "cascade",
                        "source_signature": source_sig, "target_signature": target_sig,
                        "pressure": child_pressure, "rule_id": rule["id"],
                    },
                ))

                logger.info(
                    "Cascade arc spawned: %s → %s (pressure %.2f)",
                    source_sig, target_sig, child_pressure,
                    extra={"simulation_id": str(sim_id), "cascade_id": str(cascade_id)},
                )

        return entries, spawned

    # ── Convergence Detection ───────────────────────────────────

    @classmethod
    async def _detect_convergence(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> tuple[list[dict], bool]:
        """Detect archetype convergence pairings."""
        entries: list[dict] = []
        detected = False

        # Get convergence pairs config
        try:
            pairs_row = (
                admin.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", "heartbeat_convergence_pairs")
                .limit(1)
                .execute()
            ).data
            if not pairs_row:
                return entries, detected
            pairs = pairs_row[0]["setting_value"]
            if isinstance(pairs, str):
                pairs = json.loads(pairs)
        except Exception:
            logger.warning("Failed to load convergence pairs config")
            return entries, detected

        # Get active arcs with archetypes
        active_arcs = (
            admin.table("narrative_arcs")
            .select("id, primary_archetype, secondary_archetype, status")
            .eq("simulation_id", str(sim_id))
            .in_("status", ["active", "climax"])
            .execute()
        ).data or []

        if len(active_arcs) < 2:
            return entries, detected

        # Collect all active archetypes
        active_archetypes: set[str] = set()
        for arc in active_arcs:
            if arc.get("primary_archetype"):
                # Normalize: "The Tower" → "Tower"
                name = arc["primary_archetype"].replace("The ", "")
                active_archetypes.add(name)
            if arc.get("secondary_archetype"):
                name = arc["secondary_archetype"].replace("The ", "")
                active_archetypes.add(name)

        # Check convergence pairs
        for pair_key, pair_data in pairs.items():
            parts = pair_key.split("+")
            if len(parts) != 2:
                continue

            arch_a, arch_b = parts[0].strip(), parts[1].strip()
            if arch_a in active_archetypes and arch_b in active_archetypes:
                # Check if convergence already exists for this tick
                existing = (
                    admin.table("narrative_arcs")
                    .select("id")
                    .eq("simulation_id", str(sim_id))
                    .eq("arc_type", "convergence")
                    .eq("primary_archetype", arch_a)
                    .eq("secondary_archetype", arch_b)
                    .in_("status", ["active", "climax"])
                    .limit(1)
                    .execute()
                ).data
                if existing:
                    continue

                conv_name = pair_data.get("name", f"{arch_a} + {arch_b}")
                conv_id = uuid4()

                admin.table("narrative_arcs").insert({
                    "id": str(conv_id),
                    "simulation_id": str(sim_id),
                    "arc_type": "convergence",
                    "primary_archetype": arch_a,
                    "secondary_archetype": arch_b,
                    "status": "active",
                    "pressure": 0.5,
                    "peak_pressure": 0.5,
                    "started_at_tick": tick_number,
                    "last_active_tick": tick_number,
                    "ticks_active": 1,
                }).execute()

                detected = True
                effects = pair_data.get("effects", {})
                effects_desc = ", ".join(f"{k}: {v:+.2f}" for k, v in effects.items())

                entries.append(make_heartbeat_entry(
                    heartbeat_id, sim_id, tick_number, "convergence",
                    f"CONVERGENCE DETECTED: The {arch_a} + The {arch_b} = '{conv_name}'. {effects_desc}.",
                    f"KONVERGENZ ERKANNT: Der {arch_a} + Der {arch_b} = '{conv_name}'. {effects_desc}.",
                    severity="critical",
                    metadata={
                        "arc_id": str(conv_id), "convergence_name": conv_name,
                        "archetype_a": arch_a, "archetype_b": arch_b,
                        "effects": effects,
                    },
                ))

                logger.info(
                    "Convergence detected: %s + %s = '%s'",
                    arch_a, arch_b, conv_name,
                    extra={"simulation_id": str(sim_id), "convergence_id": str(conv_id)},
                )

                # Generate new lore section from convergence (world evolution)
                cls._create_convergence_lore(
                    admin, sim_id, arch_a, arch_b, conv_name, effects_desc,
                )

        return entries, detected

    @classmethod
    def _create_convergence_lore(
        cls, admin: Client, sim_id: UUID,
        arch_a: str, arch_b: str, conv_name: str, effects_desc: str,
    ) -> None:
        """Create a new lore section when a convergence is detected."""
        try:
            # Find next sort_order
            existing = (
                admin.table("simulation_lore")
                .select("sort_order")
                .eq("simulation_id", str(sim_id))
                .order("sort_order", desc=True)
                .limit(1)
                .execute()
            ).data
            next_order = (existing[0]["sort_order"] + 1) if existing else 0

            admin.table("simulation_lore").insert({
                "simulation_id": str(sim_id),
                "sort_order": next_order,
                "chapter": "Echoes of Convergence",
                "arcanum": f"The {conv_name}",
                "title": conv_name,
                "epigraph": f"When The {arch_a} met The {arch_b}, the substrate trembled.",
                "body": (
                    f"The convergence of The {arch_a} and The {arch_b} reshaped the fabric "
                    f"of this simulation. Known as '{conv_name}', this moment marked a turning "
                    f"point in the world's history. {effects_desc}"
                ),
            }).execute()

            logger.info(
                "Convergence lore created: '%s' (order %d)",
                conv_name, next_order,
                extra={"simulation_id": str(sim_id), "convergence_name": conv_name},
            )
        except Exception:
            logger.warning(
                "Failed to create convergence lore for '%s'",
                conv_name,
                extra={"simulation_id": str(sim_id)},
                exc_info=True,
            )

    # ── Arc Advancement ─────────────────────────────────────────

    @classmethod
    async def _advance_arcs(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
    ) -> list[dict]:
        """Increment ticks, update pressure, check climax, age dormant arcs."""
        entries: list[dict] = []

        active_arcs = (
            admin.table("narrative_arcs")
            .select("*")
            .eq("simulation_id", str(sim_id))
            .in_("status", ["building", "active", "climax", "resolving"])
            .execute()
        ).data or []

        for arc in active_arcs:
            arc_id = arc["id"]
            arc_status = arc["status"]
            arc_type = arc.get("arc_type", "escalation")
            pressure = float(arc.get("pressure", 0))
            peak = float(arc.get("peak_pressure", 0))
            ticks_active = (arc.get("ticks_active") or 0) + 1

            update_data: dict = {
                "last_active_tick": tick_number,
                "ticks_active": ticks_active,
            }

            if arc_status == "building":
                # Building → active after 2 ticks
                if ticks_active >= 2:
                    update_data["status"] = "active"
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "narrative_arc",
                        f"Narrative arc '{arc.get('primary_signature', 'unknown')}' "
                        f"({arc_type}) became ACTIVE.",
                        f"Narrativer Bogen '{arc.get('primary_signature', 'unknown')}' "
                        f"({arc_type}) wurde AKTIV.",
                        severity="warning",
                        metadata={"arc_id": arc_id, "arc_type": arc_type},
                    ))

            elif arc_status == "active":
                # Pressure growth for escalation arcs
                if arc_type == "escalation":
                    # Count matching events
                    sig = arc.get("primary_signature", "")
                    event_count = len((
                        admin.table("events")
                        .select("id")
                        .eq("simulation_id", str(sim_id))
                        .is_("deleted_at", "null")
                        .in_("event_status", ["active", "escalating"])
                        .contains("tags", [sig])
                        .execute()
                    ).data or [])
                    pressure = round(min(1.0, pressure + 0.1 * max(0, event_count - 2)), 4)

                update_data["pressure"] = pressure
                if pressure > peak:
                    update_data["peak_pressure"] = pressure

                # Check for climax
                if pressure > 0.8:
                    update_data["status"] = "climax"
                    update_data["climax_start_tick"] = tick_number
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "narrative_arc",
                        f"Narrative arc '{arc.get('primary_signature', 'unknown')}' "
                        f"({arc_type}) reached CLIMAX (pressure {pressure:.2f}).",
                        f"Narrativer Bogen '{arc.get('primary_signature', 'unknown')}' "
                        f"({arc_type}) erreichte HOEHEPUNKT (Druck {pressure:.2f}).",
                        severity="critical",
                        metadata={
                            "arc_id": arc_id, "arc_type": arc_type,
                            "pressure": pressure,
                        },
                    ))

            elif arc_status == "climax":
                # Climax → resolving after 2 ticks at climax
                # Use climax_start_tick if tracked, otherwise estimate from peak_pressure timing
                climax_start = arc.get("climax_start_tick") or arc.get("last_active_tick", tick_number)
                climax_ticks = tick_number - climax_start
                if climax_ticks >= 2:
                    update_data["status"] = "resolving"
                    update_data["pressure"] = round(pressure * 0.8, 4)

            elif arc_status == "resolving":
                # Resolving → resolved when pressure drops below 0.1
                new_pressure = round(pressure * 0.7, 4)
                update_data["pressure"] = new_pressure
                if new_pressure < 0.1:
                    update_data["status"] = "resolved"
                    sig = arc.get("primary_signature", "unknown")
                    entries.append(make_heartbeat_entry(
                        heartbeat_id, sim_id, tick_number, "narrative_arc",
                        f"Narrative arc '{sig}' ({arc_type}) RESOLVED. "
                        f"Peak pressure was {peak:.2f}.",
                        f"Narrativer Bogen '{sig}' ({arc_type}) AUFGELOEST. "
                        f"Spitzendruck war {peak:.2f}.",
                        severity="positive",
                        metadata={
                            "arc_id": arc_id, "arc_type": arc_type,
                            "peak_pressure": peak,
                        },
                    ))

                    # Scar zones if peak pressure was significant
                    if peak > 0.5:
                        cls._scar_affected_zones(
                            admin, sim_id, arc, arc_type, sig,
                        )

            admin.table("narrative_arcs").update(update_data).eq("id", arc_id).execute()

        return entries

    # ── Zone Scarring ──────────────────────────────────────────

    @classmethod
    def _scar_affected_zones(
        cls, admin: Client, sim_id: UUID,
        arc: dict, arc_type: str, signature: str,
    ) -> None:
        """Append scar description to zones affected by a resolved high-pressure arc."""
        try:
            source_event_ids = arc.get("source_event_ids") or []
            if not source_event_ids:
                return

            # Find zones linked to the arc's source events
            zone_links = (
                admin.table("event_zone_links")
                .select("zone_id")
                .in_("event_id", source_event_ids)
                .execute()
            ).data or []

            seen_zones: set[str] = set()
            scar_suffix = f" The district still bears marks of the {arc_type} of {signature}."

            for link in zone_links:
                zone_id = link["zone_id"]
                if zone_id in seen_zones:
                    continue
                seen_zones.add(zone_id)

                zone = (
                    admin.table("zones")
                    .select("id, description")
                    .eq("id", zone_id)
                    .limit(1)
                    .execute()
                ).data
                if zone:
                    current_desc = zone[0].get("description") or ""
                    if scar_suffix not in current_desc:
                        admin.table("zones").update({
                            "description": current_desc + scar_suffix,
                        }).eq("id", zone_id).execute()

            if seen_zones:
                logger.info(
                    "Scarred %d zone(s) from resolved %s/%s arc",
                    len(seen_zones), arc_type, signature,
                    extra={
                        "simulation_id": str(sim_id),
                        "arc_id": arc.get("id"),
                        "zones_scarred": len(seen_zones),
                    },
                )
        except Exception:
            logger.warning(
                "Failed to scar zones for arc %s", arc.get("id"),
                extra={"simulation_id": str(sim_id)},
                exc_info=True,
            )

    # ── Query Methods (for API) ─────────────────────────────────

    @classmethod
    async def list_arcs(
        cls, supabase: Client, sim_id: UUID,
        status_filter: str | None = None,
        limit: int = 50, offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List narrative arcs for a simulation."""
        query = (
            supabase.table("narrative_arcs")
            .select("*", count="exact")
            .eq("simulation_id", str(sim_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        response = query.execute()
        return response.data or [], response.count or 0

    @classmethod
    async def get_arc(cls, supabase: Client, sim_id: UUID, arc_id: UUID) -> dict | None:
        """Get a single narrative arc."""
        response = (
            supabase.table("narrative_arcs")
            .select("*")
            .eq("id", str(arc_id))
            .eq("simulation_id", str(sim_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None


