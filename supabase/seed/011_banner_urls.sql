-- Set banner_url for all simulations that have banners in storage.
-- These are uploaded to production via the image service and synced to local.
-- Spengbab (60000000-*) has no banner.

UPDATE simulations SET banner_url =
  'http://localhost:54321/storage/v1/object/public/simulation.assets/' || id || '/banner.webp'
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001'
) AND banner_url IS NULL;
