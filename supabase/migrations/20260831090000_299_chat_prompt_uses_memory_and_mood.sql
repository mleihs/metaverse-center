-- Migration 299: Der Chat berechnete Erinnerung und Stimmung und warf sie weg.
--
-- Befund D7/S12 der Systempruefung, beim Nachmessen groesser als gemeldet.
--
-- WAS GEMESSEN WURDE (Prod, 31.08.2026)
--
--   select simulation_id is null as plattform, locale,
--          position('{agent_memories}' in prompt_content) > 0,
--          position('{agent_mood}' in prompt_content) > 0
--   from prompt_templates where template_type = 'chat_system_prompt';
--
--   plattform  de   false  false     <- 322 Zeichen
--   plattform  en   false  false     <- 295 Zeichen
--   Welt       en   false  false     <-  85 Zeichen
--   Welt       en   false  false     <- 358 Zeichen
--   Welt       en   false  false     <- 427 Zeichen
--   Welt       en   TRUE   TRUE      <- 899 Zeichen (aus der Schmiede)
--
-- `ChatAIService` holt die Erinnerungen des Agenten (mit Wichtigkeit und
-- Typ) und baut einen Stimmungsblock aus Laune, Stress und den fuenf
-- staerksten Moodlets. `prompt_contracts.py` deklariert beide Variablen
-- korrekt. Der Vorlagentext nannte sie nur nirgends -- also rendert der
-- Resolver sie in nichts hinein, still und ohne Fehler.
--
-- Eine Welt hatte es, weil ihre Vorlage aus der Schmiede stammt. Fuer alle
-- anderen war jedes Gespraech das erste: der Agent erinnerte sich an nichts
-- und war immer gleich gelaunt, egal was im Rest des Systems ueber ihn
-- geschrieben stand.
--
-- WARUM NACKTE PLATZHALTER AUF EIGENER ZEILE
--
-- Beide Werte tragen ihre eigene Beschriftung: `format_for_prompt` beginnt
-- mit "Your memories and reflections:", und der Stimmungsblock ist ein
-- vollstaendiger Satz aus `MOOD_CONTEXT_TEMPLATES`. Eine zusaetzliche
-- Beschriftung im Vorlagentext ergaebe eine doppelte.
--
-- Und beide sind BEDINGT: `chat_ai_service` setzt `agent_mood` nur, wenn ein
-- Stimmungsblock zustande kam. Der Resolver rendert eine deklarierte, aber
-- nicht gelieferte Variable leer und schweigt dazu (bewusst, siehe
-- `PromptResolver._render`) -- eine nackte Zeile verschwindet dann rueckstands-
-- frei, eine beschriftete liesse "Wie es dir heute geht:" ohne Fortsetzung
-- stehen.
--
-- WAS DIESE MIGRATION NICHT TUT
--
-- Sie fasst die vier WELT-eigenen Vorlagen nicht an. Eine Weltvorlage ist
-- Autorschaft; sie zu ueberschreiben waere derselbe Fehler wie ein
-- automatischer Reparaturlauf ueber die Weltnamen (Regel W6 der
-- Forge-Welle). Fuer die drei unvollstaendigen kommt ein Skript mit Liste
-- zur Durchsicht -- ausdruecklich nicht automatisch.
--
-- Der Kandidatenfilter ist deshalb eng: NUR `simulation_id IS NULL`.

BEGIN;

UPDATE prompt_templates
SET prompt_content = 'You are {agent_name}, a character in the simulation "{simulation_name}".

Your personality: {agent_character}
Your background: {agent_background}

{agent_memories}

{agent_mood}

Stay in character at all times. Respond naturally as this character would.
Never break character or acknowledge being an AI.
Respond in {locale_name}.',
    variables = '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "agent_memories"}, {"name": "agent_mood"}, {"name": "simulation_name"}, {"name": "locale_name"}]'::jsonb,
    updated_at = now()
WHERE template_type = 'chat_system_prompt'
  AND simulation_id IS NULL
  AND locale = 'en';

UPDATE prompt_templates
SET prompt_content = 'Du bist {agent_name}, ein Charakter in der Simulation "{simulation_name}".

Deine Persönlichkeit: {agent_character}
Dein Hintergrund: {agent_background}

{agent_memories}

{agent_mood}

Bleibe jederzeit in der Rolle. Antworte natürlich, wie dieser Charakter es tun würde.
Brich niemals die Rolle und gib nie zu, eine KI zu sein.
Antworte auf {locale_name}.',
    variables = '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "agent_memories"}, {"name": "agent_mood"}, {"name": "simulation_name"}, {"name": "locale_name"}]'::jsonb,
    updated_at = now()
WHERE template_type = 'chat_system_prompt'
  AND simulation_id IS NULL
  AND locale = 'de';

-- Abnahme in derselben Transaktion: beide Plattformvorlagen muessen danach
-- beide Platzhalter tragen. Ohne diese Pruefung waere ein UPDATE, das null
-- Zeilen trifft (fehlende Seed-Zeile, anderer `locale`-Wert), ein stiller
-- Erfolg -- genau die Fehlerart, wegen der `upsert_platform_setting`
-- existiert.
DO $$
DECLARE
  vollstaendig INT;
BEGIN
  SELECT count(*) INTO vollstaendig
  FROM prompt_templates
  WHERE template_type = 'chat_system_prompt'
    AND simulation_id IS NULL
    AND position('{agent_memories}' in prompt_content) > 0
    AND position('{agent_mood}' in prompt_content) > 0;

  IF vollstaendig <> 2 THEN
    RAISE EXCEPTION
      'Erwartet: zwei Plattform-Chatvorlagen (de, en) mit Erinnerung und Stimmung. Gefunden: %.',
      vollstaendig;
  END IF;
END $$;

COMMIT;
