-- ═══════════════════════════════════════════════════════════════════════════
-- 381 · Ein Parameter, der eine Grenze verspricht
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER BEFUND ─────────────────────────────────────────────────────────────
--
--   `AgentMemoryService.retrieve` nimmt seit jeher ein `simulation_id`
--   entgegen — und BENUTZT es nicht. Es geht nicht in die RPC, es filtert
--   nichts, es steht nur in der Signatur.
--
--   Gefunden am 05.09.2026 von einem neuen Tor gegen tote Parameter
--   (`test_kein_toter_parameter.py`), das aus einem anderen Fehler derselben
--   Klasse entstand: `_fire_and_forget_digest` nahm `participants` entgegen
--   und reichte es nicht weiter, worauf die Ich-Schicht aus Migration 373 nie
--   eine Zeile schrieb.
--
--   Der Schaden ist heute NULL, und das ist genau das Heimtueckische:
--
--       Erinnerungen, deren Welt nicht die Welt ihrer Figur ist:   0
--       Figuren in mehr als einer Welt:                            0
--
--   Die Grenze haelt, aber nicht weil jemand sie zieht — sondern weil eine
--   Figur zufaellig genau einer Welt gehoert. `agent_id` bestimmt die Welt
--   mit, also faellt nichts auf. Ein Parameter, der eine Zusicherung
--   BEHAUPTET, die niemand einloest, ist schlimmer als gar keiner: an der
--   Aufrufstelle sieht er wie eine Schranke aus.
--
-- ── WAS DIESE MIGRATION TUT ────────────────────────────────────────────────
--
--   Sie macht den Parameter WAHR, statt ihn zu entfernen. `p_simulation_id`
--   wird ein echter Filter im Abruf. Zwei Gruende, den schwereren Weg zu
--   gehen:
--
--   * Ein Gedaechtnis ist an eine Welt gebunden. Dass diese Bindung heute aus
--     `agent_id` folgt, ist eine Eigenschaft der DATEN, keine der Abfrage. Die
--     Datenlage kann sich aendern (eine Figur, die zwei Welten besucht, ist
--     eine denkbare Spielmechanik); die Grenze soll dann trotzdem halten.
--   * Tiefenverteidigung, dasselbe Muster wie FastAPI-Rollenpruefung neben
--     RLS: zwei Schranken, von denen jede allein genuegte.
--
--   NULL bleibt erlaubt und heisst „ueber alle Welten dieser Figur" — sonst
--   waere jeder Aufrufer, der die Welt nicht kennt, gezwungen, sie zu
--   erfinden.
--
-- ── DROP UND CREATE, ZUM ZWEITEN MAL HEUTE ─────────────────────────────────
--
--   Die Funktion bekommt einen neuen Parameter; PostgreSQL wuerde daraus eine
--   ZWEITE ueberladene Funktion machen statt die bestehende zu ersetzen, und
--   PostgREST waehlte dann nach Argumentnamen — mal die eine, mal die andere.
--   Beide Signaturen werden deshalb ausdruecklich entfernt.
--
--   Alles aus 342 (NaN-Zweig) und 379 (`valid_until`, `superseded_by`,
--   `expired`) steht woertlich weiter drin. Eine Reparatur, die eine fruehere
--   zuruecknimmt, ist keine.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.retrieve_agent_memories(UUID, extensions.vector, INT);
DROP FUNCTION IF EXISTS public.retrieve_agent_memories(UUID, extensions.vector, INT, UUID);

CREATE FUNCTION public.retrieve_agent_memories(
  p_agent_id UUID,
  p_query_embedding extensions.vector(1536) DEFAULT NULL,
  p_top_k INT DEFAULT 10,
  p_simulation_id UUID DEFAULT NULL
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
      -- Vergangenes wiegt halb (Migration 379).
      * CASE WHEN m.valid_until IS NOT NULL AND m.valid_until <= now() THEN 0.5 ELSE 1 END
    )::FLOAT AS retrieval_score,
    (m.valid_until IS NOT NULL AND m.valid_until <= now()) AS expired
  FROM agent_memories m
  WHERE m.agent_id = p_agent_id
    -- Die Weltgrenze. NULL heisst „ueber alle Welten dieser Figur" — heute
    -- dasselbe Ergebnis, morgen vielleicht nicht (Migration 381).
    AND (p_simulation_id IS NULL OR m.simulation_id = p_simulation_id)
    -- Ueberholte fallen ganz heraus (Migration 379).
    AND m.superseded_by IS NULL
  ORDER BY retrieval_score DESC
  LIMIT p_top_k;
$$;

