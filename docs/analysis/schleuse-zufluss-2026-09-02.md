---
title: "Der Zufluss der Schleuse — Reddit, Bluesky und was stattdessen da ist"
date: "2026-09-02"
type: analysis
status: measured
lang: de
tags: [schleuse, event-intake, news-scanner, social-trends, bluesky, reddit, prod-measurement]
---

# Der Zufluss der Schleuse — Ist-Zustand am 02.09.2026

**Anlass:** die Frage, ob Reddit und Bluesky für den Nachrichten-/Themenimport
verdrahtet sind.

**Kurze Antwort:** nein. Reddit existiert im gesamten Backend nicht — null
Zeilen. Bluesky existiert, aber ausschliesslich in der Gegenrichtung: es
veröffentlicht, es liest nicht. Beide tauchen in Plan und Prototyp der Schleuse
als „Sozialquellen" auf; im Code gibt es sie nicht.

**Der grössere Befund daneben:** der Substrate-Scanner hat auf Produktion noch
**nie gelaufen**. `news_scan_candidates` und `news_scan_log` sind leer — nicht
„wenige Zeilen", sondern null. `news_scanner_enabled` steht seit dem
09.03.2026 auf `false`.

Alle Zahlen unten sind am 02.09.2026 gegen die Produktionsdatenbank
(`bffjoupddfjaljqrwqck`) und gegen `main` gemessen, nicht aus Dokumenten
übernommen.

---

## 1. Reddit

| Ort | Treffer |
|---|---|
| `backend/**/*.py` | **0** |
| `supabase/migrations/**` | 0 |
| `content/**` | 0 |
| `frontend/src/**/*.ts` | **1** — `SOCIAL_ADAPTERS` in `types/intake.ts` |

Der einzige Treffer im ganzen Repository ist eine Menge, die ich selbst am
02.09. beim Bau der Schleuse angelegt habe:

```ts
const SOCIAL_ADAPTERS = new Set(['reddit', 'bluesky']);
```

Sie wird von `sourceKindOf()` gelesen und ordnet eine Quelle der Klasse
`social` zu. Da kein Adapter dieses Namens existiert, ist der Zweig
**unerreichbar** — die Klasse `social` kann heute nicht eintreten. Der Test,
der `sourceKindOf('reddit') === 'social'` prüft, prüft damit einen Zustand, den
es nicht gibt.

Es gibt also keinen Reddit-Import, keinen Reddit-Adapter, keine
Reddit-Zugangsdaten und keine Stelle, an der einer angeschlossen wäre.

## 2. Bluesky — vorhanden, aber in der anderen Richtung

Bluesky ist real und aktiv, nur nicht als Quelle. `BlueskyService`
(`backend/services/external/bluesky.py`) kann genau das:

| Methode | AT-Protocol-Aufruf | Richtung |
|---|---|---|
| `_create_session` / `_refresh_session` | `com.atproto.server.createSession` | — |
| `publish_post` | `com.atproto.repo.createRecord` | **raus** |
| `upload_media` | `com.atproto.repo.uploadBlob` | **raus** |
| `delete_post` | `com.atproto.repo.deleteRecord` | **raus** |
| `get_post_metrics` | `app.bsky.feed.getPosts` | rein, aber nur für **eigene** Posts |
| `validate_credentials` | — | — |

Kein `app.bsky.feed.searchPosts`, kein `getTimeline`, kein `getAuthorFeed` für
fremde Konten. Die einzige lesende Methode holt Likes und Reposts zu Beiträgen,
die die Plattform selbst veröffentlicht hat.

Der Router bestätigt das Bild — `backend/routers/bluesky.py` hat acht
Endpunkte, und alle acht bedienen eine Ausgangs-Warteschlange:

    GET  /queue · GET /queue/{id} · POST /queue/{id}/skip · /unskip · /publish
    GET  /analytics · GET /settings · GET /status

Auf Prod ist dieser Weg **eingeschaltet**: `bluesky_enabled`,
`bluesky_posting_enabled` und `bluesky_auto_crosspost` stehen auf `true`,
Handle `bureau-imposs-geo.bsky.social`, Takt 300 s. Das ist die
Instagram→Bluesky-Kreuzveröffentlichung aus `CLAUDE.md`, nicht ein Zufluss.

