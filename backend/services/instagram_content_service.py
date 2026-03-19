"""Instagram content pipeline — selects, composes, and stages content for publishing.

This is a platform-level orchestration service (not simulation-scoped CRUD).
Pattern follows ChronicleService: classmethod-based, stateless, uses GenerationService
for AI caption generation and InstagramImageComposer for visual preparation.

Content flow:
  fn_select_instagram_candidates() → generate caption → compose image → stage as draft
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status

from backend.config import settings
from backend.services.generation_service import GenerationService
from backend.services.instagram_image_composer import InstagramImageComposer
from supabase import Client

logger = logging.getLogger(__name__)

# Bureau dispatch counter — persisted via MAX(dispatch_number) pattern
_AI_DISCLOSURE_FOOTER = "\n\n—\nAI-generated content from metaverse.center"

# Hashtag presets
_BRAND_TAGS = ["#BureauOfImpossibleGeography", "#SubstrateDispatch"]
_DISCOVERY_TAGS = ["#worldbuilding", "#AIart", "#speculativefiction"]

# Content type weights (overridable via platform_settings.instagram_content_mix).
# Weights are proportional: agent=3, building=2 means ~60% agents, ~40% buildings.
# Set a weight to 0 to disable that content type entirely.
DEFAULT_CONTENT_MIX: dict[str, int] = {
    "agent": 3,
    "building": 2,
    "chronicle": 2,
    "lore": 1,
}

# Caption templates (hardcoded fallbacks — prompt_templates DB entries take priority)
CAPTION_TEMPLATES = {
    "agent": (
        "BUREAU OF IMPOSSIBLE GEOGRAPHY\n"
        "DISPATCH [{dispatch_number:04d}] | {date}\n"
        "CLASSIFICATION: {classification}\n"
        "RE: {simulation_name} — Personnel File\n\n"
        "{body}\n\n"
        "ADDENDUM: Filing Clerk's Note — "
        "This operative's dossier was flagged during routine archival review. "
        "External observers are advised to note the details carefully."
    ),
    "building": (
        "BUREAU OF IMPOSSIBLE GEOGRAPHY\n"
        "DISPATCH [{dispatch_number:04d}] | {date}\n"
        "CLASSIFICATION: {classification}\n"
        "RE: {simulation_name} — Shard Surveillance\n\n"
        "{body}\n\n"
        "ADDENDUM: Filing Clerk's Note — "
        "This structure has been under continuous Bureau observation. "
        "Structural anomalies are being monitored."
    ),
    "chronicle": (
        "BUREAU OF IMPOSSIBLE GEOGRAPHY\n"
        "DISPATCH [{dispatch_number:04d}] | {date}\n"
        "CLASSIFICATION: AMBER\n"
        "RE: {simulation_name} — Chronicle Edition #{edition_number}\n\n"
        "{body}\n\n"
        "ADDENDUM: Filing Clerk's Note — "
        "This chronicle was intercepted during routine substrate monitoring. "
        "Read the full dispatch at metaverse.center."
    ),
}


class InstagramContentService:
    """Selects, composes, and stages content for the Instagram pipeline."""

    @classmethod
    async def select_candidates(
        cls,
        admin_supabase: Client,
        content_types: list[str] | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """Select unposted content candidates via Postgres RPC.

        Returns a list of candidate dicts with content_type, id, name,
        image_url, simulation metadata, etc.
        """
        types = content_types or list(DEFAULT_CONTENT_MIX.keys())
        response = admin_supabase.rpc(
            "fn_select_instagram_candidates",
            {"p_content_types": types, "p_limit": limit},
        ).execute()

        candidates = response.data if response.data else []
        # RPC returns jsonb — may be a list or nested
        if isinstance(candidates, str):
            candidates = json.loads(candidates)
        if not isinstance(candidates, list):
            candidates = []

        logger.info(
            "Selected %d Instagram candidates across types %s",
            len(candidates),
            types,
            extra={"candidate_count": len(candidates), "content_types": types},
        )
        return candidates

    @classmethod
    async def generate_post_from_candidate(
        cls,
        admin_supabase: Client,
        candidate: dict,
        *,
        user_id: UUID | None = None,
    ) -> dict:
        """Generate a complete Instagram post draft from a content candidate.

        Steps:
          1. Get next dispatch number
          2. Generate Bureau caption (AI or template fallback)
          3. Compose Instagram-ready image (AVIF → JPEG + overlay)
          4. Upload to staging bucket
          5. Insert draft into instagram_posts

        Returns the created instagram_posts row.
        """
        content_type = candidate["content_type"]
        entity_id = candidate.get("id")
        simulation_id = candidate.get("simulation_id")
        simulation_name = candidate.get("simulation_name", "Unknown Shard")
        simulation_slug = candidate.get("simulation_slug", "")
        image_url = candidate.get("image_url") or candidate.get("portrait_image_url")
        # Lore entries store image_slug, not full URL — resolve it
        if not image_url and content_type == "lore" and candidate.get("image_slug"):
            from backend.config import settings
            image_url = (
                f"{settings.supabase_url}/storage/v1/object/public/"
                f"simulation.assets/{simulation_slug}/{candidate['image_slug']}.avif"
            )

        # 1. Next dispatch number
        dispatch_number = await cls._get_next_dispatch_number(admin_supabase)

        # 2. Generate caption
        caption = await cls._generate_caption(
            admin_supabase,
            candidate,
            dispatch_number=dispatch_number,
            simulation_id=UUID(simulation_id) if simulation_id else None,
        )

        # 3. Build hashtags
        hashtags = cls._build_hashtags(simulation_slug, content_type)

        # 4. Generate alt text
        alt_text = cls._generate_alt_text(candidate)

        # 5. Compose image
        image_urls = []
        if image_url:
            composer = InstagramImageComposer(admin_supabase)
            sim_colors = await cls._get_simulation_colors(admin_supabase, simulation_id)

            if content_type == "agent":
                jpeg_bytes = await composer.compose_agent_dossier(
                    portrait_url=image_url,
                    agent_name=candidate.get("name", "Unknown"),
                    simulation_name=simulation_name,
                    color_primary=sim_colors.get("color_primary", "#e2e8f0"),
                    color_background=sim_colors.get("color_background", "#0f172a"),
                )
            elif content_type == "building":
                jpeg_bytes = await composer.compose_building_surveillance(
                    image_url=image_url,
                    building_name=candidate.get("name", "Unknown"),
                    simulation_name=simulation_name,
                    color_primary=sim_colors.get("color_primary", "#e2e8f0"),
                    color_background=sim_colors.get("color_background", "#0f172a"),
                )
            else:
                jpeg_bytes = await composer.compose_bureau_dispatch(
                    source_image_url=image_url,
                    dispatch_number=dispatch_number,
                    simulation_name=simulation_name,
                    color_primary=sim_colors.get("color_primary", "#e2e8f0"),
                    color_background=sim_colors.get("color_background", "#0f172a"),
                )

            staging_url = await composer.upload_to_staging(
                jpeg_bytes,
                simulation_id=simulation_id or "platform",
            )
            image_urls.append(staging_url)
        else:
            # Text-only dispatches (chronicles) — generate background
            composer = InstagramImageComposer(admin_supabase)
            sim_colors = await cls._get_simulation_colors(admin_supabase, simulation_id)
            jpeg_bytes = await composer.compose_bureau_dispatch(
                source_image_url=None,
                dispatch_number=dispatch_number,
                simulation_name=simulation_name,
                color_primary=sim_colors.get("color_primary", "#e2e8f0"),
                color_background=sim_colors.get("color_background", "#0f172a"),
                classification="AMBER",
            )
            staging_url = await composer.upload_to_staging(
                jpeg_bytes,
                simulation_id=simulation_id or "platform",
            )
            image_urls.append(staging_url)

        # 6. Content moderation check
        moderation = await cls._moderate_caption(admin_supabase, caption)
        if moderation["blocked"]:
            logger.warning(
                "Caption blocked by moderation: %s (reason: %s)",
                candidate.get("name", "?"),
                moderation["reason"],
                extra={
                    "content_type": content_type,
                    "candidate_id": entity_id,
                    "simulation_id": simulation_id,
                    "moderation_reason": moderation["reason"],
                },
            )
            return {"id": None, "status": "rejected", "failure_reason": moderation["reason"]}

        # 7. Cipher ARG integration — generate unlock code if enabled
        unlock_code = None
        try:
            cipher_resp = (
                admin_supabase.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", [
                    "instagram_cipher_enabled",
                    "instagram_cipher_difficulty",
                    "instagram_cipher_hint_format",
                ])
                .execute()
            )
            cipher_settings: dict[str, str] = {}
            for row in cipher_resp.data or []:
                cipher_settings[row["setting_key"]] = row["setting_value"]

            raw_enabled = str(cipher_settings.get("instagram_cipher_enabled", "false")).lower()
            cipher_enabled = raw_enabled not in ("false", "0", "no", "")
            if cipher_enabled and simulation_id:
                from backend.services.cipher_service import CipherService
                cipher_difficulty = cipher_settings.get("instagram_cipher_difficulty", "medium")
                cipher_hint_format = cipher_settings.get("instagram_cipher_hint_format", "footer")

                unlock_code = await CipherService.generate_code(
                    admin_supabase,
                    difficulty=cipher_difficulty,
                    simulation_id=UUID(simulation_id),
                )
                caption = CipherService.embed_cipher_hint(
                    caption, unlock_code, cipher_difficulty, cipher_hint_format,
                )
                logger.info("Cipher code generated for draft", extra={
                    "unlock_code_prefix": unlock_code[:8] if unlock_code else "",
                    "difficulty": cipher_difficulty,
                    "simulation_id": simulation_id,
                })
        except Exception:
            logger.warning("Cipher generation failed, proceeding without cipher", exc_info=True)

        # 8. Build content snapshot (frozen entity data)
        snapshot = cls._build_snapshot(candidate)

        # 9. Insert draft
        record = {
            "simulation_id": simulation_id,
            "content_source_type": content_type,
            "content_source_id": entity_id,
            "content_source_snapshot": json.dumps(snapshot, default=str),
            "caption": caption,
            "hashtags": hashtags,
            "alt_text": alt_text,
            "image_urls": image_urls,
            "media_type": "IMAGE",
            "status": "draft",
            "unlock_code": unlock_code,
            "ai_disclosure_included": True,
            "created_by_id": str(user_id) if user_id else None,
        }

        resp = (
            admin_supabase.table("instagram_posts")
            .insert(record)
            .execute()
        )
        saved = resp.data[0] if resp.data else record

        logger.info(
            "Created Instagram draft: %s (%s) for %s",
            saved.get("id"),
            content_type,
            simulation_name,
            extra={
                "post_id": saved.get("id"),
                "content_type": content_type,
                "candidate_id": entity_id,
                "simulation_id": simulation_id,
                "simulation_name": simulation_name,
                "dispatch_number": dispatch_number,
            },
        )
        return saved

    @classmethod
    async def generate_batch(
        cls,
        admin_supabase: Client,
        content_types: list[str] | None = None,
        count: int = 1,
        simulation_id: UUID | None = None,
        user_id: UUID | None = None,
    ) -> list[dict]:
        """Generate multiple post drafts from available candidates.

        Returns list of created instagram_posts rows.
        """
        candidates = await cls.select_candidates(
            admin_supabase,
            content_types=content_types,
            limit=count * 3,  # fetch extra for filtering
        )

        # Filter to specific simulation if requested
        if simulation_id:
            candidates = [
                c for c in candidates
                if c.get("simulation_id") == str(simulation_id)
            ]

        # Load configurable content mix from platform_settings
        mix = dict(DEFAULT_CONTENT_MIX)
        try:
            mix_resp = (
                admin_supabase.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", "instagram_content_mix")
                .limit(1)
                .execute()
            )
            if mix_resp.data:
                mix = json.loads(mix_resp.data[0]["setting_value"])
        except Exception:
            logger.debug("Failed to load instagram_content_mix, using defaults")

        # Distribute count across types proportionally to weights.
        # Example: mix={"agent":3,"building":2,"chronicle":2}, count=5
        #   → agent=2, building=1, chronicle=1, remaining=1 → agent=3
        selected = cls._select_weighted(candidates, mix, count)

        results = []
        for candidate in selected:
            try:
                post = await cls.generate_post_from_candidate(
                    admin_supabase, candidate, user_id=user_id,
                )
                results.append(post)
            except Exception as exc:
                logger.exception(
                    "Failed to generate post for candidate %s",
                    candidate.get("id"),
                    extra={
                        "candidate_id": candidate.get("id"),
                        "content_type": candidate.get("content_type"),
                        "simulation_id": candidate.get("simulation_id"),
                    },
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "content_generation")
                    scope.set_context("instagram", {
                        "candidate_id": str(candidate.get("id")),
                        "content_type": candidate.get("content_type"),
                        "simulation_id": str(candidate.get("simulation_id")),
                    })
                    sentry_sdk.capture_exception(exc)

        return results

    @staticmethod
    def _select_weighted(
        candidates: list[dict],
        mix: dict[str, int],
        count: int,
    ) -> list[dict]:
        """Select candidates proportionally to content mix weights.

        Given mix={"agent": 3, "building": 2, "chronicle": 2, "lore": 1}
        and count=8, allocates: agent=3, building=2, chronicle=2, lore=1.
        Remaining slots (if any) go round-robin to types with available candidates.
        Diversifies across simulations within each type via round-robin.
        """
        import random

        # Group candidates by type
        by_type: dict[str, list[dict]] = {}
        for c in candidates:
            ct = c.get("content_type", "")
            by_type.setdefault(ct, []).append(c)

        # Shuffle within each type for variety across simulations
        for items in by_type.values():
            random.shuffle(items)

        # Diversify: within each type, round-robin across simulations
        for ct in by_type:
            items = by_type[ct]
            sim_buckets: dict[str, list[dict]] = {}
            for c in items:
                sid = c.get("simulation_id", "")
                sim_buckets.setdefault(sid, []).append(c)
            # Interleave from different simulations
            interleaved: list[dict] = []
            bucket_iters = [iter(v) for v in sim_buckets.values()]
            random.shuffle(bucket_iters)
            while bucket_iters:
                next_round = []
                for it in bucket_iters:
                    val = next(it, None)
                    if val is not None:
                        interleaved.append(val)
                        next_round.append(it)
                bucket_iters = next_round
            by_type[ct] = interleaved

        # Calculate proportional slots per type
        total_weight = sum(mix.get(ct, 0) for ct in mix if mix.get(ct, 0) > 0)
        if total_weight == 0:
            return candidates[:count]

        slots: dict[str, int] = {}
        allocated = 0
        for ct, weight in sorted(mix.items(), key=lambda x: -x[1]):
            if weight <= 0:
                continue
            n = max(1, round(count * weight / total_weight))
            n = min(n, count - allocated, len(by_type.get(ct, [])))
            slots[ct] = n
            allocated += n

        # Fill remaining slots round-robin from types with leftover candidates
        remaining = count - allocated
        if remaining > 0:
            for ct in sorted(mix.keys(), key=lambda x: -mix.get(x, 0)):
                available = len(by_type.get(ct, [])) - slots.get(ct, 0)
                if available > 0:
                    take = min(remaining, available)
                    slots[ct] = slots.get(ct, 0) + take
                    remaining -= take
                if remaining <= 0:
                    break

        # Pick candidates
        selected: list[dict] = []
        for ct, n in slots.items():
            selected.extend(by_type.get(ct, [])[:n])

        # Shuffle final selection so types are interleaved in the batch
        random.shuffle(selected)
        return selected

    # ── Queue Management ────────────────────────────────────────────────

    @classmethod
    async def list_queue(
        cls,
        admin_supabase: Client,
        status_filter: str | None = None,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list, int]:
        """List Instagram queue items with simulation metadata."""
        query = (
            admin_supabase.table("v_instagram_queue")
            .select("*", count="exact")
        )
        if status_filter:
            query = query.eq("status", status_filter)

        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        data = response.data or []
        total = response.count if response.count is not None else len(data)
        return data, total

    @classmethod
    async def approve_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
        scheduled_at: datetime | None = None,
    ) -> dict:
        """Approve a draft post → scheduled status."""
        update = {
            "status": "scheduled",
            "scheduled_at": (scheduled_at or datetime.now(UTC)).isoformat(),
        }
        resp = (
            admin_supabase.table("instagram_posts")
            .update(update)
            .eq("id", str(post_id))
            .eq("status", "draft")
            .execute()
        )
        if not resp.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found or not in draft status.",
            )
        return resp.data[0]

    @classmethod
    async def reject_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
        reason: str,
    ) -> dict:
        """Reject a draft post with reason."""
        update = {
            "status": "rejected",
            "failure_reason": reason,
        }
        resp = (
            admin_supabase.table("instagram_posts")
            .update(update)
            .eq("id", str(post_id))
            .in_("status", ["draft", "scheduled"])
            .execute()
        )
        if not resp.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Post not found or already published.",
            )
        return resp.data[0]

    @classmethod
    async def get_post(
        cls,
        admin_supabase: Client,
        post_id: UUID,
    ) -> dict:
        """Get a single Instagram post."""
        resp = (
            admin_supabase.table("instagram_posts")
            .select("*")
            .eq("id", str(post_id))
            .limit(1)
            .execute()
        )
        if not resp.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Instagram post not found.",
            )
        return resp.data[0]

    @classmethod
    async def update_engagement_metrics(
        cls,
        admin_supabase: Client,
        post_id: UUID,
        metrics: dict,
    ) -> dict:
        """Update engagement metrics for a published post."""
        reach = metrics.get("reach", 0) or 0
        likes = metrics.get("likes", 0) or 0
        comments = metrics.get("comments", 0) or 0
        saves = metrics.get("saved", 0) or 0
        shares = metrics.get("shares", 0) or 0
        impressions = metrics.get("impressions", 0) or 0

        engagement_rate = 0.0
        if reach > 0:
            engagement_rate = round((likes + comments + saves + shares) / reach, 4)

        update = {
            "likes_count": likes,
            "comments_count": comments,
            "reach": reach,
            "impressions": impressions,
            "saves": saves,
            "shares": shares,
            "engagement_rate": engagement_rate,
            "metrics_updated_at": datetime.now(UTC).isoformat(),
        }
        resp = (
            admin_supabase.table("instagram_posts")
            .update(update)
            .eq("id", str(post_id))
            .execute()
        )
        return resp.data[0] if resp.data else update

    @classmethod
    async def get_analytics(
        cls,
        admin_supabase: Client,
        days: int = 30,
    ) -> dict:
        """Get aggregated Instagram analytics via Postgres RPC."""
        response = admin_supabase.rpc(
            "fn_instagram_analytics",
            {"p_days": days},
        ).execute()
        return response.data if response.data else {}

    # ── Internal Helpers ────────────────────────────────────────────────

    @classmethod
    async def _get_next_dispatch_number(cls, admin_supabase: Client) -> int:
        """Get the next Bureau dispatch number (sequential across all posts)."""
        count_resp = (
            admin_supabase.table("instagram_posts")
            .select("id", count="exact")
            .execute()
        )
        total = count_resp.count if count_resp.count is not None else 0
        return total + 1

    @classmethod
    async def _generate_caption(
        cls,
        admin_supabase: Client,
        candidate: dict,
        dispatch_number: int,
        simulation_id: UUID | None = None,
    ) -> str:
        """Generate a Bureau-voice Instagram caption.

        Tries AI generation via GenerationService first, falls back to template.
        """
        content_type = candidate["content_type"]
        simulation_name = candidate.get("simulation_name", "Unknown Shard")
        date_str = datetime.now(UTC).strftime("%Y-%m-%d")

        # Try AI generation if not in mock mode and we have a simulation
        if not settings.forge_mock_mode and simulation_id:
            try:
                gen = GenerationService(
                    admin_supabase,
                    simulation_id,
                    settings.openrouter_api_key,
                )

                # Build context from candidate data
                entity_context = cls._build_entity_context(candidate)

                result = await gen._generate(
                    template_type=f"instagram_{content_type}_caption",
                    model_purpose="social_trends",
                    variables={
                        "simulation_name": simulation_name,
                        "dispatch_number": str(dispatch_number),
                        "date": date_str,
                        "entity_name": candidate.get("name", "Unknown"),
                        "entity_context": entity_context,
                    },
                    locale="en",
                )

                caption = result.get("content", "")
                if caption and len(caption) > 50:
                    # Append AI disclosure footer
                    caption = caption.strip() + _AI_DISCLOSURE_FOOTER
                    # Truncate to Instagram limit
                    if len(caption) > 2200:
                        caption = caption[:2190] + "…"
                    return caption
            except Exception as exc:
                logger.warning(
                    "AI caption generation failed for %s, using template",
                    content_type,
                    exc_info=True,
                    extra={
                        "content_type": content_type,
                        "simulation_id": str(simulation_id),
                        "dispatch_number": dispatch_number,
                    },
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("instagram_phase", "caption_generation")
                    scope.set_context("instagram", {
                        "content_type": content_type,
                        "simulation_id": str(simulation_id),
                    })
                    sentry_sdk.capture_exception(exc)

        # Template fallback
        template = CAPTION_TEMPLATES.get(content_type, CAPTION_TEMPLATES["agent"])
        body = cls._build_template_body(candidate)

        caption = template.format(
            dispatch_number=dispatch_number,
            date=date_str,
            classification="PUBLIC",
            simulation_name=simulation_name,
            body=body,
            edition_number=candidate.get("edition_number", 1),
        )
        caption = caption.strip() + _AI_DISCLOSURE_FOOTER

        if len(caption) > 2200:
            caption = caption[:2190] + "…"

        return caption

    @classmethod
    def _build_entity_context(cls, candidate: dict) -> str:
        """Build a context string from candidate data for AI caption generation."""
        content_type = candidate["content_type"]

        if content_type == "agent":
            parts = [
                f"Name: {candidate.get('name', 'Unknown')}",
                f"System: {candidate.get('system', '')}",
            ]
            if candidate.get("character"):
                parts.append(f"Character: {candidate['character'][:300]}")
            if candidate.get("background"):
                parts.append(f"Background: {candidate['background'][:300]}")
            return "\n".join(parts)

        if content_type == "building":
            parts = [
                f"Name: {candidate.get('name', 'Unknown')}",
                f"Type: {candidate.get('building_type', '')}",
                f"Condition: {candidate.get('building_condition', '')}",
            ]
            if candidate.get("description"):
                parts.append(f"Description: {candidate['description'][:300]}")
            return "\n".join(parts)

        if content_type == "chronicle":
            parts = [
                f"Title: {candidate.get('name', 'Unknown')}",
                f"Edition: #{candidate.get('edition_number', 1)}",
            ]
            if candidate.get("headline"):
                parts.append(f"Headline: {candidate['headline'][:200]}")
            if candidate.get("content"):
                parts.append(f"Content excerpt: {candidate['content'][:400]}")
            return "\n".join(parts)

        if content_type == "lore":
            parts = [
                f"Title: {candidate.get('name', 'Unknown')}",
                f"Chapter: {candidate.get('chapter', '')}",
            ]
            if candidate.get("epigraph"):
                parts.append(f"Epigraph: {candidate['epigraph'][:200]}")
            if candidate.get("body"):
                parts.append(f"Content: {candidate['body'][:400]}")
            return "\n".join(parts)

        return json.dumps(candidate, default=str)[:500]

    @classmethod
    def _build_template_body(cls, candidate: dict) -> str:
        """Build body text from candidate data for template-based captions."""
        content_type = candidate["content_type"]

        if content_type == "agent":
            name = candidate.get("name", "Unknown Operative")
            system = candidate.get("system", "")
            character = candidate.get("character", "")
            return (
                f"The Bureau has authorized the declassification of Operative {name}'s "
                f"personnel file. System designation: {system}.\n\n"
                f"{character[:400] if character else 'Further details remain restricted.'}"
            )

        if content_type == "building":
            name = candidate.get("name", "Unknown Structure")
            btype = candidate.get("building_type", "")
            condition = candidate.get("building_condition", "operational")
            desc = candidate.get("description", "")
            return (
                f"Shard surveillance report for {name} ({btype}). "
                f"Current structural status: {condition}.\n\n"
                f"{desc[:400] if desc else 'Visual assessment ongoing.'}"
            )

        if content_type == "chronicle":
            headline = candidate.get("headline", "")
            content = candidate.get("content", "")
            return (
                f"{headline}\n\n"
                f"{content[:500] if content else 'Full dispatch available at metaverse.center.'}"
            )

        if content_type == "lore":
            title = candidate.get("name", "Unknown Archive")
            chapter = candidate.get("chapter", "")
            epigraph = candidate.get("epigraph", "")
            body = candidate.get("body", "")
            return (
                f"DECLASSIFIED ARCHIVE: {title}\n"
                f"Section: {chapter}\n\n"
                f"{epigraph[:200] + chr(10) + chr(10) if epigraph else ''}"
                f"{body[:400] if body else 'Full archive available at metaverse.center.'}"
            )

        return "The Bureau has detected activity requiring documentation."

    @classmethod
    def _build_hashtags(cls, simulation_slug: str, content_type: str) -> list[str]:
        """Build 3-5 hashtags for a post."""
        tags = [_BRAND_TAGS[0]]  # #BureauOfImpossibleGeography

        if simulation_slug:
            # Strip epoch suffix (e.g., "station-null-e7" → "station-null")
            clean_slug = re.sub(r"-e\d+$", "", simulation_slug)
            # Convert slug to hashtag (e.g., "station-null" → "#StationNull")
            slug_tag = "#" + "".join(
                word.capitalize() for word in clean_slug.split("-")
            )
            tags.append(slug_tag)

        # 1-2 discovery tags
        tags.append(_DISCOVERY_TAGS[0])  # #worldbuilding
        if content_type == "agent":
            tags.append("#AIart")
        elif content_type == "chronicle":
            tags.append("#speculativefiction")
        elif content_type == "lore":
            tags.append("#lore")
        elif content_type == "building":
            tags.append("#AIarchitecture")

        return tags[:5]

    @classmethod
    def _generate_alt_text(cls, candidate: dict) -> str:
        """Generate accessible alt text (max 100 chars) from candidate data."""
        content_type = candidate["content_type"]
        name = candidate.get("name", "Unknown")

        if content_type == "agent":
            return f"AI-generated portrait of {name}, a fictional character"[:100]
        if content_type == "building":
            return f"AI-generated image of {name}, a fictional structure"[:100]
        if content_type == "chronicle":
            return f"Bureau dispatch document: {name}"[:100]
        if content_type == "lore":
            return f"Declassified Bureau archive: {name}"[:100]

        return f"Bureau of Impossible Geography dispatch about {name}"[:100]

    @classmethod
    async def _get_simulation_colors(
        cls,
        admin_supabase: Client,
        simulation_id: str | None,
    ) -> dict[str, str]:
        """Fetch simulation design settings (primary color, background)."""
        if not simulation_id:
            return {"color_primary": "#e2e8f0", "color_background": "#0f172a"}

        resp = (
            admin_supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", simulation_id)
            .in_("setting_key", [
                "design.color_primary",
                "design.color_background",
            ])
            .execute()
        )

        colors = {"color_primary": "#e2e8f0", "color_background": "#0f172a"}
        for row in resp.data or []:
            key = row["setting_key"]
            if key == "design.color_primary":
                colors["color_primary"] = row["setting_value"]
            elif key == "design.color_background":
                colors["color_background"] = row["setting_value"]

        return colors

    # Default blocklist — catches obvious issues. Overridable via platform_settings.
    _DEFAULT_BLOCKLIST = [
        "kill yourself", "suicide", "self-harm", "racial slur", "n-word",
        "child abuse", "sexual content", "porn", "nude", "naked",
        "terrorist", "bomb threat", "school shooting",
    ]

    @classmethod
    async def _moderate_caption(
        cls,
        admin_supabase: Client,
        caption: str,
    ) -> dict[str, bool | str]:
        """Check caption against keyword blocklist and basic safety rules.

        Returns: {"blocked": bool, "reason": str}
        """
        caption_lower = caption.lower()

        # Load configurable blocklist from platform_settings
        blocklist = list(cls._DEFAULT_BLOCKLIST)
        try:
            resp = (
                admin_supabase.table("platform_settings")
                .select("setting_value")
                .eq("setting_key", "instagram_blocklist")
                .limit(1)
                .execute()
            )
            if resp.data and resp.data[0]["setting_value"]:
                custom = json.loads(resp.data[0]["setting_value"])
                if isinstance(custom, list):
                    blocklist.extend(custom)
        except Exception:
            logger.debug("Failed to load instagram_blocklist, using defaults")

        # Check blocklist
        for term in blocklist:
            if term.lower() in caption_lower:
                return {"blocked": True, "reason": f"Blocked term: '{term}'"}

        # Basic length check — Instagram captions max 2200 chars
        if len(caption) > 2200:
            return {"blocked": False, "reason": ""}

        # Check for excessive emoji (Bureau voice should have none)
        import unicodedata
        emoji_count = sum(1 for ch in caption if unicodedata.category(ch).startswith("So"))
        if emoji_count > 3:
            return {"blocked": True, "reason": f"Too many emojis ({emoji_count}) — not Bureau voice"}

        return {"blocked": False, "reason": ""}

    @classmethod
    async def load_instagram_credentials(cls, admin_supabase: Client) -> dict[str, str]:
        """Load Instagram API credentials from platform_settings.

        Shared utility used by both the router and scheduler to avoid
        duplicating credential loading + decryption logic.
        """
        rows = (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", ["instagram_access_token", "instagram_ig_user_id"])
            .execute()
        ).data or []

        result: dict[str, str] = {"access_token": "", "ig_user_id": ""}
        for row in rows:
            if row["setting_key"] == "instagram_ig_user_id":
                result["ig_user_id"] = row["setting_value"] or ""
            elif row["setting_key"] == "instagram_access_token":
                raw = row["setting_value"] or ""
                if raw.startswith("gAAAAA"):
                    try:
                        from backend.utils.encryption import decrypt
                        result["access_token"] = decrypt(raw)
                    except (ValueError, Exception):
                        logger.warning("Failed to decrypt Instagram access token")
                else:
                    result["access_token"] = raw

        return result

    @classmethod
    def _build_snapshot(cls, candidate: dict) -> dict:
        """Build a frozen content snapshot for archive purposes."""
        # Remove large binary/image data, keep text content
        snapshot = {}
        for key, value in candidate.items():
            if key in ("image_url", "portrait_image_url"):
                snapshot[key] = value  # keep URL reference
            elif isinstance(value, str) and len(value) > 2000:
                snapshot[key] = value[:2000] + "…"
            else:
                snapshot[key] = value
        return snapshot
