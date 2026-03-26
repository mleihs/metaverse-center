/**
 * Bureau Terminal — Command parser and handler registry.
 * Bartle-inspired verb-noun parser with synonym resolution and fuzzy matching.
 * Part IV, section 4.8 of game-systems-integration.md.
 */

import { msg } from '@lit/localize';
import { appState } from '../services/AppStateManager.js';
import { agentAutonomyApi } from '../services/api/AgentAutonomyApiService.js';
import { agentsApi } from '../services/api/index.js';
import { buildingsApi } from '../services/api/index.js';
import { chatApi } from '../services/api/index.js';
import { eventsApi } from '../services/api/index.js';
import { healthApi } from '../services/api/index.js';
import { heartbeatApi } from '../services/api/index.js';
import { zoneActionsApi } from '../services/api/index.js';
import { terminalState } from '../services/TerminalStateManager.js';
import type { Agent, BuildingReadiness, ChatMessage } from '../types/index.js';
import type { CommandContext, TerminalCommand, TerminalLine } from '../types/terminal.js';
import {
  commandLine,
  formatAmbiguousTarget,
  formatAskResponse,
  formatAssign,
  formatBootSequence,
  formatClearanceUpgrade,
  formatDebrief,
  formatDirectionNotAvailable,
  formatExamineAgent,
  formatExamineBuilding,
  formatFortify,
  formatHelp,
  formatInvestigate,
  formatHelpCommand,
  formatInsufficientClearance,
  formatInsufficientPoints,
  formatLook,
  formatMap,
  formatNoTarget,
  formatOnboardingHint,
  formatQuarantine,
  formatReport,
  formatScan,
  formatStatus,
  formatTalkEnter,
  formatTalkExit,
  formatTalkResponse,
  formatUnassign,
  formatUnknownCommand,
  formatWeather,
  formatWhere,
  errorLine,
  systemLine,
} from './terminal-formatters.js';

// ── Levenshtein Distance ───────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Synonym Map ────────────────────────────────────────────────────────────

const SYNONYM_MAP = new Map<string, string>([
  // look
  ['l', 'look'], ['observe', 'look'], ['survey', 'look'],
  // go
  ['move', 'go'], ['walk', 'go'], ['travel', 'go'],
  // examine
  ['ex', 'examine'], ['inspect', 'examine'], ['x', 'examine'],
  // talk
  ['speak', 'talk'], ['contact', 'talk'], ['hail', 'talk'],
  // weather
  ['wx', 'weather'], ['conditions', 'weather'],
  // status
  ['sitrep', 'status'], ['sit', 'status'],
  // fortify
  ['reinforce', 'fortify'], ['defend', 'fortify'],
  // quarantine
  ['lockdown', 'quarantine'], ['isolate', 'quarantine'],
  // assign
  ['station', 'assign'], ['post', 'assign'], ['transfer', 'assign'],
  // exitconversation
  ['leave', 'exitconversation'], ['bye', 'exitconversation'], ['exit', 'exitconversation'],
  // filter
  ['feed', 'filter'],
  // config
  ['settings', 'config'],
  // Stage 3: Intelligence
  ['intel', 'debrief'], ['brief', 'debrief'],
  ['query', 'ask'], ['question', 'ask'],
  ['probe', 'investigate'], ['research', 'investigate'],
  ['radar', 'scan'], ['sweep', 'scan'],
  ['summary', 'report'], ['log', 'report'],
]);

// ── Cardinal Directions ────────────────────────────────────────────────────

const DIRECTIONS = new Set([
  'north', 'south', 'east', 'west', 'n', 's', 'e', 'w',
  'northeast', 'northwest', 'southeast', 'southwest',
  'ne', 'nw', 'se', 'sw', 'up', 'down',
]);

// ── Fuzzy Entity Matching ──────────────────────────────────────────────────

interface NamedEntity {
  id: string;
  name: string;
}

/**
 * Find entities matching a search string.
 * 1. Exact case-insensitive match
 * 2. Substring match
 * 3. Levenshtein distance <= 2
 */
function fuzzyMatch<T extends NamedEntity>(
  query: string,
  entities: T[],
): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  // Exact match
  const exact = entities.filter((e) => e.name.toLowerCase() === q);
  if (exact.length > 0) return exact;

  // Substring match
  const substring = entities.filter((e) => e.name.toLowerCase().includes(q));
  if (substring.length > 0) return substring;

  // Levenshtein fallback (match against individual words in name)
  const lev = entities.filter((e) => {
    const words = e.name.toLowerCase().split(/\s+/);
    return words.some((w) => levenshtein(q, w) <= 2);
  });
  return lev;
}

// ── Helper: Get Simulation ID ──────────────────────────────────────────────

function simId(): string {
  return appState.simulationId.value ?? '';
}

// ── Helper: Ensure zone data loaded ────────────────────────────────────────

