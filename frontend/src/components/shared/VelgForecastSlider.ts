/**
 * VelgForecastSlider — range input with live-delta label primitive (P3.2).
 *
 * Generic shared primitive used by ForecastPanel and any future what-if
 * surface that needs a numerical input with side-by-side delta feedback.
 * The slider itself is purely visual: the parent computes the delta
 * string (e.g. "+$2.34", "-12 calls/min") and passes it via the
 * ``delta-text`` attribute. The ``delta-sign`` attribute drives the
 * delta colour (positive → warning amber, negative → success green,
 * zero → muted) so the same primitive can frame any signed metric.
 *
 * Brutalist aesthetics:
 *   - Hard-edge square thumb with offset shadow
 *   - Default-position tick on the track for "where you started"
 *   - Reset icon-button appears only when the value is dirty
 *   - Monospace tabular-nums value display, amber when off-default
 *   - Dashed border around the panel
 *
 * Events:
 *   slider-change → ForecastSliderChangeDetail
 *     (exported below so consumers narrow type-safely)
 *
 * Accessibility:
 *   - Native ``<input type="range">`` (full keyboard support).
 *   - ``aria-valuetext`` carries the value + unit ("100%").
 *   - When delta-text is non-empty it is exposed via ``aria-describedby``
 *     so screen readers announce "moving this slider adds $2.34" along
 *     with the value change.
 *   - Reset button is a 30×30 icon target (project IconButton convention,
 *     above the WCAG AA 24×24 minimum for non-essential controls; the
 *     same effect is also reachable by dragging back to default).
 *
 * Usage:
 *   <velg-forecast-slider
 *     key="forge_runs_pct"
 *     label="Forge ignites vs current"
 *     min=${0} max=${300} default=${100} value=${value} step=${5}
 *     unit="%"
 *     delta-text="+$2.34"
 *     delta-sign=${1}
 *     @slider-change=${onSliderChange}
 *   ></velg-forecast-slider>
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized, msg } from '@lit/localize';

import { icons } from '../../utils/icons.js';

/**
 * Detail payload of the ``slider-change`` CustomEvent. Exported so panels
 * can narrow event handlers type-safely without relying on structural
 * subset-matching that would silently drift if the slider extended its
 * payload later.
 */
export interface ForecastSliderChangeDetail {
  key: string;
  value: number;
  default: number;
  raw: string;
}

@localized()
@customElement('velg-forecast-slider')
export class VelgForecastSlider extends LitElement {
  /** Stable key used in slider-change events; matches the backend slider catalog. */
  @property({ type: String }) key = '';
  /** Visible label rendered above the slider. Parent provides translated text. */
  @property({ type: String }) label = '';
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  /** The "no change" baseline. A tick is rendered at this position. */
  @property({ type: Number }) default = 50;
  @property({ type: Number }) value = 50;
  @property({ type: Number }) step = 1;
  /** Unit suffix shown after the value (e.g. "%", "x"). */
  @property({ type: String }) unit = '';
  /** Pre-formatted delta string (e.g. "+$2.34"). Parent owns formatting. */
  @property({ type: String, attribute: 'delta-text' }) deltaText = '';
  /** Sign of the delta drives colour: 1 = up/warning, -1 = down/success, 0 = neutral. */
  @property({ type: Number, attribute: 'delta-sign' }) deltaSign = 0;
  @property({ type: Boolean }) disabled = false;

