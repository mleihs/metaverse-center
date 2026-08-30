/**
 * Substrate Attunement — a long game that had a display but no door.
 *
 * A world may attune to up to two of the eight resonance signatures. Each tick
 * deepens what it is attuned to; past a threshold the signature harmonises and
 * begins turning its own kind of crisis into its opposite - an economic tremor
 * becomes a market boom, a conflict wave becomes a peace accord. It is the only
 * mechanic on the platform that plays out over dozens of ticks rather than one.
 *
 * `POST`/`DELETE /simulations/{id}/attunements` have always existed. The health
 * screen has always drawn the depth meters. But it drew them inside a panel that
 * returns early when there are no attunements and no anchors, so a world with
 * none - which is every world, since nothing could ever create one - saw
 * nothing at all. The mechanic was visible only to worlds that already had it.
 *
 * So the console is a tuning desk that is present whether or not anything is
 * tuned: eight signatures on plates, the held ones carrying a depth meter with
 * the harmonisation threshold marked on it, and the two rules that govern the
 * choice printed where the choice is made.
 *
 * Those rules come from the server (`max_attunements`,
 * `attunement_switching_cooldown_ticks` on the overview). They are
 * platform-configurable, and a screen that prints "1 of 2" while the platform
 * allows three is worse than one that prints nothing.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import { captureError } from '../../services/SentryService.js';
import type {
  HeartbeatOverview,
  ResonanceSignature,
  SubstrateAttunement,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import { VelgToast } from '../shared/Toast.js';

/** The eight, in the order `backend/models/resonance.py` declares them. */
const SIGNATURES: readonly ResonanceSignature[] = [
  'economic_tremor',
  'conflict_wave',
  'biological_tide',
  'elemental_surge',
  'authority_fracture',
  'innovation_spark',
  'consciousness_drift',
  'decay_bloom',
];

