import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { echoesApi, eventsApi, simulationsApi } from '../../services/api/index.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type { EventEcho, EventReaction, Event as SimEvent, Simulation } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { panelButtonStyles } from '../shared/panel-button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgBadge.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgSidePanel.js';
import './EchoCard.js';
import './EchoTriggerModal.js';

@localized()
@customElement('velg-event-details-panel')
export class VelgEventDetailsPanel extends LitElement {
  static styles = [
    panelButtonStyles,
    css`
    :host {
      display: block;
      --side-panel-width: 540px;
    }

    .panel__content {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__text {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }

    .panel__text--secondary {
      color: var(--color-text-secondary);
    }

    .panel__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    /* Impact display */
    .panel__impact {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .panel__impact-bar {
      display: flex;
      gap: 3px;
      align-items: flex-end;
      height: 24px;
      flex: 1;
    }

    .panel__impact-segment {
      flex: 1;
      background: var(--color-border-light);
    }

    .panel__impact-segment--active {
      background: var(--color-primary);
    }

    .panel__impact-segment--high {
      background: var(--color-danger);
    }

    .panel__impact-segment--medium {
      background: var(--color-warning);
    }

    .panel__impact-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      min-width: 36px;
      text-align: center;
    }

    /* Tags */
    .panel__tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .panel__tag {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-secondary);
    }

    /* Metadata */
    .panel__kv-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .panel__kv-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-1-5) 0;
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__kv-key {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .panel__kv-value {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      text-align: right;
      word-break: break-word;
    }

    /* Reactions */
    .panel__reactions {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .panel__reaction {
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      user-select: none;
      transition: background var(--transition-fast);
    }

    .panel__reaction-header:hover {
      background: var(--color-surface-header);
    }

    .panel__reaction-chevron {
      flex-shrink: 0;
      color: var(--color-text-muted);
      transition: transform var(--transition-fast);
    }

    .panel__reaction-chevron--open {
      transform: rotate(90deg);
    }

    .panel__reaction-agent {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel__reaction-emotion {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-1-5);
      background: var(--color-surface-header);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    .panel__reaction-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      flex-shrink: 0;
      transition: color var(--transition-fast);
    }

    .panel__reaction-delete:hover {
      color: var(--color-danger);
    }

    .panel__reaction-body {
      padding: 0 var(--space-3) var(--space-3) var(--space-3);
      border-top: var(--border-width-thin) solid var(--color-border-light);
    }

    .panel__reaction-text {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      padding-top: var(--space-2);
    }

    .panel__reaction-empty {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-4);
    }

    .panel__reactions-loading {
      text-align: center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      padding: var(--space-3);
    }

    /* Override: Edit uses neutral style here because Generate is the primary action */
    .panel__btn--edit {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }
  `,
  ];

