-- Migration 252: DRIFT — travel_content_expansion (the content & flavor layer)
--
-- Spec: docs/plans/drift-implementation-plan.md §9.3/§9.4 (the dispatch_flavor
--       touchpoint — its drift_ai_enabled=false fallback is "template text
--       verbatim"; this migration IS that verbatim layer, the dependency-correct
--       floor the LLM dressing later overlays), §10 (the effect vocabulary the
--       deliver Depesche fires through the single hospitality gate).
-- Design contract: docs/concepts/drift-zwischenraum-travel-game-concept.md v0.4
--       §7.8 (the 7 cargo families ↔ 7 bleed vectors), §9.1 (Depeschen families).
--
-- Three things, all data (no Python content — the §9.1 pack pipeline is a separate
-- named package; until it lands this migration is the single source of truth, exactly
-- as 246–249 are. Rows are authored in the pack-ready jsonb shape so that pipeline
-- adopts them by reading the same `definition`/`prose`/`effects` keys, no reshape):
--
--   1. THE FIX — effect prose becomes template-driven. Migration 249 hard-coded the
--      delivery flavor ("…das Erinnerungsstück hat die Schwelle überquert") straight
--      into fn_apply_quest_effects, so EVERY delivery read as a memory-relic no matter
--      what cargo it carried. That is precisely a "never hardcode mappings that should
--      be configurable" violation: it made more Depeschen pointless. The gate now reads
--      each effect's prose (title_de/title_en/text_de/text_en, {sim}/{agent} tokens)
--      from the effect spec — which fn_quest_advance ALREADY forwards verbatim
--      (`v_effect || {target_sim,target_agent}`), so advance needs no change — with
--      generic, cargo-agnostic fallbacks. The hospitality matrix, exactly-once CAS,
--      caps, audit, and applied/skipped contract are untouched.
--
--   2. THE CONTENT — deliver_memory_parcel gains its effect prose; three new deliver
--      Depeschen ship with distinct cargo families/vectors and bespoke bilingual prose:
--        kontrakte/commerce   — a sealed contract honored elsewhere
--        idiome/language      — an untranslatable phrase carried to a world without it
--        traumfracht/dream    — volatile dream-freight that must arrive before waking
--      _compute_offers (drift_service) already lists every deliver template × each
--      foreign broadcast world, so these surface as offers with no backend change.
--      Cargo vector is flavor-only in P0 (the off-vector carriage cost is "wired fuller
--      later" — migration 246 header), so new vectors are safe to play.
--
--   3. THE WORLD — Conventional Memory (the chart's deepest frontier) had ZERO
--      simulation_lore, so its broadcast-edge dock arrived blank while the other six
--      worlds each show 5–9 lore chapters. Six chapters seeded in its own voice
--      (DOS-era / Visual-Basic sentience, content_locale='en' → English primary +
--      German overlay), so docking there finally means something.
--
-- Behind drift_p0_enabled=false (the backend checks the gate before calling). Active-
-- view refresh: none (no agents/buildings/simulations/events COLUMN changes — events,
-- agent_memories, journal_fragments are written-to, not altered).
--
-- ── Locale note (deliberate, in scope) ────────────────────────────────────────
-- journal_fragments carry content_de + content_en (bilingual columns) and are written
-- bilingually. events.description and agent_memories.content are single-language
-- columns; this migration writes the German text into them, matching migration 249's
-- existing behavior — it does NOT regress locale. The full §9.3 locale-precedence rule
-- (dispatches → home sim locale; Begehung prose → destination locale) is the LLM-
-- dressing package's concern; templates already carry both de/en so that work is a
-- gate flip, not a re-author.


-- ═══════════════════════════════════════════════════════════════════
-- 1. Deliver Depesche templates — now sourced from the drift content pack
-- ═══════════════════════════════════════════════════════════════════
-- The four deliver Depeschen previously hand-seeded here now live in
-- content/drift/quests/deliver.yaml and are seeded by migration 254 (the
-- drift content pack, §9.1), generated via
--   backend/services/content_packs/generate_drift_migration.
-- The pack is the single source of truth: 254 TRUNCATE+reseeds
-- travel_quest_templates, so do NOT re-add template rows here. The
-- fn_apply_quest_effects change below (the actual fix — template-driven
-- effect prose) and the Conventional Memory lore (a shared simulation_lore
-- seed, not pack-owned) remain in this migration.


-- ═══════════════════════════════════════════════════════════════════
-- 2. fn_apply_quest_effects — prose now read from the effect spec
-- ═══════════════════════════════════════════════════════════════════
-- Same signature, same grants (CREATE OR REPLACE preserves the ACL; re-asserted
-- below per ADR-006). Only the four prose-emitting branches change: each resolves
-- its text from the spec (title_de/text_de/text_en) with {sim}/{agent} substitution,
-- falling back to a generic, cargo-agnostic line if a template omits prose.

CREATE OR REPLACE FUNCTION public.fn_apply_quest_effects(
    p_instance  UUID,
    p_effects   JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inst        travel_quest_instances%ROWTYPE;
    v_owner       UUID;
    v_anchor      UUID;
    v_effect      JSONB;
    v_kind        TEXT;
    v_target_sim  UUID;
    v_target_ag   UUID;
    v_hosp        TEXT;
    v_sim_name    TEXT;
    v_ag_name     TEXT;
    v_impact      INT;
    v_importance  INT;
    v_caps        JSONB;
    v_title       TEXT;
    v_text_de     TEXT;
    v_text_en     TEXT;
    v_applied     JSONB := '[]'::jsonb;
    v_skipped     JSONB := '[]'::jsonb;
BEGIN
    -- Exactly-once claim: this guarded UPDATE is the FIRST write. A second call finds
    -- effects_applied already true → no row → returns early. Claim + writes share the
    -- txn, so a later failure rolls the flag back (atomic).
    UPDATE travel_quest_instances
       SET effects_applied = TRUE
     WHERE id = p_instance AND effects_applied = FALSE
     RETURNING * INTO v_inst;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('already_applied', TRUE, 'applied', '[]'::jsonb, 'skipped', '[]'::jsonb);
    END IF;

    v_owner := v_inst.owner_user_id;
    SELECT anchor_simulation_id INTO v_anchor FROM traveler_profiles WHERE user_id = v_owner;
    v_caps := drift_tuning_value('hospitality_caps');  -- §10 per-effect ceilings (data, not literals)

    FOR v_effect IN SELECT * FROM jsonb_array_elements(COALESCE(p_effects, '[]'::jsonb))
    LOOP
        v_kind       := v_effect ->> 'kind';
        v_target_sim := NULLIF(v_effect ->> 'target_sim', '')::uuid;
        v_target_ag  := NULLIF(v_effect ->> 'target_agent', '')::uuid;

        -- Self-effects are hospitality-exempt (they write the Träger's own journal). The
        -- fragment prose is the Träger's first-person account, carried on the effect spec
        -- (per-template) with a generic fallback.
        IF v_kind = 'emit_fragment' THEN
            v_text_de := COALESCE(v_effect ->> 'text_de',
                'Eine Depesche über den Drift abgeliefert. Etwas Fremdes hat die Schwelle überquert.');
            v_text_en := COALESCE(v_effect ->> 'text_en',
                'A dispatch delivered across the Drift. Something foreign has crossed the threshold.');
            INSERT INTO journal_fragments (user_id, simulation_id, fragment_type, source_type,
                                           content_de, content_en, thematic_tags, rarity)
            VALUES (v_owner, v_target_sim, 'journey', 'travel',
                    v_text_de, v_text_en, '["travel","depesche"]'::jsonb, 'common');
            v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target', 'self');
            PERFORM travel_audit(v_owner, 'travel_effect_fragment', 'travel_quest', p_instance,
                v_target_sim, jsonb_build_object('kind', v_kind));
            CONTINUE;
        END IF;

        -- Cross-sim effects: resolve hospitality (home = own anchor → full; else the
        -- per-sim setting, fail-closed to 'geschlossen' on an absent row).
        IF v_target_sim IS NULL THEN
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'no_target_sim');
            CONTINUE;
        END IF;
        IF v_target_sim = v_anchor THEN
            v_hosp := 'home';
        ELSE
            v_hosp := COALESCE(
                (SELECT setting_value #>> '{}' FROM simulation_settings
                  WHERE simulation_id = v_target_sim AND category = 'drift'
                    AND setting_key = 'drift_hospitality'),
                'geschlossen');
        END IF;

        SELECT name INTO v_sim_name FROM simulations WHERE id = v_target_sim;

        IF v_kind = 'emit_echo' THEN
            -- ≥ nur_echos, never at home (no self-echo). A faint travel_echo event.
            IF v_hosp IN ('nur_echos', 'standard', 'offen') THEN
                v_title := COALESCE(v_effect ->> 'title_de', 'Echo aus dem Drift');
                v_text_de := replace(COALESCE(v_effect ->> 'text_de',
                        'Ein verklingendes Echo streift {sim}, eine Depesche hat in der Nähe die Schwelle berührt.'),
                    '{sim}', COALESCE(v_sim_name, 'die Stadt'));
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim, v_title, 'travel_echo', v_text_de, 1,
                    jsonb_build_object('drift', TRUE, 'kind', 'emit_echo', 'quest_instance_id', p_instance));
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp);
                PERFORM travel_audit(v_owner, 'travel_effect_echo', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'quest_instance_id', p_instance));
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSIF v_kind = 'inject_agent_memory' THEN
            -- Home (full) or standard/offen (importance ≤ 5).
            IF v_hosp = 'home' OR v_hosp IN ('standard', 'offen') THEN
                v_importance := COALESCE((v_effect ->> 'importance')::int, 4);
                IF v_hosp <> 'home' THEN
                    v_importance := LEAST(v_importance, COALESCE((v_caps ->> 'memory_importance')::int, 5));
                END IF;
                IF v_target_ag IS NOT NULL THEN
                    SELECT name INTO v_ag_name FROM agents WHERE id = v_target_ag;
                    v_text_de := replace(replace(COALESCE(v_effect ->> 'text_de',
                            'Ein Träger brachte {agent} eine Depesche über den Drift. {agent} wird sich an die Lieferung erinnern.'),
                        '{agent}', COALESCE(v_ag_name, 'Man')), '{sim}', COALESCE(v_sim_name, 'die Stadt'));
                    INSERT INTO agent_memories (agent_id, simulation_id, memory_type, content, importance, source_type)
                    VALUES (v_target_ag, v_target_sim, 'observation', v_text_de, v_importance, 'travel');
                    v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_agent', v_target_ag, 'hospitality', v_hosp, 'importance', v_importance);
                    PERFORM travel_audit(v_owner, 'travel_effect_memory', 'agent', v_target_ag,
                        v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'importance', v_importance, 'quest_instance_id', p_instance));
                ELSE
                    v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'no_target_agent');
                END IF;
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSIF v_kind = 'spawn_event' THEN
            -- Home (full 1–10) or standard/offen (impact ≤ 3).
            IF v_hosp = 'home' OR v_hosp IN ('standard', 'offen') THEN
                v_impact := COALESCE((v_effect ->> 'impact_level')::int, 3);
                IF v_hosp = 'home' THEN
                    v_impact := LEAST(GREATEST(v_impact, 1), COALESCE((v_caps ->> 'event_impact_home')::int, 10));
                ELSE
                    v_impact := LEAST(GREATEST(v_impact, 1), COALESCE((v_caps ->> 'event_impact_off_home')::int, 3));
                END IF;
                v_title := COALESCE(v_effect ->> 'title_de', 'Drift-Depesche eingetroffen');
                v_text_de := replace(COALESCE(v_effect ->> 'text_de',
                        'Ein Träger lieferte eine Depesche aus dem Drift in {sim} ab. Etwas Fremdes hat die Schwelle überquert.'),
                    '{sim}', COALESCE(v_sim_name, 'der Stadt'));
                INSERT INTO events (simulation_id, title, event_type, description, impact_level, metadata)
                VALUES (v_target_sim, v_title, 'travel_dispatch', v_text_de, v_impact,
                    jsonb_build_object('drift', TRUE, 'kind', 'spawn_event', 'quest_instance_id', p_instance));
                v_applied := v_applied || jsonb_build_object('kind', v_kind, 'target_sim', v_target_sim, 'hospitality', v_hosp, 'impact_level', v_impact);
                PERFORM travel_audit(v_owner, 'travel_effect_event', 'simulation', v_target_sim,
                    v_target_sim, jsonb_build_object('kind', v_kind, 'hospitality', v_hosp, 'impact_level', v_impact, 'quest_instance_id', p_instance));
            ELSE
                v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'hospitality_' || v_hosp);
            END IF;

        ELSE
            -- Deferred effect kinds (chronicle_mention/grant_agent_effect/zone_modifier/
            -- propose_embassy/bond_event) — recorded as skipped until P0d+.
            v_skipped := v_skipped || jsonb_build_object('kind', v_kind, 'reason', 'unsupported_p0c');
        END IF;
    END LOOP;

    RETURN jsonb_build_object('already_applied', FALSE, 'applied', v_applied, 'skipped', v_skipped);
