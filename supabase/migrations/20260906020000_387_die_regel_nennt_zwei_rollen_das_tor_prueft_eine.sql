-- Migration 387: Die Regel nennt zwei Rollen, das Tor prueft eine
--
-- Gefunden am 05.09.2026 beim Nachpruefen eines ganz anderen Verdachts (der
-- sich als unbegruendet erwies: 238 und 187 sind wirkungsseitig angewandt).
--
-- ── DER BEFUND ──────────────────────────────────────────────────────────────
--
-- Drei Funktionen sind SECURITY DEFINER, fuer `authenticated` aufrufbar,
-- nehmen eine FREMDE Nutzerkennung als Parameter und pruefen `auth.uid()`
-- nicht:
--
--     fn_get_wallet_summary(p_user_id uuid)     -> jsonb
--     fn_user_byok_allowed(p_user_id uuid)      -> boolean
--     fn_user_has_byok_bypass(p_user_id uuid)   -> boolean
--
-- SECURITY DEFINER heisst: die Funktion laeuft als ihr Eigentuemer, RLS greift
-- also nicht. PostgREST stellt jede EXECUTE-berechtigte Funktion unter
-- `/rest/v1/rpc/<name>` bereit. Damit kann JEDER angemeldete Nutzer die
-- Guthabenuebersicht und die BYOK-Berechtigung eines BELIEBIGEN anderen lesen,
-- indem er dessen Kennung uebergibt.
--
-- 🔑 Die Berechtigungspruefung ist vollstaendig in die Aufrufstelle ausgelagert
-- — und PostgREST ist eine Aufrufstelle, die diese Pruefung nicht kennt. Genau
-- die Bauart des Vorfalls 096 -> 147.
--
-- ── WIE GROSS ES IST, UND WIE GROSS NICHT ───────────────────────────────────
--
-- ⚠ Es geht NICHT um Schluesselmaterial. `fn_get_user_api_keys`, die den
-- verschluesselten OpenRouter-/Replicate-Schluessel herausgibt, ist bereits
-- service_role-only (authenticated=f, anon=f) — nachgemessen. Betroffen sind
-- eine Berechtigungsauskunft (zwei Boolesche) und eine Guthabenuebersicht.
--
-- Ebenfalls NICHT betroffen: `anon`. Die drei sind fuer den oeffentlichen
-- Schluessel nicht aufrufbar, und `lint-no-secdef-public-grant.sh` haelt diese
-- Haelfte seit jeher — gegen die Abfrage des Tors meldet Prod `(keine)`.
--
-- Kein Schreibzugriff. Es ist eine Informationspreisgabe zwischen angemeldeten
-- Nutzern, kein Rechteaufstieg.
--
-- ── WARUM ES NIEMANDEM AUFFIEL ──────────────────────────────────────────────
--
-- Die Regel in CLAUDE.md nennt `anon` ODER `authenticated`. Das Tor fragt nur
-- nach `anon`. Eine Regel mit zwei Rollen und ein Tor mit einer — die
-- ungeprueftte Haelfte ist die Stelle, an der so etwas liegen bleibt.
--
-- Gemessen auf Prod, um die Ausnahmen NICHT mitzureissen:
--
--     SECDEF fuer authenticated aufrufbar (ohne Trigger)   28
--       davon mit Nutzerkennung als Parameter               4
--         davon auth.uid() GEGEN den Parameter geprueft     1  fn_update_user_byok_keys
--         davon ungeprueft                                  3  <- diese Migration
--       davon ohne Nutzerkennung                           24  strukturell sicher
--
-- ⚠ Die Zahl 24 stammt aus der SCHAERFEREN Frage. Ein erster Durchgang zaehlte
-- „22 pruefen auth.uid()" per Textmuster — das haette eine Funktion als
-- Ausnahme durchgehen lassen, die `auth.uid()` liest und trotzdem einen fremden
-- Parameter verarbeitet. Der Hinweis darauf kam von `Frontseite-Redesign`.
--
-- ── DIE REIHENFOLGE IST NICHT BELIEBIG ──────────────────────────────────────
--
-- ⚠ Das REVOKE ALLEIN BRICHT DIE SCHMIEDE. Beide Aufrufstellen im Backend
-- (`routers/forge.py`, `_check_byok_access` und der `/wallet`-Endpunkt)
-- reichten bis heute `get_effective_supabase` durch — fuer nicht-administrative
-- Nutzer also den User-JWT-Klienten. Der Wechsel auf `admin_supabase` ist
-- verhaltensneutral (SECURITY DEFINER laeuft ohnehin als Eigentuemer, siehe
-- CLAUDE.md) und geht dieser Migration im selben Commit voraus.
--
-- Der Aufruf von `fn_user_byok_allowed` INNERHALB von `fn_get_user_api_keys`
-- ist unberuehrt: ein innerer Aufruf laeuft mit den Rechten des Eigentuemers,
-- nicht denen des Aufrufers. Die Selbstpruefung unten behauptet das nicht
-- blind, sondern prueft, dass die aeussere Funktion weiterhin existiert und
-- service_role-only bleibt.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_get_wallet_summary(uuid)    FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_user_byok_allowed(uuid)     FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_user_has_byok_bypass(uuid)  FROM authenticated, anon, PUBLIC;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Gegen die eigene WIRKUNG, nicht gegen den Bestand: darf `authenticated` die
-- drei noch ausfuehren? Das ist strukturell, laeuft auf einer leeren Datenbank
-- genauso und braucht keine einzige Datenzeile.
--
-- Und die Voraussetzung wird ehrlich gemacht: findet sie die Funktionen nicht,
-- sagt sie es LAUT. Ein Test, der besteht, weil er nichts zu pruefen fand, ist
-- kein bestandener Test.

DO $$
DECLARE
  vorhanden integer;
  offen     text;
  schluessel_offen boolean;
BEGIN
  SELECT count(*) INTO vorhanden
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('fn_get_wallet_summary','fn_user_byok_allowed','fn_user_has_byok_bypass');

  IF vorhanden = 0 THEN
    RAISE NOTICE 'Keine der drei Funktionen gefunden — Probe ausgesetzt. Wurden sie umbenannt? Dann gehoert diese Migration nachgezogen.';
  ELSE
    SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offen
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('fn_get_wallet_summary','fn_user_byok_allowed','fn_user_has_byok_bypass')
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE');

    IF offen IS NOT NULL THEN
      RAISE EXCEPTION 'authenticated darf weiterhin ausfuehren: %', offen;
    END IF;

    RAISE NOTICE 'Geprueft: % Funktion(en), keine davon fuer authenticated aufrufbar', vorhanden;
  END IF;

  -- Das Schluesselmaterial war schon zu und muss es bleiben. Diese Migration
  -- fasst es nicht an; die Probe steht hier, weil eine spaetere Aenderung an
  -- der BYOK-Kette es unbemerkt oeffnen koennte.
  SELECT bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    INTO schluessel_offen
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_get_user_api_keys';

  IF schluessel_offen THEN
    RAISE EXCEPTION 'fn_get_user_api_keys ist fuer authenticated aufrufbar — das gibt Schluesselmaterial heraus';
  END IF;
END $$;

COMMIT;
