"""Unit tests for email templates — structure and content verification."""

from backend.services.email_templates import (
    render_cycle_briefing,
    render_epoch_completed,
    render_epoch_invitation,
    render_phase_change,
)

# ── Cycle Briefing ────────────────────────────────────────────


class TestRenderCycleBriefing:
    def _sample_data(self) -> dict:
        return {
            "epoch_name": "Operation Shadow",
            "epoch_status": "competition",
            "cycle_number": 3,
            "rank": 2,
            "prev_rank": 3,
            "total_players": 4,
            "composite": 72.3,
            "composite_delta": 3.2,
            "dimensions": [
                {"name": "stability", "value": 72.3, "delta": 2.1},
                {"name": "influence", "value": 45.0, "delta": -1.3},
                {"name": "sovereignty", "value": 88.1, "delta": 0.0},
                {"name": "diplomatic", "value": 60.5, "delta": 5.2},
                {"name": "military", "value": 33.2, "delta": 8.0},
            ],
            "rp_balance": 18,
            "rp_cap": 40,
            "active_ops": 3,
            "resolved_ops": 2,
            "success_ops": 1,
            "detected_ops": 1,
            "guardians": 2,
            "counter_intel": 0,
            "public_events": [
                {"narrative": "An operative was detected infiltrating Station Null.", "event_type": "detection"},
                {"narrative": "Alliance Shadow Pact dissolved.", "event_type": "betrayal"},
            ],
            "simulation_name": "Velgarien",
            "command_center_url": "https://metaverse.center/epoch",
            # New enrichment fields
            "accent_color": "#ff6b2b",
            "simulation_slug": "velgarien",
            "missions": [
                {"type": "spy", "target_name": "Station Null", "status": "success"},
                {"type": "saboteur", "target_name": "Speranza", "status": "failed"},
            ],
            "threats": [
                {"type": "spy", "status": "detected", "source_name": "Speranza"},
            ],
            "has_threat_data": True,
            "spy_intel": [
                {"narrative": "Intel report: Station Null zone security revealed."},
            ],
            "rank_gap": {"en": "5.2 points behind #1", "de": "5,2 Punkte hinter #1"},
            "alliance_name": None,
            "ally_names": [],
            "alliance_bonus_active": False,
            "next_cycle_missions": 2,
            "next_cycle_rp_projection": "+12 → 30 / 40",
        }

    def test_contains_epoch_name(self):
        html = render_cycle_briefing(self._sample_data())
        assert "Operation Shadow" in html

    def test_contains_cycle_number(self):
        html = render_cycle_briefing(self._sample_data())
        assert "CYCLE 3 RESOLVED" in html

    def test_contains_rank(self):
        html = render_cycle_briefing(self._sample_data())
        assert "#2 / 4" in html

    def test_contains_composite_score(self):
        html = render_cycle_briefing(self._sample_data())
        assert "72.3" in html

    def test_contains_dimension_names_en(self):
        html = render_cycle_briefing(self._sample_data())
        assert "STABILITY" in html
        assert "INFLUENCE" in html
        assert "SOVEREIGNTY" in html
        assert "DIPLOMATIC" in html
        assert "MILITARY" in html

    def test_contains_dimension_names_de(self):
        """German section should contain translated dimension names."""
        html = render_cycle_briefing(self._sample_data())
        assert "STABILIT" in html  # STABILITÄT
        assert "EINFLUSS" in html
        assert "DIPLOMATIE" in html

    def test_contains_operative_status_mission_log(self):
        """B7: When mission details are present, renders per-mission log."""
        html = render_cycle_briefing(self._sample_data())
        assert "OPERATIVE DEPLOYMENT LOG" in html
        assert "SPY" in html  # Operative type in mission table

    def test_contains_operative_status_aggregate_fallback(self):
        """Aggregate view when no mission details provided."""
        data = self._sample_data()
        data["missions"] = []  # Trigger aggregate fallback
        html = render_cycle_briefing(data)
        assert "ACTIVE" in html
        assert "RESOLVED" in html

    def test_contains_public_events(self):
        html = render_cycle_briefing(self._sample_data())
        assert "Station Null" in html
        assert "Shadow Pact" in html

    def test_contains_cta_link(self):
        html = render_cycle_briefing(self._sample_data())
        assert "https://metaverse.center/epoch" in html

    def test_contains_german_section(self):
        html = render_cycle_briefing(self._sample_data())
        assert "DEUTSCHE VERSION" in html

    def test_contains_footer_links(self):
        html = render_cycle_briefing(self._sample_data())
        assert "Manage notifications" in html
        assert "Benachrichtigungen verwalten" in html

    def test_html_structure(self):
        html = render_cycle_briefing(self._sample_data())
        assert html.startswith("<!DOCTYPE html>")
        assert "</html>" in html
        assert '<body' in html

    def test_escapes_epoch_name(self):
        data = self._sample_data()
        data["epoch_name"] = "Test <script>alert(1)</script>"
        html = render_cycle_briefing(data)
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_no_events_shows_no_intercepts(self):
        data = self._sample_data()
        data["public_events"] = []
        html = render_cycle_briefing(data)
        assert "No public signals intercepted" in html

    # ── New section tests (B1-B7 enrichment) ──

    def test_contains_threat_assessment(self):
        """B1: Threat assessment section shows detected inbound ops."""
        html = render_cycle_briefing(self._sample_data())
        assert "THREAT ASSESSMENT" in html
        assert "Speranza" in html  # Source of the threat

    def test_no_threats_shows_message(self):
        data = self._sample_data()
        data["threats"] = []
        html = render_cycle_briefing(data)
        assert "No inbound threats detected" in html

    def test_contains_spy_intel(self):
        """B2: Spy intel digest shows earned intelligence."""
        html = render_cycle_briefing(self._sample_data())
        assert "SPY INTEL DIGEST" in html
        assert "zone security revealed" in html

    def test_contains_rank_gap(self):
        """B3: Rank gap indicator."""
        html = render_cycle_briefing(self._sample_data())
        assert "5.2 points behind #1" in html

    def test_contains_next_cycle_preview(self):
        """B4: Next cycle preview section."""
        html = render_cycle_briefing(self._sample_data())
        assert "NEXT CYCLE PREVIEW" in html
        assert "12" in html  # RP projection

    def test_contains_alliance_status_independent(self):
        """B6: Alliance status when operating independently."""
        data = self._sample_data()
        data["alliance_name"] = None
        html = render_cycle_briefing(data)
        assert "ALLIANCE STATUS" in html
        assert "Operating independently" in html

    def test_contains_alliance_status_allied(self):
        """B6: Alliance status when in an alliance."""
        data = self._sample_data()
        data["alliance_name"] = "Shadow Pact"
        data["ally_names"] = ["The Gaslit Reach", "Speranza"]
        data["alliance_bonus_active"] = True
        html = render_cycle_briefing(data)
        assert "Shadow Pact" in html
        assert "DIPLOMATIC BONUS" in html

    def test_contains_mission_log(self):
        """B7: Per-mission breakdown."""
        data = self._sample_data()
        html = render_cycle_briefing(data)
        assert "OPERATIVE DEPLOYMENT LOG" in html
        assert "SPY" in html  # Operative type label

    def test_per_simulation_accent_color(self):
        """F1: Per-simulation accent color used in score bars."""
        data = self._sample_data()
        data["accent_color"] = "#ff6b2b"
        html = render_cycle_briefing(data)
        assert "#ff6b2b" in html

    def test_per_simulation_narrative_voice(self):
        """F2: Per-simulation narrative header."""
        data = self._sample_data()
        data["simulation_slug"] = "velgarien"
        html = render_cycle_briefing(data)
        assert "BUREAU DIRECTIVE" in html

    def test_single_language_en(self):
        """A1: Single-language rendering."""
        html = render_cycle_briefing(self._sample_data(), email_locale="en")
        assert "DEUTSCHE VERSION" not in html
        assert "STABILITY" in html

    def test_single_language_de(self):
        """A1: Single-language German rendering."""
        html = render_cycle_briefing(self._sample_data(), email_locale="de")
        assert "DEUTSCHE VERSION" not in html
        assert "STABILIT" in html  # STABILITÄT
        # Should NOT contain English dimension names as primary
        # (German is the first and only block)

    def test_dark_mode_meta_tag(self):
        """A4: Dark mode meta tags for Apple Mail/iOS/Outlook compatibility."""
        html = render_cycle_briefing(self._sample_data())
        assert 'name="color-scheme" content="light dark"' in html


