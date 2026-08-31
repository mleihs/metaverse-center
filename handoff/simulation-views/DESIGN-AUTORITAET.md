# Wer entscheidet, wenn Skill und Handoff sich widersprechen

Beim Umsetzen laufen zwei Regelwerke nebeneinander:

- **`.claude/skills/velg-frontend-design`** — das Projekt-Regelwerk (Tokens,
  Lint-Tore, i18n, WCAG, Shared-Komponenten).
- **`handoff/simulation-views/README.md`** — der Entwurf von Claude Design.

## Die Regel

**Der Skill liefert das VOKABULAR, der Handoff bestimmt das BILD.**
Der Skill sagt, *womit* gebaut wird (Token statt Hex, `msg()`, keine Kantenstreifen,
`prefers-reduced-motion`); der Handoff sagt, *wie es aussehen soll*. Wo der Skill
eine Regel aufstellt, die das Bild des Handoffs zerstören würde, gewinnt der Handoff —
aber nur dort, und nur beim Bild, nie bei einem Lint-Tor.

## Nachgezählt: VIER Berührungspunkte, davon EINER ein echter Widerspruch

> **Nachtrag (Sitzung `Frontseite-Redesign`, Phase 0).** Die Tabelle unten stand
> zuerst mit einer einzigen Konfliktzeile da. Nachgemessen sind es vier Stellen, an
> denen Skill und Handoff sich berühren — aber nur die Schriftzeile ist ein echter
> Widerspruch. Die anderen drei sehen wie Widersprüche aus und lösen sich beim
> Hinsehen auf; sie stehen hier trotzdem, weil eine aufgelöste Falle, die niemand
> aufgeschrieben hat, beim nächsten Mal wieder eine Falle ist. Punkte 2–4 unten.

| Punkt | Skill | Handoff | Verhältnis |
|---|---|---|---|
| Rohe Hex-Werte | verboten | alle Hex sind Token-Referenzen | einig |
| Kantenstreifen | verboten | verboten (Tabu) | einig |
| Rotierte Elemente / Stempel | — | verboten (Tabu) | einig |
| Radius 0, Offset-Schatten | ja | ja (Ausnahme TCG ~6 px) | einig |
| `msg()`, En-Dash, WCAG AA | Pflicht | Pflicht (DoD) | einig |
| **Überschriften-Schrift** | **„alle Überschriften `--font-brutalist`, uppercase"** | **Schlagzeilen Spectral-Serif 38 px, Chat-Bubbles Serif, Lore-Prosa Spectral 16,5 px** | **WIDERSPRUCH** |

## Wie der Widerspruch aufzulösen ist — er ist im Code schon aufgelöst

Der Live-Code trennt seit jeher zwei Ebenen, und zwar genau an der Linie, die der
Handoff zieht. Belege aus `components/broadsheet/BroadsheetArticle.ts`:

    .article__source-tag   --font-brutalist              ← Chrome
    .article__headline     --font-bureau/--font-prose    ← Inhalt   (Zeile 63)
    .article__excerpt      --font-bureau/--font-prose    ← Inhalt   (Zeile 73)
    .article__agent        --font-mono                   ← Metazeile

**Chrome ist brutalistisch, Inhalt ist Spectral.** Kicker, Labels, Metazeilen,
Reiter, Knöpfe, Panel-Köpfe: Courier, uppercase, getrackt. Was die Welt selbst
sagt — Schlagzeile, Lede, Exzerpt, Banter, Chat-Nachricht, Lore-Absatz, Verdikt-
Zitat: Spectral.

Die Regel des Skills meint UI-Überschriften. Eine Zeitung, deren Schlagzeile in
gesperrten Grossbuchstaben auf Courier steht, ist keine Zeitung mehr — und der
Live-Code hat nie behauptet, dass sie das sein soll. **Hier ist also nichts zu
entscheiden, nur nichts kaputtzumachen:** beim Restyling die `--font-bureau`-
Zeilen stehen lassen und nicht „regelkonform" auf `--font-brutalist` ziehen.

## Die Probe vor jedem Commit
Wenn eine Änderung eine Zeile von `--font-bureau`/`--font-prose` auf
`--font-brutalist` bringt: **anhalten.** Entweder ist es Chrome (dann war die
Zeile vorher falsch und der Wechsel richtig), oder es ist Inhalt (dann ist der
Wechsel ein Schaden, den kein Lint-Tor meldet).


---

## Punkt 2 — Unicode-Ornamente: KEIN Widerspruch, aber leicht falsch zu reparieren

