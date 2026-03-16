---
title: "Simulation Settings"
id: simulation-settings
version: "1.0"
date: 2026-02-15
lang: de
type: spec
status: active
tags: [settings, configuration, simulation]
---

# 08 - Simulation Settings: Komplett-Spezifikation

---

## Übersicht

Das Settings-System ist das **Kernstück** der Multi-Simulations-Plattform. Es ermöglicht die vollständige Konfiguration jeder Simulation über eine dedizierte UI.

### Settings-Kategorien

| Kategorie | Tab | Beschreibung |
|-----------|-----|-------------|
| **General** | Allgemein | Name, Beschreibung, Thema, Sprache |
| **World** | Welt | Taxonomien/Enums anpassen |
| **AI** | KI | Modelle, Prompts, Parameter |
| **Integration** | Integrationen | Externe APIs, Social Media |
| **Design** | Design | Theme, Farben, Typography |
| **Access** | Zugang | Sichtbarkeit, Rollen, Einladungen |

---

## 1. General Settings

### Felder

| Setting Key | Typ | Default | Beschreibung |
|------------|-----|---------|-------------|
| `general.name` | string | (required) | Simulations-Name (z.B. "Velgarien") |
| `general.slug` | string | (auto) | URL-freundlicher Name (read-only nach Erstellung) |
| `general.description` | text | "" | Beschreibung der Simulation |
| `general.theme` | enum | "custom" | dystopian, utopian, fantasy, scifi, historical, custom |
| `general.content_locale` | string | "en" | Hauptsprache für Inhalte |
| `general.additional_locales` | string[] | [] | Weitere Inhalts-Sprachen |
| `general.timezone` | string | "UTC" | Zeitzone für Timestamps |
| `general.icon_url` | string | null | Simulations-Icon |
| `general.banner_url` | string | null | Simulations-Banner |

### UI-Spezifikation

```
┌─────────────────────────────────────────┐
│ Allgemeine Einstellungen                │
├─────────────────────────────────────────┤
│                                         │
│ Name *                                  │
│ [Velgarien                          ]   │
│                                         │
│ URL-Slug (nicht änderbar)               │
│ [velgarien                          ]   │
│                                         │
│ Thema                                   │
│ [Dystopisch                        ▾]   │
│   ○ Dystopisch                          │
│   ○ Utopisch                            │
│   ○ Fantasy                             │
│   ○ Sci-Fi                              │
│   ○ Historisch                          │
│   ○ Benutzerdefiniert                   │
│                                         │
│ Inhalts-Sprache *                       │
│ [Deutsch                           ▾]   │
│                                         │
│ Weitere Sprachen                        │
│ [☑ Englisch] [☐ Französisch] [☐ ...]   │
│                                         │
│ Zeitzone                                │
│ [Europe/Berlin                     ▾]   │
│                                         │
│ Beschreibung                            │
│ ┌─────────────────────────────────────┐ │
│ │ Eine dystopische Weltensimulation   │ │
│ │ in der...                           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Icon / Banner                           │
│ [Hochladen] [Entfernen]                │
│                                         │
│           [Änderungen speichern]        │
└─────────────────────────────────────────┘
```

---

## 2. World Settings (Taxonomien)

### Verwaltet alle dynamischen Enums/Kategorien

| Taxonomy Type | Velgarien-Default | Beschreibung |
|--------------|-------------------|-------------|
| `system` | Politik, Militär, Zivil, Wirtschaft, Unterwelt, Klerus, Wissenschaft | Agenten-Systeme |
| `profession` | Wissenschaftler, Führungsperson, Militär, Ingenieur, Künstler, Mediziner, Sicherheitspersonal, Verwaltung, Handwerker, Spezialist | Professionen |
| `gender` | Männlich, Weiblich, Divers, Alien | Gender-Optionen |
| `building_type` | Wohnkomplex, Bürogebäude, Fabrik, Klinik, Bildungseinrichtung, Kulturzentrum, Regierungsgebäude, Handelsgebäude, Infrastruktur | Gebäudetypen |
| `building_style` | Brutalistisch, Modern, Klassisch, Futuristisch, Industrial | Gebäude-Stile |
| `building_special_type` | Akademie, Militärakademie, Medizinisches Zentrum, Forschungslabor, Propagandazentrum | Spezialgebäude |
| `event_type` | NEWS, PROPAGANDA, SOCIAL, POLITICAL, ECONOMIC, CULTURAL | Event-Typen |
| `campaign_type` | Surveillance, Control, Distraction, Loyalty, Productivity, Conformity | Kampagnen-Typen |
| `target_demographic` | Bildungssektor, Arbeitende Bevölkerung, Gesundheitsbewusste, Allgemein | Zielgruppen |
| `urgency_level` | Niedrig, Mittel, Hoch, Kritisch | Dringlichkeitsstufen |
| `zone_type` | Residential, Commercial, Industrial, Military, Religious, Government, Slums, Ruins | Zonen-Typen |
| `security_level` | Low, Medium, High, Restricted | Sicherheitsstufen |
| `sentiment` | Positive, Negative, Neutral, Mixed | Sentiment-Typen |

