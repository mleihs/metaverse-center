-- 344 — Der Agenten-Chat bekommt eigene Regler
--
-- `chat_response` war bis zum 02.09.2026 kein deklarierter Zweck. Er fiel unter
-- Regel 3 in `platform_model_config.get_platform_model` auf `model_default` —
-- der Chat folgte also jeder Modellentscheidung, die fuer die Schmiede oder die
-- Einordnung getroffen wurde, ohne dass irgendwo stand, dass er das tut.
--
-- Er ist jetzt deklariert (`ai_purposes.py`, model_key `chat`) und loest auf
-- `deepseek/deepseek-v4-flash` auf: 1 048 576 Token Kontext gegen 163 840 bei
-- `deepseek-chat` (gemessen am OpenRouter-Katalog).
--
-- ⚠ VORRANG: die ZEILE schlaegt die Deklaration. Ohne diese Migration bliebe
-- eine im Code geaenderte Vorgabe auf jeder Datenbank wirkungslos, die die
-- Zeile schon hat — und `test_ai_purposes_migration.py` besteht genau darauf.
--
-- DIE WERTE, UND WARUM
--   max_tokens 1400   Rund 1 000 deutsche Woerter: lang genug fuer eine
--                     ausgefuehrte Antwort, kurz genug, dass sie ein
--                     Gespraechszug bleibt. Die zunaechst erwogenen 2 500
--                     waeren ein Aufsatz und kollidieren mit
--                     `_CONTEXT_RESERVE = 5000`, das sich System-Prompt UND
--                     Antwort teilen — Persona, Erinnerungen, Beziehungen und
--                     Stimmung tragen dort oft schon 2 000+.
--   timeout 60        Wie die uebrigen Textzwecke.
--   reasoning "off"   Nicht nur eine Kostenfrage: `_sanitize_response` entfernt
--                     heute `<think>`-Bloecke aus Antworten, durchgesickerte
--                     Gedankenketten waren also ein TATSAECHLICHES Problem.
--                     Abschalten beseitigt die Ursache statt das Symptom. Fuer
--                     Charakter-Rollenspiel traegt Nachdenken ohnehin nichts
--                     zur Personentreue bei.
--
-- Nicht hier, weil sie keine Zweck-Einstellungen sind, sondern Regler des
-- Gespraechszugs (`chat_ai_service.py`): temperature 1,15, top_p 0,95,
-- frequency_penalty 0,15. `presence_penalty` bleibt ABSICHTLICH ungesetzt —
-- es wirkt binaer, und der erwogene Wert 0,05 liegt unter der
-- Wahrnehmungsschwelle. Ein Regler, der nichts tut, ist schlechter als keiner.
--
-- Wiederholbar: ON CONFLICT DO NOTHING laesst jede Anpassung eines Betreibers
-- stehen.

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('model_chat', '"deepseek/deepseek-v4-flash"'::jsonb, 'Modell fuer den Agenten-Chat. Eigener Schluessel seit 02.09.2026 — vorher folgte der Chat model_default. v4-flash traegt 1 048 576 Token Kontext.'),
  ('max_tokens_chat_response', '1400'::jsonb, 'Ausgabe-Obergrenze in Tokens fuer den Zweck ''chat_response''. Voreinstellung 1400. Rund 1 000 deutsche Woerter — lang genug fuer eine ausgefuehrte Antwort, kurz genug, dass sie ein Gespraechszug bleibt.'),
  ('timeout_chat_response', '60'::jsonb, 'Zeitlimit in Sekunden fuer den Zweck ''chat_response''. Voreinstellung 60.'),
  ('reasoning_chat_response', '"off"'::jsonb, 'Denkaufwand fuer den Zweck ''chat_response''. off | minimal | low | medium | high | xhigh | auto. Fuer Charakter-Rollenspiel abgeschaltet: Reasoning-Tokens werden aus max_tokens bezahlt und sickerten als <think>-Bloecke in die Antworten.')
ON CONFLICT (setting_key) DO NOTHING;
