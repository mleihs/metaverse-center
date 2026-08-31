-- ============================================================================
-- Migration 305 — Ein Fünftel der Botschafter-Güte war die Länge eines Namens
-- ============================================================================
--
-- BEFUND (D12, zweiter Teil)
-- --------------------------
-- `embassy_ambassador_quality` in `mv_embassy_effectiveness` speiste bis zu
-- **0,2 von 1,0** aus der ZEICHENLÄNGE der Botschafternamen:
--
--     LEAST(0.2, (length(name_a) + length(name_b)) / 50.0)
--
-- Ein Botschafter namens „Bartholomew Featherstonehaugh" war damit
-- diplomatisch wirksamer als einer namens „Li Wei". Die Güte geht mit Gewicht
-- 0,4 in die Botschaftswirksamkeit ein und von dort in die Weltgesundheit —
-- eine Umbenennung veränderte die Diplomatie einer Welt.
--
-- Das ist keine Balance-Zahl, sondern ein Stellvertreter, der nichts misst.
-- Gemeint war offensichtlich „die Schmiede hat einen richtigen Namen
-- geschrieben"; gemessen wurde, wie viele Buchstaben er hat.
--
-- WAS SICH ÄNDERT
-- ---------------
-- Anwesenheit statt Länge, 0,1 je Name, gleicher Deckel von 0,2 — dasselbe
-- Muster, das die Nachbarterme für `quirk` (0,1 + 0,1) und `role`
-- (0,05 + 0,05) längst benutzen. Es wird also keine neue Zahl erfunden,
-- sondern eine bestehende Form auf einen Term übertragen, der aus der Reihe
-- fiel.
--
-- **Auf dem heutigen Bestand ändert sich nichts.** Vorher gemessen über alle
-- 40 Botschaften: größte Verschiebung **0,000**, Mittel 0,185 vor und nach der
-- Änderung, 40 von 40 unverändert. Jede Botschaft trägt entweder beide Namen
-- (mit je ≥ 10 Zeichen, also am Deckel) oder keinen.
--
-- WARUM DIE SICHTEN NEU GEBAUT WERDEN MÜSSEN
-- ------------------------------------------
-- `mv_embassy_effectiveness` ist eine MATERIALISIERTE Sicht; für die gibt es
-- kein `CREATE OR REPLACE`. `mv_simulation_health` hängt an ihr, ein
-- `DROP … CASCADE` nimmt sie also mit. Beide Rümpfe stammen aus
-- `pg_get_viewdef` auf PROD — nicht aus Migration 031, denn der Ledger taugt
-- nicht als Beleg für den Bestand.
--
-- Gemessener Ist-Zustand vor dem Eingriff, hier danach wiederhergestellt:
--   mv_embassy_effectiveness: 3 Indizes (1 UNIQUE auf embassy_id, je einer auf
--                             simulation_a_id und simulation_b_id), KEINE Grants
--   mv_simulation_health:     2 Indizes (1 UNIQUE auf simulation_id, einer auf
--                             slug), KEINE Grants
--   Abhängige von mv_simulation_health: keine
--
-- Die UNIQUE-Indizes sind nicht schmückend: ohne sie ist
-- `REFRESH MATERIALIZED VIEW CONCURRENTLY` unmöglich, und der Herzschlag
-- refresht im Betrieb. Sie werden deshalb vor dem abschließenden REFRESH
-- wieder angelegt.
--
-- Der Abnahmeblock am Ende prüft: beide Sichten da, alle fünf Indizes da, kein
-- `length(` mehr im Rumpf, und die Zeilenzahlen stimmen (40 Botschaften, 36
-- Welten). Die WERTGLEICHHEIT wird außerhalb der Migration geprüft, gegen die
-- vorher gesicherten 40 + 36 Zeilen — innerhalb wäre sie nicht möglich, weil
-- die alten Werte nach dem DROP nicht mehr existieren.
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_embassy_effectiveness CASCADE;

