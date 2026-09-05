-- ═══════════════════════════════════════════════════════════════════════════
-- 383 · Ein Widerspruch, der niemandem auffällt
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER BEFUND ─────────────────────────────────────────────────────────────
--
--   Migration 379 hat dem Gedächtnis Gültigkeit gegeben: `valid_until` und
--   `superseded_by`, dazu `fn_supersede_memory`. Der Abruf achtet sie, die
--   Oberfläche zeigt sie, `AgentMemoryService.supersede` schreibt sie.
--
--   Gemessen am 05.09.2026, nach dem Ausrollen:
--
--       Erinnerungen gesamt                   504
--       davon mit Gültigkeitsfenster            0
--       davon als überholt markiert             0
--
--   Der Weg war gebaut und ging ihn niemand. Es fehlte nicht das Datenmodell,
--   sondern der ERKENNER — die Stelle, die merkt, dass eine neue Beobachtung
--   eine alte aufhebt.
--
-- ── WARUM DAS BILLIG GEHT ──────────────────────────────────────────────────
--
--   Ein Modellaufruf je Beobachtung wäre teuer (496 Beobachtungen). Aber die
--   Einbettungen liegen längst da, und ein Widerspruch braucht Nähe: „X ist
--   Archivarin" und „X ist nicht mehr Archivarin" stehen im Vektorraum dicht
--   beieinander, „X ist Archivarin" und „es regnet" nicht.
--
--   Vorher gemessen, an 495 eingebetteten Beobachtungen auf Produktion, der
--   Abstand jeder Beobachtung zu ihrem nächsten ÄLTEREN Nachbarn derselben
--   Figur:
--
--       min 0,057 · p05 0,136 · p25 0,232 · Median 0,341 · max 0,829
--
--       Kandidaten unter Abstand   0,05     0 von 496
--                                  0,10     7
--                                  0,15    28     ← gewählt
--                                  0,20    66
--                                  0,25   120
--
--   Der Vektor wirft also 94 % weg, und das Modell entscheidet nur den Rest.
--   Die Schwelle steht im Dienst, nicht hier — sie ist eine Spielregel und
--   keine Struktur, und `MemorySupersedeService` erklärt sie dort.
--
-- ── WAS DIESE MIGRATION LIEFERT ────────────────────────────────────────────
--
--   1. `fn_supersede_candidates` — die Kandidatensuche. Sie gehört in SQL:
--      der Vektorabstand ist ein Operator, und ein Python-Durchlauf über
--      alle Paare wäre O(n²) über die Anwendungsgrenze (ADR-007).
--   2. Das Merkmalstor `memory_supersede_enabled`, Vorgabe AUS. Der Erkenner
--      SCHREIBT ins Gedächtnis; ein Fehlurteil nimmt einer Figur etwas weg,
--      das sie wusste.
--   3. Die Vorlage `memory_supersede` in beiden Sprachen.
--
--   Der Strich in den Vorlagen ist U+2013, nicht U+2014 — Migration 351 hat
--   den Geviertstrich entfernt und 382 musste ihn ein zweites Mal nachziehen,
--   weil drei spätere Migrationen ihn wieder eingeführt haben.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Die Kandidatensuche ─────────────────────────────────────────────────
--
-- SECURITY INVOKER: die Funktion darf nichts können, was die Aufruferin nicht
-- darf (ADR-006). Sie liest nur.
CREATE OR REPLACE FUNCTION public.fn_supersede_candidates(
  p_simulation_id UUID,
  p_max_distance  FLOAT DEFAULT 0.15,
  p_limit         INT   DEFAULT 10
)
RETURNS TABLE (
  kandidat_agent_id   UUID,
  neuere_id           UUID,
  neuere_inhalt       TEXT,
  neuere_erstellt     TIMESTAMPTZ,
  aeltere_id          UUID,
  aeltere_inhalt      TEXT,
  aeltere_erstellt    TIMESTAMPTZ,
  abstand             FLOAT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  -- Je NEUERE Erinnerung nur ihr nächster älterer Nachbar. Ohne das
  -- `DISTINCT ON` käme dieselbe neue Beobachtung mit fünf Kandidaten, und
  -- das Modell entschiede fünfmal über dieselbe Frage.
  SELECT * FROM (
    SELECT DISTINCT ON (neu.id)
      neu.agent_id,
      neu.id, neu.content, neu.created_at,
      alt.id, alt.content, alt.created_at,
      (neu.embedding <=> alt.embedding)::float
    FROM agent_memories neu
    JOIN agent_memories alt
      ON alt.agent_id = neu.agent_id
     AND alt.id <> neu.id
     -- Nur RÜCKWÄRTS: eine ältere Beobachtung kann eine neuere nicht
     -- aufheben. Ohne diese Zeile käme jedes Paar zweimal, einmal je
     -- Richtung, und die Hälfte davon wäre falsch herum.
     AND alt.created_at < neu.created_at
    WHERE neu.simulation_id = p_simulation_id
      AND alt.simulation_id = p_simulation_id
      AND neu.memory_type = 'observation'
      AND alt.memory_type = 'observation'
      AND neu.embedding IS NOT NULL
      AND alt.embedding IS NOT NULL
      -- Was schon überholt ist, wird nicht noch einmal beurteilt.
      AND neu.superseded_by IS NULL
      AND alt.superseded_by IS NULL
      AND alt.valid_until IS NULL
      AND (neu.embedding <=> alt.embedding) < p_max_distance
    ORDER BY neu.id, (neu.embedding <=> alt.embedding)
  ) paare(kandidat_agent_id, neuere_id, neuere_inhalt, neuere_erstellt,
          aeltere_id, aeltere_inhalt, aeltere_erstellt, abstand)
  -- Die ÄHNLICHSTEN zuerst: wo der Abstand am kleinsten ist, ist ein
  -- Widerspruch am wahrscheinlichsten, und das Budget ist knapp.
  ORDER BY paare.abstand
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.fn_supersede_candidates(UUID, FLOAT, INT) IS
  'Paare (neuere, aeltere) Beobachtungen derselben Figur, die sich im Vektorraum nahe sind – Kandidaten dafuer, dass die neuere die aeltere aufhebt. Der Vektor filtert, das Modell entscheidet. Gemessen 05.09.2026: bei Abstand < 0,15 bleiben 28 von 496 Beobachtungen uebrig. Siehe Migration 383.';

-- ── 2. Das Merkmalstor ─────────────────────────────────────────────────────
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('memory_supersede_enabled', 'false'::jsonb,
   'Ob der Widerspruchs-Erkenner laufen darf: eine neue Beobachtung hebt eine aeltere auf (Phase des Herzschlags). Vorgabe AUS. Er SCHREIBT ins Gedaechtnis, und ein Fehlurteil nimmt einer Figur etwas weg, das sie wusste. Siehe Migration 383.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── 2b. Der Modellzweck ────────────────────────────────────────────────────
--
-- Die ZEILE gewinnt zur Laufzeit, nicht die Deklaration in `ai_purposes.py`.
-- Ein Vorgabewert, der nur im Code stuende, wuerde auf keiner Datenbank
-- wirken, die die Zeile hat — und das sind alle.
-- `test_ai_purposes_migration.py` bindet beide aneinander.
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('max_tokens_memory_supersede', '200'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''memory_supersede''. Die Antwort ist ein Ja/Nein plus ein kurzer Grund als JSON; mehr Budget hiesse nur, dass ein schwatzhaftes Modell laenger schwatzt.'),
  ('timeout_memory_supersede', '60'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''memory_supersede''. Der Lauf haengt am Herzschlag, nicht an einer Anfrage.'),
  ('reasoning_memory_supersede', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''memory_supersede''. off | minimal | low | medium | high | xhigh | auto. Abgeschaltet: ein Denkblock im JSON macht es unparsbar, und die Fassade wertet unlesbar als NEIN.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── 3. Die Vorlage ─────────────────────────────────────────────────────────
-- `prompt_category` ist NOT NULL. `memory_extraction` und
-- `memory_reflection` stehen als `text_generation` – der Erkenner gehoert in
-- dieselbe Familie, nicht zu `chat`: er beantwortet eine Frage ueber das
-- Gedaechtnis, er fuehrt kein Gespraech.
INSERT INTO prompt_templates
  (simulation_id, prompt_category, template_type, template_name, locale, prompt_content, variables, temperature, max_tokens)
VALUES
  (NULL, 'text_generation', 'memory_supersede', 'Widerspruchs-Erkenner im Gedaechtnis', 'de',
   'Du pruefst das Gedaechtnis der Figur {agent_name}.

Zwei Beobachtungen derselben Figur, die aeltere zuerst:

ALT: {older_statement}
NEU: {newer_statement}

Frage: Hebt die neuere Beobachtung die aeltere AUF? Das ist nur dann der
Fall, wenn beide dieselbe Sache behaupten und die neuere die aeltere
UNGUELTIG macht – ein Zustand hat sich geaendert, eine Rolle wurde
abgegeben, eine Annahme hat sich als falsch erwiesen.

Es ist NICHT der Fall, wenn die neuere die aeltere nur ergaenzt, wiederholt,
bestaetigt oder ein anderes Thema betrifft. Zwei Beobachtungen ueber
dieselbe Person sind nicht schon deshalb ein Widerspruch.

Im Zweifel: nein. Eine faelschlich aufgehobene Erinnerung nimmt der Figur
etwas weg, das sie wusste; eine faelschlich behaltene kostet nur Platz.

Antworte NUR mit JSON:
{"supersedes": true oder false, "reason": "ein kurzer Satz"}',
   '["agent_name", "older_statement", "newer_statement"]'::jsonb, 0.0, 200),
  (NULL, 'text_generation', 'memory_supersede', 'Memory supersession judge', 'en',
   'You are checking the memory of the character {agent_name}.

Two observations by the same character, older first:

OLD: {older_statement}
NEW: {newer_statement}

Question: does the newer observation SUPERSEDE the older one? That is only
the case if both assert the same thing and the newer makes the older
INVALID – a state changed, a role was given up, an assumption turned out
to be wrong.

It is NOT the case if the newer merely adds to, repeats, confirms, or
concerns something other than the older. Two observations about the same
person are not a contradiction just because of that.

When in doubt: no. A wrongly retired memory takes something away that the
character knew; a wrongly kept one only costs space.

Answer with JSON ONLY:
{"supersedes": true or false, "reason": "one short sentence"}',
   '["agent_name", "older_statement", "newer_statement"]'::jsonb, 0.0, 200)
ON CONFLICT DO NOTHING;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Mit einer Wirkprobe, die ihre Bedingung HERSTELLT: zwei nahe beieinander
-- liegende Beobachtungen anlegen, messen dass sie als Paar gefunden werden,
-- eine weit entfernte anlegen, messen dass sie es NICHT wird, aufraeumen.
DO $$
DECLARE
  v_fn       int;
  v_secdef   boolean;
  v_tor      int;
  v_vorlagen int;
  v_strich   int;
  v_agent    uuid;
  v_sim      uuid;
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;
  v_nah      int;
  v_fern     int;
BEGIN
  SELECT count(*) INTO v_fn FROM pg_proc WHERE proname = 'fn_supersede_candidates';
  IF v_fn <> 1 THEN
    RAISE EXCEPTION '383: fn_supersede_candidates gibt es % mal statt einmal', v_fn;
  END IF;

  SELECT prosecdef INTO v_secdef FROM pg_proc WHERE proname = 'fn_supersede_candidates';
  IF v_secdef THEN
    RAISE EXCEPTION '383: fn_supersede_candidates ist SECURITY DEFINER';
  END IF;

  SELECT count(*) INTO v_tor FROM platform_settings
  WHERE setting_key = 'memory_supersede_enabled' AND setting_value = 'false'::jsonb;
  IF v_tor <> 1 THEN
    RAISE EXCEPTION '383: das Merkmalstor fehlt oder steht nicht auf aus';
  END IF;

  DECLARE v_zweck int;
  BEGIN
    SELECT count(*) INTO v_zweck FROM platform_settings
    WHERE setting_key IN ('max_tokens_memory_supersede', 'timeout_memory_supersede', 'reasoning_memory_supersede')
      AND setting_value IS NOT NULL;
    IF v_zweck <> 3 THEN
      RAISE EXCEPTION '383: % von 3 Zeilen des Modellzwecks fehlen', 3 - v_zweck;
    END IF;
  END;

  SELECT count(*) INTO v_vorlagen FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'memory_supersede';
  IF v_vorlagen <> 2 THEN
    RAISE EXCEPTION '383: % Vorlagen statt 2 (de + en)', v_vorlagen;
  END IF;

  -- Migration 351 hat den Geviertstrich entfernt; 382 musste ihn ein zweites
  -- Mal nachziehen, weil drei spaetere Migrationen ihn wieder einfuehrten.
  -- Diese hier soll nicht die vierte sein.
  SELECT count(*) INTO v_strich FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'memory_supersede'
    AND prompt_content LIKE '%' || chr(8212) || '%';
  IF v_strich > 0 THEN
    RAISE EXCEPTION '383: % Vorlage(n) fuehren den Geviertstrich und heben damit 351 wieder auf', v_strich;
  END IF;

  -- ── Wirkprobe ────────────────────────────────────────────────────────────
  SELECT a.id, a.simulation_id INTO v_agent, v_sim FROM agents a LIMIT 1;
  IF v_agent IS NULL THEN
    RAISE NOTICE '383: keine Figur vorhanden, Wirkprobe UEBERSPRUNGEN (Struktur ist geprueft).';
  ELSE
    -- Zwei fast gleiche Vektoren und einer, der weit weg ist.
    --
    -- ⚠ `created_at` wird AUSDRUECKLICH gesetzt. Die Vorgabe ist `now()`,
    -- und `now()` ist innerhalb EINER Transaktion konstant: alle drei Zeilen
    -- bekaemen denselben Zeitstempel, `alt.created_at < neu.created_at`
    -- waere nie wahr, und die Probe faende nichts. Genau daran ist ihre
    -- erste Fassung gescheitert - laut, wie es sich gehoert.
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance, embedding, created_at)
    VALUES (v_agent, v_sim, '383 Probe alt', 5,
            (SELECT array_fill(0.01::real, ARRAY[1536])::extensions.vector),
            now() - interval '2 hours')
    RETURNING id INTO v_a;
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance, embedding, created_at)
    VALUES (v_agent, v_sim, '383 Probe neu', 5,
            (SELECT array_fill(0.010001::real, ARRAY[1536])::extensions.vector),
            now() - interval '1 hour')
    RETURNING id INTO v_b;
    INSERT INTO agent_memories (agent_id, simulation_id, content, importance, embedding, created_at)
    VALUES (v_agent, v_sim, '383 Probe fern', 5,
            (SELECT (array_fill(0.01::real, ARRAY[768]) || array_fill(-0.01::real, ARRAY[768]))::extensions.vector),
            now())
    RETURNING id INTO v_c;

    SELECT count(*) INTO v_nah FROM fn_supersede_candidates(v_sim, 0.15, 500) k
    WHERE k.neuere_id = v_b AND k.aeltere_id = v_a;
    IF v_nah <> 1 THEN
      RAISE EXCEPTION '383: das nahe Paar wurde nicht gefunden (% Treffer) - die Bedingung stand nie', v_nah;
    END IF;

    SELECT count(*) INTO v_fern FROM fn_supersede_candidates(v_sim, 0.15, 500) k
    WHERE k.neuere_id = v_c;
    IF v_fern <> 0 THEN
      RAISE EXCEPTION '383: das ferne Paar wurde faelschlich gefunden (% Treffer) - die Schwelle trennt nicht', v_fern;
    END IF;

    DELETE FROM agent_memories WHERE id IN (v_a, v_b, v_c);
    RAISE NOTICE '383: Wirkprobe bestanden - nahes Paar gefunden, fernes nicht.';
  END IF;

  RAISE NOTICE '383: Kandidatensuche (INVOKER), Merkmalstor auf aus, 2 Vorlagen ohne Geviertstrich.';
END $$;
