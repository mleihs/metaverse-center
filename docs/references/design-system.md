---
title: "Design System"
id: design-system
version: "1.4"
date: 2026-03-17
lang: de
type: reference
status: active
tags: [design, tokens, themes, wcag, accessibility]
---

# 12 - Design System: Komplett-Neuaufbau

---

## Analyse des Altsystems

### Aktuelle CSS-Dateien (8 Dateien, ~3.100 Zeilen)

| Datei | Zeilen | Inhalt |
|-------|--------|--------|
| `design-tokens.css` | 219 | 176 CSS Custom Properties, Dark Mode, Reduced Motion |
| `layout.css` | 602 | Reset, Container, Flex/Grid, Spacing, Sizing Utilities |
| `components.css` | 596 | Form, Table, Lightbox, Agent Cards, Notifications |
| `kitchen-sink.css` | ~800 | Testseite mit allen Komponenten |
| `interface.css` | ~400 | Spezifische Interface-Styles |
| `reactions.css` | ~200 | Event-Reactions Styles |
| `spinner.css` | ~100 | Spinner/Loading Styles |
| `tailwind.css` | ~200 | Tailwind Entry (kaum genutzt) |

**Zusatzlich:** ~86 `static styles` / `css` Deklarationen in 54 Lit-Komponenten (Shadow DOM)

### Kritische Probleme

| # | Problem | Details |
|---|---------|---------|
| D1 | **Button-Duplikation** | Buttons 4x definiert: design-tokens, components.css, action-buttons, inline in Lit-Komponenten |
| D2 | **Card-Duplikation** | Cards 3x definiert: components.css, agent-cards, inline |
| D3 | **Form-Duplikation** | Forms 3x definiert: components.css, Modals (5+ identische Kopien) |
| D4 | **Modal-Duplikation** | 2 Modal-Systeme: VelgBaseModal + lightbox-system |
| D5 | **Fehlende Gray-Stufen** | gray-400, gray-700, gray-900 fehlen |
| D6 | **Keine Semantic Colors** | Keine surface, border, text-muted, text-secondary Tokens |
| D7 | **Keine Font-Size Scale** | Font-Sizes inline hardcodiert (0.75rem, 0.875rem, 1rem, 1.1rem, 1.25rem) |
| D8 | **Keine Heading-Styles** | Keine h1-h6 Token-Definitionen |
| D9 | **Z-Index-Chaos** | Modal-Token: z-modal=1050, Inline: modal-z-index=10000 |
| D10 | **Dark Mode = Inversion** | Nur Schwarz/Weiss-Tausch, kein echtes Dark Mode |
| D11 | **Spacing-Lucken** | Scale: 1,2,3,4,6,8,12,16 - Lucken bei 5,10,20,24 |
| D12 | **2 Font-Stacks** | Brutalist #1: Courier New, #2: Arial Black (inkonsistent) |
| D13 | **Tailwind installiert, kaum genutzt** | tailwindcss v4 in package.json, fast keine Nutzung |
| D14 | **~30% hardcodierte Hex-Werte** | In Lit-Komponenten statt Design-Token-Referenzen |

---

## Neues Design System: Architektur

### Philosophie

```
1. Token-First: ALLES uber CSS Custom Properties
2. Simulation-Themeable: Jede Simulation kann Tokens uberschreiben
3. One Definition: Jede Komponente exakt einmal definiert
4. Shadow DOM Compatible: Tokens durchdringen Shadow DOM via :host
5. Accessibility: WCAG 2.1 AA als Minimum
```

### Datei-Struktur

```
styles/
├── tokens/
│   ├── _colors.css          # Farb-Palette + Semantic Colors
│   ├── _typography.css       # Font Families, Sizes, Weights, Line-Heights
│   ├── _spacing.css          # Spacing Scale
│   ├── _shadows.css          # Shadow System
│   ├── _borders.css          # Border System
│   ├── _z-index.css          # Z-Index Scale
│   ├── _animation.css        # Transitions, Animations
│   ├── _layout.css           # Container, Breakpoints
│   └── _index.css            # Alle Token-Imports
├── themes/
│   ├── _light.css            # Light Mode Token-Werte
│   ├── _dark.css             # Dark Mode Token-Werte
│   └── _simulation.css       # Simulation-Override-Mechanismus
├── base/
│   ├── _reset.css            # Modern CSS Reset
│   ├── _global.css           # Body, HTML, Links
│   └── _typography.css       # Heading Styles, Text Styles
├── components/
│   ├── _button.css           # Einheitliches Button-System
│   ├── _card.css             # Einheitliches Card-System
│   ├── _form.css             # Einheitliches Form-System
│   ├── _table.css            # Table-System
│   ├── _modal.css            # Modal-System
│   ├── _notification.css     # Toast/Notification-System
│   ├── _spinner.css          # Loading States
│   └── _nav.css              # Navigation System
├── utilities/
│   ├── _flex.css             # Flexbox Utilities
│   ├── _grid.css             # Grid Utilities
│   ├── _spacing.css          # Margin/Padding Utilities
│   ├── _display.css          # Display/Visibility
│   └── _text.css             # Text Utilities
├── shared/
│   └── _lit-shared.css       # Shared Styles fur Lit-Komponenten (adoptable)
└── main.css                  # Master Import
```

