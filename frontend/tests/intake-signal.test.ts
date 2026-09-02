/**
 * Die Schleuse — Adapter und Quellenklasse.
 *
 * Geprüft wird das, was beim Weiterbauen leicht kaputtgeht und nirgends
 * auffällt: die Reihenfolge in `sourceKindOf` (ein Adapter ohne Schlüssel ist
 * unbrauchbar, egal wie gut seine Daten wären) und die Zusicherung, dass die
 * beiden Zuflüsse dieselbe Gestalt liefern.
 */

import { describe, expect, it } from 'vitest';
import type { AdapterInfo, ScanCandidate } from '../src/services/api/ScannerApiService.js';
import type { BrowseArticle } from '../src/services/api/SocialTrendsApiService.js';
import {
  CATEGORY_ARCHETYPE,
  EFFECT_SKIP_THRESHOLD,
  effectiveMagnitude,
  fromBrowseArticle,
  fromScanCandidate,
  sourceKindOf,
} from '../src/types/intake.js';

function adapter(over: Partial<AdapterInfo> = {}): AdapterInfo {
  return {
    name: 'usgs_earthquakes',
    display_name: 'USGS',
    categories: ['natural_disaster'],
    is_structured: true,
    requires_api_key: false,
    api_key_setting: null,
    default_interval: 21600,
    enabled: true,
    available: true,
    ...over,
  };
}

function candidate(over: Partial<ScanCandidate> = {}): ScanCandidate {
  return {
    id: 'cand-1',
    source_category: 'natural_disaster',
    title: 'Beben vor der Küste',
    description: 'Magnitude 6.1, keine Meldungen über Schäden.',
    bureau_dispatch: null,
    article_url: 'https://example.org/a',
    article_platform: null,
    article_raw_data: null,
    magnitude: 0.55,
    classification_reason: 'deterministisch (Richter → Magnitude)',
    source_adapter: 'usgs_earthquakes',
    is_structured: true,
    status: 'pending',
    resonance_id: null,
    created_at: '2026-09-02T06:00:00Z',
    reviewed_at: null,
    reviewed_by_id: null,
    ...over,
  };
}

describe('sourceKindOf', () => {
  it('stuft einen Adapter ohne Schlüssel als unbrauchbar ein, auch wenn er strukturiert ist', () => {
    // Die Reihenfolge ist der Punkt: `nokey` muss VOR `structured` greifen,
    // sonst zeigt die Sensor-Leiste eine grüne Kachel für eine tote Quelle.
    const info = adapter({ requires_api_key: true, available: false });
    expect(sourceKindOf('usgs_earthquakes', info)).toBe('nokey');
  });

  it('erkennt strukturierte, soziale, interne und halbstrukturierte Quellen', () => {
    expect(sourceKindOf('usgs_earthquakes', adapter())).toBe('structured');
    expect(sourceKindOf('reddit')).toBe('social');
    expect(sourceKindOf('bluesky')).toBe('social');
    expect(sourceKindOf('echoes')).toBe('internal');
    expect(sourceKindOf('hackernews')).toBe('semi');
  });

  it('fällt ohne Adapter-Angaben auf die vorsichtige Annahme zurück', () => {
    // Ohne Dashboard-Eintrag ist unbekannt, ob eine Quelle ein Modell braucht.
    // `llm` ist die teure Annahme und damit die richtige.
    expect(sourceKindOf('guardian')).toBe('llm');
  });

  it('ist unabhängig von der Schreibweise', () => {
    expect(sourceKindOf('Reddit')).toBe('social');
  });
});

