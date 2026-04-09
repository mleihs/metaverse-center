/**
 * VelgAchievementToast — Achievement unlock listener.
 *
 * Headless component (no render output) that subscribes to Supabase Realtime
 * on user_achievements table. When a new badge is awarded, uses the existing
 * VelgToast system to display a notification. No duplicate toast infrastructure.
 *
 * Mount once in the app shell: <velg-achievement-toast></velg-achievement-toast>
 */

import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { msg } from '@lit/localize';

import { appState } from '../../services/AppStateManager.js';
import { supabase } from '../../services/supabase/client.js';
import { achievementsApi } from '../../services/api/AchievementsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { VelgToast } from '../shared/Toast.js';

@customElement('velg-achievement-toast')
export class VelgAchievementToast extends LitElement {
  private _channel: ReturnType<typeof supabase.channel> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe();
  }

  private _subscribe() {
    const userId = appState.user.value?.id;
    if (!userId) return;

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
          this._onAchievementEarned(payload.new as { achievement_id: string });
        },
      )
      .subscribe();
  }

  private _unsubscribe() {
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
  }

  private async _onAchievementEarned(row: { achievement_id: string }) {
    try {
      const res = await achievementsApi.getAchievements();
      if (!res.data) return;

      const found = res.data.find((a) => a.achievement_id === row.achievement_id);
      if (!found?.definition) return;

      const def = found.definition;
      const locale = localeService.currentLocale;
      const name = locale === 'de' ? def.name_de : def.name_en;

      VelgToast.success(`${msg('Achievement Unlocked')}: ${name}`);
    } catch {
      // Best-effort notification — don't break the app if fetch fails
    }
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
