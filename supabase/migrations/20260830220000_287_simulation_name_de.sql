-- ═══════════════════════════════════════════════════════════════════════════
-- 287 — die Welt bekommt auch einen deutschen Namen (Befund 16b)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- Die Zeremonie zeigt "STATE PATHOGRAPHY: LEGIBILITY AS BIOPOLITICAL METABOLISM"
-- unter einer deutschen Oberflaeche. Das ist die sichtbare Haelfte; die ernste
-- steht in der Datenbank.
--
-- Schritt 5 dieser Funktion fuellt `description_de` aus dem Anker — und
-- `name_de` nicht, obwohl der Anker `title_de` traegt und die Zeile direkt
-- daneben steht. Gemessen auf Produktion 2026-08-30:
--
--   41 von 41 Simulationen haben name_de leer
--   15 von 19 Entwuerfen mit gewaehltem Anker haben ein title_de
--   im ganzen Backend schreibt KEINE Zeile Code simulations.name_de
--
-- Eine Welt traegt ihren englischen Namen damit ihr Leben lang, in jeder
-- Ansicht und in jeder Sprache. Der Slug ist aus dem englischen Namen
-- abgeleitet und bleibt, wie er ist — er ist eine Adresse, kein Text.
--
-- Die deutschen Titel sind da und sie sind gut: "Staatspathographie:
-- Leserlichkeit als biopolitischer Stoffwechsel", "Der oneironautische
-- Leuchtturm", "Die Prophezeiung der gebrochenen Zeit". Sie wurden erzeugt,
-- gespeichert und nie gelesen.
--
-- WAS
-- ---
-- 1. KUENFTIG: Schritt 5 schreibt `name_de` aus `v_anchor->>'title_de'`, genau
--    parallel zu `description_de` eine Zeile darunter.
-- 2. RUECKWIRKEND: die zehn Welten, deren deutscher Titel noch in ihrem eigenen
--    Entwurf steht, bekommen ihn.
--
-- WAS DIE NACHZIEHUNG NICHT TUT
-- -----------------------------
-- Sie uebersetzt nichts. Von den 41 Welten sind
--   10  aus dem eigenen Entwurf herstellbar   -> werden gesetzt
--    7  tragen ohnehin einen deutschen Namen  -> unberuehrt
--   24  englischer Name, keine Quelle          -> unberuehrt
-- Fuer die 24 waere ein Name zu erfinden eine Benennungsentscheidung, keine
-- Wiederherstellung. `t()` im Frontend faellt beidseitig zurueck, sie zeigen
-- also weiterhin korrekt ihren `name` — eine fehlende Uebersetzung ist eine
-- sichtbare Luecke, eine erfundene nicht.
--
-- DIE ZUORDNUNG IST EXAKT, NICHT UNGEFAEHR
-- ----------------------------------------
-- `forge_drafts` hat keine Spalte, die auf die Simulation zeigt. Die Zuordnung
-- laeuft daher ueber den Slug, den diese Funktion selbst aus dem Ankertitel
-- bildet — mit demselben regexp_replace, und mit dem Kollisionssuffix `-1`,
-- `-2` aus der Schleife darueber.
--
-- Das Muster ist `^<basis>(-[0-9]+)?$` und NICHT `LIKE '<basis>-%'`. Der
-- Unterschied ist nicht theoretisch: auf Produktion existieren
-- `the-tamagotchi-temporality` und `the-tamagotchi-temporality-principle`, und
-- ihre deutschen Titel sind verschieden ("Die Tamagotchi-Zeitlichkeit" gegen
-- "Das Tamagotchi-Zeitlichkeitsprinzip"). Ein LIKE haette der einen den Namen
-- der anderen gegeben.
--
-- Zusaetzlich wird nur gesetzt, wo GENAU EIN Entwurf passt und name_de leer
-- ist. Ein zweideutiger Treffer bleibt liegen, statt geraten zu werden.
--
-- Der Funktionsrumpf stammt aus dem LIVE-Stand auf Produktion (pg_proc.prosrc,
-- 30.08.2026, also einschliesslich der Migrationen 284 und 286).
-- SECURITY DEFINER bleibt, kein neuer EXECUTE-Grant (ADR-006).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Kuenftig: Schritt 5 fuellt name_de.
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

-- 2. Rueckwirkend: die zehn Welten mit einem deutschen Titel im eigenen Entwurf.
WITH kandidat AS (
    SELECT
        trim(BOTH '-' FROM lower(regexp_replace(
            d.philosophical_anchor->'selected'->>'title', '[^a-zA-Z0-9]+', '-', 'g'
        ))) AS slug_base,
        d.philosophical_anchor->'selected'->>'title_de' AS title_de
    FROM public.forge_drafts d
    WHERE coalesce(d.philosophical_anchor->'selected'->>'title_de', '') <> ''
), eindeutig AS (
    SELECT s.id, min(k.title_de) AS title_de
    FROM public.simulations s
    JOIN kandidat k ON s.slug ~ ('^' || k.slug_base || '(-[0-9]+)?$')
    WHERE coalesce(s.name_de, '') = ''
    GROUP BY s.id
    HAVING count(DISTINCT k.title_de) = 1   -- zweideutig bleibt liegen
)
UPDATE public.simulations s
SET name_de = e.title_de, updated_at = now()
FROM eindeutig e
WHERE s.id = e.id;
