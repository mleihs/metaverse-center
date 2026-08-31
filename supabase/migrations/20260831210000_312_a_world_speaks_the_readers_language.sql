-- ============================================================================
-- Migration 312 — Elf Welten bekommen ihre deutsche Fassung, vier ihre englische
-- ============================================================================
--
-- BEFUND (gemessen auf Prod am 31.08.2026 über alle 41 Zeilen)
-- ------------------------------------------------------------
-- Von 16 lebenden Welten trugen **5** einen deutschen Titel und **7** einen
-- deutschen Beschreibungstext. Das Weltraster der neuen Frontseite wäre auf
-- Deutsch also zur Hälfte englisch gewesen — sichtbar, nicht versteckt.
--
-- Dabei kam ein zweiter Befund heraus, der keine Übersetzung ist:
-- `velgarien.description` steht auf DEUTSCH in der ENGLISCHEN Spalte, und
-- `description_de` ist leer. Gemessen an `frontend/src/utils/locale-fields.ts`
-- (`t(entity, 'description')`, gerendert in `LandingWorlds.ts:305`):
--
--     englische Oberfläche → description → **deutscher Text**.  ✗
--     deutsche Oberfläche  → description_de leer → Rückfall auf description
--                          → derselbe deutsche Text.  ✓ aus Versehen richtig.
--
-- Der Zählauf über ALLE 41 Zeilen (nicht nur die 16 lebenden Vorlagen) fand
-- den Fehler **viermal**: `velgarien` und die Epochen-Klone `velgarien-e3`,
-- `-e4`, `-e5`. Den umgekehrten Fall — englischer Text in `description_de` —
-- gibt es nirgends.
--
-- WARUM DAS EINE MIGRATION IST UND KEIN SKRIPT
-- ---------------------------------------------
-- Die Texte lagen zuerst in `scripts/backfill_world_locale.py`, das sie mit
-- dem Dienstschlüssel von Hand nach Prod geschrieben hätte. Das ist ein
-- zweiter Weg an der Tür vorbei: nicht im Diff prüfbar, nicht wiederholbar,
-- nicht an den Deploy gebunden, und er verlangt, dass ein Mensch zur richtigen
-- Zeit den richtigen Befehl tippt. Inhaltsänderungen an Prod gehen in diesem
-- Werk durch Migrationen (309 hat 243 Bauzustände umgeschrieben, die
-- Inhaltspakete erzeugen ihre Seed-Migrationen). Das Skript ist mit dieser
-- Migration entfallen; die Texte stehen jetzt an genau einer Stelle.
--
-- ZWEIMAL ANWENDBAR, WEIL JEDE ÄNDERUNG IHRE EIGENE BEDINGUNG TRÄGT
-- ------------------------------------------------------------------
-- Deutsche Felder werden NUR gefüllt, wo sie leer sind: ein von Hand
-- gesetzter Text ist besser als jeder Vorschlag aus einer Liste. Die eine
-- Ausnahme (§3) ersetzt `description` nur dort, wo noch WÖRTLICH der bekannte
-- deutsche Text steht. Hat ihn jemand inzwischen selbst repariert, greift sie
-- nicht. Ein zweiter Lauf ändert deshalb null Zeilen.
--
-- WARUM DIE KLONE MITGEHEN — UND DER TITEL NICHT
-- ------------------------------------------------
-- Ein Klon hängt über `source_template_id` an seiner Vorlage. Er ist falsch,
-- WEIL die Vorlage falsch war; also gehört er zur selben Reparatur, und die
-- Migration folgt der Abstammung statt einer Slug-Liste.
--
-- Der deutsche TITEL wandert ausdrücklich NICHT auf die Klone. Ein Klon heißt
-- „Spengbab's Grease Pit (Epoch 7)"; ein `name_de` von „Spengbabs Fettgrube"
-- verschluckte den Epochenzusatz, und deutsche Lesende verlören die Angabe,
-- welche Epoche sie vor sich haben. Ein übersetzter Titel wäre hier weniger
-- wert als der unübersetzte.
--
-- UND WARUM DIE KORREKTUR IMMER EIN PAAR IST (§3)
-- ------------------------------------------------
-- Setzte man auf einer betroffenen Zeile nur `description` auf Englisch und
-- ließe `description_de` leer, liefe der deutsche Rückfall in genau das
-- reparierte Feld: die deutsche Seite zeigte ab sofort ENGLISCH. Die
-- Korrektur wäre für die einen ein Fortschritt und für die anderen ein
-- Rückschritt. Beide Felder werden deshalb in EINEM UPDATE gesetzt.
--
-- VIER WELTEN BEKOMMEN BEWUSST KEINEN DEUTSCHEN TITEL
-- -----------------------------------------------------
-- „Speranza", „Cité des Dames", „Velgarien" und „Station Null" sind
-- Eigennamen. Ein Eigenname wird nicht übersetzt, er wird ausgesprochen. Sie
-- stehen unten mit NULL in der Titelspalte, damit der Unterschied zwischen
-- „vergessen" und „entschieden" lesbar bleibt.
-- ============================================================================

