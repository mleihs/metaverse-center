-- ============================================================================
-- Migration 308 — Eine Welt muss den Verfall benennen können, den sie erlaubt
-- ============================================================================
--
-- BEFUND (offener Punkt aus Migration 303, nachgemessen 31.08.2026 auf Prod)
-- --------------------------------------------------------------------------
-- Migration 303 hat die Zustandsleiter der Bauten an EINE Stelle gelegt
-- (`fn_building_condition_step`: excellent → good → fair → poor → ruined) und
-- dabei einen Punkt ausdrücklich ausgespart:
--
--     „Sechs von 25 Welten haben eine Leiter, die auf Sprosse 4 und 5 wieder
--      AUFWÄRTS geht (excellent → good → fair → restored → illuminated). Ein
--      Verfall entlang `sort_order` würde dort einen Bau verbessern."
--
-- Nachgemessen ergibt sich ein anderes, schärferes Bild — in drei Punkten:
--
-- **Erstens: `sort_order` ist gar keine Leiter.** Gemessen an den Verbrauchern
-- (`TaxonomyService.list_taxonomies` ordnet danach, `WorldSettingsPanel`
-- sortiert danach) ist die Spalte reine ANZEIGEreihenfolge; keine einzige
-- Stelle im Werk liest sie als Schweregrad. Bei den aus der Schmiede
-- abgeleiteten Vokabularen ist sie sogar nur „Reihenfolge des ersten
-- Auftretens" (`forge_taxonomies._collect`). Eine aufsteigende Sprosse 4/5 ist
-- also keine falsche Reihenfolge, sondern eine Reihenfolge, die nie eine war.
-- Deshalb ordnet diese Migration NICHTS um: das Umnummerieren von 25 Welten
-- würde keinen Defekt beheben und die falsche Lesart erst nahelegen.
--
-- **Zweitens: die Herkunft ist nicht die Schmiede.** Die Taxonomien der beiden
-- betroffenen Welten stehen handgeschrieben in ihren Welt-Migrationen (043
-- `cite_des_dames`, 140 `conventional_memory`); die fünf Klone erbten sie. Von
-- der Schmiede stammt keine einzige: alle 26 Entwürfe tragen
-- `taxonomies = {}` (siehe `forge_taxonomies`-Modulkopf, Befund 30).
--
-- **Drittens — und das ist der eigentliche Defekt: sieben Welten, nicht sechs,
-- führen ein Vokabular, das unter dem Verfall nicht abgeschlossen ist.**
--
--     cite-des-dames        fehlt: poor, ruined      (und ihre fünf Klone e3–e8)
--     conventional-memory   fehlt: ruined
--
-- Verfällt dort ein Bau von `fair`, schreibt `fn_degrade_building` den Wert
-- `poor` — und die Welt kann ihn nicht beschriften. In der Oberfläche steht
-- dann ein roher englischer Bezeichner in einer deutschen Seite. Das ist genau
-- die Klasse, die Migration 303 mit `moderate` beseitigt hat: nicht ein
-- falscher Wert, sondern ein Wert, den niemand benennen kann.
--
-- Gemessen wurde ausserdem, was in diese Lücke fällt: die vier Bauten von
-- `cite-des-dames` auf `restored` und `illuminated` verfallen gar nicht
-- (`condition_off_ladder`, seit 303 sichtbar); die vier auf `excellent` und
-- die zwei auf `good` laufen auf `fair` zu und stehen dann vor der Lücke.
--
-- DIE REGEL, DIE HIER GILT
-- ------------------------
-- **Abgeschlossenheit unter dem Verfall.** Von der BESTEN Kernsprosse, die
-- eine Welt selbst führt, muss jede tiefere Sprosse ebenfalls in ihrem
-- Vokabular stehen. Nicht mehr: eine Welt, die bei `fair` beginnt, bekommt
-- kein `excellent` dazu — das wäre erfunden. Nicht weniger: jeden Zustand, in
-- den der Verfall einen Bau bringen KANN, muss die Welt benennen können.
--
-- Alle 25 Welten mit Bauzustands-Taxonomie beginnen bei `excellent`; für sie
-- heisst die Regel also: alle fünf Sprossen. 18 erfüllen sie bereits.
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- 1. `fn_building_condition_ladder()` — die Leiter als abfragbare Menge, damit
--    die Abgeschlossenheitsprüfung und der Schritt DIESELBE Leiter benutzen.
--    `fn_building_condition_step` liest sie ab jetzt, statt sie ein zweites
--    Mal aufzuzählen (dasselbe Prinzip wie 303, eine Ebene höher).
-- 2. `fn_building_condition_label()` — die Beschriftung der fünf Sprossen.
--    Nicht erfunden, sondern auf Prod gemessen und dort EINSTIMMIG:
--    excellent/good/fair je 25 von 25 Welten identisch, `poor` 19 von 19,
--    `ruined` 18 von 18. Die Migration schreibt also, was die Plattform
--    ohnehin sagt.
-- 3. Nachtrag der 13 fehlenden Zeilen (6 × 2 + 1). Bestehende Zeilen bleiben
--    unangetastet — auch Beschriftung und `sort_order`. Die neuen Sprossen
--    werden hinten angehängt (`max(sort_order) + rung`), weil die Spalte
--    Anzeigereihenfolge ist und ein Umsortieren nichts gewönne.
-- 4. `fn_materialize_shard` bekommt Schritt 8b: dieselbe Abgeschlossenheit für
--    jede künftige Welt, unmittelbar nachdem ihre Taxonomien geschrieben sind.
--    Damit ist die Regel nicht nur nachgetragen, sondern gehalten.
-- 5. Und beim Hinsehen fiel im selben Schritt 8 ein zweiter Verlust auf:
--    `sort_order` stand nicht in der Einfügeliste. Jede von der Schmiede
--    geschriebene Taxonomiezeile bekam die Vorgabe 0 — die abgeleitete
--    Reihenfolge des ersten Auftretens ging beim Schreiben verloren, und die
--    Anzeige bekam eine Liste ohne Ordnung. `WITH ORDINALITY` trägt sie jetzt
--    hinüber. Auf Prod noch folgenlos (alle 26 Entwürfe tragen
--    `taxonomies = {}`), aber es ist der Pfad, den Befund 30 gerade öffnet.
--
-- Der Körper von `fn_materialize_shard` stammt aus `pg_get_functiondef` auf
-- PROD, nicht aus einer Migration — der Ledger taugt nicht als Beleg für den
-- Bestand (siehe `prod-schema-gap-migration-235`). Geändert ist ausschliesslich
-- der eingefügte Schritt 8b.
--
-- WAS SIE NICHT TUT
-- -----------------
-- Sie entscheidet nicht, ob `restored` und `illuminated` verfallen sollen.
-- Weltspezifische Zustände bleiben neben der Leiter und damit unbeweglich;
-- `fn_degrade_building` meldet dafür seit 303 `condition_off_ladder`. Das ist
-- eine inhaltliche Frage an die jeweilige Welt, keine, die eine Migration
-- erraten darf.
--
-- ⚠ Rechte: `fn_building_condition_ladder` und `fn_building_condition_label`
-- werden NEU angelegt, und eine neue Funktion braucht ZWEI Widerrufe — keiner
-- der beiden genügt allein:
--
--     REVOKE ALL     … FROM PUBLIC;              -- PostgreSQLs eigene Vorgabe
--     REVOKE EXECUTE … FROM anon, authenticated; -- Supabases pg_default_acl
--
-- Migration 307 hat gelernt, dass `FROM PUBLIC` die direkte Zuteilung an `anon`
-- nicht wegnimmt. Der erste Probelauf dieser Migration hat die Umkehrung
-- gelehrt: `FROM anon, authenticated` allein lässt die PUBLIC-Zuteilung stehen,
-- die PostgreSQL jeder neuen Funktion selbst gibt — und `has_function_privilege`
-- ist genau deshalb das richtige Messgerät, weil es beide Wege sieht. Der
-- Abnahmeblock unten misst, statt anzunehmen.
-- ============================================================================