### UI-Spezifikation: Taxonomy Editor

```
┌─────────────────────────────────────────────────┐
│ Welt-Einstellungen                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ Kategorie: [Professionen              ▾]        │
│                                                 │
│ ┌──────┬───────────────┬──────────┬──────────┐  │
│ │ Reihe│ Interner Wert │ Label    │ Aktionen │  │
│ ├──────┼───────────────┼──────────┼──────────┤  │
│ │  ↕ 1 │ scientist     │ DE: Wissenschaftler  │  │
│ │      │               │ EN: Scientist │ ✏️ 🗑️│  │
│ ├──────┼───────────────┼──────────┼──────────┤  │
│ │  ↕ 2 │ leader        │ DE: Führungsperson   │  │
│ │      │               │ EN: Leader    │ ✏️ 🗑️│  │
│ ├──────┼───────────────┼──────────┼──────────┤  │
│ │  ↕ 3 │ military      │ DE: Militär          │  │
│ │      │               │ EN: Military  │ ✏️ 🗑️│  │
│ ├──────┼───────────────┼──────────┼──────────┤  │
│ │  ... │               │          │          │  │
│ └──────┴───────────────┴──────────┴──────────┘  │
│                                                 │
│ Drag & Drop zum Sortieren                       │
│                                                 │
│ [+ Neuen Wert hinzufügen]                       │
│                                                 │
│ ── Hinzufügen ──                                │
│ Interner Wert: [alchemist          ]            │
│ Label (DE):    [Alchemist          ]            │
│ Label (EN):    [Alchemist          ]            │
│ [Hinzufügen] [Abbrechen]                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 3. AI Settings

### 3.1 Text-Modelle pro Zweck

| Setting Key | Velgarien-Default | Beschreibung |
|------------|-------------------|-------------|
| `ai.models.agent_description` | deepseek/deepseek-chat-v3-0324 | Agent-Beschreibungen |
| `ai.models.agent_reactions` | meta-llama/llama-3.3-70b-instruct:free | Event-Reaktionen |
| `ai.models.building_description` | meta-llama/llama-3.3-70b-instruct:free | Gebäude-Beschreibungen |
| `ai.models.event_generation` | deepseek/deepseek-chat-v3-0324 | Event-Generierung |
| `ai.models.chat_response` | deepseek/deepseek-chat-v3-0324 | Chat-Antworten |
| `ai.models.news_transformation` | meta-llama/llama-3.2-3b-instruct:free | News-Transformation |
| `ai.models.social_trends` | meta-llama/llama-3.3-70b-instruct:free | Trend-Titel/Beschreibungen |
| `ai.models.fallback` | shisa-ai/shisa-v2-llama3.3-70b:free | Fallback-Modell |

### 3.2 Bild-Modelle

| Setting Key | Velgarien-Default | Beschreibung |
|------------|-------------------|-------------|
| `ai.image_models.agent_portrait` | stability-ai/stable-diffusion (SD 1.5) | Agent-Portraits |
| `ai.image_models.building_image` | stability-ai/stable-diffusion (SD 1.5) | Gebäude-Bilder |
| `ai.image_models.fallback` | sd15 | Fallback |

### 3.3 Bild-Parameter

| Setting Key | Default | Beschreibung |
|------------|---------|-------------|
| `ai.image_params.width` | 512 | Bildbreite |
| `ai.image_params.height` | 512 | Bildhöhe |
| `ai.image_params.guidance_scale` | 7.5 | Guidance Scale |
| `ai.image_params.num_inference_steps` | 50 | Inference Steps |
| `ai.image_params.scheduler` | "K_EULER" | Scheduler |

### 3.4 Prompt-Templates

Verwaltung über eigene UI (Prompt Template Editor).

| Setting Key | Beschreibung |
|------------|-------------|
| `ai.prompts.agent_generation.{locale}` | Agent-Generierungs-Prompt |
| `ai.prompts.building_generation.{locale}` | Gebäude-Generierungs-Prompt |
| `ai.prompts.portrait_description.{locale}` | Portrait-Beschreibungs-Prompt |
| `ai.prompts.event_generation.{locale}` | Event-Generierungs-Prompt |
| `ai.prompts.chat_system.{locale}` | Chat System-Prompt |
| `ai.prompts.news_transformation.{locale}` | News-Transformations-Prompt |
| ... | Alle 22 Prompts aus dem Altsystem |

### 3.5 Generierungs-Parameter

| Setting Key | Default | Beschreibung |
|------------|---------|-------------|
| `ai.params.temperature.default` | 0.8 | Default Temperatur |
| `ai.params.max_tokens.default` | 500 | Default Max Tokens |
| `ai.params.negative_prompt.agent` | "cartoon, anime..." | Negative Prompt (Agenten) |
| `ai.params.negative_prompt.building` | "people, humans..." | Negative Prompt (Gebäude) |

### UI-Spezifikation: AI Settings

```
┌─────────────────────────────────────────────────┐
│ KI-Einstellungen                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ ── Text-Modelle ──                              │
│                                                 │
│ Agent-Beschreibungen:                           │
│ [deepseek/deepseek-chat-v3-0324         ▾]     │
│ Temperatur: [0.8] Max Tokens: [300]             │
│                                                 │
│ Event-Reaktionen:                               │
│ [meta-llama/llama-3.3-70b-instruct:free ▾]     │
│ Temperatur: [0.7] Max Tokens: [100]             │
│                                                 │
│ ... (weitere Modelle)                           │
│                                                 │
│ ── Bild-Modelle ──                              │
│                                                 │
│ Agent-Portraits:                                │
│ [stability-ai/stable-diffusion          ▾]     │
│ Größe: [512]×[512]  Steps: [50]                │
│                                                 │
│ ── Prompt-Templates ──                          │
│                                                 │
│ [Prompt-Editor öffnen →]                        │
│ 22 Templates konfiguriert (12 DE, 10 EN)        │
│                                                 │
│           [Änderungen speichern]                │
└─────────────────────────────────────────────────┘
```

---

## 4. Integration Settings

### Externe Services pro Simulation

| Setting Key | Typ | Beschreibung |
|------------|-----|-------------|
| `integration.facebook.page_id` | string | Facebook Page ID |
| `integration.facebook.access_token` | encrypted | Page Access Token |
| `integration.facebook.api_version` | string | API Version (z.B. "v23.0") |
| `integration.facebook.enabled` | boolean | Facebook-Integration aktiv |
| `integration.guardian.api_key` | encrypted | Guardian API Key |
| `integration.guardian.enabled` | boolean | Guardian aktiv |
| `integration.newsapi.api_key` | encrypted | NewsAPI Key |
| `integration.newsapi.enabled` | boolean | NewsAPI aktiv |
| `integration.openrouter.api_key` | encrypted | OpenRouter API Key (Override) |
| `integration.replicate.api_key` | encrypted | Replicate API Key (Override) |

**Verschlüsselung:** Alle API-Keys werden mit AES-256 verschlüsselt in der Datenbank gespeichert. Der Verschlüsselungs-Key kommt aus einer Umgebungsvariable.

### UI-Spezifikation

```
┌─────────────────────────────────────────────────┐
│ Integrationen                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ ── Facebook ──                          [An ○]  │
│ Page ID:      [203648343900979     ]            │
│ Access Token: [••••••••••••••••••••]  [Testen]  │
│ API Version:  [v23.0               ]            │
│                                                 │
│ ── The Guardian ──                      [An ○]  │
│ API Key:      [••••••••••••••••••••]  [Testen]  │
│                                                 │
│ ── NewsAPI ──                           [An ○]  │
│ API Key:      [••••••••••••••••••••]  [Testen]  │
│                                                 │
│ ── AI-Provider (Überschreibungen) ──            │
│ OpenRouter Key: [Plattform-Default verwenden]   │
│ Replicate Key:  [Plattform-Default verwenden]   │
│                                                 │
│           [Änderungen speichern]                │
└─────────────────────────────────────────────────┘
```

---

## 5. Design Settings

Per-Simulation-Theming erlaubt vollständige visuelle Anpassung. Settings werden als flache Keys (Kategorie `design`) in `simulation_settings` gespeichert. Die vollständige Token-Taxonomie und Architektur ist in **Theming System** (`theming-system.md`) dokumentiert.

### Theme-Tokens pro Simulation (32 Tokens, 3 Tiers)

#### Tier 1: Farben (16 Tokens)

| Setting Key | Brutalist-Default | Beschreibung |
|------------|-------------------|-------------|
| `color_primary` | `#000000` | Primärfarbe |
| `color_primary_hover` | `#1a1a1a` | Primär-Hover |
| `color_primary_active` | `#333333` | Primär-Active |
| `color_secondary` | `#3b82f6` | Sekundärfarbe |
| `color_accent` | `#f59e0b` | Akzentfarbe |
| `color_background` | `#ffffff` | Hintergrund |
| `color_surface` | `#f5f5f5` | Oberflächen |
| `color_surface_sunken` | `#e5e5e5` | Abgesenkte Flächen |
| `color_surface_header` | `#fafafa` | Header-Hintergrund |
| `color_text` | `#0a0a0a` | Textfarbe |
| `color_text_secondary` | `#525252` | Sekundärer Text |
| `color_text_muted` | `#a3a3a3` | Gedämpfter Text |
| `color_border` | `#000000` | Rahmenfarbe |
| `color_border_light` | `#d4d4d4` | Heller Rahmen |
| `color_danger` | `#dc2626` | Fehlerfarbe |
| `color_success` | `#16a34a` | Erfolgsfarbe |

