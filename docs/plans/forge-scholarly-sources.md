---
title: "Die Gattungsgrenze der Schmiede-Recherche"
id: doc-forge-scholarly-sources
version: 1.0
lang: de
type: plan
status: draft
date: 2026-09-04
tags: [forge, research, tavily, openalex, sources, provenance]
---

# Die Gattungsgrenze der Schmiede-Recherche

> **Regel dieses Dokuments.** Die Recherche der Schmiede (Astrolabium Schritt 1,
> Lore-Recherche Phase 4) zieht als Belege nur drei Gattungen heran: belletristische
> und literaturkritische Werke, philosophische Schriften, begutachtete
> Fachliteratur. Alles Uebrige — Videoplattformen, Fanwikis, soziale Netze,
> Spiele- und Brettspielportale, Frage-Antwort-Foren, Verkaufsseiten — ist keine
> Quelle im Sinne dieses Systems.

## 0. Der Anlass, in Zahlen

Ein Produktionslauf lieferte unter der Achse `CONCEPTUAL OVERVIEW` fuenf Quellen:
ein YouTube-Video zu einem Brettspiel, ein Fandom-Wiki, ein Facebook-Beitrag, ein
Verlagstext und eine wissenschaftliche Arbeit. Unter `INTELLECTUAL TRADITIONS`
drei Feuilletonbesprechungen.

Die Achse `CONCEPTUAL OVERVIEW` **hat** eine Domainliste
(`research_domains_encyclopedic` = Wikipedia, SEP, Britannica). Sie hat nicht
gewirkt. Das ist der eigentliche Befund.

## 1. Befund A — `include_domains` ist ohne `include_domains_mode` **keine** Schranke

Gemessen am 2026-09-04 gegen die Tavily-API, gleiche Anfrage, gleicher Seed,
gleiche drei Domains:

| Aufruf | Parameter | Treffer aus der Liste |
|---|---|---|
| A | `include_domains=[wikipedia, plato, britannica]` | **2 von 5** — dabei `facebook.com`, `edubloxtutor.com`, ein Blog |
| D | dieselbe Liste **+ `include_domains_mode="filter"`** | **5 von 5** |

Tavily kennt zwei Betriebsarten: `filter` (harte Schranke) und `boost` (nur
Rangfolge). Der Python-Client 0.7.27 fuehrt `include_domains_mode` nicht in
seiner Signatur — der Parameter geht nur ueber `**kwargs` durch. Er wird heute
an keiner Stelle gesetzt, also gewichtet die Liste bloss und schliesst nichts
aus.

**Folge:** Der Admin-Bereich *Forschung* verwaltet seit Migration 124 vier
Domainlisten, die nie eine Schranke waren. Wer dort etwas eintrug, hat eine
Empfehlung ausgesprochen, keine Regel.

## 2. Befund B — die Achse `INTELLECTUAL TRADITIONS` hat gar keine Liste

`research_service.py` setzt fuer die zweite Phase-1-Achse kein `include_domains`.
Sie sucht im offenen Netz. Das ist die Achse, die die Feuilletonbesprechungen
geliefert hat.

## 3. Befund C — die Anfrage ist die Erzaehlpraemisse selbst

Phase 1 uebergibt den Seed **woertlich** an die Suchmaschine, die zweite Achse
mit vier angehaengten Woertern (`f"{seed} philosophical literary context"`). Der
Kommentar darueber behauptet, es werde „auf Schluesselsubstantive reduziert" —
der Code reduziert nichts.

Eine Suchmaschine, der man eine Fiktionspraemisse gibt, antwortet mit
fiktionsfoermigem Material. Gemessen, offene Suche, derselbe Seed:
`instagram.com/memoriesworthpreserving`, `worldbuilding.stackexchange.com`,
`mixbook.com/inspiration/memory-preservation-guide`. Kein Filter der Welt macht
daraus Wissenschaft, weil es keine gibt, die auf diese Anfrage antwortet.

**Die Domainschranke allein reicht also nicht.** Sie entfernt das Falsche; sie
beschafft nicht das Richtige.

## 4. Was angezapft werden kann — gemessen, nicht behauptet

