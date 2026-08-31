"""Service layer for the authenticated user dashboard aggregation.

WAS DIESER DIENST LIEFERT — UND WAS AUSDRUECKLICH NICHT
-------------------------------------------------------
Er liefert, was NUR fuer diese eine angemeldete Person gilt und sonst nirgends
aggregiert vorliegt: ihre Welten mit den Angaben, die der Umschalter zeigt,
ihre laufenden Epochen mit Frist und Handlungsstand, und den Zustand des
Substrats.

Er liefert NICHT, was schon einen eigenen Endpunkt hat. Das Weltenregister
(``simulationsApi.listPublic``), die Auszeichnungen (``achievementsApi``), die
Resonanzzeilen (``resonanceApi.list``) und die Agentenkarten
(``agentsApi.listPublic``) holt die Oberflaeche dort, wo sie stehen. Ein
Dashboard-Endpunkt, der alles einsammelt, waere in drei Monaten der Ort, an dem
jede neue Kachel angebaut wird, und niemand koennte mehr sagen, welche Abfrage
wem gehoert.

ALLE FELDER SIND AUF PROD GEMESSEN (31.08.2026), KEINES IST GERATEN
--------------------------------------------------------------------
Der Entwurf des Dashboards verlangte neun Dinge und trug sechs davon als
Platzhalter. Nachgemessen existieren vier davon wirklich: Weltkunst
(``banner_url``, 16 von 16), Lore und Sinnspruch (``simulation_lore``, 109
Zeilen ueber alle 16 Welten), Agentenportraets (229 von 258) und der
Substratzustand (ableitbar aus ``substrate_resonances.status``). Zwei fehlen
wirklich, und sie fehlen verschieden:

* die **Zyklusfrist** ist vollstaendig gebaut und hat keinen Gegenstand — alle
  sieben Epochen stehen still, seit bevor es die Spalte gab;
* einen **Order-Zaehler mit Nenner** gibt es nicht; messbar ist nur das Ja/Nein
  ``has_acted_this_cycle``.

Beides wird gemeldet wie es ist. Eine erfundene Zahl waere schlimmer als eine
fehlende — dieselbe Regel wie auf der Frontseite, wo der Entwurf ``47 worlds``
trug und gemessen 16 daraus wurden.
"""

from __future__ import annotations

import logging
from uuid import UUID

from backend.models.epoch import total_cycles_for
from backend.models.user import ActiveEpochParticipation, DashboardData, DashboardWorld
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Beben, die das Substrat GERADE stoeren. ``subsiding`` gehoert bewusst nicht
#: dazu: ein abklingendes Beben zaehlt im Bestand mit, macht das Substrat aber
#: nicht anomal. Die Warnzeile der Befehlsleiste zu zeigen, waehrend nichts mehr
#: passiert, waere eine Behauptung.
_DISTURBING_RESONANCE_STATUSES = ("detected", "impacting")

#: Beben, die ueberhaupt im Spiel sind. Weiter gefasst, andere Frage — siehe
#: ``DashboardData.active_resonance_count``.
_LIVE_RESONANCE_STATUSES = ("detected", "impacting", "subsiding")

#: Klone gehoeren einer Epoche, nicht der Person. Sie tauchen in „Meine Welten"
#: nicht auf.
_NOT_MY_WORLD_TYPES = ("game_instance", "archived")


