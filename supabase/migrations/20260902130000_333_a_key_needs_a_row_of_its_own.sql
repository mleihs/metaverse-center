-- Migration 333: Ein Schlüssel braucht eine eigene Zeile
--
-- P4 aus `handoff/byok-verankerung-2026-09-02.md`. Bisher lagen die
-- persönlichen Schlüssel als ZWEI SPALTEN in `user_wallets`
-- (`encrypted_openrouter_key`, `encrypted_replicate_key`, Migr. 055). Diese
-- Form beantwortet drei Fragen nicht, und keine davon ist exotisch:
--
--   * ROTATION. Ein Fernet-Schlüssel verschlüsselt heute Wallets UND
--     `simulation_settings`, und nirgends steht, WELCHER Schlüssel welchen
--     Geheimtext erzeugt hat. Solange das niemand weiß, kann man den
--     Verschlüsselungsschlüssel nicht wechseln, ohne alles auf einmal neu zu
--     verschlüsseln — also praktisch nie. `key_version` beantwortet die Frage
--     pro Zeile; die zugehörige Mechanik steht in
--     `backend/utils/encryption.py` (`MultiFernet` über eine Liste, Neues
--     verschlüsselt der jüngste, Altes entschlüsselt weiterhin der ältere).
--   * WEITERE ANBIETER. Jeder neue Anbieter war bisher eine neue SPALTE plus
--     ein neuer RPC-Parameter plus ein neues Feld in drei Diensten. Jetzt ist
--     er eine Zeile.
--   * ZULETZT GEPRÜFT / ZULETZT BENUTZT. Ein hinterlegter Schlüssel, der seit
--     Wochen nicht mehr trägt, sah bisher genauso aus wie einer, der
--     funktioniert. „Configured" ist keine Auskunft über Gültigkeit.
--
-- JETZT IST DER GÜNSTIGSTE MOMENT. Auf Produktion liegen NULL hinterlegte
-- Schlüssel (gemessen 02.09.2026, siehe Migr. 330): die Rückfüllung ist leer,
-- es gibt nichts zu verlieren. Nach dem ersten echten Schlüssel wäre dieselbe
-- Umstellung eine Datenwanderung mit Geheimtexten.
--
-- KEIN AUSFALLFENSTER. Die alten Spalten bleiben stehen und werden vom
-- deprecierten `fn_update_user_byok_keys` weiter mitgeschrieben, damit ein
-- Backend-Stand VOR dem Deploy nichts verliert. Gelesen wird ab hier
-- ausschließlich aus `user_api_keys` — es gibt also genau EINE Wahrheit, und
-- die Spalten sind nur noch ein Echo für die Dauer des Deploys. Sie fallen in
-- einer späteren Migration, nachdem der neue Stand läuft (ADR-007-Muster:
-- am Kopplungspunkt zerschneiden, nicht mittendrin).

BEGIN;

-- ── 1. Die Tabelle ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('openrouter', 'replicate')),
    encrypted_key text NOT NULL,
    -- Welche Fassung des Verschlüsselungsschlüssels diesen Geheimtext erzeugt
    -- hat. Heute gibt es genau eine (1). Der Wert ist kein Schmuck: er ist die
    -- Liste dessen, was nach einem Schlüsselwechsel noch neu zu verschlüsseln
    -- ist, und ohne ihn ist ein Wechsel nicht durchführbar.
    key_version integer NOT NULL DEFAULT 1 CHECK (key_version >= 1),
    -- Zuletzt beim Anbieter bestätigt (der Prüfknopf, und nur wenn der
    -- geprüfte Schlüssel der HINTERLEGTE war).
    last_verified_at timestamptz,
    -- Zuletzt für einen echten Aufruf hergegeben. Stündlich gestempelt, nicht
    -- pro Aufruf — die Auskunft „wird noch benutzt" braucht keine Sekunden.
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);

COMMENT ON TABLE public.user_api_keys IS
    'Persönliche API-Schlüssel, eine Zeile je (Nutzer, Anbieter). Ersetzt user_wallets.encrypted_* (Migr. 333). Der Geheimtext verlässt die Datenbank nur über den service_role-Client.';

CREATE TRIGGER trg_user_api_keys_updated_at
    BEFORE UPDATE ON public.user_api_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. RLS: der Geheimtext ist serverseitig, Punkt ────────────────────────
