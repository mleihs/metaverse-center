/**
 * Die diplomatische Übersicht einer Welt.
 *
 * ── WARUM DIESE DATEI ENTSTANDEN IST ────────────────────────────────────────
 *
 * Sie stand bis zum 02.09.2026 in `social/SocialTrendsView.ts`, mitten in einer
 * View, deren Aufgabe das Durchsehen von Nachrichtenartikeln ist. Die Schleuse
 * (`components/intake/**`) ersetzt genau diese Aufgabe — und Schritt 8 ihres
 * Bauplans lautet „alte Views löschen".
 *
 * ⚠ Beim Nachsehen, WAS man da löscht, stellte sich heraus: die 1989 Zeilen
 * tragen ZWEI Hälften. Die eine ist ersetzt, die andere hat die Schleuse nie
 * abgedeckt — Botschaften und Weltgesundheit. Wer die Datei entfernt hätte,
 * hätte ein Merkmal mitentfernt, das niemand ersetzt hat.
 *
 * 🔑 „Ersetzt" gilt für eine AUFGABE, nicht für eine DATEI. Vor dem Löschen
 * zählen, was sonst noch drinsteht.
 *
 * ── WAS SICH DABEI NICHT GEÄNDERT HAT ───────────────────────────────────────
 *
 * Nichts am Verhalten: Zustand, Laden, Auszeichnung und CSS sind unverändert
 * übernommen. Das ist Absicht — eine Verschiebung UND eine Verbesserung in
 * einem Zug macht hinterher nicht mehr unterscheidbar, welche der beiden einen
 * Unterschied verursacht hat.
 *
 * Botschaften werden in `components/buildings/**` GESCHLOSSEN
 * (`EmbassyCreateModal`, `EmbassyLink`); diese Übersicht liest sie nur. Deshalb
 * hängt sie jetzt an der Gebäude-Ansicht und nicht mehr an den Nachrichten.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { embassiesApi, healthApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type { Embassy, EmbassyEffectiveness, SimulationHealth } from '../../types/index.js';
import {
  bleedVectorLabel,
  effectivenessLabel,
  embassyStatusLabel,
} from '../../utils/enum-labels.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { humanizeEnum } from '../../utils/text.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/VelgBadge.js';

@localized()
@customElement('velg-embassies-panel')
export class VelgEmbassiesPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ═══════════════════════════════════════
       EMBASSY OVERVIEW — Diplomatic Dossier
       ═══════════════════════════════════════ */

    .embassy-overview {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5) var(--space-6);
      background: var(--color-surface-sunken);
      border: var(--border-default);
      border-top: 3px solid var(--color-secondary);
      position: relative;
      overflow: hidden;
    }

    .embassy-overview::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 200px;
      height: 200px;
      background: radial-gradient(
        circle at top right,
        color-mix(in srgb, var(--color-secondary) 6%, transparent),
        transparent 70%
      );
      pointer-events: none;
    }

    .embassy-overview__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .embassy-overview__icon {
      display: flex;
      color: var(--color-secondary);
      opacity: 0.7;
    }

    .embassy-overview__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: 0.14em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .embassy-overview__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: var(--label-transform);
      letter-spacing: 0.08em;
      color: var(--color-text-quiet);
      margin-left: auto;
    }

    /* ── Intel summary bar ── */

    .embassy-intel {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
    }

    .embassy-intel__stat {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .embassy-intel__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: 0.08em;
      color: var(--color-text-quiet);
    }

    .embassy-intel__value {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      font-size: var(--text-xl, 20px);
      color: var(--color-text-primary);
      line-height: 1;
    }

    .embassy-intel__value--accent {
      color: var(--color-secondary);
    }

    /* ── Embassy card grid ── */

    .embassy-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }

    .embassy-card {
      appearance: none;
      font: inherit;
      text-align: start;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface);
      border: var(--border-width-default) solid var(--color-border);
      overflow: hidden;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .embassy-card:hover {
      border-color: var(--color-secondary);
      box-shadow: 0 0 calc(12px * var(--glow-strength)) color-mix(in srgb, var(--color-secondary) 12%, transparent);
    }

    /* Shimmer border accent */
    .embassy-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        var(--embassy-theme-color, var(--color-secondary)),
        color-mix(in srgb, var(--embassy-theme-color, var(--color-secondary)) 40%, var(--color-primary)),
        var(--embassy-theme-color, var(--color-secondary))
      );
      background-size: 200% 100%;
      animation: embassy-shimmer 4s linear infinite;
    }

    @keyframes embassy-shimmer {
      0% { background-position: 200% center; }
      100% { background-position: -200% center; }
    }

    .embassy-card__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .embassy-card__sim-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      box-shadow: 0 0 calc(6px * var(--glow-strength)) var(--embassy-theme-color, transparent);
    }

    .embassy-card__sim-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: 0.06em;
      color: var(--color-text-quiet);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .embassy-card__partner {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
    }

    .embassy-card__thumb {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border: var(--border-width-default) solid var(--color-border);
      flex-shrink: 0;
    }

    .embassy-card__info {
      flex: 1;
      min-width: 0;
    }

    .embassy-card__building-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
      transition: color 0.2s;
    }

    .embassy-card:hover .embassy-card__building-name {
      color: var(--color-secondary);
    }

    .embassy-card__building-type {
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      text-transform: capitalize;
    }

    /* Effectiveness bar */
    .embassy-card__effectiveness {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .embassy-card__eff-track {
      flex: 1;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      overflow: hidden;
    }

    .embassy-card__eff-fill {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .embassy-card__eff-value {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      font-size: var(--text-xs);
      min-width: 36px;
      text-align: right;
    }

    .embassy-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      align-items: center;
    }

    .embassy-card__ambassador {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-border-light);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .embassy-card__amb-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: 0.06em;
      color: var(--color-text-quiet);
    }

    /* ── Empty state ── */

    .embassy-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .embassy-empty__icon {
      color: var(--color-text-quiet);
      opacity: 0.4;
    }

    .embassy-empty__text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: 0.08em;
      color: var(--color-text-quiet);
    }

    .embassy-empty__hint {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
      max-width: 320px;
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .embassy-overview {
        padding: var(--space-4);
      }

      .embassy-intel {
        grid-template-columns: 1fr;
      }

      .embassy-cards {
        grid-template-columns: 1fr;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _embassies: Embassy[] = [];
  @state() private _embassyEffectiveness: EmbassyEffectiveness[] = [];
  @state() private _healthSummary: SimulationHealth | null = null;
  @state() private _embassyLoading = false;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._loadEmbassyData();
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      void this._loadEmbassyData();
    }
  }

  /**
   * Botschaften und Weltgesundheit holen.
   *
   * ⚠ Der Fehlerpfad ist beim Verschieben DAZUGEKOMMEN, und er ist die einzige
   * Abweichung vom Original: dort standen zwei `await`-Aufrufe ohne `try`, und
   * ein geworfener Fehler hätte `_embassyLoading` für immer auf `true` stehen
   * lassen. Das Haus verlangt, dass jeder Fehlerpfad beobachtet wird
   * (`lint-no-empty-catch.sh`); `finally` sorgt zusätzlich dafür, dass die
   * Anzeige aus dem Ladezustand herausfindet.
   */
  private async _loadEmbassyData(): Promise<void> {
    if (!this.simulationId) return;
    this._embassyLoading = true;

    const mode = appState.currentSimulationMode.value;
    try {
      const [embassyResult, healthResult] = await Promise.all([
        embassiesApi.listForSimulation(this.simulationId, mode),
        healthApi.getDashboard(this.simulationId, mode),
      ]);

      if (embassyResult.success && embassyResult.data) {
        this._embassies = embassyResult.data;
      }
      if (healthResult.success && healthResult.data) {
        this._healthSummary = healthResult.data.health;
        this._embassyEffectiveness = healthResult.data.embassies ?? [];
      }
    } catch (err) {
      captureError(err, { source: 'VelgEmbassiesPanel._loadEmbassyData' });
    } finally {
      this._embassyLoading = false;
    }
  }

  private _effectivenessColor(label: string): string {
    switch (label) {
      case 'optimal':
        return 'var(--color-success)';
      case 'operational':
        return 'var(--color-info, var(--color-secondary))';
      case 'limited':
        return 'var(--color-warning, var(--color-accent))';
      case 'dormant':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-muted)';
    }
  }

  private _getEmbassyPartner(embassy: Embassy): {
    building: Embassy['building_a'];
    simulation: Embassy['simulation_a'];
  } | null {
    if (embassy.simulation_a_id === this.simulationId) {
      return { building: embassy.building_b, simulation: embassy.simulation_b };
    }
    return { building: embassy.building_a, simulation: embassy.simulation_a };
  }

  private _getEmbassyEffectiveness(embassyId: string): EmbassyEffectiveness | undefined {
    return this._embassyEffectiveness.find((e) => e.embassy_id === embassyId);
  }

  private _getAmbassadorName(embassy: Embassy): string | null {
    const meta = embassy.embassy_metadata;
    if (!meta) return null;
    const key = this.simulationId === embassy.simulation_a_id ? 'ambassador_a' : 'ambassador_b';
    return meta[key]?.name ?? null;
  }

  private _handleEmbassyClick(embassy: Embassy): void {
    const partner = this._getEmbassyPartner(embassy);
    if (!partner?.simulation || !partner?.building) return;
    const slug = partner.simulation.slug ?? partner.simulation.id;
    appState.pendingOpenBuildingId.value = partner.building.id;
    navigate(`/simulations/${slug}/buildings`);
  }

  // -- Embassy render --

  private _renderEmbassyOverview() {
    if (this._embassyLoading) return nothing;

    const health = this._healthSummary;
    const embassies = this._embassies;
    const hasEmbassies = embassies.length > 0;

    return html`
      <div class="embassy-overview">
        <div class="embassy-overview__header">
          <span class="embassy-overview__icon">${icons.handshake(18)}</span>
          <h2 class="embassy-overview__title">${msg('Diplomatic Relations')}</h2>
          <span class="embassy-overview__subtitle">
            ${
              hasEmbassies
                ? msg(
                    str`${embassies.length} ${embassies.length === 1 ? 'embassy' : 'embassies'} on file`,
                  )
                : msg('No embassies')
            }
          </span>
        </div>

        ${health ? this._renderEmbassyIntel(health) : nothing}

        ${
          hasEmbassies
            ? html`<div class="embassy-cards">
              ${embassies.map((e) => this._renderEmbassyCard(e))}
            </div>`
            : this._renderEmbassyEmpty()
        }
      </div>
    `;
  }

  private _renderEmbassyIntel(health: SimulationHealth) {
    const avgPct = Math.round(health.avg_embassy_effectiveness * 100);
    const avgColor =
      avgPct >= 60
        ? 'var(--color-success)'
        : avgPct >= 30
          ? 'var(--color-warning, var(--color-accent))'
          : 'var(--color-danger)';

    return html`
      <div class="embassy-intel">
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Active Embassies')}</span>
          <span class="embassy-intel__value embassy-intel__value--accent">
            ${health.active_embassy_count}
          </span>
        </div>
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Avg Effectiveness')}</span>
          <span class="embassy-intel__value" style="color: ${avgColor}">
            ${avgPct}%
          </span>
        </div>
        <div class="embassy-intel__stat">
          <span class="embassy-intel__label">${msg('Diplomatic Reach')}</span>
          <span class="embassy-intel__value">
            ${health.diplomatic_reach.toFixed(2)}
          </span>
        </div>
      </div>
    `;
  }

  private _renderEmbassyCard(embassy: Embassy) {
    const partner = this._getEmbassyPartner(embassy);
    if (!partner?.building || !partner?.simulation) return nothing;

    const eff = this._getEmbassyEffectiveness(embassy.id);
    const effPct = eff ? Math.round(eff.effectiveness * 100) : 0;
    const effLabel = eff?.effectiveness_label ?? 'unknown';
    const effColor = this._effectivenessColor(effLabel);
    const themeColor = getThemeColor(partner.simulation.theme ?? '');
    const ambassador = this._getAmbassadorName(embassy);

    const statusVariant =
      embassy.status === 'active'
        ? 'success'
        : embassy.status === 'suspended'
          ? 'warning'
          : 'default';

    return html`
      <button
        type="button"
        class="embassy-card"
        style="--embassy-theme-color: ${themeColor}"
        @click=${() => this._handleEmbassyClick(embassy)}
      >
        <div class="embassy-card__header">
          <span
            class="embassy-card__sim-dot"
            style="background: ${themeColor}"
          ></span>
          <span class="embassy-card__sim-name">${t(partner.simulation, 'name')}</span>
          <velg-badge variant=${statusVariant}>${embassyStatusLabel(embassy.status)}</velg-badge>
        </div>

        <div class="embassy-card__partner">
          ${
            partner.building.image_url
              ? html`<img
                class="embassy-card__thumb"
                src=${partner.building.image_url}
                alt=${partner.building.name}
                loading="lazy"
              />`
              : nothing
          }
          <div class="embassy-card__info">
            <div class="embassy-card__building-name">${partner.building.name}</div>
            ${
              partner.building.building_type
                ? html`<div class="embassy-card__building-type">${humanizeEnum(t(partner.building, 'building_type'))}</div>`
                : nothing
            }
          </div>
        </div>

        ${
          eff
            ? html`
          <div class="embassy-card__effectiveness">
            <div class="embassy-card__eff-track">
              <div
                class="embassy-card__eff-fill"
                style="width: ${effPct}%; background: ${effColor}"
              ></div>
            </div>
            <span class="embassy-card__eff-value" style="color: ${effColor}">
              ${effPct}%
            </span>
          </div>
        `
            : nothing
        }

        <div class="embassy-card__meta">
          ${
            eff
              ? html`<velg-badge variant=${
                  effLabel === 'optimal'
                    ? 'success'
                    : effLabel === 'operational'
                      ? 'info'
                      : effLabel === 'limited'
                        ? 'warning'
                        : 'danger'
                }>${effectivenessLabel(effLabel)}</velg-badge>`
              : nothing
          }
          ${
            embassy.bleed_vector
              ? html`<velg-badge variant="info">${bleedVectorLabel(embassy.bleed_vector)}</velg-badge>`
              : nothing
          }
        </div>

        ${
          ambassador
            ? html`
          <div class="embassy-card__ambassador">
            <span class="embassy-card__amb-label">${msg('Ambassador')}:</span>
            ${ambassador}
          </div>
        `
            : nothing
        }
      </button>
    `;
  }

  private _renderEmbassyEmpty() {
    return html`
      <div class="embassy-empty">
        <span class="embassy-empty__icon">${icons.handshake(32)}</span>
        <span class="embassy-empty__text">${msg('No embassies established')}</span>
        <span class="embassy-empty__hint">
          ${msg('Visit the Buildings tab to establish embassies with other simulations and boost your diplomatic reach.')}
        </span>
      </div>
    `;
  }

  // -- Render --

  protected render() {
    return this._renderEmbassyOverview();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-embassies-panel': VelgEmbassiesPanel;
  }
}
