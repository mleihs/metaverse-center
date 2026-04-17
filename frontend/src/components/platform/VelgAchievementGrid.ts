/**
 * VelgAchievementGrid — Full achievement collection display.
 *
 * Conceptual direction: Military commendation wall. Badges arranged in a
 * dense grid, grouped by category with completion percentage headers.
 * Earned badges glow, locked badges are silhouetted. Filter tabs let
 * you focus on what you've earned or what remains.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  AchievementDefinition,
  AchievementProgress,
  UserAchievement,
} from '../../services/api/AchievementsApiService.js';
import { achievementsApi } from '../../services/api/AchievementsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import './VelgAchievementBadge.js';

type FilterMode = 'all' | 'earned' | 'locked';

const CATEGORY_ORDER = [
  'initiation',
  'dungeon',
  'epoch',
  'collection',
  'social',
  'challenge',
  'secret',
];
const CATEGORY_LABELS: Record<string, { en: string; de: string }> = {
  initiation: { en: 'Initiation', de: 'Initiation' },
  dungeon: { en: 'Dungeon Mastery', de: 'Dungeon-Meisterschaft' },
  epoch: { en: 'Epoch Warfare', de: 'Epochen-Krieg' },
  collection: { en: 'Collection', de: 'Sammlung' },
  social: { en: 'Social & Bleed', de: 'Soziales & Bleed' },
  challenge: { en: 'Challenge', de: 'Herausforderung' },
  secret: { en: 'Classified', de: 'Klassifiziert' },
};

@localized()
@customElement('velg-achievement-grid')
export class VelgAchievementGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-6);
      max-width: var(--container-xl);
      margin: 0 auto;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
    }
    .title {
      font-family: var(--font-brutalist);
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
    }
    .stats {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .stats strong {
      color: var(--color-primary);
    }

    /* ── Filter tabs ── */
    .filters {
      display: flex;
      gap: var(--space-1);
      margin-bottom: var(--space-6);
      border-bottom: 1px solid var(--color-border-light);
      padding-bottom: var(--space-2);
    }
    .filter-btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-2-5) var(--space-4);
      min-height: 44px;
      background: none;
      border: 1px solid transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }
    .filter-btn:hover {
      color: var(--color-text-primary);
    }
    .filter-btn[aria-selected='true'] {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }
    .filter-btn:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    /* ── Category section ── */
    .category {
      margin-bottom: var(--space-8);
    }
    .category-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
      border-left: 3px solid var(--color-primary);
      padding-left: var(--space-3);
    }
    .category-name {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }
    .category-progress {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Badge grid ── */
    .badge-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    /* ── Empty state ── */
    .empty {
      text-align: center;
      padding: var(--space-12) var(--space-6);
      color: var(--color-text-muted);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
    }

    @media (max-width: 640px) {
      :host { padding: var(--space-4); }
      .badge-grid { gap: var(--space-3); justify-content: center; }
      .header { flex-direction: column; gap: var(--space-2); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @state() private _definitions: AchievementDefinition[] = [];
  @state() private _earned: UserAchievement[] = [];
  @state() private _progress: AchievementProgress[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _filter: FilterMode = 'all';

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    this._error = null;
    try {
      const [defsRes, earnedRes, progressRes] = await Promise.all([
        achievementsApi.getDefinitions(),
        achievementsApi.getAchievements(),
        achievementsApi.getProgress(),
      ]);
      if (defsRes.data) this._definitions = defsRes.data;
      if (earnedRes.data) this._earned = earnedRes.data;
      if (progressRes.data) this._progress = progressRes.data;
    } catch (err) {
      captureError(err, { source: 'VelgAchievementGrid._load' });
      this._error = 'Failed to load achievements';
    } finally {
      this._loading = false;
    }
  }

  private get _earnedIds(): Set<string> {
    return new Set(this._earned.map((a) => a.achievement_id));
  }

  private get _progressMap(): Map<string, AchievementProgress> {
    return new Map(this._progress.map((p) => [p.achievement_id, p]));
  }

  private get _filteredDefinitions(): AchievementDefinition[] {
    const earned = this._earnedIds;
    return this._definitions.filter((d) => {
      if (this._filter === 'earned') return earned.has(d.id);
      if (this._filter === 'locked') return !earned.has(d.id);
      return true;
    });
  }

  private _getLocaleField(
    def: AchievementDefinition,
    field: 'name' | 'description' | 'hint',
  ): string {
    const locale = localeService.currentLocale;
    const key = `${field}_${locale === 'de' ? 'de' : 'en'}` as keyof AchievementDefinition;
    return (
      (def[key] as string) || (def[`${field}_en` as keyof AchievementDefinition] as string) || ''
    );
  }

  protected render() {
    if (this._loading)
      return html`<velg-loading-state message=${msg('Loading achievements')}></velg-loading-state>`;
    if (this._error)
      return html`<velg-error-state message=${this._error} show-retry @retry=${this._load}></velg-error-state>`;
    if (!this._definitions.length)
      return html`<velg-empty-state message=${msg('No achievements available')}></velg-empty-state>`;

    const earnedCount = this._earnedIds.size;
    const totalCount = this._definitions.length;

    return html`
      <div class="header">
        <h2 class="title">${msg('Commendations')}</h2>
        <span class="stats">
          <strong>${earnedCount}</strong> / ${totalCount} ${msg('earned')}
        </span>
      </div>

      <div class="filters" role="tablist">
        ${this._renderFilterTab('all', msg('All'))}
        ${this._renderFilterTab('earned', msg('Earned'))}
        ${this._renderFilterTab('locked', msg('Locked'))}
      </div>

      ${this._renderCategories()}
    `;
  }

  private _renderFilterTab(mode: FilterMode, label: string) {
    return html`
      <button
        class="filter-btn"
        role="tab"
        aria-selected=${this._filter === mode}
        @click=${() => {
          this._filter = mode;
        }}
      >${label}</button>
    `;
  }

  private _renderCategories() {
    const filtered = this._filteredDefinitions;
    const grouped = new Map<string, AchievementDefinition[]>();
    for (const def of filtered) {
      const list = grouped.get(def.category) || [];
      list.push(def);
      grouped.set(def.category, list);
    }

    const sections = CATEGORY_ORDER.filter((c) => grouped.has(c));
    if (!sections.length) {
      return html`<div class="empty">${msg('No matching achievements')}</div>`;
    }

    let globalIdx = 0;
    return sections.map((category) => {
      const defs = grouped.get(category)!;
      const catTotal = this._definitions.filter((d) => d.category === category).length;
      const catEarned = defs.filter((d) => this._earnedIds.has(d.id)).length;
      const locale = localeService.currentLocale;
      const label = CATEGORY_LABELS[category]?.[locale === 'de' ? 'de' : 'en'] || category;

      return html`
        <section class="category">
          <div class="category-header">
            <span class="category-name">${label}</span>
            <span class="category-progress">${catEarned}/${catTotal}</span>
          </div>
          <div class="badge-grid">
            ${defs.map((def) => {
              const earned = this._earnedIds.has(def.id);
              const prog = this._progressMap.get(def.id);
              const idx = globalIdx++;
              return html`
                <velg-achievement-badge
                  style="--i: ${idx}"
                  rarity=${def.rarity}
                  ?earned=${earned}
                  ?secret=${def.is_secret}
                  name=${this._getLocaleField(def, 'name')}
                  iconKey=${def.icon_key}
                  progress=${prog ? prog.current_count : -1}
                  target=${prog ? prog.target_count : 1}
                  title=${
                    earned
                      ? this._getLocaleField(def, 'description')
                      : def.is_secret
                        ? msg('Secret achievement')
                        : this._getLocaleField(def, 'hint') ||
                          this._getLocaleField(def, 'description')
                  }
                ></velg-achievement-badge>
              `;
            })}
          </div>
        </section>
      `;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-achievement-grid': VelgAchievementGrid;
  }
}
