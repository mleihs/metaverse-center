import type { ApiResponse, NotificationPreferences } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

/** What one email unsubscribe link is for. */
export interface UnsubscribeScope {
  category: 'cycle_resolved' | 'phase_changed' | 'epoch_completed' | 'all';
}

class NotificationPreferencesApiServiceImpl extends BaseApiService {
  async getPreferences(): Promise<ApiResponse<NotificationPreferences>> {
    return this.get<NotificationPreferences>('/users/me/notification-preferences');
  }

  async updatePreferences(
    prefs: NotificationPreferences,
  ): Promise<ApiResponse<NotificationPreferences>> {
    return this.post<NotificationPreferences>('/users/me/notification-preferences', prefs);
  }

  /**
   * Read what an emailed unsubscribe token covers. Changes nothing - the
   * confirmation page has to name what the reader is about to leave, and the
   * token is opaque to the browser.
   */
  async describeUnsubscribe(token: string): Promise<ApiResponse<UnsubscribeScope>> {
    return this.get<UnsubscribeScope>('/unsubscribe/describe', { token });
  }

  /**
   * Carry out an emailed unsubscribe. The token is the authorisation; no
   * session is required, which is the whole point - the reader arrives from
   * their inbox, not from the app.
   */
  async confirmUnsubscribe(token: string): Promise<ApiResponse<UnsubscribeScope>> {
    return this.post<UnsubscribeScope>(`/unsubscribe/confirm?token=${encodeURIComponent(token)}`);
  }
}

export const notificationPreferencesApi = new NotificationPreferencesApiServiceImpl();