async function ensureZoneData(zoneId: string): Promise<void> {
  const sid = simId();
  if (!sid || !zoneId) return;

  // Load agents for zone if not cached
  if (!terminalState.agentsByZone.value.has(zoneId)) {
    const resp = await agentsApi.list(sid);
    if (resp.success && resp.data) {
      const zoneAgents = resp.data.filter((a) => a.current_zone_id === zoneId);
      terminalState.cacheAgentsForZone(zoneId, zoneAgents);
    }
  }

  // Load buildings for zone if not cached
  if (!terminalState.buildingsByZone.value.has(zoneId)) {
    const resp = await buildingsApi.list(sid, { zone_id: zoneId });
    if (resp.success && resp.data) {
      terminalState.cacheBuildingsForZone(zoneId, resp.data);
    }
  }
}

// ── Command Handlers ───────────────────────────────────────────────────────

async function handleLook(_ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  const zoneId = terminalState.currentZoneId.value;
  if (!sid || !zoneId) return [systemLine(msg('No zone selected. Use "go {zone}" first.'))];

  await ensureZoneData(zoneId);

  const zone = terminalState.zoneCache.value.get(zoneId);
  if (!zone) return [systemLine(msg('Zone data unavailable.'))];

  // Parallel API calls
  const [stabResp, eventsResp, weatherResp, readinessResp] = await Promise.all([
    healthApi.listZoneStability(sid),
    eventsApi.list(sid, { event_status: 'active' }),
    heartbeatApi.listEntries(sid, { entry_type: 'ambient_weather', limit: '1' }),
    healthApi.listBuildingReadiness(sid, { zone_id: zoneId }),
  ]);

  const stability = stabResp.success && stabResp.data
    ? stabResp.data.find((zs) => zs.zone_id === zoneId) ?? null
    : null;

  // Cache stabilities for map command
  if (stabResp.success && stabResp.data) {
    terminalState.zoneStabilities.value = stabResp.data;
  }

  const agents = terminalState.currentZoneAgents.value;
  const buildings = terminalState.currentZoneBuildings.value;

  // Build readiness map
  const readinessMap = new Map<string, BuildingReadiness>();
  if (readinessResp.success && readinessResp.data) {
    for (const r of readinessResp.data) {
      readinessMap.set(r.building_id, r);
    }
  }

  // Filter events to current zone (simple: check if event location matches zone name)
  const zoneEvents = (eventsResp.success && eventsResp.data)
    ? eventsResp.data.filter((e) => {
        const loc = (e.location ?? '').toLowerCase();
        return loc.includes(zone.name.toLowerCase());
      }).map((e) => ({
        title: e.title,
        event_status: e.event_status,
        event_type: e.event_type ?? undefined,
      }))
    : [];

  const weatherEntry = weatherResp.success && weatherResp.data?.[0]
    ? weatherResp.data[0]
    : null;
  const weatherNarrative = weatherEntry?.narrative_en ?? undefined;

  const allZones = Array.from(terminalState.zoneCache.value.values());

  return formatLook(
    zone, stability, agents, buildings, readinessMap, zoneEvents, allZones, weatherNarrative,
  );
}

async function handleGo(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('go');

  // Check for cardinal directions
  if (DIRECTIONS.has(target.toLowerCase())) {
    return formatDirectionNotAvailable();
  }

  const zones = Array.from(terminalState.zoneCache.value.values());
  const currentZoneId = terminalState.currentZoneId.value;

  // Numeric shortcut: "go 1" → first exit zone (zones excluding current, same order as look)
  const num = parseInt(target, 10);
  if (!isNaN(num) && num >= 1) {
    const exitZones = zones.filter((z) => z.id !== currentZoneId);
    if (num > exitZones.length) {
      return [systemLine(`${msg('Invalid exit number')}. ${msg('Valid')}: 1-${exitZones.length}`)];
    }
    const zone = exitZones[num - 1];
    terminalState.setCurrentZone(zone.id);
    terminalState.invalidateZoneCaches();
    const lookLines = await handleLook(ctx);
    return lookLines;
  }

  // Fuzzy match against zones
  const matches = fuzzyMatch(target, zones);

  if (matches.length === 0) {
    return formatUnknownCommand(target);
  }
  if (matches.length > 1) {
    return formatAmbiguousTarget(matches);
  }

  const zone = matches[0];
  terminalState.setCurrentZone(zone.id);
  terminalState.invalidateZoneCaches();

  // Auto-look on arrival
  const lookLines = await handleLook(ctx);
  return lookLines;
}