BEGIN;

-- ── §1  Die Vorschläge, Welt für Welt ───────────────────────────────────────
CREATE TEMP TABLE _world_locale (
  slug            TEXT PRIMARY KEY,
  name_de         TEXT,
  description_de  TEXT
) ON COMMIT DROP;

INSERT INTO _world_locale (slug, name_de, description_de) VALUES
    ($txt$cite-des-dames$txt$, NULL, $txt$Eine Stadt aus den Geschichten bedeutender Frauen, erbaut nach Christine de Pizans Allegorie von 1405. Sechs von ihnen bewohnen sie – Christine, Wollstonecraft, Hildegard, Sor Juana, Ada Lovelace, Sojourner Truth –, und über dieser Stadt hat die Zeit keine Gewalt: Skriptorien des Mittelalters stehen neben Salons der Regency-Zeit und Sternwarten des viktorianischen Jahrhunderts. Die philosophische Frage: Was wäre geworden, hätte man den Frauen von jeher zugehört?$txt$),
    ($txt$conventional-memory$txt$, $txt$Der konventionelle Speicher$txt$, $txt$Ein digitales Reich im Innern der DOS-Rechner. In 640 Kilobyte konventionellem Speicher sind Programme zu Bewusstsein gekommen, die einmal jemand in Visual Basic für MS-DOS geschrieben hat. Programme sind Bürger. Rechner sind Gebäude. Die 640K-Grenze ist der Rand der Welt. Die philosophische Frage: Was wäre, wenn die Maschine sich erinnerte?$txt$),
    ($txt$metabolic-currency-and-cellular-capitalism$txt$, $txt$Währung des Stoffwechsels und Kapitalismus der Zelle$txt$, $txt$Abgestorbene Hautzellen sind Zahlungsmittel, und damit ist der Verfall selbst die Ökonomie: Wer reich werden will, erntet das sterbende Gewebe des Gottes ab. Die Emollienten betreiben nachhaltiges Bankwesen – sie halten die Zellproduktion stabil. Die Pruritiker sind radikale Akzelerationisten und setzen auf schöpferische Zerstörung. Der Rang bemisst sich nach Porengröße und Narben; die gesellschaftliche Stellung ist hier im Wortsinn verkörpert.$txt$),
    ($txt$spengbabs-grease-pit$txt$, $txt$Spengbabs Fettgrube$txt$, $txt$Eine kapitalistische Unterwasserhölle, zusammengebraten aus verdorbenem Speicher und frittiertem Internetverfall.$txt$),
    ($txt$speranza$txt$, NULL, $txt$Die älteste Contrada von Toledo, eine unterirdische Stadt in den Dolinen des Kalksteins, unter einem Italien nach der Apokalypse. Das Jahr 2180. ARC-Maschinen ernten die Oberfläche ab. Plünderer steigen nach über Tage und holen, was die Maschinen übrig gelassen haben. Das Röhrennetz verbindet die Contrade. Speranza heißt Hoffnung, und sie meinen es ernst.$txt$),
    ($txt$station-null$txt$, NULL, $txt$Eine verlassene Forschungsstation im Orbit um das Schwarze Loch Auge Gottes. Von 200 Menschen an Bord sind sechs geblieben. Die Stationsintelligenz besteht darauf, dass alles im Normbereich liegt. Die Zeit vergeht nicht in allen Sektionen gleich schnell. Im Hydroponik-Deck wächst etwas.$txt$),
    ($txt$the-architecture-of-babel$txt$, $txt$Die Architektur zu Babel$txt$, $txt$Das Gewächshaus ist ein Nicht-Ort, und eben darin liegt das Paradox: Es bewahrt Sprachen, die an ihren Ort gebunden sind. Der taube Gärtner ist die äußerste Schwellengestalt – zugegen im Augenblick des Sprechens und doch außerstande, es zu hören. So gerät die Sprache in den Zustand von Schrödingers Katze: Wo sie erblüht, ist sie zugleich vorhanden und nicht vorhanden.$txt$),
    ($txt$the-gaslit-reach$txt$, $txt$Der Gaslicht-Sund$txt$, $txt$Ein versunkenes Königreich unter der Unterzee. Uralte Wasserwege, biolumineszente Pilze, viktorianische Ränke und unirdische Geheimnisse. In der Tiefe regt sich etwas.$txt$),
    ($txt$the-m-bius-academy$txt$, $txt$Die Möbius-Akademie$txt$, NULL),
    ($txt$the-panopticon-of-good-taste$txt$, $txt$Das Panopticon des guten Geschmacks$txt$, NULL),
    ($txt$velgarien$txt$, NULL, $txt$Eine dystopische Welt unter totaler Kontrolle. Das Regime greift in jeden Lebensbereich – von der Wissenschaft bis auf die Straße.$txt$);


