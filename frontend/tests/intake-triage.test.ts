/**
 * Die Sichtung — Filter, Rang und die vier Tasten.
 *
 * Warum das Tests sind und keine Selbstverständlichkeiten:
 *
 * 1. **Die Reihenfolge IST die Auskunft.** Die Sichtung ist eine Rangliste, und
 *    genau deshalb wurde für sie ein gleichförmiges Kartenraster gewählt und
 *    kein Masonry. Eine Sortierung, die still danebengreift, sieht aus wie eine
 *    Sortierung.
 * 2. **Der Tastenhinweis steht auf dem Schirm.** `↑↓ · Leertaste · ⏎ · x` ist in
 *    der Werkzeugleiste angezeigt. Ein angezeigter Hinweis, der nichts auslöst,
 *    ist dieselbe Sorte Lüge wie ein Regler, der nichts bewegt.
 * 3. **Zwei Sortierungen sind ABSICHTLICH tot** (Passung, Netz-Tempo — die
 *    Zahlen liefert das Backend nicht). Dass sie abgeschaltet SIND und nicht
 *    heimlich nach Magnitude sortieren, ist der ganze Punkt der Entscheidung.
 *
 * Rolle: `intakeState.role` leitet sich aus `appState.isPlatformAdmin` ab, das
 * hier `false` ist. Alle Signale werden deshalb ÖRTLICH verworfen — kein Test
 * greift zum Netz.
 */

import { beforeEach, describe, expect, it } from 'vitest';

// ⚠ Nebenwirkungs-Import ZUERST, sonst entfernt esbuild ihn und `@customElement`
// läuft nie — das Element bliebe ein nicht aufgewertetes HTMLElement.
import '../src/components/intake/IntakeTriageModal.js';
import type { VelgIntakeTriageModal } from '../src/components/intake/IntakeTriageModal.js';
import { intakeState } from '../src/services/IntakeStateManager.js';
import type { ScanCandidate } from '../src/services/api/ScannerApiService.js';
import { fromScanCandidate, type IntakeSignal } from '../src/types/intake.js';

