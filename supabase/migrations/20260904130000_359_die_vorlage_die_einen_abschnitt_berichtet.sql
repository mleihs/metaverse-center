-- ═══════════════════════════════════════════════════════════════════════════
-- 359 · Die Vorlage, die einen Abschnitt berichtet
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Gehört zu Migration 358. Dort steht die Ablage, hier der Auftrag.
--
-- ── Was die Vorlage NICHT tut ──────────────────────────────────────────────
--
-- Sie liest keine frühere Verdichtung. Der Auftrag bekommt nur den Urtext
-- SEINES Abschnitts, und das ist der Punkt: „Recursively Summarizing Enables
-- Long-Term Dialogue Memory" (arXiv:2308.15022) und die Arbeiten danach
-- beschreiben, wie ein Verdichter seine eigene frühere Ausgabe für
-- Grundwahrheit hält und einen einmal falschen Satz durch jede weitere Runde
-- trägt. Hier gibt es keine weitere Runde.
--
-- ── Warum der Bericht auf DEN CHARAKTER zielt ──────────────────────────────
--
-- Der Anlass war der Satz des Nutzers, dass mit einem engen Fenster (Wortlaut nicht wiedergegeben). Eine Verdichtung, die nur
-- Ereignisse aufzählt (Wortlaut nicht wiedergegeben)), rettet den nicht. Der
-- Auftrag verlangt deshalb ausdrücklich das, was eine Ereignisliste weglässt:
-- wie die Beteiligten zueinander stehen, was sich zwischen ihnen geändert
-- hat, welche Anrede und welcher Ton sich eingespielt haben, und was
-- unausgesprochen blieb.
--
-- Das letzte Feld ist das wichtigste und das am leichtesten zu verlierende:
-- ein Gespräch, das über Hunderte Züge eine Vertraulichkeit aufgebaut hat,
-- hat sie in keiner einzelnen Nachricht stehen.

INSERT INTO prompt_templates (template_type, prompt_category, locale, template_name, prompt_content, is_system_default, is_active)
VALUES
  ('chat_conversation_digest', 'chat', 'en', 'Conversation Digest (EN)',
   E'The following is section {segment_index} of a long conversation between: {participant_names}.\n\n--- TRANSCRIPT ---\n{transcript}\n--- END TRANSCRIPT ---\n\nWrite a compact report of this section in {locale_name}. It will be given to the participants as their memory of what happened here, so record what a summary of events alone would lose:\n\n1. What happened, and what was decided or settled.\n2. How the participants stand towards each other, and what changed between them in this section.\n3. The register that has settled in: forms of address, tone, what is joked about, what is avoided.\n4. What stayed unspoken but was clearly present.\n\nFacts that will matter later belong in; small talk does not.',
   true, true),
  ('chat_conversation_digest', 'chat', 'de', 'Gespraechs-Verdichtung (DE)',
   E'Es folgt Abschnitt {segment_index} eines langen Gespraechs zwischen: {participant_names}.\n\n--- MITSCHRIFT ---\n{transcript}\n--- ENDE MITSCHRIFT ---\n\nSchreibe einen knappen Bericht ueber diesen Abschnitt auf {locale_name}. Er wird den Beteiligten als ihre Erinnerung an das Geschehene vorgelegt, halte deshalb fest, was eine blosse Ereignisliste verlieren wuerde:\n\n1. Was geschehen ist, und was entschieden oder geklaert wurde.\n2. Wie die Beteiligten zueinander stehen, und was sich zwischen ihnen in diesem Abschnitt geaendert hat.\n3. Der Ton, der sich eingespielt hat: Anrede, Umgangsform, worueber gescherzt wird, was gemieden wird.\n4. Was unausgesprochen blieb, aber deutlich da war.\n\nWas spaeter noch zaehlt, gehoert hinein; Belangloses nicht.',
   true, true)
ON CONFLICT DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: stehen beide Zeilen da, tragen sie alle vier
-- Platzhalter, die `prompt_contracts.py` deklariert, und keinen fuenften.
-- Ein Platzhalter, den die Aufrufstelle nicht liefert, rendert LEER — und
-- das faellt nicht auf, es macht den Bericht nur stiller.
DO $$
DECLARE
  v_zeilen int;
  v_platz  int;
BEGIN
  SELECT count(*) INTO v_zeilen FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_conversation_digest';
  IF v_zeilen <> 2 THEN
    RAISE EXCEPTION '359: % Plattform-Zeilen statt 2 (en + de)', v_zeilen;
  END IF;

  SELECT count(*) INTO v_platz FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_conversation_digest'
    AND prompt_content LIKE '%{participant_names}%'
    AND prompt_content LIKE '%{transcript}%'
    AND prompt_content LIKE '%{locale_name}%'
    AND prompt_content LIKE '%{segment_index}%'
    AND prompt_content NOT LIKE '%{{%';
  IF v_platz <> 2 THEN
    RAISE EXCEPTION '359: nur % von 2 Zeilen tragen alle vier Platzhalter in der richtigen Schreibweise', v_platz;
  END IF;

  RAISE NOTICE '359: zwei Verdichtungs-Vorlagen, vier Platzhalter je Zeile.';
END $$;
