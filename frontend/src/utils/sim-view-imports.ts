/**
 * Maps simulation view names to their dynamic import factories.
 * Used by _enterSimulationRoute() in app-shell to lazy-load view components.
 */
const viewImports: Record<string, () => Promise<unknown>> = {
  lore: () => import('../components/lore/SimulationLoreView.js'),
  broadsheet: () => import('../components/broadsheet/SimulationBroadsheet.js'),
  chronicle: () => import('../components/chronicle/ChronicleView.js'),
  health: () => import('../components/health/SimulationHealthView.js'),
  pulse: () => import('../components/heartbeat/SimulationPulse.js'),
  agents: () => import('../components/agents/AgentsView.js'),
  bonds: () => import('../components/bonds/BondsView.js'),
  buildings: () => import('../components/buildings/BuildingsView.js'),
  events: () => import('../components/events/EventsView.js'),
  chat: () => import('../components/chat/ChatView.js'),
  settings: () => import('../components/settings/SettingsView.js'),
  social: () => import('../components/social/SocialTrendsView.js'),
  locations: () => import('../components/locations/LocationsView.js'),
  terminal: () => import('../components/terminal/TerminalView.js'),
  dungeon: () => import('../components/dungeon/DungeonTerminalView.js'),
};

export function getSimViewImport(view: string): (() => Promise<unknown>) | undefined {
  return viewImports[view];
}
