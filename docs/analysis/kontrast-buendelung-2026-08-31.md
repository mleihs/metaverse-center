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
Archetyp, je Ereignis; dazu `--_danger` 14, `--_text-dim` 10, `--_stamp` 8).
Statisch nicht messbar, und der Wert ist bewusst beweglich.

**Die Regel hier ist nicht „heben", sondern „die Farbe von der Information
trennen".** Sie stammt aus einem Fall im „Im Dienst"-Streifen, wo eine
Rollenfarbe eine Zahl färbte: gegen die vier Gründe gemessen fielen **14 von
24 Paarungen als Text durch, aber nur 6 von 24 als Marke** — `guardian` steht
bei 7,80 auf Schwarz und 2,24 auf Creme. **Sechs Identitätsfarben können
nicht gleichzeitig auf hellem und dunklem Grund Text sein, per Konstruktion.**
Die Farbe trägt dort jetzt nur noch die Marke, die Rolle steht in Worten im
zugänglichen Namen.

⚠ Die Klasse ist aber **nicht einheitlich**, und das entscheidet die Arbeit.
Stichprobe `archetypes/ArchetypeDetailView.ts` (11 Befunde): dort steht
`--_accent` fast ausschliesslich in Flächen und Verläufen —
`color-mix(… var(--_accent) 8%, transparent)`, Rasterlinien, Atmosphäre. Das
ist bereits eine Marke und braucht keine Reparatur. Die Befunde entstehen an
den wenigen Stellen, an denen dieselbe Farbe zusätzlich Text färbt.

**Also je Komponente ansehen, nicht sweepen:** trägt die Laufzeitfarbe hier
eine Marke (dann in Ordnung) oder eine Aussage (dann trennen)? Ein
mechanischer Tausch würde die Atmosphäre zerstören, die in dieser Klasse der
eigentliche Zweck der Farbe ist.

#### Zwei Schnitte, die die 198 handhabbar machen

**Erster Schnitt: Marke oder Aussage.** Der Versuch, das aus dem Selektornamen
zu lesen, lässt **100 von 198 unentschieden** — ein Name sagt nicht
verlässlich, ob Text eine Aussage trägt (`.lore-intro__paragraph` ist
offensichtlich eine, `.exit__gauge-full` schwer zu sagen). Die Regex an die
Daten anzupassen wäre der Fehler gewesen; stattdessen ist die **Vorgabe
umgedreht**: Text ist eine Aussage, es sei denn, sein Name sagt ausdrücklich,
dass er ein Zeichen ist (`dot`, `glyph`, `icon`, `pip`, `caret`, …).

Das ist die sichere Seite: **eine Aussage fälschlich für eine Marke zu halten
verbirgt ein echtes Problem; umgekehrt entsteht nur Arbeit.**

    Aussagen (Vorgabe)      184
    Marken (Name sagt es)    15

**Zweiter Schnitt, und er ist der nützlichere: fällt es auch auf
Plattform-Dunkel durch?**

    fällt AUCH auf der Vorgabe durch    31   ← echter Komponentenfehler, themenunabhängig
    nur in gethemten Läufen            153   ← sitzt auf dem Grund des Themes

**Die 31 sind die Arbeitsliste.** Sie sind auf jedem Grund kaputt, also ohne
Diskussion über Themes zu reparieren. Die 153 stellen erst die Frage, die
diese Klasse ausmacht: bringt das Bauteil seinen eigenen Grund mit (wie der
Dungeon, dann ist der Befund gegenstandslos) oder sitzt es auf dem des Themes
(dann greift die Trennungsregel)?

⚠ Und Schritt 1b hilft hier **nicht**: er hebt `--color-text-secondary` und
`--color-text-muted`, nicht die Tier-3-Token. Diese Klasse bleibt auch nach
1b bestehen.

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
