import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  type AIUsageBreakdown,
  type AIUsageStats,
  adminApi,
} from '../../../services/api/AdminApiService.js';
import { captureError } from '../../../services/SentryService.js';
import {
  type Cell,
  compareCells,
  formatAmount,
  formatCount,
  formatPercent,
} from '../../../utils/kontor-format.js';
import { renderCell } from '../../shared/kontor-cell.js';
import { kontorTableStyles, kontorTableTokens } from '../../shared/kontor-table-styles.js';
import '../../shared/VelgMetricCard.js';
import '../../shared/EchartsChart.js';
import '../../shared/LoadingState.js';
import '../../shared/ErrorState.js';
import '../../shared/EmptyState.js';

/**
 * KONTOR — Kosten und Telemetrie, Betreiberinnen-Ansicht.
 *
 * Arbeitswerkzeug fuer genau eine Person. Dichte erwuenscht, Schmuck nicht:
 * keine Kaskade, kein Versatz beim Ueberfahren, keine Eckklammern. Was hier
 * steht, steht, weil es eine Zahl traegt.
 *
 * ── WAS DIESES PANEL BEHAUPTET, UND WAS DER ALTE TAB NICHT KONNTE ──────────
 *
 * **Jeder Mittelwert traegt seine Zaehlbasis.** Auf Prod gemessen (05.09.2026)
 * tragen 204 von 1 644 beantworteten Aufrufen gar keinen Betrag — jede achte
 * Zeile. Verbucht eine Aggregation sie als Null, ist der Mittelwert 14,2 %
 * zu niedrig **und die Summe daneben stimmt trotzdem**. Genau so ist der
 * Fehler seit Migration 152 unbemerkt geblieben.
 *
 * Je Zweck wird es schlimmer, weil sich die betragslosen Zeilen dort sammeln,
 * wo keine Tokenzahlen zurueckkommen: `translation` traegt 318 Zeilen, davon
 * 201 ohne Betrag. Ein Mittelwert fuer `translation` waere nicht ungenau,
 * sondern um 63 % falsch.
 *
 * Deshalb steht in jeder Zeile dieser Tabellen die Basis neben der Zahl, und
 * jede Zelle ohne Wert traegt ihr eigenes Zeichen statt einer erfundenen Null.
 *
 * ── DIE SECHS ZELLZUSTAENDE ────────────────────────────────────────────────
 *
 * Sie kommen aus `utils/kontor-format.ts` und werden hier nicht neu erfunden.
 * Der Zustand haengt an der ZELLE, nicht an der Spalte: eine Spalte darf
 * gemessene und nicht erfasste Zeilen mischen.
 */
@localized()
@customElement('velg-kontor-panel')
export class VelgKontorPanel extends LitElement {
  static styles = [
    kontorTableTokens,
    kontorTableStyles,
    css`
      :host {
        display: block;
        /* Die Aufschluesselungen stehen enger als eine Haupttabelle: die
           Textspalte traegt Modell-Slugs, nicht Saetze. */
        --_kontor-label-w: 200px;
        --_kontor-amount-w: 110px;
      }

      .kontor__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-6);
        padding-bottom: var(--space-2-5);
        box-shadow: inset 0 -1px var(--color-border);
        margin-bottom: var(--space-4);
      }

      .kontor__title {
        font-family: var(--font-brutalist);
        font-weight: var(--heading-weight);
        text-transform: var(--heading-transform);
        letter-spacing: var(--heading-tracking);
        font-size: var(--text-lg);
        color: var(--color-text-primary);
        margin: 0;
      }

      .kontor__kicker {
        font-family: var(--font-mono);
        font-size: var(--_kontor-micro);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
        margin-left: var(--space-3);
      }

      .kontor__period {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        background: var(--color-surface-raised);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        padding: var(--space-1) var(--space-2);
      }

      .kontor__tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: var(--space-3);
        margin-bottom: var(--space-5);
      }

      .kontor__chart {
        border: 1px solid var(--color-border);
        background: var(--color-surface-raised);
        padding: var(--space-3);
        margin-bottom: var(--space-5);
      }

      .kontor__note {
        font-family: var(--font-mono);
        font-size: var(--_kontor-micro);
        color: var(--color-text-muted);
        padding-top: var(--space-2);
      }

      .kontor__sections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: var(--space-5);
      }

      .kontor__section {
        border: 1px solid var(--color-border);
        background: var(--color-surface-raised);
        min-width: 0;
      }

      .kontor__section-title {
        font-family: var(--font-brutalist);
        font-size: var(--_kontor-micro);
        font-weight: var(--font-bold);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-secondary);
        margin: 0;
        padding: var(--space-2) var(--space-2-5);
        box-shadow: inset 0 -1px var(--color-border);
      }

      /* Die Legende steht UEBER der Tabelle, nicht darunter: ein Zeichen, das
         man erst nachschlaegt, nachdem man es falsch gelesen hat, hat nichts
         erklaert. */
      .kontor__legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-2-5);
        font-family: var(--font-mono);
        font-size: var(--_kontor-micro);
        color: var(--color-text-muted);
        box-shadow: inset 0 -1px var(--color-border-light);
      }

      .kontor__scroll {
        max-height: 420px;
        overflow-y: auto;
        overflow-x: auto;
      }
    `,
  ];

