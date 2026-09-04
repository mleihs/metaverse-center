-- ═══════════════════════════════════════════════════════════════════════════
-- 358 · Ein Faden erinnert sich abschnittweise
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DAS PROBLEM, wörtlich vom Nutzer (Wortlaut nicht wiedergegeben)
--
-- Er hat recht, aber nicht ganz aus dem Grund, den man vermutet, und der
-- Unterschied entscheidet über die Bauform.
--
-- ── Was die Forschung dazu sagt ────────────────────────────────────────────
--
-- 1. PERSONA-DRIFT IST KEIN FENSTERPROBLEM.
--    „Persistent Personas? Role-Playing, Instruction Following, and Safety in
--    Extended Interactions" (arXiv:2512.12775, EACL 2026) misst den Verfall
--    der Figurentreue über 100+ Züge und findet ihn INNERHALB des Fensters —
--    er tritt auf, wenn gar nichts abgeschnitten wird. Mehr Verlauf
--    mitzuschicken ist also nicht die Antwort. Was hilft, ist ein Block, der
--    JEDEN Zug neu eingespritzt wird.
--
-- 2. WÖRTLICHE AUSSCHNITTE SCHLAGEN EXTRAHIERTE FAKTEN.
--    „Verbatim Chunks Beat Extracted Artifacts" (arXiv:2601.00821, 2026,
--    kontrollierte Ablation) misst auf LoCoMo 43,9 % gegen 28,0 % und auf
--    LongMemEval-S 67,4 % gegen 45,4 %. Die Empfehlung ist die VEREINIGUNG,
--    nicht das eine statt des anderen. `agent_memories` ist reine Extraktion;
--    diese Tabelle ist die andere Hälfte.
--
-- 3. REKURSIVES ZUSAMMENFASSEN HÄUFT FEHLER AN.
--    Seit „Recursively Summarizing Enables Long-Term Dialogue Memory"
--    (arXiv:2308.15022) ist das Muster verbreitet, Zusammenfassung und neue
--    Züge immer wieder zu einer neuen Zusammenfassung zu falten. Die
--    dokumentierte Schwäche: der Verdichter behandelt seine EIGENE frühere
--    Ausgabe als Grundwahrheit. Ein einmal falsch gesagter Satz überlebt jede
--    weitere Runde und wird dabei bestätigt.
--
-- ── Was daraus folgt: ABSCHNITTE, KEINE REKURSION ──────────────────────────
--
--   Der Faden zerfällt in Abschnitte fester Länge. Jeder Abschnitt wird
--   GENAU EINMAL verdichtet, aus SEINEN EIGENEN Nachrichten, und danach nie
--   wieder angefasst. Es gibt keinen Pfad, auf dem eine Verdichtung eine
--   andere liest.
--
--   Damit ist Punkt 3 nicht gemildert, sondern ausgeschlossen: jede Zeile
--   dieser Tabelle hat genau eine Erzeugung aus dem Urtext hinter sich.
--
--   Nebenwirkung, und keine kleine: die Kosten sind endlich. Ein Faden mit
--   329 Nachrichten kostet acht einmalige Aufrufe, nicht einen mit jedem Zug
--   wachsenden Schleppzug. Gemessen an ai_usage_log lag der Chat zuletzt bei
--   21 940 Eingabe-Token je Aufruf.
--
-- ── Warum eine Zeile je Abschnitt und keine Spalte am Gespräch ─────────────
--
--   Eine einzelne `digest`-Spalte müsste bei jedem Wachstum überschrieben
--   werden — und ein Überschreiben aus dem eigenen alten Wert IST die
--   Rekursion aus Punkt 3. Getrennte, unveränderliche Zeilen machen sie
--   baulich unmöglich, statt sie nur zu verbieten.
--
--   `UNIQUE (conversation_id, segment_index)` ist die Stelle, an der zwei
--   gleichzeitige Läufe sich begegnen: der zweite bekommt 23505 und lässt es
--   dabei bewenden. Kein Zählerstand, kein Sperrsatz.

