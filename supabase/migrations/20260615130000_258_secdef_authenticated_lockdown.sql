-- Migration 258: SECURITY DEFINER `authenticated` lockdown (ADR-006, part 2/2)
--
-- CONTEXT. Migration 257 closed the anon surface (73 anon-callable SECURITY
-- DEFINER RPCs -> 5) and split the rest into Tier A (service_role-only) and
-- Tier B (anon revoked, `authenticated` kept). This migration finishes the job
-- for Tier B: of those 46 functions, only a minority self-validate the caller;
-- the rest trust their ID parameters with no internal guard, so any logged-in
-- user could call them directly against a foreign epoch / simulation / user
-- (horizontal privilege escalation), bypassing the FastAPI Depends() gate.
--
-- pg_proc analysis of Tier B (prosrc inspected, not name-matched):
--   * 37 WRITES trust ID params, NO caller guard  -> revoke `authenticated`
--     here, making them service_role-only (Tier-A treatment).
--   *  3 WRITES self-validate via auth.uid()        -> KEEP authenticated
--     (fn_purchase_tokens uses auth.uid() as the buyer id; fn_update_user_byok_keys
--      and toggle_message_reaction RAISE / scope when auth.uid() <> the target).
--   *  6 READS                                       -> KEEP authenticated
--     (a user reading data they may already see is not an escalation; the 4
--      ID-trusting ones — fn_get_wallet_summary, fn_get_ward_strength,
--      fn_user_byok_allowed, fn_user_has_byok_bypass — are a low-severity
--      horizontal info-leak tracked as a P1 follow-up, not closed here to keep
--      this migration write-focused and behaviour-preserving).
--   The 6 DRIFT player actions (fn_travel_move / _complete / _abandon /
--   _run_open, fn_quest_accept / _advance) were never in 257 (already anon=0)
--   and each guards `auth.uid() IS DISTINCT FROM p_user` — they stay
--   authenticated (the hybrid Supabase RPC pattern, called with the user JWT).
--
-- ACCOMPANYING CODE CHANGE (lands in the same commit — switch AND revoke
-- together, never a half-state). 12 backend call sites that reached these
-- writes with the router-injected user-JWT client were switched to the
-- service-role client (`get_admin_supabase_client()`), so the revoke does not
-- break them. The switch is behaviourally neutral: SECURITY DEFINER already
-- runs the body as the owner, and none of the 37 reference auth.uid(), so the
-- only thing that changes is which role passes the EXECUTE check. The other ~25
-- writes were already reached only via admin/service_role clients (heartbeat,
-- epoch-cycle scheduler, mission resolution, cipher redeem) or have no caller
-- at all (fn_deploy_operative_atomic, fn_dissolve_alliance_atomic are
-- defined-but-dead); those are a pure revoke.
--   Switched: forge_feature_service (purchase / refund / darkroom),
--   scoring_service (compute_cycle_scores), epoch_participation_service
--   (join_epoch / join_team), lore_service (delete / reorder),
--   cycle_resolution_service (_grant_rp_batch / spend_rp / grant_rp — shared
--   chokepoints with mixed callers), forge_orchestrator_service
--   (materialize_shard).
--
-- GRANT MECHANICS (same lesson as 257). EXECUTE can flow via the PUBLIC default
-- grant AND/OR a direct `authenticated` grant; revoking one is a no-op while the
-- other stands. The robust pattern is REVOKE FROM PUBLIC, anon, authenticated
-- then GRANT EXECUTE back to exactly service_role.
--
-- Idempotent (REVOKE/GRANT replay cleanly) and self-verifying: the transaction
-- aborts if any of the 37 is still anon/authenticated-callable, if any lost the
-- service_role path, if a keep-authenticated function was caught in the revoke,
-- or if the RLS helpers / get_bleed_status lost their anon grant.

BEGIN;

