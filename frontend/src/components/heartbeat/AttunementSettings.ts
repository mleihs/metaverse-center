/**
 * Attunement Settings — Substrate Frequency Tuner.
 *
 * 8 resonance signature cards styled as radio frequency channels.
 * Each card has a CSS sine-wave visualization, segmented VU-meter
 * depth bar, threshold marker, and HARMONIZED starburst.
 * Max 2 selectable with classified-style slot badge.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import type { ResonanceSignature, SubstrateAttunement } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { renderInfoBubble, infoBubbleStyles } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

/* ── Wave frequency offsets per signature (in deg) for unique patterns ── */
const WAVE_PHASES: Record<ResonanceSignature, number> = {
  economic_tremor: 0,
  conflict_wave: 45,
  biological_tide: 90,
  elemental_surge: 135,
  authority_fracture: 180,
  innovation_spark: 225,
  consciousness_drift: 270,
  decay_bloom: 315,
};

const SIGNATURES: { key: ResonanceSignature; label: string; icon: () => unknown }[] = [
  { key: 'economic_tremor', label: 'Economic Tremor', icon: () => icons.archetypeTower(20) },
  { key: 'conflict_wave', label: 'Conflict Wave', icon: () => icons.archetypeShadow(20) },
  { key: 'biological_tide', label: 'Biological Tide', icon: () => icons.archetypeDevouringMother(20) },
  { key: 'elemental_surge', label: 'Elemental Surge', icon: () => icons.archetypeDeluge(20) },
  { key: 'authority_fracture', label: 'Authority Fracture', icon: () => icons.archetypeOverthrow(20) },
  { key: 'innovation_spark', label: 'Innovation Spark', icon: () => icons.archetypePrometheus(20) },
  { key: 'consciousness_drift', label: 'Consciousness Drift', icon: () => icons.archetypeAwakening(20) },
  { key: 'decay_bloom', label: 'Decay Bloom', icon: () => icons.archetypeEntropy(20) },
];

const VU_SEGMENTS = 10;

