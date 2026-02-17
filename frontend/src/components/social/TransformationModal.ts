import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { socialTrendsApi } from '../../services/api/index.js';
import type { BrowseArticle } from '../../services/api/SocialTrendsApiService.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import type { SocialTrend } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/BaseModal.js';

type Step = 'preview' | 'transform' | 'integrate';

@localized()
@customElement('velg-transformation-modal')
export class VelgTransformationModal extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .wizard {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    /* Step indicator */
    .wizard__steps {
      display: flex;
      gap: 0;
      border: var(--border-default);
    }

    .wizard__step {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1-5);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-sunken);
      color: var(--color-text-muted);
      border-right: var(--border-width-thin) solid var(--color-border);
    }

    .wizard__step:last-child {
      border-right: none;
    }

    .wizard__step--active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .wizard__step--done {
      background: var(--color-success-bg);
      color: var(--color-success);
    }

    .wizard__step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      border: var(--border-width-default) solid currentColor;
    }

    /* Content sections */
    .wizard__section {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .wizard__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .wizard__original {
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border-light);
      font-size: var(--text-sm);
      line-height: 1.5;
    }

    .wizard__original-title {
      font-weight: var(--font-bold);
      margin-bottom: var(--space-1);
    }

    .wizard__original-meta {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-1);
    }

    .wizard__result {
      padding: var(--space-3);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      font-size: var(--text-sm);
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .wizard__model-info {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    /* Form fields for integrate step */
    .wizard__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .wizard__form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .wizard__form-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .wizard__form-label--required::after {
      content: ' *';
      color: var(--color-danger);
    }

    .wizard__form-input,
    .wizard__form-select,
    .wizard__form-textarea {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .wizard__form-input:focus,
    .wizard__form-select:focus,
    .wizard__form-textarea:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .wizard__form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .wizard__form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .wizard__form-checkbox {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }

    .wizard__form-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .wizard__form-range-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .wizard__error {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-danger);
    }

    /* Footer */
    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
    }

    .footer__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .footer__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .footer__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .footer__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .footer__btn--cancel {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
    }

    .footer__btn--save {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }
  `;

  @property({ type: Object }) trend?: SocialTrend;
  @property({ type: Object }) article?: BrowseArticle;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _step: Step = 'preview';
  @state() private _loading = false;
  @state() private _error: string | null = null;

  // Transform result
  @state() private _transformedContent = '';
  @state() private _modelUsed = '';

  // Integrate form
  @state() private _eventTitle = '';
  @state() private _eventDescription = '';
  @state() private _eventType = 'news';
  @state() private _impactLevel = 5;

  // Reaction generation (ephemeral articles)
  @state() private _generateReactions = true;
  @state() private _reactionAgents = 20;

  get _isEphemeral(): boolean {
    return !!this.article && !this.trend;
  }

  private get _articleName(): string {
    return this._isEphemeral
      ? (this.article as BrowseArticle).name
      : (this.trend as SocialTrend).name;
  }

  private get _articlePlatform(): string {
    return this._isEphemeral
      ? (this.article as BrowseArticle).platform
      : (this.trend as SocialTrend).platform;
  }

  private get _articleUrl(): string | undefined {
    return this._isEphemeral
      ? (this.article as BrowseArticle).url
      : (this.trend as SocialTrend).url;
  }

  private get _articleRawData(): Record<string, unknown> | undefined {
    return this._isEphemeral
      ? (this.article as BrowseArticle).raw_data
      : ((this.trend as SocialTrend).raw_data as Record<string, unknown> | undefined);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._resetWizard();
    }
  }

  private _stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  private _extractTitle(content: string): string {
    const lines = content.split('\n').filter((l) => l.trim());
    const first = lines[0] || '';
    return first
      .replace(/^\*\*(?:Titel|Title):\*\*\s*/i, '')
      .replace(/\*\*/g, '')
      .trim();
  }

  private _cleanContent(content: string): string {
    let cleaned = content;
    cleaned = cleaned.replace(/```json[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/^---\s*$/gm, '');
    cleaned = cleaned.replace(/^\s*\*\*(?:Titel|Title):\*\*\s*[^\n]*\n?/i, '');
    cleaned = cleaned.replace(/^\s*\*\*(?:Artikel|Article):\*\*\s*\n?/im, '');
    cleaned = cleaned
      .replace(
        /(\n\s*\*\*(?:Titel|Title|Autor|Author|Datum|Date|Quelle|Source|Veröffentlichungsdatum|Publication Date|Schlagwörter|Tags|Keywords):\*\*.*)+$/i,
        '',
      )
      .trim();
    return cleaned;
  }

  private _resetWizard(): void {
    this._step = 'preview';
    this._loading = false;
    this._error = null;
    this._transformedContent = '';
    this._modelUsed = '';
    this._eventTitle = '';
    this._eventDescription = '';
    this._eventType = 'news';
    this._impactLevel = 5;
    this._generateReactions = true;
    this._reactionAgents = 20;
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private async _handleTransform(): Promise<void> {
    this._error = null;

    try {
      await generationProgress.run('transform', async (progress) => {
        progress.setStep('prepare', msg('Preparing request...'));
        await new Promise((r) => setTimeout(r, 300));

        progress.setStep(
          'transform',
          msg('AI transforming article...'),
          msg('This may take a moment'),
        );

        let response: Awaited<
          ReturnType<typeof socialTrendsApi.transform | typeof socialTrendsApi.transformArticle>
        >;

        if (this._isEphemeral) {
          response = await socialTrendsApi.transformArticle(this.simulationId, {
            article_name: this._articleName,
            article_platform: this._articlePlatform,
            article_url: this._articleUrl,
            article_raw_data: this._articleRawData,
          });
        } else {
          response = await socialTrendsApi.transform(this.simulationId, {
            trend_id: (this.trend as SocialTrend).id,
          });
        }

        progress.setStep('process', msg('Processing result...'));
        await new Promise((r) => setTimeout(r, 200));

        if (response.success && response.data) {
          const data = response.data as {
            transformation?: {
              content?: string;
              narrative?: string;
              title?: string;
              description?: string;
              event_type?: string;
              impact_level?: number;
              model_used?: string;
            };
          };
          const t = data.transformation;

          this._transformedContent = t?.narrative || this._cleanContent(t?.content || '');
          this._modelUsed = t?.model_used || '';
          this._eventTitle = t?.title || this._extractTitle(t?.content || '') || this._articleName;
          this._eventDescription = t?.description || this._transformedContent;
          if (t?.event_type) this._eventType = t.event_type;
          if (t?.impact_level) this._impactLevel = t.impact_level;

          this._step = 'transform';
          progress.complete(msg('Transformation complete'));
        } else {
          const errMsg = response.error?.message || msg('Transformation failed');
          progress.setError(errMsg);
          this._error = errMsg;
        }
      });
    } catch {
      // Error already shown by GenerationProgressService
    }
  }

  private _handleProceedToIntegrate(): void {
    this._step = 'integrate';
  }

  private async _handleIntegrate(): Promise<void> {
    if (!this._eventTitle.trim()) {
      this._error = msg('Title is required');
      return;
    }

    this._loading = true;
    this._error = null;

    if (this._isEphemeral) {
      const response = await socialTrendsApi.integrateArticle(this.simulationId, {
        title: this._eventTitle.trim(),
        description: this._eventDescription.trim() || undefined,
        event_type: this._eventType,
        impact_level: this._impactLevel,
        tags: [this._articlePlatform],
        generate_reactions: this._generateReactions,
        max_reaction_agents: this._reactionAgents,
        source_article: {
          name: this._articleName,
          platform: this._articlePlatform,
          url: this._articleUrl,
          raw_data: this._articleRawData,
        },
      });

      if (response.success && response.data) {
        const result = response.data;
        if (this._generateReactions && result.reactions_count > 0) {
          VelgToast.success(msg(str`Event created with ${result.reactions_count} agent reactions`));
        } else {
          VelgToast.success(msg('Event created from trend'));
        }
        this.dispatchEvent(
          new CustomEvent('transform-complete', {
            detail: result.event,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message || msg('Integration failed');
        VelgToast.error(this._error);
      }
    } else {
      const response = await socialTrendsApi.integrate(this.simulationId, {
        trend_id: (this.trend as SocialTrend).id,
        title: this._eventTitle.trim(),
        description: this._eventDescription.trim() || undefined,
        event_type: this._eventType,
        impact_level: this._impactLevel,
        tags: [(this.trend as SocialTrend).platform],
      });

      if (response.success) {
        VelgToast.success(msg('Event created from trend'));
        this.dispatchEvent(
          new CustomEvent('transform-complete', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message || msg('Integration failed');
        VelgToast.error(this._error);
      }
    }

    this._loading = false;
  }

  private _getStepClass(step: Step): string {
    const steps: Step[] = ['preview', 'transform', 'integrate'];
    const current = steps.indexOf(this._step);
    const target = steps.indexOf(step);
    if (target === current) return 'wizard__step--active';
    if (target < current) return 'wizard__step--done';
    return '';
  }

  private _getEventTypeTaxonomies() {
    return appState.getTaxonomiesByType('event_type');
  }

  private _renderPreview() {
    const raw = this._articleRawData as Record<string, string> | undefined;
    return html`
      <div class="wizard__section">
        <div class="wizard__label">${msg('Original Article')}</div>
        <div class="wizard__original">
          <div class="wizard__original-title">${this._articleName}</div>
          ${
            raw?.trail_text || raw?.description
              ? html`<div>${this._stripHtml(raw.trail_text || raw.description)}</div>`
              : nothing
          }
          <div class="wizard__original-meta">
            ${this._articlePlatform}
            ${raw?.byline || raw?.author ? html` &mdash; ${raw.byline || raw.author}` : nothing}
            ${this._articleUrl ? html` &mdash; <a href=${this._articleUrl} target="_blank" rel="noopener">${this._articleUrl}</a>` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private _renderTransformResult() {
    return html`
      ${this._renderPreview()}
      <div class="wizard__section">
        <div class="wizard__label">${msg('Transformed')}</div>
        <div class="wizard__result">${this._cleanContent(this._transformedContent)}</div>
        ${
          this._modelUsed
            ? html`<div class="wizard__model-info">${msg(str`Model: ${this._modelUsed}`)}</div>`
            : nothing
        }
      </div>
    `;
  }

  private _renderIntegrateForm() {
    const eventTypes = this._getEventTypeTaxonomies();

    return html`
      <div class="wizard__form">
        <div class="wizard__form-group">
          <label class="wizard__form-label wizard__form-label--required">${msg('Event Title')}</label>
          <input
            class="wizard__form-input"
            type="text"
            .value=${this._eventTitle}
            @input=${(e: InputEvent) => {
              this._eventTitle = (e.target as HTMLInputElement).value;
            }}
            placeholder=${msg('Title for the new event')}
          />
        </div>

        <div class="wizard__form-group">
          <label class="wizard__form-label">${msg('Description')}</label>
          <textarea
            class="wizard__form-textarea"
            .value=${this._eventDescription}
            @input=${(e: InputEvent) => {
              this._eventDescription = (e.target as HTMLTextAreaElement).value;
            }}
            placeholder=${msg('Event description (pre-filled from transformation)')}
          ></textarea>
        </div>

        <div class="wizard__form-row">
          <div class="wizard__form-group">
            <label class="wizard__form-label">${msg('Event Type')}</label>
            <select
              class="wizard__form-select"
              .value=${this._eventType}
              @change=${(e: Event) => {
                this._eventType = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="news">${msg('News')}</option>
              ${eventTypes.map(
                (t) => html`<option value=${t.value}>${t.label?.en ?? t.value}</option>`,
              )}
            </select>
          </div>

          <div class="wizard__form-group">
            <label class="wizard__form-label">${msg(str`Impact Level (${this._impactLevel}/10)`)}</label>
            <input
              class="wizard__form-input"
              type="range"
              min="1"
              max="10"
              step="1"
              .value=${String(this._impactLevel)}
              @input=${(e: InputEvent) => {
                this._impactLevel = Number((e.target as HTMLInputElement).value);
              }}
            />
          </div>
        </div>

        ${this._isEphemeral ? this._renderReactionOptions() : nothing}
      </div>
    `;
  }

  private _renderReactionOptions() {
    return html`
      <div class="wizard__form-group">
        <label class="wizard__form-checkbox">
          <input
            type="checkbox"
            .checked=${this._generateReactions}
            @change=${(e: Event) => {
              this._generateReactions = (e.target as HTMLInputElement).checked;
            }}
          />
          <span class="wizard__form-label">${msg('Generate agent reactions')}</span>
        </label>
      </div>

      ${
        this._generateReactions
          ? html`
          <div class="wizard__form-group">
            <div class="wizard__form-range-label">
              <label class="wizard__form-label">${msg('Number of agents')}</label>
              <span class="wizard__form-label">${this._reactionAgents}/50</span>
            </div>
            <input
              class="wizard__form-input"
              type="range"
              min="1"
              max="50"
              step="1"
              .value=${String(this._reactionAgents)}
              @input=${(e: InputEvent) => {
                this._reactionAgents = Number((e.target as HTMLInputElement).value);
              }}
            />
          </div>
        `
          : nothing
      }
    `;
  }

  private _renderStepContent() {
    switch (this._step) {
      case 'preview':
        return this._renderPreview();
      case 'transform':
        return this._renderTransformResult();
      case 'integrate':
        return this._renderIntegrateForm();
    }
  }

  private _renderFooterButtons() {
    switch (this._step) {
      case 'preview':
        return html`
          <button class="footer__btn footer__btn--cancel" @click=${this._handleClose}>${msg('Cancel')}</button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleTransform}
          >
            ${msg('Transform')}
          </button>
        `;
      case 'transform':
        return html`
          <button class="footer__btn footer__btn--cancel" @click=${this._handleClose}>${msg('Cancel')}</button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleTransform}
          >
            ${msg('Re-Transform')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleProceedToIntegrate}
          >
            ${msg('Create Event')}
          </button>
        `;
      case 'integrate':
        return html`
          <button
            class="footer__btn footer__btn--cancel"
            @click=${() => {
              this._step = 'transform';
            }}
          >
            ${msg('Back')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleIntegrate}
            ?disabled=${this._loading}
          >
            ${this._loading ? msg('Creating...') : msg('Save as Event')}
          </button>
        `;
    }
  }

  protected render() {
    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${msg('News → Event')}</span>

        <div class="wizard">
          <div class="wizard__steps">
            <div class="wizard__step ${this._getStepClass('preview')}">
              <span class="wizard__step-number">1</span> ${msg('Preview')}
            </div>
            <div class="wizard__step ${this._getStepClass('transform')}">
              <span class="wizard__step-number">2</span> ${msg('Transform')}
            </div>
            <div class="wizard__step ${this._getStepClass('integrate')}">
              <span class="wizard__step-number">3</span> ${msg('Event')}
            </div>
          </div>

          ${this._renderStepContent()}

          ${this._error ? html`<div class="wizard__error">${this._error}</div>` : nothing}
        </div>

        <div slot="footer" class="footer">
          ${this._renderFooterButtons()}
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-transformation-modal': VelgTransformationModal;
  }
}