# ── Phase Change ──────────────────────────────────────────────


class TestRenderPhaseChange:
    def test_contains_phase_names(self):
        html = render_phase_change(
            epoch_name="Operation Dawn",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "FOUNDATION" in html
        assert "COMPETITION" in html
        assert "Operation Dawn" in html

    def test_contains_german_phase_names(self):
        html = render_phase_change(
            epoch_name="Test",
            old_phase="competition",
            new_phase="reckoning",
            cycle_count=10,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "WETTBEWERB" in html
        assert "ABRECHNUNG" in html

    def test_contains_cycle_count(self):
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=7,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "7" in html

    def test_contains_operational_changes(self):
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "Standard RP allocation" in html

    def test_bilingual(self):
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "DEUTSCHE VERSION" in html

    # ── New phase change tests (C1, C2, A1) ──

    def test_per_player_standing_data(self):
        """C1: Phase change email includes player standing."""
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
            standing_data={"rank": 2, "total_players": 5, "composite": 65.4},
        )
        assert "#2 / 5" in html
        assert "65.4" in html

    def test_accent_color(self):
        """F1: Per-simulation accent color."""
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
            accent_color="#0d7377",
        )
        assert "#0d7377" in html

    def test_single_language_en(self):
        """A1: Single-language rendering."""
        html = render_phase_change(
            epoch_name="Test",
            old_phase="foundation",
            new_phase="competition",
            cycle_count=5,
            command_center_url="https://metaverse.center/epoch",
            email_locale="en",
        )
        assert "DEUTSCHE VERSION" not in html


