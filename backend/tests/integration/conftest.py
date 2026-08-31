"""Shared fixtures for integration tests that need a live Supabase instance."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from backend.config import settings
from backend.tests.integration.game_constants import (
    SIM_GASLIT_REACH,
    SIM_SPERANZA,
    SIM_STATION_NULL,
    SIM_VELGARIEN,
)
from supabase import AsyncClient, Client, create_client


def _supabase_available() -> bool:
    """Check if a real Supabase instance is reachable at the configured URL."""
    if not settings.supabase_anon_key:
        return False
    try:
        import httpx

        resp = httpx.get(
            f"{settings.supabase_url}/rest/v1/",
            headers={"apikey": settings.supabase_anon_key},
            timeout=2.0,
        )
        return resp.status_code < 500
    except Exception:
        return False


requires_supabase = pytest.mark.skipif(
    not _supabase_available(),
    reason="Supabase not reachable at configured URL",
)


# ── Data structures ────────────────────────────────────────────────────


@dataclass
class ParticipantFixture:
    """A participant in a test epoch."""

    participant_id: UUID
    user_id: UUID
    simulation_id: UUID
    initial_rp: int


@dataclass
class EpochFixture:
    """All IDs and config for an isolated test epoch."""

    epoch_id: UUID
    status: str
    current_cycle: int
    config: dict
    participants: list[ParticipantFixture] = field(default_factory=list)

    @property
    def simulation_ids(self) -> list[UUID]:
        """All simulation IDs in this epoch."""
        return [p.simulation_id for p in self.participants]

    @property
    def rp_per_cycle(self) -> int:
        return self.config.get("rp_per_cycle", 10)

    @property
    def rp_cap(self) -> int:
        return self.config.get("rp_cap", 40)

    def sim_id_for(self, player: UUID) -> UUID:
        """Get the game-instance simulation ID for a player."""
        for p in self.participants:
            if p.user_id == player:
                return p.simulation_id
        msg = f"Player {player} not in epoch"
        raise ValueError(msg)


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def admin_client() -> Client:
    """Sync Supabase client with service_role — for test setup/teardown only."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


#: Plattform-Tore, die Integrationstests umlegen. Sie stehen in einer ECHTEN
#: Datenbank, nicht in einer Attrappe — was ein Test hier hinterlässt, findet
#: der nächste vor, und zwar über den pytest-Lauf hinaus.
_MUTABLE_PLATFORM_GATES = ("drift_fun_core_enabled",)


@pytest.fixture(autouse=True, scope="module")
def restore_platform_gates(request):
    """Jede Testdatei gibt die Plattform-Tore so zurück, wie sie sie vorfand.

    DER BEFUND, DER DAZU GEFÜHRT HAT (T7, gemessen 31.08.2026)
    ----------------------------------------------------------
    `test_travel_economy.py` stellt das Fun-Kern-Tor in JEDEM `finally` auf
    **False** — nicht auf den Wert, den es vorfand. `test_travel_sondierung.py`
    importiert denselben Helfer und schliesst es an drei weiteren Stellen, ohne
    es je zurückzustellen. Beide behandeln „Tor zu" als Ruhezustand.

    Alphabetisch läuft `economy` vor `sondierung`. Gemessen:

        sondierung allein, Tor offen        26 grün
        sondierung allein, Tor geschlossen  11 rot   (GATE_CLOSED)
        economy, dann sondierung           15 rot

    Und der Schaden überlebt den Lauf: nach `sondierung` stand das Tor wieder
    auf `false`, also fiel derselbe Test beim NÄCHSTEN Aufruf schon „allein"
    durch. Das ist die schlechtere Sorte Fehler — in CI zufällig, lokal
    scheinbar dauerhaft, und in beiden Fällen verdächtigt man die falsche
    Änderung.

    WARUM DIE REPARATUR HIER STEHT UND NICHT IN DEN TESTS
    -----------------------------------------------------
    Man könnte in beide Dateien ein sauberes `finally` schreiben. Dann müsste
    die dritte Datei daran denken — und die vierte. Ein Zustand, den ein Test
    ändern DARF, gehört von der Vorrichtung zurückgesetzt, nicht von der
    Disziplin der Schreibenden. Modulweit, weil das die Grenze ist, an der der
    Schaden übertritt: innerhalb einer Datei setzen die Tests das Tor selbst,
    zwischen Dateien tut es niemand.

    Zwei Abfragen je Testdatei. Ein Lauf über die ganze Mappe kostet damit rund
    sechzig — gemessen unter einer Zehntelsekunde, und dafür ist die Mappe in
    jeder Reihenfolge grün.
    """
    if not _supabase_available():
        yield
        return
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    rows = (
        client.table("platform_settings")
        .select("setting_key, setting_value")
        .in_("setting_key", list(_MUTABLE_PLATFORM_GATES))
        .execute()
    ).data or []
    before = {row["setting_key"]: row["setting_value"] for row in rows}
    try:
        yield
    finally:
        for key, value in before.items():
            client.table("platform_settings").upsert(
                {"setting_key": key, "setting_value": value}, on_conflict="setting_key"
            ).execute()


