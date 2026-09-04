-- ═══════════════════════════════════════════════════════════════════════════
-- 373 · Ein Bericht ueber euch ist nicht deine Erinnerung
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Die Verdichtung aus 358/359 ist EIN Text je Abschnitt, an alle Figuren
-- gleich ausgeliefert, und die Vorlage sagte woertlich: "Er wird den
-- Beteiligten ALS IHRE ERINNERUNG vorgelegt", samt "wie die Beteiligten
-- zueinander stehen" und "was unausgesprochen blieb".
--
-- ── GEMESSEN, mit dem eigenen Fokalisierungs-Detektor ──────────────────────
--
--   12 Verdichtungen eines Fadens, jede aus der Sicht jeder der drei Figuren:
--
--       als Erinnerung von Figur 1:  11 von 12 allwissend
--       als Erinnerung von Figur 2:  11 von 12 allwissend
--       als Erinnerung von Figur 3:  11 von 12 allwissend
--
--       mit Ich-Form:               5 von 12
--       Durchschnittslaenge:        2 333 Zeichen
--       im Prompt zusammen:         ~7 000 Token je Zug, je Figur
--
--   Gegen einen Satz "du bist X" stehen 7 000 Token Erzaehlerprosa, die
--   vorfuehrt, wie man ueber alle drei gleichzeitig spricht. Und fuenf der
--   zwoelf enthalten ein "ich", das keiner Leserin gehoert.
--
-- ── DIE FORSCHUNG, und sie ist eindeutig ───────────────────────────────────
--
--   ReverieMem (arXiv:2606.25632) misst genau diese Wahl. KBF-QA, 4 386
--   Fragen ueber 8 Romane, harmonisches Mittel aus Treffer- und
--   Verweigerungsgenauigkeit:
--
--       geteilter Abruf ueber alles (Naive RAG)      KBF 18,9   (Verweigerung 10,0)
--       RAPTOR, also SUMMIERUNG ueber Baeume         KBF 16,8   (Verweigerung  8,7)
--       nur geteilte Schicht, sichtbarkeitsbegrenzt  KBF 60,9   (Verweigerung 47,0)
--       nur Ich-Schicht je Figur                     KBF 17,8   (Treffer      10,8)
--       BEIDE Schichten                              KBF 73,3   (Verweigerung 81,2)
--
--   Zwei Lehren daraus, beide gegen die naheliegende Loesung:
--
--   * Die geteilte Schicht ALLEIN reicht nicht. Verweigerung faellt von 81
--     auf 47 — die Figur spricht weiter ueber ihre Grenze hinaus, weil nichts
--     sie in der EIGENEN Erfahrung verankert.
--   * Die Ich-Schicht ALLEIN ist schlimmer als beides: Treffer 10,8. Die
--     Figur wird zur Amnestikerin. Wer die geteilte Schicht ersatzlos
--     streicht, tauscht Allwissenheit gegen Gedaechtnisverlust.
--
--   Zusammenfassen selbst ist der Verdaechtige: die Baum-Summierung hat die
--   SCHLECHTESTE Verweigerungsrate der ganzen Tabelle. Sie loescht die
--   Herkunft, und ohne Herkunft kann nachgelagert nichts mehr filtern.
--
--   Chroma "Context Rot" (18 Modelle) misst dazu: zusammenhaengende Prosa ist
--   ein SCHLECHTERES Abrufsubstrat als eine Liste — "structural coherence
--   consistently hurts model performance". Der geteilte Teil wird deshalb
--   eine Liste und kein Fliesstext.
--
--   Und CHARM (arXiv:2609.01352) sagt, warum eine Umbenennung nicht genuegt:
--   zwischen dem ERKENNEN einer Grenze und ihrem EINHALTEN liegen bei GPT-4o
--   72,4 Punkte. Der Filter muss laufen, BEVOR die Token beim Modell sind.
--   Deshalb wird der Innenwelt-Anteil nicht verboten, sondern gar nicht erst
--   erzeugt.
--
-- ── WAS DIESE MIGRATION TUT ────────────────────────────────────────────────
--
--   1. `chat_conversation_digests.agent_id` — NULL heisst geteiltes
--      Protokoll, gesetzt heisst Ich-Erinnerung genau dieser Figur.
--   2. Der Eindeutigkeitszwang wird zu ZWEI Teilindizes. Ein
--      `UNIQUE(…, agent_id)` taete es NICHT: PostgreSQL haelt NULLs fuer
--      verschieden, damit waeren beliebig viele geteilte Protokolle je
--      Abschnitt erlaubt — der Zwang saehe da und waere leer.
--   3. `chat_conversation_digest` wird zum PROTOKOLL DES BEOBACHTBAREN:
--      Liste, keine Innenwelt, kein "unausgesprochen", und es heisst nicht
--      mehr Erinnerung.
--   4. Neu: `chat_character_episode` — Ich-Form, in der Stimme EINER Figur,
--      nur was sie wahrgenommen hat, ohne Wissen um Spaeteres.
--
--   Der Preis: je Abschnitt 1 + N Aufrufe statt 1. Das faellt EINMAL je
--   Abschnitt an, nicht je Zug — der teure Weg waere gewesen, die
--   Sichtbarkeit je Zug zu berechnen.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE chat_conversation_digests
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id) ON DELETE CASCADE;

