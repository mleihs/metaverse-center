"""Wer sieht, ist nicht wer spricht — Fokalisierung messen.

Genette trennt in der Erzähltheorie zwei Fragen, die man leicht verwechselt:
**wer sieht** und **wer spricht**. Die Antwort auf die erste heißt
Fokalisierung, und sie hat drei Werte:

    intern    Die Erzählung bleibt im Wahrnehmungshorizont EINER Figur.
    null      Der Erzähler weiß mehr als jede Figur — Allwissenheit.
    extern    Der Erzähler weiß weniger: reine Beobachtung von aussen.

Der Fehler, den dieses Modul misst, ist der **Sprung von intern auf null**.
Eine Figur hört auf, eine Person zu sein, und wird zum Autor des Abschnitts.
Gemessen am 04.09.2026 an drei aufeinanderfolgenden Zügen eines echten
Gesprächs: alle drei begannen mit einem Erzählersatz über alle Beteiligten,
zwei nannten sich dabei selbst beim Namen.

Das ist keine Marotte des Modells, sondern eine seit 1972 beschriebene
Erzählhaltung — und deshalb messbar. ``Says Who? Effective Zero-Shot
Annotation of Focalization`` (arXiv:2409.11390, CHR 2025) klassifiziert sie
zero-shot mit F1 84,8 %, etwa auf dem Niveau geschulter Menschen. Angewandt
wurde das bisher auf Literatur; als Regressionstor auf Agentenausgaben hat es
nach dem Stand der Recherche noch niemand benutzt.

── Zwei Stufen, und die erste kostet nichts ──────────────────────────────────

Die Heuristik fragt nicht „ist das gute Prosa". Sie fragt zwei sehr enge
Dinge, und beide sind Allwissenheit im Wortsinn — eine Figur kann das nicht
wahrnehmen:

1. **Ein Kollektiv aller Beteiligten.** „Die drei Frauen verharren." Wer so
   schreibt, steht ausserhalb der Gruppe, zu der er gehört.
2. **Ein fremdes Inneres als Tatsache.** „Elena spürt", „Mira weiß". Das
   Papier zum perspektivgebundenen Gedächtnis nennt es *Factual Overreach*:
   die Figur benutzt Wissen ausserhalb ihrer Perspektive.

Was sie NICHT als Fehler zählt, und das ist genauso wichtig:

* Die dritte Person über sich selbst. „Mira hebt die Hand" ist im Rollenspiel
  die übliche Konvention, nicht der Fehler — der Fehler ist der
  GELTUNGSBEREICH, nicht das Register. (Diese Unterscheidung hat mich am
  04.09. eine falsche Prompt-Änderung gekostet.)
* Wahrnehmung eines anderen. „Elena scheint zu zögern", „ich sehe sie
  zögern" — das ist genau die erlaubte Form, und eine Messung, die sie
  bestraft, treibt die Prosa in Monologe.

Die zweite Stufe ist der Referenzmaßstab: ein Modellaufruf, hinter einem
eigenen Riegel, auf Stichproben. Ihr Zweck ist, die billige Stufe zu EICHEN,
nicht sie zu ersetzen — ohne sie wüsste niemand, wie oft die Heuristik irrt.

── Was dieses Modul nicht tut ────────────────────────────────────────────────

Es blockiert keine Antwort und schreibt keinen Text um. Ein Tor, das in den
Anfragepfad eingreift, wäre beim ersten Fehlurteil ein Ausfall; eines, das
misst, ist beim ersten Fehlurteil eine falsche Zahl. Der zweite Fehler ist der
billigere und der sichtbarere.

Und es zählt nicht selbst zusammen: „wie allwissend ist dieser Faden" ist eine
Aggregatfrage und steht als View ``conversation_focalization`` in der
Datenbank (Migration 368, ADR-007). Ein Dienst, der dieselbe Zahl in Python
bildete, wäre eine zweite Wahrheit.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

Verdict = Literal["internal", "zero", "external", "unclear"]

# Der Riegel für die teure Stufe heisst `focalization_model_check_enabled`
# (Migration 368, Vorgabe AUS) und steht ABSICHTLICH noch nicht als Konstante
# hier: sie zu setzen, bevor irgendetwas danach entscheidet, hiesse ein Tor zu
# behaupten, das es nicht gibt. `test_unwired_gates_are_really_dead` hat genau
# das gefangen, und es hatte recht. Die Konstante kommt mit ihrem Leser.

#: Verben, die ein INNERES benennen.
#:
#: Die Liste ist absichtlich kurz und besteht nur aus Verben, deren Subjekt
#: das Erlebnis HAT — nicht aus solchen, die es zeigen. „Elena zittert" ist
#: Wahrnehmung von aussen und erlaubt; „Elena fürchtet" ist es nicht.
#:
#: Nicht darin, mit Absicht: `scheint`, `wirkt`, `sieht aus`, `seems`,
#: `appears`. Das sind die Formen, die eine Figur BENUTZEN SOLL, wenn sie über
#: eine andere spricht. Sie zu bestrafen triebe die Prosa in Monologe.
_INNER_VERBS_DE = (
    "spürt",
    "spuert",
    "fühlt",
    "fuehlt",
    "empfindet",
    "weiß",
    "weiss",
    "denkt",
    "erinnert sich",
    "begreift",
    "versteht",
    "ahnt",
    "hofft",
    "fürchtet",
    "fuerchtet",
    "will",
    "beschließt",
    "beschliesst",
    "entscheidet",
    "erkennt",
    "bereut",
    "sehnt sich",
)
_INNER_VERBS_EN = (
    "feels",
    "senses",
    "knows",
    "thinks",
    "remembers",
    "realizes",
    "realises",
    "understands",
    "hopes",
    "fears",
    "wants",
    "decides",
    "regrets",
    "longs",
)

#: Wörter, die eine GRUPPE meinen, zu der der Sprecher gehört.
#:
#: „Die drei Frauen verharren" — wer das schreibt, steht ausserhalb der
#: Gruppe, in der er steht. Die Zahl ist der Anker: `_collective_pattern`
#: baut daraus ein Muster mit der TATSÄCHLICHEN Teilnehmerzahl, damit „die
#: zwei Wachen" in einer Dreierrunde kein Treffer ist.
_COLLECTIVE_NUMBERS = {
    2: ("zwei", "beide", "two", "both"),
    3: ("drei", "three"),
    4: ("vier", "four"),
    5: ("fünf", "fuenf", "five"),
}
_COLLECTIVE_ALL = ("alle drei", "alle vier", "wir alle", "all three", "all four", "all of us")

#: Zeichen dafür, dass der Text IM Horizont einer Figur steht.
#:
#: Erste Person ist das offensichtliche. Aber auch ein Text ohne jede erste
#: Person kann intern fokalisiert sein: „Mira hebt die Hand" ist die übliche
#: Rollenspielkonvention und bleibt bei EINER Person. Deshalb zählt unten
#: auch der Fall „ausser dem Sprecher handelt niemand".
_FIRST_PERSON = re.compile(
    r"\b(?:ich|mein|meine|meiner|meinem|meinen|mir|mich|"
    r"i|my|me|mine)\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class FocalizationResult:
    """Ein Urteil samt seinem Beleg.

    ``evidence`` ist nicht Zierrat. Ein Urteil ohne Beleg ist eine Behauptung,
    und wer in einem halben Jahr nachsieht, warum ein Zug als allwissend
    gezählt wurde, hat nur diesen einen Anhaltspunkt.
    """

    verdict: Verdict
    method: Literal["heuristic", "model"] = "heuristic"
    evidence: dict[str, Any] = field(default_factory=dict)
    others_named: list[str] = field(default_factory=list)
    model: str | None = None


class FocalizationService:
    """Misst, ob ein Agentenzug im Horizont seiner Figur bleibt."""

    # ── Die kostenlose Stufe ──────────────────────────────────────────────

    @classmethod
    def measure(cls, text: str, *, speaker: str, others: list[str]) -> FocalizationResult:
        """Der Befund für EINEN Zug. Kein Netz, kein Modell, keine Kosten.

        Drei mögliche Urteile, und das dritte ist kein Ausweichen:

        ``zero``      Kollektiv oder fremdes Inneres gefunden.
        ``internal``  Erste Person, oder ausser dem Sprecher handelt niemand.
        ``unclear``   Andere sind genannt, aber weder als Kollektiv noch mit
                      Innerem, und der Sprecher sagt nirgends „ich". „Sie
                      zögert" kann Wahrnehmung sein oder Anmassung, und der
                      Unterschied steht nicht im Wortlaut. Dafür ist die
                      zweite Stufe da.

        Zu raten wäre schlimmer als zuzugeben, nichts gesehen zu haben.
        """
        if not text or not text.strip():
            return FocalizationResult("unclear", evidence={"grund": "leerer Text"})

        fremde = [n for n in others if n and n.strip() and n != speaker]
        genannt = [n for n in fremde if cls._names_person(text, n)]

        kollektiv = cls._find_collective(text, teilnehmer=len(fremde) + 1)
        inneres = cls._find_foreign_interior(text, fremde)
        gemeinsam = cls._find_joint_others(text, fremde, speaker=speaker)

        belege: dict[str, Any] = {}
        if kollektiv:
            belege["kollektiv"] = kollektiv
        if inneres:
            belege["fremdes_inneres"] = inneres
        if gemeinsam:
            belege["mehrere_fremde_ohne_ich"] = gemeinsam

        if belege:
            return FocalizationResult("zero", evidence=belege, others_named=genannt)

        # Kein Anhalt für Allwissenheit. Jetzt die Gegenfrage: gibt es einen
        # POSITIVEN Anhalt für den Horizont EINER Figur?
        #
        # ⚠ Diese Hälfte fehlte in der ersten Fassung, und der Schaden war
        # nicht klein: ohne sie gab es nur `zero` und `unclear`, der Nenner
        # der Quote in `conversation_focalization` bestand allein aus
        # `zero`-Fällen, und die View meldete für JEDEN Faden 100 %.
        # Eine Kennzahl, die immer denselben Wert hat, misst nichts.
        #
        # Zwei Wege zu „intern", und beide sind Genette-treu:
        #   · erste Person — der Horizont ist ausgesprochen
        #   · ausser dem Sprecher handelt niemand — „Mira hebt die Hand" ist
        #     die übliche Rollenspielkonvention und bleibt bei EINER Person.
        #     Das Register ist nicht die Fokalisierung.
        erste_person = bool(_FIRST_PERSON.search(text))
        nur_ich = not genannt
        if erste_person or nur_ich:
            return FocalizationResult(
                "internal",
                evidence={
                    "erste_person": erste_person,
                    "kein_fremder_handelnder": nur_ich,
                },
                others_named=genannt,
            )

        # Andere sind genannt, aber weder als Kollektiv noch mit Innerem, und
        # der Sprecher sagt nirgends „ich". Das ist der Fall, den diese Stufe
        # ehrlich nicht entscheiden kann — „sie zögert" kann Wahrnehmung sein
        # oder Anmassung, und der Unterschied steht nicht im Wortlaut.
        return FocalizationResult(
            "unclear",
            evidence={"grund": "andere genannt, aber kein Kollektiv, kein fremdes Inneres, keine erste Person"},
            others_named=genannt,
        )

    @staticmethod
    def _names_person(text: str, name: str) -> bool:
        """Ob der Text diese Person beim Namen nennt.

        Auch beim VORNAMEN — Rollenspieltexte schreiben „Elena", nicht „Elena
        Voss". Wortgrenzen, damit „Mira" nicht in „Miracle" trifft.
        """
        teile = [name, *name.split()]
        return any(re.search(rf"\b{re.escape(t)}\b", text, re.IGNORECASE) for t in teile if len(t) > 2)

    @staticmethod
    def _find_collective(text: str, *, teilnehmer: int) -> str | None:
        """Ein Wort, das die GANZE Runde meint.

        Die Zahl muss stimmen: „die drei Frauen" ist in einer Dreierrunde ein
        Treffer, „die zwei Wachen" nicht. Ohne diese Bindung wäre jede
        Zahlenangabe im Text ein Fehlalarm.
        """
        niedrig = text.lower()
        for wendung in _COLLECTIVE_ALL:
            if wendung in niedrig:
                return wendung
        for wort in _COLLECTIVE_NUMBERS.get(teilnehmer, ()):
            # „die drei", „the three" — mit Artikel davor, sonst trifft es
            # jede beilaeufige Zahl („drei Schritte").
            if re.search(rf"\b(?:die|der|den|the)\s+{re.escape(wort)}\b", niedrig):
                return wort
        return None

    @classmethod
    def _find_foreign_interior(cls, text: str, others: list[str]) -> list[str] | None:
        """Ein fremdes Inneres als Tatsache behauptet.

        Gesucht wird das Muster ``<fremder Name> … <Innen-Verb>`` innerhalb
        eines kurzen Fensters — dazwischen dürfen ein paar Wörter stehen
        („Elena, die Hände im Schoss, weiß"), aber kein Satzende. Über einen
        Punkt hinweg zu suchen fände „Elena schweigt. Ich weiss." und das wäre
        falsch.
        """
        treffer: list[str] = []
        verben = "|".join(re.escape(v) for v in (*_INNER_VERBS_DE, *_INNER_VERBS_EN))
        for name in others:
            for teil in [name, *name.split()]:
                if len(teil) <= 2:
                    continue
                muster = rf"\b{re.escape(teil)}\b[^.!?\n]{{0,40}}?\b(?:{verben})\b"
                gefunden = re.search(muster, text, re.IGNORECASE)
                if gefunden:
                    treffer.append(gefunden.group(0).strip())
                    break
        return treffer or None

    @classmethod
    def _find_joint_others(cls, text: str, others: list[str], *, speaker: str) -> str | None:
        """Ein Satz, der ZWEI Beteiligte nebeneinanderstellt, ohne ein „ich".

        Das ist eine Aufzählung der Runde von aussen — funktional dasselbe wie
        ein Kollektiv, nur ausgeschrieben.

        ⚠ DER SPRECHER ZÄHLT MIT, und das ist der Punkt. Der echte Zug, der
        diese Regel ausgelöst hat (04.09.2026, 15:07 UTC), lautete sinngemäss:

            „…während die Eier in <Sprecherin> und <die andere> zum Leben
             erwachen."

        Geschrieben VON der Sprecherin. Sie nennt sich selbst in der dritten
        Person, neben einer anderen, als zwei gleichrangige Orte desselben
        Vorgangs. Das ist der Blick von aussen auf den eigenen Körper — und
        genau das kann niemand aus EINEM Körper heraus.

        Eine Regel, die nur fremde Namen zählte, hätte den Satz nicht gesehen:
        ausser der Sprecherin war nur EINE andere genannt.

        ⚠ Die Bedingung „ohne ein ich" ist die zweite Hälfte, und ohne sie
        wäre die Regel falsch:

            „Ich sehe, wie sie und er sich ansehen."   ← Wahrnehmung, gut
            „Sie und er sehen sich an."                ← Erzählung, nicht

        Beide nennen zwei Beteiligte. Der Unterschied ist, ob ein
        Wahrnehmender im Satz steht. Deshalb SATZWEISE und nicht über den
        ganzen Text: ein „ich" drei Sätze weiter rettet den Satz nicht, in dem
        es fehlt.

        Die dritte Person über sich ALLEIN bleibt unangetastet — „Sie hebt die
        Hand" nennt einen Beteiligten, nicht zwei.
        """
        beteiligte = [n for n in [speaker, *others] if n and n.strip()]
        for satz in re.split(r"(?<=[.!?])\s+|\n+", text):
            if not satz.strip() or _FIRST_PERSON.search(satz):
                continue
            drin = [n for n in beteiligte if cls._names_person(satz, n)]
            if len(drin) >= 2:
                return satz.strip()[:120]
        return None

    # ── Schreiben ─────────────────────────────────────────────────────────

    @classmethod
    async def record(
        cls,
        admin: Client,
        message_id: UUID,
        result: FocalizationResult,
    ) -> None:
        """Den Befund ablegen. Ein zweiter Lauf desselben Verfahrens ersetzt ihn.

        `on_conflict` auf (message_id, method): sonst häufte jeder Lauf Zeilen
        an, und die Auswertung zählte dieselbe Nachricht mehrfach. Die
        Eindeutigkeit steht in Migration 368, hier steht nur, dass wir sie
        benutzen.

        Fehler kosten NICHTS: die Nachricht ist schon geschrieben, und ein
        fehlender Messwert ist eine Lücke in einer Statistik, kein Ausfall im
        Gespräch.
        """
        try:
            await (
                admin.table("chat_message_focalization")
                .upsert(
                    {
                        "message_id": str(message_id),
                        "verdict": result.verdict,
                        "method": result.method,
                        "evidence": result.evidence,
                        "others_named": result.others_named,
                        "model": result.model,
                    },
                    on_conflict="message_id,method",
                )
                .execute()
            )
        except Exception:
            logger.exception("Fokalisierungs-Befund fuer %s nicht gespeichert", message_id)

    # ── Lesen: die Auswertung kommt aus SQL ───────────────────────────────

    @staticmethod
    async def rate_for_conversation(
        supabase: Client, conversation_id: UUID, *, method: str = "heuristic"
    ) -> dict[str, Any] | None:
        """Die Allwissenheitsquote eines Fadens.

        Aus der View, nicht aus einer Schleife. Dieselbe Zahl bekommt die
        Verwaltungsoberfläche, ein Test und ein Mensch mit psql — es gibt keine
        zweite Rechnung, die davon abweichen könnte (ADR-007).
        """
        response = await (
            supabase.table("conversation_focalization")
            .select("gemessen, allwissend, im_horizont, unklar, allwissend_prozent, zuletzt")
            .eq("conversation_id", str(conversation_id))
            .eq("method", method)
            .limit(1)
            .execute()
        )
        rows = extract_list(response)
        return rows[0] if rows else None
