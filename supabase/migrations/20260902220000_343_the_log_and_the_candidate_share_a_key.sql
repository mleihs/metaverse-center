-- Migration 343: Protokoll und Kandidatenblatt teilen einen Schlüssel
--
-- Lücke 7 aus `handoff/schleuse-event-intake.md`. Das Scan-Protokoll soll je
-- Zeile sagen, was aus ihr geworden ist — in der Sichtung, im Eingang, in der
-- Quarantäne, als Ereignis, als Resonanz, gemeldet, verworfen. Beim Bauen des
-- Protokolls (Schritt 6) stellte sich heraus, dass das nicht geht:
--
--     news_scan_log          UNIQUE (source_name, source_id)   ← ein Schlüssel
--     news_scan_candidates   source_adapter, title, …          ← KEINE source_id
--
-- Übrig blieb der Titel. Ein Abgleich darüber lieferte auf Prod 149 Treffer bei
-- 222 Log-Zeilen und 83 Kandidaten — ein Kreuzprodukt über wiederholte
-- Überschriften, keine Identität. Die Spalte zeigt deshalb bis heute nur
-- „eingeordnet / aussortiert".
--
-- 🔑 Eine Verknüpfung über ein Feld, das kein Schlüssel IST, liefert
-- zuverlässig Zeilen — nur nicht die richtigen.
--
-- ── DIE NACHTRAGUNG IST ABSICHTLICH UNVOLLSTÄNDIG ───────────────────────────
--
-- Der Scanner schreibt beide Zeilen aus DEMSELBEN `ScanResult`, das die
-- `source_id` trägt — für alles Künftige ist der Schlüssel also echt. Für die
-- 134 Zeilen, die schon dastehen, gibt es ihn nicht, und er lässt sich nur
-- erraten.
--
-- Deshalb wird nur nachgetragen, wo das Paar (Quelle, Titel) im Protokoll
-- GENAU EINE Zeile trifft. Gemessen vor dem Lauf:
--
--     Kandidaten                    134
--     eindeutig zuordenbar          125
--     mehrdeutig (Titel mehrfach)     9   ← bleiben NULL
--     ohne Treffer                    0
--
-- Die neun bleiben leer, und das Protokoll sagt für sie schlicht nichts. Eine
-- Zuordnung zu raten, um eine Spalte voll zu bekommen, wäre genau der Fehler,
-- den diese Migration behebt.

BEGIN;

ALTER TABLE public.news_scan_candidates
  ADD COLUMN IF NOT EXISTS source_id text;

COMMENT ON COLUMN public.news_scan_candidates.source_id IS
  'Die Kennung der Quelle, wie news_scan_log sie fuehrt. Zusammen mit source_adapter der Schluessel zwischen Protokoll und Kandidat (Migration 343). NULL fuer Zeilen von vor dieser Migration, die sich nicht eindeutig zuordnen liessen.';

-- Nachtragen, wo (Quelle, Titel) genau EINE Protokollzeile trifft.
WITH eindeutig AS (
  SELECT source_name, title, min(source_id) AS source_id
    FROM public.news_scan_log
   GROUP BY source_name, title
  HAVING count(*) = 1
)
UPDATE public.news_scan_candidates c
   SET source_id = e.source_id
  FROM eindeutig e
 WHERE c.source_id IS NULL
   AND e.source_name = c.source_adapter
   AND e.title = c.title;

-- Der Index dient dem Blick VOM Protokoll AUF den Kandidaten, den das
-- Scan-Protokoll-Modal macht: gegeben (Quelle, Kennung), welchen Status hat sie?
CREATE INDEX IF NOT EXISTS idx_news_scan_candidates_source
  ON public.news_scan_candidates (source_adapter, source_id)
  WHERE source_id IS NOT NULL;

-- ── Selbstpruefung ─────────────────────────────────────────────────────────
--
-- Nicht „ist die Spalte da" — das sagt schon das ALTER. Geprueft wird, dass die
-- Nachtragung etwas getroffen hat UND dass sie nichts Mehrdeutiges getroffen
-- hat: eine (Quelle, Kennung) darf hoechstens EINEN Kandidaten benennen, sonst
-- waere der neue Schluessel keiner.

DO $$
DECLARE
  kandidaten integer;
  nachgetragen integer;
  doppelt integer;
BEGIN
  SELECT count(*) INTO kandidaten FROM public.news_scan_candidates;
  SELECT count(*) INTO nachgetragen
    FROM public.news_scan_candidates WHERE source_id IS NOT NULL;

  /*
   * ⚠ BERICHTIGT: die erste Fassung warf hier, wenn `nachgetragen = 0` — und
   * auf einer FRISCHEN Datenbank ist die Tabelle leer, es gibt also nichts
   * nachzutragen. Die Migration haette CI abgebrochen.
   *
   * Das ist dieselbe Bauart, die an einem Tag fuenfmal repariert wurde (299,
   * 305, 309, 311, 314), und ich habe sie in meiner eigenen 345 als vermieden
   * BESCHRIEBEN, waehrend sie hier stand. Gemeldet von `velgarien-rebuild-6e`.
   *
   * Die Regel: eine Selbstpruefung darf gegen ihre eigene WIRKUNG pruefen, nie
   * gegen den BESTAND der Plattform. Die Voraussetzung wird deshalb ehrlich,
   * die Zusicherung bleibt scharf — und NOTICE statt Schweigen, denn ein
   * ausgesetzter Test ist kein bestandener.
   */
  IF kandidaten = 0 THEN
    RAISE NOTICE 'Keine Kandidaten vorhanden — Nachtragsprobe ausgesetzt (frische Datenbank?)';
  ELSIF nachgetragen = 0 THEN
    RAISE EXCEPTION 'Die Nachtragung hat keine einzige Zeile getroffen — das Namenspaar stimmt nicht';
  END IF;

  SELECT count(*) INTO doppelt FROM (
    SELECT source_adapter, source_id
      FROM public.news_scan_candidates
     WHERE source_id IS NOT NULL
     GROUP BY source_adapter, source_id
    HAVING count(*) > 1
  ) d;
  IF doppelt > 0 THEN
    RAISE EXCEPTION '% Paare (Quelle, Kennung) benennen mehr als einen Kandidaten — kein Schluessel', doppelt;
  END IF;

  RAISE NOTICE 'source_id nachgetragen fuer % von % Kandidaten', nachgetragen, kandidaten;
END $$;

COMMIT;
