---
title: "AI Integration"
id: ai-integration
version: "2.3"
date: 2026-03-16
lang: de
type: spec
status: active
tags: [ai, openrouter, replicate, generation]
---

# 09 - AI Integration: Pipelines pro Simulation konfigurierbar

---

## Übersicht

Die AI-Integration wird vollständig pro Simulation konfigurierbar. Jede Simulation kann eigene Modelle, Prompts, Parameter und Sprach-Einstellungen definieren.

### AI-Provider

| Provider | Zweck | API |
|----------|-------|-----|
| **OpenRouter** | Text-Generierung (LLM) | `https://api.openrouter.com/api/v1/chat/completions` |
| **Replicate** | Bild-Generierung (Flux Dev) | `https://api.replicate.com/v1/predictions` |

### Auflösungs-Reihenfolge für AI-Konfiguration

```
1. Simulation-Setting (z.B. ai.models.agent_description)
2. Simulation-Default-Modell (z.B. ai.models.default)
3. Plattform-Default-Modell
```

---

## Text-Generierung

### Generierungs-Typen

| Typ | Beschreibung | Altsystem-Quelle |
|-----|-------------|------------------|
| `agent_generation` | Agent-Charakter + Hintergrund | generate_service.py:262-296 |
| `agent_reactions` | Reaktionen auf Events | generate_service.py + news_service.py |
| `building_generation` | Gebäude-Beschreibung | generate_service.py:553-559 |
| `portrait_description` | Portrait-Beschreibung für Bildgenerierung | generate_service.py:794-796 |
| `event_generation` | Event-Texte generieren | generate_service.py:915-917 |
| `chat_system_prompt` | Chat System-Prompt | generate_service.py:1246-1259 |
| `chat_with_memory` | Chat mit Konversations-Memory | generate_service.py:1410-1440 |
| `news_transformation` | News → Simulations-Event | news_service.py:437-453 |
| `news_agent_reaction` | Agent-Reaktion auf News | news_service.py:563-577 |
| `social_trends_campaign` | Kampagnen-Generierung | social_trends_service.py:579-602 |
| `social_media_transform` | Social Media Post transformieren | facebook_integration_prompts.py |
| `social_media_sentiment` | Sentiment-Analyse | facebook_integration_prompts.py |
| `social_media_agent_reaction` | Agent-Reaktion auf Social Media | facebook_integration_prompts.py |

### Prompt-Template-System

```python
class PromptResolver:
    """Löst Prompts für eine Simulation + Locale auf."""

    def resolve(self, simulation_id: UUID, template_type: str, locale: str = None) -> PromptTemplate:
        """
        Auflösungs-Reihenfolge:
        1. Simulation + gewünschtes Locale
        2. Simulation + Default-Locale der Simulation
        3. Plattform-Default + gewünschtes Locale
        4. Plattform-Default + 'en'
        """
        locale = locale or self.get_simulation_locale(simulation_id)

        # 1. Simulation + Locale
        template = self.db.get_template(simulation_id, template_type, locale)
        if template: return template

        # 2. Simulation + Default-Locale
        default_locale = self.get_simulation_locale(simulation_id)
        if locale != default_locale:
            template = self.db.get_template(simulation_id, template_type, default_locale)
            if template: return template

        # 3. Plattform-Default + Locale
        template = self.db.get_template(None, template_type, locale)
        if template: return template

        # 4. Plattform-Default + EN
        return self.db.get_template(None, template_type, 'en')
```

### Prompt-Template-Format

```python
# Beispiel: Agent-Generierung (Deutsch)
{
    "template_type": "agent_generation",
    "locale": "de",
    "prompt_content": """
Du bist ein Weltenbauer für die Simulation "{simulation_name}".
Erstelle einen detaillierten Charakter für einen Agenten:

Name: {agent_name}
System: {agent_system}
Geschlecht: {agent_gender}

Die Welt ist {simulation_theme_description}.

Erstelle:
1. Charakter (mindestens 100 Wörter): Persönlichkeit, Motivationen, Stärken, Schwächen
2. Hintergrund (mindestens 100 Wörter): Herkunft, Ausbildung, wichtige Lebensereignisse

Antworte auf {locale_name}.
Antworte im JSON-Format:
{{"character": "...", "background": "..."}}
""",
    "system_prompt": "Du bist ein kreativer Weltenbauer. Antworte immer auf {locale_name}.",
    "variables": ["simulation_name", "agent_name", "agent_system", "agent_gender",
                  "simulation_theme_description", "locale_name"]
}
```

