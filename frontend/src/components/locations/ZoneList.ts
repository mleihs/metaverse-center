import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Zone, ZoneStability } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

/** Ambient weather data for a zone (from heartbeat entries).
 * Field naming follows t() convention: `narrative` (EN) + `narrative_de` (DE).
 * Parent maps heartbeat entry's narrative_en → narrative when building this.
 */
export interface ZoneWeather {
  narrative: string;      // EN (t() base field)
  narrative_de: string;   // DE (t() locale field)
  categories: string[];
  temperature: number;
  weather_code: number;
}

/** Map WMO weather code categories to Unicode weather symbols. */
const WEATHER_SYMBOLS: Record<string, string> = {
  clear: '\u2600',           // ☀
  overcast: '\u2601',        // ☁
  fog: '\uD83C\uDF2B\uFE0F', // 🌫️
  fog_dense: '\uD83C\uDF2B\uFE0F',
  rain_light: '\uD83C\uDF26\uFE0F', // 🌦️
  rain: '\uD83C\uDF27\uFE0F', // 🌧️
  rain_freezing: '\u2744\uFE0F', // ❄️
  storm: '\u26C8\uFE0F',    // ⛈️
  snow: '\u2744\uFE0F',      // ❄️
  storm_snow: '\u2744\uFE0F',
  thunderstorm: '\u26A1',    // ⚡
  thunderstorm_severe: '\u26A1',
  heat: '\uD83D\uDD25',      // 🔥
  cold: '\u2744\uFE0F',      // ❄️
  wind: '\uD83D\uDCA8',      // 💨
  full_moon: '\uD83C\uDF15', // 🌕
  new_moon: '\uD83C\uDF11',  // 🌑
};

