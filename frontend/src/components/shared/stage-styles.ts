/**
 * Die Bühne — das gemeinsame Raster der beiden ganzseitigen Flächen.
 *
 * Frontseite und Dashboard sind die einzigen Ansichten, die über die volle
 * Breite gehen und bei 4K weiterwachsen sollen. Beide bauten das Raster
 * zunächst selbst; das wären zwei Rasterlogiken für dasselbe Produkt gewesen.
 * Die Maße stehen jetzt in `styles/tokens/_layout.css` (`--stage-measure`,
 * `--stage-gutter`, `--stage-type-scale`), und hier stehen die zwei
 * Bauformen, die man daraus IMMER braucht.
 *
 * WARUM ES ZWEI SIND UND NICHT EINE
 *
 * `.stage-container` ist die normale Inhaltsreihe: ein zentrierter Kasten im
 * Maß der Bühne, dessen Polsterung INNERHALB des Maßes liegt.
 *
 * `.stage-bleed-row` ist die Reihe, deren Hintergrund oder Trennlinie über
 * den ganzen Sichtbereich laufen muss, während ihr Inhalt trotzdem bündig
 * unter den Reihen darüber steht — die Kopfnavigation, die Rechtszeile, die
 * Befehlsleiste. Sie darf deshalb KEINE Maximalbreite bekommen (die würde die
 * Linie mit abschneiden) und rechnet den Behälter stattdessen nach.
 *
 * ⚠ `box-sizing: border-box` ist der Kern und nicht Beiwerk. Im Schatten-DOM
 * gilt `content-box`; ohne die Zeile misst `max-width: 1920px` nur den Inhalt,
 * der Kasten wird 1920 + 2 × Polsterung breit, und der sichtbare Rand ist bei
 * 2560 px um 64 px je Seite falsch. Das sieht kein Linter und kein tsc — es
 * ist am 31.08.2026 genau so passiert und erst beim Messen im Browser
 * aufgefallen.
 *
 * ⚠ `100%` und nicht `100vw`: `100vw` schließt die Breite des Rollbalkens ein
 * und macht die Reihe um ein paar Pixel zu breit.
 *
 * BENUTZUNG
 *
 *     static styles = [stageStyles, css`…`];
 *     …
 *     <div class="layout stage-container">…</div>
 *     <div class="nav stage-bleed-row">…</div>
 *
 * Die eigene Klasse behält Aussehen und Raster; die Bühnenklasse übernimmt
 * Breite, Polsterung und Kastenmodell. Wer beides in der eigenen Klasse noch
 * einmal setzt, hat zwei Wahrheiten — genau davor bewahrt dieses Modul.
 */

import { css } from 'lit';

export const stageStyles = css`
  .stage-container {
    box-sizing: border-box;
    max-width: var(--stage-measure);
    margin-inline: auto;
    padding-inline: var(--stage-gutter);
  }

  .stage-bleed-row {
    box-sizing: border-box;
    padding-inline: max(
      var(--stage-gutter),
      calc((100% - var(--stage-measure)) / 2 + var(--stage-gutter))
    );
  }
`;
