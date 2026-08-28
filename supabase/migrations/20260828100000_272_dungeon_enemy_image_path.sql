-- ============================================================================
-- Migration 272: dungeon_enemy_templates.image_path
-- ============================================================================
-- Rollout-Phase 3a des grafischen Dungeon-Modus (docs/plans/graphical-dungeon-
-- rollout.md). Die Gegner standen in der Szene bisher als clip-path-Silhouetten
-- (FOE_GEOMETRY), weil es keine Kreatur-Assets gab. Die 42 Assets existieren
-- inzwischen (docs/plans/dungeon-enemy-asset-manifest.md); diese Spalte ist der
-- Weg, auf dem die Zuordnung Kreatur → Bild aus dem Content-Pack bis in die
-- Szene kommt.
--
-- BUCKET-RELATIVER PFAD, KEINE URL. Der Wert lautet z. B.
-- 'dungeon-enemies/shadow_wisp-384.avif' und wird erst beim Rendern gegen die
-- Storage-Basis der jeweiligen Umgebung gesetzt. Eine vollqualifizierte URL
-- würde die Prod-Projekt-Ref in eine eingecheckte Seed-Migration backen, die
-- ebenso gegen das lokale Supabase (127.0.0.1:54321) und gegen CI läuft.
--
-- NULLABLE OHNE DEFAULT und bewusst ohne Backfill: NULL heißt "diese Kreatur
-- hat noch kein Bild", und genau darauf fällt die grafische Ansicht auf ihre
-- Silhouette zurück. Die Werte kommen NICHT aus dieser Migration, sondern aus
-- dem Content-Pack (A1.5): content/dungeon/archetypes/*/enemies.yaml →
-- validate_content_packs → generate_migration. Diese Migration öffnet nur die
-- Spalte; die Seed-Migration daneben füllt sie und bleibt die einzige Quelle.
--
-- Reihenfolge beim Deploy: diese Migration MUSS vor der Seed-Migration laufen,
-- sonst schlägt deren INSERT an der unbekannten Spalte fehl. Die zeitbasierte
-- Dateibenennung stellt das sicher (272 < 273).
--
-- Keine View über dungeon_enemy_templates (geprüft), also kein CREATE OR
-- REPLACE VIEW nötig. RLS-Policy ist tabellenweit (public read) und von einer
-- zusätzlichen Spalte unberührt.
-- ============================================================================

ALTER TABLE dungeon_enemy_templates
    ADD COLUMN IF NOT EXISTS image_path TEXT;

COMMENT ON COLUMN dungeon_enemy_templates.image_path IS
    'Bucket-relativer Objektpfad der Kreatur-Szenengrafik in simulation.assets '
    '(z. B. dungeon-enemies/shadow_wisp-384.avif). NULL = kein Asset, die '
    'grafische Ansicht rendert dann die clip-path-Silhouette. Gepflegt über das '
    'Content-Pack (content/dungeon/archetypes/*/enemies.yaml), nie direkt.';
