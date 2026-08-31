# Fortsetzungs-Prompt (nach Context-Clear einfügen)

> Stand: 31.08.2026 abends, Sitzung `velgarien-rebuild-88`.
> **Zehn Commits lokal, NICHTS gepusht.** Parallel: `velgarien-rebuild-45`.
> **Backend zum ersten Mal komplett grün: 4 915 bestanden, 41 übersprungen, 0 rot.**

---

## ▶ N5 IST ABGENOMMEN — die Sperre ist gebrochen

Der Deploy landete 08:03 UTC, der erste Tick danach lief um 09:00. Gemessen auf
Prod, vorher → nachher:

    Bedarfs-Moodlets                    0 →  26   (19 Agenten)
    Gruppen                             –  →  need_safety, need_social, need_stimulation
    Stärken                             –  →  −15 … −3
    schlechteste Laune der Plattform   −1 →  −22
    Agenten mit negativer Laune         0 →  55
    Agenten unter −20                   0 →   1
    Agenten mit Stress > 0              0 →   1  (max. 7)
    Moodlets gesamt                   188 → 213

🔑 **Die Kette, die elf Monate lang nicht anspringen konnte, läuft.** Bis heute
war die schlechteste Laune, die je ein Agent hatte, **−1** — bei einem Tor von
−20. Jetzt steht sie bei −22, und `fn_update_stress_levels` baut zum ersten Mal
Stress auf (vorher `count(distinct stress_level) = 1` über alle 258 Agenten).

Erst vier von vierzehn Welten haben getickt (station-null,
metabolic-currency, the-gaslit-reach, the-metamorphosis-of-memory);
**velgarien und the-m-bius-academy stehen noch auf 05:57/05:58** und kommen
beim nächsten Lauf (`heartbeat_interval_seconds = 14400`, also 4 h).

**`events` in den letzten 24 h steht weiter auf 0**, und das ist erwartet: die
zwei verbleibenden Tore sind weit. `relationship_threshold` braucht |Meinung|
≥ 60 (gemessen 0 … 45, und eine Meinung sinkt erst, wenn jemand beleidigt);
`stress_breakdown` braucht Stress ≥ 800, gemessen 7. **Die nächste Messung, auf
die es ankommt, ist die Meinungsspanne** — sobald sie unter 0 geht, hat die
erste Beleidigung stattgefunden.

Rücknahme, falls es zu viel wird:
```sql
DELETE FROM agent_moodlets WHERE stacking_group LIKE 'need\_%';
DROP FUNCTION fn_apply_need_moodlets(uuid, jsonb);
```

---

## ⚠ Drei Migrationen warten auf das Wort

| Migration | Inhalt | Geprobt | Auf Prod |
|---|---|---|---|
| 308 | Abgeschlossenheit der Bauzustands-Vokabulare | ✅ 2× | ❌ |
| 309 | Die Beschriftung folgt dem Zustand | ✅ 2× | ❌ |
| 310 | `json_repair_enabled = false` | ✅ 2× | ❌ |

Alle drei transaktional gegen die **echten Prod-Daten** geprobt
(`BEGIN … ROLLBACK`), jede zweimal in derselben Transaktion angewandt.
Nächste freie Nummer: **311**, Zeitstempel ab `20260831200000`.

Gemessene Wirkung von 308+309 zusammen:

    Taxonomiezeilen building_condition        305 → 363
    Simulationen mit Vokabular                 25 → 36  (alle)
    Bauten ohne deutsche Beschriftung         216 → 0
    Bauten, deren Wort von ihrer Welt abweicht 27 → 0

---

## Was diese Sitzung getan hat

**Die drei Punkte aus dem Nachmittags-Handoff sind durch** — aber keiner war
das, was dort stand.

**(1)** „Sechs Welten mit aufwärts laufender Zustandsleiter" war dreimal anders:
`sort_order` ist gar keine Leiter (reine Anzeigereihenfolge, kein Verbraucher
liest sie als Schweregrad); die Herkunft ist nicht die Schmiede, sondern die
handgeschriebenen Welt-Migrationen 043/140; und der Defekt trifft **sieben**
Simulationen, nicht sechs.

