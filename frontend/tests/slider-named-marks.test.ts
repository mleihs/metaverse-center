/**
 * Benannte Rasten am Regler — und die eine Zahl, die niemand hören darf.
 *
 * Der Regler ist numerisch geblieben: er trägt Indizes 0–4, und der Aufrufer
 * bildet sie auf Stunden ab. Das ist richtig für einen geteilten Baustein,
 * hat aber eine Kehrseite, und die ist der Grund für diese Datei.
 *
 * OHNE `aria-valuetext` sagt eine Vorlesesoftware „2". Zwei ist eine Zahl, die
 * auf dem Bildschirm nirgends steht und ausserhalb dieses Reglers nichts
 * bedeutet — sie ist ein Umsetzungsdetail, das nach aussen gelangt. Wer den
 * Regler nicht sieht, bekäme also die einzige Angabe, die keine ist.
 *
 * Die zweite Zusicherung ist der Rückfall. Trifft der Wert keine Raste, darf
 * die Anzeige KEINEN Namen nennen: ein Regler, der „regelmässig" sagt,
 * während er zwischen zwei Rasten steht, behauptet etwas Falsches, und das
 * ist schlimmer als eine nackte Zahl.
 *
 * Die dritte hält fest, dass die Erweiterung die vorhandenen Aufrufer nichts
 * kostet: ohne `marks` verhält sich der Regler genau wie vorher.
 */

import { beforeEach, describe, expect, it } from 'vitest';

// ⚠ Nebenwirkungs-Import: käme die Klasse nur in Typ-Positionen vor, entfernte
// esbuild ihn restlos und `@customElement` liefe nie.
await import('../src/components/shared/VelgForecastSlider.js');
type Slider = import('../src/components/shared/VelgForecastSlider.js').VelgForecastSlider;
type SliderMark = import('../src/components/shared/VelgForecastSlider.js').SliderMark;

const RASTEN: SliderMark[] = [
  { value: 0, label: 'selten', hint: 'alle 48 Stunden', tick: '48' },
  { value: 1, label: 'gelegentlich', hint: 'alle 24 Stunden', tick: '24' },
  { value: 2, label: 'regelmässig', hint: 'alle 12 Stunden', tick: '12' },
  { value: 3, label: 'oft', hint: 'alle 6 Stunden', tick: '6' },
  { value: 4, label: 'lebhaft', hint: 'alle 4 Stunden', tick: '4' },
];

async function bauen(props: Partial<Slider> = {}): Promise<Slider> {
  const el = document.createElement('velg-forecast-slider') as Slider;
  el.key = 'frequenz';
  el.label = 'Wie oft';
  el.min = 0;
  el.max = 4;
  el.step = 1;
  el.default = 2;
  el.value = 2;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function eingabe(el: Slider): HTMLInputElement {
  const input = el.shadowRoot?.querySelector<HTMLInputElement>('.slider__input');
  if (!input) throw new Error('kein Regler im Schatten');
  return input;
}

describe('Der Regler nennt den Namen, nicht den Index', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('aria-valuetext trägt Namen UND Stundenangabe', async () => {
    const el = await bauen({ marks: RASTEN, value: 2 });
    expect(eingabe(el).getAttribute('aria-valuetext')).toBe('regelmässig – alle 12 Stunden');
  });

  it('ein geschütztes Leerzeichen im Hinweis überlebt bis in aria-valuetext', async () => {
    // Der Regler darf den Text nicht normalisieren. Dass die Stufen ihn
    // MITBRINGEN, prüft continuation-steps.test.ts – hier steht nur, dass
    // er unterwegs nicht verlorengeht.
    //
    // ⚠ Die erste Fassung dieser Prüfung verglich gegen ein GEWÖHNLICHES
    // Leerzeichen und war deshalb grün, ohne etwas zu prüfen.
    const el = await bauen({
      marks: [{ value: 0, label: 'lebhaft', hint: 'alle 4\u00A0Stunden', tick: '4' }],
      min: 0,
      max: 0,
      value: 0,
    });
    expect(eingabe(el).getAttribute('aria-valuetext')).toBe('lebhaft – alle 4\u00A0Stunden');
  });

  it('die Anzeige nennt den Namen, nicht die Zahl', async () => {
    const el = await bauen({ marks: RASTEN, value: 0 });
    const text = el.shadowRoot?.querySelector('.slider__value')?.textContent ?? '';
    expect(text).toContain('selten');
    expect(text).toContain('alle 48 Stunden');
  });

  it('jede Raste bekommt eine Kerbe und ihre Beschriftung', async () => {
    const el = await bauen({ marks: RASTEN, value: 2 });
    expect(el.shadowRoot?.querySelectorAll('.slider__mark')).toHaveLength(5);
    const beschriftungen = Array.from(
      el.shadowRoot?.querySelectorAll('.slider__tick') ?? [],
      (n) => n.textContent?.trim(),
    );
    expect(beschriftungen).toEqual(['48', '24', '12', '6', '4']);
  });

  it('die getroffene Kerbe ist ausgezeichnet, und zwar genau eine', async () => {
    const el = await bauen({ marks: RASTEN, value: 3 });
    expect(el.shadowRoot?.querySelectorAll('.slider__mark--active')).toHaveLength(1);
    const aktiv = el.shadowRoot?.querySelector('.slider__tick--active');
    expect(aktiv?.textContent?.trim()).toBe('6');
  });
});

