/**
 * Withdrawal Slip - the page an emailed unsubscribe link lands on.
 *
 * This is the only view in the app written for someone who may not be signed
 * in, may not remember signing up, and is one unsatisfying click away from
 * pressing "spam" instead. Everything here follows from that:
 *
 *   - It states what is being left BEFORE asking, by name. The token is opaque
 *     to the browser, so the page reads it back from the server first.
 *   - It performs nothing on arrival. Corporate mail security (Safe Links,
 *     Proofpoint) pre-fetches every link in an incoming message; a page that
 *     unsubscribed on load would remove readers who never touched the mail.
 *     The backend's GET is a redirect for the same reason - the write is a POST
 *     the reader presses.
 *   - It has exactly one action above the fold, and a second, quieter one for
 *     the reader who came here by accident.
 *   - It never shows a spinner where a sentence belongs.
 *
 * The form is a Bureau withdrawal slip: a ruled card, a subject line, a
 * stamped confirmation on completion. The stamp is a colour and a rule, not a
 * rotated frame - rotated stamp graphics are forbidden project-wide.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { UnsubscribeScope } from '../../services/api/NotificationPreferencesApiService.js';
import { notificationPreferencesApi } from '../../services/api/NotificationPreferencesApiService.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';

type Phase = 'reading' | 'ready' | 'working' | 'done' | 'invalid';

@localized()
@customElement('velg-unsubscribe-view')
export class VelgUnsubscribeView extends LitElement {
  static styles = [
    markerCornerStyles,
    css`
      :host {
        display: block;
        padding: var(--content-padding, var(--space-6));
        max-width: 620px;
        margin: 0 auto;
        --_ink: var(--color-text-primary);
        --_rule: var(--color-border);
        --_stamp: var(--color-primary);
        --_stamp-wash: color-mix(in srgb, var(--color-primary) 8%, transparent);
        --_done: var(--color-success);
        --_done-wash: color-mix(in srgb, var(--color-success) 10%, transparent);
      }

      /* ── Slip ───────────────────────────────────────────── */

      .slip {
        position: relative;
        background: var(--color-surface-raised);
        border: var(--border-medium);
        box-shadow: var(--shadow-lg);
        padding: var(--space-8) var(--space-6) var(--space-6);
      }

      .slip__kicker {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-quiet);
        margin: 0 0 var(--space-2);
      }

      .slip__title {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: clamp(1.35rem, 4vw, var(--text-2xl));
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        line-height: var(--leading-tight);
        color: var(--_ink);
        margin: 0 0 var(--space-5);
      }

      /* ── Subject line: what is being left ───────────────── */

      .subject {
        border-top: 1px dashed var(--_rule);
        border-bottom: 1px dashed var(--_rule);
        padding: var(--space-4) var(--space-4);
        margin: 0 0 var(--space-5);
        background: var(--_stamp-wash);
      }

      .subject__label {
        display: block;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-widest);
        color: var(--color-text-quiet);
        margin-bottom: var(--space-1-5);
      }

      .subject__value {
        display: block;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-md);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--_stamp);
        line-height: var(--leading-snug);
      }

      .subject__note {
        display: block;
        margin-top: var(--space-2);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .prose {
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-6);
      }

      /* ── Actions ────────────────────────────────────────── */

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        min-height: 48px;
        padding: var(--space-3) var(--space-5);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        border: var(--border-medium);
        cursor: pointer;
        background: transparent;
        color: var(--_ink);
        transition: background var(--transition-fast), box-shadow var(--transition-fast);
      }

      .action--primary {
        background: var(--_stamp);
        border-color: var(--_stamp);
        color: var(--color-text-inverse);
        box-shadow: var(--shadow-sm);
      }

      .action--primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        box-shadow: var(--shadow-md);
      }

      .action--primary:active:not(:disabled) {
        box-shadow: var(--shadow-pressed);
      }

      .action--quiet {
        border-color: var(--_rule);
        color: var(--color-text-secondary);
        min-height: 44px;
      }

      .action--quiet:hover {
        color: var(--_ink);
        border-color: var(--_ink);
      }

      .action:disabled {
        opacity: 0.55;
        cursor: progress;
      }

      .action:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      /* ── Confirmation ───────────────────────────────────── */

      .receipt {
        border: var(--border-medium);
        border-color: var(--_done);
        background: var(--_done-wash);
        padding: var(--space-5);
        margin: 0 0 var(--space-6);
        display: flex;
        gap: var(--space-3);
        align-items: flex-start;
      }

      .receipt__icon {
        color: var(--_done);
        flex-shrink: 0;
        line-height: 0;
        margin-top: 2px;
      }

      .receipt__text {
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--_ink);
      }

      .receipt__text strong {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
      }

      /* Entrance: the slip settles once, nothing repeats. */
      .slip {
        animation: slip-in var(--duration-entrance) var(--ease-settle) both;
      }

      @keyframes slip-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 640px) {
        .slip {
          padding: var(--space-6) var(--space-4) var(--space-5);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `,
  ];

  @state() private _phase: Phase = 'reading';
  @state() private _category: UnsubscribeScope['category'] | null = null;

  private get _token(): string {
    return new URLSearchParams(window.location.search).get('token') ?? '';
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this._describe();
  }

  /** Read what the link covers. Deliberately does not act on it. */
  private async _describe(): Promise<void> {
    const token = this._token;
    if (!token) {
      this._phase = 'invalid';
      return;
    }
    const res = await notificationPreferencesApi.describeUnsubscribe(token);
    if (res.success && res.data) {
      this._category = res.data.category;
      this._phase = 'ready';
      return;
    }
    this._phase = 'invalid';
  }

  private async _confirm(): Promise<void> {
    this._phase = 'working';
    try {
      const res = await notificationPreferencesApi.confirmUnsubscribe(this._token);
      if (res.success) {
        this._phase = 'done';
        return;
      }
      this._phase = 'invalid';
    } catch (err) {
      captureError(err, { source: 'UnsubscribeView._confirm' });
      this._phase = 'invalid';
    }
  }

  private _categoryLabel(category: UnsubscribeScope['category']): string {
    switch (category) {
      case 'cycle_resolved':
        return msg('Cycle briefings');
      case 'phase_changed':
        return msg('Phase transitions');
      case 'epoch_completed':
        return msg('Closing reports');
      default:
        return msg('All epoch notifications');
    }
  }

  private _categoryNote(category: UnsubscribeScope['category']): string {
    switch (category) {
      case 'cycle_resolved':
        return msg(
          'The tactical briefing that arrives when a cycle resolves - your rank, your scores, what your operatives did.',
        );
      case 'phase_changed':
        return msg('The short note when an epoch moves into Foundation, Competition or Reckoning.');
      case 'epoch_completed':
        return msg('The final standings when an epoch ends.');
      default:
        return msg(
          'Every epoch email: cycle briefings, phase transitions and closing reports. Security and account emails are unaffected - those are never optional.',
        );
    }
  }

  protected render() {
    if (this._phase === 'reading') {
      return html`<velg-loading-state message=${msg('Checking the link')}></velg-loading-state>`;
    }

    if (this._phase === 'invalid') {
      return html`
        <velg-error-state
          message=${msg(
            'This unsubscribe link is not valid. It may have been altered on the way, or the address it was issued for no longer exists. You can still change everything from your notification settings.',
          )}
        ></velg-error-state>
        <div class="actions" style="margin-top: var(--space-5)">
          <button class="action action--quiet" @click=${() => navigate('/settings/notifications')}>
            ${msg('Open notification settings')}
          </button>
        </div>
      `;
    }

    if (this._phase === 'done') {
      return html`
        <article class="slip marker-corners">
          <p class="slip__kicker">${msg('Bureau of Multiverse Observation')}</p>
          <h1 class="slip__title">${msg('Withdrawal recorded')}</h1>

          <div class="receipt">
            <span class="receipt__icon">${icons.checkCircle(20)}</span>
            <p class="receipt__text">
              <strong>${this._categoryLabel(this._category ?? 'all')}</strong><br />
              ${msg('will no longer be sent to you. Nothing else about your account has changed.')}
            </p>
          </div>

          <p class="prose">
            ${msg(
              'If this was a mistake, you can switch it back on at any time - the setting lives with your account, not with this link.',
            )}
          </p>

          <div class="actions">
            <button class="action action--quiet" @click=${() => navigate('/settings/notifications')}>
              ${msg('Manage notifications')}
            </button>
          </div>
        </article>
      `;
    }

    const category = this._category ?? 'all';
    return html`
      <article class="slip marker-corners">
        <p class="slip__kicker">${msg('Bureau of Multiverse Observation')}</p>
        <h1 class="slip__title">${msg('Stop these emails?')}</h1>

        <div class="subject">
          <span class="subject__label">${msg('Subject of withdrawal')}</span>
          <span class="subject__value">${this._categoryLabel(category)}</span>
          <span class="subject__note">${this._categoryNote(category)}</span>
        </div>

        <p class="prose">
          ${msg(
            'Nothing has changed yet. Press the button below and the Bureau stops writing to you about this.',
          )}
        </p>

        <div class="actions">
          <button
            class="action action--primary"
            ?disabled=${this._phase === 'working'}
            @click=${this._confirm}
          >
            ${this._phase === 'working' ? msg('Recording...') : msg('Stop these emails')}
          </button>
          <button class="action action--quiet" @click=${() => navigate('/settings/notifications')}>
            ${msg('Choose individually instead')}
          </button>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-unsubscribe-view': VelgUnsubscribeView;
  }
}
