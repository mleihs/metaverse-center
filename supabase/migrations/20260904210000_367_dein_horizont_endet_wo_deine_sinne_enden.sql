-- ═══════════════════════════════════════════════════════════════════════════
-- 367 · Dein Horizont endet, wo deine Sinne enden
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dritte Fassung der Gruppen-Anweisung (nach 356 und 364). Dass es eine dritte
-- braucht, ist selbst ein Befund — und die ersten beiden waren nicht nur zu
-- schwach, sie zielten teilweise auf das Falsche.
--
-- ── GEMESSEN, nach dem Ausrollen von 364 ───────────────────────────────────
--
--       Marken `[Name]:`            0 von 3   ✓  (Reparatur aus 356 hält)
--       Bruchstücke                 0         ✓
--       eigener Name in 3. Person   3 von 3   ✗
--
-- ── DIE FEHLDIAGNOSE, und sie war meine ────────────────────────────────────
--
--   Ich hielt „die Figur schreibt in der dritten Person über sich selbst" für
--   den Fehler und verlangte in einem ersten Entwurf die Ich-Form. Das ist
--   falsch: Handlungsprosa in der dritten Person mit Namen ist im
--   Rollenspiel-Ökosystem die übliche Konvention (Ali:Chat schreibt sie
--   ausdrücklich so vor).
--
--   Der Fehler ist nicht das REGISTER, sondern der GELTUNGSBEREICH. „Die drei
--   Frauen verharren…" ist ein Satz über alle drei. Das Modell hat nicht die
--   Figur vergessen — es hat die Rolle „Autor dieses Abschnitts" statt „diese
--   Person" eingenommen.
--
--   Eine Anweisung zur Ich-Form hätte also einen gesunden Zug verboten und
--   den kranken nicht getroffen.
--
-- ── DIE MEDIZIN: EIN WAHRNEHMUNGSHORIZONT, KEINE PERSONALFORM ──────────────
--
--   Belegt, und zwar mit der einzigen sauberen Messung zu genau dieser Frage:
--   perspektivgebundenes Gedächtnis (arXiv:2606.25632) erreicht **+34,6
--   Prozentpunkte Knowledge Boundary Fidelity** bei **~79 % Gewinnrate in der
--   Erzählqualität** — die Sichtbarkeitsgrenze je Figur senkt allwissende
--   Aussagen, OHNE die Prosa zu verflachen. Das ist die Gegenprobe zum
--   naheliegenden Einwand, eine engere Regel mache die Sprache steif.
--
--   Zwei Dinge, die eine flache Verbotsregel nicht hat und die hier stehen:
--
--   1. UNTERORDNUNG STATT VERBOT. Umgebungsbeschreibung ist erlaubt, soweit
--      sie die EIGENE Handlung trägt. Ein „erzähle nie die Szene" wäre in
--      einem Rollenspiel unbrauchbar; der Raum muss vorkommen dürfen.
--   2. MITTELBARER BERICHT ERLAUBT, URHEBERSCHAFT NICHT. „Sie hat nach der
--      Akte gefragt" darf sie sagen; was die andere als Nächstes tut, nicht.
--      Das ist die Godmodding-Regel des Forenrollenspiels aus den 1990ern:
--      Absicht ja, Ergebnis nein.
--
-- ── UND DIE FORM: KEINE VERBOTE ────────────────────────────────────────────
--
--   Praktiker-Konsens (rentry.org/modelimpersonation): ein „vermeide es, X zu
--   tun" bringe oft das Gegenteil, weil es dem Modell ein Muster beibringt,
--   auf das es sonst nicht käme. ⚠ Nicht gemessen, und es gibt Widerspruch.
--   Aber die Verbotsfassung ist zweimal ausgerollt worden und hat zweimal
--   nicht gehalten; die andere Form ist noch nicht versucht.
--
-- ── WAS HIER NICHT STEHT, WEIL ES IM CODE STEHT ────────────────────────────
--
--   DIE STELLE. Die Anweisung stand im System-Prompt, also an Position 0 vor
--   dem ganzen Verlauf — bei 373 Nachrichten mit zweihundert Zügen dazwischen.
--   Sie steht jetzt unmittelbar vor der Antwort
--   (`ChatAIService._append_closing_instruction`). Der Praktiker-Konsens dazu
--   trägt den einzigen quantifizierten Datenpunkt des ganzen Feldes: 37 von 40
--   sauberen Durchläufen mit der Regel an dieser Stelle.
--
--   ⚠ UND EINE EHRLICHE GRENZE. Der letzte Satz verlangt, dass eine Figur
--   erkennt, wann sie schweigen soll. Zwei Arbeiten von 2026 (arXiv:2603.11409,
--   arXiv:2605.05626) messen genau das und kommen zum selben Schluss:
--   kontextbewusstes Schweigen ist zero-shot NICHT vorhanden — Basismodelle
--   verpassen rund die HÄLFTE der richtigen Gelegenheiten. Diese Zeile wird
--   also nur teilweise wirken. Ein billiges Tor ausserhalb des Modells wäre
--   die verlässlichere Lösung und steht noch aus.

