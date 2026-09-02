/**
 * Der Beruf eines Agenten — vorübergehend nicht angezeigt.
 *
 * ═══ WARUM ═══════════════════════════════════════════════════════════════
 *
 * Am 02.09.2026 gemessen, auf Prod: es gibt DREI Berufssysteme, und keines
 * kennt ein anderes.
 *
 *   1. agents.primary_profession / _de     111 Zeilen · 17 Welten
 *                                          104 VERSCHIEDENE Werte
 *      Freier Text, den das Modell beim Weltenbau schreibt. Praktisch jeder
 *      Agent hat einen eigenen. Der Vertrag (backend/models/forge.py) verlangt
 *      "a short noun phrase", max_length=100 — die Spalte selbst ist `text`
 *      ohne Zwang, und eine Welt von vor dieser Disziplin trägt Werte bis
 *      380 Zeichen. DAS ist der Wert, den die Oberfläche zeigte.
 *
 *   2. simulation_taxonomies (taxonomy_type='profession')   187 Zeilen · 27 Welten
 *      Ein kontrolliertes Vokabular PRO WELT, mit Beschriftung {de,en} —
 *      genau das Mittel, mit dem die Plattform sonst Bauart, Zustand und
 *      Zonentyp benennt. Sechs Welten teilen sich denselben Satz
 *      (`ai-system, chaplain, commander, engineer, physicist, xenobiologist`),
 *      es sind also Vorlagen aus Themen-Presets, nicht aus den Agenten
 *      abgeleitet. Gelesen wird es von NIEMANDEM: `taxonomyLabel('profession',
 *      …)` steht an keiner Stelle im Baum.
 *      Deckung mit System 1: 12 von 111.
 *
 *   3. agent_professions                   180 Zeilen · 28 Welten · 55 versch.
 *      Die strukturierte Fassung: profession, qualification_level (Ø 4,33),
 *      specialization, is_primary. Mit eigenem Router und Dienst.
 *      Die verbrauchende Seite — building_profession_requirements — hat
 *      NULL Zeilen. Der Dienst kann Anforderungen lesen und schreiben; es
 *      existiert keine einzige. Deckung mit System 2: 12 von 180.
 *
 * Der Beruf hat also KEINE Wirkung im Spiel. Die Mechanik hängt an einer
 * anderen Achse: operative_type und die sechs Eignungswerte. Ein "General der
 * Streitkräfte" ist nicht militärischer als eine Archivarin — das entscheidet
 * allein sein Eignungsprofil.
 *
 * ═══ WAS AUSGEBLENDET IST, UND WAS NICHT ═════════════════════════════════
 *
 * AUSGEBLENDET ist nur die ANZEIGE. Der Beruf bleibt auf der Akte und bleibt
 * im Prompt: `chat_ai_service` gibt ihn als `agent_profession` in den
 * Chat-Systemprompt, `personality_extraction_service` und `chat_service`
 * (Gesprächseinstieg „Wie läuft deine Arbeit als {profession}?") lesen ihn
 * ebenfalls. Dort HAT er Bedeutung — er färbt, wie eine Figur spricht. Nichts
 * davon wird hier angefasst; ein Feld zu verstecken ist keine Erlaubnis, es zu
 * löschen.
 *
 * ═══ WIE ER ZURÜCKKOMMT ══════════════════════════════════════════════════
 *
 * Eine Zeile: PROFESSION_DISPLAY_ENABLED auf true. Sinnvoll wird das, sobald
 * eines der drei Systeme trägt — der naheliegendste Weg ist System 3, weil es
 * bereits zu 180 Zeilen gefüllt ist und nur seine Gegenseite fehlt:
 * building_profession_requirements füllen, dann wird qualification_level zu
 * einem Tor und der Beruf zu einer Entscheidung.
 *
 * Bis dahin wäre eine angezeigte Berufsbezeichnung eine Behauptung über eine
 * Spielbedeutung, die es nicht gibt.
 */

/** Der einzige Schalter. Auf `true`, sobald ein Beruf etwas bewirkt. */
export const PROFESSION_DISPLAY_ENABLED = false;

/**
 * Die anzuzeigende Berufsbezeichnung — leer, solange der Beruf nichts bedeutet.
 *
 * @param resolved Was die Aufrufstelle sonst angezeigt hätte, in der Sprache
 *   des Lesers (also in aller Regel `t(agent, 'primary_profession')`).
 */
export function professionLabel(resolved: string | null | undefined): string {
  if (!PROFESSION_DISPLAY_ENABLED) return '';
  return resolved ?? '';
}
