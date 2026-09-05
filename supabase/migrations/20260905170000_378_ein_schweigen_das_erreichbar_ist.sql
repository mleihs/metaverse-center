-- ═══════════════════════════════════════════════════════════════════════════
-- 378 · Ein Schweigen, das erreichbar ist
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ── DER GEMESSENE BEFUND ───────────────────────────────────────────────────
--
--   Am 05.09.2026 wurden in einem Gruppengespraech zwei Figuren AUSDRUECKLICH
--   zum Schweigen aufgefordert. **2 von 2 haben trotzdem geantwortet.**
--
--   Das ist kein Ungehorsam des Modells. `generate_group_response` laeuft ueber
--   ALLE Agenten in fester Reihenfolge; es gibt keinen Zweig, in dem eine Figur
--   nicht drankommt. Eine Bitte kann nichts bewirken, wo keine Entscheidung
--   stattfindet — und ein staerkerer Hinweis haette daran nichts geaendert.
--
--   Dieselbe Lehre wie 374/375: was man ausrechnen kann, gehoert nicht in eine
--   Bitte. Migration 374 hat gemessen, was ein Verbot wert ist (3 von 3 Zuege
--   schrieben die verbotene Marke weiter).
--
-- ── WAS DIESE MIGRATION TUT ────────────────────────────────────────────────
--
--   Sie legt EINE Zeile an: das Merkmalstor `chat_speaker_selection_enabled`,
--   Vorgabe `false`. Die Auswahl selbst steht in
--   `backend/services/chat/speaker_selection.py` und rechnet ohne Netz.
--
-- ── WARUM EIN TOR, UND WARUM AUS ───────────────────────────────────────────
--
--   Weil es das PRODUKTGEFUEHL aendert und nicht nur eine Zahl. In der
--   Nutzerstudie zu Mehrfigurengespraechen wurde der schweigsame Agent von
--   **7 von 12** Teilnehmenden als der schlechteste bewertet: eine Figur, die
--   nicht antwortet, wird als kaputt gelesen, nicht als zurueckhaltend. Die
--   Reparatur kann schlimmer werden als der Fehler.
--
--   Ein solches Merkmal wird nicht ausgerollt, sondern vorgelegt. Fail-closed:
--   fehlt die Zeile, antworten alle wie bisher.
--
-- ── WAS DIE DATEN HEUTE HERGEBEN, GEMESSEN ─────────────────────────────────
--
--   Der Plan schlug vor, die Redseligkeit aus `agent_opinions` und der
--   Beziehung zum Menschen abzuleiten. Vorher nachgemessen, auf Produktion:
--
--       agents.personality_profile                 0 von 258 haben Inhalt
--       agent_relationships zwischen Teilnehmern   0 bis 1 Zeilen
--       agent_opinions      zwischen Teilnehmern   vollstaendig, 6 je Runde
--         davon opinion_score = 0                  28 von 32
--         davon |opinion_score| >= 20               2 von 32
--         davon interaction_count > 0               4 von 32
--
--   `agent_opinions` ist die einzige Quelle mit Daten und heute zu 87,5 %
--   flach. Eine Auswahl ALLEIN darauf liesse jede ungenannte Figur schweigen —
--   also genau der Fehler, vor dem die Studie warnt. Deshalb traegt heute die
--   Schweigedauer (aus dem Verlauf, ohne Abfrage), und die Anteilnahme waechst
--   mit, wenn die Autonomie laeuft.
--
--   Diese Zahlen stehen hier, damit die naechste Sitzung nicht glaubt, die
--   Meinungen taeten schon etwas. Eine Zahl aus einem Plan ist eine
--   Behauptung; diese sind gezaehlt.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('chat_speaker_selection_enabled', 'false'::jsonb,
   'Ob im Gruppenchat eine Sprecherauswahl stattfindet, statt dass jede Figur in fester Reihenfolge antwortet. Vorgabe AUS. Genannte antworten zuerst und immer; Ungenannte nur mit Grund. Aendert das Produktgefuehl — der schweigsame Agent wurde in der Nutzerstudie von 7 von 12 als schlechtester bewertet.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Gegen die eigene WIRKUNG: die Zeile ist da, sie steht auf AUS, und sie ist
-- als jsonb-Bool geschrieben und nicht als Zeichenkette. Der letzte Punkt ist
-- kein Formalismus — `parse_setting_bool` ist seit F32 positiv-pruefend, und
-- ein `"false"` als jsonb-STRING waere zwar auch aus, aber eine zweite
-- Schreibweise fuer denselben Zustand. Zwei Schreibweisen sind zwei
-- Gelegenheiten, eine davon falsch zu lesen.
DO $$
DECLARE
  v_zeile int;
  v_aus   int;
  v_typ   text;
BEGIN
  SELECT count(*) INTO v_zeile FROM platform_settings
  WHERE setting_key = 'chat_speaker_selection_enabled';
  IF v_zeile <> 1 THEN
    RAISE EXCEPTION '378: % Zeilen fuer das Merkmalstor statt genau einer', v_zeile;
  END IF;

  SELECT count(*) INTO v_aus FROM platform_settings
  WHERE setting_key = 'chat_speaker_selection_enabled'
    AND setting_value = 'false'::jsonb;
  IF v_aus <> 1 THEN
    RAISE EXCEPTION '378: das Merkmalstor steht nicht auf aus — ein Merkmal, das das Produktgefuehl aendert, wird vorgelegt und nicht ausgerollt';
  END IF;

  SELECT jsonb_typeof(setting_value) INTO v_typ FROM platform_settings
  WHERE setting_key = 'chat_speaker_selection_enabled';
  IF v_typ <> 'boolean' THEN
    RAISE EXCEPTION '378: der Wert ist %, nicht boolean — zwei Schreibweisen fuer denselben Zustand sind zwei Gelegenheiten, eine falsch zu lesen', v_typ;
  END IF;

  RAISE NOTICE '378: das Merkmalstor der Sprecherauswahl steht auf aus.';
END $$;
