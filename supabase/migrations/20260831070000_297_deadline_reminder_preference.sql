-- Migration 297: Die Frist-Erinnerung bekommt einen eigenen Schalter.
--
-- Handoff P2.17. Das System zieht RP ab und übergibt den Platz an eine KI,
-- OHNE vorher zu warnen — der Spieler erfährt von der Strafe erst im nächsten
-- Lagebericht, wenn sie schon eingetreten ist.
--
-- Die Erinnerung schließt diese Lücke und braucht deshalb einen Schalter:
--   * Standard `true`. Wer die Strafe nicht kennt, kann sie nicht vermeiden,
--     und eine Warnung, die man erst einschalten muss, warnt niemanden.
--   * Abbestellbar, im Gegensatz zu Sicherheitsmails: sie ist an einen Zyklus
--     gebunden und damit Massenpost im Sinne von RFC 8058. Sie taucht deshalb
--     auch in `UNSUBSCRIBE_CATEGORIES` auf.
--
-- Die Häufigkeit deckelt nicht diese Spalte, sondern `email_log` (Migr. 291):
-- höchstens eine Erinnerung je Nutzer und Zyklus, nachgeschlagen statt gezählt.

BEGIN;

ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS deadline_reminder BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.deadline_reminder IS
    'Erinnerung T-2 Std. vor der Zyklusauflösung, wenn noch Befehle offen sind. '
    'Standard true: eine Warnung, die man erst einschalten muss, warnt niemanden.';

COMMIT;
