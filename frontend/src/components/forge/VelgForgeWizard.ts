import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';

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
    css`
      /* ── Dark Console Shell ──────────────── */

      :host {
        display: block;
        min-height: 100vh;
        background: var(--color-gray-950, #030712);
        color: var(--color-gray-100, #f3f4f6);
        position: relative;
        overflow: hidden;
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
        z-index: 1000;
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
        border-bottom: 2px solid var(--color-gray-700, #374151);
        background: var(--color-gray-900, #111827);
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
        color: var(--color-danger, #ef4444);
        border: 1px solid var(--color-danger, #ef4444);
        margin-bottom: var(--space-4);
        position: relative;
      }

      .forge-hero__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black, 900);
        font-size: var(--text-3xl, 1.875rem);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist, 0.08em);
        color: var(--color-gray-100, #f3f4f6);
        margin: 0 0 var(--space-2);
        position: relative;
      }

      .forge-hero__subtitle {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        color: var(--color-gray-400, #9ca3af);
        margin: 0;
        position: relative;
      }

      .forge-hero__save-status {
        position: absolute;
        top: var(--space-4);
        right: var(--space-6);
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-gray-400, #9ca3af);
      }

      .forge-hero__save-status--saving {
        color: var(--color-success, #22c55e);
        animation: blink 1s step-end infinite;
      }

      @keyframes blink {
        50% { opacity: 0; }
      }

      /* ── Phase Indicator Bar ─────────────── */

      .phases {
        display: flex;
        gap: 0;
        margin-bottom: var(--space-10);
        border: 1px solid var(--color-gray-700, #374151);
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
        color: var(--color-gray-400, #9ca3af);
        background: var(--color-gray-900, #111827);
        border-right: 1px solid var(--color-gray-700, #374151);
        position: relative;
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .phase:last-child {
        border-right: none;
      }

      .phase--active {
        color: var(--color-gray-950, #030712);
        background: var(--color-success, #22c55e);
        font-weight: 700;
      }

      /* Phase IV (Ignition) uses danger red instead of green */
      .phase--active.phase--ignition {
        background: var(--color-danger, #ef4444);
        color: white;
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
        color: var(--color-success, #22c55e);
        background: rgba(74 222 128 / 0.1);
      }

      .phase--clickable {
        cursor: pointer;
      }

      .phase--clickable:hover {
        background: rgba(74 222 128 / 0.18);
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
  @state() private _hasDraft = false;
  private _disposeEffects: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();

    this._disposeEffects.push(
      effect(() => {
        this._phase = forgeStateManager.phase.value;
      }),
      effect(() => {
        this._hasDraft = forgeStateManager.draft.value !== null;
      }),
    );
  }

  disconnectedCallback() {
    for (const dispose of this._disposeEffects) dispose();
    this._disposeEffects = [];
    super.disconnectedCallback();
  }

  private _navigateToPhase(phaseId: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition') {
    forgeStateManager.updateDraft({ current_phase: phaseId });
  }

  private _renderPhaseBar() {
    const steps: { id: 'astrolabe' | 'drafting' | 'darkroom' | 'ignition'; label: string; ignition: boolean }[] = [
      { id: 'astrolabe', label: msg('I. The Astrolabe'), ignition: false },
      { id: 'drafting', label: msg('II. The Table'), ignition: false },
      { id: 'darkroom', label: msg('III. The Darkroom'), ignition: false },
      { id: 'ignition', label: msg('IV. The Ignition'), ignition: true },
    ];
    const phaseOrder: string[] = steps.map((s) => s.id);
    const currentIdx = phaseOrder.indexOf(this._phase);

    return html`
      <div class="phases" role="list" aria-label=${msg('Forge Phases')}>
        ${steps.map(
          (s, i) => {
            const isDone = i < currentIdx;
            const isActive = this._phase === s.id;
            return html`
            <div
              role="listitem"
              class="phase ${isDone ? 'phase--done phase--clickable' : ''} ${isActive ? 'phase--active' : ''} ${s.ignition ? 'phase--ignition' : ''}"
              ${isActive ? html`aria-current="step"` : nothing}
              @click=${isDone ? () => this._navigateToPhase(s.id) : nothing}
              @keydown=${isDone ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._navigateToPhase(s.id); } } : nothing}
              tabindex=${isDone ? '0' : '-1'}
              ${isDone ? html`role="button"` : nothing}
              ${isDone ? html`aria-label=${msg('Return to') + ' ' + s.label}` : nothing}
            >
              ${isDone ? html`<span aria-hidden="true">&#10003; </span>` : nothing}${s.label}
            </div>
          `;
          },
        )}
      </div>
    `;
  }

  protected render() {
    return html`
      <div class="forge-container">
        <header class="forge-hero">
          <div class="forge-hero__classification">${msg('Bureau of Impossible Geography')}</div>
          <h1 class="forge-hero__title">${msg('The Simulation Forge')}</h1>
          <p class="forge-hero__subtitle">
            ${msg('Materialize a new Shard through the mechanics of Curated Proceduralism.')}
          </p>
          ${
            this._hasDraft
              ? html`<span class="forge-hero__save-status" role="status">${msg('Saved')}</span>`
              : nothing
          }
        </header>

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