**Der Anschein.** Der Skill sagt „Icons ausschliesslich aus `utils/icons.ts`", der
Handoff §4.10 sagt „Unicode-Glyphen sind KEINE Icons" — und derselbe Handoff schreibt
dann `◈ Übersicht`, `●◐○` für den Bauzustand, `✦ Name ✦` auf der Kartenplatte, `✓` am
Agenten-Reiter, `⚲` für angeheftet, `▾` für „Mehr", `✕` zum Zurücknehmen vor.

**Die Auflösung liegt im Wort „Icon".** Beide Regeln verbieten dasselbe: dass ein Glyph
für ein Icon EINSTEHT. Ein `⚔` statt `icons.crossedSwords()` ist verboten, weil es einen
Gegenstand der Welt benennt und dabei von der Schriftart des Betrachters abhängt. Ein `✦`
neben einem Namen benennt nichts — es ist Satzschmuck, wie ein Auslassungspunkt.

**Gemessen im Live-Code**, damit das nicht Meinung bleibt:

    ✦  2 Dateien      ●  2 Dateien      ✓  2 Dateien
    ◆  3 Dateien      ▾  1 Datei        ▸  1 Datei

`▸` steht dabei in `shared/marker-styles.ts` selbst, in `.status-mark::before` — also im
Modul, das der Skill als kanonisches Auszeichnungsvokabular nennt. Das Projekt hat die
Frage längst entschieden.

**Die Probe:** Kann man den Glyph durch ein Wort ersetzen, ohne dass Bedeutung verloren
geht? Dann ist er Schmuck und darf bleiben (`✦ Voss ✦` → `Voss`). Geht es nicht, benennt
er etwas und muss ein Icon werden (`●◐○` → nein: das ist der Zustand, und dafür trägt die
Karte ohnehin ein Wort daneben; die Punkte sind die Redundanz, nicht die Aussage).

**Für `msg()` heisst das:** der Glyph gehört NICHT in die Zeichenkette. `msg('Overview')`
bleibt sauber, das `◈` steht als eigenes `<span aria-hidden="true">` davor — sonst trägt
jede Übersetzung ein Ornament mit, das keine Übersetzung braucht.

---

## Punkt 3 — Ken-Burns und `filter` am Masthead: KEIN Widerspruch, aber eine echte Falle

**Der Anschein.** Skill-Regel 6 verbietet `filter`, `transform`, `will-change`,
`contain: paint` und `perspective` auf Layout-Containern. Der Handoff verlangt für den
Masthead genau beides: Ken-Burns (`transform: scale(1) → 1.06`, 34 s) und einen
gedimmten Hintergrund (`filter: brightness(.62) saturate(.85)`).

**Die Auflösung:** die Regel gilt dem CONTAINER, nicht dem Bild darin. Beide Effekte
gehören auf die absolut positionierte Hintergrund-Ebene — ein Blattelement — und nie auf
den Masthead selbst. Genau so macht es der Prototyp (`position:absolute; inset:0;
background-image:…; filter:…; animation:kb …`), und genau so macht es der Live-Code
bereits: `components/landing/LandingHero.ts:183` trägt `filter: brightness(0.72)
saturate(0.95)` plus `animation: ken-burns 34s` auf der Backdrop-Ebene. Dieselben 34 s.

**Warum die Regel trotzdem ernst ist:** ein `filter` auf dem Masthead-Container erzeugt
einen neuen Containing Block, und jedes `position: fixed`-Modal darunter — Lightbox,
Bureau-Dispatch, Confirm-Dialog — springt an die falsche Stelle. Der Fehler ist unsichtbar,
bis jemand ein Modal öffnet. Also: **Effekte auf die Ebene, nie auf den Rahmen.**

---

## Punkt 4 — WCAG AA gegen die Prototyp-Farbwerte: hier gewinnt der SKILL

Dies ist die einzige Stelle, an der die Regel oben (»beim Bild gewinnt der Handoff«)
NICHT gilt, und der Handoff sagt das selbst: seine eigene Definition of Done verlangt
„WCAG AA Kontrast auf Phosphor-Dim-Texten geprüft". Der Entwurf ordnet sich also unter.

**Gemessen**, an der Kontextzeile der Nav-Leiste (`#555` auf `#060606`, wie im Prototyp):

    #555555 auf #060606   →  2,80 : 1     AA verlangt 4,5 : 1 für Fliesstext
    #7b7b7b auf #060606   →  4,79 : 1     ✓

**Die Auflösung:** den Farbton behalten, den Wert heben, bis AA erreicht ist. Ein neutrales
Grau bleibt ein neutrales Grau; der Entwurf verliert nichts, was er gemeint hat. Konkret
in `SimulationNav`: `color-mix(in srgb, var(--color-text-muted) 90%, var(--color-surface-sunken))`
statt eines rohen `#555`.

