# Handoff: Mail-System — Überarbeitung

**Referenz-Prototyp:** `Email Templates.dc.html` (Design-Projekt
`a8436a10-865a-457b-ac95-22a3410edde8`, nicht im Repo).
Neun Vorlagen in Versandbreite, jede mit Versandvertrag (Betreff, Preheader, Auslöser, Filter).
**Nicht kopieren** — der Prototyp nutzt Flex/Grid und Inline-Styles; Produktion bleibt
tabellenbasiert. Er zeigt Layout, Hierarchie, Farbe und Copy.

**Ziel:** `backend/services/email_templates.py`, `email_service.py`,
`cycle_notification_service.py`, `supabase/templates/`

## Wichtig: Hex ist hier korrekt

Der Repo-Contract verlangt Tokens statt roher Hex-Werte — **für E-Mail gilt das nicht.**
CSS-Variablen werden von Outlook und Gmail nicht aufgelöst. `email_templates.py` hält
seine Palette bereits als Modulkonstanten (`_AMBER`, `_TEXT`, …); das bleibt so.
Die Konstanten sollen aber den Token-Werten entsprechen und bei Änderungen mitgezogen werden.

---

## P0 — Fehler

### 1. `cite-des-dames` ist unlesbar
`_SIM_EMAIL_COLORS["cite-des-dames"] = "#1E3A8A"` auf `_BG #0a0a0a` ergibt **1,9:1**.
Der CTA setzt diese Farbe als Hintergrund mit `color:{_BG}` — dunkelblau auf schwarz.

Fix: Helligkeitsschranke für alle Akzentfarben. Wer unter ~4,5:1 gegen `_BG` liegt, wird
aufgehellt, bevor er verwendet wird. `#1E3A8A` → etwa `#5A82D8`. Als Funktion
`get_sim_accent()` implementieren, damit neue Simulationen automatisch abgesichert sind,
und mit einem Test belegen, der jede Farbe in `_SIM_EMAIL_COLORS` gegen `_BG` prüft.

### 2. Fußzeile verfehlt WCAG AA
`_TEXT_DARK = "#666"` auf `#0a0a0a` = **3,45:1** bei 10px. Auf `#8a8a8a` (5,7:1) anheben
und die Fußzeile auf 12px setzen. `_TEXT_DIM #888` ist mit 5,6:1 in Ordnung.

### 3. Kein Plain-Text-Teil
`_send_sync` baut `MIMEMultipart("alternative")`, hängt aber nur HTML an; der Resend-Payload
hat kein `text`-Feld. Beides kostet Spam-Score.

Fix: Jede `render_*`-Funktion bekommt ein Gegenstück `render_*_text()`, oder — pragmatischer —
eine gemeinsame `html_to_text(html)`-Hilfe. Der Text-Teil wandert in den Resend-Payload
(`"text": …`) und als erster `MIMEText`-Teil in die SMTP-Nachricht (Plain zuerst, HTML danach —
`alternative` verlangt aufsteigende Präferenz).

### 4. Keine Ein-Klick-Abmeldung
Gmail und Yahoo verlangen sie seit 2024 von Massenversendern. Fehlt vollständig.

Fix: Header `List-Unsubscribe: <https://metaverse.center/unsubscribe?token=…>, <mailto:…>`
und `List-Unsubscribe-Post: List-Unsubscribe=One-Click` mitsenden (Resend: `headers`-Feld;
SMTP: `msg["List-Unsubscribe"]`). Dazu ein signierter Token-Endpunkt, der ohne Login
die betroffene Kategorie abschaltet — nicht bloß nach `/settings` leiten.
In der Fußzeile zusätzlich zwei getrennte Links: **diese Kategorie** abbestellen und
**alle Benachrichtigungen** verwalten.

