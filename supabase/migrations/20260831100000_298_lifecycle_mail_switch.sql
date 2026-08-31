-- 298 — Der Schalter für Post, die dem Menschen folgt statt dem Spiel
--
-- Handoff P2.21. `LifecycleMailScheduler` fragt `lifecycle_mail_enabled` und
-- ist fail-closed: fehlt die Zeile, läuft KEIN Sweep. Ohne diese Saat wäre die
-- Willkommensmail gebaut und dauerhaft stumm — ein Tor, das nichts trifft.
--
-- Warum die Saat `true` ist und das gefahrlos bleibt
-- --------------------------------------------------
-- Der Sweep hat eine UNTERE Fenstergrenze von 24 Stunden. Gegen den echten
-- Bestand gemessen, am Tag dieser Migration:
--
--   ohne Untergrenze:  10 Konten  (jedes je angelegte Konto bekäme "Willkommen")
--   mit  Untergrenze:   0 Konten  (jüngstes Konto: 2026-04-22)
--
-- Post lässt sich nicht zurückholen. Die Grenze ist deshalb kein Feinschliff,
-- sondern die Bedingung dafür, dass dieser Schalter überhaupt auf `true` stehen
-- darf.
--
-- Abschalten (es gibt für diesen Schlüssel noch keine Admin-Oberfläche, der
-- Endpunkt `PUT /api/v1/admin/settings/lifecycle_mail_enabled` erreicht ihn):
--
--   UPDATE platform_settings SET setting_value = 'false'::jsonb
--    WHERE setting_key = 'lifecycle_mail_enabled';
--
-- Die Saat trägt den kanonischen jsonb-Bool (CLAUDE.md: Migrationssaaten so,
-- Admin-Schreibwege den Kleinbuchstaben-String). `parse_setting_bool` nimmt seit
-- F32 beides: `isinstance(value, bool)` durchreichen, sonst positiv abgleichen.

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'lifecycle_mail_enabled',
  'true'::jsonb,
  'Master switch for lifecycle mail sweeps (welcome, digest, invitation follow-up). Fail-closed: absent means off.'
)
ON CONFLICT (setting_key) DO NOTHING;
