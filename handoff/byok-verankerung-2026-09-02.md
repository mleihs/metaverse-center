# BYOK — Analyse und Sanierungsplan

**Stand:** 2026-09-02 · **Status:** analysiert, nichts implementiert · **Zweig:** `main`

## Der Satz, um den es geht

Der Schlüssel gehört der **Person**. Er liegt in der **Geldbörse der Schmiede**
(`user_wallets`), hinter dem Tor **Architekt**, in einem Modal namens **Münze** —
drei Wörter aus der Ökonomie der Forge für eine Sache, die keine Ökonomie ist.
Dasselbe Muster wie `member_role='architect'`: ein Wort der einen Achse in der
Spalte der anderen.

## Ist-Zustand auf Produktion (gemessen 2026-09-02)

| Messung | Wert |
|---|---|
| `user_wallets` | 4 Zeilen, alle `is_architect` |
| `byok_allowed` | **0** |
| `byok_bypass` | 0 |
| hinterlegte Schlüssel | **0 OpenRouter / 0 Replicate** |
| `byok_access_policy` | `per_user` |
| `byok_bypass_enabled` | `false` |
| `ai_usage_log.key_source` | 604 von 604 Zeilen `platform` (10,5311 USD, 05.04.–01.09.) |

BYOK ist auf Prod **funktionsunfähig** — nicht kaputtgegangen, sondern nie
erreichbar gewesen.

## Die Kette

- **Speicher:** `user_wallets.encrypted_openrouter_key` / `encrypted_replicate_key`
  (Migr. 055), Fernet/AES-256 via `backend/utils/encryption.py`, EIN
  `SETTINGS_ENCRYPTION_KEY` für Wallets *und* `simulation_settings`.
- **Schreiben:** `PUT /forge/wallet/keys` (`backend/routers/forge.py:385`) →
  `require_architect()` → `_check_byok_access` (`forge.py:77`) →
  `ForgeDraftService.update_user_keys` → SECDEF-RPC `fn_update_user_byok_keys`
  (Migr. 125/218, prüft `auth.uid() = p_user_id` selbst).
- **Lesen:** `get_user_keys` (`backend/services/forge_draft_service.py:251`);
  `None` fällt auf den Plattformschlüssel zurück.
- **Wirkung — nur zwei Stellen:** Forge-Orchestrator (6 Aufrufe, eigener Nutzer)
  und Herzschlag Phase 9 (`heartbeat_service.py:1043` — Schlüssel des **Welt-
  Besitzers**). Alles andere (Chat, Chronik, Resonanz, Dungeon, Social,
  Einbettungen) läuft über `external_service_resolver.get_ai_provider_config`:
  Sim-Override → `platform_settings` → `.env`. Diese Kette kennt BYOK nicht.
- **Eintragen heute:** Kopfzeile → Systempanel → Wallet-Abzeichen → Modal „The Mint"
  → unter den Bündeln, sichtbar nur bei `canForge` **und**
  `byok_allowed || effective_bypass` (`VelgForgeMint.ts:690`). Zweiter Ort:
  Admin → Forge → SEC-08 (`AdminForgeTab.ts:835`, dasselbe Panel, `mode="admin"`).

## Befunde

1. **Admin kann seinen eigenen Schlüssel nicht speichern (403).**
   `_check_byok_access` fragt nur `fn_user_byok_allowed`; die Funktion kennt
   `is_platform_admin()` nicht. Policy `per_user` + `byok_allowed=false` ⇒
   SEC-08 rendert Eingabefelder (`VelgByokPanel.ts:627` prüft nichts) und
   „Speichern" antwortet *BYOK access not granted*.
2. **Nach Freigabe scheitert derselbe Aufruf mit 500.** Der Router reicht
   `get_effective_supabase` in die RPC; für Admins ist das `service_role`, dessen
   JWT kein `sub` hat ⇒ `auth.uid()` NULL ⇒ `auth.uid() IS DISTINCT FROM p_user_id`
   greift ⇒ *Not authorized to update another user's keys*. Zwei unabhängige
   Sperren übereinander. `backend/tests/test_forge_router.py:236` mockt **beide** weg.
3. **Kein UI für die Standard-Politik.** `adminApi.updateUserByokAllowed` /
   `updateUserByokBypass` (`AdminApiService.ts:178,182`) haben **keinen Aufrufer**.
   `AdminUsersTab` schaltet „Is Architect" + Token, nicht `byok_allowed`;
   `UpdateUserWalletRequest` (`backend/routers/admin.py:94`) kennt die Felder nicht.
