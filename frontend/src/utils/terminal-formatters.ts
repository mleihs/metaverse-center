/**
 * Bureau Terminal — Pure formatter functions.
 * Convert API responses into TerminalLine[] prose output.
 * No API calls here — only data transformation.
 */

import { msg } from '@lit/localize';
import type {
  AgentMood,
  AgentMoodlet,
  AgentNeeds,
} from '../services/api/AgentAutonomyApiService.js';
import type {
  Agent,
  Building,
  BuildingReadiness,
  Event,
  HeartbeatEntry,
  IntelDossier,
  OperativeMission,
  SimulationHealthDashboard,
  Zone,
  ZoneStability,
} from '../types/index.js';
import type { TerminalCommand, TerminalLine } from '../types/terminal.js';

// ── Helpers ────────────────────────────────────────────────────────────────

let _lineCounter = 0;

function lineId(): string {
  return `tl-${Date.now()}-${++_lineCounter}`;
}

function responseLine(content: string, zoneId?: string): TerminalLine {
  return { id: lineId(), type: 'response', content, timestamp: new Date(), zoneId };
}

function systemLine(content: string): TerminalLine {
  return { id: lineId(), type: 'system', content, timestamp: new Date() };
}

/** ASCII art block — rendered with tight line-height so underscore glyphs
 *  don't create visual gaps between rows. */
function artLine(content: string): TerminalLine {
  return { id: lineId(), type: 'art', content, timestamp: new Date() };
}

function errorLine(content: string): TerminalLine {
  return { id: lineId(), type: 'error', content, timestamp: new Date() };
}

function hintLine(content: string): TerminalLine {
  return { id: lineId(), type: 'hint', content, timestamp: new Date() };
}

function commandLine(input: string): TerminalLine {
  return { id: lineId(), type: 'command', content: `> ${input}`, timestamp: new Date() };
}

// ── Combat Line Factories (reusable across Dungeons + War Room Ops) ─────

/** Party attack hit, ability activation, successful action. */
function combatPlayerLine(content: string): TerminalLine {
  return { id: lineId(), type: 'combat-player', content, timestamp: new Date() };
}

/** Missed attack or failed check — dim, italic. */
function combatMissLine(content: string): TerminalLine {
  return { id: lineId(), type: 'combat-miss', content, timestamp: new Date() };
}

/** Damage received by party — danger red, hull breach warning. */
function combatDamageLine(content: string): TerminalLine {
  return { id: lineId(), type: 'combat-damage', content, timestamp: new Date() };
}

/** Stress heals, condition recovery — life support green. */
function combatHealLine(content: string): TerminalLine {
  return { id: lineId(), type: 'combat-heal', content, timestamp: new Date() };
}

/** Round headers, victory, stalemate — bold tactical display. */
function combatSystemLine(content: string): TerminalLine {
  return { id: lineId(), type: 'combat-system', content, timestamp: new Date() };
}

/** Render a horizontal bar: ###-------- (width chars total). */
function stabilityBar(value: number, width = 15): string {
  const filled = Math.round((value / 100) * width);
  return '#'.repeat(Math.max(0, filled)) + '-'.repeat(Math.max(0, width - filled));
}

/** Render a needs bar: ###-- value (width chars). */
function needsBar(value: number, width = 5): string {
  const filled = Math.round((value / 100) * width);
  return '#'.repeat(Math.max(0, filled)) + '-'.repeat(Math.max(0, width - filled));
}

/** Get stability label from percentage. */
function stabilityLabel(pct: number): string {
  if (pct < 20) return msg('CRITICAL');
  if (pct < 40) return msg('UNSTABLE');
  if (pct < 60) return msg('CONTESTED');
  if (pct < 80) return msg('STABLE');
  return msg('FORTIFIED');
}

/** Get health label from 0-1 value. */
function healthLabel(value: number): string {
  const pct = value * 100;
  if (pct < 25) return msg('CRITICAL');
  if (pct < 50) return msg('STRUGGLING');
  if (pct < 75) return msg('STABLE');
  return msg('THRIVING');
}

/** Format a mood score (-100 to +100) into a label. */
function moodLabel(score: number): string {
  if (score >= 15) return msg('Content');
  if (score >= 5) return msg('Calm');
  if (score >= -5) return msg('Neutral');
  if (score >= -15) return msg('Uneasy');
  return msg('Distressed');
}

/** Resolve a command description (may be a lazy function or plain string). */
function resolveDescription(desc: string | (() => string)): string {
  return typeof desc === 'function' ? desc() : desc;
}

/** Uppercase first letter. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pad string to fixed width. */
function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

// ── Event-Related Types ────────────────────────────────────────────────────

interface ActiveEvent {
  title: string;
  event_status: string;
  event_type?: string;
}

// ── Formatters ─────────────────────────────────────────────────────────────

/**
 * Format the `look` command output — current zone overview.
 */
