-- ============================================================================
-- 321 · Ein Bau darf nicht in ein gesünderes Wort verfallen
-- ============================================================================
--
-- Korrektur an Migration 320, gefunden beim Ablesen der KETTE statt der Tabelle.
--
-- 320 hat `thriving` auf Sprosse 22 gesetzt, knapp unter `good` (20). In der
-- Tabelle sah das richtig aus — „blühend" war dort als „ungefähr gut" notiert.
-- In der Leiter gelesen ergibt es einen Satz, der nicht stimmen kann:
--
--     fn_building_condition_step(Velgarien, 'good', 1)  →  'thriving'
--
-- Ein Bau in gutem Zustand verfällt und ist danach BLÜHEND. Verfall darf nie zu
-- einem Wort führen, das gesünder klingt als das vorige; sonst liest der
-- Spielende die Mechanik als kaputt, und er hätte recht.
--
-- `thriving` gehört über `good`: ein blühender Ort ist mehr als ein guter.
-- Sprosse 18, zwischen `preserved` (15) und `good` (20).
--
--     vorher   excellent → preserved → good → thriving → restricted → …
--     nachher  excellent → preserved → thriving → good → restricted → …
--
-- WARUM DAS DIE EINZIGE STELLE IST
-- Die vollständige Kette wurde danach in allen 36 lebenden Welten abgelesen
-- (sie ist überall dieselbe) und Sprosse für Sprosse auf denselben Fehler
-- geprüft. `good → restricted`, `fair → anomalous` und `poor → compromised`
-- lesen sich absteigend; nur `good → thriving` las sich aufwärts.
--
-- 🔑 Die Lehre für die nächste Taxonomie-Migration: eine Sprossenzuordnung ist
-- nicht in der Tabelle zu prüfen, in der man sie schreibt, sondern in der KETTE,
-- die daraus entsteht. Jedes Paar für sich war plausibel; erst die Reihenfolge
-- zeigte den Widerspruch.
--
-- Diese Migration ÜBERSCHREIBT die Sprosse bewusst (320 setzte nur, wo keine
-- stand) — sie korrigiert einen Wert, den 320 selbst geschrieben hat.
-- ============================================================================

BEGIN;

UPDATE simulation_taxonomies
   SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('rung', 18)
 WHERE taxonomy_type = 'building_condition'
   AND value = 'thriving'
   AND (metadata ->> 'rung') = '22';

COMMIT;
