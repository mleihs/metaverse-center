/**
 * Lesesaal, Scan-Log und Nachhall — Schritt 6.
 *
 * Was hier geprüft wird, ist in allen drei Fällen dasselbe: **dass eine
 * Oberfläche nur behauptet, was ihre Daten hergeben.** Das ist die Regel, an der
 * dieser ganze Schritt entlanggebaut ist, und sie ist genau die Sorte Zusage,
 * die ein späterer Beitrag in bester Absicht bricht:
 *
 * - der Lesesaal gliedert nach Archetyp und Quelle, NICHT nach Ort — ein Signal
 *   im Eingang hat keinen;
 * - das Scan-Log zeigt „eingeordnet / aussortiert" und NICHT die Schleusen-
 *   Stufe — die beiden Tabellen teilen keinen Schlüssel;
 * - der Nachhall sammelt keine fremden Resonanzen ein, nur damit er nicht leer
 *   aussieht.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ⚠ Nebenwirkungs-Import ZUERST, sonst entfernt esbuild ihn und `@customElement`
// laeuft nie.
import '../src/components/intake/IntakeAftermathChamber.js';
import '../src/components/intake/IntakeReadingRoomModal.js';
import '../src/components/intake/IntakeScanLogModal.js';
import type { VelgIntakeAftermathChamber } from '../src/components/intake/IntakeAftermathChamber.js';
import type { VelgIntakeReadingRoomModal } from '../src/components/intake/IntakeReadingRoomModal.js';
import type { VelgIntakeScanLogModal } from '../src/components/intake/IntakeScanLogModal.js';
import { scannerApi } from '../src/services/api/index.js';
import type { ScanCandidate, ScanLogEntry } from '../src/services/api/ScannerApiService.js';
import { intakeState } from '../src/services/IntakeStateManager.js';
import { fromScanCandidate, type IntakeSignal } from '../src/types/intake.js';

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

function logEntry(over: Partial<ScanLogEntry> = {}): ScanLogEntry {
  return {
    id: 'l1',
    source_id: 'x1',
    source_name: 'Bluesky',
    title: 'Ein Beitrag',
    url: null,
    scanned_at: '2026-09-02T06:00:00Z',
    classified: false,
    source_category: null,
    magnitude: null,
    intake_status: null,
    ...over,
  };
}

/** Signale einspielen und danach auf die gewünschte Stufe heben. */
function seedEntrance(candidates: ScanCandidate[]): void {
  const map = new Map<string, IntakeSignal>();
  for (const c of candidates) {
    const s = fromScanCandidate(c);
    map.set(s.id, { ...s, stage: 'in' });
  }
  intakeState.signals.value = map;
}

/**
 * Element anlegen, oeffnen, an den Baum haengen, ersten Rendervorgang abwarten.
 *
 * Die Schranke traegt `open` und `updateComplete` im TYP, statt sie am
 * Aufrufort hereinzucasten: ein `as unknown as` waere hier zwar ausserhalb von
 * `src/` erlaubt, aber es ist genau der Griff, den das Haus verboten hat, weil
 * er Formabweichungen versteckt.
 */
async function mount<
  T extends HTMLElement & { updateComplete: Promise<unknown>; open?: boolean },