# ── Epoch Completed ───────────────────────────────────────────


class TestRenderEpochCompleted:
    def _sample_leaderboard(self) -> list[dict]:
        return [
            {
                "rank": 1,
                "simulation_id": "sim-a",
                "simulation_name": "Velgarien",
                "composite": 85.2,
                "stability": 90.0,
                "influence": 75.0,
                "sovereignty": 88.0,
                "diplomatic": 70.0,
                "military": 82.0,
                "stability_title": "The Unshaken",
            },
            {
                "rank": 2,
                "simulation_id": "sim-b",
                "simulation_name": "The Gaslit Reach",
                "composite": 72.1,
                "stability": 65.0,
                "influence": 80.0,
                "sovereignty": 70.0,
                "diplomatic": 75.0,
                "military": 68.0,
                "influence_title": "The Resonant",
            },
        ]

    def test_contains_winner(self):
        html = render_epoch_completed(
            epoch_name="Operation Final",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "Velgarien" in html
        # Star icon for winner (military-grade, replaces crown emoji)
        assert "&#9733;" in html

    def test_contains_leaderboard(self):
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "Velgarien" in html
        assert "The Gaslit Reach" in html
        assert "85.2" in html
        assert "72.1" in html

    def test_highlights_player(self):
        """Player's row should have a highlighted background."""
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        # The player row has a different bg color
        assert "#1a1a00" in html

    def test_contains_dimension_titles(self):
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "The Unshaken" in html
        assert "The Resonant" in html

    def test_contains_german_dimension_titles(self):
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        # German section
        assert "Der Unersch" in html  # Der Unerschütterliche
        assert "Der Einflussreiche" in html

    def test_bilingual(self):
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "DEUTSCHE VERSION" in html

    def test_total_cycles(self):
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
        )
        assert "15" in html

    # ── New completed email tests (D1, D2, A1, F1) ──

    def test_campaign_stats(self):
        """D1: Personal campaign statistics."""
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
            campaign_stats={
                "total_ops": 12,
                "success_rate": 66.7,
                "by_type": {"spy": 4, "saboteur": 3, "guardian": 5},
            },
        )
        assert ">12<" in html  # total ops (in <strong> tag)
        assert "67%" in html  # success rate (:.0f rounds 66.7→67)
        assert "SPY:4" in html or "SPY" in html  # type breakdown

    def test_single_language_en(self):
        """A1: Single-language rendering."""
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
            email_locale="en",
        )
        assert "DEUTSCHE VERSION" not in html

    def test_accent_color(self):
        """F1: Per-simulation accent color."""
        html = render_epoch_completed(
            epoch_name="Test",
            leaderboard=self._sample_leaderboard(),
            player_simulation_id="sim-b",
            cycle_count=15,
            command_center_url="https://metaverse.center/epoch",
            accent_color="#C08A10",
        )
        assert "#C08A10" in html


