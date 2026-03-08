-- =============================================================================
-- Migration 081: Add i18n columns to events table
-- =============================================================================
-- Follows the pattern from migration 060 (agents: character_de, background_de;
-- buildings: description_de, etc.)
-- Events are generated in English (title, description) with German translations
-- stored in title_de, description_de.
-- =============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS title_de text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description_de text;

COMMENT ON COLUMN events.title_de IS 'German translation of event title';
COMMENT ON COLUMN events.description_de IS 'German translation of event description';
