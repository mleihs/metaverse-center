---
title: "Die Zahlen, gegen die gebaut wird"
date: "2026-09-05"
type: messung
lang: de
---

# Unsere eigenen Daten, in EINER Momentaufnahme

⚠ **Alles hier stammt aus einer einzigen Abfrage.** Der erste Auftrag an Claude
Design enthielt Zahlen aus zwei verschiedenen Momenten — die Tabelle wächst
laufend — und ging deshalb nicht auf (1 222 + 316 = 1 538 bei 1 510 Gesamt).
Claude Design hat es beim Nachrechnen gefunden. Wer diese Datei fortschreibt:
**eine Abfrage, ein Zeitpunkt.**

## Stand 05.09.2026, 21:15

    Zeilen gesamt                          1 646
      Bild (Replicate)                       316
      Text (OpenRouter)                    1 330      316 + 1330 = 1646 ✓

    Gesamtbetrag                          $11.87
    kleinster Betrag > 0                $0.000012
    groesster Betrag                       $0.073

    ohne jeden Betrag (0 oder NULL)          206     12,5 %
    Band Text   0 < x <= 0,005 USD         1 126
    Luecke      0,005 < x < 0,025              0     ← leer, real
    Band Bild   x >= 0,025                    314
                                   1126 + 0 + 314 = 1440
                                        1440 + 206 = 1646 ✓

    Welten 21 · Modelle 10 · Zwecke 21 · Anbieter 2
    Ausgang: 1 644 ok · 2 http_error

## ⚠ Der Fehler, der nie auffallen würde

Claude Design hat in `TODO-OPUS.md` §6.10 gewarnt: verbucht eine Aggregation
die 206 betragslosen Zeilen als Null, **sind alle Mittelwerte falsch und die
Summe stimmt trotzdem.**

Nachgemessen, an unseren Daten:

    Ø je Aufruf MIT den Nullen      $0.007223
    Ø je Aufruf OHNE die Nullen     $0.008256
    Abweichung                          14,3 %

Und je Zweck wird es viel schlimmer:

    translation    320 Zeilen, 203 ohne Betrag    63 %
    anchors          2 Zeilen,   2 ohne Betrag   100 %
    chat           479 Zeilen,   1 ohne Betrag     0 %

Ein Mittelwert für `translation` wäre nicht ungenau, sondern **falsch** — und
die Summe daneben wäre richtig, weshalb es niemand bemerkt.

**Warum sie keinen Betrag tragen:** Übersetzungen und Ankerläufe haben keine
Preisliste. Das ist nicht null und nicht klein, sondern NICHT ERFASST — genau
der Zellzustand, für den es im Stand der Technik keine Regel gibt.

**Konsequenz für den Bau:** Jeder Mittelwert trägt seine Zählbasis
(`n = 512 von 640`). Der Entwurf macht das schon; es darf beim Verdrahten nicht
verlorengehen.

Geprüft am 05.09.2026: Wir rechnen einen solchen Mittelwert **noch nirgends** —
weder in SQL noch in Python. Die Falle ist vor dem Bauen gefunden, nicht danach.

## Was die Achsen heute tragen

    Zeit · Anbieter · Modell · Zweck · Ausgang     vollständig
    Welt                                          1 308 / 1 646
    Gespräch                                      60 (nur Verdichtungen)
    Figur                                         ab Commit 2a0235d6
    Nutzer                                        ab Commit ee0caad7
    Schlüsselquelle                               1 646 „platform" — BYOK nie benutzt

Die letzten drei sind ab jetzt gefüllt, nicht rückwirkend. Das Panel muss
zeigen können, wie eine Achse aussieht, die erst ab einem Datum Daten hat.
