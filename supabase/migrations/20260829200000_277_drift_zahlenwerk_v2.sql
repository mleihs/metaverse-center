-- ═══════════════════════════════════════════════════════════════════════════════
-- 277 — DRIFT: die drei fehlenden Werte aus dem Zahlenwerk v2
-- ═══════════════════════════════════════════════════════════════════════════════
-- Das Konzept (docs/concepts/drift-gameplay-redesign-concept.md §6, "Zahlenwerk v2")
-- schreibt für P0.5 eine vollständige Werte-Tabelle vor. Elf ihrer vierzehn Zeilen sind
-- mit den Wellen 1 und 2 in `drift_tuning` gelandet — DREI nicht. Es sind ausgerechnet
-- die drei, die ineinandergreifen, und ihr Fehlen ist im Durchspielen messbar:
--
--   Fenster (Takte)   8 → 14   "Session 10-15 min; Raum für Sondieren/Gebäude/Umwege"
--   DZ-Cap           20 → 40   "DZ braucht Raum zum Eskalieren + Senken"
--   Notfrequenz     −20 → −10  "20 ist mit Havarie-Redesign doppelt bestrafend"
--
-- Gemessen an einer Fahrt über die lokale Karte (7 Welten, 48 Knoten), Bandbreitenklasse I:
--
-- (a) NOTFREQUENZ. Bandbreite 11 kauft drei bis fünf Kanten (Kosten 2/2/6 beobachtet),
--     das Fenster erlaubt acht. Ab dem Takt, an dem die Bandbreite leer ist, kostet JEDER
--     Zug 20 KH — und weil die Dissonanz da längst über der Blutungsschwelle (8) liegt,
--     zusätzlich 5. Die Messung: KH 100 → 75 → 50 → 25 → 0. Vier Züge. Der Träger stirbt
--     nicht an einer Entscheidung, sondern an einer Subtraktion. Genau das meint das
--     Konzept mit "doppelt bestrafend": die Havarie IST schon die Strafe für ein leeres
--     Budget; −20 tötet vorher.
--
-- (b) FENSTER. Bei 8 Takten kostet jeder Stich (1 Takt) ein Achtel der ganzen Fahrt —
--     und die Fahrt muss davon auch noch heimkommen. Sondierung ist der Push-your-luck-Kern
--     der ganzen Welle 2 und war schlicht nicht bezahlbar. 14 ist der Wert, bei dem
--     graben eine Wahl wird statt eines Verzichts.
--
-- (c) DZ-CAP. Der Cap 20 staucht alles, was auf der Dissonanz sitzt, auf die halbe Skala:
--     die Bänder (`signal_bands.dz`: ruhig <7, erhoeht <14) haben keinen Auslauf mehr, und
--     `dz_late_window.from_takt = 8` konnte bei einem 8-Takt-Fenster überhaupt nur im
--     allerletzten Takt feuern — die Eskalation M9 war totes Tuning. Mit Fenster 14 bekommt
--     sie sechs Takte Anlauf.
--
--     Der Cap hängt außerdem an der OPTIK, und das war im Browser der auffälligste Effekt:
--     der Grade-Shader (`post/composer.ts`) skaliert Reißbänder, Redaktionsblöcke und
--     Scanlines mit `uDissonance = dissonanz / cap`. Die Redaktionsblöcke — schwarze
--     Rechtecke über der Karte — schalten bei `diss > 0.5`. Bei Cap 20 heißt das ab DZ 10,
--     also ab der Hälfte jeder normalen Fahrt; gemessen stand ein Lauf bei DZ 16 auf
--     `uDissonance` 0.8 und die Karte war dauerhaft von blinkenden Blöcken überzogen.
--     Der Shader ist für die 40er-Skala geschrieben. Auf der 20er liest sich jede
--     Dissonanz doppelt so schlimm, wie sie gemeint ist — und verdeckt dabei die eine
--     Fläche, die lesbar bleiben muss. Cap 40 stellt beides zugleich richtig.
--
-- Reine Datenänderung: keine Funktion, keine Spalte, kein Verhalten im Code. Alle drei
-- Schlüssel werden zur Laufzeit über `drift_tuning_value()` gelesen; laufende Fahrten
-- sehen die neuen Werte ab dem nächsten Zug. Rücknahme = die drei alten Werte
-- zurückschreiben (unten dokumentiert).
--
-- Rollback:
--   UPDATE drift_tuning SET value = '8'::jsonb  WHERE setting_key = 'window_base';
--   UPDATE drift_tuning SET value = '20'::jsonb WHERE setting_key = 'dz_p0_cap';
--   UPDATE drift_tuning SET value = '20'::jsonb WHERE setting_key = 'notfreq_kh_per_edge';

UPDATE public.drift_tuning
   SET value = '14'::jsonb,
       description = 'Aufenthaltsfenster in Takten (Zahlenwerk v2 §6: Raum für Sondieren und Umwege)',
       updated_at = now()
 WHERE setting_key = 'window_base';

UPDATE public.drift_tuning
   SET value = '40'::jsonb,
       description = 'Dissonanz-Obergrenze (Zahlenwerk v2 §6; skaliert auch uDissonance im Grade-Shader)',
       updated_at = now()
 WHERE setting_key = 'dz_p0_cap';

UPDATE public.drift_tuning
   SET value = '10'::jsonb,
       description = 'Kohärenz je Kante auf Notfrequenz (Zahlenwerk v2 §6: 20 war mit dem Havarie-Redesign doppelt bestrafend)',
       updated_at = now()
 WHERE setting_key = 'notfreq_kh_per_edge';

-- Die drei Schlüssel MÜSSEN existieren — sie werden seit Migration 246/264 geseedet.
-- Ein stiller No-Op (0 Zeilen) wäre genau die Klasse Fehler, die CLAUDE.md für
-- platform_settings beschreibt: die Änderung sähe erfolgreich aus und wäre keine.
DO $$
DECLARE
    v_missing TEXT[];
BEGIN
    SELECT array_agg(k) INTO v_missing
      FROM unnest(ARRAY['window_base', 'dz_p0_cap', 'notfreq_kh_per_edge']) AS k
     WHERE NOT EXISTS (SELECT 1 FROM public.drift_tuning t WHERE t.setting_key = k);
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 277: drift_tuning fehlen die Schlüssel %', v_missing;
    END IF;
END $$;
