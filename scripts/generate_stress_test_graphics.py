"""Generate 50+ edge-case social media graphics for exhaustive stress testing.

Tests: empty strings, max-length strings, Unicode, all 8 archetypes,
extreme magnitudes, 0/1/many operatives, collision scenarios, emoji in names.

Usage:
    PYTHONPATH=. .venv/bin/python scripts/generate_stress_test_graphics.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

OUTPUT_DIR = PROJECT_ROOT / "_test_output" / "stress_test"


def solid_png(w: int, h: int, color: tuple[int, int, int]) -> bytes:
    from PIL import Image
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


ALL_ARCHETYPES = [
    ("The Shadow", "#e74c3c"),
    ("The Tower", "#f39c12"),
    ("The Devouring Mother", "#9b59b6"),
    ("The Entropy", "#8e44ad"),
    ("The Prometheus", "#e67e22"),
    ("The Deluge", "#3498db"),
    ("The Awakening", "#2ecc71"),
    ("The Overthrow", "#e84393"),
]

ALL_OPERATIVE_TYPES = ["Saboteur", "Infiltrator", "Spy", "Propagandist", "Assassin"]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    mock = MagicMock()
    from backend.services.instagram_image_service import InstagramImageService
    svc = InstagramImageService(supabase=mock)
    results: list[tuple[str, bytes]] = []
    idx = [0]

    def add(name: str, data: bytes) -> None:
        idx[0] += 1
        results.append((name, data))
        print(f"  [{idx[0]:02d}] {name}")

    # ═══════════════════════════════════════════════════════════════
    # DETECTION VARIANTS (10)
    # ═══════════════════════════════════════════════════════════════
    print("── Detection ──")

    # D01: All 8 archetypes at various magnitudes
    for i, (arch, color) in enumerate(ALL_ARCHETYPES):
        mag = round(0.1 + i * 0.12, 2)
        slug = arch.lower().replace("the ", "").replace(" ", "_")
        add(f"det_{slug}_{mag}.jpg", svc.compose_story_detection(
            archetype=arch, signature=f"SIG-{i:04d}-ALPHA", magnitude=mag, accent_hex=color))

    # D09: Extremely long signature (S1 regression test)
    add("det_long_sig_100char.jpg", svc.compose_story_detection(
        archetype="The Shadow", signature="ANOMALY-SUBSTRATE-RESONANCE-CASCADE-ALPHA-OMEGA-PRIME-ZETA-KAPPA-THETA-EPSILON-0001",
        magnitude=0.95, accent_hex="#e74c3c"))

    # D10: Empty/minimal signature
    add("det_empty_sig.jpg", svc.compose_story_detection(
        archetype="The Tower", signature="X", magnitude=0.01, accent_hex="#f39c12"))

    # ═══════════════════════════════════════════════════════════════
    # CLASSIFICATION VARIANTS (10)
    # ═══════════════════════════════════════════════════════════════
    print("── Classification ──")

    # C01: Normal
    add("cls_normal.jpg", svc.compose_story_classification(
        archetype="The Tower", source_category="Structural Collapse",
        affected_shard_count=3, highest_susceptibility_sim="Cite des Dames",
        highest_susceptibility_val=0.88,
        bureau_dispatch="Standard Bureau dispatch. Brief.", accent_hex="#f39c12"))

    # C02: EXTREMELY long category (S1/U3 regression)
    add("cls_long_category.jpg", svc.compose_story_classification(
        archetype="The Entropy",
        source_category="Interdimensional Psychological Substrate Dissolution Protocol Override with Extended Bureaucratic Classification Appendix Revision Seventeen",
        affected_shard_count=99, highest_susceptibility_sim="X", highest_susceptibility_val=0.1,
        bureau_dispatch=None, accent_hex="#8e44ad"))

    # C03: Very long sim name (S3 regression)
    add("cls_long_sim.jpg", svc.compose_story_classification(
        archetype="The Deluge", source_category="Flood",
        affected_shard_count=1,
        highest_susceptibility_sim="The Democratic Republic of Autonomous Governance and Perpetual Enlightenment Through Bureaucratic Excellence of the Northern Administrative District",
        highest_susceptibility_val=3.14,
        bureau_dispatch="Brief.", accent_hex="#3498db"))

    # C04: Very long dispatch (S2 regression -- CRITICAL)
    long_dispatch = "CIPHER-0001-ALPHA :: " + "All Bureau operatives must comply. " * 20
    add("cls_long_dispatch.jpg", svc.compose_story_classification(
        archetype="The Shadow", source_category="Total Collapse",
        affected_shard_count=15, highest_susceptibility_sim="Cite des Dames",
        highest_susceptibility_val=2.5,
        bureau_dispatch=long_dispatch, accent_hex="#e74c3c"))

    # C05: No dispatch, minimal content
    add("cls_no_dispatch.jpg", svc.compose_story_classification(
        archetype="The Awakening", source_category="X",
        affected_shard_count=0, highest_susceptibility_sim="V",
        highest_susceptibility_val=0.0, bureau_dispatch=None, accent_hex="#2ecc71"))

    # C06: Unicode in sim name
    add("cls_unicode_sim.jpg", svc.compose_story_classification(
        archetype="The Prometheus", source_category="Resonance",
        affected_shard_count=2,
        highest_susceptibility_sim="Cite des Dames",
        highest_susceptibility_val=1.0,
        bureau_dispatch="Operatives: report.", accent_hex="#e67e22"))

    # C07-C10: All remaining archetypes
    for arch, color in [("The Devouring Mother", "#9b59b6"), ("The Overthrow", "#e84393"),
                         ("The Prometheus", "#e67e22"), ("The Deluge", "#3498db")]:
        slug = arch.lower().replace("the ", "").replace(" ", "_")
        add(f"cls_{slug}.jpg", svc.compose_story_classification(
            archetype=arch, source_category="Standard Resonance",
            affected_shard_count=5, highest_susceptibility_sim="Test Shard",
            highest_susceptibility_val=0.75,
            bureau_dispatch="Monitor and report.", accent_hex=color))

    # ═══════════════════════════════════════════════════════════════
    # IMPACT VARIANTS (10)
    # ═══════════════════════════════════════════════════════════════
    print("── Impact ──")

    # I01: Very long sim name (S4 regression)
    add("imp_long_name.jpg", svc.compose_story_impact(
        simulation_name="The Democratic Republic of Autonomous Governance and Perpetual Enlightenment",
        effective_magnitude=0.99, events_spawned=["Event A", "Event B"],
        narrative_closing="Memory bleeds.", accent_hex="#e74c3c", sim_color_hex="#c0392b",
        banner_bytes=None, portraits=None, reactions=None))

    # I02: 0 events, empty closing
    add("imp_zero_events.jpg", svc.compose_story_impact(
        simulation_name="V", effective_magnitude=0.01, events_spawned=[],
        narrative_closing="", accent_hex="#3498db", sim_color_hex="#2980b9",
        banner_bytes=None, portraits=None, reactions=None))

    # I03: 7 events (max visible)
    add("imp_7_events.jpg", svc.compose_story_impact(
        simulation_name="Cite des Dames", effective_magnitude=0.85,
        events_spawned=[f"Event {i}: The {['Cathedral', 'Archive', 'Market', 'Border', 'Railway', 'Square', 'Bunker'][i-1]} Incident" for i in range(1, 8)],
        narrative_closing="The Bureau recalibrates.", accent_hex="#f39c12", sim_color_hex="#d68910",
        banner_bytes=None, portraits=None, reactions=None))

    # I04: Very long closing text (S5 regression)
    add("imp_long_closing.jpg", svc.compose_story_impact(
        simulation_name="Cite des Dames", effective_magnitude=0.72,
        events_spawned=["The Cathedral Shifts"],
        narrative_closing="When the architecture of certainty fractures, what spills through is not chaos but the accumulated weight of every suppressed truth, every classified document, every erased identity that the Bureau tried to file away in Sub-Level C.",
        accent_hex="#9b59b6", sim_color_hex="#8e44ad",
        banner_bytes=None, portraits=None, reactions=None))

    # I05: With reactions (no portraits)
    add("imp_with_reactions.jpg", svc.compose_story_impact(
        simulation_name="Cite des Dames", effective_magnitude=0.65,
        events_spawned=["Market Panic", "Border Shift"],
        narrative_closing="The substrate remembers.",
        accent_hex="#e67e22", sim_color_hex="#d35400",
        banner_bytes=None, portraits=None,
        reactions=[{"agent_name": "Viktor Harken", "text": "This is precisely the sort of disruption that validates our protocols. Increase surveillance in all affected sectors.", "emotion": "cold satisfaction"}]))

    # I06-I10: All archetypes at different magnitudes
    for i, (arch, color) in enumerate(ALL_ARCHETYPES[:5]):
        slug = arch.lower().replace("the ", "").replace(" ", "_")
        mag = round(0.2 * (i + 1), 2)
        add(f"imp_{slug}.jpg", svc.compose_story_impact(
            simulation_name=f"Shard {i+1}", effective_magnitude=mag,
            events_spawned=[f"Event {j}" for j in range(i + 1)],
            narrative_closing="The trembling subsides.", accent_hex=color, sim_color_hex=color,
            banner_bytes=None, portraits=None, reactions=None))

    # ═══════════════════════════════════════════════════════════════
    # ADVISORY VARIANTS (10)
    # ═══════════════════════════════════════════════════════════════
    print("── Advisory ──")

    # A01: 5v5 all types both sides (max density)
    add("adv_5v5_max.jpg", svc.compose_story_advisory(
        archetype="The Shadow", aligned_types=ALL_OPERATIVE_TYPES,
        opposed_types=ALL_OPERATIVE_TYPES, zone_name="Zone Alpha", accent_hex="#e74c3c"))

    # A02: 5v0 with very long zone name (S7/S8 regression)
    add("adv_5v0_long_zone.jpg", svc.compose_story_advisory(
        archetype="The Overthrow", aligned_types=ALL_OPERATIVE_TYPES, opposed_types=[],
        zone_name="The Extended Administrative District of Northern Industrial Reclamation Zone Fourteen Under Bureau Oversight Protocol",
        accent_hex="#e84393"))

    # A03: 0v0 no zone (empty)
    add("adv_empty.jpg", svc.compose_story_advisory(
        archetype="The Tower", aligned_types=[], opposed_types=[],
        zone_name=None, accent_hex="#f39c12"))

    # A04: 1v1 minimal
    add("adv_1v1.jpg", svc.compose_story_advisory(
        archetype="The Deluge", aligned_types=["Spy"], opposed_types=["Assassin"],
        zone_name="Canal District", accent_hex="#3498db"))

    # A05: 0v5 all opposed
    add("adv_0v5.jpg", svc.compose_story_advisory(
        archetype="The Entropy", aligned_types=[], opposed_types=ALL_OPERATIVE_TYPES,
        zone_name="The Void", accent_hex="#8e44ad"))

    # A06-A10: Various archetypes with different configs
    configs = [
        ("The Awakening", ["Infiltrator", "Spy"], ["Propagandist"], "The Market Quarter", "#2ecc71"),
        ("The Prometheus", ["Saboteur"], ["Spy", "Assassin", "Propagandist"], "The Foundry", "#e67e22"),
        ("The Devouring Mother", ["Saboteur", "Infiltrator", "Spy", "Propagandist"], ["Assassin"], None, "#9b59b6"),
        ("The Shadow", ["Assassin"], [], "Block 7", "#e74c3c"),
        ("The Deluge", ["Infiltrator", "Spy"], ["Saboteur", "Propagandist", "Assassin"], "The Extended Northern Waterfront Industrial District", "#3498db"),
    ]
    for arch, aligned, opposed, zone, color in configs:
        slug = arch.lower().replace("the ", "").replace(" ", "_")
        add(f"adv_{slug}_{len(aligned)}v{len(opposed)}.jpg", svc.compose_story_advisory(
            archetype=arch, aligned_types=aligned, opposed_types=opposed,
            zone_name=zone, accent_hex=color))

    # ═══════════════════════════════════════════════════════════════
    # SUBSIDING VARIANTS (5)
    # ═══════════════════════════════════════════════════════════════
    print("── Subsiding ──")

    for arch, color in ALL_ARCHETYPES[:5]:
        slug = arch.lower().replace("the ", "").replace(" ", "_")
        import random
        random.seed(hash(arch))
        ev = random.randint(0, 150)
        sh = random.randint(0, 20)
        add(f"sub_{slug}_{ev}ev.jpg", svc.compose_story_subsiding(
            archetype=arch, events_spawned_total=ev, shards_affected=sh, accent_hex=color))

    # ═══════════════════════════════════════════════════════════════
    # FEED POST VARIANTS (5)
    # ═══════════════════════════════════════════════════════════════
    print("── Feed Posts ──")

    bg = solid_png(1080, 1350, (15, 23, 42))

    # F01: Very long title (S10 regression)
    add("feed_long_title.jpg", svc._compose_with_overlay(
        image_bytes=bg, title="SHARD SURVEILLANCE -- The Kanzlerpalast der Administrativen Vollstreckung und Ewigen Ordnung des Staates",
        subtitle="LOCATION: The Democratic Republic of Autonomous Governance and Perpetual Enlightenment",
        color_primary="#e74c3c", color_background="#1a0a0a", classification="RESTRICTED", cipher_hint=None))

    # F02: Minimal
    add("feed_minimal.jpg", svc._compose_with_overlay(
        image_bytes=bg, title="X", subtitle="Y",
        color_primary="#2ecc71", color_background="#0a1a0a", classification="PUBLIC", cipher_hint=None))

    # F03: With cipher hint
    add("feed_cipher.jpg", svc._compose_with_overlay(
        image_bytes=bg, title="DISPATCH [0042]", subtitle="RE: Cite des Dames",
        color_primary="#f39c12", color_background="#0f172a", classification="AMBER",
        cipher_hint="BUREAU-ALPHA-7741-OMEGA-PRIME"))

    # F04: With real image background
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (1080, 1350), (30, 40, 60))
    draw = ImageDraw.Draw(img)
    for y in range(0, 1350, 50):
        draw.line([(0, y), (1080, y)], fill=(40, 50, 70), width=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    add("feed_with_image.jpg", svc._compose_with_overlay(
        image_bytes=buf.getvalue(), title="PERSONNEL FILE -- Elena Voss",
        subtitle="SHARD: Cite des Dames",
        color_primary="#3498db", color_background="#0f172a", classification="AMBER", cipher_hint=None))

    # F05: All classifications
    for classif in ("PUBLIC", "AMBER", "RESTRICTED"):
        add(f"feed_{classif.lower()}.jpg", svc._compose_with_overlay(
            image_bytes=bg, title=f"DISPATCH [0001] -- Classification Test",
            subtitle=f"RE: Test Shard -- {classif}",
            color_primary="#e2e8f0", color_background="#0f172a", classification=classif, cipher_hint=None))

    # ═══════════════════════════════════════════════════════════════
    # SAVE ALL
    # ═══════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"Saving {len(results)} images to {OUTPUT_DIR}/")
    print(f"{'='*60}")
    total_bytes = 0
    for filename, jpeg_bytes in results:
        (OUTPUT_DIR / filename).write_bytes(jpeg_bytes)
        total_bytes += len(jpeg_bytes)
    print(f"  Total: {len(results)} files, {total_bytes/1024:.0f} KB")


if __name__ == "__main__":
    main()
