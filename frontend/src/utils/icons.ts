import { svg } from 'lit';

/**
 * Centralized SVG icon library — Three-Tier Taxonomy.
 *
 * Tier 1 (Platform Chrome): Tabler-derived stroke, 2.0px standard / 1.5px decorative.
 *   Square linecaps + miter joins for brutalist aesthetic.
 * Tier 2 (Lore Objects): Custom-drawn archetype icons, 1.5px stroke.
 * Tier 3 (Game Pieces): game-icons.net filled silhouettes, viewBox 0 0 512 512.
 *   CC BY 3.0 — lorc, delapouite, skoll.
 *
 * See docs/concepts/icon-system-audit.md for full taxonomy and rationale.
 */
export const icons = {
  edit: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
      <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
      <path d="M16 5l3 3" />
    </svg>
  `,

  trash: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 7l16 0" />
      <path d="M10 11l0 6" />
      <path d="M14 11l0 6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  `,

  chevronDown: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M6 9l6 6l6 -6" />
    </svg>
  `,

  chevronRight: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 6l6 6l-6 6" />
    </svg>
  `,

  plus: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 5l0 14" /><path d="M5 12l14 0" />
    </svg>
  `,

  close: (size = 12) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  `,

  building: (size = 48) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 21l18 0" />
      <path d="M5 21v-14l8 -4v18" />
      <path d="M19 21v-10l-6 -4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  `,

  calendar: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M4 11h16" />
    </svg>
  `,

  location: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
    </svg>
  `,

  brain: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
      <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
      <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
      <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
      <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
      <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
    </svg>
  `,

  sparkle: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 6a6 6 0 0 1 6 6a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6z" />
    </svg>
  `,

  palette: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
      <path d="M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </svg>
  `,

  search: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35 -4.35" />
    </svg>
  `,

  book: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6l0 13" />
      <path d="M12 6l0 13" />
      <path d="M21 6l0 13" />
    </svg>
  `,

  users: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
    </svg>
  `,

  bolt: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M13 3l0 7h6l-8 11l0 -7h-6l8 -11" />
    </svg>
  `,

  messageCircle: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" />
    </svg>
  `,

  megaphone: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M18 8a3 3 0 0 1 0 6" />
      <path d="M10 8v6a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1" />
      <path d="M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h0" />
      <path d="M4 18l2 -4h-2" />
    </svg>
  `,

  mapPin: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
    </svg>
  `,

  gear: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </svg>
  `,

  terminal: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  `,

  heartbeat: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M19.5 13.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
      <path d="M3 12h4l2 -3l4 6l2 -3h4" />
    </svg>
  `,

  image: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </svg>
  `,

  menu: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  `,

  // ── Bot personality icons ────────────────────────────
  botSentinel: (size = 24) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l8 4.5v5c0 4.418-3.354 8.074-8 9.5-4.646-1.426-8-5.082-8-9.5v-5L12 3z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  `,

  botWarlord: (size = 24) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 2l1.5 5h5l-4 3.5 1.5 5-4-3-4 3 1.5-5-4-3.5h5z" />
      <path d="M5 20l3-3" />
      <path d="M19 20l-3-3" />
    </svg>
  `,

  botDiplomat: (size = 24) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M11 14h-4a2 2 0 00-2 2v2" />
      <path d="M13 14h4a2 2 0 012 2v2" />
      <circle cx="9" cy="8" r="3" />
      <circle cx="15" cy="8" r="3" />
      <path d="M12 11v3" />
    </svg>
  `,

  botStrategist: (size = 24) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  `,

  botChaos: (size = 24) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M13 3l0 7h6l-8 11l0-7h-6l8-11" />
    </svg>
  `,

  github: (size = 18) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="currentColor" stroke="none">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  `,

  instagram: (size = 18) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  `,

  // ── Operative type icons ──────────────────────────────

  operativeSpy: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
    </svg>
  `,

  operativeSaboteur: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="15" r="7" />
      <path d="M12 8v-5" />
      <path d="M14 3l-2 2-2-2" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  `,

  operativeAssassin: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 2l-1 9h2l-1 9" />
      <path d="M8 11l4-9 4 9" />
      <path d="M5 20l7-3 7 3" />
    </svg>
  `,

  operativeInfiltrator: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 4c-2.5 0-4.5 1.5-5 4-.3 1.5 0 3 .8 4.2" />
      <path d="M16.2 12.2c.8-1.2 1.1-2.7.8-4.2-.5-2.5-2.5-4-5-4" />
      <path d="M9 16c0 1.7 1.3 3 3 3s3-1.3 3-3" />
      <path d="M12 19v2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  `,

  operativeGuardian: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l8 4.5v5c0 4.418-3.354 8.074-8 9.5-4.646-1.426-8-5.082-8-9.5v-5L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  `,

  // ── Battle event icons ────────────────────────────────

  target: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  `,

  checkCircle: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  `,

  xCircle: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  `,

  alertTriangle: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
      <path d="M12 16h.01" />
    </svg>
  `,

  explosion: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 2l1 5 4-3-2 5 5 1-4 3 3 4-5-2 1 5-3-4-3 4 1-5-5 2 3-4-4-3 5-1-2-5 4 3z" />
    </svg>
  `,

  droplet: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" />
    </svg>
  `,

  handshake: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M11 17l-1-1" />
      <path d="M14 14l-4 4-3-3 4-4" />
      <path d="M3 7l3 3 4-4 2 2 5-5 3 3" />
      <path d="M3 7l0 4h4" />
      <path d="M21 7l0 4h-4" />
    </svg>
  `,

  skull: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 4c4.418 0 8 3.358 8 7.5 0 1.901-.794 3.636-2.1 4.952l.1 2.548a1 1 0 01-1 1h-10a1 1 0 01-1-1l.1-2.548C4.794 15.136 4 13.401 4 11.5 4 7.358 7.582 4 12 4z" />
      <circle cx="9" cy="11" r="1" />
      <circle cx="15" cy="11" r="1" />
      <path d="M10 16h4" />
      <path d="M12 16v3" />
    </svg>
  `,

  radar: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
      <path d="M12 3v4" />
      <path d="M12 12l5-5" />
    </svg>
  `,

  clipboard: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  `,

  // ── Misc icons ────────────────────────────────────────

  antenna: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 12l-2-4" />
      <path d="M12 12l2-4" />
      <path d="M12 12v9" />
      <path d="M8 21h8" />
      <path d="M7 5a5 5 0 0 1 10 0" />
      <path d="M4 2a10 10 0 0 1 16 0" />
    </svg>
  `,

  columns: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 21h18" />
      <path d="M5 21v-14l7-4 7 4v14" />
      <path d="M9 21v-8h6v8" />
      <path d="M3 7h18" />
    </svg>
  `,

  crossedSwords: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M5 19l14-14" />
      <path d="M15 5h4v4" />
      <path d="M19 19l-14-14" />
      <path d="M5 5h4v4" />
    </svg>
  `,

  deploy: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 16v5" />
      <path d="M9 18l3 3 3-3" />
    </svg>
  `,

  fortify: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l8 4.5v5c0 4.418-3.354 8.074-8 9.5-4.646-1.426-8-5.082-8-9.5v-5L12 3z" />
      <path d="M12 9v4" />
      <path d="M10 11h4" />
    </svg>
  `,

  trophy: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 7H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3h1" />
      <path d="M17 7h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3h-1" />
    </svg>
  `,

  timer: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M10 2h4" />
    </svg>
  `,

  newspaper: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8z" />
    </svg>
  `,

  // --- Substrate Resonance Archetypes ---

  archetypeTower: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 21l3 -18l3 18" />
      <path d="M7 6l10 0" />
      <path d="M6 12l12 0" />
      <path d="M5 18l14 0" />
      <path d="M15 3l2 -1" />
      <path d="M17 7l2 -2" />
    </svg>
  `,

  archetypeShadow: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3a9 9 0 0 1 0 18" />
      <path d="M12 3a7 7 0 0 0 0 18" />
      <path d="M12 3v18" />
      <circle cx="12" cy="9" r="1" fill="currentColor" />
      <circle cx="12" cy="15" r="1" fill="currentColor" />
    </svg>
  `,

  archetypeDevouringMother: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 21c-4.97 0 -9 -2.686 -9 -6c0 -2.21 1.79 -4.126 4.5 -5.174" />
      <path d="M12 21c4.97 0 9 -2.686 9 -6c0 -2.21 -1.79 -4.126 -4.5 -5.174" />
      <path d="M12 3c-1.933 0 -3.5 2.239 -3.5 5s1.567 5 3.5 5" />
      <path d="M12 3c1.933 0 3.5 2.239 3.5 5s-1.567 5 -3.5 5" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" />
    </svg>
  `,

  archetypeDeluge: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 14c0 -3.314 3.582 -6 8 -6s8 2.686 8 6" />
      <path d="M3 18c.328 -.814 1.014 -1.553 1.952 -2.14" />
      <path d="M21 18c-.328 -.814 -1.014 -1.553 -1.952 -2.14" />
      <path d="M7 4l.5 2" />
      <path d="M12 3v3" />
      <path d="M17 4l-.5 2" />
      <path d="M5 20l2 -1" />
      <path d="M12 20v1" />
      <path d="M19 20l-2 -1" />
    </svg>
  `,

  archetypeOverthrow: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l-8 9h5v9h6v-9h5z" />
    </svg>
  `,

  archetypePrometheus: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 2l1.5 5h4.5l-3.5 3l1.5 5l-4 -3l-4 3l1.5 -5l-3.5 -3h4.5z" />
      <path d="M12 15v6" />
      <path d="M9 18h6" />
    </svg>
  `,

  archetypeAwakening: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M4.93 4.93l2.12 2.12" />
      <path d="M16.95 16.95l2.12 2.12" />
      <path d="M4.93 19.07l2.12 -2.12" />
      <path d="M16.95 7.05l2.12 -2.12" />
    </svg>
  `,

  archetypeEntropy: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 3c-1.333 2.667 -2 5.333 -2 8s.667 5.333 2 8" />
      <path d="M12 3c1.333 2.667 2 5.333 2 8s-.667 5.333 -2 8" />
      <path d="M8 8l8 8" />
      <path d="M16 8l-8 8" />
    </svg>
  `,

  /** Returns the archetype icon for a given resonance signature. */
  resonanceArchetype: (signature: string, size = 16) => {
    const map: Record<string, (size: number) => ReturnType<typeof svg>> = {
      economic_tremor: icons.archetypeTower,
      conflict_wave: icons.archetypeShadow,
      biological_tide: icons.archetypeDevouringMother,
      elemental_surge: icons.archetypeDeluge,
      authority_fracture: icons.archetypeOverthrow,
      innovation_spark: icons.archetypePrometheus,
      consciousness_drift: icons.archetypeAwakening,
      decay_bloom: icons.archetypeEntropy,
    };
    return (map[signature] ?? icons.alertTriangle)(size);
  },

  /** Substrate tremor icon (seismograph wave). */
  substrateTremor: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 12h3l2 -6l3 12l3 -8l2 6h5" />
    </svg>
  `,

  // ── Visibility icons ──────────────────────────────────

  eye: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </svg>
  `,

  eyeOff: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.014 9.014 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </svg>
  `,

  upload: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
      <path d="M7 9l5 -5l5 5" />
      <path d="M12 4l0 12" />
    </svg>
  `,

  imageReference: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M15 8h.01" />
      <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" />
      <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
      <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />
    </svg>
  `,

  key: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-3.602 -3.602a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z" />
      <path d="M14.5 7.5l-8 8" />
      <path d="M3 21l1.5 -1.5" />
      <path d="M6.5 17.5l2-2" />
    </svg>
  `,

  // ── OAuth provider icons ────────────────────────────

  googleOAuth: (size = 18) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  `,

  // ── Bleed / Threshold / Cartography icons ────────────

  fracture: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 3l5 7-3 4 6 7" />
      <path d="M9 10l5-2" />
      <path d="M6 14l4 1" />
      <path d="M20 3l-5 7 3 4-6 7" />
    </svg>
  `,

  anchor: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v13" />
      <path d="M5 12h2a5 5 0 0 0 10 0h2" />
      <path d="M12 20a8 8 0 0 1-8-8" />
      <path d="M12 20a8 8 0 0 0 8-8" />
    </svg>
  `,

  scorchedEarth: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
    </svg>
  `,

  emergencyDraft: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
      <path d="M19 7v6" />
      <path d="M19 16h.01" />
    </svg>
  `,

  compassRose: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l1 4-1 1-1-1z" fill="currentColor" />
      <path d="M12 21l-1-4 1-1 1 1z" />
      <path d="M3 12l4-1 1 1-1 1z" />
      <path d="M21 12l-4 1-1-1 1-1z" fill="currentColor" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  `,

  stampClassified: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M7 10h10" />
      <path d="M7 14h6" />
    </svg>
  `,

  lock: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11v-4a4 4 0 0 1 8 0v4" />
    </svg>
  `,

  magnifyingGlass: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="10" cy="10" r="7" />
      <path d="M21 21l-6-6" />
    </svg>
  `,

  pencilAnnotate: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  `,

  layerInfrastructure: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 21h18" />
      <path d="M5 21v-12l7-4 7 4v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M10 9h4" />
    </svg>
  `,

  layerBleed: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" />
      <path d="M12 3v18" stroke-dasharray="2 2" />
    </svg>
  `,

  layerMilitary: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l8 4.5v5c0 4.418-3.354 8.074-8 9.5-4.646-1.426-8-5.082-8-9.5v-5L12 3z" />
      <path d="M12 8l-3 5h6l-3 5" />
    </svg>
  `,

  layerHistory: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <path d="M3.05 11h.01" />
      <path d="M3.05 13h.01" />
    </svg>
  `,

  heartline: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 12h4l2 -3l4 6l2 -3h6" />
    </svg>
  `,

  flatline: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M3 12h18" />
    </svg>
  `,

  hexagon: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M19.875 6.27a2.225 2.225 0 0 1 1.125 1.948v7.564c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1-2.184 0l-6.75-4.27A2.225 2.225 0 0 1 3 15.782V8.218c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033z" />
    </svg>
  `,

  // ── Dungeon Icons ─────────────────────────────────────────────────────────

  /** Depth gauge — stairs goal (delapouite, game-icons.net, CC BY 3.0). */
  dungeonDepth: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M439 32v165h18V32h-18zm-18 12.99L327.6 80l93.4 35V44.99zM165.9 103c-5 0-10.2 2.3-15.3 7-6.2 5.8-11.5 15.1-13.8 26.3-2.3 11.3-1 22 2.5 29.7 3.5 7.8 8.6 12.3 14.6 13.5 6 1.3 12.4-.9 18.7-6.6 6.1-5.8 11.5-15.1 13.8-26.4 2.2-11.3.9-22-2.5-29.7-3.5-7.8-8.6-12.2-14.6-13.5-1.1-.2-2.3-.3-3.4-.3zm-38.4 78.5c-3.4 1.2-6.9 2.5-10.7 4.1-24.85 15.7-42.2 31.2-59.84 55.7-11.19 15.5-11.74 42-12.58 61.5l20.8 9.2c.87-27.8.36-39.3 13.27-55.3 9.83-12.2 19.33-25 37.55-28.9 1.6 28.9-2.6 73.7-14 119.6 20.5 2.8 37.6-.7 57-6.3 50.7-25.3 74.1-3.8 109.3 45.7l20.5-32.1c-24.6-28.9-48.5-75.1-117.2-57.3 5-27.3 5.6-45.4 8.6-72.6.6-12 .8-23.9 1.1-35.7-8.9 6.8-19.9 10.4-31 8.1-9.5-2-17.3-7.9-22.8-15.7zm144.2 7.3c-18.2 17.8-22.2 31-50.2 38.4l-22.5-24c-.4 12.8-.8 25.9-1.9 39.2 9.5 8.7 19.2 15.7 22.7 14.6 31.3-9.4 40.3-20.3 61.4-41.9l-9.5-26.3zM409 215v96h-96v96h-96v78.1c102.3.2 167.8 1.1 270 1.8V215h-78zM140.7 363.9c-13.6 2.5-27.8 3.3-43.44.9-10.89 37.5-26.76 74.3-48.51 102.5l38.63 15.3c27.02-37.9 36.82-70.6 53.32-118.7z"/>
    </svg>
  `,

  /** Room counter — door frame. */
  doorOpen: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 -1h-14a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1" />
      <path d="M12 4v16" /><path d="M14 12h.01" />
    </svg>
  `,

  /** Visibility — diamond pip (filled). */
  diamond: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="currentColor" stroke="none">
      <path d="M12 3l7 9l-7 9l-7 -9z" />
    </svg>
  `,

  /** Visibility — diamond pip (empty). */
  diamondEmpty: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3l7 9l-7 9l-7 -9z" />
    </svg>
  `,

  /** Scout action — spyglass (lorc, game-icons.net, CC BY 3.0). */
  binoculars: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M84.438 20.78c-.414.005-.824.01-1.25.032-2.273.113-4.742.477-7.376 1.094C65.28 24.373 52.858 31.236 42.094 42 31.33 52.763 24.467 65.186 22 75.72c-2.467 10.532-.738 18.23 3.75 22.718 3.93 3.93 10.33 5.763 18.938 4.5-1.82-5.496-1.757-11.592-.407-17.282 2.182-9.194 7.5-18.247 15.314-26.062 7.814-7.816 16.836-13.13 26.03-15.313 2.3-.544 4.695-.876 7.064-.968 3.515-.135 7.022.307 10.312 1.407 1.3-8.664-.52-15.082-4.47-19.032-3.154-3.156-7.896-4.97-14.093-4.907zm9.937 41.126c-.332-.006-.694.01-1.063.032-.98.06-2.08.23-3.343.53-5.057 1.2-11.542 4.728-17.157 10.344-5.616 5.617-9.145 12.1-10.344 17.157-1.2 5.054-.25 7.718 1.03 9l.344.343.312.406 41.344 51.25c4.423-9.226 10.846-18.254 19.03-26.44 8.186-8.183 17.214-14.607 26.44-19.03L99.72 64.156l-.407-.312-.344-.344c-.84-.84-2.273-1.552-4.595-1.594zm85.22 55.344a30.675 30.675 0 0 0-2.376.03c-2.168.115-4.54.465-7.064 1.064-10.095 2.394-22.042 9.042-32.406 19.406-10.364 10.364-17.012 22.31-19.406 32.406-2.394 10.095-.727 17.367 3.5 21.594l.344.375.312.375 3.75 4.625c.046-.207.076-.418.125-.625 3.576-15.268 12.593-30.935 26.125-44.47 13.467-13.468 29.05-22.452 44.25-26.06l-4.25-3.44-.375-.343-.375-.343c-2.774-2.775-6.828-4.448-12.156-4.594zm31.186 25.656c-2.895-.01-6.086.374-9.56 1.188-11.122 2.604-24.185 9.838-35.5 21.156-11.318 11.318-18.552 24.378-21.157 35.5-2.117 9.036-1.316 16.178 1.656 21.125l.093.156 48.375 59.94c6.217-18.252 17.894-36.74 34.218-53.064 16.332-16.33 34.835-28.003 53.094-34.22L219.75 144.5c-2.557-1.017-5.562-1.583-8.97-1.594zm99.25 65.344c-.697.007-1.41.027-2.124.063-3.814.188-7.85.798-12.125 1.812-17.098 4.056-36.72 15.005-53.686 31.97-16.965 16.963-27.913 36.586-31.97 53.686-4.055 17.102-1.384 30.74 6.94 39.064l.342.344.313.406.31.406a92.7 92.7 0 0 1 1.907-11c5.25-22.406 18.652-45.87 38.907-66.125 20.255-20.255 43.718-33.658 66.125-38.906 3.702-.87 7.4-1.513 11.06-1.907l-.436-.344-.406-.314-.344-.344c-5.853-5.852-14.346-8.918-24.813-8.812zm35.22 27.97c-4.95-.034-10.325.6-16.03 1.936-18.262 4.278-39.118 15.898-57.158 33.938-18.04 18.04-29.66 38.896-33.937 57.156-3.19 13.618-2.38 25.28 1.97 34.063l55.874 69.28c.46-3.185 1.058-6.378 1.81-9.593 6.32-26.98 22.565-55.408 47.126-79.97 24.56-24.56 52.96-40.773 79.938-47.092 2.055-.482 4.108-.89 6.156-1.25l-67.53-54.5h-.033c-5.132-2.575-11.256-3.924-18.187-3.97zm103.094 75.5c-.947.005-1.907.017-2.875.06-5.166.236-10.637 1.008-16.345 2.345-22.832 5.348-48.686 19.78-71.03 42.125-22.347 22.345-36.778 48.2-42.126 71.03-5.35 22.833-1.77 41.703 9.905 53.376 7.86 7.862 18.996 12.047 32.406 12.313a46.876 46.876 0 0 1-2-1.876c-13.45-13.452-16.224-33.735-11.5-53.906 4.726-20.172 16.757-41.163 34.908-59.313 18.15-18.15 39.172-30.213 59.343-34.938 5.044-1.18 10.086-1.898 15.033-2.093 14.84-.586 28.754 3.505 38.843 13.594a43.13 43.13 0 0 1 1.938 2.062c-.245-13.438-4.44-24.595-12.313-32.47-8.207-8.207-19.98-12.4-34.186-12.31zm8.28 47.717c-.65.005-1.3.032-1.968.063-3.564.167-7.37.687-11.375 1.625-16.024 3.754-34.44 14.003-50.374 29.938-7.822 7.822-14.263 16.238-19.25 24.687a91.23 91.23 0 0 1 5.438-5.938c17.012-17.01 38.125-24.96 53.22-21.5-5.877 2.765-11.803 6.865-17.158 12.22-16.19 16.19-21.17 37.454-11.125 47.5 7.735 7.733 22.152 6.587 35.75-1.75-3.07 4.568-6.748 9.03-10.967 13.25-18.512 18.51-41.876 26.32-57.063 20.343 7.814 6.11 19.617 7.906 34.156 4.5 16.025-3.754 34.44-14.003 50.375-29.938 15.936-15.934 26.185-34.35 29.94-50.375 3.752-16.024 1.195-28.71-6.5-36.406-5.413-5.41-13.32-8.293-23.095-8.22z"/>
    </svg>
  `,

  /** Retreat action — exit door (delapouite, game-icons.net, CC BY 3.0). */
  doorExit: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M217 28.098v455.804l142-42.597V70.697zm159.938 26.88.062 2.327V87h16V55zM119 55v117.27h18V73h62V55zm258 50v16h16v-16zm0 34v236h16V139zm-240 58.727V233H41v46h96v35.273L195.273 256zM244 232c6.627 0 12 10.745 12 24s-5.373 24-12 24-12-10.745-12-24 5.373-24 12-24zM137 339.73h-18V448h18zM377 393v14h16v-14zm0 32v23h16v-23zM32 471v18h167v-18zm290.652 0-60 18H480v-18z"/>
    </svg>
  `,

  /** Rest action — campfire (lorc, game-icons.net, CC BY 3.0). */
  campfire: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M281.53 23.438c48.44 71.504-18.447 145.556-63.655 58.968 27.295 144.502-65.22 166.347-74.75 74.75-73.554 65.057-59.358 147.17-20.438 210.75l45.844-26.344c-12.004-18.318-17.995-42.502-15.31-66.218 25.688 39.43 106.855 10.088 97.124-59.938 10.695 32.074 37.802 28.97 65.78-20.5C278.07 297.622 337.95 364.248 378.032 333.5c1.47 11.97-2.95 25.657-10.592 38.063l46.968 12.53c55.122-47.503 79.71-135.97-3.812-175.53 39.08 60.478-13.1 105.064-60.72 41.468-38.546-72.133 82.366-113.394-68.343-226.593zM173.876 48.124c-64.128 32.333-14.642 60.51-14.03 92.344 44.122-38.935-3.722-53.508 14.03-92.345zm74.47 269.094L75 416.874c2.71 18.39 8.98 34.417 18.813 48.5l92-44.063-78.688 59.875c3.39 3.38 7.033 6.62 10.938 9.75L192.78 448c-.023-.738-.06-1.475-.06-2.22 0-37.22 30.495-67.56 67.81-67.56a67.554 67.554 0 0 1 29.44 6.717c-2.323-13.414-7.28-27.104-14.72-39.28l-94.938 40.124 82.47-56.467c-4.34-4.55-9.166-8.64-14.438-12.094zm58.874 57.624c1.61 7.148 2.6 14.315 2.967 21.312l.22 3.938c11.13 12.042 17.937 28.09 17.937 45.687a66.814 66.814 0 0 1-3.813 22.25l91.345 24.376c4.642-6.327 8.588-12.768 11.844-19.375l-63.158-24.686 70.125 6.844c.866-2.948 1.61-5.923 2.22-8.938l-97.063-34.22L439 427.5c.156-5.772-.103-11.67-.813-17.72L307.22 374.845zm-46.69 22.062c-27.26 0-49.124 21.8-49.124 48.875 0 27.078 21.864 48.876 49.125 48.876 27.263 0 49.126-21.798 49.126-48.875 0-27.075-21.863-48.874-49.125-48.874zm-4.936 11.78c43.778.002 58.435 71.595 0 71.595 26.622-23.113 29.81-46.888 0-71.592zm.187 9.845c-21.616 17.916-19.304 35.177 0 51.94-42.375 0-31.745-51.94 0-51.94z"/>
    </svg>
  `,

  /** Interact/encounter — hand (lorc, game-icons.net, CC BY 3.0). */
  handClick: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M309.752 35.514c-3.784.046-7.807.454-12.004 1.082-27.198 61.067-49.85 122.007-65.45 182.775-9.293-4.313-18.634-8.57-27.962-12.845-3.95-53.137 1.876-103.13 5.33-153.757-6.696-5.06-17.54-8.82-28.596-8.98-11.573-.166-22.304 3.33-28.537 9.513-5.44 70.22-5.258 147.354 1.133 217.475 21.926 29.733 45.877 59.903 52.305 103.64l-18.49 2.716c-4.24-28.837-17.583-51.34-33.238-73.51l-7.582-10.55c-5.01-6.862-10.134-13.79-15.185-20.945-21.397-28.51-44.094-51.49-62.155-59.22-9.81-4.196-17.273-4.385-24.632-.442-6.486 3.474-13.52 11.49-20.043 25.387 53.41 51.674 70.576 104.044 82.718 138.664 5.79 16.507 11.08 31.523 21.274 47.025 15.614 23.746 49.446 42.91 84.066 49.51 34.62 6.598 68.69.712 86.87-19.833 14.36-16.227 41.232-41.87 56.195-57.787 24.524-26.085 59.485-54.964 88.597-77.248 14.556-11.142 27.62-20.598 37.197-27.178 4.79-3.29 8.68-5.848 11.612-7.625.197-.12.34-.182.527-.294 1.31-9.873-.448-20.663-4.804-29.375-4.358-8.718-10.787-14.658-17.763-17.015-35.707 21.283-70.62 44.438-103.877 75.438-5.745-7.274-11.933-14.06-18.5-20.424 30.747-58.815 69.992-107.75 114.28-150.41-1.56-9.55-7.76-19.814-16.114-27.32-8.4-7.55-18.526-11.7-25.852-11.623-45.615 46.382-85.864 96.907-117.5 154.463-6.918-4.36-14.023-8.513-21.27-12.51 18.893-64.715 42.99-126.426 73.5-184.392-12.757-15.245-25.477-23.335-42.347-24.324a52.385 52.385 0 0 0-3.7-.08z"/>
    </svg>
  `,

  /** Room type: treasure — chest. */
  treasure: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <rect x="3" y="12" width="18" height="8" rx="1" />
      <path d="M3 12a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4" />
      <path d="M12 12v3" /><circle cx="12" cy="16" r="1" />
    </svg>
  `,

  /** Room type: boss — crown. */
  crown: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z" />
    </svg>
  `,

  /** Room type: entrance — door enter. */
  doorEnter: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
      <path d="M20 12h-12l3 -3" /><path d="M11 15l-3 -3" />
    </svg>
  `,

  /** Shield — guardian school / defense. */
  shield: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
    </svg>
  `,

  /** Dagger — assassin school. */
  dagger: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 2l2 10l-2 2l-2 -2z" />
      <path d="M8 14l8 0" />
      <path d="M12 16v4" />
    </svg>
  `,

  /** Mask — infiltrator school. */
  mask: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 4c4.418 0 8 2.686 8 6s-3.582 6 -8 6s-8 -2.686 -8 -6s3.582 -6 8 -6z" />
      <circle cx="9" cy="9" r="1.5" /><circle cx="15" cy="9" r="1.5" />
    </svg>
  `,

  /** Bomb — saboteur school. */
  bomb: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="11" cy="14" r="7" />
      <path d="M14 7l2 -2" /><path d="M18 3l-1.5 1.5" />
      <path d="M18 3l0 3" /><path d="M18 3l3 0" />
    </svg>
  `,

  /** Footprints — boot prints move action (lorc, game-icons.net, CC BY 3.0). */
  footprints: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M111.512 21.176c-6.65.088-13.7 1.088-21.162 3.088-87.625 23.48-77.956 222.752-9.297 310.984l.002-.002 99.513-26.664c-3.273-35.578.003-76.04 19.313-113.947 2.605-89.97-24.095-174.31-88.368-173.46zm294.38 0c-64.273-.852-90.972 83.488-88.37 173.46 19.31 37.905 22.587 78.368 19.314 113.946l99.514 26.664.002.002c68.658-88.232 78.327-287.505-9.297-310.984-7.463-2-14.513-3-21.162-3.088zM188.878 350.06l-101.26 27.13c5.495 191.896 200.51 104.13 101.26-27.13zm139.65 0c-99.25 131.26 95.767 219.026 101.262 27.13l-101.263-27.13z"/>
    </svg>
  `,

  /** Dungeon map — treasure map (lorc, game-icons.net, CC BY 3.0). */
  dungeonMap: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M227.4 34.7c-10.1 0-20.2.2-30.2.5l6.1 65.6-61.1-62.5c-31.3 2.5-62.5 6.6-93.8 12.5l34.2 28.4-48-.6c35.1 100.2 6.9 182.6-.3 292.1L130 476.5c10-1.3 19.9-2.4 29.6-3.3l21.5-42.2 18.6 28.8 41.5-33.5.8 43c82.9-.2 157.7 9.1 235.7 7.9-28.2-73-31.2-143.6-31.9-209.2l-33.3-19.1 32.7-33.9c-.4-21.3-1.3-42-3.6-61.9l-57.4.7 50.2-41.7c-3.8-15.5-9-30.4-16.1-44.7l-29.5-23.9C335 38 281.2 34.6 227.4 34.7zm58.7 37c10.6 24.75 21.1 49.5 31.7 74.3 7.5-10.5 14.9-21 22.4-31.5 16 27.2 32 54.3 48 81.5l-16.2 9.5-33.3-56.7-42.5 59.4-15.2-10.9 24-33.5-21.9-51.5-24.6 40.1 12 22.6-16.5 8.8-18.3-34.5-24.8 58.2-17.2-7.4 32.5-76.2 7.7-18c4.8 9.2 9.6 18.3 14.5 27.4 12.5-20.6 25.1-41.11 37.7-61.6zM91.2 128c6.72 1.6 13.4 3.4 19.2 5.3-2.1 5.9-4.1 11.8-6.2 17.6-5.79-1.6-11.72-3.4-16.9-4.7 1.39-6 2.62-12.1 3.9-18.2zm37.9 13.4c6.3 3.8 12 7.2 17 12.8L132.6 167c-4-3.7-8.6-7-12.8-9.4zm28.7 32.3c2.1 7.4 2.1 15.7 1.6 22.5l-18.5-2.4c.1-5.1.3-10-1-14.5zm-21.2 35.7 17.2 7.1c-3.3 6.6-5.1 12.7-8.6 17.8l-16.3-9c2.6-5.4 5.6-10.8 7.7-15.9zm-16.5 34.1 17.7 6.1c-1.5 5.4-3 11.2-3.6 16.2l-18.6-2c1.3-7.5 2.1-14 4.5-20.3zm207.8 17.4c8.5 1 14.6 3 21.7 7.1l-9.8 16c-4.1-2.8-9.4-3.8-13.5-4.5zm-21.2 1.5c1.1 6.1 2.5 12.2 3.9 18.3-5.9 1.3-11.7 3.3-16.5 5.1l-6.8-17.4c6.7-2.4 13.5-4.7 19.4-6zm-37.9 15.9 11 15.1c-5.6 4-11.8 7.8-16.8 10.6l-8.9-16.4c5.1-2.9 10.6-6.3 14.7-9.3zM135.3 281c1.5 4.7 4.2 9.2 6.9 12.1l-13.8 12.6c-5.5-5.7-9.5-13.5-11.2-20.1zm230.3 3.3c3.5 6.4 6.8 12.7 8.7 19.1l-17.8 5.6c-2-5.4-4.3-10.8-6.8-14.8zm-127.4 10.9 6.9 17.3c-6.4 2.7-12.9 4.8-18.6 6.5l-5-18c5.9-1.6 11.3-3.8 16.7-5.8zm-83.8 6.2c5.3 1.7 10.8 3.4 15.7 4.2-1.2 6.1-2 12.3-2.8 18.5-7-1-14.5-3.3-20.5-5.7zm50 3.5 2.8 18.5c-7.2 1.3-13.4 1.6-19.8 1.9l-.4-18.7c5.9-.2 11.6-.8 17.4-1.7zm174.5 18c1 6.4 1.6 12.9 2.2 19.3l-18.7 1.5c-.4-6-.9-11.9-2-17.8zm-67.6 30.8c18.9 3.5 44.9 16.2 68.9 33.9 7.4-9.9 14.4-20.4 21.3-31.1l30.1 12.9c-4.7 12.3-15 25.6-28.6 37.2 17 16.2 30.9 34.5 37 53-13.8-18.1-31.1-31.8-50.3-42.8-23.4 15.8-52.7 25.9-79.6 20.4 22.9-4.4 40.6-16.6 55.8-32.6-16.5-7.5-33.8-13.9-51.3-20.1z"/>
    </svg>
  `,

  /** Room type: elite combat — skull with lightning. */
  skullBolt: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M12 4a7 7 0 0 1 7 7c0 2.5 -1.5 4.5 -3.5 5.5v1.5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-1.5c-2 -1 -3.5 -3 -3.5 -5.5a7 7 0 0 1 7 -7z" />
      <path d="M10 20h4" /><path d="M12 4l-1 4h2l-1 4" />
    </svg>
  `,

  /** Room type: encounter/event — question mark in circle. */
  questionCircle: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 17l0 .01" />
      <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -2.5" />
    </svg>
  `,

  // ── Dungeon Map Node Icons (filled, game-icons.net, CC BY 3.0) ──────────
  // viewBox 0 0 512 512, fill-only. Optimized for 20×20px rendering in map nodes.
  // Attribution: game-icons.net contributors (lorc, delapouite, skoll).

  /** Map node: combat — crossed swords (lorc). */
  mapCombat: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906 200.56 200.53a402.965 402.965 0 0 1-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z"/>
    </svg>
  `,

  /** Map node: treasure — open chest (skoll). */
  mapTreasure: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M410.365 101.005c8.21-22.26 16.21-31.12 20.33-34.45 3.06-2.48 5.73-3.42 7.92-2.81 4 1.13 8.49 7.45 11.88 16.89 10.89 30.34 10 84.28-.93 129.51zm-286 72.92c7.52-31 10.28-66.13 7.77-94.92l-43.6-4.86zm289.46-113-301.2-33.53c-2.5-.28-5.24 1.46-7.11 3-3.67 3-10.42 10.32-17.66 27.64l308.68 34.34c5.16-13.25 11.02-23.89 17.31-31.43zm-228.78 298.71v-70.72l10.76 1.19 42.24 5.18v70.51zm16-40.34a13 13 0 0 0 5.34 10.29l-2.34 24.42 17 1.74-4-25a9.54 9.54 0 0 0 5-9.15 13.64 13.64 0 0 0-11.06-12.59s.17.1.13.1c-5.95-.68-11.07 3.9-10.07 10.1zm53 64.45-85-9.84v-86.72l-1.05-.09a8.14 8.14 0 0 1-7.27 6.71 8 8 0 0 1 5.23 8.9 8 8 0 0 1-8 6.66c8.453 4.004 4.341 16.778-4.86 15.1a8 8 0 0 1-8 13.8 8.01 8.01 0 0 1-12.28 10.29v.09a8 8 0 0 1-3.86 8.37l9.13 5.35v14.25l-12 7.13-12-7.12v-14.26l8.15-4.82a8.21 8.21 0 0 1-5.07-5.92.418.418 0 0 1 0-.1 8 8 0 0 1-15.18-5c-6.851 7.214-18.094-2.065-12.31-10.16-8.346 4.519-16.217-6.676-9.14-13-9.17 2.661-14.453-10.083-6.09-14.69a8 8 0 0 1-3.21-15.67c-9.294-1.047-9.548-14.463-.3-15.86-.669-.164-1.264-.473-1.83-.76l-17.24-1.86.6 167.11 309.18 34.49-.6-165.83-107-13.05zm140.06-164 4.72 1.91.91.58 38.72 4.31-23.26-64.77-12.82 37c-.16.46-3.41 9.8-8.27 20.99zm-208.54-39.74 5 5.49 12.75-11.15 21.45-2.28 16.61 15.35 10.51 8.73 18.54-9.29 3.44.5c.12-.67.25-1.34.38-2 3.08-16.1 7.35-30.16 7.53-30.75l13.39-43.91 16.88 42.71 8.42 21.42 10.66-12.39 22.14-25.73 5.78 33.45 3.29 19.1 17.1-9.64 35.09-19.79-18.48-51.4-247.86-27.61c2.51 34.94-1.85 77.32-12.39 112h2.32l7-12.86h40.46zm-111.29 97.39c7.6 2.1 7.9 12.766.43 15.29 7.737.867 9.802 11.153 3 14.94 7.653-.548 11.614 8.947 5.84 14 7.313-2.115 13.168 6.216 8.7 12.38 6.288-3.518 13.657 2.417 11.56 9.31 4.53-4.723 12.506-2.304 13.65 4.14 2.057-5.713 9.48-7.141 13.51-2.6-1.285-6.404 5.23-11.566 11.17-8.85-4.564-5.77.425-14.123 7.67-12.84-6.419-4.541-3.122-14.648 4.74-14.53-7.316-3.503-5.375-14.415 2.7-15.18a8 8 0 0 1-5.38-8l-76.43-8.26c-.41.19-.746.15-1.16.2zm367.54 139.08-.59-163.86-8.67 7-55.51 46.79.58 162zm-26.23-165.2-24.11-15.27-4.18-1.69c-5.91 11.52-13.39 23-22.66 27.88-5.44 2.88-12.22 4.34-20.16 4.34-11.13 0-24.75-2.91-37.35-8-10-4-23.3-11-30.26-21.34-4.9-7.29-6.64-17.77-5.31-32.92l-21.78 10.93-19-15.8-11.42-10.53-9.16 1-20.45 17.83-11-11.7h-24.21l-17.61 32-5.7-7.2-4.42 4.85-10.76 16.35-12.29 4.91L97.611 256h-12.2l-2.776 6.005 76.9 8.21a8.15 8.15 0 0 1 2-2.9 8 8 0 0 1 10.31-.46 1.657 1.657 0 0 1-.14-.24c-4.955-8.368 6.459-16.62 12.87-9.375 6.412 7.245-3.167 17.571-10.87 11.635a8 8 0 0 1 1.12 2.89l22.62 2.44 168.54 20.57 51.49-43.38zm-28.34-57.73-36.88 20.79-7.14-41.47-28 32.51-18.13-46.11s-16.65 54.58-7 69c7.69 11.45 35.42 22.25 54.33 22.25 5 0 9.43-.76 12.67-2.48 13.8-7.31 30.15-54.49 30.15-54.49zm-317.08 270.8v-.2c0-3.77-8.21-6.83-18.33-6.83-10.12 0-18.33 3.06-18.33 6.83 0 3.21 6 5.9 14 6.63v.2c0 3.77 8.21 6.83 18.33 6.83 10.12 0 18.33-3.06 18.33-6.83-.01-3.21-5.98-5.9-14-6.63zm350 6.63c-10.13 0-18.33 3.06-18.33 6.83s8.21 6.83 18.33 6.83c10.12 0 18.33-3.06 18.33-6.83s-8.25-6.8-18.38-6.8zm40-16.28c-10.13 0-18.33 3.06-18.33 6.83s8.21 6.83 18.33 6.83c10.12 0 18.33-3.06 18.33-6.83s-8.22-6.83-18.34-6.83z"/>
    </svg>
  `,

  /** Map node: boss — crowned skull (lorc). */
  mapBoss: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="m92.406 13.02-.164 156.353c3.064.507 6.208 1.38 9.39 2.627 36.496 14.306 74.214 22.435 111.864 25.473l43.402-60.416 42.317 58.906c36.808-4.127 72.566-12.502 105.967-24.09 3.754-1.302 7.368-2.18 10.818-2.6l1.523-156.252-75.82 95.552-34.084-95.55-53.724 103.74-53.722-103.74-35.442 95.55-72.32-95.55h-.006zm164.492 156.07-28.636 39.86 28.634 39.86 28.637-39.86-28.635-39.86zM86.762 187.55c-2.173-.08-3.84.274-5.012.762-2.345.977-3.173 2.19-3.496 4.196-.645 4.01 2.825 14.35 23.03 21.36 41.7 14.468 84.262 23.748 126.778 26.833l-17.75-24.704c-38.773-3.285-77.69-11.775-115.5-26.596-3.197-1.253-5.877-1.77-8.05-1.85zm333.275.19c-2.156.052-5.048.512-8.728 1.79-33.582 11.65-69.487 20.215-106.523 24.646l-19.264 26.818c40.427-2.602 80.433-11.287 119.22-26.96 15.913-6.43 21.46-17.81 21.36-22.362-.052-2.276-.278-2.566-1.753-3.274-.738-.353-2.157-.71-4.313-.658zm-18.117 47.438c-42.5 15.87-86.26 23.856-130.262 25.117l-14.76 20.547-14.878-20.71c-44.985-1.745-89.98-10.23-133.905-24.306-12.78 28.51-18.94 61.14-19.603 93.44 37.52 17.497 62.135 39.817 75.556 64.63C177 417.8 179.282 443.62 174.184 467.98c7.72 5.007 16.126 9.144 24.98 12.432l5.557-47.89 18.563 2.154-5.935 51.156c9.57 2.21 19.443 3.53 29.377 3.982v-54.67h18.69v54.49c9.903-.638 19.705-2.128 29.155-4.484l-5.857-50.474 18.564-2.155 5.436 46.852c8.747-3.422 17.004-7.643 24.506-12.69-5.758-24.413-3.77-49.666 9.01-72.988 13.28-24.234 37.718-46 74.803-64.29-.62-33.526-6.687-66.122-19.113-94.23zm-266.733 47.006c34.602.23 68.407 12.236 101.358 36.867-46.604 33.147-129.794 34.372-108.29-36.755 2.315-.09 4.626-.127 6.933-.11zm242.825 0c2.307-.016 4.617.022 6.93.11 21.506 71.128-61.684 69.903-108.288 36.757 32.95-24.63 66.756-36.637 101.358-36.866zM255.164 332.14c11.77 21.725 19.193 43.452 25.367 65.178h-50.737c4.57-21.726 13.77-43.45 25.37-65.18z"/>
    </svg>
  `,

  /** Map node: entrance — dungeon gate (delapouite). */
  mapEntrance: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="m193.571 26.027 35.192 83.99c14.877 7.658 33.121 6.696 47.488-1.279l40.283-85.976c-45.582-7.268-84.512-4.945-122.963 3.265zm137.3 7.606-32.038 71.38c12.536 12.349 37.237 18.872 47.033 15.448l31.172-64.691c-12.422-8.392-27.428-15.886-46.168-22.137zm-154.86-1.97c-21.814 6.55-40.982 16.35-56.099 28.591 14.941 15.844 28.861 34.184 38.194 52.832 24.477 6.133 35.479-6.849 47.475-18.55zm-74.245 34.831c-36.541 32.91-66.523 76.42-78.068 125.215l65.957 3.353c12.006-30.53 24.552-56.284 54.231-72.755-9.883-20.24-23.626-39.403-42.12-55.813zm292.503-.29-31.852 61.044c32.54 21.007 43.572 41.348 52.597 69l72.464-8.43c-9.612-55.894-42.206-107.047-93.209-121.614zm-52.233 137.2c4.757 12.937-15.842 29.7-9.07 39.428-4.011.85-8.874 1.642-14.385-8.957-1.126 12.49 2.172 19.603 12.168 29.209-2.682.783-8.045 2.75-12.08.566-1.24 7.386 10.867 13.863 20.725 14.832l8.392-2.175c-6.09-1.106-7.881-3.315-10.627-6.13 2.97-1.32 12.554-7.117 2.149-14.751 12.634-2.752 6.035-14.89 4.14-21.862 7.525 7.798 15.243 22.54 21.862 7.084 4.176 12.604 6.561 12.12 13.614 9.107 1.054 9.196-2.957 14.791-8.792 22.518l12.494-4.992c6.018-5.026 20.16-25.502 6.428-35.5 2.603 12.443-5.563 14.388-18.672-10.937-4.377 30.773-12.236-7.49-28.346-17.44zm-321.668 2.108v66.242l72.842-11.858 1.592-49.873zm143.486.363c3.732 8.72-14.487 45.226-18.865 14.453-13.109 25.325-23.908 24.26-21.304 11.817-13.732 9.998-1.347 33.458 4.671 38.484l11.229 3.001c-5.835-7.727-11.565-13.614-10.512-22.81 7.053 3.013 10.492 5.604 14.668-7 6.618 15.456 17.32-4.378 24.846-12.175-1.554 11.494-6.282 22.427 7.303 25.197-9.13 10.082 1.899 19.99-12.694 22.812l8.393 2.176c9.857-.97 20.385-10.606 19.144-17.992-4.035 2.183-7.818 3.376-10.5 2.594 9.996-9.607 10.662-21.46 9.536-33.95-5.511 10.6-7.917 11.738-11.752 13.698 6.77-9.728-5.927-32.285-14.163-40.305zm327.512 1.172-77.57 5.687 1.156 79.192 75.524 2.842zM98.313 279.81l-79.955 9.779 1.202 99.754 83.54 1.152zm280.659 7.347-28.332 7.031 21.455 68.315 16.125-5.043zm-246.961 3.348-9.248 70.303 16.125 5.043 21.455-68.315zM412.269 310.3v83.58l79.166-8.031 2.289-75.55zm84.605 91.656-88.934 9.947-1.16 80.727 90.674.586zm-395.822 2.002-81.848 2.322-4.658 86.184h90z"/>
    </svg>
  `,

  /** Map node: exit — exit door (delapouite). */
  mapExit: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true" fill="currentColor">
      <path d="M217 28.098v455.804l142-42.597V70.697zm159.938 26.88.062 2.327V87h16V55zM119 55v117.27h18V73h62V55zm258 50v16h16v-16zm0 34v236h16V139zm-240 58.727V233H41v46h96v35.273L195.273 256zM244 232c6.627 0 12 10.745 12 24s-5.373 24-12 24-12-10.745-12-24 5.373-24 12-24zM137 339.73h-18V448h18zM377 393v14h16v-14zm0 32v23h16v-23zM32 471v18h167v-18zm290.652 0-60 18H480v-18z"/>
    </svg>
  `,

  /** Map node: fog/unknown — question mark in void. */
  mapUnknown: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="currentColor" stroke="none">
      <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 .55.45 1 1 1s1-.45 1-1C8.5 7.57 10.07 6 12 6s3.5 1.57 3.5 3.5c0 1.58-1.06 2.56-2.38 3.18C11.78 13.36 11 14.49 11 16v.5c0 .55.45 1 1 1s1-.45 1-1V16c0-.64.42-1.12 1.38-1.62C15.9 13.58 17.5 12.09 17.5 9.5 17.5 6.46 15.04 4 12 4zm0 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
    </svg>
  `,

  /** Map node: threshold — doorway (lorc, game-icons.net, CC BY 3.0). */
  mapThreshold: (size = 20) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true"
      fill="currentColor" stroke="none">
      <path d="m208.7 22.36 22.4 77.23c8.9-1.66 18.1-2.49 27.6-2.49 8.5 0 16.8.68 24.9 2.02l22.2-76.76zm103.1 46.26-10 34.78c15.2 4.8 29.1 12.3 40.8 22.7l25.5-23.8c-16-14.79-35.1-26.35-56.3-33.68zm-108.9.86c-21 7.67-39.9 19.61-55.6 34.72l25.5 23.8c.1-.1.2-.3.4-.4 11.4-10.6 24.9-18.3 39.8-23.4zM97.56 83.35 59.71 139l86.09 30.1c3.7-10 8.6-19.1 14.5-27.1zm318.24 0-60.3 56.35c6.4 8.2 11.7 17.6 15.7 28.1l82.4-28.8zM268 116v317.5h93.4V218.6c0-35.3-11.5-60.4-29.8-77.3-16.2-15-38.3-23.6-63.6-25.3zm-18.6 0c-25.2 1.7-47.3 10.3-63.6 25.3-18.2 16.8-29.7 42-29.7 77.3v214.9h93.3zm163 57.3-35.8 12.5c2.2 10.2 3.4 21.1 3.4 32.8v9.3h38.9v-9.3c0-15.8-2.3-31-6.5-45.3zM105 174.7c-3.9 13.9-6.05 28.6-6.05 43.9v9.3h38.55v-9.3c0-11.2 1.1-21.7 3.1-31.4zm-39.3 71.8v56.2h71.8v-56.2zm314.3 0v56.2h66v-56.2zM98.95 321.3v37.5h38.55v-37.5zm281.05 0v37.5h38.9v-37.5zM56.16 377.4v56.1h81.34v-56.1zm323.84 0v56.1h75.8v-56.1zm-233.3 74.7-39.6 37.5h297.4l-33-37.5z"/>
    </svg>
  `,

  /** Volume — speaker with sound waves (audio on). */
  volume: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M15 8a5 5 0 0 1 0 8" />
      <path d="M17.7 5a9 9 0 0 1 0 14" />
      <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
    </svg>
  `,

  /** Volume off — speaker muted. */
  volumeOff: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
      <path d="M16 10l4 4m0 -4l-4 4" />
    </svg>
  `,

  /** Copy to clipboard — Platform Chrome Tier 1. */
  copy: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
      <path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  `,

  /** Thumbs up — Platform Chrome Tier 1. */
  thumbsUp: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" />
    </svg>
  `,

  /** Thumbs down — Platform Chrome Tier 1. */
  thumbsDown: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M17 13v-8a1 1 0 0 0 1 -1h2a1 1 0 0 0 1 1v7a1 1 0 0 0 -1 1h-3a4 4 0 0 1 -4 4v1a2 2 0 0 0 -4 0v-5h-3a2 2 0 0 1 -2 -2l1 -5a2 3 0 0 1 2 -2h7a3 3 0 0 1 3 3" />
    </svg>
  `,

  /** Refresh/regenerate — Platform Chrome Tier 1. */
  refresh: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
    </svg>
  `,

  /** Bookmark — Platform Chrome Tier 1. */
  bookmark: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" />
    </svg>
  `,

  /** Link — Platform Chrome Tier 1. */
  link: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 15l6 -6" />
      <path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" />
      <path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" />
    </svg>
  `,

  /** Smile/emoji — Platform Chrome Tier 1. */
  smile: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="10" x2="9.01" y2="10" />
      <line x1="15" y1="10" x2="15.01" y2="10" />
      <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
    </svg>
  `,

  /** Pin — Platform Chrome Tier 1. Migrated from ChatWindow inline. */
  pin: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
      <line x1="12" y1="16" x2="12" y2="21" />
      <line x1="8" y1="4" x2="16" y2="4" />
    </svg>
  `,

  /** User plus (add agent) — Platform Chrome Tier 1. Migrated from ChatWindow inline. */
  userPlus: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h3" />
      <line x1="19" y1="14" x2="19" y2="20" />
      <line x1="16" y1="17" x2="22" y2="17" />
    </svg>
  `,

  /** Download/export — Platform Chrome Tier 1. Chat export actions. */
  download: (size = 14) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="12" y1="4" x2="12" y2="16" />
    </svg>
  `,

  discordOAuth: (size = 18) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  `,

  // ── Achievement badge icons (game-icons.net, CC BY 3.0) ──────────────
  // Silhouette-style fill icons for hexagonal badge display.
  // Attribution: game-icons.net — Lorc, Delapouite, and contributors.

  /** Badge: Field Agent — spy silhouette. */
  badgeSpy: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M218 19c-1 0-2.76.52-5.502 3.107c-2.742 2.589-6.006 7.021-9.191 12.76c-6.37 11.478-12.527 28.033-17.666 45.653c-4.33 14.844-7.91 30.457-10.616 44.601c54.351 24.019 107.599 24.019 161.95 0c-2.706-14.144-6.286-29.757-10.616-44.601c-5.139-17.62-11.295-34.175-17.666-45.653c-3.185-5.739-6.45-10.171-9.191-12.76C296.76 19.52 295 19 294 19c-6.5 0-9.092 1.375-10.822 2.85c-1.73 1.474-3.02 3.81-4.358 7.34s-2.397 8.024-5.55 12.783C270.116 46.73 263.367 51 256 51c-7.433 0-14.24-4.195-17.455-8.988c-3.214-4.794-4.26-9.335-5.576-12.881s-2.575-5.867-4.254-7.315C227.035 20.37 224.5 19 218 19m-46.111 124.334c-1.41 9.278-2.296 17.16-2.57 22.602c6.61 5.087 17.736 10.007 31.742 13.302C217.18 183.031 236.6 185 256 185s38.82-1.969 54.94-5.762c14.005-3.295 25.13-8.215 31.742-13.302c-.275-5.443-1.161-13.324-2.57-22.602c-55.757 23.332-112.467 23.332-168.223 0M151.945 155.1c-19.206 3.36-36.706 7.385-51.918 11.63c-19.879 5.548-35.905 11.489-46.545 16.57c-5.32 2.542-9.312 4.915-11.494 6.57c-.37.28-.247.306-.445.546c.333.677.82 1.456 1.73 2.479c1.973 2.216 5.564 4.992 10.627 7.744c10.127 5.504 25.944 10.958 45.725 15.506C139.187 225.24 194.703 231 256 231s116.813-5.76 156.375-14.855c19.78-4.548 35.598-10.002 45.725-15.506c5.063-2.752 8.653-5.528 10.627-7.744c.91-1.023 1.397-1.802 1.73-2.479c-.198-.24-.075-.266-.445-.547c-2.182-1.654-6.174-4.027-11.494-6.568c-10.64-5.082-26.666-11.023-46.545-16.57c-15.212-4.246-32.712-8.272-51.918-11.631c.608 5.787.945 10.866.945 14.9v3.729l-2.637 2.634c-10.121 10.122-25.422 16.191-43.302 20.399C297.18 200.969 276.6 203 256 203s-41.18-2.031-59.06-6.238s-33.182-10.277-43.303-20.399L151 173.73V170c0-4.034.337-9.113.945-14.9m1.094 88.205C154.558 308.17 200.64 359 256 359s101.442-50.83 102.96-115.695a749 749 0 0 1-19.284 2.013c-1.33 5.252-6.884 25.248-15.676 30.682c-13.61 8.412-34.006 7.756-48 0c-7.986-4.426-14.865-19.196-18.064-27.012c-.648.002-1.287.012-1.936.012c-.65 0-1.288-.01-1.936-.012c-3.2 7.816-10.078 22.586-18.064 27.012c-13.994 7.756-34.39 8.412-48 0c-8.792-5.434-14.346-25.43-15.676-30.682a749 749 0 0 1-19.285-2.013M137.4 267.209c-47.432 13.23-77.243 32.253-113.546 61.082c42.575 4.442 67.486 21.318 101.265 48.719l16.928 13.732l-21.686 2.211c-13.663 1.393-28.446 8.622-39.3 17.3c-5.925 4.738-10.178 10.06-12.957 14.356c44.68 5.864 73.463 10.086 98.011 20.147c18.603 7.624 34.81 18.89 53.737 35.781l5.304-23.576c-1.838-9.734-4.134-19.884-6.879-30.3c-5.12-7.23-9.698-14.866-13.136-22.007C201.612 397.326 199 391 199 384c0-3.283.936-6.396 2.428-9.133a480 480 0 0 0-6.942-16.863c-29.083-19.498-50.217-52.359-57.086-90.795m237.2 0c-6.87 38.436-28.003 71.297-57.086 90.795a481 481 0 0 0-6.942 16.861c1.493 2.737 2.428 5.851 2.428 9.135c0 7-2.612 13.326-6.14 20.654c-3.44 7.142-8.019 14.78-13.14 22.01c-2.778 10.547-5.099 20.82-6.949 30.666l5.14 23.42c19.03-17.01 35.293-28.338 53.974-35.994c24.548-10.06 53.33-14.283 98.011-20.147c-2.78-4.297-7.032-9.618-12.957-14.355c-10.854-8.679-25.637-15.908-39.3-17.3l-21.686-2.212l16.928-13.732c33.779-27.4 58.69-44.277 101.265-48.719c-36.303-28.829-66.114-47.851-113.546-61.082M256 377c-8 0-19.592.098-28.234 1.826c-4.321.864-7.8 2.222-9.393 3.324c-1.592 1.103-1.373.85-1.373 1.85s1.388 6.674 4.36 12.846c2.971 6.172 7.247 13.32 11.964 19.924s9.925 12.699 14.465 16.806c4.075 3.687 7.842 5.121 8.211 5.377c.37-.256 4.136-1.69 8.21-5.377c4.54-4.107 9.749-10.202 14.466-16.806s8.993-13.752 11.965-19.924S295 385 295 384s.22-.747-1.373-1.85c-1.593-1.102-5.072-2.46-9.393-3.324C275.592 377.098 264 377 256 377m0 61.953c-.042.03-.051.047 0 .047s.042-.018 0-.047m-11.648 14.701L235.047 495h41.56l-9.058-41.285C264.162 455.71 260.449 457 256 457c-4.492 0-8.235-1.316-11.648-3.346"/>
    </svg>
  `,

  /** Badge: Into the Depths — dungeon gate. */
  badgeDungeonGate: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="m193.571 26.027l35.192 83.99c14.877 7.658 33.121 6.696 47.488-1.279l40.283-85.976c-45.582-7.268-84.512-4.945-122.963 3.265m137.3 7.606l-32.038 71.38c12.536 12.349 37.237 18.872 47.033 15.448l31.172-64.691c-12.422-8.392-27.428-15.886-46.168-22.137zm-154.86-1.97c-21.814 6.55-40.982 16.35-56.099 28.591c14.941 15.844 28.861 34.184 38.194 52.832c24.477 6.133 35.479-6.849 47.475-18.55zm-74.245 34.831c-36.541 32.91-66.523 76.42-78.068 125.215l65.957 3.353c12.006-30.53 24.552-56.284 54.231-72.755c-9.883-20.24-23.626-39.403-42.12-55.813m292.503-.29l-31.852 61.044c32.54 21.007 43.572 41.348 52.597 69l72.464-8.43c-9.612-55.894-42.206-107.047-93.209-121.614M98.313 279.81l-79.955 9.779l1.202 99.754l83.54 1.152zm280.659 7.347l-28.332 7.031l21.455 68.315l16.125-5.043zm-246.961 3.348l-9.248 70.303l16.125 5.043l21.455-68.315zM412.269 310.3v83.58l79.166-8.031l2.289-75.55zm84.605 91.656l-88.934 9.947l-1.16 80.727l90.674.586zm-395.822 2.002l-81.848 2.322l-4.658 86.184h90z"/>
    </svg>
  `,

  /** Badge: Forgemaster — anvil. */
  badgeAnvil: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M128.688 115.594v147.75h285v-147.75zm-111.844 20.47c17.374 47.14 54.372 80.413 94.906 93.81v-93.81zm414.375 12.31v88.657c21.457-9.083 42.92-25.257 64.374-47.374c-21.52-22.562-42.633-35.173-64.375-41.28zm-226.25 132.47c-12.15 38.536-33.897 71.5-60.595 100.47l257.844-.002c-28.705-29.016-49.952-62.054-61.5-100.468H204.97zM101.843 400v43.78h337.562V400z"/>
    </svg>
  `,

  /** Badge: Archetype Explorer — compass. */
  badgeCompass: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="m203.97 23l-18.032 4.844l11.656 43.468c-25.837 8.076-50.32 21.653-71.594 40.75L94.53 80.594l-13.218 13.22l31.376 31.374c-19.467 21.125-33.414 45.53-41.813 71.343l-42.313-11.343l-4.843 18.063l42.25 11.313c-6.057 27.3-6.157 55.656-.345 83L23.72 308.78l4.843 18.064l41.812-11.22a193.3 193.3 0 0 0 31.25 59.876l-29.97 52.688l-16.81 29.593l29.56-16.842l52.657-29.97a193.3 193.3 0 0 0 60.094 31.407l-11.22 41.844l18.033 4.81l11.218-41.905a195.7 195.7 0 0 0 83-.375l11.312 42.28l18.063-4.81l-11.344-42.376c25.812-8.4 50.217-22.315 71.342-41.78l31.375 31.373l13.22-13.218l-31.47-31.47a193.3 193.3 0 0 0 40.72-71.563l43.53 11.657l4.813-18.063l-43.625-11.686a195.7 195.7 0 0 0-.344-82.063l43.97-11.78l-4.813-18.063L440.908 197c-6.73-20.866-17.08-40.79-31.032-58.844l29.97-52.656l16.842-29.563l-29.593 16.844l-52.656 29.97c-17.998-13.875-37.874-24.198-58.657-30.906l11.783-44L309.5 23l-11.78 43.97c-27-5.925-55.02-6.05-82.064-.376zm201.56 85L297.25 298.313l-.75.437l-40.844-40.875l-148.72 148.72l-2.186 1.25l109.125-191.75l41.78 41.78L405.532 108zm-149.686 10.594c21.858 0 43.717 5.166 63.594 15.47l-116.625 66.342l-2.22 1.28l-1.28 2.22l-66.25 116.406c-26.942-52.04-18.616-117.603 25.03-161.25c26.99-26.988 62.38-40.468 97.75-40.468zm122.72 74.594c26.994 52.054 18.67 117.672-25.002 161.343c-43.66 43.662-109.263 52.005-161.312 25.033l116.438-66.282l2.25-1.25l1.25-2.25l66.375-116.592z"/>
    </svg>
  `,

  /** Badge: Depth Master — cave entrance. */
  badgeCave: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M346.951 24.582L299.193 72.34l-101.136-7.024l-40.97 80.737l68.688 25.35l37.153-19.936l8.511 15.861l-44.293 23.768l-79.7-29.416l-70.19 55.341l35.117 58.995l-.375.2l13.014 21.585l29.134 2.361l55.06-35.123l9.679 15.176l-60.16 38.377l-44.364-3.596l-18.23-30.234l-56.8 30.586l33.712 61.804l-33.713 40.735L18 444.177V494h170.62l-5.6-45.592a261 261 0 0 1-5.147-4.512c-4.186-3.761-5.89-5.444-8.027-7.484l-73.13 21.797l-21.339-20.484l12.467-12.985l13.777 13.225l73.068-21.78l3.784 3.667s4.24 4.09 9.216 8.636l37.797-37.248l8.133 79.54l6.3-93.444l10.364 28.387l6.281-45.112l3.14-3.091l-.29-.233l22.486-27.974l.465-.907l.188.096l11.453-14.248l14.03 11.277l-9.122 11.348l67.803 34.715l27.008-9.489l22.478 17.71l22.924-12.036l8.367 15.938l-33.262 17.46l-23.875-18.81l-24.964 8.772l-9.584-4.907l39.04 87.842L383.923 494H494v-28.512L462.713 478.2l-6.776-16.678L494 446.06V211.176l-23.438-26.463l-21.654-67.371l-33.547 32.666l-107.77-13.873l-28.019-29.096l12.967-12.486l23.629 24.539l92.867 11.953l31.442-30.615l-52.79-61.801zm27.53 177.74l34.177 41.428l28.863-6.56l-4.136-13.59l17.22-5.243l9.77 32.098l-58.543 13.307l-31.377-38.033l-33.086 19.853l-9.262-15.436z"/>
    </svg>
  `,

  /** Badge: Loot Collector — treasure chest. */
  badgeChest: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M410.365 101.005c8.21-22.26 16.21-31.12 20.33-34.45c3.06-2.48 5.73-3.42 7.92-2.81c4 1.13 8.49 7.45 11.88 16.89c10.89 30.34 10 84.28-.93 129.51zm-286 72.92c7.52-31 10.28-66.13 7.77-94.92l-43.6-4.86zm289.46-113l-301.2-33.53c-2.5-.28-5.24 1.46-7.11 3c-3.67 3-10.42 10.32-17.66 27.64l308.68 34.34c5.16-13.25 11.02-23.89 17.31-31.43zm-228.78 298.71v-70.72l10.76 1.19l42.24 5.18v70.51zm16-40.34a13 13 0 0 0 5.34 10.29l-2.34 24.42l17 1.74l-4-25a9.54 9.54 0 0 0 5-9.15a13.64 13.64 0 0 0-11.06-12.59s.17.1.13.1c-5.95-.68-11.07 3.9-10.07 10.1zm53 64.45l-85-9.84v-86.72l-1.05-.09a8.14 8.14 0 0 1-7.27 6.71a8 8 0 0 1 5.23 8.9a8 8 0 0 1-8 6.66c8.453 4.004 4.341 16.778-4.86 15.1a8 8 0 0 1-8 13.8a8.01 8.01 0 0 1-12.28 10.29v.09a8 8 0 0 1-3.86 8.37l9.13 5.35v14.25l-12 7.13l-12-7.12v-14.26l8.15-4.82a8.21 8.21 0 0 1-5.07-5.92a.4.4 0 0 1 0-.1a8 8 0 0 1-15.18-5c-6.851 7.214-18.094-2.065-12.31-10.16c-8.346 4.519-16.217-6.676-9.14-13c-9.17 2.661-14.453-10.083-6.09-14.69a8 8 0 0 1-3.21-15.67c-9.294-1.047-9.548-14.463-.3-15.86c-.669-.164-1.264-.473-1.83-.76l-17.24-1.86l.6 167.11l309.18 34.49l-.6-165.83l-107-13.05zm140.06-164l4.72 1.91l.91.58l38.72 4.31l-23.26-64.77l-12.82 37c-.16.46-3.41 9.8-8.27 20.99zm-208.54-39.74l5 5.49l12.75-11.15l21.45-2.28l16.61 15.35l10.51 8.73l18.54-9.29l3.44.5c.12-.67.25-1.34.38-2c3.08-16.1 7.35-30.16 7.53-30.75l13.39-43.91l16.88 42.71l8.42 21.42l10.66-12.39l22.14-25.73l5.78 33.45l3.29 19.1l17.1-9.64l35.09-19.79l-18.48-51.4l-247.86-27.61c2.51 34.94-1.85 77.32-12.39 112h2.32l7-12.86h40.46zm-111.29 97.39c7.6 2.1 7.9 12.766.43 15.29c7.737.867 9.802 11.153 3 14.94c7.653-.548 11.614 8.947 5.84 14c7.313-2.115 13.168 6.216 8.7 12.38c6.288-3.518 13.657 2.417 11.56 9.31c4.53-4.723 12.506-2.304 13.65 4.14c2.057-5.713 9.48-7.141 13.51-2.6c-1.285-6.404 5.23-11.566 11.17-8.85c-4.564-5.77.425-14.123 7.67-12.84c-6.419-4.541-3.122-14.648 4.74-14.53c-7.316-3.503-5.375-14.415 2.7-15.18a8 8 0 0 1-5.38-8l-76.43-8.26c-.41.19-.746.15-1.16.2m367.54 139.08l-.59-163.86l-8.67 7l-55.51 46.79l.58 162zm-26.23-165.2l-24.11-15.27l-4.18-1.69c-5.91 11.52-13.39 23-22.66 27.88c-5.44 2.88-12.22 4.34-20.16 4.34c-11.13 0-24.75-2.91-37.35-8c-10-4-23.3-11-30.26-21.34c-4.9-7.29-6.64-17.77-5.31-32.92l-21.78 10.93l-19-15.8l-11.42-10.53l-9.16 1l-20.45 17.83l-11-11.7h-24.21l-17.61 32l-5.7-7.2l-4.42 4.85l-10.76 16.35l-12.29 4.91L97.611 256h-12.2l-2.776 6.005l76.9 8.21a8.15 8.15 0 0 1 2-2.9a8 8 0 0 1 10.31-.46a2 2 0 0 1-.14-.24c-4.955-8.368 6.459-16.62 12.87-9.375c6.412 7.245-3.167 17.571-10.87 11.635a8 8 0 0 1 1.12 2.89l22.62 2.44l168.54 20.57l51.49-43.38zm-28.34-57.73l-36.88 20.79l-7.14-41.47l-28 32.51l-18.13-46.11s-16.65 54.58-7 69c7.69 11.45 35.42 22.25 54.33 22.25c5 0 9.43-.76 12.67-2.48c13.8-7.31 30.15-54.49 30.15-54.49"/>
    </svg>
  `,

  /** Badge: Master Strategist — chess queen. */
  badgeChessQueen: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M477.518 181.966a25 25 0 0 1-34.91 23l-62.29 150.26h-248.92l-62.24-150.19a25 25 0 1 1 9.73-7.29l87 71.2l20.92-126.4a25 25 0 1 1 14.7-1.85l54.31 117l54.42-117.3a25 25 0 1 1 14.58 2.08l20.93 126.42l87.26-71.3a25 25 0 1 1 44.51-15.63m-71.66 241.25h-300v60h300zm-27.75-52h-244.22v36h244.22z"/>
    </svg>
  `,

  /** Badge: Undefeated — ghost. */
  badgeGhost: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M373.688 22.063c-1.245-.014-2.498 0-3.75.03c-31.364.748-65.528 15.414-96.938 47.313c-88.264 89.642-154.092 171.18-242.938 174.03c23.65 18.21 54.87 31.21 85.25 36.783c-24.375 29.26-50.877 47.65-93.437 64.842c37.915 9.124 74.452 6.5 109.813-2.343c-27.29 34.35-62.118 65.85-107.47 95.78c60.376-.392 136.226-12.138 181.626-47.906c-4.842 30.69-16.186 65.125-43.22 100.47c70.74-18.73 117.115-42.386 146.595-83.533c2.905 27.513-.94 45.098-11.095 80.595c78.006-66.3 150.857-164.775 182.78-270.97C513.44 108.94 452.066 22.89 373.69 22.063zM371.03 96.47c5.76 0 11.1 1.732 15.564 4.686c-7.706.283-13.875 6.6-13.875 14.375c0 7.956 6.45 14.407 14.405 14.407c5.118 0 9.6-2.665 12.156-6.687c.028.503.033 1.022.033 1.53c0 15.633-12.648 28.314-28.282 28.314c-15.632 0-28.31-12.68-28.31-28.313c0-15.63 12.678-28.31 28.31-28.31zm67.376 34.874a28.2 28.2 0 0 1 12.438 2.875c-5.734 1.9-9.875 7.284-9.875 13.655c0 7.955 6.45 14.406 14.405 14.406c4.54 0 8.547-2.093 11.188-5.374c.086.902.156 1.826.156 2.75c0 15.632-12.68 28.313-28.314 28.313c-15.633 0-28.312-12.682-28.312-28.314s12.68-28.312 28.312-28.312z"/>
    </svg>
  `,

  /** Badge: Banter Connoisseur — speech bubble. */
  badgeSpeech: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M488 348.78h-70.24l-15.1 87.44l-48.78-87.44H169v-50h190v-157h129zm-145-273v207H158.13l-48.79 87.47l-15.11-87.47H24v-207zM136.724 215.324c0-10.139-12.257-15.214-19.425-8.046s-2.093 19.426 8.046 19.426c6.285 0 11.38-5.095 11.38-11.38zm60.945 0c-.068-10.12-12.32-15.122-19.452-7.943c-7.131 7.18-2.047 19.399 8.073 19.399c6.314 0 11.422-5.141 11.38-11.456zm60.945 0c0-10.139-12.257-15.214-19.425-8.046s-2.093 19.426 8.046 19.426c6.284 0 11.38-5.095 11.38-11.38z"/>
    </svg>
  `,

  /** Badge: Echo Sender — wave crest. */
  badgeWave: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M298.844 21.47c-19.177.074-37.7 9.793-43.156 29.06c-21.613-18.783-57.038-5.957-57.97 13.907c-.397.11-.79.234-1.187.344c-12.147-4.116-20.077-.304-24.186 7.44c-18.52-14.45-44.42-1.614-51.188 19.218c-14.786-17.19-42.58 4.042-30.406 25.124c.188.327.397.63.594.938a341 341 0 0 0-14.063 11.28a51.34 51.34 0 0 0-23.56-5.155c-13.145.303-26.367 5.78-36.19 17.625v118.063c6.726 4.154 16.51 6.48 24.94 5.375a372 372 0 0 0-16.75 58.437c-.277.918-.546 1.85-.782 2.813c-.782 3.182-1.24 6.21-1.407 9.093c-9.176 55.403-5.31 111.628 13.095 161.126H56.72c-15.91-39.335-21.726-84.3-18.095-129.875c20.554 13.602 55.617 7.05 63.563-25.31c7.245-29.515-15.273-47.982-38.126-47.876c-4.062.02-8.143.638-12.062 1.875c5.06-17.025 11.418-33.773 19.063-49.94a342 342 0 0 1 19.75-36.03c13.37 8.93 38.33 6.824 41.25-21c1.343 4.814 9.112 7.514 15.656 7.438c-10.532 23.45-18.023 48.2-22.564 73.343c-8.506 47.1-6.837 95.784 4.625 140.564c-22.214 3.28-24.636 38.295 1.22 38.844c4.18.087 7.748-.735 10.72-2.188c7.164 17.84 16.073 34.685 26.686 50.156h23.156c-45.083-57.982-62.535-143.55-48-224.03c.185-1.024.4-2.042.594-3.063c12.583 16.662 30.995 16.28 44.313 7.156c.098 7.433.444 14.858 1.06 22.25c6.366 76.193 39.422 149.527 91.626 197.686h29.156c-57.272-43.11-95.5-119.53-102.156-199.22c-5.615-67.22 10.893-136.265 56.125-190.155c-22.662 48.81-28.814 101.335-22.405 152.032c-10.69 7.01-16.59 20.936-7.063 35.813c4.65 7.262 10.705 10.994 16.938 12.125a330 330 0 0 0 6.72 20.78c25.606 71.122 74.834 133.122 135.936 168.626h43.28c-69.03-26.022-128.378-90.037-158.405-166.47c12.857.64 25.67-14.788 16.658-29.686c-3.872-6.39-9.452-9.026-14.97-9c3.396-7.17 3.52-15.913-2-24.53c-4.954-7.738-11.826-11.5-18.874-12.25c-5.378-44.973-.098-91.102 18.812-134.345l.906 1.75C273.37 181.75 290.925 240.357 322.625 289c10 15.346 21.402 29.735 33.906 42.938a20 20 0 0 0-3.592-.313c-19.654.194-25.004 31.01-1.75 36.72c15.508 3.807 23.524-8.896 21.687-20.408c34.925 31.702 76.562 54.554 119.906 64.094v-19.217c-59.818-14.523-117.576-57.376-154.5-114.032c-24.12-37.01-39.39-79.608-41.092-124c4.408-66.014 98.113-44.375 115.656-5.155c-6.523-34.758-23.54-58.183-46.094-73.188c15.407-13.958-4.283-37.503-20.813-26.156c-8.08-19.323-27.917-28.886-47.093-28.81z"/>
    </svg>
  `,

  /** Badge: Ward Master — magic shield. */
  badgeWard: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M57.78 23.135c-1.517 29.085-2.193 55.608-2.266 80.316c6.56-2.716 13.703-4.333 21.228-4.333c31.245 0 56.883 25.64 56.883 56.887c0 31.246-25.777 56.3-56.883 56.3c-6.068 0-11.95-1.003-17.488-2.77C71.906 332.82 108.064 376.35 147.668 401.9c20.677 13.34 42.986 21.7 64.268 33.245c17.444 9.463 34.177 21.525 47.42 40.127c13.23-18.597 29.925-30.658 47.324-40.122c21.226-11.545 43.46-19.904 64.064-33.242c39.46-25.543 75.488-69.07 88.135-192.324c-5.32 1.708-10.974 2.723-16.907 2.723c-31.107 0-56.88-25.058-56.88-56.3c0-31.244 25.634-56.888 56.88-56.888c7.63 0 14.745 1.697 21.23 4.508c-.07-24.757-.745-51.334-2.265-80.49c-59.488 13-130.78 19.266-201.5 19.888h-.163c-70.718-.62-142.008-6.888-201.496-19.888zm304.124 39.32l-27.117 93.18l-17.945-5.22l11.504-39.532l-85.116 63.646l-11.19-14.97l129.864-97.105zm-205.394 1.01l81.732 59.512l-11 15.107l-34.338-25.004l34.79 103.514l-17.714 5.955l-53.47-159.085zm140.486 99.652l129.383 97.95l-98.25-.48l.09-18.69l42.15.208l-84.653-64.087zm-122.357 37.71l10.83 15.228l-36.206 25.754l104.898-.17l.03 18.69l-163.577.262l84.024-59.766zm117.79 21l17.806 5.675l-49.39 155.008l-31.248-96.46l17.777-5.76l13.324 41.124l31.73-99.586z"/>
    </svg>
  `,

  /** Badge: Flawless Run — sparkles. */
  badgeStar: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M237.4 20.73c-6.1 42.1-26.8 64.2-63.9 64c31.6 4.5 63.8 8 63.9 64.07c-.6-46.1 24.5-63.07 64.1-64.07c-38-1.5-64.9-16.3-64.1-64m127.8 11.58c-9.1 14.25-20.8 21.29-38.9 10.28c14.9 11.79 18.6 24.76 10.2 38.97c8.9-11.18 17.5-22.73 39-10.27c-17.8-10.06-18.8-23.57-10.3-38.98M59.68 41.69c-2.7 18.8-12 28.6-28.5 28.5c14.1 2 28.4 3.6 28.5 28.52c-.3-20.5 10.9-28.12 28.5-28.52c-16.9-.7-28.9-7.3-28.5-28.5M431 66.28c-2.7 18.8-12 28.6-28.5 28.5c14.1 2 28.4 3.6 28.5 28.52c-.3-20.5 10.9-28.12 28.5-28.52c-16.9-.7-28.9-7.3-28.5-28.5M120.3 116.4c-15.8 53.7-47.76 48-79.35 43.4C76.6 170 90.3 197.1 84.28 239.2c12.66-46 42.62-52.6 79.42-43.4c-37.6-12.1-56.9-35.4-43.4-79.4m187 5c-8.8 61.6-39.3 94-93.6 93.7c46.2 6.5 93.6 11.7 93.6 93.7c-.8-67.3 35.9-92.2 93.8-93.7c-55.5-2.2-94.9-23.9-93.8-93.7m136.8 38.3c-13.1 21.6-29.5 28.8-49.7 20.1c16.3 9.7 33 19.1 20.1 49.6c10.3-25.2 27.9-28.7 49.7-20c-20.3-9.7-31.6-23.9-20.1-49.7M50.7 243.2c9.16 16.7 7.63 30.1-5.61 40c12.46-6.9 24.85-14.3 39.91 5.6c-12.57-16.2-8.2-29 5.61-40c-13.92 9.7-27.47 11.6-39.91-5.6m137.2.3c11.4 26.8-.5 41.3-21.7 50.9c22.7-8.5 40.8-4.5 50.9 21.7c-12.7-31.8 4.8-41.2 21.7-50.9c-21 8.5-37.8.9-50.9-21.7m228 12.6c-26.6 64.7-68.7 91.7-127.8 76.4c48.6 19.8 98.8 38.5 76.4 127.9c17.5-73.7 64.4-90.7 127.9-76.5c-59.9-17.5-96.9-52-76.5-127.8M99.94 295.5c15.66 57.8.86 98.1-47.32 118.5c43.46-11.8 87.38-25.2 118.68 47.4c-26.4-59.3-3.4-95.4 47.3-118.8c-50 19.2-93.1 15-118.66-47.1m169.36 61c-21.8 20.6-43 23.6-63.2 7.3c15.5 16.3 31.6 32.4 7.2 63.3c19.8-25.6 41.2-24.1 63.3-7.3c-20.2-17.4-28.6-37.5-7.3-63.3M443.2 404c-2.7 18.8-12 28.6-28.5 28.5c14.1 2 28.4 3.6 28.5 28.5c-.3-20.5 10.9-28.1 28.5-28.5c-16.9-.7-28.9-7.3-28.5-28.5m-169.7 36c-2.7 18.8-12 28.6-28.5 28.5c14.1 2 28.4 3.6 28.5 28.5c-.3-20.5 10.9-28.1 28.5-28.5c-16.9-.7-28.9-7.3-28.5-28.5"/>
    </svg>
  `,

  /** Badge: Speed Runner — lightning. */
  badgeLightning: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M29.805 29.777L242.14 209.55H118.712l112.54 86.784H95.995l225.656 174.012l-81.537-116.05l66.487.143l179.185 138.175l-171.96-244.746h84.568L248.082 29.776z"/>
    </svg>
  `,

  /** Badge: Pacifist — dove. */
  badgeDove: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M38.643 17.275L32.215 59.47c20.354 23.085 48.127 40.682 79.195 56c-29.677-4.055-58.635-12.142-84.64-24.868c-.292 8.613-.584 26.252.896 35.58c23.024 8.994 48.88 14.026 75.95 16.728c-23.698 5.377-47.716 7.58-71.425 6.95c2.665 9.36 7.325 22.24 11.26 31.675c22.547-1.977 45.912-7.504 69.36-15.47c-18.785 14.27-39.05 26.146-60.185 35.322l28.877 30.056l17.144-9.898l-5.978 22.312c6.788 6.61 20.498 15.434 27.56 20.623l13.268-11.662l-.338 20.2c19.91 13.99 41.056 12.083 61.15 1.718c-.804 6.438-1.308 13.29-1.482 20.56C132.47 314.7 66.666 320.958 70.59 348.222l34.553 6.947l-34.108 18.04c1.503 7.398 3.84 15.003 7.73 22.677L120.1 379.56l-27.93 36.666c4.726 6.13 14.61 14.823 20.537 20.515l39.47-46.24l-17.962 63.475c6.238 4.326 19.387 9.33 26.273 12.87l43.313-71.076l-14.138 80.248c17.225 3.487 20.708 4.81 39.82 3.19l18.186-75.66l20.297 71.852c7.333-2.51 23.21-9.526 29.976-12.664l-11.794-59.3l35.372 45.14c7.232-5.076 18.943-11.587 24.316-17.328l-17.994-37.326l31.973 18.19c25.568-17.19-44.333-57.458-86.944-100.22c6.416-8.725 11.636-17.086 15.786-25.042c19.45 27.668 44.75 39.74 75.84 29.93l-1.176-21.815l16.002 14.943c7.52-4.34 15.072-10.137 22.48-16.166l-6.99-19.133l18.694 8.745c12.732-6.638 22.917-17.1 33.08-27.59c-16.19-12.562-32.92-27.903-47.49-40.242c17.74 9.162 38.718 17.52 56.892 23.95c4.27-7.49 12.045-21.063 15.463-28.7c-19.626-4.04-39.435-11.263-58.413-20.58c23.383 2.56 45.728 3.05 66.367-1.138c2.805-8.642 9.82-22.678 11.123-30.996c-23.616 6.897-49.242 8.78-74.923 7.03c28.832-9.016 55.294-21.066 75.56-39.81L485.69 93c-84.44 76.087-173.95 30.858-210.133 83.916a34.9 34.9 0 0 0-14.932-.56c-14.7-80.695-139.033-53.424-221.982-159.083zM293 226.155l-9.643 45.806l-23.623-44.347c10.196 4.382 20.545 8.023 33.266-1.457z"/>
    </svg>
  `,

  /** Badge: Mother's Embrace (secret) — heart. */
  badgeHeart: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M303.25 20.813c-19.18.348-39.962 9.117-56.5 25.656c-22.422 22.42-30.52 52.633-22.75 76.093c-65.983-30.33-59.733-32.19-123.344-73c-10.072-6.463-19.472-9.42-27.844-9.813a41 41 0 0 0-2.593-.03c-12.75.2-22.962 6.374-29.532 14.936C29.474 69.27 28.334 90.84 51.656 109.094c31.026 24.285 58.81 41.01 79 59.437c20.19 18.43 32.648 40.622 28.344 70.064c-3.158 21.608-13.658 37.998-26.438 51.47c-12.78 13.47-27.778 24.454-41.468 36.655c-27.38 24.4-50.33 51.783-45.063 114.28c3.328 39.483 34.19 55.117 59.69 52.375c12.748-1.37 23.477-7.368 29.374-17.5s7.696-25.406-1.03-47.72c-7.595-19.415 3.133-40.834 18.374-57.092c15.24-16.26 36.798-28.82 58.843-25c6.177 1.07 11.454 4.72 15.064 9.156c3.61 4.434 5.964 9.587 7.937 15.217c3.948 11.262 6.27 24.706 9.126 38.594c5.712 27.78 13.663 55.97 33.063 68.47c37.963 24.468 75.257 17.39 91.905.438c8.324-8.477 11.914-18.828 9.125-31.125c-2.79-12.298-12.677-27.19-34.25-41.875c-23.664-16.11-32.655-48.258-33.844-80.094s5.287-64.078 20.125-84.03c6.88-9.25 17.516-13.15 29.626-17.44c12.11-4.288 26.207-8.474 40.75-14.686c29.086-12.426 59.667-32.198 79.156-76.782c17.078-39.068 3.342-64.286-15.312-73.47c-9.327-4.59-20.13-5.16-30.438-.655c-10.307 4.507-20.43 14.22-27.437 31.782c-13.14 32.934-39.188 51.677-70.406 56.407c-8.096 1.225-16.526 1.577-25.22 1.155c7.504-4.07 14.71-9.367 21.25-15.906c29.4-29.402 34.242-72.228 10.844-95.626c-10.237-10.237-24.176-15.053-39.094-14.782z"/>
    </svg>
  `,

  /** Badge: Political Vertigo (secret) — revolt fist. */
  badgeRevolution: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M106 145.23c0-36.923 37.5-36.923 37.5-36.923s-18.75-23.163-18.75-36.922c0-13.76 0-18.462 18.75-36.922C162.25 16 162.25 16 181 16h150c18.75 0 42.22 19.56 56.25 36.923C398.26 66.556 406 89.845 406 101.813c0 61.88-50.018 178.424-50.018 178.424l6.137 215.197l-203.352.566L181 274.46l-37.5-36.922c-18.75-18.462-37.5-36.924-37.5-55.384z"/>
    </svg>
  `,

  /** Badge: Speed Runner — sprinting figure. */
  badgeSprint: (size = 16) => svg`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="currentColor" d="M169.53 16.344L259.345 88L337 92.28l-1.03 18.657l-161.376-8.906l-118.78-4.905l227.28 68.03l-197.72 246.75l-14.53-17.655l-49.22 96.625l248.69-202.78l51.81 11.592l-38.78 40.594L270.5 329.5l-57.28 84.125L444.843 273.47L328 241.06l100.22-81.718c1.132.46 2.3.898 3.5 1.22c23.324 6.248 49.764-16.835 59.06-51.533c9.298-34.695-2.08-67.874-25.405-74.124s-49.765 16.802-59.063 51.5a95.4 95.4 0 0 0-2.875 16.22z"/>
    </svg>
  `,
};

/** Valid icon key — use for compile-time validation of icon references. */
export type IconKey = keyof typeof icons;