  static styles = css`
    :host {
      --_track-h: 4px;
      --_thumb-size: 18px;
      --_track-bg: var(--color-border);
      --_track-fill: var(--color-primary);
      --_thumb: var(--color-primary);
      --_thumb-active: var(--color-primary-active);
      --_value-default: var(--color-text-primary);
      --_value-dirty: var(--color-primary);
      --_delta-up: var(--color-warning);
      --_delta-down: var(--color-success);
      --_delta-zero: var(--color-text-muted);

      display: block;
    }

    .slider {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3) var(--space-2-5);
      background: var(--color-surface-raised);
      border: 1px dashed var(--color-border);
    }

    .slider__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .slider__label {
      flex: 1;
      min-width: 0;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      cursor: pointer;
    }

    .slider__value {
      font-family: var(--font-mono);
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--_value-default);
      font-variant-numeric: tabular-nums;
      transition: color var(--transition-fast);
      min-width: 4ch;
      text-align: right;
    }

    .slider__value--dirty {
      color: var(--_value-dirty);
    }

    .slider__track-wrapper {
      position: relative;
      height: var(--_thumb-size);
      display: flex;
      align-items: center;
    }

    .slider__input {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      height: var(--_thumb-size);
      background: transparent;
      cursor: pointer;
      margin: 0;
      padding: 0;
    }

    .slider__input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .slider__input::-webkit-slider-runnable-track {
      height: var(--_track-h);
      background: var(--_track-bg);
      border: none;
    }

    .slider__input::-moz-range-track {
      height: var(--_track-h);
      background: var(--_track-bg);
      border: none;
    }

    .slider__input::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: var(--_thumb-size);
      height: var(--_thumb-size);
      background: var(--_thumb);
      border: 2px solid var(--color-text-inverse);
      box-shadow: var(--shadow-xs);
      margin-top: calc((var(--_thumb-size) - var(--_track-h)) / -2);
      cursor: grab;
      transition: background var(--transition-fast);
    }

    .slider__input::-moz-range-thumb {
      width: var(--_thumb-size);
      height: var(--_thumb-size);
      background: var(--_thumb);
      border: 2px solid var(--color-text-inverse);
      box-shadow: var(--shadow-xs);
      cursor: grab;
      transition: background var(--transition-fast);
    }

    .slider__input:focus-visible {
      outline: none;
    }

    .slider__input:focus-visible::-webkit-slider-thumb {
      box-shadow: var(--shadow-xs), var(--ring-focus);
    }

    .slider__input:focus-visible::-moz-range-thumb {
      box-shadow: var(--shadow-xs), var(--ring-focus);
    }

    .slider__input:active::-webkit-slider-thumb {
      background: var(--_thumb-active);
      cursor: grabbing;
    }

    .slider__input:active::-moz-range-thumb {
      background: var(--_thumb-active);
      cursor: grabbing;
    }

    .slider__default-tick {
      position: absolute;
      top: calc(50% - 6px);
      width: 2px;
      height: 12px;
      background: var(--color-text-muted);
      pointer-events: none;
      transform: translateX(-50%);
    }

    .slider__footer {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    .slider__default-label {
      color: var(--color-text-muted);
      letter-spacing: var(--tracking-wide);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slider__default-label strong {
      color: var(--color-text-secondary);
      font-weight: var(--font-semibold);
    }

    .slider__delta {
      font-variant-numeric: tabular-nums;
      font-weight: var(--font-semibold);
      white-space: nowrap;
    }

    .slider__delta--up { color: var(--_delta-up); }
    .slider__delta--down { color: var(--_delta-down); }
    .slider__delta--zero { color: var(--_delta-zero); }
    .slider__delta--placeholder {
      color: var(--color-text-muted);
      opacity: 0.4;
    }

    .slider__reset {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast),
        background var(--transition-fast);
    }

    .slider__reset:hover,
    .slider__reset:focus-visible {
      color: var(--color-primary);
      border-color: var(--color-primary);
      background: var(--color-primary-bg);
      outline: none;
    }

    .slider__reset:focus-visible {
      box-shadow: var(--ring-focus);
    }

    @media (prefers-reduced-motion: reduce) {
      .slider__value,
      .slider__input::-webkit-slider-thumb,
      .slider__input::-moz-range-thumb,
      .slider__reset {
        transition: none;
      }
    }
  `;

