-- Migration 332: Eine Kappe darf nur zählen, was die Plattform bezahlt hat
--
-- BEFUND 5 aus `handoff/byok-verankerung-2026-09-02.md`. `ai_budget` ist die
-- Ausgabengrenze der PLATTFORM: `BudgetEnforcementService.pre_check` liest
-- `get_budget_states`, und wenn die laufende Periode über der Grenze liegt,
-- wird der nächste Modellaufruf hart geblockt. Die Summe darunter kam aus
-- `ai_usage_log` — ungefiltert nach `key_source`.
--
-- Solange kein Aufrufer je `key_source='byok'` schrieb (604 von 604 Zeilen
-- `platform`, gemessen am 02.09.2026), war das folgenlos. Mit dem Commit, der
-- die Herkunft durchreicht, wäre es genau falschherum: ein Nutzer mit eigenem
-- Schlüssel bezahlt seine Aufrufe selbst, und jeder davon hätte die Kappe der
-- Plattform ein Stück weiter geschlossen — bis der Block irgendwann ALLE
-- trifft, wegen Geldes, das die Plattform nie ausgegeben hat. Die
-- großzügigste Nutzergruppe hätte den Dienst für alle abgewürgt.
--
-- Der Filter gehört hierher und nicht ins Log: die Zeile bleibt vollständig
-- (Kostenübersicht, Firehose und `get_ai_usage_stats` sollen weiter sehen,
-- was insgesamt geflossen ist — nur eben nicht auf Kosten der Plattform).
--
-- Die vier Geltungsbereiche bleiben unverändert; der Ausschluss gilt für alle
-- vier, auch für `user`: eine Nutzergrenze in USD misst ebenfalls Geld der
-- Plattform. Wer den eigenen Schlüssel benutzt, ist genau deshalb nicht
-- gedeckelt — das ist die Bedeutung von BYOK, nicht ein Schlupfloch.
--
-- `key_source` ist NOT NULL mit Vorgabe `'platform'` (Migr. 150), also
-- braucht der Vergleich kein COALESCE; `IS DISTINCT FROM` steht trotzdem
-- dort, damit ein späteres Nullable die Zeile nicht stillschweigend aus der
-- Summe fallen lässt.

BEGIN;

CREATE OR REPLACE FUNCTION get_budget_states()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_now   TIMESTAMPTZ := now();
    v_hour  TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day   TIMESTAMPTZ := date_trunc('day',   v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_mon   TIMESTAMPTZ := date_trunc('month', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
    RETURN (
        SELECT coalesce(jsonb_agg(
            to_jsonb(b) || jsonb_build_object(
                'current_usd',   round(coalesce(s.current_usd, 0)::numeric, 6),
                'current_calls', coalesce(s.current_calls, 0)
            )
        ), '[]'::jsonb)
        FROM ai_budget b
        LEFT JOIN LATERAL (
            SELECT
                sum(estimated_cost_usd) AS current_usd,
                count(*)::INT           AS current_calls
            FROM ai_usage_log u
            WHERE u.created_at >= CASE b.period
                WHEN 'hour'  THEN v_hour
                WHEN 'day'   THEN v_day
                WHEN 'month' THEN v_mon
            END
            -- Nur Geld der Plattform zählt gegen die Kappen der Plattform.
            AND u.key_source IS DISTINCT FROM 'byok'
            AND CASE b.scope
                WHEN 'global'     THEN TRUE
                WHEN 'purpose'    THEN u.purpose = b.scope_key
                WHEN 'simulation' THEN u.simulation_id::text = b.scope_key
                WHEN 'user'       THEN u.user_id::text = b.scope_key
            END
        ) s ON TRUE
    );
END;
$$;

COMMENT ON FUNCTION get_budget_states IS
    'Budget list with current-period rolled-up spend attached, BYOK-paid calls excluded (migr. 332 — a platform cap counts only platform money). Used by the BudgetEnforcementService read path and the budget admin panel.';

COMMIT;