  @property({ type: Object }) event: SimEvent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _reactions: EventReaction[] = [];
  @state() private _reactionsLoading = false;
  @state() private _generatingReactions = false;
  @state() private _expandedReactions: Set<string> = new Set();
  @state() private _echoes: EventEcho[] = [];
  @state() private _simulations: Simulation[] = [];
  @state() private _echoTriggerOpen = false;

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('event') || changedProperties.has('open')) {
      if (this.open && this.event) {
        this._expandedReactions = new Set();
        this._loadReactions();
        this._loadEchoes();
        this._loadSimulations();
      }
    }
  }

  private async _loadReactions(): Promise<void> {
    if (!this.event || !this.simulationId || !appState.isAuthenticated.value) return;

    this._reactionsLoading = true;
    try {
      const response = await eventsApi.getReactions(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._reactions = response.data;
      } else {
        this._reactions = this.event.reactions ?? [];
      }
    } catch {
      this._reactions = this.event.reactions ?? [];
    } finally {
      this._reactionsLoading = false;
    }
  }

  private async _loadEchoes(): Promise<void> {
    if (!this.event || !this.simulationId) return;

    try {
      const response = await echoesApi.listForEvent(this.simulationId, this.event.id);
      if (response.success && response.data) {
        this._echoes = response.data;
      } else {
        this._echoes = [];
      }
    } catch {
      this._echoes = [];
    }
  }

  private async _loadSimulations(): Promise<void> {
    if (this._simulations.length > 0) return;
    try {
      const response = await simulationsApi.list();
      if (response.success && response.data) {
        const data = response.data;
        this._simulations = Array.isArray(data)
          ? data
          : ((data as { items?: Simulation[] }).items ?? []);
      }
    } catch {
      // Simulations list is optional context
    }
  }

  private _formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  private _getImpactClass(level: number): string {
    if (level >= 8) return 'high';
    if (level >= 5) return 'medium';
    return 'active';
  }

  private _handleEdit(): void {
    this.dispatchEvent(
      new CustomEvent('event-edit', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleDelete(): void {
    this.dispatchEvent(
      new CustomEvent('event-delete', {
        detail: this.event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggleReaction(reactionId: string): void {
    const next = new Set(this._expandedReactions);
    if (next.has(reactionId)) {
      next.delete(reactionId);
    } else {
      next.add(reactionId);
    }
    this._expandedReactions = next;
  }

  private async _handleDeleteReaction(reaction: EventReaction): Promise<void> {
    if (!this.event) return;

    const agentName = reaction.agents?.name ?? reaction.agent_name;
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete reaction'),
      message: msg(str`Delete reaction of ${agentName} to "${this.event.title}"?`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });

    if (!confirmed) return;

    const response = await eventsApi.deleteReaction(this.simulationId, this.event.id, reaction.id);
    if (response.success) {
      this._reactions = this._reactions.filter((r) => r.id !== reaction.id);
      VelgToast.success(msg('Reaction deleted'));
    } else {
      VelgToast.error(response.error?.message ?? msg('Failed to delete reaction'));
    }
  }

  private async _handleGenerateReactions(): Promise<void> {
    if (!this.event || this._generatingReactions) return;
    this._generatingReactions = true;

    try {
      await generationProgress.run('reactions', async (progress) => {
        progress.setStep('prepare', msg('Loading agents...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'generate',
          msg('Generating agent reactions...'),
          msg('This may take a moment'),
        );

        const response = await eventsApi.generateReactions(
          this.simulationId,
          (this.event as SimEvent).id,
        );

        progress.setStep('process', msg('Processing reactions...'));
        await new Promise((r) => setTimeout(r, 200));

        if (response.success && response.data) {
          // Reload to get full data with agent joins
          await this._loadReactions();
          progress.complete(msg(str`${response.data.length} reactions generated`));
          VelgToast.success(msg(str`${response.data.length} agent reactions generated`));
        } else {
          const errMsg = response.error?.message || msg('Reaction generation failed');
          progress.setError(errMsg);
          VelgToast.error(errMsg);
        }
      });
    } catch {
      // handled by GenerationProgressService
    } finally {
      this._generatingReactions = false;
    }
  }

  private _renderImpactBar() {
    if (!this.event) return null;
    const level = this.event.impact_level ?? 1;
    const impactClass = this._getImpactClass(level);

    return html`
      <div class="panel__impact">
        <div class="panel__impact-bar">
          ${Array.from({ length: 10 }, (_, i) => {
            const isActive = i < level;
            const segmentClass = isActive
              ? `panel__impact-segment panel__impact-segment--${impactClass}`
              : 'panel__impact-segment';
            return html`<div class=${segmentClass} style="height: 100%"></div>`;
          })}
        </div>
        <span class="panel__impact-value">${level}</span>
      </div>
    `;
  }

  private _renderMetadata() {
    if (!this.event?.metadata) return null;
    const entries = Object.entries(this.event.metadata);
    if (entries.length === 0) return null;

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Metadata')}</velg-section-header>
        <div class="panel__kv-list">
          ${entries.map(
            ([key, value]) => html`
              <div class="panel__kv-item">
                <span class="panel__kv-key">${key}</span>
                <span class="panel__kv-value">${String(value)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderReactions() {
    if (this._reactionsLoading) {
      return html`<div class="panel__reactions-loading">${msg('Loading reactions...')}</div>`;
    }

    if (this._reactions.length === 0) {
      return html`<div class="panel__reaction-empty">${msg('No reactions yet')}</div>`;
    }

    return html`
      <div class="panel__reactions">
        ${this._reactions.map((reaction) => {
          const isOpen = this._expandedReactions.has(reaction.id);
          const agentName = reaction.agents?.name ?? reaction.agent_name;
          return html`
            <div class="panel__reaction">
              <div
                class="panel__reaction-header"
                @click=${() => this._toggleReaction(reaction.id)}
              >
                <span class="panel__reaction-chevron ${isOpen ? 'panel__reaction-chevron--open' : ''}">
                  ${icons.chevronRight()}
                </span>
                <span class="panel__reaction-agent">${agentName}</span>
                ${
                  reaction.emotion
                    ? html`<span class="panel__reaction-emotion">${reaction.emotion}</span>`
                    : nothing
                }
                <button
                  class="panel__reaction-delete"
                  title=${msg('Delete reaction')}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    this._handleDeleteReaction(reaction);
                  }}
                >
                  ${icons.trash(14)}
                </button>
              </div>
              ${
                isOpen
                  ? html`
                  <div class="panel__reaction-body">
                    <div class="panel__reaction-text">${reaction.reaction_text}</div>
                  </div>
                `
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  private _getSimulationName(simId: string): string {
    const sim = this._simulations.find((s) => s.id === simId);
    return sim?.name ?? simId;
  }

  private _handleTriggerEchoClick(): void {
    this._echoTriggerOpen = true;
  }

  private _handleEchoTriggerClose(): void {
    this._echoTriggerOpen = false;
  }

  private _handleEchoTriggered(): void {
    this._echoTriggerOpen = false;
    this._loadEchoes();
    VelgToast.success(msg('Echo triggered successfully'));
  }

  private _handleEchoClick(e: CustomEvent<EventEcho>): void {
    const echo = e.detail;
    if (echo.target_event) {
      this.dispatchEvent(
        new CustomEvent('event-click', {
          detail: echo.target_event,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _renderBleedProvenance() {
    const evt = this.event;
    if (!evt || evt.data_source !== 'bleed' || !evt.external_refs) return null;

    const refs = evt.external_refs as Record<string, unknown>;
    const sourceSimId = refs.source_simulation_id as string | undefined;
    const echoVector = refs.echo_vector as string | undefined;

    if (!sourceSimId) return null;

    const sourceName = this._getSimulationName(sourceSimId);

    return html`
      <div class="panel__section">
        <velg-section-header>${msg('Bleed Origin')}</velg-section-header>
        <div class="panel__text panel__text--secondary">
          ${msg(str`Originated in ${sourceName}${echoVector ? ` via ${echoVector}` : ''}`)}
        </div>
      </div>
    `;
  }

  private _renderEchoes() {
    return html`
      <div class="panel__section">
        <velg-section-header>
          ${msg(str`Echoes (${this._echoes.length})`)}
        </velg-section-header>

        ${
          this._echoes.length === 0
            ? html`<div class="panel__reaction-empty">${msg('No echoes yet')}</div>`
            : html`
            <div class="panel__reactions">
              ${this._echoes.map(
                (echo) => html`
                  <velg-echo-card
                    .echo=${echo}
                    .simulationName=${this._getSimulationName(echo.target_simulation_id)}
                    @echo-click=${this._handleEchoClick}
                  ></velg-echo-card>
                `,
              )}
            </div>
          `
        }

        ${
          appState.canAdmin.value
            ? html`
            <button
              class="panel__btn panel__btn--edit"
              style="margin-top: var(--space-2);"
              @click=${this._handleTriggerEchoClick}
            >
              ${icons.sparkle()}
              ${msg('Trigger Echo')}
            </button>
          `
            : nothing
        }
      </div>
    `;
  }

  protected render() {
    const evt = this.event;

    return html`
      <velg-side-panel
        .open=${this.open}
        .panelTitle=${evt?.title ?? msg('Event Details')}
      >
        ${
          evt
            ? html`
              <div slot="content">
                <div class="panel__content">
                  <!-- Type & Source badges -->
                  <div class="panel__section">
                    <div class="panel__badges">
                      ${evt.event_type ? html`<velg-badge variant="primary">${evt.event_type}</velg-badge>` : null}
                      ${evt.data_source ? html`<velg-badge variant="info">${evt.data_source}</velg-badge>` : null}
                    </div>
                  </div>

                  <!-- Description -->
                  ${
                    evt.description
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Description')}</velg-section-header>
                        <div class="panel__text">${evt.description}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Occurred At -->
                  ${
                    evt.occurred_at
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Occurred At')}</velg-section-header>
                        <div class="panel__text">${this._formatDate(evt.occurred_at)}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Impact Level -->
                  <div class="panel__section">
                    <velg-section-header>${msg('Impact Level')}</velg-section-header>
                    ${this._renderImpactBar()}
                  </div>

                  <!-- Location -->
                  ${
                    evt.location
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Location')}</velg-section-header>
                        <div class="panel__text">${evt.location}</div>
                      </div>
                    `
                      : null
                  }

                  <!-- Tags -->
                  ${
                    evt.tags && evt.tags.length > 0
                      ? html`
                      <div class="panel__section">
                        <velg-section-header>${msg('Tags')}</velg-section-header>
                        <div class="panel__tags">
                          ${evt.tags.map((tag) => html`<span class="panel__tag">${tag}</span>`)}
                        </div>
                      </div>
                    `
                      : null
                  }

                  <!-- Metadata -->
                  ${this._renderMetadata()}

                  <!-- Reactions -->
                  <div class="panel__section">
                    <velg-section-header>
                      ${msg(str`Reactions (${this._reactions.length})`)}
                    </velg-section-header>
                    ${this._renderReactions()}
                  </div>

                  <!-- Bleed Provenance -->
                  ${this._renderBleedProvenance()}

                  <!-- Echoes -->
                  ${this._renderEchoes()}
                </div>
              </div>

              ${
                appState.canEdit.value
                  ? html`
                <button
                  slot="footer"
                  class="panel__btn panel__btn--generate"
                  @click=${this._handleGenerateReactions}
                  ?disabled=${this._generatingReactions}
                >
                  ${icons.brain()}
                  ${this._generatingReactions ? msg('Generating...') : msg('Generate Reactions')}
                </button>
                <button
                  slot="footer"
                  class="panel__btn panel__btn--edit"
                  @click=${this._handleEdit}
                >
                  ${icons.edit()}
                  ${msg('Edit')}
                </button>
                <button
                  slot="footer"
                  class="panel__btn panel__btn--danger"
                  @click=${this._handleDelete}
                >
                  ${icons.trash()}
                  ${msg('Delete')}
                </button>
              `
                  : nothing
              }
            `
            : html`
              <div slot="content">
                <div class="panel__content">
                  <div class="panel__text panel__text--secondary">${msg('No event selected.')}</div>
                </div>
              </div>
            `
        }
      </velg-side-panel>

      <velg-echo-trigger-modal
        .event=${this.event}
        .simulationId=${this.simulationId}
        .simulations=${this._simulations}
        ?open=${this._echoTriggerOpen}
        @modal-close=${this._handleEchoTriggerClose}
        @echo-triggered=${this._handleEchoTriggered}
      ></velg-echo-trigger-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-details-panel': VelgEventDetailsPanel;
  }
}
