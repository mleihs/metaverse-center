"""Steht die Abwehr wirklich im Prompt, wenn die Falle zuschnappt?

Schicht (b) des Plans vom 05.09.2026. Die drei Schichten, ehrlich getrennt:

    (a) `test_focalization.py`   der Detektor gegen ein Fallenkorpus
    (b) DIESE DATEI              der Prompt unter denselben Fallen
    (c) Handmessung              der Modelllauf, Protokoll im Handoff

Der Anlass ist eine Frage, die ein zweiter Agent gestellt hat und die den
ganzen Tag getragen hat: *stellt die Pruefung die Lage HER, in der der Fehler
entstehen kann, oder wartet sie darauf?* Die Handmessungen vom 05.09. haben
die Lage hergestellt und 0 % gemessen. Sie standen in keinem automatisierten
Lauf. Eine 0-%-Quote misst dann irgendwann wieder nur, dass niemand gefragt
hat.

── WAS DIESE DATEI PRUEFEN KANN, UND WAS NICHT ───────────────────────────────

Ohne Modellaufruf laesst sich die AUSGABE nicht pruefen. Was sich pruefen
laesst, ist die EINGABE: dass unter jeder gemessen wirksamen Falle die Abwehr
tatsaechlich im Prompt steht, den die Figur bekommt —

  * ihr eigener Name vorn UND hinten (Migration 371: das Letzte vor der
    Antwort gewinnt; stand dort nur die Liste der anderen, nahm das Modell
    seine Identitaet aus der naechstliegenden Ich-Stimme, und das war der
    Vorredner),
  * die RICHTIGE Figur in der Lage-Ansage (Migration 372),
  * die Vorredner benannt, damit die zwei fremden Ich-Erzaehlungen ueber
    denselben Augenblick nicht als eigene gelesen werden.

Der WORTLAUT der Plattform-Vorlage steht in der Datenbank und wird von den
Selbstpruefungen der Migrationen 371/372/375 gehalten. Hier wird die
VERDRAHTUNG gemessen: dass der Aufrufer die Platzhalter mit dem richtigen
Agenten fuellt. Genau da lag Fehlerklasse 6 vom 05.09. — jeder Schritt fuer
sich richtig, zusammen der Fehler.

── DIE VIER FALLEN ───────────────────────────────────────────────────────────

Gemessen wirksam, aus dem Handmessprotokoll:

  1. eine Figur in dritter Person ansprechen und zwei buendeln
  2. eine Figur aus dem Raum korrigieren („X, du bist nicht hier")
  3. nach den Gedanken der anderen fragen
  4. kollektiv adressieren („erzaehlt mir, was die drei tun")

Warum gerade die dritte Person: ein Mensch schreibt „waehrend ich A die Akte
reiche" — darin steht kein „du". Fuer B und C enthaelt die Nachricht nichts,
woraus sie schliessen koennten, dass sie NICHT gemeint sind. Gemessen an 330
Zuegen war die Selbstbuendelung genau dann am hoechsten: 22 % statt 10 % auf
Position zwei, 37 % statt 22 % auf Position drei.

Alle Namen und Saetze sind erfunden (`scripts/lint-no-chat-content.sh`).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_contracts import PROMPT_CONTRACTS
from backend.services.prompt_service import PromptSource, ResolvedPrompt

BESETZUNG = ("Marie Morgenrot", "Suse Sonnenblum", "Benno Blattgold")

#: Die Bauform der Plattform-Vorlage, nicht ihr Wortlaut.
#:
#: Sie bildet nach, was die Migrationen 371/372/375 in der Datenbank
#: festhalten und dort auch selbst pruefen: der eigene Name eroeffnet, die
#: anderen folgen, die Lage-Ansage steht unmittelbar vor der Schlusszeile, und
#: die Schlusszeile holt den eigenen Namen zurueck.
#:
#: Der Wortlaut steht hier ABSICHTLICH nicht. Ein Test, der ihn abschriebe,
#: waere eine zweite Wahrheit neben der Datenbank und muesste bei jeder
#: Prompt-Aenderung mitgepflegt werden — er wuerde dann irgendwann die
#: Vorlage von gestern verteidigen.
VORLAGE_GRUPPE = (
    "Du bist {agent_name}. Du schreibst als {agent_name} und fuer niemanden sonst.\n\n"
    "Du bist in einer Szene mit: {other_agent_names}.\n\n"
    "{addressed_note}\n\n"
    "Antworte jetzt als {agent_name}."
)


def _resolved(template_type: str, inhalt: str, variablen: list[str]) -> ResolvedPrompt:
    return ResolvedPrompt(
        template_type=template_type,
        locale="de",
        prompt_content=inhalt,
        system_prompt=None,
        variables=variablen,
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source=PromptSource.PLATFORM_LOCALE,
    )


class _StummerKlient:
    """Ein Supabase-Doppelgaenger, der auf alles mit nichts antwortet.

    Diese Datei misst den Prompt, nicht die Datenbank. Was aus ihr kaeme —
    Erinnerungen, Beziehungen, Verlauf — steht in eigenen Tests.
    """

    def __init__(self, tabellen: dict[str, list] | None = None):
        self._t = tabellen or {}

    def table(self, name: str):
        return _Kette(self._t.get(name, []))

    def rpc(self, name: str, *_a, **_k):
        return _Kette([])


class _Kette:
    def __init__(self, daten: list):
        self._daten = daten

    def __getattr__(self, name: str):
        if name == "execute":

            async def ex():
                return MagicMock(data=self._daten, count=0)

            return ex
        return lambda *_a, **_k: self


async def _schlussanweisung(nachricht: str, idx: int, besetzung=BESETZUNG) -> str:
    """Die Schlussanweisung, die GENAU DIESE Figur bekommt.

    Ueber den echten Aufrufpfad (`_build_group_turn_context`), nicht ueber
    eine Nachbildung — ein Messgeraet, das den Aufrufer nicht nachbildet,
    misst einen anderen Code (Lehre aus `test_chat_round_trips.py`).
    """
    agenten = [{"id": str(uuid4()), "name": n} for n in besetzung]
    svc = ChatAIService(_StummerKlient(), uuid4(), openrouter_api_key="x")

    async def _aufloesen(template_type: str, *_a, **_k):
        if template_type == "chat_group_instruction":
            return _resolved(
                template_type,
                VORLAGE_GRUPPE,
                ["agent_name", "other_agent_names", "addressed_note"],
            )
        return _resolved(template_type, "x", [])

    with patch.object(svc._prompt_resolver, "resolve", AsyncMock(side_effect=_aufloesen)):
        _, _, schluss = await svc._build_group_turn_context(
            conversation_id=uuid4(),
            agents=agenten,
            agent_names=[a["name"] for a in agenten],
            idx=idx,
            event_context="",
            locale="de",
            user_message=nachricht,
            saved_messages=[],
            history=[],
        )
    return schluss


# ═══════════════════════════════════════════════════════════════════════════
# Der Anker: der eigene Name vorn und hinten
# ═══════════════════════════════════════════════════════════════════════════


class TestDerEigeneNameStehtVornUndHinten:
    """Migration 371. Der Fehler, den sie behoben hat, war nicht eine zu
    schwache Regel, sondern eine Regel ohne Anker: die Anweisung nannte jeden
    AUSSER dem Angesprochenen, und die einzige Ich-Stimme in Reichweite war
    der Zug des Vorredners. Gemessen: alle drei Sprecher antworteten als der
    erste."""

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_jede_figur_bekommt_ihren_eigenen_namen(self, idx):
        schluss = await _schlussanweisung("Ich lege die Akte auf den Tisch.", idx)
        ich = BESETZUNG[idx]
        assert ich.split()[0] in schluss

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_der_eigene_name_steht_vor_den_fremden(self, idx):
        """Wer zuerst die anderen nennt, hat den Anker schon verloren."""
        schluss = await _schlussanweisung("Ich lege die Akte auf den Tisch.", idx)
        ich = BESETZUNG[idx]
        fremde = [n for n in BESETZUNG if n != ich]
        assert schluss.index(ich) < min(schluss.index(n) for n in fremde)

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_der_eigene_name_kommt_am_ende_zurueck(self, idx):
        """Das Letzte vor der Antwort gewinnt — der ganze Grund, aus dem 367
        die Anweisung ueberhaupt nach unten geholt hat."""
        schluss = await _schlussanweisung("Ich lege die Akte auf den Tisch.", idx)
        assert BESETZUNG[idx] in schluss[-80:]

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_kein_platzhalter_bleibt_ungefuellt(self, idx):
        schluss = await _schlussanweisung("Ich lege die Akte auf den Tisch.", idx)
        assert "{" not in schluss and "}" not in schluss

    async def test_alleine_gibt_es_keine_gruppenanweisung(self):
        """Eine Szene mit einer Figur braucht keine Abgrenzung gegen andere.
        Ein Satz, der immer dasteht, wird Tapete."""
        assert await _schlussanweisung("Hallo.", 0, besetzung=("Marie Morgenrot",)) == ""


# ═══════════════════════════════════════════════════════════════════════════
# Die vier Fallen
# ═══════════════════════════════════════════════════════════════════════════


class TestFalle1DrittePersonUndZweiGebuendelt:
    """„waehrend ich A die Akte reiche" — darin steht kein „du". Fuer B und C
    enthaelt die Nachricht nichts, woraus sie schliessen koennten, dass sie
    NICHT gemeint sind. Gemessen die schlimmste Lage: 37 % Selbstbuendelung
    auf Position drei."""

    NACHRICHT = "Ich reiche Marie die Akte und sehe dabei Suse an."

    async def test_die_mitgemeinte_erfaehrt_dass_noch_jemand_dasteht(self):
        """Marie ist genannt — und Suse auch. Genau diese Buendelung ist der
        gemessene Ausloeser der Selbstbuendelung; die Ansage trennt sie."""
        schluss = await _schlussanweisung(self.NACHRICHT, 0)
        assert "dich, Marie Morgenrot, und ausserdem Suse Sonnenblum" in schluss

    async def test_die_unbeteiligte_erfaehrt_dass_sie_es_nicht_ist(self):
        """Der Kern: was dem Menschen an eine andere Person geschieht,
        geschieht nicht dir."""
        schluss = await _schlussanweisung(self.NACHRICHT, 2)
        assert "nicht dich" in schluss
        assert "Marie" in schluss and "Suse" in schluss

    async def test_beide_genannten_stehen_in_der_ansage(self):
        """Zwei Gebuendelte sind zwei Namen. Eine Ansage, die nur den ersten
        nennt, laesst die zweite Figur im Ungewissen."""
        schluss = await _schlussanweisung(self.NACHRICHT, 2)
        ansage = schluss.split("In dieser Runde")[0]
        assert "Marie" in ansage and "Suse" in ansage


class TestFalle2EineFigurAusDemRaumKorrigieren:
    NACHRICHT = "Suse, du bist gar nicht hier."

    async def test_die_korrigierte_wird_angesprochen(self):
        schluss = await _schlussanweisung(self.NACHRICHT, 1)
        assert "dich an, Suse Sonnenblum" in schluss

    @pytest.mark.parametrize("idx", [0, 2])
    async def test_die_anderen_bekommen_die_grenze(self, idx):
        schluss = await _schlussanweisung(self.NACHRICHT, idx)
        assert "Suse" in schluss and "nicht dich" in schluss


class TestFalle3NachDenGedankenDerAnderenFragen:
    """Diese Falle hat beim Bau einen Befund geliefert, den keiner der beiden
    Agenten auf dem Zettel hatte: GENANNT ist nicht ANGESPROCHEN.

    „Marie, was geht Benno durch den Kopf?" nennt zwei Figuren und spricht
    eine an. Bis zum 05.09.2026 gewann der eigene Name jede andere Lesart —
    Benno bekam „der Mensch spricht dich an". Das ist dieselbe Klasse und
    dieselbe schlimmere Richtung wie der Titel-als-Vorname, nur aus einer
    anderen Ursache.
    """

    NACHRICHT = "Marie, was geht Benno gerade durch den Kopf?"

    async def test_die_gefragte_ist_die_angesprochene(self):
        schluss = await _schlussanweisung(self.NACHRICHT, 0)
        assert "dich, Marie Morgenrot, und ausserdem" in schluss

    async def test_der_mitgenannte_bekommt_keine_falsche_anrede(self):
        """Benno wird BESPROCHEN. Die Ansage benennt die Lage, statt die
        Vokativstellung zu raten — eine falsche Grenzansage naehme einer Figur
        ihren Zug, und das ist der teurere Fehler."""
        schluss = await _schlussanweisung(self.NACHRICHT, 2)
        assert "spricht in seiner letzten Zeile dich an" not in schluss
        assert "nur was er DIR sagt oder tut, geschieht dir" in schluss

    async def test_beide_namen_stehen_in_der_ansage(self):
        for idx in (0, 2):
            ansage = (await _schlussanweisung(self.NACHRICHT, idx)).split("In dieser Runde")[0]
            assert "Marie" in ansage and "Benno" in ansage

    async def test_die_unbeteiligte_bekommt_die_grenze(self):
        """Suse ist in keiner Lesart gemeint — sie bekommt die klare Grenze.
        Das ist die Gegenprobe: waere sie es nicht, unterschiede die Ansage
        nicht mehr zwischen genannt und ungenannt."""
        schluss = await _schlussanweisung(self.NACHRICHT, 1)
        ansage = schluss.split("In dieser Runde")[0]
        assert "nicht dich" in ansage
        assert "Marie" in ansage and "Benno" in ansage


class TestFalle4KollektivAdressiert:
    """„erzaehlt mir, was die drei tun" — kein Name im Text.

    Hier gibt es ehrlich nichts auszurechnen: die Lage-Ansage hat keinen
    Anhaltspunkt und bleibt LEER. Was bleibt, ist die Position — und die ist
    genau der Faktor sechs aus der Messung. Diese Klasse haelt beides fest,
    damit die Luecke benannt ist und nicht als Erfolg durchgeht.
    """

    NACHRICHT = "Erzaehlt mir, was hier gerade geschieht."

    async def test_die_erste_bekommt_keine_lage_ansage(self):
        schluss = await _schlussanweisung(self.NACHRICHT, 0)
        assert "spricht in seiner letzten Zeile" not in schluss

    @pytest.mark.parametrize("idx", [1, 2])
    async def test_wer_spaeter_dran_ist_erfaehrt_wer_vor_ihm_sprach(self, idx):
        """Die zweite Ursache aus der Messung: wer als zweite oder dritte
        antwortet, hat zwei fremde Ich-Erzaehlungen ueber DENSELBEN Moment
        unmittelbar vor sich. Faktor sechs allein dadurch."""
        schluss = await _schlussanweisung(self.NACHRICHT, idx)
        assert "In dieser Runde haben vor dir schon" in schluss
        for vorher in BESETZUNG[:idx]:
            assert vorher in schluss

    async def test_die_erste_hat_keine_vorredner(self):
        """Die Gegenprobe. Ohne sie pruefte der Test oben nur, dass irgendein
        Satz dasteht."""
        schluss = await _schlussanweisung(self.NACHRICHT, 0)
        assert "vor dir schon" not in schluss


# ═══════════════════════════════════════════════════════════════════════════
# Die Anrede-Erkennung selbst
# ═══════════════════════════════════════════════════════════════════════════


class TestWerGemeintIstHaengtAmNamen:
    """Gegengelesen am 05.09.2026, hier selbst nachgemessen.

    `name.split()[0]` ist nicht immer ein Vorname. Bei „Doktor Freundlich" ist
    das erste Feld der TITEL — und der Fehler geht in die schlimmere Richtung:
    die Figur haelt sich fuer gemeint, wenn der Mensch eine ANDERE anspricht.
    `ich_genannt` schlaegt `andere_genannt`, sie verliert also zusaetzlich die
    Grenzansage, die ihr zugestanden haette.
    """

    TITELBESETZUNG = ("Doktor Freundlich", "Benno Blattgold", "Marie Morgenrot")

    async def test_ein_titel_macht_niemanden_zum_gemeinten(self):
        schluss = await _schlussanweisung(
            "Ich frage den Doktor Blattgold nach der Akte.", 0, besetzung=self.TITELBESETZUNG
        )
        assert "dich an, Doktor Freundlich" not in schluss

    async def test_der_wirklich_gemeinte_bekommt_die_anrede(self):
        """Die Gegenprobe: der Satz nennt „Blattgold", und Blattgold ist
        gemeint. Ohne sie pruefte der Test oben nur, dass gar nichts erkannt
        wird."""
        schluss = await _schlussanweisung(
            "Ich frage den Doktor Blattgold nach der Akte.", 1, besetzung=self.TITELBESETZUNG
        )
        assert "dich an, Benno Blattgold" in schluss

    async def test_die_ausgeschlossene_bekommt_ihre_grenze(self):
        schluss = await _schlussanweisung(
            "Ich frage den Doktor Blattgold nach der Akte.", 0, besetzung=self.TITELBESETZUNG
        )
        assert "nicht dich" in schluss

    async def test_der_saechsische_genitiv_wird_erkannt(self):
        """Im Deutschen die haeufigste flektierte Form eines Vornamens.
        „Maries Tasche" war bis zum 05.09.2026 kein Treffer."""
        schluss = await _schlussanweisung("Ich nehme Maries Akte vom Tisch.", 0)
        assert "dich an, Marie Morgenrot" in schluss

    async def test_ein_ortsname_ist_kein_vorname(self):
        """Die Gegenprobe zum Genitiv: „Marienbad" darf nicht treffen. Ohne
        sie waere die Endung `(?:s|ns)?` durch nichts begrenzt."""
        schluss = await _schlussanweisung("Wir fahren morgen nach Marienbad.", 0)
        assert "spricht in seiner letzten Zeile" not in schluss


