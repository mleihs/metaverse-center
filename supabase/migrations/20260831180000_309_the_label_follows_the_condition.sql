-- ============================================================================
-- Migration 309 — Die Beschriftung folgt dem Zustand
-- ============================================================================
--
-- BEFUND (gemessen auf Prod, 31.08.2026, beim Nachmessen von Migration 308)
-- -------------------------------------------------------------------------
-- Migration 308 schliesst die Lücken in den Bauzustands-Vokabularen. Beim
-- Prüfen, WER dieses Vokabular eigentlich liest, kam ein grösserer Befund
-- heraus — und er sitzt eine Ebene tiefer.
--
-- **Die Oberfläche liest das Vokabular gar nicht.** `t(b, 'building_condition')`
-- (`frontend/src/utils/locale-fields.ts`) nimmt die Spalte
-- `buildings.building_condition_de` und fällt, wenn sie leer ist, auf das
-- ENGLISCHE Feld zurück. Die Taxonomie speist nur das Auswahlmenü im
-- Bearbeiten-Dialog (`BuildingEditModal`).
--
-- Und diese Spalte pflegt niemand:
--
--     216 von 324 Bauten haben KEINE deutsche Beschriftung
--         182 davon auf `good`, über 27 Simulationen
--     → in der deutschen Oberfläche steht bei ihnen das rohe englische Wort
--
--      27 weitere tragen eine, die von der ihrer Welt abweicht
--         `fair` erscheint als mittelmässig, befriedigend, mässig, akzeptabel,
--         ordentlich, angemessen, brauchbar und „in Ordnung" — acht Wörter für
--         einen Wert, teils INNERHALB derselben Welt
--
-- **Und der Verfall macht es schlimmer, statt es zu heilen.**
-- `fn_degrade_building` schreibt `building_condition` und lässt
-- `building_condition_de` stehen. Ein Bau, der von `fair` auf `poor` verfällt,
-- behält also die Beschriftung des VORIGEN Zustands: der Zustand sinkt, das
-- angezeigte Wort bleibt. Migration 303 hat die Reichweite des Verfalls von
-- 209 auf 297 Bauten erhöht — dieser Fehler ist seitdem lauter, nicht leiser.
--
-- DIE URSACHE
-- -----------
-- `building_condition` ist kein Freitext, sondern ein Wert aus einem
-- kontrollierten Vokabular. Seine Übersetzung gehört zum VOKABULAR, einmal —
-- nicht an jede Zeile. Die Spalte `building_condition_de` ist eine
-- Zweitschrift, und niemand hat sie je nachgeführt.
--
-- Das ist derselbe Bauplan wie bei der Leiter in Migration 303: eine
-- Reihenfolge stand zweimal da, also stand sie zweimal verschieden da. Hier
-- steht eine BESCHRIFTUNG zweimal da.
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- 1. **Die elf Simulationen ohne Vokabular bekommen eines** — abgeleitet aus
--    ihren EIGENEN Bauten, nicht erfunden (dasselbe Verfahren wie
--    `forge_taxonomies.derive_taxonomies`, nur für Bestandsdaten und in SQL).
--    Zehn davon sind Ursprungswelten; darunter The Möbius Academy, eine der
--    beiden Welten, die überhaupt ticken.
--
--    Die deutsche Beschriftung ist die in dieser Welt HÄUFIGSTE, nicht eine
--    plattformweite Vorgabe: The Time Bank of Momo sagt `Akzeptabel`, The
--    Metamorphosis of Memory sagt `Mittelmässig`, beide für `fair`. Das ist
--    die Regel, die `forge_taxonomies` begründet — eine Welt spricht in ihren
--    eigenen Worten. Nur wo eine Welt gar kein Deutsch hat, greift die
--    plattformweit gemessene Beschriftung aus Migration 308.
--
--    Danach läuft derselbe Abschluss wie in 308: von der besten Kernsprosse
--    abwärts muss jede Sprosse dastehen.
--
-- 2. **`fn_building_condition_de(welt, wert)`** — die Beschriftung an EINER
--    Stelle: erst die Taxonomie der Welt, dann die plattformweite, dann der
--    rohe Wert. Wer den Zustand eines Baus schreibt, braucht ab jetzt keine
--    eigene Kopie dieser Frage.
--
-- 3. **Ein Auslöser statt zweier geflickter Aufrufer.**
--    `trg_building_condition_label` setzt `building_condition_de` immer dann,
--    wenn `building_condition` gesetzt oder geändert wird und der Schreiber
--    nicht selbst eine Beschriftung mitgibt.
--
--    Warum ein Auslöser und nicht zwei Zeilen in `fn_degrade_building` und
--    `fn_apply_dungeon_loot`: weil das die beiden Schreiber wären, die ich
--    GEFUNDEN habe. Der Auslöser deckt auch die, die ich nicht gefunden habe,
--    und jeden künftigen. Eine Zweitschrift synchron zu halten ist Integrität,
--    und Integrität gehört nach SQL (ADR-007, `feedback-sql-vs-python-boundary`).
--
--    Schreibt jemand ausdrücklich eine eigene Beschriftung (der
--    Bearbeiten-Dialog kann das), bleibt sie stehen — der Auslöser greift nur,
--    wenn `building_condition_de` unverändert durchgereicht wird.
--
-- 4. **Nachtrag für den Bestand**: jeder Bau bekommt die Beschriftung, die die
--    Taxonomie seiner Welt für seinen Zustand führt. Damit verschwinden die
--    216 englischen Wörter und die acht Schreibweisen für `fair`.
--
-- WAS SIE NICHT TUT
-- -----------------
-- Sie räumt die Zweitschrift nicht ab. Richtig wäre auf Dauer, dass die
-- Oberfläche die Beschriftung aus der Taxonomie liest und die Spalte
-- `building_condition_de` verschwindet. Das ist eine Frontend-Änderung an vier
-- Stellen (`BuildingCard`, `BuildingDetailsPanel`, `BuildingsView`,
-- `terminal-formatters`) und gehört in einen eigenen Schritt; sie steht als T4
-- in `handoff/TODO-offen.md`. Bis dahin ist die Spalte ein Zwischenspeicher mit
-- einer Quelle und einem Wächter — statt einer Zweitschrift ohne beides.
--
-- Sie entscheidet auch nicht über `pristine`. Der Wert kommt jetzt in fünf
-- Vokabularen vor und ist damit beschriftbar, steht aber weiter neben der
-- Leiter: diese sechs Bauten verfallen nicht (T3).
-- ============================================================================


