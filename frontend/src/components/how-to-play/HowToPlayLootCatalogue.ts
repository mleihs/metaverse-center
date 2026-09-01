/**
 * How to Play — Beutekatalog.
 *
 * WARUM ES DIESE SEITE GIBT
 *   Auf Prod liegen 105 Beutestuecke in 8 Archetypen mit 12 Wirkungsarten, alle
 *   zweisprachig beschrieben. Das Hilfesystem nannte bis zum 01.09.2026 die
 *   KATEGORIEN („aptitude boosts, memories, moodlets, event modifiers") und kein
 *   einziges Stueck; unter `/docs` stand nichts. Wer wissen wollte, wo das
 *   Restaurierungsfragment faellt — eines von nur ZWEI Stuecken im ganzen Spiel,
 *   die einen verfallenen Bau wieder heben —, fand es nirgends ausser im Code.
 *
 * DER KATALOG WIRD NICHT GESCHRIEBEN, SONDERN GELESEN
 *   Jede Zeile kommt aus `GET /public/dungeons/loot`, das dieselbe Registrierung
 *   liest wie der laufende Dungeon. Ein abgeschriebener Katalog waere am Tag der
 *   naechsten Inhaltsmigration falsch, und niemand wuerde es merken — genau das
 *   ist der Hilfe mit der Zustandsleiter passiert: dort stand
 *   „good → moderate → poor → ruined", eine Kette, die der Code seit Migration
 *   303 nicht mehr kennt, mit einer Sprosse, die keine Welt je hatte.
 *
 *   Deshalb traegt diese Datei auch KEINE `msg()`-Zeichenketten fuer Beutenamen
 *   oder Beschreibungen: die stehen zweisprachig in der Datenbank. Uebersetzt
 *   wird nur, was diese Seite selbst sagt.
 *
 * DIE BEDEUTUNG STEHT BEIM VERTRAG
 *   Was eine Wirkungsart TUT, kommt aus `dungeon_loot_contracts.py` mit — dort,
 *   wo auch steht, WO sie greift. Zwei Wahrheiten ueber dieselbe Mechanik
 *   driften; zwei Tests binden die Erklaerung an den Vertrag, damit eine neue
 *   Wirkungsart ohne Satz rot wird statt leer.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  LootCatalogue,
  LootCatalogueEntry,
  LootEffectMeaning,
} from '../../services/api/DungeonApiService.js';
import { dungeonApi } from '../../services/api/index.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import { htpBackStyles, htpHeroStyles } from './htp-shared-styles.js';

/** Die drei Stufen, wie das Debriefing sie nennt. */
const TIER_LABEL: Readonly<Record<number, () => string>> = {
  1: () => msg('Minor'),
  2: () => msg('Major'),
  3: () => msg('Legendary'),
};