> ⚠ **Nebenbefund (Sicherheit):** `bluesky_app_password` liegt in
> `platform_settings` im **Klartext**, während `instagram_access_token` in
> derselben Tabelle Fernet-verschlüsselt liegt (`gAAAAA…`). Zwei Geheimnisse
> derselben Tabelle mit zwei verschiedenen Schutzgraden — das ist keine
> Entscheidung, das ist eine Lücke. Ein Bluesky-App-Passwort erlaubt
> Veröffentlichen und Löschen unter der Kennung des Bureaus.

## 3. Was der Zufluss stattdessen hat

### 3a. Der Scanner — zehn Adapter, keiner sozial

`backend/services/scanning/adapters/`, ausgelesen über die Registry:

| Adapter | strukturiert | Schlüssel nötig | Kategorien |
|---|---|---|---|
| `usgs_earthquakes` | ja | – | natural_disaster |
| `noaa_alerts` | ja | – | natural_disaster |
| `nasa_eonet` | ja | – | natural_disaster, environmental_disaster |
| `gdacs` | ja | – | natural_disaster |
| `disease_sh` | ja | – | pandemic |
| `who_outbreaks` | nein | – | pandemic |
| `hackernews` | nein | – | tech_breakthrough |
| `gdelt` | nein | – | economic_crisis, military_conflict, … |
| `guardian` | nein | **ja** (`guardian_api_key`) | economic_crisis, military_conflict, … |
| `newsapi` | nein | **ja** (`newsapi_api_key`) | economic_crisis, military_conflict, … |

Auf Prod sind fünf davon ausgewählt (`news_scanner_adapters`, gesetzt
09.03.2026):

    usgs_earthquakes · noaa_alerts · nasa_eonet · gdacs · guardian

### 3b. Der Browse-Weg — zwei Quellen, hart begrenzt

`POST /simulations/{id}/social-trends/browse` nimmt genau zwei Werte an. Die
Grenze steht im Pydantic-Modell als Muster, ein dritter Wert ist ein 422:

```python
source: str = Field(default="guardian", pattern=r"^(guardian|newsapi)$")
```

Dieselbe Begrenzung in `fetch`, dieselbe im Auswahlfeld der Oberfläche
(`SocialTrendsView.ts`: zwei `<option>`, „The Guardian" und „NewsAPI").

---

## 4. Was auf Produktion tatsächlich liegt

```
social_trends            12 Zeilen · alle platform='guardian'
                         · 16.–17.02.2026, seither nichts (197 Tage)
news_scan_candidates      0 Zeilen
news_scan_log             0 Zeilen
```

Der Scanner hat also nicht „wenig" geliefert, sondern **nie etwas**. Der Grund
steht in den Riegeln:

| Schlüssel | Wert | gesetzt am |
|---|---|---|
| `news_scanner_enabled` | **`false`** | 09.03.2026 |
| `news_scanner_interval_seconds` | 21600 (6 h) | 09.03.2026 |
| `news_scanner_auto_create` | `false` | 09.03.2026 |
| `news_scanner_min_magnitude` | 0.2 | 09.03.2026 |
| `news_scanner_adapters` | 5 Namen (s. o.) | 09.03.2026 |

### Und ein zweiter Riegel dahinter

`platform_settings` enthält **überhaupt keine** `*_api_key`-Zeile — weder
`guardian_api_key` noch `newsapi_api_key`. Der Scanner liest seine Schlüssel
aber ausschliesslich von dort (`ScannerService._load_config`, Z. 131–145).

Das heisst: **`news_scanner_enabled = true` allein genügt nicht.** Danach
liefen die vier schlüssellosen Messdienste (USGS, NOAA, NASA, GDACS), und der
Guardian-Adapter meldete `available: false` — in der Sensor-Leiste der
Schleuse als rote Kachel „kein Key".

Die Guardian-Schlüssel liegen an einer anderen Stelle: **pro Welt**, in
`simulation_settings`, Kategorie `integration`, Fernet-verschlüsselt:

    Velgarien             16.02.2026
    Velgarien (Epoch 3)   10.03.2026
    Velgarien (Epoch 4)   14.03.2026
    Velgarien (Epoch 5)   18.03.2026

Vier Zeilen, alle derselbe Geheimtext, alle zur Welt „Velgarien" und ihren
Epochen-Kopien. Die anderen zwölf Welten haben keinen. Das erklärt zugleich,
warum die 12 Trends alle in Velgarien liegen: **der Browse-Weg ist
weltgebunden und funktioniert nur dort, wo ein Schlüssel hinterlegt ist.**