describe('fromScanCandidate', () => {
  it('übernimmt Klassifikation und Begründung des Scanners', () => {
    const s = fromScanCandidate(candidate(), [adapter()]);
    expect(s.stage).toBe('raw');
    expect(s.magnitude).toBe(0.55);
    expect(s.category).toBe('natural_disaster');
    expect(s.classificationNote).toContain('deterministisch');
    expect(s.sourceKind).toBe('structured');
  });

  it('bildet den Status des Scanners auf die Stufe der Schleuse ab', () => {
    expect(fromScanCandidate(candidate({ status: 'approved' })).stage).toBe('res');
    expect(fromScanCandidate(candidate({ status: 'rejected' })).stage).toBe('out');
    expect(fromScanCandidate(candidate({ status: 'flagged' })).stage).toBe('flag');
    expect(fromScanCandidate(candidate({ status: 'pending' })).stage).toBe('raw');
  });

  it('nennt genau eine Quelle, solange das Backend nicht bündelt', () => {
    // Ein leeres Array wäre die Unwahrheit — eine Quelle gibt es ja.
    const s = fromScanCandidate(candidate());
    expect(s.sources).toEqual([{ name: 'usgs_earthquakes', count: 1 }]);
  });
});

describe('fromBrowseArticle', () => {
  const article: BrowseArticle = {
    name: 'Hafenstreik geht in die dritte Woche',
    platform: 'guardian',
    url: 'https://example.org/b',
    raw_data: { trail_text: 'Verhandlungen ausgesetzt.' },
  };

  it('landet im Eingang, weil ein Mensch ihn bereits gewählt hat', () => {
    expect(fromBrowseArticle(article).stage).toBe('in');
  });

  it('hat keine Magnitude — die entsteht erst im Schmelztiegel', () => {
    const s = fromBrowseArticle(article);
    expect(s.magnitude).toBe(0);
    expect(s.category).toBeNull();
    expect(s.classificationNote).toBeUndefined();
  });

  it('leitet eine stabile ID aus der URL ab', () => {
    // `BrowseArticle` hat keine ID. Ohne stabilen Schlüssel verlöre die
    // Zustandsmaschine das Signal beim nächsten Laden.
    expect(fromBrowseArticle(article).id).toBe('browse:https://example.org/b');
    const ohneUrl = fromBrowseArticle({ name: 'Titel', platform: 'guardian' });
    expect(ohneUrl.id).toBe('browse:Titel');
  });

  it('liest den Anriss aus den beiden Feldern, die die Quellen benutzen', () => {
    expect(fromBrowseArticle(article).abstract).toBe('Verhandlungen ausgesetzt.');
    const newsapi = fromBrowseArticle({
      name: 'T',
      platform: 'newsapi',
      raw_data: { description: 'Kurzfassung.' },
    });
    expect(newsapi.abstract).toBe('Kurzfassung.');
  });
});

describe('Beide Zuflüsse liefern dieselbe Gestalt', () => {
  it('setzt in beiden Fällen jedes Pflichtfeld', () => {
    const felder = ['id', 'stage', 'source', 'sourceKind', 'headline', 'observedAt', 'magnitude'];
    for (const s of [
      fromScanCandidate(candidate()),
      fromBrowseArticle({ name: 'T', platform: 'guardian' }),
    ]) {
      for (const f of felder) {
        expect(s, `${f} fehlt`).toHaveProperty(f);
        expect(s[f as keyof typeof s], `${f} ist leer`).not.toBeUndefined();
      }
      expect(Array.isArray(s.sources)).toBe(true);
    }
  });
});

describe('Kategorie → Archetyp', () => {
  it('deckt alle acht Kategorien ab und nennt keine zweimal', () => {
    const werte = Object.values(CATEGORY_ARCHETYPE);
    expect(werte).toHaveLength(8);
    expect(new Set(werte).size).toBe(8);
  });
});

describe('effectiveMagnitude', () => {
  it('deckelt bei 1', () => {
    expect(effectiveMagnitude(0.9, 1.4)).toBe(1);
  });

  it('markiert eine übersprungene Welt unter der Schwelle', () => {
    expect(effectiveMagnitude(0.3, 0.5)).toBeLessThan(EFFECT_SKIP_THRESHOLD);
    expect(effectiveMagnitude(0.8, 0.9)).toBeGreaterThan(EFFECT_SKIP_THRESHOLD);
  });
});
