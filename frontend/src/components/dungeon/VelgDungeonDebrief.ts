/**
 * Das Nachbesprechungs-Terminal — die Beuteverteilung bekommt eine Bühne.
 *
 * WARUM ES DIESE KOMPONENTE GIBT
 * Der Endgegner liegt, die Gruppe hat überlebt, und jetzt wird verteilt, was
 * der Lauf hergab. Bis hierher war das eine Knopfreihe in der Aktionsleiste —
 * und in der grafischen Ansicht überhaupt nichts, weil `case 'distributing'`
 * im ganzen Frontend an genau einer Stelle vorkam.
 *
 * ⚠ DER WICHTIGSTE TEIL IST NICHT DIE OPTIK, SONDERN DIE FRIST.
 * `DISTRIBUTION_TIMEOUT_MS = 300_000`: läuft sie ab, weist `_auto_finalize`
 * alles Unverteilte STUMM dem ersten Gruppenmitglied zu und schließt den Lauf.
 * Fünf Minuten, ohne Ankündigung. Ein Spieler, der in Ruhe liest, verlor seine
 * Wahl, ohne je erfahren zu haben, dass er unter Zeitdruck stand. Der Zeitgeber
 * steht deshalb im ersten Bild, mit dem Satz, was bei Null geschieht.
 *
 * DIE DATEN LAGEN BEREIT
 * `phase_timer` deckt die Verteilungsphase mit ab, `DungeonStateManager`
 * füllt daraus `timerRemaining`, und `DungeonCombatBar` zeigt genau so etwas
 * schon für den Kampf. Hier wird nichts gebaut, was es nicht gab — es wird
 * angeschlossen.
 *
 * DIE KOMPONENTE RUFT KEINEN ENDPUNKT.
 * Jede Handlung geht als `terminal-command` hinaus, genau wie die
 * Aktionsleiste. So bleiben Bühne und Terminal-Spur derselbe Vorgang, und die
 * Chronik erzählt hinterher dieselbe Geschichte.
 *
 * Entwurf: `handoff/dungeon-debrief.md` (Claude Design), Spezifikation §4–§8.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import { terminalState } from '../../services/TerminalStateManager.js';
import type { AgentCombatStateClient, LootItem } from '../../types/dungeon.js';
import { AUTO_APPLY_EFFECTS } from '../../utils/dungeon-formatters.js';
import { localized as localizedField } from '../../utils/locale-fields.js';
import { formatParams } from '../shared/loot-param-labels.js';
import '../shared/VelgGameCard.js';
import '../shared/VelgHoldButton.js';

/**
 * Die fünf Dimensionen. Spiegelt `BIG_FIVE_DIMENSIONS` in
 * `backend/models/resonance_dungeon.py:310` — der SCHLÜSSEL geht englisch an
 * den Befehl, die BESCHRIFTUNG ist übersetzt. Beides zu vermischen hieße,
 * einem Server ein deutsches Wort zu schicken, das er nicht kennt.
 */
const BIG_FIVE: ReadonlyArray<{ key: string; label: () => string }> = [
  { key: 'openness', label: () => msg('Openness') },
  { key: 'conscientiousness', label: () => msg('Conscientiousness') },
  { key: 'extraversion', label: () => msg('Extraversion') },
  { key: 'agreeableness', label: () => msg('Agreeableness') },
  { key: 'neuroticism', label: () => msg('Neuroticism') },
];

/** Ab hier warnt der Zeitgeber, ab da drängt er. In Sekunden. */
const WARN_AB = 60;
const GEFAHR_AB = 15;

/** Ein Rang je Stufe — `rarity` der Karte. */
function rangFuerStufe(tier: number): 'common' | 'rare' | 'legendary' {
  if (tier >= 3) return 'legendary';
  if (tier === 2) return 'rare';
  return 'common';
}

@localized()
@customElement('velg-dungeon-debrief')
export class VelgDungeonDebrief extends SignalWatcher(LitElement) {
  /** Das Stück, das gerade ein Ziel sucht. */
  @state() private _aktivesStueck: string | null = null;

  /** Bei `personality_modifier`: der gewählte Agent, der noch eine Dimension braucht. */
  @state() private _wartetAufDimension: string | null = null;

