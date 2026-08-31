-- ============================================================================
-- Migration 315 — Der Titel sagte „Panopticon", der Text sagte „Panoptikum"
-- ============================================================================
--
-- BEFUND — UND ER IST SELBST VERURSACHT
-- --------------------------------------
-- Migration 312 hat `the-panopticon-of-good-taste` den deutschen Titel
-- **„Das Panopticon des guten Geschmacks"** gegeben. Begründung damals: die
-- Welt beruft sich ausdrücklich auf Foucault, und die deutsche Foucault-Ausgabe
-- behält Benthams „Panopticon" bei; „Panoptikum" ist im Deutschen das
-- Wachsfigurenkabinett.
--
-- Der deutsche BESCHREIBUNGSTEXT stand schon vorher da und sagt zweimal
-- „Panoptikum". 312 hat ihn nicht angefasst — nach der eigenen Regel, gefüllte
-- Felder nicht zu überschreiben. Die Regel ist richtig, ihre Folge hier nicht:
-- auf derselben Seite steht seither ein Titel und ein Text, die einander
-- widersprechen. Wer das anrichtet, räumt es auf.
--
-- WAS AM TEXT SONST NOCH FALSCH IST
-- ----------------------------------
-- Er ist eine maschinennahe Übersetzung des englischen Originals:
--
--   „ambiantes Licht"        ein Gallizismus; deutsch: Umgebungslicht
--   „Panoptikum" ×2          Wachsfigurenkabinett statt Foucault
--   Geviertstriche (—) ×3    im Deutschen ist der Gedankenstrich ein
--                            Halbgeviertstrich (–)
--   „des Shard" / „dieses Shard"  ein englisches Wort ohne deutschen Kasus;
--                            die deutsche Oberfläche sagt durchweg „Welt"
--   „Beobachtet-Werden"      Bindestrich-Substantivierung
--   „Eine Welt, die … ist, ist nicht neutral"   doppeltes „ist"
--   „Notausstiegsluke"       für „escape hatch"; deutsch: Ausgang
--
-- Der neue Text ist auf Deutsch geschrieben und nicht gewendet: Satzbau
-- umgebaut, Fachbegriffe erhalten (Bourdieu, Colomina, skopisches Regime,
-- Mies van der Rohe, Noguchi), Register unverändert theoretisch.
--
-- FAIL-CLOSED
-- -----------
-- Ersetzt wird NUR, wo noch wörtlich der bekannte alte Text steht. Hat ihn
-- jemand inzwischen selbst verbessert, passiert nichts. Zweimal anwendbar.
-- ============================================================================

BEGIN;

UPDATE simulations
   SET description_de = $txt$Dieser Anker trägt Bourdieus Grundsatz – dass Geschmack nicht unschuldig ist, dass jedes ästhetische Urteil auch ein gesellschaftliches ist – in das bauliche Gefüge einer Welt. Wo der Designkanon der Jahrhundertmitte alles durchdringt, ist nichts neutral: Er schreibt einen ganz bestimmten Konsens darüber fest, was gute Form sei, was richtige Proportion, was angemessenes Material. Colominas Befund, dass die Moderne im Kern ein skopisches Regime ist – ein System des geordneten Schauens –, gibt dem einen Raum: Mies van der Rohes Glaswände lassen nicht nur Licht herein, sie machen das Wohnen zur Aufführung. Im monumentalen Maßstab – Stühle, größer als der Mensch, Straßenlaternen als architektonische Ereignisse – hört das gestaltete Ding auf, dem Menschen zu dienen, und beginnt, ihn zu rahmen: Es macht ihn zur Figur in der eigenen Komposition. Dass es keine Autos und keine Ketten gibt, ist nicht nur ökologische Tugend, sondern die Beseitigung jenes visuellen Lärms, der von der ästhetischen Geschlossenheit ablenken könnte. Foucaults Panopticon brauchte einen Turm und einen Wächter; dieses hier braucht nur einen Couchtisch von Noguchi und genug Umgebungslicht. Der Gegendruck – der einzige Ausgang – liegt in den kleinen Werkstätten: Orte, an denen gemacht und nicht konsumiert wird, an denen niemand zusieht, und die einen für einen Augenblick aus der Zucht der vollendeten Form entlassen.$txt$
 WHERE slug = $txt$the-panopticon-of-good-taste$txt$
   AND btrim(COALESCE(description_de, '')) = btrim($txt$Dieser Anker entfaltet Bourdieus zentrales Argument — dass Geschmack nicht unschuldig ist, dass ästhetisches Urteil immer auch soziales Urteil ist — im physischen Gefüge des Shard. Eine Welt, die vom Designkanon der Mitte des Jahrhunderts durchdrungen ist, ist nicht neutral: Sie kodiert einen sehr spezifischen kulturellen Konsens darüber, was gute Form, richtige Proportion und angemessene Materialität ausmacht. Colominas Erkenntnis, dass modernistische Architektur im Grunde ein skopisches Regime ist (ein System organisierten Schauens), verleiht dem eine räumliche Dimension: Mies van der Rohes Glaswände lassen nicht nur Licht herein, sie machen das Bewohnen zur Aufführung. In monumentalem Maßstab — Stühle, die größer sind als menschliche Körper, Straßenlaternen, die zu architektonischen Ereignissen werden — hört das gestaltete Objekt auf, dem Menschen zu dienen, und beginnt, ihn zu rahmen, ihn zur Figur in seiner Komposition zu machen. Die Abwesenheit von Autos und Ketten ist nicht nur ökologische Tugend; sie ist auch die Beseitigung visuellen Rauschens, das von der ästhetischen Totalität ablenken könnte. Foucaults Panoptikum benötigte einen Turm und einen Wächter; das Panoptikum dieses Shard benötigt nur einen Noguchi-Couchtisch und ausreichend ambiantes Licht. Die Gegenspannung des Shard — seine Notausstiegsluke — liegt in den kleinen Handwerksläden: Räume, in denen das Machen, nicht das Konsumieren oder Beobachtet-Werden, einen temporären Ausgang aus der visuellen Disziplin vollendeter Form bietet.$txt$);

DO $$
DECLARE
  widerspruch INT;
  gallizismus INT;
  geviert     INT;
BEGIN
  SELECT count(*) INTO widerspruch FROM simulations
   WHERE slug = 'the-panopticon-of-good-taste' AND description_de LIKE '%Panoptikum%';
  SELECT count(*) INTO gallizismus FROM simulations
   WHERE slug = 'the-panopticon-of-good-taste' AND description_de LIKE '%ambiante%';
  SELECT count(*) INTO geviert FROM simulations
   WHERE slug = 'the-panopticon-of-good-taste' AND description_de LIKE '%' || chr(8212) || '%';

  IF widerspruch > 0 THEN
    RAISE EXCEPTION 'Migration 315: der Text sagt weiter „Panoptikum", der Titel „Panopticon"';
  END IF;
  IF gallizismus > 0 THEN
    RAISE EXCEPTION 'Migration 315: „ambiantes Licht" steht noch da';
  END IF;
  IF geviert > 0 THEN
    RAISE EXCEPTION 'Migration 315: Geviertstriche im deutschen Text';
  END IF;

  RAISE NOTICE 'Migration 315 abgenommen: Titel und Text sagen dasselbe Wort.';
END $$;

COMMIT;
