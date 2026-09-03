-- 352 — Ein Buch, das nur die gelungenen Faelle kennt, ist kein Buch.
--
-- Am 03.09.2026 blieb eine Chatnachricht ohne Antwort. Die Suche nach dem
-- Grund lief ins Leere, und zwar nicht aus Zufall:
--
--   ai_usage_log        letzte Zeile 02.09. 18:56 UTC — nur Erfolge
--   ai_circuit_state    leer — der Automat hatte nicht ausgeloest
--   Behaelterprotokoll  mit dem Behaelter um 01:58 UTC geloescht
--
-- `_record_usage` in `backend/services/ai_utils.py` wird ausschliesslich NACH
-- einem gelungenen `agent.run` aufgerufen. Jede der vier Abbruchbahnen
-- (HTTP-Fehler, Zeitueberschreitung, Abbruch, gescheiterter Ausweichlauf)
-- endet in `logger.error` und `raise` — also in einem Strom, der beim
-- naechsten Deploy mit dem Behaelter verschwindet.
--
-- Damit war der Unterschied zwischen „es lief nichts" und „es scheiterte
-- alles" von aussen nicht zu sehen. Beides sieht aus wie eine leere Tabelle.
--
-- Diese Migration macht aus dem Erfolgsbuch ein VERSUCHSBUCH: eine Zeile je
-- Anlauf, mit dem Ausgang daneben. Der Inhalt der Uebermittlung bleibt
-- draussen — protokolliert wird, DASS und WIE etwas endete, nie WAS gesagt
-- wurde. `error_detail` ist auf 500 Zeichen begrenzt und traegt die Meldung
-- des Anbieters, nicht die Eingabe.

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS error_kind TEXT,
  ADD COLUMN IF NOT EXISTS error_detail TEXT;

-- Bestehende Zeilen sind per Bauart Erfolge — der Vorgabewert stimmt fuer sie.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_usage_log'::regclass AND conname = 'ai_usage_log_outcome_check'
  ) THEN
    ALTER TABLE ai_usage_log
      ADD CONSTRAINT ai_usage_log_outcome_check
      CHECK (outcome IN ('ok', 'http_error', 'timeout', 'cancelled', 'failed'));
  END IF;
END
$do$;

ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_error_detail_len CHECK (char_length(error_detail) <= 500)
  NOT VALID;

-- Ein Fehlschlag wird gesucht, nicht durchblaettert: der Teilindex traegt nur
-- die Ausnahmen, nicht die 604 gelungenen Zeilen daneben.
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_failures
  ON ai_usage_log (created_at DESC)
  WHERE outcome <> 'ok';

COMMENT ON COLUMN ai_usage_log.outcome IS
  'Ausgang des Anlaufs. ok = beantwortet; http_error = Anbieter antwortete mit '
  'Fehlercode; timeout = Zeitgrenze; cancelled = Aufrufer ging; failed = alles '
  'Uebrige. Nur ok-Zeilen tragen Token und Kosten.';
COMMENT ON COLUMN ai_usage_log.error_kind IS
  'Kurzform der Ursache: Ausnahmeklasse oder "HTTP <code>". Zum Gruppieren.';
COMMENT ON COLUMN ai_usage_log.error_detail IS
  'Meldung des Anbieters, auf 500 Zeichen gekuerzt. NIE Eingabe oder Antwort.';

-- Selbstpruefung: die Migration behauptet ihre eigene WIRKUNG, nicht den
-- Bestand der Plattform. Ein leeres ai_usage_log darf sie nicht rot faerben.
DO $check$
DECLARE
  v_cols INT;
  v_idx  INT;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_name = 'ai_usage_log' AND column_name IN ('outcome', 'error_kind', 'error_detail');
  IF v_cols <> 3 THEN
    RAISE EXCEPTION 'Migration 352: % von 3 Spalten angelegt', v_cols;
  END IF;

  SELECT count(*) INTO v_idx FROM pg_indexes
   WHERE tablename = 'ai_usage_log' AND indexname = 'idx_ai_usage_log_failures';
  IF v_idx <> 1 THEN
    RAISE EXCEPTION 'Migration 352: Teilindex auf die Fehlschlaege fehlt';
  END IF;

  IF EXISTS (SELECT 1 FROM ai_usage_log WHERE outcome IS NULL) THEN
    RAISE EXCEPTION 'Migration 352: Zeilen ohne Ausgang';
  END IF;
END
$check$;