export function formatLook(
  zone: Zone,
  stability: ZoneStability | null,
  agents: Agent[],
  buildings: Building[],
  readinessMap: Map<string, BuildingReadiness>,
  events: ActiveEvent[],
  allZones: Zone[],
  weatherNarrative?: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const stabPct = stability ? Math.round(stability.stability * 100) : 0;
  const stabLbl = stability?.stability_label?.toUpperCase() ?? stabilityLabel(stabPct);
  const security = stability?.security_level ?? zone.security_level ?? 'unknown';

  // Header
  lines.push(
    responseLine(
      `${zone.name.toUpperCase()}${zone.description ? ` \u2013 ${zone.description}` : ''}`,
    ),
  );

  // Stability + Security
  lines.push(
    responseLine(`${msg('Stability')}: ${stabPct}% [${stabLbl}] | ${msg('Security')}: ${security}`),
  );

  // Weather
  if (weatherNarrative) {
    lines.push(responseLine(weatherNarrative));
  }

  // Buildings
  if (buildings.length > 0) {
    const bldgStrs = buildings.map((b) => {
      const r = readinessMap.get(b.id);
      const pct = r ? Math.round(r.readiness * 100) : 0;
      return `${b.name} (${pct}% ${msg('ready')})`;
    });
    lines.push(responseLine(`${msg('Buildings')}: ${bldgStrs.join(', ')}`));
  } else {
    lines.push(responseLine(msg('No buildings in this zone.')));
  }

  // Agents
  if (agents.length > 0) {
    const agentNames = agents.map((a) => a.name);
    lines.push(responseLine(`${msg('Agents present')}: ${agentNames.join(', ')}`));
  } else {
    lines.push(responseLine(msg('No agents present.')));
  }

  // Active events
  if (events.length > 0) {
    const eventStrs = events.map((e) => `${e.title} [${e.event_status}]`);
    lines.push(responseLine(`${msg('Active events')}: ${events.length} (${eventStrs.join(', ')})`));
  }

  // Exits (all other zones, numbered for quick navigation: "go 1")
  const exitZones = allZones.filter((z) => z.id !== zone.id);
  if (exitZones.length > 0) {
    const exitStrs = exitZones.map((z, i) => `[${i + 1}] ${z.name}`);
    lines.push(responseLine(`${msg('Exits')}: ${exitStrs.join(', ')}`));
  }

  return lines;
}

/**
 * Format the `examine {agent}` command output.
 */
