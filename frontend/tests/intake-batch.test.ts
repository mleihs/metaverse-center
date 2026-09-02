/**
 * Die zwei Stapel-Wege — und die drei Zusagen, die sie geben.
 *
 * Alle drei sind die Sorte, die ein späterer Beitrag in bester Absicht bricht,
 * weil das Gegenteil jeweils bequemer ist:
 *
 * 1. **Die Stapel-Verwandlung setzt KEINE Linse.** Eine Vorgabe-Zone wäre eine
 *    Zeile Code und eine Entscheidung, die niemand gesehen hat — sie bestimmt,
 *    WO in der Welt ein Ereignis eintritt.
 * 2. **Die Stapel-Aufnahme deckelt an der Tagesquote.** Ein Stapel, der sie
 *    überginge, wäre eine Umgehung mit einem Knopf.
 * 3. **Es rücken nur so viele Signale vor, wie der Server WIRKLICH angelegt
 *    hat.** Die Antwort führt `events` und `errors` getrennt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { socialTrendsApi } from '../src/services/api/index.js';
import { generationProgress } from '../src/services/GenerationProgressService.js';
import { intakeState } from '../src/services/IntakeStateManager.js';
import type { ScanCandidate } from '../src/services/api/ScannerApiService.js';
import { fromScanCandidate, type IntakeSignal } from '../src/types/intake.js';
import {
  batchIntegrateQuarantine,
  batchTransformEntrance,
} from '../src/components/intake/intake-batch.js';

function candidate(over: Partial<ScanCandidate> = {}): ScanCandidate {
  return {
    id: 'c1',
    source_category: 'natural_disaster',
    title: 'Beben vor der Küste',
    description: null,
    bureau_dispatch: null,
    article_url: null,
    article_platform: null,
    article_raw_data: null,
    magnitude: 0.55,
    classification_reason: null,
    source_adapter: 'usgs_earthquakes',
    source_id: null,
    sources: [],
    social_volume: 0,
    is_structured: true,
    status: 'pending',
    resonance_id: null,
    created_at: '2026-09-02T06:00:00Z',
    reviewed_at: null,
    reviewed_by_id: null,
    flag_reason: null,
    flagged_by_simulation_id: null,
    ...over,
  };
}

function seed(candidates: ScanCandidate[], stage: IntakeSignal['stage']): void {
  const map = new Map<string, IntakeSignal>();
  for (const c of candidates) {
    const s = fromScanCandidate(c);
    map.set(s.id, { ...s, stage });
  }
  intakeState.signals.value = map;
}

/** Eine fertige Linse, wie sie der Schmelztiegel setzen würde. */
function withLens(id: string): void {
  intakeState.patch(id, {
    lens: {
      zone: 'zone-1',
      vector: 'commerce',
      tone: 'official',
      type: 'crisis',
      impact: 6,
      react: false,
      n: 3,
      witnesses: [],
    },
    proposal: { title: 'Ein Riss im Fundament', body: 'Der Boden gab nach.' },
  });
}

beforeEach(() => {
  intakeState.clear();
  vi.restoreAllMocks();
  /*
   * Die Fortschrittsanzeige durchreichen, statt sie zu zeichnen: sie legt sonst
   * ein Element an den Dokumentbaum und ist fuer das, was hier geprueft wird,
   * ohne Belang.
   */
  vi.spyOn(generationProgress, 'withProgress').mockImplementation(
    async (_config, callback) =>
      await callback({ setStep: () => {}, setError: () => {}, complete: () => {} }),
  );
});

