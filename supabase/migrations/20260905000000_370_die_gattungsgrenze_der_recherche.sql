-- Migration 370: die Gattungsgrenze der Schmiede-Recherche
--
-- Die Recherche der Schmiede belegt Weltenbau mit drei Gattungen: literarische
-- Werke und Literaturkritik, philosophische Schriften, begutachtete
-- Fachliteratur. Diese Migration legt die Listen ab, an denen das entschieden
-- wird, und ersetzt die vier Steuerlisten aus Migration 124.
--
-- Warum die alten Listen ersetzt werden muessen und nicht nur ergaenzt:
-- sie wurden fuer eine Schranke geschrieben, die es nie gab. Tavily kennt zu
-- `include_domains` zwei Betriebsarten -- `filter` schliesst aus, `boost`
-- gewichtet nur -- und ohne `include_domains_mode` galt in der Praxis die
-- zweite. Gemessen am 2026-09-04 mit identischer Anfrage und identischer
-- Liste: ohne den Parameter kamen 2 von 5 Treffern aus der Liste (darunter
-- facebook.com), mit ihm 5 von 5. `TavilySearchService` setzt ihn jetzt.
--
-- Zwei der alten Eintraege verletzen die Gattungsgrenze ausserdem direkt:
-- `dezeen.com` und `designboom.com` sind redaktionelle Designmagazine ohne
-- Apparat. Sie weichen der Architekturgeschichte (sah.org, getty.edu, JSTOR).
--
-- Neu sind die beiden Listen, an denen die Entscheidung wirklich faellt:
-- `research_source_allowlist` und `research_source_denylist`. Sie werden nach
-- der Lieferung auf JEDE Quellzeile JEDES Anbieters angewandt
-- (`backend/services/research_source_policy.py`) -- auch auf die der
-- schluessellosen Fachdienste, an denen Tavily nicht beteiligt ist.
--
-- Siehe docs/plans/forge-scholarly-sources.md.

BEGIN;

-- 0. Den Zustand VOR dem Schreiben festhalten. Eine Migration, die hinterher
--    am Zeitstempel raten muss, was sie selbst angefasst hat, meldet beim
--    zweiten Lauf etwas anderes als beim ersten. Der Vergleich gehoert an
--    eine Tabelle, nicht an NOW().
CREATE TEMP TABLE m370_before ON COMMIT DROP AS
  SELECT setting_key, setting_value
    FROM platform_settings
   WHERE setting_key LIKE 'research_domains_%';

-- 1. Die vier Steuerlisten: nur ueberschreiben, wo noch der Wert aus
--    Migration 124 steht. Eine vom Admin geaenderte Liste ist eine
--    Entscheidung und bleibt stehen; sie wird unten gemeldet.

UPDATE platform_settings
   SET setting_value = '["en.wikipedia.org","de.wikipedia.org","britannica.com","plato.stanford.edu","iep.utm.edu","jstor.org","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","link.springer.com","journals.sagepub.com","annualreviews.org","oapen.org","archive.org"]'::jsonb,
       updated_at = NOW()
 WHERE setting_key = 'research_domains_encyclopedic'
   AND setting_value = '["en.wikipedia.org","plato.stanford.edu","britannica.com"]'::jsonb;

UPDATE platform_settings
   SET setting_value = '["jstor.org","muse.jhu.edu","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","journals.sagepub.com","brill.com","openlibrary.org","gutenberg.org","archive.org","hathitrust.org","doaj.org","oapen.org","en.wikipedia.org","de.wikipedia.org","britannica.com"]'::jsonb,
       updated_at = NOW()
 WHERE setting_key = 'research_domains_literary'
   AND setting_value = '["en.wikipedia.org","britannica.com","theparisreview.org"]'::jsonb;