4. **Die Anleitung verspricht mehr als der Code tut.** `htp-topic-data.ts:230ff`:
   „runs every request through your credentials", „Powers … chat responses, and
   bureau terminal agent replies" — beides falsch.
5. **Die Kostenspur weiß nicht, wer bezahlt hat.** `run_ai(key_source="platform")`
   ist Vorgabe (`ai_utils.py:246`), **kein** Aufrufer setzt je `"byok"` (der
   Docstring in `_record_usage` gesteht es ein). Budget-RPC (Migr. 228) aggregiert
   `ai_usage_log` ohne `key_source`-Filter ⇒ fremdbezahlte Aufrufe zählen gegen die
   Plattformkappe. CHECK-Spalte kennt `'byok'` seit Migr. 150, nie beschrieben.
6. **Widerruf widerruft nichts.** `byok_allowed=false` sperrt nur Schreiben/Testen;
   `get_user_keys` fragt nie nach der Erlaubnis.
7. **Zwei Dinge, ein Name.** Settings → Integrationen → „AI Provider Overrides"
   trägt den Hilfetipp „What is BYOK?" (`IntegrationSettingsPanel.ts:91`), schreibt
   aber nach `simulation_settings`, gehört der Welt, hat keinen Prüfknopf, keine
   Maskierung/Widerruf-Parität, taucht in `byok_status` nicht auf.
8. **Sackgasse.** `AutonomySettingsPanel.ts:260` sagt Nicht-Architekten „Open The
   Mint to configure your API keys"; das Modal ist global montiert
   (`PlatformHeader.ts:1018`), öffnet und zeigt Bündel ohne Schlüsselformular.
9. **Kleineres.** Keine Längen-/Formatprüfung (`models/forge.py:502`); kein
   Rotationspfad (ein Fernet-Key ohne Version für Wallets + Sim-Settings);
   `UserWallet` (`models/forge.py:496`) trägt die `encrypted_*`-Felder im Modell,
   RLS erlaubt `SELECT *` auf die eigene Zeile.

## Beschlossener Plan (Reihenfolge 3 → 2 → 1 → 5 → 4 → 6)

**Sitzung A**

- **P3** — Befund 2 zuerst: RPC-Aufruf so führen, dass `auth.uid()` trägt (Nutzer-
  Client für die RPC; die RPC prüft sich selbst — behaviorally neutral laut
  CLAUDE.md-Regel zu SECDEF). Danach Befund 1: `_check_byok_access` um
  `is_platform_admin()` ergänzen **oder** über den nächsten Punkt erledigen.
- **P2** — Tore trennen: Schlüssel hinterlegen darf **jeder angemeldete Nutzer**
  (`get_current_user` statt `require_architect()` auf `PUT/DELETE/POST
  /wallet/keys*`); `byok_bypass` (Token-Erlass) bleibt Admin-Politik. Löst 1, 3, 8.
  Tests entmocken, sonst bleibt es falsch-grün.

**Sitzung B**

- **P1** — Abschnitt „Schlüsselbund" in der Personalakte (`UserProfileView.ts`,
  neben Identität/Korrespondenz), dasselbe `<velg-byok-panel>` **wiederverwendet**,
  nicht kopiert. Die Münze behält eine Verknüpfung statt des Formulars.
  Vor Komponentenarbeit: Skill `velg-frontend-design`.
- **P5** — `key_source` bis `ai_usage_log` durchreichen (Forge-Orchestrator +
  Heartbeat kennen die Herkunft) und die Budgetkette danach filtern.
- **P4** — `user_api_keys(user_id, provider, encrypted_key, key_version,
  last_verified_at, last_used_at)` statt zweier Wallet-Spalten; erlaubt Rotation,
  weitere Anbieter, „zuletzt geprüft am". Migration + Rückfüllung aus `user_wallets`.
- **P6** — `htp-topic-data.ts` an die Wahrheit angleichen (oder Wirkung bewusst
  ausweiten). Ebenso Befund 6 (Widerruf löscht/sperrt) und 7 (Benennung trennen).

## Prod-Abfragen wiederholen

`~/.config/metaspots/SUPABASE-ACCESS.md`, Management-API auf Ref `bffjoupddfjaljqrwqck`.
