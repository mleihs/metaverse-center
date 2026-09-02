-- Migration 330: Ein Schlüssel gehört der PERSON, nicht der SCHMIEDE
--
-- BEFUND (gemessen auf Prod am 2026-09-02). BYOK war nie erreichbar: 4 Wallet-
-- Zeilen, alle `is_architect`, `byok_allowed` 0, hinterlegte Schlüssel 0,
-- `ai_usage_log.key_source` 604 von 604 `platform`. Nicht kaputtgegangen —
-- nie erreichbar gewesen. Drei Sperren lagen übereinander, und keine wusste
-- von den anderen:
--
--   1. Der Router forderte `require_architect()` — ein Tor der SCHMIEDE für
--      eine Sache der PERSON. (Backend, gleicher Commit.)
--   2. `_check_byok_access` kannte `is_platform_admin()` nicht: Politik
--      `per_user` + `byok_allowed = false` ⇒ selbst der Admin, der die Politik
--      setzt, bekam 403. (Backend, gleicher Commit.)
--   3. Diese Funktion hier: ein blankes UPDATE auf `user_wallets`. Wer keine
--      Geldbörse hat — also jeder Nicht-Architekt — bekam 0 betroffene Zeilen
--      und die Antwort „Wallet not found. Must be an architect first."
--      Die Sperre steckte im SQL und hätte die beiden anderen überlebt.
--
-- Diese Migration löst (3) und einen vierten, stilleren Fall: die
-- Zusammenfassung, die das Frontend liest, log für Nutzer OHNE Wallet-Zeile
-- die Politik als `per_user`/`false` — auch dann, wenn die Plattform in
-- Wahrheit `all` erlaubt. Ein Formular, das aus einem fest verdrahteten
-- Vorgabewert heraus unsichtbar bleibt.
--
-- GRUNDSATZ. Die Zeile in `user_wallets` ist plattformweite Metadaten der
-- Person (Migr. 055: „Platform-wide metadata + BYOK encrypted keys"), nicht
-- ein Ausweis der Schmiede. `account_tier` bleibt `observer`, der Trigger
-- `trg_sync_architect_flag` setzt `is_architect = false` — eine Zeile
-- anzulegen verleiht also keinerlei Forge-Rechte. Wer keinen Schlüssel
-- hinterlegt, läuft unverändert über den Projektschlüssel; BYOK ist ein
-- Modus, keine Regel.
--
-- Der Selbstschutz der Funktion (`auth.uid() IS DISTINCT FROM p_user_id`)
-- bleibt unangetastet — er ist der Grund, warum sie nach ADR-006/Migr. 258
-- `authenticated`-aufrufbar bleiben darf, und damit der Grund, warum sie mit
-- dem NUTZER-Client gerufen werden muss (der Service-Role-JWT trägt kein
-- `sub`, `auth.uid()` wäre NULL). Die Signatur bleibt Zeichen für Zeichen
-- gleich, damit die in 257/258 gepinnten Rechte weiter greifen.

BEGIN;

-- ── 1. Schlüssel hinterlegen legt die Geldbörse an, wenn es keine gibt ──────

CREATE OR REPLACE FUNCTION public.fn_update_user_byok_keys(
    p_user_id uuid,
    p_encrypted_openrouter_key text DEFAULT NULL,
    p_encrypted_replicate_key text DEFAULT NULL,
    p_clear_openrouter boolean DEFAULT false,
    p_clear_replicate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    -- Caller must be the wallet owner. Unverändert: dieser Selbstschutz ist
    -- die Bedingung dafür, dass die Funktion `authenticated` bleiben darf.
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update another user''s keys';
    END IF;

    UPDATE public.user_wallets
    SET
        encrypted_openrouter_key = CASE
            WHEN p_clear_openrouter THEN NULL
            ELSE COALESCE(p_encrypted_openrouter_key, encrypted_openrouter_key)
        END,
        encrypted_replicate_key = CASE
            WHEN p_clear_replicate THEN NULL
            ELSE COALESCE(p_encrypted_replicate_key, encrypted_replicate_key)
        END,
        updated_at = now()
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count > 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
    END IF;

    -- Keine Geldbörse. Einen Schlüssel LÖSCHEN, den es nie gab, ist erledigt,
    -- ohne dass dafür eine Zeile entstehen müsste.
    IF p_encrypted_openrouter_key IS NULL AND p_encrypted_replicate_key IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'No keys stored.');
    END IF;

    -- Einen Schlüssel HINTERLEGEN legt die Zeile an. `account_tier` bleibt
    -- ausdrücklich `observer`; der Trigger leitet daraus `is_architect = false`
    -- ab. ON CONFLICT fängt das Rennen zweier gleichzeitiger Hinterlegungen.
    INSERT INTO public.user_wallets (
        user_id, account_tier, encrypted_openrouter_key, encrypted_replicate_key
    )
    VALUES (
        p_user_id,
        'observer',
        CASE WHEN p_clear_openrouter THEN NULL ELSE p_encrypted_openrouter_key END,
        CASE WHEN p_clear_replicate  THEN NULL ELSE p_encrypted_replicate_key  END
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        encrypted_openrouter_key = CASE
            WHEN p_clear_openrouter THEN NULL
            ELSE COALESCE(EXCLUDED.encrypted_openrouter_key, public.user_wallets.encrypted_openrouter_key)
        END,
        encrypted_replicate_key = CASE
            WHEN p_clear_replicate THEN NULL
            ELSE COALESCE(EXCLUDED.encrypted_replicate_key, public.user_wallets.encrypted_replicate_key)
        END,
        updated_at = now();

    RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
END;
$$;

-- ── 2. Die Zusammenfassung muss die Politik auch ohne Geldbörse kennen ──────
--
-- Vorher gab es zwei Ausgänge: mit Zeile die echte Politik, ohne Zeile einen
-- fest verdrahteten Vorgabewert (`per_user`, alles `false`). Nutzer ohne
-- Geldbörse — nach dieser Migration genau jene, die noch nie einen Schlüssel
-- hinterlegt haben — sahen damit nie, dass die Plattform `all` erlaubt.
-- Jetzt gibt es EINEN Ausgang: die Wallet-Felder fallen auf Vorgaben zurück,
-- die Politik wird immer gefragt.

CREATE OR REPLACE FUNCTION public.fn_get_wallet_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_forge_tokens integer;
    v_is_architect boolean;
    v_account_tier text;
    v_has_openrouter_key boolean;
    v_has_replicate_key boolean;
    v_byok_bypass boolean;
    v_system_enabled boolean;
    v_access_policy text;
BEGIN
    -- LEFT JOIN gegen eine einzeilige Quelle: fehlt die Geldbörse, liefert die
    -- Abfrage trotzdem GENAU EINE Zeile mit den Vorgabewerten. Damit gibt es
    -- nur einen Ausgang aus dieser Funktion statt zweier, die auseinanderdriften.
    SELECT COALESCE(w.forge_tokens, 0),
           COALESCE(w.is_architect, false),
           COALESCE(w.account_tier, 'observer'),
           w.encrypted_openrouter_key IS NOT NULL,
           w.encrypted_replicate_key IS NOT NULL,
           COALESCE(w.byok_bypass, false)
    INTO v_forge_tokens, v_is_architect, v_account_tier,
         v_has_openrouter_key, v_has_replicate_key, v_byok_bypass
    FROM (SELECT p_user_id AS uid) q
    LEFT JOIN user_wallets w ON w.user_id = q.uid;

    SELECT COALESCE((setting_value = 'true'::jsonb), false)
    INTO v_system_enabled
    FROM platform_settings WHERE setting_key = 'byok_bypass_enabled';
    v_system_enabled := COALESCE(v_system_enabled, false);

    SELECT COALESCE(setting_value #>> '{}', 'per_user')
    INTO v_access_policy
    FROM platform_settings WHERE setting_key = 'byok_access_policy';
    v_access_policy := COALESCE(v_access_policy, 'per_user');

    RETURN jsonb_build_object(
        'forge_tokens', v_forge_tokens,
        'is_architect', v_is_architect,
        'account_tier', v_account_tier,
        'byok_status', jsonb_build_object(
            'has_openrouter_key', v_has_openrouter_key,
            'has_replicate_key', v_has_replicate_key,
            -- Einzige Quelle bleiben die Politik-Funktionen; sie vertragen
            -- einen Nutzer ohne Geldbörse (COALESCE(..., false) im Rumpf).
            'byok_allowed', fn_user_byok_allowed(p_user_id),
            'byok_bypass', v_byok_bypass,
            'system_bypass_enabled', v_system_enabled,
            'effective_bypass', fn_user_has_byok_bypass(p_user_id),
            'access_policy', v_access_policy
        )
    );
END;
$$;

-- ── 3. Rechte erneut behaupten (CREATE OR REPLACE erbt sie, aber sichtbar) ──
-- Siehe ADR-006 und Migr. 257/258: `fn_update_user_byok_keys` bleibt
-- `authenticated`-aufrufbar, WEIL sie sich selbst prüft.
REVOKE ALL ON FUNCTION public.fn_update_user_byok_keys(uuid, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_update_user_byok_keys(uuid, text, text, boolean, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_get_wallet_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_wallet_summary(uuid) TO authenticated, service_role;

-- ── 4. Selbstprüfung (fail-closed) ─────────────────────────────────────────
DO $$
DECLARE
    v_bad text;
BEGIN
    SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_update_user_byok_keys', 'fn_get_wallet_summary')
      AND has_function_privilege('anon', p.oid, 'EXECUTE');
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 330 FAILED: anon-aufrufbar: %', v_bad;
    END IF;

    SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_update_user_byok_keys', 'fn_get_wallet_summary')
      AND NOT (has_function_privilege('authenticated', p.oid, 'EXECUTE')
               AND has_function_privilege('service_role', p.oid, 'EXECUTE'));
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 330 FAILED: Aufrufweg verloren: %', v_bad;
    END IF;
END $$;

COMMIT;
