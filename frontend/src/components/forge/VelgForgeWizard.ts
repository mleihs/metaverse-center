import { localized, msg, str } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ForgeDraft } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { forgeConsoleTypeTokens } from '../shared/forge-console-styles.js';

import './VelgForgeAstrolabe.js';
import './VelgForgeTable.js';
import './VelgForgeDarkroom.js';
import './VelgForgeIgnition.js';

/**
 * The Simulation Forge Wizard — Main container.
 * Guides the user through the 4 phases of creation.
 */
@localized()
@customElement('velg-forge-wizard')
export class VelgForgeWizard extends LitElement {
  static styles = [
    forgeConsoleTypeTokens,
    css`
      /* ── Dark Console Shell ──────────────── */

      :host {
        display: block;
        min-height: 100vh;
        background: var(--color-surface-sunken);
        color: var(--color-text-primary);
        position: relative;
        /* clip, not hidden: any non-visible overflow makes this element a
           scroll container, and a sticky descendant then sticks to the bottom
           of THIS box instead of the viewport. The phase action bar is
           position: sticky and was measured 1163px down a 1024px viewport —
           pinned to nothing. Clip still contains horizontal overflow without
           creating that container. The CRT overlay below is position: fixed
           and never needed the clipping. */
        overflow-x: clip;
      }

      /* CRT scanline overlay — full host coverage */
      :host::before {
        content: '';
        position: fixed;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255 255 255 / 0.012) 2px,
          rgba(255 255 255 / 0.012) 4px
        );
        pointer-events: none;
        z-index: var(--z-top);
      }

      @media (prefers-reduced-motion: reduce) {
        :host::before {
          display: none;
        }
      }

      .forge-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: var(--space-8) var(--space-6);
        position: relative;
      }

      /* ── Hero Header ─────────────────────── */

      .forge-hero {
        position: relative;
        padding: var(--space-8) var(--space-6);
        margin-bottom: var(--space-8);
        border-bottom: 2px solid var(--color-border);
        background: var(--color-surface);
        overflow: hidden;
      }

      .forge-hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255 255 255 / 0.015) 2px,
          rgba(255 255 255 / 0.015) 4px
        );
        pointer-events: none;
      }

      .forge-hero__classification {
        display: inline-block;
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-danger);
        border: 1px solid var(--color-danger);
        margin-bottom: var(--space-4);
        position: relative;
      }

      .forge-hero__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-3xl, 1.875rem);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist, 0.08em);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-2);
        position: relative;
      }

      .forge-hero__subtitle {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-text-quiet);
        margin: 0;
        position: relative;
      }

      .forge-hero__save {
        position: absolute;
        top: var(--space-4);
        right: var(--space-6);
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      /* ── Context strip (phases II onward) ───── */

      .forge-strip {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding: var(--space-3) var(--space-4);
        margin-bottom: var(--space-6);
        background: var(--color-surface);
        border-bottom: 2px solid var(--color-border);
      }

      .forge-strip__save {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-left: auto;
      }

      .context-bar {
        display: flex;
        align-items: baseline;
        gap: var(--space-4);
        flex-wrap: wrap;
        min-width: 0;
      }

      .context-bar__main {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        min-width: 0;
      }

      .context-bar__city {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold, 700);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist, 0.08em);
        color: var(--color-text-primary);
      }

      .context-bar__anchor {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .context-bar__params {
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--color-text-tertiary);
      }

      .context-bar__jump {
        background: none;
        border: none;
        padding: 0;
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--color-text-link);
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
      }

      .context-bar__jump:hover {
        color: var(--color-text-primary);
      }

      /* ── Save state ─────────────────────────── */

      .save-state {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-quiet);
        white-space: nowrap;
      }

      .save-state--pending {
        color: var(--color-text-tertiary);
      }

      .save-state__dot {
        width: var(--space-1-5);
        height: var(--space-1-5);
        background: var(--color-success);
        border-radius: var(--border-radius-full);
      }

      .save-state__leave {
        background: none;
        border: var(--border-width-thin) solid var(--color-border);
        padding: var(--space-1) var(--space-2);
        font-family: var(--font-mono, monospace);
        font-size: var(--_forge-label);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: border-color var(--transition-fast, 100ms), color var(--transition-fast, 100ms);
      }

      .save-state__leave:hover {
        border-color: var(--color-text-secondary);
        color: var(--color-text-primary);
      }

      /* ── Phase Indicator Bar ─────────────── */

      .phases {
        display: flex;
        gap: 0;
        margin-bottom: var(--space-10);
        border: 1px solid var(--color-border);
        overflow: hidden;
      }

      .phase {
        flex: 1;
        padding: var(--space-2-5, 10px) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        text-align: center;
        color: var(--color-text-quiet);
        background: var(--color-surface);
        border-right: 1px solid var(--color-border);
        position: relative;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .phase:last-child {
        border-right: none;
      }

      .phase--active {
        color: var(--color-surface-sunken);
        background: var(--color-success);
        font-weight: 700;
      }

      /* Phase IV (Ignition) uses danger red instead of green */
      .phase--active.phase--ignition {
        background: var(--color-danger);
        color: var(--color-text-inverse);
      }

      .phase--active::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 0%, rgba(255 255 255 / 0.2) 50%, transparent 100%);
        animation: phase-sweep 2s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .phase--active::after {
          animation: none;
        }
      }

      @keyframes phase-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .phase--done {
        color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 10%, transparent);
        padding: 0;
      }

      /* A completed step is a real button, so it carries its own padding and
         fills the cell; the cell keeps its list semantics. */
      .phase__jump {
        display: block;
        width: 100%;
        padding: var(--space-2-5, 10px) var(--space-3);
        background: none;
        border: none;
        font: inherit;
        color: inherit;
        text-transform: inherit;
        letter-spacing: inherit;
        cursor: pointer;
        transition: background var(--transition-normal, 200ms);
      }

      .phase__jump:hover {
        background: color-mix(in srgb, var(--color-success) 18%, transparent);
      }

      .phase__jump:focus-visible {
        outline: 2px solid var(--color-border-focus);
        outline-offset: -3px;
      }

      /* ── Phase Content with slide transitions ── */

      .phase-content {
        animation: phase-slide-in var(--duration-entrance, 300ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
      }

      @media (prefers-reduced-motion: reduce) {
        .phase-content {
          animation: none;
        }
      }

      @keyframes phase-slide-in {
        from { opacity: 0; transform: translateX(30px); }
        to { opacity: 1; transform: translateX(0); }
      }

      /* ── Responsive ──────────────────────── */

      @media (max-width: 600px) {
        .forge-hero__title {
          font-size: var(--text-xl, 1.25rem);
        }

        .phase {
          font-size: 9px;
          padding: var(--space-2) var(--space-1);
          letter-spacing: 0.05em;
        }

        .forge-container {
          padding: var(--space-4) var(--space-3);
        }
      }
    `,
  ];

