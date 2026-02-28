import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { eventsApi } from '../../services/api/index.js';
import type { Event as SimEvent } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import '../shared/BaseModal.js';
import { formStyles } from '../shared/form-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-event-edit-modal')
export class VelgEventEditModal extends LitElement {
  static styles = [
    formStyles,
    infoBubbleStyles,
    css`
    :host {
      display: block;
    }

    .form__label {
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .form__label--required::after {
      content: ' *';
      color: var(--color-danger);
    }

    .form__input,
    .form__select,
    .form__textarea {
      padding: var(--space-2) var(--space-3);
    }

    /* Impact level slider */
    .form__impact-wrapper {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .form__range {
      flex: 1;
      appearance: none;
      height: 6px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
    }

    .form__range::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 20px;
      background: var(--color-primary);
      border: var(--border-medium);
      cursor: pointer;
    }

    .form__range::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: var(--color-primary);
      border: var(--border-medium);
      cursor: pointer;
    }

    .form__impact-value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      min-width: 32px;
      text-align: center;
    }

    /* Tags input */
    .form__tags-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .form__tags-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
    }

    .form__tag-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface-header);
      border: var(--border-width-default) solid var(--color-border);
    }

    .form__tag-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      line-height: 1;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: color var(--transition-fast);
    }

    .form__tag-remove:hover {
      color: var(--color-danger);
    }

    .form__tag-hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

  `,
  ];

