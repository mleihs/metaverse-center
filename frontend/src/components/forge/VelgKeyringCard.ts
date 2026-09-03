/**
 * Eine Anbieter-Karte im Schlüsselbund — drei Phasen, ein Grundsatz.
 *
 * DER GRUNDSATZ: **Prüfen vor Eintragen.** Kein Schlüssel wird gespeichert,
 * ohne dass der Anbieter ihn bestätigt hat. Vorher war das Prüfen ein
 * freiwilliger Knopf neben dem Speichern; wer ihn übersprang, legte einen
 * Schlüssel ab, von dem niemand wusste, ob er trägt — und `verified_at` blieb
 * für immer null. Ein Tippfehler sah dann monatelang aus wie ein gültiger
 * Schlüssel, bis mitten in einem Weltenbau die erste Anfrage scheiterte.
 *
 * DIE DREI PHASEN
 *   `empty`  — kein Schlüssel hinterlegt, es läuft der Projektschlüssel.
 *   `edit`   — einer wird eingegeben und geprüft. Beim WECHSEL bleibt der alte
 *              in Kraft, bis der neue bestätigt ist: ein halber Wechsel darf
 *              keine Welt anhalten.
 *   `stored` — einer liegt da, mit Kennung, Bestätigungsdatum und (wenn er zu
 *              lange nicht geprüft wurde) einem Vermerk.
 *
 * DER VERMERK ist der Grund, warum es diese Karte gibt: „hinterlegt" ist keine
 * Auskunft über Gültigkeit. Ein beim Anbieter zurückgezogener Schlüssel sieht
 * hier genauso aus wie ein gültiger — bis jemand fragt. Deshalb steht der
 * Vermerk in den Farben des Bureau-Terminals, nicht in Rot: es ist kein
 * Fehler, sondern eine offene Frage.
 *
 * Limit und 30-Tage-Verbrauch aus der Design-Übergabe fehlen bewusst. Sie
 * brauchen zwei Endpunkte, die es noch nicht gibt (Anbieter-Proxy und
 * Nutzungsreihe); eine Karte, die einen leeren Balken zeigt, behauptet mehr
 * als sie weiss.
 */
import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { forgeApi, type TestBYOKResult } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { formatDate } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { detectProvider, type KeyProviderId, providerById } from '../../utils/key-providers.js';
import { bureauPaletteStyles } from '../shared/bureau-palette-styles.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

/** Wie weit die Prüfung gekommen ist. */
type CheckState = 'idle' | 'testing' | 'confirmed' | 'rejected' | 'unreachable';

