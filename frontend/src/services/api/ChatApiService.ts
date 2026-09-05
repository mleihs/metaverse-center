import type {
  ApiResponse,
  ChatConversation,
  ChatEventReference,
  ChatMessage,
  ChatReactionSummary,
  ConversationContinueHours,
  ConversationNotifyMode,
} from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';
import type { QueryParams } from './query-params';

export class ChatApiService extends BaseApiService {
  listConversations(
    simulationId: string,
    mode: 'public' | 'member',
  ): Promise<ApiResponse<ChatConversation[]>> {
    return this.getSimulationData(`/simulations/${simulationId}/chat/conversations`, mode);
  }

  /**
   * Das eigene Kontopasswort erneut nachweisen.
   *
   * Der Server stellt dafuer KEIN Token aus und merkt sich nichts — die
   * Antwort sagt nur, wie lange die Oberflaeche das Ja gelten lassen darf.
   */
  reauth(password: string): Promise<ApiResponse<{ valid_for_seconds: number }>> {
    // `postExpecting401`: hier heisst 401 „falsches Passwort", nicht
    // „abgelaufene Sitzung". Der normale Weg meldet den Nutzer ab.
    return this.postExpecting401('/auth/reauth', { password });
  }

  /**
   * Ein Bild aus dem, was gerade gesagt wurde.
   *
   * `span` waehlt den Ausschnitt: `round` ist die Vorgabe und die richtige
   * Einheit — die Zuege einer Runde beschreiben DENSELBEN Augenblick aus
   * verschiedener Sicht, sind also ein Moment und nicht mehrere. Ein
   * gleitendes Fenster ueber die letzten N Nachrichten schnitte mitten hinein.
   *
   * `vantage` und `rating` sind WUENSCHE. Was wirklich gilt, rechnet der
   * Server aus den Einstellungen des Nutzers; `rating: 'mature'` von hier aus
   * erhoeht nichts.
   */
  createSceneImage(
    simulationId: string,
    conversationId: string,
    options: {
      span?: 'message' | 'round' | 'section';
      vantage?: 'human' | 'agent' | 'wide';
      rating?: 'general' | 'mature';
    } = {},
  ): Promise<ApiResponse<ChatMessage>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/scene-image`,
      {
        span: options.span ?? 'round',
        vantage: options.vantage,
        rating: options.rating ?? 'general',
      },
    );
  }

  /**
   * Ein Szenenbild wieder entfernen — Zeile UND beide Dateien.
   *
   * Jedes Bild liegt zweimal im Speicher (native Fassung und Daumennagel);
   * das raeumt der Server ab, nicht der Klient. Bis zum 05.09.2026 gab es
   * diese Route nicht: ein erzeugtes Bild blieb, wo es war.
   */
  deleteSceneImage(
    simulationId: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResponse<{ deleted: boolean; storage_objects_removed: number }>> {
    return this.delete(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/scene-image/${messageId}`,
    );
  }

  /**
   * Den Verschluss eines Gespraechs umlegen.
   *
   * Das Passwort geht im SELBEN Aufruf mit: so liegt kein Fenster zwischen
   * Nachweis und Wirkung, und die Oberflaeche muss keinen Nachweis-Zustand
   * fuehren, dem der Server ohnehin nicht glauben koennte.
   */
  setConversationLock(
    simulationId: string,
    conversationId: string,
    locked: boolean,
    password: string,
  ): Promise<ApiResponse<{ id: string; locked: boolean }>> {
    // Siehe `reauth`: 401 ist hier die Antwort auf das Passwort.
    return this.patchExpecting401(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/lock`,
      { locked, password },
    );
  }

  /**
   * Ob und wie dieses Gespraech ohne den Menschen weitergeht.
   *
   * Kein Passwort, anders als beim Verschluss nebenan: der Verschluss nimmt
   * etwas zurueck, was schon geschrieben steht; dies gibt nur der Zukunft
   * eine Richtung und ist jederzeit wieder umzulegen.
   *
   * Der Server weist einen VERSCHLOSSENEN Faden mit 400 ab. Wer verschliesst,
   * hat eine Geste gemacht, und ein Agent, der daraus in der Wochenpost
   * erzaehlt, verraet sie.
   */
  setConversationContinuation(
    simulationId: string,
    conversationId: string,
    settings: {
      continues_without_user: boolean;
      notify: ConversationNotifyMode;
      interval_hours: ConversationContinueHours;
    },
  ): Promise<
    ApiResponse<{
      id: string;
      continues_without_user: boolean;
      continue_notify: ConversationNotifyMode;
      continue_interval_hours: ConversationContinueHours;
    }>
  > {
    return this.patch(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/continuation`,
      settings,
    );
  }

  createConversation(
    simulationId: string,
    data: { agent_ids: string[]; title?: string },
  ): Promise<ApiResponse<ChatConversation>> {
    return this.post(`/simulations/${simulationId}/chat/conversations`, data);
  }

  getMessages(
    simulationId: string,
    conversationId: string,
    mode: 'public' | 'member',
    params?: QueryParams,
  ): Promise<ApiResponse<ChatMessage[]>> {
    return this.getSimulationData(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      mode,
      params,
    );
  }

  sendMessage(
    simulationId: string,
    conversationId: string,
    data: { content: string; metadata?: Record<string, unknown>; generate_response?: boolean },
  ): Promise<ApiResponse<ChatMessage[]>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages`,
      data,
    );
  }

  addAgent(
    simulationId: string,
    conversationId: string,
    agentId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.post(`/simulations/${simulationId}/chat/conversations/${conversationId}/agents`, {
      agent_id: agentId,
    });
  }

  removeAgent(
    simulationId: string,
    conversationId: string,
    agentId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.delete(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/agents/${agentId}`,
    );
  }

  addEventReference(
    simulationId: string,
    conversationId: string,
    eventId: string,
  ): Promise<ApiResponse<ChatEventReference>> {
    return this.post(`/simulations/${simulationId}/chat/conversations/${conversationId}/events`, {
      event_id: eventId,
    });
  }

  removeEventReference(
    simulationId: string,
    conversationId: string,
    eventId: string,
  ): Promise<ApiResponse<unknown>> {
    return this.delete(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/events/${eventId}`,
    );
  }

  getEventReferences(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatEventReference[]>> {
    return this.get(`/simulations/${simulationId}/chat/conversations/${conversationId}/events`);
  }

  toggleReaction(
    simulationId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<ApiResponse<{ action: string; message_id: string; emoji: string }>> {
    return this.post(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
      { emoji },
    );
  }

  getReactions(
    simulationId: string,
    conversationId: string,
    messageId: string,
  ): Promise<ApiResponse<ChatReactionSummary[]>> {
    return this.get(
      `/simulations/${simulationId}/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
    );
  }

  renameConversation(
    simulationId: string,
    conversationId: string,
    title: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.put(`/simulations/${simulationId}/chat/conversations/${conversationId}/title`, {
      title,
    });
  }

  /**
   * Ein Gespraech beiseitelegen oder wieder hervorholen.
   *
   * Der Rumpf wurde bis zum 05.09.2026 vom Server VERWORFEN — die Route nahm
   * keinen entgegen und archivierte immer. Dass es niemandem auffiel, lag
   * daran, dass es nur einen Aufrufer gab und der dasselbe wollte. Erst als
   * jemand zurueck wollte, zeigte sich, dass es keinen Rueckweg gab.
   */
  setConversationStatus(
    simulationId: string,
    conversationId: string,
    status: 'active' | 'archived',
  ): Promise<ApiResponse<ChatConversation>> {
    return this.patch(`/simulations/${simulationId}/chat/conversations/${conversationId}`, {
      status,
    });
  }

  deleteConversation(
    simulationId: string,
    conversationId: string,
  ): Promise<ApiResponse<ChatConversation>> {
    return this.delete(`/simulations/${simulationId}/chat/conversations/${conversationId}`);
  }

  /** Contextual conversation starters for empty conversations. */
  getStarters(
    simulationId: string,
    conversationId: string,
    locale: string = 'de',
  ): Promise<ApiResponse<string[]>> {
    return this.get(`/simulations/${simulationId}/chat/conversations/${conversationId}/starters`, {
      locale,
    });
  }

  /** URL for the regenerate SSE endpoint (used by ChatStreamConsumer). */
  regenerateStreamUrl(simulationId: string, conversationId: string): string {
    return `/api/v1/simulations/${simulationId}/chat/conversations/${conversationId}/regenerate`;
  }
}

export const chatApi = new ChatApiService();