### Sprach-Instruktion in Prompts

Jeder Prompt enthält eine explizite Sprach-Instruktion:

```python
def build_prompt(template: PromptTemplate, variables: dict, locale: str) -> str:
    """Baut den finalen Prompt mit Sprach-Instruktion."""
    # Locale-Name für menschliche Lesbarkeit
    locale_names = {"de": "Deutsch", "en": "English", "fr": "Français", ...}

    variables["locale_name"] = locale_names.get(locale, locale)
    variables["locale_code"] = locale

    # Template-Variablen ersetzen
    return template.prompt_content.format(**variables)
```

---

## Bild-Generierung

### Pipeline

```
1. Portrait/Building/Lore-Beschreibung generieren (Text-LLM)
2. Beschreibung als Prompt an Replicate senden
3. Negative Prompt aus Settings laden
4. Bild generieren (Flux Dev, Output-Format: PNG als verlustfreie Quelle)
5. Bild verarbeiten via image_service.py (AVIF, Qualität 85, Pillow 12.1.1 nativer Support, 1024px max)
6. In Supabase Storage hochladen
7. URL in Entity speichern
8. Lore-Bilder: `simulation_lore.image_generated_at = now()` setzen (via `section_id` Parameter, Migration 107) — ermoeglicht `get_forge_progress()` Lore-Bild-Tracking
```

### Fehlerbehandlung

| Fehlertyp | Klasse | Verhalten |
|-----------|--------|-----------|
| Billing/Credit-Fehler (402) | `ReplicateBillingError` | Gesamter Batch-Abbruch — kein Retry sinnvoll. Erkannt via Keywords (`billing`, `payment`, `spending limit`, `402`) in Replicate API-Response. |
| Modell-Fehler | `ReplicateError` | Einzelbild-Fehler geloggt, Batch faehrt fort mit naechstem Entity. |
| Sonstige Fehler | `Exception` | Einzelbild-Fehler geloggt, Batch faehrt fort. |

`run_batch_generation` umschliesst alle 4 Bildtypen (Banner → Portraits → Buildings → Lore) mit einem aeusseren `try/except ReplicateBillingError`. Innere Schleifen fangen `ReplicateBillingError` separat und re-raisen — generische `except Exception` Bloecke behandeln nur Nicht-Billing-Fehler.

### LLM Timeout Protection (`run_ai()`)

Zentraler Wrapper fuer alle `agent.run()`-Aufrufe in `ai_utils.py`. Verhindert unendliches Haengen bei OpenRouter-Ausfaellen.

**Mechanismus:** `run_ai()` injiziert `timeout` und `max_tokens` via `setdefault` in `model_settings`. pydantic-ai reicht `model_settings["timeout"]` an das OpenAI SDK weiter, das es als httpx-Timeout setzt. Bei Timeout wird `openai.APITimeoutError` geworfen → von bestehenden `except Exception`-Bloecken gefangen → Prozess faehrt fort.

**Centralized Timeouts (`PYDANTIC_AI_TIMEOUTS`):**

| Purpose | Timeout (s) | Max Tokens | Beschreibung |
|---------|-------------|------------|-------------|
| `research` | 90 | 2048 | Themen-Recherche (cheap model) |
| `anchors` | 120 | 3072 | 3 Philosophical Anchors (bilingual) |
| `chunk` | 180 | 12288 | Geography/Agents/Buildings |
| `lore` | 180 | 8192 | Lore Scroll (5-7 Sektionen) |
| `lore_translation` | 180 | 8192 | Lore DE-Uebersetzung |
| `dossier` | 300 | 16384 | Classified Dossier (~9000 Woerter) |
| `theme` | 90 | 2048 | Visual Theme (~30 Felder) |
| `translation` | 120 | 4096 | Entity-Uebersetzungs-Batch |
| `dossier_evolution` | 60 | 1024 | Dossier-Addendum (100-250 Woerter) |
| `entity` | 120 | 3072 | Einzel-Agent/Building |

**Observability:** Jeder `run_ai()`-Aufruf loggt:
- Start: `AI call started` mit `purpose`, `timeout_s`, `max_tokens`
- Erfolg: `AI call completed` mit `purpose`, `elapsed_s`
- Fehler: `AI call failed` mit `purpose`, `elapsed_s`, `exc_info=True`