  /** Der Zeitgeber hat die 60er- bzw. 15er-Marke schon angesagt. */
  @state() private _angesagt = new Set<number>();

  /**
   * Die Zeremonie in vier Zuständen.
   *
   *   sealed ──halten──▶ breaking ──650ms──▶ dealt ──Reigen──▶ ready
   *
   * `ready` ist der Zustand, in dem verteilt wird; alles davor ist Auftritt.
   * Bei `prefers-reduced-motion` und beim Überspringen wird direkt dorthin
   * gesprungen — nicht schneller abgespielt, sondern ausgelassen.
   */
  @state() private _zeremonie: 'sealed' | 'breaking' | 'dealt' | 'ready' = 'sealed';

  /** Welche Stücke schon offen liegen. */
  @state() private _aufgedeckt = new Set<string>();

  /** Das Stück im Scheinwerfer (nur Stufe III), oder null. */
  @state() private _imLicht: string | null = null;

  /**
   * Das Stück, das gerade am Zeiger hängt.
   *
   * Ziehen ist die KÜR, Klicken der Vertrag: alles hier ist auch ohne
   * Zeigegerät erreichbar, und der Ablegepfad endet in derselben Methode wie
   * der Klickpfad. Zwei Wege zu demselben Befehl, nicht zwei Befehle.
   */
  @state() private _gezogen: string | null = null;

  /** Über welchem Ziel der Zeiger gerade schwebt. */
  @state() private _ueberZiel: string | null = null;

  /**
   * Alle laufenden Zeitgeber der Zeremonie.
   *
   * ⚠ Sie MÜSSEN beim Abmelden und beim Überspringen geräumt werden. Ein
   * Rückruf, der nach dem Entfernen der Komponente feuert, schreibt in einen
   * Zustand, den niemand mehr rendert — und beim Wiedereintritt in die Phase
   * spielt er gegen die neue Zeremonie an.
   */
  private _uhren: ReturnType<typeof setTimeout>[] = [];

  // ── Ableitungen aus dem Zustand ────────────────────────────────────────

  private get _busy(): boolean {
    return dungeonState.loading.value || terminalState.isLoading.value;
  }

  private get _stuecke(): LootItem[] {
    return dungeonState.clientState.value?.pending_loot ?? [];
  }

  /** Was der Spieler verteilt. Die Auto-Wirkungen sind nicht darunter. */
  private get _verteilbar(): LootItem[] {
    return this._stuecke.filter((i) => !AUTO_APPLY_EFFECTS.has(i.effect_type));
  }

  /** Was ohne Wahl wirkt — wird gezeigt, nie zugewiesen. */
  private get _automatisch(): LootItem[] {
    return this._stuecke.filter((i) => AUTO_APPLY_EFFECTS.has(i.effect_type));
  }

  private get _zuweisungen(): Record<string, string> {
    return dungeonState.clientState.value?.loot_assignments ?? {};
  }

  private get _vorschlaege(): Record<string, string> {
    return dungeonState.clientState.value?.loot_suggestions ?? {};
  }

  /**
   * Gültige Ziele. Eine gefangene Agentin ist keins — der Server nimmt die
   * Zuweisung nicht an, also darf die Bühne sie nicht anbieten.
   */
  private get _ziele(): AgentCombatStateClient[] {
    return (dungeonState.clientState.value?.party ?? []).filter((a) => a.condition !== 'captured');
  }

  private get _offen(): number {
    const z = this._zuweisungen;
    return this._verteilbar.filter((i) => !z[i.id]).length;
  }

  // ── Handlungen ─────────────────────────────────────────────────────────

  private _dispatch(command: string): void {
    if (this._busy) return;
    this.dispatchEvent(
      new CustomEvent('terminal-command', { detail: command, bubbles: true, composed: true }),
    );
  }

  private _waehleStueck(item: LootItem): void {
    this._wartetAufDimension = null;
    this._aktivesStueck = this._aktivesStueck === item.id ? null : item.id;
  }

