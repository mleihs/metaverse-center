/**
 * Aus einem Charakterbild eine Zeile machen, die auf eine Karte passt.
 *
 * Der Endpunkt `/public/landing` liefert `character` — auf Produktion am
 * 03.09.2026 gemessen **964 bis 1141 Zeichen**, also einen Absatz. Auf der
 * Karte ist Platz fuer vier geklammerte Zeilen. Gebraucht wird kein
 * Kuerzungszeichen mitten im Wort, sondern ein Satz.
 *
 * DIE REGEL, UND WARUM SIE SO SCHMAL IST
 *
 * Der erste Satz dieser Texte beginnt ausnahmslos mit dem Namen, den die Karte
 * daneben schon gross setzt:
 *
 *     "Viktor Harken ist die lebende Verkoerperung des velgarischen Prinzips: …"
 *     "General Aldric Wolf verkoerpert die eiserne Disziplin und …"
 *     "Inspektor Mueller ist der gewissenhafteste Beamte einer Behoerde, die …"
 *
 * Der Name wird darum abgeschnitten — aber nur, wenn er WOERTLICH am Anfang
 * steht und ihm eines der aufgezaehlten Bindeverben folgt. Trifft die Regel
 * nicht, bleibt der Satz unangetastet: ein Teaser, der einen halben Satz
 * zeigt, ist schlimmer als einer, der den Namen wiederholt.
 *
 * Kein Versuch, Nebensaetze zu kuerzen oder Kommas zu deuten. Was hier
 * entsteht, ist der erste Satz ohne seine Anrede, sonst nichts.
 */

/**
 * Bindeverben, hinter denen die Aussage beginnt. Bewusst aufgezaehlt.
 *
 * OHNE die Artikel. Ein erster Versuch fuehrte "ist der" und "ist die" mit —
 * und schnitt damit den Artikel weg, der zur Aussage gehoert: aus "ist die
 * lebende Verkoerperung" wurde "Lebende Verkoerperung", aus "ist der
 * gewissenhafteste Beamte" wurde "Gewissenhafteste Beamte". Beides ist kein
 * Deutsch. Das Bindeverb endet beim Verb.
 */
const COPULAS = [
  // Deutsch
  'ist',
  'war',
  'bleibt',
  'gilt als',
  'gilt',
  'verkörpert',
  'verkoerpert',
  // Englisch
  'is',
  'was',
  'remains',
  'embodies',
];

/** Obergrenze, ab der auch ein erster Satz zu lang fuer eine Karte ist. */
const MAX_LENGTH = 190;

/** Der erste Satz eines Absatzes. */
function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  // Satzende ist ein Punkt, dem Leerraum und ein Grossbuchstabe folgen — so
  // ueberlebt "z. B." und ein Punkt in einer Zahl.
  const match = trimmed.match(/^(.*?[.!?])\s+[A-ZÄÖÜ]/);
  return (match ? match[1] : trimmed).trim();
}

/**
 * Eine Karten-Zeile aus dem Charakterbild eines Buergers.
 *
 * @param character Der Absatz aus dem Endpunkt. Leer oder `null` gibt `''`.
 * @param name Der Name, wie die Karte ihn zeigt — nur dieser wird entfernt.
 */
export function citizenTeaser(character: string | null | undefined, name: string): string {
  if (!character) return '';

  let sentence = firstSentence(character);
  if (!sentence) return '';

  const cleanName = name.trim();
  if (cleanName && sentence.toLowerCase().startsWith(cleanName.toLowerCase())) {
    const rest = sentence.slice(cleanName.length).trim();
    // Das laengste passende Bindeverb zuerst, damit "ist der" vor "ist" greift.
    const copula = [...COPULAS]
      .sort((a, b) => b.length - a.length)
      .find((c) => rest.toLowerCase().startsWith(`${c} `));
    if (copula) {
      const tail = rest.slice(copula.length).trim();
      if (tail) sentence = tail.charAt(0).toUpperCase() + tail.slice(1);
    }
  }

  if (sentence.length > MAX_LENGTH) {
    const cut = sentence.slice(0, MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    sentence = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]$/, '')}…`;
  }

  return sentence;
}