  @property({ type: Object }) event: SimEvent | null = null;
  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) open = false;

  @state() private _title = '';
  @state() private _eventType = '';
  @state() private _description = '';
  @state() private _occurredAt = '';
  @state() private _impactLevel = 1;
  @state() private _tags: string[] = [];
  @state() private _tagInput = '';
  @state() private _location = '';
  @state() private _saving = false;
  @state() private _error: string | null = null;

  private get _isEdit(): boolean {
    return this.event !== null;
  }

  private get _modalTitle(): string {
    return this._isEdit ? msg('Edit Event') : msg('Create Event');
  }

  private _getEventTypeTaxonomies() {
    return appState.getTaxonomiesByType('event_type');
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('event') || changedProperties.has('open')) {
      if (this.open) {
        this._populateForm();
      }
    }
  }

  private _populateForm(): void {
    if (this.event) {
      this._title = this.event.title;
      this._eventType = this.event.event_type ?? '';
      this._description = this.event.description ?? '';
      this._occurredAt = this.event.occurred_at
        ? this._toDateInputValue(this.event.occurred_at)
        : '';
      this._impactLevel = this.event.impact_level ?? 1;
      this._tags = [...(this.event.tags ?? [])];
      this._location = this.event.location ?? '';
    } else {
      this._resetForm();
    }
    this._error = null;
  }

  private _resetForm(): void {
    this._title = '';
    this._eventType = '';
    this._description = '';
    this._occurredAt = this._toDateInputValue(new Date().toISOString());
    this._impactLevel = 1;
    this._tags = [];
    this._tagInput = '';
    this._location = '';
    this._error = null;
  }

  private _toDateInputValue(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }

  private _handleTagKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this._addTag();
    }
  }

  private _addTag(): void {
    const tag = this._tagInput.replace(/,/g, '').trim();
    if (tag && !this._tags.includes(tag)) {
      this._tags = [...this._tags, tag];
    }
    this._tagInput = '';
  }

  private _removeTag(tag: string): void {
    this._tags = this._tags.filter((t) => t !== tag);
  }

  private _handleClose(): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _handleSubmit(e?: Event): Promise<void> {
    e?.preventDefault();

    if (!this._title.trim()) {
      this._error = msg('Title is required');
      return;
    }

    this._saving = true;
    this._error = null;

    const data: Partial<SimEvent> = {
      title: this._title.trim(),
      event_type: this._eventType || undefined,
      description: this._description.trim() || undefined,
      occurred_at: this._occurredAt ? new Date(this._occurredAt).toISOString() : undefined,
      impact_level: this._impactLevel,
      tags: this._tags,
      location: this._location.trim() || undefined,
    };

    try {
      const response = this._isEdit
        ? await eventsApi.update(this.simulationId, (this.event as SimEvent).id, data)
        : await eventsApi.create(this.simulationId, data);

      if (response.success) {
        VelgToast.success(
          this._isEdit ? msg('Event updated successfully') : msg('Event created successfully'),
        );
        this.dispatchEvent(
          new CustomEvent('event-saved', {
            detail: response.data,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message ?? msg('Failed to save event');
        VelgToast.error(this._error);
      }
    } catch {
      this._error = msg('An unexpected error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  protected render() {
    const eventTypes = this._getEventTypeTaxonomies();

    return html`
      <velg-base-modal
        ?open=${this.open}
        @modal-close=${this._handleClose}
      >
        <span slot="header">${this._modalTitle}</span>

        <form class="form" @submit=${this._handleSubmit}>
          <div class="form__group">
            <label class="form__label form__label--required">
              ${msg('Title')}
              ${renderInfoBubble(msg('Event headline. Preserved through bleed echoes — this is what agents in other simulations hear.'))}
            </label>
            <input
              class="form__input"
              type="text"
              .value=${this._title}
              @input=${(e: InputEvent) => {
                this._title = (e.target as HTMLInputElement).value;
              }}
              placeholder=${msg('Event title')}
              required
            />
          </div>

          <div class="form__group">
            <label class="form__label">
              ${msg('Event Type')}
              ${renderInfoBubble(msg('Narrative category. Affects AI tone and which agents react. Different types trigger different relationship dynamics.'))}
            </label>
            <select
              class="form__select"
              .value=${this._eventType}
              @change=${(e: Event) => {
                this._eventType = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="">${msg('-- Select Type --')}</option>
              ${eventTypes.map(
                (t) => html`
                  <option value=${t.value}>${t.label?.en ?? t.value}</option>
                `,
              )}
            </select>
          </div>

          <div class="form__group">
            <label class="form__label">
              ${msg('Description')}
              ${renderInfoBubble(msg('Full event narrative. Transformed by bleed vectors when echoing to other simulations (e.g., Commerce bleed rewrites through economic lens).'))}
            </label>
            <textarea
              class="form__textarea"
              .value=${this._description}
              @input=${(e: InputEvent) => {
                this._description = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder=${msg('Event description...')}
            ></textarea>
          </div>

          <div class="form__row">
            <div class="form__group">
              <label class="form__label">
                ${msg('Occurred At')}
                ${renderInfoBubble(msg('When the event occurred. Timeline ordering determines cause-and-effect chains. Recent high-impact events increase zone event pressure.'))}
              </label>
              <input
                class="form__input"
                type="datetime-local"
                .value=${this._occurredAt}
                @input=${(e: InputEvent) => {
                  this._occurredAt = (e.target as HTMLInputElement).value;
                }}
              />
            </div>

            <div class="form__group">
              <label class="form__label">
                ${msg('Location')}
                ${renderInfoBubble(msg('Where the event happened. Events are attributed to the matching zone for stability calculations. Zones with many high-impact events become unstable.'))}
              </label>
              <input
                class="form__input"
                type="text"
                .value=${this._location}
                @input=${(e: InputEvent) => {
                  this._location = (e.target as HTMLInputElement).value;
                }}
                placeholder=${msg('Optional location')}
              />
            </div>
          </div>

          <div class="form__group">
            <label class="form__label">
              ${msg(str`Impact Level (${this._impactLevel}/10)`)}
              ${renderInfoBubble(msg('Determines ripple radius: 1-3 local zone, 4-6 adjacent zones, 7-8 entire city, 9-10 all cities. Events above the bleed threshold (default 8) can echo to connected simulations.'))}
            </label>
            <div class="form__impact-wrapper">
              <input
                class="form__range"
                type="range"
                min="1"
                max="10"
                step="1"
                .value=${String(this._impactLevel)}
                @input=${(e: InputEvent) => {
                  this._impactLevel = Number((e.target as HTMLInputElement).value);
                }}
              />
              <span class="form__impact-value">${this._impactLevel}</span>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label">
              ${msg('Tags')}
              ${renderInfoBubble(msg('Tags matching a bleed vector (commerce, memory, dream...) boost echo strength by 20%. Tags matching an agent system increase reaction probability.'))}
            </label>
            <div class="form__tags-container">
              ${
                this._tags.length > 0
                  ? html`
                  <div class="form__tags-chips">
                    ${this._tags.map(
                      (tag) => html`
                        <span class="form__tag-chip">
                          ${tag}
                          <button
                            type="button"
                            class="form__tag-remove"
                            @click=${() => this._removeTag(tag)}
                            aria-label="Remove tag ${tag}"
                          >
                            ${icons.close()}
                          </button>
                        </span>
                      `,
                    )}
                  </div>
                `
                  : null
              }
              <input
                class="form__input"
                type="text"
                .value=${this._tagInput}
                @input=${(e: InputEvent) => {
                  this._tagInput = (e.target as HTMLInputElement).value;
                }}
                @keydown=${this._handleTagKeyDown}
                placeholder=${msg('Type and press Enter to add')}
              />
              <span class="form__tag-hint">${msg('Press Enter or comma to add a tag')}</span>
            </div>
          </div>

          ${this._error ? html`<div class="form__error">${this._error}</div>` : null}
        </form>

        <div slot="footer" class="footer">
          <button
            class="footer__btn footer__btn--cancel"
            @click=${this._handleClose}
            ?disabled=${this._saving}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="footer__btn footer__btn--save"
            @click=${this._handleSubmit}
            ?disabled=${this._saving}
          >
            ${this._saving ? msg('Saving...') : this._isEdit ? msg('Save Changes') : msg('Create Event')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-event-edit-modal': VelgEventEditModal;
  }
}
