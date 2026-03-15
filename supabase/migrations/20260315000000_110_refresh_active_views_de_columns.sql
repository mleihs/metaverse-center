-- Refresh active_* views to pick up _de columns added in migration 060.
-- PostgreSQL expands SELECT * at view creation time, not query time.
-- Any migration that adds columns to tables backing these views MUST
-- include CREATE OR REPLACE VIEW to refresh the column set.

CREATE OR REPLACE VIEW public.active_agents AS
    SELECT * FROM agents WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_buildings AS
    SELECT * FROM buildings WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_simulations AS
    SELECT * FROM simulations WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.active_events AS
    SELECT * FROM events WHERE deleted_at IS NULL;