async function handleExamine(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('examine');

  const sid = simId();
  const zoneId = terminalState.currentZoneId.value;
  if (!sid || !zoneId) return [systemLine(msg('No zone selected.'))];

  await ensureZoneData(zoneId);

  // Try agent match first (current zone agents)
  const agents = terminalState.currentZoneAgents.value;
  const agentMatches = fuzzyMatch(target, agents);

  if (agentMatches.length === 1) {
    const agent = agentMatches[0];
    // Fetch detailed data in parallel
    const [detailResp, moodResp, needsResp, moodletsResp] = await Promise.all([
      agentsApi.getById(sid, agent.id),
      agentAutonomyApi.getAgentMood(sid, agent.id),
      agentAutonomyApi.getAgentNeeds(sid, agent.id),
      agentAutonomyApi.getAgentMoodlets(sid, agent.id),
    ]);
    const fullAgent = (detailResp.success && detailResp.data) ? detailResp.data : agent;
    const mood = (moodResp.success && moodResp.data) ? moodResp.data : null;
    const needs = (needsResp.success && needsResp.data) ? needsResp.data : null;
    const moodlets = (moodletsResp.success && moodletsResp.data) ? moodletsResp.data : [];
    return formatExamineAgent(fullAgent, mood, needs, moodlets);
  }

  if (agentMatches.length > 1) {
    return formatAmbiguousTarget(agentMatches);
  }

  // Try building match
  const buildings = terminalState.currentZoneBuildings.value;
  const buildingMatches = fuzzyMatch(target, buildings);

  if (buildingMatches.length === 1) {
    const building = buildingMatches[0];
    const [readinessResp, agentsResp] = await Promise.all([
      healthApi.listBuildingReadiness(sid, { zone_id: zoneId }),
      buildingsApi.getAgents(sid, building.id),
    ]);
    const readiness = readinessResp.success && readinessResp.data
      ? readinessResp.data.find((r) => r.building_id === building.id) ?? null
      : null;
    const assignedAgents: Agent[] = [];
    if (agentsResp.success && agentsResp.data) {
      // Building agents response may have agent data embedded
      for (const rel of agentsResp.data) {
        const agentData = (rel as unknown as Record<string, unknown>).agent as Agent | undefined;
        if (agentData) assignedAgents.push(agentData);
      }
    }
    return formatExamineBuilding(building, readiness, assignedAgents);
  }

  if (buildingMatches.length > 1) {
    return formatAmbiguousTarget(buildingMatches);
  }

  return formatUnknownCommand(target);
}

async function handleTalk(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('talk');

  const sid = simId();
  const zoneId = terminalState.currentZoneId.value;
  if (!sid || !zoneId) return [systemLine(msg('No zone selected.'))];

  await ensureZoneData(zoneId);

  const agents = terminalState.currentZoneAgents.value;
  const matches = fuzzyMatch(target, agents);

  if (matches.length === 0) return formatUnknownCommand(target);
  if (matches.length > 1) return formatAmbiguousTarget(matches);

  const agent = matches[0];

  // Reuse existing conversation or create new one
  let conversationId = terminalState.getConversationForAgent(agent.id);
  if (!conversationId) {
    const resp = await chatApi.createConversation(sid, {
      agent_ids: [agent.id],
      title: `Bureau Terminal: ${agent.name}`,
    });
    if (!resp.success || !resp.data) {
      return [systemLine(msg('Failed to establish communication channel.'))];
    }
    conversationId = resp.data.id;
  }

  terminalState.enterConversation(agent.id, agent.name, conversationId);
  return formatTalkEnter(agent.name);
}

async function handleConversationInput(input: string): Promise<TerminalLine[]> {
  const conv = terminalState.conversationMode.value;
  if (!conv) return [];

  const sid = simId();
  if (!sid) return [];

  const resp = await chatApi.sendMessage(sid, conv.conversationId, {
    content: input,
    generate_response: true,
  });

  if (!resp.success || !resp.data) {
    return [systemLine(msg('Communication interrupted. Try again.'))];
  }

  // Response may be a single message or array
  const messages = Array.isArray(resp.data) ? resp.data : [resp.data];
  return formatTalkResponse(messages);
}

async function handleExitConversation(_ctx: CommandContext): Promise<TerminalLine[]> {
  terminalState.exitConversation();
  return formatTalkExit();
}

async function handleWeather(_ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  const resp = await heartbeatApi.listEntries(sid, {
    entry_type: 'ambient_weather',
    limit: '1',
  });

  const entry = resp.success && resp.data?.[0] ? resp.data[0] : null;
  return formatWeather(entry);
}

async function handleStatus(_ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  const resp = await healthApi.getDashboard(sid);
  if (!resp.success || !resp.data) {
    return [systemLine(msg('Failed to retrieve situation report.'))];
  }

  return formatStatus(
    resp.data,
    terminalState.operationsPoints.value,
    terminalState.intelPoints.value,
  );
}

async function handleMap(_ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  const zones = Array.from(terminalState.zoneCache.value.values());
  let stabilities = terminalState.zoneStabilities.value;

  if (stabilities.length === 0) {
    const resp = await healthApi.listZoneStability(sid);
    if (resp.success && resp.data) {
      stabilities = resp.data;
      terminalState.zoneStabilities.value = stabilities;
    }
  }

  const simName = appState.currentSimulation.value?.name ?? '';
  const currentZoneId = terminalState.currentZoneId.value ?? '';

  return formatMap(zones, stabilities, currentZoneId, simName);
}

async function handleWhere(_ctx: CommandContext): Promise<TerminalLine[]> {
  const zone = terminalState.currentZone.value;
  if (!zone) return [systemLine(msg('Location unknown. Use "go {zone}" to navigate.'))];
  return formatWhere(zone);
}

async function handleHelp(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args[0]?.toLowerCase();

  if (target) {
    // Help for specific command
    const cmd = COMMAND_REGISTRY.get(target) ?? COMMAND_REGISTRY.get(SYNONYM_MAP.get(target) ?? '');
    if (cmd) return formatHelpCommand(cmd);
    return formatUnknownCommand(target);
  }

  const commands = Array.from(COMMAND_REGISTRY.values());
  return formatHelp(commands, terminalState.clearanceLevel.value);
}

