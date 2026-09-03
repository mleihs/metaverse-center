/**
 * Die geteilten Bedienelemente der Schleuse.
 *
 * Vier Komponenten (Schmelztiegel, Quarantäne-Karte, Resonanz-Modal,
 * Melden-Modal) benutzen dieselben vier Dinge: ein Mono-Etikett, eine
 * Fussnote, einen Chip und einen Knopf. Sie viermal zu schreiben hiesse, vier
 * Gelegenheiten zu schaffen, dass ein Chip in der einen Kammer anders aussieht
 * als in der nächsten — und die Schleuse ist EIN Board, kein Satz Fenster.
 *
 * Was hier NICHT hineingehört: alles, was nur eine Komponente hat. Ein
 * geteiltes Stilmodul, in das jeder seine Sonderfälle legt, ist eine zweite
 * Komponente ohne Namen.
 */

import { css } from 'lit';

export const intakeControlStyles = css`
  .label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-widest);
    text-transform: var(--label-transform);
    color: var(--color-text-muted);
  }

  .note {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wider);
    text-transform: var(--label-transform);
    color: var(--color-text-tertiary);
  }

  .prose {
    font-family: var(--font-prose);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--color-text-secondary);
    margin: 0;
    text-wrap: pretty;
  }

  .prose--quiet {
    font-style: italic;
    color: var(--color-text-tertiary);
  }

  /* ── Chip: eine Wahl unter mehreren ──────────────────────────────────── */

  .chip {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wider);
    text-transform: var(--label-transform);
    padding: var(--space-1-5) var(--space-2-5);
    background: transparent;
    border: var(--border-width-thin) solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }

  .chip:hover:not(:disabled),
  .chip:focus-visible:not(:disabled) {
    border-color: var(--color-accent-amber);
    color: var(--color-text-primary);
  }

  .chip:focus-visible {
    outline: none;
    box-shadow: var(--ring-focus);
  }

  /*
   * Die Auswahl ist der GANZE Rahmen plus Füllung, nie ein Balken an einer
   * Kante — das Haus verbietet den Balken (lint-no-accent-edge-bar.sh), und
   * ein Chip ist klein genug, dass der volle Rahmen ihn trägt.
   */
  .chip--on {
    background: var(--color-accent-amber);
    border-color: var(--color-accent-amber);
    color: var(--color-on-accent-amber);
  }

  .chip--on:hover,
  .chip--on:focus-visible {
    color: var(--color-on-accent-amber);
  }

  .chip--green.chip--on {
    background: transparent;
    border-color: var(--color-accent-green);
    color: var(--color-accent-green);
  }

  .chip:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* ── Knopf: eine Handlung ────────────────────────────────────────────── */

  .act {
    font-family: var(--font-brutalist);
    font-weight: var(--font-bold);
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-widest);
    text-transform: var(--label-transform);
    padding: var(--space-2-5) var(--space-4);
    background: transparent;
    border: var(--border-width-thin) solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: border-color var(--transition-fast), color var(--transition-fast);
  }

  .act:hover:not(:disabled),
  .act:focus-visible:not(:disabled) {
    border-color: var(--color-accent-amber);
    color: var(--color-text-primary);
  }

  .act:focus-visible {
    outline: none;
    box-shadow: var(--ring-focus);
  }

  .act--primary {
    background: var(--color-accent-amber);
    border-color: var(--color-accent-amber-dim);
    color: var(--color-on-accent-amber);
    box-shadow: var(--shadow-md);
  }

  .act--primary:hover:not(:disabled),
  .act--primary:focus-visible:not(:disabled) {
    background: var(--color-accent-amber-hover);
    color: var(--color-on-accent-amber);
  }

  .act--green {
    border-color: var(--color-accent-green);
    color: var(--color-accent-green);
  }

  .act--green:hover:not(:disabled),
  .act--green:focus-visible:not(:disabled) {
    border-color: var(--color-accent-green);
    color: var(--color-accent-green);
    background: color-mix(in srgb, var(--color-accent-green) 12%, transparent);
  }

  .act:disabled {
    opacity: 0.35;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .act {
      transition-duration: 0.01ms;
    }
  }
`;

