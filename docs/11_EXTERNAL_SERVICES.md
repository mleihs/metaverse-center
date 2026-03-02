# 11 - External Services: Pro Simulation konfigurierbar

**Version:** 1.0
**Datum:** 2026-02-15

---

## Übersicht

Alle externen Services sind pro Simulation konfigurierbar. Jede Simulation kann eigene API-Keys, Accounts und Konfigurationen für externe Dienste haben.

```
Plattform-Defaults (Fallback)
    │
    ▼
┌─────────────────────┐
│ Simulation Settings  │
│ (Integration Tab)    │
├─────────────────────┤
│ Facebook Integration │ ← Eigene Page pro Simulation
│ News-APIs            │ ← Eigene Keys möglich
│ AI-Provider          │ ← Override möglich
│ Storage              │ ← Shared (Supabase)
└─────────────────────┘
```

---

## 1. Facebook Graph API

### Konfiguration pro Simulation

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.facebook.enabled` | Integration aktiv | Nein |
| `integration.facebook.page_id` | Facebook Page ID | Nein |
| `integration.facebook.access_token` | Page Access Token | **Ja** |
| `integration.facebook.api_version` | API Version | Nein |
| `integration.facebook.sync_interval_minutes` | Sync-Intervall | Nein |
| `integration.facebook.auto_transform` | Auto-Transformation | Nein |

### Features

| Feature | Endpoint | Beschreibung |
|---------|----------|-------------|
| Posts importieren | `GET /{page-id}/feed` | Posts von der konfigurierten Page |
| Kommentare laden | `GET /{post-id}/comments` | Kommentare eines Posts |
| Post-Details | `GET /{post-id}` | Einzelner Post mit Reactions |
| Bild-URLs | `GET /{post-id}/attachments` | Medien-Anhänge |

### Altsystem-Referenz

```python
# config.py (Alt)
FACEBOOK_PAGE_ACCESS_TOKEN = "EAA..."
FACEBOOK_PAGE_ID = "203648343900979"
FACEBOOK_API_VERSION = "v23.0"
USE_FACEBOOK_MOCK_DATA = True

# Neu: Aus simulation_settings laden
facebook_config = settings_service.get_integration(simulation_id, 'facebook')
```

### Transformation-Pipeline

```
1. Posts von Facebook importieren
2. Sentiment-Analyse durchführen (AI)
3. Posts in Simulations-Kontext transformieren (AI)
   - Transformation-Typ aus Simulation-Settings
   - Prompt aus prompt_templates (lokalisiert)
4. Agenten-Reaktionen generieren (AI)
5. Optional: Als Event integrieren
```

---

## 2. News-APIs

### The Guardian API

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.guardian.enabled` | Integration aktiv | Nein |
| `integration.guardian.api_key` | API Key | **Ja** |
| `integration.guardian.default_section` | Standard-Sektion | Nein |
| `integration.guardian.max_results` | Max Ergebnisse pro Abfrage | Nein |

**API:** `https://open-platform.theguardian.com/search`
**Rate Limit:** Abhängig vom API-Tier (Free: 12 Requests/Sekunde)

### NewsAPI

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.newsapi.enabled` | Integration aktiv | Nein |
| `integration.newsapi.api_key` | API Key | **Ja** |
| `integration.newsapi.sources` | Bevorzugte Quellen | Nein |
| `integration.newsapi.language` | Sprach-Filter | Nein |

**API:** `https://newsapi.org/v2/everything`
**Rate Limit:** Free: 100 Requests/Tag

### News-Transformation-Flow

```
1. Trends von Guardian/NewsAPI abrufen
2. In social_trends Tabelle speichern
3. Relevanz-Score berechnen
4. Optional: In Simulations-Kontext transformieren (AI)
   - news_transformation Prompt (lokalisiert)
5. Optional: Als Kampagne integrieren
6. Optional: Als Event mit Agent-Reaktionen erstellen
```

---

## 3. Replicate API (Bildgenerierung)

### Konfiguration

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.replicate.api_key` | API Token (Override) | **Ja** |
| `ai.image_models.agent_portrait` | Modell für Portraits | Nein |
| `ai.image_models.building_image` | Modell für Gebäude | Nein |
| `ai.image_params.*` | Generierungs-Parameter | Nein |

**API:** `https://api.replicate.com/v1/predictions`
**Auth:** `Authorization: Token {api_key}`

### Altsystem-Referenz

```python
# config.py (Alt)
REPLICATE_API_TOKEN = "r8_..."
IMAGE_MODELS = {
    "agent_portrait": {
        "model": "stability-ai/stable-diffusion",
        "version": "ac732df83cea7fff2b7cf1003e0b4b7a9...",
        "scheduler": "K_EULER"
    }
}

# image_service.py (Alt)
DEFAULT_WIDTH = 512
DEFAULT_HEIGHT = 512
DEFAULT_GUIDANCE_SCALE = 7.5
DEFAULT_NUM_INFERENCE_STEPS = 50
```

### Bild-Verarbeitung

```
1. Replicate Prediction erstellen
2. Poll bis Status "succeeded" (max 600s)
3. Bild-URL herunterladen
4. In WebP konvertieren (Qualität 85)
5. Max 1024px Resize
6. In Supabase Storage hochladen
7. Öffentliche URL generieren
```

### Storage Buckets

