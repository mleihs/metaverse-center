# RESUME — Schleuse (Event-Intake) einbauen

**Stand 02.09.2026.** Nichts committet, nichts gepusht. Prod läuft `dba881d0`.

## Wo alles liegt

- `handoff/schleuse-event-intake.md` — der Bauplan (342 Z., inkl. meiner zwei Nachträge am Ende)
- `handoff/schleuse-prototype-1b.html` — 853 Z., Block 1b als Nachschlagewerk: Keyframes
  (Z. 10–42), Template mit allen Modals (bis Z. 518), Logik-Auszug (Z. 520–853).
  **Nicht lauffähig, nicht kopieren** — Inline-Styles auf Token übersetzen.
- Quelle beider Dateien: `~/Dev/Buchhaltung/Metaverse.center (6).zip`

## Verifiziert (nicht nochmal prüfen)

- Alle 17 im Plan genannten Repo-Dateien existieren.
- Alle 10 genannten API-Methoden existieren (`ScannerApiService`: `triggerScan`,
  `toggleAdapter`, `getDashboard`, `approveCandidate`, `rejectCandidate`, `getScanLog`;
  `SocialTrendsApiService`: `transformArticle`, `batchTransform`, `integrateArticle`,
  `batchIntegrate`).
- `lint-color-ok` wird von `lint-color-tokens.sh` gelesen (Z. 47, 68) — der Pragma trägt.
- Bureau-Palette liegt als Privat-Variablen in `components/terminal/BureauTerminal.ts`
  Z. 60–71, jede bereits mit `/* lint-color-ok */`.

## 🔑 Die Token-Falle (zweimal zugeschlagen, beide Male dokumentiert)

1. Der Plan nannte vier Token, die es NICHT gibt (`--color-accent`, `--color-text`,
   `--color-border-subtle`, `--color-forge`). `lint-color-tokens.sh` fängt das nicht —
   es prüft rohe Hex, nicht undefinierte Namen. Eine verworfene Deklaration meldet nichts.
2. Meine Korrektur war selbst falsch: ich schrieb `--color-primary`. Den Token GIBT es,
   aber `ThemeService.ts:80` bildet das Weltfeld `color_primary` darauf ab — er wechselt
   pro Welt. Für eine Bureau-Fläche ist `--color-accent-amber` (`_colors.css:165`) richtig.
   **Ein Token-Name kann existieren und trotzdem der falsche sein.**
   Prüffrage: gehört diese Farbe der WELT oder der PLATTFORM?
   Nebenbei: `--color-accent-amber-dim` ist `#be5e09`, nicht `#b45309` — am 31.08. für
   Kontrast angehoben (`_colors.css:168`). Der Prototyp trägt den alten Wert.

## ⚠ Der Zufluss ist trocken (am 02.09. gemessen)

- `POST …/social-trends/browse` mit `source: guardian` → **Cloudflare-502 in 580 ms**,
  `text/html` statt JSON. Mit `source: newsapi` → sauberes JSON 400 „NewsAPI key not
  configured". Die Route ist also gesund, nur der Guardian-Zweig bringt den Ursprung zum
  Schweigen. Ursache steht im Backend-Log, dort noch nicht nachgesehen.
- Deshalb sieht der Nutzer „Failed to load articles" statt der echten Meldung:
  `BaseApiService.handleResponse` ruft `response.json()` auf HTML, das wirft, und
  `errorMessage` bleibt auf dem Standardwert. **Gilt für JEDEN Endpunkt der App.**
- `ScannerService` steht im Scheduler (Takt 6 h), hängt an `news_scanner_enabled`;
  Zustand von aussen nicht lesbar (`platform_settings` ist service_role-only).
- Prod-Bestand: 12 Trends, alle in der Welt „Velgarien", alle `guardian`, alle vom
  16./17.02.2026. 15 von 16 Welten haben null. Seither 197 Tage nichts.

## Umsetzungsreihenfolge (aus dem Plan, § Umsetzungsreihenfolge)

Schritt 1 läuft unabhängig vom Zufluss und ist der Einstieg:
`services/IntakeStateManager.ts` + `IntakeSignal`-Adapter über die vorhandenen APIs,
Rolle aus `appState.isPlatformAdmin` bzw. `appState.canEdit`.
Muster: `services/TerminalStateManager.ts`.

Danach 2 (Shell + Board), 3 (Schmelztiegel), 4 (Quarantäne + Modals), 5 (Sichtung),
6 (Lesesaal/Scan-Log/Echo/Kammer ④), 7 (Quote + Abos), 8 (alte Views löschen).

## Vor jedem Commit

`bash frontend/scripts/lint-color-tokens.sh && bash frontend/scripts/lint-llm-content.sh`
plus `lint-backtick-in-css.mjs` (die Backtick-im-css-Kommentar-Falle) und `tsc`.
