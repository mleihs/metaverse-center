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
 *
 * ZWEI VORLAGEN, EINE DATENQUELLE
 * Seit dem Atlas-Skin (03.09.2026) gibt es die Seite zweimal: "editorial" ist
 * die Fassung vom 31.08., "atlas" die Kartenmappe aus neun Blaettern. Welche
 * gilt, sagt "appState.landingTemplate" - abgeleitet vom Skin, siehe die
 * Begruendung dort.
 *
 * Der Unterschied ist AUSSCHLIESSLICH die Zusammensetzung. Der Schnappschuss,
 * sein Laden, die strukturierten Daten und die Fehlerbehandlung sind fuer beide
 * dieselben, und zwar buchstaeblich: sie stehen einmal hier. Eine zweite
 * Landing-Komponente mit eigener Ladelogik waere die naechste Datei, in der
 * eine Zahl anders gerechnet wird als in der ersten.
 *
 * Fuenf der neun Blaetter sind die bestehenden Abschnitte - sie tragen den
 * Skin ueber die Tokens und brauchen dafuer keine zweite Fassung. Vier gibt es
 * nur in der Kartenmappe: Legende (02), Vermessungsprotokoll (06),
 * Marginalien (08), Fundstuecke (09).
 */

import { localized } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { captureError } from '../../services/SentryService.js';
import { seoService } from '../../services/SeoService.js';
import type {
  LandingCitizen,
  LandingCounts,
  LandingPrompt,
  LandingSnapshot,
  LandingWorld,
} from '../../types/index.js';
import { injectLandingStructuredData } from './landing-structured-data.js';
import './LandingCitizens.js';
import './LandingForge.js';
import './LandingHero.js';
import './LandingSeoFooter.js';
import './LandingSystems.js';
import './LandingWorlds.js';
import './atlas/AtlasForge.js';
import './atlas/AtlasHero.js';
import './atlas/AtlasInformants.js';
import './atlas/AtlasSystems.js';
import './atlas/AtlasTerritories.js';
import './atlas/VelgLandingFindings.js';
import './atlas/VelgLandingLegend.js';
import './atlas/VelgLandingMarginalia.js';
import './atlas/VelgLandingSurveyLog.js';

@localized()
@customElement('velg-landing-page')
export class VelgLandingPage extends SignalWatcher(LitElement) {
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

  /**
   * Die Welt des Satzes, der im Schmiede-Abschnitt gerade anlaeuft.
   *
   * Die Frontseite haelt sie, nicht eines der beiden Bauteile: der Faecher
   * weiss nichts vom Schreibwerk und das Schreibwerk nichts vom Faecher, und
   * das soll so bleiben — sie stehen nur zufaellig uebereinander. Der Ort, an
   * dem sie sich kennen, ist die Seite, die beide rendert.
   *
   * `null` heisst „kein Zusammenhang": ein Beispielsatz gehoert zu keiner
   * Welt, und drei der sechzehn echten Saetze liessen sich keiner zuordnen
   * (Migration 328). Der Faecher blaettert dann wie bisher weiter.
   */
  @state() private _promptWorld: string | null = null;

  private _onPromptWorld = (e: Event): void => {
    const detail = (e as CustomEvent<{ simulationId: string | null }>).detail;
    this._promptWorld = detail?.simulationId ?? null;
  };

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
    const prompts = snapshot?.forge_prompts ?? [];