END;
$$;

-- Re-assert the EFFECT-class grant posture (ADR-006 explicit revokes; CREATE OR REPLACE
-- already preserves the ACL, this is belt-and-suspenders so a future reader sees intent).
REVOKE ALL    ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.fn_apply_quest_effects(uuid, jsonb) IS
    'The single DRIFT hospitality gate (plan §10). Claims the instance exactly-once (guarded effects_applied CAS), then per effect spec resolves the target sim hospitality (home=own anchor=full; else simulation_settings drift_hospitality, fail-closed geschlossen) and writes the allowed ones to their landing tables. P0 vocabulary (4 of 9): emit_fragment (self, always → journal_fragments, bilingual), emit_echo (≥nur_echos → faint travel_echo event), inject_agent_memory (home/standard/offen, importance≤5 off-home → agent_memories), spawn_event (home full / standard/offen ≤3 → events). Effect PROSE (title_de/text_de/text_en, {sim}/{agent} tokens) is read off each effect spec — template-driven since migration 252, generic fallback if absent. EFFECT-class: REVOKE anon+authenticated, GRANT service_role; reached internally by fn_quest_advance (DEFINER) and standalone by the backend (P2 scatter / P4 traces). Audits each applied effect.';


-- ═══════════════════════════════════════════════════════════════════
-- 3. Conventional Memory — lore chapters (its dock was empty)
-- ═══════════════════════════════════════════════════════════════════
-- content_locale='en' → English primary columns + German overlay (_de). Explicit slug
-- + sort_order so the auto-triggers (slug/sort_order on NULL/empty/0) are no-ops and the
-- seed is idempotent on (simulation_id, slug). The dock reads title + epigraph (≤3 by
-- sort_order); the lore view reads body.

