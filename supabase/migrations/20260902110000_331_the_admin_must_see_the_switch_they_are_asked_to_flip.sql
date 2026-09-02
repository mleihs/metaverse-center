-- Migration 331: Der Admin muss den Schalter sehen, den er umlegen soll
--
-- BEFUND 3 aus `handoff/byok-verankerung-2026-09-02.md`: Für die per-Nutzer-
-- Freigabe von BYOK gibt es seit Migration 103 eine Spalte
-- (`user_wallets.byok_allowed`), seit jeher einen Endpunkt
-- (`PUT /forge/admin/user-byok-allowed/{id}`) und im Frontend eine
-- Dienstmethode (`adminApi.updateUserBYOKAllowed`) — aber KEINEN Aufrufer.
-- Die ausgelieferte Politik ist `per_user`; auf Produktion ist der Wert bei
-- null Nutzern gesetzt. Die Tür existiert, der Schlüssel existiert, und
-- niemand konnte je danach greifen.
--
-- Die Nutzerverwaltung soll den Schalter jetzt zeigen. Dafür muss sie seinen
-- Zustand kennen: `admin_get_user` verbindet `user_wallets` bereits per LEFT
-- JOIN, gibt aber nur `forge_tokens` und `is_architect` heraus. Vier Felder
-- kommen dazu, statt einer zweiten Abfrage auf dieselbe Zeile (ADR-007,
-- Postgres-first).
--
-- Die Schlüssel selbst bleiben draußen. Herausgegeben wird ausschließlich, OB
-- einer hinterlegt ist (`… IS NOT NULL`), nie der verschlüsselte Wert — ein
-- Admin muss sehen, dass jemand einen Schlüssel hat, und nichts darüber
-- hinaus.
--
-- Rein additiv: `AdminUserDetailResponse` ist `extra="allow"`, die Funktion
-- ist service_role-only (Migr. 040) mit genau einem Aufrufer
-- (`AdminUserService.get_user_with_memberships`), und die Signatur bleibt
-- gleich, also bleiben die Rechte aus 040 stehen.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user jsonb;
BEGIN
    SELECT row_to_json(u)::jsonb INTO v_user
    FROM (
        SELECT
            au.id::text,
            au.email,
            au.raw_user_meta_data,
            au.created_at,
            au.last_sign_in_at,
            au.email_confirmed_at,
            uw.forge_tokens,
            uw.is_architect,
            -- BYOK: die zwei Schalter der Plattform …
            COALESCE(uw.byok_allowed, false) AS byok_allowed,
            COALESCE(uw.byok_bypass, false) AS byok_bypass,
            -- … und nur die Tatsache, dass ein Schlüssel daliegt.
            (uw.encrypted_openrouter_key IS NOT NULL) AS has_openrouter_key,
            (uw.encrypted_replicate_key IS NOT NULL) AS has_replicate_key
        FROM auth.users au
        LEFT JOIN public.user_wallets uw ON au.id = uw.user_id
        WHERE au.id = p_user_id
    ) u;

    IF v_user IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v_user;
END;
$function$;

-- Rechte aus Migration 040 erneut behaupten (Signatur unverändert, also
-- ohnehin erhalten — hier sichtbar gemacht, weil die Funktion SECURITY
-- DEFINER ist und ADR-006 verlangt, dass der Aufrufweg im Text steht).
REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO service_role;

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.admin_get_user(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.admin_get_user(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 331 FAILED: admin_get_user ist anon/authenticated-aufrufbar';
    END IF;
    IF NOT has_function_privilege('service_role', 'public.admin_get_user(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 331 FAILED: service_role hat den Aufrufweg verloren';
    END IF;
END $$;

COMMIT;
