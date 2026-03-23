---
title: "ADR-009: admin_supabase Usage Policy"
id: adr-009
date: 2026-03-23
lang: de
type: spec
status: active
tags: [adr, security, rls, admin, supabase]
---

# ADR-009: admin_supabase Usage Policy

## Status

Accepted

## Context

`get_admin_supabase()` returns a Supabase client using the `service_role` key, which bypasses Row Level Security (RLS). Overuse of this client weakens the defense-in-depth architecture. An audit (March 2026) found 166 usages across 31 files — most legitimate, but some unnecessary.

## Decision

Admin Supabase (`service_role` client) is permitted ONLY in these contexts:

### Legitimate Uses

1. **Platform admin endpoints** — protected by `require_platform_admin()` decorator. Examples: user management, settings, Instagram/Bluesky publishing, news scanner.

2. **Cross-simulation operations** — where RLS prevents cross-boundary queries by design. Examples: embassy creation (links two simulations), echo propagation, connection management.

3. **SECURITY DEFINER RPC calls** — where the RPC itself enforces access control. Examples: `fn_materialize_shard`, `clone_simulations_for_epoch`, `fn_compute_cycle_scores`.

4. **Background system tasks** — schedulers and heartbeat that run without a user context. Examples: `heartbeat_service`, `resonance_scheduler`, `instagram_scheduler`, `bluesky_scheduler`.

5. **Game epoch mechanics** — where epoch-scoped operations require cross-participant writes. Examples: `cycle_resolution_service`, `operative_mission_service` (during resolution), `bot_service`.

### Permitted Exception: Public Endpoints with SECURITY DEFINER RPCs

Public (unauthenticated) endpoints MAY use `get_admin_supabase()` when ALL of these conditions are met:
1. The endpoint delegates to a SECURITY DEFINER RPC that contains ALL validation internally (rate limiting, deduplication, input sanitization)
2. The RPC is NOT granted to `anon` or `authenticated` (defense-in-depth: only service_role can call it)
3. The endpoint has FastAPI-level rate limiting (`@limiter.limit()`)
4. The RPC returns no sensitive data

Example: `POST /api/v1/public/bureau/dispatch` (cipher redemption) uses `admin_supabase` to call `fn_redeem_cipher_code` — the RPC enforces per-IP rate limits, deduplication, and returns only safe reward data.

### Forbidden Uses

1. **Granting SECURITY DEFINER RPCs to anon/authenticated** — NEVER. All SECURITY DEFINER RPCs must be callable only by service_role. The backend provides the security boundary. (See incident: migration 096→147.)

2. **Normal user CRUD** — user-scoped reads/writes must use `get_supabase()` (user JWT) to enforce RLS.

3. **Lazy RLS bypass** — if an operation fails with the user client, fix the RLS policy instead of switching to admin client.

## Documentation Convention

Every function accepting `admin_supabase: Client` must document WHY in its docstring:

```python
async def resolve_pending_missions(
    cls, supabase: Client, epoch_id: UUID,
) -> list[dict]:
    """Resolve missions -- uses admin client because cross-simulation
    writes are required (saboteur effects target other simulations).
    """
```

## Consequences

- Security audit baseline: 74% of admin_supabase uses confirmed legitimate.
- Migration 147: Revoked `admin_list_users` public grant (incident from migration 096).
- Migration 149: Cipher dispatch moved from admin to anon client.
- New CLAUDE.md rule: "Never use service_role in public/user-facing endpoints."
