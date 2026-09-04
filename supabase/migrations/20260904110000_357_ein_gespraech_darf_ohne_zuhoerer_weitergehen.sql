-- ═══════════════════════════════════════════════════════════════════════════
-- 357 · Ein Gespräch darf ohne Zuhörer weitergehen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Wer mit zwei Agenten redet und den Browser schliesst, kommt in einen Faden
-- zurück, in dem seit seinem letzten Satz nichts geschehen ist. Diese drei
-- Spalten sind der Griff, mit dem man das je GESPRÄCH ändert — nicht je Welt
-- und nicht je Konto.
--
-- ── Warum STUNDEN und keine Stufenzahl ─────────────────────────────────────
--   Der erste Entwurf hatte `continue_frequency SMALLINT` mit 0–3 als
--   „Wortwechsel je Takt". Zwei Fehler darin:
--
--   1. Eine Zahl von 0 bis 3 sagt niemandem, was sie bedeutet. Wer in einem
--      Jahr in diese Tabelle sieht, braucht eine Übersetzungstabelle, die
--      irgendwo im Frontend steht. `12` sagt zwölf Stunden.
--   2. „Je Takt" hängt am Takt. Ein Admin, der `heartbeat_interval_seconds`
--      von vier auf acht Stunden stellt, halbiert damit stillschweigend jede
--      Einstellung jedes Gesprächs auf der Plattform.
--
--   Gespeichert wird deshalb der MINDESTABSTAND in Stunden. Fünf Werte, weil
--   ein Regler mit benannten Rasten fünf gut trägt und zehn nicht:
--
--        4 h   rege          jeder Takt
--        6 h   oft
--       12 h   regelmässig   Vorgabe
--       24 h   gelegentlich
--       48 h   selten
--
--   ⚠ Die WIRKLICHE Kadenz ist `max(continue_interval_hours, Taktlänge)`.
--   Der Heartbeat schlägt vorgabemäss alle 4 h (Minimum 2 h,
--   `heartbeat_service._DEFAULT_INTERVAL`), und feiner als der Takt kann
--   nichts werden. „Rege = 4 h" trifft deshalb genau die Vorgabe; stellt ein
--   Admin den Takt auf 8 h, sind alle fünf Stufen bis 8 h einander gleich.
--   Das steht so auch am Regler, damit die Zahl nicht lügt.
--
-- ── Warum KEINE eigene Spalte für „zuletzt weitergeredet" ──────────────────
--   `last_message_at` wird vom Trigger aus 20260215000009 bei jeder Nachricht
--   gesetzt — auch bei denen des Wortwechsels. Der Abstand misst sich daran
--   von selbst, und er hat eine zweite, erwünschte Wirkung: schreibt der
--   Mensch selbst etwas, ist die Uhr zurückgestellt. Wer da ist, braucht
--   keine Agenten, die ohne ihn reden.
--
-- ── Warum CHECK-Beschränkungen ─────────────────────────────────────────────
--   Anders als bei `platform_settings` (Schlüssel-Wert, 355) sind das echte
--   Spalten mit einem geschlossenen Wertebereich. Die Schranke gehört hierher;
--   der Router prüft zusätzlich, weil eine 400er-Antwort besser ist als ein
--   23514 aus der Tiefe.

ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS continues_without_user  BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS continue_notify         TEXT     NOT NULL DEFAULT 'digest',
  ADD COLUMN IF NOT EXISTS continue_interval_hours SMALLINT NOT NULL DEFAULT 12;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_continue_notify_check') THEN
    ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_continue_notify_check
      CHECK (continue_notify IN ('never', 'app', 'digest', 'immediate'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_continue_interval_check') THEN
    ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_continue_interval_check
      CHECK (continue_interval_hours IN (4, 6, 12, 24, 48));
  END IF;
END $$;

COMMENT ON COLUMN chat_conversations.continues_without_user IS
  'Ob die Agenten dieses Fadens in Abwesenheit des Menschen miteinander weiterreden duerfen. Greift nur, wenn das Merkmalstor agent_continuation_enabled offen ist und der Faden nicht verschlossen ist.';
COMMENT ON COLUMN chat_conversations.continue_notify IS
  'Wie der Mensch davon erfaehrt: never | app (nur die Whisper-Karte) | digest (Abschnitt in der Wochenpost) | immediate (eigene Mail).';
COMMENT ON COLUMN chat_conversations.continue_interval_hours IS
  'Mindestabstand zwischen zwei Wortwechseln in Stunden: 4 | 6 | 12 | 24 | 48. Die wirkliche Kadenz ist max(dieser Wert, Heartbeat-Taktlaenge).';

-- Die Abfrage der Phase lautet „welche Faeden reden weiter" — und das sind
-- wenige. Ein Teilindex traegt deshalb nur die, die es angeht, statt die
-- ganze Tabelle.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_continues
  ON chat_conversations (simulation_id, last_message_at)
  WHERE continues_without_user AND NOT locked;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene WIRKUNG: stehen die drei Spalten da, tragen sie die
-- richtigen Vorgabewerte, greifen beide Schranken, ist der Teilindex da.
-- Kein Wort über den Inhalt der Plattform — die Prüfung besteht auf einer
-- leeren Datenbank genauso wie auf der vollen.
DO $$
DECLARE
  v_spalten int;
  v_check   int;
  v_index   int;
  v_default text;
  v_defn    text;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_name = 'chat_conversations'
    AND column_name IN ('continues_without_user', 'continue_notify', 'continue_interval_hours');
  IF v_spalten <> 3 THEN
    RAISE EXCEPTION '357: % von 3 Spalten angelegt', v_spalten;
  END IF;

  SELECT column_default INTO v_default FROM information_schema.columns
  WHERE table_name = 'chat_conversations' AND column_name = 'continue_interval_hours';
  IF v_default IS NULL OR v_default NOT LIKE '12%' THEN
    RAISE EXCEPTION '357: Vorgabewert fuer continue_interval_hours ist %, erwartet 12', v_default;
  END IF;

  SELECT count(*) INTO v_check FROM pg_constraint
  WHERE conname IN ('chat_conversations_continue_notify_check',
                    'chat_conversations_continue_interval_check');
  IF v_check <> 2 THEN
    RAISE EXCEPTION '357: % von 2 Schranken vorhanden', v_check;
  END IF;

  SELECT count(*) INTO v_index FROM pg_indexes
  WHERE tablename = 'chat_conversations' AND indexname = 'idx_chat_conversations_continues';
  IF v_index <> 1 THEN
    RAISE EXCEPTION '357: Teilindex fehlt';
  END IF;

  -- Die Schranke muss auch die RICHTIGEN Werte tragen, nicht nur dastehen.
  -- Eine Zaehlung von zwei Schranken ist ein Haken ohne Deckung, solange
  -- niemand hineingesehen hat: `CHECK (continue_interval_hours IN (4))` waere
  -- ebenfalls „vorhanden".
  --
  -- Geprueft wird die Definition und nicht ein Probe-INSERT: auf
  -- `chat_conversations` liegen Fremdschluessel auf `simulation_id` und
  -- `user_id`, die vor jeder CHECK zuschlagen. Eine Probe, die immer am
  -- Fremdschluessel scheitert, beweist ueber die Schranke nichts.
  SELECT pg_get_constraintdef(oid) INTO v_defn FROM pg_constraint
  WHERE conname = 'chat_conversations_continue_interval_check';
  IF v_defn IS NULL
     OR v_defn NOT LIKE '%4%' OR v_defn NOT LIKE '%6%' OR v_defn NOT LIKE '%12%'
     OR v_defn NOT LIKE '%24%' OR v_defn NOT LIKE '%48%' THEN
    RAISE EXCEPTION '357: Stundenschranke traegt nicht alle fuenf Stufen: %', v_defn;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_defn FROM pg_constraint
  WHERE conname = 'chat_conversations_continue_notify_check';
  IF v_defn IS NULL
     OR v_defn NOT LIKE '%never%' OR v_defn NOT LIKE '%app%'
     OR v_defn NOT LIKE '%digest%' OR v_defn NOT LIKE '%immediate%' THEN
    RAISE EXCEPTION '357: Meldeschranke traegt nicht alle vier Wege: %', v_defn;
  END IF;

  RAISE NOTICE '357: drei Spalten, zwei Schranken, ein Teilindex.';
END $$;
