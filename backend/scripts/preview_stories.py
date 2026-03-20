"""Local story template preview renderer.

Renders all 5 story templates with hardcoded test data (no DB needed).
Saves to /tmp/story_preview_{N}_{type}.jpg for rapid visual iteration.

Run: source backend/.venv/bin/activate && python backend/scripts/preview_stories.py
"""
# ruff: noqa: T201 S108

from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is on sys.path so backend.* imports work
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.services.instagram_image_composer import InstagramImageComposer  # noqa: E402

# Dummy supabase client — story templates don't need DB access
composer = InstagramImageComposer(supabase=None)  # type: ignore[arg-type]

# ── Test Data ──────────────────────────────────────────────────────────

# Use The Deluge (blue) to match production stories
ARCHETYPE = "The Deluge"
ACCENT_HEX = "#2266CC"
SIM_COLOR_HEX = "#2266CC"
SIM_NAME = "Aethon Subsidence"

# Two reactions — verifies only 1 renders after the fix
REACTIONS = [
    {
        "agent_name": "Tarn Ashfold",
        "text": "The water remembers what the stone forgets. We built our certainties on sand.",
        "emotion": "dread",
    },
    {
        "agent_name": "Sera Voss",
        "text": "This should NOT appear on the final image — second reaction culled.",
        "emotion": "defiance",
    },
]

EVENTS = [
    "Flood Protocol Alpha initiated",
    "Tidal surge detected in District 7",
    "Emergency evacuation order issued",
    "Infrastructure collapse — Bridge 14",
]

# ── Render All Templates ───────────────────────────────────────────────

renders: list[tuple[str, bytes]] = []

print("Rendering story templates...")

# 1. Detection
print("  1/5 Detection...")
detection = composer.compose_story_detection(
    archetype=ARCHETYPE,
    signature="harmonic_distortion",
    magnitude=0.73,
    accent_hex=ACCENT_HEX,
)
renders.append(("detection", detection))

# 2. Classification
print("  2/5 Classification...")
classification = composer.compose_story_classification(
    archetype=ARCHETYPE,
    source_category="seismic_anomaly",
    affected_shard_count=4,
    highest_susceptibility_sim=SIM_NAME,
    highest_susceptibility_val=2.7,
    bureau_dispatch=(
        "Field operatives report unusual tidal patterns across "
        "multiple substrate layers. The Deluge signature is "
        "intensifying beyond projected thresholds.\n"
        "All monitoring stations on elevated alert."
    ),
    accent_hex=ACCENT_HEX,
)
renders.append(("classification", classification))

# 3. Impact (no banner/portraits — gradient fallback)
print("  3/5 Impact...")
impact = composer.compose_story_impact(
    simulation_name=SIM_NAME,
    effective_magnitude=0.73,
    events_spawned=EVENTS,
    narrative_closing="The waters rise. The foundations tremble. What was built now learns to swim.",
    accent_hex=ACCENT_HEX,
    sim_color_hex=SIM_COLOR_HEX,
    banner_bytes=None,
    portraits=None,
    reactions=REACTIONS,
)
renders.append(("impact", impact))

# 4. Advisory
print("  4/5 Advisory...")
advisory = composer.compose_story_advisory(
    archetype=ARCHETYPE,
    aligned_types=["Saboteur", "Infiltrator"],
    opposed_types=["Propagandist"],
    zone_name="The Drowned Quarter",
    accent_hex=ACCENT_HEX,
)
renders.append(("advisory", advisory))

# 5. Subsiding
print("  5/5 Subsiding...")
subsiding = composer.compose_story_subsiding(
    archetype=ARCHETYPE,
    events_spawned_total=47,
    shards_affected=4,
    accent_hex=ACCENT_HEX,
)
renders.append(("subsiding", subsiding))

# ── Save & Report ──────────────────────────────────────────────────────

print("\nResults:")
for i, (name, data) in enumerate(renders, 1):
    path = f"/tmp/story_preview_{i}_{name}.jpg"
    Path(path).write_bytes(data)
    kb = len(data) / 1024
    print(f"  [{i}] {name:20s}  {kb:6.1f} KB  → {path}")

print("\nDone. Open /tmp/story_preview_*.jpg to review.")
