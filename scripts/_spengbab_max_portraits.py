#!/usr/bin/env python3
"""Generate 3 agent portraits with flux-2-max using safety-hardened manual prompts.

flux-2-max has a stricter safety filter than flux-2-pro. The LLM-generated
prompts contain body horror language that triggers E005. This script uses
hand-crafted description_override prompts that preserve the Spengbab aesthetic
while staying within max's safety bounds.

Usage:
    source backend/.venv/bin/activate
    python scripts/_spengbab_max_portraits.py
"""

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENVIRONMENT", "development")

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SIM_ID = UUID("60000000-0000-0000-0000-000000000001")
MODEL_MAX = "black-forest-labs/flux-2-max"

# Safety-hardened prompts: preserve Spengbab aesthetic without body horror triggers.
# Style: corrupted digital art + underground comix, NOT body horror/gore.
MAX_SAFE_PROMPTS = {
    "Morbid Patrick": (
        "A grotesque cartoon starfish character rendered in corrupted MS Paint, "
        "deep-fried JPEG compression artifacts throughout, scratchy underground comix "
        "line art style, character stares vacantly with enormous dilated pupils, "
        "wearing a tattered Hawaiian shirt covered in digital noise, surrounded by "
        "pixelated fast food debris, sickly neon-green and toxic-pink color palette, "
        "heavy cross-hatching, Ren and Stimpy grotesque close-up composition, "
        "2006 internet cursed image aesthetic, low-fidelity, no anti-aliasing"
    ),
    "Sandy the Exiled": (
        "A cartoon squirrel character in a cracked astronaut helmet rendered in "
        "corrupted MS Paint aesthetic, deep-fried JPEG artifacts, the helmet visor "
        "reflects distorted neon fast food signs, character has an expression of "
        "existential dread, scratchy hairy line art, underground comix illustration, "
        "Beksiński-inspired industrial background of rusted pipes and broken machinery, "
        "sickly yellow-green lighting, heavy cross-hatching, extreme close-up, "
        "2006 internet creepypasta board aesthetic, pixelated textures"
    ),
    "Spengbab": (
        "A grotesque cartoon sponge character rendered in deeply corrupted MS Paint, "
        "the most deep-fried JPEG artifact imaginable, character is a crude yellow "
        "rectangle with enormous uneven eyes and a crooked smile showing too many "
        "teeth, surrounded by bubbles that look like rendering errors, standing in "
        "a fast food kitchen made of pixelated geometry, toxic neon color palette, "
        "scratchy hairy line art, heavy cross-hatching, Ren and Stimpy extreme "
        "close-up style, underground comix, corrupted DirectX shader glow, "
        "scanlines and digital noise overlay, 2003 bootleg game screenshot aesthetic"
    ),
}


async def main() -> None:
    from backend.dependencies import get_admin_supabase
    from backend.services.forge_image_service import ForgeImageService
    from backend.utils.responses import extract_list

    supabase = await get_admin_supabase()

    # Build world context
    lore_resp = await (
        supabase.table("simulation_lore")
        .select("title, body")
        .eq("simulation_id", str(SIM_ID))
        .order("sort_order")
        .limit(3)
        .execute()
    )
    parts = []
    for s in lore_resp.data or []:
        parts.append(f"{s.get('title', '')}: {(s.get('body') or '')[:300]}")
    world_context = "\n".join(parts)

    # Set model override to flux-2-max
    await (
        supabase.table("simulation_settings")
        .upsert(
            {
                "simulation_id": str(SIM_ID),
                "category": "ai",
                "setting_key": "image_model_agent_portrait",
                "setting_value": f'"{MODEL_MAX}"',
            },
            on_conflict="simulation_id,category,setting_key",
        )
        .execute()
    )

    image_service = ForgeImageService(
        supabase,
        SIM_ID,
        replicate_api_key=os.environ.get("REPLICATE_API_TOKEN"),
        openrouter_api_key=os.environ.get("OPENROUTER_API_KEY"),
        world_context=world_context,
    )

    results = {"ok": 0, "fail": 0}

    for name, safe_prompt in MAX_SAFE_PROMPTS.items():
        agent_resp = await (
            supabase.table("agents")
            .select("id")
            .eq("simulation_id", str(SIM_ID))
            .eq("name", name)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
        agent = agent_resp.data
        if not agent:
            logger.warning("Agent not found: %s", name)
            continue

        logger.info("Generating MAX portrait: %s (safety-hardened prompt)...", name)
        try:
            url = await image_service.generate_agent_portrait(
                UUID(agent["id"]),
                name,
                description_override=safe_prompt,
            )
            logger.info("✓ %s [MAX] → %s", name, url)
            results["ok"] += 1
        except Exception as e:
            logger.error("✗ %s [MAX] FAILED: %s", name, e)
            results["fail"] += 1
        await asyncio.sleep(2)

    # Clean up model override
    await (
        supabase.table("simulation_settings")
        .delete()
        .eq("simulation_id", str(SIM_ID))
        .eq("setting_key", "image_model_agent_portrait")
        .execute()
    )

    logger.info("═══ MAX PORTRAITS: %d OK, %d failed ═══", results["ok"], results["fail"])


if __name__ == "__main__":
    asyncio.run(main())
