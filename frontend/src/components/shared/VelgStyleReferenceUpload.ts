import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

/**
 * Reusable drag-and-drop upload + preview widget for style reference images.
 *
 * Industrial Darkroom aesthetic: recessed specimen tray drop zone,
 * scanline overlay on dragover, overlay action buttons on hover.
 *
 * @fires reference-change - { detail: { file?: File, url?: string, action: 'upload'|'url'|'delete' } }
 */
@localized()
@customElement('velg-style-reference-upload')
export class VelgStyleReferenceUpload extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Specimen Tray (Drop Zone) ──────────── */

    .tray {
      position: relative;
      min-height: 120px;
      background: var(--color-gray-950, #030712);
      border: 1px dashed var(--color-gray-600, #4b5563);
      box-shadow: inset 0 2px 8px rgba(0 0 0 / 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }

    .tray:hover {
      border-color: var(--color-gray-500, #6b7280);
    }

    .tray--dragover {
      border-color: var(--color-success, #22c55e);
      box-shadow:
        inset 0 2px 8px rgba(0 0 0 / 0.4),
        0 0 12px rgba(34 197 94 / 0.15);
    }

    /* Scanline overlay on dragover */
    .tray--dragover::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(34 197 94 / 0.03) 2px,
        rgba(34 197 94 / 0.03) 4px
      );
      pointer-events: none;
      animation: scanline-drift 2s linear infinite;
    }

    @keyframes scanline-drift {
      0% { transform: translateY(0); }
      100% { transform: translateY(4px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .tray--dragover::after { animation: none; }
    }

    .tray--error {
      border-color: var(--color-danger, #ef4444);
      animation: error-flash 0.3s ease;
    }

    @keyframes error-flash {
      0%, 100% { border-color: var(--color-danger, #ef4444); }
      50% { border-color: rgba(239 68 68 / 0.4); }
    }

    .tray--success {
      border-color: var(--color-success, #22c55e);
      animation: success-flash 0.4s ease;
    }

    @keyframes success-flash {
      0% { border-color: var(--color-success, #22c55e); box-shadow: 0 0 0 rgba(34 197 94 / 0); }
      50% { box-shadow: 0 0 16px rgba(34 197 94 / 0.3); }
      100% { border-color: var(--color-gray-600, #4b5563); box-shadow: 0 0 0 rgba(34 197 94 / 0); }
    }

    /* ── Empty State ──────────────────────────── */

    .tray__icon {
      color: var(--color-gray-500, #6b7280);
      transition: color 0.2s;
    }

    .tray--dragover .tray__icon {
      color: var(--color-success, #22c55e);
    }

    .tray__label {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-gray-400, #9ca3af);
      text-align: center;
    }

    .tray__hint {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-500, #6b7280);
    }

    .tray__input {
      display: none;
    }

    /* ── Preview State ───────────────────────── */

    .preview {
      position: relative;
      width: 100%;
      min-height: 120px;
      max-height: 200px;
      overflow: hidden;
    }

    .preview__image {
      width: 100%;
      height: 100%;
      min-height: 120px;
      max-height: 200px;
      object-fit: cover;
      display: block;
      border: 1px solid var(--color-gray-700, #374151);
      transition: transform 0.2s;
    }

    .preview:hover .preview__image {
      transform: scale(1.02);
    }

    .preview__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      background: rgba(0 0 0 / 0.6);
      backdrop-filter: blur(4px);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .preview:hover .preview__overlay {
      opacity: 1;
    }

    .preview__action {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--color-gray-800, #1f2937);
      border: 1px solid var(--color-gray-600, #4b5563);
      color: var(--color-gray-200, #e5e7eb);
      cursor: pointer;
      transition: all 0.15s;
      padding: 0;
    }

    .preview__action:hover {
      background: var(--color-gray-700, #374151);
      border-color: var(--color-gray-400, #9ca3af);
      transform: scale(1.1);
    }

    .preview__action--delete:hover {
      border-color: var(--color-danger, #ef4444);
      color: var(--color-danger, #ef4444);
    }

    /* ── Loading Shimmer ─────────────────────── */

    .shimmer {
      min-height: 120px;
      background: var(--color-gray-950, #030712);
      border: 1px solid var(--color-gray-700, #374151);
      position: relative;
      overflow: hidden;
    }

    .shimmer::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255 255 255 / 0.04),
        transparent
      );
      animation: shimmer-sweep 1.5s ease-in-out infinite;
    }

    @keyframes shimmer-sweep {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .shimmer::after { animation: none; }
    }

    /* ── URL Input ───────────────────────────── */

    .url-row {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .url-row__input {
      flex: 1;
      background: var(--color-gray-950, #030712);
      color: var(--color-gray-100, #f3f4f6);
      border: 1px solid var(--color-gray-700, #374151);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    .url-row__input:focus {
      outline: none;
      border-color: var(--color-success, #22c55e);
    }

    .url-row__input::placeholder {
      color: var(--color-gray-500, #6b7280);
    }

    .url-row__btn {
      padding: var(--space-1) var(--space-2);
      background: var(--color-gray-800, #1f2937);
      border: 1px solid var(--color-gray-600, #4b5563);
      color: var(--color-gray-300, #d1d5db);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .url-row__btn:hover {
      background: var(--color-gray-700, #374151);
      border-color: var(--color-gray-500, #6b7280);
    }

    .url-row__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Error Message ───────────────────────── */

    .error-msg {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-danger, #ef4444);
      margin-top: var(--space-1);
    }

    /* ── Aspect Hint ─────────────────────────── */

    .aspect-hint {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-gray-500, #6b7280);
      text-align: center;
      margin-top: var(--space-1);
    }
  `;

  static readonly ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
  static readonly MAX_SIZE = 10 * 1024 * 1024; // 10 MB

  @property() referenceUrl = '';
  @property() entityType = 'portrait';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property() aspectHint = '';

  @state() private _isDragover = false;
  @state() private _error = '';
  @state() private _flashState: 'success' | 'error' | '' = '';
  @state() private _urlInput = '';

  private _handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.disabled && !this.loading) {
      this._isDragover = true;
    }
  }

  private _handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this._isDragover = false;
  }

  private _handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this._isDragover = false;

    if (this.disabled || this.loading) return;

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      this._processFile(file);
    }
  }

  private _handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this._processFile(file);
    }
    input.value = '';
  }

  private _processFile(file: File) {
    this._error = '';

    if (!VelgStyleReferenceUpload.ALLOWED_TYPES.includes(file.type)) {
      this._error = msg('Unsupported file type. Use PNG, JPEG, WebP, or AVIF.');
      this._flash('error');
      return;
    }

    if (file.size > VelgStyleReferenceUpload.MAX_SIZE) {
      this._error = msg('File too large. Maximum 10 MB.');
      this._flash('error');
      return;
    }

    this._flash('success');
    this.dispatchEvent(
      new CustomEvent('reference-change', {
        detail: { file, action: 'upload' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleUrlSubmit() {
    const url = this._urlInput.trim();
    if (!url) return;

    this._error = '';
    try {
      new URL(url);
    } catch {
      this._error = msg('Invalid URL.');
      this._flash('error');
      return;
    }

    this.dispatchEvent(
      new CustomEvent('reference-change', {
        detail: { url, action: 'url' },
        bubbles: true,
        composed: true,
      }),
    );
    this._urlInput = '';
  }

  private _handleUrlKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this._handleUrlSubmit();
    }
  }

  private _handleDelete(e: Event) {
    e.stopPropagation();
    this._error = '';
    this.dispatchEvent(
      new CustomEvent('reference-change', {
        detail: { action: 'delete' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleReplace(e: Event) {
    e.stopPropagation();
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('.tray__input');
    input?.click();
  }

  private _openFilePicker() {
    if (this.disabled || this.loading) return;
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('.tray__input');
    input?.click();
  }

  private _flash(state: 'success' | 'error') {
    this._flashState = state;
    setTimeout(() => {
      this._flashState = '';
    }, 400);
  }

  protected render() {
    if (this.loading) {
      return html`<div class="shimmer"></div>`;
    }

    const hasPreview = Boolean(this.referenceUrl);

    return html`
      ${hasPreview ? this._renderPreview() : this._renderDropZone()}
      ${
        !hasPreview
          ? html`
          <div class="url-row">
            <input
              class="url-row__input"
              type="text"
              .value=${this._urlInput}
              placeholder=${msg('or paste image URL')}
              ?disabled=${this.disabled}
              @input=${(e: Event) => {
                this._urlInput = (e.target as HTMLInputElement).value;
              }}
              @keydown=${this._handleUrlKeydown}
            />
            <button
              class="url-row__btn"
              ?disabled=${this.disabled || !this._urlInput.trim()}
              @click=${this._handleUrlSubmit}
            >${msg('Fetch')}</button>
          </div>
        `
          : nothing
      }
      ${this.aspectHint ? html`<div class="aspect-hint">${this.aspectHint}</div>` : nothing}
      ${this._error ? html`<div class="error-msg">${this._error}</div>` : nothing}
      <input
        class="tray__input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        @change=${this._handleFileInput}
      />
    `;
  }

  private _renderDropZone() {
    const trayClass = [
      'tray',
      this._isDragover ? 'tray--dragover' : '',
      this._flashState === 'error' ? 'tray--error' : '',
      this._flashState === 'success' ? 'tray--success' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div
        class=${trayClass}
        @dragover=${this._handleDragOver}
        @dragleave=${this._handleDragLeave}
        @drop=${this._handleDrop}
        @click=${this._openFilePicker}
      >
        <span class="tray__icon">${icons.upload(24)}</span>
        <span class="tray__label">${msg('Drop image or click to upload')}</span>
        <span class="tray__hint">PNG, JPEG, WebP, AVIF (max 10 MB)</span>
      </div>
    `;
  }

  private _renderPreview() {
    return html`
      <div class="preview">
        <img
          class="preview__image"
          src=${this.referenceUrl}
          alt=${msg('Style reference')}
          loading="lazy"
        />
        <div class="preview__overlay">
          <button
            class="preview__action"
            @click=${this._handleReplace}
            title=${msg('Replace')}
          >${icons.upload(16)}</button>
          <button
            class="preview__action preview__action--delete"
            @click=${this._handleDelete}
            title=${msg('Delete')}
          >${icons.trash(16)}</button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-style-reference-upload': VelgStyleReferenceUpload;
  }
}