**Diese Prüfung ist NICHT optional und kein Lint-Tor macht sie:** `lint-color-tokens.sh`
prüft, ob eine Farbe ein Token ist, nicht ob man sie lesen kann. `lint-color-contrast.sh`
liegt ruhend im Verzeichnis. Jede aus dem Prototyp übernommene Dim-Farbe auf dunklem
Grund ist also von Hand nachzurechnen — vor allem im Dungeon, wo `--_phosphor-dim` die
halbe Beschriftung trägt.

---

## Zusammenfassung in einer Zeile pro Punkt

| # | Berührung | Wer gewinnt | Was zu tun ist |
|---|---|---|---|
| 1 | Überschriften-Schrift | **Handoff** | Chrome brutalistisch, Inhalt Spectral — `--font-bureau`-Zeilen stehen lassen |
| 2 | Unicode-Ornamente | einig | Schmuck darf bleiben, Bezeichnendes wird Icon; Glyph nie in `msg()` |
| 3 | Ken-Burns / `filter` | einig | Effekt auf die Blatt-Ebene, nie auf den Container |
| 4 | Dim-Farben | **Skill** | Farbton behalten, Wert bis AA heben, von Hand nachrechnen |

---

## Punkt 5 — Breitbild und 4K: hier stand der Skill WIRKLICH im Weg (behoben)

Dies ist der zweite echte Konflikt, und anders als bei der Schrift war er nicht
nur eine Formulierung, sondern eine **veraltete Token-Liste**. Vom Nutzer als
grosser Punkt benannt (Wortlaut nicht wiedergegeben)

**Was der Skill sagte.** Seine Layout-Liste kannte genau eine Container-Leiter,
`--container-sm` bis `--container-max` (1600 px), und sonst nichts. Gemessen:

    grep -c "stage-measure" .claude/skills/velg-frontend-design/SKILL.md   → 0
    grep -c "stage-measure" .claude/rules/velg-frontend-design.md          → 0

Der Skill wusste also **nichts** von `--stage-measure` (1920), `--stage-gutter`
(48 → 64 ab 1920), `--stage-type-scale` (1 → 1,15 ab 2560) und `stage-styles.ts` —
dem Raster, das die Sitzung `velgarien-rebuild-45` am selben Tag gebaut hat und das
`tokens/_layout.css` ausführlich begründet. Wer dem Skill wörtlich folgte, kam bei
4K auf 1600 px zentriert, und zwar für JEDE Ansicht.

**Was der Handoff verlangt** — ausdrücklich nicht eine Regel für alle
(README, „Wide-Screen & 4K": „Drei Regeln nach View-Typ — NICHT eine für alle"):

| Ansicht | Regel | Mass |
|---|---|---|
| Simulation View v4 (Dokument/Registratur) | zentrierte Bühne, Chrome full-bleed | 1920 |
| Chat, Dungeon (Vollhöhen-Cockpit) | **gar kein Container** | Rails an der Kante, Bühne nimmt alles |
| Broadsheet (Papier) | Satzmass halten | 1220 zentriert |
| Epochen-Boards, Admin (Werkzeug) | `--container-max` | 1600, wie bisher |

**Der Schaden war messbar, nicht theoretisch.** `SimulationShell.ts` kappte
`.shell__content` auf `--container-2xl` (bei Breitbild 1600) und zentrierte es, und
die Ausnahme `--immersive` hing an `view === 'dungeon'`. Der Chat stand damit bei
2560 px in einer 1600-px-Kiste mit rund 480 px totem Rand auf jeder Seite — genau
der „Leerstreifen links der Sidebar", den die Cockpit-Regel als Abnahmekriterium
ausschliesst. Gefunden von `velgarien-rebuild-af`, behoben in der Sitzung
`Frontseite-Redesign`: die Zeile nutzt jetzt `FULL_HEIGHT_VIEWS`, dasselbe Set, das
elf Zeilen tiefer schon über die Fusszeile entscheidet.

**Behoben, nicht nur notiert.** Beide Kopien des Skills (`.claude/skills/…/SKILL.md`
und `.claude/rules/…`) tragen jetzt die Bühnen-Token und die Vier-Regeln-Tabelle. Der
Skill ist damit kein Hindernis mehr, sondern sagt dasselbe wie der Handoff.

**Die Frage, die vor jedem `max-width` zu stellen ist:** *Was IST diese Ansicht —
Dokument, Cockpit, Papier oder Werkzeug?* Wer sie nicht stellt, wählt stillschweigend
„Werkzeug", weil das der Vorgabewert der alten Liste war.