@localized()
@customElement('velg-htp-loot-catalogue')
export class VelgHtpLootCatalogue extends LitElement {
  static styles = [
    htpHeroStyles,
    htpBackStyles,
    css`
      :host {
        display: block;
        /* Tier 3 */
        --_rule: color-mix(in srgb, var(--color-border-light) 70%, var(--color-surface));
        --_tier1: var(--color-text-quiet);
        --_tier2: var(--color-info);
        --_tier3: var(--color-accent-amber-readable, var(--color-accent-amber));
      }

      .wrap {
        max-width: var(--container-2xl);
        margin-inline: auto;
        padding: var(--space-8) var(--content-padding) var(--space-16);
      }

      /* ── Was die Wirkungsarten bedeuten ─────────────────────────────── */

      .meanings {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: var(--space-4);
        margin-block: var(--space-8) var(--space-12);
      }

      .meaning {
        border: var(--border-width-thin) solid var(--_rule);
        background: var(--color-surface-raised);
        padding: var(--space-4) var(--space-5);
      }

      .meaning__name {
        font-family: var(--font-brutalist);
        font-size: var(--text-2xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-accent-amber-readable, var(--color-accent-amber));
      }

      .meaning__text {
        margin: var(--space-2) 0 0;
        font-family: var(--font-bureau, var(--font-prose));
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      /* ── Ein Archetyp und seine Stuecke ─────────────────────────────── */

      .arch {
        margin-block-end: var(--space-12);
      }

      .arch__head {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        padding-block-end: var(--space-3);
        border-block-end: var(--border-width-thin) solid var(--_rule);
      }

      .arch__name {
        margin: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-lg);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .arch__count {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
      }

      .items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: var(--space-4);
        margin-block-start: var(--space-5);
      }

      .item {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        border: var(--border-width-thin) solid var(--_rule);
        background: var(--color-surface-raised);
        padding: var(--space-4) var(--space-5);
      }

      .item__top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .item__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .item__tier {
        flex: 0 0 auto;
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        white-space: nowrap;
      }

      .item__tier--1 { color: var(--_tier1); }
      .item__tier--2 { color: var(--_tier2); }
      .item__tier--3 { color: var(--_tier3); }

      .item__desc {
        margin: 0;
        font-family: var(--font-bureau, var(--font-prose));
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .item__foot {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        margin-block-start: auto;
        padding-block-start: var(--space-3);
        border-block-start: var(--border-width-thin) solid var(--_rule);
        font-family: var(--font-mono);
        font-size: var(--text-2xs);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-quiet);
      }

      @media (max-width: 640px) {
        .items,
        .meanings {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _catalogue: LootCatalogue | null = null;
  @state() private _loading = true;
  @state() private _error: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const res = await dungeonApi.getLootCatalogue();
      this._catalogue = res.data ?? null;
    } catch (err) {
      captureError(err, { source: 'VelgHtpLootCatalogue._load' });
      this._error = msg('The catalogue could not be loaded.');
    } finally {
      this._loading = false;
    }
  }

  /** Der Text in der Sprache des Lesers, mit der anderen als Rueckfall. */
  private _say(en: string, de: string): string {
    return localeService.currentLocale === 'de' ? de || en : en || de;
  }

  private _renderMeaning(m: LootEffectMeaning) {
    return html`
      <div class="meaning">
        <div class="meaning__name">${m.effect_type.replace(/_/g, ' ')}</div>
        <p class="meaning__text">${this._say(m.summary_en, m.summary_de)}</p>
      </div>
    `;
  }

  private _renderItem(item: LootCatalogueEntry) {
    const tier = TIER_LABEL[item.tier]?.() ?? String(item.tier);
    return html`
      <article class="item">
        <div class="item__top">
          <span class="item__name">${this._say(item.name_en, item.name_de)}</span>
          <span class="item__tier item__tier--${item.tier}">${tier}</span>
        </div>
        <p class="item__desc">${this._say(item.description_en, item.description_de)}</p>
        <div class="item__foot">
          <span>${item.effect_type.replace(/_/g, ' ')}</span>
          <span>${msg(str`Drop weight ${item.drop_weight}`)}</span>
        </div>
      </article>
    `;
  }

  private _renderArchetype(archetype: string, items: LootCatalogueEntry[]) {
    return html`
      <section class="arch">
        <div class="arch__head">
          <h2 class="arch__name">${archetype}</h2>
          <span class="arch__count">
            ${msg(str`${items.length} pieces`)}
          </span>
        </div>
        <div class="items">${items.map((i) => this._renderItem(i))}</div>
      </section>
    `;
  }

  protected render() {
    if (this._loading) return html`<velg-loading-state></velg-loading-state>`;
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${() => void this._load()}
      ></velg-error-state>`;
    }
    const cat = this._catalogue;
    if (!cat || !cat.items.length) return nothing;

    const nachArchetyp = new Map<string, LootCatalogueEntry[]>();
    for (const item of cat.items) {
      const liste = nachArchetyp.get(item.archetype) ?? [];
      liste.push(item);
      nachArchetyp.set(item.archetype, liste);
    }

    return html`
      <div class="wrap">
        <header class="htp-hero">
          <p class="htp-hero__kicker">${msg('Resonance dungeons')}</p>
          <h1 class="htp-hero__title">${msg('Loot catalogue')}</h1>
          <p class="htp-hero__lede">
            ${msg(
              'Every piece a dungeon can yield, what it does, and which archetype drops it. Read from the same record the run uses, so it is never out of date.',
            )}
          </p>
        </header>

        <h2 class="arch__name">${msg('What the effects do')}</h2>
        <div class="meanings">${cat.meanings.map((m) => this._renderMeaning(m))}</div>

        ${[...nachArchetyp.entries()].map(([a, items]) => this._renderArchetype(a, items))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-htp-loot-catalogue': VelgHtpLootCatalogue;
  }
}
