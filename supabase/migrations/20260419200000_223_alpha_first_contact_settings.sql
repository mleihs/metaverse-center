-- Alpha First-Contact Modal settings.
--
-- Two platform_settings keys drive the Bureau-Dispatch modal that greets
-- non-member visitors while Velgarien is in alpha:
--
--   alpha_first_contact_modal_enabled  Whether the modal should render at all.
--   alpha_first_contact_modal_version  Bumping this retriggers the modal even
--                                      for users who already dismissed it.
--
-- Both keys are read-only for anon/authenticated via a narrow public endpoint
-- (GET /api/v1/public/alpha-state); writes go through the admin setting API.
-- RLS on platform_settings is unchanged (service_role only); the public
-- endpoint projects onto a minimal DTO, so no policy relaxation is needed.

-- setting_value is jsonb. `true` is a valid JSON literal on its own, but a
-- date string must be double-quoted to be valid JSON — `"2026-04-19"` is a
-- JSON string, whereas bare `2026-04-19` is parsed as the expression
-- `2026 - 04 - 19`, which fails psql's JSON parser.
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  (
    'alpha_first_contact_modal_enabled',
    'true'::jsonb,
    'Render Bureau-Dispatch first-contact modal to non-member visitors.'
  ),
  (
    'alpha_first_contact_modal_version',
    '"2026-04-19"'::jsonb,
    'Version stamp. Bump to re-show the modal to users who dismissed an older version.'
  )
ON CONFLICT (setting_key) DO NOTHING;
