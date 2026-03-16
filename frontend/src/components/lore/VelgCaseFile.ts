import { localized, msg } from '@lit/localize';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LoreSection } from '../platform/LoreScroll.js';
import { caseFileStyles } from './case-file-styles.js';
import { parseFragments } from './lore-content.js';

import './VelgCaseFileToc.js';
import './VelgEvidenceTag.js';
import './VelgPropheticFragment.js';

interface EntityRef {
  name: string;
  type: 'agent' | 'building' | 'zone';
  id: string;
}

/**
 * Dedicated tabbed viewer for classified dossier sections.
 * Styled as a physical Bureau case file with ALPHA–ZETA tabs,
 * TOC sidebar, and evidence tags for entity cross-references.
 */
@localized()
@customElement('velg-case-file')
export class VelgCaseFile extends LitElement {
  static styles = [caseFileStyles];

  @property({ type: Array }) sections: LoreSection[] = [];
  @property({ type: String }) simulationName = '';
  @property({ type: Array }) agents: EntityRef[] = [];
  @property({ type: Array }) buildings: EntityRef[] = [];
  @property({ type: Array }) zones: EntityRef[] = [];
  @property({ type: String }) basePath = '';

  @state() private _activeTab = 0;

  private _entityMap: Map<string, EntityRef> | null = null;
  private _entityRegex: RegExp | null = null;

  updated(changed: Map<string, unknown>): void {
    if (changed.has('agents') || changed.has('buildings') || changed.has('zones')) {
      this._buildEntityIndex();
    }
  }

  private _buildEntityIndex(): void {
    const map = new Map<string, EntityRef>();

    for (const a of this.agents) {
      map.set(a.name, a);
    }
    for (const b of this.buildings) {
      map.set(b.name, b);
    }
    for (const z of this.zones) {
      map.set(z.name, z);
    }

    this._entityMap = map;

    // Build regex from names, sorted longest-first to avoid partial matches
    const names = [...map.keys()].filter((n) => n.length > 2).sort((a, b) => b.length - a.length);

    if (names.length > 0) {
      const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      this._entityRegex = new RegExp(`(${escaped.join('|')})`, 'g');
    } else {
      this._entityRegex = null;
    }
  }

  private _handleTabChange(index: number): void {
    this._activeTab = index;
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this._activeTab = Math.min(this._activeTab + 1, this.sections.length - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this._activeTab = Math.max(this._activeTab - 1, 0);
    }
  }

  protected render() {
    if (this.sections.length === 0) return nothing;

    const active = this.sections[this._activeTab];

    return html`
      <div class="case-file">
        ${this._renderHeader()}
        ${this._renderTabs()}
        <div class="case-file__body">
          <div class="case-file__toc">
            <velg-case-file-toc
              .sections=${this.sections}
              .activeIndex=${this._activeTab}
              @toc-select=${(e: CustomEvent<{ index: number }>) =>
                this._handleTabChange(e.detail.index)}
            ></velg-case-file-toc>
          </div>
          <div
            class="case-file__panel"
            role="tabpanel"
            id="panel-${this._activeTab}"
            aria-labelledby="tab-${this._activeTab}"
          >
            ${this._renderSection(active)}
          </div>
        </div>
      </div>
    `;
  }

  private _renderHeader() {
    return html`
      <div class="case-file__header">
        <h3 class="case-file__title">${msg('CLASSIFIED CASE FILE')}</h3>
        <div class="case-file__subtitle">
          ${msg('BUREAU CASE FILE // SHARD')}: ${this.simulationName.toUpperCase()}
          // ${msg('CLASSIFICATION: LEVEL 4 // AUTHORIZED EYES ONLY')}
        </div>
      </div>
    `;
  }

  private _renderTabs() {
    return html`
      <div
        class="case-file__tabs"
        role="tablist"
        aria-label=${msg('Dossier sections')}
        @keydown=${this._handleKeydown}
      >
        ${this.sections.map(
          (section, i) => html`
            <button
              class="case-file__tab ${i === this._activeTab ? 'case-file__tab--active' : ''}"
              role="tab"
              id="tab-${i}"
              aria-selected=${i === this._activeTab ? 'true' : 'false'}
              aria-controls="panel-${i}"
              tabindex=${i === this._activeTab ? '0' : '-1'}
              @click=${() => this._handleTabChange(i)}
            >
              ${section.arcanum}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderSection(section: LoreSection) {
    const isEpsilon = section.arcanum === 'EPSILON';

    return html`
      <div class="panel__arcanum-label">${msg('ARCANUM')} ${section.arcanum}</div>
      <h4 class="panel__title">${section.title}</h4>
      ${
        section.epigraph
          ? html`<blockquote class="panel__epigraph">${section.epigraph}</blockquote>`
          : nothing
      }
      ${
        isEpsilon
          ? this._renderFragments(section.body)
          : html`<div class="panel__body">${this._renderBodyWithTags(section.body)}</div>`
      }
    `;
  }

  private _renderFragments(body: string) {
    const fragments = parseFragments(body);
    if (fragments.length === 0) {
      return html`<div class="panel__body">${this._renderBodyWithTags(body)}</div>`;
    }
    return fragments.map(
      (f) => html`<velg-prophetic-fragment .fragment=${f}></velg-prophetic-fragment>`,
    );
  }

  private _renderBodyWithTags(body: string) {
    if (!this._entityRegex || !this._entityMap) {
      return this._renderParagraphs(body);
    }

    // Split body into paragraphs, then tag entities within each
    const paragraphs = body.split(/\n\n+/);
    return paragraphs.map((para) => html`<p>${this._tagEntitiesInText(para)}</p>`);
  }

  private _tagEntitiesInText(text: string): Array<ReturnType<typeof html> | string> {
    if (!this._entityRegex || !this._entityMap) return [text];

    const parts: Array<ReturnType<typeof html> | string> = [];
    const regex = new RegExp(this._entityRegex.source, 'g');
    let last = 0;

    for (const match of text.matchAll(regex)) {
      if (match.index > last) {
        parts.push(text.slice(last, match.index));
      }
      const entity = this._entityMap.get(match[1]);
      if (entity) {
        parts.push(html`<velg-evidence-tag
          .entityName=${entity.name}
          .entityType=${entity.type}
          .entityId=${entity.id}
          .basePath=${this.basePath}
        ></velg-evidence-tag>`);
      } else {
        parts.push(match[1]);
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      parts.push(text.slice(last));
    }
    return parts;
  }

  private _renderParagraphs(body: string) {
    const paragraphs = body.split(/\n\n+/);
    return paragraphs.map((para) => html`<p>${para}</p>`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-case-file': VelgCaseFile;
  }
}
