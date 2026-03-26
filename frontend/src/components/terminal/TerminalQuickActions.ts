/**
 * Bureau Terminal — Context-sensitive quick action buttons.
 *
 * Buttons below the terminal that type and execute commands.
 * Written Realms hybrid pattern: click types the command AND executes it,
 * so the user learns the syntax naturally.
 *
 * Button sets change based on clearance level and conversation mode.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { terminalTokens } from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-terminal-quick-actions')
export class VelgTerminalQuickActions extends LitElement {
  static styles = [
    terminalTokens,
    css`
      :host {
        display: block;
        --_phosphor: var(--amber);
        --_phosphor-dim: var(--amber-dim);
        --_phosphor-glow: var(--amber-glow);
        --_screen-bg: var(--hud-bg);
        --_border: var(--hud-border);
        --_mono: var(--font-mono, 'SF Mono', 'Fira Code', 'Cascadia Code', monospace);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--_screen-bg) 80%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        border-top: none;
      }

      .action-btn {
        font-family: var(--_mono);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 5px 12px;
        background: transparent;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
        cursor: pointer;
        transition: all 150ms;
        white-space: nowrap;
      }

      .action-btn:hover {
        color: var(--_phosphor);
        border-color: var(--_phosphor-dim);
        background: color-mix(in srgb, var(--_phosphor) 5%, transparent);
      }

      @media (prefers-reduced-motion: no-preference) {
        .action-btn:hover {
          box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent);
        }
      }

      .action-btn:active {
        transform: scale(0.96);
      }

      .action-btn:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      .action-btn--tier2 {
        border-style: dashed;
      }

      /* Mobile: larger touch targets */
      @media (max-width: 640px) {
        .actions {
          padding: 10px 14px;
          gap: 8px;
        }
        .action-btn {
          font-size: 12px;
          padding: 8px 16px;
          min-height: 44px;
        }
      }
    `,
  ];

  @property({ type: Number }) clearanceLevel = 1;
  @property({ type: Boolean }) inConversation = false;
  @property({ type: Boolean }) epochMode = false;

  private _dispatch(command: string): void {
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: command,
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    // Conversation mode: only show Leave
    if (this.inConversation) {
      return html`
        <div class="actions" role="toolbar" aria-label=${msg('Quick actions')}>
          <button class="action-btn" @click=${() => this._dispatch('leave')}>
            ${msg('Leave')}
          </button>
        </div>
      `;
    }

    return html`
      <div class="actions" role="toolbar" aria-label=${msg('Quick actions')}>
        <button class="action-btn" @click=${() => this._dispatch('look')}>
          ${msg('Look')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('status')}>
          ${msg('Status')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('weather')}>
          ${msg('Weather')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('map')}>
          ${msg('Map')}
        </button>
        <button class="action-btn" @click=${() => this._dispatch('help')}>
          ${msg('Help')}
        </button>
        ${this.clearanceLevel >= 2 && !this.epochMode
          ? html`
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('fortify')}>
              ${msg('Fortify')}
            </button>
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('assign')}>
              ${msg('Assign')}
            </button>
          `
          : ''}
        ${this.epochMode
          ? html`
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('sitrep')}>
              ${msg('Sitrep')}
            </button>
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('threats')}>
              ${msg('Threats')}
            </button>
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('intercept')}>
              ${msg('Intercept')}
            </button>
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('dossier')}>
              ${msg('Dossier')}
            </button>
          `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-terminal-quick-actions': VelgTerminalQuickActions;
  }
}
