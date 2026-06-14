-- Migration 257: SECURITY DEFINER anon/authenticated RPC exposure sweep (ADR-006)
--
-- CONTEXT. PostgREST exposes every EXECUTE-granted function at /rest/v1/rpc/<fn>.
-- 73 SECURITY DEFINER, non-trigger functions were anon-EXECUTEable, i.e. callable by
-- anyone holding the public anon key — bypassing the FastAPI Depends() role gate.
-- Several are privileged with NO internal caller check (fn_admin_grant_tokens lets anon
-- grant tokens to any user; epoch clone/delete; RP grants; PII email batch). ADR-006 /
-- incident-147 class.
--
-- GRANT MECHANICS (the subtlety). These functions carry a MIX of grant paths:
--   * a PUBLIC default grant  (proacl entry `=X/postgres`), and/or
--   * direct anon / authenticated grants  (`anon=X/postgres`, `authenticated=X/postgres`).
-- `REVOKE FROM anon, authenticated` alone does NOT close the hole when EXECUTE also flows
-- via PUBLIC (has_function_privilege stays true). The robust, ACL-shape-agnostic pattern
-- is: REVOKE FROM PUBLIC + anon (+ authenticated for Tier A), then GRANT EXECUTE back to
-- exactly the roles the backend uses. service_role is re-granted explicitly so we can
-- never strip the backend admin path by accident.
--
-- CLASSIFICATION (per-function: backend caller client vs public.py anon surface vs RLS deps):
--   Tier A (22) — privileged; called ONLY via admin/service_role clients or purely
--                 SQL-internal; not public-read; not an RLS helper.
--                 -> REVOKE PUBLIC+anon+authenticated; GRANT service_role.
--   Tier B (41) — user-actions + system writes reached via the injected user-JWT client;
--                 not on the public anon read surface.
--                 -> REVOKE PUBLIC+anon; GRANT authenticated+service_role.
--   KEEP   (5) — 4 RLS helpers (revoking ANY grant breaks 129 policy references) +
--                 get_bleed_status (the ONE genuine public.py anon read). Untouched.
--                 NOTE: get_broadsheet_source_data, get_message_reactions,
--                 fn_get_ward_strength, fn_compute_cycle_scores, fn_increment_progress
--                 were initially mis-kept here; the fresh-eyes review proved the matching
--                 public.py methods do plain table SELECTs and never call these RPCs, so
--                 they moved to Tier B (anon revoked).
--
-- MIGRATION 258 (the authenticated lockdown — the immediate continuation, NOT a deferred
-- TODO). pg_proc analysis: of the Tier-B writes, only 3 self-validate via auth.uid()
-- (fn_purchase_tokens, fn_update_user_byok_keys, toggle_message_reaction) and correctly
-- stay authenticated. The other ~35 trust their ID params with no internal guard, so an
-- authenticated user can call them directly against foreign epochs/sims. 258 switches
-- their backend call sites to the service_role/admin client (the routers already validate
-- ownership) and REVOKEs authenticated, making them service_role-only. The 6 Tier-B reads
-- keep authenticated (a user reading data they may see is not a hole).
--
-- Idempotent (REVOKE/GRANT replays cleanly) and self-verifying: the transaction aborts if
-- any Tier-A hole remains, a Tier-B authenticated path was broken, service_role lost
-- EXECUTE, or an RLS helper lost a grant.

BEGIN;

