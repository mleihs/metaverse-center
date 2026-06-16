-- ============================================================
-- Migration 262: fn_record_dossier_evolution — atomic dossier-section append
-- (fix ADR-007 read-modify-write in DossierEvolutionService.evolve_section)
-- ============================================================
--
-- evolve_section re-read evolution_log, appended a log entry in Python, and
-- wrote the whole array back together with `evolution_count + 1` — where the
-- evolution_count was captured earlier in the function (a stale snapshot). It
-- ALSO rebuilt the body/body_de by concatenating onto `section["body"]`, the
-- same earlier snapshot. So three writes (body, evolution_log, evolution_count)
-- all derived from stale reads: two concurrent evolutions of the same lore
-- section would lose one addendum, drop a log entry, and under-count.
--
-- This RPC does the entire mutation server-side on the LIVE row in one
-- statement — no read first, no stale snapshot:
--   * body    = body    || separator    || addendum        (live concat)
--   * body_de = coalesce(body_de,'') || de_separator || addendum_de
--   * evolution_count = evolution_count + 1                 (server increment)
--   * evolution_log   = coalesce(evolution_log,'[]') || log_entry  (jsonb append)
--   * evolved_at = now()
-- jsonb `array || object` appends the object as one element (verified), so the
-- log append is dedup-free and race-free. Python still owns the addendum text
-- and the body_de separator/fallback (translation success vs English fallback),
-- passing the pieces in; SQL owns the atomic concatenation.
--
-- SECDEF hygiene (ADR-006 / migrations 257+258): service_role-only — called via
-- the admin client from the heartbeat pipeline. Revoked from PUBLIC/anon/
-- authenticated, granted only to service_role.
-- ============================================================

CREATE FUNCTION public.fn_record_dossier_evolution(
    p_section_id         UUID,
    p_body_separator     TEXT,
    p_addendum           TEXT,
    p_body_de_separator  TEXT,
    p_addendum_de        TEXT,
    p_log_entry          JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.simulation_lore
       SET body = body || p_body_separator || p_addendum,
           body_de = COALESCE(body_de, '') || p_body_de_separator || p_addendum_de,
           evolution_count = COALESCE(evolution_count, 0) + 1,
           evolution_log = COALESCE(evolution_log, '[]'::jsonb) || p_log_entry,
           evolved_at = NOW()
     WHERE id = p_section_id;
END;
$$;

COMMENT ON FUNCTION public.fn_record_dossier_evolution(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) IS
    'Atomic dossier-section evolution: appends body/body_de, increments '
    'evolution_count, and appends the log entry to evolution_log — all server-side '
    'on the live row in one statement (no stale read-modify-write). Service-role '
    'only (called via the admin client from DossierEvolutionService.evolve_section).';

-- Lock to service_role (never anon/authenticated). On Supabase pg_default_acl can
-- direct-grant EXECUTE to anon/authenticated for new functions, so revoke
-- explicitly per the SECDEF hygiene of migrations 257/258.
REVOKE EXECUTE ON FUNCTION public.fn_record_dossier_evolution(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_record_dossier_evolution(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