@localized()
@customElement('velg-attunement-console')
export class VelgAttunementConsole extends SignalWatcher(LitElement) {
  static styles = [
    markerCornerStyles,
    css`
    :host {
      display: block;
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
      --_tuned: var(--color-info);
      --_tuned-wash: color-mix(in srgb, var(--color-info) 10%, transparent);
      --_harmonized: var(--color-success);
      --_harmonized-wash: color-mix(in srgb, var(--color-success) 12%, transparent);
    }

    .console {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .console__rules {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-muted);
    }

    .console__count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .console__count--full {
      color: var(--color-warning);
    }

    .dial {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-2);
    }

    /* ── One signature ─────────────────────────────────────── */

    .signature {
      --marker-color: transparent;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      padding: var(--space-3);
      min-height: 44px;
      text-align: left;
      background: var(--color-surface);
      border: 1px solid var(--_rule);
      color: var(--_ink);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast);
    }

    .signature:hover:not([disabled]) {
      border-color: var(--_tuned);
      background: var(--_tuned-wash);
    }

    .signature:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .signature[disabled] {
      cursor: not-allowed;
      opacity: 0.4;
    }

    .signature--tuned {
      --marker-color: var(--_tuned);
      border-color: var(--_tuned);
      background: var(--_tuned-wash);
    }

    .signature--harmonized {
      --marker-color: var(--_harmonized);
      border-color: var(--_harmonized);
      background: var(--_harmonized-wash);
    }

    .signature__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .signature__state {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .signature__state--harmonized {
      color: var(--_harmonized);
    }

    /* ── Depth meter ───────────────────────────────────────── */

    .meter {
      position: relative;
      height: 6px;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      overflow: hidden;
    }

    .meter__fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--_tuned);
      transition: width var(--duration-slower) var(--ease-dramatic);
    }

    .meter__fill--harmonized {
      background: var(--_harmonized);
    }

    /* The threshold is a notch in the track, not a coloured edge: it marks a
       position on a scale, which is the one job a hairline does better than a
       label. */
    .meter__threshold {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--color-text-primary);
      opacity: 0.7;
    }

    .signature__release {
      align-self: flex-start;
      margin-top: var(--space-1);
      padding: var(--space-1) var(--space-2);
      min-height: 28px;
      background: transparent;
      border: 1px solid var(--color-border-danger);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .signature__release:hover:not([disabled]) {
      background: var(--color-danger-bg);
    }

    .signature__release:focus-visible {
      outline: none;
      box-shadow: var(--ring-danger);
    }

    .signature__release[disabled] {
      border-color: var(--_rule);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }

    .note {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      .dial {
        grid-template-columns: 1fr;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _attunements: SubstrateAttunement[] = [];
  @state() private _overview: HeartbeatOverview | null = null;
  @state() private _loading = true;
  @state() private _busy: string | null = null;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    this._loading = true;
    const [attRes, overviewRes] = await Promise.all([
      heartbeatApi.listAttunements(this.simulationId),
      heartbeatApi.getOverview(this.simulationId, appState.currentSimulationMode.value),
    ]);
    if (attRes.success && attRes.data) this._attunements = attRes.data;
    if (overviewRes.success && overviewRes.data) this._overview = overviewRes.data;
    this._loading = false;
  }

  // ── Derived ───────────────────────────────────────────────

  private get _max(): number {
    return this._overview?.max_attunements ?? 2;
  }

  private get _cooldown(): number {
    return this._overview?.attunement_switching_cooldown_ticks ?? 3;
  }

  private _held(signature: ResonanceSignature): SubstrateAttunement | undefined {
    return this._attunements.find((a) => a.resonance_signature === signature);
  }

  private _signatureLabel(signature: ResonanceSignature): string {
    switch (signature) {
      case 'economic_tremor':
        return msg('Economic tremor');
      case 'conflict_wave':
        return msg('Conflict wave');
      case 'biological_tide':
        return msg('Biological tide');
      case 'elemental_surge':
        return msg('Elemental surge');
      case 'authority_fracture':
        return msg('Authority fracture');
      case 'innovation_spark':
        return msg('Innovation spark');
      case 'consciousness_drift':
        return msg('Consciousness drift');
      case 'decay_bloom':
        return msg('Decay bloom');
    }
  }

  /** What harmonising this signature turns loose - the templates in AttunementService. */
  private _promise(signature: ResonanceSignature): string {
    switch (signature) {
      case 'economic_tremor':
        return msg('Market booms and trade windfalls.');
      case 'conflict_wave':
        return msg('Peace accords and diplomatic breakthroughs.');
      case 'biological_tide':
        return msg('Medical breakthroughs and immune adaptation.');
      case 'elemental_surge':
        return msg('Geological discoveries and fertile aftermath.');
      case 'authority_fracture':
        return msg('Democratic reform and civic renaissance.');
      case 'innovation_spark':
        return msg('Technology dividends and innovation harvests.');
      case 'consciousness_drift':
        return msg('Cultural awakening and philosophical harmony.');
      case 'decay_bloom':
        return msg('Ecological recovery and a green renaissance.');
    }
  }

  // ── Actions ───────────────────────────────────────────────

  private async _attune(signature: ResonanceSignature): Promise<void> {
    if (this._busy) return;
    this._busy = signature;
    try {
      const res = await heartbeatApi.setAttunement(this.simulationId, {
        resonance_signature: signature,
      });
      if (res.success) {
        await this._load();
        VelgToast.success(msg('The substrate is listening to that signature.'));
        this.dispatchEvent(
          new CustomEvent('attunement-changed', { bubbles: true, composed: true }),
        );
      } else {
        VelgToast.error(res.error?.message ?? msg('The substrate did not take the signature.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgAttunementConsole._attune' });
      VelgToast.error(msg('The substrate did not take the signature.'));
    } finally {
      this._busy = null;
    }
  }

  private async _release(signature: ResonanceSignature): Promise<void> {
    if (this._busy) return;
    this._busy = signature;
    try {
      const res = await heartbeatApi.removeAttunement(this.simulationId, signature);
      if (res.success) {
        await this._load();
        VelgToast.success(msg('The signature has been let go. Its depth is lost.'));
        this.dispatchEvent(
          new CustomEvent('attunement-changed', { bubbles: true, composed: true }),
        );
      } else {
        VelgToast.error(res.error?.message ?? msg('The signature could not be released.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgAttunementConsole._release' });
      VelgToast.error(msg('The signature could not be released.'));
    } finally {
      this._busy = null;
    }
  }

  // ── Render ────────────────────────────────────────────────

  protected render() {
    if (!this.simulationId || this._loading) return nothing;

    const held = this._attunements.length;
    const full = held >= this._max;

    return html`
      <div class="console">
        <div class="console__count ${full ? 'console__count--full' : ''}">
          ${msg(str`${held} of ${this._max} signatures held`)}
        </div>

        <div class="dial" role="group" aria-label=${msg('Substrate attunement')}>
          ${SIGNATURES.map((s) => this._renderSignature(s, full))}
        </div>

        <p class="console__rules">
          ${msg(str`An attunement deepens with every pulse. Past the notch on its meter the signature harmonises, and its own kind of crisis starts producing its opposite instead. A signature just set is locked for ${this._cooldown} pulses, and letting one go loses everything it had gathered.`)}
        </p>

        ${
          !appState.canEdit.value
            ? html`<p class="note">
              ${msg('Tuning the substrate requires editor rights in this world.')}
            </p>`
            : nothing
        }
      </div>
    `;
  }

  private _renderSignature(signature: ResonanceSignature, full: boolean) {
    const held = this._held(signature);
    const canEdit = appState.canEdit.value;
    const busy = this._busy === signature;

    if (!held) {
      return html`
        <button
          class="signature"
          ?disabled=${full || !canEdit || busy}
          title=${this._promise(signature)}
          @click=${() => void this._attune(signature)}
        >
          <span class="signature__name">${this._signatureLabel(signature)}</span>
          <span class="signature__state">${this._promise(signature)}</span>
          ${
            full
              ? html`<span class="signature__state">
                ${msg('Let another signature go first.')}
              </span>`
              : nothing
          }
        </button>
      `;
    }

    const pct = Math.round(held.depth * 100);
    const threshold = Math.round(held.positive_threshold * 100);
    const harmonized = held.depth >= held.positive_threshold;
    const locked = held.switching_cooldown_ticks > 0;

    return html`
      <div
        class="signature marker-corners ${harmonized ? 'signature--harmonized' : 'signature--tuned'}"
      >
        <span class="signature__name">${this._signatureLabel(signature)}</span>
        <div
          class="meter"
          role="meter"
          aria-valuenow=${pct}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label=${msg(str`${this._signatureLabel(signature)}: depth ${pct} percent, harmonises at ${threshold}`)}
        >
          <div
            class="meter__fill ${harmonized ? 'meter__fill--harmonized' : ''}"
            style="width: ${pct}%"
          ></div>
          <div class="meter__threshold" style="left: ${threshold}%"></div>
        </div>
        <span class="signature__state ${harmonized ? 'signature__state--harmonized' : ''}">
          ${
            harmonized
              ? msg(str`Harmonised at ${pct}% – ${this._promise(signature)}`)
              : msg(
                  str`Depth ${pct}%, harmonises at ${threshold}% – ${held.ticks_exposed} pulses in`,
                )
          }
        </span>
        ${
          canEdit
            ? html`
              <button
                class="signature__release"
                ?disabled=${locked || busy}
                title=${
                  locked
                    ? msg(str`Locked for ${held.switching_cooldown_ticks} more pulses.`)
                    : msg('Releasing loses the depth gathered so far.')
                }
                @click=${() => void this._release(signature)}
              >
                ${icons.close(12)}
                ${locked ? msg(str`Locked (${held.switching_cooldown_ticks})`) : msg('Let go')}
              </button>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-attunement-console': VelgAttunementConsole;
  }
}