DO $$
DECLARE
  sig text;
  v_bad text;
  tier_a text[] := ARRAY[
    'archive_epoch_instances(p_epoch_id uuid)',
    'clone_simulations_for_epoch(p_epoch_id uuid, p_created_by_id uuid, p_epoch_number integer)',
    'delete_epoch_instances(p_epoch_id uuid)',
    'fn_admin_grant_tokens(p_user_id uuid, p_tokens integer, p_reason text)',
    'fn_apply_betrayal(p_epoch_id uuid, p_cycle_number integer, p_betrayer_sim uuid, p_victim_sim uuid, p_penalty double precision, p_detected boolean)',
    'fn_auto_draft_participants(p_epoch_id uuid, p_max_agents integer)',
    'fn_award_achievement(p_user_id uuid, p_achievement_id text, p_context jsonb)',
    'fn_bluesky_analytics(p_days integer)',
    'fn_check_and_resolve_deadline(p_epoch_id uuid, p_expected_cycle integer)',
    'fn_compute_alliance_tension(p_epoch_id uuid, p_cycle_number integer)',
    'fn_create_sabotage_capped(p_simulation_id uuid, p_event_data jsonb, p_max_active integer)',
    'fn_deduct_alliance_upkeep(p_epoch_id uuid)',
    'fn_detect_enemy_batch(p_epoch_id uuid, p_target_sim uuid)',
    'fn_generate_cipher_code(p_difficulty text, p_seed text)',
    'fn_increment_academy_counter(p_user_id uuid)',
    'fn_increment_progress_unique(p_user_id uuid, p_achievement_id text, p_target integer, p_item_id text, p_context jsonb)',
    'fn_instagram_analytics(p_days integer)',
    'fn_process_afk_batch(p_epoch_id uuid, p_penalty_rp integer, p_escalation_threshold integer, p_rp_multiplier double precision)',
    'fn_replace_afk_with_bot(p_participant_id uuid, p_bot_name text, p_personality text, p_difficulty text, p_created_by_id uuid)',
    'fn_select_instagram_candidates(p_content_types text[], p_limit integer)',
    'fn_set_acted_this_cycle(p_epoch_id uuid, p_simulation_id uuid)',
    'get_user_emails_batch(user_ids uuid[])'
  ];
  tier_b text[] := ARRAY[
    'fn_add_agent_stress(p_agent_id uuid, p_amount real)',
    'fn_advance_epoch_cycle(p_epoch_id uuid, p_expected_cycle integer)',
    'fn_advance_mission_timers(p_epoch_id uuid, p_cycle_hours integer)',
    'fn_batch_grant_rp(p_epoch_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_darkroom_use_regen(p_purchase_id uuid)',
    'fn_decay_agent_needs(p_simulation_id uuid, p_rate_multiplier real)',
    'fn_decay_moodlet_strengths(p_simulation_id uuid)',
    'fn_degrade_building(p_building_id uuid)',
    'fn_delete_lore_section_atomic(p_simulation_id uuid, p_section_id uuid)',
    'fn_deploy_operative_atomic(p_epoch_id uuid, p_simulation_id uuid, p_agent_id uuid, p_operative_type text, p_cost_rp integer, p_target_simulation_id uuid, p_target_zone_id uuid, p_target_entity_id uuid, p_target_entity_type text, p_embassy_id uuid, p_success_probability double precision, p_resolves_at timestamp with time zone)',
    'fn_dissolve_alliance_atomic(p_epoch_id uuid, p_team_id uuid, p_reason text)',
    'fn_downgrade_zone_security(p_zone_id uuid, p_tiers_down integer)',
    'fn_expire_alliance_proposals(p_epoch_id uuid, p_current_cycle integer)',
    'fn_expire_autonomy_modifiers(p_simulation_id uuid)',
    'fn_expire_fortifications(p_epoch_id uuid, p_cycle_number integer)',
    'fn_fortify_zone_atomic(p_epoch_id uuid, p_simulation_id uuid, p_zone_id uuid, p_rp_cost integer, p_expires_at_cycle integer)',
    'fn_fulfill_agent_need(p_agent_id uuid, p_need_type text, p_amount real)',
    'fn_get_wallet_summary(p_user_id uuid)',
    'fn_grant_rp_single(p_epoch_id uuid, p_simulation_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_increment_opinion_interaction(p_agent_id uuid, p_target_agent_id uuid)',
    'fn_initialize_agent_autonomy(p_agent_id uuid, p_simulation_id uuid, p_resilience real, p_volatility real, p_sociability real, p_social_decay real, p_purpose_decay real, p_safety_decay real, p_comfort_decay real, p_stimulation_decay real)',
    'fn_join_epoch_atomic(p_epoch_id uuid, p_simulation_id uuid, p_user_id uuid, p_initial_rp integer)',
    'fn_join_team_checked(p_epoch_id uuid, p_team_id uuid, p_simulation_id uuid, p_max_size integer)',
    'fn_materialize_shard(p_draft_id uuid)',
    'fn_purchase_feature(p_user_id uuid, p_simulation_id uuid, p_feature_type text, p_token_cost integer, p_config jsonb)',
    'fn_purchase_tokens(p_bundle_slug text)',
    'fn_recalculate_mood_scores(p_simulation_id uuid)',
    'fn_recalculate_opinion_scores(p_simulation_id uuid)',
    'fn_redeem_cipher_code(p_code text, p_user_id uuid, p_ip_hash text)',
    'fn_refund_feature(p_purchase_id uuid)',
    'fn_reorder_lore_sections_atomic(p_simulation_id uuid, p_section_ids uuid[])',
    'fn_spend_rp_atomic(p_epoch_id uuid, p_simulation_id uuid, p_amount integer)',
    'fn_transfer_rp_atomic(p_epoch_id uuid, p_from_simulation_id uuid, p_to_simulation_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_transition_mission_status(p_mission_id uuid, p_from_status text, p_to_status text)',
    'fn_update_stress_levels(p_simulation_id uuid, p_recovery_per_tick integer)',
    'fn_update_user_byok_keys(p_user_id uuid, p_encrypted_openrouter_key text, p_encrypted_replicate_key text, p_clear_openrouter boolean, p_clear_replicate boolean)',
    'fn_user_byok_allowed(p_user_id uuid)',
    'fn_user_has_byok_bypass(p_user_id uuid)',
    'fn_weaken_relationships(p_agent_id uuid, p_delta integer)',
    'insert_broadsheet_edition(p_simulation_id uuid, p_data jsonb)',
    'toggle_message_reaction(p_message_id uuid, p_emoji text)',
    -- Reclassified OUT of KEEP by the fresh-eyes review: these are NOT reached by any
    -- anonymous public.py endpoint (the matching service methods do plain table SELECTs),
    -- so leaving anon was a hole. fn_compute_cycle_scores + fn_increment_progress are
    -- writes (authenticated lockdown follows in 258); the other three are reads.
    'fn_compute_cycle_scores(p_epoch_id uuid, p_cycle_number integer, p_score_weights jsonb)',
    'fn_increment_progress(p_user_id uuid, p_achievement_id text, p_target integer, p_context jsonb)',
    'fn_get_ward_strength(p_target_simulation_id uuid, p_echo_vector text)',
    'get_broadsheet_source_data(p_simulation_id uuid, p_period_start timestamp with time zone, p_period_end timestamp with time zone)',
    'get_message_reactions(p_message_ids uuid[])'
  ];
