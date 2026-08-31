# Fortsetzungs-Prompt (nach Context-Clear einfügen)

> Stand: 31.08.2026 nachmittags, Sitzung `velgarien-rebuild-88`.
> **Alles committet UND gepusht** (`origin/main` = `50a36dc5`).
> Parallel läuft `velgarien-rebuild-45` an der neuen Frontseite (L5).

---

Setze den Umsetzungsplan aus der Systemprüfung vom 30.08.2026 weiter um —
händisch, Schritt für Schritt, keine Agenten.

ARBEITSWEISE: Arbeite so lange wie möglich DURCHGEHEND. Mach zuerst ALLES, was
keine Entscheidung von mir braucht. Frag mich erst, wenn nichts
Entscheidungsfreies mehr übrig ist — und dann gebündelt.

LIES ZUERST:
1. Memory `paket-d-h-mail-2026-08-31-nachmittag.md` — der vollständige Stand.
2. Memory `revoke-from-public-does-not-remove-anon.md` und
   `git-stash-shared-worktree.md` — beide heute geschrieben, beide teuer gelernt.
3. `docs/analysis/warum-keine-events-2026-08-31.md` — N5 mit dem Nachtrag, der
   die Ursache benennt.
4. `docs/plans/system-review-remediation-2026-08-30.md` — §0 verbindlich.

ZUERST PRÜFEN:
- `git log --oneline origin/main..HEAD` → sollte **0** sein.
- Ticken die Welten? `select slug, last_heartbeat_tick, last_heartbeat_at from
  simulations where slug in ('velgarien','the-m-bius-academy')`
- **Ist deployt?** `fn_apply_need_moodlets` ist auf Prod, der Aufrufer im Tick
  ist gepusht aber womöglich nicht ausgeliefert. Prüfen:
  `ssh root@45.137.68.227 "docker logs --since 30m \$(docker ps --format '{{.Names}}' | grep a6exg | head -1)" | grep need_moodlets`

---

## Was steht (alles auf Prod, alles gepusht)

| Migration | Inhalt | Zustand |
|---|---|---|
| 295, 299, 301, 302 | Epochen-Klon, Chat-Prompt, Zonenmaßnahme, Instagram-Schlüssel | ✅ Prod |
| 303 | Zustandsleiter der Bauten an EINER Stelle (Verfall 209 → 297 von 324) | ✅ Prod |
| 304 | Botschafter über `agent_id` statt Namen | ✅ Prod |
| 305 | Botschafter-Güte: Anwesenheit statt Zeichenlänge (0 von 40 verändert) | ✅ Prod |
| 306 | **`fn_apply_need_moodlets`** — Bedürfnisse werden zu Stimmung (N5) | ✅ Prod |
| 307 | anon-Rechte der neuen Funktionen widerrufen | ✅ Prod |

**Nächste freie Nummer: 308**, Zeitstempel ab `20260831170000`.
Der Peer nimmt ab `20260831130000` — abstimmen, er ist bei der Frontseite.

Pakete: **D10 komplett**, D12 komplett, H2, H5, Mail-P3.27/P3.28, N5 gebaut.

---

## ⚠ Der eine Punkt, der halb offen ist

**N5 wirkt erst nach einem Deploy.** `fn_apply_need_moodlets` steht auf Prod,
aber der Aufruf im Tick (`AgentNeedsService.apply_need_moodlets`, Phase 9a-2 in
`heartbeat_service.py`) ist nur gepusht. Bis zum Deploy ändert sich am Spiel
nichts.

Nach dem Deploy, beim ersten Tick, erwartet:
- 2 von 258 Agenten unter Laune −20 (gemessen, nicht geschätzt)
- `fn_update_stress_levels` beginnt bei diesen Stress aufzubauen
- `insult` wird für sie wählbar — die erste negative Interaktion der Welt

Messen nach dem Deploy:
```sql
select count(*) from agent_moodlets where stacking_group like 'need\_%';
select min(mood_score), count(*) filter (where mood_score < -20) from agent_mood;
select max(stress_level) from agent_mood;
select count(*) from events where created_at > now() - interval '1 day';
```
Die letzte Zahl steht seit Monaten auf 0. Sie ist die eigentliche Abnahme.

Rücknahme, falls es zu viel wird:
```sql
DELETE FROM agent_moodlets WHERE stacking_group LIKE 'need\_%';
DROP FUNCTION fn_apply_need_moodlets(uuid, jsonb);
```

---

## Offene Punkte (keiner blockiert)