export function formatExamineAgent(
  agent: Agent,
  mood: AgentMood | null,
  needs: AgentNeeds | null,
  moodlets: AgentMoodlet[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const professions = agent.professions ?? [];
  const primaryProf = professions.find((p) => p.is_primary);
  const relations = agent.building_relations ?? [];

  // Header
  const currentBuilding = relations.length > 0 ? relations[0] : null;
  const buildingStr = currentBuilding
    ? ` \u2013 ${(currentBuilding as unknown as Record<string, string>).building_name ?? msg('Assigned')}`
    : '';
  lines.push(responseLine(`${agent.name.toUpperCase()}${buildingStr}`));

  // System + Profession
  const systemStr = agent.system ? capitalize(agent.system) : msg('Unknown');
  const profStr = primaryProf
    ? `${primaryProf.profession} (Lv ${primaryProf.qualification_level})`
    : (agent.primary_profession ?? msg('None'));
  lines.push(responseLine(`${msg('System')}: ${systemStr} | ${msg('Profession')}: ${profStr}`));

  // Mood + Stress
  if (mood) {
    const moodLbl = moodLabel(mood.mood_score);
    lines.push(
      responseLine(
        `${msg('Mood')}: ${mood.mood_score > 0 ? '+' : ''}${mood.mood_score} (${moodLbl}) | ${msg('Stress')}: ${mood.stress_level} (${mood.dominant_emotion})`,
      ),
    );
  }

  // Needs
  if (needs) {
    lines.push(
      responseLine(
        `${msg('Needs')}: ` +
          `${msg('Social')} ${needsBar(needs.social)} ${Math.round(needs.social)}  ` +
          `${msg('Purpose')} ${needsBar(needs.purpose)} ${Math.round(needs.purpose)}  ` +
          `${msg('Safety')} ${needsBar(needs.safety)} ${Math.round(needs.safety)}`,
      ),
    );
  }

  // Moodlets
  if (moodlets.length > 0) {
    const moodletStrs = moodlets.map(
      (m) => `${m.moodlet_type} (${m.emotion}, ${m.strength > 0 ? '+' : ''}${m.strength})`,
    );
    lines.push(responseLine(`${msg('Moodlets')}: ${moodletStrs.join(', ')}`));
  }

  // Ambassador
  if (agent.is_ambassador) {
    const blocked = agent.ambassador_blocked_until
      ? ` (${msg('blocked until')} ${new Date(agent.ambassador_blocked_until).toLocaleDateString()})`
      : ` (${msg('active')})`;
    lines.push(responseLine(`${msg('Ambassador')}${blocked}`));
  }

  return lines;
}

/**
 * Format the `examine {building}` command output.
 */
export function formatExamineBuilding(
  building: Building,
  readiness: BuildingReadiness | null,
  assignedAgents: Agent[],
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  // Header
  lines.push(responseLine(`${building.name.toUpperCase()}`));

  // Type + Condition
  const bType = building.building_type ?? msg('Unknown');
  const condition = building.building_condition ?? msg('Unknown');
  lines.push(
    responseLine(
      `${msg('Type')}: ${bType} | ${msg('Condition')}: ${condition} | ${msg('Capacity')}: ${building.population_capacity}`,
    ),
  );

  // Readiness factors (Victoria 3 pattern)
  if (readiness) {
    const pct = Math.round(readiness.readiness * 100);
    lines.push(responseLine(`${msg('Readiness')}: ${pct}%`));
    lines.push(
      responseLine(
        `  ${msg('Staffing')}: ${Math.round(readiness.staffing_ratio * 100)}% (${readiness.assigned_agents}/${building.population_capacity}) [${readiness.staffing_status}]`,
      ),
    );
    lines.push(
      responseLine(
        `  ${msg('Qualification')}: ${Math.round(readiness.qualification_match * 100)}%`,
      ),
    );
    lines.push(
      responseLine(`  ${msg('Condition')}: ${Math.round(readiness.condition_factor * 100)}%`),
    );
    const influencePct = Math.round(readiness.avg_influence * 100);
    const influenceTier =
      influencePct > 55 ? msg('STRONG') : influencePct > 30 ? msg('AVG') : msg('WEAK');
    lines.push(responseLine(`  ${msg('Influence')}: ${influencePct}% [${influenceTier}]`));
  }

  // Assigned agents
  if (assignedAgents.length > 0) {
    const names = assignedAgents.map((a) => a.name);
    lines.push(responseLine(`${msg('Assigned')}: ${names.join(', ')}`));
  } else {
    lines.push(responseLine(msg('No agents assigned.')));
  }

  return lines;
}

/**
 * Format the `weather` command output.
 */
export function formatWeather(entry: HeartbeatEntry | null): TerminalLine[] {
  if (!entry) {
    return [responseLine(msg('No weather data available.'))];
  }

  const lines: TerminalLine[] = [];
  const meta = entry.metadata as Record<string, unknown> | undefined;

  lines.push(responseLine(msg('CURRENT CONDITIONS')));

  // Narrative is the primary content
  if (entry.narrative_en) {
    lines.push(responseLine(entry.narrative_en));
  }

  // Extract structured data if available in metadata
  if (meta) {
    const parts: string[] = [];
    if (typeof meta.temperature === 'number') parts.push(`${meta.temperature.toFixed(1)}\u00B0C`);
    if (typeof meta.wind_speed === 'number') parts.push(`${msg('Wind')}: ${meta.wind_speed} km/h`);
    if (typeof meta.visibility === 'number') {
      const vis = meta.visibility as number;
      parts.push(
        `${msg('Visibility')}: ${vis >= 1000 ? `${(vis / 1000).toFixed(1)}km` : `${Math.round(vis)}m`}`,
      );
    }
    if (typeof meta.moon_phase === 'number') {
      const mp = meta.moon_phase as number;
      const phase =
        mp < 0.125
          ? msg('New Moon')
          : mp < 0.375
            ? msg('Waxing Crescent')
            : mp < 0.625
              ? msg('Full Moon')
              : mp < 0.875
                ? msg('Waning Gibbous')
                : msg('New Moon');
      parts.push(`${msg('Moon')}: ${phase} (${Math.round(mp * 100)}%)`);
    }
    if (parts.length > 0) {
      lines.push(responseLine(parts.join(' | ')));
    }
  }

  return lines;
}

/**
 * Format the `status` command output — simulation sitrep.
 */
export function formatStatus(
  dashboard: SimulationHealthDashboard,
  opsPoints: number,
  intelPoints: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const h = dashboard.health;
  const overallPct = Math.round(h.overall_health * 100);
  const label = h.health_label?.toUpperCase() ?? healthLabel(h.overall_health);

  lines.push(responseLine(`${msg('SITUATION REPORT')} \u2013 ${h.simulation_name}`));
  lines.push(responseLine(`${msg('Overall health')}: ${overallPct}% [${label}]`));

  // Zone stability table
  lines.push(responseLine(msg('Zone stability:')));
  for (const zs of dashboard.zones) {
    const pct = Math.round(zs.stability * 100);
    const lbl = zs.stability_label?.toUpperCase() ?? stabilityLabel(pct);
    const bar = stabilityBar(pct);
    lines.push(
      responseLine(`  ${pad(zs.zone_name, 22)} ${pad(`${pct}%`, 5)} [${pad(lbl, 10)}] ${bar}`),
    );
  }

  // Embassies
  if (dashboard.embassies && dashboard.embassies.length > 0) {
    const active = dashboard.embassies.filter(
      (e) => (e as unknown as Record<string, unknown>).is_active,
    );
    lines.push(responseLine(`${msg('Embassies')}: ${active.length} ${msg('active')}`));
  }

  // Resource budgets
  lines.push(
    responseLine(
      `${msg('Operations points')}: ${opsPoints}/${3} | ${msg('Intel points')}: ${intelPoints}/${2}`,
    ),
  );

  return lines;
}

/**
 * Format the `map` command output — flat zone list with stability.
 * No adjacency exists, so we show a list instead of ASCII art.
 */
export function formatMap(
  zones: Zone[],
  stabilities: ZoneStability[],
  currentZoneId: string,
  simulationName: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const stabMap = new Map(stabilities.map((zs) => [zs.zone_id, zs]));

  lines.push(responseLine(`${msg('SECTOR MAP')} \u2013 ${simulationName}`));

  for (const zone of zones) {
    const marker = zone.id === currentZoneId ? '* ' : '  ';
    const zs = stabMap.get(zone.id);
    const pct = zs ? Math.round(zs.stability * 100) : 0;
    const lbl = zs?.stability_label?.toUpperCase() ?? stabilityLabel(pct);
    lines.push(
      responseLine(
        `${marker}${pad(zone.name.toUpperCase(), 24)} ${pad(`${String(pct)}%`, 5)} [${lbl}]`,
      ),
    );
  }

  lines.push(responseLine(''));
  lines.push(
    responseLine(`* = ${msg('current position')} | ${msg("Use 'go {zone name}' to travel")}`),
  );

  return lines;
}

/**
 * Format the `where` command output.
 */
export function formatWhere(zone: Zone): TerminalLine[] {
  const desc = zone.description ? ` (${zone.description})` : '';
  return [responseLine(`${msg('You are in')} ${zone.name.toUpperCase()}${desc}.`)];
}

/**
 * Format the `help` command output — list all available commands.
 */
export function formatHelp(commands: TerminalCommand[], clearanceLevel: number): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const available = commands.filter((c) => c.tier <= clearanceLevel);

  lines.push(
    responseLine(`${msg('AVAILABLE COMMANDS')} (${msg('Clearance Level')} ${clearanceLevel})`),
  );

  for (const cmd of available) {
    lines.push(responseLine(`  ${pad(cmd.verb, 14)} ${resolveDescription(cmd.description)}`));
  }

  lines.push(responseLine(''));
  lines.push(responseLine(msg("Type 'help {command}' for detailed usage.")));
  lines.push(responseLine(''));
  lines.push(
    responseLine(
      `OPS = ${msg('Operations Points (fortify, quarantine)')} | INT = ${msg('Intel Points (future: debrief, scan)')}`,
    ),
  );

  return lines;
}

