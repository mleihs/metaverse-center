"""Wer diesmal antwortet — und wer schweigen darf.

── DER GEMESSENE BEFUND ──────────────────────────────────────────────────────

Am 05.09.2026 wurden in einem Gruppengespraech zwei Figuren AUSDRUECKLICH zum
Schweigen aufgefordert. **2 von 2 haben trotzdem geantwortet.**

Das ist kein Ungehorsam des Modells, sondern eine Eigenschaft der Bauform:
``generate_group_response`` laeuft ueber ALLE Agenten in fester Reihenfolge.
Solange die Reihenfolge fest ist, ist Schweigen nicht erreichbar — es gibt
keinen Zweig, in dem eine Figur nicht drankommt. Eine Bitte kann nichts
bewirken, wo keine Entscheidung stattfindet.

Deshalb ein AUSWAHLSCHRITT und kein staerkerer Hinweis. Dieselbe Lehre wie in
Migration 374/375: was man ausrechnen kann, gehoert nicht in eine Bitte.

── DIE REGEL ─────────────────────────────────────────────────────────────────

    1. Wen der Mensch beim Namen nennt, der antwortet — immer, und zuerst.
    2. Nennt er NIEMANDEN, antworten alle. Eine kollektive Anrede
       („erzaehlt mir, was hier geschieht") gilt allen; dort zu schweigen
       waere keine Zurueckhaltung, sondern Ausfall.
    3. Wen er nicht nennt, der antwortet, wenn er einen Grund hat:
       · Anteilnahme — er hat eine ausgepraegte Meinung ueber eine der
         genannten Figuren (``agent_opinions``), oder
       · er hat lange genug geschwiegen.
    4. Es schweigen nie alle. Aus (1) folgt das von selbst, sobald ein Name
       faellt; ohne Namen greift (2).

── ⚠ WARUM SCHWEIGEN SPARSAM SEIN MUSS ───────────────────────────────────────

In der Nutzerstudie zu Mehrfigurengespraechen wurde der schweigsame Agent von
**7 von 12** Teilnehmenden als der schlechteste bewertet. Eine Figur, die
nicht antwortet, wird als kaputt gelesen, nicht als zurueckhaltend. Die
Reparatur kann also schlimmer werden als der Fehler.

``_SCHWEIGEN_MAX`` ist die Antwort darauf: nach zwei Runden Schweigen spricht
eine Figur wieder, ganz gleich was sonst gilt. Bei drei Figuren heisst das,
dass jede spaetestens in jeder dritten Runde zu Wort kommt.

── ⚠ WAS DIE DATEN HEUTE HERGEBEN, GEMESSEN ──────────────────────────────────

Der Plan schlug vor, die Redseligkeit „aus ``agent_opinions`` und der
Beziehung zum Menschen" abzuleiten. Am 05.09.2026 auf Produktion nachgemessen,
bevor eine Zeile davon gebaut wurde:

    agents.personality_profile        0 von 258 Agenten haben einen Inhalt
    agent_relationships  zwischen Gespraechsteilnehmern:   0 bis 1 Zeilen
    agent_opinions       zwischen Gespraechsteilnehmern:   vollstaendig
                                                           (6 je Dreierrunde)
    davon opinion_score = 0                                28 von 32
    davon |opinion_score| >= 20                             2 von 32
    davon interaction_count > 0                             4 von 32

Also: ``agent_opinions`` ist die einzige der drei vorgeschlagenen Quellen mit
Daten — und sie ist heute zu 87,5 % flach. Eine Auswahl, die ALLEIN darauf
stuende, liesse jede ungenannte Figur schweigen, und das ist genau der Fehler,
vor dem die Studie warnt.

Deshalb tragen beide Gruende, und **die Schweigedauer ist heute die
tragende**. Die Anteilnahme ist richtig gebaut und wirkt, sobald die Meinungen
sich fuellen; sie steht nicht da, weil sie heute etwas leistet, sondern weil
sie es kann, ohne heute zu schaden. Wer diese Zahlen nachmisst und die
Anteilnahme fuer wirkungslos haelt, hat recht — bis die Autonomie laeuft.

Eine Zahl aus einem Plan ist eine Behauptung; diese hier sind gezaehlt.

── WAS HIER NICHT STEHT ──────────────────────────────────────────────────────

Kein Netzzugriff und keine Uhr. Diese Datei rechnet, und alles, was sie
braucht, gibt der Aufrufer mit — der Vorlauf hat es ohnehin geladen. Eine
Auswahl, die selbst fragt, kostete eine Rundreise je Sprecher, und
``backend/tests/unit/test_chat_round_trips.py`` sagt genau das Gegenteil zu.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.services.chat.names import nennt

__all__ = [
    "ANTEILNAHME_SCHWELLE",
    "SCHWEIGEN_MAX",
    "Sprecherwahl",
    "schweigerunden",
    "waehle_sprecher",
]

#: Ab welcher Meinungsstaerke eine ungenannte Figur sich einmischt.
#:
#: ``agent_opinions.opinion_score`` laeuft von -100 (Feindschaft) bis +100
#: (Ergebenheit). Zwanzig ist wenig — mit Absicht: die Schwelle soll den Fall
#: „ich habe mit dieser Person etwas zu schaffen" fangen, nicht nur den
#: Extremfall. Gemessen liegt der hoechste Betrag zwischen heutigen
#: Gespraechsteilnehmern bei 24.
ANTEILNAHME_SCHWELLE = 20

#: Nach wie vielen geschwiegenen Runden eine Figur wieder spricht.
#:
#: ZWEI. Der schweigsame Agent wurde in der Studie von 7 von 12 als
#: schlechtester bewertet — eine Figur, die nicht antwortet, wird als kaputt
#: gelesen. Bei drei Figuren kommt so jede spaetestens in jeder dritten Runde
#: zu Wort.
SCHWEIGEN_MAX = 2

#: Wie viele Runden zurueck ueberhaupt gezaehlt wird.
#:
#: Der Verlauf ist gekappt; weiter zurueckzuzaehlen als er reicht, hiesse eine
#: Zahl zu bilden, die von der Kappung abhaengt und nicht vom Gespraech.
SCHWEIGEN_FENSTER = 8


@dataclass(frozen=True)
class Sprecherwahl:
    """Wer spricht, in welcher Reihenfolge, und warum wer nicht.

    ``grund`` ist nicht Zierrat. Eine Figur, die nicht antwortet, sieht fuer
    den Menschen aus wie ein Fehler; wer nachsieht, warum sie geschwiegen hat,
    hat nur diesen Eintrag. Dieselbe Begruendung wie bei ``evidence`` im
    Fokalisierungs-Befund.
    """

    reihenfolge: list[int] = field(default_factory=list)
    schweigt: list[int] = field(default_factory=list)
    grund: dict[int, str] = field(default_factory=dict)


def schweigerunden(history: list[dict], agent_ids: list[str]) -> list[int]:
    """Wie viele der letzten Runden jede Figur geschwiegen hat.

    Eine Runde beginnt mit einer Nachricht des Menschen. Gezaehlt wird nur die
    ununterbrochene Strecke am Ende: wer in der letzten Runde gesprochen hat,
    steht bei null, ganz gleich wie oft er davor geschwiegen hat.

    ⚠ Nach REIHENFOLGE geschnitten und nicht nach Zeitstempel. Ein Filter
    gegen die Datenbankuhr hat am 05.09.2026 einmal alles weggeschnitten, weil
    die Uhr auf dem Vortag stand.

    ``history`` ist die Liste, die der Vorlauf ohnehin geladen hat — diese
    Funktion fragt nichts nach.
    """
    runden: list[set[str]] = []
    for msg in history:
        rolle = msg.get("sender_role")
        if rolle == "user":
            runden.append(set())
            continue
        if rolle != "assistant":
            # Systemzeilen (Fluestern, Beitritte) eroeffnen keine Runde und
            # sind kein Zug — sie duerfen ein Schweigen weder beenden noch
            # verlaengern.
            continue
        wer = str(msg.get("agent_id") or "")
        if wer:
            if not runden:
                runden.append(set())
            runden[-1].add(wer)
    # Nur abgeschlossene Runden am Ende, und nur so viele, wie das Fenster
    # zulaesst. Die AKTUELLE Runde steht noch nicht im Verlauf — die
    # Nutzernachricht dieses Zuges wird erst danach angehaengt.
    letzte = runden[-SCHWEIGEN_FENSTER:]
    ergebnis: list[int] = []
    for agent_id in agent_ids:
        still = 0
        for runde in reversed(letzte):
            if agent_id in runde:
                break
            still += 1
        ergebnis.append(still)
    return ergebnis


def waehle_sprecher(
    *,
    agent_names: list[str],
    agent_ids: list[str],
    user_message: str,
    still_seit: list[int],
    anteilnahme: dict[str, dict[str, int]],
    aktiv: bool,
) -> Sprecherwahl:
    """Wer diese Runde antwortet.

    ``anteilnahme`` ist die Meinungsmatrix der Runde: ``{von: {ueber: wert}}``
    mit ``opinion_score``. Sie kommt aus ``agent_opinions`` und wird EINMAL im
    Vorlauf geladen, nicht je Sprecher.

    ``aktiv`` ist das Merkmalstor. Steht es aus — die Vorgabe —, sprechen alle
    in der urspruenglichen Reihenfolge, und diese Funktion ist eine teure Art,
    ``list(range(n))`` zu schreiben. Genau so soll es sein: das Tor darf nichts
    ueber die Reihenfolge aendern, sonst waere „aus" nicht mehr der Zustand von
    vorher.
    """
    n = len(agent_names)
    alle = list(range(n))
    if not aktiv or n <= 1:
        return Sprecherwahl(reihenfolge=alle)

    genannt = [i for i in alle if agent_names[i] and nennt(user_message or "", agent_names[i])]
    if not genannt:
        # Eine kollektive Anrede gilt allen. Hier zu schweigen waere kein
        # Zurueckhalten, sondern Ausfall — und ohne Namen im Text gibt es
        # ohnehin nichts, woraus sich eine Auswahl begruenden liesse.
        return Sprecherwahl(reihenfolge=alle, grund=dict.fromkeys(alle, "niemand genannt"))

    reihenfolge = list(genannt)
    schweigt: list[int] = []
    grund: dict[int, str] = dict.fromkeys(genannt, "genannt")
    genannte_ids = {agent_ids[i] for i in genannt if i < len(agent_ids)}

    for i in alle:
        if i in grund:
            continue
        eigen = agent_ids[i] if i < len(agent_ids) else ""
        meinungen = anteilnahme.get(eigen, {})
        staerkste = max((abs(meinungen.get(z, 0)) for z in genannte_ids), default=0)
        still = still_seit[i] if i < len(still_seit) else 0
        if staerkste >= ANTEILNAHME_SCHWELLE:
            reihenfolge.append(i)
            grund[i] = f"Anteilnahme {staerkste}"
        elif still >= SCHWEIGEN_MAX:
            reihenfolge.append(i)
            grund[i] = f"schweigt seit {still} Runden"
        else:
            schweigt.append(i)
            grund[i] = f"nicht genannt, Anteilnahme {staerkste}, still seit {still}"

    return Sprecherwahl(reihenfolge=reihenfolge, schweigt=schweigt, grund=grund)
