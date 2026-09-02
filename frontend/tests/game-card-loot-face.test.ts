/**
 * Der Flipper darf NUR bei `type="loot"` entstehen.
 *
 * Warum das ein Test ist und keine Selbstverständlichkeit: `VelgGameCard` wird
 * heute an Dutzenden Stellen für Agenten und Gebäude gerendert. Eine
 * zusätzliche Schicht mit `transform-style: preserve-3d` über der Karte legt
 * einen neuen Stapel- und Enthaltungskontext an — genau das, was in diesem
 * Projekt schon einmal `position: fixed`-Modale zerbrochen hat. Der Schaden
 * wäre nicht sichtbar, wo er entsteht, sondern irgendwo anders.
 *
 * Deshalb wird hier nicht geprüft, dass die Beutekarte funktioniert, sondern
 * dass die anderen beiden Typen ihren DOM auf die Zeichen genau behalten.
 */

import { describe, expect, it } from 'vitest';

// ⚠ Nebenwirkungs-Import ZUERST. Kaeme die Klasse nur in Typ-Positionen vor,
// entfernte esbuild den Import restlos — `@customElement` liefe nie, das
// Element bliebe ein nicht aufgewertetes HTMLElement, und jede Pruefung
// scheiterte an einem fehlenden shadowRoot statt an der Sache.
import '../src/components/shared/VelgGameCard.js';
import type { VelgGameCard } from '../src/components/shared/VelgGameCard.js';

/** Element anlegen, an den Baum hängen, ersten Rendervorgang abwarten. */
async function karte(props: Partial<VelgGameCard>): Promise<VelgGameCard> {
  const el = document.createElement('velg-game-card') as VelgGameCard;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function wurzel(el: VelgGameCard): ShadowRoot {
  const r = el.shadowRoot;
  if (!r) throw new Error('kein shadowRoot — die Komponente hat nicht gerendert');
  return r;
}

describe('VelgGameCard: die verdeckte Beutekarte', () => {
  it('legt für agent und building KEINEN Flipper an', async () => {
    for (const type of ['agent', 'building'] as const) {
      const el = await karte({ type, name: 'X' });
      const r = wurzel(el);
      expect(r.querySelector('.card-flipper'), `${type} bekam einen Flipper`).toBeNull();
      expect(r.querySelector('.card-back'), `${type} bekam eine Rückseite`).toBeNull();
      // Die Karte selbst muss weiterhin direkt in der Perspektive sitzen.
      expect(r.querySelector('.card-perspective > .card')).not.toBeNull();
      el.remove();
    }
  });

  it('legt für loot einen Flipper mit zwei Flächen an', async () => {
    const el = await karte({ type: 'loot', name: 'Die Scherbe', faceDown: true });
    const r = wurzel(el);
    expect(r.querySelector('.card-flipper')).not.toBeNull();
    expect(r.querySelector('.card-flipper__face--front .card')).not.toBeNull();
    expect(r.querySelector('.card-flipper__face--back .card-back')).not.toBeNull();
    el.remove();
  });

  it('dreht sich nur, solange faceDown gesetzt ist', async () => {
    const el = await karte({ type: 'loot', name: 'Die Scherbe', faceDown: true });
    expect(wurzel(el).querySelector('.card-flipper--down')).not.toBeNull();

    el.faceDown = false;
    await el.updateComplete;
    expect(wurzel(el).querySelector('.card-flipper--down')).toBeNull();
    el.remove();
  });

  it('reveal() deckt auf, meldet es einmal und ist danach wirkungslos', async () => {
    const el = await karte({ type: 'loot', name: 'Die Scherbe', faceDown: true, rarity: 'legendary' });
    const meldungen: CustomEvent[] = [];
    el.addEventListener('velg-card-revealed', (e) => meldungen.push(e as CustomEvent));

    el.reveal();
    await el.updateComplete;
    expect(el.faceDown).toBe(false);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0].detail).toMatchObject({ name: 'Die Scherbe', rarity: 'legendary' });

    // Ein zweiter Aufruf darf die Zeremonie nicht ein zweites Mal auslösen.
    el.reveal();
    await el.updateComplete;
    expect(meldungen).toHaveLength(1);
    el.remove();
  });

  it('zeigt den Verrat als eigene Schicht, und nur wenn es etwas zu verraten gibt', async () => {
    const ohne = await karte({ type: 'loot', name: 'A', faceDown: true, rarityTell: 'none' });
    expect(wurzel(ohne).querySelector('.card-back__aura')).toBeNull();
    ohne.remove();

    for (const tell of ['rare', 'legendary'] as const) {
      const el = await karte({ type: 'loot', name: 'A', faceDown: true, rarityTell: tell });
      const r = wurzel(el);
      expect(r.querySelector('.card-back__aura'), `${tell} ohne Aura`).not.toBeNull();
      expect(r.querySelector(`.card-back--tell-${tell}`)).not.toBeNull();
      el.remove();
    }
  });
});
