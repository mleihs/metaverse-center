-- Migration 294: Drei Verwaltungssichten waren für `anon` lesbar.
--
-- Gefunden beim Nacharbeiten von E13 („`available_dungeons` auf
-- `security_invoker` stellen"). Die Messung ergab etwas anderes als der Befund:
-- **keine einzige der 11 Sichten in `public` erklärt `security_invoker`**, alle
-- laufen also als ihr Eigentümer (`postgres`), und alle 11 sind `anon`-lesbar.
-- RLS der Basistabellen greift damit bei keiner.
--
-- Für die meisten ist das folgenlos: `active_agents`, `active_buildings`,
-- `active_events`, `map_simulations`, `conversation_summaries` und
-- `simulation_dashboard` lesen Tabellen, deren Richtlinien `anon` denselben
-- Zugriff ohnehin ausdrücklich gewähren (Public-First-Architektur;
-- `chat_conversations` trägt z. B. `conversations_anon_select` für aktive
-- Welten). Die Sicht gibt dort nichts heraus, was die Richtlinie verwehrt.
--
-- Bei DREI Sichten ist es anders — ihre Basistabellen verwehren `anon` alles:
--
--   token_economy_stats  → token_purchases  ("Users read own purchases",
--                                            "Admins read all purchases")
--                          user_wallets     ("Users can view their own wallet",
--                                            "Admins can manage all wallets")
--       Gibt heraus: Gesamtumsatz in Cent, Tokens im Umlauf, Zahl der Käufer.
--       Aggregate, keine Personendaten — aber Geschäftszahlen der Plattform.
--
--   v_instagram_queue    → instagram_posts  (RLS an; einzige Richtlinie
--   v_bluesky_queue      → bluesky_posts     `ig_posts_admin_all` bzw.
--                                            `bsky_posts_admin_all`, ALL,
--                                            Bedingung `is_platform_admin()`)
--
--       ACHTUNG, die Unterscheidung ist wichtig: es ist NICHT „keine
--       Richtlinie", sondern „eine Richtlinie, die für anon nie zutrifft".
--       Der Unterschied entscheidet, was ein späterer Leser tut: wer „keine
--       Richtlinie" liest, könnte auf die Idee kommen, eine hinzuzufügen — und
--       damit genau den Zugang öffnen, den diese Migration schließt.
--       (Meine erste Messung sah die Richtlinie nicht, weil die Abfrage auf
--       `polcmd = 'r'` filterte; eine ALL-Richtlinie trägt `'*'`.
--       Von der Parallelsitzung berichtigt.)
--       Gibt heraus: die vollständige Warteschlange samt UNVERÖFFENTLICHTER
--       Beiträge — Bildtexte, Hashtags, Bild-URLs, Terminplanung — und
--       `unlock_code`, den Code des Cipher-ARG je Beitrag. 13 bzw. 2 Zeilen.
--       Wer die Codes vor der Veröffentlichung lesen kann, löst das ARG, ohne
--       es zu spielen.
--
-- BELEG (Parallelsitzung, lesend auf Prod in BEGIN … ROLLBACK, `SET LOCAL ROLE
-- anon`, beide Seiten unter DERSELBEN Rolle gemessen):
--
--       als Rolle anon      Basistabelle   Sicht
--       instagram_posts            0         13
--       bluesky_posts              0          2
--
-- Die Basistabelle gibt anon nichts, die Sicht dreizehn Zeilen. Genau die
-- Differenz ist die Lücke.
--
-- Alle drei werden im Betrieb AUSSCHLIESSLICH über den service_role-Client
-- hinter `require_platform_admin()` gelesen (`forge_draft_service.py:466`,
-- `instagram_content_service.py:573`, `bluesky_content_service.py:205`) —
-- der Entzug der anon/authenticated-Rechte kann also keinen Aufrufer treffen.
--
-- Zwei Maßnahmen, absichtlich beide:
--   1. Rechte entziehen — die direkte Wirkung, unabhängig von RLS.
--   2. `security_invoker` setzen — Tiefenverteidigung: sollte jemand die
--      Rechte künftig wieder erteilen, greift dann wenigstens die RLS der
--      Basistabellen statt der Eigentümerrolle.
--
-- Die übrigen acht Sichten bleiben unangetastet: dort `security_invoker` zu
-- setzen wäre eine Verhaltensänderung an öffentlichen Leseflächen, deren
-- Richtlinien ich nicht einzeln geprüft habe, und das gehört nicht in eine
-- Migration, die eine Lücke schließt.

BEGIN;

REVOKE SELECT ON public.token_economy_stats FROM anon, authenticated;
REVOKE SELECT ON public.v_instagram_queue   FROM anon, authenticated;
REVOKE SELECT ON public.v_bluesky_queue     FROM anon, authenticated;

ALTER VIEW public.token_economy_stats SET (security_invoker = on);
ALTER VIEW public.v_instagram_queue   SET (security_invoker = on);
ALTER VIEW public.v_bluesky_queue     SET (security_invoker = on);

COMMIT;