--
-- Die alte Wallet-Regel erlaubte dem Besitzer `SELECT` auf die eigene Zeile,
-- also auch auf `encrypted_openrouter_key` (Befund 9). Für den EIGENEN
-- Schlüssel ist das kein Geheimnisbruch — man hat ihn selbst getippt — aber es
-- ist auch kein Nutzen: die Oberfläche zeigt nie mehr als „hinterlegt / nicht
-- hinterlegt", und alles, was den Klartext braucht, läuft im Server.
-- Deshalb bekommt `authenticated` hier KEINE Leseregel. RLS ist eingeschaltet
-- und leer: `service_role` umgeht sie, alle anderen sehen nichts. Geschrieben
-- wird über die SECURITY-DEFINER-Funktionen weiter unten, die sich selbst an
-- `auth.uid()` prüfen.
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage all API keys"
    ON public.user_api_keys FOR ALL
    USING ((SELECT is_platform_admin()));

-- ── 3. Rückfüllung aus den zwei Spalten ───────────────────────────────────

INSERT INTO public.user_api_keys (user_id, provider, encrypted_key, key_version)
SELECT user_id, 'openrouter', encrypted_openrouter_key, 1
FROM public.user_wallets
WHERE encrypted_openrouter_key IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;

INSERT INTO public.user_api_keys (user_id, provider, encrypted_key, key_version)
SELECT user_id, 'replicate', encrypted_replicate_key, 1
FROM public.user_wallets
WHERE encrypted_replicate_key IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;

-- ── 4. Schreiben: eine Funktion je Vorgang, Identität aus auth.uid() ──────
--
-- Kein `p_user_id` mehr. Die stärkste Form der Selbstprüfung aus ADR-006 ist
-- die, bei der es gar keinen fremden Nutzer zu übergeben GIBT — dieselbe Form
-- wie die DRIFT-Spieleraktionen. Damit kann die Verwechslung aus Migration
-- 330 (Service-Role-JWT ohne `sub`) hier nicht einmal formuliert werden: ohne
-- angemeldeten Aufrufer bricht die Funktion ab.

