-- Migration 335: Ein Schlüssel braucht ein Gesicht — und einen Weg, um einen zu bitten
--
-- Grundlage für die Design-Übergabe „Personalakte & Schlüsselbund". Drei
-- Lücken, die die Oberfläche sonst nur verstecken könnte:
--
--   1. KEIN GESICHT. Bisher weiß die Karte nur, DASS ein Schlüssel hinterlegt
--      ist. Wer zwei Konten bei einem Anbieter hat, kann nicht erkennen,
--      welches hier liegt, und wer einen Schlüssel beim Anbieter zurückzieht,
--      sieht hier keinen Unterschied. Vier Zeichen genügen dafür — dieselbe
--      Auskunft, die jede Kreditkartenabrechnung gibt, und kein Geheimnis:
--      aus vier Zeichen eines ~73 Zeichen langen Schlüssels folgt nichts.
--   2. KEIN NACHPRÜFEN. `last_verified_at` (Migr. 333) wird nur gestempelt,
--      wenn jemand denselben Schlüssel noch einmal EINTIPPT. Der hinterlegte
--      Schlüssel selbst war nie prüfbar — dabei ist genau das die Frage, die
--      zählt: trägt er noch? Der Server hat den Klartext, also kann er fragen.
--   3. KEIN WEG ZU BITTEN. Die Politik ist `per_user`, und auf Produktion ist
--      NIEMAND freigeschaltet. Für alle diese Konten ist die Sache heute eine
--      Tür ohne Klinke: kein Formular, kein Hinweis, keine Möglichkeit zu
--      fragen. Ein Antrag ist die Klinke — und für den Admin ein Eingang, in
--      dem etwas ankommt, statt einer Liste, die er von sich aus durchgehen
--      müsste.

BEGIN;

-- ── 1. Das Gesicht ─────────────────────────────────────────────────────────

ALTER TABLE public.user_api_keys
    ADD COLUMN IF NOT EXISTS key_last4 text
        CHECK (key_last4 IS NULL OR length(key_last4) <= 8);

COMMENT ON COLUMN public.user_api_keys.key_last4 IS
    'Letzte Zeichen des Klartextschlüssels, damit die Karte eine Kennung zeigen kann (sk-or-v1-•••••7f3a). Kein Geheimnis; der Rest bleibt verschlüsselt.';

-- Signatur ändert sich → erst DROP, sonst entsteht eine ÜBERLADUNG und jedes
-- spätere REVOKE/GRANT scheitert mit „function name is not unique"
-- (die Lehre von Migration 218).
DROP FUNCTION IF EXISTS public.fn_set_user_api_key(text, text, integer);