class UserDashboardService:
    """Aggregates dashboard data for a single authenticated user."""

    @classmethod
    async def get_dashboard(
        cls,
        supabase: Client,
        admin_supabase: Client,
        user_id: UUID,
    ) -> DashboardData:
        """Fetch consolidated dashboard data.

        Queries memberships, active epoch participations, academy count,
        and active resonance count.  All queries use the user JWT (RLS enforced)
        except user_profiles which requires admin access.
        """
        user_id_str = str(user_id)

        # ── Meine Welten ──
        # Drei Abfragen statt einer: die Mitgliedschaft sagt WELCHE Welten, die
        # Sicht sagt WIE sie aussehen, die Lore sagt WAS sie erzählen. Sie in
        # einen Join zu zwingen ginge — aber `simulation_lore` hat mehrere
        # Zeilen je Welt, und ein Join darüber vervielfachte die Weltzeilen.
        mem_resp = await (
            supabase.table("simulation_members")
            .select("simulation_id, member_role, simulations(simulation_type)")
            .eq("user_id", user_id_str)
            .execute()
        )
        role_by_sim: dict[str, str] = {}
        for row in extract_list(mem_resp):
            sim = row.get("simulations") or {}
            # Klone gehören einer Epoche, nicht der Person.
            if sim.get("simulation_type") in _NOT_MY_WORLD_TYPES:
                continue
            role_by_sim[str(row["simulation_id"])] = row["member_role"]

        worlds: list[DashboardWorld] = []
        if role_by_sim:
            sim_ids = list(role_by_sim)
            # `simulation_dashboard` trägt Thema, Bild und die beiden Zählungen
            # bereits — sie hier noch einmal zusammenzuzählen hieße, eine
            # vorhandene Antwort ein zweites Mal herzuleiten.
            sims_resp = await (
                supabase.table("simulation_dashboard")
                .select("simulation_id, name, name_de, slug, theme, banner_url, agent_count, building_count")
                .in_("simulation_id", sim_ids)
                .execute()
            )

            # Die ERSTE Kammer je Welt. `sort_order` ist auf allen 109 Zeilen
            # gesetzt (gemessen), also ist „erste" eine Tatsache und keine
            # Auslegung.
            lore_resp = await (
                supabase.table("simulation_lore")
                .select("simulation_id, sort_order, title, title_de, body, body_de, epigraph, epigraph_de")
                .in_("simulation_id", sim_ids)
                .order("sort_order")
                .execute()
            )
            first_lore: dict[str, dict] = {}
            for row in extract_list(lore_resp):
                first_lore.setdefault(str(row["simulation_id"]), row)

            for row in extract_list(sims_resp):
                sim_id = str(row["simulation_id"])
                lore = first_lore.get(sim_id) or {}
                worlds.append(
                    DashboardWorld(
                        simulation_id=row["simulation_id"],
                        name=row.get("name") or "",
                        name_de=row.get("name_de"),
                        slug=row.get("slug") or "",
                        member_role=role_by_sim.get(sim_id, "observer"),
                        theme=row.get("theme"),
                        banner_url=row.get("banner_url"),
                        agent_count=row.get("agent_count") or 0,
                        building_count=row.get("building_count") or 0,
                        lore_body=lore.get("body"),
                        lore_body_de=lore.get("body_de"),
                        lore_epigraph=lore.get("epigraph"),
                        lore_epigraph_de=lore.get("epigraph_de"),
                        lore_title=lore.get("title"),
                        lore_title_de=lore.get("title_de"),
                    )
                )

        # ── Active epoch participations ──
        active_statuses = ["lobby", "foundation", "competition", "reckoning"]
        ep_resp = await (
            supabase.table("epoch_participants")
            .select(
                "epoch_id, current_rp, has_acted_this_cycle, "
                "game_epochs(id, name, status, epoch_type, current_cycle, config, cycle_deadline_at), "
                "simulations(name, banner_url)"
            )
            .eq("user_id", user_id_str)
            .eq("is_bot", False)
            .in_("game_epochs.status", active_statuses)
            .execute()
        )
        participations: list[ActiveEpochParticipation] = []
        for row in extract_list(ep_resp):
            epoch = row.get("game_epochs")
            if not epoch or epoch.get("status") not in active_statuses:
                continue
            sim = row.get("simulations") or {}
            config = epoch.get("config") or {}
            duration_days = config.get("duration_days", 14)
            cycle_hours = config.get("cycle_hours", 8)
            total_cycles = total_cycles_for(duration_days, cycle_hours)
            rp_cap = config.get("rp_cap", 30)

            participations.append(
                ActiveEpochParticipation(
                    epoch_id=epoch["id"],
                    epoch_name=epoch.get("name", ""),
                    epoch_status=epoch["status"],
                    epoch_type=epoch.get("epoch_type", "competitive"),
                    current_cycle=epoch.get("current_cycle", 0),
                    total_cycles=total_cycles,
                    current_rp=row.get("current_rp", 0),
                    rp_cap=rp_cap,
                    simulation_name=sim.get("name", ""),
                    simulation_banner_url=sim.get("banner_url"),
                    # Kann `None` sein, und das ist auf Prod der Regelfall —
                    # siehe das Feld im Modell. Nicht auffüllen.
                    cycle_deadline_at=epoch.get("cycle_deadline_at"),
                    has_acted_this_cycle=bool(row.get("has_acted_this_cycle")),
                )
            )

        # ── Academy epochs played ──
        profile_data = await maybe_single_data(
            admin_supabase.table("user_profiles").select("academy_epochs_played").eq("id", user_id_str).maybe_single()
        )
        academy_count = 0
        if profile_data:
            academy_count = profile_data.get("academy_epochs_played", 0)

        # ── Substrat: zwei verschiedene Fragen, zwei Abfragen ──
        # „Wie viele Beben sind im Spiel?" und „Wird gerade gestört?" sind nicht
        # dasselbe. Ein abklingendes Beben zählt im Bestand, macht das Substrat
        # aber nicht anomal. Die beiden zusammenzulegen hieße, die Warnzeile zu
        # zeigen, während nichts mehr passiert.
        res_resp = await (
            supabase.table("substrate_resonances")
            .select("id", count="exact")
            .in_("status", list(_LIVE_RESONANCE_STATUSES))
            .is_("deleted_at", "null")
            .execute()
        )
        resonance_count = res_resp.count if res_resp.count is not None else 0

        disturbing_resp = await (
            supabase.table("substrate_resonances")
            .select("id", count="exact")
            .in_("status", list(_DISTURBING_RESONANCE_STATUSES))
            .is_("deleted_at", "null")
            .execute()
        )
        disturbing = disturbing_resp.count or 0
        substrate_status = "anomalous" if disturbing > 0 else "stable"

        logger.info(
            "Dashboard data fetched",
            extra={
                "user_id": user_id_str,
                "worlds": len(worlds),
                "active_epochs": len(participations),
            },
        )

        return DashboardData(
            worlds=worlds,
            active_epoch_participations=participations,
            academy_epochs_played=academy_count,
            active_resonance_count=resonance_count,
            substrate_status=substrate_status,
        )
