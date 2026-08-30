-- ═══════════════════════════════════════════════════════════════════════════
-- 284 — fn_materialize_shard nimmt zweisprachige Taxonomien entgegen (W4)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- Befund 30, und er reicht tiefer als das Dokument ihn beschrieben hat.
--
-- Schritt 8 dieser Funktion legt seit jeher eine `simulation_taxonomies`-Zeile
-- je Wert in `forge_drafts.taxonomies` an. Gemessen auf Produktion am
-- 30.08.2026: **alle 26 Entwuerfe tragen `taxonomies = {}`**. Die Schleife
-- laeuft null Mal und legt treu nichts an — jede Welt, die die Forge je gebaut
-- hat, entstand ohne jedes Vokabular. 16 von 41 Simulationen haben deshalb
-- keine `building_condition`-Taxonomie, darunter genau die Welt aus dem
-- Produktionslauf vom 29.08.
--
-- Die Folge steht in den Gebaeuden: **115 von 314 tragen einen Zustandswert,
-- den ihre eigene Simulation nicht definiert** (68 von 78 `fair`, alle 6
-- `pristine`, alle 4 `ruined`). Jeder Wert, der aus einer eigenen Taxonomie
-- stammt — `sealed`, `anomalous`, `thriving`, `illuminated` — passt; alle 17.
--
-- Die Python-Seite leitet das Vokabular jetzt aus den erzeugten Entitaeten ab
-- (`backend/services/forge_taxonomies.py`) und schreibt es vor dem Aufruf in
-- den Entwurf. Damit ein Gebaeude gar keinen Wert mehr tragen KANN, den seine
-- Welt nicht kennt: die Werte der Welt SIND die ihrer Gebaeude.
--
-- Diese Migration liefert die fehlende Haelfte. Die Funktion baute das Label
-- bisher als `jsonb_build_object('en', val)` — englisch, ohne Platz fuer die
-- deutsche Beschriftung. Das Frontend liest aber `label->>'de'`, und genau
-- deshalb druckte es bisher das, was das Modell je Gebaeude frei erfunden hat:
-- `fair` kam als mittelmaessig, maessig, befriedigend, akzeptabel, mittel,
-- ordentlich, in Ordnung, brauchbar und angemessen zurueck — dreizehn Woerter
-- fuer fuenf Werte.
--
-- WAS
-- ---
-- Schritt 8 nimmt jetzt BEIDE Formen an:
--
--   alt : {"building_conditions": ["sealed", "fair"]}
--   neu : {"building_conditions": [{"value": "sealed",
--                                   "label": {"en": "Sealed", "de": "Versiegelt"}}]}
--
-- Die alte Form bleibt gueltig und verhaelt sich exakt wie bisher (Label nur
-- englisch). Das ist kein Zugestaendnis an Altlasten, sondern noetig: ein
-- Entwurf, der zwischen Deploy und Materialisierung offen steht, wurde nach der
-- alten Regel geschrieben und muss durchlaufen.
--
-- `jsonb_typeof` entscheidet je EINTRAG, nicht je Schluessel, damit eine
-- gemischte Liste nicht an ihrem ersten Element scheitert.
--
-- Der Rest der Funktion ist unveraendert; sie wird als Ganzes ersetzt, weil
-- PostgreSQL kein Aendern eines einzelnen Blocks kennt. Der Rumpf ist aus dem
-- LIVE-Stand auf Produktion uebernommen (pg_proc.prosrc, 30.08.2026) und nicht
-- aus einer aelteren Migrationsdatei rekonstruiert — die Funktion wurde seit
-- 112 mehrfach ersetzt, und die Datei mit der hoechsten Nummer ist nicht
-- zwingend die, die laeuft.
--
-- SICHERHEIT: SECURITY DEFINER bleibt, und der EXECUTE-Grant bleibt so eng wie
-- er ist — kein Grant an anon/authenticated (ADR-006, Migrationen 257/258).
-- Der Aufrufer ist der Service-Role-Client, der Router prueft vorher.
-- ═══════════════════════════════════════════════════════════════════════════

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
    INSERT INTO public.simulations (
        name, slug, description, description_de, theme, owner_id, status, simulation_type,
        content_locale, additional_locales
    ) VALUES (
        v_anchor->>'title',
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
        INSERT INTO public.simulation_taxonomies (simulation_id, taxonomy_type, value, label)
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
            END
        FROM jsonb_array_elements(v_setting_val) AS entry
        WHERE coalesce(
            CASE jsonb_typeof(entry)
                WHEN 'object' THEN entry->>'value'
                ELSE entry #>> '{}'
            END, '') <> '';
    END LOOP;

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