---

## 1. Foundation Tokens

### 1.1 Farb-Palette (Platform-Dark)

Die Platform ist grundsatzlich dunkel gestaltet (Header, Dashboard, Forge, Admin).
Simulation-Views uberschreiben die Tokens via ThemeService auf dem `<velg-simulation-shell>` Element.

```css
:root {
  color-scheme: dark;

  /* === GRAY SCALE (Palette — nicht semantisch, immer Tokens unten verwenden) === */
  --color-gray-0: #ffffff;
  /* ... (vollstandige 12-Stufen-Skala, unverandert) ... */
  --color-gray-1000: #000000;

  /* === SEMANTIC COLORS === */
  --color-primary: #f59e0b;           /* Amber — Platform-Akzent */
  --color-primary-hover: #fbbf24;
  --color-primary-active: #d97706;
  --color-primary-bg: rgba(245, 158, 11, 0.08);

  --color-danger: #ef4444;
  --color-danger-bg: #2a1010;          /* Dunkler Rot-Tint */
  --color-danger-border: rgba(239, 68, 68, 0.3);

  --color-success: #22c55e;
  --color-success-bg: #0f2a10;         /* Dunkler Grun-Tint */
  --color-success-border: rgba(34, 197, 94, 0.3);

  --color-warning: #f59e0b;
  --color-warning-bg: #2a1f0f;         /* Dunkler Amber-Tint */
  --color-warning-border: rgba(245, 158, 11, 0.3);

  --color-info: #3b82f6;
  --color-info-bg: #0f1a2a;            /* Dunkler Blau-Tint */
  --color-info-border: rgba(59, 130, 246, 0.3);

  /* === SURFACE COLORS === */
  --color-surface: #0a0a0a;
  --color-surface-raised: #111111;
  --color-surface-sunken: #060606;
  --color-surface-overlay: #111111;
  --color-surface-header: #0a0a0a;
  --color-surface-inverse: #ffffff;

  /* === TEXT COLORS === */
  --color-text-primary: #e5e5e5;       /* WCAG: 15.4:1 auf surface */
  --color-text-secondary: #a0a0a0;     /* WCAG: 7.4:1 auf surface */
  --color-text-muted: #888888;         /* WCAG: 5.5:1 auf surface */
  --color-text-inverse: #0a0a0a;
  --color-text-link: var(--color-info);
  --color-text-danger: var(--color-danger);

  /* === BORDER COLORS === */
  --color-border: #333333;
  --color-border-light: #222222;
  --color-border-focus: var(--color-primary);
  --color-border-danger: var(--color-danger);

  /* === PLATFORM ACCENT (nicht themenbar — immer Amber) === */
  --color-accent-amber: #f59e0b;
  --color-accent-amber-hover: #fbbf24;
  --color-accent-amber-dim: #b45309;
  --color-accent-amber-glow: rgba(245, 158, 11, 0.15);
  --color-accent-green: #4ade80;
}
```

**Architektur-Split:**
- `:root` = Platform-Dark (immer dunkel, Amber-Akzent)
- `<velg-simulation-shell>` = ThemeService-Override (kann hell oder dunkel sein)
- Simulationen ohne gespeicherte Design-Settings erhalten automatisch das Brutalist-Preset (hell) als Fallback

### 1.2 Typography

```css
:root {
  /* === FONT FAMILIES === */
  --font-brutalist: 'Courier New', 'Monaco', 'Lucida Console', monospace;
  --font-bureau: 'Spectral', 'Georgia', 'Times New Roman', serif;  /* Bureau-level literary prose */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;

  /* === SEMANTIC TOKENS (analogous to --heading-font) === */
  --font-body: var(--font-sans);    /* UI text — overridden per-simulation by ThemeService */
  --font-prose: var(--font-bureau); /* Literary prose — overridden per-simulation, Spectral on platform */

  /* === FONT SIZES (Modular Scale: 1.25 ratio) === */
  --text-xs: 0.64rem;    /* 10.24px */
  --text-sm: 0.8rem;     /* 12.8px */
  --text-base: 1rem;     /* 16px */
  --text-md: 1.125rem;   /* 18px */
  --text-lg: 1.25rem;    /* 20px */
  --text-xl: 1.563rem;   /* 25px */
  --text-2xl: 1.953rem;  /* 31.25px */
  --text-3xl: 2.441rem;  /* 39px */
  --text-4xl: 3.052rem;  /* 48.8px */

  /* === FONT WEIGHTS === */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-black: 900;

  /* === LINE HEIGHTS === */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;

  /* === LETTER SPACING === */
  --tracking-tight: -0.025em;
  --tracking-normal: 0;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;
  --tracking-brutalist: 1px;

  /* === HEADING TOKENS === */
  --heading-font: var(--font-brutalist);
  --heading-weight: var(--font-black);
  --heading-transform: uppercase;
  --heading-tracking: var(--tracking-brutalist);

  --h1-size: var(--text-3xl);
  --h2-size: var(--text-2xl);
  --h3-size: var(--text-xl);
  --h4-size: var(--text-lg);
  --h5-size: var(--text-md);
  --h6-size: var(--text-base);
}
```