CREATE OR REPLACE FUNCTION public.fn_set_user_api_key(
    p_provider text,
    p_encrypted_key text,
    p_key_version integer DEFAULT 1,
    p_last4 text DEFAULT NULL
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

    INSERT INTO public.user_api_keys (user_id, provider, encrypted_key, key_version, key_last4)
    VALUES (v_user, p_provider, p_encrypted_key, p_key_version, p_last4)
    ON CONFLICT (user_id, provider) DO UPDATE
    SET encrypted_key = EXCLUDED.encrypted_key,
        key_version = EXCLUDED.key_version,
        key_last4 = EXCLUDED.key_last4,
        -- Ein NEUER Schlüssel ist nicht der geprüfte alte.
        last_verified_at = NULL,
        updated_at = now();

    -- Echo in die alten Spalten, solange sie existieren (Migr. 333 §5).
    UPDATE public.user_wallets
    SET encrypted_openrouter_key = CASE WHEN p_provider = 'openrouter' THEN p_encrypted_key ELSE encrypted_openrouter_key END,
        encrypted_replicate_key  = CASE WHEN p_provider = 'replicate'  THEN p_encrypted_key ELSE encrypted_replicate_key  END,
        updated_at = now()
    WHERE user_id = v_user;

    RETURN jsonb_build_object('success', true, 'message', 'Key stored.');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_user_api_key(text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_set_user_api_key(text, text, integer, text) TO authenticated, service_role;

-- Der alte Weg (deprecated seit 333) ruft die Funktion mit drei Argumenten;
-- nach dem DROP gäbe es die nicht mehr. Er wird auf die neue Signatur
-- umgestellt und reicht kein `last4` durch — ein Schlüssel, der über den
-- alten Weg kommt, hat eben kein Gesicht, bis er einmal neu gesetzt wird.
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
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update another user''s keys';
    END IF;

    IF p_clear_openrouter THEN
        PERFORM public.fn_clear_user_api_key('openrouter');
    ELSIF p_encrypted_openrouter_key IS NOT NULL THEN
        PERFORM public.fn_set_user_api_key('openrouter', p_encrypted_openrouter_key, 1, NULL);
    END IF;

    IF p_clear_replicate THEN
        PERFORM public.fn_clear_user_api_key('replicate');
    ELSIF p_encrypted_replicate_key IS NOT NULL THEN
        PERFORM public.fn_set_user_api_key('replicate', p_encrypted_replicate_key, 1, NULL);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Keys updated successfully.');
END;
$$;

-- ── 2. Die Frische-Schwelle ────────────────────────────────────────────────

INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
    'byok_stale_days',
    '90'::jsonb,
    'Nach so vielen Tagen ohne Bestätigung beim Anbieter trägt ein hinterlegter Schlüssel einen Vermerk.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- ── 3. Der Antrag ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.byok_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes text,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz
);

COMMENT ON TABLE public.byok_requests IS
    'Antrag eines Kontos auf Freigabe für eigene API-Schlüssel. Gegenstück zu user_wallets.byok_allowed unter der Politik per_user.';

-- Ein offener Antrag je Konto — sonst wird der Eingang zur Warteschlange
-- desselben Menschen.
CREATE UNIQUE INDEX IF NOT EXISTS idx_byok_requests_one_pending
    ON public.byok_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_byok_requests_pending
    ON public.byok_requests (status) WHERE status = 'pending';

ALTER TABLE public.byok_requests ENABLE ROW LEVEL SECURITY;

-- Die Hilfsaufrufe stehen in `(SELECT …)`, damit Postgres sie EINMAL je
-- Anweisung auswertet statt je Zeile (initPlan, Migration 183). Migration 093
-- schrieb sie noch nackt; das Muster hier ist das aktuelle.
CREATE POLICY "Users read own byok requests"
    ON public.byok_requests FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users create own byok requests"
    ON public.byok_requests FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Platform admins manage byok requests"
    ON public.byok_requests FOR ALL
    USING ((SELECT is_platform_admin()));

-- Freigeben ist zwei Schreibvorgänge, die zusammengehören: den Antrag
-- abhaken UND die Erlaubnis setzen. Getrennt ausgeführt gäbe es den Zustand
-- „genehmigt, aber nicht freigeschaltet" — genau die Sorte halber Reparatur,
-- die hinterher niemand findet. Die Geldbörse wird per Upsert angelegt, falls
-- es keine gibt (Migr. 330: eine Zeile dort ist Metadaten der Person, kein
-- Ausweis der Schmiede).
CREATE OR REPLACE FUNCTION public.fn_resolve_byok_request(
    p_request_id uuid,
    p_approve boolean,
    p_reviewer_id uuid,
    p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request record;
BEGIN
    SELECT * INTO v_request
    FROM public.byok_requests
    WHERE id = p_request_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found or already reviewed.');
    END IF;

    UPDATE public.byok_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        admin_notes = p_admin_notes,
        reviewed_by = p_reviewer_id,
        reviewed_at = now()
    WHERE id = p_request_id;

    IF p_approve THEN
        INSERT INTO public.user_wallets (user_id, account_tier, byok_allowed)
        VALUES (v_request.user_id, 'observer', true)
        ON CONFLICT (user_id) DO UPDATE SET byok_allowed = true, updated_at = now();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_request.user_id,
        'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
    );
END;
$$;

-- Vertraut seinen ID-Parametern (kein auth.uid()-Selbstschutz), also
-- service_role-only: der Router prüft `require_platform_admin()` davor.
-- ADR-006, Migrationen 257/258.
REVOKE ALL ON FUNCTION public.fn_resolve_byok_request(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolve_byok_request(uuid, boolean, uuid, text) TO service_role;

-- ── 4. Die Zusammenfassung zeigt das Gesicht ───────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_wallet_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_forge_tokens integer;
    v_is_architect boolean;
    v_account_tier text;
    v_byok_bypass boolean;
    v_has_or boolean;
    v_has_rep boolean;
    v_or_last4 text;
    v_rep_last4 text;
    v_or_verified timestamptz;
    v_rep_verified timestamptz;
    v_or_used timestamptz;
    v_rep_used timestamptz;
    v_system_enabled boolean;
    v_access_policy text;
    v_stale_days integer;
    v_request_status text;
BEGIN
    SELECT COALESCE(w.forge_tokens, 0),
           COALESCE(w.is_architect, false),
           COALESCE(w.account_tier, 'observer'),
           COALESCE(w.byok_bypass, false)
    INTO v_forge_tokens, v_is_architect, v_account_tier, v_byok_bypass
    FROM (SELECT p_user_id AS uid) q
    LEFT JOIN user_wallets w ON w.user_id = q.uid;

    -- Je Anbieter in EINER Abfrage, und die Existenz kommt aus EXISTS statt
    -- aus `record IS NOT NULL`: bei einem record heisst das in Postgres „ALLE
    -- Felder sind nicht null", nicht „eine Zeile wurde gefunden" — ein
    -- Schlüssel ohne Prüfdatum wäre damit als nicht vorhanden gemeldet worden.
    SELECT EXISTS (SELECT 1 FROM user_api_keys WHERE user_id = p_user_id AND provider = 'openrouter'),
           EXISTS (SELECT 1 FROM user_api_keys WHERE user_id = p_user_id AND provider = 'replicate')
    INTO v_has_or, v_has_rep;

    SELECT key_last4, last_verified_at, last_used_at
    INTO v_or_last4, v_or_verified, v_or_used
    FROM user_api_keys WHERE user_id = p_user_id AND provider = 'openrouter';

    SELECT key_last4, last_verified_at, last_used_at
    INTO v_rep_last4, v_rep_verified, v_rep_used
    FROM user_api_keys WHERE user_id = p_user_id AND provider = 'replicate';

    SELECT COALESCE((setting_value = 'true'::jsonb), false)
    INTO v_system_enabled
    FROM platform_settings WHERE setting_key = 'byok_bypass_enabled';
    v_system_enabled := COALESCE(v_system_enabled, false);

    SELECT COALESCE(setting_value #>> '{}', 'per_user')
    INTO v_access_policy
    FROM platform_settings WHERE setting_key = 'byok_access_policy';
    v_access_policy := COALESCE(v_access_policy, 'per_user');

    SELECT COALESCE((setting_value #>> '{}')::integer, 90)
    INTO v_stale_days
    FROM platform_settings WHERE setting_key = 'byok_stale_days';
    v_stale_days := COALESCE(v_stale_days, 90);

    -- Damit die Oberfläche „Anfrage liegt beim Bureau" zeigen kann, statt den
    -- Antrag nach dem Absenden zu vergessen.
    SELECT status INTO v_request_status
    FROM byok_requests WHERE user_id = p_user_id
    ORDER BY created_at DESC LIMIT 1;

    RETURN jsonb_build_object(
        'forge_tokens', v_forge_tokens,
        'is_architect', v_is_architect,
        'account_tier', v_account_tier,
        'byok_status', jsonb_build_object(
            'has_openrouter_key', v_has_or,
            'has_replicate_key', v_has_rep,
            'openrouter_last4', v_or_last4,
            'replicate_last4', v_rep_last4,
            'openrouter_verified_at', v_or_verified,
            'replicate_verified_at', v_rep_verified,
            'openrouter_last_used_at', v_or_used,
            'replicate_last_used_at', v_rep_used,
            'byok_allowed', fn_user_byok_allowed(p_user_id),
            'byok_bypass', v_byok_bypass,
            'system_bypass_enabled', v_system_enabled,
            'effective_bypass', fn_user_has_byok_bypass(p_user_id),
            'access_policy', v_access_policy,
            'stale_after_days', v_stale_days,
            'request_status', v_request_status
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_get_wallet_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_wallet_summary(uuid) TO authenticated, service_role;

-- ── 5. Selbstprüfung (fail-closed) ─────────────────────────────────────────
DO $$
DECLARE
    v_bad text;
BEGIN
    SELECT string_agg(p.proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_set_user_api_key', 'fn_resolve_byok_request', 'fn_get_wallet_summary')
      AND has_function_privilege('anon', p.oid, 'EXECUTE');
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'Migration 335 FAILED: anon-aufrufbar: %', v_bad;
    END IF;

    IF has_function_privilege('authenticated', 'public.fn_resolve_byok_request(uuid, boolean, uuid, text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Migration 335 FAILED: fn_resolve_byok_request ist authenticated-aufrufbar (vertraut seinen ID-Parametern)';
    END IF;

    -- Nach dem DROP darf es GENAU EINE fn_set_user_api_key geben.
    SELECT count(*)::text INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_set_user_api_key';
    IF v_bad <> '1' THEN
        RAISE EXCEPTION 'Migration 335 FAILED: % Überladungen von fn_set_user_api_key', v_bad;
    END IF;
END $$;

COMMIT;
