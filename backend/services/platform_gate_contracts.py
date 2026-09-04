"""Jedes Merkmalstor der Plattform, einmal erklärt — und was sein Fehlen kostet.

``platform_settings`` trägt 20 Zeilen auf ``*_enabled`` (gemessen 31.08.2026 auf
Prod). Für keine davon gab es bis heute eine Übersicht. Fünf Tore hatten einen
Schalter irgendwo in einem Fachreiter (Herzschlag, Instagram-Chiffre, Bluesky,
Gesundheit, Waisen-Kehrer), die übrigen fünfzehn hatten überhaupt keinen. Man
konnte sie nur über eine SQL-Zeile umlegen, und wer nicht wusste, dass sie
existieren, legte sie nie um.

Das ist keine Unbequemlichkeit, sondern die Ursache dreier stiller Ausfälle:

- ``journal_enabled`` hat auf Prod **keine Zeile**. Der Erzeuger fällt
  fail-closed auf aus, seit P5 — deshalb stehen dort 0 Fragmente.
- ``scheduled_ai_spend_enabled`` hat **keine Zeile**, seit es gebaut wurde.
- ``resonance_auto_process_enabled`` hat **keine Zeile** — und läuft trotzdem,
  weil ``ResonanceScheduler._load_config`` mit ``_DEFAULT_ENABLED = True``
  beginnt und die Vorgabe nur überschreibt, wenn eine Zeile ankommt. Genau
  diese Sorte Unterschied ist der Grund für das Feld ``default_when_missing``:
  eine fehlende Zeile bedeutet **nicht** überall dasselbe, und ohne die Angabe
  sieht man einem leeren Feld nicht an, ob dahinter „aus" oder „an" steht.

Die Erklärung steht hier und nicht im Frontend, weil die Namen hier gelesen
werden. ``backend/tests/unit/test_platform_gate_contracts.py`` bindet die
Erklärung per AST an ihre Lesestellen — in **beide** Richtungen: ein Tor, das
eine Datei liest und das hier fehlt, ist ein roter Test, und eine Erklärung,
die niemand liest, ebenso. Das Muster ist das von ``prompt_contracts`` (W1) und
``simulation_setting_contracts``.

**Nicht hier hinein gehören** Schlüssel aus ``simulation_settings`` — sie
gehören einer Welt, nicht der Plattform, und ihre Oberfläche sind die Panels
unter ``frontend/src/components/settings/``. Gemessen und ausdrücklich
ausgenommen: ``agent_autonomy_enabled``, ``weather_enabled``, ``bonds_enabled``,
``bleed_enabled``, ``guardian_enabled``, ``newsapi_enabled`` (die letzten beiden
sind Integrationseinstellungen je Welt mit Rückfall auf einen
Plattform-Schlüssel, aber der Rückfall ist der *API-Schlüssel*, nicht das Tor).
Ebenso ausgenommen ``afk_penalty_enabled``: das steht in der Epochenkonfig.
"""

from __future__ import annotations

from typing import Final, NamedTuple

__all__ = [
    "GATE_GROUPS",
    "PLATFORM_GATES",
    "PlatformGate",
    "gate_keys",
]


class PlatformGate(NamedTuple):
    """Ein Merkmalstor in ``platform_settings``.

    ``default_when_missing`` ist gemessen, nicht gewünscht: es ist der Wert, den
    die Lesestelle tatsächlich benutzt, wenn die Zeile fehlt. Wo er ``True`` ist,
    ist das Tor ein *Notaus* (Abwesenheit heißt „läuft"); wo er ``False`` ist,
    ist es ein *Anschalter* (Abwesenheit heißt „aus"). Die Oberfläche muss den
    Unterschied zeigen, sonst ist ein leeres Feld zweideutig.

    ``reader`` nennt das Modul, das den Schlüssel liest. Der AST-Test benutzt es
    als Suchraum; es ist damit kein Kommentar, sondern eine Zusage.

    ``wired`` beantwortet die einzige Frage, die einem Schalter wirklich zusteht:
    ändert sein Umlegen heute irgendetwas? Wo es ``False`` ist, zeigt die
    Oberfläche das Tor als das, was es ist: vorbereitet, nicht angeschlossen.

    Am 31.08.2026 standen fünf DRIFT-Tore so da — ``drift_ai_enabled`` und
    ``drift_p1..p4_enabled`` hatten eine Zeile auf Prod und keine Lesestelle
    (gemessen über ``pg_get_functiondef`` auf der laufenden Datenbank: 0 Treffer,
    ``drift_fun_core_enabled`` zum Vergleich: 10; im Python nannte sie nur diese
    Datei). Sie sind seither angeschlossen und nicht entfernt worden:
    ``DriftService.get_public_state`` liest alle sechs in einem Abruf, wendet die
    kumulative Regel an und meldet das Ergebnis über
    ``GET /api/v1/public/drift/state``. Damit ist heute kein Tor mehr unverdrahtet —
    ``test_unwired_gates_are_really_dead`` läuft über eine leere Liste, und genau
    das ist der erwünschte Zustand. Das Feld bleibt: das nächste vorbereitete Tor
    soll sich wieder als solches erklären müssen.
    """

    key: str
    group: str
    label: str
    turns_on: str
    absence_costs: str
    default_when_missing: bool
    reader: str
    wired: bool = True


