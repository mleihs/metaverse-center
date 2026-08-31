from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class UserProfile(BaseModel):
    """Basic user profile."""

    id: UUID
    email: str


class MembershipInfo(BaseModel):
    """Simulation membership details for a user."""

    simulation_id: UUID
    simulation_name: str
    simulation_slug: str = ""
    member_role: str
    joined_at: datetime | None = None


class UserWithMemberships(BaseModel):
    """User profile with all simulation memberships."""

    id: UUID
    email: str
    memberships: list[MembershipInfo] = []
    onboarding_completed: bool = True
    academy_epochs_played: int = 0
    is_platform_admin: bool = False


class DashboardWorld(BaseModel):
    """Eine Welt des Spielenden, so wie das Dashboard sie zeigt.

    WARUM DAS NICHT ``MembershipInfo`` IST: die trägt id, Name, Slug und Rolle
    und wird auch von ``GET /users/me`` geliefert. Der Weltenumschalter des
    Dashboards braucht mehr — Bild, Thema, Kennzahlen, einen Lore-Absatz und
    einen Sinnspruch — und würde ``MembershipInfo`` für einen fremden Zweck
    aufblähen. Zwei Fragen, zwei Modelle.

    ALLES HIER IST GEMESSEN VORHANDEN (Prod, 31.08.2026), nichts erfunden:
    ``banner_url`` bei 16 von 16 Vorlagen, ``simulation_lore`` mit 109 Zeilen
    über alle 16 Welten, ``agent_count``/``building_count`` aus der Sicht
    ``simulation_dashboard``. Der Entwurf trug diese Felder als Platzhalter im
    Prototyp; sie stehen im Bestand.

    Zweisprachig wie überall im Werk: der Client wählt über ``t(entity, feld)``
    (``frontend/src/utils/locale-fields.ts``), deshalb kein locale-Parameter.
    """

    simulation_id: UUID
    name: str
    name_de: str | None = None
    slug: str
    member_role: str
    theme: str | None = None
    banner_url: str | None = None
    agent_count: int = 0
    building_count: int = 0
    #: Die erste Kammer der Lore (``sort_order`` aufsteigend). Der Umschalter
    #: zeigt EINEN Absatz und EINEN Sinnspruch je Welt; die ganze Lore liegt
    #: hinter ``loreApi`` und gehört nicht in dieses DTO.
    lore_body: str | None = None
    lore_body_de: str | None = None
    lore_epigraph: str | None = None
    lore_epigraph_de: str | None = None
    #: Der Titel der Kammer. Der Entwurf zeigt unter dem Zitat eine
    #: Quellenangabe; eine Person, die es gesagt hätte, gibt es nicht — wohl
    #: aber die Kammer, aus der es stammt. Eine echte Herkunft ist besser als
    #: eine erfundene Stimme.
    lore_title: str | None = None
    lore_title_de: str | None = None


class ActiveEpochParticipation(BaseModel):
    """Active epoch participation summary for the dashboard."""

    epoch_id: UUID
    epoch_name: str
    epoch_status: str
    epoch_type: str = "competitive"
    current_cycle: int
    total_cycles: int
    current_rp: int
    rp_cap: int
    simulation_name: str
    #: Das Weltbild der Epochen-Simulation. Der Entwurf legte dem Dashboard ein
    #: eigenes Bühnenbild bei; gemessen tragen aber ALLE 20 Epochen-Klone auf
    #: Prod ein ``banner_url``. Das echte Bild der eigenen Welt ist besser als
    #: ein mitgeliefertes Standbild — es zeigt, WO man spielt.
    simulation_banner_url: str | None = None
    rank: int = 0
    participant_count: int = 0
    #: Ende des laufenden Zyklus. ``None`` heißt NICHT „kein Zyklus", sondern
    #: „für diese Epoche läuft keine Uhr" — und das ist auf Prod bei allen
    #: sieben der Fall. Gemessen am 31.08.2026: die Spalte kam mit Migration 204
    #: am 13.04., die jüngste Epoche bewegte sich zuletzt am 20.03. Keine ist je
    #: durch den Übergang gelaufen, der die Frist setzt (und der greift nur bei
    #: ``auto_resolve_mode != "manual"``). Das Uhrwerk ist vollständig gebaut —
    #: drei Schreiber, ein Leser, der Zeitgeber läuft in ``app.py`` —, ihm fehlt
    #: der Gegenstand. Die Oberfläche muss deshalb einen leeren Countdown
    #: EHRLICH zeigen können, statt eine Zahl zu erfinden.
    cycle_deadline_at: datetime | None = None
    #: Was von „Orders placed 1/3" wirklich messbar ist. Einen Zähler mit Nenner
    #: gibt es nicht — ``epoch_participants`` trägt ein Ja/Nein
    #: (``has_acted_this_cycle``), keine Zahl. Ein erfundener Nenner wäre
    #: dieselbe Sorte Behauptung wie „47 worlds" auf der Frontseite.
    has_acted_this_cycle: bool = False


class DashboardData(BaseModel):
    """Aggregated dashboard data for the authenticated user."""

    #: Ersetzt das frühere ``memberships``. Es hatte genau einen Verbraucher
    #: (``SimulationsDashboard.ts``), und zwei Darstellungen derselben Welten im
    #: selben DTO wären eine Doppelung gewesen.
    worlds: list[DashboardWorld] = []
    active_epoch_participations: list[ActiveEpochParticipation] = []
    academy_epochs_played: int = 0
    #: Wie viele Beben überhaupt im Spiel sind — einschließlich der
    #: abklingenden. Bewusst NICHT dasselbe wie ``substrate_status``.
    active_resonance_count: int = 0
    #: „Wird das Substrat GERADE gestört?" — ``detected`` oder ``impacting``.
    #: Ein abklingendes Beben (``subsiding``) zählt in ``active_resonance_count``
    #: mit, macht das Substrat aber nicht anomal: das eine ist eine Bestandszahl,
    #: das andere eine Zustandsfrage. Die beiden auseinanderzuhalten ist Absicht;
    #: sie zu vermischen hieße, die Warnzeile der Befehlsleiste zu zeigen,
    #: während nichts mehr passiert.
    substrate_status: Literal["anomalous", "stable"] = "stable"
