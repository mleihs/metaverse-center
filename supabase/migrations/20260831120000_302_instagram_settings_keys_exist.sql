-- ============================================================================
-- Migration 302 — Zwei Einstellungen, die gelesen, aber nie angelegt wurden
-- ============================================================================
--
-- BEFUND (aus dem Tor zu D10-3, 31.08.2026)
-- -----------------------------------------
-- Beim Bau von `backend/tests/unit/test_platform_settings_keys_exist.py` — dem
-- Tor, das jeden im Code gelesenen `platform_settings`-Schlüssel gegen die
-- Migrationen hält — fielen zwei weitere Schlüssel derselben Bauart auf:
--
--   instagram_trending_tags   ← instagram_content_service.py:213
--   instagram_blocklist       ← instagram_content_service.py:1028
--
-- Beide werden gelesen, beide legt keine Migration und kein Seed an. Auf Prod
-- gemessen (31.08.2026): 17 `instagram_*`-Schlüssel vorhanden,
-- `instagram_blocklist` steht auf `[]` — von Hand angelegt, ohne Migration —
-- und `instagram_trending_tags` fehlt vollständig.
--
-- WAS DAS BEDEUTET
-- ----------------
-- CLAUDE.md führt den „trending tag slot" als Teil der Hashtag-Strategie
-- (5 Tags, variiert je Post, ein Platz für einen Trend-Tag). Dieser Platz ist
-- auf jedem je erzeugten Beitrag leer geblieben, und zwar geräuschlos: der
-- Lesepfad fängt jeden Fehlschlag ab und meldet ihn mit `logger.debug`. Ein
-- fehlender Schlüssel und ein leerer Schlüssel sehen im Betrieb identisch aus.
--
-- WAS DIESE MIGRATION TUT — UND WAS NICHT
-- ---------------------------------------
-- Sie legt beide Zeilen mit dem Wert an, den der Code heute schon als Vorgabe
-- benutzt: die leere Liste. Das VERHALTEN ändert sich dadurch um nichts. Was
-- sich ändert, ist die Sichtbarkeit — die Schlüssel existieren, tragen eine
-- Beschreibung und sind damit in der Admin-Oberfläche auffindbar und
-- redigierbar. Ein Trend-Tag ist eine redaktionelle Entscheidung; diese
-- Migration trifft sie ausdrücklich NICHT, sie stellt nur den Ort her, an dem
-- sie getroffen werden kann.
--
-- `ON CONFLICT DO NOTHING` schützt hier den bestehenden Prod-Wert von
-- `instagram_blocklist`. Der Vorbehalt aus J4 (ein Anlegen mit DO NOTHING
-- entscheidet zugleich, was nie mehr hineinkommt) greift nicht, weil die Zeile
-- ein Behälter ist, den der Admin danach beschreibt — Anlegen und Einstellen
-- sind hier schon getrennt.
--
-- Die Vorgabeliste des Blocklist-Filters bleibt bewusst in
-- `InstagramContentService._DEFAULT_BLOCKLIST`. Der Code ERWEITERT die Vorgabe
-- um den DB-Wert; die Vorgabe hier zusätzlich einzutragen hieße, jeden Begriff
-- doppelt zu führen.
-- ============================================================================

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  (
    'instagram_trending_tags',
    '[]'::jsonb,
    'Trend-Hashtags für den fünften Tag-Platz (JSON-Array aus Strings, ohne #). '
    'Leer = kein Trend-Tag. Redaktionell gepflegt.'
  ),
  (
    'instagram_blocklist',
    '[]'::jsonb,
    'Zusätzliche gesperrte Begriffe für Instagram-Bildunterschriften (JSON-Array '
    'aus Strings). Wird zur eingebauten Vorgabeliste HINZUGEFÜGT, ersetzt sie nicht.'
  )
ON CONFLICT (setting_key) DO NOTHING;

-- ── Abnahme ────────────────────────────────────────────────────────────────
-- Ein INSERT, das null Zeilen trifft, ist sonst ein stiller Erfolg. Geprüft
-- wird die ANWESENHEIT beider Zeilen, nicht die Zahl der eingefügten — auf Prod
-- existiert eine davon bereits und wird zu Recht nicht angefasst.
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(k)
    INTO v_missing
  FROM unnest(ARRAY['instagram_trending_tags', 'instagram_blocklist']) AS k
  WHERE NOT EXISTS (
    SELECT 1 FROM platform_settings ps WHERE ps.setting_key = k
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 302: Schlüssel fehlen nach dem INSERT: %', v_missing;
  END IF;
END;
$$;