  protected render() {
    const isDirty = this.value !== this.default;
    const trackPct =
      this.max === this.min ? 0 : ((this.default - this.min) / (this.max - this.min)) * 100;
    // Native <input type="range">'s track is inset by half a thumb-width on
    // each end (the thumb is centered when at min/max). Without this
    // correction, the tick at trackPct=0 would sit at the visual left edge
    // while the thumb at min sits inset by thumb/2. The shift maps trackPct
    // ∈ [0, 100] to a multiplier ∈ [+0.5, -0.5] so the tick aligns with the
    // thumb at every position. Verified at extremes (0/50/100) and quarter
    // points; matches the native browser geometry of WebKit/Gecko range
    // tracks (Chromium/Firefox/Safari all inset by half-thumb).
    const thumbShift = 0.5 - trackPct / 100;
    const formattedValue = `${this.value}${this.unit}`;
    const formattedDefault = `${this.default}${this.unit}`;
    const deltaClass =
      this.deltaSign > 0
        ? 'slider__delta--up'
        : this.deltaSign < 0
          ? 'slider__delta--down'
          : 'slider__delta--zero';
    const inputId = `range-${this.key}`;
    const deltaId = `delta-${this.key}`;
    // Compose aria-valuetext so screen readers announce "100% (+$2.34)"
    // when the operator scrubs — the visible delta is otherwise invisible
    // to assistive tech because it lives in a sibling element.
    const valuetext = this.deltaText
      ? `${formattedValue} (${this.deltaText})`
      : formattedValue;

    return html`
      <div class="slider" part="root">
        <header class="slider__header">
          <label class="slider__label" for=${inputId}>${this.label}</label>
          <output
            class="slider__value ${isDirty ? 'slider__value--dirty' : ''}"
            for=${inputId}
          >
            ${formattedValue}
          </output>
        </header>
        <div class="slider__track-wrapper">
          <input
            id=${inputId}
            class="slider__input"
            type="range"
            min=${this.min}
            max=${this.max}
            step=${this.step}
            .value=${String(this.value)}
            ?disabled=${this.disabled}
            aria-label=${this.label}
            aria-valuetext=${valuetext}
            aria-describedby=${this.deltaText ? deltaId : nothing}
            @input=${this._onInput}
          />
          <span
            class="slider__default-tick"
            style="left: calc(${trackPct}% + ${thumbShift} * var(--_thumb-size))"
            aria-hidden="true"
          ></span>
        </div>
        <footer class="slider__footer">
          <span class="slider__default-label">
            ${msg('default:')} <strong>${formattedDefault}</strong>
          </span>
          ${
            this.deltaText
              ? html`<span id=${deltaId} class="slider__delta ${deltaClass}">${this.deltaText}</span>`
              : html`<span
                  class="slider__delta slider__delta--placeholder"
                  aria-hidden="true"
                  >–</span
                >`
          }
          ${
            isDirty
              ? html`<button
                  class="slider__reset"
                  type="button"
                  @click=${this._reset}
                  aria-label=${msg('Reset to default')}
                  title=${msg('Reset to default')}
                >
                  ${icons.refresh(14)}
                </button>`
              : nothing
          }
        </footer>
      </div>
    `;
  }

  private _clamp(value: number): number {
    if (Number.isNaN(value)) return this.default;
    if (this.max < this.min) return value;
    return Math.min(this.max, Math.max(this.min, value));
  }

  private _onInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const raw = input.value;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    // Defensive clamp: native <input type="range"> already enforces bounds,
    // but a misconfigured caller passing min > max or external value
    // injections via JS could leak out-of-range values. Clamp here so the
    // dispatched event is always within [min, max].
    const value = this._clamp(parsed);
    this.value = value;
    this._emit(value, raw);
  }

  private _reset() {
    if (this.value === this.default) return;
    this.value = this.default;
    this._emit(this.default, String(this.default));
  }

  private _emit(value: number, raw: string): void {
    const detail: ForecastSliderChangeDetail = {
      key: this.key,
      value,
      default: this.default,
      raw,
    };
    this.dispatchEvent(
      new CustomEvent<ForecastSliderChangeDetail>('slider-change', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forecast-slider': VelgForecastSlider;
  }
}