#### Tier 2: Typographie (7 Tokens)

| Setting Key | Brutalist-Default | Beschreibung |
|------------|-------------------|-------------|
| `font_heading` | `'Courier New', Monaco, monospace` | Überschriften-Font |
| `font_body` | `system-ui, sans-serif` | Fließtext-Font |
| `font_mono` | `SF Mono, Monaco, monospace` | Monospace-Font |
| `heading_weight` | `900` | Überschriften-Gewicht |
| `heading_transform` | `uppercase` | Überschriften-Transform |
| `heading_tracking` | `1px` | Überschriften-Buchstabenabstand |
| `font_base_size` | `16px` | Basis-Schriftgröße |

#### Tier 3: Charakter & Animation (9 Tokens)

| Setting Key | Brutalist-Default | Beschreibung |
|------------|-------------------|-------------|
| `border_radius` | `0` | Eckenrundung |
| `border_width` | `3px` | Dicke Rahmenbreite |
| `border_width_default` | `2px` | Standard-Rahmenbreite |
| `shadow_style` | `offset` | Shadow-Typ: `offset`, `blur`, `glow`, `none` |
| `shadow_color` | `#000000` | Shadow-Farbe |
| `hover_effect` | `translate` | Hover-Effekt: `translate`, `scale`, `glow`, `none` |
| `animation_speed` | `1` | Animations-Geschwindigkeit (Multiplikator) |
| `animation_easing` | `ease` | Easing-Funktion |
| `text_inverse` | `#ffffff` | Invertierte Textfarbe |