CREATE TABLE IF NOT EXISTS public.chat_conversation_digests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,

    -- Der wievielte Abschnitt des Fadens, ab 0. Die Abschnittslänge steht im
    -- Dienst (`ConversationDigestService.SEGMENT_SIZE`) und NICHT hier: sie
    -- ist eine Abwägung zwischen Kosten und Auflösung, keine Eigenschaft der
    -- Ablage. Die Grenzen jeder Zeile stehen ohnehin unten in `covers_*`,
    -- also bleibt eine geänderte Länge lesbar statt zweideutig.
    segment_index   int  NOT NULL CHECK (segment_index >= 0),

    -- Welche Nachrichten drinstecken. Zeitstempel und nicht IDs: die Auswahl
    -- lief ohnehin über `created_at`, und ein Zeitraum ist ohne Nachschlagen
    -- lesbar.
    covers_from     timestamptz NOT NULL,
    covers_to       timestamptz NOT NULL,
    message_count   int  NOT NULL CHECK (message_count > 0),

    summary         text NOT NULL CHECK (length(trim(summary)) > 0),
    locale          text NOT NULL DEFAULT 'de',
    model           text,

    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chat_conversation_digests_segment_unique
        UNIQUE (conversation_id, segment_index),
    CONSTRAINT chat_conversation_digests_range_check
        CHECK (covers_to >= covers_from)
);

COMMENT ON TABLE public.chat_conversation_digests IS
  'Die verdichtete Vorgeschichte eines Fadens, abschnittweise. Jede Zeile wird genau einmal aus ihren eigenen Nachrichten erzeugt und danach nie wieder angefasst — keine Verdichtung liest eine andere. Siehe Migration 358.';

CREATE INDEX IF NOT EXISTS idx_chat_conversation_digests_lookup
  ON chat_conversation_digests (conversation_id, segment_index);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Eine Verdichtung ist der Inhalt des Gesprächs in kürzerer Form. Sie ist
-- deshalb genauso schützenswert wie die Nachrichten selbst und hängt an
-- derselben Besitzerschaft. Kein `anon`, keine Weltrolle: der Faden gehört
-- seinem Besitzer.
ALTER TABLE public.chat_conversation_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conversation_digests_owner_read ON public.chat_conversation_digests;
CREATE POLICY chat_conversation_digests_owner_read
  ON public.chat_conversation_digests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_conversation_digests.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

-- KEINE Schreibrichtlinie für `authenticated`. Verdichtungen entstehen im
-- Dienst über den service_role-Client; ein Mensch, der seine eigene
-- Vorgeschichte umschreiben kann, kann dem Modell eine Geschichte
-- unterschieben, die nie stattgefunden hat.

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene WIRKUNG. Kein Wort über den Inhalt der Plattform: auf
-- einer frischen Datenbank gibt es keine Gespräche, und die Prüfung besteht
-- trotzdem.
DO $$
DECLARE
  v_spalten  int;
  v_unique   int;
  v_rls      boolean;
  v_policies int;
  v_anon     int;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_name = 'chat_conversation_digests';
  IF v_spalten <> 10 THEN
    RAISE EXCEPTION '358: % Spalten statt 10', v_spalten;
  END IF;

  SELECT count(*) INTO v_unique FROM pg_constraint
  WHERE conname = 'chat_conversation_digests_segment_unique';
  IF v_unique <> 1 THEN
    RAISE EXCEPTION '358: der Eindeutigkeitszwang auf (conversation_id, segment_index) fehlt — ohne ihn koennen zwei gleichzeitige Laeufe denselben Abschnitt doppelt verdichten';
  END IF;

  SELECT relrowsecurity INTO v_rls FROM pg_class
  WHERE oid = 'public.chat_conversation_digests'::regclass;
  IF NOT v_rls THEN
    RAISE EXCEPTION '358: RLS ist nicht eingeschaltet';
  END IF;

  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE tablename = 'chat_conversation_digests';
  IF v_policies <> 1 THEN
    RAISE EXCEPTION '358: % Richtlinien statt genau einer (nur Lesen fuer den Besitzer)', v_policies;
  END IF;

  -- `anon` darf hier nichts. Das ist die Zusicherung, die zaehlt, und sie
  -- wird gemessen statt behauptet.
  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
  WHERE table_name = 'chat_conversation_digests' AND grantee = 'anon';
  IF v_anon > 0 THEN
    RAISE EXCEPTION '358: anon haelt % Recht(e) auf die Verdichtungen', v_anon;
  END IF;

  RAISE NOTICE '358: Tabelle, Eindeutigkeitszwang, RLS mit einer Leserichtlinie, anon ohne Recht.';
END $$;
