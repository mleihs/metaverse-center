/**
 * ForecastPanel — End-of-month projection + 5 what-if sliders (P3.3).
 *
 * Backend (OpsForecastService) computes the baseline projection ONCE on
 * panel-open: linear + seasonal from the 30-day rollup, plus a
 * Haiku-generated NL driver text (cached 5 min, budget-exempt). The
 * client applies slider deltas LOCALLY for <100ms response (AD-6) —
 * dragging a slider re-runs the formula in JS, never round-trips to the
 * server.
 *
 * Slider → delta formula:
 *   growth_multiplier  → baseline × (value - 1)
 *   *_pct (purpose)    → baseline × purpose_share × ((value - 100) / 100)
 *   model_efficiency_pct → baseline × ((value - 100) / 100)
 *
 * Deltas are additive — operators reason in "this slider adds $X" terms;
 * multiplicative interaction would compound surprisingly. The driver
 * text reflects the BASELINE only; slider movements are local what-ifs.
 *
 * Data sources:
 *   - /admin/ops/forecast — own fetch on connect + manual refresh.
 *   - LedgerSnapshot.by_purpose — passed from AdminOpsTab so we share
 *     its 30s poll instead of duplicating the ledger fetch.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {
  bureauOpsApi,
  type ForecastProjection,
  type LedgerSnapshot,
} from '../../../services/api/BureauOpsApiService.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import '../../shared/VelgForecastSlider.js';
import '../../shared/VelgKineticCounter.js';

interface SliderDelta {
  usd: number;
  text: string;
  sign: 1 | 0 | -1;
}

@localized()
@customElement('velg-ops-forecast-panel')
export class VelgOpsForecastPanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_glow: color-mix(in srgb, var(--color-accent-amber) 18%, transparent);
      display: block;
      border: 2px solid var(--color-border);
      background: var(--color-surface-raised);
      padding: var(--space-5);
      position: relative;
    }

    :host::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--_accent);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--space-4);
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .header__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    .header__refresh {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: transparent;
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    .header__refresh:hover,
    .header__refresh:focus-visible {
      color: var(--color-primary);
      border-color: var(--color-primary);
      outline: none;
    }

    .header__refresh:focus-visible {
      box-shadow: var(--ring-focus);
    }

    .header__refresh:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .projection {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-4);
      position: relative;
    }

    @media (max-width: 700px) {
      .projection { grid-template-columns: 1fr; }
    }

    .projection__cell {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .projection__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .projection__value {
      font-family: var(--font-brutalist);
      font-variant-numeric: tabular-nums;
      font-size: var(--text-2xl);
      font-weight: var(--font-black);
      line-height: 1;
      color: var(--color-text-primary);
    }

    .projection__value--adjusted {
      color: var(--_accent);
      text-shadow: 0 0 12px var(--_glow);
    }

    .projection__band {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }

    .projection__delta {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      font-variant-numeric: tabular-nums;
    }

    .projection__delta--up { color: var(--color-warning); }
    .projection__delta--down { color: var(--color-success); }

    .driver {
      font-family: var(--font-bureau, var(--font-prose, serif));
      font-size: var(--text-sm);
      font-style: italic;
      color: var(--color-text-secondary);
      border-left: 3px solid var(--_accent);
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-5);
      line-height: var(--leading-relaxed);
    }

    .sliders {
      display: grid;
      gap: var(--space-3);
    }

    .sliders__heading {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 0 0 var(--space-2) 0;
    }

    .sliders__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }

    .sliders__reset-all {
      font-family: var(--font-brutalist);
      font-size: 9px;
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
      transition: color var(--transition-fast);
    }

    .sliders__reset-all:hover:not(:disabled),
    .sliders__reset-all:focus-visible:not(:disabled) {
      color: var(--color-primary);
      outline: none;
    }

    .sliders__reset-all:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .footnote {
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px dashed var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed);
    }

    .error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      margin-bottom: var(--space-4);
    }

    @media (prefers-reduced-motion: reduce) {
      .projection__value--adjusted { text-shadow: none; }
    }
  `;

  /** Shared with LedgerPanel; provides per-purpose share for slider deltas. */
  @property({ type: Object }) snapshot: LedgerSnapshot | null = null;

  @state() private _forecast: ForecastProjection | null = null;
  @state() private _loading = true;
  @state() private _refreshing = false;
  @state() private _error: string | null = null;
  @state() private _sliderValues: Record<string, number> = {};

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetch();
  }

  private async _fetch(): Promise<void> {
    this._refreshing = !this._loading;
    const resp = await bureauOpsApi.getForecast();
    if (resp.success) {
      this._forecast = resp.data;
      this._error = null;
      // Seed slider values to defaults on first load; preserve user edits
      // on manual refresh so re-fetching the projection does not blow
      // away the operator's in-progress what-if scenario.
      const next: Record<string, number> = {};
      for (const slider of resp.data.sliders) {
        next[slider.key] = this._sliderValues[slider.key] ?? slider.default;
      }
      this._sliderValues = next;
    } else {
      this._error = resp.error.message;
      captureError(new Error(resp.error.message), {
        source: 'ForecastPanel._fetch',
        code: resp.error.code,
      });
    }
    this._loading = false;
    this._refreshing = false;
  }

  private _handleSliderChange(e: CustomEvent<{ key: string; value: number }>): void {
    const { key, value } = e.detail;
    this._sliderValues = { ...this._sliderValues, [key]: value };
  }

  private _resetAll(): void {
    if (!this._forecast) return;
    const reset: Record<string, number> = {};
    for (const slider of this._forecast.sliders) {
      reset[slider.key] = slider.default;
    }
    this._sliderValues = reset;
  }

  /**
   * Compute the per-slider USD delta against the baseline projection.
   *
   * - growth_multiplier: scales the entire projection (baseline × (m - 1)).
   * - model_efficiency_pct: scales the entire projection.
   * - other *_pct sliders: scale the matching purpose share only.
   *
   * Purpose-share keys map to ai_usage_log.purpose values via prefix
   * match — "chat_pct" matches both "chat" and "chat_memory" rows so
   * the operator's mental model ("chat traffic") aligns with what they
   * see in the heatmap.
   */
  private _computeDelta(sliderKey: string, value: number, baseline: number): number {
    if (sliderKey === 'growth_multiplier') {
      return baseline * (value - 1);
    }
    if (sliderKey === 'model_efficiency_pct') {
      return baseline * ((value - 100) / 100);
    }
    const purposePrefix = sliderKey.replace(/_pct$/, '');
    const share = this._purposeShare(purposePrefix);
    return baseline * share * ((value - 100) / 100);
  }

  private _purposeShare(prefix: string): number {
    const purposes = this.snapshot?.by_purpose ?? [];
    if (purposes.length === 0) return 0;
    const total = purposes.reduce((sum, row) => sum + row.cost_usd, 0);
    if (total <= 0) return 0;
    const matching = purposes
      .filter((row) => row.key === prefix || row.key.startsWith(`${prefix}_`))
      .reduce((sum, row) => sum + row.cost_usd, 0);
    return matching / total;
  }

  private _formatUsd(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1000) return `$${value.toFixed(0)}`;
    if (abs >= 100) return `$${value.toFixed(1)}`;
    return `$${value.toFixed(2)}`;
  }

  private _formatSignedDelta(value: number): SliderDelta {
    const sign: 1 | 0 | -1 = value > 0.005 ? 1 : value < -0.005 ? -1 : 0;
    if (sign === 0) {
      return { usd: 0, text: '', sign: 0 };
    }
    const formatted = this._formatUsd(Math.abs(value));
    return {
      usd: value,
      text: sign > 0 ? `+${formatted}` : `−${formatted}`,
      sign,
    };
  }

  private _isAnyDirty(): boolean {
    if (!this._forecast) return false;
    return this._forecast.sliders.some(
      (slider) => this._sliderValues[slider.key] !== slider.default,
    );
  }

  protected render() {
    if (this._loading) {
      return html`<div class="header"><span class="header__label">${msg('Forecast // Oracle')}</span><span class="header__refresh">${msg('loading…')}</span></div>`;
    }
    if (this._error || !this._forecast) {
      return html`
        <div class="header"><span class="header__label">${msg('Forecast // Oracle')}</span></div>
        <div class="error">${msg('Forecast unavailable:')} ${this._error ?? msg('no data')}</div>
      `;
    }

    const f = this._forecast;
    const baseline = f.projected_usd;
    const ciHalf = f.confidence_high_usd - f.projected_usd;

    let totalDelta = 0;
    const sliderDeltas: Map<string, SliderDelta> = new Map();
    for (const slider of f.sliders) {
      const value = this._sliderValues[slider.key] ?? slider.default;
      const delta = this._computeDelta(slider.key, value, baseline);
      totalDelta += delta;
      sliderDeltas.set(slider.key, this._formatSignedDelta(delta));
    }
    const adjusted = baseline + totalDelta;
    const totalSign: 1 | 0 | -1 = totalDelta > 0.005 ? 1 : totalDelta < -0.005 ? -1 : 0;
    const dirty = this._isAnyDirty();

    return html`
      <div class="header">
        <span class="header__label">${msg('Forecast // Oracle')}</span>
        <button
          class="header__refresh"
          type="button"
          ?disabled=${this._refreshing}
          @click=${this._fetch}
          title=${msg('Refresh projection from server')}
        >
          ${icons.refresh(12)}
          ${this._refreshing ? msg('refreshing…') : msg('refresh')}
        </button>
      </div>

      <div class="projection">
        <div class="projection__cell">
          <span class="projection__label">${msg('Baseline (end-of-month)')}</span>
          <span class="projection__value">
            <velg-kinetic-counter
              .value=${baseline}
              prefix="$"
              .precision=${2}
            ></velg-kinetic-counter>
          </span>
          <span class="projection__band">
            ±${this._formatUsd(ciHalf)} · ${msg('days left:')} ${f.days_remaining}
          </span>
        </div>
        <div class="projection__cell">
          <span class="projection__label">
            ${dirty ? msg('What-if scenario') : msg('No adjustments active')}
          </span>
          <span class="projection__value ${dirty ? 'projection__value--adjusted' : ''}">
            <velg-kinetic-counter
              .value=${adjusted}
              prefix="$"
              .precision=${2}
            ></velg-kinetic-counter>
          </span>
          ${dirty
            ? html`<span
                class="projection__delta ${totalSign > 0 ? 'projection__delta--up' : totalSign < 0 ? 'projection__delta--down' : ''}"
              >
                ${totalSign > 0 ? '+' : totalSign < 0 ? '−' : ''}${this._formatUsd(Math.abs(totalDelta))} ${msg('vs baseline')}
              </span>`
            : nothing}
        </div>
      </div>

      ${f.driver_text ? html`<p class="driver">${f.driver_text}</p>` : nothing}

      <div class="sliders">
        <div class="sliders__heading">
          <h3 class="sliders__title">${msg('What-if sliders')}</h3>
          <button
            class="sliders__reset-all"
            type="button"
            ?disabled=${!dirty}
            @click=${this._resetAll}
          >
            ${msg('Reset all')}
          </button>
        </div>
        ${f.sliders.map((slider) => {
          const value = this._sliderValues[slider.key] ?? slider.default;
          const delta = sliderDeltas.get(slider.key);
          return html`
            <velg-forecast-slider
              key=${slider.key}
              label=${slider.label}
              .min=${slider.min}
              .max=${slider.max}
              .default=${slider.default}
              .value=${value}
              .step=${slider.unit === 'x' ? 0.1 : 1}
              unit=${slider.unit}
              delta-text=${delta?.text ?? ''}
              .deltaSign=${delta?.sign ?? 0}
              @slider-change=${this._handleSliderChange}
            ></velg-forecast-slider>
          `;
        })}
      </div>

      <p class="footnote">
        ${msg(
          'Sliders apply additive deltas client-side; refresh to re-fetch the baseline + driver text from the server.',
        )}
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-ops-forecast-panel': VelgOpsForecastPanel;
  }
}