@localized()
@customElement('velg-keyring-card')
export class VelgKeyringCard extends SignalWatcher(LitElement) {
  static styles = [
    css`
    :host {
      display: block;
      /* Die vier Werte stehen in shared/bureau-palette-styles.ts; hier nur
         die Namen, unter denen dieser Baustein sie kennt. */
      --_gold: var(--_bureau-dim);
      --_gold-bright: var(--_bureau-text);
      --_gold-border: var(--_bureau-border);
      --_gold-bg: var(--_bureau-screen);
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      border: 1px solid var(--color-border-light);
      background: var(--color-surface);
      padding: var(--space-4);
      animation: card-rise var(--duration-entrance) var(--ease-dramatic) both;
      animation-delay: calc(var(--i, 0) * 60ms);
      transition: border-color var(--transition-normal);
    }

    .card[data-state='stored'] {
      border-color: color-mix(in srgb, var(--color-accent-green) 55%, var(--color-border));
    }

    .card[data-state='notice'] {
      border-color: var(--_gold-border);
    }

    .card[data-state='edit'] {
      border-color: var(--color-accent-amber);
      box-shadow: var(--shadow-md);
    }

    @keyframes card-rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    /* ── Kopf ─────────────────────────────────────────── */

    .head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: var(--border-radius-full);
      background: var(--color-text-muted);
      flex-shrink: 0;
    }

    .card[data-state='stored'] .dot {
      background: var(--color-accent-green);
      box-shadow: 0 0 calc(6px * var(--glow-strength)) color-mix(in srgb, var(--color-accent-green) 60%, transparent);
    }

    .card[data-state='notice'] .dot {
      background: var(--_gold-bright);
      box-shadow: 0 0 calc(6px * var(--glow-strength)) color-mix(in srgb, var(--_gold-bright) 50%, transparent);
    }

    .name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .service {
      margin-left: auto;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    /* ── Kennung ──────────────────────────────────────── */

    .identity {
      font-family: var(--font-mono);
      font-size: var(--text-base);
      color: var(--color-text-primary);
      word-break: break-all;
    }

    .identity__mask {
      color: var(--color-text-tertiary);
      letter-spacing: 0.12em;
    }

    .identity__tail {
      color: var(--color-text-primary);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .meta__confirmed {
      color: var(--color-accent-green);
    }

    .card[data-state='notice'] .meta__confirmed {
      color: var(--_gold);
    }

    .meta__spacer {
      margin-left: auto;
    }

    /* ── Vermerk ──────────────────────────────────────── */

    .notice {
      border: 1px solid var(--_gold-border);
      background: var(--_gold-bg);
      padding: var(--space-3);
      font-size: var(--text-xs);
      line-height: var(--leading-relaxed);
      color: var(--_gold-bright);
      animation: card-rise var(--duration-slow) var(--ease-dramatic) both;
    }

    .notice__kicker {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--_gold);
      margin-right: var(--space-2);
    }

    /* ── Leere Karte ──────────────────────────────────── */

    .empty {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .purpose {
      font-family: var(--font-prose, serif);
      font-style: italic;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* ── Eingabe ──────────────────────────────────────── */

    .kicker {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-accent-amber);
    }

    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      padding: var(--space-2-5) var(--space-10) var(--space-2-5) var(--space-3);
      min-height: 44px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-none);
      color: var(--color-text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      transition: border-color var(--transition-normal);
    }

    .input:focus-visible {
      outline: none;
      border-color: var(--color-accent-amber);
      box-shadow: 0 0 0 3px var(--color-accent-amber-glow);
    }

    .input[data-check='rejected'],
    .input[data-format='wrong'] {
      border-color: var(--color-danger);
    }

    .input[data-check='testing'] {
      border-color: var(--color-accent-amber);
    }

    .input[data-check='confirmed'] {
      border-color: var(--color-accent-green);
    }

    /* Der Lichtstreifen wandert nur, solange gefragt wird. */
    .input-wrap[data-check='testing']::after {
      content: '';
      position: absolute;
      inset: 1px 1px 1px 1px;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--color-accent-amber) 10%, transparent) 50%,
        transparent 100%
      );
      width: 24%;
      animation: sweep 1400ms ease-in-out infinite;
    }

    @keyframes sweep {
      from {
        transform: translateX(-30%);
      }
      to {
        transform: translateX(430%);
      }
    }

    .reveal {
      position: absolute;
      right: var(--space-2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
    }

    .reveal:hover:not(:disabled) {
      color: var(--color-text-primary);
    }

    .reveal:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .reveal:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    .format {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .format[data-tone='wrong'] {
      color: var(--color-danger);
    }

    .format[data-tone='ok'] {
      color: var(--color-accent-green);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      border: 1px solid currentColor;
    }

    .badge[data-tone='testing'] {
      color: var(--color-accent-amber);
      animation: badge-pulse 1200ms ease-in-out infinite;
    }

    .badge[data-tone='ok'] {
      color: var(--color-accent-green);
      animation: badge-pop 150ms var(--ease-bounce) both;
    }

    .badge[data-tone='bad'] {
      color: var(--color-danger);
    }

    @keyframes badge-pulse {
      50% {
        opacity: 0.45;
      }
    }

    @keyframes badge-pop {
      from {
        transform: scale(0.85);
      }
    }

    /* ── Fuß ──────────────────────────────────────────── */

    .foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-top: auto;
      padding-top: var(--space-1);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      min-height: 36px;
      padding: var(--space-1-5) var(--space-3);
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-wide);
      cursor: pointer;
      white-space: nowrap;
      transition: border-color var(--transition-fast), color var(--transition-fast);
    }

    .btn:hover:not(:disabled) {
      border-color: var(--color-text-primary);
      color: var(--color-text-primary);
    }

    .btn:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    .btn--amber {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
    }

    .btn--amber:hover:not(:disabled) {
      background: var(--color-accent-amber);
      color: var(--color-on-accent-amber);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn--gold {
      border-color: var(--_gold);
      color: var(--_gold-bright);
    }

    .btn--gold:hover:not(:disabled) {
      background: var(--_gold);
      color: var(--_gold-bg);
    }

    .btn--danger:hover:not(:disabled) {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    /* „Eintragen" ist vor der Bestätigung KEIN Knopf, der abgelehnt wird —
       er ist einer, der noch nicht dran ist. Deshalb grau und ohne Zeiger,
       statt rot oder verschwunden: die Beschriftung bleibt sichtbar, damit
       man sieht, was als Nächstes kommt. */
    .btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .hint {
      font-family: var(--font-prose, serif);
      font-style: italic;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .card[data-flash] {
      animation: flash-green 900ms var(--ease-dramatic) both;
    }

    @keyframes flash-green {
      0% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-green) 55%, transparent);
      }
      100% {
        box-shadow: 0 0 0 12px transparent;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }

      .input-wrap[data-check='testing']::after {
        display: none;
      }
    }
  `,
    bureauPaletteStyles,
  ];

