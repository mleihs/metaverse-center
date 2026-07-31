-- ============================================================================
-- Migration 270: Covering-Indizes für alle bisher unindexierten Foreign Keys
-- ============================================================================
-- Deep-Audit 2026-07-12, P3: 88 FK-Constraints hatten keinen Index, dessen
-- führende Spalten den FK-Spalten entsprechen. Folge: jede Löschung/Änderung
-- am referenzierten Parent erzwingt einen Sequential Scan der Child-Tabelle
-- pro Constraint — bei einer Simulationslöschung kaskadiert das zu O(N×M)
-- über die großen Log-Tabellen (agent_activities, travel_telemetry_events,
-- travel_log_entries, …); dieselben Indizes tragen die FK-Joins der Views.
--
-- Vollständiger Sweep statt handverlesener Liste: generiert aus pg_constraint
-- gegen den lokalen Migrationsstand (Constraint-Ebene, Composite-FKs als
-- mehrspaltige Indizes mit exakter Spaltenreihenfolge). IF NOT EXISTS macht
-- die Migration idempotent und tolerant gegenüber abweichend benannten
-- Alt-Indizes, die zwischenzeitlich entstehen.
--
-- Bewusst KEIN CONCURRENTLY: Migrationen laufen in Transaktionen (CI wendet
-- sie via psql an); die Tabellen sind klein genug, dass der kurze Write-Lock
-- pro CREATE INDEX beim Deploy nicht ins Gewicht fällt.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_achievement_progress_achievement_id ON public.achievement_progress (achievement_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_location_building_id ON public.agent_activities (location_building_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_location_zone_id ON public.agent_activities (location_zone_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_related_event_id ON public.agent_activities (related_event_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_target_agent_id ON public.agent_activities (target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_dungeon_loot_effects_simulation_id ON public.agent_dungeon_loot_effects (simulation_id);
CREATE INDEX IF NOT EXISTS idx_agent_dungeon_loot_effects_source_run_id ON public.agent_dungeon_loot_effects (source_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_simulation_id ON public.agent_memories (simulation_id);
CREATE INDEX IF NOT EXISTS idx_agent_opinion_modifiers_source_event_id ON public.agent_opinion_modifiers (source_event_id);
CREATE INDEX IF NOT EXISTS idx_agent_opinion_modifiers_target_agent_id ON public.agent_opinion_modifiers (target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_current_building_id ON public.agents (current_building_id);
CREATE INDEX IF NOT EXISTS idx_ai_budget_updated_by_id ON public.ai_budget (updated_by_id);
CREATE INDEX IF NOT EXISTS idx_ai_circuit_state_triggered_by_id ON public.ai_circuit_state (triggered_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_battle_log_mission_id ON public.battle_log (mission_id);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_simulation_id ON public.bluesky_posts (simulation_id);
CREATE INDEX IF NOT EXISTS idx_building_agent_relations_simulation_id ON public.building_agent_relations (simulation_id);
CREATE INDEX IF NOT EXISTS idx_building_event_relations_simulation_id ON public.building_event_relations (simulation_id);
CREATE INDEX IF NOT EXISTS idx_building_profession_requirements_simulation_id ON public.building_profession_requirements (simulation_id);
CREATE INDEX IF NOT EXISTS idx_bureau_responses_created_by_id ON public.bureau_responses (created_by_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_simulation_id ON public.campaign_events (simulation_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_simulation_id ON public.campaign_metrics (simulation_id);
CREATE INDEX IF NOT EXISTS idx_chart_honors_user_id ON public.chart_honors (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent_id ON public.chat_conversations (agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_event_references_event_id ON public.chat_event_references (event_id);
CREATE INDEX IF NOT EXISTS idx_chat_event_references_referenced_by ON public.chat_event_references (referenced_by);
CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_user_id ON public.chat_message_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_cipher_redemptions_user_id ON public.cipher_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_city_streets_zone_id ON public.city_streets (zone_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_anchors_created_by_simulation_id ON public.collaborative_anchors (created_by_simulation_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_anchors_created_by_user_id ON public.collaborative_anchors (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_drift_chart_edges_connection_id ON public.drift_chart_edges (connection_id);
CREATE INDEX IF NOT EXISTS idx_dungeon_encounter_templates_combat_encounter_id ON public.dungeon_encounter_templates (combat_encounter_id);
CREATE INDEX IF NOT EXISTS idx_embassies_created_by_id ON public.embassies (created_by_id);
CREATE INDEX IF NOT EXISTS idx_epoch_alliance_proposals_proposer_simulation_id ON public.epoch_alliance_proposals (proposer_simulation_id);
CREATE INDEX IF NOT EXISTS idx_epoch_alliance_votes_voter_simulation_id ON public.epoch_alliance_votes (voter_simulation_id);
CREATE INDEX IF NOT EXISTS idx_epoch_chat_messages_sender_id ON public.epoch_chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_epoch_chat_messages_sender_simulation_id ON public.epoch_chat_messages (sender_simulation_id);
CREATE INDEX IF NOT EXISTS idx_epoch_invitations_accepted_by_id ON public.epoch_invitations (accepted_by_id);
CREATE INDEX IF NOT EXISTS idx_epoch_invitations_invited_by_id ON public.epoch_invitations (invited_by_id);
CREATE INDEX IF NOT EXISTS idx_epoch_participants_bot_player_id ON public.epoch_participants (bot_player_id);
CREATE INDEX IF NOT EXISTS idx_epoch_teams_created_by_simulation_id ON public.epoch_teams (created_by_simulation_id);
CREATE INDEX IF NOT EXISTS idx_event_echoes_root_event_id ON public.event_echoes (root_event_id);
CREATE INDEX IF NOT EXISTS idx_event_echoes_source_simulation_id ON public.event_echoes (source_simulation_id);
CREATE INDEX IF NOT EXISTS idx_event_echoes_target_event_id ON public.event_echoes (target_event_id);
CREATE INDEX IF NOT EXISTS idx_forge_access_requests_reviewed_by ON public.forge_access_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_forge_drafts_user_id ON public.forge_drafts (user_id);
CREATE INDEX IF NOT EXISTS idx_fragment_generation_requests_simulation_id ON public.fragment_generation_requests (simulation_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_created_by_id ON public.instagram_posts (created_by_id);
CREATE INDEX IF NOT EXISTS idx_journal_constellations_attunement_id ON public.journal_constellations (attunement_id);
CREATE INDEX IF NOT EXISTS idx_journal_fragments_simulation_id ON public.journal_fragments (simulation_id);
CREATE INDEX IF NOT EXISTS idx_news_scan_candidates_resonance_id ON public.news_scan_candidates (resonance_id);
CREATE INDEX IF NOT EXISTS idx_news_scan_candidates_reviewed_by_id ON public.news_scan_candidates (reviewed_by_id);
CREATE INDEX IF NOT EXISTS idx_operative_missions_embassy_id ON public.operative_missions (embassy_id);
CREATE INDEX IF NOT EXISTS idx_operative_missions_target_zone_id ON public.operative_missions (target_zone_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by_id ON public.platform_settings (updated_by_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_by_id ON public.prompt_templates (created_by_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_parent_template_id ON public.prompt_templates (parent_template_id);
CREATE INDEX IF NOT EXISTS idx_resonance_dungeon_runs_resonance_id ON public.resonance_dungeon_runs (resonance_id);
CREATE INDEX IF NOT EXISTS idx_sentry_rules_updated_by_id ON public.sentry_rules (updated_by_id);
CREATE INDEX IF NOT EXISTS idx_simulation_chronicles_epoch_id ON public.simulation_chronicles (epoch_id);
CREATE INDEX IF NOT EXISTS idx_simulation_connections_simulation_b_id ON public.simulation_connections (simulation_b_id);
CREATE INDEX IF NOT EXISTS idx_simulation_invitations_invited_by_id ON public.simulation_invitations (invited_by_id);
CREATE INDEX IF NOT EXISTS idx_simulation_members_invited_by_id ON public.simulation_members (invited_by_id);
CREATE INDEX IF NOT EXISTS idx_simulation_settings_updated_by_id ON public.simulation_settings (updated_by_id);
CREATE INDEX IF NOT EXISTS idx_social_media_agent_reactions_agent_id ON public.social_media_agent_reactions (agent_id);
CREATE INDEX IF NOT EXISTS idx_social_media_agent_reactions_comment_id ON public.social_media_agent_reactions (comment_id);
CREATE INDEX IF NOT EXISTS idx_social_media_agent_reactions_post_id ON public.social_media_agent_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_social_media_agent_reactions_simulation_id ON public.social_media_agent_reactions (simulation_id);
CREATE INDEX IF NOT EXISTS idx_social_stories_simulation_id ON public.social_stories (simulation_id);
CREATE INDEX IF NOT EXISTS idx_substrate_attunements_created_by_id ON public.substrate_attunements (created_by_id);
CREATE INDEX IF NOT EXISTS idx_substrate_resonances_created_by_id ON public.substrate_resonances (created_by_id);
CREATE INDEX IF NOT EXISTS idx_threshold_actions_target_building_id ON public.threshold_actions (target_building_id);
CREATE INDEX IF NOT EXISTS idx_threshold_actions_target_zone_id ON public.threshold_actions (target_zone_id);
CREATE INDEX IF NOT EXISTS idx_token_purchases_bundle_id ON public.token_purchases (bundle_id);
CREATE INDEX IF NOT EXISTS idx_travel_cargo_counterpart_cargo_id ON public.travel_cargo (counterpart_cargo_id);
CREATE INDEX IF NOT EXISTS idx_travel_cargo_origin_agent_id ON public.travel_cargo (origin_agent_id);
CREATE INDEX IF NOT EXISTS idx_travel_cargo_origin_building_id ON public.travel_cargo (origin_building_id);
CREATE INDEX IF NOT EXISTS idx_travel_cargo_origin_event_id ON public.travel_cargo (origin_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_log_entries_node_id ON public.travel_log_entries (node_id);
CREATE INDEX IF NOT EXISTS idx_travel_runs_begehung_simulation_id ON public.travel_runs (begehung_simulation_id);
CREATE INDEX IF NOT EXISTS idx_travel_runs_begehung_zone_id ON public.travel_runs (begehung_zone_id);
CREATE INDEX IF NOT EXISTS idx_travel_runs_chart_version ON public.travel_runs (chart_version);
CREATE INDEX IF NOT EXISTS idx_travel_telemetry_events_run_id ON public.travel_telemetry_events (run_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON public.user_achievements (achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_attunements_constellation_id ON public.user_attunements (constellation_id);
CREATE INDEX IF NOT EXISTS idx_zone_actions_created_by_id ON public.zone_actions (created_by_id);
CREATE INDEX IF NOT EXISTS idx_zone_fortifications_zone_id ON public.zone_fortifications (zone_id);
