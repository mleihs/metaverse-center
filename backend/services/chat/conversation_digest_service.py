"""Die verdichtete Vorgeschichte eines Fadens — abschnittweise, einmalig.

DER ANLASS, wörtlich vom Nutzer hat es gemeldet (Wortlaut nicht wiedergegeben)

Der Satz stimmt, aber die naheliegende Antwort (mehr Verlauf mitschicken) ist
falsch, und drei gemessene Befunde bestimmen deshalb die Bauform:

1. **Persona-Drift ist kein Fensterproblem.** arXiv:2512.12775 (EACL 2026)
   misst den Verfall der Figurentreue über 100+ Züge und findet ihn
   *innerhalb* des Kontextfensters — er tritt auf, wenn gar nichts
   abgeschnitten wird. Ein grösseres Fenster heilt ihn nicht.
2. **Wörtliche Ausschnitte schlagen extrahierte Fakten.** arXiv:2601.00821
   (kontrollierte Ablation, alles andere konstant) misst 43,9 % gegen 28,0 %
   auf LoCoMo und 67,4 % gegen 45,4 % auf LongMemEval-S. Die Empfehlung ist
   die *Vereinigung*. ``agent_memories`` ist reine Extraktion; das hier ist
   die andere Hälfte, und das wörtliche Fenster der letzten Züge bleibt
   daneben stehen.
3. **Rekursives Zusammenfassen häuft Fehler an.** arXiv:2308.15022 und die
   Arbeiten danach: wer Zusammenfassung und neue Züge immer wieder zu einer
   neuen Zusammenfassung faltet, lässt den Verdichter seine eigene frühere
   Ausgabe als Grundwahrheit behandeln. Ein einmal falsch gesagter Satz
   überlebt jede Runde und wird dabei bestätigt.

Aus 3 folgt die eine Entscheidung, die alles andere trägt: **jeder Abschnitt
wird genau einmal verdichtet, aus seinen eigenen Nachrichten, und danach nie
wieder angefasst.** Es gibt keinen Pfad, auf dem eine Verdichtung eine andere
liest. Die Fehlerhäufung ist damit nicht gemildert, sondern baulich
ausgeschlossen.

Die Kosten sind dadurch endlich statt wachsend. Gemessen an ``ai_usage_log``
auf Produktion (200 Aufrufe, ``purpose = 'chat'``): 21 940 Eingabe-Token je
Zug, weil der Chat bis zu 60 % seines Fensters mit Verlauf füllt. Ein Faden
mit 329 Nachrichten kostet hier acht einmalige Aufrufe — und die Zahl wächst
mit dem Faden, nicht mit jedem Zug darin.

Was dieser Dienst NICHT ist: der Ersatz für das wörtliche Fenster. Er steht
daneben. Die Reihenfolge im Prompt ist Figurenblock, Verdichtungen, wörtliche
letzte Züge — vom Allgemeinen zum Nächsten, weil das Letzte im Prompt am
schwersten wiegt.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from backend.services.ai_usage_service import AIUsageService
from backend.services.budget_enforcement_service import BudgetExceededError
from backend.services.external.openrouter import BudgetContext, OpenRouterService
from backend.services.model_resolver import ModelResolver
from backend.services.platform_model_config import get_platform_max_tokens, get_platform_reasoning
from backend.services.prompt_service import LOCALE_NAMES, PromptResolver
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Wie viele Nachrichten ein Abschnitt fasst.
#:
#: Die Zahl ist eine Abwägung und keine Naturkonstante, deshalb steht sie hier
#: und nicht in der Migration:
#:
#: * **Kleiner** heisst feinere Auflösung und mehr Aufrufe. Bei 20 kostete der
#:   Faden 7b2e37c3 sechzehn statt acht Verdichtungen, und jede zweite hätte
#:   kaum mehr zu berichten als „sie redeten weiter".
#: * **Grösser** heisst weniger Aufrufe und gröbere Erinnerung. Bei 100 fiele
#:   eine ganze Beziehungswende in einen Absatz.
#:
#: 40 Nachrichten sind bei den auf Produktion gemessenen Längen etwa eine
#: Sitzung — die Einheit, in der ein Mensch sich an ein Gespräch erinnert.
SEGMENT_SIZE = 40

#: Wie viele Abschnitte höchstens in einen Prompt gehen.
#:
#: Ohne Deckel wüchse der Block linear mit dem Faden und nähme genau den Platz
#: zurück, den die Verdichtung sparen sollte. Acht Abschnitte sind 320
#: Nachrichten Vorgeschichte; ist der Faden länger, fallen die ÄLTESTEN weg —
#: nicht die neuesten. Was vor einem halben Jahr besprochen wurde, ist über
#: `agent_memories` weiter auffindbar, wenn es wichtig war.
MAX_DIGESTS_IN_PROMPT = 8

#: Der eigene Zweck. Nicht `chat_response`: eine Verdichtung ist ein Bericht
#: und kein Gesprächszug, sie braucht ein anderes Antwortbudget und soll in
#: der Kostenauswertung getrennt sichtbar sein. Und sie darf nicht auf
#: `model_default` laufen — siehe Handoff `denkmodell-als-standard-2026-09-02`:
#: ein Denkmodell als Vorgabe machte 709 von 747 Aufrufen unbemerkt teuer.
PURPOSE = "chat_digest"


class ConversationDigestService:
    """Erzeugt und liest die abschnittweise Vorgeschichte eines Fadens."""

    def __init__(
        self,
        supabase: Client,
        simulation_id: UUID,
        openrouter_api_key: str | None = None,
    ) -> None:
        self._supabase = supabase
        self._simulation_id = simulation_id
        self._prompt_resolver = PromptResolver(supabase, simulation_id)
        self._model_resolver = ModelResolver(supabase, simulation_id)
        self._openrouter = OpenRouterService(api_key=openrouter_api_key)

    # ── Lesen ─────────────────────────────────────────────────────────────

    async def load_digest_text(self, conversation_id: UUID, locale: str = "de") -> str:
        """Die vorhandenen Verdichtungen als ein Block für den System-Prompt.

        Reiner Lesevorgang, kein Modellaufruf: er liegt im Anfragepfad eines
        Chats und darf ihn nicht verlängern. Fehlt eine Verdichtung, fehlt sie
        eben — das Gespräch läuft mit dem wörtlichen Fenster weiter, nur mit
        kürzerem Gedächtnis. Erzeugt wird ausserhalb des Pfades
        (:meth:`ensure_digests`).
        """
        rows = await self._load_digests(conversation_id)
        if not rows:
            return ""

        # Die NEUESTEN behalten, wenn gedeckelt wird. `rows` kommt aufsteigend,
        # der Schnitt liegt also vorn.
        rows = rows[-MAX_DIGESTS_IN_PROMPT:]
        kopf = (
            "Earlier in this conversation (your own memory of it):"
            if locale == "en"
            else "Frueher in diesem Gespraech (deine eigene Erinnerung daran):"
        )
        teile = [kopf]
        for row in rows:
            teile.append(f"\n[{row['covers_from'][:10]} – {row['covers_to'][:10]}]\n{row['summary']}")
        return "\n".join(teile)

    async def _load_digests(self, conversation_id: UUID) -> list[dict[str, Any]]:
        response = await (
            self._supabase.table("chat_conversation_digests")
            .select("segment_index, covers_from, covers_to, summary")
            .eq("conversation_id", str(conversation_id))
            .order("segment_index")
            .execute()
        )
        return extract_list(response)

    # ── Schreiben ─────────────────────────────────────────────────────────

    async def ensure_digests(
        self,
        conversation_id: UUID,
        *,
        participant_names: list[str],
        locale: str = "de",
        max_per_run: int = 2,
    ) -> int:
        """Fehlende Abschnitte verdichten. Gibt zurück, wie viele entstanden.

        ⚠ **Verlangt einen service_role-Client.** Der Dienst liest mit dem
        Client, mit dem er gebaut wurde — für :meth:`load_digest_text` reicht
        der des Nutzers, denn die RLS-Richtlinie aus 358 lässt den Besitzer
        lesen. SCHREIBEN darf sie niemand: es gibt keine Schreibrichtlinie für
        `authenticated`, weil ein Mensch, der seine eigene Vorgeschichte
        umschreiben kann, dem Modell eine Geschichte unterschieben kann, die
        nie stattgefunden hat. Und `BudgetContext` verlangt ohnehin den
        Admin-Client.

        Der einzige Aufrufer ist deshalb `ChatAIService._fire_and_forget_digest`,
        und der baut den Dienst mit `get_admin_supabase()` neu — auch weil der
        anfragegebundene Client beim Abbau der Anfrage geschlossen ist.

        ``max_per_run`` deckelt einen einzelnen Lauf. Ein Faden, der zum
        ersten Mal verdichtet wird, hätte sonst acht Modellaufrufe am Stück —
        der erste Aufruf für einen langen Faden wäre der teuerste, und zwar
        ohne dass jemand ihn angefordert hat. So holt der Faden über wenige
        Läufe auf, und die Verdichtungen, die es schon gibt, sind sofort
        nützlich.

        NUR VOLLSTÄNDIGE Abschnitte. Ein angefangener wird nicht verdichtet:
        er müsste später ergänzt oder ersetzt werden, und ein Ersetzen aus dem
        eigenen alten Wert IST die Rekursion, die diese Bauform ausschliesst.
        Die laufenden Nachrichten stehen ohnehin wörtlich im Fenster.
        """
        gesamt = await self._count_messages(conversation_id)
        vollstaendig = gesamt // SEGMENT_SIZE
        if vollstaendig == 0:
            return 0

        vorhanden = {row["segment_index"] for row in await self._load_digests(conversation_id)}
        fehlend = [i for i in range(vollstaendig) if i not in vorhanden]
        if not fehlend:
            return 0

        model = await self._model_resolver.resolve_text_model(PURPOSE)
        template = await self._prompt_resolver.resolve("chat_conversation_digest", locale)
        budget = BudgetContext(
            admin_supabase=self._supabase,
            purpose=PURPOSE,
            simulation_id=self._simulation_id,
        )

        erzeugt = 0
        for index in fehlend[:max_per_run]:
            if await self._write_one(
                conversation_id,
                index,
                participant_names=participant_names,
                locale=locale,
                model=model,
                template=template,
                budget=budget,
            ):
                erzeugt += 1
        return erzeugt

    async def _write_one(
        self,
        conversation_id: UUID,
        segment_index: int,
        *,
        participant_names: list[str],
        locale: str,
        model: Any,
        template: Any,
        budget: BudgetContext,
    ) -> bool:
        messages = await self._load_segment(conversation_id, segment_index)
        if len(messages) < SEGMENT_SIZE:
            # Zwischen Zählung und Auswahl kann gelöscht worden sein. Ein
            # unvollständiger Abschnitt wird NICHT verdichtet — er trüge dann
            # für immer die Nummer eines Abschnitts, den es so nie gab.
            logger.info(
                "Abschnitt %d von %s ist unvollstaendig (%d/%d) – uebersprungen",
                segment_index,
                conversation_id,
                len(messages),
                SEGMENT_SIZE,
            )
            return False

        transcript = "\n".join(self._as_line(m) for m in messages)
        prompt = self._prompt_resolver.fill_template(
            template,
            {
                "participant_names": ", ".join(participant_names),
                "transcript": transcript,
                "locale_name": LOCALE_NAMES.get(locale, locale),
                "segment_index": str(segment_index + 1),
            },
        )
        system_prompt = self._prompt_resolver.fill_system_prompt(template, {})

        try:
            text = await self._openrouter.generate(
                model=model.model_id,
                messages=([{"role": "system", "content": system_prompt}] if system_prompt else [])
                + [{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=get_platform_max_tokens(PURPOSE),
                reasoning=get_platform_reasoning(PURPOSE),
                budget=budget,
            )
        except BudgetExceededError as exc:
            # Eine bewusste, protokollierte Verwaltungsentscheidung, kein
            # Fehlschlag. Wiederholen hiesse dieselbe Absage noch einmal holen.
            logger.info("Verdichtung von %s durch Budget gestoppt: %s", conversation_id, exc)
            return False

        await AIUsageService.log(
            self._supabase,
            simulation_id=self._simulation_id,
            provider="openrouter",
            model=model.model_id,
            purpose=PURPOSE,
            usage=self._openrouter.last_usage or {},
            metadata={"conversation_id": str(conversation_id), "segment_index": segment_index},
        )

        text = (text or "").strip()
        if not text:
            # Leer NICHT speichern. Die CHECK-Beschränkung wiese es ab, aber
            # der eigentliche Grund ist ein anderer: eine leere Zeile belegte
            # die Abschnittsnummer, und der Abschnitt wäre für immer
            # unverdichtbar — `ensure_digests` hielte ihn für erledigt.
            logger.warning("Leere Verdichtung fuer Abschnitt %d von %s", segment_index, conversation_id)
            return False

        try:
            await (
                self._supabase.table("chat_conversation_digests")
                .insert(
                    {
                        "conversation_id": str(conversation_id),
                        "segment_index": segment_index,
                        "covers_from": messages[0]["created_at"],
                        "covers_to": messages[-1]["created_at"],
                        "message_count": len(messages),
                        "summary": text,
                        "locale": locale,
                        "model": model.model_id,
                    }
                )
                .execute()
            )
        except Exception as exc:
            # Der Eindeutigkeitszwang aus 358 ist hier die Begegnung zweier
            # gleichzeitiger Laeufe. Der zweite hat nichts falsch gemacht; er
            # war nur langsamer. Kein Sentry-Eintrag fuer ein Wettrennen, das
            # die Datenbank korrekt entschieden hat.
            if "23505" in str(exc) or "duplicate key" in str(exc).lower():
                logger.info(
                    "Abschnitt %d von %s wurde parallel verdichtet – der andere Lauf war schneller",
                    segment_index,
                    conversation_id,
                )
                return False
            raise
        return True

    # ── Datenzugriff ──────────────────────────────────────────────────────

    async def _count_messages(self, conversation_id: UUID) -> int:
        response = await (
            self._supabase.table("chat_messages")
            .select("id", count="exact")
            .eq("conversation_id", str(conversation_id))
            .limit(1)
            .execute()
        )
        return int(getattr(response, "count", 0) or 0)

    async def _load_segment(self, conversation_id: UUID, segment_index: int) -> list[dict[str, Any]]:
        """Die Nachrichten EINES Abschnitts, chronologisch.

        `range` und nicht `limit` mit Versatz im Python: die Grenzen des
        Abschnitts sind Zeilennummern in der nach `created_at` sortierten
        Menge, und die soll die Datenbank ziehen.
        """
        start = segment_index * SEGMENT_SIZE
        response = await (
            self._supabase.table("chat_messages")
            .select("content, sender_role, created_at, agents(name)")
            .eq("conversation_id", str(conversation_id))
            .order("created_at")
            .range(start, start + SEGMENT_SIZE - 1)
            .execute()
        )
        return extract_list(response)

    @staticmethod
    def _as_line(msg: dict[str, Any]) -> str:
        """Eine Zeile der Mitschrift, mit Sprecher.

        Der Name steht als Text davor und die Rolle ist überall ``user``: das
        hier ist eine MITSCHRIFT, kein Gesprächsprotokoll. Ginge sie als Folge
        von ``assistant``- und ``user``-Zügen hinaus, läse das Modell die
        fremden Züge als eigene und schriebe das Gespräch fort statt es zu
        berichten — derselbe Fehler, den Migration 356 im Chat selbst behoben
        hat, nur an anderer Stelle.
        """
        embedded = msg.get("agents")
        if isinstance(embedded, list):
            embedded = embedded[0] if embedded else None
        name = embedded.get("name") if isinstance(embedded, dict) else None
        if not name:
            name = "User" if msg.get("sender_role") == "user" else "?"
        return f"{name}: {msg.get('content') or ''}"
