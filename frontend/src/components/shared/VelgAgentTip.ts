/**
 * VelgAgentTip — Enriched agent card list for tooltip slots.
 *
 * Renders a compact vertical list of agent avatars + names, designed
 * to be slotted into VelgTooltip's `tip` named slot. Eliminates
 * duplicated tooltip markup across ChatWindow and ConversationList.
 *
 * Usage:
 *   <velg-tooltip position="below">
 *     <div class="badge">+2</div>
 *     <velg-agent-tip slot="tip" .agents=${overflowAgents}></velg-agent-tip>
 *   </velg-tooltip>
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { AgentBrief } from '../../types/index.js';

import './VelgAvatar.js';

@customElement('velg-agent-tip')
export class VelgAgentTip extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .agent {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .agent__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      white-space: nowrap;
    }
  `;

  @property({ type: Array }) agents: AgentBrief[] = [];

  protected render() {
    return html`
      ${this.agents.map(
        (a) => html`
        <div class="agent">
          <velg-avatar .src=${a.portrait_image_url ?? ''} .name=${a.name} size="xs"></velg-avatar>
          <span class="agent__name">${a.name}</span>
        </div>
      `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-agent-tip': VelgAgentTip;
  }
}