  @state() private _stats: AIUsageStats | null = null;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _days = 180;
  /** Eine Spalte zur Zeit, zwei Zustaende. Vorgabe: Kosten absteigend. */
  @state() private _sortDir: 'asc' | 'desc' = 'desc';

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const resp = await adminApi.getAIUsageStats(this._days);
      if (resp.success && resp.data) {
        this._stats = resp.data;
      } else {
        this._error = resp.error?.message ?? msg('Could not load usage data.');
      }
    } catch (err) {
      captureError(err, { source: 'KontorPanel._load' });
      this._error = msg('Could not load usage data.');
    } finally {
      this._loading = false;
    }
  }

  private _onPeriod(e: Event): void {
    this._days = Number((e.target as HTMLSelectElement).value);
    void this._load();
  }

  private _onSort(): void {
    this._sortDir = this._sortDir === 'desc' ? 'asc' : 'desc';
  }

  /**
   * Ein Kontor-Token zur Laufzeit lesen.
   *
   * ECharts zeichnet auf Canvas — ein `var()` kommt dort nicht an, die Farbe
   * muss als Wert in die Option. Sie wird deshalb vom WIRT gelesen und nicht
   * aus `:root`: das Panel steht in der Plattformhuelle, und die Tokens
   * stehen dort, wo `ThemeService` sie geschrieben hat.
   *
   * Kein Hex-Rueckfallwert. Ein leeres Token heisst, dass
   * `publishKontorPalette` auf diesem Wirt nicht gelaufen ist — das ist ein
   * Fehler und wird gemeldet, nicht mit einer Farbe ueberdeckt, die als
   * einzige im Panel keinen Skin kennt.
   */
  private _token(name: string): string {
    const wert = getComputedStyle(this).getPropertyValue(name).trim();
    if (!wert) {
      captureError(new Error(`Kontor-Token ${name} ist auf diesem Wirt leer`), {
        source: 'KontorPanel._token',
      });
    }
    return wert;
  }

  protected render(): TemplateResult {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Reading the ledger')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${() => void this._load()}
      ></velg-error-state>`;
    }
    if (!this._stats) {
      return html`<velg-empty-state message=${msg('No usage recorded yet.')}></velg-empty-state>`;
    }
    return this._renderPanel(this._stats);
  }

  private _renderPanel(s: AIUsageStats): TemplateResult {
    return html`
      <div class="kontor__head">
        <div>
          <h2 class="kontor__title">
            ${msg('Kontor')}<span class="kontor__kicker"
              >${msg('Costs & telemetry')}</span
            >
          </h2>
        </div>
        <select
          class="kontor__period"
          aria-label=${msg('Period')}
          @change=${this._onPeriod}
        >
          ${[7, 30, 90, 180, 365].map(
            (d) =>
              html`<option value=${d} ?selected=${this._days === d}>
                ${msg(str`${d} days`)}
              </option>`,
          )}
        </select>
      </div>

      <div class="kontor__tiles">${this._renderTiles(s)}</div>
      ${this._renderChart(s)}

      <div class="kontor__sections">
        ${this._renderBreakdown(msg('By model'), 'model', s.by_model)}
        ${this._renderBreakdown(msg('By purpose'), 'purpose', s.by_purpose)}
        ${this._renderBreakdown(msg('By provider'), 'provider', s.by_provider)}
        ${this._renderOutcomes(s)}
      </div>
    `;
  }

  /**
   * Die Kopfkacheln.
   *
   * Sechs Zahlen, ein Blick. Die dritte traegt ihre Zaehlbasis als Unterzeile
   * — sie ist der Grund, warum es dieses Panel gibt.
   */
  private _renderTiles(s: AIUsageStats): TemplateResult {
    const basisBekannt = s.avg_cost_basis > 0 && s.avg_cost_of > 0;
    const anteilOhne = s.avg_cost_of > 0 ? s.unrecorded_calls / s.avg_cost_of : 0;
    const fehler = Object.entries(s.by_outcome ?? {})
      .filter(([k]) => k !== 'ok')
      .reduce((sum, [, v]) => sum + (v?.calls ?? 0), 0);

    return html`
      <velg-metric-card
        label=${msg('Actual')}
        value=${formatAmount(s.total_cost_usd).text}
        sublabel=${msg(str`${this._days} days`)}
        variant="warning"
      ></velg-metric-card>

      <velg-metric-card
        label=${msg('Per call')}
        value=${formatAmount(s.avg_cost_per_call).text}
        sublabel=${
          basisBekannt
            ? msg(str`n = ${formatCount(s.avg_cost_basis)} of ${formatCount(s.avg_cost_of)}`)
            : msg('basis not stated')
        }
      ></velg-metric-card>

      <velg-metric-card
        label=${msg('Without amount')}
        value=${formatCount(s.unrecorded_calls)}
        sublabel=${basisBekannt ? msg(str`${formatPercent(anteilOhne)} of all rows`) : ''}
      ></velg-metric-card>

      <velg-metric-card
        label=${msg('Calls')}
        value=${formatCount(s.total_calls)}
      ></velg-metric-card>

      <velg-metric-card
        label=${msg('Tokens')}
        value=${formatCount(s.total_tokens)}
      ></velg-metric-card>

      <velg-metric-card
        label=${msg('Failed')}
        value=${formatCount(fehler)}
        variant=${fehler > 0 ? 'danger' : 'default'}
      ></velg-metric-card>
    `;
  }

  /**
   * Das Hauptdiagramm: Kosten je Tag.
   *
   * ⚠ Die Farben werden zur LAUFZEIT aus dem Wirt gelesen. ECharts zeichnet
   * auf Canvas — ein `var()` kommt dort nicht an, und ein Hexwert im Quelltext
   * kennt den Skin nicht. `EchartsChart` liest die Grundtoene selbst; die
   * Serienfarbe und die Gitterlinie gibt dieses Panel dazu, weil es die
   * KONTOR-Rollen sind und nicht die der Plattform.
   */
  private _renderChart(s: AIUsageStats): TemplateResult {
    const serie = this._token('--color-series-text');
    const gitter = this._token('--color-chart-grid');

    const tage = s.daily_trend;
    if (!tage.length) {
      return html`<div class="kontor__chart">
        <velg-empty-state message=${msg('No day carries a value in this period.')}></velg-empty-state>
      </div>`;
    }

    return html`
      <div class="kontor__chart">
        <velg-echarts-chart
          height="240px"
          aria-label=${msg('Cost per day')}
          .option=${{
            grid: { left: 56, right: 16, top: 16, bottom: 28 },
            xAxis: {
              type: 'category',
              data: tage.map((t) => t.day),
              splitLine: { show: false },
            },
            yAxis: {
              type: 'value',
              splitLine: {
                lineStyle: gitter ? { color: gitter, type: 'dashed' } : { type: 'dashed' },
              },
            },
            tooltip: { trigger: 'axis' },
            series: [
              {
                type: 'bar',
                data: tage.map((t) => t.cost),
                // Fehlt das Token, bleibt itemStyle weg und ECharts nimmt die
                // Themenfarbe, die `EchartsChart` selbst aus dem Wirt liest.
                // Ein Hexwert als Rueckfall waere die einzige Farbe im Panel,
                // die keinen Skin kennt.
                ...(serie ? { itemStyle: { color: serie } } : {}),
              },
            ],
          }}
        ></velg-echarts-chart>
        <div class="kontor__note">
          ${msg('One bar per day. Rows without an amount stand on no axis here.')}
        </div>
      </div>
    `;
  }

  /**
   * Eine Aufschluesselung — je Achse eine.
   *
   * Jede Zeile traegt: Betrag, Ø je Aufruf MIT Zaehlbasis, und die Zahl der
   * Zeilen ohne Betrag als eigener Zellzustand. Ohne die dritte Spalte waere
   * die zweite genauso falsch wie die Plattformzahl vor Migration 389.
   */
  private _renderBreakdown<K extends string>(
    titel: string,
    schluessel: K,
    zeilen: ReadonlyArray<AIUsageBreakdown & Record<K, string>>,
  ): TemplateResult {
    if (!zeilen.length) {
      return html`<section class="kontor__section">
        <h3 class="kontor__section-title">${titel}</h3>
        <velg-empty-state message=${msg('This axis carries no rows.')}></velg-empty-state>
      </section>`;
    }

    /*
     * Der Anbieter-Praefix faellt weg, WENN die Kurznamen eindeutig bleiben.
     *
     * Im Browser gesehen (05.09.2026): die zwei teuersten Zeilen standen beide
     * als „black-forest-labs/flux-2-…" da -- der Auslassungspunkt kappte genau
     * die Silbe, in der sie sich unterscheiden (pro gegen max). Die beiden
     * groessten Posten der Tabelle waren nicht auseinanderzuhalten.
     *
     * Gekuerzt wird nur, wenn dabei keine NEUE Mehrdeutigkeit entsteht: gaebe
     * es zwei Anbieter mit gleichem Modellnamen, blieben die vollen Namen
     * stehen. Ein kuerzerer Name, der zwei Dinge meint, waere derselbe Fehler
     * noch einmal. Der volle Slug steht in jedem Fall im title-Attribut.
     */
    const kurz = (voll: string): string => voll.split('/').pop() || voll;
    const kurzeNamen = zeilen.map((z) => kurz(z[schluessel]));
    const eindeutig = new Set(kurzeNamen).size === kurzeNamen.length;

    const aufbereitet = zeilen.map((z) => {
      const kosten = z.cost ?? 0;
      const aufrufe = z.calls ?? 0;
      // `billed` fehlt auf einer Datenbank vor Migration 389. Dann ist die
      // Basis NICHT bekannt — und ein Mittelwert ohne bekannte Basis wird
      // hier nicht geraten, sondern als „nicht erfasst" gezeigt.
      // Kein `!`-Zugriff: das Feld fehlt auf einer Datenbank vor Migration
      // 389, und „fehlt" ist hier eine Aussage (Basis nicht bekannt), kein
      // Grund, die Typpruefung zu uebergehen.
      const gebucht = z.billed;
      const basisBekannt = gebucht !== undefined && gebucht !== null;
      const basis = gebucht ?? 0;
      const ohne = basisBekannt ? (z.unrecorded ?? aufrufe - basis) : 0;
      return {
        voll: z[schluessel] || msg('unassigned'),
        name: eindeutig
          ? kurz(z[schluessel] || '') || msg('unassigned')
          : z[schluessel] || msg('unassigned'),
        aufrufe,
        basisBekannt,
        basis,
        ohne,
        kosten: formatAmount(kosten),
        // Der Mittelwert dieser Zeile, ueber die Zeilen MIT Betrag.
        mittel: basisBekannt && basis > 0 ? formatAmount(kosten / basis) : formatAmount(null),
        ohneZelle: basisBekannt
          ? ohne > 0
            ? formatAmount(null)
            : formatAmount(0)
          : formatAmount(null),
      };
    });

    aufbereitet.sort((a, b) => compareCells(a.kosten, b.kosten, this._sortDir));

    return html`
      <section class="kontor__section">
        <h3 class="kontor__section-title">${titel}</h3>
        <div class="kontor__legend kontor-legend__probe">
          <span>${msg('Cell states:')}</span>
          <span>${renderCell(formatAmount(0.003))} ${msg('measured')}</span>
          <span>${renderCell(formatAmount(null), msg('not recorded'))} ${msg('not recorded')}</span>
        </div>
        <div class="kontor__scroll">
          <table class="kontor-table">
            <thead class="kontor-table__head">
              <tr>
                <th class="kontor-col--label">${titel}</th>
                <th
                  class="kontor-col--amount"
                  aria-sort=${this._sortDir === 'desc' ? 'descending' : 'ascending'}
                  tabindex="0"
                  @click=${this._onSort}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this._onSort();
                    }
                  }}
                >
                  ${msg('Cost')}<span class="kontor-table__sort"
                    >${this._sortDir === 'desc' ? '▾' : '▴'}</span
                  >
                </th>
                <th class="kontor-col--amount">${msg('Per call')}</th>
                <th class="kontor-col--amount">${msg('Without amount')}</th>
              </tr>
            </thead>
            <tbody class="kontor-table__body">
              ${aufbereitet.map(
                (r) => html`
                  <tr>
                    <td class="kontor-col--label" title=${r.voll}>${r.name}</td>
                    <td class="kontor-col--amount">${renderCell(r.kosten)}</td>
                    <td class="kontor-col--amount">
                      ${renderCell(r.mittel, msg('not recorded'))}
                      ${
                        r.basisBekannt
                          ? html`<span class="kontor-basis"
                            >${msg(
                              str`n = ${formatCount(r.basis)} of ${formatCount(r.aufrufe)}`,
                            )}</span
                          >`
                          : nothing
                      }
                    </td>
                    <td class="kontor-col--amount">
                      ${
                        r.ohne > 0
                          ? html`<span class="kontor-cell kontor-cell--unrecorded"
                            >${formatCount(r.ohne)}</span
                          >`
                          : renderCell(formatAmount(0))
                      }
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  /**
   * Die Ausgangs-Achse.
   *
   * Die einzige Aggregation der RPC ohne `outcome = 'ok'`-Filter — hier IST
   * der Ausgang die Achse. Sie ist die Probe darauf, dass eine Zaehlung, die
   * „beantwortet" meint, Fehlschlaege nicht mitzaehlt.
   */
  private _renderOutcomes(s: AIUsageStats): TemplateResult {
    const eintraege = Object.entries(s.by_outcome ?? {});
    if (!eintraege.length) {
      return html`<section class="kontor__section">
        <h3 class="kontor__section-title">${msg('By outcome')}</h3>
        <velg-empty-state
          message=${msg('The database has not recorded outcomes yet.')}
        ></velg-empty-state>
      </section>`;
    }

    const zeilen: Array<{ name: string; aufrufe: number; kosten: Cell }> = eintraege
      .map(([name, v]) => ({
        name,
        aufrufe: v?.calls ?? 0,
        kosten: formatAmount(v?.cost ?? null),
      }))
      .sort((a, b) => b.aufrufe - a.aufrufe);

    return html`
      <section class="kontor__section">
        <h3 class="kontor__section-title">${msg('By outcome')}</h3>
        <div class="kontor__scroll">
          <table class="kontor-table">
            <thead class="kontor-table__head">
              <tr>
                <th class="kontor-col--label">${msg('Outcome')}</th>
                <th class="kontor-col--amount">${msg('Calls')}</th>
                <th class="kontor-col--amount">${msg('Cost')}</th>
              </tr>
            </thead>
            <tbody class="kontor-table__body">
              ${zeilen.map(
                (r) => html`
                  <tr>
                    <td class="kontor-col--label">${r.name}</td>
                    <td class="kontor-col--amount">${formatCount(r.aufrufe)}</td>
                    <td class="kontor-col--amount">${renderCell(r.kosten)}</td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-kontor-panel': VelgKontorPanel;
  }
}
