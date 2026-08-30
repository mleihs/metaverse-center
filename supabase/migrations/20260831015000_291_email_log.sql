-- ═══════════════════════════════════════════════════════════════════════════
-- 291 — Ein Versandprotokoll: damit „es kam keine Mail" beantwortbar wird
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM (Befund B15 der Systempruefung, Punkt 25 des Mail-Handoffs)
-- -----------------------------------------------------------------
-- Die Plattform verschickt Post ueber Resend (primaer) und SMTP (Rueckfall).
-- Resend ist SEND-ONLY: dort gibt es keine Versandliste, die man nachschlagen
-- koennte. Im Backend blieb vom Versand genau eine Logzeile uebrig, und Logs
-- rotieren.
--
-- Die Folge ist keine Unbequemlichkeit, sondern eine Luecke in der Mechanik:
--
--   * „Ich habe keine Mail bekommen" war bisher unbeantwortbar. Nicht schwer
--     zu beantworten — unbeantwortbar. Es gab keinen Ort, an dem die Antwort
--     stehen koennte.
--   * Zwei geplante Vorlagen brauchen Idempotenz, nicht Komfort: die
--     Fristerinnerung (T-2 Std.) und der Einladungs-Nachfass (T-24 Std.)
--     duerfen GENAU EINMAL zugestellt werden. Ohne eine Zeile, die sagt „ist
--     raus", schickt jeder Scheduler-Lauf sie erneut.
--   * Eine Haeufigkeitsgrenze pro Tag laesst sich ohne Zaehlbasis nicht
--     ziehen. Ein aktiver Spieler kann bei Acht-Stunden-Zyklen auf zwoelf
--     Mails am Tag kommen.
--
-- WAS
-- ---
-- Eine Zeile je Zustellversuch, erfolgreich oder nicht. `ok = false` ist
-- ausdruecklich Teil des Protokolls: ein Versand, der fehlschlug, ist die
-- Antwort auf die Frage oben, nicht ihr Fehlen.
--
-- Die Tabelle ist ein Protokoll und keine Warteschlange: nichts liest sie, um
-- zu entscheiden, OB gesendet wird — ausser den beiden Idempotenz-Faellen
-- oben, und die fragen nach einer bereits geschriebenen Zeile.
--
-- ZUGRIFF
-- -------
-- RLS an, KEINE Richtlinie. Damit ist die Tabelle ausschliesslich ueber den
-- service_role-Client erreichbar. Das ist Absicht: sie enthaelt
-- E-Mail-Adressen, und sie wird von `EmailService` geschrieben, der ohnehin
-- ohne Sitzung laeuft. Kein Grant an `anon` oder `authenticated` — siehe die
-- Regel in CLAUDE.md und die Sweep-Migrationen 257/258.

CREATE TABLE IF NOT EXISTS public.email_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_email   TEXT NOT NULL,
    template          TEXT NOT NULL,
    subject           TEXT,
    epoch_id          UUID REFERENCES public.game_epochs(id) ON DELETE SET NULL,
    simulation_id     UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
    cycle_number      INTEGER,
    transport         TEXT NOT NULL,
    message_id        TEXT,
    ok                BOOLEAN NOT NULL,
    error             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_log IS
    'Ein Datensatz je Zustellversuch. Beantwortet "kam die Mail an?", traegt die '
    'Idempotenz von Erinnerung und Nachfass und die Grundlage einer Tagesgrenze. '
    'service_role only.';
COMMENT ON COLUMN public.email_log.transport IS 'resend | smtp | none (kein Transport konfiguriert)';
COMMENT ON COLUMN public.email_log.ok IS
    'Fehlversuche werden bewusst mitprotokolliert: ein fehlgeschlagener Versand '
    'ist die Antwort auf "ich habe nichts bekommen", nicht ihr Fehlen.';

-- Idempotenz-Nachschlag: „ist diese Sorte fuer diesen Nutzer in diesem Zyklus
-- schon rausgegangen?" Bewusst KEIN UNIQUE-Index — ein zweiter Versuch nach
-- einem Fehlschlag muss erlaubt bleiben, und die Entscheidung darueber gehoert
-- in die Anwendung, nicht in eine Zwangsbedingung, die einen Retry abwuergt.
CREATE INDEX IF NOT EXISTS idx_email_log_idempotency
    ON public.email_log (recipient_user_id, template, epoch_id, cycle_number)
    WHERE recipient_user_id IS NOT NULL;

-- Tagesgrenze und Auswertung.
CREATE INDEX IF NOT EXISTS idx_email_log_recipient_time
    ON public.email_log (recipient_user_id, created_at DESC)
    WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_log_created_at
    ON public.email_log (created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Keine Richtlinie und keine Grants: nur der service_role-Client kommt heran.
REVOKE ALL ON public.email_log FROM anon, authenticated;
