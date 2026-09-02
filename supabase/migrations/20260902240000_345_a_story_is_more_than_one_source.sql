-- Migration 345: Eine Geschichte ist mehr als eine Quelle
--
-- Lücke 2 aus `handoff/schleuse-event-intake.md`. Die Sichtung soll GESCHICHTEN
-- zeigen statt Rohsignale: dieselbe Nachricht aus drei Quellen ist eine Zeile
-- mit drei Chips, nicht drei Zeilen.
--
-- ── WAS VORHER PASSIERTE, UND WARUM ES ZWEIMAL FALSCH WAR ───────────────────
--
-- `deduplicator.deduplicate_within_batch` verglich Titel NUR innerhalb
-- derselben Quelle:
--
--     if existing.source_name != result.source_name: continue
--
-- Ein Guardian-Artikel und ein Bluesky-Beitrag über dasselbe Beben wurden
-- deshalb nie zusammengeführt — beide wurden eigene Kandidaten. Genau das
-- verbietet der Bauplan („eine Sozialquelle wird nie eine eigene Zeile"), und
-- genau das war der Grund, warum die Regel bisher als „nicht anwendbar" galt:
-- sie stand da und wurde nicht durchgesetzt.
--
-- Zweitens WARF die Funktion die Duplikate weg. Damit ging die Auskunft
-- verloren, die den Wert einer Geschichte ausmacht: dass drei Quellen sie
-- melden und zweihundert Menschen darauf reagiert haben.
--
-- 🔑 Eine Entduplizierung, die wegwirft, verliert eine Aussage. Eine, die
-- bündelt, gewinnt eine.
--
-- ── DIE ZWEI SPALTEN ────────────────────────────────────────────────────────
--
-- `sources`         jsonb-Array `[{"name": "guardian", "count": 2}, …]`
--                   Enthält IMMER auch den Träger selbst — eine Geschichte ohne
--                   Quelle gibt es nicht. `count` zählt BEITRÄGE dieser Quelle,
--                   nicht Quellen: dass NOAA dieselbe Warnung dreimal absetzt,
--                   ist eine andere Auskunft als dass drei Dienste sie melden.
--
-- `social_volume`   Likes + Reposts der beitragenden Sozialquellen. Heute
--                   liefert nur Bluesky solche Zahlen. **0 heisst „keine
--                   gemessen", nicht „niemand hat reagiert"** — jede Anzeige
--                   muss den Unterschied machen können, deshalb NOT NULL mit
--                   Vorgabe 0 und keine Nullwerte.
--
-- ── DIE ALTEN 134 ZEILEN BEKOMMEN IHRE EIGENE QUELLE, MEHR NICHT ────────────
--
-- Sie entstanden, bevor gebündelt wurde. Welche anderen Quellen dieselbe
-- Geschichte gemeldet haben, steht nirgends und liesse sich nur über
-- Titelähnlichkeit RATEN — dieselbe unzuverlässige Verknüpfung, die schon bei
-- Lücke 7 verworfen wurde. Sie bekommen deshalb genau einen Eintrag, ihren
-- eigenen Adapter, und `social_volume` bleibt 0. Das ist wahr und
-- unvollständig; geraten wäre vollständig und falsch.

BEGIN;

ALTER TABLE public.news_scan_candidates
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS social_volume integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.news_scan_candidates.sources IS
  'Die Quellen, die dieselbe Geschichte gemeldet haben: [{"name","count"}]. Enthaelt immer auch den Traeger. Migration 345.';
COMMENT ON COLUMN public.news_scan_candidates.social_volume IS
  'Likes + Reposts der beitragenden Sozialquellen. 0 heisst "keine gemessen", nicht "niemand hat reagiert". Migration 345.';

-- Bestehende Zeilen: die eigene Quelle, sonst nichts.
UPDATE public.news_scan_candidates
   SET sources = jsonb_build_array(jsonb_build_object('name', source_adapter, 'count', 1))
 WHERE sources = '[]'::jsonb;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Geprueft wird die WIRKUNG dieser Migration, nicht der Bestand der Welt: dass
-- keine Zeile ohne Quelle dasteht und dass `social_volume` nirgends NULL ist.
-- Eine Zahl wie „134 Zeilen" gehoert in den Kommentar, nicht in die Bedingung —
-- sie waere ab der naechsten Zeile falsch.

DO $$
DECLARE
  ohne_quelle integer;
BEGIN
  SELECT count(*) INTO ohne_quelle
    FROM public.news_scan_candidates
   WHERE sources IS NULL OR jsonb_array_length(sources) = 0;
  IF ohne_quelle > 0 THEN
    RAISE EXCEPTION '% Kandidaten stehen ohne Quelle da — eine Geschichte ohne Quelle gibt es nicht', ohne_quelle;
  END IF;
END $$;

COMMIT;
