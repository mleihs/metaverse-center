-- ═══════════════════════════════════════════════════════════════════════════
-- 360 · Die Verdichtung bekommt eigene Regler
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Gehört zu 358 (Ablage) und 359 (Vorlage). Hier stehen die Zahlen.
--
-- ⚠ VORRANG: die ZEILE schlägt die Deklaration in `ai_purposes.py`. Ohne
-- diese Migration bliebe eine im Code geänderte Vorgabe auf jeder Datenbank
-- wirkungslos, die die Zeile schon hat — und `test_ai_purposes_migration.py`
-- besteht genau darauf. Dieselbe Begründung wie in 344.
--
-- ── Warum ein EIGENER Zweck und nicht `chat_response` ──────────────────────
--
--   Eine Verdichtung ist ein Bericht, kein Gesprächszug. Sie braucht ein
--   anderes Antwortbudget, ein längeres Zeitlimit (ihre Eingabe sind 40
--   Nachrichten statt einer), und sie soll in der Kostenauswertung getrennt
--   sichtbar sein.
--
--   Und sie darf nicht auf `model_default` fallen. Handoff
--   `denkmodell-als-standard-2026-09-02`: dort war das Vorgabemodell ein
--   Denkmodell, und 709 von 747 Aufrufen liefen unbemerkt teuer. Der eigene
--   Zweck ist die Schranke dagegen. `model_key` ist `chat`, die Verdichtung
--   folgt also demselben Modell wie der Chat (`model_chat`, seit 344
--   `deepseek/deepseek-v4-flash`).
--
-- ── DIE WERTE, UND WARUM ───────────────────────────────────────────────────
--
--   max_tokens 700    Die Vorlage verlangt höchstens 180 Wörter; 700 Token
--                     sind rund 500 deutsche Wörter. Das Budget hält also
--                     Luft und schneidet nicht mitten im Satz ab.
--
--                     ⚠ Ein GRÖSSERES Budget wäre hier schädlich und nicht
--                     nur teuer. Die Verdichtung geht in JEDEN folgenden Zug
--                     ein, bis zu acht Abschnitte gleichzeitig
--                     (`MAX_DIGESTS_IN_PROMPT`). 2 000 Token je Abschnitt
--                     wären 16 000 im System-Prompt und nähmen genau den
--                     Platz zurück, den die Verdichtung sparen soll. Das ist
--                     der seltene Fall, in dem die Obergrenze nach oben
--                     GEFÄHRLICH ist und nicht nach unten.
--
--   timeout 90        Statt der üblichen 60. Die Eingabe ist mit 40
--                     Nachrichten deutlich grösser als ein Gesprächszug, und
--                     der Lauf hängt an keiner Anfrage — er läuft im
--                     Hintergrund, nachdem die Antwort beim Menschen ist.
--
--   reasoning "off"   Aus demselben Grund wie bei `chat_response`
--                     (durchgesickerte `<think>`-Blöcke waren ein
--                     tatsächliches Problem), und hier kommt eines hinzu:
--                     eine durchgesickerte Gedankenkette in einer Verdichtung
--                     wäre DAUERHAFT. Sie wird gespeichert und nie wieder
--                     überschrieben — das ist die Bauform aus 358.
--
-- Wiederholbar: ON CONFLICT DO NOTHING lässt jede Anpassung eines Betreibers
-- stehen.

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('max_tokens_chat_digest', '700'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''chat_digest'' (die abschnittweise Verdichtung eines Gespraechs). Voreinstellung 700. Nach OBEN gefaehrlich: die Verdichtung geht in jeden folgenden Zug ein, bis zu acht Abschnitte gleichzeitig.'),
  ('timeout_chat_digest', '90'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''chat_digest''. Voreinstellung 90 statt der ueblichen 60: die Eingabe sind 40 Nachrichten, und der Lauf haengt an keiner Anfrage.'),
  ('reasoning_chat_digest', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''chat_digest''. off | minimal | low | medium | high | xhigh | auto. Abgeschaltet: eine durchgesickerte Gedankenkette waere hier DAUERHAFT, weil eine Verdichtung gespeichert und nie wieder ueberschrieben wird.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung: die drei Schlüssel existieren und tragen einen
-- Wert. Kein Wort über die übrige Plattform.
DO $$
DECLARE
  v_keys int;
BEGIN
  SELECT count(*) INTO v_keys FROM platform_settings
  WHERE setting_key IN ('max_tokens_chat_digest', 'timeout_chat_digest', 'reasoning_chat_digest')
    AND setting_value IS NOT NULL;
  IF v_keys <> 3 THEN
    RAISE EXCEPTION '360: % von 3 Reglern gesetzt', v_keys;
  END IF;
  RAISE NOTICE '360: drei Regler fuer chat_digest.';
END $$;
