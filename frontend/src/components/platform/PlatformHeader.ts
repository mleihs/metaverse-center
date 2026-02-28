import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { localeService } from '../../services/i18n/locale-service.js';
import type { Simulation } from '../../types/index.js';

import './UserMenu.js';

@localized()
@customElement('velg-platform-header')
export class VelgPlatformHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      height: var(--header-height);
      background: var(--color-surface-header);
    }

    /* Animated gradient bottom border */
    :host::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-primary) 15%,
        var(--color-text-secondary) 35%,
        var(--color-primary) 50%,
        var(--color-text-secondary) 65%,
        var(--color-primary) 85%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: header-border-flow 4s linear infinite;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 0 var(--space-6);
    }

    .header__left {
      display: flex;
      align-items: center;
      gap: var(--space-8);
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      cursor: pointer;
      text-decoration: none;
    }

    /* --- Map button — marching ants border + beacon dot --- */

    .header__nav-link {
      position: relative;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      text-decoration: none;
      cursor: pointer;
      padding: var(--space-2) var(--space-5) var(--space-2) var(--space-7);
      color: var(--color-primary);
      border: none;

      /* Marching-ants border — 4 dashed gradients, one per edge */
      background:
        repeating-linear-gradient(90deg, var(--color-primary) 0 6px, transparent 6px 12px) 0 0 / 100% 2px no-repeat,
        repeating-linear-gradient(90deg, var(--color-primary) 0 6px, transparent 6px 12px) 0 100% / 100% 2px no-repeat,
        repeating-linear-gradient(0deg, var(--color-primary) 0 6px, transparent 6px 12px) 0 0 / 2px 100% no-repeat,
        repeating-linear-gradient(0deg, var(--color-primary) 0 6px, transparent 6px 12px) 100% 0 / 2px 100% no-repeat;
      background-color: var(--color-surface);
      animation: march 0.6s linear infinite;

      transition:
        color 0.25s ease,
        background-color 0.25s ease,
        letter-spacing 0.3s ease,
        transform 0.2s ease,
        box-shadow 0.3s ease,
        filter 0.3s ease;
    }

    /* Beacon dot — pulsing "you are here" marker */
    .header__nav-link::before {
      content: '';
      position: absolute;
      left: var(--space-3);
      top: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-primary);
      transform: translateY(-50%);
      box-shadow: 0 0 4px var(--color-primary);
      animation: beacon-pulse 2s ease-in-out infinite;
    }

    /* Hover: fill + faster ants + beacon expands */
    .header__nav-link:hover {
      color: var(--color-text-inverse);
      background-color: var(--color-primary);
      letter-spacing: calc(var(--tracking-brutalist) + 0.04em);
      transform: translate(-2px, -2px);
      box-shadow:
        var(--shadow-lg),
        0 0 15px color-mix(in srgb, var(--color-primary) 40%, transparent);
      animation: march 0.25s linear infinite;

      /* Override border gradients to white/inverse for contrast */
      background-image:
        repeating-linear-gradient(90deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(90deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(0deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(0deg, var(--color-text-inverse) 0 6px, transparent 6px 12px);
    }

    .header__nav-link:hover::before {
      background: var(--color-text-inverse);
      box-shadow:
        0 0 6px var(--color-text-inverse),
        0 0 12px color-mix(in srgb, var(--color-text-inverse) 60%, transparent);
      animation: beacon-pulse-fast 0.8s ease-in-out infinite;
    }

    .header__nav-link:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    /* --- Active state (map is open) --- */

    .header__nav-link--active {
      color: var(--color-text-inverse);
      background-color: var(--color-primary);
      animation: march 0.35s linear infinite;

      /* Inverse ants */
      background-image:
        repeating-linear-gradient(90deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(90deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(0deg, var(--color-text-inverse) 0 6px, transparent 6px 12px),
        repeating-linear-gradient(0deg, var(--color-text-inverse) 0 6px, transparent 6px 12px);

      box-shadow:
        0 0 10px color-mix(in srgb, var(--color-primary) 40%, transparent),
        0 0 25px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .header__nav-link--active::before {
      background: var(--color-text-inverse);
      box-shadow: 0 0 6px var(--color-text-inverse);
    }

    .header__nav-link--active:hover {
      background-color: var(--color-primary-hover);
      box-shadow:
        var(--shadow-lg),
        0 0 20px color-mix(in srgb, var(--color-primary) 60%, transparent),
        0 0 40px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    /* --- Simulation selector --- */

    .sim-selector {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sim-selector__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .sim-selector__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-3);
      border: var(--border-default);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .sim-selector__select:hover {
      border-color: var(--color-primary);
    }

    .sim-selector__select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    /* --- Right side --- */

    .header__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .locale-toggle {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-2);
      border: var(--border-default);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.2s ease,
        box-shadow 0.2s ease;
    }

    .locale-toggle:hover {
      color: var(--color-primary);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }

    .locale-toggle:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn-sign-in {
      position: relative;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-1-5) var(--space-4);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-color: var(--color-primary);
      border-radius: var(--border-radius);
      cursor: pointer;
      overflow: hidden;
      transition:
        transform 0.2s ease,
        box-shadow 0.3s ease;
    }

    .btn-sign-in::before {
      content: '';
      position: absolute;
      top: -30%;
      left: -80%;
      width: 40%;
      height: 160%;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-text-inverse) 30%, transparent),
        transparent
      );
      transform: skewX(-20deg);
      opacity: 0;
      pointer-events: none;
    }

    .btn-sign-in:hover {
      transform: translate(-2px, -2px);
      box-shadow:
        var(--shadow-lg),
        0 0 15px color-mix(in srgb, var(--color-primary) 40%, transparent);
    }

    .btn-sign-in:hover::before {
      opacity: 1;
      animation: nav-link-sweep 0.6s ease forwards;
    }

    .btn-sign-in:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    /* --- Keyframes --- */

    /* Marching ants: dashes march clockwise around the border */
    @keyframes march {
      to {
        background-position:
          12px 0, -12px 100%,
          0 -12px, 100% 12px;
      }
    }

    /* Beacon dot: gentle pulse */
    @keyframes beacon-pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 4px var(--color-primary);
      }
      50% {
        opacity: 0.4;
        box-shadow: 0 0 8px var(--color-primary), 0 0 16px color-mix(in srgb, var(--color-primary) 40%, transparent);
      }
    }

    /* Beacon dot: fast pulse on hover */
    @keyframes beacon-pulse-fast {
      0%, 100% {
        opacity: 1;
        transform: translateY(-50%) scale(1);
        box-shadow: 0 0 6px var(--color-text-inverse);
      }
      50% {
        opacity: 0.6;
        transform: translateY(-50%) scale(1.5);
        box-shadow: 0 0 10px var(--color-text-inverse), 0 0 20px color-mix(in srgb, var(--color-text-inverse) 50%, transparent);
      }
    }

    @keyframes header-border-flow {
      0% { background-position: 0% 0; }
      100% { background-position: 200% 0; }
    }

    /* === Mobile: collapse header elements === */

    @media (max-width: 640px) {
      .header {
        padding: 0 var(--space-3);
      }

      .header__left {
        gap: var(--space-3);
      }

      .header__title {
        font-size: var(--text-base);
        letter-spacing: 0;
      }

      .sim-selector__label {
        display: none;
      }

      .header__nav-link {
        padding: var(--space-1-5) var(--space-3) var(--space-1-5) var(--space-5);
        font-size: var(--text-xs);
      }

      .header__right {
        gap: var(--space-2);
      }
    }

    @media (max-width: 400px) {
      .header__nav-link {
        display: none;
      }
    }
  `;

  @state() private _simulations: Simulation[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this._simulations = appState.simulations.value;
    import('./DevAccountSwitcher.js');
  }

  private _handleTitleClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/dashboard', bubbles: true, composed: true }),
    );
  }

  private _preMapPath: string | null = null;

  private _handleMapClick(e: Event): void {
    e.preventDefault();
    if (window.location.pathname === '/multiverse') {
      // Go back to where the user was before opening the map
      const target = this._preMapPath ?? '/dashboard';
      this._preMapPath = null;
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: target, bubbles: true, composed: true }),
      );
    } else {
      this._preMapPath = window.location.pathname;
      this.dispatchEvent(
        new CustomEvent('navigate', { detail: '/multiverse', bubbles: true, composed: true }),
      );
    }
  }

  private _handleEpochClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/epoch', bubbles: true, composed: true }),
    );
  }

  private _handleGuideClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: '/how-to-play', bubbles: true, composed: true }),
    );
  }

  private _handleSignInClick(): void {
    this.dispatchEvent(new CustomEvent('login-panel-open', { bubbles: true, composed: true }));
  }

  private async _toggleLocale(): Promise<void> {
    const next = localeService.currentLocale === 'en' ? 'de' : 'en';
    await localeService.setLocale(next);
  }

  private _handleSimulationChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const simId = select.value;
    const sim = this._simulations.find((s) => s.id === simId) || null;
    appState.setCurrentSimulation(sim);
    if (sim) {
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: `/simulations/${sim.slug}/agents`,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  protected render() {
    const currentSim = appState.currentSimulation.value;

    return html`
      <div class="header">
        <div class="header__left">
          <a href="/dashboard" class="header__title" @click=${this._handleTitleClick}>${msg('metaverse.center')}</a>

          <a href="/multiverse" class="header__nav-link ${window.location.pathname === '/multiverse' ? 'header__nav-link--active' : ''}" @click=${this._handleMapClick}>${msg('Map')}</a>

          <a href="/epoch" class="header__nav-link ${window.location.pathname === '/epoch' ? 'header__nav-link--active' : ''}" @click=${this._handleEpochClick}>${msg('Epoch')}</a>

          <a href="/how-to-play" class="header__nav-link ${window.location.pathname === '/how-to-play' ? 'header__nav-link--active' : ''}" @click=${this._handleGuideClick}>${msg('Guide')}</a>

          ${
            this._simulations.length > 0
              ? html`
              <div class="sim-selector">
                <span class="sim-selector__label">${msg('Simulation:')}</span>
                <select class="sim-selector__select" @change=${this._handleSimulationChange}>
                  <option value="">${msg('-- Select --')}</option>
                  ${this._simulations.map(
                    (sim) => html`
                      <option value=${sim.id} ?selected=${currentSim?.id === sim.id}>
                        ${sim.name}
                      </option>
                    `,
                  )}
                </select>
              </div>
            `
              : null
          }
        </div>

        <div class="header__right">
          ${html`<velg-dev-account-switcher></velg-dev-account-switcher>`}
          <button class="locale-toggle" @click=${this._toggleLocale}>
            ${localeService.currentLocale === 'en' ? 'DE' : 'EN'}
          </button>
          ${
            appState.isAuthenticated.value
              ? html`<velg-user-menu></velg-user-menu>`
              : html`<button class="btn-sign-in" @click=${this._handleSignInClick}>${msg('Sign In')}</button>`
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-header': VelgPlatformHeader;
  }
}