UPDATE platform_settings
   SET setting_value = '["plato.stanford.edu","iep.utm.edu","philpapers.org","philarchive.org","philsci-archive.pitt.edu","ndpr.nd.edu","jstor.org","cambridge.org","academic.oup.com","link.springer.com","degruyter.com","brill.com","tandfonline.com","journals.sagepub.com","press.princeton.edu","mitpress.mit.edu"]'::jsonb,
       updated_at = NOW()
 WHERE setting_key = 'research_domains_philosophy'
   AND setting_value = '["plato.stanford.edu","iep.utm.edu","en.wikipedia.org"]'::jsonb;

UPDATE platform_settings
   SET setting_value = '["sah.org","getty.edu","metmuseum.org","arthistoricum.net","architecturalhistoriansjournal.org","jstor.org","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","journals.sagepub.com","link.springer.com","oapen.org","archive.org","en.wikipedia.org","de.wikipedia.org","britannica.com"]'::jsonb,
       updated_at = NOW()
 WHERE setting_key = 'research_domains_architecture'
   AND setting_value = '["en.wikipedia.org","dezeen.com","designboom.com"]'::jsonb;

-- Fehlt eine der vier (frische Datenbank), wird sie angelegt.
INSERT INTO platform_settings (setting_key, setting_value, updated_by_id)
VALUES
  ('research_domains_encyclopedic', '["en.wikipedia.org","de.wikipedia.org","britannica.com","plato.stanford.edu","iep.utm.edu","jstor.org","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","link.springer.com","journals.sagepub.com","annualreviews.org","oapen.org","archive.org"]'::jsonb, NULL),
  ('research_domains_literary', '["jstor.org","muse.jhu.edu","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","journals.sagepub.com","brill.com","openlibrary.org","gutenberg.org","archive.org","hathitrust.org","doaj.org","oapen.org","en.wikipedia.org","de.wikipedia.org","britannica.com"]'::jsonb, NULL),
  ('research_domains_philosophy', '["plato.stanford.edu","iep.utm.edu","philpapers.org","philarchive.org","philsci-archive.pitt.edu","ndpr.nd.edu","jstor.org","cambridge.org","academic.oup.com","link.springer.com","degruyter.com","brill.com","tandfonline.com","journals.sagepub.com","press.princeton.edu","mitpress.mit.edu"]'::jsonb, NULL),
  ('research_domains_architecture', '["sah.org","getty.edu","metmuseum.org","arthistoricum.net","architecturalhistoriansjournal.org","jstor.org","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","journals.sagepub.com","link.springer.com","oapen.org","archive.org","en.wikipedia.org","de.wikipedia.org","britannica.com"]'::jsonb, NULL)
ON CONFLICT (setting_key) DO NOTHING;