  @state() private _phase: string = 'astrolabe';
  @state() private _draft: ForgeDraft | null = null;
  @state() private _lastSavedAt: number | null = null;
  private _disposeEffects: (() => void)[] = [];

  /** Screen Wake Lock — keeps display on during the entire forge session. */
  private _wakeLock: WakeLockSentinel | null = null;

  connectedCallback() {
    super.connectedCallback();

    // Restore draft from sessionStorage on page refresh
    forgeStateManager.restoreSession();

    this._disposeEffects.push(
      effect(() => {
        this._phase = forgeStateManager.phase.value;
      }),
      effect(() => {
        this._draft = forgeStateManager.draft.value;
      }),
      effect(() => {
        this._lastSavedAt = forgeStateManager.lastSavedAt.value;
      }),
    );

    this._requestWakeLock();
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    this._releaseWakeLock();
    super.disconnectedCallback();
  }

  private async _requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      // Wake lock denied or unsupported — degrades gracefully; not all browsers implement the API.
      captureError(err, { source: 'VelgForgeWizard._requestWakeLock' });
    }
  }

  private async _releaseWakeLock(): Promise<void> {
    if (this._wakeLock) {
      await this._wakeLock
        .release()
        .catch((err) => captureError(err, { source: 'VelgForgeWizard._releaseWakeLock' }));
      this._wakeLock = null;
    }
  }

  private _handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this._requestWakeLock();
    }
  };

  private _navigateToPhase(phaseId: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition') {
    forgeStateManager.updateDraft({ current_phase: phaseId });
  }

  /**
   * The four-step phase bar.
   *
   * Every ARIA attribute here used to be written as an element-position
   * expression – `${isActive ? html\`aria-current="step"\` : nothing}` – which
   * Lit only accepts for directives. A TemplateResult in that position is
   * dropped without an error, so `aria-current`, `role="button"` and the
   * per-step `aria-label` never reached the DOM: the bar announced itself as a
   * plain list, and every completed step was a focusable div with no name and
   * no role. They are ordinary attribute bindings now, and a completed step is
   * a real button rather than a div with a keydown handler.
   */
  private _renderPhaseBar() {
    const steps: {
      id: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition';
      label: string;
      ignition: boolean;
    }[] = [
      { id: 'astrolabe', label: msg('I. The Astrolabe'), ignition: false },
      { id: 'drafting', label: msg('II. The Table'), ignition: false },
      { id: 'darkroom', label: msg('III. The Darkroom'), ignition: false },
      { id: 'ignition', label: msg('IV. The Ignition'), ignition: true },
    ];
    const phaseOrder: string[] = steps.map((s) => s.id);
    const currentIdx = phaseOrder.indexOf(this._phase);

    return html`
      <div class="phases" role="list" aria-label=${msg('Forge Phases')}>
        ${steps.map((s, i) => {
          const isDone = i < currentIdx;
          const isActive = this._phase === s.id;
          const classes = [
            'phase',
            isDone ? 'phase--done' : '',
            isActive ? 'phase--active' : '',
            s.ignition ? 'phase--ignition' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return html`
            <div
              role="listitem"
              class="${classes}"
              aria-current=${isActive ? 'step' : nothing}
            >
              ${
                isDone
                  ? html`
                <button
                  type="button"
                  class="phase__jump"
                  aria-label=${msg(str`Return to ${s.label}`)}
                  @click=${() => this._navigateToPhase(s.id)}
                >
                  <span aria-hidden="true">&#10003;</span> ${s.label}
                </button>
              `
                  : html`<span class="phase__label">${s.label}</span>`
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * The compact context strip that replaces the hero from phase II onward.
   *
   * The hero is onboarding: it names the tool and asks for fifteen minutes.
   * That is worth 250 pixels once. Carrying it through all four phases cost
   * that height on every screen while the things the user had actually decided
   * – the city, the anchor, the parameters – were nowhere on screen at all.
   */
  private _renderContextBar() {
    const draft = this._draft;
    if (!draft) return nothing;

    const city = (draft.geography as { city_name?: string } | undefined)?.city_name;
    const anchor = draft.philosophical_anchor?.selected;
    // From the state manager, not the raw column. `generation_config` is only
    // written once the user moves a slider, so a draft that took the defaults
    // has an empty object there and the strip read
    // "undefined operatives · undefined structures". The manager merges the
    // defaults, which is also what the phase itself and the action bar use.
    const cfg = forgeStateManager.generationConfig.value;

    return html`
      <div class="context-bar">
        <div class="context-bar__main">
          ${city ? html`<span class="context-bar__city">${city}</span>` : nothing}
          ${anchor ? html`<span class="context-bar__anchor">${t(anchor, 'title')}</span>` : nothing}
        </div>
        ${
          cfg
            ? html`
          <span class="context-bar__params">
            ${msg(str`${cfg.agent_count} operatives · ${cfg.building_count} structures · ${cfg.zone_count} districts`)}
          </span>
        `
            : nothing
        }
        <button
          type="button"
          class="context-bar__jump"
          @click=${() => this._navigateToPhase('astrolabe')}
        >${msg('Back to the seed')}</button>
      </div>
    `;
  }

  /**
   * Save state, reported from an acknowledged write rather than from the mere
   * existence of a draft.
   */
  private _renderSaveState() {
    if (this._lastSavedAt === null) {
      return html`<span class="save-state save-state--pending">${msg('Not saved yet')}</span>`;
    }
    const time = new Date(this._lastSavedAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return html`
      <span class="save-state" role="status">
        <span class="save-state__dot" aria-hidden="true"></span>
        ${msg(str`Saved ${time}`)}
      </span>
      <button type="button" class="save-state__leave" @click=${this._handleSaveAndLeave}>
        ${msg('Save and leave')}
      </button>
    `;
  }

  private _handleSaveAndLeave = async (): Promise<void> => {
    await forgeStateManager.flushNow();
    navigate('/');
  };

  protected render() {
    const isOpening = this._phase === 'astrolabe';

    return html`
      <div class="forge-container">
        ${
          isOpening
            ? html`
          <header class="forge-hero">
            <div class="forge-hero__classification">${msg('Bureau of Impossible Geography')}</div>
            <h1 class="forge-hero__title">${msg('The Simulation Forge')}</h1>
            <p class="forge-hero__subtitle">
              ${msg('Materialize a new Shard through the mechanics of Curated Proceduralism.')}
            </p>
            <div class="forge-hero__save">${this._renderSaveState()}</div>
          </header>
        `
            : html`
          <header class="forge-strip">
            ${this._renderContextBar()}
            <div class="forge-strip__save">${this._renderSaveState()}</div>
          </header>
        `
        }

        ${this._renderPhaseBar()}

        <main class="phase-content" aria-live="polite" .key=${this._phase}>
          ${this._renderCurrentPhase()}
        </main>
      </div>
    `;
  }

  private _renderCurrentPhase() {
    switch (this._phase) {
      case 'astrolabe':
        return html`<velg-forge-astrolabe></velg-forge-astrolabe>`;
      case 'drafting':
        return html`<velg-forge-table></velg-forge-table>`;
      case 'darkroom':
        return html`<velg-forge-darkroom></velg-forge-darkroom>`;
      case 'ignition':
        return html`<velg-forge-ignition></velg-forge-ignition>`;
      default:
        return nothing;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-wizard': VelgForgeWizard;
  }
}
