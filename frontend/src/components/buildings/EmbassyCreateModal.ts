import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { agentsApi, buildingsApi, embassiesApi, simulationsApi } from '../../services/api/index.js';
import type { Agent, Building, EchoVector, Simulation } from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgBadge.js';

type Step = 'partner' | 'protocol' | 'ambassadors' | 'confirm';

@localized()
@customElement('velg-embassy-create-modal')
export class VelgEmbassyCreateModal extends LitElement {
  static styles = [
    formStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;
      }

      .steps {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      .steps__item {
        padding: var(--space-1) var(--space-3);
        border: var(--border-width-default) solid var(--color-border);
        color: var(--color-text-muted);
      }

      .steps__item--active {
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border-color: var(--color-primary);
      }

      .steps__item--done {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      /* --- Building Preview --- */

      .building-preview {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3);
        border: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-surface);
        margin-top: var(--space-2);
      }

      .building-preview__img {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border: var(--border-width-thin) solid var(--color-border-light);
        flex-shrink: 0;
      }

      .building-preview__placeholder {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
        color: var(--color-text-muted);
        font-size: var(--text-xs);
        flex-shrink: 0;
      }

      .building-preview__info {
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5);
        min-width: 0;
      }

      .building-preview__name {
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .building-preview__type {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        text-transform: capitalize;
      }

      /* --- Ambassador Grid --- */

      .ambassador-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
      }

      @media (max-width: 480px) {
        .ambassador-grid {
          grid-template-columns: 1fr;
        }
      }

      .ambassador-col {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .ambassador-col__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
      }

      .ambassador-col__preview {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 40px;
      }

      .ambassador-col__name {
        font-weight: var(--font-semibold);
        font-size: var(--text-sm);
      }

      .info-banner {
        padding: var(--space-3);
        background: var(--color-primary-bg);
        border: var(--border-width-thin) solid var(--color-primary);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        line-height: var(--leading-relaxed);
        margin-bottom: var(--space-4);
      }

      /* --- Confirm Preview --- */

      .confirm-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-4);
      }

      .confirm-card {
        padding: var(--space-3);
        border: var(--border-default);
        background: var(--color-surface);
      }

      .confirm-card__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        margin-bottom: var(--space-2);
      }

      .confirm-card__name {
        font-weight: var(--font-bold);
        font-size: var(--text-base);
        margin-bottom: var(--space-1);
      }

      .confirm-card__type {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        text-transform: capitalize;
      }

      .confirm-card__ambassador {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-3);
        padding-top: var(--space-2);
        border-top: var(--border-width-thin) solid var(--color-border-light);
      }

      .confirm-card__ambassador-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }

      .confirm-detail {
        margin-top: var(--space-4);
        padding: var(--space-3);
        border: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-surface);
      }

      .confirm-detail__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        margin-bottom: var(--space-1);
      }

      .confirm-detail__value {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }

      .confirm-detail__value--italic {
        font-style: italic;
      }
    `,
  ];

  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) sourceBuilding: Building | null = null;

  @state() private _step: Step = 'partner';
  @state() private _simulations: Simulation[] = [];
  @state() private _targetBuildings: Building[] = [];
  @state() private _targetSimId = '';
  @state() private _targetBuildingId = '';
  @state() private _bleedVector: EchoVector = 'memory';
  @state() private _question = '';
  @state() private _loading = false;

  // Ambassadors
  @state() private _localAgents: Agent[] = [];
  @state() private _partnerAgents: Agent[] = [];
  @state() private _localAmbassadorId = '';
  @state() private _localAmbassadorRole = '';
  @state() private _localAmbassadorQuirk = '';
  @state() private _partnerAmbassadorId = '';
  @state() private _partnerAmbassadorRole = '';
  @state() private _partnerAmbassadorQuirk = '';

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._step = 'partner';
      this._targetSimId = '';
      this._targetBuildingId = '';
      this._bleedVector = 'memory';
      this._question = '';
      this._targetBuildings = [];
      this._localAgents = [];
      this._partnerAgents = [];
      this._localAmbassadorId = '';
      this._localAmbassadorRole = '';
      this._localAmbassadorQuirk = '';
      this._partnerAmbassadorId = '';
      this._partnerAmbassadorRole = '';
      this._partnerAmbassadorQuirk = '';
      this._loadSimulations();
      this._loadLocalAgents();
    }
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private async _loadSimulations(): Promise<void> {
    try {
      const resp = await simulationsApi.listPublic();
      if (resp.success && resp.data) {
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Simulation[] }).data ?? []);
        this._simulations = items.filter((s: Simulation) => s.id !== appState.simulationId.value);
      }
    } catch {
      // fail silently
    }
  }

  private async _loadLocalAgents(): Promise<void> {
    const simId = appState.simulationId.value;
    if (!simId) return;
    try {
      const resp = await agentsApi.list(simId, { limit: '100' });
      if (resp.success && resp.data) {
        this._localAgents = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Agent[] }).data ?? []);
      }
    } catch {
      this._localAgents = [];
    }
  }

  private async _loadTargetBuildings(): Promise<void> {
    if (!this._targetSimId) return;
    try {
      const resp = await buildingsApi.listPublic(this._targetSimId, { limit: '100' });
      if (resp.success && resp.data) {
        const items = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Building[] }).data ?? []);
        // Filter out buildings already used as embassies
        this._targetBuildings = items.filter((b) => b.special_type !== 'embassy');
      }
    } catch {
      this._targetBuildings = [];
    }
  }

  private async _loadPartnerAgents(): Promise<void> {
    if (!this._targetSimId) return;
    try {
      const resp = await agentsApi.listPublic(this._targetSimId, { limit: '100' });
      if (resp.success && resp.data) {
        this._partnerAgents = Array.isArray(resp.data)
          ? resp.data
          : ((resp.data as { data?: Agent[] }).data ?? []);
      }
    } catch {
      this._partnerAgents = [];
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private async _handleTargetSimChange(e: Event): Promise<void> {
    this._targetSimId = (e.target as HTMLSelectElement).value;
    this._targetBuildingId = '';
    this._partnerAmbassadorId = '';
    this._partnerAmbassadorRole = '';
    this._partnerAmbassadorQuirk = '';
    this._partnerAgents = [];
    if (this._targetSimId) {
      await Promise.all([this._loadTargetBuildings(), this._loadPartnerAgents()]);
    }
  }

  private _handleNext(): void {
    const steps: Step[] = ['partner', 'protocol', 'ambassadors', 'confirm'];
    const idx = steps.indexOf(this._step);
    if (idx < steps.length - 1) {
      this._step = steps[idx + 1];
    }
  }

  private _handleBack(): void {
    const steps: Step[] = ['partner', 'protocol', 'ambassadors', 'confirm'];
    const idx = steps.indexOf(this._step);
    if (idx > 0) {
      this._step = steps[idx - 1];
    }
  }

  private async _handleCreate(): Promise<void> {
    if (!this.sourceBuilding || !this._targetSimId || !this._targetBuildingId) return;

    this._loading = true;
    try {
      const simId = appState.simulationId.value;
      if (!simId) return;

      const localAgent = this._localAgents.find((a) => a.id === this._localAmbassadorId);
      const partnerAgent = this._partnerAgents.find((a) => a.id === this._partnerAmbassadorId);

      // Build ambassador metadata — ambassador_a maps to building_a's simulation
      // We send building_a_id = sourceBuilding (local), so ambassador_a = local ambassador
      const embassy_metadata: Record<string, unknown> = {};
      if (localAgent) {
        embassy_metadata.ambassador_a = {
          name: localAgent.name,
          role: this._localAmbassadorRole || undefined,
          quirk: this._localAmbassadorQuirk || undefined,
        };
      }
      if (partnerAgent) {
        embassy_metadata.ambassador_b = {
          name: partnerAgent.name,
          role: this._partnerAmbassadorRole || undefined,
          quirk: this._partnerAmbassadorQuirk || undefined,
        };
      }

      const resp = await embassiesApi.create(simId, {
        building_a_id: this.sourceBuilding.id,
        simulation_a_id: simId,
        building_b_id: this._targetBuildingId,
        simulation_b_id: this._targetSimId,
        bleed_vector: this._bleedVector,
        description: this._question || undefined,
        embassy_metadata: Object.keys(embassy_metadata).length > 0 ? embassy_metadata : undefined,
      });

      if (resp.success) {
        VelgToast.success(msg('Embassy established and activated.'));
        this.dispatchEvent(
          new CustomEvent('embassy-created', { detail: resp.data, bubbles: true, composed: true }),
        );
        this._close();
      } else {
        VelgToast.error(msg('Failed to establish embassy.'));
      }
    } catch {
      VelgToast.error(msg('Failed to establish embassy.'));
    } finally {
      this._loading = false;
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _getSelectedTargetBuilding(): Building | undefined {
    return this._targetBuildings.find((b) => b.id === this._targetBuildingId);
  }

  private _getTargetSimulation(): Simulation | undefined {
    return this._simulations.find((s) => s.id === this._targetSimId);
  }

  private _renderBuildingPreview(building: Building | null | undefined) {
    if (!building) return nothing;
    return html`
      <div class="building-preview">
        ${
          building.image_url
            ? html`<img class="building-preview__img" src=${building.image_url} alt=${building.name} />`
            : html`<div class="building-preview__placeholder">--</div>`
        }
        <div class="building-preview__info">
          <span class="building-preview__name">${building.name}</span>
          <span class="building-preview__type">${building.building_type}</span>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  private _renderSteps() {
    const steps: Step[] = ['partner', 'protocol', 'ambassadors', 'confirm'];
    const labels: Record<Step, string> = {
      partner: msg('Partner'),
      protocol: msg('Protocol'),
      ambassadors: msg('Ambassadors'),
      confirm: msg('Confirm'),
    };
    const currentIdx = steps.indexOf(this._step);
    return html`
      <div class="steps">
        ${steps.map(
          (s, i) => html`
            <span class="steps__item ${s === this._step ? 'steps__item--active' : i < currentIdx ? 'steps__item--done' : ''}">
              ${labels[s]}
            </span>
          `,
        )}
      </div>
    `;
  }

  private _renderPartnerStep() {
    const targetBuilding = this._getSelectedTargetBuilding();
    return html`
      <form class="form" @submit=${(e: Event) => e.preventDefault()}>
        <div class="form__group">
          <label class="form__label">
            ${msg('Target Simulation')}
            ${renderInfoBubble(msg('The partner world this embassy connects to. Each simulation pair can have multiple embassies with different bleed vectors.'))}
          </label>
          <select class="form__select" .value=${this._targetSimId} @change=${this._handleTargetSimChange}>
            <option value="">${msg('Select simulation...')}</option>
            ${this._simulations.map((s) => html`<option value=${s.id}>${s.name}</option>`)}
          </select>
        </div>

        ${
          this._targetSimId
            ? html`
              <div class="form__group">
                <label class="form__label">
                  ${msg('Target Building')}
                  ${renderInfoBubble(msg('The partner building that will house the embassy. Its condition and staffing affect embassy effectiveness.'))}
                </label>
                <select
                  class="form__select"
                  .value=${this._targetBuildingId}
                  @change=${(e: Event) => {
                    this._targetBuildingId = (e.target as HTMLSelectElement).value;
                  }}
                >
                  <option value="">${msg('Select building...')}</option>
                  ${this._targetBuildings.map(
                    (b) => html`<option value=${b.id}>${b.name} (${b.building_type})</option>`,
                  )}
                </select>
                ${this._renderBuildingPreview(targetBuilding)}
              </div>
            `
            : nothing
        }

      </form>
    `;
  }

  private _renderProtocolStep() {
    const vectors: EchoVector[] = [
      'memory',
      'resonance',
      'language',
      'commerce',
      'architecture',
      'dream',
      'desire',
    ];
    return html`
      <form class="form" @submit=${(e: Event) => e.preventDefault()}>
        <div class="form__group">
          <label class="form__label">
            ${msg('Bleed Vector')}
            ${renderInfoBubble(msg('The thematic channel through which reality bleeds. Commerce: trade events. Language: linguistic drift. Memory: traumatic echoes. Resonance: parallel relationships. Architecture: structural influence. Dream: visions. Desire: yearning.'))}
          </label>
          <select
            class="form__select"
            .value=${this._bleedVector}
            @change=${(e: Event) => {
              this._bleedVector = (e.target as HTMLSelectElement).value as EchoVector;
            }}
          >
            ${vectors.map((v) => html`<option value=${v}>${v}</option>`)}
          </select>
        </div>

        <div class="form__group">
          <label class="form__label">
            ${msg('The Question')}
            ${renderInfoBubble(msg('The fundamental existential question this embassy explores. Shapes AI narrative when events bleed through this channel. A well-crafted question produces richer echo narratives.'))}
          </label>
          <textarea
            class="form__textarea"
            rows="3"
            placeholder=${msg('What fundamental question does this embassy ask?')}
            .value=${this._question}
            @input=${(e: Event) => {
              this._question = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </div>

      </form>
    `;
  }

  private _renderAmbassadorsStep() {
    const localAgent = this._localAgents.find((a) => a.id === this._localAmbassadorId);
    const partnerAgent = this._partnerAgents.find((a) => a.id === this._partnerAmbassadorId);
    const currentSimName = appState.currentSimulation.value?.name ?? msg('Local');
    const partnerSimName = this._getTargetSimulation()?.name ?? msg('Partner');

    return html`
      <div class="info-banner">
        ${msg('Ambassadors are agents who represent their simulation at this embassy. Assignment is optional.')}
      </div>

      <div class="ambassador-grid">
        <div class="ambassador-col">
          <span class="ambassador-col__title">${currentSimName}</span>
          <select
            class="form__select"
            .value=${this._localAmbassadorId}
            @change=${(e: Event) => {
              this._localAmbassadorId = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">${msg('No ambassador')}</option>
            ${this._localAgents.map((a) => html`<option value=${a.id}>${a.name}</option>`)}
          </select>
          ${
            localAgent
              ? html`
                <div class="ambassador-col__preview">
                  <velg-avatar
                    name=${localAgent.name}
                    .src=${localAgent.portrait_image_url ?? null}
                    size="sm"
                  ></velg-avatar>
                  <span class="ambassador-col__name">${localAgent.name}</span>
                </div>
              `
              : nothing
          }
          ${
            this._localAmbassadorId
              ? html`
                <input
                  class="form__input"
                  type="text"
                  placeholder=${msg('Role (e.g., Cultural Attaché)')}
                  .value=${this._localAmbassadorRole}
                  @input=${(e: Event) => {
                    this._localAmbassadorRole = (e.target as HTMLInputElement).value;
                  }}
                />
                <input
                  class="form__input"
                  type="text"
                  placeholder=${msg('Quirk (optional)')}
                  .value=${this._localAmbassadorQuirk}
                  @input=${(e: Event) => {
                    this._localAmbassadorQuirk = (e.target as HTMLInputElement).value;
                  }}
                />
              `
              : nothing
          }
        </div>

        <div class="ambassador-col">
          <span class="ambassador-col__title">${partnerSimName}</span>
          <select
            class="form__select"
            .value=${this._partnerAmbassadorId}
            @change=${(e: Event) => {
              this._partnerAmbassadorId = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">${msg('No ambassador')}</option>
            ${this._partnerAgents.map((a) => html`<option value=${a.id}>${a.name}</option>`)}
          </select>
          ${
            partnerAgent
              ? html`
                <div class="ambassador-col__preview">
                  <velg-avatar
                    name=${partnerAgent.name}
                    .src=${partnerAgent.portrait_image_url ?? null}
                    size="sm"
                  ></velg-avatar>
                  <span class="ambassador-col__name">${partnerAgent.name}</span>
                </div>
              `
              : nothing
          }
          ${
            this._partnerAmbassadorId
              ? html`
                <input
                  class="form__input"
                  type="text"
                  placeholder=${msg('Role (e.g., Cultural Attaché)')}
                  .value=${this._partnerAmbassadorRole}
                  @input=${(e: Event) => {
                    this._partnerAmbassadorRole = (e.target as HTMLInputElement).value;
                  }}
                />
                <input
                  class="form__input"
                  type="text"
                  placeholder=${msg('Quirk (optional)')}
                  .value=${this._partnerAmbassadorQuirk}
                  @input=${(e: Event) => {
                    this._partnerAmbassadorQuirk = (e.target as HTMLInputElement).value;
                  }}
                />
              `
              : nothing
          }
        </div>
      </div>

    `;
  }

  private _renderConfirmStep() {
    const target = this._getSelectedTargetBuilding();
    const targetSim = this._getTargetSimulation();
    const currentSimName = appState.currentSimulation.value?.name ?? msg('Local');
    const localAgent = this._localAgents.find((a) => a.id === this._localAmbassadorId);
    const partnerAgent = this._partnerAgents.find((a) => a.id === this._partnerAmbassadorId);

    return html`
      <div class="confirm-grid">
        <div class="confirm-card">
          <div class="confirm-card__label">${currentSimName}</div>
          ${this._renderBuildingPreview(this.sourceBuilding)}
          ${
            localAgent
              ? html`
                <div class="confirm-card__ambassador">
                  <velg-avatar name=${localAgent.name} .src=${localAgent.portrait_image_url ?? null} size="sm"></velg-avatar>
                  <span class="confirm-card__ambassador-name">${localAgent.name}</span>
                  <velg-badge variant="warning">${msg('Ambassador')}</velg-badge>
                </div>
              `
              : nothing
          }
        </div>
        <div class="confirm-card">
          <div class="confirm-card__label">${targetSim?.name ?? msg('Partner')}</div>
          ${this._renderBuildingPreview(target)}
          ${
            partnerAgent
              ? html`
                <div class="confirm-card__ambassador">
                  <velg-avatar name=${partnerAgent.name} .src=${partnerAgent.portrait_image_url ?? null} size="sm"></velg-avatar>
                  <span class="confirm-card__ambassador-name">${partnerAgent.name}</span>
                  <velg-badge variant="warning">${msg('Ambassador')}</velg-badge>
                </div>
              `
              : nothing
          }
        </div>
      </div>

      <div class="confirm-detail">
        <div class="confirm-detail__label">${msg('Bleed Vector')}</div>
        <div class="confirm-detail__value">${this._bleedVector}</div>
      </div>

      ${
        this._question
          ? html`
            <div class="confirm-detail">
              <div class="confirm-detail__label">${msg('The Question')}</div>
              <div class="confirm-detail__value confirm-detail__value--italic">${this._question}</div>
            </div>
          `
          : nothing
      }

    `;
  }

  // ---------------------------------------------------------------------------
  // Footer (centralized, rendered in slot="footer")
  // ---------------------------------------------------------------------------

  private _renderFooter() {
    if (this._step === 'partner') {
      return html`
        <button class="footer__btn footer__btn--cancel" @click=${this._close}>
          ${msg('Cancel')}
        </button>
        <button
          class="footer__btn footer__btn--save"
          ?disabled=${!this._targetSimId || !this._targetBuildingId}
          @click=${this._handleNext}
        >
          ${msg('Next')}
        </button>
      `;
    }
    if (this._step === 'confirm') {
      return html`
        <button class="footer__btn footer__btn--cancel" @click=${this._handleBack}>
          ${msg('Back')}
        </button>
        <button
          class="gen-btn"
          ?disabled=${this._loading}
          @click=${this._handleCreate}
        >
          ${this._loading ? msg('Establishing...') : msg('Establish & Activate')}
        </button>
      `;
    }
    // protocol + ambassadors
    return html`
      <button class="footer__btn footer__btn--cancel" @click=${this._handleBack}>
        ${msg('Back')}
      </button>
      <button class="footer__btn footer__btn--save" @click=${this._handleNext}>
        ${msg('Next')}
      </button>
    `;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  protected render() {
    if (!this.open) return nothing;

    return html`
      <velg-base-modal
        .open=${this.open}
        @modal-close=${this._close}
      >
        <span slot="header">${msg('Establish Embassy')}</span>
        ${this._renderSteps()}
        ${this._step === 'partner' ? this._renderPartnerStep() : nothing}
        ${this._step === 'protocol' ? this._renderProtocolStep() : nothing}
        ${this._step === 'ambassadors' ? this._renderAmbassadorsStep() : nothing}
        ${this._step === 'confirm' ? this._renderConfirmStep() : nothing}
        <div slot="footer">${this._renderFooter()}</div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-embassy-create-modal': VelgEmbassyCreateModal;
  }
}
