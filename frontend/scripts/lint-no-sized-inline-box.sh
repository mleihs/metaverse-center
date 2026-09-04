#!/usr/bin/env bash
#
# EINE INLINE-BOX NIMMT KEINE GROESSE AN.
#
# aspect-ratio gilt nicht fuer eine nicht-ersetzte Inline-Box. Steht es auf
# einer Klasse, die im Markup auf einem <span>, <a>, <em>, <b>, <i>, <label>,
# <small>, <code>, <abbr> oder <picture> sitzt, und nennt sie kein display,
# dann ist sie wirkungslos — ohne Fehler, ohne Warnung, ohne roten Test.
#
# WARUM ES DIESES TOR GIBT
#   Dreimal derselbe Bau, dreimal unsichtbar:
#     · <picture> ist display: inline — das <img> mit height: 100% fiel auf
#       null zusammen. Bild geladen, kein Fehler in der Konsole, nichts zu
#       sehen.
#     · AtlasRegistry .card__plate als <span>: aspect-ratio und overflow
#       wirkungslos, das Bild lief auf seine natuerliche Hoehe und schob den
#       Namen der Welt aus dem Blick. Vom Benutzer gemeldet, am 04.09.2026.
#     · IntakeBrowseModal .shot--none als <span>: der gestrichelte Kasten fuer
#       "kein Bild" hatte gar keine Groesse.
#   Der Nachbar mit demselben CSS und einem <div> im Markup sieht richtig aus.
#   Genau das macht die Klasse Fehler so zaeh: das Gegenstueck beweist, dass
#   das CSS stimmt, und lenkt die Suche in die Irre.
#
# EIN ERSETZTES ELEMENT IST NICHT BETROFFEN
#   <img>, <video>, <canvas>, <svg>, <iframe>, <input> bringen ihre eigene Box
#   mit und nehmen Groesse auch inline an. Sie stehen deshalb nicht in der
#   Liste — .shot in IntakeBrowseModal ist ein <img> und war nie ein Fehler.
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

node - <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

/* Nicht-ersetzte Inline-Elemente. Ersetzte (img, video, canvas, svg, iframe,
   input) fehlen mit Absicht — sie bringen ihre eigene Box mit. */
const INLINE = ['span', 'a', 'em', 'strong', 'b', 'i', 'label', 'small', 'code', 'abbr', 'picture'];

/* NUR aspect-ratio, und das ist eine bewusste Verengung.
   width, height und overflow stehen auch auf Inline-Boxen wirkungslos herum,
   aber ein Kind eines Flex- oder Grid-Behaelters wird BLOCKIFIZIERT, egal was
   sein eigenes display sagt. `.status-dot { width: 8px }` auf einem <span> in
   einer Flex-Zeile ist voellig richtig, und ein Tor, das den Elternteil nicht
   kennt, kann das nicht auseinanderhalten. Die erste Fassung meldete deshalb
   dutzendweise Stellen, die stimmen.

   aspect-ratio bleibt, weil es in diesem Werk fast ausschliesslich auf
   gerahmten Abbildungen steht -- einer Platte, einem Vorschaubild -- und die
   sitzen im Fluss, nicht in einer Flex-Zeile. Die drei bekannten Faelle waren
   alle von dieser Art. Ein Tor, das eine Bauart sicher faengt, ist mehr wert
   als eines, das alles meldet und deshalb eine Ausnahmeliste braucht. */