-- ── 1. Die Leiter, als Menge ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_ladder()
RETURNS TABLE (value TEXT, rung INTEGER)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  VALUES ('excellent', 1), ('good', 2), ('fair', 3), ('poor', 4), ('ruined', 5);
$$;

COMMENT ON FUNCTION fn_building_condition_ladder() IS
  'Die gemeinsame Kernleiter der Bauzustände als abfragbare Menge, Sprosse 1 '
  '(bester Zustand) bis 5 (Ruine). Einzige Aufzählung der Leiter im ganzen '
  'Schema: fn_building_condition_step liest sie, und die Abgeschlossenheit der '
  'Welt-Vokabulare (Migration 308) prüft gegen sie. Die fünf Sprossen sind auf '
  'Prod gemessen (simulation_taxonomies, 25 Welten), nicht erfunden.';

REVOKE ALL    ON FUNCTION fn_building_condition_ladder() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_ladder() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_ladder() TO service_role;


-- ── 2. Ihre Beschriftung ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_building_condition_label(p_value TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_value
    WHEN 'excellent' THEN '{"en":"Excellent","de":"Ausgezeichnet"}'::jsonb
    WHEN 'good'      THEN '{"en":"Good","de":"Gut"}'::jsonb
    WHEN 'fair'      THEN '{"en":"Fair","de":"Befriedigend"}'::jsonb
    WHEN 'poor'      THEN '{"en":"Poor","de":"Schlecht"}'::jsonb
    WHEN 'ruined'    THEN '{"en":"Ruined","de":"Ruine"}'::jsonb
    ELSE jsonb_build_object('en', p_value)
  END;
$$;

COMMENT ON FUNCTION fn_building_condition_label(TEXT) IS
  'Die Beschriftung einer Kernsprosse, wie sie auf Prod bereits einstimmig '
  'steht (excellent/good/fair 25 von 25 Welten identisch, poor 19 von 19, '
  'ruined 18 von 18). Wird nur beim NACHTRAGEN einer fehlenden Sprosse '
  'benutzt; eine vorhandene Beschriftung überschreibt sie nie — eine Welt darf '
  'ihre Zustände in ihren eigenen Worten benennen.';

REVOKE ALL    ON FUNCTION fn_building_condition_label(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_building_condition_label(TEXT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_building_condition_label(TEXT) TO service_role;


-- ── 3. Der Schritt liest die Leiter, statt sie zu wiederholen ───────────────

CREATE OR REPLACE FUNCTION fn_building_condition_step(
  p_condition TEXT,
  p_direction INTEGER   -- +1 = ein Schritt abwärts (Verfall), -1 = aufwärts
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT l.value
       FROM fn_building_condition_ladder() l
      WHERE l.rung = (
              SELECT h.rung FROM fn_building_condition_ladder() h
               WHERE h.value = p_condition
            ) + p_direction),
    p_condition          -- Ende der Leiter erreicht, oder Wert nicht auf ihr
  );
$$;

COMMENT ON FUNCTION fn_building_condition_step(TEXT, INTEGER) IS
  'Ein Schritt auf der gemeinsamen Zustandsleiter der Bauten. +1 verfällt, '
  '-1 repariert. Ein Wert, der nicht auf der Leiter steht, kommt unverändert '
  'zurück — der Aufrufer entscheidet, ob das ein Ende oder ein Fehlschlag ist. '
  'Die Leiter selbst steht seit Migration 308 in fn_building_condition_ladder '
  'und wird hier nicht mehr aufgezählt.';

REVOKE EXECUTE ON FUNCTION fn_building_condition_step(TEXT, INTEGER) FROM anon;
GRANT  EXECUTE ON FUNCTION fn_building_condition_step(TEXT, INTEGER) TO authenticated, service_role;


-- ── 4. Die dreizehn fehlenden Sprossen ──────────────────────────────────────
-- Nur einfügen, nie ändern. Der Zuschlag auf `sort_order` ist `max + rung`,
-- damit die neuen Zeilen hinten und untereinander in Verfallsreihenfolge
-- stehen.

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


-- ── 5. Und die Schmiede hält die Regel künftig selbst ───────────────────────
-- Körper aus pg_get_functiondef auf Prod gezogen; eingefügt ist ausschliesslich
-- Schritt 8b, unmittelbar nach dem Schreiben der Taxonomien.

CREATE OR REPLACE FUNCTION public.fn_materialize_shard(p_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_draft record;
    v_sim_id uuid;
    v_city_id uuid;
    v_user_id uuid;
    v_anchor jsonb;
    v_geo jsonb;
    v_tax jsonb;
    v_agent jsonb;
    v_building jsonb;
    v_setting_key text;
    v_setting_val jsonb;
    v_zone_id uuid;
    v_zone_elem jsonb;
    v_zone_map jsonb := '{}'::jsonb;
    v_slug text;
    v_slug_base text;
    v_slug_counter int := 0;
    v_zone_ids uuid[];
    v_zone_count int;
    v_building_idx int := 0;
    v_is_admin boolean;
    v_has_bypass boolean;
BEGIN
    -- 1. Fetch draft and lock for update
    SELECT * INTO v_draft FROM public.forge_drafts WHERE id = p_draft_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft not found.';
    END IF;

    IF v_draft.status NOT IN ('draft', 'processing') THEN
        RAISE EXCEPTION 'Draft is already processed (status: %).', v_draft.status;
    END IF;

    v_user_id := v_draft.user_id;
    v_anchor := v_draft.philosophical_anchor->'selected';
    v_geo := v_draft.geography;
    v_tax := v_draft.taxonomies;

    -- Check admin and BYOK bypass status once
    v_is_admin := is_platform_admin();
    v_has_bypass := fn_user_has_byok_bypass(v_user_id);

    -- 2. Validate required JSONB structure
    IF v_anchor IS NULL OR v_anchor->>'title' IS NULL THEN
        RAISE EXCEPTION 'Draft is missing a selected philosophical anchor.';
    END IF;
    IF v_geo->'zones' IS NULL OR jsonb_array_length(v_geo->'zones') = 0 THEN
        RAISE EXCEPTION 'Draft is missing geography zones.';
    END IF;
    IF v_draft.agents IS NULL OR jsonb_array_length(v_draft.agents) = 0 THEN
        RAISE EXCEPTION 'Draft must contain at least one agent.';
    END IF;

    -- 3. Verify Quota (admin and BYOK bypass skip token check)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        IF NOT EXISTS (SELECT 1 FROM public.user_wallets WHERE user_id = v_user_id AND forge_tokens > 0) THEN
            RAISE EXCEPTION 'Insufficient tokens.';
        END IF;
    END IF;

    -- 4. Generate unique slug with collision handling
    v_slug_base := lower(regexp_replace(v_anchor->>'title', '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug_base := trim(BOTH '-' FROM v_slug_base);
    v_slug := v_slug_base;

    LOOP
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.simulations WHERE slug = v_slug);
        v_slug_counter := v_slug_counter + 1;
        v_slug := v_slug_base || '-' || v_slug_counter;
    END LOOP;

    -- 5. Create Simulation (with description_de from anchor)
    --
    -- `name_de` was the one bilingual column this INSERT did not fill, while its
    -- sibling `description_de` sat on the very next line. The anchor has carried
    -- `title_de` all along — measured on production 2026-08-30, 15 of 19 drafts
    -- with a selected anchor have one, and they are good ("Staatspathographie:
    -- Leserlichkeit als biopolitischer Stoffwechsel"). Nothing read it, so every
    -- world the Forge ever built carries its English name in every language:
    -- 41 of 41 simulations had `name_de` empty. See finding 16.
    INSERT INTO public.simulations (
        name, name_de, slug, description, description_de, theme, owner_id, status, simulation_type,
        content_locale, additional_locales
    ) VALUES (
        v_anchor->>'title',
        coalesce(v_anchor->>'title_de', ''),
        v_slug,
        v_anchor->>'description',
        coalesce(v_anchor->>'description_de', ''),
        'custom',
        v_user_id,
        'active',
        'template',
        'en',
        ARRAY['de']
    ) RETURNING id INTO v_sim_id;

    -- 6. Create Owner Membership
    INSERT INTO public.simulation_members (simulation_id, user_id, member_role)
    VALUES (v_sim_id, v_user_id, 'owner');

    -- 7. Create City
    INSERT INTO public.cities (simulation_id, name, description)
    VALUES (v_sim_id, v_geo->>'city_name', 'Materialized via Simulation Forge.')
    RETURNING id INTO v_city_id;

    -- 8. Insert Taxonomies (safe singularization via regexp_replace)
    --
    -- Accepts BOTH entry shapes, decided per entry rather than per key so a
    -- mixed list cannot fail on its first element:
    --   "sealed"                                        -> label {"en": "sealed"}
    --   {"value": "sealed", "label": {"en":…, "de":…}}  -> label taken as given
    -- The string form is what every draft written before migration 284 carries;
    -- it must keep working for a draft left open across the deploy.
    FOR v_setting_key, v_setting_val IN SELECT * FROM jsonb_each(v_tax)
    LOOP
        --
        -- `sort_order` kam bis Migration 308 nie an: die Spalte fehlte in der
        -- Einfuegeliste, also bekam jede Zeile die Vorgabe 0 und die abgeleitete
        -- Reihenfolge (`forge_taxonomies._collect`, Reihenfolge des ersten
        -- Auftretens) war beim Schreiben verloren. WITH ORDINALITY traegt sie
        -- jetzt hinueber.
        INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
        SELECT
            v_sim_id,
            regexp_replace(v_setting_key, 's$', ''),
            CASE jsonb_typeof(entry)
                WHEN 'object' THEN entry->>'value'
                ELSE entry #>> '{}'
            END,
            CASE
                WHEN jsonb_typeof(entry) = 'object' AND jsonb_typeof(entry->'label') = 'object'
                    THEN entry->'label'
                WHEN jsonb_typeof(entry) = 'object'
                    THEN jsonb_build_object('en', entry->>'value')
                ELSE jsonb_build_object('en', entry #>> '{}')
            END,
            position::int
        FROM jsonb_array_elements(v_setting_val) WITH ORDINALITY AS t(entry, position)
        WHERE coalesce(
            CASE jsonb_typeof(entry)
                WHEN 'object' THEN entry->>'value'
                ELSE entry #>> '{}'
            END, '') <> '';
    END LOOP;

    -- 8b. Die Zustandsleiter der Bauten muss beschriftbar sein (Migration 308)
    --
    -- Der Verfall (fn_degrade_building) bewegt einen Bau entlang der Kernleiter
    -- excellent -> good -> fair -> poor -> ruined. Führt die Welt eine dieser
    -- Sprossen nicht, trägt der verfallene Bau einen Wert, den seine eigene
    -- Welt nicht beschriften kann — roher englischer Bezeichner in einer
    -- deutschen Oberfläche, dieselbe Klasse wie `moderate` vor Migration 303.
    --
    -- Verlangt wird nur, was der Verfall auch erreichen kann: von der BESTEN
    -- Sprosse, die die Welt selbst führt, abwärts. Eine Welt, die bei `fair`
    -- beginnt, bekommt kein `excellent` dazu — das wäre erfunden.
    IF EXISTS (
        SELECT 1 FROM public.simulation_taxonomies
        WHERE simulation_id = v_sim_id AND taxonomy_type = 'building_condition'
    ) THEN
        INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order)
        SELECT v_sim_id, 'building_condition', l.value,
               fn_building_condition_label(l.value),
               (SELECT coalesce(max(t.sort_order), 0) FROM public.simulation_taxonomies t
                 WHERE t.simulation_id = v_sim_id AND t.taxonomy_type = 'building_condition') + l.rung
        FROM fn_building_condition_ladder() l
        WHERE l.rung >= (
                SELECT min(k.rung)
                FROM public.simulation_taxonomies t
                JOIN fn_building_condition_ladder() k ON k.value = t.value
                WHERE t.simulation_id = v_sim_id AND t.taxonomy_type = 'building_condition'
              )
          AND NOT EXISTS (
                SELECT 1 FROM public.simulation_taxonomies t
                WHERE t.simulation_id = v_sim_id
                  AND t.taxonomy_type = 'building_condition'
                  AND t.value = l.value
              );
    END IF;


    -- 9. Insert Zones (with _de columns)
    FOR v_zone_elem IN SELECT * FROM jsonb_array_elements(v_geo->'zones')
    LOOP
        INSERT INTO public.zones (
            simulation_id, city_id, name, zone_type, zone_type_de, description, description_de
        ) VALUES (
            v_sim_id, v_city_id,
            v_zone_elem->>'name',
            v_zone_elem->>'zone_type',
            coalesce(v_zone_elem->>'zone_type_de', ''),
            v_zone_elem->>'description',
            coalesce(v_zone_elem->>'description_de', '')
        ) RETURNING id INTO v_zone_id;

        v_zone_map := v_zone_map || jsonb_build_object(v_zone_elem->>'name', v_zone_id);
    END LOOP;

    -- Collect zone IDs for round-robin building distribution
    SELECT array_agg(id ORDER BY name) INTO v_zone_ids
    FROM public.zones WHERE simulation_id = v_sim_id;
    v_zone_count := coalesce(array_length(v_zone_ids, 1), 1);

    -- 10. Insert Streets (with street_type_de)
    INSERT INTO public.city_streets (
        simulation_id, city_id, zone_id, name, street_type, street_type_de
    )
    SELECT
        v_sim_id, v_city_id,
        (v_zone_map->>(s->>'zone_name'))::uuid,
        s->>'name',
        s->>'street_type',
        coalesce(s->>'street_type_de', '')
    FROM jsonb_array_elements(v_geo->'streets') AS s;

    -- 11. Insert Agents (with _de columns)
    INSERT INTO public.agents (
        simulation_id, name, gender, system,
        primary_profession, primary_profession_de,
        character, character_de,
        background, background_de
    )
    SELECT
        v_sim_id,
        a->>'name', a->>'gender', a->>'system',
        a->>'primary_profession', coalesce(a->>'primary_profession_de', ''),
        a->>'character', coalesce(a->>'character_de', ''),
        a->>'background', coalesce(a->>'background_de', '')
    FROM jsonb_array_elements(v_draft.agents) AS a;

    -- 12. Insert Buildings (round-robin distribution, with _de columns)
    FOR v_building IN SELECT * FROM jsonb_array_elements(v_draft.buildings)
    LOOP
        INSERT INTO public.buildings (
            simulation_id, city_id, zone_id, name,
            building_type, building_type_de,
            description, description_de,
            building_condition, building_condition_de
        ) VALUES (
            v_sim_id,
            v_city_id,
            v_zone_ids[1 + (v_building_idx % v_zone_count)],
            v_building->>'name',
            v_building->>'building_type', coalesce(v_building->>'building_type_de', ''),
            v_building->>'description', coalesce(v_building->>'description_de', ''),
            coalesce(v_building->>'building_condition', 'operational'),
            coalesce(v_building->>'building_condition_de', '')
        );
        v_building_idx := v_building_idx + 1;
    END LOOP;

    -- 13. Insert Settings (AI & Design)
    FOR v_setting_key, v_setting_val IN SELECT * FROM jsonb_each(v_draft.ai_settings)
    LOOP
        INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
        VALUES (v_sim_id, 'ai', v_setting_key, v_setting_val);
    END LOOP;

    -- 13b. Default game settings: disable health visual effects for fresh simulations
    INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
    VALUES (v_sim_id, 'game', 'critical_health_effects_enabled', 'false'::jsonb)
    ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;

    -- 13c. Persist philosophical anchor fields to simulation_settings (category='anchor')
    INSERT INTO public.simulation_settings (simulation_id, category, setting_key, setting_value)
    VALUES
        (v_sim_id, 'anchor', 'title',                    to_jsonb(v_anchor->>'title')),
        (v_sim_id, 'anchor', 'title_de',                 to_jsonb(coalesce(v_anchor->>'title_de', ''))),
        (v_sim_id, 'anchor', 'core_question',            to_jsonb(coalesce(v_anchor->>'core_question', ''))),
        (v_sim_id, 'anchor', 'core_question_de',         to_jsonb(coalesce(v_anchor->>'core_question_de', ''))),
        (v_sim_id, 'anchor', 'literary_influence',       to_jsonb(coalesce(v_anchor->>'literary_influence', ''))),
        (v_sim_id, 'anchor', 'literary_influence_de',    to_jsonb(coalesce(v_anchor->>'literary_influence_de', ''))),
        (v_sim_id, 'anchor', 'description',              to_jsonb(coalesce(v_anchor->>'description', ''))),
        (v_sim_id, 'anchor', 'description_de',           to_jsonb(coalesce(v_anchor->>'description_de', ''))),
        (v_sim_id, 'anchor', 'bleed_signature_suggestion', to_jsonb(coalesce(v_anchor->>'bleed_signature_suggestion', ''))),
        (v_sim_id, 'anchor', 'seed_prompt',              to_jsonb(coalesce(v_draft.seed_prompt, '')))
    ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;

    -- 14. Deduct Token (admin and BYOK bypass skip deduction)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        UPDATE public.user_wallets SET forge_tokens = forge_tokens - 1 WHERE user_id = v_user_id;
    END IF;

    -- 15. Finalize Draft
    UPDATE public.forge_drafts SET status = 'completed', current_phase = 'completed' WHERE id = p_draft_id;

    RETURN v_sim_id;
END;
$function$
;

REVOKE EXECUTE ON FUNCTION fn_materialize_shard(uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_materialize_shard(uuid) TO service_role;


-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_luecken   TEXT;
  v_anzahl    INT;
BEGIN
  -- (a) Die Leiter selbst: fünf Sprossen, lückenlos numeriert.
  SELECT count(*) INTO v_anzahl FROM fn_building_condition_ladder();
  IF v_anzahl <> 5 THEN
    RAISE EXCEPTION 'Migration 308: die Leiter hat % Sprossen statt 5', v_anzahl;
  END IF;
  IF EXISTS (
    SELECT 1 FROM fn_building_condition_ladder() l
     WHERE l.rung NOT BETWEEN 1 AND 5
  ) THEN
    RAISE EXCEPTION 'Migration 308: die Sprossennummern liegen nicht in 1..5';
  END IF;

  -- (b) Der Schritt verhält sich unverändert (dieselben Zusicherungen wie 303,
  --     jetzt gegen die neue, gelesene Leiter).
  IF fn_building_condition_step('good', 1) <> 'fair' THEN
    RAISE EXCEPTION 'Migration 308: good verfaellt nicht zu fair, sondern zu %',
      fn_building_condition_step('good', 1);
  END IF;
  IF fn_building_condition_step('excellent', 1) <> 'good' THEN
    RAISE EXCEPTION 'Migration 308: excellent verfaellt nicht zu good';
  END IF;
  IF fn_building_condition_step('fair', 1) <> 'poor' THEN
    RAISE EXCEPTION 'Migration 308: fair verfaellt nicht zu poor';
  END IF;
  IF fn_building_condition_step('poor', -1) <> 'fair' THEN
    RAISE EXCEPTION 'Migration 308: poor repariert nicht zu fair';
  END IF;
  IF fn_building_condition_step('ruined', 1) <> 'ruined' THEN
    RAISE EXCEPTION 'Migration 308: das Ende der Leiter ist nicht stabil';
  END IF;
  IF fn_building_condition_step('excellent', -1) <> 'excellent' THEN
    RAISE EXCEPTION 'Migration 308: der Kopf der Leiter ist nicht stabil';
  END IF;
  IF fn_building_condition_step('illuminated', 1) <> 'illuminated' THEN
    RAISE EXCEPTION 'Migration 308: ein Wert neben der Leiter wurde veraendert';
  END IF;

  -- (c) Die Sprosse, die es nie gab, steht in keiner der vier Funktionen.
  --     Geprueft wird der Koerper OHNE Kommentare (J3b).
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('fn_degrade_building', 'fn_apply_dungeon_loot',
                        'fn_building_condition_step', 'fn_building_condition_ladder')
      AND position('moderate' in regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')) > 0
  ) THEN
    RAISE EXCEPTION 'Migration 308: die Sprosse moderate steht wieder im Code';
  END IF;

  -- (d) DER PUNKT DIESER MIGRATION: kein Welt-Vokabular hat noch eine Luecke.
  --     Von der besten Kernsprosse einer Welt abwaerts muss jede Sprosse da sein.
  SELECT string_agg(x.slug || ': ' || x.fehlt, '; ' ORDER BY x.slug), count(*)
    INTO v_luecken, v_anzahl
  FROM (
    SELECT s.slug,
           string_agg(l.value, ', ' ORDER BY l.rung) AS fehlt
    FROM (
      SELECT t.simulation_id, min(k.rung) AS beste
      FROM simulation_taxonomies t
      JOIN fn_building_condition_ladder() k ON k.value = t.value
      WHERE t.taxonomy_type = 'building_condition'
      GROUP BY t.simulation_id
    ) w
    CROSS JOIN fn_building_condition_ladder() l
    JOIN simulations s ON s.id = w.simulation_id
    WHERE l.rung >= w.beste
      AND NOT EXISTS (
            SELECT 1 FROM simulation_taxonomies t
            WHERE t.simulation_id = w.simulation_id
              AND t.taxonomy_type = 'building_condition'
              AND t.value = l.value
          )
    GROUP BY s.slug
  ) x;

  IF COALESCE(v_anzahl, 0) > 0 THEN
    RAISE EXCEPTION 'Migration 308: % Welt(en) koennen ihren eigenen Verfall nicht benennen — %',
      v_anzahl, v_luecken;
  END IF;

  -- (e) Und nichts wurde ueberschrieben: die Beschriftung der Kernsprossen ist
  --     dort, wo sie schon stand, unveraendert. Gemessen wird die Einstimmigkeit,
  --     die vor der Migration galt — 25/25 fuer die drei obersten Sprossen.
  SELECT count(DISTINCT t.label::text) INTO v_anzahl
  FROM simulation_taxonomies t
  WHERE t.taxonomy_type = 'building_condition' AND t.value = 'excellent';
  IF v_anzahl > 1 THEN
    RAISE EXCEPTION 'Migration 308: excellent traegt jetzt % verschiedene Beschriftungen', v_anzahl;
  END IF;

  -- (f) Rechte. REVOKE … FROM PUBLIC nimmt anon nichts weg (Migration 307);
  --     deshalb wird hier gemessen, nicht angenommen.
  IF has_function_privilege('anon', 'fn_building_condition_ladder()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: anon darf fn_building_condition_ladder ausfuehren';
  END IF;
  IF has_function_privilege('anon', 'fn_building_condition_label(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: anon darf fn_building_condition_label ausfuehren';
  END IF;
  IF has_function_privilege('anon', 'fn_building_condition_step(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: anon darf fn_building_condition_step ausfuehren';
  END IF;
  IF has_function_privilege('anon', 'fn_materialize_shard(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_materialize_shard(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: fn_materialize_shard ist oeffentlich aufrufbar (SECURITY DEFINER!)';
  END IF;
  IF NOT has_function_privilege('service_role', 'fn_materialize_shard(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: service_role darf fn_materialize_shard nicht mehr ausfuehren';
  END IF;
  IF NOT has_function_privilege('service_role', 'fn_degrade_building(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 308: service_role darf fn_degrade_building nicht mehr ausfuehren';
  END IF;
END;
$$;
