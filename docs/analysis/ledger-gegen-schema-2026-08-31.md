---
title: "Der Ledger weicht ab, das Schema nicht — 55 Migrationen nachgemessen"
date: "2026-08-31"
type: analysis
status: measured
lang: de
tags: [migrations, ledger, prod, schema-drift]
---

# Der Ledger weicht ab, das Schema nicht

> Gemessen auf Prod am 31.08.2026. Alle Zahlen aus der laufenden Datenbank,
> keine aus einem Bericht. Messgerät: `scripts/compare_ledger_with_repo.py`.

## Der Anlass

Im Fortsetzungsstand stand als offener Punkt 5:

> **Ledger-Drift**: 52 Repo-Migrationen fehlen im Prod-Ledger und 54
> Ledger-Zeilen im Repo, alle aus April 2026 — dieselben Migrationen unter
> verschiedenen Zeitstempeln (`db push` vergab sie damals selbst). Kein
> Wirkungsproblem, aber der Beleg dafür, dass nur der Schema-Abgleich zählt.

„Kein Wirkungsproblem" war eine Annahme. Sie stimmt — aber sie war nicht
gemessen, und im Gedächtnis standen zugleich zwei Migrationen (237, 238) als
„fehlend auf Prod" geführt. Beides zusammen konnte nicht stimmen.

## Die Zahlen

    Ledger-Zeilen                                          320
    Repo-Dateien                                           321

    Repo-Dateien ohne Ledger-Zeile                          55
    Ledger-Zeilen ohne Repo-Datei                           54

    davon nach NAME gepaart (nur der Zeitstempel weicht ab)  45
    danach unerklärt                                        10
      davon noch gar nicht angewandt (308, 309, 310)         3
      tatsächlich zu prüfen                                  7

## Warum die 45 keine Lücke sind

`supabase db push` hat den Zeitstempel damals selbst vergeben **und dabei das
Nummernpräfix abgeschnitten**:

    Repo    20260409200000_185_awakening_partial_narratives.sql
    Ledger  20260409075104   awakening_partial_narratives

Beides ist dieselbe Migration. Ein Vergleich über die Version findet sie
zweimal und meldet zweimal eine Lücke; ein Vergleich über den Namen ohne
Präfix findet sie einmal.

🔑 **Zwei Zahlen, die beide alarmierend aussehen (55 und 54), sind zu einem
grossen Teil dieselbe Zeile, von zwei Seiten gezählt.**

## Die sieben, die übrig blieben — jede einzeln am Schema geprüft

Für diese sieben gibt es weder eine Ledger-Zeile noch einen gleichnamigen
Eintrag. Geprüft wurde nicht der Ledger, sondern die WIRKUNG:

| Migration | Prüfung am Schema | Ergebnis |
|---|---|---|
| 186 `heartbeat_entry_type_resonance_mood` | `heartbeat_entries_entry_type_check` lässt `resonance` und `mood` zu | ✅ |
| 187 `features_settings_public_read` | Richtlinie `settings_anon_select` auf `simulation_settings` | ✅ |
| 193 `achievement_badge_icons_and_contrast` | 4 von 4 `icon_key` an den Auszeichnungen | ✅ |
| 233 `fix_join_team_phantom_race` | `fn_join_team_checked` vorhanden, mit Kommentar | ✅ |
| 234 `dungeon_partial_narratives` | 6 von 6 Awakening-Zeilen in `dungeon_banter` | ✅ |
| 237 `events_realtime_publication` | `events` in `pg_publication_tables` für `supabase_realtime` | ✅ |
| 238 `revoke_auto_draft_from_authenticated` | `has_function_privilege('authenticated', …)` = **false** | ✅ |

**Sieben von sieben sind angewandt.** Darunter 237 und 238, die im Gedächtnis
als Lücke geführt waren.

## Was daraus folgt

🔑 **Der Ledger taugt in BEIDE Richtungen nicht als Beleg.** Der Vorfall
`prod-schema-gap-migration-235` hat gelehrt, dass eine Ledger-Zeile nicht
beweist, dass eine Migration angewandt ist. Diese Messung ergänzt die
Umkehrung: **eine fehlende Ledger-Zeile beweist nicht, dass sie es nicht ist.**

Ein Eintrag in der Restliste ist deshalb kein Befund, sondern eine Frage. Und
sie hat nur eine Form, in der sie zu beantworten ist: nachsehen, was die
Migration TUT, und nachsehen, ob es dasteht. Eine allgemeine Automatik gibt es
nicht — jede Migration tut etwas anderes.

## Das Messgerät

`scripts/compare_ledger_with_repo.py`, rein lesend. Es paart nach Namen und
gibt aus, was danach unerklärt bleibt. Es behauptet ausdrücklich nicht, dass
diese Migrationen fehlen; es sagt, wo hingesehen werden muss.

Solange 308–310 nicht angewandt sind, stehen sie erwartungsgemäß in der Liste.

## Nicht gemessen

Die 54 Ledger-Zeilen ohne Repo-Datei sind nach dieser Paarung zu 45 erklärt;
neun bleiben (`215a/b/c`, drei `228_bureau_ops_*`, `fix_fn_award_achievement_type_mismatch`,
`fix_trg_ach_forge_columns`, `achievement_badge_icons_cohesive_set`). Das sind
Migrationen, die auf Prod liefen und deren Datei im Repo nicht (mehr) unter
diesem Namen steht — die harmlosere Richtung, weil die Wirkung dasteht und nur
die Herkunft im Repo anders heisst. Wer sie aufräumen will, fängt bei
`215a/b/c` an: sie sind die aufgespaltete Fassung des einen Repo-Files
`215_substrate_audit_fixes`.
