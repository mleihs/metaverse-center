# Code Audit: Velgarien Rebuild
**Datum:** 23. März 2026
**Status:** KRITISCHE MÄNGEL (Nicht produktionsreif)
**Audit-Scope:** Full Stack (FastAPI, Lit 3, Supabase, AI Integrations)

## 1. Executive Summary
Die Architektur ist gut strukturiert (FastAPI Services/Routers, Lit Signals), leidet aber unter fatalen Sicherheitslücken und Performance-Flaschenhälsen. Die Trennung von Verantwortlichkeiten ist sauber, wird aber durch weitreichende RLS-Bypasses im Backend untergraben.

---

## 2. Kritische Findings (P0/P1)

### [P0] Kritisches User-Daten-Leak (Security by Obscurity)
*   **Datei:** `supabase/migrations/20260311100000_096_grant_admin_list_users_to_authenticated.sql`
*   **Problem:** Der RPC `admin_list_users` (SECURITY DEFINER) wurde per `GRANT TO anon` öffentlich freigegeben.
*   **Risiko:** Jeder Angreifer kann via Supabase-REST-API die gesamte Nutzerdatenbank (E-Mails, IDs, Metadaten) auslesen. Das UI-Gating im `DevAccountSwitcher` ist wirkungslos.
*   **Fix:** `REVOKE EXECUTE ON FUNCTION public.admin_list_users FROM anon, authenticated;`

### [P1] SSRF Schwachstelle in Image Service
*   **Datei:** `backend/services/image_service.py` (`_download_reference_image`)
*   **Problem:** Lädt Bilder von User-URLs ohne IP-Validierung herunter.
*   **Risiko:** Zugriff auf interne Metadaten-Endpunkte (AWS/GCP) oder interne Netzwerk-Ressourcen durch manipulierte `style_reference_url`.
*   **Fix:** Nutzung der SSRF-geschützten `fetch_from_url` Logik aus `StyleReferenceService`.

### [P1] Performance: Synchronous I/O in Async Loop
*   **Datei:** Global im Backend (`services/`, 100+ Treffer von `.execute()`)
*   **Problem:** Die Supabase-Python-Library (v2.25.1) führt synchrone HTTP-Requests aus.
*   **Risiko:** Jeder DB-Call blockiert den FastAPI Event-Loop. Unter Last führt dies zum Totalausfall (Thread Starvation).
*   **Fix:** Kapselung der DB-Calls in `asyncio.to_thread()` oder Umstieg auf asynchrone HTTP-Clients.

---

## 3. Bereichsweises Audit

### FastAPI (Backend)
*   **RLS-Bypass:** Exzessive Nutzung von `get_admin_supabase` (Service Role Key) hebelt RLS-Sicherheit aus.
*   **Validierung:** Pydantic-Models sind vorbildlich implementiert.
*   **AI-Services:** `OpenRouterService` und `ReplicateService` haben exzellentes Error-Handling/Retries.

### Lit 3 (Frontend)
*   **State Management:** Hervorragender Einsatz von Preact Signals (`AppStateManager.ts`).
*   **XSS:** Einziger Treffer `unsafeHTML` in `EventDetailsPanel.ts` ist manuell (Regex) escaped, aber strukturell riskant.

### Supabase (Database)
*   **Architektur:** Saubere Migrationen, guter Einsatz von Materialized Views für Game-Metriken.
*   **Policies:** RLS auf Kerntabellen (`agents`, `buildings`) ist korrekt definiert (`user_has_simulation_role`).

---

## 4. Sofortmaßnahmen (Quick Wins)
1.  **Sperrung des RPC-Leaks:** Den öffentlichen Grant auf `admin_list_users` sofort widerrufen.
2.  **SSRF Protection:** IP-Check in `image_service.py` nachrüsten.
3.  **Threadpooling:** Helper-Funktion für Supabase-Calls einführen:
    ```python
    async def run_query(query):
        return await asyncio.to_thread(query.execute)
    ```

---

## 5. Remediation Log

### [P0] admin_list_users RPC Leak — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| REVOKE EXECUTE FROM anon, authenticated | `supabase/migrations/20260323100000_147_revoke_admin_list_users_public_access.sql` | Done |
| DevAccountSwitcher auf Backend-API (adminApi.listUsers) umgestellt | `frontend/src/components/platform/DevAccountSwitcher.ts` | Done |
| Hardcoded Passwords in Env-Variable verschoben (VITE_DEV_SWITCHER_PASSWORD) | `frontend/src/components/platform/DevAccountSwitcher.ts` | Done |

**Verifikation:**
- TypeScript: 0 Fehler
- Backend Unit Tests: 842 passed
- Color Token Lint: PASS
- Backend Ruff: 0 neue Fehler (1 pre-existing in test file)

### Postgres-First Race Conditions — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| 6 atomische RPCs (mission status, building degrade, zone downgrade, relationships, RP grant, fortification expiry) | `supabase/migrations/20260323200000_148_atomic_game_rpcs.sql` | Done |
| Lore sort_order Trigger (fn_lore_auto_sort_order) | Migration 148 | Done |
| Feature-Flag `use_atomic_game_rpcs` in platform_settings | Migration 148 | Done |
| operative_mission_service.py: Feature-Flag-gesteuerte Dual-Path-Methoden | `backend/services/operative_mission_service.py` | Done |
| cycle_resolution_service.py: grant_rp + fortification expiry auf RPCs | `backend/services/cycle_resolution_service.py` | Done |
| heartbeat_service.py: TOCTOU durch INSERT-first Pattern ersetzt | `backend/services/heartbeat_service.py` | Done |
| Unit Tests: Saboteur RPC-Pfad + Legacy-Pfad gepatcht | `backend/tests/unit/test_operative_service.py` | Done |
| postgres-views.md: RPC-Katalog um 17 fehlende Einträge ergänzt | Memory-Datei | Done |

