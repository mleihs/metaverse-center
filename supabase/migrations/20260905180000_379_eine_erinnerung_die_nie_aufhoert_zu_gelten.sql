-- ═══════════════════════════════════════════════════════════════════════════
-- 379 · Eine Erinnerung, die nie aufhört zu gelten
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER BEFUND ─────────────────────────────────────────────────────────────
--
--   `agent_memories` hat zwölf Spalten. KEINE davon sagt, wie lange etwas
--   gilt, ob es überholt ist oder ob es fallengelassen werden darf:
--
--       id · agent_id · simulation_id · memory_type · content · content_de ·
--       importance · source_type · source_id · embedding · created_at ·
--       last_accessed_at
--
--   `last_accessed_at` ist die einzige zeitliche Spalte neben `created_at`,
--   und sie wird geschrieben, aber nirgends gelesen: `retrieve_agent_memories`
--   (Migration 067, zuletzt 342) rangiert nach Ähnlichkeit, Wichtigkeit und
--   FRISCHE — nicht nach Zugriff. Nichts in diesem Werk lässt je etwas fallen.
--
--   Der Dienst ist Stanford-„Generative Agents"-Bauart von 2023. Die Kritik an
--   dieser Bauart trifft genau die übernommenen Punkte: ein Gedächtnis ohne
--   Gültigkeit häuft Widersprüche an, statt sie aufzulösen. „X ist Archivarin"
--   und „X ist nicht mehr Archivarin" stehen dann nebeneinander im selben
--   Prompt, beide mit vollem Gewicht, und das Modell wählt.
--
--   Migration 373 hat die Zweischichtigkeit gebracht: WESSEN Erinnerung es
--   ist. Diese hier ergänzt sie um die zweite Frage — WIE LANGE sie gilt.
--
-- ── ZWEI SPALTEN, ZWEI VERSCHIEDENE DINGE ──────────────────────────────────
--
--   `valid_until`    Das Ende des Gültigkeitsfensters. „X war Archivarin, bis
--                    Mai." Der Satz bleibt WAHR — als Vergangenheit. Er darf
--                    deshalb weiter abgerufen werden, aber nicht mehr als
--                    Gegenwart gelesen.
--
--   `superseded_by`  Diese Erinnerung wurde von einer ANDEREN überholt. Sie
--                    fällt aus dem Abruf, weil ihre Nachfolgerin dieselbe
--                    Frage beantwortet: beide zugleich im Prompt hiessen, dem
--                    Modell eine Tatsache und ihren Widerruf nebeneinander zu
--                    geben.
--
--   Der Unterschied ist nicht akademisch. Ein abgelaufenes Fenster VERSCHIEBT
--   eine Erinnerung in die Vergangenheit; ein Nachfolger ERSETZT sie. Eine
--   Spalte für beides hiesse, den Unterschied unsichtbar zu machen — dieselbe
--   Falle wie „zwei Rollen, ein Vorgabewert".
--
--   GELÖSCHT WIRD NICHTS. Vergessen heisst hier: nicht mehr als Gegenwart
--   abgerufen werden. Eine Zeile wegzuwerfen nähme dem Werk seine Geschichte,
--   und ein Gedächtnis, das Vergangenes nicht mehr benennen kann, ist ärmer
--   als eines, das zu viel behält.
--
-- ── EINE RPC, WEIL ES ZWEI SCHREIBVORGÄNGE SIND ────────────────────────────
--
--   `fn_supersede_memory` setzt Nachfolger UND Fensterende in EINER Anweisung
--   und prüft dabei, dass beide Erinnerungen derselben Figur gehören und dass
--   keine sich selbst überholt. In Python wäre das lesen-rechnen-schreiben mit
--   einem Fenster dazwischen (ADR-007).
--
-- ── WAS DIESE MIGRATION NICHT TUT ──────────────────────────────────────────
--
--   Sie baut KEINEN Erkenner für Widersprüche. Der brauchte einen
--   Modellaufruf, und ob ein Werk seine Figuren vergessen lassen WILL, ist
--   eine Entscheidung des Menschen und nicht dieser Migration. Was hier
--   entsteht, ist der Weg: die Spalten, die Prüfungen, der Abruf, der sie
--   achtet, und eine Dienstmethode, die ihn geht.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS valid_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.agent_memories(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agent_memories.valid_until IS
  'Ende des Gueltigkeitsfensters. NULL = gilt weiter. Ist es vergangen, wird die Erinnerung WEITER abgerufen, aber als Vergangenheit gerendert und geringer gewichtet — „X war Archivarin, bis …" bleibt wahr. Siehe Migration 379.';
COMMENT ON COLUMN public.agent_memories.superseded_by IS
  'Die Erinnerung, die diese ueberholt hat. Ist sie gesetzt, faellt diese Zeile aus dem Abruf: beide zugleich im Prompt hiessen, dem Modell eine Tatsache und ihren Widerruf nebeneinander zu geben. Die Zeile bleibt stehen. Siehe Migration 379.';

-- Der Abruf filtert auf `superseded_by IS NULL`; ohne Index ist das ein
-- Sequenzdurchlauf ueber alle Erinnerungen einer Figur. Teilindex, weil die
-- ueberholten die Ausnahme sind und ein voller Index sie mitschleppte.
CREATE INDEX IF NOT EXISTS idx_agent_memories_gueltig
  ON public.agent_memories (agent_id)
  WHERE superseded_by IS NULL;

-- ── Die Ueberholung, atomar ────────────────────────────────────────────────
--
-- SECURITY INVOKER: die Funktion darf nichts koennen, was die Aufruferin nicht
-- darf. Eine SECURITY-DEFINER-Funktion waere hier ein offenes Tor an der
-- FastAPI-Rollenpruefung vorbei (ADR-006), und sie braucht die erhoehten
-- Rechte nicht — RLS auf `agent_memories` traegt die Entscheidung schon.
CREATE OR REPLACE FUNCTION public.fn_supersede_memory(
  p_old_id      UUID,
  p_new_id      UUID DEFAULT NULL,
  p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (id UUID, valid_until TIMESTAMPTZ, superseded_by UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_alt_agent UUID;
  v_neu_agent UUID;
BEGIN
  IF p_old_id IS NULL THEN
    RAISE EXCEPTION 'fn_supersede_memory: ohne Erinnerung gibt es nichts zu ueberholen';
  END IF;
  IF p_new_id = p_old_id THEN
    RAISE EXCEPTION 'fn_supersede_memory: eine Erinnerung kann sich nicht selbst ueberholen';
  END IF;

  SELECT m.agent_id INTO v_alt_agent FROM agent_memories m WHERE m.id = p_old_id;
  IF v_alt_agent IS NULL THEN
    RAISE EXCEPTION 'fn_supersede_memory: Erinnerung % gibt es nicht (oder sie ist nicht sichtbar)', p_old_id;
  END IF;

  -- Eine fremde Erinnerung zu ueberholen hiesse, in ein anderes Gedaechtnis
  -- zu schreiben. Genau die Grenze, die Migration 373 gezogen hat.
  IF p_new_id IS NOT NULL THEN
    SELECT m.agent_id INTO v_neu_agent FROM agent_memories m WHERE m.id = p_new_id;
    IF v_neu_agent IS NULL THEN
      RAISE EXCEPTION 'fn_supersede_memory: Nachfolgerin % gibt es nicht', p_new_id;
    END IF;
    IF v_neu_agent <> v_alt_agent THEN
      RAISE EXCEPTION 'fn_supersede_memory: die Nachfolgerin gehoert einer anderen Figur';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE agent_memories m
     SET superseded_by = COALESCE(p_new_id, m.superseded_by),
         -- Ohne ausdrueckliches Fensterende gilt der Zeitpunkt der
         -- Ueberholung. Eine Erinnerung, die ersetzt wurde und trotzdem
         -- „gilt weiter" saehe, waere ein halb geschriebener Zustand.
         valid_until = COALESCE(p_valid_until, m.valid_until, now())
   WHERE m.id = p_old_id
  RETURNING m.id, m.valid_until, m.superseded_by;
END $$;

COMMENT ON FUNCTION public.fn_supersede_memory(UUID, UUID, TIMESTAMPTZ) IS
  'Markiert eine Erinnerung als ueberholt und setzt ihr Fensterende — beides in EINER Anweisung, mit Pruefung auf Selbstbezug und fremdes Gedaechtnis. SECURITY INVOKER: RLS entscheidet. Siehe Migration 379, ADR-006 und ADR-007.';

-- ── Der Abruf achtet die Gueltigkeit ───────────────────────────────────────
--
-- DROP und CREATE, nicht CREATE OR REPLACE: die Funktion bekommt eine neue
-- Rueckgabespalte (`expired`), und PostgreSQL weigert sich mit 42P13, den
-- Rueckgabetyp einer bestehenden Funktion zu aendern.
DROP FUNCTION IF EXISTS public.retrieve_agent_memories(UUID, extensions.vector, INT);

CREATE FUNCTION public.retrieve_agent_memories(
  p_agent_id UUID,
  p_query_embedding extensions.vector(1536) DEFAULT NULL,
  p_top_k INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, memory_type memory_type, content TEXT, content_de TEXT,
  importance INT, source_type memory_source_type, created_at TIMESTAMPTZ,
  retrieval_score FLOAT, expired BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    m.id, m.memory_type, m.content, m.content_de,
    m.importance, m.source_type, m.created_at,
    (
      (
        CASE
          WHEN p_query_embedding IS NULL OR m.embedding IS NULL THEN 0
          -- Unbrauchbarer Abstand (Nullvektor auf einer der beiden Seiten):
          -- zählt wie „keine Einbettung", statt alles andere zu verdrängen
          -- (Migration 342).
          WHEN (m.embedding <=> p_query_embedding) = 'NaN'::FLOAT8 THEN 0
          ELSE 0.4 * (1 - (m.embedding <=> p_query_embedding))
        END
        + 0.4 * (m.importance::float / 10.0)
        + 0.2 * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - m.created_at)) / 86400.0))
      )
      -- Vergangenes wiegt halb. Nicht null: „X war Archivarin" ist eine
      -- richtige Erinnerung und darf gegen eine belanglose aktuelle noch
      -- gewinnen. Nicht voll: sonst verdraengt die Vergangenheit die
      -- Gegenwart, und das ist der Fehler, den diese Migration behebt.
      * CASE WHEN m.valid_until IS NOT NULL AND m.valid_until <= now() THEN 0.5 ELSE 1 END
    )::FLOAT AS retrieval_score,
    (m.valid_until IS NOT NULL AND m.valid_until <= now()) AS expired
  FROM agent_memories m
  WHERE m.agent_id = p_agent_id
    -- Ueberholte fallen ganz heraus. Ihre Nachfolgerin beantwortet dieselbe
    -- Frage; beide zugleich hiessen, dem Modell eine Tatsache und ihren
    -- Widerruf nebeneinander zu geben und es waehlen zu lassen.
    AND m.superseded_by IS NULL
  ORDER BY retrieval_score DESC
  LIMIT p_top_k;
