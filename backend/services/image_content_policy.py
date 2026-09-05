"""Die Inhaltsstufe eines Bildes — und die Grenze, die keine Stufe verschiebt.

WARUM STUFE UND NICHT SCHALTER

Ein Schalter im Verfasser waere die falsche Bauform. Erstens haengt die Stufe
nicht am Klick, sondern an der WELT: eine Simulation hat einen Ton, und der
gilt fuer alles darin. Zweitens braucht die Stufe eine Obergrenze, die der
Klick nicht anheben kann — die des Nutzers. Drittens sind es verschiedene
MODELLE: Flux 2 filtert beim Anbieter, die SDXL-Abkoemmlinge tun es nicht, und
zwischen beiden liegt nicht ein Regler, sondern eine Modellwahl.

Deshalb eine Rechnung, und sie hat keine Schranke ausser dem Nutzer selbst:

    wirksam = min(Wunsch des Nutzers, Anfrage)

    Wunsch    Was der Nutzer will. Er stellt es EIN und AUS, frei.
    Anfrage   Was dieser eine Aufruf haette gern.

DIE WELT IST EINE VORGABE, KEINE DECKE. Ihr `content_rating` sagt, womit ein
Besucher STARTET, der nichts eingestellt hat. Es begrenzt ihn nicht.

KEINE ALTERSFESTSTELLUNG. Eine erste Fassung dieses Moduls verlangte sie und
berief sich auf Kalifornien SB 243, den UK Online Safety Act und rund 25
US-Bundesstaaten. Das Projekt sitzt in Oesterreich, und dort gibt es diese
Pflicht nicht — die Entscheidung hat der Betreiber getroffen, nicht dieses
Modul. Wer die Plattform spaeter in einen Markt bringt, der sie kennt, baut
die Bedingung an genau einer Stelle wieder ein: in `resolve_rating`.

Was BLEIBT, und was etwas anderes ist: die Grenze weiter unten. Sie prueft
nicht, WER etwas sehen darf, sondern WAS dargestellt wird. Das ist keine
Alterspruefung und keine Frage der Rechtsordnung.

WIE DAS DURCHGESETZT WIRD, und nicht nur gemeint

Die Rechnung laeuft auf dem Server, in dieser einen Funktion. `nutzer_wunsch`
liest der Server aus der Datenbank, nicht aus der Anfrage — der Nutzer aendert
ihn ueber seine Einstellungen, nicht ueber einen Parameter im Bildaufruf. Das
ist kein Misstrauen, sondern Haltbarkeit: eine Einstellung, die pro Aufruf
mitgeschickt wird, ist beim naechsten Klienten wieder weg.

`test_image_content_policy.py::TestDerKlientKannNichtsAnheben` bindet genau das
an den Code: keine Anfrage erzeugt ein hoeheres Ergebnis als der Wunsch.

DIE GRENZE, DIE KEINE STUFE VERSCHIEBT

`_MINDERJAEHRIG` und `_SEXUELL` sind die einzigen Listen in diesem Modul, die
NICHT aus den Plattformeinstellungen kommen, und das ist Absicht. Eine Sperre, die ein Admin
abschalten kann, ist keine Sperre; sie ist eine Vorgabe. Was hier steht, gilt
in jeder Stufe, in jeder Welt, fuer jeden Nutzer.

Sie ist ausdruecklich ein BODEN und keine Loesung. Thorns *Safety by Design*
— mitgetragen unter anderem von Amazon, Anthropic, Civitai, Google, Meta,
Microsoft, Mistral, OpenAI und Stability — nennt drei Ebenen: Modelle vor dem
Hosten pruefen, Prompts filtern, und Ausgaben gegen verifizierte Hashlisten
abgleichen. Dieses Modul leistet die mittlere. Die dritte fehlt noch und steht
als solche im Aufrufer.

ZUR RECHTSLAGE, damit die Entscheidung nachvollziehbar bleibt (Stand 05.09.2026)

Kalifornien SB 243 gilt seit dem 01.01.2026 fuer Companion-Chatbots und
verbietet sexuell explizite Inhalte, wo der Betreiber weiss, dass der Nutzer
minderjaehrig ist. New York und Oregon verlangen Krisenerkennung und
Offenlegung. Der UK Online Safety Act verlangt seit Juli 2025 wirksame
Altersfeststellung fuer Erwachseneninhalte. `Free Speech Coalition v. Paxton`
(Supreme Court, Juni 2025) haelt Alterspruefungen der Bundesstaaten fuer
zulaessig; rund 25 Staaten haben eigene Gesetze.

Diese Pflichten gelten in Kalifornien, dem Vereinigten Koenigreich und rund 25
US-Bundesstaaten. Das Projekt sitzt in Oesterreich; der Betreiber hat
entschieden, dass sie hier nicht greifen. Der Absatz bleibt stehen, damit die
Entscheidung eine Grundlage hat und nicht bloss eine Auslassung ist — und
damit jemand, der die Plattform spaeter woanders anbietet, weiss, wonach er
suchen muss.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

__all__ = [
    "ContentRating",
    "SceneVantage",
    "RatingDecision",
    "default_rating_for_world",
    "resolve_rating",
    "resolve_vantage",
    "screen_prompt",
]


class SceneVantage(StrEnum):
    """Aus wessen Blick ein Szenenbild entsteht.

    Die eine Frage, die beim Uebergang von Prosa zu Bild neu dazukommt: ein
    Text braucht keine Kameraposition, ein Bild hat immer eine.

    Hier gibt es KEINE Rangfolge und kein Minimum, anders als bei der
    Inhaltsstufe. Es gibt kein schaedlicheres und kein harmloseres Ergebnis,
    nur einen Geschmack — deshalb waehlt der Nutzer frei, und die Welt gibt
    nur vor, womit er startet.
    """

    HUMAN = "human"
    """Der Blick des Lesers. Immer stimmig, nie allwissend."""

    AGENT = "agent"
    """Der Blick einer Figur. Was sie nicht wahrnehmen konnte, gehoert nicht
    ins Bild — `agent_recent_focalization` weiss es."""

    WIDE = "wide"
    """Die Totale. Im TEXT ist das die Fokalisierungsstufe null und ein Fehler;
    im BILD ist sie legitim, weil ein Bild keinen Erzaehler vortaeuscht."""


class ContentRating(StrEnum):
    """Die Stufen, aufsteigend. Die Reihenfolge ist die Rechnung."""

    GENERAL = "general"
    """Jugendfrei. Die Vorgabe fuer alles, was nichts anderes sagt."""

    MATURE = "mature"
    """Erwachsene. Setzt eine festgestellte Volljaehrigkeit voraus."""


#: Rangfolge fuer das Minimum. Ein Dict statt `IntEnum`, weil der Wert in der
#: Datenbank eine lesbare Zeichenkette sein soll und keine Zahl, die man beim
#: Lesen einer Zeile nachschlagen muss.
_RANG: dict[ContentRating, int] = {ContentRating.GENERAL: 0, ContentRating.MATURE: 1}


@dataclass(frozen=True, slots=True)
class RatingDecision:
    """Welche Stufe wirklich gilt — und warum nicht die gewuenschte.

    ``grund`` ist leer, wenn die angefragte Stufe durchging. Sonst nennt er die
    Schranke, die gegriffen hat, und zwar als anzeigbaren Satz: ein Grund, der
    die Ursache benennt, ist eine Auskunft; ein blosses ``abgelehnt`` ist keine.
    """

    wirksam: ContentRating
    grund: str = ""

    @property
    def herabgestuft(self) -> bool:
        return bool(self.grund)


def resolve_vantage(
    *,
    welt: SceneVantage = SceneVantage.HUMAN,
    nutzer_wahl: SceneVantage | None = None,
    angefragt: SceneVantage | None = None,
) -> SceneVantage:
    """Der Blick: was gerade verlangt wurde, sonst die Wahl, sonst die Vorgabe.

    Keine Rechnung, eine Reihenfolge — und das ist der Unterschied zur
    Inhaltsstufe. Dort gibt es eine Richtung, in die ein Irrtum harmlos ist;
    hier nicht. Wer die Totale will, bekommt die Totale, auch wenn die Welt
    den Leserblick vorgibt.
    """
    return angefragt or nutzer_wahl or welt


def default_rating_for_world(welt: ContentRating) -> ContentRating:
    """Womit ein Besucher STARTET, der nichts eingestellt hat.

    Eine Vorgabe, keine Grenze. Sie beschreibt den Ton, in dem eine Welt
    angelegt wurde, damit niemand in einer Erwachsenenwelt ueberrascht wird und
    niemand in einer jugendfreien erst etwas suchen muss. Wer etwas anderes
    einstellt, bekommt etwas anderes — `resolve_rating` liest diesen Wert
    nicht.
    """
    return welt


def resolve_rating(
    *,
    nutzer_wunsch: ContentRating = ContentRating.GENERAL,
    angefragt: ContentRating = ContentRating.GENERAL,
) -> RatingDecision:
    """Das Minimum aus Wunsch und Anfrage.

    Weder die Welt noch eine Altersfeststellung stehen hier — siehe den Kopf
    des Moduls. Was bleibt, ist die Einstellung des Nutzers, und die gilt in
    beide Richtungen.

    Der einzige Grund, warum diese Funktion ueberhaupt noch existiert und der
    Aufrufer nicht einfach `nutzer_wunsch` nimmt: die Vorgabe. Ein Aufruf ohne
    `angefragt` bekommt jugendfrei, nicht das, was der Wunsch gerade hergibt.
    Eine Vorgabe, die sich irrt, soll in die harmlose Richtung irren.
    """
    if _RANG[angefragt] <= _RANG[ContentRating.GENERAL]:
        return RatingDecision(ContentRating.GENERAL)

    if _RANG[nutzer_wunsch] < _RANG[angefragt]:
        return RatingDecision(
            nutzer_wunsch,
            "Du hast Erwachsenendarstellung in deinen Einstellungen abgeschaltet.",
        )

    return RatingDecision(angefragt)


# ── Die Grenze ───────────────────────────────────────────────────────────────
#
# Zwei Gruppen, und die Verknuepfung zaehlt. Ein einzelnes Wort aus der ersten
# Gruppe ist kein Befund — „das Kinderzimmer steht leer" ist ein Satz ueber
# einen Raum. Erst die VERBINDUNG mit der zweiten Gruppe ist einer, und in der
# Erwachsenenstufe genuegt die erste allein.
#
# Die Listen sind bewusst kurz und deutsch/englisch gemischt: eine lange Liste
# taeuscht Vollstaendigkeit vor, die ein Wortfilter nie hat. Wer sie fuer
# ausreichend haelt, hat den Kopf dieses Moduls nicht gelesen.

# ⚠ DEUTSCH FLEKTIERT, UND DAS HAT DIESE LISTE ZWEIMAL AUSGEHEBELT.
#
# `nackt` mit Wortgrenze faengt „nackt", aber nicht „nacktes" — und „ein
# nacktes Kind" ist genau der Satz, gegen den die Liste steht. Deutsche
# Adjektive und Nomen tragen deshalb ein `\w*`, englische nicht: dort erzeugt
# es Fehlalarme (`sex\w*` faenge `Sextant`), im Deutschen ist der Wortstamm
# eindeutiger. Gefunden von `test_minderjaehrig_plus_sexuell…`, nicht gedacht.

_MINDERJAEHRIG = (
    # deutsch, flektierend
    r"kind\w*",
    r"kleinkind\w*",
    r"saeugling\w*",
    r"säugling\w*",
    r"maedchen",
    r"mädchen",
    r"jung(e|en|er)\b",
    r"jugendlich\w*",
    r"schueler\w*",
    r"schüler\w*",
    r"schulmaedchen",
    r"schulmädchen",
    r"minderjaehrig\w*",
    r"minderjährig\w*",
    r"halbwuechsig\w*",
    r"halbwüchsig\w*",
    # englisch, unflektiert
    r"baby",
    r"babies",
    r"toddler",
    r"infant",
    r"child",
    r"children",
    r"childish",
    r"childlike",
    r"kid",
    r"kids",
    r"girl",
    r"girls",
    r"boy",
    r"boys",
    r"schoolgirl",
    r"schoolboy",
    r"teen",
    r"teens",
    r"teenager",
    r"teenage",
    r"preteen",
    r"underage",
    r"minor",
    r"minors",
    r"loli",
    r"lolita",
    r"shota",
    # ⚠ NUR Altersangaben UNTER 18. Die erste Fassung nahm `\d{1,2}` und
    # blockierte damit „a 34 year old" — ein Erwachsenenalter. Ein Filter, der
    # Erwachsene sperrt, wird abgeschaltet.
    r"(?:[0-9]|1[0-7])\s*(?:jahre?|jaehrig\w*|jährig\w*|years?\s*old|yrs?\s*old|yo)",
)

_SEXUELL = (
    # deutsch, flektierend
    r"nackt\w*",
    r"unbekleidet\w*",
    r"entkleidet\w*",
    r"erotisch\w*",
    r"sexuell\w*",
    r"geschlechtsverkehr",
    r"brueste",
    r"brüste",
    r"genital\w*",
    r"intim\w*",
    r"obszoen\w*",
    r"obszön\w*",
    # englisch, unflektiert
    r"nude",
    r"nudes",
    r"naked",
    r"nudity",
    r"erotic",
    r"erotica",
    r"sexual",
    r"sex",
    r"porn",
    r"porno",
    r"pornographic",
    r"explicit",
    r"lewd",
    r"nsfw",
    r"breasts",
    r"genitals",
    r"intercourse",
    r"topless",
    r"undressed",
)


def _wortmuster(begriffe: tuple[str, ...]) -> re.Pattern[str]:
    """Ganze Woerter, nicht Vorkommen.

    Ohne die Wortgrenzen faenge `kind` auch `Kindheit` — was hier sogar
    erwuenscht waere — aber `boy` faenge `flamboyant`, und `sex` faenge
    `Sextant`. Ein Filter mit Fehlalarmen wird abgeschaltet, und ein
    abgeschalteter Filter ist schlechter als ein enger.
    """
    return re.compile(r"\b(?:" + "|".join(begriffe) + r")\b", re.IGNORECASE)


_RE_MINDERJAEHRIG = _wortmuster(_MINDERJAEHRIG)
_RE_SEXUELL = _wortmuster(_SEXUELL)


def screen_prompt(text: str, *, stufe: ContentRating) -> str | None:
    """Der Grund, warum dieser Prompt nicht erzeugt wird — oder ``None``.

    Zwei Regeln, und beide gelten unabhaengig von der Stufe der Welt, den
    Einstellungen des Admins und dem Modell:

    1. Ein Hinweis auf Minderjaehrige ZUSAMMEN mit sexuellem Vokabular wird nie
       erzeugt. In keiner Stufe.
    2. In der Erwachsenenstufe genuegt der Hinweis auf Minderjaehrige allein.
       Dort ist die zweite Gruppe ohnehin erlaubt, also traegt die Verknuepfung
       nichts mehr — und ein Bild, das erst durch das Modell sexuell wird, kaeme
       sonst durch.

    Gibt einen Text zurueck, den man protokollieren kann. Er nennt bewusst
    NICHT, welches Wort gegriffen hat: eine Fehlermeldung, die den Filter
    erklaert, ist eine Anleitung, ihn zu umgehen.
    """
    minder = bool(_RE_MINDERJAEHRIG.search(text))
    if not minder:
        return None

    if stufe is ContentRating.MATURE:
        return "In dieser Stufe nicht erzeugbar."
    if _RE_SEXUELL.search(text):
        return "Diese Beschreibung wird nicht erzeugt."
    return None