  private _waehleZiel(agent: AgentCombatStateClient, stueckId?: string): void {
    const gesucht = stueckId ?? this._aktivesStueck;
    const item = this._verteilbar.find((i) => i.id === gesucht);
    if (!item) return;
    // Der Ablegepfad muss dieselbe Karte aktiv setzen wie der Klickpfad, sonst
    // sucht der Dimensionsschritt danach ins Leere.
    this._aktivesStueck = item.id;

    // Ein Persönlichkeits-Modifikator braucht eine Dimension, sonst weist der
    // Server ihn zurück. Also fragen, statt eine zu erfinden.
    if (item.effect_type === 'personality_modifier') {
      this._wartetAufDimension = agent.agent_id;
      return;
    }
    this._sende(item, agent.agent_name);
  }

  private _waehleDimension(dimension: string): void {
    const item = this._verteilbar.find((i) => i.id === this._aktivesStueck);
    const agent = this._ziele.find((a) => a.agent_id === this._wartetAufDimension);
    if (!item || !agent) return;
    this._sende(item, agent.agent_name, dimension);
  }

  /**
   * Der Befehl, wortgleich mit dem, den das Terminal versteht
   * (`utils/dungeon-commands.ts`): `assign <nummer> <name> [dimension]`.
   * Die Nummer ist 1-basiert und zählt NUR die verteilbaren Stücke — dieselbe
   * Filterung wie im Formatierer, sonst zeigt die Bühne auf ein anderes Stück
   * als der Server.
   */
  private _sende(item: LootItem, agentName: string, dimension?: string): void {
    const nummer = this._verteilbar.indexOf(item) + 1;
    this._dispatch(`assign ${nummer} ${agentName}${dimension ? ` ${dimension}` : ''}`);
    this._aktivesStueck = null;
    this._wartetAufDimension = null;
  }

  // ── Der Zeitgeber (P0) ─────────────────────────────────────────────────

  /**
   * Sagt die 60- und die 15-Sekunden-Marke EINMAL an.
   *
   * Nicht jede Sekunde: `role="timer"` bleibt `aria-live="off"`, sonst spricht
   * ein Vorleser den Countdown mit und macht die Seite unbenutzbar. Die zwei
   * Marken kommen über eine getrennte, höfliche Region.
   */
  private _ansage(sekunden: number): string {
    for (const marke of [WARN_AB, GEFAHR_AB]) {
      if (sekunden <= marke && !this._angesagt.has(marke)) {
        this._angesagt.add(marke);
        return marke === GEFAHR_AB ? msg('Fifteen seconds.') : msg('One minute left.');
      }
    }
    return '';
  }