**Batch Observability (`run_batch_generation`):**
- `batch_id`-Korrelation via structlog contextvars
- Phase A/B-Timing mit `elapsed_s`
- Pro-Bild Fortschritts-Logs: `Generating image {entity_type} {n}/{total}`
- Zusammenfassungs-Log: `Batch generation DONE` mit `total_elapsed_s`, `phase_a_s`, `phase_b_s`, `images_succeeded`, `images_failed`

**`safe_background()` Enhancement:** Loggt Start, Completion (mit Dauer), und Failure (mit Dauer + Sentry) fuer alle Background-Tasks.

### Konfigurierbare Parameter

| Parameter | Setting Key | Default |
|-----------|------------|---------|
| Modell | `ai.image_models.{purpose}` | black-forest-labs/flux-dev |
| Breite | `ai.image_params.width` | 512 |
| Höhe | `ai.image_params.height` | 512 |
| Guidance Scale | `ai.image_params.guidance_scale` | 3.5–5.0 (Flux-optimiert) |
| Inference Steps | `ai.image_params.num_inference_steps` | 50 |
| Output-Format | — | PNG (verlustfreie Quelle, Konvertierung zu AVIF via image_service.py) |
| Negative Prompt (Agent) | `ai.params.negative_prompt.agent` | "cartoon, anime, illustration, distorted..." |
| Negative Prompt (Building) | `ai.params.negative_prompt.building` | "people, humans, characters, faces..." |

**Wichtig:** Negative Prompts bleiben immer auf Englisch, da Flux englische Prompts erwartet. Flux Dev nutzt keine Scheduler-Parameter (anders als Stable Diffusion).

---

## Chat-System (direkte OpenRouter-API)

### Architektur

Das Chat-System nutzt direkte HTTP-Aufrufe an die OpenRouter-API (kein LangChain). Memory-Management erfolgt manuell ueber die `chat_messages`-Tabelle.

```
User Message
    │
    ▼
┌─────────────────────┐
│ Chat Service         │
│                     │
│ 1. Load Prompt      │ ← prompt_templates (chat_system_prompt + locale)
│ 2. Load Memory      │ ← chat_messages (letzte 50, manuell geladen)
│ 3. Build Context    │ ← Agent-Profil + Simulation-Kontext
│ 4. Call OpenRouter   │ ← Direkte API-Aufrufe (httpx), Modell aus Settings
│ 5. Save Response    │ ← chat_messages
│                     │
└─────────────────────┘
```

### Chat Memory (pro Simulation)

```python
class ChatService:
    """Chat-Service mit manueller Konversations-History."""

    async def get_conversation_history(
        self, conversation_id: UUID, limit: int = 50
    ) -> list[dict]:
        """Laedt die letzten N Nachrichten als Message-Array fuer OpenRouter."""
        messages = await self.db.get_messages(conversation_id, limit=limit)
        return [
            {"role": msg["sender_role"], "content": msg["content"]}
            for msg in messages
        ]

    def build_system_prompt(self, agent: Agent, simulation: Simulation) -> str:
        """Baut den System-Prompt aus Simulation-Settings."""
        template = self.prompt_resolver.resolve(
            simulation.id,
            'chat_system_prompt',
            simulation.locale
        )
        return template.format(
            agent_name=agent.name,
            agent_character=agent.character,
            agent_background=agent.background,
            simulation_name=simulation.name,
            locale_name=self.get_locale_name(simulation.locale)
        )
```

---

## Weitere AI-Pipelines

### Bot-Chat (`BotChatService`)

Dual-Mode-System fuer KI-gesteuerte Gegner in kompetitiven Epochen:

| Modus | Kosten | Latenz | Beschreibung |
|-------|--------|--------|-------------|
| **Template** | Kostenlos | Sofort | Muster-basierte Antworten mit Persoenlichkeits-Varianten |
| **LLM** | OpenRouter-Kosten | ~1-3s | Vollstaendige LLM-Generierung via OpenRouter |