@pytest.fixture()
async def async_admin_client() -> AsyncClient:
    """Async Supabase client with service_role — for calling async services.

    Delegates to the process-wide cache (``supabase_admin_cache``) so
    integration tests use the same client that production paths would
    use. The autouse ``_reset_admin_supabase_cache`` fixture in
    ``backend/tests/conftest.py`` guarantees each test gets a fresh
    client bound to its own event loop.
    """
    from backend.utils.supabase_admin_cache import get_admin_supabase_client

    return await get_admin_supabase_client()


@pytest.fixture(scope="session")
def test_user_ids(admin_client: Client) -> list[UUID]:
    """Ensure 4 test auth users exist, return their IDs.

    Creates users via Supabase auth signup if they don't exist.
    Idempotent: same emails always yield same user records.
    """
    import httpx

    def _extract_uid(payload: object) -> str | None:
        """Pull a user id out of a signup/token response, tolerating shapes.

        Signup returns the user at the top level or nested under ``user``;
        the token endpoint nests it under ``user``. Error responses (e.g.
        ``{"message": "..."}``) carry no id and yield ``None``.
        """
        if not isinstance(payload, dict):
            return None
        candidate = payload.get("user")
        if not isinstance(candidate, dict):
            candidate = payload
        uid = candidate.get("id")
        return uid if isinstance(uid, str) else None

    user_ids: list[UUID] = []
    for i in range(1, 5):
        email = f"gamedb-test-{i}@test.velgarien.dev"
        creds = {"email": email, "password": "gamedb-test-pass-123"}
        headers = {"apikey": settings.supabase_anon_key}
        try:
            resp = httpx.post(
                f"{settings.supabase_url}/auth/v1/signup",
                json=creds,
                headers=headers,
                timeout=5.0,
            )
            # signup returns user on both create and "already registered"
            uid = _extract_uid(resp.json())
            if uid is None:
                # User exists (or signup suppressed the body) — sign in for the ID.
                resp = httpx.post(
                    f"{settings.supabase_url}/auth/v1/token?grant_type=password",
                    json=creds,
                    headers=headers,
                    timeout=5.0,
                )
                uid = _extract_uid(resp.json())
        except httpx.HTTPError as e:
            pytest.skip(f"Supabase auth service unavailable ({email}): {e}")

        if uid is None:
            # Auth reachable but couldn't yield an id (e.g. 503 "name
            # resolution failed", email confirmation required). Skip
            # rather than raise a cryptic KeyError — the response body
            # tells us why.
            pytest.skip(f"Could not resolve test auth user {email} (HTTP {resp.status_code}): {resp.text[:200]}")
        user_ids.append(UUID(uid))

    return user_ids