describe('Die Stapel-Verwandlung', () => {
  it('schreibt Vorschläge und setzt KEINE Linse', async () => {
    seed([candidate({ id: 'a', title: 'Erstes' }), candidate({ id: 'b', title: 'Zweites' })], 'in');
    vi.spyOn(socialTrendsApi, 'batchTransform').mockResolvedValue({
      success: true,
      data: [
        {
          article_name: 'Erstes',
          article_platform: 'usgs_earthquakes',
          transformation: { title: 'Der Riss', description: 'Text.' },
          error: null,
        },
        {
          article_name: 'Zweites',
          article_platform: 'usgs_earthquakes',
          transformation: { title: 'Die Welle', narrative: 'Anderer Text.' },
          error: null,
        },
      ],
    });

    const n = await batchTransformEntrance('sim-1');
    expect(n).toBe(2);

    const a = intakeState.get('a');
    expect(a?.stage).toBe('q');
    expect(a?.proposal).toEqual({ title: 'Der Riss', body: 'Text.' });
    // DIE Zusage: der Ort bleibt eine Entscheidung.
    expect(a?.lens).toBeUndefined();
  });

  it('lässt liegen, was das Modell nicht verwandelt hat', async () => {
    seed([candidate({ id: 'a', title: 'Erstes' }), candidate({ id: 'b', title: 'Zweites' })], 'in');
    vi.spyOn(socialTrendsApi, 'batchTransform').mockResolvedValue({
      success: true,
      data: [
        {
          article_name: 'Erstes',
          article_platform: 'usgs_earthquakes',
          transformation: { title: 'Der Riss', description: 'Text.' },
          error: null,
        },
        {
          article_name: 'Zweites',
          article_platform: 'usgs_earthquakes',
          transformation: null,
          error: 'model refused',
        },
      ],
    });

    expect(await batchTransformEntrance('sim-1')).toBe(1);
    expect(intakeState.get('a')?.stage).toBe('q');
    expect(intakeState.get('b')?.stage).toBe('in');
  });

  it('schiebt nichts weiter, wenn der Aufruf scheitert', async () => {
    seed([candidate({ id: 'a' })], 'in');
    vi.spyOn(socialTrendsApi, 'batchTransform').mockResolvedValue({
      success: false,
      error: { message: 'kaputt', code: 'HTTP_502' },
    });

    expect(await batchTransformEntrance('sim-1')).toBe(0);
    expect(intakeState.get('a')?.stage).toBe('in');
  });
});

