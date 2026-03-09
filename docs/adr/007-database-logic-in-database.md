---
title: "ADR-007: Datenbank-Logik in der Datenbank"
id: adr-007
date: 2026-02-15
lang: de
type: spec
status: active
tags: [adr, database, functions, triggers, invariants]
---

# ADR-007: Datenbank-Logik in der Datenbank

## Status

Accepted

## Context

Geschaefts-Invarianten (State Machines, Slug-Immutabilitaet, Owner-Guards) und atomare Multi-Tabellen-Operationen (Epoch-Cloning, Forge-Materialisierung, Cascade Events) muessen zuverlaessig durchgesetzt werden — unabhaengig davon, welcher Code-Pfad die Daten modifiziert.

## Decision

Geschaefts-Invarianten, abgeleitete Daten und atomare Multi-Tabellen-Operationen werden als PostgreSQL Functions und Triggers implementiert — nicht in der Anwendungsschicht.

## Alternatives Considered

- **Alle Logik in FastAPI** — Bypass-Risiko durch Application-Bugs, Race Conditions, fehlende Service-Aufrufe
- **Hybridansatz mit PG fuer Invarianten** — Gewaehlt

## Rule

Wenn die Logik eine Daten-Invariante schuetzt (State Machines, Slug-Immutabilitaet, Owner-Guard) oder atomar mehrere Tabellen modifiziert (`clone_simulations_for_epoch`, `fn_materialize_shard`, `process_cascade_events`) → PostgreSQL. Wenn sie externe APIs orchestriert (OpenRouter, Replicate, SMTP) → FastAPI.

## Documentation Convention

Jeder Python-Service, der eine Postgres-Funktion aufruft, eine View liest oder von einem Trigger abhaengt, **muss** die Migration-Nummer im Docstring dokumentieren:

```python
async def get_analytics(cls, supabase, simulation_id, campaign_id):
    """Aggregated campaign analytics via Postgres ``get_campaign_analytics`` (migration 065)."""
```

Format: `` ``object_name`` (migration NNN) `` — bei Updates: `` (migration NNN, updated MMM) ``.

Vollstaendiger Katalog aller Postgres-Objekte: siehe `memory/postgres-views.md`.

## Consequences

- ~48 Functions, 53 Trigger-Eintraege, 4 Materialized Views, 7 Views.
- Invarianten werden auf DB-Ebene erzwungen, unabhaengig vom Aufrufer (API, Migration, direkter DB-Zugriff).
- Alle Python-Service-Docstrings referenzieren die zugehoerige Migration.
- Siehe [Database Schema](../references/database-schema.md) fuer vollstaendige Dokumentation.
