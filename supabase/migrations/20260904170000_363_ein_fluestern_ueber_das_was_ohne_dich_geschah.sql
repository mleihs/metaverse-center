-- ═══════════════════════════════════════════════════════════════════════════
-- 363 · Ein Flüstern über das, was ohne dich geschah
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Schritt 3 des Plans (Konzept 03, Whisper-Weg): aus einem Wortwechsel ohne
-- Zuhörer wird eine Nachricht an den Menschen, der ihn eingeschaltet hat.
--
-- ── ABWEICHUNG VOM PLAN, UND WARUM ─────────────────────────────────────────
--
--   Der Plan sagt: erzeugt, „wenn der Spieler darin vorkommt UND eine Bindung
--   besteht". Die erste Bedingung ist NICHT ERFÜLLBAR, und das ist gemessen,
--   nicht vermutet:
--
--     · `user_profiles` führt keinen Anzeigenamen (Spalten: id, email,
--       onboarding_completed, academy_epochs_played, created_at, updated_at).
--       Der Name liegt in `auth.users.user_metadata`.
--     · Vor allem aber: der Agent ERFÄHRT den Namen nie. Weder
--       `chat_ai_service` noch ein Prompt-Vertrag reicht ihn durch; in der
--       Mitschrift heisst der Mensch schlicht „User".
--
--   Eine Bedingung, die auf einen Namen prüft, den niemand kennt, ist immer
--   falsch. Das Merkmal sähe gebaut aus und liefe nie — die schlechteste
--   Sorte fertig.
--
--   Es gilt deshalb die zweite Bedingung ALLEIN: eine BINDUNG zwischen dem
--   Menschen und einem der Beteiligten. Das ist auch die richtigere: die
--   Bindung ist die Beziehung, die die Nachricht überhaupt bedeutsam macht.
--   Ohne sie wäre das Flüstern die Benachrichtigung einer Fremden.
--
-- ── DER TYP ────────────────────────────────────────────────────────────────
--
--   `bond_whispers.whisper_type` kennt fünf Werte (Migration 219). Ein
--   sechster wird gebraucht, weil dieses Flüstern eine andere Herkunft hat
--   als die fünf: es entsteht nicht aus dem Zustand eines Agenten, sondern
--   aus einem Gespräch, das stattgefunden hat.
--
--   `trigger_context` trägt die `conversation_id` — ohne sie wäre das
--   Flüstern eine Behauptung ohne Beleg, und der Mensch könnte nicht
--   nachsehen, wovon die Rede ist.

BEGIN;

ALTER TABLE bond_whispers DROP CONSTRAINT IF EXISTS bond_whispers_whisper_type_check;

ALTER TABLE bond_whispers ADD CONSTRAINT bond_whispers_whisper_type_check
  CHECK (whisper_type IN ('state', 'event', 'memory', 'question', 'reflection', 'conversation'));

COMMIT;

-- Der Riegel für den Mailweg. Fail-closed wie jeder `*_enabled`-Schlüssel:
-- fehlt die Zeile, geht keine Post hinaus. Für Mail ist das die richtige
-- Richtung des Scheiterns — ein Tor, das eine Aussendung still SCHARFSTELLT,
-- ist schlimmer als eines, das sie still zurückhält.
--
-- ⚠ Getrennt von `lifecycle_mail_enabled`: wer die Begrüssungspost anschaltet,
-- hat damit nicht entschieden, dass Agentengespräche in fremde Postfächer
-- gehen. Zwei Entscheidungen, zwei Schalter.
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('continuation_mail_enabled', 'false'::jsonb, 'Ob aus Wortwechseln ohne Zuhoerer Post hinausgeht (Zustellart "immediate" und die Wochenpost). Vorgabe AUS. Getrennt von lifecycle_mail_enabled: wer die Begruessungspost anschaltet, hat damit nicht entschieden, dass Agentengespraeche in fremde Postfaecher gehen.')
ON CONFLICT (setting_key) DO NOTHING;

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung, und zwar mit einer PROBE: nimmt der CHECK den
-- neuen Wert an, und weist er einen erfundenen weiterhin ab. Zu zählen, dass
-- die Beschränkung dasteht, wäre ein Haken ohne Deckung.
--
-- `bond_whispers.bond_id` hat einen Fremdschlüssel, der vor dem CHECK
-- zuschlägt. Die Probe läuft deshalb gegen eine ECHTE Bindung, falls es eine
-- gibt — und wird sonst mit RAISE NOTICE ÜBERSPRUNGEN. Nicht verschwiegen:
-- eine Prüfung, die nichts zu prüfen fand, ist keine bestandene.
DO $$
DECLARE
  v_bond   uuid;
  v_riegel int;
BEGIN
  SELECT count(*) INTO v_riegel FROM platform_settings
  WHERE setting_key = 'continuation_mail_enabled';
  IF v_riegel <> 1 THEN
    RAISE EXCEPTION '363: der Mail-Riegel wurde nicht angelegt';
  END IF;

  SELECT id INTO v_bond FROM agent_bonds LIMIT 1;
  IF v_bond IS NULL THEN
    RAISE NOTICE '363: keine Bindung vorhanden — CHECK-Probe UEBERSPRUNGEN, nicht bestanden. Der neue Wert steht in der Beschraenkung, ist aber nicht ausprobiert.';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO bond_whispers (bond_id, whisper_type, content_de, content_en)
    VALUES (v_bond, 'conversation', 'Probe 363', 'Probe 363');
    DELETE FROM bond_whispers WHERE bond_id = v_bond AND content_de = 'Probe 363';
    RAISE NOTICE '363: conversation wird angenommen.';
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION '363: der CHECK weist conversation weiterhin ab';
  END;

  BEGIN
    INSERT INTO bond_whispers (bond_id, whisper_type, content_de, content_en)
    VALUES (v_bond, 'erfunden', 'Probe 363b', 'Probe 363b');
    DELETE FROM bond_whispers WHERE bond_id = v_bond AND content_de = 'Probe 363b';
    RAISE EXCEPTION '363: der CHECK hat einen erfundenen Typ durchgelassen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '363: ein erfundener Typ wird weiterhin abgewiesen.';
  END;
END $$;