-- ── 1. Die Beschriftung, an einer Stelle ────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_de(
  p_simulation_id UUID,
  p_value TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Zuerst das Wort, das die Welt selbst führt.
    (SELECT nullif(btrim(t.label ->> 'de'), '')
       FROM simulation_taxonomies t
      WHERE t.simulation_id = p_simulation_id
        AND t.taxonomy_type = 'building_condition'
        AND t.value = p_value
      LIMIT 1),
    -- Dann die plattformweit gemessene Beschriftung der Kernsprossen (308).
    nullif(btrim(fn_building_condition_label(p_value) ->> 'de'), ''),
    -- Und zuletzt der rohe Wert: sichtbar unübersetzt ist besser als leer,
    -- weil leer in der Oberfläche auf das englische Feld zurückfällt und dort
    -- wie eine Übersetzung aussieht.
    p_value
  );
$$;

COMMENT ON FUNCTION fn_building_condition_de(UUID, TEXT) IS
  'Die deutsche Beschriftung eines Bauzustands in einer bestimmten Welt: erst '
  'deren eigene Taxonomie, dann die plattformweit gemessene Beschriftung der '
  'Kernsprossen, dann der rohe Wert. Einzige Stelle, an der diese Frage '
  'beantwortet wird — der Auslöser trg_building_condition_label ist ihr '
  'einziger Aufrufer im Schema.';

