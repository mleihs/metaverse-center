import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AgentIntelData } from '../lore/lore-content.js';

/**
 * Per-agent Bureau intelligence card, displayed on agent detail pages
 * when the simulation's classified dossier has been purchased.
 */
@localized()
@customElement('velg-intel-card')
export class VelgIntelCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .intel {
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 60%, transparent);
      padding: var(--space-4);
      position: relative;
      overflow: hidden;
    }

    /* Scanline */
    .intel::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        color-mix(in srgb, var(--color-primary) 1.5%, transparent) 2px,
        color-mix(in srgb, var(--color-primary) 1.5%, transparent) 4px
      );
      pointer-events: none;
    }

    .intel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .intel__title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .intel__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      opacity: 0.7;
    }

    .intel__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .intel__stamp {
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      padding: 2px var(--space-1);
      transform: rotate(2deg);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Risk Badge ── */
    .intel__risk {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid;
      margin-bottom: var(--space-3);
    }

    .risk-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .intel__risk--low {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    .intel__risk--low .risk-dot { background: var(--color-success); }

    .intel__risk--moderate {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    }
    .intel__risk--moderate .risk-dot { background: var(--color-warning); }

    .intel__risk--high {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }
    .intel__risk--high .risk-dot { background: var(--color-danger); }

    .intel__risk--critical {
      color: var(--color-danger);
      border-color: var(--color-danger);
      animation: risk-glow 1.5s ease-in-out infinite;
    }
    .intel__risk--critical .risk-dot {
      background: var(--color-danger);
      animation: risk-pulse 1s ease-in-out infinite;
    }

    @keyframes risk-glow {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: 0 0 8px var(--color-danger-border); }
    }

    @keyframes risk-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ── Section Fields ── */
    .intel__section {
      margin-bottom: var(--space-3);
    }

    .intel__section:last-child {
      margin-bottom: 0;
    }

    .intel__field-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-1);
    }

    .intel__field-value {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
      white-space: pre-wrap;
    }

    .intel__annotation {
      font-style: italic;
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-2);
      margin-top: var(--space-3);
    }

    @media (prefers-reduced-motion: reduce) {
      .intel__risk--critical,
      .intel__risk--critical .risk-dot {
        animation: none;
      }
    }

    @media (max-width: 480px) {
      .intel {
        padding: var(--space-3);
      }
    }
  `;

  @property({ type: Object }) intel: AgentIntelData | null = null;

  protected render() {
    if (!this.intel) return nothing;

    const {
      agentName,
      riskLevel,
      hiddenMotivation,
      surveillanceNotes,
      crossReferences,
      bureauAnnotation,
    } = this.intel;
    const riskClass = riskLevel.toLowerCase();

    return html`
      <div class="intel" role="region" aria-label=${msg('Bureau Intelligence')}>
        <div class="intel__header">
          <div class="intel__title-group">
            <span class="intel__label">${msg('CLASSIFIED ADDENDUM')}</span>
            <h4 class="intel__name">${agentName}</h4>
          </div>
          <span class="intel__stamp">${msg('LEVEL 4')}</span>
        </div>

        <div class="intel__risk intel__risk--${riskClass}" aria-label="${msg('RISK ASSESSMENT')}: ${riskLevel}">
          <span class="risk-dot" aria-hidden="true"></span>
          ${msg('RISK ASSESSMENT')}: ${riskLevel}
        </div>

        ${
          hiddenMotivation
            ? html`<div class="intel__section">
              <div class="intel__field-label">${msg('HIDDEN MOTIVATION')}</div>
              <div class="intel__field-value">${hiddenMotivation}</div>
            </div>`
            : nothing
        }

        ${
          surveillanceNotes
            ? html`<div class="intel__section">
              <div class="intel__field-label">${msg('SURVEILLANCE NOTES')}</div>
              <div class="intel__field-value">${surveillanceNotes}</div>
            </div>`
            : nothing
        }

        ${
          crossReferences
            ? html`<div class="intel__section">
              <div class="intel__field-label">${msg('CROSS-REFERENCES')}</div>
              <div class="intel__field-value">${crossReferences}</div>
            </div>`
            : nothing
        }

        ${
          bureauAnnotation
            ? html`<div class="intel__annotation">
              <span class="intel__field-label">${msg('BUREAU ANNOTATION')}</span>
              ${bureauAnnotation}
            </div>`
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intel-card': VelgIntelCard;
  }
}
