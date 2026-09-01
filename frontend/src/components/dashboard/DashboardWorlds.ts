/**
 * Der Weltenumschalter — „Meine Welten" im Operativen Terminal.
 *
 * Links die Liste der eigenen Welten, rechts eine Vorschau, die beim Überfahren
 * einer Zeile wechselt. Das Muster stammt vom Systemindex der Frontseite; es ist
 * dasselbe Bauprinzip, weil es dieselbe Frage beantwortet: viele Dinge nennen,
 * eines zeigen.
 *
 * ALLES HIER KOMMT AUS DEM BESTAND
 *
 * Der Prototyp trug ein `MY`-Array mit erfundener Lore, erfundenen Zitaten und
 * Platzhalterbildern (die Insektenwelt zeigte einen Ozean). Gemessen auf Prod am
 * 31.08.2026 existiert jedes dieser Felder wirklich: `banner_url` bei 16 von 16
 * Welten, `simulation_lore` mit 109 Kammern über alle 16, und Thema, Rolle sowie
 * beide Zählungen stehen in der Sicht `simulation_dashboard`. Es gab nichts zu
 * erfinden — nur nachzusehen.
 *
 * DIE QUELLENANGABE UNTER DEM ZITAT IST DIE KAMMER, NICHT EINE STIMME
 *
 * Der Entwurf zeigt dort eine Zuschreibung. Eine Person, die den Satz gesagt
 * hätte, gibt es nicht; die Kammer, aus der er stammt, gibt es
 * (`simulation_lore.title`). Eine echte Herkunft ist besser als eine erfundene
 * Stimme — und wenn auch die fehlt, steht dort nichts, statt etwas zu behaupten.
 *
 * ⚠ ZWEI FALLEN, DIE IN DIESEM BAUTEIL SCHARF SIND
 *
 * 1. `overflow: hidden` auf einem Flex-Kind hebt dessen `min-width: auto` auf,
 *    und der Text schneidet mitten im Wort ab. Genau daran sind am 31.08.2026
 *    elf von vierzehn Reitern der Simulationsnavigation gescheitert
 *    („GEBÄUD", „GESUNDHE"). Die Vorschaukachel braucht `overflow: hidden` für
 *    ihren Verlauf — sie steht deshalb in einem Raster mit fester Spaltenbreite
 *    und nicht in einer Flex-Reihe, und die Zeilentexte tragen `min-width: 0`
 *    ausdrücklich.
 *
 * 2. Der Wechsel hängt am Überfahren. Eine Maus hat das, eine Tastatur nicht —
 *    deshalb wechselt die Vorschau auch bei `focus`, und die Zeilen sind
 *    Schaltflächen, keine Divs mit Klick-Handler.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DashboardWorld } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { humanizeEnum } from '../../utils/text.js';
import { stageStyles } from '../shared/stage-styles.js';

@localized()
@customElement('velg-dashboard-worlds')
export class VelgDashboardWorlds extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        --_rule: var(--color-border-light);
        --_row-hover: color-mix(in srgb, var(--color-text-primary) 4%, var(--color-surface));
        --_panel-ground: var(--color-surface-sunken);
        --_veil: color-mix(in srgb, var(--color-surface-sunken) 94%, transparent);
        --_scanline: color-mix(in srgb, var(--color-surface) 10%, transparent);

        display: block;
        padding-block: var(--space-16);
        border-bottom: var(--border-width-thin) solid var(--_rule);
      }

      :host([hidden]) {
        display: none;
      }

      /* Festes Raster statt Flex: die Vorschau trägt "overflow: hidden" für
         ihren Verlauf, und in einer Flex-Reihe verlöre ihre Nachbarin dadurch
         den Schrumpfschutz. */
      .layout {
        display: grid;
        grid-template-columns: 1fr 620px;
        gap: var(--space-12);
        align-items: stretch;
      }

      .head {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        margin: 0 0 var(--space-6);
      }

      .head__kicker {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-accent-amber);
      }

      .head__title {
        margin: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: calc(var(--text-xl) * var(--stage-type-scale, 1));
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .head__count {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-quiet);
      }

      /* ── Die Liste ──────────────────────────────────────────────────── */
      .row {
        display: grid;
        grid-template-columns: 52px 1fr auto;
        gap: var(--space-6);
        align-items: baseline;
        width: 100%;
        padding: var(--space-6) var(--space-2-5);
        border: 0;
        border-top: var(--border-width-thin) solid var(--_rule);
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .row:last-of-type {
        border-bottom: var(--border-width-thin) solid var(--_rule);
      }

      .row:hover,
      .row:focus-visible {
        background: var(--_row-hover);
      }

      .row__index {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-quiet);
      }

      /* min-width: 0 ausdrücklich — sonst wächst die Spalte über das Raster
         hinaus, sobald ein Weltname lang ist. */
      .row__body {
        min-width: 0;
      }

      /* Die GANZE Titelzeile rückt und färbt, nicht nur der Name: der
         Themenanhänger steht daneben und liefe ihm sonst davon. */
      .row__titleline {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        transition:
          transform var(--transition-normal),
          color var(--transition-normal);
      }

      .row:hover .row__titleline,
      .row:focus-visible .row__titleline {
        transform: translateX(10px);
        color: var(--color-accent-amber);
      }

      .row__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xl);
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: inherit;
      }

      .row__theme {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-quiet);
      }

      /*
       * Die Zeile eines REGISTERS, nicht der Anfang eines Textes.
       *
       * Hier stand ein Lesemass (62ch) und keine Zeilenbegrenzung. Eine Welt
       * mit einer Zweizeiler-Beschreibung bekam zwei Zeilen, eine mit 700
       * Zeichen bekam siebzehn — auf Prod gemessen an „Meine Welten" mit 15
       * Welten stand Eintrag 02 als Textblock zwischen zwei Zweizeilern, und
       * die Nummern 01, 02, 03 verloren dabei jeden Zusammenhang.
       *
       * In einem Register haben die Zeilen dieselbe Gestalt; ungleiche Hoehen
       * sind kein Rhythmus, sondern die Abwesenheit von einem. Drei Zeilen
       * sind das Mass, das der Handoff fuer Teaser selbst nennt („erste
       * Lore-Section, 3-Zeilen-Clamp"), also dieselbe Zahl wie in der
       * Uebersicht — nicht eine neue, die jemand hier erfunden hat.
       *
       * Das Lesemass bleibt: es begrenzt die Zeile, die Klammer die Zahl der
       * Zeilen. Ohne beides waeren drei Zeilen ueber die volle Spaltenbreite
       * wieder zu lang zum Lesen.
       */
      .row__desc {
        margin: var(--space-2) 0 0;
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-quiet);
        max-width: 62ch;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .row__meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-quiet);
        white-space: nowrap;
      }

      .row--new .row__name {
        color: var(--color-accent-amber);
      }

      /* ── Die Vorschau ───────────────────────────────────────────────── */
      .preview {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding-top: var(--space-12);
      }

      .panel {
        position: relative;
        aspect-ratio: 16 / 9;
        flex: 0 0 auto;
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        background: var(--_panel-ground);
      }

      .panel__art,
      .panel__veil,
      .panel__scan {
        position: absolute;
        inset: 0;
      }

      .panel__art {
        background-position: center;
        background-size: cover;
        transition: opacity var(--duration-slower) var(--ease-default);
      }

      .panel__veil {
        background: linear-gradient(180deg, transparent 52%, var(--_veil));
      }

      .panel__scan {
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          var(--_scanline) 3px,
          var(--_scanline) 6px
        );
      }

      .panel__foot {
        position: absolute;
        left: var(--space-6);
        right: var(--space-6);
        bottom: var(--space-5);
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--space-6);
      }

      .panel__tag {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-accent-amber);
        margin-bottom: var(--space-2);
      }

      .panel__name {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xl);
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .panel__counter {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-quiet);
        flex: 0 0 auto;
      }

      .dossier {
        margin-top: var(--space-5);
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-5);
        border: var(--border-width-thin) solid var(--_rule);
        background: var(--_panel-ground);
        padding: var(--space-7) var(--space-8);
      }

      .dossier__lore {
        margin: 0;
        font-family: var(--font-prose);
        font-size: calc(var(--text-sm) * var(--stage-type-scale, 1));
        line-height: var(--leading-loose);
        color: var(--color-text-secondary);
      }

      /* Trennlinie oben, kein Balken an der Seite. */
      .dossier__quote {
        border-top: var(--border-width-thin) solid var(--_rule);
        padding-top: var(--space-5);
      }

      .dossier__quote p {
        margin: 0 0 var(--space-2-5);
        font-family: var(--font-prose);
        font-style: italic;
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-primary);
      }

      /* Feste Mindesthöhe: bricht die Quellenangabe um, darf der Verweis
         daneben nicht mitspringen. */
      .dossier__foot {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--space-5);
        min-height: 26px;
      }

      .dossier__source {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        line-height: var(--leading-snug);
        color: var(--color-text-quiet);
      }

      .dossier__enter {
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        white-space: nowrap;
        flex: 0 0 auto;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-text-quiet);
        transition: color var(--transition-fast);
      }

      .dossier__enter:hover,
      .dossier__enter:focus-visible {
        color: var(--color-accent-amber);
      }

      @media (min-width: 1920px) {
        .layout {
          grid-template-columns: 1fr 760px;
        }
      }

      @media (max-width: 1024px) {
        .layout {
          grid-template-columns: 1fr;
        }

        .preview {
          padding-top: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .row__titleline,
        .panel__art {
          transition: none;
        }

        .row:hover .row__titleline,
        .row:focus-visible .row__titleline {
          transform: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) worlds: DashboardWorld[] = [];

  /** Welche Zeile die Vorschau zeigt. Überfahren UND Fokus setzen sie. */
  @state() private _selected = 0;

  protected render() {
    if (!this.worlds.length) return nothing;
    const world = this.worlds[Math.min(this._selected, this.worlds.length - 1)];

    return html`
      <div class="layout stage-container">
        <div>
          <div class="head">
            <span class="head__kicker">${msg('Simulation Roster')}</span>
            <h2 class="head__title">${msg('My Worlds')}</h2>
            <span class="head__count">${this.worlds.length}</span>
          </div>
          ${this.worlds.map((w, i) => this._renderRow(w, i))}
          <button class="row row--new" @click=${() => navigate('/forge')}>
            <span class="row__index">+</span>
            <span class="row__body">
              <span class="row__titleline">
                <span class="row__name">${msg('Fracture a New Shard')}</span>
              </span>
              <p class="row__desc">${msg('One sentence in. A civilization out.')}</p>
            </span>
            <span class="row__meta"></span>
          </button>
        </div>
        ${this._renderPreview(world)}
      </div>
    `;
  }

  private _renderRow(world: DashboardWorld, index: number) {
    const select = () => {
      this._selected = index;
    };
    return html`
      <button
        class="row"
        style="--i: ${index}"
        @mouseenter=${select}
        @focus=${select}
        @click=${() => navigate(`/simulations/${world.slug}`)}
      >
        <span class="row__index">${String(index + 1).padStart(2, '0')}</span>
        <span class="row__body">
          <span class="row__titleline">
            <span class="row__name">${t(world, 'name')}</span>
            ${world.theme ? html`<span class="row__theme">${humanizeEnum(world.theme)}</span>` : nothing}
          </span>
          <p class="row__desc">${t(world, 'description')}</p>
        </span>
        <span class="row__meta">
          <span>${humanizeEnum(world.member_role)}</span>
          <span>${msg(str`${world.agent_count} AG · ${world.building_count} BLDG`)}</span>
        </span>
      </button>
    `;
  }

  private _renderPreview(world: DashboardWorld) {
    const lore = t(world, 'lore_body');
    const quote = t(world, 'lore_epigraph');
    const source = t(world, 'lore_title');
    const position = `${String(this._selected + 1).padStart(2, '0')} / ${String(this.worlds.length).padStart(2, '0')}`;
    // Die Verzweigung steht VOR der Übersetzung, nicht darin: eine Vorlage mit
    // einem Fragezeichen darin lässt sich nicht sinnvoll übersetzen, weil die
    // Übersetzerin nicht sieht, welcher Zweig gemeint ist. Dafür gibt es ein
    // eigenes Lint-Tor, und es hat hier zugeschlagen.
    const role = humanizeEnum(world.member_role);
    const theme = world.theme ? humanizeEnum(world.theme) : '';

    return html`
      <div class="preview">
        <div class="panel">
          ${
            world.banner_url
              ? html`<div class="panel__art" style="background-image: url('${world.banner_url}')"></div>`
              : nothing
          }
          <div class="panel__veil"></div>
          <div class="panel__scan"></div>
          <div class="panel__foot">
            <div>
              <div class="panel__tag">
                ${msg(str`${role} // ${theme}`)}
              </div>
              <div class="panel__name">${t(world, 'name')}</div>
            </div>
            <div class="panel__counter">${position}</div>
          </div>
        </div>
        <div class="dossier">
          ${lore ? html`<p class="dossier__lore">${lore}</p>` : nothing}
          <div class="dossier__quote">
            ${quote ? html`<p>“${quote}”</p>` : nothing}
            <div class="dossier__foot">
              <p class="dossier__source">${source ? msg(str`From: ${source}`) : ''}</p>
              <button class="dossier__enter" @click=${() => navigate(`/simulations/${world.slug}`)}>
                ${msg('Enter world')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-worlds': VelgDashboardWorlds;
  }
}
