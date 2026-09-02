-- 342 — Ein Nullvektor stand in jedem Abruf auf Platz 1
--
-- BEFUND (gemessen am 02.09.2026 an dieser Datenbank)
--
-- `EmbeddingService.embed` gab bei jedem Fehlschlag einen NULLVEKTOR zurück
-- statt zu melden, dass kein Vektor zu holen war. Die Zeile wurde geschrieben,
-- der Aufruf meldete Erfolg — und pgvector liefert für den Kosinusabstand zu
-- einem Nullvektor `NaN`:
--
--     '[0,0,0]' <=> '[1,2,3]'                        →  NaN
--     0.4*(1-NaN) + 0.4*importance + 0.2*recency     →  NaN
--
-- Und PostgreSQL sortiert `NaN` in `ORDER BY … DESC` VOR jede Zahl. An dieser
-- Datenbank nachgestellt:
--
--     NULLVEKTOR       NaN    Platz 1
--     gute Erinnerung  0.9    Platz 2
--     mittlere         0.5    Platz 3
--
-- Eine einzige fehlgeschlagene Einbettung besetzte damit in JEDEM semantischen
-- Abruf dieses Agenten dauerhaft den ersten von acht Plätzen — mit einer
-- Erinnerung, die zur Frage nichts beiträgt. Der Fehler war unsichtbar: nichts
-- schlug fehl, es stand nur immer dasselbe zuoberst.
--
-- Bestand zum Zeitpunkt der Migration: 305 Erinnerungen, davon
--   1 mit Nullvektor  (source_type='event_reaction')
--   1 ganz ohne Einbettung (source_type='system', aus einem SQL-Pfad)
--
-- Klein — aber beide Löcher wachsen: jeder Einbettungsfehler erzeugt einen
-- weiteren Nullvektor, und die SQL-Schreibpfade (`fn_apply_dungeon_loot`,
-- Reise-Fehlschläge, Verlies-RPCs) schreiben grundsätzlich ohne Vektor.
--
-- ZWEI SCHNITTE
--   1. Die Bewertungsfunktion darf einen unbrauchbaren Abstand nicht gewinnen
--      lassen. Sie behandelt ihn wie „keine Einbettung": der Beitrag ist 0,
--      Wichtigkeit und Frische tragen die Erinnerung weiter.
--   2. Bestehende Nullvektoren werden auf NULL gesetzt — die ehrliche Angabe.
--
-- Der Schreibpfad ist im selben Zug repariert (`embed()` gibt jetzt `None`,
-- `record_observation` schreibt dann NULL statt eines vergifteten Vektors).

BEGIN;

-- ── 1. Die Bewertung gegen NaN absichern ────────────────────────────────────
--
-- ⚠ `d <> d` taugt hier NICHT als NaN-Prüfung: PostgreSQL behandelt NaN als
-- gleich sich selbst (anders als IEEE 754). Der Vergleich `= 'NaN'` ist der
-- Weg, der in Postgres wirkt.
CREATE OR REPLACE FUNCTION retrieve_agent_memories(
  p_agent_id UUID,
  p_query_embedding extensions.vector(1536) DEFAULT NULL,
  p_top_k INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, memory_type memory_type, content TEXT, content_de TEXT,
  importance INT, source_type memory_source_type, created_at TIMESTAMPTZ,
  retrieval_score FLOAT
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
      CASE
        WHEN p_query_embedding IS NULL OR m.embedding IS NULL THEN 0
        -- Unbrauchbarer Abstand (Nullvektor auf einer der beiden Seiten):
        -- zählt wie „keine Einbettung", statt alles andere zu verdrängen.
        WHEN (m.embedding <=> p_query_embedding) = 'NaN'::FLOAT8 THEN 0
        ELSE 0.4 * (1 - (m.embedding <=> p_query_embedding))
      END
      + 0.4 * (m.importance::float / 10.0)
      + 0.2 * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - m.created_at)) / 86400.0))
    )::FLOAT AS retrieval_score
  FROM agent_memories m
  WHERE m.agent_id = p_agent_id
  ORDER BY retrieval_score DESC
  LIMIT p_top_k;
$$;

COMMENT ON FUNCTION retrieve_agent_memories(UUID, extensions.vector, INT) IS
  'Abruf nach Ähnlichkeit (0,4) + Wichtigkeit (0,4) + Frische (0,2). '
  'Ein unbrauchbarer Abstand (NaN durch Nullvektor) zählt wie keine Einbettung — '
  'ohne diesen Zweig stand eine fehlgeschlagene Einbettung in jedem Abruf auf '
  'Platz 1, weil PostgreSQL NaN in DESC vor jede Zahl sortiert (Migration 342).';

-- ── 2. Bestehende Nullvektoren ehrlich machen ───────────────────────────────
--
-- Nicht gelöscht: der Inhalt der Erinnerung ist gültig, nur ihr Vektor ist es
-- nicht. Mit NULL trägt sie über Wichtigkeit und Frische weiter und kann
-- später nachgeholt werden.
UPDATE agent_memories
   SET embedding = NULL
 WHERE embedding IS NOT NULL
   AND (embedding <=> embedding) = 'NaN'::FLOAT8;

COMMIT;
