import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface GenerationStep {
  id: string;
  label: string;
}

type StepState = 'pending' | 'active' | 'completed';

@localized()
@customElement('velg-generation-progress')
export class VelgGenerationProgress extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-notification);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.85);
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--duration-slow) var(--ease-out),
        visibility var(--duration-slow) var(--ease-out);
    }

    .overlay--open {
      opacity: 1;
      visibility: visible;
    }

    .container {
      width: 90%;
      max-width: 480px;
      background: var(--color-surface-raised);
      border: var(--border-width-heavy) solid var(--color-gray-1000);
      box-shadow: var(--shadow-xl);
      padding: var(--space-8) var(--space-6);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
      animation: slideIn 0.3s var(--ease-out) forwards;
    }

    .container--error {
      border-color: var(--color-danger);
      animation: slideIn 0.3s var(--ease-out) forwards, shake 0.4s var(--ease-in-out);
    }

    .container--complete {
      border-color: var(--color-success);
    }

    /* --- Spinner --- */

    .spinner {
      position: relative;
      width: 80px;
      height: 80px;
    }

    .spinner__ring {
      width: 80px;
      height: 80px;
      border: 6px solid var(--color-border-light);
      border-top-color: var(--color-gray-1000);
      border-radius: var(--border-radius-full);
      animation: spin 1s linear infinite;
    }

    .spinner__ring--error {
      border-top-color: var(--color-danger);
      animation: spin 2s linear infinite;
    }

    .spinner__ring--complete {
      border-color: var(--color-success);
      border-top-color: var(--color-success);
      animation: none;
    }

    .spinner__icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: bounce 2s infinite;
    }

    .spinner__icon--error {
      animation: none;
    }

    .spinner__icon--complete {
      animation: none;
    }

    .spinner__icon svg {
      width: 28px;
      height: 28px;
      stroke: var(--color-gray-1000);
      stroke-width: 2.5;
      fill: none;
    }

    .spinner__icon--error svg {
      stroke: var(--color-danger);
    }

    .spinner__icon--complete svg {
      stroke: var(--color-success);
    }

    /* --- Title --- */

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      text-align: center;
      color: var(--color-text-primary);
    }

    .title--error {
      color: var(--color-danger);
    }

    .title--complete {
      color: var(--color-success);
    }

    /* --- Progress text --- */

    .progress-text {
      text-align: center;
    }

    .progress-text__main {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .progress-text__main::after {
      content: '';
      animation: dots 1.5s steps(4, end) infinite;
    }

    .progress-text__main--complete::after {
      animation: none;
      content: '';
    }

    .progress-text__sub {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    /* --- Steps --- */

    .steps {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .step {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-1-5) var(--space-2);
      transition: opacity var(--transition-normal), color var(--transition-normal);
    }

    .step--pending {
      opacity: 0.35;
    }

    .step--active {
      opacity: 1;
    }

    .step--completed {
      opacity: 0.6;
    }

    .step__indicator {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step__dot {
      width: 8px;
      height: 8px;
      background: var(--color-border-light);
      border-radius: var(--border-radius-full);
      transition: all var(--transition-normal);
    }

    .step--active .step__dot {
      width: 12px;
      height: 12px;
      background: var(--color-gray-1000);
      animation: pulse 1.5s infinite;
    }

    .step__check {
      width: 18px;
      height: 18px;
      stroke: var(--color-success);
      stroke-width: 3;
      fill: none;
    }

    .step__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
    }

    .step--active .step__label {
      color: var(--color-text-primary);
      font-weight: var(--font-black);
    }

    .step--completed .step__label {
      text-decoration: line-through;
      color: var(--color-text-muted);
    }

    /* --- Progress bar --- */

    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--color-border-light);
    }

    .progress-bar__fill {
      height: 100%;
      background: var(--color-gray-1000);
      transition: width 0.5s var(--ease-out);
    }

    .progress-bar__fill--indeterminate {
      animation: progress 30s linear forwards;
    }

    .progress-bar__fill--complete {
      width: 100% !important;
      background: var(--color-success);
      animation: none;
    }

    .progress-bar__fill--error {
      background: var(--color-danger);
      animation: none;
    }

    /* --- Error --- */

    .error-message {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-danger);
      text-align: center;
      padding: var(--space-3);
      border: var(--border-width-default) solid var(--color-danger);
      background: var(--color-danger-bg);
      width: 100%;
      box-sizing: border-box;
    }

    /* --- Close button --- */

    .close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-medium);
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-fast);
    }

    .close-btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .close-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    /* --- Animations --- */

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }

    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.7; }
    }

    @keyframes progress {
      0% { width: 0%; }
      100% { width: 90%; }
    }

    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: String }) title = msg('Processing...');
  @property({ type: String }) progressText = '';
  @property({ type: String }) subText = '';
  @property({ type: Boolean }) closeable = false;
  @property({ type: String }) error = '';
  @property({ type: Array }) steps: GenerationStep[] = [];
  @property({ type: String }) activeStep = '';

  @state() private _completedSteps: Set<string> = new Set();
  @state() private _isComplete = false;

  show(title: string, steps: GenerationStep[]): void {
    this.title = title;
    this.steps = steps;
    this.activeStep = '';
    this.progressText = '';
    this.subText = '';
    this.error = '';
    this._completedSteps = new Set();
    this._isComplete = false;
    this.open = true;
  }

  setStep(stepId: string, text?: string, subText?: string): void {
    // Mark all previous steps as completed
    const newCompleted = new Set(this._completedSteps);
    for (const step of this.steps) {
      if (step.id === stepId) break;
      newCompleted.add(step.id);
    }
    this._completedSteps = newCompleted;
    this.activeStep = stepId;
    if (text !== undefined) this.progressText = text;
    if (subText !== undefined) this.subText = subText;
    this.error = '';
  }

  setError(message: string): void {
    this.error = message;
    this.closeable = true;
  }

  complete(message?: string): void {
    // Mark all steps as completed
    const allCompleted = new Set<string>();
    for (const step of this.steps) {
      allCompleted.add(step.id);
    }
    this._completedSteps = allCompleted;
    this.activeStep = '';
    this._isComplete = true;
    if (message) this.progressText = message;
    this.subText = '';

    // Auto-hide after a brief delay
    setTimeout(() => this.hide(), 1200);
  }

  hide(): void {
    this.open = false;
  }

  private _getStepState(stepId: string): StepState {
    if (this._completedSteps.has(stepId)) return 'completed';
    if (this.activeStep === stepId) return 'active';
    return 'pending';
  }

  private _getProgressPercent(): number {
    if (this._isComplete) return 100;
    if (this.steps.length === 0) return 0;
    const completedCount = this._completedSteps.size;
    const activeBonus = this.activeStep ? 0.5 : 0;
    return Math.round(((completedCount + activeBonus) / this.steps.length) * 100);
  }

  private _renderCheckIcon() {
    return html`<svg class="step__check" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  }

  private _renderSpinnerIcon() {
    if (this._isComplete) {
      return html`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>`;
    }
    if (this.error) {
      return html`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 9v4" /><path d="M12 17h.01" />
        <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
      </svg>`;
    }
    return html`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 6a6 6 0 0 1 6 6a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6z" />
    </svg>`;
  }

  protected render() {
    const hasError = Boolean(this.error);
    const progressPercent = this._getProgressPercent();

    return html`
      <div class="overlay ${this.open ? 'overlay--open' : ''}">
        <div class="container ${hasError ? 'container--error' : ''} ${this._isComplete ? 'container--complete' : ''}">

          <div class="spinner">
            <div class="spinner__ring ${hasError ? 'spinner__ring--error' : ''} ${this._isComplete ? 'spinner__ring--complete' : ''}"></div>
            <div class="spinner__icon ${hasError ? 'spinner__icon--error' : ''} ${this._isComplete ? 'spinner__icon--complete' : ''}">
              ${this._renderSpinnerIcon()}
            </div>
          </div>

          <div class="title ${hasError ? 'title--error' : ''} ${this._isComplete ? 'title--complete' : ''}">
            ${hasError ? msg('Error') : this.title}
          </div>

          ${
            this.progressText
              ? html`<div class="progress-text">
                <div class="progress-text__main ${this._isComplete ? 'progress-text__main--complete' : ''}">${this.progressText}</div>
                ${this.subText ? html`<div class="progress-text__sub">${this.subText}</div>` : nothing}
              </div>`
              : nothing
          }

          ${
            this.steps.length > 0
              ? html`<div class="steps">
                ${this.steps.map((step) => {
                  const state = this._getStepState(step.id);
                  return html`
                    <div class="step step--${state}">
                      <div class="step__indicator">
                        ${state === 'completed' ? this._renderCheckIcon() : html`<div class="step__dot"></div>`}
                      </div>
                      <span class="step__label">${step.label}</span>
                    </div>
                  `;
                })}
              </div>`
              : nothing
          }

          <div class="progress-bar">
            <div
              class="progress-bar__fill ${hasError ? 'progress-bar__fill--error' : ''} ${this._isComplete ? 'progress-bar__fill--complete' : 'progress-bar__fill--indeterminate'}"
              style="width: ${progressPercent}%"
            ></div>
          </div>

          ${hasError ? html`<div class="error-message">${this.error}</div>` : nothing}

          ${
            this.closeable || hasError
              ? html`<button class="close-btn" @click=${() => this.hide()}>
                ${hasError ? msg('Close') : msg('Cancel')}
              </button>`
              : nothing
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-generation-progress': VelgGenerationProgress;
  }
}