@localized()
@customElement('velg-zone-list')
export class VelgZoneList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .item {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .item:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .item:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .item__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0 0 var(--space-2);
    }

    .item__description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-snug);
      margin-bottom: var(--space-2);
    }

    .item__meta {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .item__badges {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin-top: var(--space-3);
    }

    .item__badge {
      display: inline-flex;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      color: var(--color-primary);
    }

    .item__badge--security {
      background: var(--color-warning-bg);
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    /* --- Stability bar with threshold markers --- */

    .item__stability {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .item__stability-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .item__stability-track {
      flex: 1;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: visible;
      position: relative;
    }

    .item__stability-fill {
      height: 100%;
      transition: width 0.3s ease;
    }

    /* RimWorld-style threshold markers at stability breakpoints */
    .item__stability-threshold {
      position: absolute;
      top: -2px;
      bottom: -2px;
      width: 1px;
      background: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
      pointer-events: none;
    }

    .item__stability-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      min-width: 28px;
      text-align: right;
    }

    /* --- Event risk indicator --- */

    .item__event-risk {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-2);
      padding: var(--space-1-5) var(--space-3);
      border-left: 2px solid var(--color-border-light);
      background: var(--color-surface-sunken);
    }

    .item__event-risk--high {
      border-left-color: var(--color-warning);
      background: color-mix(in srgb, var(--color-warning) 4%, var(--color-surface-sunken));
    }

    .item__event-risk--critical {
      border-left-color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface-sunken));
    }

    .item__risk-tier {
      display: inline-flex;
      padding: 1px var(--space-1-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      flex-shrink: 0;
    }

    .item__risk-tier--low {
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-success) 40%, transparent);
      color: var(--color-success);
    }

    .item__risk-tier--medium {
      background: color-mix(in srgb, var(--color-info, var(--color-primary)) 15%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-info, var(--color-primary)) 40%, transparent);
      color: var(--color-info, var(--color-primary));
    }

    .item__risk-tier--high {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-warning) 40%, transparent);
      color: var(--color-warning);
    }

    .item__risk-tier--critical {
      background: color-mix(in srgb, var(--color-danger) 15%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 40%, transparent);
      color: var(--color-danger);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .item__risk-multiplier {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-secondary);
    }

    .item__risk-hint {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    /* Critical zone background wash */
    .item--critical-zone {
      background: color-mix(in srgb, var(--color-danger) 3%, var(--color-surface-raised));
    }

    /* Fortification / Quarantine / Cascade overlays */
    .item--quarantined {
      border-color: var(--color-warning);
      background: repeating-linear-gradient(
        45deg,
        var(--color-surface-raised),
        var(--color-surface-raised) 8px,
        color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-raised)) 8px,
        color-mix(in srgb, var(--color-warning) 8%, var(--color-surface-raised)) 16px
      );
    }

    .item__overlays {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin-top: var(--space-2);
    }

    .item__overlay-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .item__overlay-badge--fortified {
      background: color-mix(in srgb, var(--color-success) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-success) 40%, transparent);
      color: var(--color-success);
    }

    .item__overlay-badge--quarantine {
      background: color-mix(in srgb, var(--color-warning) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-warning) 40%, transparent);
      color: var(--color-warning);
    }

    .item__overlay-badge--cascade-risk {
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-danger) 40%, transparent);
      color: var(--color-danger);
    }

    .item__cascade-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-danger);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    @media (prefers-reduced-motion: reduce) {
      .item__cascade-dot { animation: none; }
    }

    .item__pressure-text {
      font-family: var(--font-brutalist);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    /* --- Ambient weather indicator --- */

    .item__weather {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      border-left: 2px solid var(--color-border-light);
    }

    .item__weather-symbol {
      font-size: var(--text-lg);
      line-height: 1;
      flex-shrink: 0;
    }

    .item__weather-text {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    .item__weather-temp {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: var(--space-0-5);
    }
  `;

  @property({ attribute: false }) zones: Zone[] = [];
  @property({ attribute: false }) stabilityMap: Map<string, ZoneStability> = new Map();
  @property({ attribute: false }) weatherMap: Map<string, ZoneWeather> = new Map();

  private _stabilityColor(value: number): string {
    if (value < 0.3) return 'var(--color-danger)';
    if (value < 0.5) return 'var(--color-accent)';
    if (value < 0.7) return 'var(--color-success)';
    return 'var(--color-primary)';
  }

  /**
   * Piecewise linear event multiplier — mirrors backend _stability_event_multiplier().
   * Low stability → more events (up to 1.5x); high stability → fewer (down to 0.5x).
   */
  private _eventMultiplier(stability: number): number {
    const bp: [number, number][] = [
      [0.0, 1.5], [0.1, 1.5], [0.3, 1.3], [0.5, 1.0],
      [0.7, 0.8], [0.9, 0.5], [1.0, 0.5],
    ];
    const s = Math.max(0, Math.min(1, stability));
    for (let i = 0; i < bp.length - 1; i++) {
      const [x0, y0] = bp[i];
      const [x1, y1] = bp[i + 1];
      if (s <= x1) {
        if (x1 === x0) return y0;
        const t = (s - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return bp[bp.length - 1][1];
  }

  private _riskTier(multiplier: number): 'low' | 'medium' | 'high' | 'critical' {
    if (multiplier <= 0.7) return 'low';
    if (multiplier <= 1.0) return 'medium';
    if (multiplier <= 1.3) return 'high';
    return 'critical';
  }

  private _riskLabel(tier: string): string {
    switch (tier) {
      case 'low': return msg('LOW');
      case 'medium': return msg('MEDIUM');
      case 'high': return msg('HIGH');
      case 'critical': return msg('CRITICAL');
      default: return msg('UNKNOWN');
    }
  }

  private _handleSelect(zone: Zone): void {
    this.dispatchEvent(
      new CustomEvent('zone-select', {
        detail: zone,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderStabilityBar(zoneId: string) {
    const stability = this.stabilityMap.get(zoneId);
    if (!stability) return nothing;

    const pct = Math.round(stability.stability * 100);
    const color = this._stabilityColor(stability.stability);

    const multiplier = this._eventMultiplier(stability.stability);
    const tier = this._riskTier(multiplier);
    const riskHint =
      tier === 'critical' ? msg('Fortify to reduce pressure')
        : tier === 'high' ? msg('Consider zone fortification')
          : '';

    return html`
      <div class="item__stability">
        <span class="item__stability-label">${msg('Stability')}</span>
        <div class="item__stability-track"
          role="meter" aria-label=${msg('Zone stability')}
          aria-valuenow=${pct} aria-valuemin=${0} aria-valuemax=${100}>
          <div
            class="item__stability-fill"
            style="width: ${pct}%; background: ${color}"
          ></div>
          <!-- Threshold markers at critical (30%) and functional (50%) boundaries -->
          <span class="item__stability-threshold" style="left: 30%"></span>
          <span class="item__stability-threshold" style="left: 50%"></span>
        </div>
        <span class="item__stability-value" style="color: ${color}">${pct}%</span>
      </div>
      <div class="item__event-risk ${tier === 'high' ? 'item__event-risk--high' : tier === 'critical' ? 'item__event-risk--critical' : ''}"
        aria-label=${msg(str`Event risk: ${this._riskLabel(tier)}`)}>
        <span class="item__risk-tier item__risk-tier--${tier}">${this._riskLabel(tier)}</span>
        <span class="item__risk-multiplier">${multiplier.toFixed(1)}x</span>
        ${riskHint ? html`<span class="item__risk-hint">${riskHint}</span>` : nothing}
      </div>
    `;
  }

  private _renderOverlays(zoneId: string) {
    const stability = this.stabilityMap.get(zoneId);
    if (!stability) return nothing;

    const hasFortification = stability.fortification_reduction > 0;
    const isQuarantined = stability.is_quarantined;
    const hasCascadeRisk = stability.event_pressure > 0.7;

    if (!hasFortification && !isQuarantined && !hasCascadeRisk) return nothing;

    return html`
      <div class="item__overlays">
        ${
          hasFortification && !isQuarantined
            ? html`<span class="item__overlay-badge item__overlay-badge--fortified"
              aria-label=${msg('Zone fortified')}
            >${msg('Fortified')}</span>`
            : nothing
        }
        ${
          isQuarantined
            ? html`<span class="item__overlay-badge item__overlay-badge--quarantine"
              aria-label=${msg('Zone quarantined')}
            >${msg('Quarantined')}</span>`
            : nothing
        }
        ${
          hasCascadeRisk
            ? html`<span class="item__overlay-badge item__overlay-badge--cascade-risk"
              aria-label=${msg('Cascade risk: zone pressure exceeds threshold')}
            ><span class="item__cascade-dot"></span> ${msg('Cascade Risk')}</span>`
            : nothing
        }
      </div>
      ${
        stability.total_pressure > 0
          ? html`<div class="item__pressure-text">
            ${msg(str`Pressure: ${Math.round(stability.event_pressure * 100)}% targeted + ${Math.round(stability.ambient_pressure * 100)}% ambient${stability.fortification_reduction > 0 ? ` - ${Math.round(stability.fortification_reduction * 100)}% fortification` : ''}`)}
          </div>`
          : nothing
      }
    `;
  }

  private _renderWeather(zoneId: string) {
    const weather = this.weatherMap.get(zoneId);
    if (!weather) return nothing;

    const narrative = t(weather, 'narrative') as string;
    if (!narrative) return nothing;

    const primaryCategory = weather.categories?.[0] || 'clear';
    const symbol = WEATHER_SYMBOLS[primaryCategory] || '\u2601';

    return html`
      <div class="item__weather" aria-label=${msg('Current conditions')}>
        <span class="item__weather-symbol" aria-hidden="true">${symbol}</span>
        <div>
          <div class="item__weather-text">${narrative}</div>
          <div class="item__weather-temp">${weather.temperature}°C</div>
        </div>
      </div>
    `;
  }

  protected render() {
    return html`
      <div class="list">
        ${this.zones.map((zone) => {
          const stability = this.stabilityMap.get(zone.id);
          const isQuarantined = stability?.is_quarantined ?? false;
          const isCriticalZone = (stability?.stability ?? 1) < 0.3;
          return html`
            <div class="item ${isQuarantined ? 'item--quarantined' : ''} ${isCriticalZone ? 'item--critical-zone' : ''}" role="button" tabindex="0" @click=${() => this._handleSelect(zone)} @keydown=${(
              e: KeyboardEvent,
            ) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._handleSelect(zone);
              }
            }}>
              <h3 class="item__name">${zone.name}</h3>
              ${
                zone.description
                  ? html`<div class="item__description">${t(zone, 'description')}</div>`
                  : nothing
              }
              ${
                zone.population_estimate
                  ? html`<div class="item__meta">
                    ${msg(str`Est. Population: ${zone.population_estimate.toLocaleString()}`)}
                  </div>`
                  : nothing
              }
              <div class="item__badges">
                ${
                  zone.zone_type
                    ? html`<span class="item__badge">${t(zone, 'zone_type')}</span>`
                    : nothing
                }
                ${
                  zone.security_level
                    ? html`<span class="item__badge item__badge--security">${zone.security_level}</span>`
                    : nothing
                }
              </div>
              ${this._renderStabilityBar(zone.id)}
              ${this._renderOverlays(zone.id)}
              ${this._renderWeather(zone.id)}
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-zone-list': VelgZoneList;
  }
}
