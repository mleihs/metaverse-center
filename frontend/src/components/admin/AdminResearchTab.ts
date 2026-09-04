import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type { PlatformSetting } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import {
  adminAnimationStyles,
  adminButtonStyles,
  adminForgeSectionStyles,
  adminLoadingStyles,
} from '../shared/admin-shared-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

interface DomainAxisMeta {
  label: string;
  description: string;
}

/**
 * Die vier Listen, die die Suche STEUERN: sie gehen als Tavilys
 * `include_domains` mit und sagen, wo zuerst nachgesehen wird.
 */
const STEERING_KEYS = [
  'research_domains_encyclopedic',
  'research_domains_literary',
  'research_domains_philosophy',
  'research_domains_architecture',
] as const;

/**
 * Die beiden Listen, die ENTSCHEIDEN. Sie werden nach der Lieferung auf jede
 * Quellzeile jedes Anbieters angewandt - auch auf die der Fachdienste, an
 * denen die Websuche nicht beteiligt ist. Bis 2026-09-04 gab es sie nicht, und
 * die vier oben wurden fuer sie gehalten: ohne `include_domains_mode` gewichtet
 * eine Domainliste nur, sie schliesst nichts aus.
 */
const POLICY_KEYS = ['research_source_allowlist', 'research_source_denylist'] as const;

const DOMAIN_KEYS = [...STEERING_KEYS, ...POLICY_KEYS] as const;

type DomainSettingKey = (typeof DOMAIN_KEYS)[number];

function getAxisMeta(): Record<DomainSettingKey, DomainAxisMeta> {
  return {
    research_domains_encyclopedic: {
      label: msg('Encyclopedic Domains'),
      description: msg(
        'General knowledge sources for conceptual overview research in Phase 1 (Astrolabe).',
      ),
    },
    research_domains_literary: {
      label: msg('Literary Domains'),
      description: msg(
        'Literary analysis and narrative technique sources for the literary axis of lore research.',
      ),
    },
    research_domains_philosophy: {
      label: msg('Philosophy Domains'),
      description: msg(
        'Philosophical and epistemological sources for the philosophical framework axis.',
      ),
    },
    research_domains_architecture: {
      label: msg('Architecture Domains'),
      description: msg(
        'Architectural history sources for the visual axis \u2013 scholarship, not design magazines.',
      ),
    },
    research_source_allowlist: {
      label: msg('Admitted Sources'),
      description: msg(
        'Every source from every provider must match one of these domains, or it is dropped \u2013 from the source list and from the text the model reads. Remove the reference works to draw the line harder.',
      ),
    },
    research_source_denylist: {
      label: msg('Refused Sources'),
      description: msg(
        'Never a source, whatever found it. This list wins over the one beside it, and it also applies to records fetched from the scholarly databases.',
      ),
    },
  };
}