#### Sonstige

| Setting Key | Default | Beschreibung |
|------------|---------|-------------|
| `logo_url` | null | Eigenes Logo |
| `custom_css` | null | Custom CSS (max 10KB, sanitized) |

### Preset-System

5 vordefinierte Presets können als Ausgangspunkt gewählt werden:

| Preset | Charakter | Vorgeschlagen für |
|--------|-----------|-------------------|
| `brutalist` | Schwarz/Weiß, Offset-Shadows, Monospace, 0 Radius | Default, Custom |
| `sunless-sea` | Tiefsee-Blaugrün, Glow-Shadows, Serif, 6px Radius | Fantasy |
| `solarpunk` | Warmgelb/Grün, Blur-Shadows, Serif, 12px Radius | Utopian |
| `cyberpunk` | Neon-Orange/Dunkel, Glow-Shadows, Condensed, 2px Radius | Dystopian, Sci-Fi |
| `nordic-noir` | Kühles Grau, Blur-Shadows, Sans-Serif, 4px Radius | Historical |

### Anwendung der Theme-Tokens

ThemeService setzt CSS Custom Properties als Inline-Styles auf das `<velg-simulation-shell>` Host-Element (nicht auf `:root`). CSS-Vererbung leitet die Overrides an alle Kind-Komponenten weiter — auch durch Shadow DOM Grenzen.