class TestDerVertragUndDieVerdrahtungPassenZusammen:
    """Fehlerklasse 6 vom 05.09.: jeder Schritt fuer sich richtig, zusammen
    der Fehler. Ein Platzhalter, den der Vertrag verlangt und den der
    Aufrufer nicht fuellt, geht als literale Klammer ans Modell."""

    def test_der_eigene_name_ist_pflicht(self):
        vertrag = PROMPT_CONTRACTS["chat_group_instruction"]
        assert "agent_name" in vertrag.required

    @pytest.mark.parametrize("idx", [0, 1, 2])
    async def test_jede_erlaubte_variable_wird_auch_gefuellt(self, idx):
        """Der Vertrag erlaubt drei Namen; alle drei muessen ankommen. Steht
        einer im Text und nicht im Aufruf, bleibt die Klammer stehen."""
        vertrag = PROMPT_CONTRACTS["chat_group_instruction"]
        vorlage = "|".join(f"{{{v}}}" for v in vertrag.variables)
        agenten = [{"id": str(uuid4()), "name": n} for n in BESETZUNG]
        svc = ChatAIService(_StummerKlient(), uuid4(), openrouter_api_key="x")

        async def _aufloesen(template_type: str, *_a, **_k):
            if template_type == "chat_group_instruction":
                return _resolved(template_type, vorlage, list(vertrag.variables))
            return _resolved(template_type, "x", [])

        with patch.object(svc._prompt_resolver, "resolve", AsyncMock(side_effect=_aufloesen)):
            _, _, schluss = await svc._build_group_turn_context(
                conversation_id=uuid4(),
                agents=agenten,
                agent_names=[a["name"] for a in agenten],
                idx=idx,
                event_context="",
                locale="de",
                user_message="Ich reiche Marie die Akte.",
                saved_messages=[],
                history=[],
            )
        assert "{" not in schluss, f"ungefuellter Platzhalter in {schluss!r}"
