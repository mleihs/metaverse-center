-- ============================================================================
-- 327 · Wo ein Agent gerade ist, wird an EINER Stelle beantwortet
-- ============================================================================
--
-- Der Entwurf verlangt für den Chat-Fensterkopf eine Statuszeile in Weltstimme
-- („Im Amt", „Unterwegs", „Im Auftrag", „Erreichbar"). Die Beschriftung gehört
-- ins Frontend, wo die Übersetzungen leben. Der ZUSTAND gehört hierher.
--
-- WARUM EINE SICHT UND NICHT DREI ROHFELDER IN DER ANTWORT
--
-- Der naheliegende Weg wäre gewesen, `current_building_id`, `current_zone_id`
-- und `is_ambassador` an die Chat-Antwort zu hängen und die Ableitung im
-- Frontend zu machen. Zwei Gründe dagegen, beide heute mehrfach belegt:
--
--   * Nennt morgen die Rundschau oder eine Mail denselben Status, schreibt sie
--     die Regel ein zweites Mal aus denselben Rohfeldern. Genau die Form, die
--     an diesem Tag fünfmal etwas kaputt gemacht hat.
--   * Zwei Kennungen ständen in jeder Chat-Antwort, obwohl niemand sie als
--     Kennungen braucht — mehr Oberfläche für nichts.
--
-- `active_ambassadors` beantwortet „ist Botschafter?" seit Migration 326 an
-- einer Stelle. Diese Sicht macht dasselbe für „wo ist er?".
--
-- DIE VORRANGREGEL IST GEMESSEN, NICHT GEWÄHLT
--
-- Auf Prod (31.08.2026), 258 Agenten:
--
--     Botschafter                     14
--       davon MIT Posten              14   ← vollständige Überschneidung
--       davon nur in einer Zone        0
--       davon ohne Ort                 0
--
-- Alle vierzehn haben auch ein `current_building_id`. Gewänne das Gebäude, wäre
-- `on_assignment` damit UNERREICHBAR — eine Beschriftung, deren Zustand nie
-- eintreten kann, also eine Tür, die sich nur für die öffnet, die schon drin
-- sind. Deshalb schlägt der Botschafter den Posten: dass jemand einen Posten
-- hat, sieht man an der Rollenzeile daneben; dass er im Auftrag unterwegs ist,
-- sonst nirgends.
--
-- ⚠ Wer diese Reihenfolge umdreht, tötet `on_assignment` lautlos. Der Grund
-- steht deshalb hier UND in `agentPresence()` im Frontend.
--
-- `security_invoker = on` ist Pflicht: eine Sicht ohne diese Einstellung läuft
-- als ihr Eigentümer, und die RLS von `agents` griffe nicht — sie stünde dann
-- von Hand in der WHERE-Klausel, wo sie beim nächsten Mal jemand vergisst.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.agent_presence
WITH (security_invoker = on) AS
SELECT
    a.simulation_id,
    a.id AS agent_id,
    CASE
        -- Botschafter zuerst. Siehe Messung im Kopf: sonst unerreichbar.
        WHEN EXISTS (
            SELECT 1 FROM public.active_ambassadors amb
             WHERE amb.agent_id = a.id
        ) THEN 'on_assignment'
        WHEN a.current_building_id IS NOT NULL THEN 'in_office'
        WHEN a.current_zone_id IS NOT NULL THEN 'travelling'
        ELSE 'reachable'
    END AS presence
FROM public.agents a
WHERE a.deleted_at IS NULL;

COMMENT ON VIEW public.agent_presence IS
  'Wo ein Agent gerade ist, als Zustand — nicht als Wort. Vorrang: Botschafter '
  'schlägt Posten schlägt Zone; ohne alles „erreichbar". Die Beschriftung macht '
  'das Frontend (agentPresence()), damit die Übersetzungen dort bleiben. '
  'Einzige Quelle dieser Frage, damit Chat, Rundschau und Mail nicht drei '
  'Fassungen derselben Regel führen. Reihenfolge NICHT umdrehen: alle 14 '
  'Botschafter haben auch einen Posten, on_assignment wäre sonst unerreichbar '
  '(Migration 327).';

REVOKE ALL ON public.agent_presence FROM PUBLIC;
GRANT SELECT ON public.agent_presence TO anon, authenticated, service_role;

COMMIT;