Konfigurierbar pro Simulation ueber `bot_chat_mode` (Setting) und `model_bot_chat` (Modell-Auswahl). 5 Persoenlichkeits-Archetypen beeinflussen Chatstil und Tonfall: Sentinel (defensiv/analytisch), Warlord (aggressiv/direkt), Diplomat (kooperativ/diplomatisch), Strategist (kalkulierend/abstrakt), Chaos (unberechenbar/provokant).

### Epoch-Lore-Generierung (`EpochInvitationService`)

Generiert narrativ-gewuerzte Einladungstexte fuer Epochen via OpenRouter. Das generierte Lore wird in `game_epochs.config.invitation_lore` gecacht und in den E-Mail-Einladungen (SMTP, HTML-Template) verwendet. Prompt-Template: `epoch_invitation` (en/de).

### Echo-Transformations-Pipeline

Kreuz-Simulations-Event-Erzeugung fuer den Bleed-Mechanismus:

```
1. Event Echo genehmigen (approve)
2. AI-Generierung via GenerationService → Event-Text fuer Ziel-Simulation
3. Neues Event in Ziel-Simulation erstellen (via Admin-Client, umgeht RLS)
```

Verwendet `EchoService` mit probabilistischem Bleed-Threshold (konfigurierbar via `BleedSettingsPanel`). Vektor-Tag-Resonanz und Strength-Decay beeinflussen die Transformation.

### AI-Beziehungsgenerierung

Vollstaendige Pipeline fuer automatische Agent-Beziehungsvorschlaege:

```
1. GenerationService.generateRelationships(agent_id, locale)
2. POST /simulations/{sim_id}/generate/relationships
3. OpenRouter generiert Beziehungsvorschlaege basierend auf Agent-Profil + Simulation-Kontext
4. Frontend: Inline-Vorschlagskarten mit Checkboxen (alle vorausgewaehlt)
5. Benutzer waehlt aus → relationshipsApi.create() speichert ausgewaehlte
```

Genutzt im `AgentDetailsPanel`. Prompt-Template: `relationship_generation` (en/de). Jede Karte zeigt: Typ-Badge, Ziel-Agent-Name, Beschreibung, Intensitaets-Balken.

### Forge Phase II: Entity Generation (`ForgeOrchestratorService`)

Chunked world generation using **Pydantic AI** `output_type` with `Field(description=...)` for per-field quality guidance. Unlike the established `GenerationService` (which uses DB prompt templates), the Forge embeds generation instructions directly into Pydantic model field descriptions and a `_build_chunk_prompt()` function.

| Chunk Type | Output Type | Key Field Guidance |
|-----------|-------------|-------------------|
| `geography` | `ForgeGeographyDraft` | `ForgeZoneDraft` (name, zone_type, description, characteristics[2-4 tags]), `ForgeStreetDraft` (name, zone_name, street_type, description) |
| `agents` | `list[ForgeAgentDraft]` | `character`: 200-300 words, personality + physical impression for portrait gen. `background`: 200-300 words, origin + motivation + secret |
| `buildings` | `list[ForgeBuildingDraft]` | `description`: 150-250 words, materials + sensory details for image gen. `building_condition`: varies across set (pristine/good/fair/poor/ruined) |

**Prompt Strategy:** `_build_chunk_prompt()` assembles chunk-type-specific prompts including:
- User's seed prompt + philosophical anchor (title, core_question, description)
- Geographic context for agent/building chunks (city name, zone names from prior geography generation)
- Word-count guidance matching the DB prompt templates used by `GenerationService`
- Image-ready hints (physical impressions for portraits, architectural materials for building images)
- Diversity instructions (vary genders, factions, building conditions)

**System Prompt:** "Senior World Architect at the Bureau of Impossible Geography" — enforces tonal consistency and literary depth, prohibits generic fantasy/sci-fi.

**Downstream Impact:** Rich Phase II text feeds Phase IV image generation:
- `agent.character` + `agent.background` → `portrait_description` DB template → Replicate
- `building.description` + `building_condition` → `building_image_description` DB template → Replicate

### Forge Research Pipeline (`ResearchService`)

Zweistufige Web-Recherche die den BUREAU_ARCHIVIST_PROMPT mit drei Achsen realer Gruendung versorgt: literarische Genealogie, philosophisches Framework, architektonisches Vokabular.

**Phase 1 (Astrolabe) — `search_thematic_context()`:**
Dual-Achsen-Parallelsuche ueber `TavilySearchService`:
1. **Conceptual Overview**: Seed → encyclopedic domains (Wikipedia, Stanford Encyclopedia, Britannica) → advanced depth, 5 results
2. **Intellectual Traditions**: English-glossed seed + "philosophical literary context" → broad search → basic depth, 3 results

