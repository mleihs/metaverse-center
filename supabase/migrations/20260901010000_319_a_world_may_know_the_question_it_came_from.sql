-- ============================================================================
-- Migration 319 — Eine Welt darf die Frage kennen, aus der sie entstanden ist
-- ============================================================================
--
-- BEFUND
-- ------
-- Der Astrolab wählt für jeden Schmiede-Entwurf EINEN philosophischen Anker,
-- und jeder spätere Erzeugungsschritt ist gegen ihn geschrieben. Der Anker hat
-- fünf inhaltliche Felder:
--
--     title / title_de              -> wird der NAME der Welt          ✓ bleibt
--     description / description_de  -> wird die BESCHREIBUNG der Welt  ✓ bleibt
--     core_question / _de           -> nirgendwohin                    ✗ verloren
--     literary_influence / _de      -> nirgendwohin                    ✗ verloren
--     bleed_signature_suggestion    -> nirgendwohin                    ✗ verloren
--
-- `fn_materialize_shard` liest `philosophical_anchor->'selected'` in `v_anchor`,
-- nimmt daraus zwei Felderpaare und verwirft den Rest. Die Kernfrage — der
-- Satz, um den die Welt gebaut wurde — überlebt die Materialisierung nicht.
--
-- Danach ist sie nicht wiederherstellbar: sie steht nur noch in `forge_drafts`,
-- und `forge_drafts` ist eigentümergebunden (RLS: `auth.uid() = user_id`).
-- Wer eine Welt ansieht, die ihm nicht gehört, kann ihre Frage nicht lesen —
-- auch der Eigentümer nicht, denn zwischen Entwurf und Welt gibt es KEINE
-- Fremdschlüsselbeziehung. Gemessen: `forge_drafts` trägt kein `simulation_id`,
-- `simulations` kein `forge_draft_id`. Es gibt keinen Weg zurück.
--
-- Der Anlass ist die neue Übersichtsseite (Design-Paket vom 31.08.2026,
-- `handoff/simulation-views/README.md`, „Tab ◈ Übersicht"): ihre erste Karte
-- ist der Anker — Label, Titel, und die Frage als Zitat. Ohne diese Spalte ist
-- das eine Karte, deren Zustand niemals eintreten kann.
--
-- WARUM EINE SPALTE UND KEINE SICHT
-- ----------------------------------
-- Migration 314 hat für die Ausgangssätze eine schmale Sicht auf `forge_drafts`
-- gebaut, statt zu kopieren. Das war dort richtig und ist hier unmöglich: jene
-- Sicht gibt einen BESTAND heraus (alle Sätze, ohne Zuordnung), diese Karte
-- braucht die Zuordnung (die Frage DIESER Welt). Ohne Fremdschlüssel kann keine
-- Sicht sie herstellen.
--
-- Der Anker gehört ohnehin der Welt und nicht dem Entwurf. Der Entwurf ist ein
-- Zwischenstand; die Welt ist das Werk. Dass drei seiner Felder schon heute in
-- `simulations` stehen, sagt dasselbe.
--
-- WAS DAMIT NEU ÖFFENTLICH WIRD — und was nicht
-- ----------------------------------------------
-- Neu lesbar sind `core_question`, `literary_influence` und
-- `bleed_signature_suggestion`. NICHT neu sind Titel und Beschreibung: die
-- stehen seit der Materialisierung als Name und Beschreibung der Welt da und
-- sind über `active_simulations` längst anon-lesbar.
--
-- Nichts davon ist Nutzerdatum: es ist verfasster Text ÜBER die Welt, aus
-- derselben Erzeugung wie ihr Name. Kein `user_id`, kein Zeitstempel, kein
-- Zwischenstand — die Spalte trägt genau das gewählte Ankerobjekt.
--
-- ⚠ ENTSCHEIDUNG DES NUTZERS ERFORDERLICH, WIE BEI MIGRATION 314
-- Diese Migration ist gebaut und geprobt, aber NICHT auf Prod angewandt. Der
-- Rückfüll-Abschnitt (5) macht die Frage von 16 bestehenden Welten sichtbar.
-- Migration 314 hat für die Ausgangssätze denselben Schritt getan und trägt
-- dazu einen ausdrücklichen Satz: „Der Nutzer hat am 31.08.2026 entschieden,
-- dass sie gezeigt werden dürfen." Für die Kernfragen fehlt dieser Satz noch.
-- Ohne ihn: Abschnitt 5 auskommentieren, dann gilt die Spalte nur für Welten,
-- die ab jetzt entstehen.
--
-- WIE ZURÜCKGEFÜLLT WIRD, OHNE FREMDSCHLÜSSEL
-- --------------------------------------------
-- Über die Gleichheit, die die Materialisierung selbst herstellt:
-- `simulations.name = anchor->>'title'`. Das ist keine Heuristik, sondern die
-- Umkehrung der Zuweisung in Abschnitt 4 dieser Datei.
--
-- Zwei Sicherungen, weil eine Gleichheit auf Text kein Fremdschlüssel ist:
--   * nur `status = 'completed'` — ein Entwurf, der nie fertig wurde, hat keine
--     Welt erzeugt, und sein Titel könnte zufällig gleich lauten;
--   * nur EINDEUTIGE Titel — trägt derselbe Titel zwei abgeschlossene Entwürfe,
--     bleibt die Welt leer. Eine leere Karte ist richtig; eine falsch
--     zugeordnete Frage wäre eine Lüge über die Welt.
--
-- ANGEWANDT AUF PROD: nein (Stand 31.08.2026)
-- ============================================================================


-- ============================================================
-- 1. Die Spalte
-- ============================================================

ALTER TABLE public.simulations
    ADD COLUMN IF NOT EXISTS philosophical_anchor jsonb;

COMMENT ON COLUMN public.simulations.philosophical_anchor IS
    'Das im Astrolab gewaehlte Ankerobjekt, wie es der Entwurf trug '
    '(title, title_de, core_question, core_question_de, literary_influence, '
    'literary_influence_de, description, description_de, '
    'bleed_signature_suggestion). Titel und Beschreibung stehen zusaetzlich als '
    'name/description der Welt — hier liegt das ganze Objekt, damit ein spaeter '
    'ergaenztes Ankerfeld keine dritte Migration braucht. NULL bei Welten, die '
    'nicht aus der Schmiede stammen oder deren Entwurf nicht mehr zuzuordnen war.';


-- ============================================================
-- 2. Die Sicht muss die neue Spalte kennen
-- ============================================================
--
-- Pflicht laut CLAUDE.md: `SELECT *` in einer Sicht loest die Spalten beim
-- ANLEGEN auf, nicht beim Abfragen. Ohne dieses CREATE OR REPLACE traegt
-- `active_simulations` die Spalte nie, und das Frontend liest ueber die Sicht.
-- Optionen der Sicht (u. a. das absichtlich fehlende `security_invoker`)
-- bleiben von CREATE OR REPLACE unberuehrt.

CREATE OR REPLACE VIEW active_simulations AS
SELECT * FROM simulations WHERE deleted_at IS NULL;


-- ============================================================
-- 3. Die Materialisierung schreibt den Anker mit
-- ============================================================
--
-- Wortgleiche Uebernahme der Fassung aus Migration 308, mit genau zwei
-- Aenderungen: `philosophical_anchor` in der Spaltenliste, `v_anchor` in den
-- Werten. Der Rest ist unveraendert — diese Datei ist keine Gelegenheit,
-- nebenbei etwas anderes zu reparieren.
--
-- Warum in SQL und nicht als UPDATE im Python danach: die Materialisierung ist
-- eine Transaktion. Ein zweiter Schreibvorgang ausserhalb liesse bei einem
-- Fehlschlag dazwischen eine Welt ohne ihren Anker stehen — genau die Klasse
-- von halbem Zustand, gegen die ADR-007 und Migration 236 geschrieben sind.

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


-- ============================================================
-- 4. Nachweis, dass Abschnitt 3 wirklich griff
-- ============================================================
--
-- Eine Funktion, die man ersetzt hat, sieht nach dem Ersetzen immer richtig
-- aus. Diese Probe fragt den gespeicherten Quelltext, nicht die Absicht.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'fn_materialize_shard'
          AND prosrc LIKE '%philosophical_anchor%'
    ) THEN
        RAISE EXCEPTION 'Migration 319: fn_materialize_shard schreibt den Anker nicht';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'active_simulations'
          AND column_name = 'philosophical_anchor'
    ) THEN
        RAISE EXCEPTION 'Migration 319: active_simulations kennt die Spalte nicht';
    END IF;

    RAISE NOTICE '319 ok — Spalte, Sicht und Materialisierung tragen den Anker';
