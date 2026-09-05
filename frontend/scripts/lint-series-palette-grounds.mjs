#!/usr/bin/env node
/**
 * lint-series-palette-grounds.mjs — Serienfarben UND Kontor-Rollen gegen JEDEN Grund.
 *
 * ⚠ ZWEI GEGENSTAENDE seit dem 05.09.2026: die Serienpalette von
 *   `EchartsChart.ts` (Teil 1, urspruenglicher Zweck) und die zehn
 *   Kontor-Rollen aus `ThemeService.ts` (Teil 2, siehe unten). Sie stehen in
 *   EINEM Tor, weil sie dieselbe Frage stellen — „gegen welchen der drei
 *   Gruende ist das eigentlich gemessen?" — und ein zweites Tor dieselbe
 *   Antwort ein zweites Mal pflegen muesste.
 *
 * ── WOHER DIESES TOR KOMMT ──────────────────────────────────────────────────
 *
 * Zweimal unabhaengig derselbe Fehler:
 *
 *   03.09.2026  `theme-presets.ts` — vier Tinten waren gegen EINEN Grund
 *               getunt und standen auf dreien („eine Tinte gegen einen Grund
 *               steht auf dreien"). Behoben.
 *   05.09.2026  `EchartsChart.ts` — die Serienpalette SERIES_LIGHT war gegen
 *               `page` getunt (3,00–3,06 : 1) und fiel auf `sunken` durch:
 *
 *                              page   raised   sunken
 *                 Speranza     3,06     2,83     2,59  ✗
 *                 Gaslit       3,01     2,78     2,55  ✗
 *                 Velgarien    3,00     2,77     2,54  ✗
 *                 Nova         4,61     4,27     3,91  ✓
 *                 Station      3,06     2,83     2,59  ✗
 *
 * Vier von fuenf. Und genau dort, wo Tabellen und Kacheln stehen — auf der
 * gesenkten Auflage.
 *
 * ⚠ **Ein Skin hat mehrere Gruende.** Die Korrektur an der einen Stelle ist
 * nicht bei der anderen angekommen, weil kein Tor die Frage gestellt hat.
 *
 * ── WAS ES PRUEFT ───────────────────────────────────────────────────────────
 *
 * Jede Serienfarbe gegen ALLE DREI Gruende (`color_background`,
 * `color_surface`, `color_surface_sunken`) JEDES Themes der passenden
 * Polaritaet. Schwelle 3 : 1 nach WCAG SC 1.4.11 — eine Serienflaeche ist ein
 * bedeutungstragender Teil einer Grafik, kein Text.
 *
 * Nicht gerundet: SC 1.4.11 sagt woertlich „2.999:1 would not meet the 3:1
 * threshold".
 *
 * ── WAS ES NICHT PRUEFT ─────────────────────────────────────────────────────
 *
 * Ob die fuenf Toene UNTEREINANDER unterscheidbar sind. Das ist eine andere
 * Frage (Szafir: bei kleinen Marken braucht es 5–6 ΔE, nicht 1) und braucht
 * ein anderes Mass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SCHWELLE = 3.0;

// ── Kontrast ────────────────────────────────────────────────────────────────
const kanal = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminanz = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
};
const kontrast = (a, b) => {
  const [la, lb] = [luminanz(a), luminanz(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// ── Die Serienpaletten aus dem Diagramm-Wrapper ─────────────────────────────
const chartSrc = read('src/components/shared/EchartsChart.ts');
const palette = (name) => {
  const m = chartSrc.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) return [];
  return [...m[1].matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((x) => x[1]);
};
const SERIES_LIGHT = palette('SERIES_LIGHT');
const SERIES_DARK = palette('SERIES_DARK');

// ── Die Themes mit ihren drei Gruenden ──────────────────────────────────────
const themeSrc = read('src/services/theme-presets.ts');
const themen = [];
const bloecke = [...themeSrc.matchAll(
  /color_background:\s*'(#[0-9a-fA-F]{6})'[\s\S]{0,4000}?color_surface_sunken:\s*'(#[0-9a-fA-F]{6})'/g,
)];
for (const b of bloecke) {
  const abschnitt = themeSrc.slice(b.index, b.index + b[0].length);
  const surface = abschnitt.match(/color_surface:\s*'(#[0-9a-fA-F]{6})'/);
  const text = themeSrc.slice(b.index, b.index + 6000).match(/color_text:\s*'(#[0-9a-fA-F]{6})'/);
  const text2 = themeSrc
    .slice(b.index, b.index + 6000)
    .match(/color_text_secondary:\s*'(#[0-9a-fA-F]{6})'/);
  const text3 = themeSrc
    .slice(b.index, b.index + 6000)
    .match(/color_text_muted:\s*'(#[0-9a-fA-F]{6})'/);
  const davor = themeSrc.slice(Math.max(0, b.index - 700), b.index);
  const davorWeit = themeSrc.slice(Math.max(0, b.index - 8000), b.index);
  /*
   * Drei Schreibweisen: `speranza: {` und `'deep-space-horror': {` (Presets)
   * sowie `export const PLATFORM_ATLAS_CONFIG: Record<string, string> = {`
   * (die zwei Plattform-Skins).
   *
   * Genommen wird die LETZTE Deklaration vor dem Block, nicht eine per `$`
   * verankerte: eine `$`-Verankerung liess die faule Kommentar-Alternative
   * ueber die schliessende Klammer des VORIGEN Satzes springen, und der
   * Atlas hiess in der Fehlerausgabe daraufhin PLATFORM_DARK_CONFIG. Ein
   * Befund unter fremdem Namen ist schlimmer als ein Befund ohne Namen.
   */
  let name = null;
  let besteStelle = -1;
  for (const muster of [
    /(?:^|[\s,{])(\w[\w-]*):\s*\{/g,
    /'([\w-]+)':\s*\{/g,
    /export const (\w+):\s*Record<string, string>\s*=\s*\{/g,
  ]) {
    for (const treffer of davorWeit.matchAll(muster)) {
      if (treffer.index > besteStelle) {
        besteStelle = treffer.index;
        name = treffer;
      }
    }
  }
  themen.push({
    name: name ? name[1] : `theme@${b.index}`,
    gruende: [b[1], surface ? surface[1] : b[1], b[2]],
    hell: text ? luminanz(b[1]) > luminanz(text[1]) : null,
    tinte2: text2 ? text2[1] : null,
    tinte1: text ? text[1] : null,
    tinte3: text3 ? text3[1] : null,
  });
}

// ── Erst die Bedingung herstellen, dann pruefen ─────────────────────────────
//
// Ohne diese drei Zeilen bestuende das Tor auch dann, wenn eine Umbenennung
// die Suche ins Leere laufen liesse — und meldete jahrelang gruen, ohne je
// etwas angesehen zu haben.
const fehler = [];
if (SERIES_LIGHT.length < 3) fehler.push(`SERIES_LIGHT: nur ${SERIES_LIGHT.length} Farben gefunden`);
if (SERIES_DARK.length < 3) fehler.push(`SERIES_DARK: nur ${SERIES_DARK.length} Farben gefunden`);
if (themen.length < 5) fehler.push(`nur ${themen.length} Themes gefunden`);
if (fehler.length) {
  console.error('FAIL: das Tor findet seinen Gegenstand nicht mehr.');
  for (const f of fehler) console.error(`  ${f}`);
  process.exit(1);
}

// ── Die Pruefung ────────────────────────────────────────────────────────────
const ROLLEN = ['page', 'raised', 'sunken'];
const funde = [];
let geprueft = 0;
for (const t of themen) {
  if (t.hell === null) continue;
  const serie = t.hell ? SERIES_LIGHT : SERIES_DARK;
  const wie = t.hell ? 'SERIES_LIGHT' : 'SERIES_DARK';
  t.gruende.forEach((grund, i) => {
    for (const farbe of serie) {
      geprueft++;
      const k = kontrast(farbe, grund);
      if (k < SCHWELLE) {
        funde.push(`${t.name} · ${ROLLEN[i]} ${grund} · ${wie} ${farbe} = ${k.toFixed(2)} : 1`);
      }
    }
  });
}

if (funde.length) {
  console.error(`FAIL: ${funde.length} Serienfarbe(n) unter ${SCHWELLE} : 1 (SC 1.4.11).`);
  console.error('      Ein Skin hat MEHRERE Gruende — gegen alle messen, nicht gegen einen.\n');
  for (const f of funde) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`  Themes: ${themen.map((t) => `${t.name}${t.hell === null ? '?' : t.hell ? '(hell)' : '(dunkel)'}`).join(' · ')}`);
console.log(
  `Teil 1 PASS: alle Serienfarben ueber ${SCHWELLE} : 1 ` +
    `(${geprueft} Paarungen, ${themen.length} Themes x 3 Gruende).`,
);

// ════════════════════════════════════════════════════════════════════════════
// TEIL 2 · Die zehn Kontor-Rollen
// ════════════════════════════════════════════════════════════════════════════
//
// ── WOHER ───────────────────────────────────────────────────────────────────
//
// Das Kostenpanel „Kontor" brachte zehn Rollen mit, die es vorher nicht gab.
// Der Entwurf wollte sie ueber `THEME_TOKEN_MAP` fuehren; das haette den
// Atlas-Skin bedient und die sechs hellen WELT-Themes still auf den dunklen
// Werten stehen lassen. Sie werden deshalb in `ThemeService.publishKontorPalette`
// an der POLARITAET gekippt — und muessen dadurch auf den Gruenden ALLER
// Themes der jeweiligen Polaritaet tragen, nicht nur auf den zwei
// Plattform-Skins.
//
// Beim Nachrechnen (05.09.2026, vor dem Bau) fielen drei Paarungen durch:
//
//     --color-hatch          #666666  auf `raised` #0f2236  = 2,81   (< 3,0)
//     --color-hatch          #666666  auf `raised` #0c2424  = 2,83   (< 3,0)
//     --color-delta-adverse  #b3261e  auf `sunken` #E0D4BE  = 4,46   (< 4,5)
//
// Beide Werte wurden um den kleinsten Schritt gehoben, der traegt
// (#6b6b6b bzw. #b1261e).
//
// ── DREI RICHTUNGEN, NICHT EINE ─────────────────────────────────────────────
//
// Ein Tor, das nur nach UNTEN prueft, laesst genau die Fehler durch, die dem
// Entwurf schon zweimal passiert sind:
//
//   MINDESTENS   Text und bedeutungstragende Flaechen (4,5 bzw. 3,0).
//   HOECHSTENS   Der Zeilen-Hover. Wird er zu stark, liest sich die
//                ueberfahrene Zeile als ausgewaehlt — ein Fehler ohne
//                Fehlermeldung. Schwelle 1,15 aus dem Entwurf.
//   DIE TINTE DARAUF
//                `--color-hatch-bg` ist kein Wert, sondern ein VIERTER GRUND:
//                die Schraffur liegt HINTER Text. Gemessen traegt sie
//                `--color-text-primary` (10,78) und `--color-text-secondary`
//                (5,19), aber NICHT `--color-text-muted` (3,83). Geprueft wird
//                deshalb die Sekundaertinte JEDES Themes auf ihr — die Rolle
//                allein gegen den Seitengrund zu messen haette hier nichts
//                gesagt.
//
// ── WAS ES AUSDRUECKLICH NICHT PRUEFT ───────────────────────────────────────
//
// `--color-chart-grid` und `--color-series-forecast` haben keine Schwelle:
// eine Splitline ist weder Text noch bedeutungstragende Grafik, und der
// Prognosebalken ist absichtlich schwach und traegt keine Beschriftung. Sie
// werden unten NAMENTLICH als ungeprueft gemeldet — eine Pruefung, die
// schweigt, ist von einer, die nichts gefunden hat, sonst nicht zu
// unterscheiden.

const themeServiceSrc = read('src/services/ThemeService.ts');

/** `KONTOR_DARK` / `KONTOR_PAPER` aus dem Dienst lesen, nicht nachbauen. */
const kontorSatz = (name) => {
  const m = themeServiceSrc.match(new RegExp(`const ${name}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) return null;
  const satz = {};
  for (const z of m[1].matchAll(/'(--[a-z0-9-]+)':\s*'([^']+)'/g)) satz[z[1]] = z[2];
  return satz;
};
const KONTOR_DARK = kontorSatz('KONTOR_DARK');
const KONTOR_PAPER = kontorSatz('KONTOR_PAPER');

/** Rolle → [Art, Schwelle]. `null` = ausdruecklich ohne Schwelle, mit Grund. */
const KONTOR_ROLLEN = {
  '--color-delta-adverse': ['min', 4.5],
  '--color-delta-benign': ['min', 4.5],
  '--color-series-image': ['min', 4.5],
  '--color-series-text': ['min', 4.5],
  '--color-text-glyph': ['min', 3.0],
  '--color-hatch': ['min', 3.0],
  '--color-row-hover': ['max', 1.15],
  '--color-hatch-bg': ['tinte', 4.5],
  '--color-chart-grid': [null, 'Splitline — weder Text noch bedeutungstragende Grafik'],
  '--color-series-forecast': [null, 'absichtlich schwach, traegt keine Beschriftung'],
};

// ── Alpha aufloesen ─────────────────────────────────────────────────────────
//
// `rgba(...)` ist kein Kontrastwert, solange nicht feststeht, WORUEBER es
// liegt. Der Stapel wird deshalb gegen den jeweiligen Grund ausgerechnet,
// nicht geschaetzt.
const kanaele = (hexwert) => {
  const h = hexwert.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const alsHex = (a) =>
  '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const aufloesen = (wert, grund) => {
  if (wert.startsWith('#')) return wert;
  const m = wert.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*[,/]\s*([\d.]+)\s*\)/);
  if (!m) return null;
  const a = Number(m[4]);
  const vg = [Number(m[1]), Number(m[2]), Number(m[3])];
  return alsHex(kanaele(grund).map((g, i) => vg[i] * a + g * (1 - a)));
};

// ── Erst die Bedingung herstellen ───────────────────────────────────────────
//
// Ohne diesen Block meldete das Tor auch dann gruen, wenn eine Umbenennung
// die beiden Saetze unauffindbar macht — es haette dann null Paarungen
// geprueft und null Fehler gefunden. Das ist kein Bestehen.
const teil2Fehler = [];
if (!KONTOR_DARK) teil2Fehler.push('KONTOR_DARK nicht gefunden in ThemeService.ts');
if (!KONTOR_PAPER) teil2Fehler.push('KONTOR_PAPER nicht gefunden in ThemeService.ts');
for (const rolle of Object.keys(KONTOR_ROLLEN)) {
  if (KONTOR_DARK && !KONTOR_DARK[rolle]) teil2Fehler.push(`KONTOR_DARK ohne ${rolle}`);
  if (KONTOR_PAPER && !KONTOR_PAPER[rolle]) teil2Fehler.push(`KONTOR_PAPER ohne ${rolle}`);
}
if (KONTOR_DARK && KONTOR_PAPER) {
  for (const rolle of Object.keys(KONTOR_DARK)) {
    if (!KONTOR_ROLLEN[rolle]) teil2Fehler.push(`${rolle} steht im Satz, aber in keiner Rollenliste`);
  }
}
/** Die zwei Saetze, auf denen das Kostenpanel tatsaechlich rendert. */
const PLATTFORM_SKINS = new Set(['PLATFORM_DARK_CONFIG', 'PLATFORM_ATLAS_CONFIG']);

for (const skin of PLATTFORM_SKINS) {
  if (!themen.some((t) => t.name === skin))
    teil2Fehler.push(`${skin} nicht als Theme erkannt — die Tintenprobe haette keinen Gegenstand`);
}
if (!themen.some((t) => t.hell === true)) teil2Fehler.push('kein helles Theme gefunden');
if (!themen.some((t) => t.hell === false)) teil2Fehler.push('kein dunkles Theme gefunden');
if (themen.some((t) => t.hell === true && !t.tinte2))
  teil2Fehler.push('ein helles Theme ohne color_text_secondary — die Tintenprobe waere blind');
if (teil2Fehler.length) {
  console.error('\nFAIL: Teil 2 findet seinen Gegenstand nicht mehr.');
  for (const f of teil2Fehler) console.error(`  ${f}`);
  process.exit(1);
}

// ── Die Pruefung ────────────────────────────────────────────────────────────
const k2Funde = [];
let k2Geprueft = 0;
const ohneSchwelle = [];
for (const [rolle, [art, schwelle]] of Object.entries(KONTOR_ROLLEN)) {
  if (art === null) {
    ohneSchwelle.push(`${rolle} (${schwelle})`);
    continue;
  }
  /*
   * Die Tintenprobe gilt NUR den zwei Plattform-Skins, und das ist eine
   * Einschraenkung mit Grund, kein Versehen.
   *
   * `--color-hatch-bg` ist eine Flaeche DES PANELS, und das Kostenpanel steht
   * im Admin, oberhalb der Welten (DESIGN-AUTORITAET #10: es darf nie an einem
   * welt-gethemten Wirt haengen, sonst faerbt eine Simulation die
   * Betriebszahlen). Die Frage „traegt diese Schraffur die Sekundaertinte?"
   * hat deshalb genau dort eine Antwort, wo das Panel wirklich rendert.
   *
   * Gemessen gegen alle zwoelf Themes faellt sie an zwei Stellen durch —
   * `solarpunk` (Oliv #4d7c0f auf #c2ccc4 = 3,03) und `deep-space-horror`
   * (#7888a0 auf #2e2e2e = 3,77). Das ist kein Fehler des Tokens, sondern die
   * Grenze seiner Zusage: eine WELT, die `--color-hatch-bg` uebernimmt, muss
   * ihre eigene Tinte darauf nachmessen. Steht so in
   * `handoff/kostenpanel/BILANZ.md`.
   *
   * Die Schranke wird unten NAMENTLICH ausgegeben. Eine eingeschraenkte
   * Pruefung, die ihre Schranke verschweigt, ist von einer vollstaendigen
   * nicht zu unterscheiden — und das ist der Fehler, der diesem Projekt
   * mehrfach eine gruene Meldung ohne Gegenstand eingebracht hat.
   */
  const gegenstand = art === 'tinte' ? themen.filter((t) => PLATTFORM_SKINS.has(t.name)) : themen;

  for (const t of gegenstand) {
    if (t.hell === null) continue;
    const roh = (t.hell ? KONTOR_PAPER : KONTOR_DARK)[rolle];
    const satz = t.hell ? 'KONTOR_PAPER' : 'KONTOR_DARK';

    if (art === 'tinte') {
      /*
       * Einmal je Theme, nicht je Grund: die Schraffur ist selbst der Grund,
       * auf dem gemessen wird. Der Wert ist deckend, also haengt er nicht
       * davon ab, was darunter liegt — dieselbe Pruefung dreimal auszugeben
       * hat den Befund oben dreifach gemeldet und dabei so ausgesehen, als
       * waeren es drei.
       */
      const farbe = aufloesen(roh, t.gruende[0]);
      if (farbe === null) {
        k2Funde.push(`${t.name} · ${rolle} · Wert "${roh}" nicht aufloesbar`);
        continue;
      }
      k2Geprueft++;
      const k = kontrast(t.tinte2, farbe);
      if (k < schwelle) {
        k2Funde.push(
          `${t.name} · ${satz} ${rolle} ${farbe} · Sekundaertinte ${t.tinte2} darauf = ${k.toFixed(2)} : 1 (min ${schwelle})`,
        );
      }
      continue;
    }

    t.gruende.forEach((grund, i) => {
      const farbe = aufloesen(roh, grund);
      if (farbe === null) {
        k2Funde.push(`${t.name} · ${rolle} · Wert "${roh}" nicht aufloesbar`);
        return;
      }
      k2Geprueft++;
      const k = kontrast(farbe, grund);
      const durch = art === 'min' ? k < schwelle : k > schwelle;
      if (durch) {
        k2Funde.push(
          `${t.name} · ${ROLLEN[i]} ${grund} · ${satz} ${rolle} ${farbe} = ${k.toFixed(2)} : 1 (${art === 'min' ? 'min' : 'max'} ${schwelle})`,
        );
      }
    });
  }
}

if (k2Funde.length) {
  console.error(`\nFAIL: ${k2Funde.length} Kontor-Rolle(n) verletzen ihre Schwelle.`);
  console.error('      Ein Skin hat MEHRERE Gruende — und zwei dieser Rollen duerfen');
  console.error('      nicht zu STARK werden, nicht zu schwach.\n');
  for (const f of k2Funde) console.error(`  ${f}`);
  process.exit(1);
}

console.log(
  `Teil 2 PASS: alle Kontor-Rollen halten ihre Schwelle ` +
    `(${k2Geprueft} Paarungen, ${themen.filter((t) => t.hell !== null).length} Themes x 3 Gruende).`,
);
console.log(`             ohne Schwelle, mit Begruendung: ${ohneSchwelle.join(' · ')}`);
console.log(
  `             Tintenprobe (--color-hatch-bg) nur auf ${[...PLATTFORM_SKINS].join(' + ')} — ` +
    'das Panel rendert nur dort (DESIGN-AUTORITAET #10).',
);

// ════════════════════════════════════════════════════════════════════════════
// TEIL 3 · Die Paarung Schraffur / Tinte im Stilmodul
// ════════════════════════════════════════════════════════════════════════════
//
// ── WOHER ───────────────────────────────────────────────────────────────────
//
// `--color-hatch-bg` ist kein Wert, sondern ein VIERTER GRUND: die Schraffur
// liegt hinter Text. Teil 2 prueft, dass sie die Sekundaertinte traegt — aber
// nicht, dass die Zelle sie auch benutzt. Genau da ist es im Entwurf
// schiefgegangen: dort steht `░` in `--k-ink-3` auf der eigenen Schraffur.
//
//     --color-text-glyph      auf --color-hatch-bg   2,55 (dunkel) · 2,74 (Papier)
//     --color-text-muted      auf --color-hatch-bg   3,83 (dunkel) · 3,96 (Papier)
//     --color-text-secondary  auf --color-hatch-bg   5,19 (dunkel) · 5,98 (Papier)
//
// Die ZEICHENtinte faellt dort sogar unter die 3 : 1 fuer bedeutungstragende
// Zeichen — sie ist gegen den SEITENgrund getunt. Zwei plausible Waehlbare
// sind also falsch, und die falsche Wahl ist die naheliegendere: die
// Sammelzeile „ohne Angabe" SOLL leiser sein als eine Datenzeile.
//
// ── WAS ES PRUEFT ───────────────────────────────────────────────────────────
//
// Jede CSS-Regel in `kontor-table-styles.ts`, die `--color-hatch-bg` setzt,
// muss in DERSELBEN Regel eine `color` erklaeren, und die muss auf der
// Schraffur 4,5 : 1 tragen — in beiden Plattform-Skins. Getrennt gesetzte
// Paarungen sind der Fehler selbst, deshalb ist „keine color in der Regel"
// ein Befund und kein uebersprungener Fall.

const KONTOR_STYLES = 'src/components/shared/kontor-table-styles.ts';
const stilSrc = read(KONTOR_STYLES);

/** Tintentokens auf ihren Wert je Plattform-Skin abbilden. */
const skinTinten = (skinName) => {
  const t = themen.find((x) => x.name === skinName);
  if (!t) return null;
  const kontorSatzFuer = t.hell ? KONTOR_PAPER : KONTOR_DARK;
  return {
    '--color-text-primary': t.tinte1,
    '--color-text-secondary': t.tinte2,
    '--color-text-muted': t.tinte3,
    '--color-text-glyph': kontorSatzFuer['--color-text-glyph'],
    '--color-hatch-bg': kontorSatzFuer['--color-hatch-bg'],
  };
};

const teil3Fehler = [];
// Regelkoerper grob zerlegen: `selektor { … }`. Reicht, weil das Modul flach
// ist (keine verschachtelten Regeln) — und wenn es das eines Tages nicht mehr
// ist, findet der Vorbedingungsblock unten keine Paarung mehr und meldet das.
const regeln = [...stilSrc.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({
  selektor: m[1].trim().split('\n').pop().trim(),
  koerper: m[2],
}));
const schraffurRegeln = regeln.filter((r) => r.koerper.includes('--color-hatch-bg'));

if (schraffurRegeln.length === 0) {
  teil3Fehler.push(
    `keine Regel in ${KONTOR_STYLES} setzt --color-hatch-bg — Teil 3 haette nichts geprueft`,
  );
}
for (const skin of PLATTFORM_SKINS) {
  if (!skinTinten(skin)) teil3Fehler.push(`${skin}: Tintenwerte nicht auflösbar`);
}

let t3Geprueft = 0;
for (const regel of schraffurRegeln) {
  const farbe = regel.koerper.match(/(?:^|\n)\s*color:\s*var\((--[a-z0-9-]+)\)/);
  if (!farbe) {
    teil3Fehler.push(
      `${regel.selektor}: setzt --color-hatch-bg, erklaert aber keine eigene color — ` +
        'die Tinte kaeme dann von aussen und waere auf der Schraffur ungeprueft',
    );
    continue;
  }
  for (const skin of PLATTFORM_SKINS) {
    const tinten = skinTinten(skin);
    if (!tinten) continue;
    const tinte = tinten[farbe[1]];
    const grund = tinten['--color-hatch-bg'];
    if (!tinte || !grund) {
      teil3Fehler.push(`${regel.selektor} · ${skin}: ${farbe[1]} ist kein bekanntes Tintentoken`);
      continue;
    }
    t3Geprueft++;
    const k = kontrast(tinte, grund);
    if (k < 4.5) {
      teil3Fehler.push(
        `${regel.selektor} · ${skin}: ${farbe[1]} ${tinte} auf der Schraffur ${grund} = ` +
          `${k.toFixed(2)} : 1 (min 4,5) — auf der Schraffur steht Sekundaertinte oder hoeher`,
      );
    }
  }
}

if (teil3Fehler.length) {
  console.error('\nFAIL: die Paarung Schraffur / Tinte traegt nicht.');
  console.error('      Die Schraffur ist ein VIERTER Grund, kein Wert.\n');
  for (const f of teil3Fehler) console.error(`  ${f}`);
  process.exit(1);
}

console.log(
  `Teil 3 PASS: ${schraffurRegeln.length} Schraffur-Regel(n) paaren Tinte und Grund ` +
    `(${t3Geprueft} Paarungen ueber ${PLATTFORM_SKINS.size} Skins).`,
);
