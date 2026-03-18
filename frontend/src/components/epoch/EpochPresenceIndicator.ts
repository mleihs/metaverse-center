/**
 * EpochPresenceIndicator — compact online/offline signal lamp.
 *
 * Green pulsing dot when the simulation's player is currently online
 * in the epoch's Realtime presence channel. Gray dormant dot otherwise.
 * Tooltip shows simulation name.
 */

import { effect } from '@preact/signals-core';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { realtimeService } from '../../services/realtime/RealtimeService.js';
import type { PresenceUser } from '../../types/index.js';

@customElement('velg-epoch-presence')
export class VelgEpochPresenceIndicator extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 0.3s, box-shadow 0.3s;
    }

    .dot--online {
      background: var(--color-success);
      box-shadow: 0 0 4px color-mix(in srgb, var(--color-success) 60%, transparent);
      animation: pulse-online 2s ease-in-out infinite;
    }

    .dot--offline {
      background: var(--color-icon);
      box-shadow: none;
    }

    @keyframes pulse-online {
      0%, 100% { box-shadow: 0 0 4px color-mix(in srgb, var(--color-success) 60%, transparent); }
      50% { box-shadow: 0 0 8px color-mix(in srgb, var(--color-success) 90%, transparent); }
    }
  `;

  @property() simulationId = '';
  @state() private _isOnline = false;
  private _disposeEffect?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._disposeEffect = effect(() => {
      const users: PresenceUser[] = realtimeService.onlineUsers.value;
      this._isOnline = users.some((u) => u.simulation_id === this.simulationId);
    });
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    super.disconnectedCallback();
  }

  protected render() {
    return html`
      <span
        class="dot ${this._isOnline ? 'dot--online' : 'dot--offline'}"
        title=${this._isOnline ? 'Online' : 'Offline'}
      ></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-presence': VelgEpochPresenceIndicator;
  }
}
