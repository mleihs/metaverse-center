-- ============================================================================
-- Migration 077: Resonance Admin RLS + Platform Admin Config
-- ============================================================================
-- Adds platform-admin RLS policy to substrate_resonances so admins can
-- see, update, and soft-delete all rows (including deleted_at IS NOT NULL).
-- This follows the same pattern as user_wallets (migration 055).
-- ============================================================================

-- 1. Platform admin email — now lives in platform_settings (migration 087).
--    ALTER DATABASE SET is blocked on Supabase hosted and local.

-- 2. Ensure is_platform_admin() exists (idempotent, rewritten by migration 087)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
          AND email = current_setting('app.platform_admin_email', true)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Admin full-access policy (SELECT + UPDATE including soft-deleted rows)
CREATE POLICY "resonances_admin_full_access"
    ON public.substrate_resonances
    FOR ALL
    USING (is_platform_admin());
