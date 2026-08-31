-- ============================================================================
-- 329 — Aufgezeichnet statt rekonstruiert
-- ============================================================================
--
-- Migration 328 hat die Herkunft der 36 bestehenden Welten wiederhergestellt:
-- welcher Satz sie erzeugt hat und welche Anker zur Wahl standen. Das war eine
-- REKONSTRUKTION ueber die Agentennamen, und sie hat 13 von 16 Entwuerfen
-- erreicht. Die drei uebrigen sind fuer immer offen.
--
-- Diese Migration sorgt dafuer, dass es keine vierte gibt: `fn_materialize_shard`
-- schreibt die Herkunft beim Erzeugen der Welt, in derselben Transaktion.
--
-- DREI AENDERUNGEN AN DER FUNKTION
--   1. Die Welt bekommt `origin_prompt` und `anchor_choices` schon im INSERT.
--   2. Der Entwurf bekommt `simulation_id` im SELBEN UPDATE wie seinen
--      Abschluss — nicht in einem zweiten daneben, denn „fertig, aber ohne
--      Welt" ist genau der Zustand, den 328 nachtraeglich reparieren musste.
--   3. Die Zeile `simulation_settings('anchor','seed_prompt')` wird nicht mehr
--      geschrieben.
--
-- ZU (3), WEIL ES EINE ENTFERNUNG IST
--   Die Funktion legte den Ausgangssatz bisher als EINSTELLUNG ab. Gemessen
--   auf Prod: 9 Welten haben diese Zeile, 13 haben die neue Spalte, und **0**
--   haben die Zeile ohne die Spalte — die Spalte ist eine echte Obermenge.
--   Gesucht wurde ausserdem nach Lesern: es gibt keinen. Weder Backend noch
--   Frontend liest `('anchor','seed_prompt')`; alle Fundstellen von
--   `seed_prompt` betreffen `forge_drafts`. Die Zeile wurde geschrieben und
--   nie gelesen.
--
--   Ein Ausgangssatz ist ausserdem keine EINSTELLUNG. `simulation_settings`
--   traegt, was ein Architekt aendern kann; die Herkunft einer Welt ist
--   Geschichte und darf nicht editierbar sein. Zwei Heimaten fuer eine
--   Tatsache sind der Anfang einer Abweichung.
--
--   ⚠ Die neun BESTEHENDEN Zeilen bleiben unangetastet. Sie sind harmlos, und
--   Produktionsdaten zu loeschen ist in diesem Werk eine harte Grenze — auch
--   wenn niemand sie liest. Wer sie spaeter aufraeumt, tut es als eigene,
--   bewusste Handlung und nicht als Nebenwirkung einer Funktionsaenderung.
-- ============================================================================