### 5. Stempel-Rotation entfernen
`@keyframes stamp-in` enthält `rotate(-4deg)`. **Projektregel: keine rotierten Elemente,
keine Stempel-Ästhetik.** Keyframe streichen und die Verwendung am Operationsnamen
(`_render_invitation_block`) ersatzlos entfernen — ein statischer Name in Akzentfarbe genügt.

### 6. Impressumsangabe fehlt
Deutschsprachiger Versand: Anbieterkennzeichnung gehört in die Fußzeile.
Betreiberzeile plus Impressum-Link in `_footer_row()`.

---

## P1 — Struktur aller Vorlagen

### 7. Preheader einführen
Erste sichtbare Zeile ist derzeit „BUREAU DIRECTIVE // CYCLE DEBRIEF ▌" — die wertvollste
Textzeile im Postfach, verschwendet an Deko.

Fix: verborgener Preheader direkt nach `<body>`, gefolgt von Füllzeichen, damit der Client
keinen Body-Text nachzieht:

```html
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<div style="display:none;max-height:0;overflow:hidden;">&#847;&zwnj;&nbsp;… (× ~40)</div>
```

`_email_shell()` bekommt einen Pflichtparameter `preheader`. Inhalt je Vorlage siehe
Prototyp-Spezifikation; immer die Kernzahl, nie eine Wiederholung des Betreffs.

### 8. Betreffzeilen: Veränderung nach vorn
Mobil sind ~35 Zeichen sichtbar. Statt „Cycle Briefing — Operation X, Cycle 3":

| Vorlage | Betreff |
|---|---|
| Lagebericht | `Zyklus 7 · Rang 2 (↑1) · 3 Befehle offen` |
| Befehlsschluss | `2 Std. bis Auflösung — 3 Befehle offen` |
| Einladung | `Purpurflut startet Freitag · 6 Plätze, 2 frei` |
| Abschluss | `Purpurflut entschieden — du bist Zweiter` |
| Expedition | `Drei von vier kehrten zurück — Die Steigende Flut` |
| Wochenblatt | `Saltmeridian, Woche 12: Ein Rücktritt und ein Brand` |
| Verrat | `Die Aschermark hat das Bündnis gebrochen` |

### 9. Zweisprachigkeit abschaffen
Ohne gesetztes Locale gehen EN **und** DE raus — beim Lagebericht achtzehn Sektionen.
`_resolve_langs()` gibt künftig immer genau eine Sprache zurück (Fallback `en`).
Stattdessen oben ein Link „English version" auf die Webansicht.
`_language_divider()` entfällt.

### 10. Zierzeichenketten raus
23× `━` und 25× `═` als Textknoten: Screenreader lesen jedes Zeichen, auf schmalen Displays
droht Überlauf. Ersetzen durch echte Ränder (`border-bottom:1px solid`) bzw. eine
Trennzeilen-Tabelle. Gleiches gilt für die Blockzeichen `█` in der Einladung.

### 11. Mindestgrößen
Sektionsköpfe und Fußzeile von 10px auf 12px. Letterspacing bei Uppercase-Labels von 3px
auf 2px. Fließtext 15–16px (bisher 14px).

### 12. Animationen entfernen
`glow-breathe` (Dauerpuls am CTA), `accent-pulse`, `cursor-blink`, `scanline-drift` und
`reveal-up` (identische Verzögerung auf jedem Sektionskopf — wirkungslos) streichen.
In Outlook ohnehin tot, in Apple Mail unruhig. `stamp-in` siehe P0.

### 13. CTA tabellenbasiert
`<a>` mit Padding rendert in Outlook unzuverlässig. Als Tabellenzelle mit
`bgcolor`-Attribut + `mso`-Conditional (VML roundrect) aufbauen.
Kein Rahmen in Akzentfarbe auf gleichfarbigem Grund.

### 14. Rot nur bei Verlust
Die rote „CLASSIFIED"-Warnbox eröffnet jede Einladung — dieselbe Farbe wie die AFK-Strafe.
`inv_intro_1` verliert Box und Rot; Rot bleibt AFK-Strafe, Verrat und Ausfällen vorbehalten.

