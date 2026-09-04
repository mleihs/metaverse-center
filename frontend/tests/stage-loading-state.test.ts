/**
 * DREI ZUSTAENDE BRAUCHEN DREI WERTE.
 *
 * Beide Buehnen des Dashboards bekamen bis zum 04.09.2026 nur
 * `participation: X | null`, und `null` hiess zweierlei: „wird noch geladen"
 * UND „nimmt an nichts teil". Sie konnten es nicht auseinanderhalten und
 * zeigten deshalb bei jedem Aufruf kurz „nichts verlangt nach dir" — eine
 * Auskunft, die niemand geprueft hatte und die eine halbe Sekunde spaeter
 * wieder verschwand. Vom Benutzer gemeldet.
 *
 * Das ist schlimmer als ein fehlendes Wartezeichen: eine unfertige Anzeige
 * sagt nichts, diese sagte etwas moeglicherweise Falsches.
 *
 * Geprueft wird die WIRKUNG, nicht die Form: steht der Leerzustandssatz auf
 * dem Bildschirm, waehrend geladen wird? Ein Test auf „das Merkmal existiert"
 * waere gruen geblieben, haette jemand die Abfrage im Render vergessen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api/index.js', () => ({ settingsApi: {}, adminApi: {} }));

// ⚠ Nebenwirkungs-Importe ZUERST, sonst entfernt esbuild sie und
// @customElement laeuft nie — die Elemente blieben ohne shadowRoot.
import '../src/components/dashboard/atlas/AtlasStage.js';
import '../src/components/dashboard/DashboardStage.js';

/** Der Satz, den keine der beiden Buehnen waehrend des Ladens sagen darf. */
const LEERSATZ = /nothing requires you|nichts verlangt nach dir/i;

async function buehne(tag: string, loading: boolean): Promise<HTMLElement> {
  const el = document.createElement(tag) as HTMLElement & {
    loading: boolean;
    participation: unknown;
    updateComplete: Promise<unknown>;
  };
  el.loading = loading;
  el.participation = null;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function text(el: HTMLElement): string {
  const r = el.shadowRoot;
  if (!r) throw new Error(`${el.tagName} hat nicht gerendert`);
  return r.textContent ?? '';
}

describe.each(['velg-atlas-stage', 'velg-dashboard-stage'])('%s', (tag) => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('sagt waehrend des Ladens NICHT, dass nichts ansteht', async () => {
    expect(text(await buehne(tag, true))).not.toMatch(LEERSATZ);
  });

  it('zeigt waehrend des Ladens den Vermessungstakt', async () => {
    const el = await buehne(tag, true);
    expect(el.shadowRoot?.querySelector('velg-survey-loader')).not.toBeNull();
  });

  /*
   * Die Gegenprobe. Ohne sie waere ein Bauteil, das den Leerzustand GANZ
   * verloren hat, ebenfalls gruen — und ein Leser ohne Einsatz saehe fuer
   * immer ein Wartezeichen.
   */
  it('sagt es, sobald der Abruf durch ist', async () => {
    const el = await buehne(tag, false);
    expect(text(el)).toMatch(LEERSATZ);
    expect(el.shadowRoot?.querySelector('velg-survey-loader')).toBeNull();
  });
});