-- 2. Die Gattungsgrenze selbst. `DO NOTHING`, weil eine vorhandene Liste
--    immer eine Entscheidung ist -- diese Schluessel gab es vor 370 nicht.
INSERT INTO platform_settings (setting_key, setting_value, updated_by_id)
VALUES
  ('research_source_allowlist', '["jstor.org","muse.jhu.edu","cambridge.org","academic.oup.com","degruyter.com","tandfonline.com","journals.sagepub.com","link.springer.com","springer.com","sciencedirect.com","onlinelibrary.wiley.com","brill.com","annualreviews.org","nature.com","science.org","pnas.org","journals.uchicago.edu","read.dukeupress.edu","openedition.org","journals.openedition.org","persee.fr","erudit.org","scielo.org","doi.org","doaj.org","core.ac.uk","zenodo.org","hal.science","arxiv.org","oapen.org","luminosoa.org","press.uchicago.edu","mitpress.mit.edu","press.princeton.edu","hup.harvard.edu","yalebooks.yale.edu","ucpress.edu","dukeupress.edu","cornellpress.cornell.edu","sup.org","nyupress.org","manchesteruniversitypress.co.uk","uminnpressblog.com","upress.umn.edu","plato.stanford.edu","iep.utm.edu","philpapers.org","philarchive.org","philsci-archive.pitt.edu","ndpr.nd.edu","openlibrary.org","archive.org","gutenberg.org","projekt-gutenberg.org","hathitrust.org","babel.hathitrust.org","wikisource.org","en.wikisource.org","de.wikisource.org","deutschestextarchiv.de","zeno.org","perseus.tufts.edu","en.wikipedia.org","de.wikipedia.org","britannica.com","sah.org","getty.edu","metmuseum.org","arthistoricum.net","architecturalhistoriansjournal.org"]'::jsonb, NULL),
  ('research_source_denylist', '["youtube.com","youtu.be","vimeo.com","dailymotion.com","twitch.tv","tiktok.com","facebook.com","fb.com","instagram.com","threads.net","x.com","twitter.com","linkedin.com","reddit.com","pinterest.com","tumblr.com","discord.com","t.me","fandom.com","wikia.com","wikia.org","gamepedia.com","tvtropes.org","imdb.com","goodreads.com","boardgamegeek.com","store.steampowered.com","steampowered.com","gog.com","ign.com","gamespot.com","polygon.com","kotaku.com","pcgamer.com","rockpapershotgun.com","eurogamer.net","gamesradar.com","gamerant.com","screenrant.com","quora.com","stackexchange.com","stackoverflow.com","answers.com","wikihow.com","ehow.com","chegg.com","coursehero.com","studocu.com","sparknotes.com","cliffsnotes.com","bartleby.com","gradesaver.com","shmoop.com","enotes.com","studysmarter.co.uk","litcharts.com","medium.com","substack.com","blogspot.com","wordpress.com","wix.com","wixsite.com","squarespace.com","weebly.com","blogger.com","amazon.com","amazon.de","ebay.com","etsy.com","alibaba.com","abebooks.com","scribd.com","slideshare.net","prezi.com","coursera.org","udemy.com","sci-hub.se","libgen.is","z-lib.org"]'::jsonb, NULL)
ON CONFLICT (setting_key) DO NOTHING;


-- 2b. Der neue KI-Zweck `research_query`: die Uebersetzung des Seeds in
--     Suchbegriffe fuer Fachdatenbanken. Ohne diese drei Zeilen laeuft der
--     Aufruf auf `UNDECLARED_PURPOSE` -- die kleinste erklaerte Obergrenze und
--     das kuerzeste Zeitlimit, also nicht kaputt, aber auch nicht das, was
--     `ai_purposes` erklaert. Die Zeile gewinnt zur Laufzeit gegen den Code,
--     darum muessen beide dasselbe sagen (test_ai_purposes_migration).
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('max_tokens_research_query', '400'::jsonb,
   'Ausgabe-Obergrenze in Tokens fuer den Zweck ''research_query''. Voreinstellung 400. Neun kurze Zeichenketten als JSON; die Ausgabe ist durch ResearchQueryPlan auf 3x3 Eintraege gedeckelt, ein groesseres Budget kaufte nichts.'),
  ('timeout_research_query', '30'::jsonb,
   'Zeitlimit in Sekunden fuer den Zweck ''research_query''. Voreinstellung 30s. Dieser Aufruf liegt VOR den Suchen, jede Sekunde schlaegt auf die Wartezeit des Astrolabiums durch.'),
  ('reasoning_research_query', '"off"'::jsonb,
   'Denkaufwand fuer den Zweck ''research_query''. off | minimal | low | medium | high | xhigh | auto. Aus einer Praemisse Fachvokabular zu benennen ist Abruf, kein Schluss -- und ein durchgesickerter <think>-Block machte das JSON unparsbar.')
ON CONFLICT (setting_key) DO NOTHING;