@localized()
@customElement('velg-attunement-settings')
export class VelgAttunementSettings extends LitElement {
  static styles = [infoBubbleStyles, css`
    /* ═══════════════════════════════════════════════════════
       SUBSTRATE FREQUENCY TUNER
       ═══════════════════════════════════════════════════════ */

    :host {
      display: block;
    }

    /* ── Header ──────────────────────────────────────────── */

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-5, 20px);
    }

    .header__left {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-lg, 18px);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1.2;
    }

    /* EKG line under title */
    .header__ekg {
      height: 12px;
      margin-top: var(--space-1, 4px);
      overflow: hidden;
    }

    .header__ekg svg {
      display: block;
      width: 100%;
      height: 12px;
    }

    .header__ekg-line {
      stroke: var(--color-primary);
      stroke-width: 1.5;
      fill: none;
      opacity: 0.6;
    }

    /* Classified status badge */
    .slot-badge {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 3px 10px;
      border: 1px solid;
      white-space: nowrap;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .slot-badge--available {
      color: var(--color-success, #22c55e);
      border-color: color-mix(in srgb, var(--color-success, #22c55e) 40%, transparent);
      background: color-mix(in srgb, var(--color-success, #22c55e) 8%, transparent);
    }

    .slot-badge--full {
      color: var(--color-warning, #f59e0b);
      border-color: color-mix(in srgb, var(--color-warning, #f59e0b) 40%, transparent);
      background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
    }

    /* ── Grid ────────────────────────────────────────────── */

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-3, 12px);
    }

    /* ── Frequency Channel Card ──────────────────────────── */

    .channel {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: var(--space-4, 16px);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      min-height: 44px;
      text-align: left;
      color: inherit;
      width: 100%;
      overflow: hidden;
      font: inherit;
    }

    .channel:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* ── Inactive / Dimmed ────────────────────────────────── */

    .channel--inactive {
      opacity: 0.55;
    }

    .channel--inactive:hover {
      opacity: 0.8;
      border-color: var(--color-primary);
    }

    /* ── Attuned (active) ────────────────────────────────── */

    .channel--attuned {
      border-color: var(--color-gold, #eab308);
      background: color-mix(in srgb, var(--color-gold, #eab308) 5%, var(--color-surface-raised));
    }

    .channel--attuned:hover {
      border-color: var(--color-gold, #eab308);
      background: color-mix(in srgb, var(--color-gold, #eab308) 10%, var(--color-surface-raised));
    }

    /* ── Harmonized ──────────────────────────────────────── */

    .channel--harmonized {
      border-color: var(--color-gold, #eab308);
      box-shadow:
        0 0 12px color-mix(in srgb, var(--color-gold, #eab308) 30%, transparent),
        inset 0 0 20px color-mix(in srgb, var(--color-gold, #eab308) 6%, transparent);
    }

    /* ── Locked (slots full) ─────────────────────────────── */

    .channel--locked {
      cursor: not-allowed;
      opacity: 0.35;
    }

    .channel--locked:hover {
      opacity: 0.35;
      border-color: var(--color-border);
    }

    /* LOCKED diagonal overlay */
    .locked-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 2;
    }

    .locked-overlay__text {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
      transform: rotate(-25deg);
      user-select: none;
    }

    /* ── Wave visualization ──────────────────────────────── */

    .wave-track {
      position: relative;
      height: 20px;
      margin-bottom: var(--space-2, 8px);
      overflow: hidden;
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .wave-svg {
      position: absolute;
      inset: 0;
      width: 200%;
      height: 100%;
    }

    .wave-path {
      fill: none;
      stroke-width: 1.5;
      stroke: var(--color-text-muted);
      opacity: 0.2;
      transition: stroke 0.3s ease, opacity 0.3s ease;
    }

    .channel--attuned .wave-path {
      stroke: var(--color-gold, #eab308);
      opacity: 0.8;
      filter: drop-shadow(0 0 3px color-mix(in srgb, var(--color-gold, #eab308) 60%, transparent));
    }

    .channel--attuned .wave-svg {
      animation: wave-flow 3s linear infinite;
    }

    .channel--harmonized .wave-path {
      opacity: 1;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-gold, #eab308) 80%, transparent));
    }

    @keyframes wave-flow {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }

    /* ── Channel identity row ────────────────────────────── */

    .channel__identity {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      min-height: 28px;
    }

    .channel__icon {
      color: var(--color-text-secondary);
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .channel--attuned .channel__icon {
      color: var(--color-gold, #eab308);
    }

    .channel__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      flex: 1;
      min-width: 0;
    }

    /* Cooldown counter in corner */
    .channel__cooldown {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-warning, #f59e0b);
      flex-shrink: 0;
      padding: 1px 6px;
      border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent);
      background: color-mix(in srgb, var(--color-warning, #f59e0b) 6%, transparent);
    }

    /* ── VU Meter (segmented depth bar) ──────────────────── */

    .vu-meter {
      position: relative;
      display: flex;
      gap: 2px;
      height: 14px;
      margin-top: var(--space-2, 8px);
      padding: 2px;
      background: var(--color-gray-900, #111);
      border: 1px solid var(--color-gray-700, #333);
    }

    .vu-segment {
      flex: 1;
      background: var(--color-gray-800, #1a1a1a);
      transition: background 0.15s ease;
      min-width: 0;
    }

    .vu-segment--lit {
      background: var(--color-gold, #eab308);
      box-shadow: 0 0 4px color-mix(in srgb, var(--color-gold, #eab308) 40%, transparent);
    }

    /* Hot segments (last 20%) glow more intensely */
    .vu-segment--hot {
      background: var(--color-warning, #f59e0b);
      box-shadow: 0 0 6px color-mix(in srgb, var(--color-warning, #f59e0b) 60%, transparent);
    }

    /* Threshold marker */
    .vu-threshold {
      position: absolute;
      top: -2px;
      bottom: -2px;
      width: 2px;
      background: var(--color-danger, #ef4444);
      z-index: 1;
    }

    .vu-threshold__label {
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--font-mono, monospace);
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-danger, #ef4444);
      white-space: nowrap;
    }

    /* ── Depth info row ──────────────────────────────────── */

    .depth-info {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-secondary);
      margin-top: var(--space-1, 4px);
    }

    /* ── HARMONIZED badge & starburst ────────────────────── */

    .harmonized-badge {
      position: absolute;
      top: var(--space-2, 8px);
      right: var(--space-2, 8px);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 2px 8px;
      color: var(--color-gold, #eab308);
      border: 1px solid color-mix(in srgb, var(--color-gold, #eab308) 40%, transparent);
      background: color-mix(in srgb, var(--color-gold, #eab308) 10%, transparent);
      z-index: 3;
    }

    .harmonized-badge--animate {
      animation: harmonized-stamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes harmonized-stamp {
      0% {
        transform: scale(2.5) rotate(-8deg);
        opacity: 0;
      }
      50% {
        transform: scale(1.1) rotate(1deg);
        opacity: 1;
      }
      100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }

    /* Starburst behind badge */
    .starburst {
      position: absolute;
      top: var(--space-2, 8px);
      right: var(--space-2, 8px);
      width: 60px;
      height: 24px;
      pointer-events: none;
      z-index: 2;
    }

    .starburst--animate {
      animation: starburst-flash 0.8s ease-out forwards;
    }

    @keyframes starburst-flash {
      0% {
        opacity: 0;
        transform: scale(0.3);
      }
      30% {
        opacity: 1;
        transform: scale(1.5);
      }
      100% {
        opacity: 0;
        transform: scale(2);
      }
    }

    .starburst__ray {
      fill: var(--color-gold, #eab308);
      opacity: 0.5;
    }

    /* ── Tuning dial animation on click ──────────────────── */

    .channel--tuning {
      animation: dial-sweep 0.4s ease-out;
    }

    @keyframes dial-sweep {
      0% {
        box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--color-primary) 20%, transparent);
      }
      40% {
        box-shadow: inset 0 0 0 30px color-mix(in srgb, var(--color-primary) 12%, transparent);
      }
      100% {
        box-shadow: inset 0 0 0 0 transparent;
      }
    }

    /* ── Error message ───────────────────────────────────── */

    .error-msg {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-danger, #ef4444);
      margin-top: var(--space-3, 12px);
    }

    /* ── Reduced motion ──────────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .channel--attuned .wave-svg,
      .harmonized-badge--animate,
      .starburst--animate,
      .channel--tuning {
        animation: none;
      }

      .wave-path,
      .vu-segment,
      .channel {
        transition: none;
      }
    }
  `];

