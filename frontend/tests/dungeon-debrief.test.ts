/**
 * Das Nachbesprechungs-Terminal — was daran nicht verrutschen darf.
 *
 * Drei Dinge sind hier keine Geschmacksfrage, sondern eine Kopplung an den
 * Server oder an die Spielregel:
 *
 * 1. DIE NUMMER IM BEFEHL zählt nur die VERTEILBAREN Stücke. Zählte die Bühne
 *    die Auto-Wirkungen mit, zeigte `assign 3` auf ein anderes Stück als das,
 *    auf das der Spieler geklickt hat — ohne Fehlermeldung, mit falscher
 *    Wirkung. Das ist der teuerste denkbare Fehler in dieser Komponente.
 * 2. EINE GEFANGENE AGENTIN IST KEIN ZIEL. Der Server nimmt die Zuweisung
 *    nicht an; die Bühne darf sie deshalb nicht anbieten.
 * 3. `personality_modifier` DARF NICHT OHNE DIMENSION abgeschickt werden.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Der Zustandsverwalter zieht die API-Schicht mit, und die verlangt beim Laden
// `VITE_SUPABASE_*`. Der Stub haelt sie aus dem Test heraus — dieselbe Technik
// wie in `base-api-service-get-simulation-data.test.ts`.
vi.mock('../src/services/supabase/client.js', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}));

// ⚠ Nebenwirkungs-Import: käme die Klasse nur in Typ-Positionen vor, entfernte
// esbuild ihn restlos und `@customElement` liefe nie.
await import('../src/components/dungeon/VelgDungeonDebrief.js');
type VelgDungeonDebrief =
  import('../src/components/dungeon/VelgDungeonDebrief.js').VelgDungeonDebrief;
const { dungeonState } = await import('../src/services/DungeonStateManager.js');
import type { DungeonClientState, LootItem } from '../src/types/dungeon.js';

function stueck(id: string, effect_type: string, tier = 1): LootItem {
  return {
    id,
    name_en: `Item ${id}`,
    name_de: `Stück ${id}`,
    tier,
    effect_type,
    effect_params: { bonus: 1 },
    description_en: 'x',
    description_de: 'y',
  };
}

function agent(agent_id: string, agent_name: string, condition = 'healthy') {
  return { agent_id, agent_name, condition } as DungeonClientState['party'][number];
}

/**
 * Nur die Felder, die der Debrief liest. Der Rest des Zustands ist für diese
 * Komponente unerreichbar, und ein vollständiger Aufbau würde die Prüfung an
 * Felder binden, die sie gar nicht anfasst.
 */
function zustand(over: Partial<DungeonClientState>): DungeonClientState {
  return {
    phase: 'distributing',
    party: [agent('a1', 'Fenn'), agent('a2', 'Voss'), agent('a3', 'Ilva', 'captured')],
    pending_loot: [],
    loot_assignments: {},
    loot_suggestions: {},
    ...over,
  } as DungeonClientState;
}

/**
 * Bühne im Zustand `ready`.
 *
 * Die Komponente beginnt VERSIEGELT — das ist die Zeremonie und wird weiter
 * unten eigens geprüft. Die Prüfungen der Verteilungslogik wollen den Zustand
 * DANACH, also wird hier übersprungen wie ein Spieler es täte: über den Knopf,
 * nicht über einen Griff in den privaten Zustand.
 */
async function buehne(over: Partial<DungeonClientState>): Promise<VelgDungeonDebrief> {
  const el = await versiegelt(over);
  el.shadowRoot?.querySelector<HTMLButtonElement>('.siegel__ueberspringen')?.click();
  await el.updateComplete;
  return el;
}

