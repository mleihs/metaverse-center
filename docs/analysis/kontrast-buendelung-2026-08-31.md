# Die Kontrastbefunde, nach Abhilfe gebündelt

**31.08.2026 · 2 195 Paarungen über 11 Themes · sieben Klassen · vier davon mechanisch**

Nach Token gebündelt sagt die Liste wenig (`--color-text-inverse` 90 ×,
`--color-text-muted` 63 ×, …). Die Frage ist nicht, welche Farbe da steht,
sondern **was zu tun ist** — und danach zerfällt sie in sieben Klassen, von
denen vier bereits ein Werkzeug haben.

| Klasse | Stellen | Verz. | Abhilfe |
|---|---:|---:|---|
| 2 gedämpfter Text | **931** | 28 | `--color-text-quiet` — **mechanisch** |
| 6 Statusfarbe auf fremder Fläche | **666** | 28 | **Schritt 1b in `ThemeService`**, keine Aufrufstelle |
| 5 Tier-3, zur Laufzeit gesetzt | 198 | 18 | statisch nicht messbar, Entscheidung je Komponente |
| 7 sonstiges | 161 | 19 | einzeln ansehen |
| 3 Statusfarbe auf eigener Tönung | 92 | 16 | `--color-<status>-readable` — **mechanisch** |
| 1 inverse Tinte auf einer Füllung | 91 | 19 | `--color-on-<füllung>`, konstant — **mechanisch** |
| 4 Flächen-Token als Vordergrund | 56 | 12 | gezeichnete Marken → `aria-hidden`, oder Fehlalarm |

## Die zwei Zahlen, auf die es ankommt

**666 Stellen brauchen KEINE Änderung an einer Aufrufstelle.** Sie sind
Klasse 6 — eine Statusfarbe auf einer Fläche, die das Theme setzt — und
genau das ist der Fall, den Schritt 1b in `ThemeService.applyConfig` an
**einer** Stelle löst. Das ist die quantitative Bestätigung des Widerrufs:
der ursprünglich vorgeschlagene Sweep über 81 Dateien hätte die grösste
Klasse nicht berührt.

**1 114 Stellen sind ein mechanischer Token-Tausch** (Klassen 2, 3 und 1
zusammen), und alle drei Token existieren bereits: `--color-text-quiet`,
`--color-<status>-readable`, `--color-on-accent-amber` /
`--color-on-surface-inverse`. Kein Entwurf, keine Entscheidung — nur Arbeit.

## Die Klassen, die eine Entscheidung brauchen

**Klasse 5 (198)** setzt ihre Farbe zur Laufzeit (`--_accent` je Agent, je
Archetyp, je Ereignis). Statisch nicht messbar, und der Wert ist bewusst
beweglich — hier hilft keine Tabelle, sondern die Frage, ob die betreffende
Komponente ihren eigenen Grund mitbringt (wie der Dungeon es tut) oder auf
dem des Themes sitzt.

**Klasse 4 (56)** ist ein Flächen-Token als *Vordergrund*
(`color: var(--color-surface-sunken)`). Das ist fast immer eine gezeichnete
Marke und kein Text. Die richtige Abhilfe ist meist `aria-hidden`, was die
Stelle ehrlich aus der Messung nimmt, statt sie per Ausnahmeliste
verschwinden zu lassen — eine Ausnahme überlebt ihren Anlass, ein
`aria-hidden` verschwindet mit ihm.

## Was hier NICHT steht

Eine Reihenfolge. Die 931 der Klasse 2 sind die grösste Zahl, aber sie sind
auch die harmloseste: gedämpfter Text, der knapp unter der Schwelle liegt.
Die 91 der Klasse 1 sind wenige und die schlimmsten — weisse Schrift auf
Amber bei 1,89 : 1, auf Haupt-Aufrufen. **Eine Liste nach Grösse zu
sortieren heisst, sie nach dem falschen Ende abzuarbeiten.**

## Zur Zählung

Gezählt sind alle Paarungen, die in mindestens einem der elf Läufe (zehn
Themes plus die Vorgabe) unter WCAG AA liegen, entdoppelt je Datei, Zeile und
Selektor. Dateien unter einer Ansicht, die `PLATFORM_DARK_CONFIG` zur Laufzeit
pinnt, sind einmal gegen die Vorgabe gezählt — ein Simulations-Theme erreicht
sie nicht.

    cd frontend && python3 scripts/measure-contrast-pairs.py --themes