# ── Existing Invitation (regression) ─────────────────────────


class TestRenderEpochInvitation:
    def _render(self, **overrides) -> str:
        defaults = {
            "epoch_name": "Test Epoch",
            "lore_text": "The shadows gather in the void...",
            "invite_url": "https://metaverse.center/epoch/join?token=abc",
            "locale": "en",
        }
        defaults.update(overrides)
        return render_epoch_invitation(**defaults)

    def test_renders_without_error(self):
        html = self._render()
        assert "Test Epoch" in html
        assert "The shadows gather" in html
        assert "token=abc" in html

    def test_html_structure(self):
        html = self._render()
        assert html.startswith("<!DOCTYPE html>")
        assert "</html>" in html
        assert "<body" in html
        assert "EPOCH SUMMONS" in html

    def test_bilingual_en_and_de(self):
        html = self._render()
        assert "DEUTSCHE VERSION" in html
        # EN header
        assert "CLASSIFIED // EPOCH SUMMONS" in html
        # DE header
        assert "EPOCHEN-EINBERUFUNG" in html

    def test_contains_intro_en(self):
        html = self._render()
        assert "Do not forward" in html
        assert "deployment" in html.lower()

    def test_contains_intro_de(self):
        html = self._render()
        assert "GEHEIM eingestuft" in html
        assert "Kommandanten" in html

    def test_contains_operation_label(self):
        html = self._render()
        assert "OPERATION" in html

    def test_contains_intel_dossier(self):
        html = self._render()
        assert "INTEL DISPATCH" in html
        assert "GEHEIMDIENSTBERICHT" in html
        assert "The shadows gather" in html

    def test_contains_mission_parameters(self):
        """Updated for v2.3 game mechanics."""
        html = self._render()
        assert "MISSION PARAMETERS" in html
        assert "MISSIONSPARAMETER" in html
        assert "Draft your agents" in html
        assert "Deploy 6 operative types" in html
        assert "Forge alliances" in html
        assert "8-hour cycles" in html

    def test_contains_rules_of_engagement(self):
        """Updated for v2.3 game mechanics."""
        html = self._render()
        assert "RULES OF ENGAGEMENT" in html
        assert "EINSATZREGELN" in html
        assert "Each player commands one simulation" in html
        assert "5 dimensions" in html
        assert "Agent aptitudes" in html
        assert "Bot opponents" in html

    def test_contains_cta_buttons(self):
        html = self._render()
        assert "ACCEPT THE SUMMONS" in html
        assert "EINBERUFUNG ANNEHMEN" in html
        # URL appears in both CTA buttons
        assert html.count("token=abc") >= 2

    def test_contains_footer(self):
        html = self._render()
        assert "Manage notifications" in html
        assert "Benachrichtigungen verwalten" in html
        assert "TRANSMISSION ORIGIN" in html

    def test_escapes_epoch_name_xss(self):
        html = self._render(epoch_name='<script>alert("xss")</script>')
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_escapes_lore_text_xss(self):
        html = self._render(lore_text='<img src=x onerror="alert(1)">')
        assert "<img" not in html
        assert "&lt;img" in html

    def test_escapes_invite_url_xss(self):
        html = self._render(invite_url='https://evil.com/"><script>alert(1)</script>')
        assert '"><script>' not in html

    def test_dossier_box_styling(self):
        """Intel dossier should use dashed border box."""
        html = self._render()
        assert "border:1px dashed" in html

    def test_section_header_pattern(self):
        """Section headers use box-drawing characters."""
        html = self._render()
        # Section headers use ── pattern (U+9472 horizontal box)
        assert "&#9472;&#9472;" in html

    # ── New invitation tests (A1, F1, E1, E2) ──

    def test_single_language_en(self):
        """A1: Single-language rendering."""
        html = self._render(email_locale="en")
        assert "DEUTSCHE VERSION" not in html
        assert "CLASSIFIED // EPOCH SUMMONS" in html

    def test_single_language_de(self):
        """A1: Single-language German rendering."""
        html = self._render(email_locale="de")
        assert "DEUTSCHE VERSION" not in html
        assert "EPOCHEN-EINBERUFUNG" in html

    def test_accent_color(self):
        """F1: Per-simulation accent color on CTA button."""
        html = self._render(accent_color="#0d7377")
        assert "#0d7377" in html

    def test_custom_cycle_hours(self):
        """E1: Dynamic cycle_hours in mission parameters."""
        html = self._render(cycle_hours=12)
        assert "12-hour cycles" in html

    def test_dark_mode_meta(self):
        """A4: Dark mode meta tags for Apple Mail/iOS/Outlook compatibility."""
        html = self._render()
        assert 'name="color-scheme" content="light dark"' in html
        assert 'name="supported-color-schemes" content="light dark"' in html


