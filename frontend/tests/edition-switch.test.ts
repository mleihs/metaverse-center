/**
 * Der Editionsumschalter hat ZWEI ARIA-Gestalten, und das ist der Grund für
 * diesen Test.
 *
 * Er steht an zwei Orten, die verschiedene Arten von Behälter sind: im
 * Benutzermenü in einem `role="menu"`, wo das richtige Kind `menuitemradio`
 * ist, und im SYS-Bereich des Headers in einem `role="navigation"`, wo
 * `menuitemradio` gar keine Bedeutung hat und das Paar zwei Schaltknöpfe mit
 * `aria-pressed` sind.
 *
 * Warum das geprüft werden muss und nicht bloß dasteht: die jeweils unbenutzte
 * Hälfte des Paares muss VERSCHWINDEN, nicht leer sein. `aria-checked=""` ist
 * kein „kein Wert", sondern ein ungültiger, und ein Knopf, der `aria-checked`
 * UND `aria-pressed` trägt, hat überhaupt keinen definierten Zustand. Auf dem
 * Bildschirm sieht beides identisch aus — die gewählte Platte ist eingefärbt,
 * das Umschalten funktioniert, und nur ein Screenreader merkt den Unterschied.
 * Genau die Art Fehler, die kein Blick auf die Seite findet.
 *
 * Der eingefärbte Zustand hängt in der CSS an `[aria-checked='true']` UND
 * `[aria-pressed='true']`; fiele eines der beiden Attribute weg, wäre die
 * Auswahl unsichtbar. Auch das steht hier.
 */

import { beforeEach, describe, expect, it } from 'vitest';

// ⚠ Nebenwirkungs-Import ZUERST, sonst entfernt esbuild ihn und
// `@customElement` läuft nie — das Element bliebe ohne shadowRoot.
import '../src/components/shared/VelgEditionSwitch.js';
import type { VelgEditionSwitch } from '../src/components/shared/VelgEditionSwitch.js';
import { appState } from '../src/services/AppStateManager.js';

async function schalter(context?: 'menu' | 'standalone'): Promise<VelgEditionSwitch> {
  const el = document.createElement('velg-edition-switch') as VelgEditionSwitch;
  if (context) el.context = context;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function platten(el: VelgEditionSwitch): HTMLButtonElement[] {
  const r = el.shadowRoot;
  if (!r) throw new Error('kein shadowRoot — die Komponente hat nicht gerendert');
  return [...r.querySelectorAll<HTMLButtonElement>('.edition__opt')];
}

describe('VelgEditionSwitch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    appState.setPlatformSkin('dark');
  });

  it('trägt die Gruppenrolle auf dem Wirt, damit menuitemradio im Menü gültig ist', async () => {
    const el = await schalter('menu');
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBeTruthy();
  });

  it('im Menü: menuitemradio mit aria-checked, KEIN aria-pressed', async () => {
    const el = await schalter('menu');
    const opts = platten(el);
    expect(opts).toHaveLength(2);
    for (const opt of opts) {
      expect(opt.getAttribute('role')).toBe('menuitemradio');
      expect(opt.hasAttribute('aria-checked')).toBe(true);
      expect(opt.hasAttribute('aria-pressed'), 'beide Zustandsattribute zugleich').toBe(false);
    }
  });

  it('freistehend: aria-pressed, KEIN aria-checked und keine geliehene Menürolle', async () => {
    const el = await schalter('standalone');
    const opts = platten(el);
    expect(opts).toHaveLength(2);
    for (const opt of opts) {
      expect(opt.hasAttribute('role'), 'menuitemradio außerhalb eines Menüs').toBe(false);
      expect(opt.hasAttribute('aria-pressed')).toBe(true);
      expect(opt.hasAttribute('aria-checked'), 'beide Zustandsattribute zugleich').toBe(false);
    }
  });

  it('freistehend ist die Vorgabe — ein Umschalter ohne Angabe leiht sich keine Menürolle', async () => {
    const opts = platten(await schalter());
    expect(opts.every((o) => !o.hasAttribute('role'))).toBe(true);
  });

  /*
   * Der Wert 'true' ist nicht Kosmetik: die CSS färbt über
   * [aria-checked='true'] / [aria-pressed='true'] ein. Ein String 'True' oder
   * ein Boolean-Attribut ohne Wert wäre eine unsichtbare Auswahl.
   */
  it.each(['menu', 'standalone'] as const)(
    'markiert in der %s-Gestalt genau eine Platte mit dem Literal "true"',
    async (context) => {
      const el = await schalter(context);
      const attr = context === 'menu' ? 'aria-checked' : 'aria-pressed';

      const gewaehlt = () => platten(el).filter((o) => o.getAttribute(attr) === 'true');
      expect(gewaehlt()).toHaveLength(1);
      expect(gewaehlt()[0].textContent?.trim()).toBe('Phosphor');

      appState.setPlatformSkin('atlas');
      await el.updateComplete;
      expect(gewaehlt()).toHaveLength(1);
      expect(gewaehlt()[0].textContent?.trim()).toBe('Paper');
    },
  );

  it('schaltet den Skin im Zustand um, wenn eine Platte gedrückt wird', async () => {
    const el = await schalter('menu');
    platten(el)[1].click();
    expect(appState.platformSkin.value).toBe('atlas');
    platten(el)[0].click();
    expect(appState.platformSkin.value).toBe('dark');
  });

  it('lässt die Beschriftung nur auf Verlangen weg', async () => {
    const mit = await schalter();
    expect(mit.shadowRoot?.querySelector('.edition__label')).not.toBeNull();

    const ohne = await schalter();
    ohne.noLabel = true;
    await ohne.updateComplete;
    expect(ohne.shadowRoot?.querySelector('.edition__label')).toBeNull();
  });
});
