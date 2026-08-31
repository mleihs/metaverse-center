-- ============================================================================
-- 322 · Eine Funktion beantwortete zwei Fragen
-- ============================================================================
--
-- Migration 320 hat 17 Bauten wieder verfallen lassen, indem sie 193 Zeilen in
-- `simulation_taxonomies.metadata` eine Sprosse gab. Das war richtig in der
-- Wirkung und falsch im Bau: **193 Kopien einer einzigen Plattform-Tatsache.**
-- `metadata.rung` ist als AUSNAHME gedacht — die eine Welt, die ihr Vokabular
-- anders ordnet — nicht als Ablage für einen Wert, der überall derselbe ist.
--
-- Schlimmer: 320 reparierte den Bestand und nicht die Leitung. Der Forge leitet
-- die Taxonomie einer Welt aus dem ab, was das Modell erfunden hat
-- (`forge_taxonomies.py`, Befund 30) — konsistent von Konstruktion her, aber
-- eine MENGE. Der Verfall braucht eine FOLGE. Jede künftig geschmiedete Welt
-- hätte ihre thematischen Wörter wieder ohne Sprosse bekommen, und irgendwann
-- hätte jemand die nächsten 193 Zeilen geschrieben.
--
-- WARUM DIE NAHELIEGENDE REPARATUR EIN SCHADEN GEWESEN WÄRE
--
-- Der erste Gedanke war, die Kernliste in `fn_building_condition_ladder()`
-- von sechs auf neunzehn Werte zu erweitern. Das hätte still etwas kaputt
-- gemacht, das an einer ganz anderen Stelle steht: `fn_materialize_shard`
-- Schritt 8b liest DIESELBE Funktion, aber mit einer anderen Frage.
--
--     ladder(sim) und step(text,int)   fragen: WO SITZT ein Wort?
--     materialize_shard 8b             fragt:  WELCHE Wörter muss jede Welt haben?
--
-- 8b füllt von der besten Sprosse, die eine Welt selbst führt, abwärts auf,
-- damit der Verfall keinen Wert erreichen kann, den die Welt nicht beschriften
-- kann. Mit neunzehn Kernwerten hätte eine neue Welt, die `excellent` führt,
-- elf Wörter eingesetzt bekommen, die niemand gewählt hat — `preserved`,
-- `thriving`, `sealed`, `makeshift` … Der Kommentar an dieser Stelle verbietet
-- genau das: „Eine Welt, die bei `fair` beginnt, bekommt kein `excellent` dazu
-- — das wäre erfunden."
--
-- Solange beide Fragen dieselben sechs Werte ergeben, ist die Verwechslung
-- unsichtbar. Sie wird in dem Augenblick sichtbar, in dem ein thematisches Wort
-- eine Sprosse bekommt — also jetzt.
--
-- 🔑 Ein Name, der zwei Fragen beantwortet, ist so lange richtig, wie beide
-- Antworten gleich sind.
--
-- WAS DIESE MIGRATION TUT
--
-- 1. NEU `fn_building_condition_rungs()` — die Sprossenkarte der Plattform.
--    Neunzehn Wörter mit ihrem Platz. Beantwortet nur: wo sitzt ein Wort.
--    Die dreizehn thematischen stammen aus dem Bestand: 18 Welten führen sie
--    bereits in ihrer Taxonomie; die Reihenfolge ist die aus 320/321, vom
--    Nutzer bestätigt und an der KETTE geprüft (nicht an der Tabelle — 321
--    hat genau dort einen Fehler gefunden: „gut" verfiel zu „blühend").
--
-- 2. `fn_building_condition_ladder(uuid)` und `fn_building_condition_step(text,int)`
--    lesen ab jetzt die Sprossenkarte statt der Kernliste.
--
-- 3. `fn_building_condition_ladder()` bleibt UNVERÄNDERT bei sechs Werten und
--    bekommt einen COMMENT, der sagt, welche Frage sie beantwortet. Nur
--    `fn_materialize_shard` 8b liest sie noch.
--
-- 4. Die 193 `metadata.rung`-Kopien aus 320/321 werden entfernt. `metadata.rung`
--    ist damit wieder das, wofür es gebaut wurde: die Ausnahme einer Welt, die
--    die Plattformordnung überstimmt.
--
-- WICHTIG — DIE WIRKUNG BLEIBT EXAKT GLEICH. Eine Welt bekommt eine Sprosse nur
-- für Werte, die sie SELBST in ihrer Taxonomie führt (der JOIN steht auf
-- `t.value`). Die Sprossenkarte drängt keiner Welt ein Wort auf. Nachgemessen
-- durch Vergleich der vollständigen Kette jeder Welt vor und nach dieser
-- Migration: identisch, und 0 Bauten neben ihrer Leiter.
--
-- WAS OFFEN BLEIBT (T11)
-- Erfindet das Modell ein NEUES Wort (`waterlogged`), hat es wieder keine
-- Sprosse. Die Ableitung kann das nicht lösen — sie erzeugt eine Menge, keine
-- Ordnung. Der nachhaltige Weg wäre, dasselbe Modell, das das Wort erfindet,
-- auch nach seinem Platz zu fragen. Das ist eine Entwurfsentscheidung und steht
-- als T11 in `handoff/TODO-offen.md`, nicht in dieser Migration.
-- ============================================================================

BEGIN;

