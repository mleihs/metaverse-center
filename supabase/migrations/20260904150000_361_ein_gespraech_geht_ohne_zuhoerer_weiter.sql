-- ═══════════════════════════════════════════════════════════════════════════
-- 361 · Ein Gespräch geht ohne Zuhörer weiter
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Das Merkmalstor, die Vorlage und die Regler für die Phase, die Migration 357
-- vorbereitet hat.
--
-- ── DAS TOR STEHT AUF AUS ──────────────────────────────────────────────────
--
--   Eine Phase, die Modellaufrufe erzeugt, darf nicht dadurch anlaufen, dass
--   jemand vergessen hat, sie abzuschalten. `ContinuationService._gate_open`
--   liest fail-closed: FEHLT die Zeile, ist das Tor ZU. Die Zeile wird hier
--   trotzdem angelegt, und ausdrücklich auf `false` — ein Tor ohne Zeile
--   erscheint in der Verwaltung als „nicht gesetzt", und ein Admin muss den
--   Unterschied zwischen „aus" und „unbekannt" nicht raten müssen.
--
-- ── DIE VORLAGE SCHREIBT EINE SZENE, KEINE PERSON ──────────────────────────
--
--   Anders als im Chat schreibt hier EIN Modell alle Stimmen. Das ist der
--   genaue Gegensatz zu dem, was Migration 356 gerade hergestellt hat, und
--   zwar mit Absicht: dort antwortet eine Figur, hier entsteht eine Szene.
--
--   Deshalb hängt alles an der Form. Die Zuordnung geschieht NACH dem Aufruf,
--   über den gemeldeten Sprechernamen; ein Zug, dessen Sprecher nicht zur
--   Besetzung gehört, wird verworfen und nicht geraten. Ein falsch
--   zugeordneter Zug stünde für immer unter dem Namen einer Figur, die ihn
--   nie gesagt hat.
--
--   Der Rahmen im Vertrag (`_FRAME_CONTINUATION`) trägt beide Zusagen, die
--   eine Welt nicht wegschreiben darf: die JSON-Form, und dass der Mensch
--   NICHT anwesend ist. Ein Wortwechsel, der ihn anspricht, behauptet eine
--   Anwesenheit, die es nicht gab.
--
-- ── DIE REGLER ─────────────────────────────────────────────────────────────
--
--   max_tokens 1200  Vier Züge von je rund 200 deutschen Wörtern plus die
--                    JSON-Hülle. Weniger schnitte den letzten Zug ab — und
--                    ein abgeschnittener Zug macht die GANZE Antwort
--                    unparsbar. Anders als bei `chat_response`, wo ein zu
--                    kurzer Text immer noch ein Text ist.
--   timeout 90       Der Lauf hängt am Herzschlag, nicht an einer Anfrage.
--   reasoning "off"  Ein Denkblock im JSON macht es unparsbar: der Aufruf ist
--                    bezahlt und das Ergebnis unbrauchbar.
--
-- ⚠ VORRANG: die ZEILE schlägt die Deklaration in `ai_purposes.py`. Ohne
-- diese Migration bliebe eine im Code geänderte Vorgabe auf jeder Datenbank
-- wirkungslos, die die Zeile schon hat. Dieselbe Begründung wie in 344.

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('agent_continuation_enabled', 'false'::jsonb, 'Ob Agenten in Gespraechen, deren Besitzer es eingeschaltet hat, ohne ihn weiterreden duerfen. Vorgabe AUS. Fehlt die Zeile, liest der Dienst ebenfalls AUS (fail-closed).'),
  ('max_tokens_agent_continuation', '1200'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''agent_continuation''. Traegt 2-4 Zuege plus JSON-Huelle. Zu wenig schneidet den letzten Zug ab und macht die GANZE Antwort unparsbar.'),
  ('timeout_agent_continuation', '90'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''agent_continuation''. Der Lauf haengt am Herzschlag, nicht an einer Anfrage.'),
  ('reasoning_agent_continuation', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''agent_continuation''. off | minimal | low | medium | high | xhigh | auto. Abgeschaltet: ein Denkblock im JSON macht es unparsbar.')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO prompt_templates (template_type, prompt_category, locale, template_name, prompt_content, is_system_default, is_active)
VALUES
  ('chat_continuation', 'chat', 'en', 'Conversation Continuation (EN)',
   E'These characters are talking among themselves: {participant_names}.\n\n--- WHO THEY ARE ---\n{agent_profiles}\n--- END ---\n\n{conversation_digest}\n\n--- HOW THE CONVERSATION STANDS ---\n{recent_transcript}\n--- END ---\n\nWrite what happens next between them, in {locale_name}: {turn_count} turns.\n\nThey pick up where the transcript leaves off, in the register that has settled in between them. Something should move: a question asked, a thing admitted, a disagreement, a small decision. Not a summary of what they already said, and not a neat ending.',
   true, true),
  ('chat_continuation', 'chat', 'de', 'Gespraechs-Fortsetzung (DE)',
   E'Diese Figuren reden unter sich: {participant_names}.\n\n--- WER SIE SIND ---\n{agent_profiles}\n--- ENDE ---\n\n{conversation_digest}\n\n--- WIE DAS GESPRAECH STEHT ---\n{recent_transcript}\n--- ENDE ---\n\nSchreibe, was als naechstes zwischen ihnen geschieht, auf {locale_name}: {turn_count} Zuege.\n\nSie knuepfen dort an, wo die Mitschrift aufhoert, im Ton, der sich zwischen ihnen eingespielt hat. Etwas soll sich bewegen: eine Frage, ein Eingestaendnis, ein Widerspruch, eine kleine Entscheidung. Keine Zusammenfassung des schon Gesagten, und kein sauberer Abschluss.',
   true, true)
ON CONFLICT DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung. Die wichtigste Zusage zuerst: das Tor steht auf
-- AUS. Eine Migration, die eine kostenpflichtige Phase versehentlich
-- scharfstellte, wäre der teuerste Tippfehler dieses Werks.
DO $$
DECLARE
  v_tor    jsonb;
  v_regler int;
  v_vorlag int;
BEGIN
  SELECT setting_value INTO v_tor FROM platform_settings
  WHERE setting_key = 'agent_continuation_enabled';
  IF v_tor IS NULL THEN
    RAISE EXCEPTION '361: das Merkmalstor wurde nicht angelegt';
  END IF;
  IF v_tor <> 'false'::jsonb THEN
    -- KEIN Fehler: laeuft die Migration auf einer Datenbank, auf der ein
    -- Admin das Tor schon geoeffnet hat, ist das seine Entscheidung, und
    -- ON CONFLICT DO NOTHING hat sie zu Recht stehen lassen. Gesagt wird es
    -- trotzdem.
    RAISE NOTICE '361: das Merkmalstor stand schon auf % und wurde nicht angetastet.', v_tor;
  END IF;

  SELECT count(*) INTO v_regler FROM platform_settings
  WHERE setting_key IN ('max_tokens_agent_continuation', 'timeout_agent_continuation', 'reasoning_agent_continuation')
    AND setting_value IS NOT NULL;
  IF v_regler <> 3 THEN
    RAISE EXCEPTION '361: % von 3 Reglern gesetzt', v_regler;
  END IF;

  SELECT count(*) INTO v_vorlag FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_continuation'
    AND prompt_content LIKE '%{participant_names}%'
    AND prompt_content LIKE '%{agent_profiles}%'
    AND prompt_content LIKE '%{conversation_digest}%'
    AND prompt_content LIKE '%{recent_transcript}%'
    AND prompt_content LIKE '%{locale_name}%'
    AND prompt_content LIKE '%{turn_count}%'
    AND prompt_content NOT LIKE '%{{%';
  IF v_vorlag <> 2 THEN
    RAISE EXCEPTION '361: nur % von 2 Vorlagen tragen alle sechs Platzhalter in der richtigen Schreibweise', v_vorlag;
  END IF;

  RAISE NOTICE '361: Tor angelegt (aus), drei Regler, zwei Vorlagen mit sechs Platzhaltern.';
END $$;
