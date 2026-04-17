import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { socialTrendsApi } from '../../services/api/index.js';
import type { BrowseArticle } from '../../services/api/SocialTrendsApiService.js';
import { generationProgress } from '../../services/GenerationProgressService.js';
import { captureError } from '../../services/SentryService.js';
import type { SocialTrend } from '../../types/index.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { VelgToast } from '../shared/Toast.js';

type Step = 'preview' | 'transform' | 'integrate';

@localized()
@customElement('velg-transformation-modal')
export class VelgTransformationModal extends LitElement {
  static styles = [
    formStyles,
    css`
    :host {
      display: block;
    }

    /* Widen modal for split-screen on transform step */
    :host([data-step="transform"]) velg-base-modal {
      --modal-max-width: 880px;
    }

    .crucible {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    /* ======================================== */
    /* PIPELINE — [REALITY] ──▶ [CRUCIBLE] ──▶ [EVENT] */
    /* ======================================== */
    .pipeline {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .pipeline__step {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1-5);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-surface-sunken);
      color: var(--color-text-muted);
      border: var(--border-width-default) solid var(--color-border);
      transition: all var(--duration-normal, 200ms);
      white-space: nowrap;
    }

    .pipeline__step--active {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
      box-shadow: 0 0 0 1px var(--color-primary), 0 0 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    .pipeline__step--done {
      background: var(--color-surface-raised);
      color: var(--color-success);
      border-color: var(--color-success);
    }

    .pipeline__arrow {
      display: flex;
      align-items: center;
      padding: 0 var(--space-1);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      letter-spacing: -1px;
      flex-shrink: 0;
    }

    .pipeline__arrow--active {
      color: var(--color-primary);
      animation: arrow-pulse 2s ease-in-out infinite;
    }

    @keyframes arrow-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @media (prefers-reduced-motion: reduce) {
      .pipeline__arrow--active {
        animation: none;
      }
    }

    /* ======================================== */
    /* CLIPPING — Newspaper / reality aesthetic */
    /* ======================================== */
    .clipping {
      position: relative;
      padding: var(--space-5) var(--space-5) var(--space-4);
      background: color-mix(in srgb, var(--color-surface-raised) 90%, var(--color-warning));
      border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      box-shadow: 2px 3px 0 color-mix(in srgb, var(--color-border) 30%, transparent);
      transform: rotate(-0.8deg);
      transition: transform var(--duration-normal, 200ms);
    }

    .clipping--compact {
      padding: var(--space-3) var(--space-4);
      transform: rotate(-0.5deg);
    }

    .clipping::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--color-text-primary);
      opacity: 0.7;
    }

    .clipping__headline {
      font-family: var(--font-body);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      line-height: 1.2;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
    }

    .clipping--compact .clipping__headline {
      font-size: var(--text-md);
      margin-bottom: var(--space-1);
    }

    .clipping__body {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: 1.65;
      color: var(--color-text-secondary);
    }

    .clipping__byline {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-1);
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      font-family: var(--font-body);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-style: italic;
    }

    .clipping__byline-platform {
      font-style: normal;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      font-family: var(--font-brutalist);
      font-size: 10px;
      color: var(--color-text-secondary);
    }

    .clipping__byline a {
      color: var(--color-text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    /* ======================================== */
    /* SPLIT-SCREEN — Crucible transform view  */
    /* ======================================== */
    .crucible__split {
      display: grid;
      grid-template-columns: 1fr 2px 1fr;
      gap: 0;
      min-height: 220px;
    }

    @media (max-width: 640px) {
      .crucible__split {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .crucible__divider {
        display: none;
      }
    }

    .crucible__panel {
      padding: var(--space-3);
      overflow-y: auto;
      max-height: 360px;
    }

    .crucible__panel-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .crucible__panel-label--sim {
      color: var(--color-success);
    }

    /* Center divider with scan animation */
    .crucible__divider {
      position: relative;
      width: 2px;
      background: var(--color-border);
      overflow: hidden;
    }

    .crucible__divider--active::after {
      content: '';
      position: absolute;
      top: 0;
      left: -1px;
      width: 4px;
      height: 40px;
      background: var(--color-success);
      box-shadow: 0 0 8px var(--color-success), 0 0 16px color-mix(in srgb, var(--color-success) 40%, transparent);
      animation: scan-sweep-v 2s ease-in-out infinite;
    }

    @keyframes scan-sweep-v {
      0% { top: -40px; opacity: 1; }
      100% { top: calc(100% + 40px); opacity: 0.4; }
    }

    @media (prefers-reduced-motion: reduce) {
      .crucible__divider--active::after {
        animation: none;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.6;
      }
    }

    /* Simulation output panel */
    .crucible__output {
      position: relative;
      padding: var(--space-3);
      background: color-mix(in srgb, var(--color-success) 3%, var(--color-surface-sunken));
      border: var(--border-width-default) solid color-mix(in srgb, var(--color-success) 20%, var(--color-border));
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      line-height: 1.65;
      white-space: pre-wrap;
      color: var(--color-text-primary);
    }

    /* CRT scanline overlay on simulation panel */
    .crucible__output::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 3px,
        color-mix(in srgb, var(--color-success) 2%, transparent) 3px,
        color-mix(in srgb, var(--color-success) 2%, transparent) 4px
      );
      pointer-events: none;
      z-index: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .crucible__output::before {
        display: none;
      }
    }

    /* Waiting state — blinking cursor */
    .crucible__cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background: var(--color-success);
      vertical-align: text-bottom;
      animation: cursor-blink 0.8s steps(1) infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .crucible__cursor {
        animation: none;
        opacity: 0.7;
      }
    }

    .crucible__waiting {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4);
    }

    /* ======================================== */
    /* INTEGRATE FORM — Simulation aesthetic    */
    /* ======================================== */
    .crucible__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      border: var(--border-width-thin) solid var(--color-border-light);
      padding: var(--space-4);
      background: var(--color-surface-sunken);
    }

    .crucible__form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .crucible__form-label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .crucible__form-label--required::after {
      content: ' *';
      color: var(--color-danger);
    }

    .crucible__form-input,
    .crucible__form-select,
    .crucible__form-textarea {
      font-family: var(--font-body);
      font-size: var(--text-base);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .crucible__form-input:focus,
    .crucible__form-select:focus,
    .crucible__form-textarea:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .crucible__form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .crucible__form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    @media (max-width: 640px) {
      .crucible__form-row {
        grid-template-columns: 1fr;
      }
    }

    .crucible__form-checkbox {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }

    .crucible__form-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .crucible__form-range-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .crucible__error {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-danger);
    }
  `,
  ];

