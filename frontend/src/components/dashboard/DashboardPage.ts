/**
 * Das Operative Terminal — der Orchestrator.
 *
 * Er holt die Daten und setzt die Abschnitte zusammen; sonst nichts. Jeder
 * Abschnitt liegt in einer eigenen Datei, weil jeder eine eigene Aufgabe hat —
 * dasselbe Muster wie bei der Frontseite, wo aus einer Datei mit 2 302 Zeilen
 * ein Orchestrator mit 120 wurde.
 *
 * VIER ABRUFE, NICHT EINER — UND DAS IST ABSICHT
 *
 * `GET /users/me/dashboard` liefert, was NUR für diese Person gilt: ihre Welten,
 * ihre Epochen, den Substratzustand. Das Weltenregister, die Agentenkarten und
 * die Resonanzzeilen haben eigene öffentliche Endpunkte und werden dort geholt.
 *
 * Ein Dashboard-Endpunkt, der alles einsammelt, wäre in drei Monaten der Ort, an
 * dem jede neue Kachel angebaut wird, und niemand könnte mehr sagen, welche
 * Abfrage wem gehört. Die vier laufen nebeneinander (`Promise.allSettled`), also
 * kostet die Trennung keine Zeit — und ein Ausfall reisst nicht die ganze Seite
 * mit, sondern nur seinen Abschnitt.
 *
 * WAS AUS DER ALTEN FASSUNG MITGEHT, OBWOHL DER ENTWURF ES NICHT ZEIGT
 *
 * Der Entwurf beschreibt den Regelzustand: jemand mit Welten und laufenden
 * Epochen. `SimulationsDashboard.ts` trug daneben Dinge, die es weiter geben
 * muss, weil sonst Funktion verschwindet:
 *
 *   Freigabe-Warteschlange   nur für Plattform-Verwaltende
 *   Betriebsleiste           Admin, Schmiede, Epoche anlegen
 *   Akademie-Einstieg        für alle ohne eigene Welt und ohne Epoche
 *
 * Sie stehen deshalb hier, in derselben Reihenfolge wie vorher. Ein Redesign,
 * das Funktion still fallen lässt, ist kein Redesign, sondern ein Verlust.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi } from '../../services/api/AgentsApiService.js';
import { resonanceApi } from '../../services/api/index.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { usersApi } from '../../services/api/UsersApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { Agent, DashboardData, Resonance, Simulation } from '../../types/index.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';
import './DashboardCommandStrip.js';
import './DashboardQueue.js';
import './DashboardRail.js';
import './DashboardRegistry.js';
import './DashboardStage.js';
import './DashboardWorlds.js';
import '../epoch/AcademyEpochCard.js';
import '../forge/ClearanceQueue.js';

/** Wie viele Welten das Register höchstens holt. Sechs zeigt es, der Rest
 *  begründet nur die Leiste darunter — mehr als hundert wäre Ladung ohne Zweck. */
const REGISTRY_LIMIT = 100;

/** Wie viele Dossierkarten das Karussell durchblättert. */
const DOSSIER_LIMIT = 12;

/** Wie oft die Uhr in der Befehlsleiste nachzieht. */
const CLOCK_MS = 1000;