CREATE MATERIALIZED VIEW mv_embassy_effectiveness AS
 WITH embassy_building_health AS (
         SELECT e_1.id AS embassy_id,
            COALESCE(bra.readiness, game_weight_fallback('building_condition'::text, ba.building_condition)) AS readiness_a,
            COALESCE(brb.readiness, game_weight_fallback('building_condition'::text, bb.building_condition)) AS readiness_b,
            (COALESCE(bra.readiness, game_weight_fallback('building_condition'::text, ba.building_condition)) + COALESCE(brb.readiness, game_weight_fallback('building_condition'::text, bb.building_condition))) / 2.0 AS avg_building_health
           FROM embassies e_1
             JOIN buildings ba ON ba.id = e_1.building_a_id
             JOIN buildings bb ON bb.id = e_1.building_b_id
             LEFT JOIN mv_building_readiness bra ON bra.building_id = e_1.building_a_id
             LEFT JOIN mv_building_readiness brb ON brb.building_id = e_1.building_b_id
        ), embassy_ambassador_quality AS (
         SELECT e_1.id AS embassy_id,
                CASE
                    WHEN e_1.embassy_metadata IS NULL THEN 0.3
                    WHEN (e_1.embassy_metadata -> 'ambassador_a'::text) IS NULL AND (e_1.embassy_metadata -> 'ambassador_b'::text) IS NULL THEN 0.3
                    ELSE LEAST(1.0, 0.4 + (
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_a'::text) ->> 'name'::text) IS NOT NULL THEN 0.1
                        ELSE 0::numeric
                    END +
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_b'::text) ->> 'name'::text) IS NOT NULL THEN 0.1
                        ELSE 0::numeric
                    END) +
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_a'::text) ->> 'quirk'::text) IS NOT NULL THEN 0.1
                        ELSE 0::numeric
                    END +
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_b'::text) ->> 'quirk'::text) IS NOT NULL THEN 0.1
                        ELSE 0::numeric
                    END +
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_a'::text) ->> 'role'::text) IS NOT NULL THEN 0.05
                        ELSE 0::numeric
                    END +
                    CASE
                        WHEN ((e_1.embassy_metadata -> 'ambassador_b'::text) ->> 'role'::text) IS NOT NULL THEN 0.05
                        ELSE 0::numeric
                    END)
                END AS ambassador_quality
           FROM embassies e_1
        ), embassy_vector_alignment AS (
         SELECT e_1.id AS embassy_id,
                CASE
                    WHEN sc.bleed_vectors IS NOT NULL AND (e_1.bleed_vector = ANY (sc.bleed_vectors)) THEN 1.0
                    ELSE 0.0
                END AS vector_alignment
           FROM embassies e_1
             LEFT JOIN simulation_connections sc ON (sc.simulation_a_id = e_1.simulation_a_id AND sc.simulation_b_id = e_1.simulation_b_id OR sc.simulation_a_id = e_1.simulation_b_id AND sc.simulation_b_id = e_1.simulation_a_id) AND sc.is_active = true
        )
 SELECT e.id AS embassy_id,
    e.simulation_a_id,
    e.simulation_b_id,
    e.building_a_id,
    e.building_b_id,
    e.status,
    e.bleed_vector,
    LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) AS building_health,
    LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) AS ambassador_quality,
    COALESCE(eva.vector_alignment, 0.0) AS vector_alignment,
        CASE
            WHEN e.status <> 'active'::text THEN 0.0
            ELSE LEAST(1.0, GREATEST(0.0, LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4 + LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4 + COALESCE(eva.vector_alignment, 0.0) * 0.2))
        END AS effectiveness,
        CASE
            WHEN e.status <> 'active'::text THEN 'dormant'::text
            WHEN LEAST(1.0, GREATEST(0.0, LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4 + LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4 + COALESCE(eva.vector_alignment, 0.0) * 0.2)) < 0.3 THEN 'dormant'::text
            WHEN LEAST(1.0, GREATEST(0.0, LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4 + LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4 + COALESCE(eva.vector_alignment, 0.0) * 0.2)) < 0.6 THEN 'limited'::text
            WHEN LEAST(1.0, GREATEST(0.0, LEAST(1.0, COALESCE(ebh.avg_building_health, 0.5)) * 0.4 + LEAST(1.0, COALESCE(eaq.ambassador_quality, 0.3)) * 0.4 + COALESCE(eva.vector_alignment, 0.0) * 0.2)) < 0.8 THEN 'operational'::text
            ELSE 'optimal'::text
        END AS effectiveness_label
   FROM embassies e
     LEFT JOIN embassy_building_health ebh ON ebh.embassy_id = e.id
     LEFT JOIN embassy_ambassador_quality eaq ON eaq.embassy_id = e.id
     LEFT JOIN embassy_vector_alignment eva ON eva.embassy_id = e.id;

CREATE UNIQUE INDEX idx_mv_embassy_eff_pk ON public.mv_embassy_effectiveness USING btree (embassy_id);
CREATE INDEX idx_mv_embassy_eff_sim_a ON public.mv_embassy_effectiveness USING btree (simulation_a_id);
CREATE INDEX idx_mv_embassy_eff_sim_b ON public.mv_embassy_effectiveness USING btree (simulation_b_id);