/**
 * Format `help {command}` — detailed usage for a single command.
 */
export function formatHelpCommand(cmd: TerminalCommand): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(responseLine(`${cmd.verb.toUpperCase()}`));
  lines.push(responseLine(`${msg('Syntax')}: ${cmd.syntax}`));
  lines.push(responseLine(`${resolveDescription(cmd.description)}`));
  if (cmd.synonyms.length > 0) {
    lines.push(responseLine(`${msg('Aliases')}: ${cmd.synonyms.join(', ')}`));
  }
  lines.push(responseLine(`${msg('Clearance')}: ${msg('Level')} ${cmd.tier}`));
  return lines;
}

// ── Zone Action Formatters ─────────────────────────────────────────────────

export function formatFortify(zoneName: string, remainingOps: number): TerminalLine[] {
  return [
    responseLine(
      `[${msg('ZONE ACTION')}] ${msg('Deploying fortification resources to')} ${zoneName}.`,
    ),
    responseLine(`${msg('Effect')}: -15% ${msg('event pressure for 7 days')}.`),
    responseLine(
      `${msg('Cost')}: 1 ${msg('ops point')} (${remainingOps} ${msg('remaining')}). ${msg('Cooldown')}: 14 ${msg('days')}.`,
    ),
  ];
}

export function formatQuarantine(zoneName: string, remainingOps: number): TerminalLine[] {
  return [
    responseLine(`[${msg('ZONE ACTION')}] ${msg('Quarantine established in')} ${zoneName}.`),
    responseLine(
      `${msg('Effect')}: ${msg('Events cannot spread to/from zone for 14 days. Agents locked in place.')}`,
    ),
    responseLine(`${msg('Cost')}: 2 ${msg('ops points')} (${remainingOps} ${msg('remaining')}).`),
  ];
}

export function formatAssign(agentName: string, buildingName: string): TerminalLine[] {
  return [responseLine(`[${msg('TRANSFER')}] ${agentName} ${msg('assigned to')} ${buildingName}.`)];
}

export function formatUnassign(agentName: string): TerminalLine[] {
  return [
    responseLine(`[${msg('TRANSFER')}] ${agentName} ${msg('unassigned from current post.')}`),
  ];
}

// ── Conversation Formatters ────────────────────────────────────────────────

export function formatTalkEnter(agentName: string): TerminalLine[] {
  return [
    responseLine(`${msg('You approach')} ${agentName}.`),
    systemLine(`[${msg("Entering conversation. Type 'leave' to exit.")}]`),
  ];
}

export function formatTalkResponse(
  messages: Array<{ content: string; sender_role: string; agent?: { name: string } | null }>,
): TerminalLine[] {
  return messages
    .filter((m) => m.sender_role === 'assistant')
    .map((m) => {
      const name = m.agent?.name ?? msg('Agent');
      return responseLine(`${name}: "${m.content}"`);
    });
}

export function formatTalkExit(): TerminalLine[] {
  return [systemLine(`[${msg('Conversation ended.')}]`)];
}

// ── Boot Sequence + Onboarding ─────────────────────────────────────────────

