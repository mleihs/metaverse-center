-- ============================================================================
-- Migration 310 — Die JSON-Reparatur bekommt einen Riegel
-- ============================================================================
--
-- BEFUND
-- ------
-- `GenerationService._parse_or_repair_json` hatte am 31.08.2026 **null
-- Aufrufer**. Alle elf JSON-Auswertungen des Dienstes riefen
-- `_parse_json_content` unmittelbar und gaben bei `None` auf — und zwar STILL:
-- keine der elf Stellen protokollierte etwas.
--
-- Was dabei geschah, wenn ein Modell eine unbrauchbare Antwort lieferte:
--
--     generate_social_media_sentiment   → Stimmung „neutral", Zuversicht 0,0,
--                                          Zusammenfassung „No summary returned."
--     extract_memory_observations       → null Beobachtungen
--     reflect_on_memories               → null Reflexionen
--     generate_chronicle_entry          → erfundener Titel, ROHTEXT als Inhalt
--     generate_resonance_event          → erfundener Titel aus Archetyp + Typ
--     generate_agent_full/partial       → Agent behält stillschweigend das Alte
--
-- Das Modell war jedes Mal bezahlt, die Antwort verworfen, und niemand erfuhr
-- davon.
--
-- 🔑 **Deshalb liess sich die Frage, ob sich eine LLM-Reparatur lohnt, gar
-- nicht beantworten: es gab keine Zahl.** Die Entscheidung hing an einer
-- Häufigkeit, die niemand erhob.
--
-- WAS DER CODE JETZT TUT (gleicher Commit)
-- ----------------------------------------
-- Die elf Stellen laufen über `_parse_json_object` bzw. `_parse_json_payload`;
-- ein Misserfolg geht als Sentry-Nachricht mit Etikett `json_parse_source`
-- hinaus. Das kostet nichts, ändert kein Verhalten und erzeugt die Zahl.
--
-- WAS DIESE MIGRATION TUT
-- -----------------------
-- Sie legt den Schlüssel `json_repair_enabled` an, mit dem Wert `false`.
--
-- Jede Reparatur ist ein ZWEITER bezahlter Modellaufruf auf eine Antwort, die
-- schon misslungen ist. Ob er stattfinden soll, ist eine Kostenentscheidung und
-- gehört nicht in den Code. Sie steht ab jetzt als Schalter da — die
-- Entscheidung ist ein Umlegen, kein Umbau.
--
-- `false` ist nicht nur die Vorgabe, sondern auch der Ausfallweg: `json_repair_allowed`
-- ist fail-closed, fehlt die Zeile, ist die Reparatur aus. Ein Riegel, der bei
-- Abwesenheit öffnet, ist kein Riegel (F32).
--
-- Die Zeile wird trotzdem GESCHRIEBEN und nicht dem Ausfallweg überlassen:
-- `test_platform_settings_keys_exist` verlangt für jeden gelesenen Schlüssel
-- eine Migration, weil ein falsch geschriebener Name zur Laufzeit genauso
-- aussieht wie ein nicht gesetzter (D10-3, `heartbeat_interval`).
-- ============================================================================

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'json_repair_enabled',
  'false'::jsonb,
  'Darf eine misslungene JSON-Antwort eines Modells ein zweites Mal — samt '
  'Zielform — ans Modell geschickt werden? Kostet je Reparatur einen weiteren '
  'bezahlten Aufruf. Aus, bis die über _observe_json_failure erhobene '
  'Misserfolgsrate die Kosten rechtfertigt.'
)
ON CONFLICT (setting_key) DO NOTHING;


-- ── Abnahme ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_wert jsonb;
BEGIN
  SELECT setting_value INTO v_wert FROM platform_settings WHERE setting_key = 'json_repair_enabled';

  IF v_wert IS NULL THEN
    RAISE EXCEPTION 'Migration 310: der Schluessel json_repair_enabled fehlt';
  END IF;

  -- Der Riegel muss ZU sein. Ein Riegel, den eine Migration versehentlich
  -- oeffnet, kostet ab dem naechsten misslungenen Modellaufruf Geld.
  --
  -- Geprueft wird gegen die Menge, die `parse_setting_bool` seit F32 als
  -- Wahrheit gelten laesst: alles ausserhalb von {true,1,yes,on} ist Falsch.
  -- Deshalb ist hier die AUSSAGE, dass der Wert nicht darin liegt, die
  -- richtige Pruefung — nicht eine Liste erlaubter Falsch-Schreibweisen.
  IF lower(coalesce(v_wert #>> '{}', '')) IN ('true', '1', 'yes', 'on') THEN
    RAISE EXCEPTION 'Migration 310: json_repair_enabled steht auf % — der Riegel ist offen', v_wert;
  END IF;
END;
$$;
