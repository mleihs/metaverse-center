-- ============================================================================
-- 320 · Ein Wort ohne Sprosse ist ein Wort, das nicht fallen kann
-- ============================================================================
--
-- WAS DER FALL WAR
--
-- 17 Bauten in 6 lebenden Welten verfielen nicht. `fn_degrade_building` meldete
-- für sie `condition_off_ladder`: Sabotage und Krisenereignisse liefen an ihnen
-- vorbei. Betroffen unter anderem der Statische Raum in Velgarien (`sealed`),
-- Room 441 (`anomalous`), das Skriptorium in Cité des Dames (`illuminated`).
--
-- Die naheliegende Erklärung wäre gewesen: der Generator erfindet Wörter, die
-- niemand kennt. Gemessen auf Prod stimmt das nicht. Die Taxonomiezeilen
-- EXISTIEREN — alle, aktiv, beschriftet, in beiden Sprachen, teilweise seit
-- März 2026:
--
--     anomalous     {"de":"Anomal",         "en":"Anomalous"}
--     sealed        {"de":"Versiegelt",     "en":"Sealed"}
--     illuminated   {"de":"Illuminiert",    "en":"Illuminated"}
--     compromised   {"de":"Kompromittiert", "en":"Compromised"}
--     …
--
-- Achtzehn Welten haben sich dieses Vokabular gegeben. Was fehlte, war die EINE
-- ZAHL, die ein Wort an die Leiter bindet.
--
-- WARUM ES DIE ZAHL IST UND NICHT `sort_order`
--
-- `fn_building_condition_ladder(p_simulation_id)` baut die Leiter aus zwei
-- Quellen: den Kernsprossen, die eine Welt selbst führt, PLUS jedem eigenen
-- Wert, den sie über `metadata->>'rung'` auf eine Sprosse gesetzt hat.
-- `sort_order` ist die Reihenfolge in der OBERFLÄCHE und geht in die Leiter
-- nicht ein — eine Migration, die `sort_order` schreibt, wäre wirkungslos
-- geblieben und hätte wie eine Reparatur ausgesehen.
--
-- Der Mechanismus war also da und wurde **null Mal** benutzt:
--
--     select count(*) from simulation_taxonomies
--      where taxonomy_type = 'building_condition' and metadata ? 'rung';
--     → 0
--
-- Ein gebauter Weg, den niemand geht, ist von einem fehlenden Weg nicht zu
-- unterscheiden, solange niemand nach ihm fragt.
--
-- WARUM 193 ZEILEN UND NICHT 14
--
-- Nur 14 Paare (Welt × Wort) werden heute von einem Bau getragen. Aber dieselben
-- Wörter stehen in 18 Welten bereit, und `critical` und `makeshift` trägt noch
-- gar kein Bau. Wer nur die 14 einhängt, repariert die Symptome und lässt die
-- Ursache stehen: der nächste Bau, der `makeshift` bekommt, fällt genauso
-- heraus. Deshalb bekommt jedes Wort seine Sprosse, auch wo es noch leer steht.
--
-- DIE SPROSSEN — eine inhaltliche Entscheidung, vom Nutzer bestätigt
--
-- Die Kernleiter arbeitet in Zehnerschritten (pristine 5 · excellent 10 ·
-- good 20 · fair 30 · poor 40 · ruined 50). Die Lücken sind absichtlich da;
-- die neuen Sprossen schieben sich hinein, ohne einen Kernwert zu verschieben.
--
--      5  pristine      (Kern)
--      8  illuminated   gesteigert, über „ausgezeichnet"
--     10  excellent     (Kern)
--     12  restored      wiederhergestellt heisst: wie neu
--     15  preserved     erhalten, nicht erneuert
--     20  good          (Kern)
--     22  thriving      blühend — misst Handel, nicht Substanz
--     24  restricted    Zugang beschränkt, Substanz gut
--     26  functional    „funktioniert" ist kein Lob
--     28  operational   in Betrieb, halb versunken
--     30  fair          (Kern)
--     32  obsolete      veraltet, aber in Betrieb („Der Älteste summt")
--     34  anomalous     nicht kaputt, sondern nicht erklärbar
--     36  sealed        versiegelt
--     38  makeshift     behelfsmässig errichtet
--     40  poor          (Kern)
--     42  compromised   nach einem Vorfall
--     45  critical      eine Sprosse über der Ruine
--     50  ruined        (Kern)
--
-- ⚠ WAS DIESE MIGRATION BEWUSST IN KAUF NIMMT
--
-- `fn_degrade_building` ÜBERSCHREIBT `building_condition`. Vier dieser Wörter
-- (`anomalous`, `sealed`, `restricted`, `compromised`) sagen nicht, wie
-- abgenutzt ein Ort ist, sondern was er IST oder wer hinein darf. Sie auf eine
-- Verschleissleiter zu hängen heisst: der Statische Raum hört beim ersten
-- Verfallstick auf, versiegelt zu heissen. Dem Nutzer wurde genau das als
-- Entscheidung vorgelegt und so entschieden — Vorrang hat, dass alle Bauten
-- denselben Regeln folgen und keine Sonderfälle entstehen.
--
-- Der Befund dahinter gehört auf die Liste, nicht in diese Migration:
-- `building_condition` trägt zwei Achsen (Verschleiss und Wesen/Zugang), und
-- der Bau-Generator schreibt in beide. Notiert in `handoff/TODO-offen.md`.
--
-- KEINE ZEILE WIRD ANGELEGT ODER UMBENANNT. Die Migration setzt ausschliesslich
-- `metadata.rung`, und nur dort, wo noch keine steht — eine Welt, die später
-- ihre eigene Sprosse setzt, behält sie.
-- ============================================================================

BEGIN;

WITH sprossen(value, rung) AS (
  VALUES
    ('illuminated',  8),
    ('restored',    12),
    ('preserved',   15),
    ('thriving',    22),
    ('restricted',  24),
    ('functional',  26),
    ('operational', 28),
    ('obsolete',    32),
    ('anomalous',   34),
    ('sealed',      36),
    ('makeshift',   38),
    ('compromised', 42),
    ('critical',    45)
)
UPDATE simulation_taxonomies t
   SET metadata = coalesce(t.metadata, '{}'::jsonb)
                  || jsonb_build_object('rung', s.rung)
  FROM sprossen s
 WHERE t.taxonomy_type = 'building_condition'
   AND t.value = s.value
   AND NOT (coalesce(t.metadata, '{}'::jsonb) ? 'rung');

COMMIT;
