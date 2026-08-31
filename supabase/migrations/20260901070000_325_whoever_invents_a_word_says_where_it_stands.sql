-- ============================================================================
-- 325 · Wer ein Wort erfindet, sagt auch, wo es steht
-- ============================================================================
--
-- Der letzte offene Punkt aus T11.
--
-- Die Taxonomie einer Welt wird aus dem ABGELEITET, was das Modell geschrieben
-- hat (`forge_taxonomies`, Befund 30) — konsistent von Konstruktion her, weil
-- die Werte der Welt genau die sind, die ihre Bauten tragen. Aber eine
-- Ableitung erzeugt eine MENGE, und der Verfall braucht eine FOLGE:
-- `fn_degrade_building` bewegt einen Bau eine Leiter ABWÄRTS, und ein Wort ohne
-- Platz kann sich nicht bewegen.
--
-- Migration 320 hat die dreizehn Wörter eingehängt, die es damals gab. Das
-- reparierte den Bestand, nicht die Leitung: das nächste erfundene Wort
-- (`waterlogged`, `flooded`, was auch immer eine Welt braucht) wäre wieder ohne
-- Sprosse entstanden, und irgendwann hätte jemand die nächste Migration
-- geschrieben.
--
-- WER DIE FRAGE BEANTWORTEN KANN
--
-- Eine Ableitung kann keine Ordnung erfinden — sie sieht Wörter, keine
-- Bedeutungen. Ein zweiter Modellaufruf wäre eine zweite Fehlerquelle. Bleibt
-- der Aufruf, der das Wort ohnehin schreibt: **das Modell weiss, was es
-- gemeint hat.** `ForgeBuildingDraft.condition_rung` fragt es (1 = unberührt,
-- 59 = Ruine, mit den Kernsprossen als Ankern), `forge_taxonomies` trägt die
-- Zahl in den Entwurf, und diese Migration schreibt sie beim Materialisieren
-- nach `metadata.rung` — wo `fn_building_condition_ladder` sie seit 324 als
-- echten Vorrang liest.
--
-- WAS EIN ENTWURF NICHT KANN: DIE PLATTFORMORDNUNG VERSCHIEBEN
--
-- Die Zahl wird NUR übernommen für
--   * `building_condition` (die anderen fünf Vokabulare sind Mengen ohne
--     Rangfolge — ein Beruf steht nicht über einem anderen),
--   * ein Wort, das `fn_building_condition_rungs()` NICHT schon kennt,
--   * eine ganze Zahl zwischen 1 und 59.
--
-- Ein Entwurf, der behauptet, `good` sitze auf 45, wird übergangen statt
-- befolgt. Die Prüfung steht hier und nicht in Python, weil die Karte hier
-- liegt — eine zweite Fassung im Dienst wäre genau die Doppelung, die
-- Migration 322 entfernt hat.
--
-- ⚠ WARUM DIE GANZE FUNKTION HIER STEHT
-- Geändert sind genau zwei Zeilen in Schritt 8: die Spaltenliste bekommt
-- `metadata`, und die SELECT-Liste bekommt den CASE-Ausdruck. Der Rest ist der
-- Quelltext der laufenden Funktion, programmatisch aus `pg_get_functiondef`
-- geholt und nicht abgeschrieben — eine 307-Zeilen-Funktion von Hand zu
-- reproduzieren ist die Art Handgriff, bei der eine Zeile still verloren geht.
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
        content_locale, additional_locales, philosophical_anchor
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
        v_anchor
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
$function$;

COMMIT;