/** Theme-specific ASCII art for the boot sequence. */
function getThemeAsciiArt(theme: string): string[] {
  switch (theme) {
    case 'dystopian':
      return [
        '        _____  ',
        '       /     \\ ',
        '      | () () |',
        '       \\_____/ ',
        '      /|     |\\ ',
        '     / |     | \\',
        '    [SURVEILLANCE]',
      ];
    case 'scifi':
      return [
        '     .  *  .  *  .',
        '   *  /\\  *  /\\  *',
        '     /  \\   /  \\  ',
        '  --/----\\_/----\\--',
        '   / STATION LINK \\',
        '  /________________\\',
      ];
    case 'fantasy':
      return [
        '       /\\       ',
        '      /  \\      ',
        '     / ** \\     ',
        '    /______\\    ',
        '    | ]==[ |    ',
        '    |______|    ',
        '   CITADEL GATE ',
      ];
    case 'historical':
      return [
        '    _________   ',
        '   /  _____  \\  ',
        '  |  |     |  | ',
        '  |  | III |  | ',
        '  |  |_____|  | ',
        '  |___________|  ',
        '   ARCHIVE WING  ',
      ];
    case 'utopian':
      return [
        '     ,-.       ',
        '    / \\ \\      ',
        '   /   \\ \\     ',
        '  /  *  \\ \\    ',
        ' /-------\\ \\   ',
        ' \\  TOWER  /   ',
        '  \\_______/    ',
      ];
    default:
      // Generic Bureau sigil
      return [
        '    ___________    ',
        '   /    BMO    \\   ',
        '  | +---------+ |  ',
        '  | | FIELD   | |  ',
        '  | | TERMINAL| |  ',
        '  | +---------+ |  ',
        '   \\___________/   ',
      ];
  }
}

export function formatBootSequence(
  simulationName: string,
  theme?: string,
  customArt?: string,
  clearanceLevel = 1,
): TerminalLine[] {
  // Prefer AI-generated art from simulation_settings, fall back to theme defaults.
  // Strip blank lines from custom art — AI generators often include leading/trailing
  // empty lines that create ugly gaps in the terminal banner.
  const artLines = customArt
    ? customArt.split('\n').filter((l) => l.trim().length > 0)
    : getThemeAsciiArt(theme ?? 'custom');
  const lines: TerminalLine[] = [];

  // ASCII art header (AI-generated or theme fallback).
  // Each row is a separate 'art' line (tight line-height: 1.15) so underscore
  // glyphs don't create visual gaps, while preserving line-by-line boot animation.
  lines.push(systemLine(''));
  for (const row of artLines) {
    lines.push(artLine(row));
  }
  lines.push(systemLine(''));

  // System info
  lines.push(systemLine('BUREAU OF IMPOSSIBLE GEOGRAPHY'));
  lines.push(systemLine('FIELD TERMINAL v3.7 -- CLASSIFIED'));
  lines.push(systemLine(''));
  lines.push(systemLine(`${msg('Operator clearance')}: LEVEL ${clearanceLevel}`));
  lines.push(systemLine(`${msg('Assigned sector')}: ${simulationName}`));
  lines.push(systemLine(''));
  lines.push(systemLine(msg('You are a Bureau field operative. Observe zones,')));
  lines.push(systemLine(msg('interrogate agents, and manage field operations.')));
  lines.push(systemLine(msg('This terminal provides local intelligence that')));
  lines.push(systemLine(msg('the overview tabs cannot.')));
  lines.push(systemLine(''));
  lines.push(systemLine(msg("Type 'help' for available commands.")));
  lines.push(systemLine(msg("Type 'look' to observe your surroundings.")));

  return lines;
}

/**
 * Get the onboarding hint for a given step (Achaea pattern).
 * Returns null if onboarding is complete.
 */
export function formatOnboardingHint(step: number, _context?: string): TerminalLine | null {
  switch (step) {
    case 0:
      return hintLine(msg("Hint: Use 'examine {agent name}' to access a dossier."));
    case 1:
      return hintLine(msg("Hint: Use 'talk {agent name}' to initiate contact."));
    case 2:
      return hintLine(msg("Hint: Use 'go {zone name}' to move to another sector."));
    case 3:
      return hintLine(msg("Hint: Use 'status' for a full situation report."));
    case 4:
      return hintLine(msg('Onboarding complete. You have full LEVEL 1 clearance.'));
    default:
      return null;
  }
}

export function formatClearanceUpgrade(newLevel: number, commands: string[]): TerminalLine[] {
  return [
    systemLine(`[SYSTEM] ${msg('Clearance upgraded to LEVEL')} ${newLevel}.`),
    systemLine(`${msg('New commands available')}: ${commands.join(', ')}.`),
    systemLine(msg("Type 'help {command}' for details.")),
  ];
}

// ── Feed Entry Formatter ───────────────────────────────────────────────────

/**
 * Format a heartbeat entry as a realtime feed line.
 */