describe('Die Stapel-Aufnahme', () => {
  it('nimmt nichts ohne Linse', async () => {
    seed([candidate({ id: 'a' })], 'q');
    const spy = vi.spyOn(socialTrendsApi, 'batchIntegrate');
    expect(await batchIntegrateQuarantine('sim-1')).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  /*
   * Die Quote deckelt `q → ev` und sonst nichts. Die Einzelaufnahme prüft sie
   * seit Schritt 4 — ein Stapel, der sie überginge, wäre eine Umgehung mit
   * einem Knopf.
   */
  it('deckelt an der Tagesquote', async () => {
    seed(
      [candidate({ id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })],
      'q',
    );
    for (const id of ['a', 'b', 'c']) withLens(id);
    intakeState.dailyQuota.value = 5;
    intakeState.eventsToday.value = 3; // es bleiben ZWEI

    const spy = vi.spyOn(socialTrendsApi, 'batchIntegrate').mockResolvedValue({
      success: true,
      data: {
        events: [{ id: 'e1' }, { id: 'e2' }] as never,
        errors: [],
        reactions_generated_for: null,
        reactions_count: 0,
      },
    });

    expect(await batchIntegrateQuarantine('sim-1')).toBe(2);
    expect(spy.mock.calls[0][1].items).toHaveLength(2);
    expect(intakeState.inQuarantine.value).toHaveLength(1);
  });

  it('rührt nichts an, wenn die Quote erschöpft ist', async () => {
    seed([candidate({ id: 'a' })], 'q');
    withLens('a');
    intakeState.dailyQuota.value = 5;
    intakeState.eventsToday.value = 5;

    const spy = vi.spyOn(socialTrendsApi, 'batchIntegrate');
    expect(await batchIntegrateQuarantine('sim-1')).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    expect(intakeState.get('a')?.stage).toBe('q');
  });

  /*
   * Die Antwort führt `events` und `errors` getrennt. Alles auf `ev` zu setzen,
   * weil der AUFRUF gelungen ist, wäre eine Quittung für Ereignisse, die es
   * nicht gibt — und die Tagesquote zählte falsch mit.
   */
  it('rückt nur so viele vor, wie der Server wirklich angelegt hat', async () => {
    seed([candidate({ id: 'a' }), candidate({ id: 'b' })], 'q');
    withLens('a');
    withLens('b');

    vi.spyOn(socialTrendsApi, 'batchIntegrate').mockResolvedValue({
      success: true,
      data: {
        events: [{ id: 'e1' }] as never,
        errors: [{ title: 'Zweites', error: 'nope' }],
        reactions_generated_for: null,
        reactions_count: 0,
      },
    });

    expect(await batchIntegrateQuarantine('sim-1')).toBe(1);
    expect(intakeState.eventsToday.value).toBe(1);
    expect(intakeState.inQuarantine.value).toHaveLength(1);
  });
});

describe('Abonnements holen herein, was ein Mensch einmal entschieden hat', () => {
  /*
   * Geprüft wird das VERHALTEN von `_merge`, nicht die Bedingung darin — über
   * den einzigen öffentlichen Weg dorthin, `loadBrowse`. Ein Test, der die
   * Bedingung nachbaut, bestätigt nur, dass ich sie zweimal gleich abschreiben
   * kann. (Erster Anlauf tat genau das; er ist ersetzt.)
   */
  const sub = {
    id: 's1',
    simulation_id: 'sim-1',
    label: 'Beben im Hafen',
    source_category: null,
    min_magnitude: 0,
    zone_id: 'zone-1',
    vector: 'commerce',
    is_active: true,
    created_at: '2026-09-02T06:00:00Z',
  };

  function browseReturns(names: string[]): void {
    vi.spyOn(socialTrendsApi, 'browse').mockResolvedValue({
      success: true,
      data: names.map((n, i) => ({ name: n, platform: 'guardian', url: `https://x/${i}` })),
    });
  }

  it('nimmt ein passendes NEUES Signal in den Eingang, mit der Linse des Abos', async () => {
    intakeState.subscriptions.value = [sub];
    browseReturns(['Hafenstreik']);

    await intakeState.loadBrowse('sim-1', {});

    const signal = [...intakeState.signals.value.values()][0];
    expect(signal.stage).toBe('in');
    expect(signal.viaSubscription?.label).toBe('Beben im Hafen');
    expect(signal.viaSubscription?.zone).toBe('zone-1');
  });

  it('lässt liegen, worauf kein Abo passt', async () => {
    // Ein gebrowster Artikel hat Magnitude 0 — „noch nicht gemessen".
    intakeState.subscriptions.value = [{ ...sub, min_magnitude: 0.4 }];
    browseReturns(['Hafenstreik']);

    await intakeState.loadBrowse('sim-1', {});
    expect([...intakeState.signals.value.values()][0].stage).toBe('raw');
  });

  /*
   * DIE Zusage: ein Abo darf nichts zurueckholen. Ohne sie kaeme Verworfenes
   * bei jedem Laden wieder in den Eingang, und eine Entscheidung waere
   * widerrufen, ohne dass jemand sie widerrufen hat.
   */
  it('holt NICHTS zurück, was ein Mensch schon behandelt hat', async () => {
    intakeState.subscriptions.value = [sub];
    browseReturns(['Hafenstreik']);

    await intakeState.loadBrowse('sim-1', {});
    const id = [...intakeState.signals.value.keys()][0];
    intakeState.discard(id);
    expect(intakeState.get(id)?.stage).toBe('out');

    // Dieselbe Antwort ein zweites Mal — der Server weiss von nichts.
    await intakeState.loadBrowse('sim-1', {});
    expect(intakeState.get(id)?.stage).toBe('out');
  });

  it('greift nicht, wenn das Abo abgeschaltet ist', async () => {
    intakeState.subscriptions.value = [{ ...sub, is_active: false }];
    browseReturns(['Hafenstreik']);

    await intakeState.loadBrowse('sim-1', {});
    expect([...intakeState.signals.value.values()][0].stage).toBe('raw');
  });
});