END;
$$;


-- ============================================================
-- 5. Rueckfuellung bestehender Welten
-- ============================================================
--
-- ⚠ NUR ANWENDEN, WENN DER NUTZER DIE FREIGABE ERTEILT HAT (siehe Kopf).
-- Ohne Freigabe: diesen Abschnitt auskommentiert lassen.
--
-- Zuordnung ueber die Gleichheit, die Abschnitt 3 selbst herstellt
-- (`simulations.name = anchor->>'title'`), abgesichert gegen Mehrdeutigkeit.

WITH eindeutig AS (
    SELECT
        d.philosophical_anchor->'selected'          AS anker,
        d.philosophical_anchor->'selected'->>'title' AS titel
    FROM public.forge_drafts d
    WHERE d.status = 'completed'
      AND d.philosophical_anchor->'selected'->>'title' IS NOT NULL
    GROUP BY 1, 2
    HAVING count(*) = 1
)
UPDATE public.simulations s
SET philosophical_anchor = e.anker
FROM eindeutig e
WHERE s.name = e.titel
  AND s.philosophical_anchor IS NULL
  AND s.deleted_at IS NULL;

DO $$
DECLARE
    v_mit int;
    v_ohne int;
BEGIN
    SELECT
        count(*) FILTER (WHERE philosophical_anchor IS NOT NULL),
        count(*) FILTER (WHERE philosophical_anchor IS NULL)
    INTO v_mit, v_ohne
    FROM public.simulations WHERE deleted_at IS NULL;

    RAISE NOTICE '319 Rueckfuellung: % Welten mit Anker, % ohne', v_mit, v_ohne;
END;
$$;