async function handleHistory(_ctx: CommandContext): Promise<TerminalLine[]> {
  const history = terminalState.commandHistory.value;
  const recent = history.slice(-20);
  if (recent.length === 0) return [systemLine(msg('No command history.'))];

  const lines: TerminalLine[] = [systemLine(msg('COMMAND HISTORY (last 20)'))];
  for (let i = 0; i < recent.length; i++) {
    lines.push(systemLine(`  ${i + 1}. ${recent[i]}`));
  }
  return lines;
}

async function handleFilter(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args[0]?.toLowerCase();
  const valid = ['all', 'intel', 'alert', 'weather', 'off'] as const;

  if (!target || !valid.includes(target as typeof valid[number])) {
    return [
      systemLine(`${msg('Feed filter')}: ${terminalState.feedFilter.value}`),
      systemLine(`${msg('Usage')}: filter ${valid.join('|')}`),
    ];
  }

  terminalState.setFeedFilter(target as typeof valid[number]);
  return [systemLine(`${msg('Feed filter set to')}: ${target}`)];
}

// ── Stage 2 Handlers ───────────────────────────────────────────────────────

async function handleFortify(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  if (!terminalState.consumeOps(1)) {
    return formatInsufficientPoints(msg('operations points'), terminalState.operationsPoints.value, 1);
  }

  // Target zone (default: current)
  let zoneId = terminalState.currentZoneId.value;
  let zoneName = terminalState.currentZone.value?.name ?? '';

  if (ctx.args.length > 0) {
    const target = ctx.args.join(' ');
    const zones = Array.from(terminalState.zoneCache.value.values());
    const matches = fuzzyMatch(target, zones);
    if (matches.length === 0) return formatUnknownCommand(target);
    if (matches.length > 1) return formatAmbiguousTarget(matches);
    zoneId = matches[0].id;
    zoneName = matches[0].name;
  }

  if (!zoneId) return [systemLine(msg('No zone selected.'))];

  const resp = await zoneActionsApi.create(sid, zoneId, { action_type: 'fortify' });
  if (!resp.success) {
    // Refund
    terminalState.operationsPoints.value += 1;
    return [systemLine(msg('Fortification failed. Points refunded.'))];
  }

  return formatFortify(zoneName, terminalState.operationsPoints.value);
}

async function handleQuarantine(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  if (!terminalState.consumeOps(2)) {
    return formatInsufficientPoints(msg('operations points'), terminalState.operationsPoints.value, 2);
  }

  let zoneId = terminalState.currentZoneId.value;
  let zoneName = terminalState.currentZone.value?.name ?? '';

  if (ctx.args.length > 0) {
    const target = ctx.args.join(' ');
    const zones = Array.from(terminalState.zoneCache.value.values());
    const matches = fuzzyMatch(target, zones);
    if (matches.length === 0) return formatUnknownCommand(target);
    if (matches.length > 1) return formatAmbiguousTarget(matches);
    zoneId = matches[0].id;
    zoneName = matches[0].name;
  }

  if (!zoneId) return [systemLine(msg('No zone selected.'))];

  const resp = await zoneActionsApi.create(sid, zoneId, { action_type: 'quarantine' });
  if (!resp.success) {
    terminalState.operationsPoints.value += 2;
    return [systemLine(msg('Quarantine failed. Points refunded.'))];
  }

  return formatQuarantine(zoneName, terminalState.operationsPoints.value);
}

async function handleAssign(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  // Parse "assign {agent} to {building}"
  const fullArgs = ctx.args.join(' ');
  const toIndex = fullArgs.toLowerCase().indexOf(' to ');
  if (toIndex === -1) {
    return [systemLine(msg("Syntax: assign {agent name} to {building name}"))];
  }

  const agentQuery = fullArgs.slice(0, toIndex).trim();
  const buildingQuery = fullArgs.slice(toIndex + 4).trim();

  if (!agentQuery || !buildingQuery) {
    return [systemLine(msg("Syntax: assign {agent name} to {building name}"))];
  }

  // Resolve agent (all agents in simulation, not just current zone)
  const agentsResp = await agentsApi.list(sid);
  const allAgents: Agent[] = agentsResp.success && agentsResp.data ? agentsResp.data : [];
  const agentMatches = fuzzyMatch(agentQuery, allAgents);
  if (agentMatches.length === 0) return formatUnknownCommand(agentQuery);
  if (agentMatches.length > 1) return formatAmbiguousTarget(agentMatches);

  // Resolve building (current zone)
  const zoneId = terminalState.currentZoneId.value;
  if (!zoneId) return [systemLine(msg('No zone selected.'))];
  await ensureZoneData(zoneId);
  const buildings = terminalState.currentZoneBuildings.value;
  const buildingMatches = fuzzyMatch(buildingQuery, buildings);
  if (buildingMatches.length === 0) return formatUnknownCommand(buildingQuery);
  if (buildingMatches.length > 1) return formatAmbiguousTarget(buildingMatches);

  const agent = agentMatches[0];
  const building = buildingMatches[0];

  const resp = await buildingsApi.assignAgent(sid, building.id, agent.id);
  if (!resp.success) {
    return [systemLine(msg('Assignment failed.'))];
  }

  terminalState.invalidateZoneCaches();
  return formatAssign(agent.name, building.name);
}

