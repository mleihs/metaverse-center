#!/usr/bin/env python3
"""Run Phase A.5 + A.6 for Spengbab's Grease Pit.

Phase A.5: Refine style prompts using lore context (OpenRouter).
Phase A.6: Generate simulation-specific prompt templates (OpenRouter).

Usage:
    source backend/.venv/bin/activate
    python scripts/_run_spengbab_a5_a6.py
"""

import asyncio
import logging
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("ENVIRONMENT", "development")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

SIM_ID = UUID("60000000-0000-0000-0000-000000000001")


async def main() -> None:
    from backend.dependencies import get_admin_supabase
    from backend.services.forge_theme_service import ForgeThemeService

    supabase = await get_admin_supabase()

    # ── Phase A.5 ──────────────────────────────────────────────────────
    print("\n═══ Phase A.5: Refining style prompts from lore context ═══\n")
    await ForgeThemeService.refine_style_prompts(supabase, SIM_ID)

    # Verify
    resp = await (
        supabase.table("simulation_settings")
        .select("setting_key, setting_value")
        .eq("simulation_id", str(SIM_ID))
        .eq("category", "ai")
        .like("setting_key", "image_style_prompt_%")
        .execute()
    )
    print("\n── Refined style prompts ──")
    for row in resp.data or []:
        key = row["setting_key"]
        val = row["setting_value"]
        print(f"  {key}:")
        print(f"    {val[:200]}...")

    # ── Phase A.6 ──────────────────────────────────────────────────────
    print("\n═══ Phase A.6: Generating simulation-specific prompt templates ═══\n")
    await ForgeThemeService.generate_simulation_templates(supabase, SIM_ID)

    # Verify
    tmpl_resp = await (
        supabase.table("prompt_templates")
        .select("template_type, prompt_content")
        .eq("simulation_id", str(SIM_ID))
        .execute()
    )
    print("\n── Generated templates ──")
    for row in tmpl_resp.data or []:
        ttype = row["template_type"]
        content = row["prompt_content"]
        print(f"  {ttype}:")
        print(f"    {content[:150]}...")

    print("\n═══ DONE — Style prompts refined, templates generated ═══")


if __name__ == "__main__":
    asyncio.run(main())
