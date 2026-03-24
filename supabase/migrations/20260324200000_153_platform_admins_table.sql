-- platform_admins — Replaces fragile email-based admin check with DB lookup.
--
-- Previously, platform admin was determined by matching the JWT email claim
-- against PLATFORM_ADMIN_EMAILS env var. This is fragile because:
-- 1. Email claims can be spoofed if auth provider misconfigured
-- 2. Email changes break admin access
-- 3. No audit trail of admin grants/revokes
--
-- This table stores user IDs directly. The backend require_platform_admin()
-- dependency queries this table instead of checking emails.
--
-- RLS: service_role only (admin check happens in backend, not via client).

CREATE TABLE IF NOT EXISTS platform_admins (
    user_id UUID PRIMARY KEY,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID,  -- nullable for seed data
    notes TEXT DEFAULT ''
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- No public access — only service_role can read/write
CREATE POLICY platform_admins_service_role ON platform_admins
    FOR ALL
    USING (auth.role() = 'service_role');

-- Seed: insert current admin(s) by looking up their user ID from email
-- This is idempotent — ON CONFLICT DO NOTHING
INSERT INTO platform_admins (user_id, notes)
SELECT id, 'Seeded from PLATFORM_ADMIN_EMAILS migration'
FROM auth.users
WHERE email IN ('matthias@leihs.at')
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE platform_admins IS
  'Platform admin user IDs. Replaces email-based admin check (see dependencies.py). Migration 153.';
