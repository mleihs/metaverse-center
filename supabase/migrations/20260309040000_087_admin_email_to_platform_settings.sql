-- 087: Move platform admin email from GUC to platform_settings table
--
-- Supabase hosted blocks ALTER DATABASE SET for custom GUC parameters.
-- This migration moves the admin email config to the platform_settings table
-- and rewrites is_platform_admin() to read from there.
-- Supports multiple admin emails via JSON array.

-- 1. Seed admin email into platform_settings
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
  'platform_admin_emails',
  '["admin@velgarien.dev"]',
  'JSON array of platform admin email addresses'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Rewrite is_platform_admin() to read from platform_settings
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid()
          AND u.email IN (
            SELECT jsonb_array_elements_text(ps.setting_value)
            FROM public.platform_settings ps
            WHERE ps.setting_key = 'platform_admin_emails'
          )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
