-- ═══════════════════════════════════════════════════════════════════════════
-- 356 · Ein Zug, der dir zugeschrieben wird, ist deiner
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (ausgezählt am 04.09.2026 am Faden 7b2e37c3-46ab-423c-ab18-ed54c6428dc2,
-- 79 Agentennachrichten):
--
--     Zugposition 0  Mira Steinfeld   32 Nachrichten   0 Bruchstücke   8 Marken
--     Zugposition 1  Elena Voss       32 Nachrichten   9 Bruchstücke   5 Marken
--     Zugposition 2  Lena Kray         5 Nachrichten   0 Bruchstücke   3 Marken
--     Einzelchat     Mira, davor      10 Nachrichten   0 Bruchstücke   0 Marken
--
-- Alle neun Bruchstücke auf Position 1. Keines auf Position 0, keines in den
-- zehn Einzelgesprächen davor. Das ist kein Zufallsmuster, sondern eine
-- Adresse: Position 1 ist die erste, die einen FRISCHEN fremden Zug bekommt.
--
-- Die Ursache lag im Code (`chat_ai_service.py`) und ist dort behoben: jeder
-- fertige Zug der anderen ging mit `role: "assistant"` hinaus, und das ist im
-- Protokoll die Zusicherung „das hast du gesagt".
--
-- WARUM DIE VORLAGE TROTZDEM MIT MUSS
--   Der Code sagt dem Modell jetzt, WER gesprochen hat. Er sagt ihm nicht,
--   was es daraus zu schliessen hat. Die alte Gruppen-Instruktion
--   („Reagiere auf die Aussagen des Users und der anderen Agenten") verbietet
--   nichts — sie lädt sogar dazu ein, den anderen zu bedienen. Zwei Schranken
--   an zwei Orten, wie überall im Werk: die eine trägt die Struktur, die
--   andere die Absicht.
--
-- WARUM ZUSÄTZLICH EIN RAHMEN IM VERTRAG
--   Diese Zeilen hier sind die PLATTFORM-Vorlage. Eine Welt darf sich eine
--   eigene schreiben, und dann stünde die Schärfung nicht mehr drin. Deshalb
--   trägt `chat_group_instruction` ab jetzt einen `frame` in
--   `backend/services/prompt_contracts.py`, den `PromptResolver` an jede
--   SIMULATIONSEIGENE Vorlage anhängt. Was eine Welt gestalten darf, ist der
--   Ton; dass niemand für einen anderen spricht, darf sie nicht wegschreiben.
--
-- KEINE ANFASSUNG SIMULATIONSEIGENER ZEILEN: `WHERE simulation_id IS NULL`.
-- Wer sich eine eigene Vorlage geschrieben hat, behält sie; der Rahmen greift
-- dort ohnehin.

UPDATE prompt_templates
SET prompt_content = 'You are in a group conversation. The other participants are: {other_agent_names}. Speak only as yourself, and only in the first person. Never write, quote or continue another participant''s lines, and never answer on their behalf. Do not put any name in front of your reply: no bracketed tag, no "Name:" opener. Messages from the others reach you marked with their name; that mark identifies them and is not a format for your own text. Respond to what the user and the others have said, and reference the mentioned events when they matter.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en';

UPDATE prompt_templates
SET prompt_content = 'Du befindest dich in einem Gruppengespraech. Die anderen Teilnehmer sind: {other_agent_names}. Sprich ausschliesslich als du selbst und in der Ich-Form. Schreibe niemals die Zeilen eines anderen, gib sie nicht wieder, fuehre sie nicht fort und antworte nicht an seiner Stelle. Stelle deinem Text keinen Namen voran: keine eckige Klammer, kein "Name:" am Anfang. Die Beitraege der anderen erreichen dich mit ihrem Namen markiert; diese Marke kennzeichnet sie und ist keine Vorlage fuer deine eigene Antwort. Reagiere auf das, was der User und die anderen gesagt haben, und beziehe dich auf die referenzierten Events, wenn sie relevant sind.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de';

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene WIRKUNG: sind die Plattform-Zeilen, die es GIBT, geschärft,
-- und steht der Platzhalter noch drin. Nicht gegen eine Zeilenzahl der
-- Plattform — die wäre Inhalt und träfe auf einer frischen Datenbank nicht zu.
--
-- Findet sich gar keine Plattform-Vorlage, wird das GESAGT und nicht
-- verschwiegen: eine Prüfung, die nichts zu prüfen fand, ist keine bestandene.
DO $$
DECLARE
  v_platform int;
  v_scharf   int;
  v_mustache int;
BEGIN
  SELECT count(*) INTO v_platform
  FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';

  IF v_platform = 0 THEN
    RAISE NOTICE '356: keine Plattform-Vorlage chat_group_instruction vorhanden — Nachschaerfung UEBERSPRUNGEN, nicht bestanden.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_scharf
  FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{other_agent_names}%'
    AND (prompt_content LIKE '%first person%' OR prompt_content LIKE '%Ich-Form%');

  IF v_scharf <> v_platform THEN
    RAISE EXCEPTION '356: nur % von % Plattform-Vorlagen tragen die Schaerfung samt Platzhalter', v_scharf, v_platform;
  END IF;

  -- Der Resolver rendert `str.format`; eine doppelte Klammer waere ein
  -- literales `{{` im Prompt und ein Verstoss gegen die CHECK aus 280.
  SELECT count(*) INTO v_mustache
  FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{{%';

  IF v_mustache > 0 THEN
    RAISE EXCEPTION '356: % Plattform-Vorlage(n) in Mustache-Schreibweise', v_mustache;
  END IF;

  RAISE NOTICE '356: % Plattform-Vorlage(n) chat_group_instruction nachgeschaerft.', v_platform;
END $$;