async function handleUnassign(ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('unassign');

  // Find agent
  const zoneId = terminalState.currentZoneId.value;
  if (!zoneId) return [systemLine(msg('No zone selected.'))];
  await ensureZoneData(zoneId);
  const agents = terminalState.currentZoneAgents.value;
  const matches = fuzzyMatch(target, agents);
  if (matches.length === 0) return formatUnknownCommand(target);
  if (matches.length > 1) return formatAmbiguousTarget(matches);

  const agent = matches[0];
  const buildingId = agent.current_building_id;
  if (!buildingId) {
    return [systemLine(`${agent.name} ${msg('is not assigned to any building.')}`)];
  }

  const resp = await buildingsApi.unassignAgent(sid, buildingId, agent.id);
  if (!resp.success) {
    return [systemLine(msg('Unassignment failed.'))];
  }

  terminalState.invalidateZoneCaches();
  return formatUnassign(agent.name);
}

async function handleCeremony(_ctx: CommandContext): Promise<TerminalLine[]> {
  if (!appState.canForge.value) {
    return [systemLine(msg('Insufficient clearance for ceremony initiation. Architect access required.'))];
  }

  // Navigate to forge
  const sim = appState.currentSimulation.value;
  if (sim) {
    window.dispatchEvent(
      new CustomEvent('vaadin-router-go', {
        detail: { pathname: `/simulations/${sim.slug}/forge` },
      }),
    );
  }
  return [systemLine(`[${msg('Redirecting to Simulation Forge...')}]`)];
}

// ── Stage 3: Intelligence Network Handlers ──────────────────────────────

async function handleScan(_ctx: CommandContext): Promise<TerminalLine[]> {
  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  if (!terminalState.consumeIntel(1)) {
    return formatInsufficientPoints(msg('intel points'), terminalState.intelPoints.value, 1);
  }

  const resp = await healthApi.listZoneStability(sid);
  if (!resp.success || !resp.data) {
    terminalState.intelPoints.value += 1; // Refund on failure
    return [errorLine(msg('Scan failed. Points refunded.'))];
  }

  // Cache stabilities for other commands
  terminalState.zoneStabilities.value = resp.data;

  return formatScan(
    resp.data,
    terminalState.currentZoneId.value,
    terminalState.intelPoints.value,
  );
}

async function handleInvestigate(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('investigate');

  const sid = simId();
  if (!sid) return [systemLine(msg('No simulation context.'))];

  if (!terminalState.consumeIntel(1)) {
    return formatInsufficientPoints(msg('intel points'), terminalState.intelPoints.value, 1);
  }

  // Fetch recent events and fuzzy-match by title
  const listResp = await eventsApi.list(sid, { limit: '50' });
  if (!listResp.success || !listResp.data) {
    terminalState.intelPoints.value += 1;
    return [errorLine(msg('Investigation failed. Points refunded.'))];
  }

  const matches = fuzzyMatch(target, listResp.data.map((e) => ({ id: e.id, name: e.title })));
  if (matches.length === 0) {
    terminalState.intelPoints.value += 1;
    return [errorLine(`${msg('No matching event found for')}: "${target}"`)];
  }
  if (matches.length > 1) {
    terminalState.intelPoints.value += 1;
    return formatAmbiguousTarget(matches);
  }

  // Fetch full event detail with reactions
  const eventResp = await eventsApi.getById(sid, matches[0].id);
  if (!eventResp.success || !eventResp.data) {
    terminalState.intelPoints.value += 1;
    return [errorLine(msg('Investigation failed. Points refunded.'))];
  }

  return formatInvestigate(eventResp.data, terminalState.intelPoints.value);
}

async function handleReport(_ctx: CommandContext): Promise<TerminalLine[]> {
  // Pure client-side — no API call, no intel cost
  const history = terminalState.commandHistory.value;
  const zones = Array.from(terminalState.zoneCache.value.values());
  const currentZone = terminalState.currentZone.value;

  // Derive zones visited from 'go' commands in history
  const zonesVisited: string[] = [];
  for (const cmd of history) {
    if (cmd.toLowerCase().startsWith('go ')) {
      const target = cmd.slice(3).trim();
      const match = zones.find((z) => z.name.toLowerCase().includes(target.toLowerCase()));
      if (match && !zonesVisited.includes(match.name)) {
        zonesVisited.push(match.name);
      }
    }
  }

  return formatReport(
    terminalState.commandCount.value,
    zonesVisited,
    history,
    currentZone?.name ?? null,
    terminalState.clearanceLevel.value,
  );
}

