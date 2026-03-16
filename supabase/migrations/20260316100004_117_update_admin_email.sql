-- =============================================================================
-- Migration 117: Transition admin email from placeholder to real address
-- =============================================================================
-- Centralizes the admin identity on matthias@leihs.at / met123.
-- Updates: platform_settings, auth.users, auth.identities.
-- Also cleans up any duplicate user rows created during manual testing.
-- =============================================================================

-- Update platform_settings to use real admin email
UPDATE public.platform_settings
SET setting_value = '["matthias@leihs.at"]'
WHERE setting_key = 'platform_admin_emails';

-- Remove duplicate matthias@leihs.at user if created manually BEFORE renaming
-- (otherwise the unique constraint on auth.users.email blocks the UPDATE)
DELETE FROM auth.identities
WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email = 'matthias@leihs.at'
      AND id != '00000000-0000-0000-0000-000000000001'
);
DELETE FROM auth.users
WHERE email = 'matthias@leihs.at'
  AND id != '00000000-0000-0000-0000-000000000001';

-- Update the dev user (UUID 00000000-...-001) to new email + password
UPDATE auth.users
SET email = 'matthias@leihs.at',
    encrypted_password = extensions.crypt('met123', extensions.gen_salt('bf')),
    raw_user_meta_data = '{"name":"Matthias"}'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Update identity record
UPDATE auth.identities
SET identity_data = jsonb_build_object(
    'sub', '00000000-0000-0000-0000-000000000001',
    'email', 'matthias@leihs.at',
    'email_verified', true
)
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND provider = 'email';
