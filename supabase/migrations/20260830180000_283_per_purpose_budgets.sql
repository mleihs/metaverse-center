-- ═══════════════════════════════════════════════════════════════════════════
-- 283 — Budget, Zeitlimit und Modell je Zweck werden bedienbar (W4)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM
-- -----
-- Befund 15: von einem KI-Aufruf war genau EINE Groesse ueber die Oberflaeche
-- erreichbar — die Modell-ID. `max_tokens` je Zweck war fest verdrahtet, und
-- zwar die Zahl, die den Produktionslauf vom 29.08. zerlegt hat: bei `entity`
-- gingen 3016 von 3072 Tokens ins Denken, 3 von 4 Versuchen starben, bevor ein
-- Zeichen Antwort entstand. Ein Betreiber, der das um 22:33 Uhr sieht, konnte
-- nichts tun ausser auf ein Deployment zu warten.
--
-- Befund 13: `style_refine` und `templates` standen in KEINER der beiden
-- Tabellen. `timeout=None` ist kein grosszuegiges Zeitlimit, es ist keines —
-- gegen ein Modell, dessen Ausgabedecke bei 384 000 Tokens liegt. Im
-- Produktionslog steht woertlich `purpose=style_refine timeout=None
-- max_tokens=None`.
--
-- Befund 11: das Modell kam aus einem anderen Namen als Budget und Zeitlimit.
-- An 8 von 9 Stellen sagte der Agent "forge" und der Aufruf "chunk", "entity",
-- "lore", "dossier". Beides ist jetzt EIN Name, deklariert in
-- `backend/services/ai_purposes.py`.
--
-- WAS
-- ---
-- Diese Migration legt die Zeilen an, die die Deklaration bedienbar machen:
--   * `max_tokens_<zweck>` und `timeout_<zweck>` fuer alle 13 Zwecke
--   * `reasoning_<zweck>` fuer die acht, die Migration 279 nicht angelegt hat
--   * `model_forecast` (+ _dev) — bisher eine `Final`-Konstante im
--     `ops_forecast_service`, also der eine Ort, an den ein Betreiber nicht
--     herankommt. Gleiches Modell, jetzt eine Zeile wie jede andere.
--
-- KEINE ZAHL IST HIER ABGETIPPT. Diese Datei ist aus
-- `backend/services/ai_purposes.py` erzeugt, und
-- `backend/tests/unit/test_ai_purposes_migration.py` vergleicht beide Seiten
-- Wert fuer Wert — eine Voreinstellung, die im Code geaendert und hier
-- vergessen wird, ist ein roter Test, kein stiller Unterschied.
--
-- VORRANG: die Zeile schlaegt die Deklaration. Das ist der Zweck der Uebung.
-- Ein unlesbarer Wert (kein Integer, 0, negativ) faellt mit einer Warnung auf
-- die Deklaration zurueck — `max_tokens=0` ist kein kleines Budget und ein
-- negatives Zeitlimit kein kurzes; beides waere ein ausgeschalteter Waechter.
--
-- Wiederholbar: ON CONFLICT DO NOTHING laesst jede Anpassung eines Betreibers
-- stehen. Kein Seed schreibt `platform_settings`, die 027-Falle (Seed laeuft
-- NACH den Migrationen, siehe Befund 31) greift hier also nicht.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('max_tokens_research', '2048'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''research''. Voreinstellung 2048. ~3 sections of citations. The one purpose that already named itself at its agent (research_service.py:283), and therefore the one that has always resolved model_research rather than model_forge.'),
  ('timeout_research', '90'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''research''. Voreinstellung 90s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_anchors', '3072'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''anchors''. Voreinstellung 3072. 3 compact structured objects, bilingual EN+DE. Thinking stays on: the run that produced correctly dated, checkable citations (Scott, Seeing Like a State, 1998) was a thinking run. Change only with a measurement — see migration 279.'),
  ('timeout_anchors', '120'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''anchors''. Voreinstellung 120s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_chunk', '12288'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''chunk''. Voreinstellung 12288. Geography / agents / buildings as one structured batch, bilingual. Thinking off: long structured output leaves no room to think — the same budget arithmetic that broke `entity` at 3072.'),
  ('timeout_chunk', '180'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''chunk''. Voreinstellung 180s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_entity', '3072'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''entity''. Voreinstellung 3072. One agent or building (character + background + DE). Measured on production 2026-08-29: with thinking at the model''s default, 3016 of 3072 tokens went to reasoning and 3 of 4 attempts died before emitting anything. Off takes it to 3/3 and 50-115s down to ~31s.'),
  ('timeout_entity', '120'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''entity''. Voreinstellung 120s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_lore', '8192'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''lore''. Voreinstellung 8192. 5-7 section lore scroll. Off keeps 2/2 success, yields more sections, runs 40% faster and costs half (migration 279).'),
  ('timeout_lore', '180'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''lore''. Voreinstellung 180s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_lore_translation', '8192'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''lore_translation''. Voreinstellung 8192. Mirrors the lore output it translates, so it mirrors its budget.'),
  ('timeout_lore_translation', '180'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''lore_translation''. Voreinstellung 180s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_dossier', '16384'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''dossier''. Voreinstellung 16384. ~9000 words across 6 sections — the largest single answer the platform asks for. Reasoning left on auto: the measurement was inconclusive, 3 of 4 runs hit an unrelated upstream provider error.'),
  ('timeout_dossier', '300'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''dossier''. Voreinstellung 300s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_dossier_evolution', '1024'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''dossier_evolution''. Voreinstellung 1024. Short 100-250 word addenda appended to an existing dossier section.'),
  ('timeout_dossier_evolution', '60'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''dossier_evolution''. Voreinstellung 60s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_theme', '2048'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''theme''. Voreinstellung 2048. One flat structured object, ~30 fields (colors, fonts, style prompts).'),
  ('timeout_theme', '90'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''theme''. Voreinstellung 90s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_translation', '4096'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''translation''. Voreinstellung 4096. A batch of entity fields translated in one call.'),
  ('timeout_translation', '120'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''translation''. Voreinstellung 120s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_style_refine', '2048'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''style_refine''. Voreinstellung 2048. NEW BUDGET — this purpose had neither, and ran as `timeout=None max_tokens=None` in production. One answer is four style prompts (PORTRAIT / BUILDING / LORE / BANNER). Measured over the 41 worlds on production 2026-08-30, as stored in simulation_settings: median 947 characters for all four together, p95 1936, max 2155 — roughly 616 tokens at the worst. 2048 is 3.3x the observed maximum, and equals `theme`, which is the same service producing the same kind of answer. Timeout 90s against a single observed duration of 21s in the 2026-08-29 ignition log.'),
  ('timeout_style_refine', '90'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''style_refine''. Voreinstellung 90s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_templates', '8192'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''templates''. Voreinstellung 8192. NEW BUDGET — as with style_refine, this ran uncapped and untimed. One answer is every prompt template for a world, as JSON. Measured across the 12 worlds on production that own templates, 2026-08-30: median 3015 characters, p95 and max both 12369 — about 3500 tokens before JSON escaping. 8192 is a little over 2x the observed maximum, and equals `lore`, the nearest comparable answer. Those 12 outputs were produced with NO cap at all, so the maximum is a real ceiling of the task and not an artefact of a previous limit.'),
  ('timeout_templates', '180'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''templates''. Voreinstellung 180s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('max_tokens_ops_forecast', '200'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''ops_forecast''. Voreinstellung 200. MOVED, not invented. This purpose is absent from the two tables this module replaces, but unlike style_refine and templates it was never unbounded: `ops_forecast_service` passed `model_settings={''timeout'': 10, ''max_tokens'': 200}` at the call site, and `run_ai` uses `setdefault`, so those won. The numbers are carried here unchanged — 200 tokens caps the 1-2 sentence summary at ~$0.0001/call — so that all thirteen budgets are in one place and an operator can see this one. The outer `asyncio.wait_for` (`_DRIVER_TEXT_TIMEOUT_S`) stays what it was: a backstop, not the primary deadline. The model id moves too — `_FORECAST_MODEL` held `anthropic/claude-haiku-4.5` as a `Final` constant, which is the one place an operator cannot reach it; `model_forecast` is seeded with that exact id. Budget-exempt by design (AD-6): it passes no `admin_supabase`, so nothing pre-checks it.'),
  ('timeout_ops_forecast', '10'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''ops_forecast''. Voreinstellung 10s. Ein fehlendes Zeitlimit ist kein grosszuegiges.'),
  ('reasoning_research', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''research''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_anchors', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''anchors''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_chunk', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''chunk''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_entity', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''entity''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_lore', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''lore''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_lore_translation', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''lore_translation''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_dossier', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''dossier''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_dossier_evolution', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''dossier_evolution''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_theme', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''theme''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_translation', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''translation''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_style_refine', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''style_refine''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_templates', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''templates''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('reasoning_ops_forecast', '"auto"'::jsonb, 'Denkaufwand fuer den Zweck ''ops_forecast''. off | minimal | low | medium | high | xhigh | auto. Reasoning-Tokens werden aus max_tokens bezahlt.'),
  ('model_forecast', '"anthropic/claude-haiku-4.5"'::jsonb, 'Modell fuer die Kostenprognose (ops_forecast). Lag bis 2026-08-30 als Final-Konstante im ops_forecast_service.'),
  ('model_forecast_dev', '"anthropic/claude-haiku-4.5"'::jsonb, 'Modell fuer die Kostenprognose (ops_forecast). Lag bis 2026-08-30 als Final-Konstante im ops_forecast_service.')
ON CONFLICT (setting_key) DO NOTHING;