/** Bühne, wie sie in die Phase eintritt: versiegelt. */
async function versiegelt(over: Partial<DungeonClientState>): Promise<VelgDungeonDebrief> {
  dungeonState.clientState.value = zustand(over);
  const el = document.createElement('velg-dungeon-debrief') as VelgDungeonDebrief;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function wurzel(el: VelgDungeonDebrief): ShadowRoot {
  const r = el.shadowRoot;
  if (!r) throw new Error('kein shadowRoot');
  return r;
}

/** Alle Befehle einsammeln, die die Bühne aussendet. */
function lauscher(el: VelgDungeonDebrief): string[] {
  const raus: string[] = [];
  el.addEventListener('terminal-command', (e) => raus.push((e as CustomEvent<string>).detail));
  return raus;
}

describe('VelgDungeonDebrief', () => {
  beforeEach(() => {
    dungeonState.clientState.value = null;
    dungeonState.timerRemaining.value = null;
    document.body.innerHTML = '';
  });

  it('rendert nichts außerhalb der Verteilungsphase', async () => {
    const el = await buehne({ phase: 'exploring' });
    expect(wurzel(el).querySelector('.buehne')).toBeNull();
  });

  it('zählt die Befehlsnummer NUR über die verteilbaren Stücke', async () => {
    // stress_heal und arc_modifier wirken ohne Wahl und dürfen nicht mitzählen.
    const el = await buehne({
      pending_loot: [
        stueck('L1', 'stress_heal'),
        stueck('L2', 'aptitude_boost'),
        stueck('L3', 'arc_modifier'),
        stueck('L4', 'memory'),
      ],
    });
    const befehle = lauscher(el);
    const r = wurzel(el);

    // Zweites verteilbares Stück (L4) wählen …
    const karten = r.querySelectorAll('velg-game-card');
    expect(karten).toHaveLength(2); // L2 und L4, nicht vier
    (karten[1] as HTMLElement).click();
    await el.updateComplete;

    // … und Fenn geben.
    const ziele = r.querySelectorAll<HTMLButtonElement>('.ziel');
    ziele[0].click();
    await el.updateComplete;

    // Wäre die Auto-Wirkung mitgezählt worden, stünde hier `assign 4`.
    expect(befehle).toEqual(['assign 2 Fenn']);
  });

  it('bietet eine gefangene Agentin nicht als Ziel an', async () => {
    const el = await buehne({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    const r = wurzel(el);
    (r.querySelector('velg-game-card') as HTMLElement).click();
    await el.updateComplete;

    const ziele = Array.from(r.querySelectorAll<HTMLButtonElement>('.ziel'));
    const ilva = ziele.find((b) => b.textContent?.includes('Ilva'));
    expect(ilva?.disabled, 'die gefangene Agentin war anklickbar').toBe(true);

    const befehle = lauscher(el);
    ilva?.click();
    await el.updateComplete;
    expect(befehle).toEqual([]);
  });

  it('schickt personality_modifier erst nach der Dimension', async () => {
    const el = await buehne({ pending_loot: [stueck('L1', 'personality_modifier')] });
    const befehle = lauscher(el);
    const r = wurzel(el);

    (r.querySelector('velg-game-card') as HTMLElement).click();
    await el.updateComplete;
    r.querySelectorAll<HTMLButtonElement>('.ziel')[0].click();
    await el.updateComplete;

    // Noch nichts gesendet — die Dimension fehlt.
    expect(befehle).toEqual([]);
    const dims = r.querySelectorAll<HTMLButtonElement>('.dimension');
    expect(dims).toHaveLength(5);

    dims[1].click(); // conscientiousness
    await el.updateComplete;
    expect(befehle).toEqual(['assign 1 Fenn conscientiousness']);
  });

  it('zeigt die Frist mit Uhr und Balken, sobald ein Zeitgeber läuft', async () => {
    dungeonState.timerRemaining.value = 125_000;
    const el = await buehne({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    const r = wurzel(el);
    expect(r.querySelector('[role="timer"]')?.textContent?.trim()).toBe('2:05');
    expect(r.querySelector('.frist__fuellung')).not.toBeNull();
    expect(r.querySelector('.frist--gefahr')).toBeNull();
  });

  it('wechselt bei 60 und 15 Sekunden die Stufe, ohne zu blinken', async () => {
    dungeonState.timerRemaining.value = 45_000;
    const warn = await buehne({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    expect(wurzel(warn).querySelector('.frist--warnung')).not.toBeNull();
    warn.remove();

    dungeonState.timerRemaining.value = 9_000;
    const gefahr = await buehne({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    expect(wurzel(gefahr).querySelector('.frist--gefahr')).not.toBeNull();
  });

  it('gibt den Bestätigen-Knopf erst frei, wenn nichts mehr offen ist', async () => {
    const el = await buehne({
      pending_loot: [stueck('L1', 'aptitude_boost'), stueck('L2', 'memory')],
      loot_assignments: { L1: 'a1' },
    });
    const knopf = wurzel(el).querySelector('velg-hold-button') as HTMLElement & {
      disabled: boolean;
    };
    expect(knopf.disabled, 'ein offenes Stück, Knopf trotzdem frei').toBe(true);

    el.remove();
    const fertig = await buehne({
      pending_loot: [stueck('L1', 'aptitude_boost'), stueck('L2', 'memory')],
      loot_assignments: { L1: 'a1', L2: 'a2' },
    });
    const knopf2 = wurzel(fertig).querySelector('velg-hold-button') as HTMLElement & {
      disabled: boolean;
    };
    expect(knopf2.disabled).toBe(false);
  });
});

describe('VelgDungeonDebrief: die Zeremonie', () => {
  beforeEach(() => {
    dungeonState.clientState.value = null;
    dungeonState.timerRemaining.value = null;
    document.body.innerHTML = '';
  });

  it('beginnt versiegelt — keine Karten, kein Ziel, aber die FRIST steht schon', async () => {
    dungeonState.timerRemaining.value = 240_000;
    const el = await versiegelt({
      pending_loot: [stueck('L1', 'aptitude_boost'), stueck('L2', 'memory')],
    });
    const r = wurzel(el);
    expect(r.querySelector('.siegel')).not.toBeNull();
    expect(r.querySelector('velg-game-card'), 'Karten vor dem Siegelbruch').toBeNull();
    expect(r.querySelector('.ziele'), 'Ziele vor dem Siegelbruch').toBeNull();
    // Der Zeitgeber laeuft ab Phasenbeginn, nicht ab dem Aufdecken — er muss
    // hinter dem Siegel sichtbar sein, sonst ist die Warnung wertlos.
    expect(r.querySelector('[role="timer"]')?.textContent?.trim()).toBe('4:00');
  });

  it('„Alles aufdecken" überspringt die Zeremonie vollständig', async () => {
    const el = await versiegelt({
      pending_loot: [stueck('L1', 'aptitude_boost'), stueck('L2', 'memory', 3)],
    });
    (wurzel(el).querySelector('.siegel__ueberspringen') as HTMLButtonElement).click();
    await el.updateComplete;

    const r = wurzel(el);
    expect(r.querySelector('.siegel')).toBeNull();
    const karten = Array.from(r.querySelectorAll('velg-game-card')) as Array<
      HTMLElement & { faceDown: boolean }
    >;
    expect(karten).toHaveLength(2);
    expect(karten.every((k) => k.faceDown === false), 'eine Karte blieb verdeckt').toBe(true);
    expect(r.querySelector('.ziele')).not.toBeNull();
  });

  it('räumt jede Uhr beim Überspringen — sonst schaltet ein Rückruf den Scheinwerfer wieder an', async () => {
    vi.useFakeTimers();
    try {
      dungeonState.clientState.value = zustand({
        pending_loot: [stueck('L1', 'aptitude_boost', 3), stueck('L2', 'memory')],
      });
      const el = document.createElement('velg-dungeon-debrief') as VelgDungeonDebrief;
      document.body.appendChild(el);
      await el.updateComplete;

      // Siegel brechen, Zeremonie anlaufen lassen …
      wurzel(el).querySelector('velg-hold-button')?.dispatchEvent(
        new CustomEvent('hold-confirmed', { bubbles: true, composed: true }),
      );
      await vi.advanceTimersByTimeAsync(700);

      // … und mittendrin überspringen.
      el.shadowRoot?.querySelector<HTMLButtonElement>('.siegel__ueberspringen')?.click();
      await el.updateComplete;
      expect(vi.getTimerCount(), 'nach dem Überspringen laufen noch Uhren').toBe(0);

      // Alles, was danach noch feuern wollte, darf nichts mehr verändern.
      await vi.advanceTimersByTimeAsync(10_000);
      await el.updateComplete;
      expect(wurzel(el).querySelector('.fach--licht'), 'Scheinwerfer nachträglich an').toBeNull();
      expect(wurzel(el).querySelector('.ziele')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('räumt die Uhren auch beim Abmelden', async () => {
    vi.useFakeTimers();
    try {
      dungeonState.clientState.value = zustand({
        pending_loot: [stueck('L1', 'aptitude_boost')],
      });
      const el = document.createElement('velg-dungeon-debrief') as VelgDungeonDebrief;
      document.body.appendChild(el);
      await el.updateComplete;
      wurzel(el).querySelector('velg-hold-button')?.dispatchEvent(
        new CustomEvent('hold-confirmed', { bubbles: true, composed: true }),
      );
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      el.remove();
      expect(vi.getTimerCount(), 'abgemeldet, Uhren laufen weiter').toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lässt eine verdeckte Karte per Klick vorzeitig aufdecken', async () => {
    vi.useFakeTimers();
    try {
      dungeonState.clientState.value = zustand({
        pending_loot: [stueck('L1', 'aptitude_boost'), stueck('L2', 'memory')],
      });
      const el = document.createElement('velg-dungeon-debrief') as VelgDungeonDebrief;
      document.body.appendChild(el);
      await el.updateComplete;
      wurzel(el).querySelector('velg-hold-button')?.dispatchEvent(
        new CustomEvent('hold-confirmed', { bubbles: true, composed: true }),
      );
      await vi.advanceTimersByTimeAsync(700); // Siegel gebrochen, Karten fliegen
      await el.updateComplete;

      const karten = Array.from(wurzel(el).querySelectorAll('velg-game-card')) as Array<
        HTMLElement & { faceDown: boolean }
      >;
      expect(karten[0].faceDown, 'Karte war schon offen').toBe(true);
      karten[0].click();
      await el.updateComplete;
      expect(
        (wurzel(el).querySelectorAll('velg-game-card')[0] as HTMLElement & { faceDown: boolean })
          .faceDown,
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('VelgDungeonDebrief: Ziehen ist die Kür, Klicken der Vertrag', () => {
  beforeEach(() => {
    dungeonState.clientState.value = null;
    dungeonState.timerRemaining.value = null;
    document.body.innerHTML = '';
  });

  /** Ein Ablegen, wie der Browser es auslöst. */
  function ablegen(ziel: HTMLElement): void {
    ziel.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    ziel.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
  }

  it('legt ein gezogenes Stück beim Ziel ab — mit demselben Befehl wie ein Klick', async () => {
    const el = await buehne({
      pending_loot: [stueck('L1', 'stress_heal'), stueck('L2', 'aptitude_boost')],
    });
    const befehle = lauscher(el);
    const r = wurzel(el);

    r.querySelector('velg-game-card')?.dispatchEvent(
      new CustomEvent('card-drag-start', { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    ablegen(r.querySelectorAll<HTMLButtonElement>('.ziel')[1]);
    await el.updateComplete;

    // Die Auto-Wirkung zählt auch hier nicht mit: L2 ist das ERSTE verteilbare.
    expect(befehle).toEqual(['assign 1 Voss']);
  });

  it('nimmt kein Ablegen auf einer gefangenen Agentin an', async () => {
    const el = await buehne({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    const befehle = lauscher(el);
    const r = wurzel(el);

    r.querySelector('velg-game-card')?.dispatchEvent(
      new CustomEvent('card-drag-start', { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    const ilva = Array.from(r.querySelectorAll<HTMLButtonElement>('.ziel')).find((b) =>
      b.textContent?.includes('Ilva'),
    );
    ablegen(ilva as HTMLElement);
    await el.updateComplete;

    expect(befehle).toEqual([]);
  });

  it('führt auch beim Ziehen über den Dimensionsschritt', async () => {
    const el = await buehne({ pending_loot: [stueck('L1', 'personality_modifier')] });
    const befehle = lauscher(el);
    const r = wurzel(el);

    r.querySelector('velg-game-card')?.dispatchEvent(
      new CustomEvent('card-drag-start', { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    ablegen(r.querySelectorAll<HTMLButtonElement>('.ziel')[0]);
    await el.updateComplete;

    expect(befehle, 'ohne Dimension abgeschickt').toEqual([]);
    r.querySelectorAll<HTMLButtonElement>('.dimension')[0].click();
    await el.updateComplete;
    expect(befehle).toEqual(['assign 1 Fenn openness']);
  });

  it('macht eine verdeckte Karte nicht ziehbar', async () => {
    const el = await versiegelt({ pending_loot: [stueck('L1', 'aptitude_boost')] });
    // Noch versiegelt: es gibt gar keine Karte.
    expect(wurzel(el).querySelector('velg-game-card')).toBeNull();
  });
});
