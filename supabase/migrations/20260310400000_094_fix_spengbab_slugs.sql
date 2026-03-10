-- Migration 094: Fix Spengbab slugs (renamed from "Whore House" to "Grease Pit")
-- The simulation was renamed but the slug remained stale due to trg_slug_immutable.

ALTER TABLE simulations DISABLE TRIGGER trg_slug_immutable;

UPDATE simulations SET slug = 'spengbabs-grease-pit'
  WHERE id = '60000000-0000-0000-0000-000000000001'
    AND slug = 'spengbabs-whore-house';

UPDATE simulations SET slug = 'spengbabs-grease-pit-e3'
  WHERE id = '1c7c7d94-9889-492d-bcea-9854e5073c51'
    AND slug = 'spengbabs-whore-house-e3';

UPDATE simulations SET slug = 'spengbabs-grease-pit-e6'
  WHERE id = '41cb002b-67b7-40e8-aa0d-fc86cbfcbc0e'
    AND slug = 'spengbabs-whore-house-e6';

ALTER TABLE simulations ENABLE TRIGGER trg_slug_immutable;