>(tag: string): Promise<T> {
  const el = document.createElement(tag) as T;
  // `open` ist OPTIONAL in der Schranke: die Nachhall-Kammer ist ein Fach im
  // Brett, kein Modal, und hat keines. `typecheck:tests` hat genau das
  // gefunden — ein Tor, das es laut aelterer Notiz gar nicht geben sollte.
  if ('open' in el) el.open = true;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function root(el: HTMLElement): ShadowRoot {
  const r = el.shadowRoot;
  if (!r) throw new Error('kein shadowRoot — die Komponente hat nicht gerendert');
  return r;
}

beforeEach(() => {
  intakeState.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Der Lesesaal', () => {
  it('zeigt nur, was im Eingang liegt', async () => {
    seedEntrance([candidate({ id: 'a' }), candidate({ id: 'b' })]);
    intakeState.toTriage('b'); // zurück in die Sichtung
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    expect(root(el).querySelectorAll('.row')).toHaveLength(1);
  });

  it('gliedert nach Archetyp und wechselt auf Quelle', async () => {
    seedEntrance([
      candidate({ id: 'a', source_category: 'natural_disaster', source_adapter: 'usgs_earthquakes' }),
      candidate({ id: 'b', source_category: 'pandemic', source_adapter: 'usgs_earthquakes' }),
    ]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    // Zwei Archetypen -> zwei Gruppen.
    expect(root(el).querySelectorAll('.group__head')).toHaveLength(2);

    const chips = [...root(el).querySelectorAll<HTMLButtonElement>('.group-by .chip')];
    expect(chips).toHaveLength(2); // NICHT drei: „Ort" gibt es an dieser Stelle nicht
    chips[1].click(); // nach Quelle
    await el.updateComplete;
    // Eine Quelle -> eine Gruppe.
    expect(root(el).querySelectorAll('.group__head')).toHaveLength(1);
  });

  /*
   * Der Bauplan will „Gliedern nach [Ort | Archetyp | Quelle]". Ort ist
   * strukturell unmöglich: der Ort entsteht erst in der Linse des
   * Schmelztiegels, also einen Schritt später. Dieser Test hält fest, dass
   * niemand ihn „nachreicht" und damit eine Gruppe „ohne Ort" für alles baut.
   */
  it('bietet KEINE Gliederung nach Ort an', async () => {
    seedEntrance([candidate({ id: 'a' })]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    const labels = [...root(el).querySelectorAll('.group-by .chip')].map((c) =>
      c.textContent?.trim().toLowerCase(),
    );
    expect(labels).not.toContain('place');
    expect(labels).not.toContain('ort');
  });

  it('zählt je Archetyp', async () => {
    seedEntrance([
      candidate({ id: 'a', source_category: 'pandemic' }),
      candidate({ id: 'b', source_category: 'pandemic' }),
      candidate({ id: 'c', source_category: 'natural_disaster' }),
    ]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    const counts = [...root(el).querySelectorAll('.tally__n')].map((n) => n.textContent?.trim());
    expect(counts).toEqual(['2', '1']);
  });

  it('schickt ein Signal zurück in die Sichtung', async () => {
    seedEntrance([candidate({ id: 'a' })]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    const acts = [...root(el).querySelectorAll<HTMLButtonElement>('.acts .act')];
    acts[1].click(); // „Zurück zur Sichtung"
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('raw');
  });

  it('verwirft aus dem Lesesaal', async () => {
    seedEntrance([candidate({ id: 'a' })]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    const acts = [...root(el).querySelectorAll<HTMLButtonElement>('.acts .act')];
    acts[2].click(); // „Verwerfen"
    await el.updateComplete;
    expect(intakeState.get('a')?.stage).toBe('out');
  });

  it('meldet den Schmelztiegel nach oben, statt ihn selbst zu öffnen', async () => {
    seedEntrance([candidate({ id: 'a' })]);
    const el = await mount<VelgIntakeReadingRoomModal>('velg-intake-reading-room-modal');
    let seen = '';
    el.addEventListener('intake-transform', (e) => {
      seen = (e as CustomEvent<{ signalId: string }>).detail.signalId;
    });
    root(el).querySelector<HTMLButtonElement>('.acts .act--primary')?.click();
    expect(seen).toBe('a');
  });
});

describe('Das Scan-Log', () => {
  it('rechnet je Quelle aus, wie viel durchkam', async () => {
    vi.spyOn(scannerApi, 'getScanLog').mockResolvedValue({
      success: true,
      data: [
        logEntry({ id: '1', source_name: 'Bluesky', classified: false }),
        logEntry({ id: '2', source_name: 'Bluesky', classified: false }),
        logEntry({ id: '3', source_name: 'Bluesky', classified: true }),
        logEntry({ id: '4', source_name: 'noaa_alerts', classified: true }),
      ],
      meta: { total: 4 },
    });

    const el = await mount<VelgIntakeScanLogModal>('velg-intake-scan-log-modal');
    await el.updateComplete;
    await el.updateComplete;

    const ratios = [...root(el).querySelectorAll('.funnel__ratio')].map((r) =>
      r.textContent?.trim(),
    );
    expect(ratios).toEqual(['1/3', '1/1']);
  });

  /*
   * Der eigentliche Wert dieser View: die aussortierten Zeilen sind das
   * Rauschen, das die Sichtung nicht zeigen kann. Wer den Filter kaputtmacht,
   * nimmt der Schleuse ihre einzige Antwort auf „lohnt sich diese Quelle".
   */
  it('filtert auf die aussortierten Zeilen', async () => {
    vi.spyOn(scannerApi, 'getScanLog').mockResolvedValue({
      success: true,
      data: [
        logEntry({ id: '1', title: 'durch', classified: true }),
        logEntry({ id: '2', title: 'raus', classified: false }),
      ],
      meta: { total: 2 },
    });

    const el = await mount<VelgIntakeScanLogModal>('velg-intake-scan-log-modal');
    await el.updateComplete;
    await el.updateComplete;
    expect(root(el).querySelectorAll('tbody tr')).toHaveLength(2);

    const chips = [...root(el).querySelectorAll<HTMLButtonElement>('.group .chip')];
    chips[2].click(); // „aussortiert"
    await el.updateComplete;

    const rows = [...root(el).querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('raus');
  });

  it('sagt es, wenn das Protokoll nicht lesbar war', async () => {
    vi.spyOn(scannerApi, 'getScanLog').mockResolvedValue({
      success: false,
      error: { message: 'kaputt', code: 'HTTP_500' },
    });
    const el = await mount<VelgIntakeScanLogModal>('velg-intake-scan-log-modal');
    await el.updateComplete;
    await el.updateComplete;
    expect(root(el).querySelector('velg-error-state')).not.toBeNull();
  });
});

describe('Der Nachhall', () => {
  /*
   * 14 Impacts liegen auf Prod — aber sie gehören zu einer Resonanz, die nicht
   * durch die Schleuse kam. Die Kammer greift sie NICHT ab. Ein Test dafür,
   * dass eine leere Kammer leer bleibt, klingt seltsam, bis jemand sie „endlich
   * mit Leben füllt".
   */
  it('bleibt leer, solange nichts aus der Schleuse ausgelöst wurde', async () => {
    seedEntrance([candidate({ id: 'a' })]);
    const el = await mount<VelgIntakeAftermathChamber>('velg-intake-aftermath-chamber');
    expect(root(el).querySelectorAll('.entry')).toHaveLength(0);
    expect(root(el).querySelectorAll('.empty').length).toBeGreaterThan(0);
  });

  it('nennt die Abwesenheit der Echos als Satz, nicht als leeren Abschnitt', async () => {
    const el = await mount<VelgIntakeAftermathChamber>('velg-intake-aftermath-chamber');
    const text = root(el).textContent ?? '';
    expect(text.toLowerCase()).toContain('echo');
  });
});
