-- ============================================================
-- Migration 276: let the auto-resolve subsystem write its own battle log,
-- and stop `current_cycle` from being nullable.
-- ============================================================
--
-- Found by the first production run of `activity_gated` (2026-08-29).
--
-- Migration 204 built the deadline / AFK subsystem and 275 made its config
-- reachable, but nobody had ever executed it against a real database. The
-- moment it ran, two of its four battle-log writes were rejected:
--
--   Battle log insert failed for event_type=player_afk: Player absent for cycle 1.
--   Battle log insert failed for event_type=cycle_auto_resolved: ...
--   -> new row for relation "battle_log" violates check constraint
--      "battle_log_event_type_check"
--
-- `battle_log_event_type_check` enumerates 29 event types. It carries
-- `cycle_resolved` and `player_passed` -- the MANUAL cycle path -- but never
-- gained the four types the AUTOMATIC path emits. Migration 204 added the
-- columns and the RPCs and forgot the constraint.
--
-- The failure was invisible for two independent reasons, which is why it
-- survived a full audit:
--   1. `activity_gated` was never sent by any client (fixed 2026-08-29), so
--      the scheduler's sweep never matched a row and the code never ran.
--   2. `BattleLogService.log_event` catches PostgrestAPIError, logs, and
--      returns the unsaved dict. A rejected insert therefore does not raise --
--      the cycle still resolves, it just resolves with a hole in its record.
--      Nothing surfaces to the user or to Sentry.
--
-- The four types below are emitted by `backend/services/epoch_cycle_scheduler.py`:
--   cycle_auto_resolved     (:131)  cycle hit its deadline and resolved itself
--   player_afk_ai_takeover  (:284)  AI assumed control after repeated absence
--   player_afk_penalty      (:296)  RP deducted for an absent cycle
--   player_afk              (:304)  absence recorded, no penalty yet
--
-- A codebase-wide sweep of BattleLogService.log_event call sites found exactly
-- these four outside the constraint -- every other emitted type is already
-- allowed. (Dungeon events go to DungeonCheckpointService and a different
-- table; they are not affected by this constraint.)

-- ═══════════════════════════════════════════════════════════════════
-- 1. battle_log.event_type — admit the automatic cycle path
-- ═══════════════════════════════════════════════════════════════════
-- Rewritten in full rather than patched: a CHECK constraint cannot be extended
-- in place, and spelling the whole list out keeps this migration readable as
-- the current truth instead of a diff against 204.

ALTER TABLE public.battle_log DROP CONSTRAINT IF EXISTS battle_log_event_type_check;

ALTER TABLE public.battle_log ADD CONSTRAINT battle_log_event_type_check CHECK (
    event_type = ANY (ARRAY[
        -- Operative missions
        'operative_deployed', 'mission_success', 'mission_failed', 'detected',
        'captured', 'sabotage', 'propaganda', 'assassination', 'infiltration',
        'counter_intel', 'intel_report', 'building_damaged', 'agent_wounded',
        'zone_fortified',
        -- Alliances
        'alliance_formed', 'alliance_dissolved', 'betrayal', 'alliance_proposal',
        'alliance_proposal_accepted', 'alliance_proposal_rejected',
        'alliance_tension_increase', 'alliance_dissolved_tension', 'alliance_upkeep',
        -- Epoch / cycle lifecycle
        'phase_change', 'epoch_start', 'epoch_end', 'rp_allocated',
        'player_passed', 'cycle_resolved',
        -- Auto-resolve + AFK (migration 204's subsystem, added here in 276)
        'cycle_auto_resolved', 'player_afk', 'player_afk_penalty',
        'player_afk_ai_takeover'
    ])
);

COMMENT ON CONSTRAINT battle_log_event_type_check ON public.battle_log IS
    'Allowed battle-log event types. When adding a log_event() call with a new '
    'type, extend this list in the same migration -- log_event swallows the '
    'rejection, so a missing type loses records silently.';

-- ═══════════════════════════════════════════════════════════════════
-- 2. game_epochs.current_cycle — NOT NULL
-- ═══════════════════════════════════════════════════════════════════
-- `EpochResponse.current_cycle` is typed `int`, and this project uses return
-- annotations as response models -- so a NULL here is a guaranteed HTTP 500 on
-- every endpoint that returns the row, not a None in the payload.
--
-- The sibling field `created_by_id` is genuinely nullable (system-created
-- academy epochs have no creator) and is being widened to `UUID | None` in the
-- Python model instead. `current_cycle` is the opposite case: a cycle counter
-- has no meaningful NULL, the column already carries DEFAULT 0, and prod holds
-- zero NULLs. Integrity belongs in SQL, so the constraint goes here rather than
-- becoming an `int | None` the whole frontend would have to defend against.
--
-- Verified on production before writing this migration:
--   SELECT count(*) FILTER (WHERE current_cycle IS NULL) FROM game_epochs; -> 0

ALTER TABLE public.game_epochs ALTER COLUMN current_cycle SET NOT NULL;
