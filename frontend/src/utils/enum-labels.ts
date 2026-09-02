/**
 * Die deutschen Wörter für Aufzählungswerte, an einer Stelle.
 *
 * WAS GEFUNDEN WURDE (01.09.2026, deutsche Oberfläche auf Prod)
 * Das Einsatzterminal zeigte in einer sonst durchgehend deutschen Ansicht:
 *
 *     VELGARIEN  DYSTOPIAN          …          Owner
 *
 * Die Ursache war nicht eine fehlende Übersetzung. `Eigentümer`, `Dystopisch`
 * und `Benutzerdefiniert` standen seit jeher im Wörterbuch — sie wurden nur nie
 * erfragt. Die Anzeigestellen riefen `humanizeEnum()`, und das ist ein
 * VERSCHÖNERER, kein Übersetzer: es macht aus `owner` ein `Owner` und aus
 * `member_role` ein `Member Role`, in jeder Sprache gleich.
 *
 * WARUM KEIN TOR DAS SAH
 * Eine Stelle sah sogar wie eine Übersetzung aus:
 *
 *     ${msg(str`${role} // ${theme}`)}
 *
 * Die VORLAGE steht im Wörterbuch und ist übersetzt. Der INHALT der Platzhalter
 * nicht. Ein `msg()` um einen Platzhalter herum besteht jede Prüfung auf
 * unübersetzte Zeichenketten und zeigt trotzdem Englisch — dieselbe Form wie
 * ein Übersetzungsziel, das da ist und trotzdem falsch gebaut ist.
 *
 * WARUM JEDE FUNKTION EINEN RÜCKFALL HAT
 * Die Datenbank hält mehr Wörter, als der Code kennt: `simulation_members`
 * trägt keine CHECK-Bedingung, und auf Produktion steht dort zweimal
 * `architect` — ein Wort der PLATTFORM-Achse (`user_wallets.is_architect`) in
 * der Spalte der WELT-Achse. Ein unbekannter Wert soll sich deshalb auf das
 * heutige Verhalten verschlechtern, nicht auf eine Lücke: `default` gibt
 * `humanizeEnum()` zurück. Eine Beschriftung, die verstummt, ist schlimmer als
 * eine, die Englisch bleibt.
 */

import { msg } from '@lit/localize';

import { humanizeEnum } from './text.js';

/** Die Themenwelten in der Reihenfolge, in der sie zur Auswahl stehen. */
export const SIMULATION_THEMES = [
  'dystopian',
  'utopian',
  'fantasy',
  'scifi',
  'historical',
  'custom',
] as const;

/** Themenwelt einer Simulation. */
export function simulationThemeLabel(theme: string): string {
  switch (theme) {
    case 'dystopian':
      return msg('Dystopian');
    case 'utopian':
      return msg('Utopian');
    case 'fantasy':
      return msg('Fantasy');
    case 'scifi':
      return msg('Sci-Fi');
    case 'historical':
      return msg('Historical');
    case 'custom':
      return msg('Custom');
    default:
      return humanizeEnum(theme);
  }
}

/**
 * Mitgliedsrolle in einer Welt.
 *
 * `architect` steht bewusst dabei, obwohl es die Rangfolge des Servers
 * (`ROLE_HIERARCHY` in `backend/dependencies.py`) NICHT kennt: das Wort steht
 * auf Produktion in zwei Zeilen, und solange es dort steht, muss die Anzeige es
 * benennen können. Dass die Rangfolge es nicht kennt, ist ein eigener Befund
 * und wird von `scripts/lint-role-vocabulary.sh` gehalten, nicht hier verdeckt.
 */
export function memberRoleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return msg('Owner');
    case 'admin':
      return msg('Admin');
    case 'editor':
      return msg('Editor');
    case 'viewer':
      return msg('Viewer');
    case 'architect':
      return msg('Architect');
    default:
      return humanizeEnum(role);
  }
}

/** Zustand einer Epoche. */
export function epochStatusLabel(status: string): string {
  switch (status) {
    case 'lobby':
      return msg('Lobby');
    case 'foundation':
      return msg('Foundation');
    case 'competition':
      return msg('Competition');
    case 'reckoning':
      return msg('Reckoning');
    case 'completed':
      return msg('Completed');
    case 'cancelled':
      return msg('Cancelled');
    default:
      return humanizeEnum(status);
  }
}

/** Zustand einer Botschaft zwischen zwei Welten. */
export function embassyStatusLabel(status: string): string {
  switch (status) {
    case 'proposed':
      return msg('Proposed');
    case 'active':
      return msg('Active');
    case 'suspended':
      return msg('Suspended');
    case 'dissolved':
      return msg('Dissolved');
    default:
      return humanizeEnum(status);
  }
}

/**
 * Was eine Botschaft zwischen den Welten überträgt.
 *
 * Die sieben Werte stehen als CHECK-Bedingung an `embassies.bleed_vector`;
 * `architecture` ist erlaubt und kommt heute nicht vor.
 */
export const BLEED_VECTORS = [
  'commerce',
  'language',
  'memory',
  'resonance',
  'architecture',
  'dream',
  'desire',
] as const;

export function bleedVectorLabel(vector: string): string {
  switch (vector) {
    case 'language':
      return msg('Language');
    case 'resonance':
      return msg('Resonance');
    case 'desire':
      return msg('Desire');
    case 'dream':
      return msg('Dream');
    case 'commerce':
      return msg('Commerce');
    case 'memory':
      return msg('Memory');
    case 'architecture':
      return msg('Architecture');
    default:
      return humanizeEnum(vector);
  }
}

/**
 * Besetzung eines Gebäudes.
 *
 * Die Werte entstehen in SQL (Migration 158, Sicht `building_readiness`) aus
 * dem Verhältnis zugewiesener Agenten zur Kapazität — nicht in Python. Wer die
 * Schwellen sucht, findet sie dort und nirgends sonst.
 */
export function staffingStatusLabel(status: string): string {
  switch (status) {
    case 'n/a':
      return msg('Not staffed');
    case 'critically_understaffed':
      return msg('Critically understaffed');
    case 'understaffed':
      return msg('Understaffed');
    case 'operational':
      return msg('Operational');
    case 'overcrowded':
      return msg('Overcrowded');
    default:
      return humanizeEnum(status);
  }
}

/** Wirksamkeit einer Botschaft. */
export function effectivenessLabel(label: string): string {
  switch (label) {
    case 'optimal':
      return msg('Optimal');
    case 'operational':
      return msg('Operational');
    case 'limited':
      return msg('Limited');
    case 'dormant':
      return msg('Dormant');
    default:
      return humanizeEnum(label);
  }
}