### 15. Handlungszeile im Lagebericht
Neun Sektionen Daten, keine Anweisung. Ganz oben, vor dem Stand, ein Kasten in Akzentfarbe:
offene Befehle + Uhrzeit der Auflösung. Darunter der CTA-Text „Ohne Befehle handelt der
Zyklus ohne dich — und kostet 1 RP."

### 16. Podium in die Abschlussmail
Die App zeigt Krone, MVP-Karten und gestaffelte Enthüllung; die Mail listet Text.
Podium als dreispaltige Tabelle (Platz 2 · 1 · 3, Sieger höher und in Akzentfarbe),
darunter die MVP-Karte mit Portrait, Aptitude-Summe und Zitat. Statisch, keine Animation.

---

## P2 — Neue Vorlagen

Reihenfolge nach Wirkung.

### 17. `render_deadline_reminder()` — die größte Lücke
Das System zieht RP ab und ersetzt den Spieler durch eine KI, **ohne vorher zu warnen**.
Der Nutzer erfährt von der Strafe erst im nächsten Lagebericht.

- Auslöser: T−2 Std. vor Auflösung, nur wenn Befehle offen sind. Neuer Scheduler-Lauf
  neben `epoch_cycle_scheduler`.
- Inhalt: Countdown groß, Liste der offenen Punkte (erledigte grün gegengezeichnet),
  Konsequenzblock in Rot (1 RP, bei Wiederholung KI-Übernahme), ein CTA.
- Neue Präferenz `deadline_reminder` (Standard `true`) in Migration, Pydantic-Modell und
  Einstellungsoberfläche.
- Höchstens eine Erinnerung pro Zyklus und Nutzer — Idempotenz über eine Sendetabelle.

### 18. `render_expedition_report()`
Ein komplettes Spielsystem ohne Mail. Auslöser: Dungeon-Instanz `completed`, `wiped`
oder `retreated`.
Inhalt: Archetyp-Artwork als Kopfbild, Kennzahlen (Rückkehr, Pegel/Stabilität bei Abbruch,
Fundstücke), Truppliste mit Portrait und Status, Erzählabschnitt, Folgen für die Welt.
**Akzentfarbe ist die des Archetyps**, nicht Plattform-Amber — analog `get_sim_accent()`
eine `get_archetype_accent()`.