describe('Zwischen zwei Rasten wird kein Name behauptet', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ein Wert ohne Raste fällt auf die Zahl zurück', async () => {
    // Der Vergleich ist absichtlich exakt. Eine Raste „ungefähr" zu treffen
    // hiesse, einen Namen zu nennen, der nicht gilt.
    const el = await bauen({ marks: RASTEN, value: 2.5, unit: '' });
    expect(eingabe(el).getAttribute('aria-valuetext')).toBe('2.5');
    const text = el.shadowRoot?.querySelector('.slider__value')?.textContent ?? '';
    expect(text).not.toContain('regelmässig');
  });

  it('keine Kerbe ist dann ausgezeichnet', async () => {
    const el = await bauen({ marks: RASTEN, value: 2.5 });
    expect(el.shadowRoot?.querySelectorAll('.slider__mark--active')).toHaveLength(0);
  });
});

describe('Ohne Rasten bleibt alles, wie es war', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('die Anzeige trägt Zahl und Einheit', async () => {
    const el = await bauen({ min: 0, max: 300, default: 100, value: 125, unit: '%' });
    const text = el.shadowRoot?.querySelector('.slider__value')?.textContent?.trim() ?? '';
    expect(text).toBe('125%');
    expect(eingabe(el).getAttribute('aria-valuetext')).toBe('125%');
  });

  it('es wird keine Kerbenleiste gebaut', async () => {
    const el = await bauen({ min: 0, max: 300, default: 100, value: 125, unit: '%' });
    expect(el.shadowRoot?.querySelector('.slider__ticks')).toBeNull();
    expect(el.shadowRoot?.querySelectorAll('.slider__mark')).toHaveLength(0);
  });

  it('die Vorgabe-Kerbe bleibt in beiden Fällen stehen', async () => {
    const ohne = await bauen({ min: 0, max: 300, default: 100, value: 125, unit: '%' });
    expect(ohne.shadowRoot?.querySelector('.slider__default-tick')).not.toBeNull();
    const mit = await bauen({ marks: RASTEN, value: 2 });
    expect(mit.shadowRoot?.querySelector('.slider__default-tick')).not.toBeNull();
  });
});

describe('Der Wert, der hinausgeht, ist der Index', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('slider-change trägt die Rastenposition, nicht die Stunden', async () => {
    // Der Baustein bleibt numerisch; die Übersetzung in Stunden gehört dem
    // Aufrufer. Ein Regler, der seinen eigenen Wert übersetzt, wäre an der
    // nächsten Stelle im Weg.
    const el = await bauen({ marks: RASTEN, value: 2 });
    let gesehen: number | null = null;
    el.addEventListener('slider-change', (e) => {
      gesehen = (e as CustomEvent<{ value: number }>).detail.value;
    });
    const input = eingabe(el);
    input.value = '4';
    input.dispatchEvent(new Event('input'));
    expect(gesehen).toBe(4);
  });
});
