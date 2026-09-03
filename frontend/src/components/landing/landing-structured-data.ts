/**
 * Die strukturierten Daten der Frontseite - unveraendert aus der alten Seite.
 *
 * Wortwoertlich uebernommen, nicht neu geschrieben: der Inhalt ist gepruefte
 * Auffindbarkeitsarbeit (VideoGame, FAQPage mit vier Fragen, HowTo mit vier
 * Schritten), und ihn beim Umbau der Gestaltung neu zu formulieren haette
 * nichts verbessert und Rang gekostet. Er liegt hier in einem eigenen Modul,
 * damit die Seite selbst schlank bleibt und damit sichtbar ist, dass es sich
 * um uebernommenen Bestand handelt.
 *
 * Was NICHT hier steht: Zahlen. Der Kriecher bekommt keine Kennzahl, die
 * veralten koennte - die Zahlen der Seite kommen aus dem Schnappschuss und
 * stehen im sichtbaren Text.
 */

import { seoService } from '../../services/SeoService.js';

export function injectLandingStructuredData(): void {
  seoService.setStructuredData({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        name: 'metaverse.center',
        url: 'https://metaverse.center',
        description:
          'A multiplayer worldbuilding and strategy platform with AI-powered agents, competitive epochs, and cross-simulation diplomacy.',
        genre: ['Strategy', 'Simulation', 'Role-playing'],
        playMode: ['MultiPlayer', 'SinglePlayer'],
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 8 },
        applicationCategory: 'Game',
        operatingSystem: 'Web browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        gamePlatform: 'Web',
        inLanguage: ['en', 'de'],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is metaverse.center?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'metaverse.center is a free multiplayer worldbuilding and strategy platform. Create living worlds with AI-powered agents, sprawling cities, and evolving lore. Join competitive Epochs where civilizations clash through espionage, alliances, and strategic deployment.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do Epochs work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Epochs are competitive PvP seasons where simulation owners deploy operatives, form alliances, and compete across five scoring dimensions: stability, influence, sovereignty, diplomatic, and military. Each cycle, players choose missions and targets, with results determined by agent aptitudes and strategic decisions.',
            },
          },
          {
            '@type': 'Question',
            name: 'What are Resonances?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Resonances are real-world events (earthquakes, elections, discoveries) that ripple through the simulated multiverse, affecting gameplay and world dynamics. They blur the boundary between simulated worlds and reality.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is metaverse.center free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, metaverse.center is completely free. Create simulations, join Epochs, and explore the multiverse at no cost. Advanced AI features like image generation use optional API keys.',
            },
          },
        ],
      },
      {
        '@type': 'HowTo',
        name: 'How to Build a World on metaverse.center',
        description: 'From a single sentence to a living, competitive civilization in four steps.',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Create Your World',
            text: 'You file a premise. The Forge answers with a complete civilization: dozens of characters carrying their own histories, cities with architecture, thousands of words of original lore, and a founding grudge nobody asked for.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Join an Epoch',
            text: 'Pit your civilization against others in timed competitive seasons. Deploy operatives, sabotage rivals, protect your agents. Strategy meets emergent AI storytelling.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Enter the Resonance',
            text: 'Send agents into the fractures between worlds. Eight archetypal dungeons, procedurally generated and literarily informed, where stress is real and choices reshape who your agents become.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Shape the Metaverse',
            text: 'Your actions ripple across every connected world. Build embassies, trigger cross-simulation events, and watch as the stories of separate civilizations entangle.',
          },
        ],
      },
    ],
  });
}
