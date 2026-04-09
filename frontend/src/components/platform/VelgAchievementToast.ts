/**
 * VelgAchievementToast — Achievement unlock listener.
 *
 * Headless component (no render output) that subscribes to Supabase Realtime
 * on user_achievements table. When a new badge is awarded, resolves the
 * definition from a locally cached catalog (no per-event API round-trip) and
 * uses the VelgToast system for notification.
 *
 * Architecture:
 *   - Caches achievement_definitions on first subscribe (static catalog)
 *   - Looks up earned badge definition locally on INSERT event
 *   - Updates appState.recentUnlock for dashboard reactivity
 *   - Resubscribes on auth changes (login/logout)
 *
 * Mount once in the app shell: <velg-achievement-toast></velg-achievement-toast>
 */

import { msg } from '@lit/localize';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import type {
  AchievementDefinition,
  UserAchievement,
} from '../../services/api/AchievementsApiService.js';
import { achievementsApi } from '../../services/api/AchievementsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { supabase } from '../../services/supabase/client.js';
import { VelgToast } from '../shared/Toast.js';

@customElement('velg-achievement-toast')
export class VelgAchievementToast extends LitElement {
  private _channel: ReturnType<typeof supabase.channel> | null = null;
  private _definitionCache = new Map<string, AchievementDefinition>();
  private _disposeAuthWatch: (() => void) | null = null;

  /** Guard against concurrent _subscribe() calls (async + immediate signal fire). */
  private _subscribeGeneration = 0;

  connectedCallback() {
    super.connectedCallback();
    // Preact Signals .subscribe() fires immediately with the current value,
    // so this single watcher handles both initial subscribe AND auth changes.
    this._disposeAuthWatch = appState.user.subscribe(() => {
      this._unsubscribe();
      this._definitionCache.clear();
      this._subscribe();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe();
    try {
      this._disposeAuthWatch?.();
    } catch {
      /* best-effort cleanup */
    }
    this._disposeAuthWatch = null;
  }

  private async _subscribe() {
    const userId = appState.user.value?.id;
    if (!userId) return;

    // Stamp a generation so stale async resumes are discarded.
    const gen = ++this._subscribeGeneration;

    // Pre-warm the definition cache (static catalog, fetched once)
    if (this._definitionCache.size === 0) {
      await this._loadDefinitions();
    }

    // Another subscribe/unsubscribe happened during the await — abort.
    if (gen !== this._subscribeGeneration) return;

    this._channel = supabase
      .channel('achievement-toast')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          this._onAchievementEarned(payload.new as { achievement_id: string; earned_at: string });
        },
      )
      .subscribe();
  }

  private _unsubscribe() {
    this._subscribeGeneration++;
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
  }

  private async _loadDefinitions() {
    try {
      // Use appState cache if already populated (e.g. by grid view)
      let defs = appState.achievementDefinitions.value;
      if (!defs.length) {
        const res = await achievementsApi.getDefinitions();
        if (res.data) {
          defs = res.data;
          appState.setAchievementDefinitions(defs);
        }
      }
      for (const def of defs) {
        this._definitionCache.set(def.id, def);
      }
    } catch {
      // Non-critical — toast will show generic text if cache miss
    }
  }

  private _onAchievementEarned(row: { achievement_id: string; earned_at: string }) {
    const def = this._definitionCache.get(row.achievement_id);
    if (!def) {
      // Cache miss (shouldn't happen, but fallback gracefully)
      VelgToast.success(msg('Achievement Unlocked'));
      return;
    }

    const locale = localeService.currentLocale;
    const name = locale === 'de' ? def.name_de : def.name_en;

    VelgToast.success(`${msg('Achievement Unlocked')}: ${name}`);

    // Update appState for dashboard reactivity
    const unlock: UserAchievement = {
      id: '',
      user_id: appState.user.value?.id ?? '',
      achievement_id: row.achievement_id,
      earned_at: row.earned_at,
      context: {},
      definition: def,
    };
    appState.setRecentUnlock(unlock);
  }

  protected render() {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-achievement-toast': VelgAchievementToast;
  }
}