@localized()
@customElement('velg-operative-dashboard')
export class VelgOperativeDashboard extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        display: block;
        background: var(--color-surface-sunken);
        color: var(--color-text-primary);
        min-height: 60vh;
      }

      /* Register und Schiene teilen sich eine Zeile — das Raster ist fest, weil
         die Registerkarten "overflow: hidden" tragen und in einer Flex-Reihe
         der Nachbarin den Schrumpfschutz nähmen. */
      .lower {
        display: grid;
        grid-template-columns: 1fr 356px;
        gap: var(--space-7);
        align-items: start;
        padding-block: var(--space-12);
      }

      .ops {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding-block: var(--space-5);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
      }

      .ops__btn {
        padding: var(--space-2-5) var(--space-5);
        border: var(--border-width-thin) solid var(--color-border);
        background: transparent;
        cursor: pointer;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-secondary);
        transition:
          color var(--transition-fast),
          border-color var(--transition-fast);
      }

      .ops__btn:hover,
      .ops__btn:focus-visible {
        color: var(--color-accent-amber);
        border-color: var(--color-accent-amber);
      }

      .academy {
        padding-block: var(--space-10);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
      }

      .clearance {
        padding-block: var(--space-6);
      }

      @media (min-width: 1920px) {
        .lower {
          grid-template-columns: 1fr 380px;
        }
      }

      @media (max-width: 1024px) {
        .lower {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _dashboard: DashboardData | null = null;
  @state() private _registry: Simulation[] = [];
  @state() private _agents: Agent[] = [];
  @state() private _tremors: Resonance[] = [];
  @state() private _clock = '';

  private _timer: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
    this._tick();
    this._timer = window.setInterval(() => this._tick(), CLOCK_MS);
  }

  disconnectedCallback(): void {
    if (this._timer !== null) window.clearInterval(this._timer);
    this._timer = null;
    super.disconnectedCallback();
  }

  private _tick(): void {
    this._clock = new Date().toLocaleTimeString();
  }

  /** Vier Abrufe nebeneinander. `allSettled`, weil ein Ausfall nur seinen
   *  Abschnitt kosten darf und nicht die Seite — jeder Fehlschlag wird
   *  beobachtet, keiner wird verschluckt. */
  private async _load(): Promise<void> {
    const member = appState.isAuthenticated.value;
    const mode = member ? 'member' : 'public';

    const [dashboard, registry, tremors] = await Promise.allSettled([
      member ? usersApi.getDashboard() : Promise.resolve(null),
      simulationsApi.listPublic({ limit: String(REGISTRY_LIMIT) }),
      resonanceApi.list(mode, { limit: '10' }),
    ]);

    if (dashboard.status === 'fulfilled' && dashboard.value?.success && dashboard.value.data) {
      this._dashboard = dashboard.value.data as DashboardData;
    } else if (dashboard.status === 'rejected') {
      captureError(dashboard.reason, { source: 'VelgOperativeDashboard._load.dashboard' });
    }

    if (registry.status === 'fulfilled' && registry.value.success && registry.value.data) {
      this._registry = registry.value.data;
    } else if (registry.status === 'rejected') {
      captureError(registry.reason, { source: 'VelgOperativeDashboard._load.registry' });
    }

    if (tremors.status === 'fulfilled' && tremors.value.success && tremors.value.data) {
      this._tremors = tremors.value.data;
    } else if (tremors.status === 'rejected') {
      captureError(tremors.reason, { source: 'VelgOperativeDashboard._load.tremors' });
    }

    await this._loadDossiers();
  }

  /** Die Dossierkarten kommen aus der ERSTEN eigenen Welt, nicht aus einer
   *  fremden: das Karussell heisst „Operatives" und meint die eigenen. Wer
   *  keine Welt hat, sieht keines — statt Karten aus einer Welt, die ihm nicht
   *  gehört. */
  private async _loadDossiers(): Promise<void> {
    const first = this._dashboard?.worlds[0];
    if (!first) return;
    try {
      const response = await agentsApi.listPublic(first.simulation_id, {
        limit: String(DOSSIER_LIMIT),
      });
      if (response.success && response.data) {
        this._agents = response.data.filter((a) => a.portrait_image_url);
      }
    } catch (err) {
      captureError(err, { source: 'VelgOperativeDashboard._loadDossiers' });
    }
  }

  /** ⚠ EIN ABSCHNITT OHNE INHALT WIRD NICHT GERENDERT, NICHT NUR LEER GELASSEN.
   *
   *  Jeder Abschnitt trägt seine senkrechte Polsterung und seine Trennlinie am
   *  `:host`. Gibt sein `render()` dann `nothing` zurück, bleibt der Kasten
   *  trotzdem stehen — gemessen im Browser: Warteschlange 97 px,
   *  Weltenumschalter 129 px, Register 96 px, zusammen **322 px** Leere
   *  zwischen zwei Linien.
   *
   *  Das ist derselbe Fehler wie beim Frontseiten-Redesign am selben Tag (ein
   *  leerer Abschnitt frass dort 192 px), und die Bauteile tragen sogar schon
   *  `:host([hidden])` — es setzte nur niemand das Merkmal. Die Entscheidung,
   *  OB ein Abschnitt erscheint, gehört ohnehin hierher: der Orchestrator kennt
   *  den Bestand, das Bauteil kennt nur seine eigene Eigenschaft.
   *
   *  Die Schiene bleibt stehen, auch wenn das Register nichts hat — sie hat
   *  eigene Inhalte. Ihr Platz im Raster bleibt deshalb belegt. */
  protected render() {
    const data = this._dashboard;
    const worlds = data?.worlds ?? [];
    const participations = data?.active_epoch_participations ?? [];
    // Kein eigener Einsatz und keine eigene Welt: dann ist der Einstieg die
    // Akademie und nicht ein leeres Raster.
    const isNewcomer = Boolean(data) && !worlds.length && !participations.length;

    return html`
      <velg-dashboard-command-strip
        .identity=${appState.user.value?.email ?? ''}
        .shards=${worlds.length}
        .activeOps=${participations.length}
        .substrate=${data?.substrate_status ?? 'stable'}
        .tremors=${data?.active_resonance_count ?? 0}
        .clock=${this._clock}
      ></velg-dashboard-command-strip>

      <velg-dashboard-stage .participation=${participations[0] ?? null}></velg-dashboard-stage>

      ${
        appState.isPlatformAdmin.value
          ? html`<div class="clearance stage-container">
              <velg-clearance-queue variant="compact"></velg-clearance-queue>
            </div>`
          : nothing
      }

      ${
        participations.length
          ? html`<velg-dashboard-queue .participations=${participations}></velg-dashboard-queue>`
          : nothing
      }
      ${worlds.length ? html`<velg-dashboard-worlds .worlds=${worlds}></velg-dashboard-worlds>` : nothing}

      ${
        isNewcomer
          ? html`<div class="academy stage-container">
              <velg-academy-epoch-card></velg-academy-epoch-card>
            </div>`
          : nothing
      }

      <div class="lower stage-container">
        ${
          this._registry.length
            ? html`<velg-dashboard-registry .worlds=${this._registry}></velg-dashboard-registry>`
            : html`<div></div>`
        }
        <velg-dashboard-rail .agents=${this._agents} .resonances=${this._tremors}></velg-dashboard-rail>
      </div>

      <div class="ops stage-bleed-row">
        ${
          appState.isPlatformAdmin.value
            ? html`<button class="ops__btn" @click=${() => navigate('/admin')}>${msg('Admin Panel')}</button>`
            : nothing
        }
        ${
          appState.canForge.value
            ? html`<button class="ops__btn" @click=${() => navigate('/forge')}>${msg('Forge')}</button>`
            : nothing
        }
        <button class="ops__btn" @click=${() => navigate('/epoch')}>${msg('Create Epoch')}</button>
        <button class="ops__btn" @click=${() => navigate('/worlds')}>${msg('Browse Shards')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-operative-dashboard': VelgOperativeDashboard;
  }
}
