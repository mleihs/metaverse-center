/**
 * Onboarding Wizard — Full-screen immersive 4-step induction sequence.
 *
 * Aesthetic: Military intelligence briefing terminal. The user is being
 * inducted into a classified multiverse monitoring program. Each step
 * feels like declassifying the next dossier section.
 *
 * Steps:
 *   1. Welcome — "Welcome to the Multiverse" atmospheric intro
 *   2. Your First World — Create / Browse / Skip paths
 *   3. Quick Tour — 5 highlight cards in horizontal scroll
 *   4. First Mission — Academy Epoch or free exploration
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { usersApi } from '../../services/api/UsersApiService.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';

type WizardStep = 0 | 1 | 2 | 3;

@localized()
@customElement('velg-onboarding-wizard')
export class VelgOnboardingWizard extends LitElement {
  static styles = css`
    /* ── Overlay ── */

    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: var(--z-sticky);
      animation: overlay-enter 300ms ease both;
    }

    @keyframes overlay-enter {
      from { opacity: 0; }
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
    }

    .backdrop__noise {
      position: absolute;
      inset: 0;
      opacity: 0.04;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 128px 128px;
      pointer-events: none;
    }

    /* ── Container ── */

    .container {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }

    .wizard {
      width: 100%;
      max-width: 640px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      position: relative;
      overflow: hidden;
      animation: wizard-scale-enter 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both 100ms;
    }

    @keyframes wizard-scale-enter {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Amber top accent */
    .wizard::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--color-accent-amber) 20%,
        var(--color-accent-amber) 80%,
        transparent 100%
      );
    }

    /* ── Step Indicator ── */

    .step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      padding: 20px 24px 0;
    }

    .step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-border);
      border: 1px solid var(--color-border);
      transition: all 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      flex-shrink: 0;
    }

    .step-dot--active {
      width: 10px;
      height: 10px;
      background: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 8px var(--color-accent-amber-glow);
      animation: badge-pop 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
    }

    .step-dot--completed {
      background: var(--color-warning-border);
      border-color: var(--color-warning-border);
    }

    .step-connector {
      width: 32px;
      height: 1px;
      background: var(--color-border);
      transition: background 200ms;
    }

    .step-connector--active {
      background: var(--color-warning-border);
    }

    @keyframes badge-pop {
      from { transform: scale(0.7); }
      to   { transform: scale(1); }
    }

    /* ── Step Content ── */

    .step-content {
      padding: 32px 32px 24px;
      min-height: 320px;
      display: flex;
      flex-direction: column;
    }

    .step--forward {
      animation: step-slide-left 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    .step--backward {
      animation: step-slide-right 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes step-slide-left {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    @keyframes step-slide-right {
      from { opacity: 0; transform: translateX(-40px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* ── Footer ── */

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px 24px;
      gap: 12px;
    }

    .footer__skip {
      background: none;
      border: none;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 4px 8px;
      letter-spacing: 0.5px;
      transition: color 150ms;
    }

    .footer__skip:hover {
      color: var(--color-text-muted);
    }

    .footer__skip:focus-visible {
      outline: 1px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Shared: Card Enter ── */

    @keyframes card-enter {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes btn-materialize {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Shared: CTA Button ── */

    .btn-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: none;
      cursor: pointer;
      transition: background 150ms, transform 150ms, box-shadow 150ms;
      box-shadow: 3px 3px 0 var(--color-accent-amber-glow);
      opacity: 0;
      animation: btn-materialize 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    .btn-cta--delay-sm  { animation-delay: 400ms; }
    .btn-cta--delay-md  { animation-delay: 600ms; }
    .btn-cta--delay-lg  { animation-delay: 800ms; }

    .btn-cta:hover {
      background: var(--color-accent-amber-hover);
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 var(--color-accent-amber-glow);
    }

    .btn-cta:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 var(--color-accent-amber-glow);
    }

    .btn-cta:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .btn-cta svg {
      width: 14px;
      height: 14px;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: border-color 150ms, color 150ms, transform 150ms;
    }

    .btn-secondary:hover {
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
      transform: translateY(-1px);
    }

    .btn-secondary:active {
      transform: translateY(0);
    }

    .btn-secondary:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ══════════════════════════════════════════
       STEP 1: WELCOME
       ══════════════════════════════════════════ */

    .welcome {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      position: relative;
    }

    .welcome__glow {
      position: absolute;
      inset: -40px;
      background:
        radial-gradient(ellipse at 30% 40%, var(--color-ascendant-gold) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 60%, var(--color-ascendant-gold) 0%, transparent 50%);
      animation: welcome-drift 12s ease-in-out infinite alternate;
      pointer-events: none;
    }

    @keyframes welcome-drift {
      from { opacity: 0.6; }
      to   { opacity: 1; }
    }

    .welcome__classification {
      position: relative;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 24px;
      opacity: 0;
      animation: card-enter 400ms var(--ease-dramatic) both 200ms;
    }

    .welcome__title {
      position: relative;
      font-family: var(--font-prose);
      font-weight: 900;
      font-size: 28px;
      letter-spacing: 1px;
      color: var(--color-text-primary);
      margin: 0 0 20px;
      animation: hero-title-enter 600ms var(--ease-dramatic) both 300ms;
    }

    @keyframes hero-title-enter {
      from { opacity: 0; transform: translateX(-12px); letter-spacing: 0.3em; }
      to   { opacity: 1; transform: translateX(0); letter-spacing: 1px; }
    }

    .welcome__pitch {
      position: relative;
      list-style: none;
      margin: 0 0 32px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .welcome__pitch li {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-text-muted);
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic) both;
    }

    .welcome__pitch li:nth-child(1) { animation-delay: 500ms; }
    .welcome__pitch li:nth-child(2) { animation-delay: 580ms; }
    .welcome__pitch li:nth-child(3) { animation-delay: 660ms; }

    /* ══════════════════════════════════════════
       STEP 2: YOUR FIRST WORLD
       ══════════════════════════════════════════ */

    .worlds {
      flex: 1;
    }

    .worlds__heading {
      font-family: var(--font-prose);
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 6px;
    }

    .worlds__subtext {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 0 0 24px;
    }

    .path-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .path-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: border-color 200ms, transform 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic) both;
      animation-delay: calc(var(--i, 0) * 100ms + 100ms);
    }

    .path-card:hover {
      border-color: var(--color-border);
    }

    .path-card:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    .path-card[aria-selected="true"] {
      border-color: var(--color-accent-amber);
      transform: scale(1.01);
      background: var(--color-ascendant-gold);
    }

    .path-card__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }

    .path-card[aria-selected="true"] .path-card__icon {
      color: var(--color-accent-amber);
      border-color: var(--color-warning-border);
    }

    .path-card__text {
      flex: 1;
      min-width: 0;
    }

    .path-card__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--color-text-secondary);
      margin: 0 0 2px;
    }

    .path-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .path-card__arrow {
      flex-shrink: 0;
      color: var(--color-border);
      transition: color 200ms, transform 200ms;
    }

    .path-card:hover .path-card__arrow,
    .path-card[aria-selected="true"] .path-card__arrow {
      color: var(--color-text-muted);
      transform: translateX(2px);
    }

    /* ══════════════════════════════════════════
       STEP 3: QUICK TOUR
       ══════════════════════════════════════════ */

    .tour {
      flex: 1;
    }

    .tour__heading {
      font-family: var(--font-prose);
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 6px;
    }

    .tour__subtext {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 0 0 20px;
    }

    .tour-carousel {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 8px;
      margin: 0 -8px;
      padding-left: 8px;
      padding-right: 8px;
    }

    /* Scrollbar styling */
    .tour-carousel::-webkit-scrollbar {
      height: 3px;
    }

    .tour-carousel::-webkit-scrollbar-track {
      background: var(--color-border-light);
    }

    .tour-carousel::-webkit-scrollbar-thumb {
      background: var(--color-border);
    }

    .tour-card {
      flex: 0 0 160px;
      scroll-snap-align: start;
      padding: 16px 14px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic) both;
      animation-delay: calc(var(--i, 0) * 80ms + 100ms);
      transition: border-color 200ms;
    }

    .tour-card:hover {
      border-color: var(--color-border);
    }

    .tour-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: var(--color-accent-amber);
    }

    .tour-card__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--color-text-secondary);
    }

    .tour-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      line-height: 1.5;
      color: var(--color-text-muted);
    }

    /* ══════════════════════════════════════════
       STEP 4: FIRST MISSION
       ══════════════════════════════════════════ */

    .mission {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .mission__heading {
      font-family: var(--font-prose);
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 6px;
    }

    .mission__subtext {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      margin: 0 0 24px;
      line-height: 1.6;
    }

    .mission-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }

    .mission-card {
      appearance: none;
      font: inherit;
      text-align: start;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: border-color 200ms, transform 200ms, box-shadow 200ms;
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic) both;
    }

    .mission-card:first-child { animation-delay: 200ms; }
    .mission-card:last-child  { animation-delay: 320ms; }

    .mission-card:hover {
      border-color: var(--color-border);
      transform: translateY(-1px);
    }

    .mission-card:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    .mission-card--primary {
      border-left: 3px solid var(--color-accent-amber);
    }

    .mission-card--primary:hover {
      border-color: var(--color-warning-border);
      border-left-color: var(--color-accent-amber);
      box-shadow: 0 2px 12px var(--color-primary-bg);
    }

    .mission-card__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }

    .mission-card--primary .mission-card__icon {
      color: var(--color-accent-amber);
      border-color: var(--color-warning-border);
    }

    .mission-card__text {
      flex: 1;
    }

    .mission-card__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--color-text-secondary);
      margin: 0 0 4px;
    }

    .mission-card__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      line-height: 1.5;
      color: var(--color-text-muted);
    }

    .mission-card__arrow {
      flex-shrink: 0;
      color: var(--color-border);
      transition: color 200ms, transform 200ms;
    }

    .mission-card:hover .mission-card__arrow {
      color: var(--color-text-muted);
      transform: translateX(2px);
    }

    /* ── Responsive ── */

    @media (max-width: 480px) {
      .step-content { padding: 24px 20px 16px; }
      .footer { padding: 12px 20px 20px; }
      .welcome__title { font-size: 22px; }
      .tour-card { flex: 0 0 140px; padding: 12px; }
    }
  `;

  @property({ type: Boolean }) open = false;

  @state() private _step: WizardStep = 0;
  @state() private _direction: 'forward' | 'backward' = 'forward';
  @state() private _selectedPath: 'create' | 'browse' | 'skip' | null = null;

  private _goForward(): void {
    if (this._step < 3) {
      this._direction = 'forward';
      this._step = (this._step + 1) as WizardStep;
    }
  }

  private _goBackward(): void {
    if (this._step > 0) {
      this._direction = 'backward';
      this._step = (this._step - 1) as WizardStep;
    }
  }

  private async _complete(action: 'academy' | 'explore'): Promise<void> {
    appState.setOnboardingCompleted(true);
    usersApi
      .completeOnboarding()
      .catch((err) => captureError(err, { source: 'VelgOnboardingWizard._complete' }));

    this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));

    if (action === 'academy') {
      this.dispatchEvent(
        new CustomEvent('onboarding-start-academy', { bubbles: true, composed: true }),
      );
    }
  }

  private _handlePathSelect(path: 'create' | 'browse' | 'skip'): void {
    this._selectedPath = path;

    if (path === 'create') {
      this.dispatchEvent(
        new CustomEvent('onboarding-create-simulation', { bubbles: true, composed: true }),
      );
    } else if (path === 'browse') {
      this.dispatchEvent(new CustomEvent('onboarding-browse', { bubbles: true, composed: true }));
    }

    // Auto-advance after brief delay
    setTimeout(() => this._goForward(), 300);
  }

  private async _skipAll(): Promise<void> {
    appState.setOnboardingCompleted(true);
    usersApi
      .completeOnboarding()
      .catch((err) => captureError(err, { source: 'VelgOnboardingWizard._skipAll' }));
    this.dispatchEvent(new CustomEvent('onboarding-complete', { bubbles: true, composed: true }));
  }

  // ── Render ──

  protected render() {
    if (!this.open) return nothing;

    const dirClass = this._direction === 'forward' ? 'step--forward' : 'step--backward';

    return html`
      <div class="backdrop">
        <div class="backdrop__noise"></div>
      </div>

      <div class="container" role="dialog" aria-modal="true" aria-label=${msg('Onboarding')}>
        <div class="wizard">
          ${this._renderStepIndicator()}

          <div class="step-content ${dirClass}" key=${this._step}>
            ${this._step === 0 ? this._renderWelcome() : nothing}
            ${this._step === 1 ? this._renderWorlds() : nothing}
            ${this._step === 2 ? this._renderTour() : nothing}
            ${this._step === 3 ? this._renderMission() : nothing}
          </div>

          <div class="footer">
            ${
              this._step > 0
                ? html`
              <button
                class="footer__skip"
                @click=${this._goBackward}
                aria-label=${msg('Go back')}
              >${msg('Back')}</button>
            `
                : html`
              <button
                class="footer__skip"
                @click=${this._skipAll}
                aria-label=${msg('Skip onboarding')}
              >${msg('Skip all')}</button>
            `
            }

            ${
              this._step === 0
                ? html`
              <button class="btn-cta btn-cta--delay-lg" @click=${this._goForward}>
                ${msg("Let's Begin")}
              </button>
            `
                : nothing
            }

            ${
              this._step === 2
                ? html`
              <button class="btn-cta btn-cta--delay-sm" @click=${this._goForward}>
                ${msg('Got It')}
              </button>
            `
                : nothing
            }
          </div>
        </div>
      </div>
    `;
  }

  private _renderStepIndicator() {
    const steps = [0, 1, 2, 3] as const;
    return html`
      <div class="step-indicator" role="progressbar"
        aria-valuenow=${this._step + 1} aria-valuemin=${1} aria-valuemax=${4}
        aria-label=${msg('Onboarding progress')}
      >
        ${steps.map(
          (s, i) => html`
          ${
            i > 0
              ? html`
            <div class="step-connector ${s <= this._step ? 'step-connector--active' : ''}"></div>
          `
              : nothing
          }
          <div class="step-dot ${
            s === this._step ? 'step-dot--active' : s < this._step ? 'step-dot--completed' : ''
          }"></div>
        `,
        )}
      </div>
    `;
  }

  private _renderWelcome() {
    return html`
      <div class="welcome">
        <div class="welcome__glow" aria-hidden="true"></div>
        <div class="welcome__classification">${msg('Classified Briefing // Eyes Only')}</div>
        <h2 class="welcome__title">${msg('Welcome to the Multiverse')}</h2>
        <ul class="welcome__pitch">
          <li>${msg('Build a world with its own agents, buildings, factions, and events.')}</li>
          <li>${msg('Deploy operatives against rival civilizations in competitive epochs.')}</li>
          <li>${msg('Real-world events bleed through the Substrate and reshape every shard.')}</li>
        </ul>
      </div>
    `;
  }

  private _renderWorlds() {
    const paths = [
      {
        id: 'create' as const,
        icon: icons.sparkle(18),
        title: msg('Create a New World'),
        desc: msg('Start with a blank shard and build from scratch.'),
      },
      {
        id: 'browse' as const,
        icon: icons.book(18),
        title: msg('Browse Existing Worlds'),
        desc: msg('Explore flagship simulations and request access.'),
      },
      {
        id: 'skip' as const,
        icon: icons.chevronRight(18),
        title: msg("I'll do this later"),
        desc: msg('Skip for now and head to the dashboard.'),
      },
    ];

    return html`
      <div class="worlds">
        <h2 class="worlds__heading">${msg('Your First World')}</h2>
        <p class="worlds__subtext">${msg('Every agent needs a home base. How would you like to start?')}</p>

        <div class="path-cards" role="radiogroup" aria-label=${msg('Choose your path')}>
          ${paths.map(
            (p, i) => html`
            <div
              class="path-card"
              style="--i: ${i}"
              role="radio"
              tabindex="0"
              aria-selected=${this._selectedPath === p.id ? 'true' : 'false'}
              aria-label=${p.title}
              @click=${() => this._handlePathSelect(p.id)}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._handlePathSelect(p.id);
                }
              }}
            >
              <div class="path-card__icon" aria-hidden="true">${p.icon}</div>
              <div class="path-card__text">
                <div class="path-card__title">${p.title}</div>
                <div class="path-card__desc">${p.desc}</div>
              </div>
              <div class="path-card__arrow" aria-hidden="true">${icons.chevronRight(12)}</div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  private _renderTour() {
    const topics = [
      {
        icon: icons.building(22),
        title: msg('Your Simulation'),
        desc: msg('Agents, buildings, and zones form a living world.'),
      },
      {
        icon: icons.sparkle(22),
        title: msg('The Forge'),
        desc: msg('AI-powered worldbuilding tools shape your reality.'),
      },
      {
        icon: icons.crossedSwords(22),
        title: msg('Epochs'),
        desc: msg('Competitive seasons where civilizations clash.'),
      },
      {
        icon: icons.deploy(22),
        title: msg('Operatives'),
        desc: msg('Spies, saboteurs, and guardians carry out covert missions.'),
      },
      {
        icon: icons.substrateTremor(22),
        title: msg('The Substrate'),
        desc: msg('Real-world events bleed through and reshape every shard.'),
      },
    ];

    return html`
      <div class="tour">
        <h2 class="tour__heading">${msg('Systems Overview')}</h2>
        <p class="tour__subtext">${msg('Five core systems power the multiverse.')}</p>

        <div class="tour-carousel" role="list" aria-label=${msg('Feature overview')}>
          ${topics.map(
            (t, i) => html`
            <div class="tour-card" style="--i: ${i}" role="listitem">
              <div class="tour-card__icon" aria-hidden="true">${t.icon}</div>
              <div class="tour-card__title">${t.title}</div>
              <div class="tour-card__desc">${t.desc}</div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  private _renderMission() {
    return html`
      <div class="mission">
        <h2 class="mission__heading">${msg('First Mission')}</h2>
        <p class="mission__subtext">
          ${msg('Ready to test your strategic instincts? Start a solo training match against 3 AI opponents, or explore the platform at your own pace.')}
        </p>

        <div class="mission-cards">
          <button
            type="button"
            class="mission-card mission-card--primary"
            aria-label=${msg('Start Academy Epoch')}
            @click=${() => this._complete('academy')}
          >
            <div class="mission-card__icon" aria-hidden="true">${icons.crossedSwords(20)}</div>
            <div class="mission-card__text">
              <div class="mission-card__title">${msg('Start Academy Epoch')}</div>
              <div class="mission-card__desc">${msg('Solo training vs 3 AI opponents. Quick match, auto-resolve.')}</div>
            </div>
            <div class="mission-card__arrow" aria-hidden="true">${icons.chevronRight(14)}</div>
          </button>

          <button
            type="button"
            class="mission-card"
            aria-label=${msg('Explore on my own')}
            @click=${() => this._complete('explore')}
          >
            <div class="mission-card__icon" aria-hidden="true">${icons.book(20)}</div>
            <div class="mission-card__text">
              <div class="mission-card__title">${msg('Explore on My Own')}</div>
              <div class="mission-card__desc">${msg('Head to the dashboard and discover at your own pace.')}</div>
            </div>
            <div class="mission-card__arrow" aria-hidden="true">${icons.chevronRight(14)}</div>
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-onboarding-wizard': VelgOnboardingWizard;
  }
}
