/**
 * Die zwei Helfer, die aus doppeltem Code wurden.
 *
 * `fanGeometry` und `setupScrollReveal` standen bis 03.09.2026 als private
 * Methoden in je ZWEI Komponenten — wörtlich gleich, seit März 2026, und von
 * keinem Test berührt. Geteilter Code ohne Test ist eine Kopie mit besserer
 * Tarnung: sie kann sich nicht mehr auseinanderentwickeln, aber niemand
 * merkt, wenn sie als Ganzes falsch wird.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fanGeometry } from '../src/utils/card-fan.js';
import { setupScrollReveal } from '../src/utils/scroll-reveal.js';

describe('fanGeometry', () => {
  it('legt ein einzelnes Blatt gerade hin – ein Fächer aus einer Karte ist keiner', () => {
    expect(fanGeometry(0, 1)).toEqual({ rot: 0, y: 0 });
    expect(fanGeometry(0, 0)).toEqual({ rot: 0, y: 0 });
  });

  it('spiegelt die Hand um die Mitte', () => {
    const total = 5;
    const first = fanGeometry(0, total);
    const last = fanGeometry(total - 1, total);
    expect(first.rot).toBeCloseTo(-last.rot);
    expect(first.y).toBeCloseTo(last.y);
  });

  it('lässt die mittlere Karte aufrecht und ganz oben liegen', () => {
    expect(fanGeometry(2, 5)).toEqual({ rot: 0, y: 0 });
  });

  it('senkt die äußeren Karten weiter ab als die inneren', () => {
    const inner = fanGeometry(1, 5);
    const outer = fanGeometry(0, 5);
    expect(outer.y).toBeGreaterThan(inner.y);
  });

  it('deckelt die Auffächerung, damit eine volle Hand keinen Kreis bildet', () => {
    // Die Spanne zwischen erster und letzter Karte ist (total-1)/total der
    // Obergrenze: sie NÄHERT sich 30 Grad an und erreicht sie nie. Der erste
    // Anlauf dieses Tests behauptete exakte Gleichheit ab sieben Karten und
    // wurde zu Recht rot – die Funktion war richtig, die Annahme falsch.
    const spread = (total: number) =>
      Math.abs(fanGeometry(0, total).rot) + Math.abs(fanGeometry(total - 1, total).rot);

    for (const total of [7, 12, 20, 40, 200]) {
      expect(spread(total)).toBeLessThan(30);
    }

    // Unterhalb der Grenze wächst der Fächer spürbar, oberhalb kaum noch.
    expect(spread(6) - spread(3)).toBeGreaterThan(1);
    expect(spread(40) - spread(20)).toBeLessThan(1);
  });
});

describe('setupScrollReveal', () => {
  class FakeObserver {
    static instances: FakeObserver[] = [];
    observed: Element[] = [];
    disconnected = false;
    constructor(
      public cb: IntersectionObserverCallback,
      public options: IntersectionObserverInit,
    ) {
      FakeObserver.instances.push(this);
    }
    observe(el: Element) {
      this.observed.push(el);
    }
    unobserve = vi.fn();
    disconnect() {
      this.disconnected = true;
    }
  }

  beforeEach(() => {
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  const root = (html: string): ParentNode => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host;
  };

  it('beobachtet nur, was noch nicht eingeblendet ist', () => {
    const r = root(`
      <p class="scroll-reveal"></p>
      <p class="scroll-reveal in-view"></p>
      <p class="other"></p>
    `);
    setupScrollReveal(r, '.scroll-reveal');
    expect(FakeObserver.instances[0].observed).toHaveLength(1);
  });

  it('trennt den vorigen Beobachter, statt ihn liegen zu lassen', () => {
    const r = root('<p class="scroll-reveal"></p>');
    const first = setupScrollReveal(r, '.scroll-reveal') as unknown as FakeObserver;
    setupScrollReveal(r, '.scroll-reveal', first as unknown as IntersectionObserver);
    expect(first.disconnected).toBe(true);
  });

  it('blendet ein und meldet das Element ab – Einblenden ist ein Ereignis', () => {
    const r = root('<p class="scroll-reveal"></p>');
    setupScrollReveal(r, '.scroll-reveal');
    const obs = FakeObserver.instances[0];
    const el = obs.observed[0];

    obs.cb(
      [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    );

    expect(el.classList.contains('in-view')).toBe(true);
    expect(obs.unobserve).toHaveBeenCalledWith(el);
  });

  it('meldet beim EIGENEN Beobachter ab, nicht beim zuletzt gesetzten', () => {
    // Der doppelte Code las das Feld `this._observer` aus der Closure. Lief
    // der Aufbau erneut, meldete der ALTE Rückruf beim NEUEN Beobachter ab –
    // ein Element blieb dann für immer beobachtet.
    const r = root('<p class="scroll-reveal"></p>');
    setupScrollReveal(r, '.scroll-reveal');
    const first = FakeObserver.instances[0];
    setupScrollReveal(r, '.scroll-reveal');
    const second = FakeObserver.instances[1];

    first.cb(
      [{ isIntersecting: true, target: first.observed[0] } as unknown as IntersectionObserverEntry],
      first as unknown as IntersectionObserver,
    );

    expect(first.unobserve).toHaveBeenCalled();
    expect(second.unobserve).not.toHaveBeenCalled();
  });

  it('ignoriert, was den Schwellwert nicht erreicht', () => {
    const r = root('<p class="scroll-reveal"></p>');
    setupScrollReveal(r, '.scroll-reveal');
    const obs = FakeObserver.instances[0];
    const el = obs.observed[0];

    obs.cb(
      [{ isIntersecting: false, target: el } as unknown as IntersectionObserverEntry],
      obs as unknown as IntersectionObserver,
    );

    expect(el.classList.contains('in-view')).toBe(false);
    expect(obs.unobserve).not.toHaveBeenCalled();
  });
});