    // Kein eigener Sprungverweis und kein eigenes <main>: die Huelle
    // (`app-shell`) liefert beides bereits. Die alte Fassung trug sie
    // trotzdem, und im laufenden Dokument standen deshalb ZWEI
    // `main#main-content` und ZWEI Sprungverweise — gemessen am 31.08.2026.
    // Shadow DOM verhindert den Kennungskonflikt, aber nicht die zwei
    // Sprungverweise in der Tabulatorreihenfolge.
    /*
     * ZWEI GARNITUREN VON ABSCHNITTEN, EINE DATENQUELLE.
     *
     * Die Kartenmappe ist keine umgestellte Frontseite, sondern eine eigene
     * Vorlage: Blattraster, Blattkoepfe, Vermessungsraster, andere
     * Spaltenteilung. Deshalb hat sie eigene Bausteine in `landing/atlas/`
     * statt Verzweigungen in den bestehenden fuenf.
     *
     * WARUM NICHT `:host([template='atlas'])` IN DEN BESTEHENDEN
     *   Der Unterschied ist kein Detail, das man mit ein paar Regeln
     *   nachschaerft — der Hero wird von einem randlosen Bild mit vier
     *   Schleiern zu einer Figur in vier Spalten. Beides in einer Datei haette
     *   zwei Layouts in denselben Selektoren gehalten, und jede spaetere
     *   Aenderung haette beide anfassen muessen, ob sie wollte oder nicht.
     *   Und eine Release-Kuerzung waere ein Sweep durch fuenf Dateien statt
     *   das Loeschen eines Verzeichnisses.
     *
     * WAS SIE TEILEN, TEILEN SIE WIRKLICH
     *   Den Schnappschuss, sein Laden, die strukturierten Daten und die
     *   Fehlerbehandlung — die stehen einmal hier, oben in dieser Datei. Beide
     *   Garnituren bekommen dieselben Objekte als Eigenschaften. Eine zweite
     *   Ladelogik waere die naechste Stelle, an der eine Zahl anders gerechnet
     *   wird als in der ersten.
     */
    const footer = html`<velg-landing-seo-footer .worlds=${worlds}></velg-landing-seo-footer>`;

    if (appState.landingTemplate.value === 'atlas') {
      return this._renderAtlas({ counts, worlds, citizens, prompts, footer });
    }

    return html`
      <velg-landing-hero .counts=${counts} .worlds=${worlds}></velg-landing-hero>
      <velg-landing-systems .counts=${counts}></velg-landing-systems>
      <velg-landing-worlds .worlds=${worlds} .counts=${counts}></velg-landing-worlds>
      <velg-landing-citizens
        .citizens=${citizens}
        .highlightSimulationId=${this._promptWorld}
      ></velg-landing-citizens>
      <velg-landing-forge
        .prompts=${prompts}
        @prompt-world=${this._onPromptWorld}
      ></velg-landing-forge>
      ${footer}
    `;
  }

  /**
   * Die Kartenmappe — Blatt 01 bis 09 plus Fussleiste.
   *
   * Die Nummern der Blaetter sind keine Dekoration: sie stehen in den
   * Blattkoepfen der Bausteine und muessen deshalb der Reihenfolge HIER
   * entsprechen. Wer hier umstellt, stellt dort mit um.
   */
  private _renderAtlas(data: {
    counts: LandingCounts | null;
    worlds: LandingWorld[];
    citizens: LandingCitizen[];
    prompts: LandingPrompt[];
    footer: TemplateResult;
  }) {
    return html`
      <velg-atlas-hero .counts=${data.counts}></velg-atlas-hero>
      <velg-landing-legend></velg-landing-legend>
      <velg-atlas-systems .counts=${data.counts}></velg-atlas-systems>
      <velg-atlas-territories
        .worlds=${data.worlds}
        .counts=${data.counts}
      ></velg-atlas-territories>
      <velg-atlas-informants
        .citizens=${data.citizens}
        .highlightSimulationId=${this._promptWorld}
      ></velg-atlas-informants>
      <velg-landing-survey-log></velg-landing-survey-log>
      <velg-atlas-forge
        .prompts=${data.prompts}
        @prompt-world=${this._onPromptWorld}
      ></velg-atlas-forge>
      <velg-landing-marginalia .counts=${data.counts}></velg-landing-marginalia>
      <velg-landing-findings></velg-landing-findings>
      ${data.footer}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-page': VelgLandingPage;
  }
}
