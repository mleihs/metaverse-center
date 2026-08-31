-- 300 — Der Einfluss eines Agenten, einmal je Liste statt einmal je Agent
--
-- D13 / H7. `fn_compute_agent_influence(agent, simulation)` gibt es seit
-- Migration 158, aber sie speist ausschließlich `mv_building_readiness`. Es gibt
-- kein agentenbezogenes Feld, an dem der Wert abrufbar wäre.
--
-- Die Folge stand im Frontend: `AgentDetailsPanel._computeInfluence` rechnete
-- die Formel im Browser NACH. Das ist die vierte handkopierte Formel im Werk
-- (S21 zählt drei, eine davon nachweislich abgewichen). Und die Agentenkarte
-- konnte den Einfluss überhaupt nicht zeigen: sie kennt die Beziehungen des
-- Agenten nicht, und eine halbe Zahl auf die Karte zu schreiben wäre genau der
-- Zustand, den H7 gerade beseitigt hat.
--
-- Warum eine Stapelfunktion und nicht ein Aufruf je Agent
-- ------------------------------------------------------
-- Eine Agentenliste zeigt 20 Karten. Zwanzig `.rpc()`-Aufrufe wären zwanzig
-- Umläufe für eine Zahl, die eine einzige `STABLE`-Abfrage liefert. Der
-- Rückgabetyp ist bewusst schmal (Kennung + Wert): die drei Bestandteile
-- rechnet niemand mehr selbst, sie stehen als Aufschlüsselung ohnehin schon im
-- Panel.
--
-- Warum KEIN SECURITY DEFINER
-- ---------------------------
-- `fn_compute_agent_influence` läuft als INVOKER, RLS gilt also für den
-- Aufrufer. Diese Hülle bleibt dabei. Damit gilt der ADR-006-Vorbehalt gegen
-- anon-aufrufbare Funktionen hier nicht: die Funktion kann nichts sehen, was
-- der Aufrufer nicht ohnehin sehen darf, und der öffentliche Leseweg
-- (`/api/v1/public/simulations/{id}/agents`) braucht denselben Wert.

CREATE OR REPLACE FUNCTION public.fn_agent_influence_batch(
  p_simulation_id uuid,
  p_agent_ids uuid[]
)
RETURNS TABLE (agent_id uuid, influence numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    a.id,
    public.fn_compute_agent_influence(a.id, p_simulation_id)
  FROM unnest(p_agent_ids) AS a(id)
$function$;

COMMENT ON FUNCTION public.fn_agent_influence_batch(uuid, uuid[]) IS
  'Einfluss mehrerer Agenten in einem Aufruf. Hülle um fn_compute_agent_influence (Migr. 158). SECURITY INVOKER: RLS gilt für den Aufrufer.';

-- Beide Rollen: der öffentliche Leseweg zeigt dieselben Karten wie der
-- angemeldete. Ohne den anon-Grant hätte die Karte für Besucher kein Symbol,
-- und die Oberfläche unterschiede sich je nachdem, wer zusieht.
GRANT EXECUTE ON FUNCTION public.fn_agent_influence_batch(uuid, uuid[]) TO anon, authenticated;
