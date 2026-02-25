-- Add missing index on buildings.street_id (consistent with idx_buildings_city, idx_buildings_zone)
CREATE INDEX IF NOT EXISTS idx_buildings_street ON buildings(street_id);
