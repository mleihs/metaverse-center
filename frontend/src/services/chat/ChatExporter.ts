/**
 * ChatExporter — Client-side conversation export to Markdown and JSON.
 *
 * Pure utility class, no UI. Generates content and triggers browser download.
 * Used by ChatWindow's export action button.
 */

import { captureError } from '../SentryService.js';
import type { AgentBrief, ChatConversation, ChatMessage } from '../../types/index.js';

export class ChatExporter {
  /**
   * Export conversation as Markdown.
   * Format mirrors how messages appear in the chat UI.
   */
  static toMarkdown(conversation: ChatConversation, messages: ChatMessage[]): string {
    const lines: string[] = [];
    const agents = ChatExporter._getAgents(conversation);
    const agentNames = agents.map((a) => a.name).join(', ') || 'Agent';

    lines.push(`# ${conversation.title || 'Conversation'}`);
    lines.push(`> Agents: ${agentNames}`);
    lines.push(`> Date: ${ChatExporter._formatDate(conversation.created_at)}`);
    lines.push(`> Messages: ${messages.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const msg of messages) {
      const sender = msg.sender_role === 'user' ? 'You' : (msg.agent?.name ?? 'Agent');
      const time = ChatExporter._formatDate(msg.created_at);
      lines.push(`**${sender}** \u2014 *${time}*`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');

      // Reactions summary
      if (msg.reactions && msg.reactions.length > 0) {
        const reactionStr = msg.reactions.map((r) => `${r.emoji} ${r.count}`).join('  ');
        lines.push(`> ${reactionStr}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Export conversation as structured JSON.
   * Includes metadata for potential re-import or analysis.
   */
  static toJSON(conversation: ChatConversation, messages: ChatMessage[]): string {
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        conversation: {
          id: conversation.id,
          title: conversation.title,
          status: conversation.status,
          created_at: conversation.created_at,
          message_count: conversation.message_count,
          agents: ChatExporter._getAgents(conversation).map((a) => ({
            id: a.id,
            name: a.name,
          })),
        },
        messages: messages.map((msg) => ({
          id: msg.id,
          sender_role: msg.sender_role,
          agent_name: msg.agent?.name,
          content: msg.content,
          created_at: msg.created_at,
          reactions: msg.reactions,
        })),
      },
      null,
      2,
    );
  }

  /**
   * Trigger a file download in the browser.
   */
  static download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download as Markdown.
   */
  static exportMarkdown(conversation: ChatConversation, messages: ChatMessage[]): void {
    const content = ChatExporter.toMarkdown(conversation, messages);
    const filename = `${ChatExporter._sanitizeFilename(conversation.title ?? 'conversation')}.md`;
    ChatExporter.download(content, filename, 'text/markdown;charset=utf-8');
  }

  /**
   * Export and download as JSON.
   */
  static exportJSON(conversation: ChatConversation, messages: ChatMessage[]): void {
    const content = ChatExporter.toJSON(conversation, messages);
    const filename = `${ChatExporter._sanitizeFilename(conversation.title ?? 'conversation')}.json`;
    ChatExporter.download(content, filename, 'application/json;charset=utf-8');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static _getAgents(conversation: ChatConversation): AgentBrief[] {
    if (conversation.agents && conversation.agents.length > 0) return conversation.agents;
    if (conversation.agent) {
      return [
        {
          id: conversation.agent.id,
          name: conversation.agent.name,
          portrait_image_url: conversation.agent.portrait_image_url,
        },
      ];
    }
    return [];
  }

  private static _formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch (err) {
      captureError(err, { source: 'ChatExporter._formatDate' });
      return dateStr;
    }
  }

  private static _sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60);
  }
}