Der Nutzer fragte nach, ob es wirklich 25 originale Simulationen gebe — nein:
16 Ursprungswelten, 20 Epochenableger. Das Nachfragen legte den **grösseren
Befund** frei: von 16 Ursprungswelten können nur VIER ihre Bauzustände
vollständig benennen, und 216 von 324 Bauten zeigten in der deutschen
Oberfläche ein englisches Wort.

**(2)** `get_platform_stats` filtert `status` jetzt mit. Dabei gemessen: der
Zähler hat **null Aufrufer** und dupliziert `LandingService`. Löschung als T5.

**(3)** `_parse_or_repair_json` hatte null Aufrufer — aber der entscheidungsfreie
Teil war das **Messen**: alle elf Auswertungen scheiterten STILL. Jetzt gibt es
die Zahl; die Reparatur liegt hinter einem fail-closed Riegel.

**Übersetzung:** 106 Zeichenketten der neuen Frontseite, 8 118 → 8 158
Einheiten, **0 ohne deutsches Ziel**.

**Ledger:** 55 Lücken gegen das Repo, **null gegen das Schema**.
`scripts/compare_ledger_with_repo.py` ist das Messgerät dazu.

---

## Offene Punkte

`handoff/TODO-offen.md` führt sechs:

- **T1** Die Reiterleiste schneidet ihre Beschriftungen ab (elf von vierzehn).
  Ursache NICHT gemessen — erst messen, dann CSS.
- **T2** The Chitinous Mandate gehört dem zweiten Konto und fehlt deshalb im
  Shards-Auswahlmenü.
- **T3** `pristine` (6 Bauten), `restored`/`illuminated` (4) stehen neben der
  Leiter und verfallen nie. Inhaltliche Entscheidung.
- **T4** `buildings.building_condition_de` ist eine Zweitschrift; richtig wäre,
  dass die Oberfläche die Taxonomie liest (vier Frontend-Stellen).
- **T5** `/platform-stats` löschen (tot + schlechteres Duplikat).
- **T6** **Dashboard-Redesign**, Claude-Design-Paket in
  `handoff/dashboard-redesign/`. Zuständig `velgarien-rebuild-45`.
  🔑 Sechs von neun geforderten Datenzeilen gibt es nicht — das ist der Aufwand,
  nicht das CSS.

Aus der Vorsitzung offen: B16 Testversand · C2 Journal · `active_agents` (N3) ·
Tagesobergrenze Mails · ladungsfähige Anschrift · D1 Bureau-Druckformel ·
D9 Bleed-Auto-Freigabe · G3 sieben März-Epochen archivieren ·
Persönlichkeits-Rückfüllung (0,03 USD) · Datenexport existiert nicht.

---

## Rezepte

**Prod-SQL** und **Migration transaktional proben**: unverändert wie im
Nachmittags-Handoff.

🔑 **Eine NEU angelegte Funktion braucht ZWEI Rechte-Widerrufe:**
```sql
REVOKE ALL     ON FUNCTION … FROM PUBLIC;              -- PostgreSQLs Vorgabe
REVOKE EXECUTE ON FUNCTION … FROM anon, authenticated; -- Supabases pg_default_acl
```
Keiner genügt allein. Migration 307 kannte nur den zweiten Teil; der erste
Probelauf von 308 ist am eigenen Tor gescheitert. `has_function_privilege` misst
beide Wege.

🔑 **Ein Textscan über einen Funktionskörper muss den Docstring abstreifen.**
Der Docstring nennt den Befund, den die Funktion behebt — und steht damit VOR
dem Gegenstand. Zwei von drei roten Tests aus dieser einen Ursache.

🔑 **Ein Auslöser statt zweier geflickter Aufrufer.** Zwei Zeilen hätten die
Schreiber gedeckt, die ich GEFUNDEN habe.

**Geteilter Arbeitsbaum:** nie `git stash`, immer
`git commit -F <datei> -- <pfade>`, `git status` vor jedem Commit.
`frontend/src/locales/**` gehört dieser Sitzung.