function candidate(over: Partial<ScanCandidate> = {}): ScanCandidate {
  return {
    id: 'c1',
    source_category: 'natural_disaster',
    title: 'Beben vor der Küste',
    description: null,
    bureau_dispatch: null,
    article_url: 'https://example.org/a',
    article_platform: null,
    article_raw_data: null,
    magnitude: 0.55,
    classification_reason: null,
    source_adapter: 'usgs_earthquakes',
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

function seed(candidates: ScanCandidate[]): void {
  const map = new Map<string, IntakeSignal>();
  for (const c of candidates) {
    const signal = fromScanCandidate(c);
    map.set(signal.id, signal);
  }
  intakeState.signals.value = map;
}

async function sichtung(): Promise<VelgIntakeTriageModal> {
  const el = document.createElement('velg-intake-triage-modal') as VelgIntakeTriageModal;
  el.open = true;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function root(el: VelgIntakeTriageModal): ShadowRoot {
  const r = el.shadowRoot;
  if (!r) throw new Error('kein shadowRoot — die Komponente hat nicht gerendert');
  return r;
}

function headlines(el: VelgIntakeTriageModal): string[] {
  return [...root(el).querySelectorAll('.headline')].map((h) => h.textContent?.trim() ?? '');
}

/**
 * Die Chips einer der beiden Gruppen der Werkzeugleiste.
 *
 * Über `.group` und nicht über eine Beschriftung: `aria-label` geht durch
 * `msg()`, und ein Test, der an einer übersetzbaren Zeichenkette hängt, wird
 * rot, sobald jemand ein Wort verbessert.
 */
function chips(el: VelgIntakeTriageModal, group: 'sort' | 'magnitude'): HTMLButtonElement[] {
  const groups = [...root(el).querySelectorAll('.group')];
  const target = groups[group === 'sort' ? 0 : 1];
  if (!target) throw new Error(`keine Chip-Gruppe ${group}`);
  return [...target.querySelectorAll<HTMLButtonElement>('.chip')];
}

function press(el: VelgIntakeTriageModal, key: string): void {
  const split = root(el).querySelector('.split');
  if (!split) throw new Error('kein .split — der Rumpf hat nicht gerendert');
  split.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

beforeEach(() => {
  intakeState.clear();
  document.body.innerHTML = '';
});

describe('Die Sichtung zeigt, was wartet', () => {
  it('zeigt je Signal der Stufe `raw` eine Karte', async () => {
    seed([candidate({ id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })]);
    const el = await sichtung();
    expect(root(el).querySelectorAll('.card')).toHaveLength(3);
  });

  it('zeigt NICHTS, was schon aufgenommen oder verworfen ist', async () => {
    seed([candidate({ id: 'a' }), candidate({ id: 'b' })]);
    intakeState.toEntrance('a');
    const el = await sichtung();
    expect(root(el).querySelectorAll('.card')).toHaveLength(1);
  });

  it('lässt das Bildfach weg, wo die Quelle keines mitschickt', async () => {
    seed([
      candidate({ id: 'mit', article_raw_data: { thumbnail: 'https://g/a.jpg' } }),
      candidate({ id: 'ohne' }),
    ]);
    const el = await sichtung();
    // Genau EINE Karte hat ein Bildfach — kein leerer Platz bei der anderen.
    expect(root(el).querySelectorAll('.shot')).toHaveLength(1);
  });
});

describe('Der Rang', () => {
  it('sortiert nach Magnitude, absteigend', async () => {
    seed([
      candidate({ id: 'a', title: 'schwach', magnitude: 0.2 }),
      candidate({ id: 'b', title: 'stark', magnitude: 0.9 }),
      candidate({ id: 'c', title: 'mittel', magnitude: 0.5 }),
    ]);
    const el = await sichtung();
    expect(headlines(el)).toEqual(['stark', 'mittel', 'schwach']);
  });

  it('sortiert nach Neuheit, wenn man es verlangt', async () => {
    seed([
      candidate({ id: 'a', title: 'alt', magnitude: 0.9, created_at: '2026-09-01T00:00:00Z' }),
      candidate({ id: 'b', title: 'neu', magnitude: 0.1, created_at: '2026-09-02T00:00:00Z' }),
    ]);
    const el = await sichtung();
    const sort = chips(el, 'sort');
    expect(sort).toHaveLength(4);
    sort[1].click(); // Neuheit
    await el.updateComplete;
    expect(headlines(el)[0]).toBe('neu');
  });

  /*
   * Der Kern der Entscheidung: „Passung" und „Netz-Tempo" sind DA und tot. Ein
   * späterer Beitrag, der sie „endlich anschliesst", indem er sie auf die
   * Magnitude legt, macht dieses Tor rot.
   */
  it('lässt Passung und Netz-Tempo abgeschaltet, solange das Bureau nicht rechnet', async () => {
    seed([candidate({ id: 'a' })]);
    const el = await sichtung();
    const sort = chips(el, 'sort');
    const disabled = sort.filter((c) => c.disabled);
    expect(disabled).toHaveLength(2);
    // Und die beiden ARBEITENDEN sind nicht abgeschaltet.
    expect(sort.filter((c) => !c.disabled)).toHaveLength(2);
    for (const chip of disabled) {
      // Die Fussnoten-Marke steht am Knopf, nicht nur im Fusstext.
      expect(chip.textContent).toContain('°');
    }
  });
});

describe('Die Filter', () => {
  it('blendet unterhalb der gewählten Magnitude aus', async () => {
    seed([
      candidate({ id: 'a', title: 'leise', magnitude: 0.1 }),
      candidate({ id: 'b', title: 'laut', magnitude: 0.8 }),
    ]);
    const el = await sichtung();
    expect(headlines(el)).toHaveLength(2);

    const steps = chips(el, 'magnitude');
    steps[2].click(); // ≥ 0.40
    await el.updateComplete;
    expect(headlines(el)).toEqual(['laut']);
  });

  it('nimmt die empfohlene Schwelle vom Server, nicht aus dem Code', async () => {
    seed([
      candidate({ id: 'a', title: 'unter', magnitude: 0.5 }),
      candidate({ id: 'b', title: 'über', magnitude: 0.8 }),
    ]);
    intakeState.recommendedThreshold.value = 0.7;
    const el = await sichtung();

    const steps = chips(el, 'magnitude');
    steps[3].click(); // „empfohlen"
    await el.updateComplete;
    expect(headlines(el)).toEqual(['über']);
  });

  it('markiert nur, was der Server empfiehlt', async () => {
    seed([
      candidate({ id: 'a', magnitude: 0.5 }),
      candidate({ id: 'b', magnitude: 0.8 }),
    ]);
    intakeState.recommendedThreshold.value = 0.7;
    const el = await sichtung();
    expect(root(el).querySelectorAll('.pick')).toHaveLength(1);
  });

  it('sucht in Überschrift, Anriss und Quelle', async () => {
    seed([
      candidate({ id: 'a', title: 'Hafenstreik', source_adapter: 'guardian' }),
      candidate({ id: 'b', title: 'Beben', description: 'im Hafen von Kobe' }),
      candidate({ id: 'c', title: 'Sonnensturm', source_adapter: 'nasa_eonet' }),
    ]);
    const el = await sichtung();
    const search = root(el).querySelector<HTMLInputElement>('.search');
    if (!search) throw new Error('kein Suchfeld');
    search.value = 'hafen';
    search.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(headlines(el).sort()).toEqual(['Beben', 'Hafenstreik']);
  });

  it('blendet eine Quelle über die Schiene aus', async () => {
    seed([
      candidate({ id: 'a', title: 'USGS', source_adapter: 'usgs_earthquakes' }),
      candidate({ id: 'b', title: 'NOAA', source_adapter: 'noaa_alerts' }),
    ]);
    const el = await sichtung();
    const items = [...root(el).querySelectorAll<HTMLButtonElement>('.rail__item')];
    expect(items).toHaveLength(2);
    items[0].click();
    await el.updateComplete;
    expect(headlines(el)).toHaveLength(1);
  });
});

describe('Die vier Tasten sind wirklich verdrahtet', () => {
  it('wählt mit der Leertaste aus', async () => {
    seed([candidate({ id: 'a' }), candidate({ id: 'b' })]);
    const el = await sichtung();
    press(el, ' ');
    await el.updateComplete;
    expect(root(el).querySelectorAll('.card--on')).toHaveLength(1);
  });

  it('bewegt den Cursor mit ↓ und wählt dort aus', async () => {
    seed([
      candidate({ id: 'a', title: 'erste', magnitude: 0.9 }),
      candidate({ id: 'b', title: 'zweite', magnitude: 0.5 }),
    ]);
    const el = await sichtung();
    press(el, 'ArrowDown');
    await el.updateComplete;
    press(el, ' ');
    await el.updateComplete;

    const cards = [...root(el).querySelectorAll('.card')];
    expect(cards[0].classList.contains('card--on')).toBe(false);
    expect(cards[1].classList.contains('card--on')).toBe(true);
  });

  it('nimmt mit ⏎ in den Eingang auf', async () => {
    seed([candidate({ id: 'a', magnitude: 0.9 }), candidate({ id: 'b', magnitude: 0.1 })]);
    const el = await sichtung();
    press(el, 'Enter');
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('in');
    expect(intakeState.get('b')?.stage).toBe('raw');
  });

  it('verwirft mit x', async () => {
    seed([candidate({ id: 'a', magnitude: 0.9 })]);
    const el = await sichtung();
    press(el, 'x');
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('out');
  });

  /*
   * Im Suchfeld ist „x" ein Buchstabe. Ohne diese Ausnahme hätte jeder, der
   * „Explosion" tippt, sein erstes Signal verworfen, bevor das zweite Zeichen
   * ankommt.
   */
  it('lässt die Tasten im Suchfeld in Ruhe', async () => {
    seed([candidate({ id: 'a' })]);
    const el = await sichtung();
    const search = root(el).querySelector<HTMLInputElement>('.search');
    if (!search) throw new Error('kein Suchfeld');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('raw');
  });

  it('läuft nicht über das Ende hinaus', async () => {
    seed([candidate({ id: 'a' })]);
    const el = await sichtung();
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    press(el, 'ArrowDown');
    await el.updateComplete;
    press(el, 'Enter');
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('in');
  });
});

describe('Die Knöpfe an der Karte', () => {
  it('nimmt einzeln auf', async () => {
    seed([candidate({ id: 'a' })]);
    const el = await sichtung();
    const admit = root(el).querySelector<HTMLButtonElement>('.row .act.row__grow');
    admit?.click();
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('in');
  });

  it('hält die Auswahl und den Zähler zusammen', async () => {
    seed([candidate({ id: 'a' }), candidate({ id: 'b' })]);
    const el = await sichtung();
    const boxes = [...root(el).querySelectorAll<HTMLButtonElement>('.box')];
    boxes[0].click();
    boxes[1].click();
    await el.updateComplete;
    expect(root(el).querySelector('.count')?.textContent?.trim()).toBe('2');
    expect(boxes[0].getAttribute('aria-checked')).toBe('true');
  });
});