-- 3. Selbstpruefung: gegen die WIRKUNG dieser Migration, nicht gegen den
--    Inhalt der Plattform. Geprueft wird, dass die sechs Schluessel da sind
--    und dass die Sperrliste die drei Gattungen enthaelt, die den Anlass
--    gaben. Beides hat diese Migration selbst hergestellt; beides gilt auf
--    einer leeren Datenbank genauso wie auf Produktion.
DO $$
DECLARE
  v_keys   int;
  v_deny   jsonb;
  v_allow  jsonb;
  v_custom text;
BEGIN
  SELECT count(*) INTO v_keys
    FROM platform_settings
   WHERE setting_key IN (
     'research_domains_encyclopedic', 'research_domains_literary',
     'research_domains_philosophy', 'research_domains_architecture',
     'research_source_allowlist', 'research_source_denylist');
  IF v_keys <> 6 THEN
    RAISE EXCEPTION 'Migration 370: erwartet 6 Forschungsschluessel, gefunden %', v_keys;
  END IF;

  SELECT setting_value INTO v_deny
    FROM platform_settings WHERE setting_key = 'research_source_denylist';
  IF NOT (v_deny ? 'youtube.com' AND v_deny ? 'facebook.com' AND v_deny ? 'fandom.com') THEN
    RAISE EXCEPTION 'Migration 370: Sperrliste unvollstaendig -- %', v_deny;
  END IF;

  SELECT setting_value INTO v_allow
    FROM platform_settings WHERE setting_key = 'research_source_allowlist';
  IF NOT (v_allow ? 'plato.stanford.edu' AND v_allow ? 'jstor.org' AND v_allow ? 'openlibrary.org') THEN
    RAISE EXCEPTION 'Migration 370: Freiliste unvollstaendig -- %', v_allow;
  END IF;
  IF v_deny @> v_allow OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_allow) a
       WHERE v_deny ? a.value) THEN
    RAISE EXCEPTION 'Migration 370: eine Domain steht in Frei- UND Sperrliste';
  END IF;

  -- Keine der vier Steuerlisten darf noch den Wert aus Migration 124 tragen.
  -- Das ist die WIRKUNG dieser Migration und gilt auf einer leeren Datenbank
  -- genauso: dort legt der INSERT oben die neuen Werte an.
  IF EXISTS (
    SELECT 1 FROM platform_settings
     WHERE (setting_key = 'research_domains_encyclopedic'
              AND setting_value = '["en.wikipedia.org","plato.stanford.edu","britannica.com"]'::jsonb)
        OR (setting_key = 'research_domains_literary'
              AND setting_value = '["en.wikipedia.org","britannica.com","theparisreview.org"]'::jsonb)
        OR (setting_key = 'research_domains_philosophy'
              AND setting_value = '["plato.stanford.edu","iep.utm.edu","en.wikipedia.org"]'::jsonb)
        OR (setting_key = 'research_domains_architecture'
              AND setting_value = '["en.wikipedia.org","dezeen.com","designboom.com"]'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Migration 370: eine Steuerliste traegt noch den Wert aus Migration 124';
  END IF;

  -- Eine Steuerliste, die nicht den Wert aus Migration 124 trug, wurde oben
  -- NICHT angefasst -- entweder weil ein Admin sie geaendert hatte, oder weil
  -- diese Migration schon einmal gelaufen ist. Beides ist in Ordnung und darf
  -- trotzdem nicht still bleiben: eine Pruefung, die nichts zu pruefen fand,
  -- ist keine bestandene Pruefung. Gemeldet wird, was gemessen wurde, nicht
  -- eine Deutung davon.
  SELECT string_agg(b.setting_key, ', ') INTO v_custom
    FROM m370_before b
    JOIN platform_settings s USING (setting_key)
   WHERE s.setting_value = b.setting_value;
  IF v_custom IS NOT NULL THEN
    RAISE NOTICE 'Migration 370: unveraendert gelassen (trug nicht den Wert aus 124): %', v_custom;
  END IF;
END $$;

COMMIT;