$$;

COMMENT ON FUNCTION public.retrieve_agent_memories(UUID, extensions.vector, INT) IS
  'Abruf nach Aehnlichkeit (0,4) + Wichtigkeit (0,4) + Frische (0,2), halbiert fuer abgelaufene Gueltigkeit, ohne ueberholte Zeilen. Ein unbrauchbarer Abstand (NaN durch Nullvektor) zaehlt wie keine Einbettung (Migration 342). `expired` sagt der Aufruferin, ob sie eine Vergangenheit rendert (Migration 379).';

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Gegen die eigene WIRKUNG, und mit einer Probe, die ihre eigene BEDINGUNG
-- HERSTELLT: die zwei Erinnerungen unten werden angelegt, ueberholt, gemessen
-- und wieder entfernt. Eine Pruefung, die auf vorhandene Daten wartet, besteht
-- auf einer leeren Datenbank muehelos und misst nichts — dieselbe Fehlerklasse
-- hat heute schon dreimal zugeschlagen.
DO $$
DECLARE
  v_spalten   int;
  v_fn        int;
  v_secdef    boolean;
  v_ret       int;
  v_index     int;
  v_agent     uuid;
  v_sim       uuid;
  v_alt       uuid;
  v_neu       uuid;
  v_treffer   int;
  v_expired   boolean;
  v_selbst    boolean := false;
