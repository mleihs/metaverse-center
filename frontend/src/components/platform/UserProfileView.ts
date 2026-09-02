/**
 * Personnel File — the account page, rebuilt around endpoints that exist.
 *
 * The page called two routes that were never written: `PUT /users/me` behind
 * the Save button and `GET /users/me/memberships` behind the list. Every visit
 * therefore produced an error banner where the memberships belonged, and a Save
 * button whose only possible outcome was failure. Nothing in the interface said
 * so, and no menu linked here at all - which is presumably why it stayed broken.
 *
 * What replaces them:
 *   - Memberships come from `GET /users/me`, which has always returned them.
 *   - The display name is Supabase Auth data (`user_metadata`) and is written
 *     straight through the auth client, per the hybrid pattern in CLAUDE.md.
 *   - The language of Bureau correspondence is a real, separate setting
 *     (`notification_preferences.email_locale`) with a real endpoint, and is
 *     stated as what it is: the language of the post, not of the interface.
 *
 * The page reads as a personnel file: a header stamp with the account's
 * standing, a form on ruled lines, and the postings as register rows that
 * cascade in. The two figures the platform actually keeps about a person -
 * academy epochs played, and whether the induction was completed - are shown
 * rather than hidden, because a file that omits its own record is decoration.
 *
 * The Keyring section is here for the same reason the rest of the page is: an
 * API key belongs to the PERSON. It used to live in `user_wallets` behind the
 * Architect gate, inside a modal called The Mint - three words from the
 * Forge's economy for a thing that is not an economy - and on production not
 * one account could reach it. The form itself is `<velg-byok-panel>`,
 * reused rather than copied; the Mint now links here instead of hosting it.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { usersApi } from '../../services/api/index.js';
import { notificationPreferencesApi } from '../../services/api/NotificationPreferencesApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { authService } from '../../services/supabase/SupabaseAuthService.js';
import type { MembershipInfo, NotificationPreferences, UserAccount } from '../../types/index.js';
import { formatDate } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../forge/VelgByokPanel.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import '../shared/VelgBadge.js';
import '../shared/VelgHelpTip.js';
import '../shared/VelgToggle.js';

const CORRESPONDENCE_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
] as const;

@localized()
@customElement('velg-user-profile-view')
export class VelgUserProfileView extends SignalWatcher(LitElement) {
  static styles = [
    markerCornerStyles,
    css`
    :host {
      display: block;
      padding: var(--content-padding, var(--space-6));
      max-width: 780px;
      margin: 0 auto;
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
      --_stamp: var(--color-primary);
      --_stamp-wash: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    /* ── File header ───────────────────────────────────────── */

    .file-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding-bottom: var(--space-3);
      margin-bottom: var(--space-6);
      border-bottom: var(--border-medium);
    }

    .file-head__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1.5rem, 4vw, var(--text-2xl));
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      color: var(--_ink);
    }

    .file-head__subject {
      display: block;
      margin-top: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      text-transform: none;
      overflow-wrap: anywhere;
    }

    .file-head__marks {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    /* ── Sections ──────────────────────────────────────────── */

    .section {
      background: var(--color-surface-raised);
      border: 1px solid var(--_rule);
      box-shadow: var(--shadow-md);
      margin-bottom: var(--space-6);
      opacity: 0;
      animation: section-in var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade));
    }

    @keyframes section-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    .section__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      background: var(--color-surface-header);
      border-bottom: 1px dashed var(--_rule);
    }

    .section__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
      color: var(--_ink);
    }

    .section__note {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .section__body {
      padding: var(--space-5);
    }

    /* ── Form on ruled lines ───────────────────────────────── */

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      padding-bottom: var(--space-4);
      margin-bottom: var(--space-4);
      border-bottom: 1px dashed var(--color-border-light);
    }

    .field:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .field__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .field__hint {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-muted);
    }

    .keyring__lede {
      margin: 0 0 var(--space-4);
      line-height: var(--leading-relaxed);
    }

    .field__input,
    .field__select {
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-2-5) var(--space-3);
      min-height: 44px;
      background: var(--color-surface);
      border: 1px solid var(--_rule);
      border-radius: var(--border-radius-none);
      color: var(--_ink);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      transition: border-color var(--transition-fast);
    }

    .field__input:focus-visible,
    .field__select:focus-visible {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .field__input--readonly {
      color: var(--color-text-muted);
      cursor: not-allowed;
    }

    .switches {
      display: flex;
      flex-direction: column;
      gap: var(--space-2-5);
      padding: var(--space-1) 0;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-top: var(--space-5);
    }

    .save-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-5);
      min-height: 44px;
      background: var(--color-surface);
      border: 2px solid var(--_stamp);
      color: var(--_stamp);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      box-shadow: var(--shadow-xs);
      transition:
        background-color var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .save-btn:hover:not([disabled]) {
      background: var(--_stamp-wash);
      box-shadow: var(--shadow-sm);
    }

    .save-btn:active:not([disabled]) {
      box-shadow: var(--shadow-pressed);
    }

    .save-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .save-btn[disabled] {
      border-color: var(--_rule);
      color: var(--color-text-muted);
      cursor: not-allowed;
      box-shadow: none;
    }

    .actions--inline {
      margin-top: var(--space-2);
    }

    .save-btn--quiet {
      border-color: var(--_rule);
      color: var(--color-text-secondary);
    }

    .save-btn--quiet:hover:not([disabled]) {
      border-color: var(--_stamp);
      color: var(--_stamp);
    }

    .actions__state {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Postings register ─────────────────────────────────── */

    .register {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .posting {
      --marker-color: var(--_rule);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-3);
      min-height: 44px;
      text-align: left;
      background: var(--color-surface);
      border: 1px solid var(--_rule);
      color: var(--_ink);
      cursor: pointer;
      opacity: 0;
      animation: posting-in var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger));
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast);
    }

    @keyframes posting-in {
      from {
        opacity: 0;
        transform: translateX(-8px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    .posting:hover {
      --marker-color: var(--_stamp);
      border-color: var(--_stamp);
      background: var(--_stamp-wash);
    }

    .posting:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .posting__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      overflow-wrap: anywhere;
    }

    .posting__meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .posting__role {
      color: var(--_stamp);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
    }

    .empty {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
    }

    .record {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--space-4);
    }

    .record__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .record__value {
      font-family: var(--font-mono);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--_stamp);
      font-variant-numeric: tabular-nums;
    }

    .record__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    @media (max-width: 640px) {
      .posting {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .posting__meta {
        white-space: normal;
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

  @state() private _account: UserAccount | null = null;
  @state() private _loading = true;
  @state() private _error: string | null = null;

  @state() private _displayName = '';
  @state() private _savedDisplayName = '';
  @state() private _savingName = false;
  @state() private _sendingReset = false;

  @state() private _prefs: NotificationPreferences | null = null;
  @state() private _savedPrefs: NotificationPreferences | null = null;
  @state() private _savingPrefs = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._readDisplayNameFromSession();
    void this._load();
  }

  private _readDisplayNameFromSession(): void {
    const user = appState.user.value;
    const name = (user?.user_metadata?.display_name as string | undefined) ?? '';
    this._displayName = name;
    this._savedDisplayName = name;
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      // `loadWallet` füllt `forgeStateManager.byokStatus`, aus dem
      // `<velg-byok-panel>` liest. Es fängt seine Fehler selbst ab und gibt
      // null zurück — ein Ausfall der Geldbörse darf die Akte nicht kippen.
      const [accountRes, prefsRes] = await Promise.all([
        usersApi.getMe(),
        notificationPreferencesApi.getPreferences(),
        forgeStateManager.loadWallet(),
      ]);

      if (accountRes.success && accountRes.data) {
        this._account = accountRes.data;
      } else {
        this._error = accountRes.error?.message ?? msg('The file could not be retrieved.');
      }

      if (prefsRes.success && prefsRes.data) {
        const prefs = { ...prefsRes.data, email_locale: prefsRes.data.email_locale || 'en' };
        this._prefs = prefs;
        this._savedPrefs = { ...prefs };
      }
    } catch (err) {
      captureError(err, { source: 'VelgUserProfileView._load' });
      this._error = msg('The file could not be retrieved.');
    } finally {
      this._loading = false;
    }
  }

  // ── Actions ───────────────────────────────────────────────

  private async _saveDisplayName(): Promise<void> {
    const next = this._displayName.trim();
    if (this._savingName || next === this._savedDisplayName) return;

    this._savingName = true;
    try {
      const { error } = await authService.updateDisplayName(next);
      if (error) {
        captureError(error, { source: 'VelgUserProfileView._saveDisplayName' });
        VelgToast.error(error.message || msg('The name could not be entered.'));
        return;
      }
      this._savedDisplayName = next;
      this._displayName = next;
      VelgToast.success(msg('Name entered in the file.'));
    } catch (err) {
      captureError(err, { source: 'VelgUserProfileView._saveDisplayName' });
      VelgToast.error(msg('The name could not be entered.'));
    } finally {
      this._savingName = false;
    }
  }

  private async _sendPasswordReset(): Promise<void> {
    const email = this._account?.email ?? appState.user.value?.email ?? '';
    if (!email || this._sendingReset) return;

    this._sendingReset = true;
    try {
      const { error } = await authService.resetPassword(email);
      if (error) {
        captureError(error, { source: 'VelgUserProfileView._sendPasswordReset' });
        VelgToast.error(error.message || msg('The letter could not be sent.'));
        return;
      }
      VelgToast.success(msg('A reset letter is on its way to your address.'));
    } catch (err) {
      captureError(err, { source: 'VelgUserProfileView._sendPasswordReset' });
      VelgToast.error(msg('The letter could not be sent.'));
    } finally {
      this._sendingReset = false;
    }
  }

  private get _prefsDirty(): boolean {
    const a = this._prefs;
    const b = this._savedPrefs;
    if (!a || !b) return false;
    return (
      a.email_locale !== b.email_locale ||
      a.cycle_resolved !== b.cycle_resolved ||
      a.phase_changed !== b.phase_changed ||
      a.epoch_completed !== b.epoch_completed
    );
  }

  private _setPref<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ): void {
    if (!this._prefs) return;
    this._prefs = { ...this._prefs, [key]: value };
  }

  private async _savePrefs(): Promise<void> {
    const prefs = this._prefs;
    if (!prefs || this._savingPrefs || !this._prefsDirty) return;

    this._savingPrefs = true;
    try {
      const res = await notificationPreferencesApi.updatePreferences(prefs);
      if (res.success && res.data) {
        const saved = { ...res.data, email_locale: res.data.email_locale || 'en' };
        this._prefs = saved;
        this._savedPrefs = { ...saved };
        VelgToast.success(msg('Correspondence preferences saved.'));
      } else {
        VelgToast.error(res.error?.message ?? msg('The preference could not be saved.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgUserProfileView._savePrefs' });
      VelgToast.error(msg('The preference could not be saved.'));
    } finally {
      this._savingPrefs = false;
    }
  }

  private _openPosting(m: MembershipInfo): void {
    navigate(`/simulations/${m.simulation_slug || m.simulation_id}/agents`);
  }

  // ── Render ────────────────────────────────────────────────

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Retrieving the file')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${() => void this._load()}
        ></velg-error-state>
      `;
    }

    return html`
      ${this._renderHead()}
      ${this._renderIdentity()}
      ${this._renderCorrespondence()}
      ${this._renderKeyring()}
      ${this._renderPostings()}
      ${this._renderRecord()}
    `;
  }

  private _renderHead() {
    const email = this._account?.email ?? appState.user.value?.email ?? '';
    return html`
      <header class="file-head">
        <h1 class="file-head__title">
          ${msg('Personnel File')}
          <span class="file-head__subject">${email}</span>
        </h1>
        <div class="file-head__marks">
          ${
            this._account?.is_platform_admin
              ? html`<velg-badge variant="warning">${msg('Platform admin')}</velg-badge>`
              : nothing
          }
          ${
            appState.isArchitect.value
              ? html`<velg-badge variant="primary">${msg('Architect')}</velg-badge>`
              : nothing
          }
          <velg-badge variant="default">
            ${msg(str`${this._account?.memberships.length ?? 0} postings`)}
          </velg-badge>
        </div>
      </header>
    `;
  }

  private _renderIdentity() {
    const dirty = this._displayName.trim() !== this._savedDisplayName;
    return html`
      <section class="section" style="--i: 0">
        <div class="section__head">
          <h2 class="section__title">${msg('Identity')}</h2>
        </div>
        <div class="section__body">
          <div class="field">
            <label class="field__label" for="profile-email">${msg('Registered address')}</label>
            <input
              class="field__input field__input--readonly"
              id="profile-email"
              type="email"
              .value=${this._account?.email ?? ''}
              readonly
            />
            <span class="field__hint">
              ${msg('The address the Bureau writes to. It cannot be changed here.')}
            </span>
          </div>

          <div class="field">
            <label class="field__label" for="profile-display-name">${msg('Display name')}</label>
            <input
              class="field__input"
              id="profile-display-name"
              type="text"
              maxlength="64"
              placeholder=${msg('How others see you')}
              .value=${this._displayName}
              @input=${(e: Event) => {
                this._displayName = (e.target as HTMLInputElement).value;
              }}
            />
            <span class="field__hint">
              ${msg('Shown beside your entries. Leave it empty to appear under your address.')}
            </span>
          </div>

          <div class="field">
            <span class="field__label">${msg('Passphrase')}</span>
            <span class="field__hint">
              ${msg('The Bureau does not hold your passphrase and cannot show it. It can send a letter that lets you set a new one.')}
            </span>
            <div class="actions actions--inline">
              <button
                class="save-btn save-btn--quiet"
                ?disabled=${this._sendingReset}
                @click=${this._sendPasswordReset}
              >
                ${icons.key(16)}
                ${this._sendingReset ? msg('Sending...') : msg('Send reset letter')}
              </button>
            </div>
          </div>

          <div class="actions">
            <button
              class="save-btn"
              ?disabled=${!dirty || this._savingName}
              @click=${this._saveDisplayName}
            >
              ${icons.stampClassified(16)}
              ${this._savingName ? msg('Entering...') : msg('Enter name')}
            </button>
            ${dirty ? html`<span class="actions__state">${msg('Unsaved change')}</span>` : nothing}
          </div>
        </div>
      </section>
    `;
  }

  private _renderCorrespondence() {
    const prefs = this._prefs;
    const dirty = this._prefsDirty;

    return html`
      <section class="section" style="--i: 1">
        <div class="section__head">
          <h2 class="section__title">${msg('Correspondence')}</h2>
          <span class="section__note">${msg('the post, not the interface')}</span>
        </div>
        <div class="section__body">
          <div class="field">
            <label class="field__label" for="profile-locale">${msg('Language of the post')}</label>
            <select
              class="field__select"
              id="profile-locale"
              ?disabled=${!prefs}
              @change=${(e: Event) => {
                this._setPref('email_locale', (e.target as HTMLSelectElement).value);
              }}
            >
              ${CORRESPONDENCE_LOCALES.map(
                (l) => html`
                  <option value=${l.code} ?selected=${l.code === (prefs?.email_locale ?? 'en')}>
                    ${l.label}
                  </option>
                `,
              )}
            </select>
            <span class="field__hint">
              ${msg('Cycle briefings, invitations and epoch reports arrive in this language. The language of this interface follows the switch in the header.')}
            </span>
          </div>

          <div class="field">
            <span class="field__label">${msg('Which letters reach you')}</span>
            <div class="switches">
              <velg-toggle
                size="sm"
                label=${msg('A cycle has been resolved')}
                .checked=${prefs?.cycle_resolved ?? true}
                ?disabled=${!prefs}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                  this._setPref('cycle_resolved', e.detail.checked)}
              ></velg-toggle>
              <velg-toggle
                size="sm"
                label=${msg('An epoch has entered a new phase')}
                .checked=${prefs?.phase_changed ?? true}
                ?disabled=${!prefs}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                  this._setPref('phase_changed', e.detail.checked)}
              ></velg-toggle>
              <velg-toggle
                size="sm"
                label=${msg('An epoch has closed')}
                .checked=${prefs?.epoch_completed ?? true}
                ?disabled=${!prefs}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                  this._setPref('epoch_completed', e.detail.checked)}
              ></velg-toggle>
            </div>
            <span class="field__hint">
              ${msg('These hold for every world at once – the Bureau keeps one register per person, not one per posting.')}
            </span>
          </div>

          <div class="actions">
            <button
              class="save-btn"
              ?disabled=${!dirty || this._savingPrefs}
              @click=${this._savePrefs}
            >
              ${icons.stampClassified(16)}
              ${this._savingPrefs ? msg('Saving...') : msg('Save preferences')}
            </button>
            ${dirty ? html`<span class="actions__state">${msg('Unsaved change')}</span>` : nothing}
          </div>
        </div>
      </section>
    `;
  }

  private _renderKeyring() {
    return html`
      <section class="section" style="--i: 2">
        <div class="section__head">
          <h2 class="section__title">${msg('Keyring')}</h2>
          <span class="section__note">
            ${msg("yours, not a world's")}
            <velg-help-tip topic="byok" label=${msg('What is BYOK?')}></velg-help-tip>
          </span>
        </div>
        <div class="section__body">
          <p class="field__hint keyring__lede">
            ${msg('Without a key of your own, everything runs on the project key – that is the normal case and costs you nothing. A key entered here is used instead, for the worlds you forge and for the ones you own.')}
          </p>
          <velg-byok-panel></velg-byok-panel>
        </div>
      </section>
    `;
  }

  private _renderPostings() {
    const postings = this._account?.memberships ?? [];
    return html`
      <section class="section" style="--i: 3">
        <div class="section__head">
          <h2 class="section__title">${msg('Postings')}</h2>
          <span class="section__note">${msg(str`${postings.length} on file`)}</span>
        </div>
        <div class="section__body">
          ${
            postings.length === 0
              ? html`<p class="empty">
                ${msg('No postings on file. Join a world, or found one, and it is entered here.')}
              </p>`
              : html`
                <div class="register">
                  ${postings.map(
                    (m, i) => html`
                      <button
                        class="posting marker-corners"
                        style="--i: ${i}"
                        @click=${() => this._openPosting(m)}
                      >
                        <span class="posting__name">${m.simulation_name}</span>
                        <span class="posting__meta">
                          <span class="posting__role">${m.member_role}</span>
                          ${
                            m.joined_at
                              ? html`<span>${msg(str`since ${formatDate(m.joined_at)}`)}</span>`
                              : nothing
                          }
                        </span>
                      </button>
                    `,
                  )}
                </div>
              `
          }
        </div>
      </section>
    `;
  }

  private _renderRecord() {
    const account = this._account;
    if (!account) return nothing;
    return html`
      <section class="section" style="--i: 4">
        <div class="section__head">
          <h2 class="section__title">${msg('Record')}</h2>
        </div>
        <div class="section__body">
          <div class="record">
            <div class="record__item">
              <span class="record__value">${account.academy_epochs_played}</span>
              <span class="record__label">${msg('Academy epochs played')}</span>
            </div>
            <div class="record__item">
              <span class="record__value">
                ${account.onboarding_completed ? msg('Yes') : msg('No')}
              </span>
              <span class="record__label">${msg('Induction completed')}</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-user-profile-view': VelgUserProfileView;
  }
}
