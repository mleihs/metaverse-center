-- Orphan-branch sweeper scheduler settings (A1.7 Phase 7b).
--
-- Four platform_settings keys drive the scheduled companion to the manual
-- POST /api/v1/admin/content-drafts/sweep-orphans endpoint. The scheduler
-- tick (backend/services/content_packs/orphan_sweeper_scheduler.py) loads
-- these every loop iteration so changes take effect without a redeploy.
--
--   orphan_sweeper_enabled           Gated launch — default false. The
--                                    scheduler will no-op until an operator
--                                    flips this to true.
--   orphan_sweeper_interval_days     Minimum wall-clock gap between sweeps.
--                                    Weekly (7.0) matches the publish
--                                    cadence comfortably without building
--                                    up a long orphan tail.
--   orphan_sweeper_min_age_days      Age floor for deleting PR-less
--                                    branches. Mirrors
--                                    DEFAULT_MIN_AGE_DAYS in the sweeper
--                                    module (14d) so the scheduled run
--                                    matches the manual-button default
--                                    when neither override is set.
--   orphan_sweeper_last_run_at       Timestamp the scheduler persists
--                                    after every completed sweep. Used
--                                    by the throttle check to skip ticks
--                                    that fire earlier than the interval.
--                                    Clear (set to JSON null) to force
--                                    the next tick to run.
--
-- Why platform_settings and not a dedicated table:
--   The scheduler only persists a single scalar (`last_run_at`) plus
--   three config knobs. A new table would be over-engineering for four
--   rows and would duplicate the admin-settings UI that already wires
--   up platform_settings.
--
-- Value shape:
--   setting_value is jsonb. Booleans are stored as bare JSON booleans,
--   numeric thresholds as JSON numbers, and the last-run timestamp as
--   either JSON null (no run yet) or a double-quoted JSON string
--   containing an ISO-8601 UTC timestamp with offset.
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  (
    'orphan_sweeper_enabled',
    'false'::jsonb,
    'Gate for the scheduled orphan-branch sweep. Keep false to run sweeps only via the admin button.'
  ),
  (
    'orphan_sweeper_interval_days',
    '7.0'::jsonb,
    'Minimum wall-clock days between scheduled orphan sweeps. Checked against orphan_sweeper_last_run_at.'
  ),
  (
    'orphan_sweeper_min_age_days',
    '14.0'::jsonb,
    'Commit-age floor (days) for deleting PR-less orphan branches. Mirrors DEFAULT_MIN_AGE_DAYS.'
  ),
  (
    'orphan_sweeper_last_run_at',
    'null'::jsonb,
    'ISO-8601 UTC timestamp of the last completed scheduled sweep, or null if it has never run. Updated by the scheduler tick.'
  )
ON CONFLICT (setting_key) DO NOTHING;