# ── Phase 7: Auto-Resolve + AFK Enrichments ──────────────────


class TestCycleBriefingPhase7:
    """Tests for Phase 7 email enrichments: auto-resolve, AFK, participation, deadline."""

    def _sample_data(self, **overrides) -> dict:
        """Base data with Phase 7 fields populated."""
        base = {
            "epoch_name": "Operation Aegis",
            "epoch_status": "competition",
            "cycle_number": 5,
            "rank": 1,
            "prev_rank": 2,
            "total_players": 4,
            "composite": 85.0,
            "composite_delta": 3.0,
            "dimensions": [
                {"name": "stability", "value": 80.0, "delta": 1.0},
                {"name": "influence", "value": 60.0, "delta": -2.0},
                {"name": "sovereignty", "value": 90.0, "delta": 0.0},
                {"name": "diplomatic", "value": 70.0, "delta": 5.0},
                {"name": "military", "value": 50.0, "delta": 2.0},
            ],
            "rp_balance": 25,
            "rp_cap": 40,
            "active_ops": 1,
            "resolved_ops": 2,
            "success_ops": 1,
            "detected_ops": 0,
            "guardians": 1,
            "counter_intel": 0,
            "public_events": [],
            "simulation_name": "Velgarien",
            "command_center_url": "https://metaverse.center/epoch",
            "accent_color": "#ff6b2b",
            "simulation_slug": "velgarien",
            "missions": [],
            "threats": [],
            "has_threat_data": False,
            "spy_intel": [],
            "rank_gap": {},
            "alliance_name": None,
            "ally_names": [],
            "alliance_bonus_active": False,
            "next_cycle_missions": 0,
            "next_cycle_rp_projection": "+10 → 35 / 40",
            # Phase 7 fields
            "auto_resolved": False,
            "player_was_afk": False,
            "afk_penalty_rp": 0,
            "replaced_by_ai": False,
            "afk_ai_personality": None,
            "consecutive_afk": 0,
            "participation_summary": None,
            "cycle_deadline_minutes": None,
        }
        base.update(overrides)
        return base

    # ── Auto-Resolve Banner ──

    def test_auto_resolve_banner_shown(self):
        """Auto-resolve banner appears when cycle was auto-resolved."""
        html = render_cycle_briefing(self._sample_data(auto_resolved=True))
        assert "auto-resolved" in html.lower() or "automatisch" in html.lower()

    def test_auto_resolve_banner_hidden(self):
        """No auto-resolve banner when cycle resolved normally."""
        html = render_cycle_briefing(self._sample_data(auto_resolved=False))
        # The i18n key "auto_resolved_banner" should NOT appear
        assert "auto-resolved at deadline" not in html.lower()
        assert "fristablauf automatisch" not in html.lower()

    # ── AFK Warning ──

    def test_afk_warning_shown(self):
        """AFK warning section appears when player was absent."""
        html = render_cycle_briefing(self._sample_data(
            player_was_afk=True,
            afk_penalty_rp=15,
        ))
        # Header present
        assert "ABSENCE DETECTED" in html or "ABWESENHEIT ERKANNT" in html
        # Penalty amount shown
        assert "-15" in html

    def test_afk_warning_hidden(self):
        """No AFK section when player was active."""
        html = render_cycle_briefing(self._sample_data(player_was_afk=False))
        assert "ABSENCE DETECTED" not in html

    def test_afk_ai_takeover_message(self):
        """AI takeover message shown when player replaced by bot."""
        html = render_cycle_briefing(self._sample_data(
            player_was_afk=True,
            replaced_by_ai=True,
            afk_ai_personality="sentinel",
        ))
        assert "SENTINEL" in html
        assert "AI" in html or "KI" in html

    def test_afk_consecutive_count(self):
        """Consecutive absence count shown when > 0."""
        html = render_cycle_briefing(self._sample_data(
            player_was_afk=True,
            consecutive_afk=3,
        ))
        assert "3" in html

    # ── Participation Summary ──

    def test_participation_summary_shown(self):
        """Participation stats shown when data available."""
        html = render_cycle_briefing(self._sample_data(
            participation_summary={"acted": 3, "total": 4},
        ))
        assert "3" in html and "4" in html

    def test_participation_summary_hidden(self):
        """No participation stats when data is None."""
        html = render_cycle_briefing(self._sample_data(
            participation_summary=None,
        ))
        # Should not contain the participation summary i18n key output
        assert "players acted" not in html.lower()

    # ── Deadline Info ──

    def test_deadline_info_shown(self):
        """Deadline info shown when config includes deadline minutes."""
        html = render_cycle_briefing(self._sample_data(
            cycle_deadline_minutes=480,
        ))
        assert "480" in html

    def test_deadline_info_hidden(self):
        """No deadline info when not configured."""
        html = render_cycle_briefing(self._sample_data(
            cycle_deadline_minutes=None,
        ))
        assert "deadline" not in html.lower() or "frist" not in html.lower()

    # ── Combined Scenario ──

    def test_full_afk_scenario(self):
        """All Phase 7 fields active simultaneously."""
        html = render_cycle_briefing(self._sample_data(
            auto_resolved=True,
            player_was_afk=True,
            afk_penalty_rp=20,
            replaced_by_ai=True,
            afk_ai_personality="guardian",
            consecutive_afk=2,
            participation_summary={"acted": 2, "total": 4},
            cycle_deadline_minutes=480,
        ))
        # Auto-resolve banner
        assert "auto-resolved" in html.lower() or "automatisch" in html.lower()
        # AFK warning header
        assert "ABSENCE DETECTED" in html or "ABWESENHEIT ERKANNT" in html
        # RP penalty
        assert "-20" in html
        # AI takeover
        assert "GUARDIAN" in html
        # Consecutive
        assert "2" in html
        # Participation
        assert "4" in html
        # Deadline
        assert "480" in html

    # ── CSS Animations (progressive enhancement) ──

    def test_css_animations_in_shell(self):
        """Email shell includes CSS @keyframes for progressive enhancement."""
        html = render_cycle_briefing(self._sample_data())
        assert "@keyframes cursor-blink" in html
        assert "@keyframes glow-breathe" in html
        assert "@keyframes reveal-up" in html
        assert "@keyframes stamp-in" in html

    def test_lang_attribute_dynamic(self):
        """Email lang attribute matches locale."""
        html_en = render_cycle_briefing(self._sample_data(), email_locale="en")
        assert 'lang="en"' in html_en
        html_de = render_cycle_briefing(self._sample_data(), email_locale="de")
        assert 'lang="de"' in html_de

    def test_no_rgba_in_inline_styles(self):
        """No rgba() in inline styles — only in @keyframes (which are in <style> block)."""
        html = render_cycle_briefing(self._sample_data(
            auto_resolved=True,
            player_was_afk=True,
            afk_penalty_rp=10,
        ))
        # Split: everything outside <style>...</style> should have no rgba
        import re
        outside_style = re.sub(r"<style>.*?</style>", "", html, flags=re.DOTALL)
        assert "rgba(" not in outside_style