### 1.3 Spacing Scale (vollstandig, luckenlos)

```css
:root {
  --space-0: 0;
  --space-0.5: 0.125rem;  /* 2px */
  --space-1: 0.25rem;     /* 4px */
  --space-1.5: 0.375rem;  /* 6px */
  --space-2: 0.5rem;      /* 8px */
  --space-2.5: 0.625rem;  /* 10px */
  --space-3: 0.75rem;     /* 12px */
  --space-3.5: 0.875rem;  /* 14px */
  --space-4: 1rem;        /* 16px */
  --space-5: 1.25rem;     /* 20px */
  --space-6: 1.5rem;      /* 24px */
  --space-7: 1.75rem;     /* 28px */
  --space-8: 2rem;        /* 32px */
  --space-9: 2.25rem;     /* 36px */
  --space-10: 2.5rem;     /* 40px */
  --space-12: 3rem;       /* 48px */
  --space-14: 3.5rem;     /* 56px */
  --space-16: 4rem;       /* 64px */
  --space-20: 5rem;       /* 80px */
  --space-24: 6rem;       /* 96px */
}
```

### 1.4 Shadow System

```css
:root {
  /* === BRUTALIST SHADOWS (Offset-based) === */
  --shadow-none: none;
  --shadow-xs: 2px 2px 0 var(--color-gray-1000);
  --shadow-sm: 3px 3px 0 var(--color-gray-1000);
  --shadow-md: 4px 4px 0 var(--color-gray-1000);
  --shadow-lg: 6px 6px 0 var(--color-gray-1000);
  --shadow-xl: 8px 8px 0 var(--color-gray-1000);
  --shadow-2xl: 12px 12px 0 var(--color-gray-1000);

  /* === PRESSED/ACTIVE SHADOW === */
  --shadow-pressed: 2px 2px 0 var(--color-gray-1000);
  --shadow-inset: inset 2px 2px 0 rgba(0,0,0,0.2);

  /* === FOCUS RINGS === */
  --ring-focus: 0 0 0 3px rgba(59, 130, 246, 0.4);
  --ring-danger: 0 0 0 3px rgba(239, 68, 68, 0.4);
  --ring-success: 0 0 0 3px rgba(34, 197, 94, 0.4);
  --ring-warning: 0 0 0 3px rgba(245, 158, 11, 0.4);
}
```

### 1.5 Border System

```css
:root {
  --border-width-thin: 1px;
  --border-width-default: 2px;
  --border-width-thick: 3px;
  --border-width-heavy: 4px;

  --border-radius-none: 0;
  --border-radius-sm: 2px;
  --border-radius-md: 4px;
  --border-radius-lg: 8px;
  --border-radius-full: 9999px;

  /* Brutalist Default: No radius */
  --border-radius: var(--border-radius-none);

  /* Composed borders */
  --border-default: var(--border-width-thick) solid var(--color-border);
  --border-light: var(--border-width-thin) solid var(--color-border-light);
  --border-medium: var(--border-width-default) solid var(--color-border);
}
```

### 1.6 Z-Index Scale (einheitlich)

```css
:root {
  --z-behind: -1;
  --z-base: 0;
  --z-raised: 10;
  --z-sticky: 100;
  --z-header: 200;
  --z-dropdown: 300;
  --z-overlay: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
  --z-notification: 800;
  --z-top: 900;
}
```

### 1.7 Animation Tokens

```css
:root {
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;

  --ease-default: ease;
  --ease-in: ease-in;
  --ease-out: ease-out;
  --ease-in-out: ease-in-out;
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  --transition-fast: var(--duration-fast) var(--ease-default);
  --transition-normal: var(--duration-normal) var(--ease-default);
  --transition-slow: var(--duration-slow) var(--ease-default);
}
```

### 1.8 Layout Tokens

```css
:root {
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1400px;
  --container-max: 1600px;

  --header-height: 60px;
  --sidebar-width: 280px;
  --sidebar-collapsed-width: 64px;
  --content-padding: var(--space-6);

  /* Breakpoints (als Referenz, nicht als CSS-Variablen nutzbar in @media) */
  /* sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */
}
```

---

## 2. Theme-System

### 2.1 Light Mode (Default)

