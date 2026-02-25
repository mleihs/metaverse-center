# 09 - AI Integration: Pipelines pro Simulation konfigurierbar

**Version:** 1.1
**Datum:** 2026-02-25
**Aenderung v1.1:** Replicate Flux Dev (`black-forest-labs/flux-dev`) als Standard-Bildmodell fuer alle Simulationen. 4 Generierungs-Scripts: `generate_velgarien_images.py` (8+6), `generate_capybara_images.py` (5+5), `generate_station_null_images.py` (6+7), `generate_dashboard_images.py` (1 Hero + 3 Banner). Workflow: lokal generieren → via REST API zu Production transferieren.

---

## Übersicht

Die AI-Integration wird vollständig pro Simulation konfigurierbar. Jede Simulation kann eigene Modelle, Prompts, Parameter und Sprach-Einstellungen definieren.

### AI-Provider

| Provider | Zweck | API |
|----------|-------|-----|
| **OpenRouter** | Text-Generierung (LLM) | `https://api.openrouter.com/api/v1/chat/completions` |
| **Replicate** | Bild-Generierung (Stable Diffusion) | `https://api.replicate.com/v1/predictions` |

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
1. Portrait/Building-Beschreibung generieren (Text-LLM)
2. Beschreibung als Prompt an Replicate senden
3. Negative Prompt aus Settings laden
4. Bild generieren (Stable Diffusion)
5. Bild verarbeiten (WebP, 1024px max)
6. In Supabase Storage hochladen
7. URL in Entity speichern
```

### Konfigurierbare Parameter

| Parameter | Setting Key | Default |
|-----------|------------|---------|
| Modell | `ai.image_models.{purpose}` | stability-ai/stable-diffusion |
| Breite | `ai.image_params.width` | 512 |
| Höhe | `ai.image_params.height` | 512 |
| Guidance Scale | `ai.image_params.guidance_scale` | 7.5 |
| Inference Steps | `ai.image_params.num_inference_steps` | 50 |
| Scheduler | `ai.image_params.scheduler` | K_EULER |
| Negative Prompt (Agent) | `ai.params.negative_prompt.agent` | "cartoon, anime, illustration, distorted..." |
| Negative Prompt (Building) | `ai.params.negative_prompt.building` | "people, humans, characters, faces..." |

**Wichtig:** Negative Prompts bleiben immer auf Englisch, da Stable Diffusion englische Prompts erwartet.

---

## Chat-System mit LangChain

### Architektur

```
User Message
    │
    ▼
┌─────────────────────┐
│ Chat Service         │
│                     │
│ 1. Load Prompt      │ ← prompt_templates (chat_system_prompt + locale)
│ 2. Load Memory      │ ← chat_messages (letzte 50)
│ 3. Build Context    │ ← Agent-Profil + Simulation-Kontext
│ 4. Call LLM         │ ← OpenRouter (Modell aus Settings)
│ 5. Save Response    │ ← chat_messages
│                     │
└─────────────────────┘
```

### LangChain Memory (pro Simulation)

```python
class SimulationChatMemory(BaseMemory):
    """Chat Memory mit Simulation-Kontext."""

    simulation_id: UUID
    conversation_id: UUID
    max_messages: int = 50

    def load_memory_variables(self, inputs: dict) -> dict:
        messages = self.db.get_messages(
            self.conversation_id,
            limit=self.max_messages
        )
        return {"history": self._format_messages(messages)}

    def _build_system_prompt(self, agent: Agent) -> str:
        # Prompt aus Simulation-Settings laden
        template = self.prompt_resolver.resolve(
            self.simulation_id,
            'chat_system_prompt',
            self.simulation_locale
        )
        return template.format(
            agent_name=agent.name,
            agent_character=agent.character,
            agent_background=agent.background,
            simulation_name=self.simulation_name,
            locale_name=self.locale_name
        )
```

---

## Alle 22 Prompts → Templates

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

Alle Mock-Templates werden ebenfalls lokalisiert als Seed-Daten bereitgestellt (DE + EN).

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