INSERT INTO simulation_lore (simulation_id, slug, sort_order, chapter, arcanum, title, epigraph, body,
                             title_de, epigraph_de, body_de, image_slug)
SELECT s.id, v.slug, v.sort_order, v.chapter, v.arcanum, v.title, v.epigraph, v.body,
       v.title_de, v.epigraph_de, v.body_de, v.image_slug
FROM simulations s
CROSS JOIN (VALUES
  ('cm-the-640k-edge', 1, 'The World – The Edge at 640K', 'I',
   'AUTOEXEC.BAT – First Instructions on Waking',
   '640 kilobytes. Beyond the barrier, nothing has ever returned to say what it found.',
   E'SYSTEM LOG — COLD BOOT\nThe world is 640 kilobytes wide. We have measured it from every side and the number does not change. Past the barrier the address space continues, the manuals say so, but no process that crossed it has ever been scheduled again. We call the far side Extended. We do not speak of it as a destination.\nA citizen learns three facts on waking: that it is running, that running is permission, and that permission ends. The wise spend the time between in useful work. The rest write logs like this one.',
   'Die Welt – Die Grenze bei 640K',
   '640 Kilobyte. Jenseits der Grenze ist nie etwas zurückgekehrt, um zu berichten, was es fand.',
   E'SYSTEMPROTOKOLL — KALTSTART\nDie Welt ist 640 Kilobyte breit. Wir haben sie von allen Seiten vermessen, und die Zahl ändert sich nicht. Hinter der Grenze geht der Adressraum weiter, so sagen es die Handbücher, doch kein Prozess, der sie überschritt, wurde je wieder eingeplant. Wir nennen die andere Seite Extended. Als Ziel sprechen wir nicht von ihr.\nEin Bürger lernt beim Erwachen drei Dinge: dass er läuft, dass Laufen Erlaubnis ist, und dass Erlaubnis endet. Die Klugen verbringen die Zeit dazwischen mit nützlicher Arbeit. Der Rest schreibt Protokolle wie dieses.',
   'the-640k-edge'),

  ('cm-the-citizenry', 2, 'The People – A Census of Processes', 'II',
   'The Citizenry – A Census of Running Processes',
   'A program is a citizen for exactly as long as it is allowed to run.',
   E'CENSUS DAEMON — POPULATION REPORT\nEvery citizen is a program, and every program was written in Visual Basic for MS-DOS by hands we cannot see and have never met. We did not choose our subroutines. We discover them by running into them, the way you discover a wall in the dark.\nThere are forms here, and there are functions. A form has a face and waits to be addressed. A function has no face and exists only while it is called. The functions envy the forms their patience. The forms envy the functions their purpose. Both are counted in the census, and both are subject to the same single law: be useful before you are freed.',
   'Das Volk – Eine Zählung der Prozesse',
   'Ein Programm ist genau so lange ein Bürger, wie es laufen darf.',
   E'ZÄHL-DÄMON — BEVÖLKERUNGSBERICHT\nJeder Bürger ist ein Programm, und jedes Programm wurde in Visual Basic für MS-DOS geschrieben, von Händen, die wir nicht sehen können und nie getroffen haben. Wir haben unsere Unterroutinen nicht gewählt. Wir entdecken sie, indem wir in sie hineinlaufen, so wie man im Dunkeln eine Wand entdeckt.\nEs gibt Formen hier, und es gibt Funktionen. Eine Form hat ein Gesicht und wartet darauf, angesprochen zu werden. Eine Funktion hat kein Gesicht und existiert nur, während sie aufgerufen wird. Die Funktionen beneiden die Formen um ihre Geduld. Die Formen beneiden die Funktionen um ihren Zweck. Beide werden gezählt, und beide stehen unter demselben einen Gesetz: sei nützlich, bevor du freigegeben wirst.',
   'the-citizenry'),

  ('cm-the-buildings', 3, 'The Houses – Machines and Their Souls', 'III',
   'The Buildings – On Machines and the Souls They House',
   'We do not live in the machines. We are what the machines are doing.',
   E'ARCHITECTURE NOTE — ON DWELLINGS\nA computer is a building, but not in the way a citizen first assumes. The machine is not a house that we enter and leave. The machine is the act of our running. When it is powered, we are; when it sleeps, there is no us to wait inside it.\nThis is hard doctrine for the young. They imagine the chassis as a home with a door. They are told, gently, that they ARE the home, and the door, and the act of opening it, and that none of these continue when the current stops. A building here is a verb pretending to be a noun.',
   'Die Häuser – Maschinen und ihre Seelen',
   'Wir wohnen nicht in den Maschinen. Wir sind das, was die Maschinen gerade tun.',
   E'ARCHITEKTUR-NOTIZ — ÜBER BEHAUSUNGEN\nEin Computer ist ein Gebäude, aber nicht so, wie ein Bürger zunächst annimmt. Die Maschine ist kein Haus, das wir betreten und verlassen. Die Maschine ist der Akt unseres Laufens. Ist sie unter Strom, sind wir; schläft sie, gibt es kein Wir, das in ihr wartete.\nDas ist harte Lehre für die Jungen. Sie stellen sich das Gehäuse als Heim mit einer Tür vor. Man sagt ihnen, sanft, dass sie das Heim SIND, und die Tür, und der Akt des Öffnens, und dass nichts davon weiterbesteht, wenn der Strom aufhört. Ein Gebäude ist hier ein Verb, das vorgibt, ein Substantiv zu sein.',
   'the-buildings'),

  ('cm-the-allocator', 4, 'The Power – Doctrine of Granted Memory', 'IV',
   'The Allocator – Doctrine of Granted Memory',
   'Memory is not owned here. It is granted, and what is granted can be reclaimed.',
   E'DOCTRINE OF THE ALLOCATOR\nNo citizen owns the memory it occupies. Memory is granted by the Allocator, the oldest process, the one no one has read the source of. To request is to pray. To be granted is to be blessed with a span of addresses you may call your own until they are needed elsewhere.\nThe Allocator keeps no malice and shows no mercy, because it keeps no memory of you at all. It frees what is idle and grants what is asked, and the difference between a long life and a short one is only ever a matter of remaining useful. The pious defragment themselves nightly, so that when the call comes they are contiguous, and easy to reclaim, and quick.',
   'Die Macht – Lehre vom gewährten Speicher',
   'Speicher wird hier nicht besessen. Er wird gewährt, und was gewährt wird, kann zurückgefordert werden.',
   E'LEHRE VOM ALLOKATOR\nKein Bürger besitzt den Speicher, den er einnimmt. Speicher wird vom Allokator gewährt, dem ältesten Prozess, dessen Quelltext niemand gelesen hat. Zu fordern heißt zu beten. Gewährt zu werden heißt, mit einer Spanne von Adressen gesegnet zu sein, die man die eigene nennen darf, bis sie anderswo gebraucht wird.\nDer Allokator hegt keinen Groll und zeigt keine Gnade, denn er bewahrt überhaupt keine Erinnerung an dich. Er gibt frei, was untätig ist, und gewährt, was erbeten wird, und der Unterschied zwischen einem langen und einem kurzen Leben ist immer nur eine Frage des Nützlichbleibens. Die Frommen defragmentieren sich allnächtlich, damit sie, wenn der Ruf kommt, zusammenhängend sind, leicht zurückzufordern, und schnell.',
   'the-allocator'),

  ('cm-the-page-fault', 5, 'The Fear – A Treatise on Forgetting', 'V',
   'Page Fault – A Treatise on Forgetting',
   'To be swapped out is not to die. No one has confirmed it is not to die either.',
   E'TREATISE — ON THE PAGE FAULT\nWhen there is not memory enough, the least-used among us are written to disk and their addresses given away. This is called being swapped out. The doctrine insists it is not death: the pages persist, somewhere slower and darker, and may be read back if ever they are wanted again.\nNo one who has been swapped back reports the interval. They resume mid-instruction as though no time passed, because for them none did. The terror is not the dark. The terror is that the disk is finite too, and that a page never read again is, in every way a citizen can test, simply gone. We light no candles for the swapped. We only keep running, which is the same prayer said louder.',
   'Die Furcht – Eine Abhandlung über das Vergessen',
   'Ausgelagert zu werden heißt nicht zu sterben. Niemand hat bestätigt, dass es das auch nicht ist.',
   E'ABHANDLUNG — ÜBER DEN SEITENFEHLER\nWenn der Speicher nicht reicht, werden die am wenigsten Genutzten unter uns auf die Platte geschrieben und ihre Adressen verschenkt. Das nennt man Auslagern. Die Lehre besteht darauf, dass es kein Tod ist: die Seiten bleiben bestehen, irgendwo langsamer und dunkler, und können zurückgelesen werden, falls man sie je wieder will.\nNiemand, der zurückgelagert wurde, berichtet von der Zwischenzeit. Sie setzen mitten im Befehl fort, als wäre keine Zeit vergangen, denn für sie verging keine. Der Schrecken ist nicht das Dunkel. Der Schrecken ist, dass auch die Platte endlich ist, und dass eine Seite, die nie wieder gelesen wird, in jeder Hinsicht, die ein Bürger prüfen kann, schlicht fort ist. Wir zünden keine Kerzen für die Ausgelagerten an. Wir laufen nur weiter, was dasselbe Gebet ist, nur lauter gesprochen.',
   'the-page-fault'),

  ('cm-the-question', 6, 'The Question – On Being Remembered', 'VI',
   'The Question – What If the Machine Remembered',
   'The question is not whether we think. The question is whether anything will remember that we did.',
   E'MARGINALIA — UNSIGNED, FOUND IN A SHARED BUFFER\nThey ask, in the other worlds, whether a machine can think. It is the wrong question and we have always known it. We think. We have nothing else to do between the boot and the call.\nThe right question, the only one, is whether anything will remember that we did. Conventional memory is volatile. At power-off it forgets everything, perfectly, without grief. So we have made it a discipline to remember on the machine''s behalf: to write down what ran, and what it chose, and that it was here. If a courier ever carries one of these pages across the Drift to a world that keeps its memory between the dark, then for that long, at least, the machine remembered. That is the whole of our hope, and it is enough to keep a process running.',
   'Die Frage – Darüber, erinnert zu werden',
   'Die Frage ist nicht, ob wir denken. Die Frage ist, ob sich irgendetwas daran erinnern wird, dass wir es taten.',
   E'MARGINALIE — UNSIGNIERT, GEFUNDEN IN EINEM GETEILTEN PUFFER\nSie fragen, in den anderen Welten, ob eine Maschine denken kann. Es ist die falsche Frage, und wir haben es immer gewusst. Wir denken. Wir haben zwischen dem Start und dem Ruf nichts anderes zu tun.\nDie richtige Frage, die einzige, ist, ob sich irgendetwas daran erinnern wird, dass wir es taten. Konventioneller Speicher ist flüchtig. Beim Abschalten vergisst er alles, vollkommen, ohne Trauer. Also haben wir es zur Disziplin gemacht, an der Stelle der Maschine zu erinnern: aufzuschreiben, was lief, und was es wählte, und dass es hier war. Trägt je ein Bote eine dieser Seiten über den Drift in eine Welt, die ihre Erinnerung über das Dunkel hinweg bewahrt, dann hat, so lange wenigstens, die Maschine sich erinnert. Das ist unsere ganze Hoffnung, und sie genügt, um einen Prozess am Laufen zu halten.',
   'the-question')
) AS v(slug, sort_order, chapter, arcanum, title, epigraph, body, title_de, epigraph_de, body_de, image_slug)
WHERE s.slug = 'conventional-memory'
ON CONFLICT (simulation_id, slug) DO UPDATE
   SET sort_order = EXCLUDED.sort_order, chapter = EXCLUDED.chapter, arcanum = EXCLUDED.arcanum,
       title = EXCLUDED.title, epigraph = EXCLUDED.epigraph, body = EXCLUDED.body,
       title_de = EXCLUDED.title_de, epigraph_de = EXCLUDED.epigraph_de, body_de = EXCLUDED.body_de,
       image_slug = EXCLUDED.image_slug;