Fallback: Deterministischer Emulator mit 6 thematischen Linsen (Entropy, Memory, Surveillance, Liminality, Posthuman, Temporal Economics).

**Phase 4 (Ignition) — `research_for_lore()`:**
Zwei parallele Schritte:
1. **LLM Research Agent** (cheap model): Generiert Forschungsbrief mit drei Sektionen (LITERARY GENEALOGY, PHILOSOPHICAL FRAMEWORK, ARCHITECTURAL VOCABULARY)
2. **Tri-Achsen Tavily-Augmentation**: 3 parallele Suchen mit achsenspezifischen Queries und Domain-Targeting (Literary → theparisreview.org; Philosophy → plato.stanford.edu; Architecture → archdaily.com). 20s Timeout, 1 Retry.

Graceful Degradation: Partielle Ergebnisse bei partiellem Fehlschlag. Emulator-Fallback fuer lokale Entwicklung.

**Sentry Scope Context:** Alle Forge-Exception-Handler nutzen `sentry_sdk.push_scope()` mit `forge_phase` Tag und `forge` Context (simulation_id, draft_id, seed, entity_type etc.). Ermoeglicht Sentry-seitige Filterung nach Phase.

### Game-Mechanik-Integration in AI-Prompts

Berechnete Metriken aus materialisierten Views werden in AI-Generierungs-Prompts injiziert fuer kontextbewusste Ausgabe:

| Materialisierte View | Daten | Einfluss auf Prompts |
|---------------------|-------|---------------------|
| `mv_building_readiness` | Gebaeude-Zustand + Kapazitaets-Auslastung | Weltbeschreibung (verfallend vs. florierend) |
| `mv_zone_stability` | Zonen-Sicherheit + Aktivitaet | Event-Ton (ruhig vs. chaotisch) |
| `mv_embassy_effectiveness` | Diplomatische Beziehungen | Kreuz-Simulations-Kontext |
| `mv_simulation_health` | Gesamt-Gesundheitsbewertung | Narrativer Grundton |

---

## Alle 26 Prompts → Templates

### Prompt-Inventar

| # | Template-Type | Locale | Beschreibung |
|---|--------------|--------|-------------|
| 1 | `agent_generation_full` | en/de | Agent komplett generieren |
| 2 | `agent_generation_partial` | en/de | Agent teilweise generieren |
| 3 | `building_generation_named` | en/de | Gebäude mit Name |
| 4 | `building_generation` | en/de | Gebäude ohne Name |
| 5 | `portrait_description` | en/de | Portrait-Beschreibung |
| 6 | `event_generation` | en/de | Event generieren |
| 7 | `chat_system_prompt` | de | Chat System-Prompt |
| 8 | `chat_with_memory` | de | Chat mit Memory |
| 9 | `news_transformation` | de | News transformieren |
| 10 | `news_agent_reaction` | de | Agent-Reaktion auf News |
| 11 | `social_trends_campaign` | de | Kampagne generieren |
| 12 | `social_media_transform_dystopian` | de | FB Post dystopisch |
| 13 | `social_media_transform_propaganda` | de | FB Post Propaganda |
| 14 | `social_media_transform_surveillance` | de | FB Post Surveillance |
| 15 | `social_media_sentiment_detailed` | de | Sentiment detailliert |
| 16 | `social_media_sentiment_quick` | de | Sentiment schnell |
| 17 | `social_media_agent_reaction_character` | de | Agent-Reaktion (Charakter) |
| 18 | `social_media_agent_reaction_sentiment` | de | Agent-Reaktion (Sentiment) |
| 19 | `social_media_thread_analysis` | de | Thread-Analyse |
| 20 | `social_media_image_caption_dystopian` | de | Bild-Caption dystopisch |
| 21 | `social_media_image_caption_surveillance` | de | Bild-Caption Surveillance |
| 22 | `user_agent_description` | en/de | User-Agent Beschreibung |
| 23 | `relationship_generation` | en/de | Beziehungsvorschläge zwischen Agents generieren |
| 24 | `building_description_named` | en/de | Gebäude-Beschreibung mit Name |
| 25 | `building_description` | en/de | Gebäude-Beschreibung ohne Name |
| 26 | `embassy_prompt_template` | en/de | Botschafts-Beschreibung |