CREATE OR REPLACE FUNCTION public.fn_set_user_api_key(
    p_provider text,
    p_encrypted_key text,
    p_key_version integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_provider NOT IN ('openrouter', 'replicate') THEN
        RAISE EXCEPTION 'Unknown provider: %', p_provider;
    END IF;
    IF p_encrypted_key IS NULL OR length(p_encrypted_key) = 0 THEN
        RAISE EXCEPTION 'Empty key';
    END IF;

    INSERT INTO public.user_api_keys (user_id, provider, encrypted_key, key_version)
    VALUES (v_user, p_provider, p_encrypted_key, p_key_version)
    ON CONFLICT (user_id, provider) DO UPDATE
    SET encrypted_key = EXCLUDED.encrypted_key,
        key_version = EXCLUDED.key_version,
        -- Ein NEUER Schlüssel ist nicht der geprüfte alte.
        last_verified_at = NULL,
        updated_at = now();

    -- Echo in die alten Spalten, solange sie existieren. Fällt mit ihnen.
    UPDATE public.user_wallets
    SET encrypted_openrouter_key = CASE WHEN p_provider = 'openrouter' THEN p_encrypted_key ELSE encrypted_openrouter_key END,
        encrypted_replicate_key  = CASE WHEN p_provider = 'replicate'  THEN p_encrypted_key ELSE encrypted_replicate_key  END,
        updated_at = now()
    WHERE user_id = v_user;

    RETURN jsonb_build_object('success', true, 'message', 'Key stored.');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_clear_user_api_key(p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_provider NOT IN ('openrouter', 'replicate') THEN
        RAISE EXCEPTION 'Unknown provider: %', p_provider;
    END IF;

    DELETE FROM public.user_api_keys WHERE user_id = v_user AND provider = p_provider;

    UPDATE public.user_wallets
    SET encrypted_openrouter_key = CASE WHEN p_provider = 'openrouter' THEN NULL ELSE encrypted_openrouter_key END,
        encrypted_replicate_key  = CASE WHEN p_provider = 'replicate'  THEN NULL ELSE encrypted_replicate_key  END,
        updated_at = now()
    WHERE user_id = v_user;

    RETURN jsonb_build_object('success', true, 'message', 'Key removed.');
END;
$$;

-- Der Prüfknopf stempelt, WENN der geprüfte Schlüssel der hinterlegte war.
-- Der Vergleich passiert im Server (er hat den Klartext); hier kommt nur die
-- Bestätigung an.
CREATE OR REPLACE FUNCTION public.fn_mark_user_api_key_verified(p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_count integer;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.user_api_keys
    SET last_verified_at = now()
    WHERE user_id = v_user AND provider = p_provider;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object('success', v_count > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_user_api_key(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_user_api_key(text, text, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_clear_user_api_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clear_user_api_key(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_mark_user_api_key_verified(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mark_user_api_key_verified(text) TO authenticated, service_role;

-- ── 5. Der alte Weg schreibt mit, bis der neue Stand läuft ────────────────

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
BEGIN
    -- DEPRECIERT seit Migration 333. Bleibt genau so lange stehen, wie ein
    -- Backend-Stand vor dem Deploy sie noch rufen kann; danach fällt sie
    -- zusammen mit `user_wallets.encrypted_*`. Der Rumpf schreibt in die neue
    -- Tabelle, damit es auch in diesem Fenster nur EINE Wahrheit gibt.
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update another user''s keys';
    END IF;

    IF p_clear_openrouter THEN
        PERFORM public.fn_clear_user_api_key('openrouter');
    ELSIF p_encrypted_openrouter_key IS NOT NULL THEN
        PERFORM public.fn_set_user_api_key('openrouter', p_encrypted_openrouter_key, 1);
    END IF;

    IF p_clear_replicate THEN
        PERFORM public.fn_clear_user_api_key('replicate');
    ELSIF p_encrypted_replicate_key IS NOT NULL THEN
        PERFORM public.fn_set_user_api_key('replicate', p_encrypted_replicate_key, 1);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
END;
$$;

-- ── 6. Lesen: der Widerruf muss auch WIRKEN ──────────────────────────────
--
-- BEFUND 6. `byok_allowed = false` sperrte bisher nur Schreiben und Testen.
-- Der Lesepfad (`ForgeDraftService.get_user_keys`) fragte nie nach der
-- Erlaubnis — ein Widerruf schloss also die Tür vor einem Schlüssel, der
-- dahinter weiterlief. Wer die Politik plattformweit auf `none` stellte,
-- änderte an laufenden Aufrufen gar nichts.
--
-- Die Prüfung gehört in dieselbe Abfrage wie das Lesen, nicht daneben: sonst
-- ist sie eine Zeile, die man an der nächsten Aufrufstelle vergisst. Die
-- Funktion gibt die Geheimtexte nur heraus, wenn die Politik es erlaubt, und
-- ist ausschliesslich über `service_role` erreichbar.
CREATE OR REPLACE FUNCTION public.fn_get_user_api_keys(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_keys jsonb;
BEGIN
    IF NOT fn_user_byok_allowed(p_user_id) THEN
        RETURN '{}'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_object_agg(provider, encrypted_key), '{}'::jsonb)
    INTO v_keys
    FROM user_api_keys
    WHERE user_id = p_user_id;

    RETURN v_keys;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_user_api_keys(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_user_api_keys(uuid) TO service_role;

-- Und die Erlaubnis selbst kennt jetzt den Plattform-Admin. Die SQL-Fassung
-- `is_platform_admin()` liest `auth.uid()` und ist damit auf dem
-- service_role-Client blind; die Tabelle `platform_admins` trägt dieselbe
-- Auskunft ohne angemeldeten Aufrufer. Ohne diesen Zweig wäre der Admin an
-- den drei Toren (Schreiben, Zusammenfassung, Lesen) unterschiedlich
-- behandelt worden — er dürfte einen Schlüssel hinterlegen, und der Lesepfad
-- benutzte ihn nicht. Die E-Mail-Liste aus der Umgebung
-- (`PLATFORM_ADMIN_EMAILS`) kennt SQL weiterhin nicht; für sie bleibt der
-- Python-Riegel in `ForgeDraftService.check_byok_allowed(is_admin=…)`.
CREATE OR REPLACE FUNCTION public.fn_user_byok_allowed(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_policy text;
    v_per_user boolean;
BEGIN
    IF EXISTS (SELECT 1 FROM platform_admins WHERE user_id = p_user_id) THEN
        RETURN true;
    END IF;

    SELECT setting_value #>> '{}' INTO v_policy
    FROM platform_settings WHERE setting_key = 'byok_access_policy';

    v_policy := COALESCE(v_policy, 'per_user');

    IF v_policy = 'none' THEN RETURN false; END IF;
    IF v_policy = 'all' THEN RETURN true; END IF;

    SELECT byok_allowed INTO v_per_user
    FROM user_wallets WHERE user_id = p_user_id;

    RETURN COALESCE(v_per_user, false);
END;
$$;

-- ── 7. Die Leser: eine Wahrheit ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_user_has_byok_bypass(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_bypass boolean;
    v_key_count integer;
    v_system_enabled boolean;
BEGIN
    IF NOT fn_user_byok_allowed(p_user_id) THEN
        RETURN false;
    END IF;

    -- Beide Schlüssel müssen daliegen: der Token-Erlass gilt erst, wenn die
    -- Plattform für gar nichts mehr zahlt.
    SELECT count(*) INTO v_key_count
    FROM user_api_keys
    WHERE user_id = p_user_id AND provider IN ('openrouter', 'replicate');
    IF v_key_count < 2 THEN
        RETURN false;
    END IF;

    SELECT COALESCE(byok_bypass, false) INTO v_bypass
    FROM user_wallets WHERE user_id = p_user_id;
    IF COALESCE(v_bypass, false) THEN
        RETURN true;
    END IF;

    SELECT (setting_value = 'true'::jsonb) INTO v_system_enabled
    FROM platform_settings WHERE setting_key = 'byok_bypass_enabled';

    RETURN COALESCE(v_system_enabled, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_wallet_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_forge_tokens integer;
    v_is_architect boolean;
    v_account_tier text;
    v_byok_bypass boolean;
    v_has_openrouter_key boolean;
    v_has_replicate_key boolean;
    v_openrouter_verified_at timestamptz;
    v_replicate_verified_at timestamptz;
    v_system_enabled boolean;
    v_access_policy text;
BEGIN
    SELECT COALESCE(w.forge_tokens, 0),
           COALESCE(w.is_architect, false),
           COALESCE(w.account_tier, 'observer'),
           COALESCE(w.byok_bypass, false)
    INTO v_forge_tokens, v_is_architect, v_account_tier, v_byok_bypass
    FROM (SELECT p_user_id AS uid) q
    LEFT JOIN user_wallets w ON w.user_id = q.uid;

    SELECT EXISTS (SELECT 1 FROM user_api_keys WHERE user_id = p_user_id AND provider = 'openrouter'),
           EXISTS (SELECT 1 FROM user_api_keys WHERE user_id = p_user_id AND provider = 'replicate'),
           (SELECT last_verified_at FROM user_api_keys WHERE user_id = p_user_id AND provider = 'openrouter'),
           (SELECT last_verified_at FROM user_api_keys WHERE user_id = p_user_id AND provider = 'replicate')
    INTO v_has_openrouter_key, v_has_replicate_key,
         v_openrouter_verified_at, v_replicate_verified_at;

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
            -- „Hinterlegt" ist keine Auskunft über Gültigkeit. Diese zwei
            -- sind es: wann der HINTERLEGTE Schlüssel zuletzt beim Anbieter
            -- durchging. NULL heisst „noch nie geprüft", nicht „ungültig".
            'openrouter_verified_at', v_openrouter_verified_at,
            'replicate_verified_at', v_replicate_verified_at,
            'byok_allowed', fn_user_byok_allowed(p_user_id),
            'byok_bypass', v_byok_bypass,
            'system_bypass_enabled', v_system_enabled,
            'effective_bypass', fn_user_has_byok_bypass(p_user_id),
            'access_policy', v_access_policy
        )
    );
END;
$$;

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
            COALESCE(uw.byok_allowed, false) AS byok_allowed,
            COALESCE(uw.byok_bypass, false) AS byok_bypass,
            EXISTS (SELECT 1 FROM public.user_api_keys k
                    WHERE k.user_id = au.id AND k.provider = 'openrouter') AS has_openrouter_key,
            EXISTS (SELECT 1 FROM public.user_api_keys k
                    WHERE k.user_id = au.id AND k.provider = 'replicate') AS has_replicate_key
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

REVOKE ALL ON FUNCTION public.admin_get_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user(uuid) TO service_role;

-- ── 8. Selbstprüfung (fail-closed) ────────────────────────────────────────
DO $$
DECLARE
    v_bad text;
    v_wallet_keys integer;
    v_table_keys integer;
BEGIN
    -- Die Rückfüllung muss vollständig sein.
    SELECT count(*) INTO v_wallet_keys FROM public.user_wallets
    WHERE encrypted_openrouter_key IS NOT NULL OR encrypted_replicate_key IS NOT NULL;
    SELECT count(DISTINCT user_id) INTO v_table_keys FROM public.user_api_keys;
    IF v_table_keys < v_wallet_keys THEN
        RAISE EXCEPTION 'Migration 333 FAILED: Rückfüllung unvollständig (% Geldbörsen mit Schlüssel, % Zeilen)',
            v_wallet_keys, v_table_keys;
    END IF;

    -- Der Geheimtext darf für anon/authenticated nicht lesbar sein.
    IF has_table_privilege('anon', 'public.user_api_keys', 'SELECT')
       AND EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'user_api_keys' AND 'anon' = ANY(roles)) THEN
        RAISE EXCEPTION 'Migration 333 FAILED: anon hat eine Leseregel auf user_api_keys';
    END IF;

    -- Die neuen Funktionen dürfen nicht anon-aufrufbar sein.
    SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_set_user_api_key', 'fn_clear_user_api_key', 'fn_mark_user_api_key_verified')
      AND has_function_privilege('anon', p.oid, 'EXECUTE');
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 333 FAILED: anon-aufrufbar: %', v_bad;
    END IF;
END $$;

COMMIT;