> 🔑 Zwei Wege, zwei Orte für denselben Schlüssel. Der Browse-Weg liest ihn
> über `ExternalServiceResolver(supabase, simulation_id)` aus
> `simulation_settings`; der Scanner liest ihn aus `platform_settings`. Wer den
> einen einträgt, hat den anderen nicht. Das ist keine Konfiguration, das ist
> eine Falle.

---

## 5. Was das für die Schleuse heisst

1. **Die Sensor-Leiste zeigt zehn Kacheln, keine davon sozial.** Die Klasse
   `social` (grau, „liefert nur Tempo und Reichweite") kann nicht auftreten.
2. **Die Abnahmebedingung des Bauplans zu Sozialquellen ist weder erfüllbar
   noch verletzbar.** Der Plan verlangt für Schritt 5 (Sichtung):
   *„Sozialquellen erscheinen nur als Chips an Geschichten oder im Rauschen,
   nie als eigene Zeile."* Es gibt keine Sozialquelle, also auch keine Zeile,
   keinen Chip und kein Rauschen. Der Punkt ist beim Bau von Schritt 5 als
   **nicht anwendbar** zu führen, nicht als erledigt.
3. **Das Feld `socialVolume` auf `IntakeSignal` steht dauerhaft auf 0**, und
   `sources[]` bleibt einelementig (das ist Lücke 2 im Plan, Story-Bündelung).
   Eine Sortierung „Netz-Tempo" hätte heute nichts zu sortieren.
4. **Kammer ① und ② bleiben leer**, solange der Scanner aus ist und der
   Browse-Weg 502 liefert. Das ist der Grund, warum Schritt 3 und 4 nur gegen
   den Code geprüft sind und nicht am Schirm.

---

## 6. Die Reihenfolge, in der der Zufluss aufginge

Nach steigendem Aufwand, jeder Schritt für sich prüfbar:

1. **`guardian_api_key` in `platform_settings` eintragen.** Eine Zeile. Danach
   hat der Scanner fünf brauchbare Adapter statt vier.
2. **Den Guardian-502 im Backend-Log nachsehen.** Der Browse-Weg hat am
   16.02. funktioniert und tut es heute nicht; der Schlüssel ist da, also ist
   es etwas anderes (abgelaufener Schlüssel, Guardian-seitige Änderung,
   Fernet-Schlüsselwechsel). **Offen, Log noch nicht angesehen.**
3. **`news_scanner_enabled = true`.** Erst nach 1 und 2, und mit Blick auf die
   Kandidatenliste im ersten Zyklus — `auto_create` steht auf `false`, es
   entsteht also nichts ohne einen Menschen. Rückholbar durch Zurückstellen
   des Riegels.
4. **Ein Reddit-Adapter**, falls die Sozialquellen wirklich gewollt sind.
   Reddits API verlangt seit 2023 OAuth und ein registriertes Skript-Konto;
   das ist ein Adapter plus zwei Einstellungen plus die Regel, dass er nie
   einen eigenen Kandidaten erzeugt, sondern nur `social_volume` an einer
   bestehenden Geschichte erhöht. Diese Regel hat heute keinen Speicherort
   (Lücke 2) — sie kommt also **nach** der Story-Bündelung, nicht davor.
5. **Bluesky als Quelle** wäre der kleinere Schritt von beiden: die Sitzung
   und der XRPC-Unterbau stehen schon in `BlueskyService`, es fehlt eine
   Methode `search_posts` (`app.bsky.feed.searchPosts`) und derselbe
   Adapter-Rahmen. Dieselbe Reihenfolge-Bedingung wie bei Reddit.

---

## 7. Belege

Alles hier ist eine Messung. Zum Nachvollziehen:

```bash
# Adapter, die es wirklich gibt
.venv/bin/python -c "
import backend.services.scanning.adapters
from backend.services.scanning.registry import get_adapter_info
print([r['name'] for r in get_adapter_info()])"

# Reddit im Backend
grep -rn reddit --include='*.py' backend/     # 0 Treffer

# Prod (nur SELECT), Zugang: ~/.config/metaspots/SUPABASE-ACCESS.md
select platform, count(*) from social_trends group by 1;
select count(*) from news_scan_candidates;
select count(*) from news_scan_log;
select setting_key, setting_value from platform_settings
  where setting_key like 'news_scanner%';
select setting_key from platform_settings where setting_key like '%api_key%';
```