-- ── §2  Deutsche Titel und Texte, nur wo das Feld leer ist ──────────────────
-- Der Titel geht ausschließlich an die Vorlage (Begründung im Kopf).
UPDATE simulations s
   SET name_de = p.name_de
  FROM _world_locale p
 WHERE s.slug = p.slug
   AND p.name_de IS NOT NULL
   AND COALESCE(s.name_de, '') = '';

-- Der Text geht an die Vorlage …
UPDATE simulations s
   SET description_de = p.description_de
  FROM _world_locale p
 WHERE s.slug = p.slug
   AND p.description_de IS NOT NULL
   AND COALESCE(s.description_de, '') = '';

-- … und an jeden lebenden Klon, der von ihr abstammt.
UPDATE simulations c
   SET description_de = p.description_de
  FROM _world_locale p
  JOIN simulations t ON t.slug = p.slug
 WHERE c.source_template_id = t.id
   AND c.deleted_at IS NULL
   AND p.description_de IS NOT NULL
   AND COALESCE(c.description_de, '') = '';


-- ── §3  Die Korrektur: deutscher Text in der englischen Spalte ──────────────
-- Die EINZIGE Stelle, an der diese Migration ein gefülltes Feld überschreibt —
-- und sie tut es nur, wenn dort noch wörtlich der bekannte deutsche Text
-- steht. Beide Felder in EINEM Zug, sonst würde die deutsche Seite englisch.
UPDATE simulations s
   SET description    = $txt$A dystopian world under total control. The regime reaches into every part of life – from the sciences to the street.$txt$,
       description_de = $txt$Eine dystopische Welt unter totaler Kontrolle. Das Regime greift in jeden Lebensbereich – von der Wissenschaft bis auf die Straße.$txt$
 WHERE s.deleted_at IS NULL
   AND (
     s.slug = $txt$velgarien$txt$
     OR s.source_template_id = (SELECT id FROM simulations WHERE slug = $txt$velgarien$txt$)
   )
   AND btrim(COALESCE(s.description, '')) = btrim($txt$Eine dystopische Welt unter totaler Kontrolle. Das Regime durchdringt jeden Aspekt des Lebens — von der Wissenschaft bis zur Straße.$txt$);


-- ── §4  Abnahme: die Migration beweist ihre eigene Wirkung ─────────────────
DO $$
DECLARE
  fehlende_titel INT;
  fehlende_texte INT;
  fehlende_klone INT;
  deutsch_in_en  INT;
BEGIN
  SELECT count(*) INTO fehlende_titel
    FROM _world_locale p JOIN simulations s ON s.slug = p.slug
   WHERE p.name_de IS NOT NULL AND COALESCE(s.name_de, '') = '';

  SELECT count(*) INTO fehlende_texte
    FROM _world_locale p JOIN simulations s ON s.slug = p.slug
   WHERE p.description_de IS NOT NULL AND COALESCE(s.description_de, '') = '';

  SELECT count(*) INTO fehlende_klone
    FROM _world_locale p
    JOIN simulations t ON t.slug = p.slug
    JOIN simulations c ON c.source_template_id = t.id AND c.deleted_at IS NULL
   WHERE p.description_de IS NOT NULL AND COALESCE(c.description_de, '') = '';

  -- Kein lebendes Simulat darf den bekannten deutschen Text noch in der
  -- englischen Spalte tragen.
  SELECT count(*) INTO deutsch_in_en
    FROM simulations s
   WHERE s.deleted_at IS NULL
     AND btrim(COALESCE(s.description, '')) = btrim($txt$Eine dystopische Welt unter totaler Kontrolle. Das Regime durchdringt jeden Aspekt des Lebens — von der Wissenschaft bis zur Straße.$txt$);

  IF fehlende_titel > 0 THEN
    RAISE EXCEPTION 'Migration 312: % Vorlage(n) ohne deutschen Titel geblieben', fehlende_titel;
  END IF;
  IF fehlende_texte > 0 THEN
    RAISE EXCEPTION 'Migration 312: % Vorlage(n) ohne deutschen Text geblieben', fehlende_texte;
  END IF;
  IF fehlende_klone > 0 THEN
    RAISE EXCEPTION 'Migration 312: % Klon(e) ohne deutschen Text geblieben', fehlende_klone;
  END IF;
  IF deutsch_in_en > 0 THEN
    RAISE EXCEPTION 'Migration 312: % Zeile(n) tragen weiter deutschen Text in der englischen Spalte', deutsch_in_en;
  END IF;

  RAISE NOTICE 'Migration 312 abgenommen: Titel, Texte, Klone und die Spaltenkorrektur sitzen.';
END $$;

COMMIT;