@localized()
@customElement('velg-admin-research-tab')
export class VelgAdminResearchTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminForgeSectionStyles,
    adminButtonStyles,
    adminLoadingStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        --_admin-accent: var(--color-accent-amber);
        --_admin-accent-contrast: var(--color-surface-sunken);
      }

      @media (prefers-reduced-motion: reduce) {
        .domain-card {
          animation: none !important;
        }
      }

      /* --- Domain Grid --- */

      .domain-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: var(--space-4);
      }

      .domain-card {
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
        animation: panel-enter 0.4s ease both;
      }

      .domain-card:nth-child(1) { animation-delay: 0s; }
      .domain-card:nth-child(2) { animation-delay: 0.05s; }
      .domain-card:nth-child(3) { animation-delay: 0.1s; }
      .domain-card:nth-child(4) { animation-delay: 0.15s; }

      .domain-card:hover {
        border-color: var(--color-text-muted);
      }

      .domain-card--dirty {
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      }

      /* --- Card Header --- */

      .domain-card__header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .domain-card__label {
        font-family: var(--font-brutalist);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        text-transform: var(--label-transform);
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
        margin: 0;
      }

      /* --- Domain Chips --- */

      .domain-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
        margin-bottom: var(--space-3);
        min-height: 28px;
      }

      .domain-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0-5) var(--space-1) var(--space-0-5) var(--space-2);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        transition:
          border-color 0.15s ease,
          background 0.15s ease;
      }

      .domain-chip:hover {
        border-color: var(--color-text-muted);
      }

      .domain-chip__remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        background: none;
        border: none;
        color: var(--color-text-quiet);
        cursor: pointer;
        transition: color 0.15s ease;
        flex-shrink: 0;
      }

      .domain-chip__remove:hover {
        color: var(--color-danger);
      }

      .domain-chip__remove:focus-visible {
        outline: 1px solid var(--color-danger);
        outline-offset: -1px;
      }

      .domain-chips--empty {
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
        padding: var(--space-1) 0;
        font-style: italic;
      }

      /* --- Add Row --- */

      .domain-card__add-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .domain-card__input {
        flex: 1;
        min-width: 0;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        transition: border-color 0.2s ease;
      }

      .domain-card__input:focus {
        outline: none;
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber);
      }

      .domain-card__input::placeholder {
        color: var(--color-text-quiet);
        opacity: 0.6;
      }

      .domain-card__add-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2);
        background: none;
        border: 1px solid var(--color-border);
        color: var(--color-text-quiet);
        cursor: pointer;
        transition:
          color 0.2s ease,
          border-color 0.2s ease;
      }

      .domain-card__add-btn:hover {
        color: var(--color-accent-amber);
        border-color: var(--color-accent-amber);
      }

      .domain-card__add-btn:focus-visible {
        outline: none;
        color: var(--color-accent-amber);
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber);
      }

      /* --- Die zwei Karten, die entscheiden --- */

      /*
       * Kein farbiger Randbalken (lint-no-accent-edge-bar): der ganze Rand
       * traegt die Farbe. Das sagt dasselbe und faellt nicht unter die Regel,
       * weil es die Box einfasst statt sie zu markieren.
       */
      .domain-card--gate {
        border-color: var(--_gate);
        box-shadow: var(--shadow-xs);
      }

      .domain-card--gate .domain-card__label {
        color: var(--_gate);
      }

      .domain-card--allow {
        --_gate: var(--color-success);
      }

      .domain-card--deny {
        --_gate: var(--color-danger);
      }

      .domain-card--gate .domain-chip {
        border-color: color-mix(in srgb, var(--_gate) 30%, var(--color-border));
      }

      .section-note {
        margin: 0 0 var(--space-4);
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        max-width: 78ch;
      }

      .actions {
        margin-top: var(--space-5);
      }

      @media (max-width: 768px) {
        .domain-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _domains: Record<string, string[]> = {};
  @state() private _originalDomains: Record<string, string[]> = {};
  @state() private _newDomainInputs: Record<string, string> = {};
  /**
   * Die Vorgabewerte kommen aus dem Backend, nicht aus einer Kopie hier.
   * Solange sie nicht da sind, ist „Auf Vorgabewerte zuruecksetzen" gesperrt -
   * lieber ein abgeblendeter Knopf als einer, der eine leere Liste schreibt.
   */
  @state() private _defaults: Record<string, string[]> = {};

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    const [result, defaults] = await Promise.all([
      adminApi.listSettings(),
      adminApi.getResearchDefaults(),
    ]);
    if (defaults.success && defaults.data) {
      this._defaults = defaults.data;
    }
    if (result.success && result.data) {
      const allSettings = result.data as PlatformSetting[];
      const domains: Record<string, string[]> = {};

      // Ohne Zeile in der Datenbank bleibt die Liste leer. Sie hier mit einer
      // Vorgabe zu fuellen, die niemand gespeichert hat, zeigte einen Zustand,
      // den das Backend nicht kennt - und „Speichern" haette ihn dann wahr
      // gemacht, ohne dass jemand ihn gewaehlt hat.
      for (const key of DOMAIN_KEYS) {
        domains[key] = [];
      }

      // Overlay DB values
      for (const s of allSettings) {
        if (!(DOMAIN_KEYS as readonly string[]).includes(s.setting_key)) continue;
        const raw = s.setting_value;
        try {
          const cleaned = typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : raw;
          const parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
          if (Array.isArray(parsed)) {
            domains[s.setting_key] = parsed;
          }
        } catch (err) {
          // Malformed DB value — keep hardcoded default for this domain.
          captureError(err, {
            source: 'AdminResearchTab._loadSettings.parse',
            settingKey: s.setting_key,
          });
        }
      }

      this._domains = domains;
      this._originalDomains = JSON.parse(JSON.stringify(domains));
      this._newDomainInputs = {};
      for (const key of DOMAIN_KEYS) {
        this._newDomainInputs[key] = '';
      }
    }
    this._loading = false;
  }

  private _isDirty(key: string): boolean {
    const current = this._domains[key];
    const original = this._originalDomains[key];
    if (!current || !original) return false;
    if (current.length !== original.length) return true;
    return current.some((d, i) => d !== original[i]);
  }

  private get _hasDirty(): boolean {
    return DOMAIN_KEYS.some((key) => this._isDirty(key));
  }

  private _addDomain(key: string): void {
    const value = (this._newDomainInputs[key] ?? '').trim().toLowerCase();
    if (!value) return;
    // Strip protocol if pasted
    const domain = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;

    const current = this._domains[key] ?? [];
    if (current.includes(domain)) {
      VelgToast.error(msg('Domain already exists.'));
      return;
    }

    this._domains = {
      ...this._domains,
      [key]: [...current, domain],
    };
    this._newDomainInputs = {
      ...this._newDomainInputs,
      [key]: '',
    };

    // Return focus to input
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(`input[data-key="${key}"]`);
      input?.focus();
    });
  }

  private _removeDomain(key: string, index: number): void {
    const current = this._domains[key] ?? [];
    this._domains = {
      ...this._domains,
      [key]: current.filter((_, i) => i !== index),
    };

    // Return focus to input
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(`input[data-key="${key}"]`);
      input?.focus();
    });
  }

  private async _saveAll(): Promise<void> {
    this._saving = true;
    let successCount = 0;
    let errorCount = 0;

    for (const key of DOMAIN_KEYS) {
      if (!this._isDirty(key)) continue;
      const domains = this._domains[key];
      const result = await adminApi.updateSetting(key, JSON.stringify(domains));
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    }

    if (successCount > 0) {
      VelgToast.success(msg(str`${successCount} domain settings saved.`));
    }
    if (errorCount > 0) {
      VelgToast.error(msg(str`${errorCount} settings failed to save.`));
    }

    await this._loadSettings();
    this._saving = false;
  }

  private get _canReset(): boolean {
    return DOMAIN_KEYS.some((key) => (this._defaults[key] ?? []).length > 0);
  }

  private _resetToDefaults(): void {
    const domains: Record<string, string[]> = { ...this._domains };
    for (const key of DOMAIN_KEYS) {
      const fallback = this._defaults[key];
      if (fallback) domains[key] = [...fallback];
    }
    this._domains = domains;
    this.requestUpdate();
  }

  private _renderDomainCard(key: DomainSettingKey) {
    const meta = getAxisMeta();
    const m = meta[key];
    if (!m) return nothing;

    const isDirty = this._isDirty(key);
    const domains = this._domains[key] ?? [];
    const inputValue = this._newDomainInputs[key] ?? '';
    const tooltipId = `tooltip-${key}`;
    const gateClass =
      key === 'research_source_allowlist'
        ? 'domain-card--gate domain-card--allow'
        : key === 'research_source_denylist'
          ? 'domain-card--gate domain-card--deny'
          : '';

    return html`
      <div class="domain-card ${gateClass} ${isDirty ? 'domain-card--dirty' : ''}">
        <div class="domain-card__header">
          <p class="domain-card__label">${m.label}</p>
          ${renderInfoBubble(m.description, tooltipId)}
        </div>

        ${
          domains.length > 0
            ? html`
              <div class="domain-chips" role="list">
                ${domains.map(
                  (domain, i) => html`
                    <span class="domain-chip" role="listitem">
                      ${domain}
                      <button
                        class="domain-chip__remove"
                        aria-label=${msg(str`Remove ${domain}`)}
                        @click=${() => this._removeDomain(key, i)}
                      >${icons.close(10)}</button>
                    </span>
                  `,
                )}
              </div>
            `
            : html`<div class="domain-chips--empty">${msg('No domains configured')}</div>`
        }

        <div class="domain-card__add-row">
          <input
            type="text"
            class="domain-card__input"
            data-key=${key}
            placeholder=${msg('Add domain...')}
            aria-label=${msg(str`Add domain to ${m.label}`)}
            .value=${inputValue}
            @input=${(e: Event) => {
              this._newDomainInputs = {
                ...this._newDomainInputs,
                [key]: (e.target as HTMLInputElement).value,
              };
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this._addDomain(key);
              }
            }}
          />
          <button
            class="domain-card__add-btn"
            title=${msg('Add Domain')}
            aria-label=${msg('Add domain')}
            @click=${() => this._addDomain(key)}
          >${icons.plus(12)}</button>
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading research domains...')}</div>`;
    }

    return html`
      <div class="forge-section marker-corners">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-02</span>
          <h3 class="forge-section__title">${msg('Research Domains')}</h3>
        </div>
        <div class="forge-section__divider"></div>

        <p class="section-note">
          ${msg(
            'These lists steer the search: they tell the web search where to look first. They do not decide what counts as a source \u2013 the two lists below do that.',
          )}
        </p>

        <div class="domain-grid">
          ${STEERING_KEYS.map((key) => this._renderDomainCard(key))}
        </div>
      </div>

      <div class="forge-section marker-corners">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-03</span>
          <h3 class="forge-section__title">${msg('Source Policy')}</h3>
        </div>
        <div class="forge-section__divider"></div>

        <p class="section-note">
          ${msg(
            'The Forge grounds worldbuilding in three genres: literary works and criticism, philosophical writing, peer-reviewed scholarship. Every source every provider returns is checked against these two lists after it arrives \u2013 what fails is dropped from the source list and from the text the model reads. The refusal list wins over the admission list.',
          )}
        </p>

        <div class="domain-grid">
          ${POLICY_KEYS.map((key) => this._renderDomainCard(key))}
        </div>

        <div class="actions">
          <button
            class="btn btn--save"
            aria-label=${msg('Save domain changes')}
            ?disabled=${!this._hasDirty || this._saving}
            @click=${this._saveAll}
          >
            ${this._saving ? msg('Saving...') : msg('Save Changes')}
          </button>
          <button
            class="btn btn--reset"
            aria-label=${msg('Reset domains to defaults')}
            ?disabled=${this._saving || !this._canReset}
            @click=${this._resetToDefaults}
          >
            ${msg('Reset to Defaults')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-research-tab': VelgAdminResearchTab;
  }
}