COMMENT ON COLUMN chat_conversation_digests.agent_id IS
  'NULL = geteiltes Protokoll des Beobachtbaren. Gesetzt = Ich-Erinnerung dieser Figur (Migration 373).';

ALTER TABLE chat_conversation_digests
  DROP CONSTRAINT IF EXISTS chat_conversation_digests_segment_unique;

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversation_digests_shared_unique
  ON chat_conversation_digests (conversation_id, segment_index)
  WHERE agent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversation_digests_character_unique
  ON chat_conversation_digests (conversation_id, segment_index, agent_id)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_conversation_digests_agent_idx
  ON chat_conversation_digests (conversation_id, agent_id, segment_index);

-- ── Die geteilte Schicht: Protokoll, kein Gedaechtnis ─────────────────────

UPDATE prompt_templates
SET prompt_content = 'Es folgt Abschnitt {segment_index} eines langen Gespraechs zwischen: {participant_names}.

--- MITSCHRIFT ---
{transcript}
--- ENDE MITSCHRIFT ---

Schreibe auf {locale_name} ein PROTOKOLL dieses Abschnitts. Es ist kein Bericht ueber die Beteiligten und keine Erinnerung von irgendjemandem, sondern die Liste dessen, was im Raum beobachtbar war.

Als Liste, eine Zeile je Vorgang, jede Zeile beginnend mit dem Namen dessen, der handelt oder spricht:

- Was jemand getan hat.
- Was jemand gesagt oder gefragt hat, und was daraufhin entschieden oder geklaert wurde.
- Was sich im Raum veraendert hat: wer gekommen ist, wer gegangen ist, was den Ort betrifft.

Zwei Dinge gehoeren NICHT hinein, weil sie niemand beobachten kann:
- was jemand gedacht, gefuehlt, gewollt oder gehofft hat,
- was zwischen den Beteiligten unausgesprochen blieb.

Wenn eine Regung sichtbar war, schreibe die Beobachtung, nicht die Deutung: nicht "sie war unsicher", sondern "sie zoegerte".

Kein Vorwort, keine Zusammenfassung am Ende, keine Ich-Form.',
    variables = '["segment_index", "participant_names", "transcript", "locale_name"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL AND template_type = 'chat_conversation_digest' AND locale = 'de';

UPDATE prompt_templates
SET prompt_content = 'The following is section {segment_index} of a long conversation between: {participant_names}.

--- TRANSCRIPT ---
{transcript}
--- END TRANSCRIPT ---

Write a RECORD of this section in {locale_name}. It is not a report about the participants and not anyone''s memory, but the list of what was observable in the room.

As a list, one line per occurrence, each line beginning with the name of whoever acts or speaks:

- What someone did.
- What someone said or asked, and what was decided or clarified as a result.
- What changed in the room: who arrived, who left, what concerns the place.

Two things do NOT belong in it, because nobody can observe them:
- what anyone thought, felt, wanted or hoped,
- what remained unspoken between the participants.

Where a feeling was visible, write the observation, not the reading: not "she was uncertain", but "she hesitated".

No preamble, no closing summary, no first person.',
    variables = '["segment_index", "participant_names", "transcript", "locale_name"]'::jsonb,
    updated_at = NOW()
WHERE simulation_id IS NULL AND template_type = 'chat_conversation_digest' AND locale = 'en';

-- ── Die Ich-Schicht: eine Figur, ihre Stimme, ihr Horizont ────────────────

INSERT INTO prompt_templates (template_type, prompt_category, template_name, locale, simulation_id, prompt_content, variables, is_active)
SELECT 'chat_character_episode', 'chat', 'Ich-Erinnerung einer Figur (DE)', 'de', NULL,
'Du bist {agent_name}. Es folgt Abschnitt {segment_index} eines Gespraechs, an dem du beteiligt warst, zusammen mit: {other_agent_names}.

--- MITSCHRIFT ---
{transcript}
--- ENDE MITSCHRIFT ---

Schreibe auf {locale_name}, woran DU dich aus diesem Abschnitt erinnerst. In der Ich-Form, in deiner Stimme, knapp.

Dein Horizont endet, wo deine Sinne enden. Schreibe, was du getan, gesagt, bemerkt und gefuehlt hast; was dir aufgefallen ist; was du dir gedacht hast und niemandem gesagt hast.

