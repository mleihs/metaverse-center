-- ============================================================================
-- 324 · Eine Ausnahme, die nur hinzufügt, ist keine Ausnahme
-- ============================================================================
--
-- `fn_building_condition_ladder(uuid)` baute die Leiter einer Welt als UNION aus
-- zwei Quellen: den Sprossen der Plattformkarte und „jedem eigenen Wert, den sie
-- selbst auf eine Sprosse gesetzt hat" (`metadata.rung`). Der Kommentar nennt
-- das eine Ausnahme, die die Plattformordnung ÜBERSTIMMT. Die Vereinigung
-- überstimmt aber nichts — sie legt daneben.
--
-- GEMESSEN auf Prod, in einer Transaktion mit ROLLBACK: setzt Speranza für
-- `thriving` eine eigene Sprosse 22, während die Plattformkarte 18 sagt, dann
-- steht `thriving` ZWEIMAL auf der Leiter dieser Welt:
--
--     value      zeilen  sprossen
--     thriving        2  18 und 22
--
-- Was daran hängt:
--
-- * `fn_building_condition_step(sim, 'good', 1)` sucht die kleinste Sprosse
--   über der aktuellen. Mit einem Doppelgänger findet sie die falsche.
-- * Steht der Bau SELBST auf dem doppelten Wort, liefert `hier` zwei Zeilen,
--   und der Verfall wählt zwischen zwei Antworten.
-- * `fn_apply_dungeon_loot` verbindet Bauten über `l.value` mit der Leiter —
--   ein Bau auf dem doppelten Wort erscheint dort zweimal.
--
-- WARUM DAS BIS HEUTE NIEMAND GEMERKT HAT
-- `metadata.rung` war nie gefüllt. Migration 320 füllte 193 Zeilen, aber alle
-- mit exakt dem Wert der Plattformkarte — und `UNION` fasst identische Zeilen
-- zusammen, also blieb es unsichtbar. 322 hat sie wieder entfernt. Der Fehler
-- wäre in dem Augenblick erschienen, in dem zum ersten Mal eine Welt WIRKLICH
-- abweicht — also bei genau der Funktion, für die der Mechanismus gebaut wurde,
-- und für die T11 ihn füllen will.
--
-- 🔑 Ein Mechanismus, der nur im gleichen Fall benutzt wird, in dem er nichts
-- tut, ist nicht erprobt, sondern unberührt.
--
-- DIE REPARATUR
-- Kein UNION mehr, sondern ein Vorrang, der als Vorrang dasteht: die eigene
-- Sprosse der Welt, sonst die Sprossenkarte der Plattform, sonst gar keine
-- (das Wort steht dann auf keiner Sprosse — die wahre Aussage, nicht eine
-- erfundene Position). Ein Wort kann danach nicht mehr doppelt erscheinen: die
-- Tabelle führt `UNIQUE (simulation_id, taxonomy_type, value)`.
--
-- Nachgemessen: die vollständige Kette aller 36 lebenden Welten ist vor und nach
-- dieser Migration identisch — heute weicht keine Welt ab, die Reparatur ist für
-- morgen.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_building_condition_ladder(p_simulation_id uuid)
RETURNS TABLE(value text, rung integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  -- Vorrang, ausgeschrieben: die eigene Sprosse der Welt schlägt die
  -- Plattformkarte. Wo beides fehlt, steht das Wort auf keiner Sprosse und
  -- taucht hier nicht auf.
  SELECT t.value,
         COALESCE(
           CASE
             WHEN t.metadata ? 'rung'
              AND (t.metadata ->> 'rung') ~ '^-?\d+$'
             THEN (t.metadata ->> 'rung')::int
           END,
           r.rung
         ) AS rung
    FROM simulation_taxonomies t
    LEFT JOIN fn_building_condition_rungs() r ON r.value = t.value
   WHERE t.simulation_id = p_simulation_id
     AND t.taxonomy_type = 'building_condition'
     AND coalesce(t.is_active, TRUE)
     AND (
           r.rung IS NOT NULL
        OR (t.metadata ? 'rung' AND (t.metadata ->> 'rung') ~ '^-?\d+$')
         );
$function$;

COMMENT ON FUNCTION public.fn_building_condition_ladder(uuid) IS
  'Die Leiter EINER Welt: jedes Zustandswort, das sie führt, mit seiner Sprosse '
  '(klein = besser). Vorrang: die eigene metadata.rung der Welt SCHLÄGT die '
  'Sprossenkarte der Plattform (seit Migration 324 wirklich — vorher war es eine '
  'UNION, die das Wort verdoppelte statt es zu überstimmen). Jedes Wort erscheint '
  'höchstens einmal. SECURITY INVOKER: die RLS von simulation_taxonomies greift.';

COMMIT;