#: Reihenfolge der Gruppen in der Oberfläche. Erst was ein Besucher sieht,
#: dann was im Hintergrund läuft, zuletzt was Geld kostet.
GATE_GROUPS: Final[tuple[str, ...]] = (
    "world",
    "narrative",
    "drift",
    "social",
    "operations",
)


#: Jedes Tor, das der Rücken aus ``platform_settings`` liest. Reihenfolge
#: innerhalb einer Gruppe = Reihenfolge in der Oberfläche.
PLATFORM_GATES: Final[tuple[PlatformGate, ...]] = (
    # ── Welt ────────────────────────────────────────────────────────────
    PlatformGate(
        key="heartbeat_enabled",
        group="world",
        label="Herzschlag",
        turns_on="Der Welt-Tick: Ereignisse, Stimmungen, Beziehungen, Wetter, Autonomie.",
        absence_costs="Keine Welt tickt mehr. Der Bestand friert ein, ohne Fehlermeldung.",
        default_when_missing=True,
        reader="backend/services/heartbeat_service.py",
    ),
    PlatformGate(
        key="autonomy_feature_enabled",
        group="world",
        label="Agenten-Autonomie (global)",
        turns_on="Phase 9 des Ticks: Agenten handeln aus eigenen Bedürfnissen.",
        absence_costs="Nichts – dieses Tor steht bei fehlender Zeile auf AN. "
        "Zum Abschalten braucht es eine Zeile mit 'false'.",
        default_when_missing=True,
        reader="backend/services/heartbeat_service.py",
    ),
    PlatformGate(
        key="critical_health_effects_enabled",
        group="world",
        label="Kritische Gesundheitswirkungen",
        turns_on="Sichtbare Verfallswirkungen, sobald eine Welt unter die Schwelle fällt.",
        absence_costs="Kranke Welten sehen aus wie gesunde.",
        default_when_missing=True,
        reader="backend/services/game_mechanics_service.py",
    ),
    # ── Erzählschichten ─────────────────────────────────────────────────
    PlatformGate(
        key="continuation_mail_enabled",
        group="narrative",
        label="Post über Gespräche ohne Zuhörer",
        turns_on="Die zwei Mail-Sweeps zu Wortwechseln ohne Zuhörer: die Sofortpost und "
        "der Gesprächs-Abschnitt der Wochenpost.",
        absence_costs="Nichts – dieses Tor steht bei fehlender Zeile auf AUS. Die Flüster-Karte "
        "in der App erscheint trotzdem; nur Post geht keine hinaus.",
        default_when_missing=False,
        reader="backend/services/lifecycle_mail_scheduler.py",
    ),
    PlatformGate(
        key="agent_continuation_enabled",
        group="narrative",
        label="Gespräche ohne Zuhörer",
        turns_on="Phase 9.8 des Ticks: Agenten reden in Fäden weiter, deren Besitzer es "
        "eingeschaltet hat – im selben Faden, sichtbar beim nächsten Öffnen.",
        absence_costs="Nichts – dieses Tor steht bei fehlender Zeile auf AUS. Eine Phase, "
        "die Modellaufrufe erzeugt, darf nicht anlaufen, weil jemand vergessen hat, sie "
        "abzuschalten. Der Schalter am einzelnen Gespräch bleibt bedienbar, damit ein "
        "Mensch seine Wahl vorbereiten kann, bevor das Tor öffnet.",
        default_when_missing=False,
        reader="backend/services/chat/continuation_service.py",
    ),
    PlatformGate(
        key="journal_enabled",
        group="narrative",
        label="Journal-Fragmente",
        turns_on="Den Fragment-Erzeuger und den Journal-Reiter für Spielende.",
        absence_costs="Das Journal bleibt dauerhaft leer. Auf Prod ist genau das der Fall.",
        default_when_missing=False,
        reader="backend/services/journal/fragment_generation_scheduler.py",
    ),
    PlatformGate(
        key="resonance_auto_process_enabled",
        group="narrative",
        label="Resonanzen automatisch verarbeiten",
        turns_on="Fällige Resonanzen werden ohne Zutun in Wirkungen übersetzt.",
        absence_costs="Nichts – dieses Tor steht bei fehlender Zeile auf AN "
        "(_DEFAULT_ENABLED = True). Zum Abschalten braucht es eine Zeile mit 'false'.",
        default_when_missing=True,
        reader="backend/services/resonance_scheduler.py",
    ),
    PlatformGate(
        key="news_scanner_enabled",
        group="narrative",
        label="Nachrichten-Scanner",
        turns_on="Der Scanner zieht echte Meldungen und schlägt Resonanzen vor.",
        absence_costs="Es entstehen keine neuen Resonanzen mehr. Der Bestand bleibt bei einer.",
        default_when_missing=False,
        reader="backend/services/scanning/scanner_service.py",
    ),
    # ── DRIFT ───────────────────────────────────────────────────────────
    PlatformGate(
        key="drift_p0_enabled",
        group="drift",
        label="DRIFT P0 – Reise",
        turns_on="Die Reise zwischen den Welten: neue Läufe, Knotensee, Andocken.",
        absence_costs="Keine neuen Läufe. Laufende bleiben bedienbar.",
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    PlatformGate(
        key="drift_fun_core_enabled",
        group="drift",
        label="DRIFT Spielkern",
        turns_on="Wirtschaft, Havarie, Signale, Sondierung – das, was die Reise zum Spiel macht.",
        absence_costs="Die Reise geht, der Spielkern nicht. Auf Prod ist genau das der Fall.",
        default_when_missing=False,
        reader="supabase/migrations/20260712100000_264_travel_economy_activation.sql",
    ),
    PlatformGate(
        key="drift_ai_enabled",
        group="drift",
        label="DRIFT KI-Erzeugung",
        turns_on=(
            "Meldet über /public/drift/state, dass DRIFT KI-Text erzeugen darf. "
            "⚠ Heute fragt das keine Erzeugungsstelle ab: DRIFT ruft überhaupt keine KI."
        ),
        absence_costs=(
            "Derzeit nichts – es gibt keinen erzeugten Text, der wegfiele. Sobald die "
            "erste DRIFT-Texterzeugung kommt, bleibt sie stumm."
        ),
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    PlatformGate(
        key="drift_p1_enabled",
        group="drift",
        label="DRIFT P1 – Welten & Präsenz",
        turns_on=(
            "Meldet P1 als offen – kumulativ, also nur wenn P0 offen ist. Hinter der "
            "Phase steht noch kein Merkmal; das Tor geht der Sache voraus."
        ),
        absence_costs=(
            "Die Phase gilt als geschlossen, auch wenn P2 bis P4 auf wahr stünden. "
            "Die Oberfläche meldet P0 als höchste offene Phase."
        ),
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    PlatformGate(
        key="drift_p2_enabled",
        group="drift",
        label="DRIFT P2 – Gefährten",
        turns_on=(
            "Meldet P2 als offen – kumulativ, also nur wenn P1 und P0 offen sind. "
            "Hinter der Phase steht noch kein Merkmal."
        ),
        absence_costs=("Die Phase gilt als geschlossen, ebenso P3 und P4, was immer in deren Zeilen steht."),
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    PlatformGate(
        key="drift_p3_enabled",
        group="drift",
        label="DRIFT P3 – Wetter & Grenzland",
        turns_on=(
            "Meldet P3 als offen – kumulativ, also nur wenn P2, P1 und P0 offen sind. "
            "Hinter der Phase steht noch kein Merkmal."
        ),
        absence_costs=("Die Phase gilt als geschlossen, ebenso P4, was immer in dessen Zeile steht."),
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    PlatformGate(
        key="drift_p4_enabled",
        group="drift",
        label="DRIFT P4 – Gesellschaft",
        turns_on=(
            "Meldet P4 als offen – die letzte Sprosse, kumulativ über alle vorherigen. "
            "Hinter der Phase steht noch kein Merkmal."
        ),
        absence_costs=(
            "Die Phase gilt als geschlossen. Auf die anderen wirkt das nicht zurück – P4 ist das Ende der Leiter."
        ),
        default_when_missing=False,
        reader="backend/services/drift_service.py",
    ),
    # ── Soziale Kanäle ──────────────────────────────────────────────────
    PlatformGate(
        key="instagram_enabled",
        group="social",
        label="Instagram-Kanal",
        turns_on="Den Entwurfs- und Veröffentlichungslauf für Instagram.",
        absence_costs="Es entstehen keine Entwürfe.",
        default_when_missing=False,
        reader="backend/services/instagram_scheduler.py",
    ),
    PlatformGate(
        key="instagram_posting_enabled",
        group="social",
        label="Instagram wirklich senden",
        turns_on="Das tatsächliche Absenden statt Trockenlauf.",
        absence_costs="Entwürfe entstehen, gehen aber nie raus.",
        default_when_missing=False,
        reader="backend/services/instagram_scheduler.py",
    ),
    PlatformGate(
        key="instagram_cipher_enabled",
        group="social",
        label="Chiffre-ARG",
        turns_on="Einmalige Codes je Beitrag und die Einlösung unter /bureau/dispatch.",
        absence_costs="Die Beiträge tragen keine Codes.",
        default_when_missing=False,
        reader="backend/services/instagram_content_service.py",
    ),
    PlatformGate(
        key="bluesky_enabled",
        group="social",
        label="Bluesky-Kanal",
        turns_on="Die Übernahme der Instagram-Beiträge ins AT-Protokoll.",
        absence_costs="Bluesky bleibt still.",
        default_when_missing=False,
        reader="backend/services/bluesky_scheduler.py",
    ),
    PlatformGate(
        key="bluesky_posting_enabled",
        group="social",
        label="Bluesky wirklich senden",
        turns_on="Das tatsächliche Absenden statt Trockenlauf.",
        absence_costs="Entwürfe entstehen, gehen aber nie raus.",
        default_when_missing=False,
        reader="backend/services/bluesky_scheduler.py",
    ),
    PlatformGate(
        key="resonance_stories_enabled",
        group="social",
        label="Resonanz-Stories",
        turns_on="Resonanzen werden zusätzlich als Instagram-Story erzählt.",
        absence_costs="Resonanzen bleiben ohne Story.",
        default_when_missing=False,
        reader="backend/services/social_story_service.py",
    ),
    PlatformGate(
        key="alpha_first_contact_modal_enabled",
        group="social",
        label="Erstkontakt-Fenster (Alpha)",
        turns_on="Das Bureau-Dispatch-Fenster für Besucher ohne Mitgliedschaft.",
        absence_costs="Besucher landen ohne Begrüßung auf der Seite.",
        default_when_missing=False,
        reader="backend/services/platform_settings_service.py",
    ),
    # ── Betrieb ─────────────────────────────────────────────────────────
    PlatformGate(
        key="lifecycle_mail_enabled",
        group="operations",
        label="Lebenszyklus-Post",
        turns_on="Willkommensmail und die übrigen Kehrläufe der Post.",
        absence_costs="Neue Konten bekommen keine Begrüßung.",
        default_when_missing=False,
        reader="backend/services/lifecycle_mail_scheduler.py",
    ),
    PlatformGate(
        key="scheduled_ai_spend_enabled",
        group="operations",
        label="KI-Ausgaben im Zeitgeber",
        turns_on="Erlaubt den Zeitgebern, kostenpflichtige Modellaufrufe zu machen.",
        absence_costs="Zeitgeber laufen, geben aber kein Geld aus. Erzählschichten bleiben leer.",
        default_when_missing=False,
        reader="backend/utils/settings.py",
    ),
    PlatformGate(
        key="orphan_sweeper_enabled",
        group="operations",
        label="Waisen-Kehrer",
        turns_on="Den geplanten Kehrlauf über verwaiste Inhaltszweige.",
        absence_costs="Waisen bleiben liegen. Für einen Kehrer die harmlosere Richtung.",
        default_when_missing=False,
        reader="backend/services/content_packs/orphan_sweeper_scheduler.py",
    ),
    PlatformGate(
        key="byok_bypass_enabled",
        group="operations",
        label="BYOK umgeht Token-Kosten",
        turns_on="Wer eigene Schlüssel hinterlegt, zahlt keine Plattform-Token.",
        absence_costs="Eigene Schlüssel sparen dem Nutzer nichts.",
        default_when_missing=False,
        reader="backend/services/forge_draft_service.py",
    ),
    PlatformGate(
        key="json_repair_enabled",
        group="operations",
        label="JSON-Reparatur durch das Modell",
        turns_on="Eine unbrauchbare Modellantwort geht samt Zielform ein ZWEITES Mal "
        "ans Modell, statt verworfen zu werden.",
        absence_costs="Nichts Laufendes. Eine misslungene Antwort wird verworfen und "
        "über _observe_json_failure gezählt – der Zustand, in dem die Plattform "
        "seit jeher war, jetzt nur sichtbar. Anschalten kostet je Reparatur einen "
        "weiteren bezahlten Aufruf.",
        default_when_missing=False,
        reader="backend/utils/settings.py",
    ),
)


def gate_keys() -> frozenset[str]:
    """Jeder erklärte Torschlüssel."""
    return frozenset(gate.key for gate in PLATFORM_GATES)
