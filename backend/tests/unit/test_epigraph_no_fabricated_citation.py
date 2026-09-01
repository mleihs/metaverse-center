"""Die Welt darf sich selbst zitieren. Sie darf keinem echten Menschen Worte in den Mund legen.

WAS AUF PRODUKTION STAND (gemessen 01.09.2026, 99 Epigraphe in lebenden Welten)

    46 Epigraphe schreiben sich einer ECHTEN Person zu.

An Quellen geprueft, drei davon nachweislich falsch:

  * „I am a cage, in search of a bird." -- Franz Kafka, The Zuerau Aphorisms
    Kafkas Aphorismus 16 lautet „Ein Kaefig ging einen Vogel suchen"
    (A cage went in search of a bird). Die Fassung im Spiel dreht den Sinn um:
    bei Kafka handelt der Kaefig, hier gesteht ein Ich.

  * „The bureaucracy is expanding to meet the needs of the expanding
    bureaucracy." -- Oscar Wilde
    Keine Werkstelle. Die Zuschreibung existiert nur auf Zitate-Aggregatoren.

  * „Every language is a world." -- Ludwig Wittgenstein,
    Philosophical Investigations, Paragraph 19
    Nicht von Wittgenstein. Paragraph 19 existiert und sagt etwas anderes
    („to imagine a language means to imagine a form of life"). Das ist die
    gefaehrlichste Form: eine Erfindung mit korrekt aussehender Fundstelle ist
    glaubwuerdiger als das Echte.

DIE URSACHE STAND IM PROMPT

`forge_lore_service` bat das Modell woertlich um „real literary quotes", und das
Feld `epigraph` trug ueberhaupt keine Beschreibung. Ein Sprachmodell kann ein
echtes Zitat nicht von einem erfundenen unterscheiden -- es erzeugt
zitatfoermigen Text und haengt einen beruehmten Namen darunter, weil das die
haeufigste Form in seinem Training ist. Der Uebersetzungs-Prompt verschlimmerte
es: er suchte „die etablierte deutsche Uebersetzung" eines Zitats, das es
womoeglich nicht gibt -- und ein Modell findet dann eine.

WAS DIESER TEST HAELT

Echtheit ist mechanisch nicht pruefbar. Die gefaehrlichste FORM schon: eine
Zuschreibung mit Jahreszahl in Klammern oder Paragraphenzeichen behauptet eine
reale, nachschlagbare Fundstelle.

Der Pruefer ist bewusst ENG. Ein breiter Pruefer haette hier einen hohen Preis:
er laesst die ganze Lore-Erzeugung scheitern, statt eine Zeile zu verbessern --
dieselbe Abwaegung, die `counted_list` im selben Modul dokumentiert (eine exakte
Laengenforderung hob die Lieferquote nicht, sie schuf nur einen Weg, die Antwort
ganz zu verlieren).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.models.forge import ForgeLoreSection

BASE = {"chapter": "I", "arcanum": "ALPHA", "title": "Ein Titel", "body": "Prosa."}


def _section(epigraph: str) -> ForgeLoreSection:
    return ForgeLoreSection(**BASE, epigraph=epigraph)


@pytest.mark.parametrize(
    "epigraph",
    [
        "",
        "Das Meer weiss nicht, dass es unter der Erde liegt.",
        '"Der Nebel haelt, was die Karte verspricht." - Bureau-Feldbericht, Fragment 42',
        '"Wir zaehlen, was bleibt." - Wiedergefundenes Logbuch, Band 7',
        '"Die Tuer war schon offen." - Maren Lund, Formgard Oral Histories, Tape 7',
        "Inschrift ueber dem Tor: WER MISST, WIRD GEMESSEN",
    ],
    ids=["leer", "ohne Zuschreibung", "Bureau", "Logbuch", "weltinterne Figur", "Inschrift"],
)
def test_in_world_epigraphs_pass(epigraph: str) -> None:
    """Weltinterne Belege sind der ganze Zweck des Feldes und duerfen nicht stoeren."""
    assert _section(epigraph).epigraph == epigraph


@pytest.mark.parametrize(
    "epigraph",
    [
        '"Every language is a world." - Ludwig Wittgenstein, Philosophical Investigations (1953)',
        '"The body is not a thing, it is a situation." - Simone de Beauvoir, The Second Sex (1949)',
        '"Ein Satz." - Michel Foucault, Discipline and Punish (1975)',
        '"Ein Satz." - Ludwig Wittgenstein, Philosophische Untersuchungen §19',
    ],
    ids=["Jahr in Klammern", "echtes Zitat, gleiche Form", "Foucault", "Paragraphenzeichen"],
)
def test_scholarly_citations_are_refused(epigraph: str) -> None:
    """Auch ein ECHTES Zitat wird in dieser Form abgewiesen -- und das ist Absicht.

    Der Pruefer kann echt und erfunden nicht unterscheiden; niemand kann das zur
    Erzeugungszeit. Er weist deshalb die BEHAUPTUNG einer realen Fundstelle ab,
    nicht ihre Falschheit. Wer ein echtes Zitat zeigen will, tut es an einer
    Stelle, an der ein Mensch es geprueft hat -- nicht in generiertem Text.
    """
    with pytest.raises(ValidationError) as err:
        _section(epigraph)
    assert "in-world" in str(err.value)


def test_the_field_tells_the_model_what_an_epigraph_is() -> None:
    """Das Feld hatte gar keine Beschreibung -- das war die eigentliche Ursache.

    Ohne Beschreibung waehlt das Modell die haeufigste Form aus seinem Training,
    und die ist „Zitat plus beruehmter Name". Ein Pruefer allein wuerde das nur
    abweisen; die Beschreibung sagt, was STATTDESSEN zu schreiben ist.
    """
    description = ForgeLoreSection.model_fields["epigraph"].description
    assert description, "epigraph ohne Beschreibung -- das Modell erfaehrt nichts"
    assert "NEVER" in description
    assert "in-world" in description.lower() or "THIS WORLD" in description
