"""Send all email templates to a test address for visual review.

Usage:
    cd /path/to/velgarien-rebuild
    source backend/.venv/bin/activate
    python scripts/send_test_emails.py
"""

import asyncio
import sys
import os

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.email_service import EmailService
from backend.services.email_templates import (
    render_clearance_denied,
    render_clearance_granted,
    render_clearance_request_admin_notification,
    render_cycle_briefing,
    render_epoch_completed,
    render_epoch_invitation,
    render_phase_change,
)

RECIPIENT = "matthias@leihs.at"


def build_all_templates() -> list[tuple[str, str]]:
    """Return list of (subject, html_body) for all templates."""
    templates = []

    # 1. Epoch Invitation
    templates.append((
        "[TEST] Epoch Invitation — Operation Crimson Tide",
        render_epoch_invitation(
            epoch_name="Operation Crimson Tide",
            lore_text=(
                "The substrate trembles. Across the fractured planes of the multiverse, "
                "a new convergence point has been detected — a nexus of unprecedented power "
                "that threatens to reshape the very fabric of reality. The Bureau of Impossible "
                "Geography has issued a Priority One summons to all qualified simulation operators. "
                "Your world's unique resonance signature has been flagged as critical to the "
                "outcome of this event. Failure to respond may result in catastrophic substrate "
                "destabilization across your entire reality cluster."
            ),
            invite_url="https://metaverse.center/epoch/join?token=test-preview-token",
            locale="en",
            accent_color="#ff6b2b",
            cycle_hours=8,
        ),
    ))

    # 2. Cycle Briefing (data-rich)
    templates.append((
        "[TEST] Cycle Briefing — Operation Crimson Tide, Cycle 3",
        render_cycle_briefing(
            data={
                "epoch_name": "Operation Crimson Tide",
                "epoch_status": "competition",
                "cycle_number": 3,
                "rank": 2,
                "prev_rank": 3,
                "total_players": 5,
                "composite": 78.4,
                "composite_delta": 5.2,
                "dimensions": [
                    {"name": "stability", "value": 82.1, "delta": 3.0},
                    {"name": "influence", "value": 71.5, "delta": -2.4},
                    {"name": "sovereignty", "value": 88.0, "delta": 8.1},
                    {"name": "diplomatic", "value": 65.3, "delta": 4.5},
                    {"name": "military", "value": 85.1, "delta": 12.8},
                ],
                "rp_balance": 45,
                "rp_cap": 100,
                "active_ops": 3,
                "resolved_ops": 7,
                "success_ops": 5,
                "detected_ops": 1,
                "guardians": 2,
                "counter_intel": 1,
                "public_events": [
                    {"narrative": "A mysterious tremor shook the Market District, toppling three stalls."},
                    {"narrative": "The Ambassador of Speranza delivered a fiery speech at the Grand Assembly."},
                    {"narrative": "Strange lights were observed over the Harbor Quarter at midnight."},
                    {"narrative": "A new guild was established in the Old Town: The Order of the Silver Quill."},
                ],
                "simulation_name": "Velgarien",
                "command_center_url": "https://metaverse.center/epoch",
                "accent_color": "#ff6b2b",
                "simulation_slug": "velgarien",
                "threats": [
                    {"type": "saboteur", "source": "The Gaslit Reach", "target_zone": "Market District", "detected": True},
                    {"type": "spy", "source": "Station Null", "target_zone": "Harbor Quarter", "detected": False},
                ],
                "spy_intel": [
                    {"target_sim": "Speranza", "zone": "Old Town", "security": "medium", "guardians": 1},
                ],
                "missions": [
                    {"type": "spy", "target_sim": "The Gaslit Reach", "success": True, "detected": False},
                    {"type": "saboteur", "target_sim": "Station Null", "success": True, "detected": True},
                    {"type": "propagandist", "target_sim": "Speranza", "success": False, "detected": False},
                ],
                "rank_gap": {"ahead_name": "Station Null", "ahead_score": 82.1, "gap": 3.7},
                "next_cycle_missions": 2,
                "next_cycle_rp_projection": 55,
                "alliance_name": "The Northern Pact",
                "ally_names": ["Speranza"],
                "alliance_bonus_active": True,
                "has_threat_data": True,
            },
            email_locale=None,  # bilingual
        ),
    ))

    # 3. Phase Change (foundation -> competition)
    templates.append((
        "[TEST] Phase Change — Competition Phase Begins",
        render_phase_change(
            epoch_name="Operation Crimson Tide",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=4,
            command_center_url="https://metaverse.center/epoch",
            accent_color="#ff6b2b",
            standing_data={"rank": 2, "total_players": 5, "composite": 78.4},
        ),
    ))

    # 4. Phase Change (competition -> reckoning)
    templates.append((
        "[TEST] Phase Change — Reckoning Phase (Urgent)",
        render_phase_change(
            epoch_name="Operation Crimson Tide",
            old_phase="competition",
            new_phase="reckoning",
            cycle_count=8,
            command_center_url="https://metaverse.center/epoch",
            accent_color="#ff6b2b",
            standing_data={"rank": 1, "total_players": 5, "composite": 91.2},
        ),
    ))

    # 5. Epoch Completed
    templates.append((
        "[TEST] Epoch Completed — Final Standings",
        render_epoch_completed(
            epoch_name="Operation Crimson Tide",
            leaderboard=[
                {"simulation_id": "sim-velgarien", "simulation_name": "Velgarien", "composite": 91.2, "rank": 1,
                 "dimensions": {"stability": 88, "influence": 92, "sovereignty": 95, "diplomatic": 85, "military": 96}},
                {"simulation_id": "sim-gaslit", "simulation_name": "The Gaslit Reach", "composite": 82.1, "rank": 2,
                 "dimensions": {"stability": 80, "influence": 85, "sovereignty": 78, "diplomatic": 90, "military": 77}},
                {"simulation_id": "sim-null", "simulation_name": "Station Null", "composite": 75.6, "rank": 3,
                 "dimensions": {"stability": 72, "influence": 78, "sovereignty": 74, "diplomatic": 70, "military": 84}},
                {"simulation_id": "sim-speranza", "simulation_name": "Speranza", "composite": 68.3, "rank": 4,
                 "dimensions": {"stability": 65, "influence": 70, "sovereignty": 68, "diplomatic": 72, "military": 66}},
                {"simulation_id": "sim-cite", "simulation_name": "Cite des Dames", "composite": 55.0, "rank": 5,
                 "dimensions": {"stability": 50, "influence": 55, "sovereignty": 52, "diplomatic": 60, "military": 58}},
            ],
            player_simulation_id="sim-velgarien",
            cycle_count=12,
            command_center_url="https://metaverse.center/epoch",
            accent_color="#ff6b2b",
            campaign_stats={
                "total_ops": 24,
                "success_rate": 0.75,
                "by_type": {"spy": 6, "saboteur": 5, "propagandist": 4, "assassin": 3, "guardian": 4, "infiltrator": 2},
            },
        ),
    ))

    # 6. Clearance Granted
    templates.append((
        "[TEST] Clearance Granted — Architect Access",
        render_clearance_granted(
            forge_url="https://metaverse.center/forge",
            admin_notes="Welcome aboard, Architect. Your simulations show exceptional promise. The Forge awaits your designs.",
        ),
    ))

    # 7. Clearance Denied
    templates.append((
        "[TEST] Clearance Denied",
        render_clearance_denied(
            admin_notes="Your request has been noted. Please ensure your simulation has at least 5 agents and 3 buildings before reapplying.",
        ),
    ))

    # 8. Admin Notification (clearance request)
    templates.append((
        "[TEST] Admin: New Clearance Request",
        render_clearance_request_admin_notification(
            user_email="test-operative@example.com",
            message="I've been building Velgarien for 3 months and would love to access the Forge to create my own simulations.",
            admin_panel_url="https://metaverse.center/admin",
        ),
    ))

    return templates


async def main():
    templates = build_all_templates()
    print(f"Sending {len(templates)} test emails to {RECIPIENT}...")
    print()

    for i, (subject, html_body) in enumerate(templates, 1):
        print(f"  [{i}/{len(templates)}] {subject}...")
        ok = await EmailService.send(RECIPIENT, subject, html_body)
        if ok:
            print("           -> Sent!")
        else:
            print("           -> FAILED (check SMTP config)")
        # Brief pause to avoid throttling
        await asyncio.sleep(0.5)

    print()
    print(f"Done. {len(templates)} emails sent to {RECIPIENT}.")


if __name__ == "__main__":
    asyncio.run(main())
