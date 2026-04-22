"""Seed a pre-crystallized constellation for frontend ceremony QA.

Use this when OpenRouter credits are exhausted (so the live crystallize
endpoint returns HTTP 429) but you still need a crystallized row to
exercise the VelgInsightReveal animation + the crystallized-state
canvas rendering against a real database.

What it does
------------
1. Picks an existing user who owns at least 2 fragments.
2. Creates a constellation (status='drafting') owned by that user.
3. Places two fragments onto it via the junction table.
4. Runs the rule-based detector to pick the correct resonance_type.
5. Writes Insight text directly to the row (bypassing the LLM call)
   and flips status→crystallized + stamps crystallized_at.

The Insight text is a seeded literary string, not LLM output. This is
QA scaffolding, not production content — the row will show the
ceremony correctly but the Insight is hand-written.

Run:
    .venv/bin/python scripts/seed_crystallized_constellation.py \\
        --email matthias.leihs@gmail.com

Cleanup:
    .venv/bin/python scripts/seed_crystallized_constellation.py \\
        --email matthias.leihs@gmail.com --cleanup
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import UTC, datetime
from uuid import uuid4

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("seed-crystallized")


SEED_INSIGHT_DE = (
    "Zwei Schatten, die in verschiedenen Fluren geboren wurden, "
    "sprechen dieselbe Zeile – leise, aber unausweichlich. Wer "
    "beide gelesen hat, trägt die Naht zwischen ihnen als Wissen."
)
SEED_INSIGHT_EN = (
    "Two shadows, born in different corridors, speak the same line — "
    "quietly, but with no way round. Whoever has read both carries "
    "the seam between them as knowledge."
)
SEED_NAME_DE = "Doppelzug"
SEED_NAME_EN = "Twofold Draft"


async def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="Target user's email.")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Archive (not delete) seeded constellations for this user.",
    )
    args = parser.parse_args()

    # Late imports so `python -c` dry-runs or --help don't trigger backend
    # side-effects (DB connect, logger plumbing, etc.).
    from backend.services.journal.resonance_detector import detect_constellation
    from backend.services.journal.constellation_service import (
        ConstellationService,
    )
    from backend.utils.supabase_admin_cache import get_admin_supabase_client

    admin = await get_admin_supabase_client()

    # Resolve user by email via auth.users (service_role can read).
    users_resp = await admin.schema("auth").table("users").select(
        "id, email"
    ).eq("email", args.email).limit(1).execute()
    if not users_resp.data:
        log.error("No user found for email %s", args.email)
        return 1
    user_id = users_resp.data[0]["id"]
    log.info("Target user: %s (%s)", args.email, user_id)

    if args.cleanup:
        # Archive every seeded row (identified by the exact SEED_NAME_EN)
        # owned by this user. We archive rather than delete to preserve
        # FK-reachable state for any past QA screenshots or bug reports.
        rows = await admin.table("journal_constellations").select(
            "id"
        ).eq("user_id", user_id).eq("name_en", SEED_NAME_EN).execute()
        ids = [r["id"] for r in (rows.data or [])]
        if not ids:
            log.info("No seeded constellations to archive.")
            return 0
        for cid in ids:
            await admin.table("journal_constellations").update(
                {"status": "archived", "archived_at": datetime.now(UTC).isoformat()}
            ).eq("id", cid).execute()
        log.info("Archived %d constellation(s).", len(ids))
        return 0

    # Fetch ≥2 fragments owned by this user, newest-first.
    frags_resp = await admin.table("journal_fragments").select("*").eq(
        "user_id", user_id
    ).order("created_at", desc=True).limit(6).execute()
    fragments = frags_resp.data or []
    if len(fragments) < 2:
        log.error(
            "User has only %d fragment(s); need ≥ 2. Play a dungeon run "
            "or trigger fragment generation first.",
            len(fragments),
        )
        return 1
    seed_fragments = fragments[:2]
    log.info(
        "Using fragments: %s",
        [f["id"] for f in seed_fragments],
    )

    # Create the constellation. Pass both names so the ceremony has a
    # title in either locale.
    created = await ConstellationService.create(
        admin,
        user_id,
        name_de=SEED_NAME_DE,
        name_en=SEED_NAME_EN,
    )
    log.info("Created constellation %s", created.id)

    # Place the two fragments at deterministic coords so the canvas
    # lays them out with a visible bezier line between them.
    for i, frag in enumerate(seed_fragments):
        await admin.table("constellation_fragments").upsert(
            {
                "constellation_id": str(created.id),
                "fragment_id": frag["id"],
                "position_x": (-180 if i == 0 else 180),
                "position_y": (-40 if i == 0 else 40),
            },
            on_conflict="constellation_id,fragment_id",
        ).execute()

    # Run the detector; fall back to the 'archetype' literal if no rule
    # matched so the seed still writes a valid CHECK-constrained row.
    # (The frontend treats the resonance_type cosmetically here.)
    placed = await ConstellationService.load_composed_fragments(
        admin, user_id, created.id
    )
    match = detect_constellation(placed)
    resonance_type = str(match.resonance_type) if match is not None else "archetype"

    # Direct update — skip the LLM, preserve the status transition
    # + crystallized_at invariant enforced by the CHECK constraint.
    update_payload = {
        "status": "crystallized",
        "resonance_type": resonance_type,
        "insight_de": SEED_INSIGHT_DE,
        "insight_en": SEED_INSIGHT_EN,
        "crystallized_at": datetime.now(UTC).isoformat(),
    }
    await admin.table("journal_constellations").update(update_payload).eq(
        "id", str(created.id)
    ).execute()
    log.info(
        "Crystallized constellation %s (resonance_type=%s). Visit "
        "/journal/constellations/%s to see the ceremony + final state.",
        created.id,
        resonance_type,
        created.id,
    )
    return 0


if __name__ == "__main__":
    # Use asyncio.run here — nothing else is scheduled at process scope.
    sys.exit(asyncio.run(_main()))
