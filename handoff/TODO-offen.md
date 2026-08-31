---
title: "Offene Punkte, die beim Vorbeigehen aufgefallen sind"
date: "2026-08-31"
type: todo
lang: de
---

# Offene Punkte

Kurzliste für Dinge, die während anderer Arbeit auffallen und nicht dort
hingehören, wo sie auffielen. Jeder Punkt nennt, was gemessen wurde, und was
NICHT gemessen wurde — damit der nächste nicht bei null anfängt.

---

## T1 · Die Reiterleiste schneidet ihre eigenen Beschriftungen ab

**Gemeldet:** 31.08.2026, vom Nutzer, mit Bildschirmfoto.
**Wo:** Simulations-Navigation, zweite Zeile (`LORE · AGENTEN · GEBÄUDE · …`).

Elf von vierzehn Reitern zeigen ein abgeschnittenes Wort:

    GEBÄUD‹e›     GESUNDHE‹it›   EREIGNISS‹e›   BINDUNGE‹n›
    SOZIALE‹s›    TERMINA‹l›     DUNGEO‹ns›     EINSTELLUNG‹en›

Kein Auslassungszeichen, keine zweite Zeile, kein Umbruch — der Text endet
einfach. Das ist die deutsche Ausgabe; die englischen Wörter sind kürzer und
passen, weshalb es im Entwurf nicht auffiel.

**Nicht gemessen** (und das ist der erste Schritt, nicht das Ändern von CSS —
siehe `feedback-measure-before-fix`): ob die Reiter eine feste Breite haben,
ob ein `overflow: hidden` ohne `text-overflow` greift, oder ob die Leiste
`flex` mit `min-width: 0` auf den Kindern ist und diese unter ihre Inhaltsbreite
gedrückt werden. Die drei Ursachen brauchen drei verschiedene Reparaturen.

**Zu bedenken:** vierzehn Reiter in einer Zeile sind unabhängig von der
Abschneidung viel. Eine waagrechte Rollleiste, eine zweite Zeile oder ein
Überlaufmenü sind Gestaltungsentscheidungen, keine CSS-Korrekturen — vor dem
Bauen `velg-frontend-design` und den Nutzer fragen.

---

## T2 · Zwei Konten besitzen die Welten

**Gemessen:** 31.08.2026 auf Prod.

Fünfzehn der sechzehn Ursprungswelten gehören `matthias@leihs.at`. **The
Chitinous Mandate** (aktiv, 8 Agenten, 7 Bauten, angelegt 17.03.2026) gehört
`matthias.leihs@gmail.com` und erscheint deshalb nicht in „Meine Welten", wenn
man mit dem anderen Konto angemeldet ist.

Kein Fehler — aber eine Welt, die man nur sieht, wenn man weiss, dass es sie
gibt. Zu entscheiden: das zweite Konto als Mitglied eintragen, die Welt
umhängen, oder es so lassen und nur wissen.

---

## T3 · `pristine` steht neben der Leiter

**Gemessen:** 31.08.2026 auf Prod, beim Nachmessen von Migration 308.

Sechs Bauten in fünf Welten tragen den Zustand `pristine` (deutsch gemessen:
`makellos`, 5 von 6). Der Wert steht in keiner der 25 Bauzustands-Taxonomien
und auf keiner Sprosse der Kernleiter — `fn_degrade_building` meldet für sie
seit Migration 303 `condition_off_ladder`. Diese sechs Bauten verfallen also
nicht: Sabotage und Krisenereignisse laufen an ihnen vorbei.

`pristine` als Sprosse 0 über `excellent` zu hängen wäre naheliegend und ist
eine INHALTLICHE Entscheidung über das Vokabular dieser Welten — keine, die
eine Migration erraten darf. Dasselbe gilt für `restored` und `illuminated` in
Cité des Dames (vier Bauten).

---

## T4 · Die Beschriftung eines Bauzustands steht zweimal da

**Gemessen:** 31.08.2026, Migration 309.

`buildings.building_condition_de` ist eine Zweitschrift der Beschriftung, die in
`simulation_taxonomies` steht. Migration 309 gibt ihr eine Quelle
(`fn_building_condition_de`) und einen Wächter (`trg_building_condition_label`),
aber sie räumt die Zweitschrift nicht ab.

Richtig wäre, dass die Oberfläche die Beschriftung aus der Taxonomie liest und
die Spalte verschwindet. Betroffen sind vier Stellen:

    frontend/src/components/buildings/BuildingCard.ts        t(b, 'building_condition')
    frontend/src/components/buildings/BuildingDetailsPanel.ts
    frontend/src/components/buildings/BuildingsView.ts       Spaltenschlüssel
    frontend/src/utils/terminal-formatters.ts

Dazu bräuchte das Frontend die Taxonomie der laufenden Welt im Zustand — die
gibt es schon (`BuildingEditModal` holt sie über `getTaxonomiesByType`), aber
nicht als geteilte Quelle.

Solange die Spalte bleibt, ist sie ein Zwischenspeicher mit Quelle und Wächter
statt einer Zweitschrift ohne beides. Das ist tragfähig, aber nicht das Ziel.

---

## T5 · `/platform-stats` sollte verschwinden

**Gemessen:** 31.08.2026.

`SimulationService.get_platform_stats` und der Endpunkt `/platform-stats`
messen dieselben drei Grössen wie `LandingService` — schlechter und ohne
Aufrufer:

    frontend/src/services/api/SimulationsApiService.ts  getPlatformStats()  0 Verwender
    LandingService._resonance_count                     Zeile für Zeile identisch
    LandingService._world_count                         filtert `status` mit, dieser tat es nicht
    active_epoch_count                                  zählt 7 Epochen, von denen
                                                        sich keine seit 164–185
                                                        Tagen bewegt hat

Der `status`-Filter ist repariert (Punkt 2 der Systemprüfung), der Epochenzähler
ausdrücklich NICHT — die Unterscheidung „Status ist kein Betrieb" ein zweites
Mal hinzuschreiben wäre genau die Doppelung, die den Zähler löschenswert macht.

**Zu löschen sind vier Stellen**, und drei davon gehören zur Frontseite und
damit zur Sitzung, die sie hält:

    backend/services/simulation_service.py      get_platform_stats
    backend/routers/public.py                   @router.get("/platform-stats")   ← Frontseite
    backend/models/…                            PlatformStatsResponse            ← Frontseite
    frontend/src/services/api/SimulationsApiService.ts  getPlatformStats         ← Frontseite

Deshalb nicht einseitig getan: ein öffentlicher Endpunkt wird nicht aus einer
fremden, gerade laufenden Datei entfernt.
