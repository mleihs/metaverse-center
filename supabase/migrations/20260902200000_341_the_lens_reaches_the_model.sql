-- Migration 341: Die Linse erreicht das Modell
--
-- Lücke 4 aus `handoff/schleuse-event-intake.md`. Der Schmelztiegel der Schleuse
-- stellt seit Schritt 3 Regler für Ort, Vektor, Tonlage, Freiheit und eine
-- freie Anweisung — und KEINER davon erreichte bisher das Modell. Die
-- Oberfläche trug deshalb eine Marke `°` an jeder betroffenen Zeile und eine
-- Fussnote, die sagt, was wirkt und was nicht. Diese Migration ist die eine
-- Hälfte des Verschlusses; die andere ist der Code (`TransformLens`,
-- `render_lens_directives`, `lens_directives` im Vertrag).
--
-- ── ZWEI ÄNDERUNGEN, UND DIE ZWEITE IST DIE, DIE MAN VERGISST ───────────────
--
-- 1. `{lens_directives}` in beide Vorlagen (de + en). Ohne den Platzhalter
--    liefert der Code den Block zwar, und niemand liest ihn — genau die
--    Sorte still wirkungslose Änderung, gegen die dieses Haus schreibt.
--
-- 2. `max_tokens` von 400 auf 900. GEMESSEN, nicht angenommen, direkt gegen
--    `deepseek/deepseek-chat` mit dem echten Prompt:
--
--        ohne Linse   cap 400   completion 279   finish=stop     JSON zu
--        MIT Linse    cap 400   completion 400   finish=length   ABGESCHNITTEN
--        MIT Linse    cap 900   completion 150   finish=stop     JSON zu
--        ohne Linse   cap 900   completion 371   finish=stop
--
--    Der Anweisungsblock kostet rund 60 Prompt-Token und verschiebt die
--    Antwort über die alte Grenze. Wer nur den Platzhalter einträgt, schaltet
--    die Regler an UND schneidet die Antwort ab — die Verwandlung liefert dann
--    ein halbes JSON, und `_parse_json_object` findet nichts.
--
--    900 ist das rund 2,4-fache des grössten VOLLSTÄNDIGEN Laufs (371).
--
-- ⚠ Das ist die zweite Vorlage an einem Tag, deren Budget in der Datenbank
-- still zu klein war (nach `scanner_bureau_dispatch`, Migration 338). Beide Male
-- hätte die Code-Änderung allein nichts bewirkt, weil die Vorlagen-Zeile den
-- Wert im Code schlägt.
--
-- 🔑 `finish_reason` ist das bessere Messgerät als „completion == max_tokens":
-- es sagt `length` auch dann, wenn die Zahl knapp darunter liegt.
--
-- ── WAS NICHT MITGESCHICKT WIRD ─────────────────────────────────────────────
--
-- `type`, `impact` und die Reaktionen bleiben draussen. Sie wirken bei der
-- AUFNAHME (`integrate-article`), nicht bei der Erzeugung, und das Modell soll
-- `event_type` und `impact_level` in derselben Antwort SELBST liefern. Beides
-- zu schicken hiesse, zwei Quellen für eine Zahl zu haben.
--
-- Die Freiheit (`creativity`) wird zur TEMPERATUR des Aufrufs und steht
-- deshalb nicht im Text — `GenerationService._generate` nimmt sie jetzt
-- entgegen und überstimmt damit die Temperatur der Vorlage.

BEGIN;

UPDATE public.prompt_templates
   SET prompt_content = 'Transformiere diesen realen Nachrichtenartikel in die Erzählung von "{simulation_name}":
Titel: {news_title}
Inhalt: {news_content}
Schreibe den Artikel um, als ob er in der Simulationswelt stattgefunden hätte.
Behalte die Kernfakten bei, passe aber Namen, Orte und Kontext an.{lens_directives}
Generiere ein JSON-Objekt mit: "title", "description", "event_type", "impact_level" (1-10).
Antworte auf {locale_name}.',
       max_tokens = 900,
       updated_at = now()
 WHERE template_type = 'news_transformation'
   AND locale = 'de'
   AND simulation_id IS NULL;

UPDATE public.prompt_templates
   SET prompt_content = 'Transform this real-world news article into the narrative of "{simulation_name}":
Title: {news_title}
Content: {news_content}
Rewrite the article as if it happened in the simulation world.
Maintain the core facts but adapt names, places, and context.{lens_directives}
Generate a JSON object with: "title", "description", "event_type", "impact_level" (1-10).
Respond in {locale_name}.',
       max_tokens = 900,
       updated_at = now()
 WHERE template_type = 'news_transformation'
   AND locale = 'en'
   AND simulation_id IS NULL;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Beide Haelften einzeln, weil sie einzeln ausfallen koennen: der Platzhalter
-- kann fehlen (Regler wirkungslos) UND das Budget kann zu klein bleiben
-- (Antwort abgeschnitten). Eine Pruefung, die nur eines von beiden sieht,
-- meldet Erfolg fuer einen halben Verschluss.

DO $$
DECLARE
  vorlagen integer;
  ohne_platzhalter integer;
  zu_klein integer;
BEGIN
  /*
   * Auf einer FRISCHEN Datenbank gibt es diese Vorlagen hier noch nicht: sie
   * kommen aus `supabase/seed/006_prompt_templates.sql`, und die Saat laeuft
   * NACH den Migrationen. Beide Pruefungen unten bestuenden dann trivial —
   * null falsche Zeilen, weil null Zeilen.
   *
   * Das ist kein Fehler, aber es muss DASTEHEN: ein Test, der besteht, weil er
   * nichts zu pruefen fand, ist kein bestandener Test. Und der eigentliche
   * Schutz liegt woanders: die Saat traegt denselben Platzhalter und dasselbe
   * Budget. Wer eines von beiden aendert, muss das andere mitaendern.
   */
  SELECT count(*) INTO vorlagen
    FROM public.prompt_templates
   WHERE template_type = 'news_transformation' AND simulation_id IS NULL;
  IF vorlagen = 0 THEN
    RAISE NOTICE 'Keine Plattform-Vorlagen fuer news_transformation — Probe ausgesetzt (frische Datenbank? die Saat kommt spaeter)';
  END IF;

  SELECT count(*) INTO ohne_platzhalter
    FROM public.prompt_templates
   WHERE template_type = 'news_transformation'
     AND simulation_id IS NULL
     AND prompt_content NOT LIKE '%{lens_directives}%';
  IF ohne_platzhalter > 0 THEN
    RAISE EXCEPTION '% Plattform-Vorlage(n) nennen {lens_directives} nicht — die Linse waere wirkungslos', ohne_platzhalter;
  END IF;

  SELECT count(*) INTO zu_klein
    FROM public.prompt_templates
   WHERE template_type = 'news_transformation'
     AND simulation_id IS NULL
     AND max_tokens < 900;
  IF zu_klein > 0 THEN
    RAISE EXCEPTION '% Plattform-Vorlage(n) tragen weiterhin ein zu kleines Budget', zu_klein;
  END IF;
END $$;

COMMIT;