```typescript
// SimulationShell ruft auf:
themeService.applySimulationTheme(simulationId, this);

// ThemeService setzt z.B.:
hostElement.style.setProperty('--color-primary', '#ff6b2b');
hostElement.style.setProperty('--font-brutalist', "'Arial Narrow', sans-serif");
```

Berechnete Tokens (`shadow_style` → 7 Shadow-Variablen, `animation_speed` → 4 Duration-Variablen) werden von ThemeService dynamisch generiert. Plattform-Level-Views (Dashboard, Login) verwenden immer die unveränderten Base-Tokens.

**Siehe:** `theming-system.md` für vollständige Architektur, Token-Mapping-Tabelle und Computed-Token-Logik.

---

## 6. Game Settings

Per-Simulation-Gameplay-Einstellungen. Werden in `simulation_settings` mit Kategorie `game` gespeichert.

| Setting Key | Default | Beschreibung |
|------------|---------|-------------|
| `critical_health_effects_enabled` | `false` (Forge-Default via Migration 121) | Kritische Health-Effekte (Entropy Overlay, Text Corruption, Card Distortion etc.) aktiviert. `get_bleed_status()` RPC liest diesen Wert — bei `false` wird `effects_suppressed: true` zurückgegeben. Admin kann per Simulation umschalten. Ohne Per-Simulation-Eintrag greift der globale `platform_settings`-Default (`true` = aktiviert). |

---

## 7. Access Settings

| Setting Key | Default | Beschreibung |
|------------|---------|-------------|
| `access.visibility` | "private" | public / private |
| `access.allow_registration` | false | Offene Registrierung erlauben |
| `access.default_role` | "viewer" | Standard-Rolle für neue Mitglieder |
| `access.invitation_expiry_hours` | 72 | Einladungs-Gültigkeit in Stunden |
| `access.max_members` | 100 | Maximale Mitgliederanzahl |

---

## Mapping: Hartcodierte Werte → Settings

| Bisher hartcodiert in | Wert | Neues Setting |
|----------------------|------|---------------|
| `config.py` AI_MODELS | 8 Modelle mit Params | `ai.models.*` |
| `config.py` IMAGE_MODELS | 3 Modelle | `ai.image_models.*` |
| `config.py` NEWS_TRANSFORMATION_PROMPT | Deutscher Prompt | `ai.prompts.news_transformation.de` |
| `config.py` FACEBOOK_PAGE_ID | "203648343900979" | `integration.facebook.page_id` |
| `config.py` GUARDIAN_API_KEY | Key | `integration.guardian.api_key` |
| `config.py` NEWSAPI_KEY | Key | `integration.newsapi.api_key` |
| DB `gender_type` ENUM | 4 Werte | `simulation_taxonomies(type='gender')` |
| DB `profession_type` ENUM | 10 Werte | `simulation_taxonomies(type='profession')` |
| DB `building_special_type` ENUM | 5 Werte | `simulation_taxonomies(type='building_special_type')` |
| DB CHECK `urgency_level` | 4 deutsche Werte | `simulation_taxonomies(type='urgency_level')` |
| DB CHECK `target_demographic` | 4 deutsche Werte | `simulation_taxonomies(type='target_demographic')` |
| DB CHECK `propaganda_type` | 6 englische Werte | `simulation_taxonomies(type='campaign_type')` |
| DB CHECK `zone_type` | 8 Werte | `simulation_taxonomies(type='zone_type')` |
| DB CHECK `security_level` | 4 Werte | `simulation_taxonomies(type='security_level')` |
| Frontend Design-Tokens CSS | 170+ Variables | `design.*` |
| Frontend "Velgarien" Texte | Hardcoded | `general.name` (dynamisch) |
| Backend Prompt-Templates | 22 Prompts | `prompt_templates` Tabelle |
| `image_service.py` | Dimensions, Steps | `ai.image_params.*` |
| `validation/strategy.py` | System-Liste, Typen | `simulation_taxonomies` |
