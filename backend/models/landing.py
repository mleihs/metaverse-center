"""DTOs für die öffentliche Frontseite — ein Aufruf statt eines Wasserfalls.

Die Frontseite braucht Zahlen, vier Welten und drei Bürger. Bisher hätte sie
dafür `/platform-stats`, `/simulations` und je Welt einen Agentenabruf
gebraucht: vier bis sieben Anfragen, bevor der erste Text steht. Der Schnappschuss
holt alles in einem Zug.

**Zweisprachigkeit wie im übrigen Werk:** die Antwort trägt `name` UND `name_de`,
`description` UND `description_de`; die Auswahl trifft der Client an seiner
aktiven Sprache. Das ist die Konvention von `SimulationResponse` und erspart dem
Endpunkt einen `locale`-Parameter. Gemessen am 31.08.2026: 5 von 16 lebenden
Welten haben einen deutschen Titel, 7 von 16 einen deutschen Text — das Raster
ist auf Deutsch also stellenweise englisch, und das ist eine Bestandslücke, die
kein Endpunkt zudecken darf.

**Jede Zahl ist gemessen, keine ist gesetzt.** Der Entwurf der Frontseite trug
`47 worlds`, `3 epochs in play` und `128 resonances absorbed` als Attrappen;
gemessen sind es 16, 0 und 1. Eine Kennzahl, die aus einer Konstante kommt, ist
irgendwann falsch — hier kommt jede aus der Datenbank.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LandingCounts(BaseModel):
    """Was die Plattform gerade wirklich trägt (Prod-Messung 31.08.2026 in Klammern).

    Die Felder mit dem Wert 0 werden nicht verschwiegen — sie stehen hier, damit
    der Client entscheiden kann, sie NICHT zu drucken. „0 Epochen im Spiel" ist
    schlechter als gar nichts, aber die Null gehört trotzdem gemessen und
    übertragen; nur so kann eine Anzeige sie auslassen, statt sie zu erfinden.
    """

    #: Lebende Welten: `simulation_type='template' AND status='active'` (16).
    #: Epochen-Klone und gelöschte Welten gehören ausdrücklich nicht dazu.
    worlds_live: int = 0

    #: Davon die, deren letzter Herzschlag frisch ist (16). Der Entwurf wirbt mit
    #: „worlds transmitting" — das ist eine Aussage über Betrieb, nicht über
    #: Bestand, und sie muss getrennt gemessen werden.
    worlds_transmitting: int = 0

    #: Epochen, die laufen UND sich bewegt haben (0). Der reine Statusfilter
    #: zählte 7 — alle sieben stehen seit Februar/März still.
    epochs_in_play: int = 0

    #: Aufgenommene Resonanzen (1).
    resonances: int = 0

    #: Bürger in lebenden Welten (108).
    citizens: int = 0

    #: Bauten in lebenden Welten (124).
    buildings: int = 0

    #: Erinnerungen der Bürger lebender Welten (304).
    memories: int = 0

    #: Ereignisse in lebenden Welten (109).
    events: int = 0

    #: Zonen in lebenden Welten (70).
    zones: int = 0


class LandingWorld(BaseModel):
    """Eine Welt fürs Raster „Läuft bereits".

    Nicht fest verdrahtet: die Auswahl kommt aus den lebenden Welten nach einer
    nachvollziehbaren Regel, damit die Seite nie eine Welt zeigt, die es nicht
    mehr gibt. Der Entwurf nannte Saltmeridian und The Gilded Hollow — beide
    existieren nicht, und beide standen als kriechbarer Link in der SEO-Fußzeile.
    """

    slug: str
    name: str
    name_de: str | None = None
    description: str | None = None
    description_de: str | None = None
    banner_url: str | None = None
    theme: str | None = None
    agent_count: int = 0

    #: Ob der letzte Herzschlag frisch ist. Der Entwurf setzt neben jede Karte
    #: eine Betriebsanzeige; ohne dieses Feld wäre sie geraten.
    transmitting: bool = False


class LandingCitizen(BaseModel):
    """Ein Bürger für die Dossierkarten.

    Der Entwurf verlangt drei echte Agenten mit Porträt. Gemessen: 108 von 108
    Agenten lebender Welten haben ein `portrait_image_url`, die Auswahl kann
    also streng sein.
    """

    slug: str
    name: str
    profession: str | None = None
    profession_de: str | None = None
    character: str | None = None
    character_de: str | None = None
    portrait_image_url: str | None = None

    #: Zone, in der der Bürger gerade steht. Die Dossierkarte trägt die Zeile
    #: „Beruf · Zone"; fehlt die Zone, bleibt nur der Beruf stehen.
    zone_name: str | None = None

    #: Welt, in der der Bürger lebt — die Karte verlinkt dorthin.
    simulation_id: str | None = None
    """Die Welt dieses Bürgers — der Schlüssel, über den der Fächer zum
    durchlaufenden Ausgangssatz passt (Migration 328)."""
    simulation_slug: str
    simulation_name: str


class LandingPrompt(BaseModel):
    """Ein Satz, der eine Welt gemacht hat — zweisprachig wie alles hier.

    Der Schmiede-Abschnitt tippt Beispielsätze. Bis zum 31.08.2026 standen
    zwanzig davon fest im Bauteil; sie waren gut geschrieben und trotzdem
    erfunden. Auf Prod liegen **26 echte Ausgangssätze** in
    ``forge_drafts.seed_prompt``, davon 16 aus abgeschlossenen Läufen — die
    tatsächlichen Sätze, aus denen die tatsächlichen Welten wurden.

    Ein Ausgangssatz ist von einem Menschen geschrieben, und die Frontseite ist
    öffentlich — ihn dort zu zeigen ist eine Veröffentlichung fremden Textes.
    Der Nutzer hat sie am 31.08.2026 freigegeben. Gelesen wird über die Sicht
    ``public_forge_prompts`` (Migration 314), die GENAU EINE Spalte herausgibt:
    ``forge_drafts`` selbst trägt ``user_id``, alle Zwischenstände und das
    Fehlerprotokoll, und wer eine Zeile davon hat, hat jede Spalte darin.

    Ist die Liste leer (Abfrage ausgefallen, kein passender Satz), tippt der
    Abschnitt seine Beispiele und nennt sie so.

    ``text_de`` bleibt leer: ein Ausgangssatz wurde in einer Sprache
    geschrieben und bleibt darin. Eine maschinelle Übersetzung eines fremden
    Satzes wäre eine Fälschung; ``t(prompt, 'text')`` fällt richtigerweise auf
    ``text`` zurück.

    Der Client wählt über ``t(prompt, 'text')`` — deshalb ``text``/``text_de``
    und kein locale-Parameter.
    """

    text: str
    text_de: str | None = None
    simulation_id: str | None = None
    """Die Welt, die aus diesem Satz wurde — oder None.

    Erst seit Migration 328 gibt es diese Verbindung überhaupt; davor war der
    Weg vom Entwurf zur Welt in keiner Richtung gespeichert. Für den Bestand
    ist sie über die Agentennamen rekonstruiert (13 von 16 eindeutig), für neue
    Läufe schreibt sie ``fn_materialize_shard`` mit.

    ``None`` heißt „unbekannt" und nicht „keine": die Frontseite zeigt dann
    keinen Zusammenhang statt einen falschen."""


class LandingSnapshotResponse(BaseModel):
    """Alles, was die Frontseite braucht, in einem Aufruf."""

    counts: LandingCounts
    worlds: list[LandingWorld] = Field(default_factory=list)
    citizens: list[LandingCitizen] = Field(default_factory=list)
    #: Echte Ausgangssätze für den Schmiede-Abschnitt, aus ``public_forge_prompts``.
    forge_prompts: list[LandingPrompt] = Field(default_factory=list)

    #: Wann gemessen wurde. Steht in der Antwort, weil eine Kennzahl ohne
    #: Zeitpunkt nicht prüfbar ist — und weil der Zwischenspeicher davorsitzt.
    measured_at: datetime