  @property({ type: String }) simulationId = '';
  @state() private _attunements: SubstrateAttunement[] = [];
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _tuningKey: ResonanceSignature | '' = '';
  @state() private _newlyHarmonized: Set<ResonanceSignature> = new Set();

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) this._load();
  }

  private async _load(): Promise<void> {
    const res = await heartbeatApi.listAttunements(this.simulationId);
    if (res.success && res.data) {
      this._attunements = res.data as SubstrateAttunement[];
    }
  }

  private _getAttunement(sig: ResonanceSignature): SubstrateAttunement | undefined {
    return this._attunements.find((a) => a.resonance_signature === sig);
  }

  private async _toggleAttunement(sig: ResonanceSignature): Promise<void> {
    this._error = '';
    this._loading = true;
    this._tuningKey = sig;

    const existing = this._getAttunement(sig);

    if (existing) {
      const res = await heartbeatApi.removeAttunement(this.simulationId, sig);
      if (res.success) {
        VelgToast.info(msg('Attunement removed.'));
      } else {
        this._error = res.error?.message ?? msg('Failed to remove attunement.');
        VelgToast.error(this._error);
      }
    } else {
      if (this._attunements.length >= 2) {
        this._error = msg('Maximum 2 attunements. Remove one first.');
        VelgToast.warning(this._error);
        this._loading = false;
        this._tuningKey = '';
        return;
      }
      const res = await heartbeatApi.setAttunement(this.simulationId, { resonance_signature: sig });
      if (res.success) {
        VelgToast.success(msg('Attunement activated. Depth will grow each tick.'));
      } else {
        this._error = res.error?.message ?? msg('Failed to set attunement.');
        VelgToast.error(this._error);
      }
    }

    // Track which sigs were already harmonized before reload
    const prevHarmonized = new Set(
      this._attunements
        .filter((a) => a.depth >= a.positive_threshold)
        .map((a) => a.resonance_signature),
    );

    await this._load();

    // Detect newly harmonized signatures for starburst animation
    for (const att of this._attunements) {
      if (att.depth >= att.positive_threshold && !prevHarmonized.has(att.resonance_signature)) {
        this._newlyHarmonized = new Set([...this._newlyHarmonized, att.resonance_signature]);
      }
    }

    this._loading = false;

    // Clear tuning animation
    setTimeout(() => {
      this._tuningKey = '';
    }, 400);
  }

  /** Builds a sine-wave SVG path unique per signature via phase offset. */
  private _buildWavePath(sig: ResonanceSignature): string {
    const phase = WAVE_PHASES[sig];
    const segments = 16;
    const w = 800; // 200% viewport width
    const h = 20;
    const mid = h / 2;
    const amp = 6;
    const segW = w / segments;
    const points: string[] = [];
    for (let i = 0; i <= segments; i++) {
      const x = i * segW;
      const angle = ((i / segments) * 720 + phase) * (Math.PI / 180);
      const y = mid + Math.sin(angle) * amp;
      points.push(i === 0 ? `M${x},${y}` : `L${x},${y.toFixed(1)}`);
    }
    return points.join(' ');
  }

  protected render() {
    const attunedCount = this._attunements.length;
    const slotsAvailable = attunedCount < 2;

    return html`
      <div class="header">
        <div class="header__left">
          <h3 class="header__title">
            ${msg('Substrate Harmonics')}
            ${renderInfoBubble(msg('Attune to up to 2 resonance signatures. Depth grows passively and faster when matching events are active. At threshold, positive events may spawn. Choose signatures that match your simulation\'s threats.'))}
          </h3>
          <div class="header__ekg">
            <svg viewBox="0 0 300 12" preserveAspectRatio="none">
              <polyline
                class="header__ekg-line"
                points="0,6 40,6 50,6 55,2 60,10 65,4 70,8 75,6 120,6 140,6 145,2 150,10 155,4 160,8 165,6 200,6 230,6 235,2 240,10 245,4 250,8 255,6 300,6"
              />
            </svg>
          </div>
        </div>
        <span class="slot-badge ${slotsAvailable ? 'slot-badge--available' : 'slot-badge--full'}">
          ${attunedCount}/2 ${msg('slots used')}
        </span>
      </div>

      <div class="grid" role="group" aria-label=${msg('Resonance signature attunements')}>
        ${SIGNATURES.map((sig) => this._renderChannel(sig, attunedCount))}
      </div>

      ${this._error ? html`<div class="error-msg" role="alert">${this._error}</div>` : nothing}
    `;
  }

  private _renderChannel(
    sig: { key: ResonanceSignature; label: string; icon: () => unknown },
    attunedCount: number,
  ) {
    const att = this._getAttunement(sig.key);
    const isAttuned = !!att;
    const isFull = attunedCount >= 2 && !isAttuned;
    const hasCooldown = att && att.switching_cooldown_ticks > 0;
    const depth = att?.depth ?? 0;
    const threshold = att?.positive_threshold ?? 0.5;
    const harmonized = isAttuned && depth >= threshold;
    const isTuning = this._tuningKey === sig.key;
    const showStarburst = this._newlyHarmonized.has(sig.key);

    const classes = [
      'channel',
      isAttuned ? 'channel--attuned' : 'channel--inactive',
      harmonized ? 'channel--harmonized' : '',
      isFull ? 'channel--locked' : '',
      isTuning ? 'channel--tuning' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const wavePath = this._buildWavePath(sig.key);

    // Compute which VU segments are lit
    const litCount = Math.round(depth * VU_SEGMENTS);
    const thresholdPos = threshold * 100;

    return html`
      <button
        class=${classes}
        ?disabled=${this._loading || (isFull && !isAttuned)}
        @click=${() => this._toggleAttunement(sig.key)}
        aria-pressed=${isAttuned}
        aria-label=${`${sig.label}${isAttuned ? ` — ${msg('attuned')}` : ''}${harmonized ? ` — ${msg('harmonized')}` : ''}`}
      >
        ${isFull
          ? html`
              <div class="locked-overlay">
                <span class="locked-overlay__text">${msg('Locked')}</span>
              </div>
            `
          : nothing}
        ${harmonized
          ? html`
              ${showStarburst
                ? html`
                    <svg class="starburst starburst--animate" viewBox="0 0 60 24" aria-hidden="true">
                      <polygon class="starburst__ray" points="30,0 33,9 42,4 35,11 44,12 35,13 42,20 33,15 30,24 27,15 18,20 25,13 16,12 25,11 18,4 27,9" />
                    </svg>
                  `
                : nothing}
              <span
                class="harmonized-badge ${showStarburst ? 'harmonized-badge--animate' : ''}"
                @animationend=${() => this._clearStarburst(sig.key)}
              >
                ${msg('Harmonized')}
              </span>
            `
          : nothing}

        <!-- Frequency wave -->
        <div class="wave-track" aria-hidden="true">
          <svg class="wave-svg" viewBox="0 0 800 20" preserveAspectRatio="none">
            <path class="wave-path" d=${wavePath} />
          </svg>
        </div>

        <!-- Identity row -->
        <div class="channel__identity">
          <span class="channel__icon">${sig.icon()}</span>
          <span class="channel__name">${sig.label}</span>
          ${hasCooldown
            ? html`
                <span class="channel__cooldown">
                  ${att!.switching_cooldown_ticks}T
                </span>
              `
            : nothing}
        </div>

        <!-- VU meter depth bar (only when attuned) -->
        ${isAttuned
          ? html`
              <div
                class="vu-meter"
                role="meter"
                aria-valuenow=${Math.round(depth * 100)}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label=${msg(str`Attunement depth: ${(depth * 100).toFixed(0)} percent of ${Math.round(threshold * 100)} percent threshold`)}
              >
                ${Array.from({ length: VU_SEGMENTS }, (_, i) => {
                  const isLit = i < litCount;
                  const isHot = isLit && i >= VU_SEGMENTS * 0.8;
                  return html`<div
                    class="vu-segment ${isLit ? 'vu-segment--lit' : ''} ${isHot ? 'vu-segment--hot' : ''}"
                  ></div>`;
                })}
                <div class="vu-threshold" style="left: ${thresholdPos}%">
                  <span class="vu-threshold__label">${msg('Threshold')}</span>
                </div>
              </div>
              <div class="depth-info">
                <span aria-label=${msg(str`Depth: ${(depth * 100).toFixed(0)} percent`)}>${msg('Depth')}: ${(depth * 100).toFixed(0)}%</span>
                <span>${att!.ticks_exposed} ${msg('ticks')}</span>
              </div>
            `
          : nothing}
      </button>
    `;
  }

  private _clearStarburst(sig: ResonanceSignature): void {
    const next = new Set(this._newlyHarmonized);
    next.delete(sig);
    this._newlyHarmonized = next;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-attunement-settings': VelgAttunementSettings;
  }
}
