/**
 * Bureau Terminal — Context-sensitive quick action buttons.
 *
 * Buttons below the terminal that type and execute commands.
 * Written Realms hybrid pattern: click types the command AND executes it,
 * so the user learns the syntax naturally.
 *
 * Button sets change based on clearance level and conversation mode.
 * Button CSS extracted to terminalActionStyles (shared with DungeonQuickActions).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  terminalActionStyles,
  terminalComponentTokens,
  terminalTokens,
} from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-terminal-quick-actions')
export class VelgTerminalQuickActions extends LitElement {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalActionStyles,
    css`
      :host {
        display: block;
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
        ${
          this.clearanceLevel >= 2 && !this.epochMode
            ? html`
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('fortify')}>
              ${msg('Fortify')}
            </button>
            <button class="action-btn action-btn--tier2" @click=${() => this._dispatch('assign')}>
              ${msg('Assign')}
            </button>
          `
            : ''
        }
        ${
          this.epochMode
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
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-terminal-quick-actions': VelgTerminalQuickActions;
  }
}