### 19. `render_world_digest()` — Wochenblatt
Löst das Kernversprechen ein („die Welt spielt weiter, während du schläfst") und ist
inhaltlich fast gratis, weil der Text im Broadsheet bereits existiert.
Sonntags, nur bei mindestens drei Ereignissen der Woche. Aufmacher + drei Kurzmeldungen +
Wochenzahlen. Ereignisarme Wochen werden übersprungen, nicht mit Füllmaterial versendet.

### 20. `render_betrayal_alert()`
Der dramatischste Moment des Spiels steckt derzeit im Lagebericht vergraben.
Auslöser: Bündnisbruch oder gelungene feindliche Operation gegen den Empfänger.
Inhalt: was geschah, was es kostet, drei Antwortmöglichkeiten mit Kosten und Aussicht,
Frist. Rot ist hier zulässig. Zusammenfassen, wenn mehrere Vorfälle im selben Zyklus
denselben Empfänger treffen — sonst droht Mail-Flut.

### 21. `render_welcome()`
Nach der Auth-Bestätigung passiert nichts. 30 Minuten nach Registrierung: drei Wege
(Zusehen ohne Konto / Akademie / Forge), plus ein Beispielsatz als Starthilfe.

### 22. Konto-Mails im Markendesign
`supabase/templates/` enthält nur `confirmation.html`. Passwort-Reset, Magic-Link,
E-Mail-Wechsel und Einladung laufen im Supabase-Standarddesign — ausgerechnet die Mails,
die jeder Nutzer sieht.
Vorlagen ergänzen und in `supabase/config.toml` verdrahten. **Nüchterner Ton, kein
Bureau-Rollenspiel:** bei Sicherheitsmails ist Klarheit die Marke. Immer mit
Gültigkeitsdauer, Klartext-URL zum Kopieren, Herkunftsangabe der Anfrage und dem Hinweis,
dass Nichtstun sicher ist. Sicherheitsmails sind nicht abbestellbar — das gehört in die Fußzeile.

### 23. DSGVO-Mails
Kontolöschung bestätigt, Datenexport bereit, E-Mail-Adresse geändert (Benachrichtigung an
die **alte** Adresse). Rechtlich nötig, derzeit nicht vorhanden.

### 24. Einladungs-Nachfass
Einladungen gehen einmal raus. Nachfass bei T−24 Std., wenn weder angenommen noch
abgelehnt wurde — höchstens einmal.

---

## P3 — Betrieb

25. **Sendetabelle** `email_log` (user_id, template, epoch_id, sent_at) für Idempotenz,
    Häufigkeitsgrenzen und Auswertung. Existiert nicht; ohne sie sind Erinnerungen und
    Nachfass nicht sicher genau einmal zuzustellen.
26. **Häufigkeitsgrenze:** ein aktiver Spieler kann heute pro Zyklus Lagebericht,
    Phasenwechsel und (künftig) Erinnerung plus Verratsmeldung bekommen — bei 8-Stunden-Zyklen
    bis zu zwölf Mails am Tag. Obergrenze pro Nutzer und Tag, Überzähliges bündeln.
27. **Vorschau-Route** im Admin (`/admin/emails/preview/{template}`) mit den Fixtures aus
    `scripts/send_test_emails.py`, damit Änderungen ohne Versand prüfbar sind.
28. **Tests erweitern:** Kontrastverhältnis jeder Akzentfarbe, Vorhandensein von Preheader
    und Plain-Text-Teil, `List-Unsubscribe`-Header gesetzt, keine `@keyframes` mehr im Shell.

## Nicht übernehmen

- Flex und Grid aus dem Prototyp — Produktion bleibt bei `<table role="presentation">`.
- Die Beispieldaten (Purpurflut, Aschermark, Saltmeridian) sind Fixtures.
- Die 600px-Breite des Prototyps ist bereits Repo-Standard und bleibt.

---

## Verzahnung mit dem Systemprüfungs-Plan (nachgetragen 2026-08-30, umsetzende Sitzung)

Vier Punkte dieses Dokuments decken sich mit Paket B aus
`docs/plans/system-review-remediation-2026-08-30.md`. Sie werden **hier** erledigt,
nicht doppelt:

| Handoff | Paket B | Anmerkung |
|---|---|---|
| 3 (Text-Teil), 4 (Ein-Klick-Abmeldung) | B14 | B14 forderte `List-Unsubscribe` + Text-Alternative; das Handoff geht mit dem signierten Abmelde-Endpunkt weiter |
| 4 (Abmelde-Ziel) | B2 | B2 wollte eine Route `/settings/notifications`; der signierte Ein-Klick-Endpunkt ersetzt sie **nicht**, er ergänzt sie — die Fußzeile braucht beide Links |
| 8 (Betreffzeilen) | B14 | Betreffs werden lokalisiert UND umgebaut, in einem Zug |
| 9 (Zweisprachigkeit) | B9 | B9 fand `locale` tot; Punkt 9 ist die Ursache |
| 25 (`email_log`) | B15 | dieselbe Tabelle; Name aus dem Handoff (`email_log`) gewinnt |

Umgekehrt bleibt in Paket B, was das Handoff nicht führt: B1/B5/B6 (Zyklusnummer),
B3 (Einladung annehmen), B4 (Simulations-Einladung verschickt keine Mail), B7/B8
(Empfänger), B10 (Erfolge beim manuellen Ende), B11 (`OpenRouterError`), B12
(Lore vor Insert), B13 (SITREP 503), B16 (Testversand).