| Quelle | Schluessel | Abdeckung | Messung 2026-09-04 |
|---|---|---|---|
| **OpenAlex** | kostenloser Schluessel, 1 USD/Tag frei = **1 000 Suchen/Tag** | 250 Mio. Arbeiten, alle Faecher, DOI, Jahr, Autor, Zeitschrift, Kurzfassung | beste Trefferguete aller getesteten; `primary_topic.field.id` erlaubt Beschraenkung auf Geisteswissenschaften (12), Sozialwissenschaften (33), Psychologie (32) |
| **Open Library** | keiner | Buecher — Belletristik **und** philosophische Monographien | lieferte Assmann *Cultural Memory*, Zerubavel *Time Maps*, Chanady *Magical Realism and the Fantastic* |
| **Crossref** | keiner (hoeflicher Pool ueber `mailto`) | 150 Mio. DOI-Datensaetze | Rangfolge deutlich schwaecher als OpenAlex (traf eine Zeitschrift *namens* „Cartography"); taugt als schluessellose Rueckfallebene |
| **Tavily, hart gefiltert** | vorhanden | Prosa-Kontext + SEP/IEP, die in keinem DOI-Index stehen | mit `mode=filter` + gelehrter Liste: SEP-Eintrag *Memory*, Cambridge *Episteme*, PhilPapers, Springer, JSTOR |
| DOAJ | keiner | nur Open-Access-Zeitschriften | **verworfen** — Volltextsuche ohne brauchbare Rangfolge; auf „memory studies" kam eine Arbeit ueber Drohnenfunk |
| Semantic Scholar | Schluessel noetig | 200 Mio. Arbeiten, `tldr`-Kurzfassungen | ohne Schluessel HTTP 429 bei der ersten Anfrage — als Wahlmoeglichkeit, nicht als Grundlage |
| PhilPapers | Registrierung noetig | 2,6 Mio. philosophische Eintraege | ueber die Tavily-Domainliste ohnehin erreichbar; eigene Anbindung spaeter |
| Project Gutenberg (Gutendex) | keiner | gemeinfreie Literatur | fuer zeitgenoessische Literatur leer; nur fuer den Kanon vor 1930 |

## 5. Befund D — die Anfrage muss uebersetzt werden, und zwar praezise

Ein Modellaufruf uebersetzt den Seed in Suchbegriffe. Ob das etwas taugt, haengt
an der **Koernigkeit** der Begriffe. Gemessen, OpenAlex, gleicher Seed:

| Begriffsart | Beispiel | Ergebnis |
|---|---|---|
| Fachname | „memory studies", „epistemology" | Olick & Robbins **und** *Prevalence of Dementia in the United States*; „allegory" holte C. S. Lewis' *The Allegory of Love* — richtiges Wort, falsche Bedeutung |
| Begriff/Theorie | „collective memory and forgetting", „critical cartography and power", „island studies imaginary geography" | Connerton *Seven types of forgetting*, Crampton *An Introduction to Critical Cartography*, Baldacchino *Islands, Island Studies*, Olick *The Collective Memory Reader* |

Ein blosser Fachname ist zu weit. Der Prompt muss **benannte Begriffe, Theorien
oder Debatten** verlangen und blosse Disziplinnamen verbieten.

Zweite Beobachtung: `relevance_score` bei OpenAlex ist **nicht** ueber Anfragen
hinweg vergleichbar (2 910 gegen 324 bei gleich guten Treffern). Eine absolute
Schwelle waere falsch; die Schwelle muss relativ zum Spitzenwert **derselben**
Anfrage sein.

## 6. Der Entwurf

Vier Beine, weil kein einzelnes traegt.

### 6.1 Bein 1 — die Schranke bei Tavily
`include_domains_mode="filter"` an **jedem** Tavily-Aufruf, dazu
`exclude_domains` mit der Sperrliste. Die vier Domainlisten im Admin werden
damit rueckwirkend zu dem, wofuer man sie gehalten hat.

### 6.2 Bein 2 — die Schranke bei uns
Jede Quellzeile **jedes** Anbieters laeuft durch
`backend/services/research_source_policy.py`:
`is_admissible(url) -> bool`, Sperrliste vor Freiliste, Hostvergleich mit
Punktgrenze (`h == d or h.endswith("." + d)` — nie `in`, sonst passt
`nicht-jstor.org.evil.com`).

Nicht zugelassene Zeilen fallen **aus beidem** heraus: aus `sources` (der Liste
unter der Ankerkarte) **und** aus dem Prosakontext, den das Modell liest. Heute
baut `format_results` beides aus derselben Zeile — ein Filter, der nur die
Anzeige saeubert, laesst den Fandom-Artikel weiterhin die Lore praegen.

Warum zwei Beine fuer dieselbe Sache: Tavilys Vorgabewert hat sich schon einmal
anders verhalten als die Doku sagt. Eine Schranke, die nur im fremden Dienst
steht, meldet ihren Ausfall nicht.

### 6.3 Bein 3 — Quellen, die per Bauart wissenschaftlich sind
Neuer Dienst `backend/services/external/scholarly_search.py`, gleiche Form wie
`TavilySearchService` (achsenbeschriftete Anfragen, `parallel_search`,
Zeitlimit, strukturierte Protokollierung, sanfter Ausfall):

- `OpenAlexProvider` — Achsen *Wissenschaft* und *Philosophie*,
  `filter=type:article|book|book-chapter,primary_topic.field.id:fields/12|fields/33|fields/32`
- `OpenLibraryProvider` — Achse *Literatur* (Buecher, nicht Aufsaetze)
- `CrossrefProvider` — schlussellose Rueckfallebene, wenn OpenAlex ausfaellt

Diese Anbieter brauchen **keine** Domainliste: ihr Bestand ist die Schranke.
Sie liefern ausserdem, was Phase 4 heute das Modell aus dem Gedaechtnis
erfinden laesst — Autor, Jahr, Zeitschrift, DOI. Der bestehende Kommentar in
`collect_sources` haelt genau diesen Fehler fest (eine Foucault-Fehlzuschreibung
in einem Produktionslauf); mit echten Datensaetzen ist die Zuschreibung
nachpruefbar statt plausibel.

### 6.4 Bein 4 — die Anfrage
Neuer KI-Zweck `research_query` (Eintrag in `ai_purposes.py`, Vertrag in
`prompt_contracts.py`, Modell `research`). Ein billiger Aufruf, typisierte
Ausgabe `ResearchQueryPlan(literary, philosophical, scholarly: list[str])`.
Der Prompt verbietet blosse Disziplinnamen und verlangt 2–6 Wort lange
Begriffe. Der Seed selbst wird **nicht** mehr als Suchanfrage benutzt.

## 7. Gemessenes Ergebnis der ganzen Kette

Prototyp gegen denselben Seed, der die Eingangsliste erzeugt hat:
**25 Quellen zugelassen, 0 abgewiesen** — SEP (*Memory*), Cambridge *Episteme*,
PhilPapers, Springer *Review of Philosophy and Psychology*, JSTOR,
*Annual Review of Sociology* (Olick & Robbins), *History and Theory*
(Kansteiner), Open Library (Zamora, Chanady). Kein YouTube, kein Facebook,
kein Fandom.

Ehrlich zum Rest: mit **zu weit gefassten** Begriffen kamen in demselben Lauf
drei fachlich abgedriftete Treffer durch (Demenzpraevalenz, therapeutische
Landschaften, motorisches Gedaechtnis). Die Quelle war wissenschaftlich, der
Bezug nicht. Dagegen wirken der Feldfilter (6.3) und der Prompt (6.4) — beide
sind in derselben Messung gegengeprueft.

## 8. Offene Entscheidungen

1. **OpenAlex-Schluessel** — kostenlos, ~30 Sekunden Registrierung, 1 000
   Suchen/Tag frei. Ohne Schluessel: Crossref als Grundlage, schlechtere
   Rangfolge.
2. **Wie streng ist die Gattungsgrenze?**
   Bleiben Wikipedia und Britannica (Nachschlagewerk, nicht begutachtet)?
   Bleiben *Paris Review*, *LRB*, *NYRB* (literarische Kritik, nicht begutachtet)?
3. **Die Architekturachse.** Sie zeigt heute auf `dezeen.com` und
   `designboom.com` — Designmagazine. Unter der Vorgabe fallen sie weg. Der
   wissenschaftliche Ersatz (Architekturgeschichte ueber OpenAlex, JSTOR,
   Society of Architectural Historians, Getty) beschreibt Bauten, zeigt sie aber
   nicht. Die visuelle Achse verliert Bildmaterial.

## 9. Nebenbefund (nicht Teil dieser Aufgabe)

Alle drei in `platform_settings` eingetragenen Modelle sind bei OpenRouter nicht
mehr auffindbar (Stand 2026-09-04, lokale Datenbank):
`model_research=google/gemini-2.0-flash-001`,
`model_default=model_forge=anthropic/claude-sonnet-4-6`,
`model_fallback=deepseek/deepseek-r1-0528:free` — alle drei HTTP 404
„No endpoints found". Die LLM-Recherche in Phase 4 faengt ihren Fehler ab und
protokolliert ihn nur; sie faellt also **still** aus. Auf Produktion pruefen.
