-- 349 — Ein Gespräch darf unter Verschluss
--
-- Manche Unterhaltungen sollen nicht schon dadurch offenliegen, dass jemand
-- neben dem Bildschirm steht. `locked` ist genau dafür da — und für nichts
-- anderes.
--
-- ⚠ WAS DIESE SPALTE NICHT IST: sie ist KEIN zweites Passwort auf die Daten.
-- Die Zeile bleibt für ihren Besitzer lesbar wie zuvor (RLS unverändert:
-- `user_id = auth.uid()`), und wer ein gültiges Token hat, kann die
-- Nachrichten über die API weiterhin holen. Der Schutz ist ein SICHTSCHUTZ
-- gegen Mitleser am Gerät, kein kryptografischer. Das gehört so
-- aufgeschrieben, damit niemand später eine Zusicherung daraus liest, die
-- nicht drinsteht — wer Verschlüsselung braucht, braucht eine andere Bauart
-- (Passphrase, die den Inhalt selbst verschlüsselt; dann kann auch der
-- service_role-Schlüssel ihn nicht mehr lesen).
--
-- Serverseitig durchgesetzt wird nur das UMLEGEN des Schalters: der Endpunkt
-- verlangt das Kontopasswort im selben Aufruf. Das Ansehen zu verwehren ist
-- Sache der Oberfläche.

BEGIN;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.chat_conversations.locked IS
  'Sichtschutz vor Mitlesern am Geraet. Kein Datenschutz gegen jemanden mit '
  'gueltigem Token — RLS ist unveraendert. Umlegen verlangt das Kontopasswort.';

-- Die Liste filtert danach; ohne Index waere das ein Seq-Scan je Aufruf.
-- Partiell, weil nur die WENIGEN gesperrten interessant sind.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_locked
  ON public.chat_conversations (user_id)
  WHERE locked;

DO $$
DECLARE
  spalte integer;
  gesperrt integer;
BEGIN
  SELECT count(*) INTO spalte
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'chat_conversations'
     AND column_name = 'locked';

  -- Die Zusicherung prueft die eigene WIRKUNG, nicht den Bestand: dass die
  -- Spalte da ist, gilt auf einer frischen Datenbank genauso wie auf Prod.
  IF spalte <> 1 THEN
    RAISE EXCEPTION 'Spalte locked wurde nicht angelegt';
  END IF;

  SELECT count(*) INTO gesperrt FROM public.chat_conversations WHERE locked;
  IF gesperrt <> 0 THEN
    RAISE EXCEPTION
      '% Gespraeche stehen direkt nach der Einfuehrung auf gesperrt — der Vorgabewert stimmt nicht',
      gesperrt;
  END IF;

  RAISE NOTICE 'locked angelegt, Vorgabe false, % Zeilen unberuehrt',
    (SELECT count(*) FROM public.chat_conversations);
END $$;

COMMIT;
