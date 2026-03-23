"""Resonance → Instagram Story pipeline.

Generates and schedules Instagram Story sequences from substrate resonance
impacts. Each resonance produces 3-5 Stories posted over 1-2 hours, creating
a narrative arc: Detection → Classification → Impact(s) → Advisory → Subsiding.

Stories are the Bureau's emergency broadcast channel. They're ephemeral because
classified transmissions are time-limited.

Database: ``social_stories`` table (migration 143).
Platform settings: 9 keys prefixed ``resonance_stories_`` (migration 143).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import sentry_sdk

from backend.models.resonance import ARCHETYPE_DESCRIPTIONS
from backend.models.social_story import ARCHETYPE_COLORS, ARCHETYPE_OPERATIVE_ALIGNMENT
from backend.services.base_service import serialize_for_json
from backend.services.instagram_image_composer import InstagramImageComposer
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Throttle defaults (overridden by platform_settings)
_DEFAULT_AUTO_MAGNITUDE = 0.5
_DEFAULT_MAX_SEQUENCES_PER_DAY = 1
_DEFAULT_COOLDOWN_HOURS = 6
_DEFAULT_ARCHETYPE_DEDUP_HOURS = 48
_DEFAULT_CATASTROPHIC_THRESHOLD = 0.8
_DEFAULT_IMPACT_THRESHOLD = 0.4
_DEFAULT_FEED_POST_RESERVE = 10

# Story timing offsets (minutes from resonance impact)
_DETECTION_DELAY = 0
_CLASSIFICATION_DELAY = 15
_IMPACT_BASE_DELAY = 30
_IMPACT_STAGGER = 10  # +10 min per additional simulation
_ADVISORY_DELAY = 60
_MAX_RETRIES = 3


class SocialStoryService:
    """Generates and schedules Instagram Stories from resonance impacts."""

    # ── CRUD ───────────────────────────────────────────────────────────────

    @staticmethod
    async def list_stories(
        admin: Client,
        *,
        status_filter: str | None = None,
        resonance_id: UUID | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List social stories with optional filters.

        Returns (rows, total_count).
        """
        query = admin.table("social_stories").select("*", count="exact")
        if status_filter:
            query = query.eq("status", status_filter)
        if resonance_id:
            query = query.eq("resonance_id", str(resonance_id))
        query = query.order("scheduled_at", desc=True).range(offset, offset + limit - 1)
        response = await query.execute()
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    @staticmethod
    async def get_by_id(admin: Client, story_id: UUID) -> dict | None:
        """Get a single social story by ID. Returns None if not found."""
        response = await (
            admin.table("social_stories")
            .select("*")
            .eq("id", str(story_id))
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    async def get_sequence(admin: Client, resonance_id: UUID) -> list[dict]:
        """Get all stories for a resonance, ordered by sequence index."""
        response = await (
            admin.table("social_stories")
            .select("*")
            .eq("resonance_id", str(resonance_id))
            .order("sequence_index")
            .execute()
        )
        return response.data or []

    @staticmethod
    async def update_status(
        admin: Client,
        story_id: UUID,
        status: str,
        **fields: str | None,
    ) -> dict | None:
        """Update a story's status and optional extra fields. Returns updated record."""
        payload: dict = {"status": status, **{k: v for k, v in fields.items() if v is not None}}
        response = await (
            admin.table("social_stories")
            .update(payload)
            .eq("id", str(story_id))
            .execute()
        )
        return response.data[0] if response.data else None

    @staticmethod
    async def clear_and_reset(admin: Client, story_id: UUID) -> None:
        """Reset a story to pending, clearing image and IG metadata."""
        await admin.table("social_stories").update({
            "status": "pending",
            "image_url": None,
            "ig_story_id": None,
            "ig_posted_at": None,
            "published_at": None,
            "failure_reason": None,
        }).eq("id", str(story_id)).execute()

    @staticmethod
    async def get_pipeline_settings(admin: Client) -> dict[str, str]:
        """Get all resonance story pipeline settings."""
        rows = await (
            admin.table("platform_settings")
            .select("setting_key, setting_value")
            .like("setting_key", "resonance_stories_%")
            .execute()
        ).data or []
        return {row["setting_key"]: row["setting_value"] for row in rows}

    # ── Publish / Regenerate ───────────────────────────────────────────────

    @classmethod
    async def publish_story(
        cls,
        admin: Client,
        story_id: UUID,
        ig_service: object,
    ) -> dict:
        """Force-publish a single story to Instagram.

        Composes image if needed, publishes via IG API, updates status.
        Returns the updated story record.
        Raises HTTPException on validation/publish failures.
        """
        from fastapi import HTTPException, status

        story = await cls.get_by_id(admin, story_id)
        if not story:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found.")

        if story["status"] not in ("pending", "ready"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot publish story with status '{story['status']}'.",
            )

        # Compose image if not yet ready
        if not story.get("image_url"):
            url = await cls.compose_story_image(admin, story_id)
            if not url:
                raise HTTPException(status_code=500, detail="Image composition failed.")
            story["image_url"] = url

        try:
            await cls.update_status(admin, story_id, "publishing")
            result = await ig_service.publish_story(story["image_url"])
            media_id = result.get("id", "")
            now_iso = datetime.now(UTC).isoformat()

            updated = await cls.update_status(
                admin, story_id, "published",
                published_at=now_iso,
                ig_story_id=media_id,
                ig_posted_at=now_iso,
            )
            return updated or story

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Force-publish story failed", extra={
                "story_id": str(story_id),
            })
            await cls.update_status(
                admin, story_id, "failed",
                failure_reason=f"Force-publish failed: {exc!s}"[:500],
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "force_publish_story")
                scope.set_context("story", {"story_id": str(story_id)})
                sentry_sdk.capture_exception(exc)
            raise HTTPException(
                status_code=502,
                detail=f"Force-publish failed: {exc!s}"[:200],
            ) from exc

    @classmethod
    async def regenerate_story(
        cls,
        admin: Client,
        story_id: UUID,
        ig_service: object,
    ) -> dict:
        """Delete from IG, recompose, and republish a story.

        Returns the updated story record.
        Raises HTTPException on failures.
        """
        from fastapi import HTTPException

        story = await cls.get_by_id(admin, story_id)
        if not story:
            raise HTTPException(status_code=404, detail="Story not found.")

        # Step 1: Delete from Instagram if published
        ig_story_id = story.get("ig_story_id")
        if ig_story_id:
            try:
                await ig_service.delete_media(ig_story_id)
                logger.info("Deleted story from Instagram", extra={
                    "story_id": str(story_id),
                    "ig_story_id": ig_story_id,
                })
            except Exception as exc:
                logger.warning("Could not delete story from Instagram (may have expired)", extra={
                    "story_id": str(story_id),
                    "ig_story_id": ig_story_id,
                    "error": str(exc)[:200],
                })

        # Step 2: Reset status and clear old image reference
        await cls.clear_and_reset(admin, story_id)

        # Step 3: Recompose image
        url = await cls.compose_story_image(admin, story_id)
        if not url:
            raise HTTPException(status_code=500, detail="Image recomposition failed.")

        # Step 4: Publish to Instagram
        try:
            await cls.update_status(admin, story_id, "publishing")
            result = await ig_service.publish_story(url)
            media_id = result.get("id", "")
            now_iso = datetime.now(UTC).isoformat()

            updated = await cls.update_status(
                admin, story_id, "published",
                published_at=now_iso,
                ig_story_id=media_id,
                ig_posted_at=now_iso,
            )
            return updated or story

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Regenerate publish failed", extra={
                "story_id": str(story_id),
            })
            await cls.update_status(
                admin, story_id, "failed",
                failure_reason=f"Regenerate publish failed: {exc!s}"[:500],
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("instagram_phase", "regenerate_publish")
                scope.set_context("story", {"story_id": str(story_id)})
                sentry_sdk.capture_exception(exc)
            raise HTTPException(
                status_code=502,
                detail=f"Recomposition succeeded but publish failed: {exc!s}"[:200],
            ) from exc

    # ── Story Sequence Creation ────────────────────────────────────────────

    @classmethod
    async def create_resonance_stories(
        cls,
        admin: Client,
        resonance_id: UUID,
        impacts: list[dict],
    ) -> list[dict]:
        """Create a Story sequence from resonance impact results.

        Called from ResonanceService.process_impact() after all impacts complete.
        Returns list of created social_stories records.

        Throttle checks (5 layers):
        1. Magnitude gate — below auto_magnitude → skip (admin can approve later)
        2. Daily sequence budget — max N sequences per day
        3. Archetype dedup — same archetype within 48h → simplified update
        4. Cooldown window — min 6h between sequences
        5. Shared API budget — reserve feed post slots
        """
        config = await cls._load_config(admin)
        if not config["enabled"]:
            logger.debug("Resonance stories disabled — skipping", extra={
                "resonance_id": str(resonance_id),
            })
            return []

        # Fetch resonance record
        res_resp = await (
            admin.table("substrate_resonances")
            .select("*")
            .eq("id", str(resonance_id))
            .limit(1)
            .execute()
        )
        if not res_resp.data:
            logger.warning("Resonance not found for story creation", extra={
                "resonance_id": str(resonance_id),
            })
            return []
        resonance = res_resp.data[0]
        magnitude = float(resonance.get("magnitude") or 0)
        archetype = resonance.get("archetype", "")

        # ── Throttle checks ──────────────────────────────────────────────

        is_catastrophic = magnitude >= config["catastrophic_threshold"]

        # Layer 1: Magnitude gate
        if magnitude < config["auto_magnitude"] and not is_catastrophic:
            logger.info("Resonance magnitude below auto threshold — skipping stories", extra={
                "resonance_id": str(resonance_id),
                "magnitude": magnitude,
                "threshold": config["auto_magnitude"],
            })
            return []

        # Layer 2: Daily sequence budget (catastrophic bypasses)
        if not is_catastrophic:
            today_count = await cls._count_sequences_today(admin)
            if today_count >= config["max_sequences_per_day"]:
                logger.info("Daily story sequence budget exhausted", extra={
                    "resonance_id": str(resonance_id),
                    "today_count": today_count,
                    "max": config["max_sequences_per_day"],
                })
                return []

        # Layer 3: Archetype dedup
        is_dedup = await cls._check_archetype_dedup(
            admin, archetype, config["archetype_dedup_hours"],
        )

        # Layer 4: Cooldown window (catastrophic bypasses)
        if not is_catastrophic:
            in_cooldown = await cls._check_cooldown(admin, config["cooldown_hours"])
            if in_cooldown:
                logger.info("Story cooldown active — skipping", extra={
                    "resonance_id": str(resonance_id),
                    "cooldown_hours": config["cooldown_hours"],
                })
                return []

        # Layer 5: Shared API budget
        api_ok = await cls._check_api_budget(admin, config["feed_post_reserve"])
        if not api_ok:
            logger.warning("Insufficient API budget for stories", extra={
                "resonance_id": str(resonance_id),
            })
            return []

        # ── Build story sequence ──────────────────────────────────────────

        now = datetime.now(UTC)

        # Filter to completed impacts with sufficient magnitude
        significant_impacts = [
            imp for imp in impacts
            if imp.get("status") == "completed"
            and float(imp.get("effective_magnitude") or 0) >= config["impact_threshold"]
        ]

        stories: list[dict] = []
        seq = 0

        if is_dedup:
            # Simplified single-story update for archetype dedup
            story = await cls._create_story_record(admin, {
                "resonance_id": str(resonance_id),
                "story_type": "detection",
                "sequence_index": 0,
                "status": "pending",
                "scheduled_at": now.isoformat(),
                "archetype": archetype,
                "magnitude": magnitude,
                "caption": f"CONTINUED: {archetype} resonance intensifies. Magnitude {magnitude:.2f}.",
            })
            if story:
                stories.append(story)
            return stories

        # Story 1: Detection (immediate)
        story = await cls._create_story_record(admin, {
            "resonance_id": str(resonance_id),
            "story_type": "detection",
            "sequence_index": seq,
            "status": "pending",
            "scheduled_at": (now + timedelta(minutes=_DETECTION_DELAY)).isoformat(),
            "archetype": archetype,
            "magnitude": magnitude,
            "caption": (
                f"Substrate anomaly detected. Signature: {resonance.get('resonance_signature', '')}. "
                f"Archetype: {archetype}. Magnitude: {magnitude:.2f}."
            ),
        })
        if story:
            stories.append(story)
        seq += 1

        # Story 2: Classification (+15 min)
        # Find highest susceptibility impact
        highest_susc = max(
            significant_impacts,
            key=lambda i: float(i.get("susceptibility") or 0),
            default=None,
        )
        highest_sim_name = ""
        highest_susc_val = 0.0
        if highest_susc:
            # Fetch simulation name
            sim_resp = await (
                admin.table("simulations")
                .select("name")
                .eq("id", highest_susc.get("simulation_id", ""))
                .limit(1)
                .execute()
            )
            highest_sim_name = sim_resp.data[0]["name"] if sim_resp.data else "Unknown"
            highest_susc_val = float(highest_susc.get("susceptibility") or 1.0)

        story = await cls._create_story_record(admin, {
            "resonance_id": str(resonance_id),
            "story_type": "classification",
            "sequence_index": seq,
            "status": "pending",
            "scheduled_at": (now + timedelta(minutes=_CLASSIFICATION_DELAY)).isoformat(),
            "archetype": archetype,
            "magnitude": magnitude,
            "caption": (
                f"Bureau classification: {resonance.get('source_category', '')}. "
                f"Affected shards: {len(significant_impacts)}. "
                f"Highest susceptibility: {highest_sim_name} ({highest_susc_val:.1f}x)."
            ),
        })
        if story:
            stories.append(story)
        seq += 1

        # Story 3+: Impact reports (one per high-impact simulation, staggered)
        for i, impact in enumerate(significant_impacts[:4]):  # max 4 impact stories
            sim_id = impact.get("simulation_id", "")
            eff_mag = float(impact.get("effective_magnitude") or 0)

            # Fetch simulation name, description, and events
            sim_resp = await (
                admin.table("simulations")
                .select("name, slug, description")
                .eq("id", sim_id)
                .limit(1)
                .execute()
            )
            sim_data = sim_resp.data[0] if sim_resp.data else {}
            sim_name = sim_data.get("name", "Unknown Shard")
            sim_description = sim_data.get("description", "")

            event_titles: list[str] = []
            spawned_ids = impact.get("spawned_event_ids") or []
            if spawned_ids:
                evt_resp = await (
                    admin.table("events")
                    .select("title")
                    .in_("id", [str(eid) for eid in spawned_ids[:5]])
                    .execute()
                )
                event_titles = [e["title"] for e in (evt_resp.data or [])]

            # Generate AI poetic closing line
            closing_line = await cls._generate_closing_line(
                admin, UUID(sim_id), archetype, sim_name, sim_description,
            )

            delay = _IMPACT_BASE_DELAY + (i * _IMPACT_STAGGER)
            story = await cls._create_story_record(admin, {
                "resonance_id": str(resonance_id),
                "simulation_id": sim_id,
                "story_type": "impact",
                "sequence_index": seq,
                "status": "pending",
                "scheduled_at": (now + timedelta(minutes=delay)).isoformat(),
                "archetype": archetype,
                "magnitude": magnitude,
                "effective_magnitude": eff_mag,
                "narrative_closing": closing_line,
                "caption": (
                    f"Shard impact: {sim_name}. Effective magnitude: {eff_mag:.2f}. "
                    f"Events spawned: {len(event_titles)}."
                ),
            })
            if story:
                stories.append(story)
            seq += 1

        # Story 4: Operative Advisory (+60 min, only during active epochs)
        if config["advisory_in_epochs_only"]:
            has_epoch = await cls._has_active_epoch(admin)
        else:
            has_epoch = True

        if has_epoch:
            alignment = ARCHETYPE_OPERATIVE_ALIGNMENT.get(archetype, {})
            aligned = alignment.get("aligned", [])
            opposed = alignment.get("opposed", [])

            if aligned or opposed:
                story = await cls._create_story_record(admin, {
                    "resonance_id": str(resonance_id),
                    "story_type": "advisory",
                    "sequence_index": seq,
                    "status": "pending",
                    "scheduled_at": (now + timedelta(minutes=_ADVISORY_DELAY)).isoformat(),
                    "archetype": archetype,
                    "magnitude": magnitude,
                    "caption": (
                        f"Operative advisory: {archetype} resonance active. "
                        f"Aligned: {', '.join(aligned)} (+3%). "
                        f"Opposed: {', '.join(opposed)} (-2%). "
                        "Deploy accordingly."
                    ),
                })
                if story:
                    stories.append(story)

        logger.info("Created resonance story sequence", extra={
            "resonance_id": str(resonance_id),
            "archetype": archetype,
            "magnitude": magnitude,
            "story_count": len(stories),
            "is_catastrophic": is_catastrophic,
        })
        return stories

    @classmethod
    async def create_subsiding_story(
        cls,
        admin: Client,
        resonance_id: UUID,
    ) -> dict | None:
        """Create the final subsiding story when resonance transitions to 'subsiding'.

        Called from the resonance status transition (DB trigger sets subsides_at).
        """
        config = await cls._load_config(admin)
        if not config["enabled"]:
            return None

        res_resp = await (
            admin.table("substrate_resonances")
            .select("*")
            .eq("id", str(resonance_id))
            .limit(1)
            .execute()
        )
        if not res_resp.data:
            return None
        resonance = res_resp.data[0]
        archetype = resonance.get("archetype", "")

        # Count total events spawned and shards affected
        impacts_resp = await (
            admin.table("resonance_impacts")
            .select("simulation_id, spawned_event_ids")
            .eq("resonance_id", str(resonance_id))
            .eq("status", "completed")
            .execute()
        )
        impacts = impacts_resp.data or []
        total_events = sum(
            len(imp.get("spawned_event_ids") or []) for imp in impacts
        )
        shards_affected = len(impacts)

        # Get highest sequence_index for this resonance
        existing = await (
            admin.table("social_stories")
            .select("sequence_index")
            .eq("resonance_id", str(resonance_id))
            .order("sequence_index", desc=True)
            .limit(1)
            .execute()
        )
        next_seq = (existing.data[0]["sequence_index"] + 1) if existing.data else 0

        story = await cls._create_story_record(admin, {
            "resonance_id": str(resonance_id),
            "story_type": "subsiding",
            "sequence_index": next_seq,
            "status": "pending",
            "scheduled_at": datetime.now(UTC).isoformat(),
            "archetype": archetype,
            "magnitude": float(resonance.get("magnitude") or 0),
            "caption": (
                f"Substrate stabilizing. {archetype} resonance subsiding. "
                f"{total_events} events spawned across {shards_affected} shards. "
                "The trembling fades. The scars remain."
            ),
        })

        if story:
            logger.info("Created subsiding story", extra={
                "resonance_id": str(resonance_id),
                "archetype": archetype,
                "total_events": total_events,
                "shards_affected": shards_affected,
            })
        return story

    # ── Image Composition ─────────────────────────────────────────────────

    @classmethod
    async def compose_story_image(
        cls,
        admin: Client,
        story_id: UUID,
    ) -> str | None:
        """Compose the story image and upload to staging. Returns storage URL.

        Reads story record, selects template by story_type, composes 1080×1920
        image, uploads to Supabase storage, and updates the record.
        """
        resp = await (
            admin.table("social_stories")
            .select("*")
            .eq("id", str(story_id))
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None
        story = resp.data[0]

        # Update status to composing
        await admin.table("social_stories").update(
            {"status": "composing"},
        ).eq("id", str(story_id)).execute()

        composer = InstagramImageComposer(admin)
        story_type = story["story_type"]
        archetype = story.get("archetype") or ""
        accent_hex = ARCHETYPE_COLORS.get(archetype, "#e2e8f0")
        magnitude = float(story.get("magnitude") or 0)

        try:
            if story_type == "detection":
                jpeg_bytes = cls._compose_detection(composer, story, accent_hex, magnitude)
            elif story_type == "classification":
                jpeg_bytes = await cls._compose_classification(
                    composer, admin, story, accent_hex,
                )
            elif story_type == "impact":
                jpeg_bytes = await cls._compose_impact(
                    composer, admin, story, accent_hex,
                )
            elif story_type == "advisory":
                jpeg_bytes = cls._compose_advisory(composer, story, accent_hex)
            elif story_type == "subsiding":
                jpeg_bytes = await cls._compose_subsiding(composer, admin, story, accent_hex)
            else:
                logger.warning("Unknown story type — cannot compose", extra={
                    "story_id": str(story_id),
                    "story_type": story_type,
                })
                await admin.table("social_stories").update(
                    {"status": "failed", "failure_reason": f"Unknown story type: {story_type}"},
                ).eq("id", str(story_id)).execute()
                return None

            # Upload to staging
            resonance_id = story.get("resonance_id") or "unknown"
            url = await composer.upload_to_staging(
                jpeg_bytes,
                simulation_id=f"stories/{resonance_id}",
                post_id=str(story_id),
            )

            # Update record
            await admin.table("social_stories").update({
                "image_url": url,
                "status": "ready",
            }).eq("id", str(story_id)).execute()

            logger.info("Composed story image", extra={
                "story_id": str(story_id),
                "story_type": story_type,
                "image_size": len(jpeg_bytes),
            })
            return url

        except Exception as exc:
            logger.exception("Story image composition failed", extra={
                "story_id": str(story_id),
                "story_type": story_type,
            })
            await admin.table("social_stories").update({
                "status": "failed",
                "failure_reason": f"Image composition failed: {exc!s}"[:500],
            }).eq("id", str(story_id)).execute()
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("social_story_phase", "compose")
                scope.set_context("story", {
                    "story_id": str(story_id),
                    "story_type": story_type,
                })
                sentry_sdk.capture_exception(exc)
            return None

    # ── Compose Helpers ───────────────────────────────────────────────────

    @staticmethod
    def _compose_detection(
        composer: InstagramImageComposer,
        story: dict,
        accent_hex: str,
        magnitude: float,
    ) -> bytes:
        """Compose detection alert image."""
        archetype = story.get("archetype") or ""
        return composer.compose_story_detection(
            archetype=archetype,
            signature=archetype.lower().replace("the ", "").replace(" ", "_"),
            magnitude=magnitude,
            accent_hex=accent_hex,
        )

    @staticmethod
    async def _compose_classification(
        composer: InstagramImageComposer,
        admin: Client,
        story: dict,
        accent_hex: str,
    ) -> bytes:
        """Compose classification document image."""
        resonance_id = story.get("resonance_id", "")
        archetype = story.get("archetype") or ""

        # Fetch resonance for source_category and bureau_dispatch
        res_resp = await (
            admin.table("substrate_resonances")
            .select("source_category, bureau_dispatch")
            .eq("id", resonance_id)
            .limit(1)
            .execute()
        )
        res_data = res_resp.data[0] if res_resp.data else {}

        # Count impacts
        impacts_resp = await (
            admin.table("resonance_impacts")
            .select("simulation_id, susceptibility, simulations(name)")
            .eq("resonance_id", resonance_id)
            .eq("status", "completed")
            .order("susceptibility", desc=True)
            .execute()
        )
        impacts = impacts_resp.data or []
        highest = impacts[0] if impacts else {}
        sim_data = highest.get("simulations") or {}

        return composer.compose_story_classification(
            archetype=archetype,
            source_category=res_data.get("source_category", "unknown"),
            affected_shard_count=len(impacts),
            highest_susceptibility_sim=sim_data.get("name", "Unknown"),
            highest_susceptibility_val=float(highest.get("susceptibility") or 1.0),
            bureau_dispatch=res_data.get("bureau_dispatch"),
            accent_hex=accent_hex,
        )

    @staticmethod
    async def _compose_impact(
        composer: InstagramImageComposer,
        admin: Client,
        story: dict,
        accent_hex: str,
    ) -> bytes:
        """Compose per-simulation cinematic impact report image.

        Fetches simulation banner, agent portraits, and reaction quotes to
        build a hero slide with blurred photo background, circular portraits,
        and reaction cards. Falls back gracefully to text-only if assets are
        unavailable.
        """
        sim_id = story.get("simulation_id")
        eff_mag = float(story.get("effective_magnitude") or story.get("magnitude") or 0)
        resonance_id = story.get("resonance_id", "")

        # Fetch simulation name, banner, and theme color
        sim_name = "Unknown Shard"
        sim_color = None
        banner_url = None
        if sim_id:
            sim_resp = await (
                admin.table("simulations")
                .select("name, slug, banner_url")
                .eq("id", sim_id)
                .limit(1)
                .execute()
            )
            if sim_resp.data:
                sim_name = sim_resp.data[0]["name"]
                banner_url = sim_resp.data[0].get("banner_url")
            # Fetch simulation design settings for color
            settings_resp = await (
                admin.table("simulation_settings")
                .select("setting_value")
                .eq("simulation_id", sim_id)
                .eq("setting_key", "color_primary")
                .limit(1)
                .execute()
            )
            if settings_resp.data:
                sim_color = str(settings_resp.data[0].get("setting_value", "")).strip('"')

        # Fetch spawned event IDs
        impact_resp = await (
            admin.table("resonance_impacts")
            .select("spawned_event_ids")
            .eq("resonance_id", resonance_id)
            .eq("simulation_id", sim_id or "")
            .limit(1)
            .execute()
        )
        spawned_ids = (impact_resp.data[0].get("spawned_event_ids") or []) if impact_resp.data else []
        event_titles: list[str] = []
        if spawned_ids:
            evt_resp = await (
                admin.table("events")
                .select("title")
                .in_("id", [str(eid) for eid in spawned_ids[:5]])
                .execute()
            )
            event_titles = [e["title"] for e in (evt_resp.data or [])]

        # Fetch agent reactions + portrait URLs for spawned events
        portrait_candidates: list[dict] = []
        reaction_data: list[dict] = []
        if spawned_ids:
            rxn_resp = await (
                admin.table("event_reactions")
                .select(
                    "agent_name, reaction_text, emotion, confidence_score,"
                    " agent_id, agents(portrait_image_url)",
                )
                .in_("event_id", [str(eid) for eid in spawned_ids])
                .order("confidence_score", desc=True)
                .limit(12)
                .execute()
            )
            # Deduplicate by agent — keep highest confidence per agent
            seen_agents: set[str] = set()
            for rxn in rxn_resp.data or []:
                agent_id = rxn.get("agent_id", "")
                if agent_id in seen_agents:
                    continue
                seen_agents.add(agent_id)

                agent_data = rxn.get("agents") or {}
                portrait_url = agent_data.get("portrait_image_url")
                if portrait_url and len(portrait_candidates) < 4:
                    portrait_candidates.append({
                        "url": portrait_url,
                        "agent_name": rxn["agent_name"],
                    })
                if len(reaction_data) < 3:
                    reaction_data.append({
                        "agent_name": rxn["agent_name"],
                        "text": rxn["reaction_text"],
                        "emotion": rxn.get("emotion"),
                    })

        # Download banner + portraits concurrently
        urls_to_download: list[tuple[str, str]] = []
        if banner_url:
            urls_to_download.append(("banner", banner_url))
        for i, p in enumerate(portrait_candidates):
            urls_to_download.append((f"portrait_{i}", p["url"]))

        downloaded: dict[str, bytes] = {}
        if urls_to_download:
            results = await asyncio.gather(
                *[
                    InstagramImageComposer._download_image_safe(url)
                    for _, url in urls_to_download
                ],
            )
            for (label, _), result in zip(urls_to_download, results, strict=True):
                if result is not None:
                    downloaded[label] = result

        # Build portrait data with downloaded bytes
        portraits: list[dict] = []
        for i, p in enumerate(portrait_candidates):
            img_bytes = downloaded.get(f"portrait_{i}")
            if img_bytes:
                portraits.append({
                    "image_bytes": img_bytes,
                    "agent_name": p["agent_name"],
                })

        return composer.compose_story_impact(
            simulation_name=sim_name,
            effective_magnitude=eff_mag,
            events_spawned=event_titles,
            narrative_closing=story.get("narrative_closing"),
            accent_hex=accent_hex,
            sim_color_hex=sim_color,
            banner_bytes=downloaded.get("banner"),
            portraits=portraits,
            reactions=reaction_data,
        )

    @staticmethod
    def _compose_advisory(
        composer: InstagramImageComposer,
        story: dict,
        accent_hex: str,
    ) -> bytes:
        """Compose operative advisory image."""
        archetype = story.get("archetype") or ""
        alignment = ARCHETYPE_OPERATIVE_ALIGNMENT.get(archetype, {})
        return composer.compose_story_advisory(
            archetype=archetype,
            aligned_types=alignment.get("aligned", []),
            opposed_types=alignment.get("opposed", []),
            zone_name=None,  # Zone info requires per-epoch context; omit for now
            accent_hex=accent_hex,
        )

    @staticmethod
    async def _compose_subsiding(
        composer: InstagramImageComposer,
        admin: Client,
        story: dict,
        accent_hex: str,
    ) -> bytes:
        """Compose subsiding/resolution image with actual event/shard counts."""
        archetype = story.get("archetype") or ""
        resonance_id = story.get("resonance_id")

        events_total = 0
        shards_affected = 0
        if resonance_id:
            impacts_resp = await (
                admin.table("resonance_impacts")
                .select("simulation_id, spawned_event_ids")
                .eq("resonance_id", resonance_id)
                .eq("status", "completed")
                .execute()
            )
            impacts = impacts_resp.data or []
            shards_affected = len(impacts)
            events_total = sum(
                len(imp.get("spawned_event_ids") or []) for imp in impacts
            )

        return composer.compose_story_subsiding(
            archetype=archetype,
            events_spawned_total=events_total,
            shards_affected=shards_affected,
            accent_hex=accent_hex,
        )

    # ── Throttle Checks ───────────────────────────────────────────────────

    @staticmethod
    async def _count_sequences_today(admin: Client) -> int:
        """Count how many story sequences were created today (UTC)."""
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        resp = await (
            admin.table("social_stories")
            .select("resonance_id", count="exact")
            .gte("created_at", today_start.isoformat())
            .eq("sequence_index", 0)  # Count first stories = count sequences
            .not_.eq("status", "skipped")
            .execute()
        )
        return resp.count if resp.count is not None else 0

    @staticmethod
    async def _check_archetype_dedup(
        admin: Client, archetype: str, dedup_hours: int,
    ) -> bool:
        """Check if this archetype already had a sequence within the dedup window.

        Returns True if dedup applies (should use simplified update).
        """
        cutoff = (datetime.now(UTC) - timedelta(hours=dedup_hours)).isoformat()
        resp = await (
            admin.table("social_stories")
            .select("id", count="exact")
            .eq("archetype", archetype)
            .eq("sequence_index", 0)
            .gte("created_at", cutoff)
            .not_.eq("status", "skipped")
            .execute()
        )
        count = resp.count if resp.count is not None else 0
        return count > 0

    @staticmethod
    async def _check_cooldown(admin: Client, cooldown_hours: int) -> bool:
        """Check if the cooldown window is still active.

        Returns True if within cooldown (should skip).
        """
        cutoff = (datetime.now(UTC) - timedelta(hours=cooldown_hours)).isoformat()
        resp = await (
            admin.table("social_stories")
            .select("published_at")
            .eq("status", "published")
            .gte("published_at", cutoff)
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        return bool(resp.data)

    @staticmethod
    async def _check_api_budget(admin: Client, feed_reserve: int) -> bool:
        """Check if there are enough API slots after reserving for feed posts.

        Instagram limit: 50 posts/24h (stories + feed posts combined).
        We reserve `feed_reserve` slots for feed posts.
        """
        cutoff = (datetime.now(UTC) - timedelta(hours=24)).isoformat()

        # Count published stories in last 24h
        story_resp = await (
            admin.table("social_stories")
            .select("id", count="exact")
            .eq("status", "published")
            .gte("published_at", cutoff)
            .execute()
        )
        story_count = story_resp.count if story_resp.count is not None else 0

        # Count published feed posts in last 24h
        post_resp = await (
            admin.table("instagram_posts")
            .select("id", count="exact")
            .eq("status", "published")
            .gte("published_at", cutoff)
            .execute()
        )
        post_count = post_resp.count if post_resp.count is not None else 0

        total_used = story_count + post_count
        remaining = 50 - total_used
        # Need at least feed_reserve for posts + 5 for the incoming sequence
        return remaining >= (feed_reserve + 5)

    @staticmethod
    async def _has_active_epoch(admin: Client) -> bool:
        """Check if any epoch is currently active."""
        resp = await (
            admin.table("game_epochs")
            .select("id", count="exact")
            .in_("status", ["lobby", "foundation", "competition", "reckoning"])
            .execute()
        )
        return (resp.count or 0) > 0

    # ── Config ────────────────────────────────────────────────────────────

    @staticmethod
    async def _load_config(admin: Client) -> dict:
        """Load resonance story config from platform_settings."""
        config = {
            "enabled": False,
            "auto_magnitude": _DEFAULT_AUTO_MAGNITUDE,
            "max_sequences_per_day": _DEFAULT_MAX_SEQUENCES_PER_DAY,
            "cooldown_hours": _DEFAULT_COOLDOWN_HOURS,
            "archetype_dedup_hours": _DEFAULT_ARCHETYPE_DEDUP_HOURS,
            "catastrophic_threshold": _DEFAULT_CATASTROPHIC_THRESHOLD,
            "advisory_in_epochs_only": True,
            "impact_threshold": _DEFAULT_IMPACT_THRESHOLD,
            "feed_post_reserve": _DEFAULT_FEED_POST_RESERVE,
        }

        try:
            rows = await (
                admin.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "resonance_stories_enabled",
                    "resonance_stories_auto_magnitude",
                    "resonance_stories_max_sequences_per_day",
                    "resonance_stories_cooldown_hours",
                    "resonance_stories_archetype_dedup_hours",
                    "resonance_stories_catastrophic_threshold",
                    "resonance_stories_advisory_in_epochs_only",
                    "resonance_stories_impact_threshold",
                    "resonance_stories_feed_post_reserve",
                ])
                .execute()
            ).data or []

            m: dict[str, str] = {r["setting_key"]: r["setting_value"] for r in rows}

            config["enabled"] = _parse_bool(m.get("resonance_stories_enabled", "false"))
            config["advisory_in_epochs_only"] = _parse_bool(
                m.get("resonance_stories_advisory_in_epochs_only", "true"),
            )

            for key, setting_key, default in [
                ("auto_magnitude", "resonance_stories_auto_magnitude", _DEFAULT_AUTO_MAGNITUDE),
                ("catastrophic_threshold", "resonance_stories_catastrophic_threshold", _DEFAULT_CATASTROPHIC_THRESHOLD),
                ("impact_threshold", "resonance_stories_impact_threshold", _DEFAULT_IMPACT_THRESHOLD),
            ]:
                try:
                    config[key] = float(m.get(setting_key, str(default)))
                except (ValueError, TypeError):
                    pass

            for key, setting_key, default in [
                ("max_sequences_per_day", "resonance_stories_max_sequences_per_day", _DEFAULT_MAX_SEQUENCES_PER_DAY),
                ("cooldown_hours", "resonance_stories_cooldown_hours", _DEFAULT_COOLDOWN_HOURS),
                ("archetype_dedup_hours", "resonance_stories_archetype_dedup_hours", _DEFAULT_ARCHETYPE_DEDUP_HOURS),
                ("feed_post_reserve", "resonance_stories_feed_post_reserve", _DEFAULT_FEED_POST_RESERVE),
            ]:
                try:
                    config[key] = int(m.get(setting_key, str(default)))
                except (ValueError, TypeError):
                    pass

        except Exception:
            logger.warning("Failed to load resonance story config — using defaults")

        return config

    # ── AI Generation ─────────────────────────────────────────────────────

    @staticmethod
    async def _generate_closing_line(
        admin: Client,
        simulation_id: UUID,
        archetype: str,
        simulation_name: str,
        simulation_description: str,
    ) -> str | None:
        """Generate a poetic one-sentence closing line for an impact story.

        Uses GenerationService with template ``story_closing_line`` (migration 143).
        Returns None if AI is unavailable or generation fails (non-fatal).
        """
        try:
            from backend.services.external_service_resolver import ExternalServiceResolver
            from backend.services.generation_service import GenerationService

            resolver = ExternalServiceResolver(admin, simulation_id)
            ai_config = await resolver.get_ai_provider_config()
            gen_service = GenerationService(admin, simulation_id, ai_config.openrouter_api_key)

            return await gen_service.generate_story_closing_line(
                archetype_name=archetype,
                archetype_description=ARCHETYPE_DESCRIPTIONS.get(archetype, ""),
                simulation_name=simulation_name,
                simulation_description=simulation_description,
            )
        except Exception:
            logger.debug("AI closing line generation unavailable", exc_info=True)
            return None

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    async def _create_story_record(admin: Client, data: dict) -> dict | None:
        """Insert a social_stories row. Returns the created record or None."""
        try:
            insert_data = serialize_for_json(data)
            resp = await admin.table("social_stories").insert(insert_data).execute()
            return resp.data[0] if resp.data else None
        except Exception:
            logger.exception("Failed to create social story record", extra={
                "story_type": data.get("story_type"),
                "resonance_id": data.get("resonance_id"),
            })
            return None


def _parse_bool(value: str) -> bool:
    """Parse a string as a boolean."""
    return str(value).lower().strip('"') not in ("false", "0", "no", "")