Von den anderen schreibe nur, was du wahrgenommen hast und was es mit dir gemacht hat — was sie taten, wie es auf dich wirkte, was du daraus geschlossen hast. Was sie DACHTEN oder WOLLTEN, weisst du nicht; wenn du es vermutest, schreibe es als deine Vermutung.

Du weisst nur, was bis zum Ende dieses Abschnitts geschehen ist. Nichts von spaeter.

Kein Vorwort. Nur die Erinnerung.',
'["agent_name", "other_agent_names", "segment_index", "transcript", "locale_name"]'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates
  WHERE template_type = 'chat_character_episode' AND locale = 'de' AND simulation_id IS NULL);

INSERT INTO prompt_templates (template_type, prompt_category, template_name, locale, simulation_id, prompt_content, variables, is_active)
SELECT 'chat_character_episode', 'chat', 'Character Episode Memory (EN)', 'en', NULL,
'You are {agent_name}. The following is section {segment_index} of a conversation you took part in, together with: {other_agent_names}.

--- TRANSCRIPT ---
{transcript}
--- END TRANSCRIPT ---

Write in {locale_name} what YOU remember of this section. In the first person, in your own voice, briefly.

Your horizon ends where your senses do. Write what you did, said, noticed and felt; what struck you; what you thought and told no one.

Of the others write only what you perceived and what it did to you — what they did, how it affected you, what you concluded. What they THOUGHT or WANTED you do not know; if you suspect it, write it as your suspicion.

You know only what happened up to the end of this section. Nothing from later.

No preamble. Just the memory.',
'["agent_name", "other_agent_names", "segment_index", "transcript", "locale_name"]'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM prompt_templates
  WHERE template_type = 'chat_character_episode' AND locale = 'en' AND simulation_id IS NULL);

DO $$
DECLARE
  v_spalte  int;
  v_idx     int;
  v_alt     int;
  v_prot    int;
  v_epi     int;
  v_verbot  int;
BEGIN
  SELECT count(*) INTO v_spalte FROM information_schema.columns
  WHERE table_name = 'chat_conversation_digests' AND column_name = 'agent_id';
  IF v_spalte <> 1 THEN RAISE EXCEPTION '373: agent_id fehlt'; END IF;

  -- Beide Teilindizes, und der alte Zwang ist weg. Bliebe er, waere je
  -- Abschnitt nur EINE Zeile erlaubt und die Ich-Schicht unschreibbar.
  SELECT count(*) INTO v_idx FROM pg_indexes
  WHERE tablename = 'chat_conversation_digests'
    AND indexname IN ('chat_conversation_digests_shared_unique',
                      'chat_conversation_digests_character_unique');
  IF v_idx <> 2 THEN RAISE EXCEPTION '373: % von 2 Teilindizes angelegt', v_idx; END IF;

  SELECT count(*) INTO v_alt FROM pg_constraint
  WHERE conname = 'chat_conversation_digests_segment_unique';
  IF v_alt <> 0 THEN
    RAISE EXCEPTION '373: der alte Zwang steht noch — die Ich-Schicht waere nicht schreibbar';
  END IF;

  -- Das Protokoll verlangt ausdruecklich KEINE Innenwelt und keine Ich-Form.
  SELECT count(*) INTO v_prot FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_conversation_digest'
    AND (prompt_content LIKE '%PROTOKOLL%' OR prompt_content LIKE '%RECORD%')
    AND (prompt_content LIKE '%keine Ich-Form%' OR prompt_content LIKE '%no first person%')
    AND prompt_content NOT LIKE '%{{%';
  IF v_prot < 2 THEN
    RAISE EXCEPTION '373: nur % von 2 Protokoll-Vorlagen umgestellt', v_prot;
  END IF;

  -- Und es nennt sich NICHT mehr Erinnerung. Genau dieser Satz stand vorher da.
  SELECT count(*) INTO v_verbot FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_conversation_digest'
    AND (prompt_content LIKE '%als ihre Erinnerung%' OR prompt_content LIKE '%as their memory%');
  IF v_verbot > 0 THEN
    RAISE EXCEPTION '373: % Vorlage(n) legen das Protokoll weiterhin als Erinnerung vor', v_verbot;
  END IF;

  SELECT count(*) INTO v_epi FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_character_episode'
    AND prompt_content LIKE '%{agent_name}%'
    AND (prompt_content LIKE '%Ich-Form%' OR prompt_content LIKE '%first person%')
    AND (prompt_content LIKE '%Nichts von spaeter%' OR prompt_content LIKE '%Nothing from later%')
    AND prompt_content NOT LIKE '%{{%';
  IF v_epi < 2 THEN
    RAISE EXCEPTION '373: nur % von 2 Ich-Vorlagen angelegt (Ich-Form + Verbot des Spaeterwissens)', v_epi;
  END IF;

  RAISE NOTICE '373: geteiltes Protokoll ohne Innenwelt + Ich-Erinnerung je Figur; % Teilindizes.', v_idx;
END $$;