**Verifikation:**
- Unit Tests: 843 passed
- Ruff: 0 Fehler auf allen geänderten Dateien
- Feature-Flag default `false` — Legacy-Code aktiv bis manuell umgeschaltet

### [P1] SSRF — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| Zentrales SSRF-safe Fetch-Utility mit DNS-Rebinding-Schutz | `backend/utils/safe_fetch.py` | Done |
| image_service.py: `_download_reference_image()` auf safe_download umgestellt | `backend/services/image_service.py` | Done |
| style_reference_service.py: `fetch_from_url()` auf safe_download delegiert, Inline-Checks entfernt | `backend/services/style_reference_service.py` | Done |
| 23 neue Unit-Tests (Scheme, IP, DNS-Rebinding, Content-Type, Size) | `backend/tests/unit/test_safe_fetch.py` | Done |
| Bestehende SSRF-Tests angepasst (DNS-Mock statt Network-Call) | `backend/tests/unit/test_style_reference_service.py` | Done |

**Verifikation:**
- Unit Tests: 866 passed (23 neue)
- Ruff: 0 Fehler
- DNS-Rebinding-Schutz: Prüft alle resolved IPs, nicht nur Raw-IPs

**Noch offen (spätere PRs):** instagram_image_composer.py, codex_export_service.py

### [P1] Sync I/O — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| `dependencies.py`: `create_client` → `await create_async_client`, `Client` → `AsyncClient as Client` | `backend/dependencies.py` | Done |
| ~970 `.execute()` Calls mit `await` versehen (alle async Funktionen) | 146 Backend-Dateien | Done |
| Test-Mocks: `MagicMock.execute` → `AsyncMock` für alle Supabase Mocks | 29 Test-Dateien | Done |
| SEO-Middleware: Eigener sync Client beibehalten (nicht async-migriert) | `backend/middleware/seo.py`, `seo_content.py` | Bewusst sync |

**Verifikation:**
- Unit Tests: 866 passed (0 failed)
- Syntax: 0 Fehler (alle Dateien kompilierbar)
- Ruff: 0 Fehler
- TypeScript: 0 Fehler
- AsyncClient verifiziert: `.auth.set_session()`, `.table().execute()` (async), `.rpc().execute()` (async)
- AST-basierter Audit (Python-Parser): 0 un-awaited Calls über 238 Produktionsdateien
- 47 zusätzliche await-on-attribute Bugs via Sentry Production Error + AST gefunden und gefixt
- 10+ iterative Deep Dives: insgesamt ~83 manuelle Fixes nach initialem Script
- Storage-Ops (.upload, .get_public_url, .remove, .list) alle async und awaited
- PlatformConfigService.get/get_multiple auf async migriert, alle 9 Caller aktualisiert
- SEO-Middleware bewusst sync (eigener create_client, separater Client-Lebenszyklus)

### Pattern-Violations — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| agent_autonomy.py: 6 DB-Queries in Services extrahiert | `routers/agent_autonomy.py` + 4 Service-Dateien | Done |
| Cipher public dispatch: admin_supabase beibehalten (SECURITY DEFINER RPC darf nicht an anon granted werden per ADR-006). Documented exception in ADR-009 | `routers/cipher.py`, `docs/adr/009-admin-supabase-usage-policy.md` | Done |
| ADR-009: admin_supabase Usage Policy | `docs/adr/009-admin-supabase-usage-policy.md` | Done |
| Fehlende Audit-Logs in invitations.py | `routers/invitations.py` | Done |

### [Frontend] unsafeHTML XSS — BEHOBEN (23.03.2026)

| Maßnahme | Datei | Status |
|----------|-------|--------|
| Shared markdown utility mit marked + DOMPurify | `frontend/src/utils/markdown.ts` | Done |
| EventDetailsPanel regex-Markdown durch renderSafeMarkdown ersetzt | `frontend/src/components/events/EventDetailsPanel.ts` | Done |

**Verifikation:**
- TypeScript: 0 Fehler
- Color Token Lint: PASS
- DOMPurify Config: Nur sichere Tags (h2-h4, p, br, strong, em, ul, ol, li, a, blockquote)

### Zusätzliche Findings (Deep-Dive-Verifizierung, 23.03.2026)

1.  **Postgres-First-Verletzungen:** 8 Race Conditions in `operative_mission_service.py`, `cycle_resolution_service.py`, `heartbeat_service.py`, `lore_service.py` — fetch-compute-update statt atomischer RPCs.
2.  **Router/Service-Trennung:** `agent_autonomy.py` hat direkte DB-Queries im Router (6 Endpoints).
3.  **Cipher admin_supabase:** Public Endpoint `POST /bureau/dispatch` nutzt unnötig `get_admin_supabase`.
4.  **Kostenkontrolle:** BYOK nur für Replicate (Images), nicht für OpenRouter (Text). Kein Token-Tracking.

Vollständiger Remediationsplan: `.claude/plans/jolly-beaming-backus.md`

---

## 6. Bewertung (1-10)
*   **Sicherheit:** 2/10 (Ziel nach Remediation: 8/10)
*   **Performance:** 3/10 (Ziel: 7/10)
*   **Architektur:** 6/10 (Ziel: 9/10)
*   **Wartbarkeit:** 7/10 (Ziel: 8/10)
*   **Produktionsreife:** NEIN (Ziel: JA nach Phase 0-4)
