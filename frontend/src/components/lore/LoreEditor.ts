import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ForgeLoreSection } from '../../services/api/ForgeApiService.js';
import type {
  LoreSectionCreatePayload,
  LoreSectionUpdatePayload,
} from '../../services/api/LoreApiService.js';
import { icons } from '../../utils/icons.js';

interface EditingState {
  sectionId: string | null; // null = creating new
  chapter: string;
  arcanum: string;
  title: string;
  epigraph: string;
  body: string;
  image_slug: string;
  image_caption: string;
}

/** Keys of `EditingState` that are edited via `<input>`/`<textarea>` — i.e.
 *  every string field. `sectionId` is set once when an edit session starts
 *  and never updated by user input, so it's excluded here. */
type EditingStringField = Exclude<keyof EditingState, 'sectionId'>;

@localized()
@customElement('velg-lore-editor')
export class VelgLoreEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .editor {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      padding: var(--space-4) 0;
    }

    /* ── Section card ── */
    .section-card {
      border: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
      padding: var(--space-5) var(--space-5) var(--space-4);
      position: relative;
    }

    .section-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-3);
    }

    .section-card__meta {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1;
      min-width: 0;
    }

    .section-card__chapter {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .section-card__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .section-card__arcanum {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-primary);
      margin-left: var(--space-1);
    }

    .section-card__actions {
      display: flex;
      gap: var(--space-1);
      flex-shrink: 0;
    }

    .section-card__body-preview {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.6;
      max-height: 3.2em;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-border-light);
    }

    /* ── Icon buttons ── */
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .icon-btn:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .icon-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .icon-btn:disabled:hover {
      color: var(--color-text-secondary);
      border-color: var(--color-border);
    }

    .icon-btn--danger:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .icon-btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    /* ── Edit form ── */
    .edit-form {
      border: 2px solid var(--color-primary);
      background: var(--color-surface);
      padding: var(--space-6) var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .edit-form__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-md);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-primary);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-border-light);
    }

    .edit-form__row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
    }

    @media (max-width: 640px) {
      .edit-form__row {
        grid-template-columns: 1fr;
      }
    }

    .edit-form__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .edit-form__field--full {
      grid-column: 1 / -1;
    }

    .edit-form__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .edit-form__input,
    .edit-form__textarea {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      padding: var(--space-2-5) var(--space-3);
      transition: border-color var(--transition-fast);
    }

    .edit-form__input:focus,
    .edit-form__textarea:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .edit-form__textarea {
      resize: vertical;
      min-height: 120px;
      line-height: 1.6;
    }

    .edit-form__textarea--body {
      min-height: 240px;
    }

    .edit-form__actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
      padding-top: var(--space-4);
      margin-top: var(--space-2);
      border-top: 1px solid var(--color-border);
    }

    .edit-form__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2-5) var(--space-5);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .edit-form__btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-primary);
    }

    .edit-form__btn--primary {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .edit-form__btn--primary:hover {
      filter: brightness(1.1);
    }

    /* ── Add button ── */
    .add-section {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      padding: var(--space-4);
      border: 2px dashed var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      transition: all var(--transition-fast);
      width: 100%;
    }

    .add-section:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .add-section svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;

  @property({ type: Array }) sections: ForgeLoreSection[] = [];

  @state() private _editing: EditingState | null = null;

  private _startEdit(section: ForgeLoreSection): void {
    this._editing = {
      sectionId: section.id,
      chapter: section.chapter,
      arcanum: section.arcanum,
      title: section.title,
      epigraph: section.epigraph ?? '',
      body: section.body,
      image_slug: section.image_slug ?? '',
      image_caption: section.image_caption ?? '',
    };
  }

  private _startCreate(): void {
    this._editing = {
      sectionId: null,
      chapter: '',
      arcanum: '',
      title: '',
      epigraph: '',
      body: '',
      image_slug: '',
      image_caption: '',
    };
  }

  private _cancelEdit(): void {
    this._editing = null;
  }

  private _handleInput(field: EditingStringField, e: Event): void {
    if (!this._editing) return;
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    // Spread-reassignment (not in-place mutation) so Lit's @state reactivity
    // picks up the change — mutation would bypass the setter and require a
    // manual `requestUpdate()`.
    this._editing = { ...this._editing, [field]: target.value };
  }

  private _submitEdit(): void {
    if (!this._editing) return;
    const { sectionId, chapter, arcanum, title, epigraph, body, image_slug, image_caption } =
      this._editing;

    if (sectionId) {
      const data: LoreSectionUpdatePayload = {
        chapter,
        arcanum,
        title,
        epigraph: epigraph || undefined,
        body,
        image_slug: image_slug || null,
        image_caption: image_caption || null,
      };
      this.dispatchEvent(
        new CustomEvent('lore-save', {
          detail: { sectionId, data },
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      const data: LoreSectionCreatePayload = {
        chapter,
        arcanum,
        title,
        epigraph: epigraph || undefined,
        body,
        image_slug: image_slug || null,
        image_caption: image_caption || null,
      };
      this.dispatchEvent(
        new CustomEvent('lore-create', { detail: { data }, bubbles: true, composed: true }),
      );
    }

    this._editing = null;
  }

  private _dispatchDelete(sectionId: string): void {
    this.dispatchEvent(
      new CustomEvent('lore-delete', { detail: { sectionId }, bubbles: true, composed: true }),
    );
  }

  private _dispatchReorder(sectionId: string, direction: -1 | 1): void {
    this.dispatchEvent(
      new CustomEvent('lore-reorder', {
        detail: { sectionId, direction },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render() {
    return html`
      <div class="editor">
        ${this.sections.map((section, idx) =>
          this._editing?.sectionId === section.id
            ? this._renderEditForm()
            : this._renderSectionCard(section, idx),
        )}
        ${
          this._editing?.sectionId === null
            ? this._renderEditForm()
            : html`
              <button class="add-section" @click=${this._startCreate}>
                <svg viewBox="0 0 16 16"><path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/></svg>
                ${msg('Add Section')}
              </button>
            `
        }
      </div>
    `;
  }

  private _renderSectionCard(section: ForgeLoreSection, idx: number) {
    const isFirst = idx === 0;
    const isLast = idx === this.sections.length - 1;

    return html`
      <div class="section-card">
        <div class="section-card__header">
          <div class="section-card__meta">
            <span class="section-card__chapter">
              ${section.chapter}
              <span class="section-card__arcanum">${section.arcanum}</span>
            </span>
            <span class="section-card__title">${section.title}</span>
          </div>
          <div class="section-card__actions">
            <button
              class="icon-btn"
              title=${msg('Move up')}
              ?disabled=${isFirst}
              @click=${() => this._dispatchReorder(section.id, -1)}
            >
              <svg viewBox="0 0 16 16"><path d="M8 4l5 5H3z"/></svg>
            </button>
            <button
              class="icon-btn"
              title=${msg('Move down')}
              ?disabled=${isLast}
              @click=${() => this._dispatchReorder(section.id, 1)}
            >
              <svg viewBox="0 0 16 16"><path d="M8 12L3 7h10z"/></svg>
            </button>
            <button
              class="icon-btn"
              title=${msg('Edit section')}
              @click=${() => this._startEdit(section)}
            >
              ${icons.edit(14)}
            </button>
            <button
              class="icon-btn icon-btn--danger"
              title=${msg('Delete section')}
              @click=${() => this._dispatchDelete(section.id)}
            >
              ${icons.trash(14)}
            </button>
          </div>
        </div>
        <div class="section-card__body-preview">
          ${section.body.substring(0, 200)}${section.body.length > 200 ? '...' : ''}
        </div>
      </div>
    `;
  }

  private _renderEditForm() {
    if (!this._editing) return nothing;
    const isNew = this._editing.sectionId === null;

    return html`
      <div class="edit-form">
        <div class="edit-form__title">
          ${isNew ? msg('New Lore Section') : msg('Edit Lore Section')}
        </div>

        <div class="edit-form__row">
          <div class="edit-form__field">
            <label class="edit-form__label">${msg('Chapter')}</label>
            <input
              class="edit-form__input"
              type="text"
              .value=${this._editing.chapter}
              @input=${(e: Event) => this._handleInput('chapter', e)}
              placeholder=${msg('e.g. The First Age')}
            />
          </div>
          <div class="edit-form__field">
            <label class="edit-form__label">${msg('Arcanum')}</label>
            <input
              class="edit-form__input"
              type="text"
              .value=${this._editing.arcanum}
              @input=${(e: Event) => this._handleInput('arcanum', e)}
              placeholder=${msg('e.g. I')}
              maxlength="10"
            />
          </div>
        </div>

        <div class="edit-form__field edit-form__field--full">
          <label class="edit-form__label">${msg('Title')}</label>
          <input
            class="edit-form__input"
            type="text"
            .value=${this._editing.title}
            @input=${(e: Event) => this._handleInput('title', e)}
          />
        </div>

        <div class="edit-form__field edit-form__field--full">
          <label class="edit-form__label">${msg('Epigraph')}</label>
          <textarea
            class="edit-form__textarea"
            .value=${this._editing.epigraph}
            @input=${(e: Event) => this._handleInput('epigraph', e)}
            placeholder=${msg('Optional opening quote or flavor text')}
          ></textarea>
        </div>

        <div class="edit-form__field edit-form__field--full">
          <label class="edit-form__label">${msg('Body')}</label>
          <textarea
            class="edit-form__textarea edit-form__textarea--body"
            .value=${this._editing.body}
            @input=${(e: Event) => this._handleInput('body', e)}
          ></textarea>
        </div>

        <div class="edit-form__row">
          <div class="edit-form__field">
            <label class="edit-form__label">${msg('Image Slug')}</label>
            <input
              class="edit-form__input"
              type="text"
              .value=${this._editing.image_slug}
              @input=${(e: Event) => this._handleInput('image_slug', e)}
              placeholder=${msg('Optional')}
            />
          </div>
          <div class="edit-form__field">
            <label class="edit-form__label">${msg('Image Caption')}</label>
            <input
              class="edit-form__input"
              type="text"
              .value=${this._editing.image_caption}
              @input=${(e: Event) => this._handleInput('image_caption', e)}
              placeholder=${msg('Optional')}
            />
          </div>
        </div>

        <div class="edit-form__actions">
          <button class="edit-form__btn" @click=${this._cancelEdit}>
            ${msg('Cancel')}
          </button>
          <button class="edit-form__btn edit-form__btn--primary" @click=${this._submitEdit}>
            ${isNew ? msg('Create') : msg('Save')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-lore-editor': VelgLoreEditor;
  }
}