UPDATE prompt_templates
SET prompt_content = 'You are in a scene with: {other_agent_names}. One more voice is marked [User] – that is the human you are talking to.

You are one person in this scene, and your horizon ends where your senses do. Write what you do, say, notice and feel. You may describe the room and the others as far as your own action needs it: what they seem to be doing, how they look to you, what you make of it.

What another person thinks, decides, or does NEXT is theirs to write. You may report what has already happened indirectly ("she asked for the file"), but you never author their next move. Their lines reach you marked with their names; that mark identifies them and is not a format for your own text.

One action per turn. When the scene needs someone else to move, let it wait.

Respond to what has been said, and reference the mentioned events when they matter.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'en';

UPDATE prompt_templates
SET prompt_content = 'Du bist in einer Szene mit: {other_agent_names}. Eine weitere Stimme ist mit [User] markiert – das ist der Mensch, mit dem du sprichst.

Du bist eine Person in dieser Szene, und dein Horizont endet, wo deine Sinne enden. Schreibe, was du tust, sagst, bemerkst und fuehlst. Den Raum und die anderen darfst du beschreiben, soweit deine eigene Handlung es braucht: was sie zu tun scheinen, wie sie auf dich wirken, was du daraus machst.

Was ein anderer denkt, entscheidet oder als NAECHSTES tut, schreibt er selbst. Was schon geschehen ist, darfst du mittelbar berichten ("sie hat nach der Akte gefragt"), aber seinen naechsten Zug machst du nie fuer ihn. Seine Zeilen erreichen dich mit seinem Namen markiert; diese Marke kennzeichnet ihn und ist keine Vorlage fuer deinen eigenen Text.

Eine Handlung je Zug. Wenn die Szene verlangt, dass sich jemand anderes bewegt, lass sie warten.

Reagiere auf das Gesagte und beziehe dich auf die referenzierten Events, wenn sie relevant sind.',
    updated_at = now()
WHERE simulation_id IS NULL
  AND template_type = 'chat_group_instruction'
  AND locale = 'de';

-- ── Selbstprüfung ──────────────────────────────────────────────────────────
-- Gegen die eigene Wirkung. Die letzte Prüfung ist die interessante: KEIN
-- „niemals" mehr, und ausdruecklich auch KEINE Forderung nach der Ich-Form —
-- die waere die Fehldiagnose, die diese Fassung korrigiert.
DO $$
DECLARE
  v_platform int;
  v_gut      int;
  v_verbote  int;
  v_ichform  int;
BEGIN
  SELECT count(*) INTO v_platform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction';

  IF v_platform = 0 THEN
    RAISE NOTICE '367: keine Plattform-Vorlage vorhanden — UEBERSPRUNGEN, nicht bestanden.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_gut FROM prompt_templates
  WHERE simulation_id IS NULL
    AND template_type = 'chat_group_instruction'
    AND prompt_content LIKE '%{other_agent_names}%'
    AND prompt_content LIKE '%[User]%'
    AND (prompt_content LIKE '%horizon ends where your senses do%'
      OR prompt_content LIKE '%Horizont endet, wo deine Sinne enden%')
    AND (prompt_content LIKE '%as far as your own action needs it%'
      OR prompt_content LIKE '%soweit deine eigene Handlung es braucht%')
    AND (prompt_content LIKE '%One action per turn%'
      OR prompt_content LIKE '%Eine Handlung je Zug%')
    AND prompt_content NOT LIKE '%{{%';
  IF v_gut <> v_platform THEN
    RAISE EXCEPTION '367: nur % von % Vorlagen tragen Wahrnehmungshorizont, Unterordnung und Ein-Handlungs-Regel', v_gut, v_platform;
  END IF;

  SELECT count(*) INTO v_verbote FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%Never %' OR prompt_content LIKE '%niemals die%'
      OR prompt_content LIKE '%Schreibe niemals%');
  IF v_verbote > 0 THEN
    RAISE EXCEPTION '367: % Vorlage(n) tragen weiterhin ein flaches Verbot', v_verbote;
  END IF;

  SELECT count(*) INTO v_ichform FROM prompt_templates
  WHERE simulation_id IS NULL AND template_type = 'chat_group_instruction'
    AND (prompt_content LIKE '%first person%' OR prompt_content LIKE '%Ich-Form%');
  IF v_ichform > 0 THEN
    RAISE EXCEPTION '367: % Vorlage(n) verlangen die Ich-Form — das war die Fehldiagnose. Der Fehler ist der Geltungsbereich, nicht die Personalform', v_ichform;
  END IF;

  RAISE NOTICE '367: % Vorlage(n) als Wahrnehmungshorizont formuliert, ohne Verbote und ohne Personalform-Forderung.', v_platform;
END $$;