async function handleDebrief(ctx: CommandContext): Promise<TerminalLine[]> {
  const target = ctx.args.join(' ').trim();
  if (!target) return formatNoTarget('debrief');

  const sid = simId();
  const zoneId = terminalState.currentZoneId.value;
  if (!sid || !zoneId) return [systemLine(msg('No zone selected.'))];

  if (!terminalState.consumeIntel(1)) {
    return formatInsufficientPoints(msg('intel points'), terminalState.intelPoints.value, 1);
  }

  await ensureZoneData(zoneId);
  const agents = terminalState.currentZoneAgents.value;
  const matches = fuzzyMatch(target, agents);

  if (matches.length === 0) {
    terminalState.intelPoints.value += 1;
    return formatUnknownCommand(target);
  }
  if (matches.length > 1) {
    terminalState.intelPoints.value += 1;
    return formatAmbiguousTarget(matches);
  }

  const agent = matches[0];

  // Reuse or create conversation for debrief
  let conversationId = terminalState.getConversationForAgent(agent.id);
  if (!conversationId) {
    const resp = await chatApi.createConversation(sid, {
      agent_ids: [agent.id],
      title: `Bureau Debrief: ${agent.name}`,
    });
    if (!resp.success || !resp.data) {
      terminalState.intelPoints.value += 1;
      return [errorLine(msg('Debrief failed. Points refunded.'))];
    }
    conversationId = resp.data.id;
    terminalState.enterConversation(agent.id, agent.name, conversationId);
    terminalState.exitConversation(); // Don't stay in conversation mode
  }

  // Send debrief request
  const debriefPrompt = [
    'Provide a formal Bureau debrief report.',
    'Structure your response in THREE sections:',
    'ZONE ASSESSMENT: Current zone stability, active threats, staffing.',
    'PERSONNEL NOTE: Other agents, relationships, suspicious activity.',
    'RECOMMENDATION: Suggested actions for the operator.',
    'Stay in character. Report only what you would realistically know.',
  ].join(' ');

  const msgResp = await chatApi.sendMessage(sid, conversationId, {
    content: debriefPrompt,
    generate_response: true,
  });

  if (!msgResp.success || !msgResp.data) {
    terminalState.intelPoints.value += 1;
    return [errorLine(msg('Debrief failed. Points refunded.'))];
  }

  const messages = (Array.isArray(msgResp.data) ? msgResp.data : [msgResp.data]) as ChatMessage[];
  const aiResponse = messages.find((m) => m.sender_role === 'assistant');
  const responseText = aiResponse?.content ?? msg('No response received.');

  return formatDebrief(agent, responseText, terminalState.intelPoints.value);
}

async function handleAsk(ctx: CommandContext): Promise<TerminalLine[]> {
  // Parse: ask {agent} about {topic}
  const raw = ctx.args.join(' ').trim();
  const aboutIdx = raw.toLowerCase().indexOf(' about ');
  if (aboutIdx === -1 || !raw) {
    return [errorLine(`${msg('Syntax')}: ask {${msg('agent name')}} about {${msg('topic')}}`)];
  }

  const agentQuery = raw.slice(0, aboutIdx).trim();
  const topic = raw.slice(aboutIdx + 7).trim();
  if (!agentQuery || !topic) {
    return [errorLine(`${msg('Syntax')}: ask {${msg('agent name')}} about {${msg('topic')}}`)];
  }

  const sid = simId();
  const zoneId = terminalState.currentZoneId.value;
  if (!sid || !zoneId) return [systemLine(msg('No zone selected.'))];

  await ensureZoneData(zoneId);
  const agents = terminalState.currentZoneAgents.value;
  const matches = fuzzyMatch(agentQuery, agents);

  if (matches.length === 0) return formatUnknownCommand(agentQuery);
  if (matches.length > 1) return formatAmbiguousTarget(matches);

  const agent = matches[0];

  // Reuse or create conversation
  let conversationId = terminalState.getConversationForAgent(agent.id);
  if (!conversationId) {
    const resp = await chatApi.createConversation(sid, {
      agent_ids: [agent.id],
      title: `Bureau Query: ${agent.name}`,
    });
    if (!resp.success || !resp.data) {
      return [errorLine(msg('Failed to establish communication channel.'))];
    }
    conversationId = resp.data.id;
    terminalState.enterConversation(agent.id, agent.name, conversationId);
    terminalState.exitConversation();
  }

  const askPrompt = `The Bureau operator asks you about: ${topic}. Answer only about this topic. If you don't have information, say so. Stay in character. Be concise.`;

  const msgResp = await chatApi.sendMessage(sid, conversationId, {
    content: askPrompt,
    generate_response: true,
  });

  if (!msgResp.success || !msgResp.data) {
    return [errorLine(msg('Communication interrupted. Try again.'))];
  }

  const messages = (Array.isArray(msgResp.data) ? msgResp.data : [msgResp.data]) as ChatMessage[];
  const aiResponse = messages.find((m) => m.sender_role === 'assistant');
  const responseText = aiResponse?.content ?? msg('No response received.');

  return formatAskResponse(agent, topic, responseText);
}

// ── Command Registry ───────────────────────────────────────────────────────