  @property({ type: String }) providerId: KeyProviderId = 'openrouter';
  /** Ein aus der Einfüge-Karte gereichter Entwurf öffnet die Karte direkt. */
  @property({ type: String }) draft = '';

  @state() private _editing = false;
  @state() private _value = '';
  @state() private _reveal = false;
  @state() private _check: CheckState = 'idle';
  @state() private _result: TestBYOKResult | null = null;
  /** Der Wert, den der Anbieter bestätigt hat — nur DER darf eingetragen werden. */
  @state() private _confirmedValue = '';
  @state() private _busy = false;
  @state() private _flash = false;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('draft') && this.draft) {
      this._value = this.draft;
      this._editing = true;
      this._check = 'idle';
      this._result = null;
      this._confirmedValue = '';
      queueMicrotask(() => this.renderRoot.querySelector<HTMLInputElement>('.input')?.focus());
    }
  }

  // ── Ableitungen ──────────────────────────────────────

  private get _provider() {
    return providerById(this.providerId);
  }

  private get _status() {
    const s = forgeStateManager.byokStatus.value;
    return this.providerId === 'openrouter'
      ? {
          hasKey: s.has_openrouter_key,
          last4: s.openrouter_last4,
          verifiedAt: s.openrouter_verified_at,
          lastUsedAt: s.openrouter_last_used_at,
        }
      : {
          hasKey: s.has_replicate_key,
          last4: s.replicate_last4,
          verifiedAt: s.replicate_verified_at,
          lastUsedAt: s.replicate_last_used_at,
        };
  }

  /** Tage seit der letzten Bestätigung, oder null wenn nie geprüft. */
  private get _daysSinceVerified(): number | null {
    const at = this._status.verifiedAt;
    if (!at) return null;
    const ms = Date.now() - new Date(at).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  private get _hasNotice(): boolean {
    if (!this._status.hasKey) return false;
    const days = this._daysSinceVerified;
    const limit = forgeStateManager.byokStatus.value.stale_after_days ?? 90;
    return days === null || days > limit;
  }

  private get _formatState(): 'empty' | 'ok' | 'wrong' | 'other-provider' {
    const v = this._value.trim();
    if (!v) return 'empty';
    if (v.startsWith(this._provider.prefix)) return 'ok';
    return detectProvider(v) ? 'other-provider' : 'wrong';
  }

  // ── Render ───────────────────────────────────────────

  protected render() {
    const phase = this._editing ? 'edit' : this._status.hasKey ? 'stored' : 'empty';
    const state = phase === 'edit' ? 'edit' : this._hasNotice ? 'notice' : phase;

    return html`
      <div class="card" data-state=${state} ?data-flash=${this._flash}>
        ${this._renderHead()}
        ${
          phase === 'edit'
            ? this._renderEdit()
            : phase === 'stored'
              ? this._renderStored()
              : this._renderEmpty()
        }
      </div>
    `;
  }

  private _renderHead() {
    return html`
      <div class="head">
        <span class="dot"></span>
        <span class="name">${this._provider.name}</span>
        <span class="service">${this._provider.service()}</span>
      </div>
    `;
  }

  private _renderStored() {
    const { last4, lastUsedAt } = this._status;
    const days = this._daysSinceVerified;

    return html`
      <div class="identity">
        <span>${this._provider.prefix}</span><span class="identity__mask">•••••</span
        ><span class="identity__tail">${last4 ?? '····'}</span>
      </div>

      <div class="meta">
        <span class="meta__confirmed">
          ${
            days === null
              ? msg('Never confirmed at the provider')
              : msg(
                  str`Confirmed at the provider on ${formatDate(this._status.verifiedAt ?? '')} · ${days} days ago`,
                )
          }
        </span>
        ${
          lastUsedAt
            ? html`<span class="meta__spacer">${msg(str`last used ${formatDate(lastUsedAt)}`)}</span>`
            : nothing
        }
      </div>

      ${this._hasNotice ? this._renderNotice(days) : nothing}

      <div class="foot">
        ${
          this._hasNotice
            ? html`<button class="btn btn--gold" ?disabled=${this._busy} @click=${this._recheck}>
              ${icons.refresh(12)} ${this._busy ? msg('Asking...') : msg('Check now')}
            </button>`
            : nothing
        }
        <button class="btn" ?disabled=${this._busy} @click=${this._startEdit}>
          ${msg('Replace key')}
        </button>
        <button class="btn btn--danger" ?disabled=${this._busy} @click=${this._remove}>
          ${icons.trash(12)} ${msg('Remove')}
        </button>
      </div>
    `;
  }

  private _renderNotice(days: number | null) {
    return html`
      <p class="notice">
        <span class="notice__kicker">${msg('Notice')}</span>
        ${
          days === null
            ? msg(
                'This key has never been confirmed at the provider. A key withdrawn there looks exactly like a valid one here.',
              )
            : msg(
                str`Not confirmed at the provider for ${days} days. A key withdrawn there looks exactly like a valid one here.`,
              )
        }
      </p>
    `;
  }

  private _renderEmpty() {
    return html`
      <p class="empty">${msg('– no key on file · running on the project key')}</p>
      <p class="purpose">${this._provider.purpose()}</p>
      <div class="foot">
        <button class="btn btn--amber" @click=${this._startEdit}>${msg('Add key')}</button>
      </div>
    `;
  }

  private _renderEdit() {
    const format = this._formatState;
    const confirmed = this._check === 'confirmed' && this._confirmedValue === this._value.trim();

    return html`
      <p class="kicker">
        ${
          this._status.hasKey
            ? msg('Replace key – the old one stays in force until the new one is confirmed')
            : msg('Add key')
        }
      </p>

      <div class="input-wrap" data-check=${this._check}>
        <input
          class="input"
          data-check=${this._check}
          data-format=${format === 'empty' ? 'idle' : format === 'ok' ? 'ok' : 'wrong'}
          type=${this._reveal ? 'text' : 'password'}
          autocomplete="off"
          spellcheck="false"
          placeholder=${this._provider.placeholder}
          aria-label=${msg(str`${this._provider.name} API key`)}
          .value=${this._value}
          @input=${this._onInput}
          @keydown=${this._onKeydown}
        />
        <button
          class="reveal"
          type="button"
          aria-pressed=${this._reveal ? 'true' : 'false'}
          ?disabled=${!this._value}
          @click=${() => {
            this._reveal = !this._reveal;
          }}
        >
          ${this._reveal ? icons.eyeOff(16) : icons.eye(16)}
        </button>
      </div>

      ${this._renderFormatLine(format)}
      ${this._renderCheckBadge()}

      <div class="foot">
        <button
          class="btn"
          ?disabled=${format !== 'ok' || this._check === 'testing'}
          @click=${this._check_}
        >
          ${this._check === 'testing' ? msg('Asking the provider...') : msg('Check with provider')}
        </button>
        <button
          class="btn ${confirmed ? 'btn--amber' : ''}"
          ?disabled=${!confirmed || this._busy}
          @click=${this._store}
        >
          ${msg('Add to file')}
        </button>
        <button class="btn" @click=${this._cancelEdit}>${msg('Cancel')}</button>
      </div>

      <p class="hint">
        ${msg('A key is only stored once the provider has confirmed it. Nothing is written before that.')}
      </p>
    `;
  }

  private _renderFormatLine(format: 'empty' | 'ok' | 'wrong' | 'other-provider') {
    if (format === 'empty') return nothing;
    if (format === 'ok') {
      return html`<p class="format" data-tone="ok">${msg('Format matches')}</p>`;
    }
    if (format === 'other-provider') {
      const other = detectProvider(this._value.trim());
      return html`<p class="format" data-tone="wrong">
        ${msg(str`That is a ${other?.name ?? '?'} key – it belongs in the ${other?.name ?? '?'} card.`)}
      </p>`;
    }
    return html`<p class="format" data-tone="wrong">
      ${msg(str`Starts with ${this._provider.prefix}`)}
    </p>`;
  }

  private _renderCheckBadge() {
    if (this._check === 'idle') return nothing;
    if (this._check === 'testing') {
      return html`<span class="badge" data-tone="testing">${msg('checking')}</span>`;
    }
    if (this._check === 'confirmed') {
      return html`<span class="badge" data-tone="ok">
        ${icons.checkCircle(11)}
        ${msg(str`Provider confirmed · answered in ${this._result?.response_ms ?? 0} ms`)}
      </span>`;
    }
    return html`<span class="badge" data-tone="bad">
      ${icons.xCircle(11)} ${this._result?.detail ?? msg('No answer from the provider')}
    </span>`;
  }

  // ── Handlungen ───────────────────────────────────────

  private _onInput(e: InputEvent): void {
    this._value = (e.target as HTMLInputElement).value;
    // Jede Änderung entwertet die Bestätigung — sonst könnte man einen
    // geprüften Schlüssel bestätigen lassen und einen anderen eintragen.
    if (this._value.trim() !== this._confirmedValue) {
      this._check = 'idle';
      this._result = null;
    }
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelEdit();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (this._check === 'confirmed' && this._confirmedValue === this._value.trim()) {
      void this._store();
    } else if (this._formatState === 'ok') {
      void this._check_();
    }
  }

  private _startEdit(): void {
    this._editing = true;
    this._value = '';
    this._reveal = false;
    this._check = 'idle';
    this._result = null;
    this._confirmedValue = '';
    queueMicrotask(() => this.renderRoot.querySelector<HTMLInputElement>('.input')?.focus());
  }

  private _cancelEdit(): void {
    this._editing = false;
    this._value = '';
    this._reveal = false;
    this._check = 'idle';
    this._result = null;
    this._confirmedValue = '';
    this.dispatchEvent(new CustomEvent('draft-consumed', { bubbles: true, composed: true }));
  }

  /** Trailing underscore: `check` ist schon der Name des Zustandsfelds. */
  private async _check_(): Promise<void> {
    const value = this._value.trim();
    if (!value || this._formatState !== 'ok') return;

    this._check = 'testing';
    this._result = null;
    try {
      const resp = await forgeApi.testBYOK(this.providerId, value);
      const result = resp.success && resp.data ? resp.data : null;
      this._result = result;
      if (result?.valid) {
        this._check = 'confirmed';
        this._confirmedValue = value;
      } else {
        this._check = 'rejected';
        this._confirmedValue = '';
      }
    } catch (err) {
      captureError(err, { source: 'VelgKeyringCard._check', provider: this.providerId });
      this._check = 'unreachable';
      this._confirmedValue = '';
      this._result = {
        valid: false,
        detail: msg('No answer – try again in a moment.'),
        response_ms: 0,
      };
    }
  }

  private async _store(): Promise<void> {
    const value = this._value.trim();
    // Der Riegel, um den es in dieser Komponente geht.
    if (this._check !== 'confirmed' || this._confirmedValue !== value || this._busy) return;

    this._busy = true;
    try {
      const resp = await forgeApi.updateBYOK({ [`${this.providerId}_key`]: value });
      if (!resp.success) {
        VelgToast.error(
          (resp.error as { message?: string } | undefined)?.message ??
            msg('The key could not be stored.'),
        );
        return;
      }
      await forgeStateManager.loadWallet();
      this._editing = false;
      this._value = '';
      this._confirmedValue = '';
      this._check = 'idle';
      this._flash = true;
      setTimeout(() => {
        this._flash = false;
      }, 900);
      VelgToast.success(msg(str`${this._provider.name} key on file and confirmed.`));
      this.dispatchEvent(new CustomEvent('keyring-changed', { bubbles: true, composed: true }));
    } catch (err) {
      captureError(err, { source: 'VelgKeyringCard._store', provider: this.providerId });
      VelgToast.error(msg('The key could not be stored.'));
    } finally {
      this._busy = false;
    }
  }

  private async _recheck(): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      const resp = await forgeApi.recheckBYOK(this.providerId);
      const result = resp.success && resp.data ? resp.data : null;
      await forgeStateManager.loadWallet();
      if (result?.valid) {
        VelgToast.success(msg(str`${this._provider.name} key confirmed – the notice is lifted.`));
      } else if (result && !result.had_key) {
        VelgToast.info(msg('There is no key on file for this provider.'));
      } else {
        VelgToast.error(result?.detail ?? msg('The provider did not confirm the key.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgKeyringCard._recheck', provider: this.providerId });
      VelgToast.error(msg('The provider could not be reached.'));
    } finally {
      this._busy = false;
    }
  }

  private async _remove(): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Remove key'),
      message: msg(
        str`Remove your ${this._provider.name} key? Requests fall back to the project key from the next call on.`,
      ),
      confirmLabel: msg('Remove'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._busy = true;
    try {
      const resp = await forgeApi.deleteBYOK(this.providerId);
      if (!resp.success) {
        VelgToast.error(
          (resp.error as { message?: string } | undefined)?.message ??
            msg('The key could not be removed.'),
        );
        return;
      }
      await forgeStateManager.loadWallet();
      VelgToast.success(msg(str`${this._provider.name} key removed.`));
      this.dispatchEvent(new CustomEvent('keyring-changed', { bubbles: true, composed: true }));
    } catch (err) {
      captureError(err, { source: 'VelgKeyringCard._remove', provider: this.providerId });
      VelgToast.error(msg('The key could not be removed.'));
    } finally {
      this._busy = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-keyring-card': VelgKeyringCard;
  }
}
