-- Migration 119: Enable Realtime on forge_access_requests
--
-- The frontend subscribes to postgres_changes on this table to detect
-- when an admin approves/rejects a clearance request (no page reload needed).
-- Without this publication entry, the Realtime channel silently receives nothing.

ALTER PUBLICATION supabase_realtime ADD TABLE forge_access_requests;