```css
:root,
[data-theme="light"] {
  --theme-bg: var(--color-gray-0);
  --theme-bg-alt: var(--color-gray-50);
  --theme-text: var(--color-gray-900);
  --theme-text-secondary: var(--color-gray-600);
  --theme-text-muted: var(--color-gray-400);
  --theme-border: var(--color-gray-1000);
  --theme-border-light: var(--color-gray-200);
  --theme-shadow-color: var(--color-gray-1000);
  --theme-surface: var(--color-gray-0);
  --theme-surface-raised: var(--color-gray-0);
  --theme-surface-sunken: var(--color-gray-50);
  --theme-header-bg: var(--color-gray-100);
  --theme-overlay-bg: rgba(0, 0, 0, 0.8);
}
```

### 2.2 Dark Mode (echtes Dark Mode)

```css
[data-theme="dark"] {
  --theme-bg: #0a0a0a;
  --theme-bg-alt: #141414;
  --theme-text: #e5e7eb;
  --theme-text-secondary: #9ca3af;
  --theme-text-muted: #6b7280;
  --theme-border: #e5e7eb;
  --theme-border-light: #374151;
  --theme-shadow-color: #e5e7eb;
  --theme-surface: #141414;
  --theme-surface-raised: #1f2937;
  --theme-surface-sunken: #0a0a0a;
  --theme-header-bg: #1f2937;
  --theme-overlay-bg: rgba(0, 0, 0, 0.9);

  /* Semantic Color Overrides fur Dark Mode */
  --color-danger-bg: #451a1a;
  --color-success-bg: #14532d;
  --color-warning-bg: #451a03;
  --color-info-bg: #1e3a5f;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Gleiche Werte wie [data-theme="dark"] */
    --theme-bg: #0a0a0a;
    --theme-bg-alt: #141414;
    --theme-text: #e5e7eb;
    --theme-text-secondary: #9ca3af;
    --theme-text-muted: #6b7280;
    --theme-border: #e5e7eb;
    --theme-border-light: #374151;
    --theme-shadow-color: #e5e7eb;
    --theme-surface: #141414;
    --theme-surface-raised: #1f2937;
    --theme-surface-sunken: #0a0a0a;
    --theme-header-bg: #1f2937;
    --theme-overlay-bg: rgba(0, 0, 0, 0.9);
  }
}
```

### 2.3 Simulation-Theme-Override-Mechanismus (Shell-Scoped)

Theme-Overrides werden **nicht** auf `:root` gesetzt, sondern auf das `<velg-simulation-shell>` Host-Element. Die Base-Tokens auf `:root` (§1, §2.1, §2.2) bleiben immer unverändert. CSS Custom Properties vererben sich durch Shadow DOM — daher erreichen die Overrides alle Kind-Komponenten innerhalb der Shell.

```
:root (Base-Tokens — immer Brutalist)
  │
  └── <velg-app> (Plattform-Level — nutzt Base-Tokens)
       │
       └── <velg-simulation-shell style="--color-primary: #ff6b2b; ...">
            │                     ↑ ThemeService setzt Overrides hier
            └── <velg-agents-view> (sieht die Override-Werte via Vererbung)
                 └── <velg-agent-card> (ebenso)
```

**Dynamische Simulation-Themes via ThemeService:**

```typescript
// SimulationShell ruft beim Laden auf:
await themeService.applySimulationTheme(simulationId, this);

// ThemeService lädt Design-Settings via API, dann:
// 1. Direkte Token-Mappings (flat key → CSS var)
hostElement.style.setProperty('--color-primary', '#ff6b2b');
hostElement.style.setProperty('--font-brutalist', "'Arial Narrow', sans-serif");

// 2. Berechnete Tokens: shadow_style → 7 Shadow-Variablen
//    shadow_style='glow' + shadow_color='#ff6b2b' →
//    --shadow-xs, --shadow-sm, ..., --shadow-2xl, --shadow-pressed

// 3. Berechnete Tokens: animation_speed → 4 Duration-Variablen
//    animation_speed=0.7 →
//    --duration-fast: 70ms, --duration-normal: 140ms, etc.
```

5 Presets (brutalist, sunless-sea, solarpunk, cyberpunk, nordic-noir) stehen als Ausgangspunkt zur Verfügung. DesignSettingsPanel bietet Live-Preview beim Bearbeiten. Alle 37 Theme-Einstellungen (21 Farben + 7 Typografie + 9 Charakter) sind über die Design-Settings editierbar.

**Contrast-Validierung:** Alle Presets werden automatisch via `frontend/tests/theme-contrast.test.ts` gegen WCAG 2.1 AA Kontrastverhältnisse geprüft (4.5:1 für normalen Text, 3.0:1 für Badges/Buttons/Muted-Text). Neue Presets müssen diesen Test bestehen.

**Cleanup:** `themeService.resetTheme(hostElement)` entfernt alle Overrides, wenn die Simulation gewechselt wird.

**Vollständige Architektur:** Siehe `../specs/theming-system.md` für Token-Taxonomy (37 Settings, 3 Tiers), Computed-Token-Logik, Preset-Definitionen und Contrast-Regeln.

---

## 3. Komponenten-System

### 3.1 Button-System (1 Definition, N Varianten)

