-- ============================================================================
-- Migration 215: Substrate & News Scanner Audit Fixes
-- ============================================================================
-- Fixes identified in full 4-perspective audit:
--
--   A1 (CRITICAL): RLS policies on news_scan_log / news_scan_candidates
--       allowed anon access. Restrict to service_role + authenticated read.
--
--   P2 (MEDIUM): check_resonance_impact_time() trigger did not account for
--       'partial' status added in migration 144. Impacts with status='partial'
--       blocked the subsiding transition indefinitely.
--
--   Note: P3 (active_resonances view naming) was evaluated but NOT changed.
--       The admin UI relies on the view returning all non-deleted resonances
--       (including archived) and filters client-side. Changing the view
--       semantics would regress the admin archived tab.
-- ============================================================================


-- ── A1: Fix RLS policies on scanner tables ──────────────────────────────────
-- The original policies (migration 084) used FOR ALL without TO role,
-- granting anon full read/write/delete access. The anon key is public
-- in the frontend, so this was exploitable via direct Supabase REST API.

DROP POLICY IF EXISTS scan_log_service ON public.news_scan_log;
DROP POLICY IF EXISTS candidates_service ON public.news_scan_candidates;
DROP POLICY IF EXISTS candidates_read ON public.news_scan_candidates;

-- Service role: full access (scanner + admin operations)
CREATE POLICY "scan_log_service_role_only"
  ON public.news_scan_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role: full access to candidates
CREATE POLICY "candidates_service_role_only"
  ON public.news_scan_candidates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated: read-only access to candidates (admin UI reads via backend)
CREATE POLICY "candidates_authenticated_read"
  ON public.news_scan_candidates
  FOR SELECT TO authenticated
  USING (true);


-- ── P2: Fix check_resonance_impact_time() to handle 'partial' status ────────
-- Migration 144 added 'partial' to resonance_impact_status enum, but the
-- completion-check trigger still only fires on status='completed' and doesn't
-- include 'partial' in its NOT IN exclusion list. This means a 'partial'
-- impact blocks the resonance from ever transitioning to 'subsiding'.
--
-- Fix: Update the trigger function to also fire on 'partial', and include
-- 'partial' in the terminal-status exclusion list.

CREATE OR REPLACE FUNCTION check_resonance_impact_time()
RETURNS TRIGGER AS $$
BEGIN
  -- When all impacts for a resonance have reached a terminal status,
  -- transition the parent resonance to 'subsiding'.
  -- Terminal statuses: completed, partial, skipped, failed
  IF NEW.status IN ('completed', 'partial') THEN
    PERFORM 1 FROM resonance_impacts
      WHERE resonance_id = NEW.resonance_id
        AND status NOT IN ('completed', 'partial', 'skipped', 'failed')
        AND id != NEW.id;

    IF NOT FOUND THEN
      UPDATE substrate_resonances
        SET status = 'subsiding',
            subsides_at = COALESCE(subsides_at, now() + interval '48 hours')
        WHERE id = NEW.resonance_id
          AND status = 'impacting';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to also fire on 'partial' status transitions
DROP TRIGGER IF EXISTS trg_check_resonance_completion ON resonance_impacts;
CREATE TRIGGER trg_check_resonance_completion
  AFTER UPDATE ON resonance_impacts
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'partial'))
  EXECUTE FUNCTION check_resonance_impact_time();


-- ── P3: active_resonances view — intentionally NOT changed ──────────────────
-- The view name is misleading (it includes archived resonances), but the admin
-- UI depends on this: it fetches all non-deleted resonances in one call and
-- client-side filters into active/archived tabs. Adding "AND status != 'archived'"
-- would regress the admin archived view. The naming is a documentation issue,
-- not a code issue.