REVOKE ALL     ON FUNCTION fn_building_condition_de(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_de(UUID, TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_de(UUID, TEXT) TO service_role;


-- ── 2. Die elf Simulationen ohne Vokabular bekommen ihres ───────────────────
-- Abgeleitet aus den eigenen Bauten. Die deutsche Beschriftung ist die in
-- dieser Welt häufigste Schreibweise; bei Gleichstand entscheidet die
-- alphabetisch erste, damit das Ergebnis nicht von der Zeilenreihenfolge
-- abhängt.

WITH ohne_vokabular AS (
  SELECT s.id
  FROM simulations s
  WHERE s.deleted_at IS NULL
    AND NOT EXISTS (
          SELECT 1 FROM simulation_taxonomies t
          WHERE t.simulation_id = s.id AND t.taxonomy_type = 'building_condition'
        )
),
haeufigstes_deutsch AS (
  SELECT simulation_id, value, de
  FROM (
    SELECT b.simulation_id,
           lower(btrim(b.building_condition))                       AS value,
           btrim(b.building_condition_de)                           AS de,
           row_number() OVER (
             PARTITION BY b.simulation_id, lower(btrim(b.building_condition))
             ORDER BY count(*) DESC, btrim(b.building_condition_de)
           ) AS rang
    FROM buildings b
    JOIN ohne_vokabular o ON o.id = b.simulation_id
    WHERE b.deleted_at IS NULL
      AND COALESCE(btrim(b.building_condition), '') <> ''
      AND COALESCE(btrim(b.building_condition_de), '') <> ''
    GROUP BY b.simulation_id, lower(btrim(b.building_condition)), btrim(b.building_condition_de)
  ) x
  WHERE rang = 1
),
eigene_werte AS (
  SELECT DISTINCT b.simulation_id, lower(btrim(b.building_condition)) AS value
  FROM buildings b
  JOIN ohne_vokabular o ON o.id = b.simulation_id
  WHERE b.deleted_at IS NULL
    AND COALESCE(btrim(b.building_condition), '') <> ''
),
geordnet AS (
  SELECT w.simulation_id,
         w.value,
         l.rung,
         -- Kernsprossen behalten ihre Sprossennummer, weltspezifische Werte
         -- kommen dahinter — dieselbe Ordnung, die 18 Simulationen bereits
         -- führen (Kern 1..5, Eigenes ab 10).
         COALESCE(
           l.rung,
           10 + row_number() OVER (
             PARTITION BY w.simulation_id
             ORDER BY (l.rung IS NOT NULL), w.value
           )::int
         ) AS position
  FROM eigene_werte w
  LEFT JOIN fn_building_condition_ladder() l ON l.value = w.value
)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
SELECT g.simulation_id,
       'building_condition',
       g.value,
       jsonb_build_object(
         'en', COALESCE(nullif(fn_building_condition_label(g.value) ->> 'en', g.value), initcap(g.value)),
         'de', COALESCE(initcap(d.de), fn_building_condition_label(g.value) ->> 'de', initcap(g.value))
       ),
       g.position
FROM geordnet g
LEFT JOIN haeufigstes_deutsch d
       ON d.simulation_id = g.simulation_id AND d.value = g.value
WHERE NOT EXISTS (
        SELECT 1 FROM simulation_taxonomies t
        WHERE t.simulation_id = g.simulation_id
          AND t.taxonomy_type = 'building_condition'
          AND t.value = g.value
      );


-- ── 3. Und dann derselbe Abschluss wie in Migration 308 ─────────────────────
-- Die neu abgeleiteten Vokabulare müssen unter dem Verfall genauso
-- abgeschlossen sein wie die bestehenden. Wortgleich zu 308, damit die Regel
-- nicht in zwei Fassungen existiert.

WITH welt AS (
  SELECT t.simulation_id,
         min(l.rung) AS beste_sprosse,
         (SELECT max(a.sort_order)
            FROM simulation_taxonomies a
           WHERE a.simulation_id = t.simulation_id
             AND a.taxonomy_type = 'building_condition') AS letzte_position
  FROM simulation_taxonomies t
  JOIN fn_building_condition_ladder() l ON l.value = t.value
  WHERE t.taxonomy_type = 'building_condition'
  GROUP BY t.simulation_id
)
INSERT INTO simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
SELECT w.simulation_id,
       'building_condition',
       l.value,
       fn_building_condition_label(l.value),
       COALESCE(w.letzte_position, 0) + l.rung
FROM welt w
CROSS JOIN fn_building_condition_ladder() l
WHERE l.rung >= w.beste_sprosse
  AND NOT EXISTS (
        SELECT 1 FROM simulation_taxonomies t
        WHERE t.simulation_id = w.simulation_id
          AND t.taxonomy_type = 'building_condition'
          AND t.value = l.value
      );


-- ── 4. Der Wächter ──────────────────────────────────────────────────────────
-- Ein Auslöser statt zweier geflickter Aufrufer: er deckt auch die Schreiber,
-- die ich nicht gefunden habe.

CREATE OR REPLACE FUNCTION fn_sync_building_condition_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Beim Anlegen nur füllen, was leer ist. Wer eine Beschriftung
        -- mitbringt, behält sie.
        IF COALESCE(btrim(NEW.building_condition), '') <> ''
           AND COALESCE(btrim(NEW.building_condition_de), '') = '' THEN
            NEW.building_condition_de :=
                fn_building_condition_de(NEW.simulation_id, NEW.building_condition);
        END IF;

    ELSIF NEW.building_condition IS DISTINCT FROM OLD.building_condition THEN
        -- Der Zustand hat sich geändert. Wenn der Schreiber die Beschriftung
        -- unverändert durchreicht, hat er sie nicht gemeint — dann folgt sie
        -- dem neuen Zustand. Genau hier liess `fn_degrade_building` bisher das
        -- Wort des VORIGEN Zustands stehen.
        --
        -- Schreibt jemand im selben Befehl eine ANDERE Beschriftung, ist das
        -- eine Aussage und wird nicht überschrieben.
        IF NEW.building_condition_de IS NOT DISTINCT FROM OLD.building_condition_de
           AND COALESCE(btrim(NEW.building_condition), '') <> '' THEN
            NEW.building_condition_de :=
                fn_building_condition_de(NEW.simulation_id, NEW.building_condition);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_sync_building_condition_label() IS
  'Hält buildings.building_condition_de an buildings.building_condition. Die '
  'Spalte ist ein Zwischenspeicher der Taxonomie-Beschriftung, kein '
  'Freitextfeld; ohne diesen Wächter behielt ein verfallener Bau das Wort '
  'seines vorigen Zustands (Migration 309). Eine ausdrücklich mitgeschriebene '
  'Beschriftung bleibt unangetastet.';

REVOKE ALL     ON FUNCTION fn_sync_building_condition_label() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_sync_building_condition_label() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_sync_building_condition_label() TO service_role;

DROP TRIGGER IF EXISTS trg_building_condition_label ON buildings;
CREATE TRIGGER trg_building_condition_label
    BEFORE INSERT OR UPDATE OF building_condition, building_condition_de ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_building_condition_label();


-- ── 5. Der Bestand bekommt seine Beschriftung ───────────────────────────────
-- 216 Bauten ohne jede deutsche Beschriftung, 27 mit einer, die von der ihrer
-- eigenen Welt abweicht. Beide bekommen das Wort, das die Taxonomie ihrer Welt
-- für ihren Zustand führt — nicht meines.

UPDATE buildings b
   SET building_condition_de = fn_building_condition_de(b.simulation_id, b.building_condition)
 WHERE b.deleted_at IS NULL
   AND COALESCE(btrim(b.building_condition), '') <> ''
   AND COALESCE(btrim(b.building_condition_de), '')
       IS DISTINCT FROM fn_building_condition_de(b.simulation_id, b.building_condition);


-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anzahl  INT;
  v_text    TEXT;
  v_id      UUID;
  v_sim     UUID;
  v_alt     TEXT;
  v_alt_de  TEXT;
  v_neu_de  TEXT;
  v_probe_alt TEXT;
BEGIN
  -- (a) Keine Simulation MIT Bauten steht mehr ohne Vokabular da.
  SELECT count(*), string_agg(s.slug, ', ' ORDER BY s.slug) INTO v_anzahl, v_text
  FROM simulations s
  WHERE s.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM buildings b
                 WHERE b.simulation_id = s.id AND b.deleted_at IS NULL
                   AND COALESCE(btrim(b.building_condition), '') <> '')
    AND NOT EXISTS (SELECT 1 FROM simulation_taxonomies t
                     WHERE t.simulation_id = s.id AND t.taxonomy_type = 'building_condition');
  IF v_anzahl > 0 THEN
    RAISE EXCEPTION 'Migration 309: % Simulation(en) mit Bauten haben kein Bauzustands-Vokabular — %',
      v_anzahl, v_text;
  END IF;

  -- (b) Kein Bau trägt einen Zustand, den seine eigene Welt nicht führt.
  --     Das ist der Punkt, an dem die Oberfläche einen rohen Bezeichner zeigte.
  SELECT count(*), string_agg(DISTINCT s.slug || ':' || b.building_condition, ', ')
    INTO v_anzahl, v_text
  FROM buildings b
  JOIN simulations s ON s.id = b.simulation_id AND s.deleted_at IS NULL
  WHERE b.deleted_at IS NULL
    AND COALESCE(btrim(b.building_condition), '') <> ''
    AND NOT EXISTS (SELECT 1 FROM simulation_taxonomies t
                     WHERE t.simulation_id = b.simulation_id
                       AND t.taxonomy_type = 'building_condition'
                       AND t.value = b.building_condition);
  IF v_anzahl > 0 THEN
    RAISE EXCEPTION 'Migration 309: % Bau(ten) tragen einen Zustand ausserhalb ihres Vokabulars — %',
      v_anzahl, left(v_text, 400);
  END IF;

  -- (c) Und keiner mehr ohne deutsche Beschriftung. DAS war der Befund:
  --     216 von 324 fielen in der deutschen Oberfläche auf das englische Wort
  --     zurück.
  SELECT count(*) INTO v_anzahl
  FROM buildings b
  WHERE b.deleted_at IS NULL
    AND COALESCE(btrim(b.building_condition), '') <> ''
    AND COALESCE(btrim(b.building_condition_de), '') = '';
  IF v_anzahl > 0 THEN
    RAISE EXCEPTION 'Migration 309: % Bau(ten) ohne deutsche Beschriftung', v_anzahl;
  END IF;

  -- (d) Die Zweitschrift stimmt mit ihrer Quelle überein, überall.
  SELECT count(*) INTO v_anzahl
  FROM buildings b
  WHERE b.deleted_at IS NULL
    AND COALESCE(btrim(b.building_condition), '') <> ''
    AND btrim(b.building_condition_de)
        IS DISTINCT FROM fn_building_condition_de(b.simulation_id, b.building_condition);
  IF v_anzahl > 0 THEN
    RAISE EXCEPTION 'Migration 309: % Bau(ten) weichen von der Beschriftung ihrer Welt ab', v_anzahl;
  END IF;

  -- (e) Ein Wert kommt in einer Welt nur EINMAL vor. Acht Schreibweisen für
  --     `fair` waren der sichtbare Teil des Befundes.
  SELECT count(*) INTO v_anzahl
  FROM (
    SELECT b.simulation_id, b.building_condition
    FROM buildings b
    WHERE b.deleted_at IS NULL AND COALESCE(btrim(b.building_condition), '') <> ''
    GROUP BY b.simulation_id, b.building_condition
    HAVING count(DISTINCT btrim(b.building_condition_de)) > 1
  ) x;
  IF v_anzahl > 0 THEN
    RAISE EXCEPTION 'Migration 309: % Welt/Zustand-Paare tragen mehr als eine Schreibweise', v_anzahl;
  END IF;

  -- (f) DER WÄCHTER MUSS WIRKEN, nicht nur dastehen. Ein echter Verfall,
  --     transaktional zurückgenommen. Ohne diese Probe belegt die Migration
  --     nur, dass ein Auslöser EXISTIERT — und ein Auslöser, der nie feuert,
  --     sieht bei jeder Prüfung aus wie einer, der wirkt.
  SELECT b.id, b.simulation_id, b.building_condition, b.building_condition_de
    INTO v_id, v_sim, v_alt, v_alt_de
  FROM buildings b
  WHERE b.deleted_at IS NULL
    AND b.building_condition IN ('excellent', 'good', 'fair', 'poor')
  ORDER BY b.id
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Migration 309: kein Bau auf der Leiter — die Probe kann nicht laufen';
  END IF;

  BEGIN
    UPDATE buildings SET building_condition = fn_building_condition_step(v_alt, 1) WHERE id = v_id;
    SELECT building_condition_de INTO v_neu_de FROM buildings WHERE id = v_id;

    IF v_neu_de IS NOT DISTINCT FROM v_alt_de THEN
      RAISE EXCEPTION
        'Migration 309: der Verfall % → % hat die Beschriftung nicht mitgezogen (steht weiter auf %)',
        v_alt, fn_building_condition_step(v_alt, 1), COALESCE(v_alt_de, '∅');
    END IF;
    IF v_neu_de IS DISTINCT FROM fn_building_condition_de(v_sim, fn_building_condition_step(v_alt, 1)) THEN
      RAISE EXCEPTION 'Migration 309: der Waechter hat eine andere Beschriftung geschrieben als die Taxonomie fuehrt';
    END IF;

    -- Gegenprobe: eine ausdrücklich mitgeschriebene Beschriftung überlebt.
    UPDATE buildings
       SET building_condition = v_alt,
           building_condition_de = 'Von Hand gesetzt'
     WHERE id = v_id;
    SELECT building_condition_de INTO v_neu_de FROM buildings WHERE id = v_id;
    IF v_neu_de <> 'Von Hand gesetzt' THEN
      RAISE EXCEPTION 'Migration 309: der Waechter ueberschreibt eine ausdruecklich gesetzte Beschriftung';
    END IF;

    -- Probe zurücknehmen.
    UPDATE buildings
       SET building_condition = v_alt, building_condition_de = v_alt_de
     WHERE id = v_id;
    SELECT building_condition, building_condition_de INTO v_probe_alt, v_neu_de FROM buildings WHERE id = v_id;
    IF v_probe_alt IS DISTINCT FROM v_alt OR v_neu_de IS DISTINCT FROM v_alt_de THEN
      RAISE EXCEPTION 'Migration 309: die Probe liess den Bau veraendert zurueck';
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Die Untertransaktion hat den Bau bereits zurückgesetzt; die Meldung
    -- gehört trotzdem nach draussen.
    RAISE;
  END;

  -- (g) Rechte. Zwei Widerrufe je NEUER Funktion; gemessen, nicht angenommen.
  IF has_function_privilege('anon', 'fn_building_condition_de(uuid,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_building_condition_de(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 309: fn_building_condition_de ist oeffentlich aufrufbar';
  END IF;

  -- (h) Und der Auslöser hängt wirklich an der Tabelle.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.buildings'::regclass
      AND tgname = 'trg_building_condition_label'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Migration 309: der Auslöser trg_building_condition_label fehlt';
  END IF;
END;
$$;
