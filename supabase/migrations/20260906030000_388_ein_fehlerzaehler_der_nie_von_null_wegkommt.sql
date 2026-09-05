-- ════════════════════════════════════════════════════════════════════════════
-- 388 · Ein Fehlerzaehler, der ein Feld liest, das niemand schreibt
-- ════════════════════════════════════════════════════════════════════════════
--
-- WAS GEMESSEN WURDE (05.09.2026, Produktion)
--
--   Zeilen mit `metadata ? 'status'`          0   ← schreibt niemand
--   Fehler laut `ai_usage_rollup_hour.errors`  0
--   echte Fehler (`outcome <> 'ok'`)           2
--   Aufrufe im 30-Tage-Fenster              1081
--
-- Die Spalte `errors` zaehlt seit Migration 229
--
--     count(*) FILTER (WHERE (metadata->>'status') = 'error')
--
-- und `metadata.status` hat NIE ein Schreibweg gefuellt. Der Zaehler stand
-- immer auf null und konnte nie von null wegkommen — nicht bei einem Ausfall,
-- nicht bei einer Drosselung, nicht bei einem Zeitueberschritt.
--
-- WARUM ES NIEMANDEM AUFFIEL
--
-- Migration 229 baute die Ansicht. Migration 352 fuehrte danach die Spalte
-- `outcome` ein und schrieb ihre eigene Lehre in den Kopf: „this table is a
-- record of ATTEMPTS, not of successes … only counts must say
-- `outcome = 'ok'` where they mean answered."
--
-- Die Ansicht hat diese Lehre nie mitbekommen. Sie ist aelter als die Spalte,
-- die ihre Frage beantwortet, und niemand ist zurueckgegangen.
--
-- ⚠ Ein Zaehler bei null sieht aus wie eine gute Nachricht. Das ist der Grund,
-- warum dieser Fehler vier Monate ueberlebt hat: „keine Fehler" ist genau das,
-- was man sehen will, und niemand prueft eine Zahl nach, die einem gefaellt.
--
-- WAS SICH AENDERT UND WAS NICHT
--
--   errors      liest jetzt `outcome`, nicht `metadata`
--   calls       bleibt die Zahl der VERSUCHE — das ist gewollt und steht
--               jetzt als Kommentar dran. `calls - errors` ergibt die
--               beantworteten.
--   Summen      unveraendert. Ein gescheiterter Versuch traegt null Token und
--               null Betrag, also war und bleibt jede Summe richtig.
--
-- Die Ansicht wird neu gebaut (ein Materialized View kennt kein
-- CREATE OR REPLACE). Indizes und Kommentar werden mit angelegt; die
-- Auffrischfunktion bleibt unberuehrt.
-- ════════════════════════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS ai_usage_rollup_hour CASCADE;

CREATE MATERIALIZED VIEW ai_usage_rollup_hour AS
SELECT
    date_trunc('hour', created_at)                          AS hour,
    purpose,
    model,
    provider,
    simulation_id,
    -- VERSUCHE, nicht Antworten. Wer beantwortete meint, rechnet
    -- `calls - errors`.
    count(*)::BIGINT                                        AS calls,
    coalesce(sum(total_tokens), 0)::BIGINT                  AS tokens,
    round(coalesce(sum(estimated_cost_usd), 0)::NUMERIC, 6) AS usd,
    -- Bis Migration 388: `(metadata->>'status') = 'error'` — ein Feld, das
    -- kein Schreibweg je gefuellt hat.
    count(*) FILTER (WHERE outcome IS DISTINCT FROM 'ok')::BIGINT AS errors,
    round(coalesce(avg(duration_ms), 0)::NUMERIC, 0)::INT   AS avg_duration_ms
FROM ai_usage_log
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2, 3, 4, 5;

-- CONCURRENTLY-refresh requirement: exactly-one-row-per-key unique index.
CREATE UNIQUE INDEX ai_usage_rollup_hour_pk
    ON ai_usage_rollup_hour (hour, purpose, model, provider, simulation_id);

CREATE INDEX idx_ai_usage_rollup_hour_time
    ON ai_usage_rollup_hour (hour DESC);

CREATE INDEX idx_ai_usage_rollup_hour_purpose
    ON ai_usage_rollup_hour (purpose, hour DESC);

COMMENT ON MATERIALIZED VIEW ai_usage_rollup_hour IS
    'Hourly rollup of ai_usage_log over a 30-day rolling window. `calls` counts ATTEMPTS; `calls - errors` are the answered ones. Refreshed CONCURRENTLY every 60 seconds by the backend rollup scheduler.';

GRANT SELECT ON ai_usage_rollup_hour TO service_role;

-- ── Selbstpruefung ──────────────────────────────────────────────────────────
--
-- Behauptet nur gegen die eigene WIRKUNG, nie gegen den Inhalt der Plattform:
-- laeuft auf einer leeren Datenbank genauso wie auf Produktion.
DO $$
DECLARE
    v_def   TEXT;
    v_spalten INT;
BEGIN
    SELECT definition INTO v_def FROM pg_matviews WHERE matviewname = 'ai_usage_rollup_hour';
    IF v_def IS NULL THEN
        RAISE EXCEPTION '388: die Ansicht ai_usage_rollup_hour existiert nicht';
    END IF;
    IF v_def LIKE '%metadata%status%' THEN
        RAISE EXCEPTION '388: der tote Metadaten-Zaehler steht noch in der Definition';
    END IF;
    IF v_def NOT LIKE '%outcome%' THEN
        RAISE EXCEPTION '388: errors liest nicht outcome';
    END IF;

    -- ⚠ NICHT information_schema.columns — das kennt die Spalten eines
    -- MATERIALIZED VIEW nicht und liefert 0. Der Trockenlauf hat genau daran
    -- abgebrochen; dieselbe Falle wie in Migration 379, wo es die
    -- Rueckgabespalten einer Funktion waren.
    SELECT count(*) INTO v_spalten FROM pg_attribute
    WHERE attrelid = 'ai_usage_rollup_hour'::regclass
      AND attnum > 0 AND NOT attisdropped;
    IF v_spalten <> 10 THEN
        RAISE EXCEPTION '388: die Ansicht hat % Spalten, erwartet 10', v_spalten;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ai_usage_rollup_hour_pk') THEN
        RAISE EXCEPTION '388: der eindeutige Index fehlt — CONCURRENTLY refresh geht dann nicht';
    END IF;

    RAISE NOTICE '388: Ansicht neu gebaut, errors liest outcome, 10 Spalten, Index steht.';
END $$;
