/**
 * Personnel File — Kopf, Reiter, fünf Blätter.
 *
 * Vorgeschichte: die Seite rief zwei Routen, die nie geschrieben wurden
 * (`PUT /users/me`, `GET /users/me/memberships`), zeigte deshalb bei jedem
 * Besuch ein Fehlerband und einen Speichern-Knopf, dessen einziger möglicher
 * Ausgang Fehlschlag war. Das ist seit Ende August repariert; was bleibt,
 * steht unten in den Aktionen.
 *
 * DIESER UMBAU (Design-Übergabe „Personalakte & Schlüsselbund") ersetzt den
 * Stapel aus fünf Sektionen durch Kopf + Reiter + Blätter. Der Grund ist
 * nicht Mode:
 *
 *  - Der Schlüsselbund ist ein Register mit Karten und braucht Breite. Im
 *    Stapel sass er zwischen Korrespondenz und Zuweisungen und bekam die
 *    780px der Formularspalte — also eine Karte je Zeile, egal wie breit der
 *    Schirm war.
 *  - Ein Stapel hat keine Adresse. Die Münze und das Autonomie-Panel
 *    verweisen auf den Schlüsselbund; ohne Reiter landete man oben und
 *    scrollte suchend. Jetzt `/profile#keys`.
 *  - Der Kopf beantwortet die Frage, für die man herkommt, ohne dass man
 *    blättert: **worauf läuft dieses Konto gerade** — eigener Schlüssel oder
 *    Projektschlüssel.
 *
 * Breite: `--stage-measure` statt der bisherigen 780px, und alle inneren
 * Umbrüche sind Container-Queries auf der Blattfläche. Die Akte wird auch im
 * Admin-Mount mit Seitenleiste gerendert; dort ergibt derselbe Viewport eine
 * andere Blattbreite, und eine Media-Query hätte dort das Falsche getan.
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
import { memberRoleLabel } from '../../utils/enum-labels.js';
import { icons } from '../../utils/icons.js';
import { navigate, updateUrl } from '../../utils/navigation.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../forge/VelgKeyring.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';
import '../shared/VelgBadge.js';
import '../shared/VelgHelpTip.js';
import '../shared/VelgTabs.js';
import '../shared/VelgToggle.js';

/** Die fünf Blätter. Reihenfolge ist die Reihenfolge der Reiter. */
const SHEET_KEYS = ['file', 'post', 'keys', 'postings', 'record'] as const;
type SheetKey = (typeof SHEET_KEYS)[number];

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
      /* Die Bühne statt der Formularbreite. Der Schlüsselbund ist ein
         Register mit Karten; mit 780px bekam er eine Karte je Zeile, egal
         wie breit der Schirm war. Ab 1920 begrenzt die Buehnenbreite, davor
         wächst die Akte mit. */
      max-width: var(--stage-measure);
      margin-inline: auto;
      padding-inline: var(--stage-gutter);
      padding-block: var(--content-padding, var(--space-6));
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
      --_stamp: var(--color-primary);
      --_stamp-wash: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    /* ── File header ───────────────────────────────────────── */

    /* Klebt oben, damit „Läuft auf …" und die Reiter beim Blättern durch ein
       langes Blatt (Zuweisungen) nicht davonlaufen. */
    .file-head {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding-block: var(--space-4) var(--space-3);
      background: var(--color-surface-sunken);
      border-bottom: 1px solid var(--color-border-light);
    }

    .file-head__line {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .file-head__no {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
    }

    /* ── Blattfläche ───────────────────────────────────────── */

    /* Jeder innere Umbruch reagiert auf DIESE Breite, nicht auf den Viewport:
       die Akte wird auch im Admin-Mount mit Seitenleiste gerendert, und dort
       ergibt derselbe Viewport eine andere Blattbreite. */
    .sheet {
      container-type: inline-size;
      padding-top: var(--space-6);
      animation: sheet-in var(--duration-slow) var(--ease-dramatic) both;
    }

    @keyframes sheet-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
      align-items: start;
    }

    @container (min-width: 900px) {
      .grid {
        grid-template-columns: minmax(0, 1fr) 320px;
      }
    }

    .grid__main,
    .single__body {
      min-width: 0;
    }

    .single__head {
      display: flex;
      justify-content: flex-end;
      margin-bottom: var(--space-3);
    }

    .single__note {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Auf einen Blick ───────────────────────────────────── */

    .glance {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--_rule);
      background: var(--color-surface-raised);
    }

    .glance__title {
      margin: 0;
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      border-bottom: 1px dashed var(--_rule);
    }

    .glance__row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      border-bottom: 1px dashed var(--color-border-light);
      color: var(--color-text-secondary);
      font-family: inherit;
      font-size: var(--text-sm);
      text-align: left;
      cursor: pointer;
    }

    .glance__row:last-child {
      border-bottom: none;
    }

    .glance__row:hover {
      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .glance__row:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: -2px;
    }

    .glance__value {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: right;
    }

    .glance__value[data-own] {
      color: var(--color-accent-green);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
      min-height: 36px;
      padding: var(--space-1-5) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--_rule);
      color: var(--color-text-secondary);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      cursor: pointer;
      transition: border-color var(--transition-fast), color var(--transition-fast);
    }

    .chip[data-active] {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
      box-shadow: 0 0 0 3px var(--color-accent-amber-glow);
    }

    .chip:hover:not(:disabled):not([data-active]) {
      border-color: var(--color-text-primary);
      color: var(--color-text-primary);
    }

    .chip:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    .chip:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .posting__key {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }

    .posting__key[data-own] {
      color: var(--color-accent-green);
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

  /** Welches Blatt oben liegt. Kommt aus dem Anker, damit `/profile#keys` trägt. */
  @state() private _tab: SheetKey = 'file';

  connectedCallback(): void {
    super.connectedCallback();
    this._readDisplayNameFromSession();
    this._readTabFromHash();
    window.addEventListener('hashchange', this._onHashChange);
    void this._load();
  }

  disconnectedCallback(): void {
    window.removeEventListener('hashchange', this._onHashChange);
    super.disconnectedCallback();
  }

  /**
   * Der Anker ist die Adresse eines Blatts. Die Münze und das
   * Autonomie-Panel verweisen auf `#keys`; ohne diesen Weg landete man oben
   * und suchte.
   */
  private _readTabFromHash(): void {
    const key = window.location.hash.replace('#', '');
    if (SHEET_KEYS.includes(key as SheetKey)) {
      this._tab = key as SheetKey;
    }
  }

  private _onHashChange = (): void => {
    this._readTabFromHash();
  };

  private _selectTab(key: SheetKey): void {
    if (key === this._tab) return;
    this._tab = key;
    // `updateUrl` vergleicht nur Pfad und Suche, nie den Anker — ein zweiter
    // Aufruf mit demselben Blatt würde also einen weiteren Verlaufseintrag
    // schreiben. Deshalb steht der Vergleich hier davor.
    updateUrl(`${window.location.pathname}#${key}`);
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
      // `<velg-keyring>` liest. Es fängt seine Fehler selbst ab und gibt
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
      <velg-tabs
        .tabs=${this._tabDefs()}
        active=${this._tab}
        @tab-change=${(e: CustomEvent<{ key: string }>) => this._selectTab(e.detail.key as SheetKey)}
      ></velg-tabs>
      <div class="sheet" data-sheet=${this._tab}>${this._renderSheet()}</div>
    `;
  }

  private _tabDefs() {
    const byok = forgeStateManager.byokStatus.value;
    const hasKey = byok.has_openrouter_key || byok.has_replicate_key;
    // Der Reiter trägt genau so viel, wie ohne Öffnen wahr ist: einen Punkt,
    // wenn ein Schlüssel liegt, sonst nichts. Eine Zahl wäre hier eine
    // Behauptung über Zustände, die man erst im Blatt sieht.
    return [
      { key: 'file', label: msg('File') },
      { key: 'post', label: msg('Correspondence') },
      { key: 'keys', label: msg('Keyring'), badge: hasKey ? '●' : undefined },
      {
        key: 'postings',
        label: msg('Postings'),
        badge: this._account?.memberships.length || undefined,
      },
      { key: 'record', label: msg('Record') },
    ];
  }

  private _renderSheet() {
    switch (this._tab) {
      case 'post':
        return this._renderCorrespondence();
      case 'keys':
        return this._renderKeyring();
      case 'postings':
        return this._renderPostings();
      case 'record':
        return this._renderRecord();
      default:
        return this._renderIdentity();
    }
  }

  private _renderHead() {
    const account = this._account;
    const email = account?.email ?? appState.user.value?.email ?? '';
    const name = this._savedDisplayName.trim();
    const byok = forgeStateManager.byokStatus.value;
    const ownKey = byok.has_openrouter_key || byok.has_replicate_key;

    return html`
      <header class="file-head">
        <div class="file-head__line">
          <h1 class="file-head__title">${msg('Personnel File')}</h1>
          ${account ? html`<span class="file-head__no">${this._fileNumber(account.id)}</span>` : nothing}
        </div>
        <p class="file-head__subject">
          ${name ? html`${name} · ` : nothing}${email}
        </p>
        <div class="file-head__marks">
          ${
            account?.is_platform_admin
              ? html`<velg-badge variant="warning">${msg('Platform admin')}</velg-badge>`
              : nothing
          }
          ${
            appState.isArchitect.value
              ? html`<velg-badge variant="primary">${msg('Architect')}</velg-badge>`
              : nothing
          }
          <velg-badge variant="default">
            ${msg(str`${account?.memberships.length ?? 0} postings`)}
          </velg-badge>
          <!-- Die Frage, für die man herkommt, ohne dass man blättern muss. -->
          <velg-badge variant=${ownKey ? 'success' : 'default'}>
            ${ownKey ? msg('Running on · your own key') : msg('Running on · the project key')}
          </velg-badge>
        </div>
      </header>
    `;
  }

  /**
   * Eine Aktennummer, die aus der Kennung folgt statt aus einem Zähler.
   *
   * Sie hat keine Bedeutung im Datenbestand — sie ist ein Wiedererkennungs-
   * zeichen für den Menschen, der zwei Akten nebeneinander hat. Deshalb aus
   * den ersten Zeichen der UUID abgeleitet und nicht gespeichert: eine
   * gespeicherte Nummer müsste vergeben, geprüft und migriert werden, und
   * niemand hätte etwas davon.
   */
  private _fileNumber(id: string): string {
    return `P-${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}`;
  }

  private _renderIdentity() {
    const dirty = this._displayName.trim() !== this._savedDisplayName;
    return html`
      <div class="grid">
        <div class="grid__main">
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
        ${this._renderAtAGlance()}
      </div>
    `;
  }

  /**
   * Was die Akte über dieses Konto weiss, in vier Zeilen.
   *
   * Sie steht neben dem Formular, weil sie die Fragen beantwortet, für die
   * man sonst durch die Reiter blättert. Jede Zeile verweist auf ihr Blatt —
   * ein Überblick, der nicht weiterführt, ist Zierat.
   */
  private _renderAtAGlance() {
    const account = this._account;
    const byok = forgeStateManager.byokStatus.value;
    const ownKey = byok.has_openrouter_key || byok.has_replicate_key;
    const prefs = this._prefs;
    const letters = [prefs?.cycle_resolved, prefs?.phase_changed, prefs?.epoch_completed].filter(
      Boolean,
    ).length;

    return html`
      <aside class="glance">
        <p class="glance__title">${msg('At a glance')}</p>
        <button class="glance__row" @click=${() => this._selectTab('keys')}>
          <span>${msg('Keyring')}</span>
          <span class="glance__value" ?data-own=${ownKey}>
            ${ownKey ? msg('your own keys') : msg('project key')}
          </span>
        </button>
        <button class="glance__row" @click=${() => this._selectTab('post')}>
          <span>${msg('Post')}</span>
          <span class="glance__value">
            ${CORRESPONDENCE_LOCALES.find((l) => l.code === (prefs?.email_locale ?? 'en'))?.label ?? 'English'}
            ${msg(str`· ${letters} of 3 letters`)}
          </span>
        </button>
        <button class="glance__row" @click=${() => this._selectTab('postings')}>
          <span>${msg('Postings')}</span>
          <span class="glance__value">${account?.memberships.length ?? 0}</span>
        </button>
        <button class="glance__row" @click=${() => this._selectTab('record')}>
          <span>${msg('Academy')}</span>
          <span class="glance__value">
            ${msg(str`${account?.academy_epochs_played ?? 0} epochs`)}
            ${account?.onboarding_completed ? ' ✓' : ''}
          </span>
        </button>
      </aside>
    `;
  }

  private _renderCorrespondence() {
    const prefs = this._prefs;
    const dirty = this._prefsDirty;

    return html`
      <div class="single">
        <div class="single__body">
          <div class="field">
            <label class="field__label" for="profile-locale">${msg('Language of the post')}</label>
            <!-- Zwei Werte sind keine Liste. Eine Auswahlliste verlangt zwei
                 Handgriffe (öffnen, wählen) und verbirgt die Alternative;
                 zwei Chips zeigen beide und brauchen einen. -->
            <div class="chips" role="radiogroup" aria-label=${msg('Language of the post')}>
              ${CORRESPONDENCE_LOCALES.map((l) => {
                const active = l.code === (prefs?.email_locale ?? 'en');
                return html`
                  <button
                    class="chip"
                    role="radio"
                    aria-checked=${active ? 'true' : 'false'}
                    ?data-active=${active}
                    ?disabled=${!prefs}
                    @click=${() => this._setPref('email_locale', l.code)}
                  >
                    ${l.label}
                  </button>
                `;
              })}
            </div>
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
      </div>
    `;
  }

  private _renderKeyring() {
    return html`
      <div class="single">
        <div class="single__head">
          <span class="single__note">
            ${msg("yours, not a world's")}
            <velg-help-tip topic="byok" label=${msg('What is BYOK?')}></velg-help-tip>
          </span>
        </div>
        <div class="single__body">
          <p class="field__hint keyring__lede">
            ${msg('Without a key of your own, everything runs on the project key – that is the normal case and costs you nothing. A key entered here is used instead, for the worlds you forge and for the ones you own.')}
          </p>
          <velg-keyring></velg-keyring>
        </div>
      </div>
    `;
  }

  private _renderPostings() {
    const postings = this._account?.memberships ?? [];
    return html`
      <div class="single">
        <div class="single__head">
          <span class="single__note">${msg(str`${postings.length} on file`)}</span>
        </div>
        <div class="single__body">
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
                          <span class="posting__role">${memberRoleLabel(m.member_role)}</span>
                          ${
                            m.joined_at
                              ? html`<span>${msg(str`since ${formatDate(m.joined_at)}`)}</span>`
                              : nothing
                          }
                          ${this._renderPullingKey(m)}
                        </span>
                      </button>
                    `,
                  )}
                </div>
              `
          }
        </div>
      </div>
    `;
  }

  /**
   * Welcher Schlüssel in DIESER Welt zieht.
   *
   * Die Auskunft folgt dem Backend und behauptet nichts darüber hinaus: der
   * persönliche Schlüssel greift an zwei Stellen — beim Schmieden (eigener
   * Entwurf) und in Phase 9 des Herzschlags, und dort ist es der Schlüssel
   * des WELT-BESITZERS. Für eine Welt, in der man Betrachter oder Redakteur
   * ist, zieht er also nicht, auch wenn er hinterlegt ist.
   *
   * Was hier bewusst FEHLT: ob die Welt selbst einen Schlüssel in ihren
   * Einstellungen trägt (der ginge vor). Diese Auskunft gibt zurzeit kein
   * Endpunkt für fremde Welten heraus, und eine geratene wäre schlechter als
   * keine.
   */
  private _renderPullingKey(m: MembershipInfo) {
    const byok = forgeStateManager.byokStatus.value;
    const ownKey = byok.has_openrouter_key || byok.has_replicate_key;
    const pulls = ownKey && m.member_role === 'owner';
    return html`<span class="posting__key" ?data-own=${pulls}>
      ${pulls ? msg('your key') : msg('project key')}
    </span>`;
  }

  private _renderRecord() {
    const account = this._account;
    if (!account) return nothing;
    return html`
      <div class="single">
        <div class="single__body">
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-user-profile-view': VelgUserProfileView;
  }
}