export function formatFeedEntry(
  entry: HeartbeatEntry,
  currentZoneId: string | null,
): TerminalLine | null {
  const meta = entry.metadata as Record<string, unknown> | undefined;
  const entryZoneId = meta?.zone_id as string | undefined;
  const isLocal = entryZoneId === currentZoneId;

  // Determine channel from entry_type
  let channel: 'INTEL' | 'WEATHER' | 'ALERT' | 'DISTANT';
  switch (entry.entry_type) {
    case 'ambient_weather':
      channel = 'WEATHER';
      break;
    case 'event_escalation':
    case 'agent_crisis':
    case 'cascade_spawn':
      channel = 'ALERT';
      break;
    default:
      channel = isLocal ? 'INTEL' : 'DISTANT';
  }

  const narrative = entry.narrative_en || entry.entry_type;

  // Build content: non-local non-weather entries get [DISTANT] prefix before channel tag.
  // When channel is already DISTANT, skip the redundant prefix.
  let content: string;
  if (!isLocal && channel !== 'WEATHER' && channel !== 'DISTANT') {
    content = `[DISTANT] [${channel}] ${narrative}`;
  } else {
    content = `[${channel}] ${narrative}`;
  }

  return {
    id: lineId(),
    type: 'feed',
    channel,
    content,
    timestamp: new Date(entry.created_at),
    zoneId: entryZoneId,
  };
}

// ── Error Formatters ───────────────────────────────────────────────────────

export function formatUnknownCommand(input: string, suggestion?: string): TerminalLine[] {
  const lines = [
    errorLine(
      `${msg('Unknown command')} '${input}'. ${msg("Type 'help' for available commands.")}`,
    ),
  ];
  if (suggestion) {
    lines.push(hintLine(`${msg('Did you mean')} '${suggestion}'?`));
  }
  return lines;
}

export function formatInsufficientClearance(
  verb: string,
  requiredTier: number,
  commandsRun?: number,
  commandsNeeded?: number,
): TerminalLine[] {
  const lines = [
    errorLine(
      `${msg('Insufficient clearance for')} '${verb}'. ${msg('Requires Level')} ${requiredTier}.`,
    ),
  ];
  if (commandsRun !== undefined && commandsNeeded !== undefined && commandsNeeded > commandsRun) {
    const remaining = commandsNeeded - commandsRun;
    lines.push(
      hintLine(
        `${msg('Run')} ${remaining} ${msg('more commands to unlock.')} (${commandsRun}/${commandsNeeded})`,
      ),
    );
  }
  return lines;
}

export function formatInsufficientPoints(
  poolName: string,
  have: number,
  need: number,
): TerminalLine[] {
  return [errorLine(`${msg('Insufficient')} ${poolName} (${have}/${need} ${msg('required')}).`)];
}

export function formatAmbiguousTarget(matches: Array<{ name: string }>): TerminalLine[] {
  const names = matches.map((m) => m.name).join(', ');
  return [errorLine(`${msg('Multiple matches')}: ${names}. ${msg('Please be more specific.')}`)];
}

export function formatDirectionNotAvailable(): TerminalLine[] {
  return [
    errorLine(
      msg(
        "Directional navigation is not available. Use 'go {zone name}' or type 'map' to see available zones.",
      ),
    ),
  ];
}

export function formatNoTarget(verb: string): TerminalLine[] {
  return [errorLine(`${verb} ${msg('requires a target. Example')}: ${verb} {${msg('name')}}`)];
}

// ── Stage 3: Intelligence Network Formatters ─────────────────────────────

/**
 * Format scan output: all-zone radar sweep as table.
 */
export function formatScan(
  stabilities: ZoneStability[],
  currentZoneId: string | null,
  remainingIntel: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(`[${msg('RADAR SWEEP')}] ${msg('All sectors')}`));
  lines.push(
    systemLine(`${msg('Intel cost')}: 1 ${msg('point')} (${remainingIntel} ${msg('remaining')})`),
  );
  lines.push(systemLine(''));

  // Table header
  const nameCol = msg('Zone').padEnd(24);
  const stabCol = msg('Stability').padEnd(12);
  const evtCol = msg('Events').padEnd(8);
  const agentCol = msg('Agents');
  lines.push(responseLine(`  ${nameCol}${stabCol}${evtCol}${agentCol}`));
  lines.push(responseLine(`  ${'─'.repeat(54)}`));

  // Sort by stability ascending (worst first — intelligence priority)
  const sorted = [...stabilities].sort((a, b) => a.stability - b.stability);

  for (const zs of sorted) {
    const marker = zs.zone_id === currentZoneId ? '►' : ' ';
    const name = zs.zone_name.padEnd(23);
    const stab = `${Math.round(zs.stability * 100)}%`.padEnd(12);
    const pressure =
      zs.event_pressure > 0 ? `${zs.event_pressure.toFixed(1)}`.padEnd(8) : '–'.padEnd(8);
    const agents = `${zs.total_agents}`;
    lines.push(responseLine(`${marker} ${name}${stab}${pressure}${agents}`));
  }

  lines.push(systemLine(''));
  lines.push(hintLine(`► = ${msg('current position')}`));
  return lines;
}

/**
 * Format investigate output: event deep dive.
 */
