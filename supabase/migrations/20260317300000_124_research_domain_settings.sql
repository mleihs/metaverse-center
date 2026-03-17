-- Migration 124: Seed configurable research domain settings
--
-- Moves hardcoded Tavily domain lists from tavily_search.py into
-- platform_settings so they can be managed from the admin panel.

INSERT INTO platform_settings (setting_key, setting_value, updated_by_id)
VALUES
  ('research_domains_encyclopedic', '["en.wikipedia.org","plato.stanford.edu","britannica.com"]', NULL),
  ('research_domains_literary', '["en.wikipedia.org","britannica.com","theparisreview.org"]', NULL),
  ('research_domains_philosophy', '["plato.stanford.edu","iep.utm.edu","en.wikipedia.org"]', NULL),
  ('research_domains_architecture', '["en.wikipedia.org","dezeen.com","designboom.com"]', NULL)
ON CONFLICT (setting_key) DO NOTHING;
