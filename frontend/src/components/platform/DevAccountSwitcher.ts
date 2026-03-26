/**
 * Dev Account Switcher — System Identity Registry.
 *
 * Searchable dropdown listing ALL registered platform users.
 * Fetches from admin API on first open, caches in memory.
 *
 * In production: password gate (sessionStorage-backed) protects access.
 * In dev: dropdown opens immediately.
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { adminApi } from '../../services/api/AdminApiService.js';
import { supabase } from '../../services/supabase/client.js';
import type { AdminUser } from '../../types/index.js';

const DEV_PASSWORD = (import.meta.env.VITE_DEV_SWITCHER_PASSWORD as string) || '';
const GATE_PASSWORD = (import.meta.env.VITE_DEV_SWITCHER_PASSWORD as string) || '';
const GATE_STORAGE_KEY = 'dev-switcher-unlocked';

interface ResolvedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'architect' | 'user';
  lastSignIn: string;
}

function resolveUser(u: AdminUser, isCurrentUser: boolean): ResolvedUser {
  const meta = u.raw_user_meta_data ?? {};
  const displayName = (meta.display_name as string) || (meta.name as string) || '';
  const isAdmin = isCurrentUser && appState.isPlatformAdmin.value;
  const role: ResolvedUser['role'] = isAdmin ? 'admin' : u.is_architect ? 'architect' : 'user';
  const lastSignIn = u.last_sign_in_at
    ? new Date(u.last_sign_in_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : '—';
  return { id: u.id, email: u.email, displayName, role, lastSignIn };
}

@customElement('velg-dev-account-switcher')
export class VelgDevAccountSwitcher extends LitElement {
  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      align-items: center;
      position: relative;
      z-index: var(--z-dropdown, 100);
    }

    /* ── DEV Tag ── */

    .tag {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      padding: 3px 7px;
      color: var(--color-surface);
      background: var(--color-primary);
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, transform 0.1s ease;
      position: relative;
    }

    .tag:hover {
      background: var(--color-primary-hover);
      transform: translateY(-1px);
    }

    .tag:active {
      transform: translateY(0);
    }

    .tag--open {
      background: var(--color-primary-hover);
    }

    .tag--open::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--color-primary-hover);
    }

    /* ── Backdrop ── */

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay, 90);
    }

    /* ── Panel ── */

    .panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 340px;
      max-height: 440px;
      z-index: var(--z-modal, 200);

      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-top: 2px solid var(--color-primary);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.7),
        0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent),
        inset 0 1px 0 rgba(255, 255, 255, 0.03);

      display: flex;
      flex-direction: column;
      overflow: hidden;

      animation: panel-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
      transform-origin: top right;
    }

    @keyframes panel-enter {
      from {
        opacity: 0;
        transform: translateY(-6px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* ── Header ── */

    .panel__header {
      padding: 10px 12px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }

    .panel__title {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel__title-text {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-muted);
    }

    .panel__count {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 0.05em;
    }

    /* ── Search ── */

    .search {
      position: relative;
    }

    .search__input {
      width: 100%;
      padding: 7px 10px 7px 28px;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      letter-spacing: 0.02em;
      color: var(--color-text-tertiary);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .search__input::placeholder {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .search__input:focus {
      border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    .search__icon {
      position: absolute;
      left: 9px;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 12px;
      color: var(--color-text-muted);
      pointer-events: none;
    }

    /* ── Divider ── */

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--color-border) 20%, var(--color-border) 80%, transparent);
      margin: 8px 0 0;
      flex-shrink: 0;
    }

    /* ── User List ── */

    .list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;

      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    .list::-webkit-scrollbar {
      width: 4px;
    }
    .list::-webkit-scrollbar-track {
      background: transparent;
    }
    .list::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 2px;
    }

    .user {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      gap: 0 10px;
      align-items: center;
      padding: 7px 12px;
      cursor: pointer;
      transition: background 0.12s ease;
      border-left: 2px solid transparent;
    }

    .user:hover {
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
      border-left-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
    }

    .user--focused {
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      border-left-color: var(--color-primary);
    }

    .user--current {
      background: color-mix(in srgb, var(--color-primary) 4%, transparent);
      border-left-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    .user--current::after {
      content: '●';
      grid-row: 1 / -1;
      grid-column: 2;
      font-size: 6px;
      color: var(--color-primary);
      align-self: center;
    }

    .user__email {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      grid-column: 1;
      transition: color 0.12s ease;
    }

    .user:hover .user__email,
    .user--focused .user__email {
      color: var(--color-text-secondary);
    }

    .user__meta {
      display: flex;
      align-items: center;
      gap: 6px;
      grid-column: 1;
    }

    .user__name {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user__role {
      font-family: var(--font-brutalist);
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 1px 4px;
      line-height: 1.3;
      flex-shrink: 0;
    }

    .user__role--admin {
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    }

    .user__role--architect {
      color: var(--color-success);
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-success) 20%, transparent);
    }

    .user__role--user {
      color: var(--color-text-muted);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--color-border);
    }

    /* ── States ── */

    .loading, .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 12px;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .loading::after {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-left: 8px;
      border: 1px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-msg {
      padding: 8px 12px;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 6%, transparent);
      border-top: 1px solid var(--color-danger-glow);
    }

    :host(.switching) .panel {
      opacity: 0.5;
      pointer-events: none;
    }

    /* ── Gate (production password) ── */

    .gate-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay, 90);
    }

    .gate {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: var(--z-modal, 200);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      border-top: 2px solid var(--color-primary);
      padding: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      animation: panel-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
      transform-origin: top right;
    }

    .gate__input {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      padding: 4px 8px;
      width: 90px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-tertiary);
      outline: none;
      transition: border-color 0.2s ease;
    }

    .gate__input:focus {
      border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
    }

    .gate__input--error {
      border-color: var(--color-danger);
    }

    .gate__btn {
      font-family: var(--font-brutalist);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border: 1px solid var(--color-primary);
      background: transparent;
      color: var(--color-primary);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .gate__btn:hover {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    .gate__error {
      position: absolute;
      top: 100%;
      left: 10px;
      margin-top: 4px;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-danger);
      white-space: nowrap;
    }

  `;

  // ── State ──

  @state() private _open = false;
  @state() private _users: ResolvedUser[] = [];
  @state() private _loading = false;
  @state() private _fetchError = '';
  @state() private _switchError = '';
  @state() private _search = '';
  @state() private _focusIndex = -1;
  // Gate state (production only)
  @state() private _unlocked = sessionStorage.getItem(GATE_STORAGE_KEY) === 'true';
  @state() private _gateOpen = false;
  @state() private _gateError = '';

  @query('.search__input') private _searchInput!: HTMLInputElement;
  @query('.gate__input') private _gateInput!: HTMLInputElement;

  private _userCache: ResolvedUser[] | null = null;

  // ── Lifecycle ──

  private _boundKeydown = this._handleKeydown.bind(this);

  private _boundUserDeleted = () => {
    this._userCache = null;
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('user-deleted', this._boundUserDeleted);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._boundKeydown);
    document.removeEventListener('user-deleted', this._boundUserDeleted);
  }

  // ── Data ──

  private async _fetchUsers(): Promise<void> {
    if (this._userCache) {
      this._users = this._userCache;
      return;
    }

    this._loading = true;
    this._fetchError = '';

    try {
      // Use the backend admin API — protected by require_platform_admin().
      // Migration 147 revoked direct RPC access from anon/authenticated.
      const response = await adminApi.listUsers(1, 200);

      if (!response.success || !response.data) {
        this._fetchError = response.error?.message || 'Failed to load users';
        return;
      }

      const raw = response.data.users ?? [];
      const currentEmail = this._currentEmail;
      this._users = raw.map((u) => resolveUser(u, u.email === currentEmail));
      this._userCache = this._users;
    } catch (e) {
      this._fetchError = e instanceof Error ? e.message : 'Network error';
    } finally {
      this._loading = false;
    }
  }

  // ── Computed ──

  private get _currentEmail(): string {
    return appState.user.value?.email ?? '';
  }

  private get _filtered(): ResolvedUser[] {
    if (!this._search) return this._users;
    const q = this._search.toLowerCase();
    return this._users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.role.includes(q),
    );
  }

  // ── Handlers ──

  private async _toggle() {
    this._open = !this._open;
    if (this._open) {
      this._search = '';
      this._focusIndex = -1;
      this._switchError = '';
      await this._fetchUsers();
      await this.updateComplete;
      this._searchInput?.focus();
    }
  }

  private _close() {
    this._open = false;
    this._search = '';
    this._focusIndex = -1;
  }

  private _handleSearchInput(e: InputEvent) {
    this._search = (e.target as HTMLInputElement).value;
    this._focusIndex = -1;
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this._open) {
      this._close();
      return;
    }
    if (e.key === 'Escape' && this._gateOpen) {
      this._gateOpen = false;
      this._gateError = '';
    }
  }

  private _handleListKeydown(e: KeyboardEvent) {
    const items = this._filtered;
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._focusIndex = Math.min(this._focusIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._focusIndex = Math.max(this._focusIndex - 1, 0);
    } else if (e.key === 'Enter' && this._focusIndex >= 0) {
      e.preventDefault();
      const user = items[this._focusIndex];
      if (user) this._switchTo(user);
    }
  }

  private async _switchTo(user: ResolvedUser) {
    if (!user.email || user.email === this._currentEmail) return;

    this._switchError = '';
    this.classList.add('switching');

    // Try admin impersonation first (works for all users)
    try {
      const resp = await adminApi.impersonateUser(user.id);
      if (resp.success && resp.data) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: resp.data.hashed_token,
          type: 'magiclink',
        });
        if (!error) {
          window.location.reload();
          return;
        }
      }
    } catch {
      // Impersonation unavailable (not admin, network error) — fall through
    }

    // Fallback: password sign-in (works for seed accounts with dev password)
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: DEV_PASSWORD,
    });

    if (error) {
      this._switchError = error.message;
      this.classList.remove('switching');
      setTimeout(() => {
        this._switchError = '';
      }, 4000);
      return;
    }

    window.location.reload();
  }

  // ── Gate handlers (production) ──

  private _openGate() {
    this._gateOpen = true;
    this._gateError = '';
    requestAnimationFrame(() => this._gateInput?.focus());
  }

  private _handleGateSubmit() {
    const value = this._gateInput?.value ?? '';
    if (!GATE_PASSWORD) {
      this._gateError = 'Gate not configured';
      return;
    }
    if (value === GATE_PASSWORD) {
      this._unlocked = true;
      this._gateOpen = false;
      this._gateError = '';
      sessionStorage.setItem(GATE_STORAGE_KEY, 'true');
    } else {
      this._gateError = 'Wrong code';
      if (this._gateInput) {
        this._gateInput.value = '';
        this._gateInput.focus();
      }
    }
  }

  private _handleGateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this._handleGateSubmit();
  }

  // ── Render ──

  protected render() {
    if (import.meta.env.PROD && !this._unlocked) {
      return this._renderGate();
    }
    return this._renderSwitcher();
  }

  private _renderSwitcher() {
    return html`
      <span
        class="tag ${this._open ? 'tag--open' : ''}"
        @click=${this._toggle}
        title="Dev Account Switcher"
      >DEV</span>

      ${
        this._open
          ? html`
        <div class="backdrop" @click=${this._close}></div>
        <div class="panel" @keydown=${this._handleListKeydown}>
          <div class="panel__header">
            <div class="panel__title">
              <span class="panel__title-text">Identity Registry</span>
              <span class="panel__count">${this._filtered.length}/${this._users.length}</span>
            </div>
            <div class="search">
              <svg class="search__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="6.5" cy="6.5" r="5"/>
                <line x1="10" y1="10" x2="14.5" y2="14.5"/>
              </svg>
              <input
                class="search__input"
                type="text"
                placeholder="search users..."
                .value=${this._search}
                @input=${this._handleSearchInput}
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="divider"></div>

          ${this._loading ? html`<div class="loading">Loading</div>` : nothing}

          ${
            !this._loading && this._fetchError
              ? html`<div class="error-msg">${this._fetchError}</div>`
              : nothing
          }

          ${
            !this._loading && !this._fetchError
              ? html`
            <div class="list" role="listbox">
              ${
                this._filtered.length === 0
                  ? html`<div class="empty">No matches</div>`
                  : this._filtered.map((u, i) => this._renderUser(u, i))
              }
            </div>
          `
              : nothing
          }

          ${this._switchError ? html`<div class="error-msg">${this._switchError}</div>` : nothing}
        </div>
      `
          : nothing
      }
    `;
  }

  private _renderUser(u: ResolvedUser, index: number) {
    const isCurrent = u.email === this._currentEmail;
    const isFocused = index === this._focusIndex;
    return html`
      <div
        class="user ${isCurrent ? 'user--current' : ''} ${isFocused ? 'user--focused' : ''}"
        role="option"
        aria-selected=${isCurrent}
        @click=${() => this._switchTo(u)}
        @mouseenter=${() => {
          this._focusIndex = index;
        }}
      >
        <span class="user__email">${u.email}</span>
        <div class="user__meta">
          ${u.displayName ? html`<span class="user__name">${u.displayName}</span>` : nothing}
          <span class="user__role user__role--${u.role}">${u.role}</span>
        </div>
      </div>
    `;
  }

  private _renderGate() {
    return html`
      <span class="tag" @click=${this._openGate}>DEV</span>
      ${
        this._gateOpen
          ? html`
        <div class="gate-backdrop" @click=${() => {
          this._gateOpen = false;
          this._gateError = '';
        }}></div>
        <div class="gate">
          <input
            class="gate__input ${this._gateError ? 'gate__input--error' : ''}"
            type="password"
            placeholder="Code"
            @keydown=${this._handleGateKeydown}
          />
          <button class="gate__btn" @click=${this._handleGateSubmit}>OK</button>
          ${this._gateError ? html`<span class="gate__error">${this._gateError}</span>` : nothing}
        </div>
      `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dev-account-switcher': VelgDevAccountSwitcher;
  }
}