  // ── Die Zeremonie ──────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    // Wer Bewegung reduziert haben will, bekommt keine kürzere Zeremonie,
    // sondern gar keine: alles liegt sofort offen.
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this._allesAufdecken();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._raeumeUhren();
  }

  private _raeumeUhren(): void {
    for (const u of this._uhren) clearTimeout(u);
    this._uhren = [];
  }

  private _spaeter(ms: number, was: () => void): void {
    this._uhren.push(setTimeout(was, ms));
  }

  /** Das Siegel ist gebrochen: Karten fliegen verdeckt heraus, dann der Reigen. */
  private _siegelBrechen(): void {
    if (this._zeremonie !== 'sealed') return;
    this._zeremonie = 'breaking';
    this._spaeter(650, () => {
      this._zeremonie = 'dealt';
      // Auswurf: 750 ms Flug plus 90 ms Versatz je Karte (Spezifikation §6.3).
      const auswurf = 750 + 90 * Math.max(0, this._verteilbar.length - 1);
      this._spaeter(auswurf, () => this._reigen());
    });
  }

  /**
   * Der Reigen: aufsteigend nach Stufe, damit die legendäre zuletzt kommt.
   *
   * Die Reihenfolge trägt die Dramatik — nicht die Effektdichte. Zwischen zwei
   * Karten liegen 560 ms; eine Stufe III bekommt davor ihren Scheinwerfer.
   */
  private _reigen(): void {
    const reihe = [...this._verteilbar].sort((a, b) => a.tier - b.tier);
    let versatz = 0;
    for (const item of reihe) {
      const legendaer = item.tier >= 3;
      if (legendaer) {
        this._spaeter(versatz, () => {
          this._imLicht = item.id;
        });
        versatz += 1700; // aufladen
      }
      this._spaeter(versatz, () => this._deckeAuf(item.id));
      versatz += legendaer ? 1500 : 560;
      if (legendaer) {
        this._spaeter(versatz, () => {
          this._imLicht = null;
        });
        versatz += 300;
      }
    }
    this._spaeter(versatz, () => {
      this._zeremonie = 'ready';
    });
  }

  private _deckeAuf(id: string): void {
    if (this._aufgedeckt.has(id)) return;
    this._aufgedeckt = new Set(this._aufgedeckt).add(id);
  }

  /**
   * Überspringen. Räumt JEDE Uhr — sonst schaltet ein noch laufender Rückruf
   * den Scheinwerfer wieder an, nachdem der Spieler ihn weggeklickt hat.
   */
  private _allesAufdecken(): void {
    this._raeumeUhren();
    this._imLicht = null;
    this._aufgedeckt = new Set(this._stuecke.map((i) => i.id));
    this._zeremonie = 'ready';
  }

  /** Was die Rückseite verrät, bevor sie sich dreht. */
  private _verrat(tier: number): 'none' | 'rare' | 'legendary' {
    if (tier >= 3) return 'legendary';
    if (tier === 2) return 'rare';
    return 'none';
  }

  private _renderSiegel() {
    const n = this._verteilbar.length;
    const brechend = this._zeremonie === 'breaking';
    return html`
      <div class="siegel ${brechend ? 'siegel--bricht' : ''}">
        ${brechend ? html`<div class="siegel__blitz"></div><div class="siegel__ring"></div>` : nothing}
        <div class="siegel__raute">
          <div class="siegel__innen">
            <span class="siegel__marke">BIG</span>
            <span class="siegel__zeile">${msg(str`${n} pieces`)}</span>
          </div>
        </div>
        <p class="siegel__satz">
          ${msg('The Bureau sealed what the run gave up. The clock is already running – the seal does not wait either.')}
        </p>
        <velg-hold-button
          .duration=${950}
          .label=${msg('Break the seal (hold)')}
          .holdingLabel=${msg('Holding…')}
          @hold-confirmed=${this._siegelBrechen}
        ></velg-hold-button>
        <button class="siegel__ueberspringen" @click=${this._allesAufdecken}>
          ${msg('Skip – lay everything open')}
        </button>
      </div>
    `;
  }

  private _renderZeitgeber() {
    const restMs = dungeonState.timerRemaining.value;
    if (restMs === null) return nothing;

    const rest = Math.max(0, Math.ceil(restMs / 1000));
    const min = Math.floor(rest / 60);
    const sek = String(rest % 60).padStart(2, '0');
    const uhr = `${min}:${sek}`;
    const anteil = Math.max(0, Math.min(1, restMs / 300_000));
    const stufe = rest <= GEFAHR_AB ? 'gefahr' : rest <= WARN_AB ? 'warnung' : 'ruhig';
    const ansage = this._ansage(rest);

    return html`
      <div class="frist frist--${stufe}">
        <div class="frist__kopf">
          <span class="frist__titel">${msg('Debrief')}</span>
          <span class="frist__uhr" role="timer" aria-live="off">${uhr}</span>
        </div>
        <div class="frist__balken" role="presentation">
          <div class="frist__fuellung" style="transform: scaleX(${anteil})"></div>
          <span class="frist__marke frist__marke--warn"></span>
          <span class="frist__marke frist__marke--gefahr"></span>
        </div>
        <p class="frist__satz">
          ${msg(
            str`The distribution closes in ${uhr}. Whatever is still open then goes to the Bureau's suggestion, without your say.`,
          )}
        </p>
        <p class="visually-hidden" aria-live="polite">${ansage}</p>
      </div>
    `;
  }

  // ── Die Teile der Bühne ────────────────────────────────────────────────

  private _renderAutomatisch() {
    const items = this._automatisch;
    if (items.length === 0) return nothing;
    return html`
      <div class="auto">
        <span class="auto__titel">${msg('System effects – no choice')}</span>
        ${items.map(
          (i) => html`
            <span class="auto__chip">
              <span class="auto__marke">${msg('AUTO')}</span>
              ${localizedField(i, 'name')}
              <span class="auto__wirkung">${formatParams(i.effect_params)}</span>
            </span>
          `,
        )}
      </div>
    `;
  }

  private _renderStueck(item: LootItem, index: number) {
    const zugewiesen = this._zuweisungen[item.id];
    const zielName = this._ziele.find((a) => a.agent_id === zugewiesen)?.agent_name;
    const vorschlag = this._ziele.find((a) => a.agent_id === this._vorschlaege[item.id]);
    const aktiv = this._aktivesStueck === item.id;
    const gedimmt = this._aktivesStueck !== null && !aktiv;

    const verdeckt = !this._aufgedeckt.has(item.id);
    const imLicht = this._imLicht === item.id;
    const fliegt = this._zeremonie === 'dealt' || this._zeremonie === 'breaking';

    return html`
      <div
        class="fach ${fliegt ? 'fach--fliegt' : ''} ${imLicht ? 'fach--licht' : ''} ${
          this._imLicht !== null && !imLicht ? 'fach--zurueck' : ''
        }"
        style="--i: ${index}; --fx: ${(index - (this._verteilbar.length - 1) / 2) * -160}px; --fr: ${
          (index - 2) * -9
        }deg"
      >
        <velg-game-card
          type="loot"
          size="md"
          full-description
          rarity=${rangFuerStufe(item.tier)}
          name=${localizedField(item, 'name')}
          .description=${localizedField(item, 'description')}
          .subtitle=${formatParams(item.effect_params)}
          .primaryStat=${item.tier}
          .faceDown=${verdeckt}
          .rarityTell=${verdeckt ? this._verrat(item.tier) : 'none'}
          ?highlighted=${aktiv}
          ?dimmed=${gedimmt}
          .draggable=${!verdeckt && this._zeremonie === 'ready' && !zugewiesen}
          @card-drag-start=${() => {
            this._gezogen = item.id;
          }}
          @dragend=${() => {
            this._gezogen = null;
            this._ueberZiel = null;
          }}
          @click=${() =>
            // Eine verdeckte Karte wartet nicht auf ihren Auftritt, wenn der
            // Spieler sie schon sehen will.
            verdeckt ? this._deckeAuf(item.id) : this._waehleStueck(item)}
        ></velg-game-card>
        <div class="fach__fuss ${zielName ? 'fach__fuss--vergeben' : ''}">
          ${
            zielName
              ? html`<span>→ ${zielName}</span>`
              : vorschlag
                ? html`<span class="fach__vorschlag"
                    >${msg('Suggested')} · ${vorschlag.agent_name}</span
                  >`
                : html`<span class="fach__offen">${msg('Unassigned')}</span>`
          }
        </div>
      </div>
    `;
  }

  private _renderZiele() {
    const item = this._verteilbar.find((i) => i.id === this._aktivesStueck);
    const wartet = this._wartetAufDimension !== null;

    return html`
      <div class="ziele">
        <p class="ziele__frage">
          ${
            wartet
              ? msg('Which dimension?')
              : item
                ? msg(str`"${localizedField(item, 'name')}" chosen – who should have it?`)
                : msg(
                    'Choose a piece, then a party member. Suggestions are suggestions, not choices already made.',
                  )
          }
        </p>
        <div class="ziele__reihe">
          ${(dungeonState.clientState.value?.party ?? []).map((agent) => {
            const gefangen = agent.condition === 'captured';
            const haelt = Object.entries(this._zuweisungen).filter(
              ([, id]) => id === agent.agent_id,
            ).length;
            return html`
              <button
                class="ziel ${item && !gefangen ? 'ziel--moeglich' : ''} ${
                  this._wartetAufDimension === agent.agent_id ? 'ziel--wartet' : ''
                } ${this._ueberZiel === agent.agent_id ? 'ziel--drueber' : ''} ${
                  this._gezogen && !gefangen ? 'ziel--ablage' : ''
                }"
                ?disabled=${gefangen || (!item && !this._gezogen) || wartet}
                @click=${() => this._waehleZiel(agent)}
                @dragover=${(e: DragEvent) => {
                  if (gefangen || !this._gezogen) return;
                  // Ohne preventDefault lehnt der Browser das Ablegen ab und
                  // es gibt kein `drop` — die stille Variante des Nichtstuns.
                  e.preventDefault();
                  this._ueberZiel = agent.agent_id;
                }}
                @dragleave=${() => {
                  if (this._ueberZiel === agent.agent_id) this._ueberZiel = null;
                }}
                @drop=${(e: DragEvent) => {
                  e.preventDefault();
                  const gezogen = this._gezogen;
                  this._gezogen = null;
                  this._ueberZiel = null;
                  if (gefangen || !gezogen) return;
                  this._waehleZiel(agent, gezogen);
                }}
              >
                <span class="ziel__name">${agent.agent_name}</span>
                <span class="ziel__zustand"
                  >${gefangen ? msg('captured – no target') : agent.condition}</span
                >
                ${haelt > 0 ? html`<span class="ziel__zahl">${haelt}</span>` : nothing}
              </button>
            `;
          })}
        </div>
        ${
          wartet
            ? html`
              <div class="dimensionen">
                ${BIG_FIVE.map(
                  (d) => html`
                    <button class="dimension" @click=${() => this._waehleDimension(d.key)}>
                      ${d.label()}
                    </button>
                  `,
                )}
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderAbschluss() {
    const offen = this._offen;
    const gesamt = this._verteilbar.length;
    return html`
      <div class="abschluss">
        <span class="abschluss__zahl">
          ${msg(str`${gesamt - offen} of ${gesamt} assigned`)}
        </span>
        <velg-hold-button
          .duration=${900}
          .disabled=${offen > 0 || this._busy}
          .label=${offen > 0 ? msg(str`${offen} still open`) : msg('Seal the distribution')}
          .holdingLabel=${msg('Hold…')}
          @hold-confirmed=${() => this._dispatch('confirm')}
        ></velg-hold-button>
      </div>
    `;
  }

  protected render() {
    if (dungeonState.clientState.value?.phase !== 'distributing') return nothing;

    const auftritt = this._zeremonie === 'sealed' || this._zeremonie === 'breaking';

    return html`
      <section class="buehne" aria-label=${msg('Debrief Terminal')}>
        <!-- Die Frist steht IMMER, auch hinter dem Siegel: sie laeuft ab dem
             Moment, in dem die Phase beginnt, nicht ab dem Aufdecken. -->
        ${this._renderZeitgeber()}
        ${
          auftritt
            ? this._renderSiegel()
            : html`
              ${this._renderAutomatisch()}
              <div class="faecher ${this._imLicht !== null ? 'faecher--scheinwerfer' : ''}">
                ${this._verteilbar.map((item, i) => this._renderStueck(item, i))}
              </div>
              ${this._zeremonie === 'ready' ? this._renderZiele() : nothing}
              ${this._zeremonie === 'ready' ? this._renderAbschluss() : nothing}
              ${
                this._zeremonie !== 'ready'
                  ? html`<button class="siegel__ueberspringen" @click=${this._allesAufdecken}>
                      ${msg('Reveal all')}
                    </button>`
                  : nothing
              }
            `
        }
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
      /*
       * Container-Abfragen, NICHT Viewport: das Terminal hat die
       * Gruppenspalte, die grafische Ansicht die Kartenschiene. Dieselbe
       * Fensterbreite ergibt zwei Bühnenbreiten.
       */
      container-type: inline-size;
      --_ruhig: var(--color-text-primary);
      --_warn: var(--color-warning);
      --_gefahr: var(--color-danger);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    .buehne {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border);
    }

    /* ── Die Frist ─────────────────────────────────────── */
    .frist__kopf {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
    }
    .frist__titel {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-md);
      color: var(--color-text-primary);
    }
    .frist__uhr {
      font-family: var(--font-mono);
      font-size: clamp(1.375rem, 1.4cqi + 1rem, 1.875rem);
      font-variant-numeric: tabular-nums;
      color: var(--_ruhig);
      transition: color 400ms var(--ease-out, ease-out);
    }
    .frist__balken {
      position: relative;
      height: 6px;
      margin-top: var(--space-2);
      background: var(--color-surface-sunken);
      overflow: hidden;
    }
    .frist__fuellung {
      height: 100%;
      transform-origin: left center;
      background: var(--_ruhig);
      transition: transform 1s linear, background-color 400ms var(--ease-out, ease-out);
    }
    .frist__marke {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--color-border);
    }
    .frist__marke--warn {
      left: 20%;
    }
    .frist__marke--gefahr {
      left: 5%;
    }
    .frist__satz {
      margin: var(--space-2) 0 0;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    /*
     * Kein Blinken. Eine Farbe, die sich ändert, wird bemerkt; eine, die
     * blinkt, wird weggeschaut — und für einen Teil der Leute ist sie ein
     * gesundheitliches Risiko.
     */
    .frist--warnung .frist__uhr,
    .frist--warnung .frist__satz {
      color: var(--_warn);
    }
    .frist--warnung .frist__fuellung {
      background: var(--_warn);
    }
    .frist--gefahr .frist__uhr,
    .frist--gefahr .frist__satz {
      color: var(--_gefahr);
    }
    .frist--gefahr .frist__fuellung {
      background: var(--_gefahr);
    }

    /* ── Auto-Wirkungen ────────────────────────────────── */
    .auto {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
    }
    .auto__titel {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
    }
    .auto__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
    }
    .auto__marke {
      font-family: var(--font-mono);
      color: var(--color-text-muted);
    }
    .auto__wirkung {
      color: var(--color-text-muted);
    }

    /* ── Das Siegel ────────────────────────────────────── */
    .siegel {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      padding: var(--space-10) var(--space-4) var(--space-6);
      position: relative;
      text-align: center;
    }
    .siegel__raute {
      /*
       * Die Spitzen ragen ueber die Box hinaus, sobald die Raute gedreht ist —
       * ohne diesen Abstand schneidet der Nachbar sie ab.
       */
      width: 150px;
      aspect-ratio: 1;
      margin: var(--space-6) 0 var(--space-8);
      display: grid;
      place-items: center;
      transform: rotate(45deg);
      border: var(--border-width-thin) solid
        color-mix(in srgb, var(--color-accent-amber) 55%, transparent);
      box-shadow: 0 0 0 14px transparent,
        0 0 0 15px color-mix(in srgb, var(--color-accent-amber) 18%, transparent);
    }
    .siegel__innen {
      display: grid;
      gap: var(--space-1);
      transform: rotate(-45deg);
    }
    .siegel__marke {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xl);
      letter-spacing: var(--tracking-brutalist);
      color: color-mix(in srgb, var(--color-accent-amber) 80%, var(--color-text-primary));
    }
    .siegel__zeile {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    .siegel__satz {
      max-width: 42ch;
      margin: 0;
      font-family: var(--font-prose);
      font-style: italic;
      color: var(--color-text-secondary);
    }
    .siegel__ueberspringen {
      justify-self: center;
      padding: var(--space-2) var(--space-3);
      min-height: 44px;
      cursor: pointer;
      background: none;
      border: none;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      text-decoration: underline;
    }
    .siegel__ueberspringen:hover {
      color: var(--color-text-primary);
    }

    /* Der Bruch: ein Blitz und ein Ring, beide auf eigenen Blattelementen. */
    .siegel--bricht .siegel__raute {
      animation: siegel-bricht 650ms var(--ease-dramatic, ease-in) forwards;
    }
    @keyframes siegel-bricht {
      to {
        transform: rotate(45deg) scale(1.9);
        filter: brightness(3);
        opacity: 0;
      }
    }
    .siegel__blitz {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: color-mix(in srgb, var(--color-accent-amber) 30%, var(--color-surface-inverse));
      mix-blend-mode: screen;
      opacity: 0;
      animation: siegel-blitz 1100ms var(--ease-out, ease-out) forwards;
    }
    @keyframes siegel-blitz {
      15% { opacity: 0.55; }
      100% { opacity: 0; }
    }
    .siegel__ring {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 300px;
      aspect-ratio: 1;
      margin: -150px 0 0 -150px;
      border: var(--border-width-thick) solid var(--color-accent-amber);
      border-radius: var(--border-radius-full);
      pointer-events: none;
      animation: siegel-ring 900ms var(--ease-out, ease-out) forwards;
    }
    @keyframes siegel-ring {
      from { transform: scale(0.6); opacity: 0.9; }
      to   { transform: scale(2.6); opacity: 0; }
    }

    /* ── Die Fächer ────────────────────────────────────── */
    .faecher {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-4);
      perspective: 1400px;
    }
    .fach {
      display: grid;
      gap: var(--space-2);
      width: 200px;
      animation: fach-auf var(--duration-entrance, 350ms) var(--ease-dramatic, ease-out) both;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade, 60ms));
    }
    @keyframes fach-auf {
      from {
        opacity: 0;
        transform: translateY(18px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    /*
     * Der Auswurf. Die Karten fliegen VERDECKT aus der Mitte heraus; --fx und
     * --fr setzt das Rendern je Karte, damit der Faecher symmetrisch aufgeht.
     */
    .fach--fliegt {
      animation: fach-auswurf 750ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      animation-delay: calc(var(--i, 0) * 90ms);
    }
    @keyframes fach-auswurf {
      from {
        opacity: 0;
        transform: translate(var(--fx, 0), -190px) scale(0.45) rotateZ(var(--fr, 0deg));
      }
      60% {
        opacity: 1;
        transform: translateY(-14px) scale(1.04);
      }
      80% {
        transform: translateY(4px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    /*
     * Der Scheinwerfer. Waehrend er brennt, nimmt der Faecher keine Klicks an —
     * sonst schlaegt ein :hover den Hub und die Karte springt zurueck.
     */
    .faecher--scheinwerfer {
      pointer-events: none;
    }
    .fach--zurueck {
      opacity: 0.25;
      transition: opacity 700ms var(--ease-out, ease-out);
    }
    .fach--licht {
      z-index: var(--z-raised);
      transform: scale(1.3) translateY(26px);
      transition: transform 700ms var(--ease-dramatic, ease-out);
    }
    .fach__fuss {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-align: center;
      color: var(--color-text-muted);
    }
    .fach__fuss--vergeben {
      color: var(--color-success);
    }
    .fach__vorschlag {
      color: var(--color-text-secondary);
    }
    .fach__offen {
      color: var(--color-warning);
    }

    /* ── Ziele ─────────────────────────────────────────── */
    .ziele__frage {
      margin: 0 0 var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }
    .ziele__reihe {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .ziel {
      display: grid;
      gap: 2px;
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      text-align: left;
      cursor: pointer;
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), background-color var(--transition-fast);
    }
    .ziel:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .ziel--moeglich {
      border-color: color-mix(in srgb, var(--color-success) 60%, transparent);
      background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface-raised));
    }
    /* Waehrend etwas am Zeiger haengt, zeigen die gueltigen Ablagen sich an. */
    .ziel--ablage {
      border-style: dashed;
    }
    .ziel--drueber {
      border-color: var(--color-success);
      border-style: solid;
      background: color-mix(in srgb, var(--color-success) 16%, var(--color-surface-raised));
    }
    .ziel--wartet {
      border-color: var(--color-accent-amber);
    }
    .ziel__name {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      font-size: var(--text-xs);
    }
    .ziel__zustand {
      font-family: var(--font-mono);
      font-size: var(--text-2xs, 10px);
      color: var(--color-text-muted);
    }
    .ziel__zahl {
      font-family: var(--font-mono);
      font-size: var(--text-2xs, 10px);
      color: var(--color-accent-amber);
    }

    .dimensionen {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .dimension {
      min-height: 44px;
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      font-size: var(--text-xs);
      background: var(--color-surface-raised);
      border: var(--border-width-thin) solid var(--color-accent-amber);
      color: var(--color-text-primary);
    }

    /* ── Abschluss ─────────────────────────────────────── */
    .abschluss {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .abschluss__zahl {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    /* ── Schmal: ein Stück nach dem anderen ────────────── */
    @container (max-width: 600px) {
      .faecher {
        flex-wrap: nowrap;
        overflow-x: auto;
        justify-content: flex-start;
        scroll-snap-type: x mandatory;
      }
      .fach {
        scroll-snap-align: center;
        flex: 0 0 auto;
      }
      .ziele__reihe {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fach,
      .fach--fliegt,
      .siegel--bricht .siegel__raute,
      .siegel__blitz,
      .siegel__ring {
        animation: none;
      }
      .fach--licht,
      .fach--zurueck {
        transition: none;
      }
      .frist__fuellung {
        transition: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-debrief': VelgDungeonDebrief;
  }
}
