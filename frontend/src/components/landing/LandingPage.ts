/**
 * Die Frontseite - "Editorial Brutalist", nach dem Entwurf vom 31.08.2026.
 *
 * WAS SICH GEGENUEBER DER ALTEN SEITE AENDERT
 * Die vorige Fassung war eine Datei mit 2 302 Zeilen, die Gestaltung, Daten,
 * Animationen und sieben Abschnitte in einem Stueck hielt. Diese hier ist ein
 * Orchestrator: sie laedt EINEN Schnappschuss, reicht ihn durch und setzt die
 * Abschnitte zusammen. Jeder Abschnitt liegt in einer eigenen Datei, weil jeder
 * eine eigene Aufgabe hat - und weil die naechste Aenderung sonst wieder in
 * einer Datei mit zweitausend Zeilen stattfinden muesste.
 *
 * EIN AUFRUF STATT EINES WASSERFALLS
 * Vorher: `/platform-stats` und `/simulations` getrennt, dazu je Welt ein
 * Agentenabruf. Jetzt: `GET /api/v1/public/landing`, ein Zug, alle Zahlen und
 * beide Listen. Jede Zahl ist gemessen - der Entwurf trug `47 worlds`,
 * `3 epochs in play` und `128 resonances absorbed` als Attrappen; gemessen sind
 * es 16, 0 und 1.
 *
 * WAS AUS DEM BESTAND UEBERNOMMEN IST, NICHT NEU GEBAUT
 *   - die strukturierten Daten (`landing-structured-data.ts`), wortwoertlich
 *   - alle fuenfzehn Verweise der bisherigen `<velg-platform-footer>`, jetzt in
 *     der SEO-Fussleiste; keiner geht verloren
 *   - `<velg-game-card>` fuer die Dossierkarten, statt die TCG-Spezifikation
 *     ein zweites Mal nachzubauen
 *   - `t()` fuer die Zweisprachigkeit, wie ueberall im Werk
 *
 * DIE SEITE ZEIGT NIE EINEN FEHLER
 * Public-First: schlaegt der Schnappschuss fehl, bleibt die Seite stehen und
 * laesst die datengetragenen Abschnitte weg. Ein leeres Raster ist besser als
 * eine Fehlermeldung - und eine erfundene Zahl waere schlimmer als beides.
 */

import { localized } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { captureError } from '../../services/SentryService.js';
import { seoService } from '../../services/SeoService.js';
import type { LandingSnapshot } from '../../types/index.js';
import { injectLandingStructuredData } from './landing-structured-data.js';
import './LandingCitizens.js';
import './LandingForge.js';
import './LandingHero.js';
import './LandingSeoFooter.js';
import './LandingSystems.js';
import './LandingWorlds.js';

@localized()
@customElement('velg-landing-page')
export class VelgLandingPage extends LitElement {
  static styles = css`
    /* Die Buehnenmasse ("--stage-measure", "--stage-gutter",
       "--stage-type-scale") stehen in "styles/tokens/_layout.css" und gelten
       fuer Frontseite UND Dashboard. Die Bauformen dazu liegen in
       "components/shared/stage-styles.ts". Hier steht nichts davon: die
       Frontseite ist ein Verwender des Rasters, nicht sein Besitzer. */
    :host {
      display: block;
      background: var(--color-surface);
      color: var(--color-text-primary);
    }
  `;

  @state() private _snapshot: LandingSnapshot | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    injectLandingStructuredData();
    await this._load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    seoService.removeStructuredData();
  }

  private async _load(): Promise<void> {
    try {
      const response = await simulationsApi.getLandingSnapshot();
      if (response.success && response.data) {
        this._snapshot = response.data;
      }
    } catch (err) {
      // Die Seite bleibt stehen; die datengetragenen Abschnitte fallen weg.
      captureError(err, { source: 'VelgLandingPage._load' });
    }
  }

  protected render() {
    const snapshot = this._snapshot;
    const counts = snapshot?.counts ?? null;
    const worlds = snapshot?.worlds ?? [];
    const citizens = snapshot?.citizens ?? [];

    // Kein eigener Sprungverweis und kein eigenes <main>: die Huelle
    // (`app-shell`) liefert beides bereits. Die alte Fassung trug sie
    // trotzdem, und im laufenden Dokument standen deshalb ZWEI
    // `main#main-content` und ZWEI Sprungverweise — gemessen am 31.08.2026.
    // Shadow DOM verhindert den Kennungskonflikt, aber nicht die zwei
    // Sprungverweise in der Tabulatorreihenfolge.
    return html`
      <velg-landing-hero .counts=${counts} .worlds=${worlds}></velg-landing-hero>
      <velg-landing-systems .counts=${counts}></velg-landing-systems>
      <velg-landing-worlds .worlds=${worlds} .counts=${counts}></velg-landing-worlds>
      <velg-landing-citizens .citizens=${citizens}></velg-landing-citizens>
      <velg-landing-forge></velg-landing-forge>
      <velg-landing-seo-footer .worlds=${worlds}></velg-landing-seo-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-page': VelgLandingPage;
  }
}
