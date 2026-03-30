"""One-off script: translate untranslated classified lore sections on production.

Uses the same TranslationService pipeline as the backend.
Run from project root with backend venv activated.

Usage:
    source backend/.venv/bin/activate
    SUPABASE_URL=https://bffjoupddfjaljqrwqck.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY=<key> \
    python scripts/translate_classified_lore.py
"""

import asyncio
import os
import sys

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main():
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    srk = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    supabase = create_client(url, srk)

    # 1. Find classified sections needing translation
    # Check for NULL body_de OR body_de identical to body (mock mode wrote English)
    resp = (
        supabase.table("simulation_lore")
        .select("id, simulation_id, arcanum, title, epigraph, body, body_de, image_caption")
        .eq("chapter", "CLASSIFIED")
        .order("simulation_id")
        .order("sort_order")
        .execute()
    )
    sections = [
        s for s in (resp.data or [])
        if not s.get("body_de") or s["body_de"] == s["body"]
    ]
    if not sections:
        print("No untranslated classified sections found.")
        return

    print(f"Found {len(sections)} untranslated classified sections")

    # Group by simulation_id
    by_sim: dict[str, list[dict]] = {}
    for s in sections:
        by_sim.setdefault(s["simulation_id"], []).append(s)

    for sim_id, sim_sections in by_sim.items():
        # Get simulation context
        sim_resp = (
            supabase.table("simulations")
            .select("name, description")
            .eq("id", sim_id)
            .single()
            .execute()
        )
        sim = sim_resp.data
        sim_name = sim["name"]
        sim_theme = sim.get("description", "")
        print(f"\nSimulation: {sim_name} ({len(sim_sections)} sections)")

        from backend.models.translation import TranslationContext
        from backend.services.translation_service import TranslationService

        for section in sim_sections:
            arcanum = section["arcanum"]
            title = section["title"]
            body = section["body"]
            epigraph = section.get("epigraph") or ""
            image_caption = section.get("image_caption") or ""

            print(f"  Translating {arcanum}: {title[:50]}... ({len(body)} chars)")

            context = TranslationContext(
                simulation_name=sim_name,
                simulation_theme=sim_theme,
                entity_type="classified_dossier",
                entity_name=title,
                additional_context=(
                    f"Bureau classified intelligence report, ARCANUM section {arcanum}. "
                    f"Formal institutional tone, clinical precision, literary prose."
                ),
            )

            # Translate all fields
            fields_to_translate = {"body": body}
            if title:
                fields_to_translate["title"] = title
            if epigraph:
                fields_to_translate["epigraph"] = epigraph
            if image_caption:
                fields_to_translate["image_caption"] = image_caption

            # Translate each field individually to handle large texts
            or_key = os.environ.get("OPENROUTER_API_KEY")
            update: dict[str, str] = {}

            for field_name, field_value in fields_to_translate.items():
                try:
                    result = await TranslationService.translate_text(
                        field_value, context=context, openrouter_key=or_key,
                    )
                    if result and result != field_value:
                        de_field = f"{field_name}_de"
                        update[de_field] = result
                        print(f"    ✓ {field_name}: {len(result)} chars DE")
                    else:
                        print(f"    ⚠ {field_name}: returned unchanged")
                except Exception as e:
                    print(f"    ✗ {field_name}: {e}")

            if update:
                supabase.table("simulation_lore").update(update).eq(
                    "id", section["id"]
                ).execute()
                print(f"    → Saved {len(update)} fields")
            else:
                print("    ✗ No translations saved")

    print(f"\nAll done. Translated {len(sections)} sections.")


if __name__ == "__main__":
    asyncio.run(main())
