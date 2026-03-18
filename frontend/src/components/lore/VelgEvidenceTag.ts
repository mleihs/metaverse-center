import { msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type EntityType = 'agent' | 'building' | 'zone';

/**
 * Inline clickable entity reference badge within dossier content.
 * Color-coded by entity type: agent=blue, building=amber, zone=green.
 */
@customElement('velg-evidence-tag')
export class VelgEvidenceTag extends LitElement {
  static styles = css`
    :host {
      display: inline;
    }

    .tag {
      display: inline;
      padding: 0 3px;
      font-size: inherit;
      font-weight: 600;
      border-bottom: 1px dashed;
      cursor: pointer;
      transition: opacity 0.15s;
      text-decoration: none;
    }

    .tag:hover {
      opacity: 0.8;
    }

    .tag--agent {
      color: var(--color-info);
      border-color: var(--color-info);
    }

    .tag--building {
      color: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
    }

    .tag--zone {
      color: var(--color-success);
      border-color: var(--color-success);
    }

    .tag:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  `;

  @property({ type: String }) entityName = '';
  @property({ type: String }) entityType: EntityType = 'agent';
  @property({ type: String }) entityId = '';
  @property({ type: String }) basePath = '';

  private _handleClick(): void {
    if (!this.basePath || !this.entityId) return;

    const tabMap: Record<EntityType, string> = {
      agent: 'agents',
      building: 'buildings',
      zone: 'map',
    };
    const tab = tabMap[this.entityType];
    const path = `/simulations/${this.basePath}/${tab}`;

    this.dispatchEvent(
      new CustomEvent('evidence-navigate', {
        bubbles: true,
        composed: true,
        detail: { path, entityId: this.entityId, entityType: this.entityType },
      }),
    );
  }

  protected render() {
    const typeLabel =
      this.entityType === 'agent'
        ? msg('Agent')
        : this.entityType === 'building'
          ? msg('Building')
          : msg('Zone');

    return html`
      <span
        class="tag tag--${this.entityType}"
        role="link"
        tabindex="0"
        aria-label="${typeLabel}: ${this.entityName}"
        @click=${this._handleClick}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleClick();
          }
        }}
      >${this.entityName}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-evidence-tag': VelgEvidenceTag;
  }
}