@pytest.fixture(scope="session")
def user_clients(admin_client: Client, test_user_ids: list[UUID]) -> list[Client]:
    """4 sync Supabase clients authenticated AS the 4 test users (index-aligned with
    ``test_user_ids``) — i.e. every request carries that user's JWT, so ``auth.uid()``
    resolves inside the database.

    This is what makes the PLAYER-class RPCs testable in CI. The DRIFT run/quest RPCs
    (and the dungeon/DRIFT family generally) open with
    ``IF (SELECT auth.uid()) IS DISTINCT FROM p_user THEN RAISE 42501`` — a guard that
    ``admin_client`` (service_role, ``auth.uid() = NULL``) can never pass. Until now that
    left every player path browser-verified-only (see the header of
    ``test_travel_failure_scatter.py``); with this fixture they run in the suite.

    The one obstacle was signup's ``email_confirm``: the local auth stack refuses the
    password grant for an unconfirmed address ("Email not confirmed"). We confirm the
    address through the service_role admin API — the same thing an operator would do in
    Studio — and then sign in normally. Session-scoped: four token exchanges, once.
    """
    clients: list[Client] = []
    for i, uid in enumerate(test_user_ids, start=1):
        creds = {
            "email": f"gamedb-test-{i}@test.velgarien.dev",
            "password": "gamedb-test-pass-123",
        }
        try:
            admin_client.auth.admin.update_user_by_id(str(uid), {"email_confirm": True})
            client = create_client(settings.supabase_url, settings.supabase_anon_key)
            client.auth.sign_in_with_password(creds)
        except Exception as e:  # auth stack down / confirmation policy changed
            pytest.skip(f"Could not authenticate test user {creds['email']}: {e}")
        clients.append(client)
    return clients


@pytest.fixture()
def epoch_factory(admin_client: Client, test_user_ids: list[UUID]):
    """Factory that creates isolated test epochs with auto-cleanup.

    Each call inserts a fresh epoch + 4 participants (one per seed
    simulation, each with a distinct test auth user).  On teardown,
    CASCADE delete on game_epochs removes all children (participants,
    missions, scores, battle_log, fortifications).
    """
    created_ids: list[UUID] = []

    sim_ids = [SIM_VELGARIEN, SIM_GASLIT_REACH, SIM_STATION_NULL, SIM_SPERANZA]

    def create(
        *,
        status: str = "competition",
        cycle: int = 3,
        rp: int = 20,
        rp_cap: int = 40,
        rp_per_cycle: int = 10,
        cycle_hours: int = 8,
        duration_days: int = 14,
    ) -> EpochFixture:
        epoch_id = uuid4()
        config = {
            "rp_per_cycle": rp_per_cycle,
            "rp_cap": rp_cap,
            "cycle_hours": cycle_hours,
            "duration_days": duration_days,
        }
        now = datetime.now(UTC)

        admin_client.table("game_epochs").insert(
            {
                "id": str(epoch_id),
                "name": f"Test Epoch {epoch_id.hex[:8]}",
                "status": status,
                "current_cycle": cycle,
                "config": config,
                "created_by_id": str(test_user_ids[0]),
                "starts_at": (now - timedelta(days=5)).isoformat(),
                "ends_at": (now + timedelta(days=9)).isoformat(),
            }
        ).execute()

        participants = []
        for i, sim_id in enumerate(sim_ids):
            pid = uuid4()
            user_id = test_user_ids[i]
            admin_client.table("epoch_participants").insert(
                {
                    "id": str(pid),
                    "epoch_id": str(epoch_id),
                    "simulation_id": str(sim_id),
                    "user_id": str(user_id),
                    "current_rp": rp,
                    "cycle_ready": False,
                }
            ).execute()
            participants.append(
                ParticipantFixture(
                    participant_id=pid,
                    user_id=user_id,
                    simulation_id=sim_id,
                    initial_rp=rp,
                )
            )

        created_ids.append(epoch_id)
        return EpochFixture(
            epoch_id=epoch_id,
            status=status,
            current_cycle=cycle,
            config=config,
            participants=participants,
        )

    yield create

    # Cleanup: CASCADE delete handles all children
    for eid in created_ids:
        try:
            admin_client.table("game_epochs").delete().eq("id", str(eid)).execute()
        except Exception:  # noqa: S110
            pass  # Best-effort cleanup


