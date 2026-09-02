-- 348 — Zwei Zuflüsse, die alle anderen übertönten
--
-- BEFUND (gemessen auf Produktion am 02.09.2026, 134 Kandidaten):
--
--     noaa_alerts       71   ← 53 % allein
--     nasa_eonet        24
--     Bluesky           21
--     usgs_earthquakes  10
--     gdacs              8
--     guardian           0
--     newsapi            0
--
-- 110 von 134 Meldungen trugen `source_category = 'natural_disaster'`, und
-- weil `CATEGORY_ARCHETYPE_MAP` diese Kategorie fest auf `elemental_surge`
-- führt, standen 82 % der Warteschlange unter EINEM Archetyp: „Die Flut".
-- Die Sichtung war kein Nachrichteneingang mehr, sondern ein Wetterticker.
--
-- Das ist keine Frage der Gewichtung, sondern der Menge: der US-Wetterdienst
-- gibt Unwetterwarnungen zu Hunderten am Tag heraus („Severe Thunderstorm
-- Warning issued September 2 at 9:03AM EDT"), der Guardian-Adapter holt
-- höchstens 50 Artikel je Lauf (5 Sektionen × 10). Jede Nachricht, die es in
-- die Sichtung schafft, ertrinkt zwischen Gewittern über Ohio.
--
-- ENTSCHEIDUNG: `noaa_alerts` und `nasa_eonet` sind ab hier nicht mehr in der
-- Vorgabe. Beide Adapter BLEIBEN registriert und jederzeit über die
-- Scanner-Verwaltung zuschaltbar — abgeschaltet ist die Vorauswahl, nicht die
-- Fähigkeit. `usgs_earthquakes` und `gdacs` bleiben drin: sie melden Ereignisse
-- von Weltrang und einzeln, nicht im Minutentakt.
--
-- WARUM SUBTRAKTION UND KEINE NEUE LISTE: die Zeile ist seit Migration 085
-- gewachsen (Bluesky kam am 02.09. dazu). Eine hier hineingeschriebene
-- Vollständigkeitsliste würde jede spätere Ergänzung stillschweigend
-- zurücknehmen. `jsonb - text` entfernt genau die benannten Einträge und lässt
-- alles andere in Ruhe — auf frischer Datenbank wie auf Produktion.

BEGIN;

UPDATE platform_settings
   SET setting_value = setting_value - 'noaa_alerts' - 'nasa_eonet',
       updated_at    = now()
 WHERE setting_key   = 'news_scanner_adapters'
   AND jsonb_typeof(setting_value) = 'array';

DO $$
DECLARE
  vorhanden integer;
  uebrig    jsonb;
BEGIN
  SELECT count(*) INTO vorhanden
    FROM platform_settings WHERE setting_key = 'news_scanner_adapters';

  IF vorhanden = 0 THEN
    -- Ehrliche Voraussetzung: die Zeile wird von Migration 085 gesät. Fehlt sie,
    -- gibt es nichts zu prüfen — und ein ausgesetzter Test ist kein bestandener.
    RAISE NOTICE 'news_scanner_adapters fehlt — Probe ausgesetzt';
    RETURN;
  END IF;

  SELECT setting_value INTO uebrig
    FROM platform_settings WHERE setting_key = 'news_scanner_adapters';

  IF uebrig @> '["noaa_alerts"]'::jsonb OR uebrig @> '["nasa_eonet"]'::jsonb THEN
    RAISE EXCEPTION 'noaa_alerts/nasa_eonet stehen weiterhin in der Vorgabe: %', uebrig;
  END IF;

  -- Die Zusicherung bleibt scharf: die Subtraktion darf die Liste nicht leeren.
  -- Eine leere Vorgabe hiesse, der Scanner läuft und holt nichts — genau der
  -- lautlose Ausfall, den dieser Eingriff verhindern soll.
  IF jsonb_array_length(uebrig) = 0 THEN
    RAISE EXCEPTION 'Vorgabe ist leer — kein Zufluss bliebe übrig';
  END IF;

  RAISE NOTICE 'Vorgabe jetzt: % (% Zuflüsse)', uebrig, jsonb_array_length(uebrig);
END $$;

COMMIT;
