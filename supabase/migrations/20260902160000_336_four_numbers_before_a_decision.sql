-- Migration 336: Vier Zahlen, bevor jemand entscheidet
--
-- Der Admin-Bereich SEC-08 soll nicht nur die eigenen Schlüssel zeigen,
-- sondern den Zustand der Sache: Wer darf, wer hat tatsächlich einen
-- bestätigten Schlüssel, wessen Schlüssel ist seit zu langem ungeprüft, und
-- was hat das auf NUTZERKONTEN gekostet.
--
-- Warum eine Funktion und nicht vier Abfragen im Dienst: es sind vier
-- Aggregate über drei Tabellen, die ZUSAMMEN eine Aussage ergeben. Getrennt
-- gelesen driften sie im Moment des Lesens auseinander (ein Antrag, der
-- zwischen der zweiten und der dritten Abfrage genehmigt wird, erscheint in
-- keiner der beiden Zahlen richtig), und der Admin sieht einen Zustand, den
-- es nie gab.
--
-- DIE VIERTE ZAHL IST DIE HEIKELSTE. `user_paid_usd_30d` summiert Aufrufe mit
-- `key_source = 'byok'` — also genau das Geld, das die Plattform NICHT
-- ausgegeben hat und das seit Migration 332 aus ihrer Kappe herausgerechnet
-- wird. Sie steht hier, damit ein Admin sieht, was seine Nutzer tragen; sie
-- darf nur nie als Plattformkosten gelesen werden. Deshalb heisst das Feld
-- `user_paid_usd_30d` und nicht `cost_30d`.
--
-- Vertraut keinen ID-Parametern (sie hat keine) und liest nur Aggregate,
-- trotzdem service_role-only: die Zahlen sind eine Auskunft über ALLE Konten,
-- und der Router prüft `require_platform_admin()` davor (ADR-006).

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_byok_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_stale_days integer;
BEGIN
    SELECT COALESCE((setting_value #>> '{}')::integer, 90)
    INTO v_stale_days
    FROM platform_settings WHERE setting_key = 'byok_stale_days';
    v_stale_days := COALESCE(v_stale_days, 90);

    RETURN jsonb_build_object(
        'stale_after_days', v_stale_days,
        -- Wer DARF. Unter der Politik `all` dürfen alle, dann sagt die Zahl
        -- der einzeln Freigeschalteten wenig — sie steht trotzdem, weil ein
        -- Wechsel zurück auf `per_user` genau diese Menge wieder aktiviert.
        'allowed_accounts', (SELECT count(*) FROM user_wallets WHERE byok_allowed),
        -- Wer tatsächlich einen BESTÄTIGTEN Schlüssel hat. Der Abstand zur
        -- Zahl darüber ist die eigentliche Auskunft.
        'with_confirmed_key', (
            SELECT count(DISTINCT user_id) FROM user_api_keys WHERE last_verified_at IS NOT NULL
        ),
        -- Wessen Schlüssel zu lange nicht bestätigt wurde. NIE geprüfte zählen
        -- mit: „noch nie" ist nicht besser als „seit langem nicht".
        'stale_keys', (
            SELECT count(*) FROM user_api_keys
            WHERE last_verified_at IS NULL
               OR last_verified_at < now() - make_interval(days => v_stale_days)
        ),
        'user_paid_usd_30d', (
            SELECT COALESCE(round(sum(estimated_cost_usd)::numeric, 4), 0)
            FROM ai_usage_log
            WHERE key_source = 'byok' AND created_at >= now() - interval '30 days'
        ),
        'open_requests', (SELECT count(*) FROM byok_requests WHERE status = 'pending')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_byok_admin_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_byok_admin_stats() TO service_role;

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.fn_byok_admin_stats()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.fn_byok_admin_stats()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 336 FAILED: fn_byok_admin_stats ist anon/authenticated-aufrufbar';
    END IF;
END $$;

COMMIT;