# ── DRIFT chart fixtures (the travel suites navigate a real chart) ─────────────


def _broadcast_homes(admin_client: Client) -> dict[str, dict]:
    """The active chart version's broadcast_rand nodes, keyed by stable_key."""
    versions = admin_client.table("chart_versions").select("version").order("version", desc=True).limit(1).execute()
    if not versions.data:
        pytest.skip("no chart version seeded")
    version = versions.data[0]["version"]
    nodes = (
        admin_client.table("drift_chart_nodes")
        .select("id, stable_key, simulation_id")
        .eq("chart_version", version)
        .eq("node_type", "broadcast_rand")
        .execute()
    )
    return {n["stable_key"]: n for n in nodes.data}


@pytest.fixture(scope="session")
def chart_home(admin_client: Client) -> dict:
    """The traveller's anchor world edge on the active chart (Velgarien's broadcast node)."""
    homes = _broadcast_homes(admin_client)
    return homes.get("home-velgarien") or next(iter(homes.values()))


@pytest.fixture(scope="session")
def chart_foreign(admin_client: Client, chart_home: dict) -> dict:
    """A FOREIGN world edge — the Depesche target and the un-surveyed honor node."""
    for node in _broadcast_homes(admin_client).values():
        if node["id"] != chart_home["id"]:
            return node
    pytest.skip("chart has only one broadcast home — a foreign dock is required")


# Die Bänder von nah nach fern. Die Reihenfolge ist die Rangfolge, nach der
# `_home_neighbors` sortiert — ein unbekanntes Band landet hinten, nicht vorn.
_BAND_ORDER = ("near", "mid", "deep")