BEGIN
  -- APPLY -------------------------------------------------------------------
  FOREACH sig IN ARRAY tier_a LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;
  FOREACH sig IN ARRAY tier_b LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
  END LOOP;

  -- VERIFY (fail-closed) ----------------------------------------------------
  -- 1) Tier A: callable by NEITHER anon NOR authenticated.
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = ANY (tier_a)
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 257 FAILED: Tier-A still anon/authenticated-callable: %', v_bad; END IF;

  -- 2) Tier B: NOT anon, but authenticated PRESERVED (backend user path intact).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = ANY (tier_b)
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 257 FAILED: Tier-B anon-open or authenticated-broken: %', v_bad; END IF;

  -- 3) service_role keeps EXECUTE on every touched function (backend admin path intact).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = ANY (tier_a || tier_b)
    AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 257 FAILED: service_role lost EXECUTE (backend break): %', v_bad; END IF;

  -- 4) RLS helpers untouched (both roles must remain, or RLS evaluation breaks).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY['is_platform_admin', 'user_has_simulation_access', 'user_has_simulation_role', 'user_simulation_role'])
    AND NOT (has_function_privilege('anon', p.oid, 'EXECUTE') AND has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 257 FAILED: RLS helper lost a grant: %', v_bad; END IF;

  RAISE NOTICE 'Migration 257 OK: Tier-A 22 closed (anon+auth), Tier-B 46 anon-closed (auth kept), service_role intact, RLS helpers intact. Authenticated lockdown of the ~35 non-self-validating writes follows in 258.';
END $$;

COMMIT;
