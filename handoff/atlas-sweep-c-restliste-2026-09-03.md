# Sweep C — Restliste (3 von 99, unangetastet)

Stand 2026-09-03. Diese drei sind bewusst **nicht** verändert — keiner der drei
ist ein flacher Flächenton, für den `--color-overlay-ink[-strong]` gemacht ist.
Alle drei sind helle Akzentmarkierungen auf einer dunklen/gefüllten Fläche mit
Deckkraft 0,15–0,4, weit über der 8-%-Decke der Ink-Tokens. Ein Griff zu den
Ink-Tokens hätte die Markierung fast unsichtbar gemacht — echte Regression,
kein stiller Fehler wie bei Sweep A.

Kein Token im aktuellen System passt. Entscheidung für eine Sichtung:

| Datei : Zeile | Was | Deckkraft | Rolle |
|---|---|---|---|
| `shared/VelgAptitudeBars.ts:112` | `box-shadow: inset 0 1px 0 rgba(255,255,255,0.15)` | 0,15 | Glanzkante oben auf einem gefüllten Balken (gehört zum `color-mix(bar-color 70%, white)`-Glanz-Look derselben Regel) |
| `how-to-play/htp-styles.ts:1112` | `.elo-row__fill::after { background: rgba(255,255,255,0.4) }`, 3px breit, rechtsbündig | 0,4 | Kappen-Markierung am Ende eines Fortschrittsbalkens |
| `multiverse/MapMinimap.ts:34` | `stroke: rgba(255,255,255,0.3)` | 0,3 | SVG-Kontur des Sichtfelds auf der Minimap — muss gegen den dunklen Grund lesbar bleiben |

## Entschieden 2026-09-03: vierte Stufe, `--color-overlay-ink-bright`

Alle drei sind umgestellt. Das Token steht in `_colors.css` und ist wie die
drei darüber ein `color-mix()` über `var(--color-text-primary)` — es kippt
damit von selbst mit der Polarität: hell auf Phosphor, Tinte auf Papier.

**Anker bei 40 %, nicht bei 30 %.** `color-mix(… X%, transparent)` kann nur
verdünnen. Ein Token bei 30 % hätte die 40-%-Kappe in `htp-styles.ts` nicht
erreichen können, ohne am Verwendungsort das Token noch einmal von Hand zu
bauen — genau die Verdopplung, gegen die das Token da ist. Also sitzt es auf
dem stärksten seiner drei Fälle, die schwächeren treten herunter:

| Stelle | Faktor | ergibt |
|---|---|---|
| `htp-styles.ts .elo-row__fill::after` | pur | 40 % |
| `MapMinimap.ts .minimap__viewport` (stroke) | 75 % | 30 % |
| `VelgAptitudeBars.ts .fill` (Glanzkante) | 37,5 % | 15 % |

Zwei Dinge, die beim Umstellen im selben Atemzug auffielen und mitgingen:

- **`VelgAptitudeBars.ts`**, die Zeile über der Glanzkante:
  `color-mix(in srgb, var(--bar-color) 70%, white)`. Kein `rgba`, deshalb von
  keinem Tor gesehen — aber derselbe Fehler. „Weiß" heißt hier „weg vom Grund",
  und das stimmt nur, solange der Grund schwarz ist; auf Papier verblasst die
  Spitze des Balkens in die Seite. Läuft jetzt über `--color-text-primary`, wie
  die Ink-Tokens. Auf Phosphor ist der Unterschied `white` → `#e5e5e5` bei 30 %
  Gewicht, also praktisch keiner.
- **`MapMinimap.ts .minimap`**: `background: rgba(0, 0, 0, 0.7)` — ein Schleier,
  der nur „Tafel" bedeutet, solange die Seite schwarz ist. Es IST eine Tafel,
  also jetzt `color-mix(in srgb, var(--color-surface) 70%, transparent)`.

Beide Dateien liegen in Verzeichnissen, die `RGBA_ENFORCED_DIRS` noch nicht
erfasst (`shared`, `multiverse`, `how-to-play`) — die drei Zeilen kamen aus
dieser Liste, nicht aus dem Tor.

Nicht Teil dieser Liste (kein Weiß, gehören nicht zu Sweep C):
`archetypes/ArchetypeDetailView.ts:518` (`rgba(255,26,26,0.5)`, rot),
`shared/VelgGameCard.ts:311` (`rgba(255,100,100,0.1)`, rot).
