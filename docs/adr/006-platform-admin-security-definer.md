---
title: "ADR-006: Platform Admin via SECURITY DEFINER RPC"
id: adr-006
date: 2026-02-15
lang: de
type: spec
status: active
tags: [adr, admin, security, rpc, auth]
---

# ADR-006: Platform Admin via SECURITY DEFINER RPC

## Status

Accepted

## Context

Admin-Endpunkte benoetigen Zugriff auf `auth.users` (Benutzerliste, Benutzerdetails, Loeschung). Die GoTrue Admin API erwartet HS256-Tokens, die lokale Supabase-Instanz verwendet jedoch ES256.

## Decision

Admin-Endpunkte nutzen PostgreSQL SECURITY DEFINER-Funktionen statt GoTrue Admin API.

## Consequences

- SECURITY DEFINER-Funktionen (`admin_list_users`, `admin_get_user`, `admin_delete_user`) umgehen das HS256/ES256-Problem.
- Direkter `auth.users`-Zugriff mit korrekter Berechtigung.
- Alle drei Funktionen pruefen `is_platform_admin()` intern.
- Funktioniert identisch in lokaler und Production-Umgebung.
- `admin_get_user` fuehrt LEFT JOIN auf `user_wallets` durch (Migration 057) und liefert `forge_tokens` + `is_architect` als flache Felder. Backend konstruiert das Wallet-Objekt aus diesen RPC-Feldern — kein separater PostgREST-Query auf `user_wallets` noetig (vermeidet 500er bei fehlender Wallet-Zeile).
- `admin_delete_user` wurde in Migration 113 neu geschrieben (DROP + CREATE statt CREATE OR REPLACE wegen Return-Type-Konflikt). Neue Logik: Simulation-Ownership wird an den Platform-Admin uebertragen (lookup via `platform_settings.platform_admin_emails`), Audit/Referenz-Spalten werden auf NULL gesetzt, user-owned Records geloescht, dann `DELETE FROM auth.users` (CASCADE fuer restliche FKs). Gibt `void` zurueck statt `boolean`.
