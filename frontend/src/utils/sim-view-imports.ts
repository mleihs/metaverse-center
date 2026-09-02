/**
 * Maps simulation view names to their dynamic import factories.
 * Used by _enterSimulationRoute() in app-shell to lazy-load view components.
 */
/**
 * Where a bare `/simulations/:id` lands, and the tab the register marks with ◈.
 *
 * Named once because three places must agree: the redirect in app-shell, the
 * fallback in SimulationNav._detectActiveTab, and the ornament in the bar. It
 * lives here rather than on the nav component so app-shell can import it
 * without dragging a Lit element into the entry bundle.
 */
export const DEFAULT_TAB = 'overview';

const viewImports: Record<string, () => Promise<unknown>> = {
  overview: () => import('../components/simulation/SimulationOverview.js'),
  lore: () => import('../components/lore/SimulationLoreView.js'),
  broadsheet: () => import('../components/broadsheet/SimulationBroadsheet.js'),
  chronicle: () => import('../components/chronicle/ChronicleView.js'),
  health: () => import('../components/health/SimulationHealthView.js'),
  pulse: () => import('../components/heartbeat/SimulationPulse.js'),
  agents: () => import('../components/agents/AgentsView.js'),
  bonds: () => import('../components/bonds/BondsView.js'),
  buildings: () => import('../components/buildings/BuildingsView.js'),
  events: () => import('../components/events/EventsView.js'),
  intake: () => import('../components/intake/IntakeView.js'),
  chat: () => import('../components/chat/ChatView.js'),
  settings: () => import('../components/settings/SettingsView.js'),
  social: () => import('../components/social/SocialTrendsView.js'),
  locations: () => import('../components/locations/LocationsView.js'),
  atlas: () => import('../components/world-map/SimulationWorldMap.js'),
  terminal: () => import('../components/terminal/TerminalView.js'),
  dungeon: () => import('../components/dungeon/DungeonView.js'),
};

export function getSimViewImport(view: string): (() => Promise<unknown>) | undefined {
  return viewImports[view];
}
