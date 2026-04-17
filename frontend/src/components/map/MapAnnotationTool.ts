import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { captureError } from '../../services/SentryService.js';

interface MapAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  rotation: number;
}

/**
 * Player personal annotations on the cartographic map.
 * Stored in localStorage, rendered as hand-written notes.
 */
@localized()
@customElement('velg-map-annotation-tool')
export class MapAnnotationTool extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host([active]) {
      pointer-events: auto;
      cursor: crosshair;
    }

    .annotation {
      position: absolute;
      font-family: var(--font-prose, 'Spectral', serif);
      font-style: italic;
      font-size: 12px;
      color: var(--color-text-secondary);
      padding: var(--space-1, 4px);
      pointer-events: auto;
      cursor: default;
      user-select: none;
      white-space: nowrap;
    }

    .annotation:hover {
      color: var(--color-text-primary);
    }

    .annotation__input {
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-prose, 'Spectral', serif);
      font-style: italic;
      font-size: 12px;
      padding: 2px 4px;
      outline: none;
      min-width: 80px;
    }

    .annotation__input:focus {
      border-color: var(--color-primary);
    }
  `;

  @property({ type: String }) mapId = '';
  @property({ type: Boolean, reflect: true }) active = false;

  @state() private _annotations: MapAnnotation[] = [];
  @state() private _editingId: string | null = null;

  private get _storageKey(): string {
    return `velg-map-annotations-${this.mapId}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._loadAnnotations();
  }

  private _loadAnnotations(): void {
    if (!this.mapId) return;
    try {
      const raw = localStorage.getItem(this._storageKey);
      this._annotations = raw ? JSON.parse(raw) : [];
    } catch (err) {
      captureError(err, { source: 'MapAnnotationTool._loadAnnotations' });
      this._annotations = [];
    }
  }

  private _saveAnnotations(): void {
    if (!this.mapId) return;
    localStorage.setItem(this._storageKey, JSON.stringify(this._annotations));
  }

  private _handleClick(e: MouseEvent) {
    if (!this.active || this._editingId) return;

    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const annotation: MapAnnotation = {
      id: crypto.randomUUID(),
      x,
      y,
      text: '',
      rotation: Math.random() * 6 - 3,
    };

    this._annotations = [...this._annotations, annotation];
    this._editingId = annotation.id;
  }

  private _handleInput(id: string, e: InputEvent) {
    const text = (e.target as HTMLInputElement).value;
    this._annotations = this._annotations.map((a) => (a.id === id ? { ...a, text } : a));
  }

  private _finishEditing(id: string) {
    const annotation = this._annotations.find((a) => a.id === id);
    if (annotation && !annotation.text.trim()) {
      // Remove empty annotations
      this._annotations = this._annotations.filter((a) => a.id !== id);
    }
    this._editingId = null;
    this._saveAnnotations();
  }

  private _handleKeyDown(id: string, e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this._finishEditing(id);
    } else if (e.key === 'Escape') {
      this._annotations = this._annotations.filter((a) => a.id !== id);
      this._editingId = null;
      this._saveAnnotations();
    }
  }

  private _handleContextMenu(id: string, e: MouseEvent) {
    e.preventDefault();
    this._annotations = this._annotations.filter((a) => a.id !== id);
    this._saveAnnotations();
  }

  protected render() {
    return html`
      <div @click=${this._handleClick}>
        ${this._annotations.map((a) => this._renderAnnotation(a))}
      </div>
    `;
  }

  private _renderAnnotation(annotation: MapAnnotation) {
    const isEditing = this._editingId === annotation.id;

    return html`
      <div
        class="annotation"
        style="left: ${annotation.x}px; top: ${annotation.y}px; transform: rotate(${annotation.rotation}deg)"
        @contextmenu=${(e: MouseEvent) => this._handleContextMenu(annotation.id, e)}
      >
        ${
          isEditing
            ? html`
              <input
                class="annotation__input"
                type="text"
                .value=${annotation.text}
                placeholder=${msg('Note...')}
                @input=${(e: InputEvent) => this._handleInput(annotation.id, e)}
                @blur=${() => this._finishEditing(annotation.id)}
                @keydown=${(e: KeyboardEvent) => this._handleKeyDown(annotation.id, e)}
                autofocus
              />
            `
            : annotation.text || nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-annotation-tool': MapAnnotationTool;
  }
}
