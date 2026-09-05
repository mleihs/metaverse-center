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

from backend.services.chat.names import anrede_teile, nennt
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
    #: Woertliche Rede — als KLASSEN, nicht als Paare.
    #:
    #: Die erste Fassung hat drei saubere Konventionen gepaart: „…“, “…” und
    #: "…". Nachgemessen am 05.09.2026 — die Kreuztabelle kam von der Sitzung
    #: `velgarien-rebuild-af`, hier selbst nachgerechnet — fallen davon
    #: **5 von 9** Kombinationen durch:
    #:
    #:                      schliessend
    #:       oeffnend     “        ”        "
    #:       --------------------------------------
    #:       „ deutsch    ja       ja       NEIN
    #:       “ typo      NEIN      ja       NEIN
    #:       " gerade    NEIN     NEIN      ja
    #:
    #: Was hielt, waren genau die drei Konventionen plus „…”. Alles Gemischte
    #: fiel durch — und Gemischtes ist kein Stil, sondern ein Ausrutscher: ein
    #: Modell rutscht oefter aus, als es sich entscheidet. Dazu fielen durch:
    #: Guillemets in beiden Richtungen (»…« und «…»), Rede ueber einen
    #: Zeilenumbruch (die alte Klasse [^"\n] schloss den Umbruch aus), und das
    #: Zitat im Zitat („Er sagte "ja" dazu“ — das " war aus der Innenklasse
    #: ausgeschlossen, der deutsche Zweig fand sein Ende nicht mehr).
    #:
    #: Die Reparatur ist deshalb nicht, fuenf Muster nachzutragen, sondern die
    #: Zeichen zu KLASSIFIZIEREN: ein Oeffner, ein Schliesser, dazwischen
    #: alles. Damit fallen die gemischten Paare, die Guillemets und das Zitat
    #: im Zitat in einem Griff, und die Regel wird kuerzer statt laenger.
    #:
    #: Die Richtung jeder dieser Luecken war dieselbe wie beim behobenen
    #: Fehler: nicht geschnittene Rede wird als Erzaehlung gelesen, also
    #: FALSCH-POSITIVE Allwissenheit. Belegt: »Marie, wo ist Suse?« — eine
    #: reine Anrede — galt bis hierher als `zero`.
    #:
    #: NICHT dazu gehoeren Sternchen (*…*). Das ist Handlung, keine Rede, und
    #: Handlung ist genau das, was gemessen werden soll.
    _ANF_AUF = "\u201e\u201c\u201d\"\u00ab\u00bb"
    _ANF_ZU = "\u201c\u201d\"\u00ab\u00bb"

    #: Die Obergrenze, und sie ist der Preis der Klassifizierung.
    #:
    #: ⚠ Ein UNPAARIGES Anfuehrungszeichen frisst ohne sie den Rest des Zuges.
    #: Der Zug bestuende dann rechnerisch nur aus Rede und galte als
    #: `internal` — ein Fehler in der GEGENrichtung, und der ist schlimmer:
    #: eine falsch-positive Allwissenheit faellt beim Nachlesen auf, eine
    #: verschwundene faellt nicht auf. Lieber konservativ schneiden als gar
    #: nicht begrenzen. 400 Zeichen sind reichlich fuer einen Redebeitrag in
    #: diesen Faeden und knapp genug, dass ein Ausrutscher hoechstens einen
    #: Absatz kostet.
    _REDE_MAX = 400
    _REDE = re.compile(
        rf"[{_ANF_AUF}][\s\S]{{2,{_REDE_MAX}}}?[{_ANF_ZU}]"
    )

    @classmethod
    def _ohne_rede(cls, text: str) -> str:
        """Der ERZAEHLTE Teil, ohne das, was die Figur laut sagt.

        Fokalisierung ist eine Eigenschaft der ERZAEHLUNG. Was eine Figur
        ausspricht, ist ihre Behauptung und faellt nicht darunter: „Mira,
        solange Lena weg ist – was liegt in deinem Archiv?" ist eine Anrede
        an die eine und eine Erwaehnung der anderen, kein allwissender Satz.

        ⚠ GEMESSEN am 05.09.2026. Nach den Reparaturen 371/372/373 meldete
        der Detektor 2 von 9 Zuegen als allwissend — MEHR als die 14 % des
        alten Fadens. Beide Treffer lagen in woertlicher Rede:

            "mehrere_fremde_ohne_ich"  eine an eine Figur gerichtete Frage,
                                       die die dritte beim Namen nennt
            "fremdes_inneres"          ein Bedingungssatz innerhalb der Rede

        Ein Messgeraet, das die Rede mitliest, bestraft eine Figur dafuer,
        dass sie ihre Gegenueber beim Namen anspricht — also fuer genau das
        Verhalten, das ein Gruppengespraech ausmacht. Alle frueheren Zahlen
        dieses Detektors (14,6 % · 13,4 % · 20,4 %) tragen diesen Fehler und
        sind nach oben verzerrt.

        ── WELCHE Formen der Schnitt kennt ──────────────────────────────

        Diese Liste gehoert in den Docstring und nicht in den Kopf des Moduls,
        weil sie beim naechsten Lesen die eigentliche Frage ist. Wer hier nur
        „Rede ausgeschlossen" liest, haelt den Schnitt fuer vollstaendig — und
        traegt einen Rest des alten Fehlers weiter, kleiner, aber denselben.

        Geschnitten wird jede Spanne von einem OEFFNER zu einem SCHLIESSER:

            Oeffner      „   “   ”   "   «   »
            Schliesser   “   ”   "   «   »
            dazwischen   alles, auch Zeilenumbrueche, hoechstens `_REDE_MAX`

        Damit sind alle neun Kombinationen der drei ueblichen Konventionen
        abgedeckt, die gemischten eingeschlossen, dazu beide Guillemet-
        Richtungen, Rede ueber einen Absatz hinweg und das Zitat im Zitat.

        NICHT geschnitten wird, mit Absicht:

        * Sternchen (*…*) — das ist Handlung, keine Rede, und Handlung ist
          genau das, was gemessen werden soll.
        * Gedankenstrich-Rede (— Wo ist sie?) — im Bestand nicht belegt, und
          ein enges Muster dafuer gibt es nicht: jeder Gedankenstrich am
          Satzanfang waere ein Treffer. Sie bleibt offen, bis sie auftaucht.
        * Ein Anfuehrungszeichen ohne Partner ueber `_REDE_MAX` hinaus. Das
          ist der Preis der Obergrenze und die gewollte Richtung, siehe dort.

        Bleibt nach dem Schnitt nichts uebrig, besteht der Zug GANZ aus Rede.
        Dann gibt es keine Erzaehlung, die einen Blickwinkel haben koennte —
        `measure` gibt dafuer `internal` zurueck, nicht `zero`. Den vollen
        Text zurueckzugeben (die erste Fassung tat das) hiess, genau den Fall
        wieder mitzumessen, den dieser Schnitt ausnehmen soll.
        """
        return cls._REDE.sub(" ", text)

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
        # Gemessen wird der ERZAEHLTE Teil. Siehe `_ohne_rede`.
        erzaehlt = cls._ohne_rede(text)
        if not erzaehlt.strip():
            # Nur Rede. Keine Erzaehlung, also kein Blickwinkel, der
            # ueberschritten werden koennte — eine Figur, die ausschliesslich
            # spricht, ist in ihrer eigenen Stimme, per Definition.
            return FocalizationResult(
                "internal",
                evidence={"nur_rede": True},
                others_named=[n for n in fremde if cls._names_person(text, n)],
            )
        genannt = [n for n in fremde if cls._names_person(erzaehlt, n)]

        kollektiv = cls._find_collective(erzaehlt, teilnehmer=len(fremde) + 1)
        inneres = cls._find_foreign_interior(erzaehlt, fremde)
        gemeinsam = cls._find_joint_others(erzaehlt, fremde, speaker=speaker)

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
        erste_person = bool(_FIRST_PERSON.search(erzaehlt))
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
        Voss". Welche Wortformen dazu zaehlen und warum das erste Feld des
        Namens keine davon ist, steht in ``backend/services/chat/names.py``:
        dieselbe Frage stellt die Lage-Ansage im Prompt, und sie muss dieselbe
        Antwort bekommen — sonst misst das Messgeraet eine andere Welt als
        die, in der die Anweisung geschrieben wird.
        """
        return nennt(text, name)

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
            # Dieselben Wortformen wie `_names_person` — sonst gaelte „Doktor
            # Freundlich weiss" fuer JEDE Figur mit diesem Titel als fremdes
            # Inneres, und der Titel allein waere ein Name.
            for teil in anrede_teile(name):
                muster = rf"\b{re.escape(teil)}(?:s|ns)?\b[^.!?\n]{{0,40}}?\b(?:{verben})\b"
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
        # ⚠ `allwissend_prozent` stand hier bis zum 05.09.2026 und war seit
        # Migration 369 keine Spalte mehr — die View traegt seither ZWEI
        # Quoten, weil eine Zahl die beiden Fragen nicht beantwortet. Der
        # Abruf haette auf Produktion 400 gemeldet; gefunden hat ihn niemand,
        # weil der einzige Aufrufer ein Test mit einem Doppelgaenger ist, der
        # jede Spaltenliste widerspruchslos annimmt. Noch eine Pruefung, die
        # bestand, ohne ihre Bedingung herzustellen.
        response = await (
            supabase.table("conversation_focalization")
            .select(
                "gemessen, allwissend, im_horizont, unklar, "
                "unter_entschiedenen_prozent, von_allen_prozent, zuletzt"
            )
            .eq("conversation_id", str(conversation_id))
            .eq("method", method)
            .limit(1)
            .execute()
        )
        rows = extract_list(response)
        return rows[0] if rows else None