| Bucket | Zweck |
|--------|-------|
| `agent.portraits` | Agent-Portraits |
| `user.agent.portraits` | User-Agent-Portraits |
| `building.images` | Gebäude-Bilder |
| `simulation.assets` | Allgemeine Simulations-Assets (NEU) |

---

## 4. OpenRouter API (LLM-Proxy)

### Konfiguration

| Setting | Beschreibung | Verschlüsselt |
|---------|-------------|---------------|
| `integration.openrouter.api_key` | API Key (Override) | **Ja** |
| `ai.models.*` | Modelle pro Zweck | Nein |
| `ai.params.*` | Parameter pro Modell | Nein |

**API:** `https://api.openrouter.com/api/v1/chat/completions`
**Auth:** `Authorization: Bearer {api_key}`

### Modell-Katalog (Velgarien-Defaults)

| Modell | Zweck | Temp | Max Tokens |
|--------|-------|------|------------|
| deepseek/deepseek-chat-v3-0324 | Agent-Beschreibungen | 0.8 | 300 |
| meta-llama/llama-3.3-70b-instruct:free | Reaktionen, Buildings | 0.7 | 100-250 |
| meta-llama/llama-3.2-3b-instruct:free | News-Transformation | 0.8 | 300 |
| shisa-ai/shisa-v2-llama3.3-70b:free | Fallback | 0.7 | 500 |

### Fehler-Handling

| HTTP Status | Aktion |
|------------|--------|
| 200 | Erfolg |
| 429 | Rate Limit → Fallback-Modell verwenden |
| 500 | Provider-Fehler → Retry (1x), dann Fallback |
| 503 | Service Unavailable → Plattform-Default-Modell |

---

## 5. Supabase (Datenbank + Auth + Storage + Realtime)

### Hybrid-Architektur

Supabase ist die zentrale Plattform-Infrastruktur. **Entscheidend:** Frontend und Backend greifen unterschiedlich auf Supabase zu:

| Dienst | Zugriff durch | Wie |
|--------|---------------|-----|
| **Auth** | Frontend direkt | `@supabase/supabase-js` mit Anon Key |
| **Storage** (User-Uploads) | Frontend direkt | Supabase Storage Client mit Auth-JWT |
| **Storage** (AI-Bilder) | Backend | Service Key (AI-Pipeline) |
| **Realtime** | Frontend direkt | Supabase Realtime Client mit Auth-JWT |
| **PostgreSQL** (Lesen/Schreiben) | Backend (FastAPI) | Anon Key + User-JWT → **RLS aktiv** |
| **PostgreSQL** (Admin/System) | Backend (FastAPI) | Service Key → RLS bypassed (sparsam!) |

### Konfiguration

| Variable | Wer nutzt es | Beschreibung |
|----------|-------------|-------------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Frontend + Backend | Projekt-URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Frontend (direkt) + Backend (mit User-JWT) | Öffentlicher Key |
| `SUPABASE_SERVICE_KEY` | Backend (nur Admin/System-Ops) | Service Key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | Backend | JWT-Validierung (aus Supabase Dashboard) |

Siehe **10_AUTH_AND_SECURITY.md** für die vollständige Hybrid-Architektur und Defense-in-Depth-Strategie.

---

## Service-Auflösung pro Simulation

```python
from fastapi import Depends
from pydantic import BaseModel
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Plattform-Defaults aus Umgebungsvariablen (pydantic-settings)."""
    openrouter_api_key: str
    replicate_api_token: str
    class Config:
        env_file = ".env"

settings = Settings()


class ExternalServiceResolver:
    """Löst externe Service-Konfiguration pro Simulation auf."""

    def __init__(self, simulation_id: UUID, settings_service: SettingsService):
        self.sim_id = simulation_id
        self.settings = settings_service

    def get_facebook_config(self) -> Optional[FacebookConfig]:
        if not self.settings.get('integration.facebook.enabled', False):
            return None
        return FacebookConfig(
            page_id=self.settings.get('integration.facebook.page_id'),
            access_token=self.settings.get_encrypted('integration.facebook.access_token'),
            api_version=self.settings.get('integration.facebook.api_version', 'v23.0')
        )

    def get_news_config(self, source: str) -> Optional[NewsConfig]:
        key = f'integration.{source}'
        if not self.settings.get(f'{key}.enabled', False):
            return None
        return NewsConfig(
            api_key=self.settings.get_encrypted(f'{key}.api_key'),
            source=source
        )

    def get_openrouter_key(self) -> str:
        """Simulation-Key oder Plattform-Default."""
        sim_key = self.settings.get_encrypted('integration.openrouter.api_key')
        return sim_key or settings.openrouter_api_key

    def get_replicate_key(self) -> str:
        """Simulation-Key oder Plattform-Default."""
        sim_key = self.settings.get_encrypted('integration.replicate.api_key')
        return sim_key or settings.replicate_api_token


# FastAPI Dependency
async def get_service_resolver(
    simulation_id: UUID,
    settings_service: SettingsService = Depends(get_settings_service)
) -> ExternalServiceResolver:
    return ExternalServiceResolver(simulation_id, settings_service)


# Verwendung in Routers:
@router.get("/facebook/posts")
async def get_facebook_posts(
    resolver: ExternalServiceResolver = Depends(get_service_resolver)
):
    config = resolver.get_facebook_config()
    if not config:
        raise HTTPException(404, detail="Facebook integration not enabled")
    ...
```
