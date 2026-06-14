# Production DB Reconciliation & Migration — 2026-06-14

Ops record of bringing production (`metaverse.center`, Supabase project
`bffjoupddfjaljqrwqck`, eu-west-3, PG 17.6) from a ~2-month-stale schema up to local HEAD.

## TL;DR

Production's DB schema was **~2 months behind** the deployed code (last migration applied
**21 April 2026**; the app had been running June-11 `main` code on an April-21 schema). It was
brought to HEAD by applying **19 migrations** = three feature packages:

- **Resonance Journal** (`232_journal_foundation`)
- **Per-sim world map** (`236_fn_apply_map_geometry`)
- **DRIFT** (`239`–`255`)

Method: a **transactional dry-run on prod** (`BEGIN … ROLLBACK`, run twice including an in-txn
verification `SELECT`) to prove the apply on the *real* prod state with **zero net change**, then
the **same SQL with `COMMIT`** + `schema_migrations` tracking rows — all via the Supabase
**Management API**.

Result (all verified): **28 tables + 17 functions** created, **53 RLS policies**, **51 FKs**,
`schema_migrations` **247 → 266**, app health **200**, **`drift_p0_enabled` stays `false`** (DRIFT
gated off, and its *code* is not on `main` → doubly inert). Existing data intact (agents 252,
simulations 40, buildings 317, events 109; embassies 40). **Full logical backup** taken first —
the project has **no PITR**, so the dumps are the only restore net.

## Why this was needed

Coolify deploys `main` but does **not** auto-apply migrations (pull-based, no migration step), and
migrations had not been applied to prod since 21 April. Meanwhile `main` advanced through ~2 months
of merged features (Resonance Journal, Agent Bonds, Bureau Ops, per-sim world map, …). So prod ran
**June-11 code on an April-21 schema** — features whose tables were missing (`journal_fragments`,
`journal_attunements`, …) were very likely **500'ing in production**. Bringing the DB to HEAD closes
that pre-existing gap *and* pre-stages the DRIFT schema (gated off) for a later launch.

## The migration-history problem (why standard tools failed)

The prod migration history was **doubly-drifted** vs the repo:

- **54 migrations exist on prod but not as local files** (exact timestamps like `20260421094240`),
  while the repo has **re-timestamped twins** (round numbers like `20260421100000`). →
  `supabase db push --linked` **refuses** ("Remote migration versions not found in local migrations
  directory"); its suggested `migration repair --status reverted` would re-apply existing objects →
  "already exists" failures. **Not usable.**
- **Name-matching is unreliable** too: even normalized (prefix-stripped) names produce false
  positives (e.g. `027b_velgarien_cities_zones` from February, `134_security_linter_fixes` from
  March reported as "missing" though the app has run on them for months).

**Ground truth = the object-level schema diff** (prod vs local HEAD), naming-independent:

```
TABLES:    local-HEAD 144 | prod 116 | missing on prod: 28 | extra on prod: 0
FUNCTIONS: local-HEAD 193 | prod 176 | missing on prod: 17 | extra on prod: 0
TYPES:     local-HEAD 4   | prod 4   | missing on prod: 0
```

**Prod is a clean SUBSET of HEAD** (no divergent prod-only objects) — the "prod-only" migrations
were all re-timestamped/renamed twins producing identical schema. The genuinely-missing objects are
exactly the 3 packages above.

**Coupling:** DRIFT cannot be applied alone — migration `243_travel_constraint_extensions` ALTERs
`journal_fragments` + `journal_attunements`, which only exist after `232` (Resonance Journal). So
"bring prod current" necessarily pulls Resonance Journal + map in with DRIFT.

## The safe method (and why not the alternatives)

| Approach | Verdict |
|---|---|
| `supabase db push --linked` | ❌ Refuses (the 54 remote-only) — would corrupt/fail on repair |
| `supabase db diff` (migra) | ❌ migra **drops RLS policies, grants, triggers** + no data seeds → on a **No-PITR** prod that risks a silent data-leak / lockout |
| **Real migration files, transactional dry-run → COMMIT** | ✅ Uses the authored/tested SQL (RLS + grants + seeds + data migrations); the dry-run proves it on the real prod state with **zero net change** (ROLLBACK) |

A local clone was rejected as the rehearsal substrate: the Supabase schema dump assumes the
`auth`/`storage` scaffolding (no `CREATE SCHEMA`), so a fresh DB restore is fiddly. The
**transactional dry-run directly on prod** is a *better* rehearsal — real `auth`, real data, exact
schema — and `ROLLBACK` makes it free.

## Execution

1. **Backup** (`/tmp/prod_drift_backup_20260614_222639/`): `schema.sql` 738 KB +
   `data.sql` 41.7 MB (full prod data) + `embassies_realprod.json` (40 rows, the only existing data
   migration `244` mutates). Confirmed **no PITR / 0 logical backups** on the project.
2. **Build apply set** = the 19 migration files (`232`, `236`, `239`–`255`) concatenated in version
   order, with top-level `BEGIN;`/`COMMIT;`/`ROLLBACK;` lines stripped (only `254`/`234` had them;
   plpgsql block `BEGIN` left untouched). `243`'s `ALTER TYPE … ADD VALUE 'travel'` is not *used* at
   migration time → no same-txn enum hazard (the dry-run validated this empirically).
3. **Dry-run #1** — `BEGIN; <19 migrations>; ROLLBACK;` via the Management API → response `[]`
   (clean, all statements succeeded, rolled back).
4. **Dry-run #2 (verification)** — same, with a `SELECT` of object existence *inside* the txn before
   ROLLBACK → proved `journal_fragments`/`travel_runs`/`fn_apply_map_geometry`/`fn_drift_scatter_cargo`
   all created, `drift_tuning` 12 rows, templates 4, lore seeded → then rolled back. (Confirms the
   `[]` was a real apply, not a no-op.)
5. **Real apply** — the same SQL with `COMMIT` + `INSERT INTO supabase_migrations.schema_migrations
   (version, name) … ON CONFLICT (version) DO NOTHING` for the 19, all in one transaction.

All SQL ran via `POST https://api.supabase.com/v1/projects/bffjoupddfjaljqrwqck/database/query`
(`Authorization: Bearer $SUPABASE_MCP_TOKEN`).

## Verification (meticulous — all green)

| Check | Result |
|---|---|
| Previously-missing tables now present | **28 / 28** (none missing) |
| Previously-missing functions now present | **17 / 17** (none missing) |
| RLS enabled on the 28 new tables | **28 / 28** |
| New tables with ≥1 RLS policy | **28 / 28** (**53** policies total) |
| Foreign keys on the new tables | **51** |
| `schema_migrations` rows | **266** (was 247; **19** new tracked) |
| EFFECT-class fns granted to anon/authenticated (ADR-006) | **0** ✓ |
| Player-class fns with `authenticated` grant | **6** ✓ |
| `drift_tuning` seed rows | **12** |
| Depesche templates | **4** (`deliver_borrowed_idiom`, `deliver_dream_cargo`, `deliver_memory_parcel`, `deliver_sealed_contract`) |
| `drift_p0_enabled` | **`false`** (gated off) |
| `244` embassy repair | embassies **40** intact · **17** agent_id backfilled · **6** Lacewing slots |
| Sanity (existing data untouched) | agents **252** · simulations **40** · buildings **317** · events **109** |
| Functional call `drift_tuning_value('window_base')` | **8** (function + table work end-to-end) |
| App health (`/api/v1/health`) | **HTTP 200** |
| Public DRIFT endpoint on prod | **404** (DRIFT code not on `main` → doubly inert) |

## Access method (for future prod work)

See `~/.config/metaspots/SUPABASE-ACCESS.md`. Summary:

- Prod ref **`bffjoupddfjaljqrwqck`**; token `SUPABASE_MCP_TOKEN` in the repo `.env` (`sbp_…`).
- Run SQL on prod via the **Management API** (above) or `supabase … --linked` (CLI is linked).
- ⚠️ **Decoy:** `duqybyxpgghietjbrxnc` (host `aws-1-eu-west-3.pooler.supabase.com`) is a different,
  near-empty project whose conn string is also in the config files — **not** prod.
- `.env SUPABASE_DB_URL` is **local** (`127.0.0.1:54322`); the real prod DB password is not in
  plaintext (cached by `supabase link`) — use the Management API.

## What's left (not part of this op)

1. **DRIFT launch** (user's call, later): merge **PR #7** (`feat/drift-p0a-foundation` → `main`) →
   Coolify deploy `main` → set `drift_p0_enabled=true`. The schema is pre-staged.
2. **Rotate the OpenRouter API keys** that were logged in plaintext during a parallel image-gen run.
3. Keep the backup at `/tmp/prod_drift_backup_20260614_222639/` until confident (no PITR).
4. Consider enabling **PITR** on the Supabase project (a managed restore net was absent here).

## Runbook — applying further migrations to this (drifted) prod

Because `db push` is unusable until the history is reconciled:

1. `supabase db dump --linked` schema + `--data-only` → backup (no PITR).
2. Object-level schema diff (prod vs local HEAD) to find what's genuinely missing — **not** name/version
   matching.
3. Concatenate the real migration files for the missing objects, strip top-level txn control.
4. **Dry-run** `BEGIN; … ROLLBACK;` via the Management API → must return `[]`; add an in-txn verify
   `SELECT` to confirm a real apply.
5. Re-run with `COMMIT` + `schema_migrations` rows.
6. Verify objects / RLS / grants / seeds / gate / sanity / app health.
