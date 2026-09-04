-- ═══════════════════════════════════════════════════════════════════════════
-- 355 · Ein Gast bekommt die Ausgabe, die das Haus wählt
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Die Plattform hat seit dem 03.09.2026 zwei Ausgaben: das Phosphor-Chrom
-- (`dark`) und die Kartenmappe (`atlas`). Wer eine wählt, dessen Wahl liegt im
-- Browser unter `velg-platform-skin` und gilt.
--
-- Wer NOCH KEINE gewählt hat — jeder Gast, jeder neue Zugang, jeder frische
-- Browser — bekam bisher `dark`, weil das im Frontend als Zeichenkette
-- dastand. Das ist eine Gestaltungsentscheidung, und die gehört nicht in einen
-- Vorgabewert im Code, sondern in die Hand der Verwaltung.
--
-- WARUM EIN TEXT UND KEIN BOOLEAN
--   Es sind heute zwei Ausgaben und morgen vielleicht drei. Ein `atlas_default`
--   als Ja/Nein wäre beim dritten Skin eine Lüge, und die Umstellung müsste
--   jede lesende Stelle anfassen. Der Schlüssel trägt deshalb den NAMEN der
--   Ausgabe.
--
-- WARUM KEINE CHECK-BESCHRÄNKUNG AUF DIE ZWEI NAMEN
--   `platform_settings` ist eine Schlüssel-Wert-Tabelle; eine Beschränkung
--   müsste den Schlüssel mitprüfen und würde bei jedem neuen Skin eine
--   Migration verlangen. Die Prüfung sitzt dort, wo die Namen bekannt sind:
--   der Router weist alles zurück, was nicht in PLATFORM_SKINS steht, und das
--   Frontend fällt über `isPlatformSkin` auf `dark` zurück. Zwei Schranken,
--   beide am richtigen Ort.
--
-- ON CONFLICT DO NOTHING: läuft die Migration auf einer Datenbank, in der
-- jemand den Schlüssel schon gesetzt hat, bleibt seine Wahl stehen.

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'platform_default_skin',
  '"dark"'::jsonb,
  'Welche Ausgabe ein Besucher ohne eigene Wahl bekommt: "dark" (Phosphor) oder "atlas" (Papier).'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene WIRKUNG, nicht gegen den Inhalt der Plattform: existiert
-- die Zeile nach diesem Lauf, und trägt sie einen der zwei gültigen Namen?
-- Beides gilt auf einer leeren Datenbank genauso wie auf Produktion.
DO $$
DECLARE
  v_wert text;
BEGIN
  SELECT setting_value #>> '{}' INTO v_wert
  FROM platform_settings
  WHERE setting_key = 'platform_default_skin';

  IF v_wert IS NULL THEN
    RAISE EXCEPTION '355: platform_default_skin fehlt nach dem INSERT';
  END IF;

  IF v_wert NOT IN ('dark', 'atlas') THEN
    RAISE EXCEPTION '355: platform_default_skin ist %, erwartet dark oder atlas', v_wert;
  END IF;

  RAISE NOTICE '355: platform_default_skin steht auf %', v_wert;
END $$;
