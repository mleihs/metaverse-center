-- ============================================================================
-- 323 · Die Leiter muss lesen können, wer auf ihr steht
-- ============================================================================
--
-- Das Frontend soll den Bauzustand als Position auf der Leiter DIESER Welt
-- anzeigen statt gegen eine feste Fünferliste zu vergleichen (10 Bauten auf der
-- HÖCHSTEN Sprosse ihrer Welt zeigten deshalb einen leeren Edelstein). Dafür
-- braucht die Taxonomie-Antwort neben jedem Wort seine Sprosse.
--
-- Die Sprosse darf nicht in Python nachgerechnet werden. Die Vorrangregel —
-- erst `metadata.rung` einer Welt, dann die Sprossenkarte der Plattform — steht
-- in `fn_building_condition_ladder(uuid)`, und eine zweite Fassung davon in
-- einem Service wäre die dritte Kopie derselben Regel an einem Tag, an dem
-- genau das schon dreimal etwas kaputt gemacht hat.
--
-- Gemessen: die Funktion ist für `authenticated` und `anon` nicht aufrufbar.
--
--     fn_building_condition_ladder(uuid)   postgres=X | service_role=X
--
-- Sie hat die Rechte ihrer Vorgängerin geerbt: `CREATE OR REPLACE` behält die
-- bestehende ACL, und weil sie ursprünglich nur intern (aus `fn_degrade_building`
-- heraus) gebraucht wurde, stand dort nie mehr. Ein Aufruf über PostgREST mit
-- einem Nutzer-JWT — und `get_effective_supabase` gibt für gewöhnliche Nutzer
-- genau den — schlüge fehl.
--
-- WARUM DIESE FREIGABE SICHER IST, und warum die Regel aus CLAUDE.md hier
-- NICHT greift:
--
-- Verboten ist EXECUTE für `anon`/`authenticated` auf SECURITY-DEFINER-
-- Funktionen — die laufen als ihr Eigentümer und hebeln damit sowohl RLS als
-- auch das `Depends()`-Rollentor aus (ADR-006, Vorfall 096→147).
--
--     fn_building_condition_ladder(uuid)   prosecdef = false
--
-- Sie ist SECURITY INVOKER. Sie läuft als der Aufrufer, liest ausschliesslich
-- `simulation_taxonomies`, und die RLS dieser Tabelle greift unverändert: wer
-- die Taxonomiezeile nicht sehen darf, bekommt ihre Sprosse auch nicht. Sie
-- nimmt eine `simulation_id` entgegen und gibt nichts zurück, was der Aufrufer
-- nicht ohnehin über `GET /public/simulations/{id}/taxonomies` liest — sie sagt
-- nur, in welcher REIHENFOLGE die Wörter stehen. `scripts/lint-no-secdef-public-grant.sh`
-- prüft die SECDEF-Oberfläche und ist von dieser Freigabe nicht berührt.
--
-- NACHTRAG ZU 322, damit die Freigabe dort keine unbemerkte bleibt:
-- `fn_building_condition_rungs()` hat bei ihrer Erzeugung EXECUTE für `anon` und
-- `authenticated` bekommen, ohne dass 322 das geschrieben hätte — auf Supabase
-- teilt `pg_default_acl` jeder NEU angelegten Funktion diese Rechte direkt zu
-- (deshalb sieht man beim ERSETZEN einer bestehenden Funktion die alten Rechte
-- und lernt das falsche Muster). Sie bleibt lesbar, und zwar absichtlich: sie
-- ist IMMUTABLE, nimmt keine Argumente, liest keine Tabelle und gibt eine
-- konstante Liste von neunzehn Wörtern mit ihrem Platz zurück. Hier steht das
-- als Entscheidung, damit es keine Fundsache bleibt.
--
-- Die Kernleiter `fn_building_condition_ladder()` (ohne Argument) bleibt
-- ABSICHTLICH bei `service_role`: sie beantwortet die Frage „welche Wörter muss
-- jede Welt führen" und wird nur von `fn_materialize_shard` gebraucht. Wer sie
-- von aussen liest, liest die falsche Frage (siehe 322).
-- ============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.fn_building_condition_ladder(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.fn_building_condition_ladder(uuid) IS
  'Die Leiter EINER Welt: jedes Zustandswort, das sie führt, mit seiner Sprosse '
  '(klein = besser). Vorrang: die eigene metadata.rung der Welt, sonst die '
  'Sprossenkarte der Plattform. SECURITY INVOKER — die RLS von '
  'simulation_taxonomies greift, deshalb ist sie seit Migration 323 auch für '
  'anon/authenticated aufrufbar und speist die rung-Spalte der Taxonomie-Antwort.';

COMMIT;
