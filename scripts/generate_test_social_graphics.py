"""Generate test social media graphics with DIVERSE content for UI/UX stress testing.

Generates multiple variants per template with edge-case content:
- Very long names, very short names
- All 8 archetypes
- Extreme magnitude values (0.01, 0.50, 0.99)
- Long dispatch text, empty dispatch text
- Many events vs zero events
- Long simulation names, short ones
- Unicode characters in names

Usage:
    PYTHONPATH=. .venv/bin/python scripts/generate_test_social_graphics.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

OUTPUT_DIR = PROJECT_ROOT / "_test_output" / "social_media"


def make_solid_png(w: int, h: int, color: tuple[int, int, int]) -> bytes:
    from PIL import Image

    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Test Data Variants ───────────────────────────────────────────────

ARCHETYPES = [
    ("The Shadow", "#e74c3c"),
    ("The Tower", "#f39c12"),
    ("The Devouring Mother", "#9b59b6"),
    ("The Entropy", "#8e44ad"),
    ("The Prometheus", "#e67e22"),
    ("The Deluge", "#3498db"),
    ("The Awakening", "#2ecc71"),
    ("The Overthrow", "#e84393"),
]

DETECTION_VARIANTS = [
    # (archetype, signature, magnitude, accent, label)
    ("The Shadow", "RESONANCE-7741-SIGMA", 0.72, "#e74c3c", "shadow_normal"),
    ("The Devouring Mother", "ANOMALY-0001-ALPHA-OMEGA-PRIME-EXTENDED", 0.99, "#9b59b6", "mother_long_sig_max_mag"),
    ("The Overthrow", "R-1", 0.01, "#e84393", "overthrow_short_sig_min_mag"),
    ("The Prometheus", "RESONANCE-4419-KAPPA-ZETA", 0.50, "#e67e22", "prometheus_mid_mag"),
]

CLASSIFICATION_VARIANTS = [
    # (archetype, source_category, shards, sim_name, suscept, dispatch, accent, label)
    ("The Tower", "Structural Collapse Resonance", 3, "Cite des Dames", 0.88,
     "CIPHER-4419-KAPPA :: Operatives embedded. Await further instruction.",
     "#f39c12", "tower_normal"),
    ("The Devouring Mother", "Psychological Substrate Dissolution with Extended Classification Protocol Override", 12,
     "The Democratic Republic of Autonomous Governance and Perpetual Enlightenment Through Bureaucratic Excellence",
     2.47, "CIPHER-0001-ALPHA :: Immediate evacuation of all personnel within the designated exclusion zone. "
     "All Bureau operatives are to report to their assigned stations for full decontamination and debriefing. "
     "Non-compliance will result in reclassification under Protocol Seventeen.",
     "#9b59b6", "mother_OVERFLOW_stress"),
    ("The Entropy", "X", 1, "V", 0.1, None, "#8e44ad", "entropy_minimal"),
    ("The Awakening", "Consciousness Expansion", 7, "Cite des Dames", 1.55,
     "Brief.", "#2ecc71", "awakening_short_dispatch"),
]

IMPACT_VARIANTS = [
    # (sim_name, magnitude, events, closing, accent, sim_color, label)
    ("Conventional Memory", 0.61,
     ["Market Panic in the Obsidian Quarter", "Whisper Cascade at the Archive"],
     "The substrate remembers what the surface tries to forget.",
     "#9b59b6", "#8e44ad", "entropy_2events"),
    ("The Democratic Republic of Autonomous Governance", 0.99,
     ["Event " + str(i) for i in range(1, 8)],
     "When the architecture of certainty fractures, what spills through is not chaos but memory.",
     "#e74c3c", "#c0392b", "shadow_7events_long_name"),
    ("V", 0.05, [], "Silence.", "#3498db", "#2980b9", "deluge_0events_minimal"),
    ("Cite des Dames", 0.85,
     ["The Cathedral Shifts", "Propaganda Network Collapse", "Underground Railway Discovered",
      "Border Anomaly Cascade", "Agent Defection Chain"],
     "The Bureau does not apologize. The Bureau recalibrates.",
     "#f39c12", "#d68910", "tower_5events"),
]

ADVISORY_VARIANTS = [
    # (archetype, aligned, opposed, zone, accent, label)
    ("The Prometheus", ["Saboteur", "Infiltrator", "Spy"], ["Propagandist", "Assassin"],
     "The Foundry District", "#e67e22", "prometheus_3v2"),
    ("The Overthrow", ["Saboteur", "Infiltrator", "Spy", "Propagandist", "Assassin"], [],
     "The Extended Administrative District of Northern Industrial Reclamation Zone Fourteen",
     "#e84393", "overthrow_5v0_long_zone"),
    ("The Shadow", [], ["Saboteur"], None, "#e74c3c", "shadow_0v1_no_zone"),
    ("The Deluge", ["Spy"], ["Saboteur", "Infiltrator", "Propagandist", "Assassin"],
     "Canal District", "#3498db", "deluge_1v4"),
]

SUBSIDING_VARIANTS = [
    # (archetype, events_total, shards, accent, label)
    ("The Awakening", 7, 4, "#2ecc71", "awakening_normal"),
    ("The Devouring Mother", 99, 15, "#9b59b6", "mother_large_numbers"),
    ("The Overthrow", 1, 1, "#e84393", "overthrow_minimal"),
    ("The Tower", 0, 0, "#f39c12", "tower_zero"),
]

FEED_VARIANTS = [
    # (title, subtitle, color_primary, color_bg, classification, cipher, label)
    ("PERSONNEL FILE -- Agent Meridian", "SHARD: Cite des Dames",
     "#3498db", "#0f172a", "AMBER", "VELG-2741-OMEGA", "feed_normal"),
    ("SHARD SURVEILLANCE -- The Kanzlerpalast der Administrativen Vollstreckung und Ewigen Ordnung",
     "LOCATION: The Democratic Republic of Autonomous Governance",
     "#e74c3c", "#1a0a0a", "RESTRICTED", None, "feed_overflow_long_title"),
    ("DISPATCH [0001]", "RE: V", "#2ecc71", "#0a1a0a", "PUBLIC", "X", "feed_minimal"),
]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    mock_supabase = MagicMock()
    from backend.services.instagram_image_service import InstagramImageService

    svc = InstagramImageService(supabase=mock_supabase)
    results: list[tuple[str, bytes]] = []
    total = (len(DETECTION_VARIANTS) + len(CLASSIFICATION_VARIANTS) +
             len(IMPACT_VARIANTS) + len(ADVISORY_VARIANTS) +
             len(SUBSIDING_VARIANTS) + len(FEED_VARIANTS))
    idx = 0

    # ── Detection ────────────────────────────────────────────────────
    for arch, sig, mag, accent, label in DETECTION_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] detection/{label}")
        data = svc.compose_story_detection(
            archetype=arch, signature=sig, magnitude=mag, accent_hex=accent,
        )
        results.append((f"detection_{label}.jpg", data))

    # ── Classification ───────────────────────────────────────────────
    for arch, cat, shards, sim, susc, dispatch, accent, label in CLASSIFICATION_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] classification/{label}")
        data = svc.compose_story_classification(
            archetype=arch, source_category=cat,
            affected_shard_count=shards,
            highest_susceptibility_sim=sim,
            highest_susceptibility_val=susc,
            bureau_dispatch=dispatch, accent_hex=accent,
        )
        results.append((f"classification_{label}.jpg", data))

    # ── Impact ───────────────────────────────────────────────────────
    for sim, mag, events, closing, accent, sim_color, label in IMPACT_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] impact/{label}")
        data = svc.compose_story_impact(
            simulation_name=sim, effective_magnitude=mag,
            events_spawned=events, narrative_closing=closing,
            accent_hex=accent, sim_color_hex=sim_color,
            banner_bytes=None, portraits=None, reactions=None,
        )
        results.append((f"impact_{label}.jpg", data))

    # ── Advisory ─────────────────────────────────────────────────────
    for arch, aligned, opposed, zone, accent, label in ADVISORY_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] advisory/{label}")
        data = svc.compose_story_advisory(
            archetype=arch, aligned_types=aligned, opposed_types=opposed,
            zone_name=zone, accent_hex=accent,
        )
        results.append((f"advisory_{label}.jpg", data))

    # ── Subsiding ────────────────────────────────────────────────────
    for arch, events_total, shards, accent, label in SUBSIDING_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] subsiding/{label}")
        data = svc.compose_story_subsiding(
            archetype=arch, events_spawned_total=events_total,
            shards_affected=shards, accent_hex=accent,
        )
        results.append((f"subsiding_{label}.jpg", data))

    # ── Feed Posts ───────────────────────────────────────────────────
    for title, subtitle, cpri, cbg, classif, cipher, label in FEED_VARIANTS:
        idx += 1
        print(f"[{idx}/{total}] feed/{label}")
        bg = make_solid_png(1080, 1350, (15, 23, 42))
        data = svc._compose_with_overlay(
            image_bytes=bg, title=title, subtitle=subtitle,
            color_primary=cpri, color_background=cbg,
            classification=classif, cipher_hint=cipher,
        )
        results.append((f"feed_{label}.jpg", data))

    # ── Save ─────────────────────────────────────────────────────────
    print(f"\nSaving {len(results)} images to {OUTPUT_DIR}/")
    print("-" * 60)
    for filename, jpeg_bytes in results:
        (OUTPUT_DIR / filename).write_bytes(jpeg_bytes)
        print(f"  {filename:55s}  {len(jpeg_bytes)/1024:7.1f} KB")
    print("-" * 60)
    print(f"  Total: {len(results)} files, {sum(len(b) for _, b in results)/1024:.1f} KB")


if __name__ == "__main__":
    main()
