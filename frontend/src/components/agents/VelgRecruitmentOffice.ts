import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FeaturePurchase } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { VelgToast } from '../shared/Toast.js';

type RecruitState = 'idle' | 'configuring' | 'processing' | 'completed';

@localized()
@customElement('velg-recruitment-office')
export class VelgRecruitmentOffice extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── CTA Panel ── */

    .recruit-cta {
      position: relative;
      margin-top: var(--space-5);
      padding: var(--space-5) var(--space-6);
      border: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
      opacity: 0;
      transform: translateY(12px);
      animation: recruit-enter 400ms ease-out forwards;
    }

    @keyframes recruit-enter {
      to { opacity: 1; transform: translateY(0); }
    }

    .recruit__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .recruit__rule {
      width: 50%;
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 0 0 var(--space-3);
    }

    .recruit__desc {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
      max-width: 50ch;
      margin: 0 0 var(--space-3);
    }

    .recruit__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4);
    }

    .recruit__cost--bypass {
      color: var(--color-success);
    }

    .recruit__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-surface-sunken);
      background: var(--color-accent-amber);
      border: 1px solid var(--color-accent-amber);
      cursor: pointer;
      transition: all 0.2s;
      min-height: 44px;
    }

    .recruit__btn:hover:not(:disabled) {
      box-shadow: 0 0 16px var(--color-warning-glow);
      transform: translateY(-1px);
    }

    .recruit__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .recruit__btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .recruit__btn--ghost {
      background: transparent;
      border-color: var(--color-border);
      color: var(--color-text-secondary);
    }

    .recruit__btn--ghost:hover:not(:disabled) {
      border-color: var(--color-text-secondary);
      color: var(--color-text-primary);
      box-shadow: none;
      transform: none;
    }

    /* ── Config Form ── */

    .config {
      margin-top: var(--space-5);
      padding: var(--space-5) var(--space-6);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      background: var(--color-surface-sunken);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      animation: recruit-enter 300ms ease-out forwards;
      opacity: 0;
    }

    .config__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-primary);
      margin: 0;
    }

    .config__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .config__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    .config__textarea {
      width: 100%;
      min-height: 60px;
      padding: var(--space-2);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      resize: vertical;
      box-sizing: border-box;
    }

    .config__textarea:focus {
      outline: none;
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 0 1px var(--color-warning-glow);
    }

    .config__select {
      padding: var(--space-2);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }

    .config__select:focus {
      outline: none;
      border-color: var(--color-accent-amber);
    }

    .config__cost {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
    }

    .config__cost--bypass {
      color: var(--color-success);
    }

    .config__actions {
      display: flex;
      gap: var(--space-3);
    }

    .config__charcount {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      text-align: right;
    }

    /* ── Processing State ── */

    .processing {
      margin-top: var(--space-5);
      padding: var(--space-5) var(--space-6);
      border: 1px solid color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      background: var(--color-surface-sunken);
    }

    .processing__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4);
    }

    .processing__cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
    }

    .recruit-card {
      position: relative;
      aspect-ratio: 3/4;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      overflow: hidden;
    }

    .recruit-card--pending {
      opacity: 0;
      animation: card-appear 400ms ease-out forwards;
    }

    @keyframes card-appear {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .recruit-card__scan {
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: var(--color-accent-amber);
      opacity: 0.6;
      animation: scan-sweep 2s ease-in-out infinite;
    }

    @keyframes scan-sweep {
      0% { left: 0; }
      50% { left: calc(100% - 2px); }
      100% { left: 0; }
    }

    .recruit-card__label {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    .recruit-card--done {
      opacity: 0;
      animation: card-flip 600ms ease forwards;
      border-color: var(--color-accent-amber);
    }

    @keyframes card-flip {
      0% { opacity: 0; transform: rotateY(90deg); }
      50% { opacity: 1; transform: rotateY(0); }
      100% { opacity: 1; transform: rotateY(0); }
    }

    .recruit-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-primary);
      text-align: center;
      padding: 0 var(--space-2);
    }

    .recruit-card__status {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-success);
    }

    /* ── Completion Banner ── */

    .completion {
      margin-top: var(--space-5);
      padding: var(--space-4) var(--space-6);
      border: 1px solid var(--color-success);
      background: color-mix(in srgb, var(--color-success) 5%, var(--color-surface-sunken));
      animation: recruit-enter 400ms ease-out forwards;
      opacity: 0;
    }

    .completion__text {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-success);
      margin: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .recruit-cta,
      .config,
      .completion,
      .recruit-card--pending,
      .recruit-card--done {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .recruit-card__scan {
        animation: none;
        display: none;
      }
    }

    @media (max-width: 480px) {
      .recruit-cta,
      .config,
      .processing,
      .completion {
        padding: var(--space-4);
      }

      .processing__cards {
        grid-template-columns: 1fr;
      }

      .config__actions {
        flex-direction: column;
      }

      .recruit__btn {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Array }) zones: Array<{ id: string; name: string }> = [];
  @property({ type: Number }) walletBalance = 0;
  @property({ type: Boolean }) hasBypass = false;

  @state() private _state: RecruitState = 'idle';
  @state() private _focus = '';
  @state() private _zoneId = '';
  @state() private _cardsCompleted = 0;

  private _openConfig(): void {
    this._state = 'configuring';
  }

  private _cancelConfig(): void {
    this._state = 'idle';
    this._focus = '';
    this._zoneId = '';
  }

  private async _authorize(): Promise<void> {
    this._state = 'processing';
    this._cardsCompleted = 0;

    const options: { focus?: string; zoneId?: string } = {};
    if (this._focus.trim()) options.focus = this._focus.trim();
    if (this._zoneId) options.zoneId = this._zoneId;

    const purchaseId = await forgeStateManager.purchaseFeature(
      this.simulationId,
      'recruitment',
      options,
    );

    if (!purchaseId) {
      VelgToast.error(forgeStateManager.error.value ?? msg('Recruitment authorization failed.'));
      this._state = 'idle';
      return;
    }

    const result = await forgeStateManager.awaitFeatureCompletion(
      purchaseId,
      (p: FeaturePurchase) => {
        if (p.status === 'processing') {
          const elapsed = Date.now() - new Date(p.created_at).getTime();
          this._cardsCompleted = Math.min(2, Math.floor(elapsed / 10000));
        }
      },
    );

    if (result?.status === 'completed') {
      this._cardsCompleted = 3;
      VelgToast.success(msg('3 recruits have reported for duty.'));
      this._state = 'completed';
      // Give time for completion animation, then signal parent to refresh
      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent('recruitment-complete', { bubbles: true, composed: true }),
        );
      }, 1500);
    } else if (result?.status === 'failed' || result?.status === 'refunded') {
      VelgToast.error(msg('Recruitment failed. Tokens refunded.'));
      this._state = 'idle';
    } else {
      VelgToast.error(msg('Recruitment timed out. Check back later.'));
      this._state = 'idle';
    }
  }

  protected render() {
    switch (this._state) {
      case 'idle':
        return this._renderCTA();
      case 'configuring':
        return this._renderConfig();
      case 'processing':
        return this._renderProcessing();
      case 'completed':
        return this._renderCompletion();
    }
  }

  private _renderCTA() {
    const cost = this.hasBypass ? 0 : 1;
    const canAfford = this.hasBypass || this.walletBalance >= cost;

    return html`
      <div class="recruit-cta" role="region" aria-label=${msg('Bureau recruitment authorization')}>
        <h3 class="recruit__title">${msg('Bureau Recruitment Authorization')}</h3>
        <hr class="recruit__rule" />

        <p class="recruit__desc">
          ${msg('Authorize the deployment of 3 new agents into this simulation. Optional focus directive and zone assignment available.')}
        </p>

        <p class="recruit__cost ${this.hasBypass ? 'recruit__cost--bypass' : ''}">
          ${this.hasBypass ? msg('BYOK: NO COST') : msg('AUTHORIZATION COST: 1 FT')}
        </p>

        <button
          class="recruit__btn"
          ?disabled=${!canAfford}
          @click=${this._openConfig}
          aria-label=${msg('Begin recruitment process')}
        >
          ${msg('BEGIN RECRUITMENT PROCESS')}
        </button>
      </div>
    `;
  }

  private _renderConfig() {
    const cost = this.hasBypass ? 0 : 1;
    const canAfford = this.hasBypass || this.walletBalance >= cost;

    return html`
      <div class="config">
        <h3 class="config__title">${msg('Recruitment Directive')}</h3>

        <div class="config__field">
          <label class="config__label">${msg('Focus directive (optional)')}</label>
          <textarea
            class="config__textarea"
            maxlength="200"
            placeholder=${msg('Describe the type of agents you want...')}
            .value=${this._focus}
            @input=${(e: Event) => {
              this._focus = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          <span class="config__charcount">${this._focus.length}/200</span>
        </div>

        ${
          this.zones.length > 0
            ? html`
            <div class="config__field">
              <label class="config__label">${msg('Target zone (optional)')}</label>
              <select
                class="config__select"
                .value=${this._zoneId}
                @change=${(e: Event) => {
                  this._zoneId = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="">${msg('Any zone')}</option>
                ${this.zones.map((z) => html`<option value=${z.id}>${z.name}</option>`)}
              </select>
            </div>
          `
            : nothing
        }

        <p class="config__cost ${this.hasBypass ? 'config__cost--bypass' : ''}">
          ${this.hasBypass ? msg('BYOK: NO COST') : msg('COST: 1 FT')}
        </p>

        <div class="config__actions">
          <button class="recruit__btn recruit__btn--ghost" @click=${this._cancelConfig}>
            ${msg('CANCEL')}
          </button>
          <button
            class="recruit__btn"
            ?disabled=${!canAfford}
            @click=${this._authorize}
          >
            ${msg('AUTHORIZE RECRUITMENT')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderProcessing() {
    const labels = [msg('RECRUIT ALPHA'), msg('RECRUIT BETA'), msg('RECRUIT GAMMA')];

    return html`
      <div class="processing" role="status" aria-live="polite">
        <h3 class="processing__title">${msg('PROCESSING RECRUITMENT...')}</h3>
        <div class="processing__cards">
          ${labels.map((label, i) => {
            const done = i < this._cardsCompleted;
            return html`
              <div
                class="recruit-card ${done ? 'recruit-card--done' : 'recruit-card--pending'}"
                style="animation-delay: ${done ? i * 200 : i * 300}ms"
              >
                ${
                  done
                    ? html`
                    <span class="recruit-card__name">${label}</span>
                    <span class="recruit-card__status">${msg('DEPLOYED')}</span>
                  `
                    : html`
                    <div class="recruit-card__scan"></div>
                    <span class="recruit-card__label">${msg('PROCESSING DOSSIER...')}</span>
                  `
                }
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _renderCompletion() {
    return html`
      <div class="completion">
        <p class="completion__text">${msg('3 RECRUITS HAVE ARRIVED')}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-recruitment-office': VelgRecruitmentOffice;
  }
}