BEGIN;

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
        content_locale, additional_locales, philosophical_anchor,
        origin_prompt, anchor_choices
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
        ARRAY['de'],
        -- Migration 319: the anchor travels WITH the world from here on.
        -- Three of its fields already landed above as name/name_de/description;
        -- the two that carry the premise (core_question, literary_influence)
        -- had nowhere to go and were dropped on the floor. Storing the whole
        -- selected object rather than two columns keeps one shape in one place:
        -- the Astrolabe writes it, the overview reads it, and a later field on
        -- the anchor needs no third migration.
        v_anchor,
        -- Migration 328/329: die Welt behaelt, woraus sie wurde.
        --
        -- Bis hierher war die Herkunft nur im Entwurf, und der ist ein
        -- Arbeitsstand — wird er aufgeraeumt, weiss die Welt nicht mehr, aus
        -- welchem Satz sie kam. Fuer die 36 Welten von heute liess sich das
        -- rekonstruieren (ueber die Agentennamen, 13 von 16 eindeutig); ab
        -- hier wird es aufgezeichnet statt geraten.
        --
        -- `anchor_choices` ist die ganze Vorlage des Astrolab-Schritts, nicht
        -- nur der gewaehlte Anker: eine Welt, die weiss, was sie haette werden
        -- koennen, sagt mehr ueber sich als eine, die nur ihr Ergebnis kennt.
        nullif(btrim(coalesce(v_draft.seed_prompt, '')), ''),
        CASE
          WHEN jsonb_typeof(v_draft.philosophical_anchor->'options') = 'array'
           AND jsonb_array_length(v_draft.philosophical_anchor->'options') > 0
          THEN v_draft.philosophical_anchor->'options'
        END
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
        INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label, sort_order, metadata)
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
            position::int,
            -- Die Sprosse, die das Modell fuer sein EIGENES Wort genannt hat.
            --
            -- Nur fuer building_condition, nur fuer ein Wort, das die
            -- Sprossenkarte der Plattform NICHT schon kennt, und nur wenn die
            -- Zahl eine ganze Zahl im gueltigen Bereich ist. Damit kann ein
            -- Entwurf, der behauptet, 'good' sitze auf 45, die Plattformordnung
            -- nicht verschieben -- er wird uebergangen, nicht befolgt.
            --
            -- Die Pruefung steht HIER und nicht in Python, weil die Karte hier
            -- liegt. Eine zweite Fassung im Dienst waere genau die Doppelung,
            -- die Migration 322 entfernt hat.
            CASE
                WHEN regexp_replace(v_setting_key, 's$', '') = 'building_condition'
                 AND jsonb_typeof(entry) = 'object'
                 AND jsonb_typeof(entry->'rung') = 'number'
                 AND (entry->>'rung') ~ '^-?[0-9]+$'
                 AND (entry->>'rung')::int BETWEEN 1 AND 59
                 AND NOT EXISTS (
                       SELECT 1 FROM public.fn_building_condition_rungs() r
                        WHERE r.value = entry->>'value'
                     )
                THEN jsonb_build_object('rung', (entry->>'rung')::int)
                ELSE '{}'::jsonb
            END
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
        (v_sim_id, 'anchor', 'origin_note',              to_jsonb(''::text))
    ON CONFLICT (simulation_id, category, setting_key) DO NOTHING;

    -- 14. Deduct Token (admin and BYOK bypass skip deduction)
    IF NOT v_is_admin AND NOT v_has_bypass THEN
        UPDATE public.user_wallets SET forge_tokens = forge_tokens - 1 WHERE user_id = v_user_id;
    END IF;

    -- 15. Finalize Draft
    -- Der Rueckverweis steht im SELBEN UPDATE wie der Abschluss, nicht in
    -- einem zweiten daneben: ein Entwurf, der fertig ist und nicht weiss,
    -- welche Welt aus ihm wurde, ist genau der Zustand, den Migration 328
    -- nachtraeglich reparieren musste.
    UPDATE public.forge_drafts
       SET status = 'completed',
           current_phase = 'completed',
           simulation_id = v_sim_id
     WHERE id = p_draft_id;

    RETURN v_sim_id;
END;
$function$
;


-- Rechte unveraendert: SECURITY DEFINER, nur ueber den service_role-Client
-- aufrufbar (ADR-006, Migration 258). Hier ausdruecklich nachgezogen, weil
-- CREATE OR REPLACE die bestehenden Rechte behaelt und das leicht wie eine
-- Zusicherung aussieht, die niemand geprueft hat.
REVOKE ALL ON FUNCTION public.fn_materialize_shard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_materialize_shard(uuid) FROM anon, authenticated;

-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  quelle text;
  anon_darf boolean;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO quelle
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_materialize_shard';

  IF quelle NOT LIKE '%origin_prompt%' THEN
    RAISE EXCEPTION 'Die Funktion schreibt origin_prompt nicht.';
  END IF;
  IF quelle NOT LIKE '%anchor_choices%' THEN
    RAISE EXCEPTION 'Die Funktion schreibt anchor_choices nicht.';
  END IF;
  IF quelle NOT LIKE '%simulation_id = v_sim_id%' THEN
    RAISE EXCEPTION 'Die Funktion setzt den Rueckverweis am Entwurf nicht.';
  END IF;
  IF quelle LIKE '%''seed_prompt'',              to_jsonb%' THEN
    RAISE EXCEPTION 'Die tote Einstellungszeile wird noch geschrieben.';
  END IF;

  SELECT has_function_privilege('anon', 'public.fn_materialize_shard(uuid)', 'EXECUTE')
    INTO anon_darf;
  IF anon_darf THEN
    RAISE EXCEPTION 'anon darf fn_materialize_shard ausfuehren — ADR-006 verletzt.';
  END IF;

  RAISE NOTICE 'Migration 329: Herkunft wird aufgezeichnet, anon ohne Recht.';
END $$;

COMMIT;