### Mock/Fallback-Templates

| # | Template-Typ | Beschreibung |
|---|-------------|-------------|
| M1 | `mock.agent_character` | 5 System-Varianten |
| M2 | `mock.agent_background` | 5 System-Varianten |
| M3 | `mock.portrait_roles` | 6 Rollen-Beschreibungen |
| M4 | `mock.building_descriptions` | 3 Typen × 3 Varianten |
| M5 | `mock.event_templates` | 4 Kategorien |
| M6 | `mock.social_trends` | 7 dystopische Trends |
| M7 | `mock.twitter_trends` | 3 Tech-Trends |
| M8 | `mock.forge_geography` | 8 Zonen (mit `characteristics`-Tags), 8 Straßen (mit `description`), 5 Stadtnamen. Seed-deterministische Auswahl |
| M9 | `mock.forge_agents` | 8 Agenten mit 2-3 Satz `character` (inkl. physische Eindrücke) und `background` (inkl. Geheimnis/Spannung). Variierte Geschlechter und Fraktionen |
| M10 | `mock.forge_buildings` | 9 Gebäude mit atmosphärischen `description`-Texten (150-250 Wörter), variierten `building_condition`-Werten (good/fair/poor) |

Alle Mock-Templates werden ebenfalls lokalisiert als Seed-Daten bereitgestellt (DE + EN).

**Forge Mock-Service (`forge_mock_service.py`):** Deterministisches Mock-System für `FORGE_MOCK_MODE=true`. Seed-aware Auswahl via SHA-256 Hash. Alle 4 Forge-Phasen abgedeckt: Research + Anchors (M8), Geography/Agents/Buildings (M9-M10), Theme (2 komplette Presets), Lore (5 Sektionen + DE-Übersetzungen), Entity-Translations. Seit Migration 112: Alle Mock-Daten enthalten bilingual `_de`-Felder (z.B. `primary_profession_de`, `description_de`, `core_question_de`).

---

## Generierungs-Service (Simulation-aware)

```python
class GenerationService:
    """AI-Generierungs-Service mit Simulation-Kontext."""

    def __init__(self, simulation_context: SimulationContext):
        self.sim = simulation_context
        self.prompt_resolver = PromptResolver(simulation_context)
        self.model_resolver = ModelResolver(simulation_context)

    async def generate_agent(self, agent_data: dict) -> dict:
        # 1. Prompt laden
        template = self.prompt_resolver.resolve('agent_generation')

        # 2. Modell laden
        model = self.model_resolver.resolve('agent_description')

        # 3. Variablen füllen
        variables = {
            'simulation_name': self.sim.simulation.name,
            'simulation_theme_description': self.sim.get_theme_description(),
            'agent_name': agent_data['name'],
            'agent_system': agent_data.get('system', ''),
            'agent_gender': agent_data.get('gender', ''),
            'locale_name': self.sim.get_locale_name(),
        }

        # 4. Prompt bauen
        prompt = template.format(**variables)

        # 5. LLM aufrufen
        response = await self.call_llm(
            model=model.model_id,
            prompt=prompt,
            system_prompt=template.system_prompt,
            temperature=model.temperature,
            max_tokens=model.max_tokens
        )

        return self.parse_response(response)
```

---

## Fehler-Handling & Fallbacks

### Model Fallback

```python
async def call_llm_with_fallback(self, model, prompt, **kwargs):
    try:
        return await self.call_llm(model, prompt, **kwargs)
    except RateLimitError:
        # Fallback zum konfigurierten Fallback-Modell
        fallback = self.model_resolver.resolve('fallback')
        return await self.call_llm(fallback.model_id, prompt, **kwargs)
    except ModelUnavailableError:
        # Plattform-Default verwenden
        default = self.get_platform_default_model()
        return await self.call_llm(default, prompt, **kwargs)
```

### Prompt Fallback

```
1. Simulation-Template (gewünschte Sprache) → gefunden → verwenden
2. Simulation-Template (Default-Sprache) → gefunden → verwenden
3. Plattform-Default (gewünschte Sprache) → gefunden → verwenden
4. Plattform-Default (EN) → immer vorhanden
5. Hardcoded Fallback → nur als letzte Absicherung
```