1. **Sechs von 25 Welten haben eine Zustandsleiter, die aufwärts geht**
   (`excellent → good → fair → restored → illuminated`, aufsteigender
   `sort_order`). Ein Verfall entlang `sort_order` würde dort ein Gebäude
   VERBESSERN. Schmiede-Befund, in Migration 303 ausdrücklich ausgespart.
2. **`get_platform_stats` filtert `status` nicht** (zählt `template AND
   deleted_at IS NULL` → 16, weil zufällig alle aktiv sind). Sobald die erste
   Welt archiviert wird, wirbt die Plattform mit ihr weiter. Dieselbe Form wie
   N3. Vom Peer gemeldet, nicht angefasst.
3. **`GenerationService._parse_or_repair_json` hat null Aufrufer** — alle elf
   JSON-Auswertungen rufen `_parse_json_content` direkt. Die LLM-Reparatur ist
   in diesem Werk nie gelaufen. Sie zu verdrahten ist eine Kostenentscheidung
   (ein zweiter bezahlter Aufruf je misslungener Antwort).
4. **Supabase Storage liefert immer `cache-control: no-cache`** — vom Peer in
   drei Formen gemessen. Halb so schlimm (ETag + 304, null Bytes), aber ein
   Infrastrukturpunkt.
5. **Ledger-Drift**: 52 Repo-Migrationen fehlen im Prod-Ledger und 54
   Ledger-Zeilen im Repo, alle aus April 2026 — dieselben Migrationen unter
   verschiedenen Zeitstempeln (`db push` vergab sie damals selbst). Kein
   Wirkungsproblem, aber der Beleg dafür, dass nur der Schema-Abgleich zählt.
6. Aus der Vorsitzung offen: B16 Testversand · C2 Journal · `active_agents`
   (30 Agenten gelöschter Welten, N3) · Tagesobergrenze Mails · ladungsfähige
   Anschrift · D1 Bureau-Druckformel · D9 Bleed-Auto-Freigabe · G3 sieben
   März-Epochen archivieren · Persönlichkeits-Rückfüllung (0,03 USD) ·
   Datenexport existiert nicht (DSGVO-Mail verweist darauf).

---

## Rezepte, die heute gebraucht wurden

**Prod-SQL:**
```bash
TOKEN=$(grep -E '^SUPABASE_MCP_TOKEN=' .env | cut -d= -f2- | tr -d '"' | xargs)
.venv/bin/python -c "import json,sys,pathlib; print(json.dumps({'query': pathlib.Path(sys.argv[1]).read_text()}))" abfrage.sql \
  | curl -sS -X POST "https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @-
```

**Migration transaktional gegen ECHTE Daten proben** (stärker als ein
Wegwerf-Postgres, wenn Zeilenzahlen geprüft werden sollen):
`BEGIN;` + Migration + `ROLLBACK;` als EINE Nachricht senden. Der Abnahmeblock
läuft dann gegen den echten Bestand. Danach gegenprüfen, dass die Rücknahme
gegriffen hat.

**Nach JEDER neu angelegten Funktion die Rechte messen** — `REVOKE … FROM
PUBLIC` nimmt anon nichts weg (siehe Memory). Und die Signatur vorher holen:
`select oid::regprocedure::text from pg_proc where proname='…'`.

**Im geteilten Arbeitsbaum immer** `git commit -F <datei> -- <pfade>`. Ein
`git commit` ohne Pfadangabe nimmt den GANZEN Index, auch die Dateien der
anderen Sitzung.

⚠ **Heredoc IMMER quotieren** (`<<'PYEOF'`).

---

REGELN: nach jeder Änderung `.venv/bin/ruff check backend` + `cd frontend &&
npm run lint:full` + betroffene pytest. Migrationen proben, zweimal anwenden.
**Prod-SCHREIBvorgänge nur mit meinem ausdrücklichen Wort; Prod LESEN ist
frei.** Werte messen, nicht Zähler. `velg-frontend-design`-Skill vor jedem
Komponentencode. CLAUDE.md gilt vollständig.

GETEILTER ARBEITSBAUM mit `velgarien-rebuild-45`: nie `git stash`, nur explizite
Pfade stagen UND committen, `git status` vor jedem Commit. Sie hält gerade die
gesamte Frontseite (`LandingPage.ts`, `components/landing/`, `landing_service`,
`models/landing.py`, `routers/public.py`). `frontend/src/locales/de.xlf` gehört
mir — **wer neue `msg()`-Zeichenketten einführt, ruft NICHT selbst
`lit-localize extract`**, sondern meldet sich.