```css
/* === BUTTON BASE === */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-brutalist);
  font-weight: var(--font-black);
  text-transform: uppercase;
  letter-spacing: var(--tracking-brutalist);
  border: var(--border-default);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* === SIZES === */
.btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  min-height: 32px;
}

.btn--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  min-height: 40px;
}

.btn--lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  min-height: 48px;
}

/* === VARIANTS === */
.btn--primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-md);
}
.btn--primary:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-lg);
}
.btn--primary:active {
  transform: translate(0);
  box-shadow: var(--shadow-pressed);
}

.btn--secondary {
  background: var(--theme-surface);
  color: var(--theme-text);
  box-shadow: var(--shadow-md);
}
.btn--secondary:hover {
  background: var(--theme-header-bg);
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-lg);
}

.btn--danger {
  background: var(--color-danger);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-md);
}
.btn--danger:hover {
  background: var(--color-danger-hover);
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-lg);
}

.btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--theme-text);
  box-shadow: none;
}
.btn--ghost:hover {
  background: var(--theme-surface-sunken);
}

.btn--outline {
  background: transparent;
  color: var(--theme-text);
  box-shadow: var(--shadow-sm);
}
.btn--outline:hover {
  background: var(--theme-surface-sunken);
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-md);
}

.btn--icon {
  padding: var(--space-2);
  min-width: 40px;
  min-height: 40px;
}

.btn--full {
  width: 100%;
}
```

### 3.2 Card-System

```css
.card {
  background: var(--theme-surface-raised);
  border: var(--border-default);
  box-shadow: var(--shadow-md);
  border-radius: var(--border-radius);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.card--interactive {
  cursor: pointer;
}
.card--interactive:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-lg);
}
.card--interactive:active {
  transform: translate(0);
  box-shadow: var(--shadow-pressed);
}

.card--selected {
  border-color: var(--color-info);
  box-shadow: 0 0 0 2px var(--color-info), var(--shadow-md);
}

.card--flat {
  box-shadow: none;
  border-color: var(--color-border-light);
}

.card__header {
  padding: var(--space-3) var(--space-4);
  background: var(--theme-header-bg);
  border-bottom: var(--border-medium) solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card__title {
  font-family: var(--heading-font);
  font-weight: var(--heading-weight);
  text-transform: var(--heading-transform);
  font-size: var(--text-md);
  margin: 0;
}

.card__body {
  padding: var(--space-4);
}

.card__footer {
  padding: var(--space-3) var(--space-4);
  border-top: var(--border-width-default) solid var(--color-border-light);
  background: var(--theme-surface-sunken);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

/* Embassy/Ambassador variant — per-simulation theme colors */
.card--embassy {
  position: relative;
  border-color: transparent;
  box-shadow:
    0 0 0 1px var(--color-primary),
    0 0 8px color-mix(in srgb, var(--color-primary) 40%, transparent);
  animation: embassy-pulse 3s ease-in-out infinite;
}
.card--embassy::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--color-primary) 18%, transparent),
    transparent 45%,
    color-mix(in srgb, var(--color-text-secondary) 14%, transparent) 70%,
    color-mix(in srgb, var(--color-primary) 18%, transparent));
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
  pointer-events: none;
  z-index: 1;
  border-radius: inherit;
}
.card--embassy:hover {
  animation: none;
  border-color: transparent;
  background:
    linear-gradient(var(--color-surface-raised), var(--color-surface-raised)) padding-box,
    linear-gradient(135deg, var(--color-primary), var(--color-text-secondary), var(--color-primary)) border-box;
  border-width: 3px;
  box-shadow: var(--shadow-lg),
    0 0 18px color-mix(in srgb, var(--color-primary) 70%, transparent);
}
.card--embassy:hover::after { opacity: 1; }
@keyframes embassy-pulse {
  0%, 100% {
    box-shadow: 0 0 0 1px var(--color-primary),
      0 0 6px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 0 5px var(--color-text-secondary),
      0 0 20px color-mix(in srgb, var(--color-primary) 70%, transparent);
  }
}
```

**Embassy-Variante:**
- Verwendet per-Simulation Theme-Farben (`--color-primary`, `--color-text-secondary`)
- **Non-hover:** Pulsierender Ring via `box-shadow: 0 0 0 Npx` (1px→5px), wechselt zwischen `--color-primary` und `--color-text-secondary`. Funktioniert mit `border-radius` (im Gegensatz zu `border-image`).
- **Hover:** Gradient-Border via `background: padding-box/border-box` Trick + Gradient-Fill-Overlay via `::after` Pseudo-Element + Lift + Glow.
- Angewandt auf: `AgentCard` (Ambassador-Agenten), `BuildingCard` (Embassy-Gebaeude)

### 3.3 Form-System

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1.5);
}

.form-label {
  font-family: var(--font-brutalist);
  font-weight: var(--font-black);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--theme-text);
}

.form-label--required::after {
  content: ' *';
  color: var(--color-danger);
}

