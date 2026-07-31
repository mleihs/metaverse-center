-- Migration 266: DRIFT Fun-Kern — travel_signal_templates (M1 content substrate)
--
-- Plan: docs/plans/drift-fun-core-implementation-plan.md §4 (Welle 2, Schritt 2.1).
-- Concept: docs/concepts/drift-gameplay-redesign-concept.md (M1 Signale, D2 "eine
--          Route, leere Züge"; R9 "Zustand wird Text").
--
-- The table the signal content pack owns. Authors write
-- `content/drift/signals/<class>.yaml`; the pipeline
-- (backend/services/content_packs/generate_drift_migration.py) emits the seed
-- (266a) as TRUNCATE + re-insert, so the pack is the single source of truth and
-- a skeleton deleted from YAML disappears from the game.
--
-- The ENGINE that draws from this table (fn_travel_move extension,
-- fn_signal_resolve, travel_log_entries) lands in 267. Content first, so the
-- 32 skeletons are reviewable on their own and the engine migration is only
-- about mechanics.
--
-- ── Why the columns are split the way they are ────────────────────────────────
-- `band_weights` and `requires` are hoisted OUT of `definition` into their own
-- columns because they are what the draw filters and weights on, on EVERY move.
-- The rest of the skeleton (prose + options / auto outcome) is payload the panel
-- reads once a template has been picked, and stays in `definition`.
--
-- ── Why no FK from run state to this table ───────────────────────────────────
-- Same decision as travel_quest_templates (241): a run's `pending_signal`
-- references its template by KEY, not by id. The pack's reseed does
-- TRUNCATE … RESTART IDENTITY CASCADE, so a hard FK would let a content
-- republish wipe live player runs. Content is republishable; a run in flight is
-- not.
--
-- No behaviour change: nothing reads this table until 267, and 267's draw is
-- itself behind `drift_fun_core_enabled` (fail-closed, seeded false in 264).

BEGIN;

CREATE TABLE IF NOT EXISTS public.travel_signal_templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key  TEXT NOT NULL UNIQUE,
    signal_class  TEXT NOT NULL,
    pack_slug     TEXT NOT NULL,
    -- {"near": int, "mid": int, "deep": int} — relative draw weight WITHIN the
    -- class, per distance band. Absent band = 0 = the skeleton does not exist
    -- there. The class mix per band lives in drift_tuning.signal_weights (267).
    band_weights  JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {"kh_band": [...], "dz_band": [...], "window_band": [...], "overload": bool}
    -- Every listed constraint must hold; absent = any. '{}' = always eligible.
    requires      JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {"prose": {...}, "options": [...]} for the interactive classes
    -- (stoerung, begegnung), {"prose": {...}, "auto": {...}} for the passive
    -- ones (fund, geruecht, stille). The shape invariant is enforced at pack
    -- load (travel_schema.SignalPack) — SQL only stores what the pipeline built.
    definition    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT travel_signal_templates_class_check CHECK (
        signal_class IN ('stoerung', 'fund', 'geruecht', 'begegnung', 'stille')
    )
);

COMMENT ON TABLE public.travel_signal_templates IS
    'M1 signal skeletons — what the Drift does on the move the traveller did not '
    'ask for. Pack-owned (content/drift/signals/<class>.yaml -> generated seed); '
    'TRUNCATE + reseed on every republish. Read by fn_travel_move (draw) and '
    'fn_signal_resolve (267).';

-- The draw filters by class first (the tuned per-band class mix), so the class
-- is the index. 32 rows today — the index is for the shape of the query, not
-- for the row count.
CREATE INDEX IF NOT EXISTS idx_travel_signal_templates_class
    ON public.travel_signal_templates (signal_class);

DROP TRIGGER IF EXISTS set_travel_signal_templates_updated_at
    ON public.travel_signal_templates;
CREATE TRIGGER set_travel_signal_templates_updated_at
    BEFORE UPDATE ON public.travel_signal_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: public read, pack (service_role) write ──────────────────────────────
-- Same posture as travel_quest_templates (241). The skeletons are not secret —
-- the panel renders them and the HUD needs the prose. What must stay
-- unforgeable is WHICH skeleton is drawn WHEN, and that is guarded by the
-- salted seed (travel_run_seeds / drift_run_salt, migration 264), not by hiding
-- the catalogue.

ALTER TABLE public.travel_signal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_signal_templates_public_select
    ON public.travel_signal_templates;
CREATE POLICY travel_signal_templates_public_select
    ON public.travel_signal_templates FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS travel_signal_templates_service_role
    ON public.travel_signal_templates;
CREATE POLICY travel_signal_templates_service_role
    ON public.travel_signal_templates FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON public.travel_signal_templates TO anon, authenticated;
GRANT ALL    ON public.travel_signal_templates TO service_role;

COMMIT;