export const COMMAND_REGISTRY = new Map<string, TerminalCommand>([
  // Stage 1: Observation
  // NOTE: descriptions use () => msg() to avoid module-level i18n gotcha (see i18n-gotchas.md)
  ['look', {
    verb: 'look', synonyms: ['l', 'observe', 'survey'], tier: 1,
    syntax: 'look', description: () => msg('Observe your current zone'),
    requiresTarget: false, handler: handleLook,
  }],
  ['go', {
    verb: 'go', synonyms: ['move', 'walk', 'travel'], tier: 1,
    syntax: 'go {zone name}', description: () => msg('Travel to another zone'),
    requiresTarget: true, targetType: 'zone', handler: handleGo,
  }],
  ['examine', {
    verb: 'examine', synonyms: ['ex', 'inspect', 'x'], tier: 1,
    syntax: 'examine {name}', description: () => msg('Inspect an agent or building'),
    requiresTarget: true, targetType: 'agent', handler: handleExamine,
  }],
  ['talk', {
    verb: 'talk', synonyms: ['speak', 'contact', 'hail'], tier: 1,
    syntax: 'talk {agent name}', description: () => msg('Start a conversation with an agent'),
    requiresTarget: true, targetType: 'agent', handler: handleTalk,
  }],
  ['weather', {
    verb: 'weather', synonyms: ['wx', 'conditions'], tier: 1,
    syntax: 'weather', description: () => msg('Show current weather conditions'),
    requiresTarget: false, handler: handleWeather,
  }],
  ['status', {
    verb: 'status', synonyms: ['sitrep', 'sit'], tier: 1,
    syntax: 'status', description: () => msg('Full situation report'),
    requiresTarget: false, handler: handleStatus,
  }],
  ['help', {
    verb: 'help', synonyms: [], tier: 1,
    syntax: 'help [command]', description: () => msg('List available commands'),
    requiresTarget: false, handler: handleHelp,
  }],
  ['map', {
    verb: 'map', synonyms: [], tier: 1,
    syntax: 'map', description: () => msg('Show sector map'),
    requiresTarget: false, handler: handleMap,
  }],
  ['where', {
    verb: 'where', synonyms: [], tier: 1,
    syntax: 'where', description: () => msg('Show your current location'),
    requiresTarget: false, handler: handleWhere,
  }],
  ['history', {
    verb: 'history', synonyms: [], tier: 1,
    syntax: 'history', description: () => msg('Show command history'),
    requiresTarget: false, handler: handleHistory,
  }],
  ['filter', {
    verb: 'filter', synonyms: ['feed'], tier: 1,
    syntax: 'filter {channel}', description: () => msg('Filter realtime feed'),
    requiresTarget: false, handler: handleFilter,
  }],
  ['exitconversation', {
    verb: 'exitconversation', synonyms: ['leave', 'bye', 'exit'], tier: 1,
    syntax: 'leave', description: () => msg('Exit current conversation'),
    requiresTarget: false, handler: handleExitConversation,
  }],

  // Stage 2: Field Operations
  ['fortify', {
    verb: 'fortify', synonyms: ['reinforce', 'defend'], tier: 2,
    syntax: 'fortify [zone]', description: () => msg('Fortify a zone (-15% event pressure, 7 days)'),
    requiresTarget: false, handler: handleFortify,
  }],
  ['quarantine', {
    verb: 'quarantine', synonyms: ['lockdown', 'isolate'], tier: 2,
    syntax: 'quarantine [zone]', description: () => msg('Quarantine a zone (14 days, 2 ops points)'),
    requiresTarget: false, handler: handleQuarantine,
  }],
  ['assign', {
    verb: 'assign', synonyms: ['station', 'post', 'transfer'], tier: 2,
    syntax: 'assign {agent} to {building}', description: () => msg('Assign agent to building'),
    requiresTarget: true, targetType: 'freetext', handler: handleAssign,
  }],
  ['unassign', {
    verb: 'unassign', synonyms: [], tier: 2,
    syntax: 'unassign {agent}', description: () => msg('Remove agent from current building'),
    requiresTarget: true, targetType: 'agent', handler: handleUnassign,
  }],
  ['ceremony', {
    verb: 'ceremony', synonyms: [], tier: 2,
    syntax: 'ceremony', description: () => msg('Initiate a Forge ceremony'),
    requiresTarget: false, handler: handleCeremony,
  }],

  // Stage 3: Intelligence Network
  ['scan', {
    verb: 'scan', synonyms: ['radar', 'sweep'], tier: 3,
    syntax: 'scan', description: () => msg('Radar sweep of all sectors (1 intel point)'),
    requiresTarget: false, handler: handleScan,
  }],
  ['investigate', {
    verb: 'investigate', synonyms: ['probe', 'research'], tier: 3,
    syntax: 'investigate {event}', description: () => msg('Deep investigation of an event (1 intel point)'),
    requiresTarget: true, targetType: 'event', handler: handleInvestigate,
  }],
  ['report', {
    verb: 'report', synonyms: ['summary', 'log'], tier: 3,
    syntax: 'report', description: () => msg('Generate session report'),
    requiresTarget: false, handler: handleReport,
  }],
  ['debrief', {
    verb: 'debrief', synonyms: ['intel', 'brief'], tier: 3,
    syntax: 'debrief {agent}', description: () => msg('Formal agent debrief (1 intel point, AI)'),
    requiresTarget: true, targetType: 'agent', handler: handleDebrief,
  }],
  ['ask', {
    verb: 'ask', synonyms: ['query', 'question'], tier: 3,
    syntax: 'ask {agent} about {topic}', description: () => msg('Ask agent about a specific topic (AI)'),
    requiresTarget: true, targetType: 'freetext', handler: handleAsk,
  }],
]);

// ── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse and execute a terminal command.
 * Returns the output lines to display (including the echoed command).
 */
export async function parseAndExecute(input: string): Promise<TerminalLine[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const output: TerminalLine[] = [];

  // Echo the command
  output.push(commandLine(trimmed));

  // Record in history
  terminalState.pushCommand(trimmed);

  // Check conversation mode — all input routes to chat except leave/bye/exit
  if (terminalState.isInConversation.value) {
    const lower = trimmed.toLowerCase();
    if (lower === 'leave' || lower === 'bye' || lower === 'exit') {
      const result = await handleExitConversation({
        simulationId: simId(), currentZoneId: terminalState.currentZoneId.value ?? '',
        rawInput: trimmed, verb: 'exitconversation', args: [],
      });
      output.push(...result);
    } else {
      const result = await handleConversationInput(trimmed);
      output.push(...result);
    }
    return output;
  }

  // Tokenize
  const tokens = trimmed.split(/\s+/);
  const rawVerb = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  // Resolve synonym
  const verb = SYNONYM_MAP.get(rawVerb) ?? rawVerb;

  // Look up command
  const cmd = COMMAND_REGISTRY.get(verb);

  if (!cmd) {
    // Suggest closest match
    let bestMatch: string | undefined;
    let bestDist = 3;
    for (const key of COMMAND_REGISTRY.keys()) {
      const d = levenshtein(rawVerb, key);
      if (d < bestDist) {
        bestDist = d;
        bestMatch = key;
      }
    }
    for (const [syn] of SYNONYM_MAP) {
      const d = levenshtein(rawVerb, syn);
      if (d < bestDist) {
        bestDist = d;
        bestMatch = SYNONYM_MAP.get(syn) ?? syn;
      }
    }
    output.push(...formatUnknownCommand(rawVerb, bestMatch));
    return output;
  }

  // Check clearance
  if (cmd.tier > terminalState.clearanceLevel.value) {
    output.push(...formatInsufficientClearance(verb, cmd.tier));
    return output;
  }

  // Execute
  terminalState.isLoading.value = true;
  try {
    const ctx: CommandContext = {
      simulationId: simId(),
      currentZoneId: terminalState.currentZoneId.value ?? '',
      rawInput: trimmed,
      verb,
      args,
    };
    const result = await cmd.handler(ctx);
    output.push(...result);

    // Check for clearance upgrade
    const upgrade = terminalState.checkClearanceUpgrade();
    if (upgrade) {
      output.push(...formatClearanceUpgrade(upgrade.newLevel, upgrade.commands));
    }

    // Check onboarding hints
    if (terminalState.onboardingStep.value < 5) {
      const step = terminalState.onboardingStep.value;
      const shouldAdvance =
        (step === 0 && verb === 'look') ||
        (step === 1 && verb === 'examine') ||
        (step === 2 && verb === 'talk') ||
        (step === 3 && verb === 'go') ||
        (step === 4 && verb === 'status');

      if (shouldAdvance) {
        const hint = formatOnboardingHint(step);
        if (hint) output.push(hint);
        terminalState.advanceOnboardingStep();
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : msg('Command failed.');
    output.push(systemLine(`[ERROR] ${message}`));
  } finally {
    terminalState.isLoading.value = false;
  }

  return output;
}

/** Get boot sequence lines for first-time display. */
export function getBootSequence(): TerminalLine[] {
  const simName = appState.currentSimulation.value?.name ?? 'Unknown';
  const theme = appState.currentSimulation.value?.theme;

  // Read AI-generated boot art from simulation design settings
  const bootArtSetting = appState.settings.value.find(
    (s) => s.setting_key === 'terminal_boot_art',
  );
  const customArt = typeof bootArtSetting?.setting_value === 'string'
    ? bootArtSetting.setting_value
    : undefined;

  return formatBootSequence(simName, theme, customArt);
}

/**
 * Get compact re-entry lines when terminal is revisited (onboarded but output cleared).
 * Short wake-from-sleep message: sector + zone + hint. Not the full cinematic boot.
 */
export function getReentrySequence(): TerminalLine[] {
  const simName = appState.currentSimulation.value?.name ?? 'Unknown';
  const zone = terminalState.currentZone.value;
  const level = terminalState.clearanceLevel.value;

  const lines: TerminalLine[] = [];
  lines.push(systemLine(''));
  lines.push(systemLine(`BUREAU FIELD TERMINAL — ${simName.toUpperCase()}`));
  lines.push(systemLine(`${msg('Operator clearance')}: LEVEL ${level}`));
  if (zone) {
    lines.push(systemLine(`${msg('Assigned sector')}: ${zone.name}`));
  }
  lines.push(systemLine(''));
  lines.push(systemLine(msg("Type 'look' to observe your surroundings.")));
  return lines;
}