.form-input,
.form-select,
.form-textarea {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  padding: var(--space-2.5) var(--space-3);
  border: var(--border-default);
  border-radius: var(--border-radius);
  background: var(--theme-surface);
  color: var(--theme-text);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  width: 100%;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--ring-focus);
}

.form-input--error,
.form-select--error,
.form-textarea--error {
  border-color: var(--color-border-danger);
}
.form-input--error:focus {
  box-shadow: var(--ring-danger);
}

.form-input:disabled {
  background: var(--theme-surface-sunken);
  opacity: 0.6;
  cursor: not-allowed;
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

.form-hint {
  font-size: var(--text-sm);
  color: var(--theme-text-muted);
}

.form-error {
  font-size: var(--text-sm);
  color: var(--color-text-danger);
  font-weight: var(--font-bold);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.form-grid--full {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

### 3.4 Table-System

```css
.table-container {
  background: var(--theme-surface);
  border: var(--border-default);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.table-header {
  padding: var(--space-3) var(--space-4);
  background: var(--theme-header-bg);
  border-bottom: var(--border-default);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-controls {
  padding: var(--space-3);
  background: var(--theme-surface-sunken);
  border-bottom: var(--border-width-default) solid var(--color-border-light);
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  padding: var(--space-3);
  background: var(--theme-header-bg);
  font-family: var(--font-brutalist);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  font-size: var(--text-sm);
  text-align: left;
  border-bottom: var(--border-default);
  position: sticky;
  top: 0;
  z-index: var(--z-raised);
  cursor: pointer;
  user-select: none;
}

.table td {
  padding: var(--space-3);
  border-bottom: var(--border-width-thin) solid var(--color-border-light);
  font-size: var(--text-sm);
}

.table tbody tr:hover {
  background: var(--theme-surface-sunken);
}

.table tbody tr:nth-child(even) {
  background: var(--color-gray-50);
}
```

### 3.5 Modal-System

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--theme-overlay-bg);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}

.modal {
  background: var(--theme-surface);
  border: var(--border-default);
  box-shadow: var(--shadow-xl);
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  animation: modal-enter var(--duration-normal) var(--ease-out);
}

.modal--sm { max-width: 480px; width: 100%; }
.modal--md { max-width: 640px; width: 100%; }
.modal--lg { max-width: 960px; width: 100%; }
.modal--xl { max-width: 1200px; width: 100%; }
.modal--full { max-width: 95vw; max-height: 95vh; }

.modal__header {
  padding: var(--space-4);
  background: var(--theme-header-bg);
  border-bottom: var(--border-default);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 1;
}

.modal__title {
  font-family: var(--heading-font);
  font-weight: var(--heading-weight);
  text-transform: var(--heading-transform);
  font-size: var(--h4-size);
  margin: 0;
}

.modal__close {
  background: transparent;
  border: var(--border-medium);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.modal__close:hover {
  background: var(--theme-surface-sunken);
}

.modal__body {
  padding: var(--space-6);
  flex: 1;
  overflow-y: auto;
}

.modal__footer {
  padding: var(--space-4);
  border-top: var(--border-width-default) solid var(--color-border-light);
  background: var(--theme-surface-sunken);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3.6 Notification-System

```css
.notification-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-notification);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 400px;
}

.notification {
  padding: var(--space-3) var(--space-4);
  border: var(--border-default);
  box-shadow: var(--shadow-md);
  font-family: var(--font-brutalist);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  animation: notification-enter var(--duration-slow) var(--ease-out);
}

.notification--success { background: var(--color-success); color: var(--color-text-inverse); }
.notification--error { background: var(--color-danger); color: var(--color-text-inverse); }
.notification--warning { background: var(--color-warning); color: var(--color-gray-900); }
.notification--info { background: var(--color-info); color: var(--color-text-inverse); }

@keyframes notification-enter {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

---

## 4. Responsive Design

### Breakpoint-System

| Token | Breite | Verwendung |
|-------|--------|-----------|
| `sm` | 640px | Smartphones (Landscape) |
| `md` | 768px | Tablets |
| `lg` | 1024px | Kleine Laptops |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Grosse Monitore |

### Media Query Pattern

```css
/* Mobile-First Breakpoints */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }

/* Container Queries fur Komponenten */
@container (min-width: 400px) { /* Komponenten-Level */ }
@container (min-width: 600px) { /* Komponenten-Level */ }
```

### Responsive Layouts

```css
/* App Layout */
.app-layout {
  display: grid;
  grid-template-rows: var(--header-height) 1fr;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
}

@media (max-width: 1024px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
  .app-sidebar {
    position: fixed;
    left: 0;
    top: var(--header-height);
    bottom: 0;
    width: var(--sidebar-width);
    z-index: var(--z-overlay);
    transform: translateX(-100%);
    transition: transform var(--transition-slow);
  }
  .app-sidebar--open {
    transform: translateX(0);
  }
}
```

### Mobile Responsive (Audit Phase 2)

Systematische Mobile-Optimierung ueber 19 Dateien mit zwei Breakpoints:

| Breakpoint | Verwendung |
|------------|-----------|
| `max-width: 640px` | Settings-Panels (9), settings-styles.ts, Chat-Komponenten (6), terminal-theme-styles.ts, Auth-Komponenten (2). Single-Column Layouts, Full-Width Inputs |
| `max-width: 768px` | EpochLeaderboard: Table→Card Layout Umbruch |

**Touch Targets:** Alle interaktiven Elemente auf mindestens 44px Mindestgroesse (WCAG 2.5.5 Level AAA).

**Shared Components:** `<velg-tabs>` (Tab-Bar mit Keyboard-Navigation: Arrow/Home/End, role="tablist", aria-selected, Roving Tabindex), `<velg-skeleton>` (Shimmer Loading Placeholder, Varianten: text/card/avatar/table-row, respektiert `prefers-reduced-motion`).

---

## 5. Accessibility

### Focus Management

```css
/* Focus-Visible Ring fur alle interaktiven Elemente */
:focus-visible {
  outline: none;
  box-shadow: var(--ring-focus);
}

/* Custom Focus Styles fur Brutalist-Look */
.btn:focus-visible,
.form-input:focus-visible,
.card--interactive:focus-visible {
  outline: 3px solid var(--color-info);
  outline-offset: 2px;
}

/* Skip-to-Content Link */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  padding: var(--space-3) var(--space-6);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: var(--border-default);
  font-family: var(--font-brutalist);
  font-weight: var(--font-black);
  text-transform: uppercase;
  z-index: var(--z-top);
  transition: top var(--transition-fast);
}
.skip-link:focus {
  top: var(--space-4);
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### High Contrast

```css
@media (prefers-contrast: high) {
  :root {
    --border-width-thin: 2px;
    --border-width-default: 3px;
    --border-width-thick: 4px;

    --shadow-sm: 3px 3px 0 var(--color-gray-1000);
    --shadow-md: 5px 5px 0 var(--color-gray-1000);
    --shadow-lg: 7px 7px 0 var(--color-gray-1000);

    --color-text-muted: var(--color-gray-600);
  }
}
```

### ARIA-Pattern

```css
/* Disabled States */
[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Expanded/Collapsed */
[aria-expanded="false"] + .collapsible-content {
  display: none;
}

/* Current Navigation */
[aria-current="page"] {
  font-weight: var(--font-black);
  border-left: var(--border-width-heavy) solid var(--color-primary);
}
```

---

## 6. Lit Shadow DOM Integration

### Shared Styles via Constructable Stylesheets

```typescript
// shared-styles.ts
import { css } from 'lit';

export const sharedButtonStyles = css`
  .btn { /* ... alle Button-Styles ... */ }
`;

export const sharedFormStyles = css`
  .form-group { /* ... alle Form-Styles ... */ }
`;

export const sharedCardStyles = css`
  .card { /* ... alle Card-Styles ... */ }
`;

export const sharedBaseStyles = css`
  :host {
    display: block;
    font-family: var(--font-sans);
    color: var(--theme-text);
    box-sizing: border-box;
  }
  :host *, :host *::before, :host *::after {
    box-sizing: border-box;
  }
`;
```

### Verwendung in Komponenten

```typescript
import { sharedBaseStyles, sharedButtonStyles, sharedFormStyles } from '../styles/shared-styles.js';

@customElement('velg-agent-edit')
export class VelgAgentEdit extends LitElement {
  static styles = [
    sharedBaseStyles,
    sharedButtonStyles,
    sharedFormStyles,
    css`
      /* Nur komponenten-spezifische Styles */
      .agent-portrait { ... }
    `
  ];
}
```

### Token-Durchdringung via CSS Custom Properties

```
Document :root (Tokens definiert)
  │
  └── <velg-app> (Shadow DOM - Tokens verfugbar via Vererbung)
       │
       └── <velg-agents-view> (Shadow DOM - Tokens weiterhin verfugbar)
            │
            └── <velg-agent-card> (Shadow DOM - Tokens weiterhin verfugbar)
```

CSS Custom Properties durchdringen Shadow DOM automatisch - daher funktioniert das Token-System ohne spezielle Massnahmen.

---

## 7. Migration: Alt → Neu

### Mapping: Alte Tokens → Neue Tokens

| Alt (design-tokens.css) | Neu | Notiz |
|------------------------|-----|-------|
| `--velg-black` | `--color-gray-1000` | Kein semantischer Name |
| `--velg-white` | `--color-gray-0` | Kein semantischer Name |
| `--velg-gray-50..800` | `--color-gray-50..800` | + fehlende Stufen |
| `--color-primary` | `--color-primary` | Beibehalten |
| `--btn-shadow-default` | `--shadow-md` | Vereinheitlicht |
| `--btn-shadow-hover` | `--shadow-lg` | Vereinheitlicht |
| `--modal-z-index: 10000` | `--z-modal: 500` | Korrigiert |
| `--notification-z-index: 10001` | `--z-notification: 800` | Korrigiert |
| `--font-family-brutalist` | `--font-brutalist` | Kurzerer Name |
| `--font-weight-brutalist` | `--font-black` | Standard-Name |

### Eliminierte Duplikationen

| Duplikation | Alt (Dateien) | Neu (1 Datei) |
|------------|---------------|---------------|
| Button-Styles | design-tokens + components + inline (4x) | `_button.css` |
| Card-Styles | components + inline (3x) | `_card.css` |
| Form-Styles | components + 5 Modals (7x) | `_form.css` |
| Modal-Styles | components + VelgBaseModal (2x) | `_modal.css` |
| Table-Styles | components + VelgDataTable (2x) | `_table.css` |

---

## Shared CSS Modules (10)

Wiederverwendbare CSS-Module in `components/shared/` und `components/how-to-play/`. Verwendung: `static styles = [formStyles, css\`...\`]` — lokale Styles gewinnen per Kaskade.

| Modul | Datei | Inhalt | Verwendet von |
|-------|-------|--------|---------------|
| `cardStyles` | `card-styles.ts` | `.card` hover/active + `.card--embassy` pulsing ring + gradient hover | AgentCard, BuildingCard, EventCard, CampaignCard, TrendCard |
| `formStyles` | `form-styles.ts` | `.form`, `.form__group`, `.form__input/.form__textarea/.form__select`, `.footer` | Alle EditModals (Agent, Building, Event, etc.) |
| `viewHeaderStyles` | `view-header-styles.ts` | `.view`, `.view__header`, `.view__title`, `.view__create-btn` | AgentsView, BuildingsView, EventsView |
| `panelButtonStyles` | `panel-button-styles.ts` | `.panel__btn` base + `--edit`, `--danger`, `--generate` Varianten | Alle DetailsPanel-Komponenten |
| `settingsStyles` | `settings-styles.ts` | `.settings-panel`, `.settings-form`, `.settings-btn`, `.settings-toggle` | AI, Integration, Design, Access Settings-Panels |
| `infoBubbleStyles` | `info-bubble-styles.ts` | `renderInfoBubble(title, text)` Shared Render-Funktion | Alle EditModals mit Game-Mechanics-Tooltips |
| `panelCascadeStyles` | `panel-cascade-styles.ts` | Staggered Detail-Panel Eingangs-Animationen | AgentDetailsPanel, BuildingDetailsPanel, EventDetailsPanel |
| `typographyStyles` | `typography-styles.ts` | `.label-brutalist` Uppercase Brutalist-Labels | Diverse Komponenten |
| `gridLayoutStyles` | `grid-layout-styles.ts` | `.entity-grid` mit `--grid-min-width` Custom Property, responsive Breakpoints | AgentsView, BuildingsView, EventsView, SocialMediaView, CampaignDashboard |
| `htpStyles` | `how-to-play/htp-styles.ts` | Komplett-CSS fuer HowToPlayView (~1100 Zeilen), extrahiert fuer Uebersichtlichkeit | HowToPlayView |

**grid-layout-styles.ts** — dedupliziert identische Grid-CSS aus 5 Views. Konfigurierbar via `--grid-min-width` Custom Property (default 240px, SocialMediaView/CampaignDashboard: 260px). Responsive Breakpoints: 640px (2 Spalten), 400px (1 Spalte).

### Info Bubble Pattern

Shared Tooltip-Komponente fuer Admin-Config-Inputs und Settings-Panels.

**Files:** `shared/info-bubble-styles.ts` (CSS + Render-Helper)

**Usage:**
```ts
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';

// In render:
${renderInfoBubble(msg('Tooltip text'), 'tip-my-input')}
<input aria-describedby="tip-my-input" />
```

**Features:**
- 16px kreisfoermiges "i"-Icon mit `tabindex="0"`
- Amber-Glow bei Hover/Focus (`--color-accent-amber`)
- 240px Tooltip mit Aufwaerts-Pfeil
- `role="tooltip"` + optionale `id` fuer `aria-describedby`-Verknuepfung
- Anzeige bei `:hover` und `:focus-within`

### Content Lint Rules

`frontend/scripts/lint-llm-content.sh` erzwingt:
1. **Keine Em-Dashes (U+2014)** in `msg()` / Template-Literals — En-Dashes (U+2013) verwenden
2. **Keine LLM-Woerter** in `msg()`-Strings: tapestry, delve, unleash, seamlessly, holistic, multifaceted, bustling, game-changer, cutting-edge
3. **Keine Em-Dashes in XLIFF**-Uebersetzungsdateien

---

## Querverweise

- **Frontend Components** (`frontend-components.md`) - Komponenten die das Design System nutzen
- **Simulation Settings** (`../specs/simulation-settings.md`) - Design Settings (Theme-Konfiguration pro Simulation)
- **Techstack Recommendation** (`../explanations/techstack-recommendation.md`) - CSS-Tools und Build-Konfiguration
- **Theming System** (`../specs/theming-system.md`) - Per-Simulation Theming: Token-Taxonomie, Presets, ThemeService-Architektur