const SIZING = /(^|[;{\s])aspect-ratio\s*:/;

/* Ein display, das die Box aus dem Inline-Fluss holt. display: inline oder
   display: contents zaehlt NICHT — sie loesen das Problem nicht. */
const HAS_DISPLAY = /(^|[;{\s])display\s*:\s*(?!inline\s*;|inline\s*$|contents)/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/* SELBSTTEST. Ohne ihn misst dieses Tor irgendetwas.
   `<i[^>]*` liest `<img` als `<i` und `<b[^>]*` liest `<button` als `<b`;
   genau daran ist mein erster Durchgang gescheitert und hat neun Treffer
   gemeldet, von denen sechs keine waren. Die Wortgrenze `[\s>]` ist deshalb
   Pflicht, und dieser Test haelt sie fest. */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function markupUses(src, tag, cls) {
  /* [\s>] nach dem Tag ist Pflicht: ohne die Wortgrenze liest `<i` das `<img`
     und `<b` das `<button`. Der Klassenname wird escaped — er kommt aus dem
     Selektor und kann Regex-Zeichen tragen; genau daran ist die erste Fassung
     dieses Tors gescheitert. */
  const attr = new RegExp(`<${tag}[\\s>][^>]*?class=["'\`]([^"'\`]*)["'\`]`, 'g');
  for (const m of src.matchAll(attr)) {
    /* Exakter Vergleich der Klassenliste, nicht \\b. Eine Wortgrenze trennt
       auch am Bindestrich: `\\bshot\\b` trifft `shot--none`, und genau so hat
       mein erster Durchgang eine Fehlstelle erfunden. */
    if (m[1].split(/\s+/).includes(cls)) return true;
  }
  return false;
}
{
  const probe = '<img class="shot" /><button class="strip" />';
  if (markupUses(probe, 'i', 'shot') || markupUses(probe, 'b', 'strip')) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: <img> wird als <i> gelesen (fehlende Wortgrenze).');
    process.exit(2);
  }
  const probe2 = '<span class="a plate b">x</span>';
  if (!markupUses(probe2, 'span', 'plate')) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: eine Klasse in der Mitte der Liste wird nicht gefunden.');
    process.exit(2);
  }
  const probe3 = '<span class="shot--none"></span>';
  if (markupUses(probe3, 'span', 'shot')) {
    console.error('SELBSTTEST FEHLGESCHLAGEN: .shot trifft shot--none (Wortgrenze am Bindestrich).');
    process.exit(2);
  }
}

const findings = [];
let scanned = 0;

for (const file of walk('src/components')) {
  const raw = fs.readFileSync(file, 'utf8');
  scanned++;
  /* Kommentare ZUERST weg. Ohne das zieht die Regel-Erkennung den Kommentar
     ueber einer Regel in den Selektor, sobald darin ein Punkt-Wort steht --
     und liest dann `.plate` statt `.card__plate`. Genau daran ist die erste
     Fassung dieses Tors vorbeigelaufen: sie meldete PASS auf einer Datei mit
     dem Fehler, fuer den sie gebaut war. Ein Tor, das gruen ist, weil es die
     falsche Klasse gesucht hat, ist kein gruenes Tor. */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const m of src.matchAll(/([.#][\w_-]+[^{};]*?)\{([^{}]*)\}/g)) {
    const body = m[2];
    if (!SIZING.test(body)) continue;
    if (HAS_DISPLAY.test(body)) continue;
    const last = [...m[1].matchAll(/[.#]([A-Za-z_][\w-]*)/g)].pop();
    if (!last) continue;
    const cls = last[1];
    for (const tag of INLINE) {
      if (markupUses(src, tag, cls)) {
        const line = src.slice(0, m.index).split('\n').length;
        findings.push({ file, line, cls, tag });
        break;
      }
    }
  }
}

if (findings.length) {
  console.error('FEHLER: aspect-ratio auf einer Inline-Box — es wirkt nicht.\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    .${f.cls} sitzt im Markup auf <${f.tag}> und nennt kein display.`);
    console.error(`    aspect-ratio gilt fuer eine nicht-ersetzte Inline-Box nicht.`);
    console.error(`    Abhilfe: display: block (oder flex/grid) in dieselbe Regel.\n`);
  }
  process.exit(1);
}

console.log(`PASS: kein aspect-ratio auf einer Inline-Box (${scanned} Dateien, ${INLINE.length} Elemente).`);
NODE