export function formatInvestigate(event: Event, remainingIntel: number): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(`[${msg('INVESTIGATE')}] ${event.title}`));
  lines.push(
    systemLine(`${msg('Intel cost')}: 1 ${msg('point')} (${remainingIntel} ${msg('remaining')})`),
  );
  lines.push(systemLine(''));

  // Event metadata
  const occurred = new Date(event.occurred_at);
  const ago = _timeAgo(occurred);
  lines.push(responseLine(`${msg('Status')}: ${event.event_status.toUpperCase()}`));
  lines.push(responseLine(`${msg('Type')}: ${event.event_type ?? '–'}`));
  lines.push(responseLine(`${msg('Impact')}: ${event.impact_level}/10`));
  lines.push(responseLine(`${msg('Occurred')}: ${ago}`));
  if (event.location) {
    lines.push(responseLine(`${msg('Location')}: ${event.location}`));
  }

  // Description
  if (event.description) {
    lines.push(systemLine(''));
    // Wrap long descriptions
    const wrapped = _wordWrap(event.description, 60);
    for (const w of wrapped) {
      lines.push(responseLine(w));
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    lines.push(systemLine(''));
    lines.push(responseLine(`${msg('Tags')}: ${event.tags.join(', ')}`));
  }

  // Reactions
  if (event.reactions && event.reactions.length > 0) {
    lines.push(systemLine(''));
    lines.push(systemLine(`${msg('Agent reactions')}:`));
    for (const r of event.reactions) {
      const emotion = r.emotion ? ` [${r.emotion}]` : '';
      lines.push(responseLine(`  ${r.agent_name}${emotion}: ${_truncate(r.reaction_text, 50)}`));
    }
  }

  return lines;
}

/**
 * Format report output: session summary as Bureau document.
 */
export function formatReport(
  commandCount: number,
  zonesVisited: string[],
  commandHistory: string[],
  currentZone: string | null,
  clearanceLevel: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  lines.push(systemLine(`[${msg('SESSION REPORT')}]`));
  lines.push(systemLine(`${msg('Filed')}: ${timestamp}`));
  lines.push(systemLine(`${msg('Clearance')}: ${msg('Level')} ${clearanceLevel}`));
  lines.push(systemLine(''));

  // Commands issued
  lines.push(responseLine(`${msg('Commands issued')}: ${commandCount}`));

  // Zones visited (deduplicated from go commands)
  if (zonesVisited.length > 0) {
    lines.push(responseLine(`${msg('Sectors visited')}: ${zonesVisited.join(', ')}`));
  }

  // Current position
  if (currentZone) {
    lines.push(responseLine(`${msg('Current position')}: ${currentZone}`));
  }

  // Recent commands breakdown
  lines.push(systemLine(''));
  const verbCounts = new Map<string, number>();
  for (const cmd of commandHistory) {
    const verb = cmd.split(/\s+/)[0].toLowerCase();
    verbCounts.set(verb, (verbCounts.get(verb) ?? 0) + 1);
  }
  lines.push(systemLine(`${msg('Activity breakdown')}:`));
  const sorted = [...verbCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [verb, count] of sorted.slice(0, 8)) {
    lines.push(responseLine(`  ${verb}: ${count}`));
  }

  lines.push(systemLine(''));
  lines.push(systemLine(msg('End of report.')));
  return lines;
}

/**
 * Format debrief output: AI-generated formal agent report.
 */
export function formatDebrief(
  agent: Agent,
  responseText: string,
  remainingIntel: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  const buildingName =
    (agent as unknown as Record<string, unknown>).current_building_name ?? msg('field position');
  lines.push(systemLine(`[${msg('DEBRIEF')}] ${agent.name} – ${buildingName}`));
  lines.push(
    systemLine(`${msg('Intel cost')}: 1 ${msg('point')} (${remainingIntel} ${msg('remaining')})`),
  );
  lines.push(systemLine(''));

  // AI response wrapped
  const wrapped = _wordWrap(responseText, 60);
  for (const w of wrapped) {
    lines.push(responseLine(w));
  }

  return lines;
}

/**
 * Format ask output: AI-generated conversational response.
 */
export function formatAskResponse(
  agent: Agent,
  topic: string,
  responseText: string,
): TerminalLine[] {
  const lines: TerminalLine[] = [];

  lines.push(systemLine(`[${msg('QUERY')}] ${agent.name} – ${topic}`));
  lines.push(systemLine(''));

  const wrapped = _wordWrap(responseText, 60);
  for (const w of wrapped) {
    lines.push(responseLine(w));
  }

  return lines;
}

// ── Text Utilities ─────────────────────────────────────────────────────────

/** Word-wrap text to a given width. */
function _wordWrap(text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      result.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      if (line.length + word.length + 1 > width && line.length > 0) {
        result.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

/** Truncate text with ellipsis. */
function _truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

/** Format a date as relative time ago. */
function _timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return msg('just now');
  if (mins < 60) return `${mins}m ${msg('ago')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${msg('ago')}`;
  const days = Math.floor(hours / 24);
  return `${days}d ${msg('ago')}`;
}

// ── Epoch Intelligence Formatters ──────────────────────────────────────────

/** Format AI sitrep narrative. */
export function formatSitrep(narrative: string, cycle: number, status: string): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(
    systemLine(
      `[SITREP] ${msg('Tactical Briefing')} \u2013 ${msg('Cycle')} ${cycle} (${status.toUpperCase()})`,
    ),
  );
  lines.push(systemLine('\u2500'.repeat(60)));

  // Word-wrap the narrative into terminal-width lines
  const wrapped = _wordWrap(narrative, 70);
  for (const line of wrapped) {
    lines.push(responseLine(line));
  }

  lines.push(systemLine('\u2500'.repeat(60)));
  lines.push(systemLine(`[${msg('END BRIEFING')}]`));
  return lines;
}