COMMENT ON MATERIALIZED VIEW mv_embassy_effectiveness IS
  'Wirksamkeit je Botschaft: Gebäudebereitschaft 0,4 + Botschafter-Güte 0,4 + '
  'Bleed-Vektor 0,2. Die Güte zählt seit Migration 305 die ANWESENHEIT eines '
  'Botschafternamens (0,1 je Name), nicht mehr seine Zeichenlänge — vorher war '
  'ein langer Name diplomatisch wirksamer als ein kurzer.';

CREATE MATERIALIZED VIEW mv_simulation_health AS
 WITH sim_zones AS (
         SELECT zs.simulation_id,
            avg(zs.stability) AS avg_zone_stability,
            count(*) AS zone_count,
            count(*) FILTER (WHERE zs.stability_label = 'critical'::text) AS critical_zone_count,
            count(*) FILTER (WHERE zs.stability_label = 'unstable'::text) AS unstable_zone_count,
            min(zs.stability) AS min_zone_stability,
            max(zs.stability) AS max_zone_stability,
            sum(zs.building_count) AS total_buildings,
            sum(zs.total_agents) AS total_agents,
            sum(zs.total_capacity) AS total_capacity
           FROM mv_zone_stability zs
          GROUP BY zs.simulation_id
        ), sim_buildings AS (
         SELECT br.simulation_id,
            count(*) AS building_count,
            avg(br.readiness) AS avg_readiness,
            count(*) FILTER (WHERE br.staffing_status = 'critically_understaffed'::text) AS critically_understaffed,
            count(*) FILTER (WHERE br.staffing_status = 'overcrowded'::text) AS overcrowded
           FROM mv_building_readiness br
          GROUP BY br.simulation_id
        ), sim_diplomacy AS (
         SELECT embassy_per_sim.sim_id,
            sum(embassy_per_sim.eff) AS diplomatic_reach,
            count(*) AS active_embassy_count,
            avg(embassy_per_sim.eff) AS avg_embassy_effectiveness
           FROM ( SELECT ee.simulation_a_id AS sim_id,
                    ee.effectiveness AS eff
                   FROM mv_embassy_effectiveness ee
                  WHERE ee.status = 'active'::text
                UNION ALL
                 SELECT ee.simulation_b_id AS sim_id,
                    ee.effectiveness AS eff
                   FROM mv_embassy_effectiveness ee
                  WHERE ee.status = 'active'::text) embassy_per_sim
          GROUP BY embassy_per_sim.sim_id
        ), sim_bleed AS (
         SELECT s_1.id AS simulation_id,
            count(DISTINCT eo.id) AS outbound_echoes,
            count(DISTINCT ei.id) AS inbound_echoes,
            COALESCE(avg(eo.echo_strength), 0::numeric) AS avg_outbound_strength
           FROM simulations s_1
             LEFT JOIN event_echoes eo ON eo.source_simulation_id = s_1.id AND eo.created_at >= (now() - '30 days'::interval)
             LEFT JOIN event_echoes ei ON ei.target_simulation_id = s_1.id AND ei.created_at >= (now() - '30 days'::interval)
          WHERE s_1.deleted_at IS NULL
          GROUP BY s_1.id
        ), health_config AS (
         SELECT COALESCE(( SELECT LEAST(0.30, GREATEST(0.0, platform_settings.setting_value::text::numeric)) AS "least"
                   FROM platform_settings
                  WHERE platform_settings.setting_key = 'heartbeat_health_baseline_floor'::text), 0.10) AS baseline_floor
        )
 SELECT s.id AS simulation_id,
    s.name AS simulation_name,
    s.slug,
    COALESCE(sz.avg_zone_stability, 0.0) AS avg_zone_stability,
    COALESCE(sz.zone_count, 0::bigint) AS zone_count,
    COALESCE(sz.critical_zone_count, 0::bigint) AS critical_zone_count,
    COALESCE(sz.unstable_zone_count, 0::bigint) AS unstable_zone_count,
    COALESCE(sb.building_count, 0::bigint) AS building_count,
    COALESCE(sb.avg_readiness, 0.0) AS avg_readiness,
    COALESCE(sb.critically_understaffed, 0::bigint) AS critically_understaffed_buildings,
    COALESCE(sb.overcrowded, 0::bigint) AS overcrowded_buildings,
    COALESCE(sz.total_agents, 0::numeric) AS total_agents_assigned,
    COALESCE(sz.total_capacity, 0::numeric) AS total_capacity,
    COALESCE(sd.diplomatic_reach, 0.0) AS diplomatic_reach,
    COALESCE(sd.active_embassy_count, 0::bigint) AS active_embassy_count,
    COALESCE(sd.avg_embassy_effectiveness, 0.0) AS avg_embassy_effectiveness,
    COALESCE(sbl.outbound_echoes, 0::bigint) AS outbound_echoes,
    COALESCE(sbl.inbound_echoes, 0::bigint) AS inbound_echoes,
    COALESCE(sbl.avg_outbound_strength, 0.0) AS avg_outbound_strength,
    LEAST(1.0, GREATEST(0.0, (1.0 - COALESCE(sz.avg_zone_stability, 0.5) * 0.3) * (0.5 + LEAST(0.5, COALESCE(sd.diplomatic_reach, 0.0) / 5.0)))) AS bleed_permeability,
    LEAST(1.0, GREATEST(0.0, hc.baseline_floor + COALESCE(sz.avg_zone_stability, 0.0) * 0.6 + COALESCE(sb.avg_readiness, 0.0) * 0.2 + LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)) AS overall_health,
        CASE
            WHEN LEAST(1.0, GREATEST(0.0, hc.baseline_floor + COALESCE(sz.avg_zone_stability, 0.0) * 0.6 + COALESCE(sb.avg_readiness, 0.0) * 0.2 + LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)) < 0.3 THEN 'critical'::text
            WHEN LEAST(1.0, GREATEST(0.0, hc.baseline_floor + COALESCE(sz.avg_zone_stability, 0.0) * 0.6 + COALESCE(sb.avg_readiness, 0.0) * 0.2 + LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)) < 0.5 THEN 'struggling'::text
            WHEN LEAST(1.0, GREATEST(0.0, hc.baseline_floor + COALESCE(sz.avg_zone_stability, 0.0) * 0.6 + COALESCE(sb.avg_readiness, 0.0) * 0.2 + LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)) < 0.7 THEN 'functional'::text
            WHEN LEAST(1.0, GREATEST(0.0, hc.baseline_floor + COALESCE(sz.avg_zone_stability, 0.0) * 0.6 + COALESCE(sb.avg_readiness, 0.0) * 0.2 + LEAST(1.0, COALESCE(sd.diplomatic_reach, 0.0) / 3.0) * 0.2)) < 0.9 THEN 'thriving'::text
            ELSE 'exemplary'::text
        END AS health_label
   FROM simulations s
     CROSS JOIN health_config hc
     LEFT JOIN sim_zones sz ON sz.simulation_id = s.id
     LEFT JOIN sim_buildings sb ON sb.simulation_id = s.id
     LEFT JOIN sim_diplomacy sd ON sd.sim_id = s.id
     LEFT JOIN sim_bleed sbl ON sbl.simulation_id = s.id
  WHERE s.deleted_at IS NULL AND (s.status = ANY (ARRAY['active'::text, 'configuring'::text]));