COMMENT ON FUNCTION public.retrieve_agent_memories(UUID, extensions.vector, INT, UUID) IS
  'Abruf nach Aehnlichkeit (0,4) + Wichtigkeit (0,4) + Frische (0,2), halbiert fuer abgelaufene Gueltigkeit, ohne ueberholte Zeilen, begrenzt auf eine Welt. NaN-Zweig aus 342, Gueltigkeit aus 379, Weltgrenze aus 381 — dort steht auch, warum der Parameter WAHR gemacht statt entfernt wurde.';

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Mit einer Probe, die ihre Bedingung HERSTELLT: zwei Erinnerungen derselben
-- Figur in ZWEI Welten, dann messen, ob der Filter trennt. Ohne das zweite
-- Exemplar pruefte die Probe nur, dass eine Abfrage etwas zurueckgibt.
DO $$
DECLARE
  v_alt      int;
  v_neu      int;
  v_param    int;
  v_agent    uuid;
  v_sim_a    uuid;
  v_sim_b    uuid;
  v_m_a      uuid;
  v_m_b      uuid;
  v_nur_a    int;
  v_beide    int;
BEGIN
  -- Genau EINE Fassung der Funktion. Zwei ueberladene waeren schlimmer als
  -- die alte: PostgREST waehlte dann nach Argumentnamen.
  SELECT count(*) INTO v_neu FROM pg_proc WHERE proname = 'retrieve_agent_memories';
  IF v_neu <> 1 THEN
    RAISE EXCEPTION '381: retrieve_agent_memories gibt es % mal statt einmal', v_neu;
  END IF;

  SELECT count(*) INTO v_param
  FROM pg_proc p, unnest(COALESCE(p.proargnames, ARRAY[]::text[])) AS argname
  WHERE p.proname = 'retrieve_agent_memories' AND argname = 'p_simulation_id';
  IF v_param <> 1 THEN
    RAISE EXCEPTION '381: der Abruf nimmt keinen Weltparameter';
  END IF;

  SELECT count(*) INTO v_alt
  FROM pg_proc p, unnest(COALESCE(p.proargnames, ARRAY[]::text[])) AS argname
  WHERE p.proname = 'retrieve_agent_memories' AND argname = 'expired';
  IF v_alt <> 1 THEN
    RAISE EXCEPTION '381: die Rueckgabespalte expired aus 379 ist verlorengegangen';
  END IF;

  -- ── Die Wirkprobe stellt ihre Bedingung selbst her ─────────────────────
  SELECT a.id, a.simulation_id INTO v_agent, v_sim_a FROM agents a LIMIT 1;
  SELECT s.id INTO v_sim_b FROM simulations s WHERE s.id <> v_sim_a LIMIT 1;

  IF v_agent IS NULL OR v_sim_b IS NULL THEN
    RAISE NOTICE '381: weniger als zwei Welten oder keine Figur — die Wirkprobe wurde UEBERSPRUNGEN (Struktur ist geprueft).';
  ELSE
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance)
    VALUES (v_agent, v_sim_a, '381 Probe Welt A', 9) RETURNING id INTO v_m_a;
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance)
    VALUES (v_agent, v_sim_b, '381 Probe Welt B', 9) RETURNING id INTO v_m_b;

    -- Ohne Weltangabe kommen BEIDE. Stellt die Bedingung her: gaebe es das
    -- zweite Exemplar nicht, saehe der Filter unten wie ein Erfolg aus.
    SELECT count(*) INTO v_beide FROM retrieve_agent_memories(v_agent, NULL, 500, NULL) r
    WHERE r.id IN (v_m_a, v_m_b);
    IF v_beide <> 2 THEN
      RAISE EXCEPTION '381: ohne Weltangabe kamen % statt 2 Proben — die Bedingung stand nie', v_beide;
    END IF;

    -- Mit Weltangabe nur die eine.
    SELECT count(*) INTO v_nur_a FROM retrieve_agent_memories(v_agent, NULL, 500, v_sim_a) r
    WHERE r.id IN (v_m_a, v_m_b);
    IF v_nur_a <> 1 THEN
      RAISE EXCEPTION '381: mit Weltangabe kamen % statt 1 Probe — die Grenze trennt nicht', v_nur_a;
    END IF;

    DELETE FROM agent_memories WHERE id IN (v_m_a, v_m_b);
    RAISE NOTICE '381: Wirkprobe bestanden — ohne Weltangabe 2, mit Weltangabe 1.';
  END IF;

  RAISE NOTICE '381: der Weltparameter ist kein Versprechen mehr, sondern ein Filter.';
END $$;
