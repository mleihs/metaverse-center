"""Ein Bild aus dem, was gerade gesagt wurde.

DIE EINHEIT IST DIE RUNDE, NICHT DIE NACHRICHT

Der naheliegende Zuschnitt — „die letzten N Nachrichten" — ist falsch, und
zwar aus einem Grund, der in diesem Verzeichnis schon aufgeschrieben steht.
`chat_ai_service._addressed_note` haelt fest, was die Zuege einer Runde sind:
*dieselbe Zeile beschreibt denselben Augenblick aus verschiedener Sicht*. Drei
Agentenzuege sind also EIN Moment, dreimal gesehen, und nicht drei Momente.

Ein gleitendes Fenster schneidet mitten hinein. Bei drei Figuren ginge es
zufaellig auf, bei zwei oder vier nicht. Die Runde dagegen steht in den Daten:
eine Menschenzeile, dann alle Zuege mit aufsteigendem
``metadata.group_turn_index``, bis die naechste Menschenzeile kommt.

Und fuer ein Bild ist die Runde nicht nur die richtige Grenze, sondern die
reichere Quelle: drei Beschreibungen eines Moments ergeben einen genaueren
Prompt als drei verschiedene Momente.

DREI SPANNEN

    message   Genau ein Zug. „Male mir das."
    round     Menschenzeile plus alle Zuege seither. Die Vorgabe.
    section   Seit der letzten Verdichtungsgrenze — ein Etablierungsbild.
              Die Grenze wird nicht neu erfunden: `chat_conversation_digests`
              kennt sie bereits.

WER IM BILD IST, ENTSCHEIDET DIE SPANNE

Nicht die Teilnehmerliste des Fadens. Wer in der gewaehlten Spanne nicht
gehandelt hat — weil er in der Fiktion den Raum verlassen hat —, gehoert nicht
ins Bild. Die Portraits der Handelnden gehen als Referenzen mit; `flux-2` nimmt
bis zu acht in EINEN Aufruf und haelt damit die Gesichter, die die Welt schon
kennt.

DER PROMPT ENTSTEHT NICHT AUS DEM ROHTEXT

Derselbe Zweischritt wie in der Schmiede-Recherche: Prosa hinein, Struktur
heraus. Der Rohtext als Bildprompt ist die schwaechste Betriebsart, die es
gibt (SillyTavern nennt sie `raw_last` und stellt sie nicht als Vorgabe ein) —
Dialog im Prompt fuehrt dazu, dass das Modell die Dialogzeile ins Bild
schreibt.

WAS DIESER DIENST NICHT TUT

Er entscheidet die Inhaltsstufe nicht selbst. `image_content_policy` rechnet
sie aus Wunsch und Anfrage, und die Grenze dort gilt fuer jede Stufe. Dieser
Dienst fuehrt aus.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from backend.services.chat_ai_service import SCENE_IMAGE_ROLE
from backend.services.image_content_policy import (
    ContentRating,
    SceneVantage,
    resolve_rating,
    resolve_vantage,
    screen_prompt,
)
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

__all__ = ["SceneImageService", "SceneSpan", "SceneImageRefusedError"]


class SceneSpan(StrEnum):
    """Welcher Ausschnitt des Fadens zum Bild wird."""

    MESSAGE = "message"
    ROUND = "round"
    SECTION = "section"


class SceneImageRefusedError(RuntimeError):
    """Der Prompt wurde nicht erzeugt. Der Text ist fuer den Nutzer bestimmt."""


#: Wie viele Nachrichten hoechstens in eine Spanne gehen.
#:
#: Nicht als Kostenbremse, sondern weil ein Bild EIN Moment ist. Wer zwanzig
#: Zuege hineingibt, bekommt eine Aufzaehlung statt einer Szene — dasselbe
#: Problem, das `_FRAME_SCENE_FROM_CHAT` im Rahmen ausdruecklich verbietet.
_MAX_SPAN_MESSAGES = 12

#: So viele Portraits nimmt `flux-2` in einen Aufruf. Die Zahl steht hier
#: nicht noch einmal — sie kommt aus der Modellfamilie, damit sie an einer
#: Stelle steht.
_VANTAGE_INSTRUCTION: dict[SceneVantage, str] = {
    SceneVantage.HUMAN: (
        "Camera at eye level of the person being spoken to, inside the scene. "
        "Show what they would see. Never show them from behind or outside."
    ),
    SceneVantage.AGENT: (
        "Camera bound to the named focal character's position and line of sight. "
        "Anything outside their field of view is absent from the frame."
    ),
    SceneVantage.WIDE: (
        "Wide establishing shot from outside the group. All present figures visible, the space around them legible."
    ),
}


@dataclass(frozen=True, slots=True)
class SceneSelection:
    """Der gewaehlte Ausschnitt, aufgeloest."""

    messages: list[dict]
    agent_ids: list[str]
    #: Portrait-URLs der Handelnden, in der Reihenfolge ihres Auftretens.
    portraits: list[str]

    @property
    def text(self) -> str:
        """Die Zuege als Prosa, mit Sprecher — so, wie ein Leser sie saehe."""
        zeilen = []
        for m in self.messages:
            name = ((m.get("agents") or {}) or {}).get("name") if isinstance(m.get("agents"), dict) else None
            marke = name or ("der Mensch" if m.get("sender_role") == "user" else "")
            zeilen.append(f"[{marke}]: {m['content']}" if marke else m["content"])
        return "\n\n".join(zeilen)


class SceneImageService:
    """Aus einer Spanne des Gespraechs wird ein Bild."""

    def __init__(self, supabase: Client, simulation_id: UUID) -> None:
        self._supabase = supabase
        self._simulation_id = simulation_id

    # ── Auswahl ──────────────────────────────────────────────────────────────

    async def select(self, conversation_id: UUID, span: SceneSpan) -> SceneSelection:
        """Die Nachrichten der Spanne, jüngste Runde zuerst gesucht.

        Geholt wird absteigend und dann umgedreht — derselbe Weg wie
        `_load_history` und `get_messages`, und aus demselben Grund: eine
        aufsteigende Abfrage mit Kappe liefert den ANFANG des Fadens.
        """
        response = await (
            self._supabase.table("chat_messages")
            .select("id, content, sender_role, agent_id, metadata, created_at, agents(name, portrait_image_url)")
            .eq("conversation_id", str(conversation_id))
            .neq("sender_role", SCENE_IMAGE_ROLE)
            .order("created_at", desc=True)
            .limit(_MAX_SPAN_MESSAGES * 3)
            .execute()
        )
        rows = extract_list(response)
        rows.reverse()
        if not rows:
            raise SceneImageRefusedError("In diesem Gespräch steht noch nichts, was man malen könnte.")

        gewaehlt = self._cut(rows, span)[-_MAX_SPAN_MESSAGES:]

        # Wer HANDELT, nicht wer dabeisteht: die Agenten dieser Spanne, in der
        # Reihenfolge ihres Auftretens, ohne Wiederholung.
        agent_ids: list[str] = []
        portraits: list[str] = []
        for m in gewaehlt:
            aid = m.get("agent_id")
            if not aid or aid in agent_ids:
                continue
            agent_ids.append(aid)
            agent = m.get("agents")
            url = agent.get("portrait_image_url") if isinstance(agent, dict) else None
            if url:
                portraits.append(url)

        return SceneSelection(messages=gewaehlt, agent_ids=agent_ids, portraits=portraits)

    @staticmethod
    def _cut(rows: list[dict], span: SceneSpan) -> list[dict]:
        """Die Kante der Spanne. Rein rechnerisch, ohne zweite Abfrage."""
        if span is SceneSpan.MESSAGE:
            return rows[-1:]

        if span is SceneSpan.ROUND:
            # Rueckwaerts bis zur letzten Menschenzeile EINSCHLIESSLICH. Sie
            # gehoert dazu: sie ist der Anlass des Moments, den die Agenten
            # dann aus ihrer Sicht beschreiben.
            for i in range(len(rows) - 1, -1, -1):
                if rows[i].get("sender_role") == "user":
                    return rows[i:]
            return rows

        # SECTION: seit der vorletzten Menschenzeile — die Verdichtungsgrenze
        # waere genauer, kostet aber eine zweite Abfrage fuer einen Ausschnitt,
        # der ohnehin gekappt wird. Zwei Runden sind die Spanne, die ein
        # Etablierungsbild traegt.
        grenzen = [i for i, m in enumerate(rows) if m.get("sender_role") == "user"]
        return rows[grenzen[-2] :] if len(grenzen) >= 2 else rows

    # ── Ausfuehrung ──────────────────────────────────────────────────────────

    async def _world(self) -> dict:
        row = await maybe_single_data(
            self._supabase.table("simulations")
            .select("id, name, description, content_rating, scene_image_vantage")
            .eq("id", str(self._simulation_id))
            .maybe_single()
        )
        if not row:
            raise SceneImageRefusedError("Diese Welt gibt es nicht mehr.")
        return row

    async def _user_prefs(self, user_id: UUID) -> dict:
        return (
            await maybe_single_data(
                self._supabase.table("user_profiles")
                .select("image_content_preference, scene_image_vantage")
                .eq("id", str(user_id))
                .maybe_single()
            )
            or {}
        )

    async def describe(
        self,
        selection: SceneSelection,
        *,
        world: dict,
        vantage: SceneVantage,
        rating: ContentRating,
        openrouter_key: str | None = None,
    ) -> str:
        """Aus der Spanne eine Bildbeschreibung — und die Grenze davor UND danach.

        Zweimal geprueft, und das ist kein Gürtel-und-Hosentraeger: der Eingang
        ist, was ein Mensch geschrieben hat, der Ausgang ist, was ein Modell
        daraus gemacht hat. Ein Modell kann aus harmlosem Text etwas anderes
        bauen, und ein Prompt, der erst nach der Uebersetzung die Grenze
        reisst, kaeme sonst durch.
        """
        from backend.services.generation_service import GenerationService

        if (grund := screen_prompt(selection.text, stufe=rating)) is not None:
            raise SceneImageRefusedError(grund)

        # Der Schluessel gehoert an den KONSTRUKTOR und nicht an den Aufruf —
        # dort sitzt auch die Weltkennung, aus der der Vorlagenaufloeser die
        # Vorlage dieser Welt holt. Ein Test bindet die Aufrufstellen per AST
        # an die Signatur der Fassade und hat genau das gemeldet.
        generation = GenerationService(
            self._supabase,
            self._simulation_id,
            openrouter_api_key=openrouter_key,
            world_context=str(world.get("description") or ""),
        )
        beschreibung = await generation.generate_chat_scene_image(
            scene_text=selection.text,
            participants=", ".join(n for n in (self._name_of(m) for m in selection.messages) if n) or "–",
            vantage_instruction=_VANTAGE_INSTRUCTION[vantage],
            world_context=str(world.get("description") or ""),
            simulation_name=str(world.get("name") or ""),
        )

        if (grund := screen_prompt(beschreibung, stufe=rating)) is not None:
            logger.warning(
                "Bildbeschreibung nach der Uebersetzung abgewiesen",
                extra={"simulation_id": str(self._simulation_id), "stufe": rating.value},
            )
            raise SceneImageRefusedError(grund)

        return beschreibung

    @staticmethod
    def _name_of(msg: dict) -> str:
        agent = msg.get("agents")
        if isinstance(agent, dict) and agent.get("name"):
            return str(agent["name"])
        return ""

    async def generate(
        self,
        *,
        conversation_id: UUID,
        user_id: UUID,
        span: SceneSpan = SceneSpan.ROUND,
        vantage: SceneVantage | None = None,
        rating: ContentRating = ContentRating.GENERAL,
        openrouter_key: str | None = None,
    ) -> dict:
        """Der ganze Weg: auswaehlen, uebersetzen, pruefen, erzeugen, ablegen."""
        from backend.services.forge_image_service import ForgeImageService

        selection = await self.select(conversation_id, span)
        world = await self._world()
        prefs = await self._user_prefs(user_id)

        entscheidung = resolve_rating(
            nutzer_wunsch=ContentRating(prefs.get("image_content_preference") or "general"),
            angefragt=rating,
        )
        blick = resolve_vantage(
            welt=SceneVantage(world.get("scene_image_vantage") or "human"),
            nutzer_wahl=SceneVantage(prefs["scene_image_vantage"]) if prefs.get("scene_image_vantage") else None,
            angefragt=vantage,
        )

        beschreibung = await self.describe(
            selection,
            world=world,
            vantage=blick,
            rating=entscheidung.wirksam,
            openrouter_key=openrouter_key,
        )

        bilder = ForgeImageService(self._supabase, self._simulation_id)
        url = await bilder.generate_scene_image(
            description=beschreibung,
            references=selection.portraits,
            rating=entscheidung.wirksam,
            conversation_id=conversation_id,
        )

        eintrag = {
            "conversation_id": str(conversation_id),
            "sender_role": SCENE_IMAGE_ROLE,
            # `content` traegt die Beschreibung: die Tabelle verlangt einen
            # nicht-leeren Text, und ein Bild ohne Alternativtext waere fuer
            # eine Vorlesehilfe ein leerer Kasten.
            "content": beschreibung[:5000],
            "metadata": {
                "scene_image": {
                    "url": url,
                    "span": span.value,
                    "vantage": blick.value,
                    "rating": entscheidung.wirksam.value,
                    "agent_ids": selection.agent_ids,
                    "references": len(selection.portraits),
                    "downgraded": entscheidung.grund or None,
                }
            },
        }
        response = await self._supabase.table("chat_messages").insert(eintrag).execute()
        gespeichert = extract_list(response)

        logger.info(
            "Szenenbild erzeugt",
            extra={
                "conversation_id": str(conversation_id),
                "span": span.value,
                "vantage": blick.value,
                "rating": entscheidung.wirksam.value,
                "messages": len(selection.messages),
                "references": len(selection.portraits),
            },
        )
        return gespeichert[0] if gespeichert else eintrag

    async def delete(self, *, conversation_id: UUID, message_id: UUID) -> dict:
        """Ein Szenenbild entfernen — die Zeile UND beide Dateien.

        JEDES Bild liegt ZWEIMAL im Speicher. `generate_scene_image` legt eine
        native Fassung (`{uuid}.full.avif`) und einen Daumennagel
        (`{uuid}.avif`) ab und gibt nur den Daumennagel zurueck; in
        `metadata.scene_image.url` steht deshalb nur einer von beiden. Wer nur
        die verlinkte Datei loescht, laesst die groessere liegen — die, die als
        Bildvorlage wieder eingelesen wird.

        Reihenfolge wie bei `delete_conversation`: erst der Speicher, dann die
        Zeile. Das Aufraeumen ist bestmoeglich und wirft nicht; bricht der
        Aufruf dazwischen ab, ist eine Datei zu viel da statt eine Zeile ohne
        Bild. Die Zeile ist die Spur, ueber die man die Datei ueberhaupt noch
        findet — sie geht zuletzt.

        Geprueft wird, dass die Nachricht wirklich ein Szenenbild DIESES
        Fadens ist. Der Besitz des Fadens haengt am Aufrufer (`verify_ownership`
        im Router); hier haengt daran, dass ueber diesen Weg keine gewoehnliche
        Gespraechszeile geloescht werden kann.
        """
        from backend.utils.storage import object_path_from_url, remove_objects

        zeile = await maybe_single_data(
            self._supabase.table("chat_messages")
            .select("id, conversation_id, sender_role, metadata")
            .eq("id", str(message_id))
            .eq("conversation_id", str(conversation_id))
            .eq("sender_role", SCENE_IMAGE_ROLE)
            .maybe_single()
        )
        if not zeile:
            raise SceneImageRefusedError("Dieses Bild gibt es in diesem Gespraech nicht.")

        url = str(((zeile.get("metadata") or {}).get("scene_image") or {}).get("url") or "")
        entfernt = 0
        if url and (pfad := object_path_from_url(url, "simulation.assets")):
            # Beide Fassungen. Der Daumennagel steht in der Zeile, die grosse
            # Fassung leitet sich aus seinem Namen ab — dieselbe Ableitung wie
            # in `_lade_beste_aufloesung`, nur andersherum.
            pfade = [pfad]
            if pfad.endswith(".avif") and not pfad.endswith(".full.avif"):
                pfade.append(pfad[: -len(".avif")] + ".full.avif")
            entfernt = await remove_objects(self._supabase, "simulation.assets", pfade)

        await self._supabase.table("chat_messages").delete().eq("id", str(message_id)).execute()

        logger.info(
            "Szenenbild geloescht",
            extra={
                "conversation_id": str(conversation_id),
                "message_id": str(message_id),
                "storage_objects_removed": entfernt,
            },
        )
        return {"deleted": True, "message_id": str(message_id), "storage_objects_removed": entfernt}