/** Format intelligence dossier on a player. */
export function formatDossier(dossier: IntelDossier, playerName: string): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(`[DOSSIER] ${playerName.toUpperCase()}`));
  lines.push(systemLine('\u2500'.repeat(50)));

  if (dossier.zone_details && dossier.zone_details.length > 0) {
    lines.push(responseLine(`${msg('Zone Security')}:`));
    for (const z of dossier.zone_details) {
      lines.push(responseLine(`  ${z.name}: ${z.security_level.toUpperCase()}`));
    }
  }

  lines.push(responseLine(`${msg('Active Guardians')}: ${dossier.guardian_count ?? 0}`));

  if (dossier.fortifications && dossier.fortifications.length > 0) {
    lines.push(responseLine(`${msg('Fortifications')}:`));
    for (const f of dossier.fortifications) {
      lines.push(
        responseLine(
          `  ${f.zone_name}: +${f.security_bonus} (${msg('expires cycle')} ${f.expires_at_cycle})`,
        ),
      );
    }
  } else {
    lines.push(responseLine(`${msg('Fortifications')}: ${msg('none detected')}`));
  }

  lines.push(
    responseLine(
      `${msg('Intel Reports')}: ${dossier.report_count ?? 0} | ${msg('Last Update')}: ${msg('Cycle')} ${dossier.last_intel_cycle ?? 0}${dossier.is_stale ? ` [${msg('STALE')}]` : ''}`,
    ),
  );

  lines.push(systemLine('\u2500'.repeat(50)));
  return lines;
}

/** Format detected incoming threats. */
export function formatThreats(threats: OperativeMission[]): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(`[THREAT ASSESSMENT] ${msg('Incoming Operatives')}`));

  if (threats.length === 0) {
    lines.push(responseLine(msg('No incoming threats detected. Sector clear.')));
    return lines;
  }

  lines.push(systemLine('\u2500'.repeat(55)));
  for (const t of threats) {
    const type = (t.operative_type ?? 'unknown').toUpperCase();
    const status = (t.status ?? 'active').toUpperCase();
    const sourceName = t.target_sim?.name ?? msg('Unknown');
    lines.push(
      responseLine(`  ${type} | ${msg('Source')}: ${sourceName} | ${msg('Status')}: ${status}`),
    );
  }
  lines.push(systemLine('\u2500'.repeat(55)));
  lines.push(
    systemLine(
      `${threats.length} ${msg('threat(s) detected')}. ${msg("Use 'intercept' to attempt capture.")}`,
    ),
  );
  return lines;
}

/** Format counter-intelligence sweep results. */
export function formatInterceptSweep(
  detected: OperativeMission[],
  remainingRP: number,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(`[COUNTER-INTEL] ${msg('Sweep Complete')}`));

  if (detected.length === 0) {
    lines.push(responseLine(msg('No foreign operatives found in sector.')));
  } else {
    for (const t of detected) {
      const type = (t.operative_type ?? 'unknown').toUpperCase();
      const status = (t.status ?? 'detected').toUpperCase();
      lines.push(responseLine(`  ${msg('Detected')}: ${type} \u2013 ${msg('Status')}: ${status}`));
    }
    lines.push(responseLine(`${detected.length} ${msg('operative(s) identified.')}`));
  }

  lines.push(systemLine(`${msg('Remaining RP')}: ${remainingRP}`));
  return lines;
}

/** Format epoch status extension (appended to normal status output). */
export function formatEpochStatusExtension(
  epochStatus: string,
  currentCycle: number,
  rp: number,
  missionCount: number,
  rank: number | null,
): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(systemLine(''));
  lines.push(systemLine(`\u2550\u2550\u2550 ${msg('EPOCH INTELLIGENCE')} \u2550\u2550\u2550`));
  lines.push(
    responseLine(
      `${msg('Phase')}: ${epochStatus.toUpperCase()} | ${msg('Cycle')}: ${currentCycle}`,
    ),
  );
  lines.push(
    responseLine(`${msg('Resource Points')}: ${rp} | ${msg('Active Missions')}: ${missionCount}`),
  );
  if (rank !== null) {
    lines.push(responseLine(`${msg('Current Rank')}: #${rank}`));
  }
  return lines;
}

/** Format insufficient RP error. */
export function formatInsufficientRP(have: number, need: number): TerminalLine[] {
  return [
    errorLine(
      `${msg('Insufficient Resource Points.')} ${msg('Required')}: ${need} | ${msg('Available')}: ${have}`,
    ),
    hintLine(msg('RP refreshes each cycle. Plan operations carefully.')),
  ];
}

export {
  combatDamageLine,
  combatHealLine,
  combatMissLine,
  combatPlayerLine,
  combatSystemLine,
  commandLine,
  errorLine,
  hintLine,
  responseLine,
  systemLine,
};