CREATE UNIQUE INDEX idx_mv_sim_health_pk ON public.mv_simulation_health USING btree (simulation_id);
CREATE INDEX idx_mv_sim_health_slug ON public.mv_simulation_health USING btree (slug);

REFRESH MATERIALIZED VIEW mv_embassy_effectiveness;
REFRESH MATERIALIZED VIEW mv_simulation_health;

-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_indizes integer;
  v_botschaften integer;
  v_welten integer;
BEGIN
  IF to_regclass('public.mv_embassy_effectiveness') IS NULL THEN
    RAISE EXCEPTION 'Migration 305: mv_embassy_effectiveness fehlt';
  END IF;
  IF to_regclass('public.mv_simulation_health') IS NULL THEN
    RAISE EXCEPTION 'Migration 305: mv_simulation_health fehlt';
  END IF;

  SELECT count(*) INTO v_indizes
  FROM pg_index x
  WHERE x.indrelid IN ('mv_embassy_effectiveness'::regclass, 'mv_simulation_health'::regclass);
  IF v_indizes <> 5 THEN
    RAISE EXCEPTION 'Migration 305: % statt 5 Indizes — ohne den UNIQUE ist CONCURRENTLY unmoeglich', v_indizes;
  END IF;

  -- Die Zeichenlaenge darf im Rumpf nicht mehr vorkommen. Geprueft wird die
  -- Sichtdefinition, in der es keine Kommentare gibt.
  IF position('length(' in pg_get_viewdef('mv_embassy_effectiveness'::regclass, true)) > 0 THEN
    RAISE EXCEPTION 'Migration 305: length( steht noch im Rumpf von mv_embassy_effectiveness';
  END IF;

  SELECT count(*) INTO v_botschaften FROM mv_embassy_effectiveness;
  SELECT count(*) INTO v_welten FROM mv_simulation_health;
  IF v_botschaften <> 40 THEN
    RAISE EXCEPTION 'Migration 305: % statt 40 Botschaften nach dem Neubau', v_botschaften;
  END IF;
  IF v_welten <> 36 THEN
    RAISE EXCEPTION 'Migration 305: % statt 36 Welten nach dem Neubau', v_welten;
  END IF;
END;
$$;