DO $$
DECLARE
  sig text;
  v_bad text;
  -- The 37 non-self-validating Tier-B writes: revoke authenticated -> service_role-only.
  revoke_auth text[] := ARRAY[
    'fn_add_agent_stress(p_agent_id uuid, p_amount real)',
    'fn_advance_epoch_cycle(p_epoch_id uuid, p_expected_cycle integer)',
    'fn_advance_mission_timers(p_epoch_id uuid, p_cycle_hours integer)',
    'fn_batch_grant_rp(p_epoch_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_compute_cycle_scores(p_epoch_id uuid, p_cycle_number integer, p_score_weights jsonb)',
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
    'fn_grant_rp_single(p_epoch_id uuid, p_simulation_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_increment_opinion_interaction(p_agent_id uuid, p_target_agent_id uuid)',
    'fn_increment_progress(p_user_id uuid, p_achievement_id text, p_target integer, p_context jsonb)',
    'fn_initialize_agent_autonomy(p_agent_id uuid, p_simulation_id uuid, p_resilience real, p_volatility real, p_sociability real, p_social_decay real, p_purpose_decay real, p_safety_decay real, p_comfort_decay real, p_stimulation_decay real)',
    'fn_join_epoch_atomic(p_epoch_id uuid, p_simulation_id uuid, p_user_id uuid, p_initial_rp integer)',
    'fn_join_team_checked(p_epoch_id uuid, p_team_id uuid, p_simulation_id uuid, p_max_size integer)',
    'fn_materialize_shard(p_draft_id uuid)',
    'fn_purchase_feature(p_user_id uuid, p_simulation_id uuid, p_feature_type text, p_token_cost integer, p_config jsonb)',
    'fn_recalculate_mood_scores(p_simulation_id uuid)',
    'fn_recalculate_opinion_scores(p_simulation_id uuid)',
    'fn_redeem_cipher_code(p_code text, p_user_id uuid, p_ip_hash text)',
    'fn_refund_feature(p_purchase_id uuid)',
    'fn_reorder_lore_sections_atomic(p_simulation_id uuid, p_section_ids uuid[])',
    'fn_spend_rp_atomic(p_epoch_id uuid, p_simulation_id uuid, p_amount integer)',
    'fn_transfer_rp_atomic(p_epoch_id uuid, p_from_simulation_id uuid, p_to_simulation_id uuid, p_amount integer, p_rp_cap integer)',
    'fn_transition_mission_status(p_mission_id uuid, p_from_status text, p_to_status text)',
    'fn_update_stress_levels(p_simulation_id uuid, p_recovery_per_tick integer)',
    'fn_weaken_relationships(p_agent_id uuid, p_delta integer)',
    'insert_broadsheet_edition(p_simulation_id uuid, p_data jsonb)'
  ];
  -- Must REMAIN authenticated-callable (3 self-validating writes + 6 reads + 6 DRIFT
  -- player actions). Matched by proname (all unique) for the post-condition guard.
  keep_auth text[] := ARRAY[
    'fn_purchase_tokens', 'fn_update_user_byok_keys', 'toggle_message_reaction',
    'fn_get_wallet_summary', 'fn_get_ward_strength', 'fn_user_byok_allowed',
    'fn_user_has_byok_bypass', 'get_message_reactions', 'get_broadsheet_source_data',
    'fn_travel_move', 'fn_travel_complete', 'fn_travel_abandon', 'fn_travel_run_open',
    'fn_quest_accept', 'fn_quest_advance'
  ];
BEGIN
  -- APPLY -------------------------------------------------------------------
  FOREACH sig IN ARRAY revoke_auth LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;

  -- VERIFY (fail-closed) ----------------------------------------------------
  -- 1) The 37 are callable by NEITHER anon NOR authenticated.
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = ANY (revoke_auth)
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 258 FAILED: write still anon/authenticated-callable: %', v_bad; END IF;

  -- 2) service_role keeps EXECUTE on all 37 (backend admin path intact).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = ANY (revoke_auth)
    AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 258 FAILED: service_role lost EXECUTE (backend break): %', v_bad; END IF;

  -- 3) Every keep-authenticated function is STILL authenticated-callable
  --    (none caught in the revoke; self-validating writes + reads + DRIFT intact).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (keep_auth)
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 258 FAILED: keep-authenticated function lost auth: %', v_bad; END IF;

  -- 4) RLS helpers + the public bleed read keep their anon grant (258 must not
  --    have touched them; revoking anon here would break RLS / the public surface).
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY['is_platform_admin', 'user_has_simulation_access',
                               'user_has_simulation_role', 'user_simulation_role', 'get_bleed_status'])
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Migration 258 FAILED: RLS helper / bleed lost anon: %', v_bad; END IF;

  RAISE NOTICE 'Migration 258 OK: 37 Tier-B writes locked to service_role; 3 self-validating writes + 6 reads + 6 DRIFT actions keep authenticated; RLS helpers + get_bleed_status intact.';
END $$;

COMMIT;