-- 1 · Die Sprossenkarte: wo sitzt ein Wort.
CREATE OR REPLACE FUNCTION public.fn_building_condition_rungs()
RETURNS TABLE(value text, rung integer)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  VALUES
    -- Kernsprossen der Plattform
    ('pristine',     5), ('excellent',  10), ('good',        20),
    ('fair',        30), ('poor',       40), ('ruined',      50),
    -- Thematische Wörter, die 18 Welten in ihrer Taxonomie führen.
    -- Die Zahl ist ihr Platz, nicht ihre Bedeutung: die Zehnerlücken der
    -- Kernleiter nehmen sie auf, ohne einen Kernwert zu verschieben.
    ('illuminated',  8),   -- gesteigert, über „ausgezeichnet"
    ('restored',    12),   -- wiederhergestellt heisst: wie neu
    ('preserved',   15),   -- erhalten, nicht erneuert
    ('thriving',    18),   -- blühend — über „gut", nie darunter (siehe 321)
    ('restricted',  24),   -- Zugang beschränkt, Substanz gut
    ('functional',  26),   -- „funktioniert" ist kein Lob
    ('operational', 28),   -- in Betrieb, halb versunken
    ('obsolete',    32),   -- veraltet, aber in Betrieb
    ('anomalous',   34),   -- nicht kaputt, sondern nicht erklärbar
    ('sealed',      36),   -- versiegelt
    ('makeshift',   38),   -- behelfsmässig errichtet
    ('compromised', 42),   -- nach einem Vorfall
    ('critical',    45);   -- eine Sprosse über der Ruine
$function$;

COMMENT ON FUNCTION public.fn_building_condition_rungs() IS
  'Sprossenkarte: WO SITZT ein Zustandswort. Gelesen von '
  'fn_building_condition_ladder(uuid) und fn_building_condition_step(text,int). '
  'Drängt keiner Welt ein Wort auf — der Aufrufer verbindet über t.value mit der '
  'Taxonomie der Welt. Nicht zu verwechseln mit fn_building_condition_ladder(), '
  'das die PFLICHT-Kernwörter nennt (siehe Migration 322).';

COMMENT ON FUNCTION public.fn_building_condition_ladder() IS
  'Kernleiter: WELCHE Wörter muss jede Welt führen, damit der Verfall nichts '
  'Unbeschriftbares erreichen kann. Einziger Leser: fn_materialize_shard 8b, das '
  'von der besten Sprosse einer Welt abwärts auffüllt. Hier NICHTS ergänzen, was '
  'nicht jede Welt haben soll — ein Wert mehr heisst ein erfundenes Wort in jeder '
  'neu geschmiedeten Welt. Für die Sprossen thematischer Wörter: '
  'fn_building_condition_rungs() (Migration 322).';

-- 2 · Die Leiter einer Welt liest die Sprossenkarte.
CREATE OR REPLACE FUNCTION public.fn_building_condition_ladder(p_simulation_id uuid)
RETURNS TABLE(value text, rung integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  -- Jede Sprosse der Plattform, die diese Welt selbst führt …
  SELECT t.value, l.rung
    FROM simulation_taxonomies t
    JOIN fn_building_condition_rungs() l ON l.value = t.value
   WHERE t.simulation_id = p_simulation_id
     AND t.taxonomy_type = 'building_condition'
     AND coalesce(t.is_active, TRUE)
  UNION
  -- … plus jeden eigenen Wert, den sie selbst auf eine Sprosse gesetzt hat.
  -- Das ist die Ausnahme einer Welt, die die Plattformordnung überstimmt oder
  -- ein Wort führt, das die Sprossenkarte nicht kennt.
  SELECT t.value, (t.metadata ->> 'rung')::int
    FROM simulation_taxonomies t
   WHERE t.simulation_id = p_simulation_id
     AND t.taxonomy_type = 'building_condition'
     AND coalesce(t.is_active, TRUE)
     AND t.metadata ? 'rung'
     AND (t.metadata ->> 'rung') ~ '^-?\d+$';
$function$;

-- 3 · Der weltlose Schritt liest die Sprossenkarte.
--     Vorher kannte er nur sechs Wörter und gab jedes thematische unverändert
--     zurück — ein Bau auf `sealed` stand still, ohne dass etwas gemeldet wurde.
CREATE OR REPLACE FUNCTION public.fn_building_condition_step(p_condition text, p_direction integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  WITH hier AS (
    SELECT l.rung FROM fn_building_condition_rungs() l WHERE l.value = p_condition
  )
  SELECT COALESCE(
    CASE WHEN p_direction > 0
      THEN (SELECT l.value FROM fn_building_condition_rungs() l, hier
             WHERE l.rung > hier.rung ORDER BY l.rung ASC  LIMIT 1)
      ELSE (SELECT l.value FROM fn_building_condition_rungs() l, hier
             WHERE l.rung < hier.rung ORDER BY l.rung DESC LIMIT 1)
    END,
    p_condition          -- Ende der Leiter, oder Wert nicht auf ihr
  );
$function$;

-- 4 · Die 193 Kopien aus 320/321 zurücknehmen.
--     Entfernt wird nur, was mit der Sprossenkarte übereinstimmt — eine Welt,
--     die inzwischen eine eigene, abweichende Sprosse gesetzt hat, behält sie.
UPDATE simulation_taxonomies t
   SET metadata = t.metadata - 'rung'
  FROM fn_building_condition_rungs() r
 WHERE t.taxonomy_type = 'building_condition'
   AND t.value = r.value
   AND (t.metadata ->> 'rung') ~ '^-?\d+$'   -- sonst wirft der Cast bei Handschrift
   AND (t.metadata ->> 'rung')::int = r.rung;

COMMIT;
