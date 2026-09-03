/**
 * Die Farben des Bureaus — einmal, an einem Ort.
 *
 * Das Bureau ist nicht Teil einer Welt, sondern der Plattform: eine Depesche
 * sieht in jeder Simulation gleich aus, unabhängig vom Thema. Deshalb stehen
 * hier rohe Hexwerte und keine Tier-1-Token — dieselbe Begründung, die
 * `terminal/BureauTerminal.ts` für seine CRT-Emulation führt.
 *
 * Warum dieses Modul existiert: dieselben vier Werte standen an VIER Orten,
 * unter vier verschiedenen Namen, jeweils mit eigener `lint-color-ok`-Marke —
 * `BureauTerminal.ts` (`--_screen-bg`/`--_border`/`--_text`/`--_text-dim`),
 * `intake/intake-styles.ts` (`--_bureau-*`) und die beiden Schlüsselbund-
 * Bausteine `forge/VelgKeyringCard.ts` + `forge/VelgKeyringRequest.ts`
 * (`--_gold*`). Die Marke schaltet `lint-color-tokens.sh` an jeder Stelle
 * einzeln ab, also konnte kein Tor bemerken, dass die vier Kopien
 * auseinanderlaufen. Ein Gold, das an einer Stelle nachgezogen wird, macht die
 * Depesche an den drei anderen falsch.
 *
 * Anwendung: als Element in das `static styles`-Array der Komponente hängen.
 *
 *   static styles = [css`…`, bureauPaletteStyles];
 *
 * Die Reihenfolge ist frei — Custom Properties lösen sich beim GEBRAUCH auf,
 * nicht bei der Deklaration, eine Komponente darf ihre eigenen Namen also auch
 * VOR diesem Modul auf die hiesigen abbilden. Der Bureau-Panel-Rahmen aus
 * `bureau-panel-styles.ts` ist davon unberührt: der muss laut eigenem Vertrag
 * das LETZTE Element bleiben, dieses Modul gehört also davor.
 *
 * Wer eine dieser Farben ändert, ändert sie für Terminal, Schleuse und
 * Schlüsselbund gemeinsam. Das ist der Zweck.
 */

import { css } from 'lit';

export const bureauPaletteStyles = css`
  :host {
    /* lint-color-ok: Depesche des Bureaus, themenunabhaengig — die einzige
       Stelle, an der diese vier Werte stehen. */
    --_bureau-screen: #0a0a08; /* lint-color-ok */
    --_bureau-border: #3d3200; /* lint-color-ok */
    --_bureau-text: #f5c542; /* lint-color-ok */
    --_bureau-dim: #a68a2e; /* lint-color-ok */
  }
`;