def _home_neighbors(admin_client: Client, chart_home: dict) -> list[dict]:
    """Alle Nachbarn des Heimatknotens, DETERMINISTISCH sortiert (nah zuerst).

    ── Warum das eine eigene Funktion mit einer Sortierung ist ──────────────

    Hier stand eine Schleife, die die ERSTE passende Kante einer Abfrage OHNE
    ``ORDER BY`` nahm. PostgREST gibt dann die physische Zeilenreihenfolge
    zurück, und die ist keine Zusage: sie verschiebt sich nach Schreibvorgängen,
    einem anderen Plan, einem VACUUM.

    Gemessen am 31.08.2026 auf der lokalen Instanz: ``home-velgarien`` hat
    **vier Nachbarn — drei ``mid`` und einen ``near``**. Welcher zurückkam, war
    also ein Würfelwurf mit 1:3, und ER entschied über ZWEI Tests gleichzeitig:

      * ``test_travel_signals``: ``survey_value_by_band`` ist
        ``{near: 0, mid: 2, deep: 3}``. Bei ``near`` überspringt der Test sich
        selbst („no survey to lose"), bei ``mid`` läuft er.
      * ``test_travel_havarie``: der Hinweg kostet nach Band. Bei ``mid``
        strandete der Lauf schon auf dem Hinweg, und die Zusicherung
        ``status == "active"`` („the outbound hop must not already strand it")
        schlug fehl.

    Das erklärt beide gemeldeten Symptome von J1 mit EINER Ursache, und es
    erklärt ihre Kopplung: die Zahl der übersprungenen Tests schwankte zwischen
    3 und 4, und der Havarie-Test fiel **genau in den Läufen** um, in denen sie
    3 war. Gemessen: ohne Zufallsreihenfolge 4 Skips und grün, mit 3 Skips und
    rot.

    Es war also NICHT Zustandsverschmutzung zwischen Tests, wie J1 vermutete —
    keine Sitzung hinterließ etwas. Es war eine Vorrichtung, die nie eine
    Antwort hatte, sondern eine Auswahl traf, ohne es zu sagen.

    ── Was die Sortierung leistet und was nicht ────────────────────────────

    Die Sortierung macht die Wahl reproduzierbar; die zweite Hälfte des Fixes
    ist, dass die beiden Tests jetzt VERSCHIEDENE Nachbarn verlangen, weil sie
    Verschiedenes brauchen. Eine Vorrichtung, die zwei unvereinbare Zwecke
    bedient und den Konflikt per Zufall auflöst, ist der eigentliche Defekt.
    """
    versions = admin_client.table("chart_versions").select("version").order("version", desc=True).limit(1).execute()
    version = versions.data[0]["version"]
    edges = admin_client.table("drift_chart_edges").select("from_node, to_node").eq("chart_version", version).execute()
    neighbor_ids: set[str] = set()
    for e in edges.data:
        if e["from_node"] == chart_home["id"]:
            neighbor_ids.add(e["to_node"])
        elif e["to_node"] == chart_home["id"]:
            neighbor_ids.add(e["from_node"])
    if not neighbor_ids:
        return []

    nodes = (
        admin_client.table("drift_chart_nodes")
        .select("id, stable_key, distance_band")
        .in_("id", sorted(neighbor_ids))
        .execute()
    )
    # Zweistufig sortiert: Band zuerst, danach die Kennung. Ohne den zweiten
    # Schlüssel wäre die Wahl innerhalb eines Bandes wieder ungeordnet — drei
    # der vier Nachbarn teilen sich hier ein Band.
    return sorted(
        nodes.data,
        key=lambda n: (
            _BAND_ORDER.index(n["distance_band"]) if n["distance_band"] in _BAND_ORDER else len(_BAND_ORDER),
            str(n["id"]),
        ),
    )


@pytest.fixture(scope="session")
def home_neighbor(admin_client: Client, chart_home: dict) -> str:
    """Der NÄCHSTGELEGENE Nachbar — die eine legale Bewegung, die ein
    zusammenbrechender Lauf noch hat.

    Das ist, was der Docstring hier immer versprach; er hielt es nur nicht.
    Der billigste Nachbar ist der einzige, der die Zusage „ein Sprung hin und
    wieder zurück, ohne unterwegs zu stranden" trägt.
    """
    neighbors = _home_neighbors(admin_client, chart_home)
    if not neighbors:
        pytest.skip("home node has no edges on the active chart")
    return neighbors[0]["id"]


@pytest.fixture(scope="session")
def home_neighbor_surveyable(admin_client: Client, chart_home: dict) -> str:
    """Ein Nachbar, dessen Band eine Erstvermessung ÜBERHAUPT bezahlt.

    Der Signal-Test will prüfen, dass die Vermessung nicht vom Ziehungsergebnis
    aufgefressen wird. Bei einem ``near``-Nachbarn ist der erwartete Wert 0, und
    die Prüfung wäre inhaltsleer — deshalb übersprang sie sich selbst. Das war
    richtig gedacht und am falschen Ort gelöst: nicht der Test soll sich
    wegdrücken, wenn die Vorrichtung den falschen Knoten zieht, sondern die
    Vorrichtung soll den richtigen liefern.

    Übersprungen wird nur noch, wenn die Karte WIRKLICH keinen zahlenden
    Nachbarn hat — dann ist es eine Aussage über die Karte, keine über den
    Würfel.
    """
    values = (
        admin_client.table("drift_tuning").select("value").eq("setting_key", "survey_value_by_band").execute()
    ).data[0]["value"]
    for node in _home_neighbors(admin_client, chart_home):
        if values.get(node["distance_band"], 0):
            return node["id"]
    pytest.skip("no neighbour of home sits in a band that pays a survey")
