/**
 * Beschriftungen fuer die Wirkungs-Parameter der Dungeon-Beute.
 *
 * WARUM DIESE DATEI EXISTIERT
 * Zwei Orte zeigen dieselben Werte und muessen sie gleich benennen: der
 * Beutekatalog in der Hilfe (alle 105 Stuecke, vorab) und die Belohnungs-Tafel
 * am Agenten (was dieser Agent tatsaechlich mitgebracht hat, im Nachhinein).
 * Zwei Kopien derselben Beschriftungstabelle sind zwei Tabellen, die
 * auseinanderlaufen — die eine wird gepflegt, die andere altert still.
 *
 * ⚠ Ein Schluessel ohne Beschriftung wird LESBAR GEMACHT, nicht durchgereicht:
 * `check_bonus` wird „Check bonus". Ein Datenbankbezeichner gehoert nie auf
 * eine Karte, und ein neuer Parameter soll degradieren statt zu entgleisen.
 */
import { msg } from '@lit/localize';

const PARAM_LABEL: Readonly<Record<string, () => string>> = {
  aptitude: () => msg('Aptitude'),
  aptitude_choices: () => msg('Choice of aptitude'),
  boost: () => msg('Increase'),
  boost_amount: () => msg('Increase'),
  bonus: () => msg('Bonus'),
  bonus_pct: () => msg('Bonus (percent)'),
  bonus_type: () => msg('Bonus type'),
  check_bonus: () => msg('Check bonus'),
  condition_improvement: () => msg('Condition rungs'),
  condition_tiers: () => msg('Condition rungs'),
  decay_type: () => msg('Decay'),
  delta: () => msg('Change'),
  big_five_delta: () => msg('Personality change'),
  dimension: () => msg('Dimension'),
  duration_rooms: () => msg('Lasts (rooms)'),
  duration_ticks: () => msg('Lasts (ticks)'),
  emotion: () => msg('Emotion'),
  importance: () => msg('Weight of the memory'),
  impact_level_reduction: () => msg('Impact reduced by'),
  max_total_bonus: () => msg('Maximum in total'),
  moodlet_type: () => msg('Mood'),
  morale_boost: () => msg('Morale'),
  player_choice: () => msg('You choose'),
  scope: () => msg('Applies to'),
  strength: () => msg('Strength'),
  stress_heal: () => msg('Stress removed'),
  stress_resist: () => msg('Stress resistance'),
  stress_damage_bonus: () => msg('Damage from stress'),
  trait: () => msg('Trait'),
  when: () => msg('When'),
};

/** Parameter, die KEINE Mechanik sind, sondern Text fuer das Debriefing. */
const NARRATIVE_PARAMS = new Set(['description_en', 'description_de', 'content_en', 'content_de']);

/** `check_bonus` → `Check bonus`. Der letzte Ausweg, nie die erste Wahl. */
function humaniseKey(key: string): string {
  const worte = key.split(/[_-]+/).filter(Boolean);
  if (!worte.length) return key;
  return [worte[0].charAt(0).toUpperCase() + worte[0].slice(1), ...worte.slice(1)].join(' ');
}

export { humaniseKey, NARRATIVE_PARAMS, PARAM_LABEL };

/** `{trait: "conscientiousness", delta: 0.15}` → `Trait: conscientiousness · Change: 0.15` */
export function formatParams(params: Record<string, unknown>, trenner = ' · '): string {
  return Object.entries(params)
    .filter(([k, v]) => !NARRATIVE_PARAMS.has(k) && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const wert = Array.isArray(v) ? v.join(' / ') : String(v);
      return `${PARAM_LABEL[k]?.() ?? humaniseKey(k)}: ${wert}`;
    })
    .join(trenner);
}
