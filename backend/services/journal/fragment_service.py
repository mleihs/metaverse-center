"""Resonance Journal Fragment Service.

Owns three responsibilities:

1. Fragment query API for the journal router (list_fragments, get_fragment).
2. Async generation queue — integration hooks call enqueue_request, which
   inserts a fragment_generation_requests row. Fire-and-forget from the
   caller's perspective: the journal must never block the source system's
   response (plan §8 "Integration hooks").
3. Scheduler pipeline — FragmentGenerationScheduler.process_tick pops
   pending rows, calls the LLM via OpenRouterService with a BudgetContext
   (A.2/A.3 pattern), inserts journal_fragments, updates
   resonance_profiles.fragment_count. Retries transient failures up to
   _MAX_ATTEMPTS; budget-blocks are final (no retry).

P0 supports impression fragments (from bond whispers). Other fragment
types register prompts in P1 via fragment_prompts._PROMPT_TABLE extension.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import (
    BudgetContext,
    CreditExhaustedError,
    OpenRouterError,
    OpenRouterService,
)
from backend.services.journal.fragment_prompts import (
    ECHO_SYSTEM_PROMPT,
    IMPRESSION_SYSTEM_PROMPT,
    IMPRINT_SYSTEM_PROMPT,
    MARK_SYSTEM_PROMPT,
    SIGNATURE_SYSTEM_PROMPT,
    TREMOR_SYSTEM_PROMPT,
    build_echo_user_prompt,
    build_impression_user_prompt,
    build_imprint_user_prompt,
    build_mark_user_prompt,
    build_signature_user_prompt,
    build_tremor_user_prompt,
)
from backend.services.platform_model_config import get_platform_model
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────────────

# Max retry attempts per generation request before marking failed.
_MAX_ATTEMPTS = 3

# Number of pending requests the scheduler pops per tick. A higher budget
# risks hogging LLM quota; a lower one delays fragment arrival. 10 gives
# active players fragments within ~2 minutes while leaving room for other
# purposes in the shared budget envelope.
_SCHEDULER_BATCH_SIZE = 10

# LLM generation params. Temperature mid-high for literary variance;
# max_tokens tight since fragments are 2-4 sentences + a tag list.
_LLM_TEMPERATURE = 0.85
_LLM_MAX_TOKENS = 400

# Strip markdown code fences from LLM output (some models wrap JSON).
_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)

# Per plan §7: fragment_generation uses the platform "research" model
# purpose (DeepSeek V3 / Gemini-Flash tier — cheap, fast, literary enough).
# constellation_insight (P2) also uses "research"; palimpsest_reflection
# (P4) uses "forge" (Claude Sonnet tier — the Palimpsest is literary).
_MODEL_PURPOSE_RESEARCH = "research"

# Map fragment_type -> (system_prompt, user_prompt_builder).
# All 6 source systems register their voices here. Imprint (dungeon) and
# the rest landed in P1 alongside their integration hooks.
_PROMPT_TABLE: dict[str, tuple[str, Any]] = {
    "impression": (IMPRESSION_SYSTEM_PROMPT, build_impression_user_prompt),
    "imprint": (IMPRINT_SYSTEM_PROMPT, build_imprint_user_prompt),
    "signature": (SIGNATURE_SYSTEM_PROMPT, build_signature_user_prompt),
    "echo": (ECHO_SYSTEM_PROMPT, build_echo_user_prompt),
    "mark": (MARK_SYSTEM_PROMPT, build_mark_user_prompt),
    "tremor": (TREMOR_SYSTEM_PROMPT, build_tremor_user_prompt),
}


class FragmentService:
    """CRUD + async generation pipeline for journal fragments."""

    # ── Public query API ──────────────────────────────────────────────

    @classmethod
    async def list_fragments(
        cls,
        supabase: Client,
        user_id: UUID,
        *,
        simulation_id: UUID | None = None,
        source_type: str | None = None,
        fragment_type: str | None = None,
        rarity: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Query fragments for a user with optional filters.

        Returns ``(rows, total_count)``. Orders newest-first.
        """
        query = (
            supabase.table("journal_fragments")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
        )
        if simulation_id is not None:
            query = query.eq("simulation_id", str(simulation_id))
        if source_type is not None:
            query = query.eq("source_type", source_type)
        if fragment_type is not None:
            query = query.eq("fragment_type", fragment_type)
        if rarity is not None:
            query = query.eq("rarity", rarity)

        resp = await query.range(offset, offset + limit - 1).execute()
        rows = extract_list(resp)
        total = getattr(resp, "count", None) or 0
        return rows, total

    @classmethod
    async def get_fragment(
        cls,
        supabase: Client,
        user_id: UUID,
        fragment_id: UUID,
    ) -> dict | None:
        """Get a single fragment, only if owned by user. None otherwise."""
        data = await maybe_single_data(
            supabase.table("journal_fragments")
            .select("*")
            .eq("id", str(fragment_id))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        return data

    # ── Enqueue API (integration hooks) ────────────────────────────────

    @classmethod
    async def enqueue_request(
        cls,
        admin: Client,
        *,
        user_id: UUID,
        source_type: str,
        source_id: UUID,
        fragment_type: str,
        context: dict,
        simulation_id: UUID | None = None,
    ) -> UUID | None:
        """Add a fragment generation request to the queue.

        Fire-and-forget from the caller's perspective. Returns the new
        request UUID on success, or None on failure. Failures are logged
        and sent to Sentry but never raised — integration hooks run in
        hot paths (heartbeat, dungeon completion, epoch cycle resolve)
        that MUST NOT be blocked by journal infrastructure.
        """
        try:
            resp = await (
                admin.table("fragment_generation_requests")
                .insert(
                    {
                        "user_id": str(user_id),
                        "simulation_id": str(simulation_id) if simulation_id else None,
                        "source_type": source_type,
                        "source_id": str(source_id),
                        "fragment_type": fragment_type,
                        "context": context,
                    }
                )
                .select("id")
                .execute()
            )
            rows = extract_list(resp)
            return UUID(rows[0]["id"]) if rows else None
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as err:
            logger.warning(
                "Fragment enqueue failed (non-fatal for caller)",
                extra={"user_id": str(user_id), "fragment_type": fragment_type},
                exc_info=True,
            )
            sentry_sdk.capture_exception(err)
            return None

    # ── Scheduler pipeline ─────────────────────────────────────────────

    @classmethod
    async def process_tick(cls, admin: Client) -> int:
        """Pop pending requests and process them. Returns count of
        successfully-generated fragments.

        Called by FragmentGenerationScheduler every ~60s.
        """
        requests = await cls._pop_pending(admin, limit=_SCHEDULER_BATCH_SIZE)
        if not requests:
            return 0

        processed = 0
        for req in requests:
            status = await cls._process_one(admin, req)
            await cls._mark_request_status(
                admin,
                req["id"],
                status,
                current_attempts=req.get("attempts", 0),
            )
            if status == "done":
                processed += 1
        return processed

    @classmethod
    async def _pop_pending(
        cls,
        admin: Client,
        *,
        limit: int,
    ) -> list[dict]:
        """Fetch pending requests, oldest first. Filters out rows that
        have already hit _MAX_ATTEMPTS.
        """
        try:
            resp = await (
                admin.table("fragment_generation_requests")
                .select("*")
                .eq("status", "pending")
                .lt("attempts", _MAX_ATTEMPTS)
                .order("enqueued_at")
                .limit(limit)
                .execute()
            )
            return extract_list(resp)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to pop pending fragment requests", exc_info=True)
            return []

    @classmethod
    async def _process_one(cls, admin: Client, req: dict) -> str:
        """Generate a single fragment. Returns one of:
            'done'    — fragment inserted successfully
            'failed'  — permanent failure (no prompt, budget blocked, DB error)
            'retry'   — transient failure, will retry next tick up to _MAX_ATTEMPTS
        """
        fragment_type = req.get("fragment_type")
        if fragment_type not in _PROMPT_TABLE:
            logger.warning(
                "No prompt registered for fragment_type",
                extra={"fragment_type": fragment_type, "request_id": req.get("id")},
            )
            return "failed"

        # Mark as generating BEFORE the LLM call so parallel workers don't
        # duplicate work if we ever scale to multiple scheduler instances.
        await cls._mark_request_status(
            admin,
            req["id"],
            "generating",
            current_attempts=req.get("attempts", 0),
        )

        system_prompt, user_prompt_builder = _PROMPT_TABLE[fragment_type]
        user_prompt = user_prompt_builder(req.get("context", {}))

        # get_platform_model always returns a string (falls back to
        # HARDCODED_DEFAULTS internally), so no `or` default is needed here.
        # Pass "research" as the purpose alias — fragment_generation belongs
        # to the same model tier per plan §7.
        model_id = get_platform_model(_MODEL_PURPOSE_RESEARCH)

        budget = BudgetContext(
            admin_supabase=admin,
            purpose="fragment_generation",
            simulation_id=_parse_uuid(req.get("simulation_id")),
            user_id=_parse_uuid(req.get("user_id")),
        )

        try:
            openrouter = OpenRouterService()
            content = await openrouter.generate(
                model=model_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=_LLM_TEMPERATURE,
                max_tokens=_LLM_MAX_TOKENS,
                budget=budget,
            )
        except BudgetExceededError:
            # Budget block is a deliberate admin action. No retry.
            logger.info(
                "Fragment generation blocked by budget",
                extra={"request_id": req.get("id"), "fragment_type": fragment_type},
            )
            return "failed"
        except CreditExhaustedError:
            # OpenRouter key is out of credits (402/403). Retrying would hit
            # the same wall on the next tick, burning attempts + circuit
            # breaker. Terminal like BudgetExceededError; surface to admin
            # via processed_at timestamp and the default 'max retries
            # exceeded' last_error would be misleading, so log explicitly.
            logger.warning(
                "Fragment generation skipped: OpenRouter credit exhausted",
                extra={"request_id": req.get("id"), "fragment_type": fragment_type},
            )
            return "failed"
        except (OpenRouterError, httpx.HTTPError) as err:
            logger.warning(
                "Fragment LLM call failed (will retry next tick)",
                extra={"request_id": req.get("id"), "fragment_type": fragment_type},
                exc_info=True,
            )
            sentry_sdk.capture_exception(err)
            return "retry"

        parsed = cls._parse_llm_response(content)
        if not parsed:
            logger.warning(
                "Fragment LLM returned unparseable JSON (will retry)",
                extra={
                    "request_id": req.get("id"),
                    "snippet": (content or "")[:120],
                },
            )
            return "retry"

        fragment_id = await cls._insert_fragment(admin, req, parsed)
        if fragment_id is None:
            return "retry"

        await cls._update_profile(
            admin,
            user_id=req["user_id"],
            thematic_tags=parsed.get("thematic_tags", []),
        )
        return "done"

    @classmethod
    async def _insert_fragment(
        cls,
        admin: Client,
        req: dict,
        parsed: dict,
    ) -> UUID | None:
        """Insert a journal_fragments row from a parsed LLM response."""
        try:
            resp = await (
                admin.table("journal_fragments")
                .insert(
                    {
                        "user_id": req["user_id"],
                        "simulation_id": req.get("simulation_id"),
                        "fragment_type": req["fragment_type"],
                        "source_type": req["source_type"],
                        "source_id": req["source_id"],
                        "content_de": parsed["content_de"],
                        "content_en": parsed["content_en"],
                        "thematic_tags": parsed.get("thematic_tags", []),
                        # P0 ships everything as 'common'. Rarity heuristic
                        # (salience filter) lands in P5 per plan §9.
                        "rarity": "common",
                    }
                )
                .select("id")
                .execute()
            )
            rows = extract_list(resp)
            return UUID(rows[0]["id"]) if rows else None
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as err:
            logger.warning("Failed to insert journal fragment", exc_info=True)
            sentry_sdk.capture_exception(err)
            return None

    @classmethod
    async def _update_profile(
        cls,
        admin: Client,
        *,
        user_id: str,
        thematic_tags: list[str],  # noqa: ARG003 -- P4 will use this for per-dim updates
    ) -> None:
        """Increment the user's resonance_profiles.fragment_count.

        P0 only tracks the counter — load-bearing for the Palimpsest
        trigger (every 30th fragment, AD-4). Per-dimension updates from
        thematic_tags -> 8D mapping land in P4 (resonance_profile_service)
        when the tag taxonomy is finalized.

        Uses read-then-upsert. The tiny race window is acceptable: if two
        fragments land simultaneously for one user, worst case is one
        count missed (trigger fires on the 31st instead of the 30th).
        """
        try:
            existing = await maybe_single_data(
                admin.table("resonance_profiles")
                .select("fragment_count")
                .eq("user_id", user_id)
                .maybe_single()
            )
            current = existing["fragment_count"] if existing else 0
            new_count = current + 1

            await (
                admin.table("resonance_profiles")
                .upsert(
                    {
                        "user_id": user_id,
                        "fragment_count": new_count,
                    },
                    on_conflict="user_id",
                )
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as err:
            # Don't fail the fragment insert over profile bookkeeping.
            logger.warning(
                "Failed to update resonance profile fragment_count",
                exc_info=True,
            )
            sentry_sdk.capture_exception(err)

    @classmethod
    async def _mark_request_status(
        cls,
        admin: Client,
        request_id: str,
        status: str,
        *,
        current_attempts: int,
    ) -> None:
        """Update a fragment_generation_request row's status.

        Handles the three scheduler-side transitions:
          - 'generating': mid-flight, used to prevent duplicate work.
          - 'retry':    failure; re-enqueue as 'pending' with attempts+1,
                         or promote to 'failed' if _MAX_ATTEMPTS reached.
          - 'done' / 'failed': terminal; set processed_at timestamp.
        """
        now_iso = datetime.now(UTC).isoformat()

        if status == "retry":
            next_attempts = current_attempts + 1
            if next_attempts >= _MAX_ATTEMPTS:
                update: dict = {
                    "status": "failed",
                    "attempts": next_attempts,
                    "processed_at": now_iso,
                    "last_error": "max retries exceeded",
                }
            else:
                update = {
                    "status": "pending",
                    "attempts": next_attempts,
                }
        elif status in {"done", "failed"}:
            update = {
                "status": status,
                "attempts": current_attempts + 1,
                "processed_at": now_iso,
            }
        else:  # 'generating' — transient mid-flight marker
            update = {"status": status}

        try:
            await (
                admin.table("fragment_generation_requests")
                .update(update)
                .eq("id", request_id)
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning(
                "Failed to mark request status",
                extra={"request_id": request_id, "new_status": status},
                exc_info=True,
            )

    # ── LLM response parsing ──────────────────────────────────────────

    @classmethod
    def _parse_llm_response(cls, content: str | None) -> dict | None:
        """Parse the LLM's JSON response, tolerant to fencing + preamble.

        Returns a dict with normalized content_de, content_en, and
        thematic_tags (defaulting to []) if all required fields validate.
        Returns None if the response is unparseable or missing required
        fields.
        """
        if not content or not content.strip():
            return None

        data: Any = None

        # Strategy 1: direct JSON parse.
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            data = None

        # Strategy 2: strip markdown fences.
        if data is None:
            match = _FENCE_RE.search(content)
            if match:
                try:
                    data = json.loads(match.group(1))
                except json.JSONDecodeError:
                    data = None

        # Strategy 3: find the outermost {...} block.
        if data is None:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    data = json.loads(content[start : end + 1])
                except json.JSONDecodeError:
                    data = None

        if not isinstance(data, dict):
            return None

        content_de = data.get("content_de")
        content_en = data.get("content_en")
        if not isinstance(content_de, str) or not content_de.strip():
            return None
        if not isinstance(content_en, str) or not content_en.strip():
            return None

        raw_tags = data.get("thematic_tags", [])
        if not isinstance(raw_tags, list):
            raw_tags = []
        tags = [t.strip().lower() for t in raw_tags if isinstance(t, str) and t.strip()]

        return {
            "content_de": content_de.strip(),
            "content_en": content_en.strip(),
            "thematic_tags": tags,
        }


def _parse_uuid(value: Any) -> UUID | None:
    """Safely parse a UUID from a DB string, None otherwise."""
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None