  @property({ type: Object }) trend?: SocialTrend;
  @property({ type: Object }) article?: BrowseArticle;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _step: Step = 'preview';
  @state() private _loading = false;
  @state() private _error: string | null = null;

  // Transform result
  @state() private _transformedContent = '';

  // Integrate form
  @state() private _eventTitle = '';
  @state() private _eventDescription = '';
  @state() private _eventType = 'news';
  @state() private _impactLevel = 5;

  // Reaction generation (ephemeral articles)
  @state() private _generateReactions = true;
  @state() private _reactionAgents = 20;

  // Crucible animation state
  @state() private _transforming = false;

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

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('_step')) {
      this.setAttribute('data-step', this._step);
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
    this._eventTitle = '';
    this._eventDescription = '';
    this._eventType = 'news';
    this._impactLevel = 5;
    this._generateReactions = true;
    this._reactionAgents = 20;
    this._transforming = false;
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private async _handleTransform(): Promise<void> {
    this._error = null;
    this._transforming = true;

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
          this._eventTitle = t?.title || this._extractTitle(t?.content || '') || this._articleName;
          this._eventDescription = t?.description || this._transformedContent;
          if (t?.event_type) this._eventType = t.event_type;
          if (t?.impact_level) this._impactLevel = t.impact_level;

          this._step = 'transform';
          this._transforming = false;
          progress.complete(msg('Transformation complete'));
        } else {
          const errMsg = response.error?.message || msg('Transformation failed');
          progress.setError(errMsg);
          this._error = errMsg;
          this._transforming = false;
        }
      });
    } catch (err) {
      captureError(err, { source: 'VelgTransformationModal._handleTransform' });
      this._transforming = false;
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

  private _getStepState(step: Step): 'active' | 'done' | '' {
    const steps: Step[] = ['preview', 'transform', 'integrate'];
    const current = steps.indexOf(this._step);
    const target = steps.indexOf(step);
    if (target === current) return 'active';
    if (target < current) return 'done';
    return '';
  }

  private _getEventTypeTaxonomies() {
    return appState.getTaxonomiesByType('event_type');
  }

  // -- Render helpers --

  private _renderPipeline() {
    const previewState = this._getStepState('preview');
    const transformState = this._getStepState('transform');
    const integrateState = this._getStepState('integrate');

    const arrow1Active = previewState === 'done' || this._transforming;
    const arrow2Active = transformState === 'done';

    return html`
      <nav class="pipeline" role="navigation" aria-label=${msg('Transformation steps')}>
        <div
          class="pipeline__step ${previewState ? `pipeline__step--${previewState}` : ''}"
          aria-current=${previewState === 'active' ? 'step' : nothing}
        >
          ${previewState === 'done' ? '\u2713' : nothing}
          ${msg('Reality')}
        </div>
        <span class="pipeline__arrow ${arrow1Active ? 'pipeline__arrow--active' : ''}" aria-hidden="true">\u2500\u2500\u25B6</span>
        <div
          class="pipeline__step ${transformState ? `pipeline__step--${transformState}` : ''} ${this._transforming ? 'pipeline__step--active' : ''}"
          aria-current=${transformState === 'active' || this._transforming ? 'step' : nothing}
        >
          ${transformState === 'done' ? '\u2713' : nothing}
          ${msg('Crucible')}
        </div>
        <span class="pipeline__arrow ${arrow2Active ? 'pipeline__arrow--active' : ''}" aria-hidden="true">\u2500\u2500\u25B6</span>
        <div
          class="pipeline__step ${integrateState ? `pipeline__step--${integrateState}` : ''}"
          aria-current=${integrateState === 'active' ? 'step' : nothing}
        >
          ${msg('Event')}
        </div>
      </nav>
    `;
  }

  private _renderClipping(compact = false) {
    const raw = this._articleRawData as Record<string, string> | undefined;
    return html`
      <div class="clipping ${compact ? 'clipping--compact' : ''}">
        <h3 class="clipping__headline">${this._articleName}</h3>
        ${
          raw?.trail_text || raw?.description
            ? html`<div class="clipping__body">${this._stripHtml(raw.trail_text || raw.description)}</div>`
            : nothing
        }
        <div class="clipping__byline">
          <span class="clipping__byline-platform">${this._articlePlatform}</span>
          ${raw?.byline || raw?.author ? html`<span>${raw.byline || raw.author}</span>` : nothing}
          ${this._articleUrl ? html`<a href=${this._articleUrl} target="_blank" rel="noopener">${msg('Source')}</a>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderPreview() {
    return html`
      <div class="crucible__section">
        ${this._renderClipping()}
      </div>
    `;
  }

  private _renderTransformResult() {
    return html`
      <div class="crucible__split">
        <!-- Reality panel -->
        <div class="crucible__panel">
          <div class="crucible__panel-label">${msg('Reality')}</div>
          ${this._renderClipping(true)}
        </div>

        <!-- Divider with scan animation -->
        <div class="crucible__divider ${this._transforming ? 'crucible__divider--active' : ''}"></div>

        <!-- Simulation panel -->
        <div class="crucible__panel">
          <div class="crucible__panel-label crucible__panel-label--sim">${msg('Simulation')}</div>
          <div class="crucible__output" aria-live="polite">
            ${this._cleanContent(this._transformedContent)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderIntegrateForm() {
    const eventTypes = this._getEventTypeTaxonomies();

    return html`
      <div class="crucible__form">
        <div class="crucible__form-group">
          <label class="crucible__form-label crucible__form-label--required">${msg('Event Title')}</label>
          <input
            class="crucible__form-input"
            type="text"
            .value=${this._eventTitle}
            @input=${(e: InputEvent) => {
              this._eventTitle = (e.target as HTMLInputElement).value;
            }}
            placeholder=${msg('Title for the new event')}
          />
        </div>

        <div class="crucible__form-group">
          <label class="crucible__form-label">${msg('Description')}</label>
          <textarea
            class="crucible__form-textarea"
            .value=${this._eventDescription}
            @input=${(e: InputEvent) => {
              this._eventDescription = (e.target as HTMLTextAreaElement).value;
            }}
            placeholder=${msg('Event description (pre-filled from transformation)')}
          ></textarea>
        </div>

        <div class="crucible__form-row">
          <div class="crucible__form-group">
            <label class="crucible__form-label">${msg('Event Type')}</label>
            <select
              class="crucible__form-select"
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

          <div class="crucible__form-group">
            <label class="crucible__form-label">${msg(str`Impact Level (${this._impactLevel}/10)`)}</label>
            <input
              class="crucible__form-input"
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
      <div class="crucible__form-group">
        <label class="crucible__form-checkbox">
          <input
            type="checkbox"
            .checked=${this._generateReactions}
            @change=${(e: Event) => {
              this._generateReactions = (e.target as HTMLInputElement).checked;
            }}
          />
          <span class="crucible__form-label">${msg('Generate agent reactions')}</span>
        </label>
      </div>

      ${
        this._generateReactions
          ? html`
          <div class="crucible__form-group">
            <div class="crucible__form-range-label">
              <label class="crucible__form-label">${msg('Number of agents')}</label>
              <span class="crucible__form-label">${this._reactionAgents}/50</span>
            </div>
            <input
              class="crucible__form-input"
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
        <span slot="header">${msg('The Crucible')}</span>

        <div class="crucible">
          ${this._renderPipeline()}
          ${this._renderStepContent()}
          ${this._error ? html`<div class="crucible__error">${this._error}</div>` : nothing}
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