/**
 * Die Farbe einer Quellenklasse — an EINER Stelle.
 *
 * Die Sensorkachel führte sie als `:host([kind='…'])`, weil die Klasse dort auf
 * dem Host steht. Die Sichtung braucht dieselbe Farbe an einem Punkt und einem
 * Wort MITTEN in einer Karte, wo `:host` nicht greift. Zwei Tabellen für
 * dieselben sechs Werte wären zwei Gelegenheiten, dass ein Adapter in der
 * Leiste grün und in der Sichtung bernstein ist.
 *
 * ⚠ Der erste Anlauf schrieb `var(--color-source-structured)` in die Sichtung.
 * Diesen Token gibt es nicht — der Rückfall hätte gegriffen, JEDER Punkt wäre
 * grau gewesen, und nichts hätte es gemeldet. Deshalb steht die Zuordnung hier
 * und nicht als zusammengesetzter Tokenname am Aufrufort: ein Name, der
 * gebildet wird, kann auf nichts zeigen, ohne dass es auffällt.
 *
 * Beide Selektorformen sind Absicht: `:host([kind])` für die Kachel,
 * `[data-kind]` für alles, was in einer Karte liegt.
 */
export const intakeKindColorStyles = css`
  :host,
  [data-kind] {
    --_kind: var(--color-text-secondary);
  }

  :host([kind='structured']),
  [data-kind='structured'] {
    --_kind: var(--color-accent-green);
  }
  :host([kind='semi']),
  [data-kind='semi'] {
    --_kind: var(--color-epoch-influence);
  }
  :host([kind='llm']),
  [data-kind='llm'] {
    --_kind: var(--color-accent-amber);
  }
  :host([kind='internal']),
  [data-kind='internal'] {
    --_kind: var(--color-info);
  }
  :host([kind='social']),
  [data-kind='social'] {
    --_kind: var(--color-text-secondary);
  }
  :host([kind='nokey']),
  [data-kind='nokey'] {
    --_kind: var(--color-danger);
  }
`;

/**
 * Die Farben des Bureaus — nur noch weitergereicht.
 *
 * Die Werte standen hier, und ihr eigener Kommentar hat bereits beschrieben,
 * dass `BureauTerminal.ts` dieselben vier Farben unter anderen Namen führt.
 * Beschrieben ist nicht behoben: am selben Tag kamen mit dem Schlüsselbund
 * zwei weitere Kopien dazu. Sie stehen jetzt an EINER Stelle,
 * `shared/bureau-palette-styles.ts`, und werden hier nur re-exportiert, damit
 * die bestehenden Importe der Schleuse gültig bleiben.
 */
export { bureauPaletteStyles } from '../shared/bureau-palette-styles.js';

/**
 * Die Werkzeugleiste über einer Kammer.
 *
 * Vier Modale trugen diesen Block wörtlich gleich — und unter ZWEI Namen:
 * `.tools` in Durchsicht und Sichtung, `.head` im Lesesaal und im Scan-Log.
 * Zwei Namen für dieselbe Sache sind der Anfang zweier Gestaltungen: wer die
 * Polsterung an einer Stelle nachzieht, verschiebt die Leiste in zwei von vier
 * Kammern. Der Name ist jetzt `.tools`, überall.
 *
 * `.head` blieb bewusst NICHT der gemeinsame Name: die Klasse steht in fast
 * jeder Datei der Schleuse für etwas anderes, ein geteilter Block unter diesem
 * Namen hätte Flächen getroffen, die keine Werkzeugleiste sind.
 */
export const intakeToolbarStyles = css`
  .tools {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-5);
    border-block-end: var(--border-width-thin) solid var(--color-border-light);
  }
`;
