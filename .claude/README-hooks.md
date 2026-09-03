# Die Tore, die am Schreibvorgang hängen

`settings.json` in diesem Verzeichnis trägt Hooks, die Claude Code beim Arbeiten
ausführt. JSON kann keine Kommentare tragen, deshalb steht die Begründung hier.

## PostToolUse · `Write|Edit` · Backtick-Tor

Nach jedem Schreiben in eine `frontend/src/**/*.ts` läuft
`frontend/scripts/lint-backtick-in-css.mjs`. Bei einem Verstoß kommt sofort ein
`decision: block` mit Datei und Zeile zurück.

**Wogegen.** Ein Backtick in einem Kommentar INNERHALB eines ``css`…` `` oder
``html`…` ``-Templates beendet das Template; alles danach parst als JavaScript.
Der Schaden ist still und vollständig: `biome check --write` meldet keinen
Fehler, sondern formatiert den ganzen Styles-Block zu JavaScript um
(`font - family;`) und meldet Erfolg.

**Warum am Schreibvorgang und nicht im Lint-Lauf.** Das Tor gibt es seit August.
Es lief nur beim nächsten vollen Durchgang — Minuten später, wenn der Fehler
schon unter zehn anderen Änderungen liegt. Am 03.09.2026 ist eine Sitzung
**fünfmal** hineingelaufen, obwohl eine Erinnerung dazu existierte. Eine
Erinnerung ist ein Rat; sie greift nur, wenn man im Moment des Schreibens an sie
denkt, und das tut man beim Formulieren eines Kommentars nicht.

**Warum Post- und nicht PreToolUse.** Ein PreToolUse-Hook sähe bei einem `Edit`
nur das Bruchstück und könnte nicht wissen, ob es in einem css-Template landet.
Dieses Werk ist voll von TypeScript-Doc-Kommentaren, die völlig zu Recht
Backticks tragen — eine Heuristik auf dem Bruchstück hätte ständig falsch Alarm
geschlagen. Der Nachlauf sieht die fertige Datei und benutzt das bereits
bewährte Tor: keine Fehlalarme, und der Grund kommt in derselben Sekunde zurück.

**Geprüft.** Der Befehl mit echter Hook-Eingabe (schweigt bei sauberen Dateien,
schweigt außerhalb `frontend/src`, blockt mit Datei und Zeile bei einer
Verletzung), das Schema mit `jq -e`, das Feuern mit einer Markierung, das
Blocken mit einer absichtlich eingebauten Verletzung über `Edit`.

**Abschalten.** `/hooks` im Terminal zeigt und deaktiviert sie.

---

## Die allgemeine Lehre

Wenn dieselbe Notiz mehrfach nicht greift, ist sie das falsche Werkzeug. Ein
wiederholter Fehler braucht einen Mechanismus, der im Augenblick des Fehlers
eingreift, keinen Merksatz.
