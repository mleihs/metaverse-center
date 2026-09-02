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

-- NACHTRAG 02.09.2026 -- WARUM AN DIESER BEREITS ANGEWANDTEN DATEI GEAENDERT WURDE
--
-- Auf Prod lief die Migration durch, weil die beiden Plattformzeilen dort seit
-- Langem gesaet waren. Auf einer FRISCHEN Datenbank kann sie es nicht: die CI
-- spielt erst alle Migrationen ein und danach `supabase/seed/0*.sql`. Zum
-- Zeitpunkt dieser Migration ist `prompt_templates` also leer, beide UPDATEs
-- treffen null Zeilen, und die Abnahme unten wirft:
--
--     ERROR: Erwartet: zwei Plattform-Chatvorlagen (de, en) mit Erinnerung
--            und Stimmung. Gefunden: 0.
--
-- Der Job "Test Backend" bricht dort mit ON_ERROR_STOP ab, seit dem 31.08.2026,
-- bei jedem Push. Das ist nicht nur ein roter Job: ein dauerhaft rotes CI macht
-- jedes ANDERE Tor unlesbar. Am 02.09.2026 hat genau das zwei Sitzungen einen
-- doppelten Zeitstempel durchgehen lassen -- `lint-migration-order.sh` HAT ihn
-- gemeldet, wortwoertlich, im selben Lauf; nur war rot der Normalzustand und
-- niemand las weiter.
--
-- Die Ursache ist nicht die Abnahme, sondern ihre Voraussetzung: eine Migration
-- darf sich nicht auf Daten stuetzen, die ein SPAETERER Schritt liefert. Die
-- beiden UPDATEs sind deshalb zu INSERT ... ON CONFLICT DO UPDATE geworden.
-- Auf Prod ist das folgenlos identisch (die Zeilen existieren, sie werden auf
-- denselben Text gesetzt wie zuvor); auf einer frischen Datenbank legt die
-- Migration sie selbst an. Der Seed traegt danach dieselben zwei Zeilen mit
-- `ON CONFLICT DO NOTHING` an und wird zum Leerlauf.
--
-- Die Abnahme bleibt unveraendert scharf: sie fordert weiterhin GENAU zwei
-- vollstaendige Plattformvorlagen. Sie wurde nicht aufgeweicht, ihr wurde die
-- fehlende Voraussetzung gegeben.
--
-- EINE FOLGE, DIE MAN WISSEN MUSS: auf einer frischen Datenbank legt jetzt
-- diese Migration die beiden Zeilen an, nicht mehr der Seed -- also mit
-- `created_by_id = NULL` statt mit der Admin-Kennung, die `006_prompt_templates`
-- gesetzt haette. Die Spalte ist nullbar und eine PLATTFORM-Vorlage gehoert
-- keinem Menschen; auf Prod aendert sich ohnehin nichts, weil die Zeilen dort
-- stehen. Falls die Kennung je gebraucht wird, gehoert sie in eine eigene
-- Migration und nicht hierher.
--
-- GEPRUEFT gegen das echte Schema (02.09.2026): ein DO-Block auf Prod, der die
-- beiden Zeilen loescht, die zwei Upserts unten laufen laesst, zaehlt und am
-- Ende mit RAISE abbricht -- ein DO-Block ist EINE Anweisung, die Ausnahme
-- verwirft alles. Ergebnis: `leer=0, nach Upsert vollstaendig=2`, und die
-- Prod-Zeilen tragen danach unveraendert `updated_at = 2026-08-31 06:01`. Damit
-- ist der INSERT-Pfad am partiellen Eindeutigkeitsindex belegt, ohne dass eine
-- Zeile angefasst wurde.

BEGIN;

-- Anlegen ODER berichtigen. Der Konfliktschluessel ist der partielle
-- Eindeutigkeitsindex `idx_prompt_templates_platform_unique` -- deshalb muss
-- sein Praedikat in der Inferenzklausel wiederholt werden, sonst findet
-- Postgres den Index nicht.
INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, variables, default_model, temperature, max_tokens,
    is_system_default
) VALUES (
    NULL, 'chat_system_prompt', 'chat', 'en', 'Chat System Prompt (EN)',
    'You are {agent_name}, a character in the simulation "{simulation_name}".

Your personality: {agent_character}
Your background: {agent_background}

{agent_memories}

{agent_mood}

Stay in character at all times. Respond naturally as this character would.
Never break character or acknowledge being an AI.
Respond in {locale_name}.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "agent_memories"}, {"name": "agent_mood"}, {"name": "simulation_name"}, {"name": "locale_name"}]'::jsonb,
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true
)
ON CONFLICT (template_type, locale) WHERE simulation_id IS NULL
DO UPDATE SET
    prompt_content = EXCLUDED.prompt_content,
    variables      = EXCLUDED.variables,
    updated_at     = now();

INSERT INTO prompt_templates (
    simulation_id, template_type, prompt_category, locale, template_name,
    prompt_content, variables, default_model, temperature, max_tokens,
    is_system_default
) VALUES (
    NULL, 'chat_system_prompt', 'chat', 'de', 'Chat-Systemprompt (DE)',
    'Du bist {agent_name}, ein Charakter in der Simulation "{simulation_name}".

Deine Persönlichkeit: {agent_character}
Dein Hintergrund: {agent_background}

{agent_memories}

{agent_mood}

Bleibe jederzeit in der Rolle. Antworte natürlich, wie dieser Charakter es tun würde.
Brich niemals die Rolle und gib nie zu, eine KI zu sein.
Antworte auf {locale_name}.',
    '[{"name": "agent_name"}, {"name": "agent_character"}, {"name": "agent_background"}, {"name": "agent_memories"}, {"name": "agent_mood"}, {"name": "simulation_name"}, {"name": "locale_name"}]'::jsonb,
    'deepseek/deepseek-chat-v3-0324', 0.8, 500, true
)
ON CONFLICT (template_type, locale) WHERE simulation_id IS NULL
DO UPDATE SET
    prompt_content = EXCLUDED.prompt_content,
    variables      = EXCLUDED.variables,
    updated_at     = now();

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