BEGIN
  SELECT count(*) INTO v_spalten FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agent_memories'
    AND column_name IN ('valid_until', 'superseded_by');
  IF v_spalten <> 2 THEN
    RAISE EXCEPTION '379: % der zwei Spalten sind da', v_spalten;
  END IF;

  SELECT count(*) INTO v_fn FROM pg_proc WHERE proname = 'fn_supersede_memory';
  IF v_fn <> 1 THEN
    RAISE EXCEPTION '379: fn_supersede_memory gibt es % mal statt einmal', v_fn;
  END IF;

  -- SECURITY INVOKER, nicht DEFINER. PostgREST legt jede EXECUTE-berechtigte
  -- Funktion unter /rest/v1/rpc/ offen; eine DEFINER-Funktion liefe dort als
  -- ihr Eigentuemer und ginge an der Rollenpruefung vorbei (ADR-006).
  SELECT prosecdef INTO v_secdef FROM pg_proc WHERE proname = 'fn_supersede_memory';
  IF v_secdef THEN
    RAISE EXCEPTION '379: fn_supersede_memory ist SECURITY DEFINER — sie umginge die Rollenpruefung';
  END IF;

  -- ⚠ Die erste Fassung dieser Probe fragte `information_schema.columns`. Die
  -- kennt Tabellen und Views, nicht die Rueckgabespalten einer Funktion — sie
  -- haette IMMER null gemeldet und den Trockenlauf immer abgebrochen. Sie ist
  -- laut gescheitert und nicht still durchgelaufen, und das ist der Unterschied
  -- zwischen einer Pruefung, die irrt, und einer, die nichts sieht.
  -- Fuer RETURNS TABLE stehen die Spaltennamen in `pg_proc.proargnames`.
  SELECT count(*) INTO v_ret
  FROM pg_proc p, unnest(COALESCE(p.proargnames, ARRAY[]::text[])) AS argname
  WHERE p.proname = 'retrieve_agent_memories' AND argname = 'expired';
  IF v_ret <> 1 THEN
    RAISE EXCEPTION '379: der Abruf gibt die Spalte expired nicht zurueck';
  END IF;

  SELECT count(*) INTO v_index FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'idx_agent_memories_gueltig';
  IF v_index <> 1 THEN
    RAISE EXCEPTION '379: der Teilindex auf die gueltigen Erinnerungen fehlt';
  END IF;

  -- ── Die Probe stellt ihre Bedingung selbst her ──────────────────────────
  SELECT a.id, a.simulation_id INTO v_agent, v_sim FROM agents a LIMIT 1;
  IF v_agent IS NULL THEN
    RAISE NOTICE '379: keine Figur vorhanden — die Wirkprobe wurde UEBERSPRUNGEN (Struktur ist geprueft).';
  ELSE
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance)
    VALUES (v_agent, v_sim, '379 Probe alt', 9) RETURNING id INTO v_alt;
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance)
    VALUES (v_agent, v_sim, '379 Probe neu', 9) RETURNING id INTO v_neu;

    -- 1. Vor der Ueberholung ist die alte abrufbar.
    SELECT count(*) INTO v_treffer FROM retrieve_agent_memories(v_agent, NULL, 500) r
    WHERE r.id = v_alt;
    IF v_treffer <> 1 THEN
      RAISE EXCEPTION '379: die Probe war vor der Ueberholung nicht abrufbar — die Bedingung stand nie';
    END IF;

    -- 2. Nach der Ueberholung nicht mehr.
    PERFORM fn_supersede_memory(v_alt, v_neu, NULL);
    SELECT count(*) INTO v_treffer FROM retrieve_agent_memories(v_agent, NULL, 500) r
    WHERE r.id = v_alt;
    IF v_treffer <> 0 THEN
      RAISE EXCEPTION '379: eine ueberholte Erinnerung wird weiter abgerufen';
    END IF;

    -- 3. Ein abgelaufenes Fenster faellt NICHT heraus, aber es meldet sich.
    UPDATE agent_memories SET superseded_by = NULL, valid_until = now() - interval '1 day'
     WHERE id = v_alt;
    SELECT r.expired INTO v_expired FROM retrieve_agent_memories(v_agent, NULL, 500) r
    WHERE r.id = v_alt;
    IF v_expired IS DISTINCT FROM true THEN
      RAISE EXCEPTION '379: eine abgelaufene Erinnerung wird nicht als Vergangenheit gemeldet (expired=%)', v_expired;
    END IF;

    -- 4. Selbstbezug wird abgewiesen.
    BEGIN
      PERFORM fn_supersede_memory(v_alt, v_alt, NULL);
    EXCEPTION WHEN others THEN
      v_selbst := true;
    END;
    IF NOT v_selbst THEN
      RAISE EXCEPTION '379: eine Erinnerung darf sich selbst ueberholen';
    END IF;

    DELETE FROM agent_memories WHERE id IN (v_alt, v_neu);
    RAISE NOTICE '379: Wirkprobe bestanden — ueberholt faellt heraus, abgelaufen meldet sich, Selbstbezug wird abgewiesen.';
  END IF;

  RAISE NOTICE '379: zwei Spalten, Teilindex, fn_supersede_memory (INVOKER) und ein Abruf mit expired.';
END $$;
