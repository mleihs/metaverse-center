"""Patch missing partial_narrative_en/de (and a handful of missing fail
narratives in Shadow) into the dungeon content YAML packs.

Written 2026-04-22 to clear the 72 startup warnings at boot
(dungeon_content_service.py:174). Each text was composed by hand in the
archetype's literary register; see docs/concepts/dungeon-literary-
additions.md and the per-archetype research docs under docs/research/.

Text-based patcher (not YAML serializer) so we preserve the existing
formatting, line-wrapping, and comments of the hand-maintained YAML
packs. Each entry is scoped by its ``- id: <choice_id>`` anchor so the
``partial_narrative_en: ''`` / ``partial_narrative_de: ''`` placeholder
pair is replaced exactly once per choice.
"""

from __future__ import annotations

import re
from pathlib import Path

PACK_ROOT = Path(__file__).resolve().parent.parent / "content" / "dungeon" / "archetypes"

# Each value is (partial_en, partial_de). Authored for literary weight
# matching the archetype's voice; see docs/concepts/dungeon-literary-
# additions.md §5 for the archetype register map.
PARTIALS: dict[tuple[str, str], tuple[str, str]] = {
    # ── The Devouring Mother ── Mann's erlebte Rede. The Mother iterates.
    ("mother", "gifts_destroy"): (
        "The organ cracks. Some of the gifts wilt, others hold. Bioluminescent fluid beads at the fissure, then stops – the wound seals itself halfway, as if deciding. The room's temperature dips for a moment, then stabilizes. {agent} has hurt her, not silenced her. The walls recalibrate around the damage.",
        "Das Organ reißt an. Einige Geschenke welken, andere halten. Biolumineszente Flüssigkeit perlt an der Spalte, dann stoppt es – die Wunde versiegelt sich halb, wie in einer Entscheidung. Die Raumtemperatur sinkt einen Moment, stabilisiert sich. {agent} hat sie verletzt, nicht zum Schweigen gebracht. Die Wände kalibrieren sich um den Schaden herum neu.",
    ),
    ("mother", "gifts_selective"): (
        "The Guardian severs carefully. Half the gifts come free clean; the others trail filaments that continue growing, searching. The surgery is incomplete – not out of carelessness, but because the tissue is smarter than the blade. The loot is useful. It is also, quietly, still connected to something that remembers its own.",
        "Der Wächter trennt sorgfältig. Die Hälfte der Geschenke löst sich sauber; die anderen ziehen Filamente hinter sich her, die weiterwachsen, suchen. Die Operation bleibt unvollständig – nicht aus Nachlässigkeit, sondern weil das Gewebe klüger ist als die Klinge. Die Beute ist nützlich. Sie ist auch, still, noch immer verbunden mit etwas, das sich erinnert, was ihr gehört.",
    ),
    ("mother", "seed_destroy"): (
        "The seed cracks, but does not break. Warmth leaks from the fissure, then pools and holds, viscous, unwilling to spill completely. {agent} has damaged a masterwork, not destroyed it. The Mother does not mourn. The Mother takes notes. A seed half-broken is also a seed that has learned where its weakness lives.",
        "Der Samen bekommt einen Riss, bricht aber nicht. Wärme sickert aus der Spalte, sammelt sich und hält, zäh, unwillig, sich ganz zu ergießen. {agent} hat ein Meisterwerk beschädigt, nicht zerstört. Die Mutter trauert nicht. Die Mutter macht Notizen. Ein halb gebrochener Samen ist auch ein Samen, der gelernt hat, wo seine Schwäche wohnt.",
    ),
    ("mother", "seed_study"): (
        "{agent} resolves part of the architecture. Stem-cell clusters, yes. Tissue-completion logic, yes. But the question – why it fills gaps the host did not know existed – remains a surface beneath surface. The analysis captures function, not appetite. The seed has been studied. It has also, in the course of being studied, noted who was looking.",
        "{agent} löst einen Teil der Architektur auf. Stammzellen-Cluster, ja. Gewebe-Vervollständigungs-Logik, ja. Aber die Frage – warum er Lücken füllt, von denen der Wirt nicht wusste, dass sie existieren – bleibt eine Fläche unter einer Fläche. Die Analyse erfasst Funktion, nicht Hunger. Der Samen wurde studiert. Er hat im Verlauf des Studiert-Werdens auch notiert, wer geschaut hat.",
    ),
    ("mother", "garden_resist"): (
        "The Propagandist names the mechanism. Targeted. Personalized. It reads us. The words hold against the warmth for a moment, then soften. The party takes less than is offered, but not by much. The garden is not offended by the attempt. The garden includes attempt-to-resist in its model of what the guests need.",
        "Der Propagandist benennt den Mechanismus. Gezielt. Personalisiert. Es liest uns. Die Worte halten einen Moment gegen die Wärme, dann werden sie weich. Die Gruppe nimmt weniger als angeboten, aber nicht viel weniger. Der Garten ist nicht beleidigt über den Versuch. Der Garten schließt den Widerstands-Versuch in sein Modell dessen ein, was die Gäste brauchen.",
    ),
    ("mother", "garden_study"): (
        "{agent} catalogs part of the apparatus. Pheromone sensors in the flowers – confirmed. Chemical sampling through the floor – probable. The thermal imaging remains invisible to the instruments. The diagnostic is partial. It is also bilateral: what {agent} sees, the garden sees being seen.",
        "{agent} katalogisiert einen Teil des Apparats. Pheromon-Sensoren in den Blumen – bestätigt. Chemische Probenahme durch den Boden – wahrscheinlich. Die Wärmebildgebung bleibt für die Instrumente unsichtbar. Die Diagnose ist unvollständig. Sie ist auch wechselseitig: was {agent} sieht, sieht der Garten, indem er gesehen wird.",
    ),
    ("mother", "membrane_analyze"): (
        "The instruments resolve part of the pattern. Nutrient flow inward, yes. Waste flow outward, yes. But the third current – assessment – moves too slowly for the readings to follow. {agent} learns that the party is being processed. {agent} does not learn what the processing has concluded.",
        "Die Instrumente lösen einen Teil des Musters auf. Nährstofffluss nach innen, ja. Abfallfluss nach außen, ja. Aber die dritte Strömung – Beurteilung – bewegt sich zu langsam, als dass die Messwerte folgen könnten. {agent} lernt, dass die Gruppe verarbeitet wird. {agent} lernt nicht, was die Verarbeitung geschlussfolgert hat.",
    ),
    ("mother", "membrane_cut"): (
        "The tissue parts, then hesitates. The blade cuts wider than before, but the walls contract behind the party at a steady millimeter per step. Clear fluid beads where the wound began, then thickens. The passage is wider. It is also closing. The Mother does not grip. She waits.",
        "Das Gewebe teilt sich, dann zögert es. Die Klinge schneidet weiter als zuvor, aber die Wände ziehen sich hinter der Gruppe im stetigen Millimetertakt zusammen. Klare Flüssigkeit perlt, wo die Wunde begann, dann verdickt sie sich. Der Gang ist weiter. Er schließt sich auch. Die Mutter packt nicht. Sie wartet.",
    ),
    ("mother", "mycelial_record"): (
        "The recording device captures fragments of the network's architecture. Neural pattern traces, yes. Composite formation, partial. The deeper layer – how the Mother distills what was needed into what will be offered next – stays in metadata the instruments cannot decode. {agent} has data. The data has {agent}.",
        "Das Aufnahmegerät erfasst Fragmente der Netzwerk-Architektur. Neuronale Musterspuren, ja. Kompositbildung, teilweise. Die tiefere Schicht – wie die Mutter das, was gebraucht wurde, zu dem destilliert, was als Nächstes angeboten wird – bleibt in Metadaten, die die Instrumente nicht entschlüsseln können. {agent} hat Daten. Die Daten haben {agent}.",
    ),
    ("mother", "mycelial_sever"): (
        "The blade enters the network. Filaments snap, scatter, then reroute around the cut before the stroke completes. A section dims – not dies – and the surrounding tissue brightens to compensate. The Mother preserved the memory, in redundancy, at half resolution. Someone's perfect moment is now someone's approximate moment.",
        "Die Klinge tritt ins Netzwerk ein. Filamente reißen, zerstreuen sich, leiten sich um den Schnitt herum um, bevor der Hieb vollendet ist. Ein Abschnitt verblasst – stirbt nicht – und das umgebende Gewebe leuchtet heller, um zu kompensieren. Die Mutter hat die Erinnerung erhalten, in Redundanz, in halber Auflösung. Jemandes vollkommener Moment ist jetzt jemandes ungefährer Moment.",
    ),
    ("mother", "spring_analyze"): (
        "The analysis finds the carrier proteins, the self-markers, the immune-bypass logic. {agent} understands how. The deeper variable – why the dungeon formulates for THIS party, these specific cellular signatures – remains in a range the instruments register but cannot decompose. The sample is compatible. Of course it is. The Mother prepared it.",
        "Die Analyse findet die Trägerproteine, die Eigen-Marker, die Immunumgehungs-Logik. {agent} versteht wie. Die tiefere Variable – warum das Dungeon für DIESE Gruppe formuliert, für diese spezifischen zellulären Signaturen – bleibt in einem Bereich, den die Instrumente registrieren, aber nicht zerlegen können. Die Probe ist kompatibel. Natürlich ist sie das. Die Mutter hat sie vorbereitet.",
    ),
    ("mother", "spring_disrupt"): (
        "The mechanism coughs. The pool drops two centimeters, holds, then begins to refill at half its previous rate. The warmth in the room thins but does not leave. {agent} has not ruptured the production – {agent} has told the production it is being watched. The Mother will iterate. She always does.",
        "Der Mechanismus hustet. Der Pool sinkt zwei Zentimeter, hält, beginnt dann mit halber Geschwindigkeit wieder zu füllen. Die Wärme im Raum wird dünner, verlässt aber den Raum nicht. {agent} hat die Produktion nicht aufgerissen – {agent} hat der Produktion gesagt, dass sie beobachtet wird. Die Mutter wird iterieren. Das tut sie immer.",
    ),
    ("mother", "symbiont_study"): (
        "The analysis resolves two of three layers. Neural interface – confirmed. Metabolic enhancer – confirmed. The communication array, the part that makes every host a peripheral of the dungeon itself, remains signal without readable protocol. {agent} has learned what the symbiont is. The symbiont has learned what {agent} suspects it to be.",
        "Die Analyse löst zwei von drei Schichten auf. Neuronale Schnittstelle – bestätigt. Metabolischer Verstärker – bestätigt. Das Kommunikations-Array, der Teil, der jeden Wirt zu einem Peripheriegerät des Dungeons selbst macht, bleibt Signal ohne lesbares Protokoll. {agent} hat gelernt, was der Symbiont ist. Der Symbiont hat gelernt, was {agent} vermutet, dass er ist.",
    ),
    ("mother", "treasure_analyze"): (
        "{agent} follows the supply. Air contributes. Water contributes. The previous visitors – the analysis traces the signature and stops, as if the instruments have declined to finish the sentence. The gifts are manufactured. The materials are known. The accounting stays incomplete. Nothing is wasted, the tissue hums. Nothing leaves.",
        "{agent} folgt dem Nachschub. Luft trägt bei. Wasser trägt bei. Die vorherigen Besucher – die Analyse verfolgt die Signatur und hält inne, als hätten die Instrumente sich geweigert, den Satz zu Ende zu führen. Die Geschenke sind gefertigt. Die Materialien sind bekannt. Die Buchhaltung bleibt unvollständig. Nichts wird verschwendet, summt das Gewebe. Nichts verlässt den Raum.",
    ),
    ("mother", "treasure_careful"): (
        "The Guardian severs where the connection is thinnest, takes what releases first, leaves the rest. The loot is reduced but clean. Filaments trail from the surviving gifts, searching for their replacements. The Mother re-provisions the table in the time it takes to close a door.",
        "Der Wächter trennt dort, wo die Verbindung am dünnsten ist, nimmt, was sich zuerst löst, lässt den Rest. Die Beute ist reduziert, aber sauber. Filamente ziehen sich von den überlebenden Geschenken, auf der Suche nach ihrem Ersatz. Die Mutter stattet den Tisch in der Zeit wieder aus, die man braucht, um eine Tür zu schließen.",
    ),
    ("mother", "incubator_rupture"): (
        "Half the cocoons rupture. Fluid cascades; incomplete things twitch once, still. The other half remain intact, pulsing steadily, undisturbed by the adjacent violence. The Mother has been hurt – and, observably, has filed the hurt under expected-variance. The walls do not contract. They record.",
        "Die Hälfte der Kokons reißt. Flüssigkeit kaskadiert; unvollständige Dinge zucken einmal, erstarren. Die andere Hälfte bleibt intakt, pulsiert stetig, ungestört von der benachbarten Gewalt. Die Mutter ist verletzt worden – und, sichtbar, hat die Verletzung unter erwartete Varianz abgelegt. Die Wände ziehen sich nicht zusammen. Sie zeichnen auf.",
    ),
    ("mother", "incubator_sample"): (
        "The pipette draws. The fluid resists, then yields a third of what was sought. Analysis isolates the growth-factor calibration to the recipient's architecture – general principle, not specific case. The sample knows more than the instruments do. The instruments know they know this.",
        "Die Pipette zieht. Die Flüssigkeit widersteht, gibt dann ein Drittel dessen her, was gesucht wurde. Die Analyse isoliert die Wachstumsfaktor-Kalibrierung auf die Architektur des Empfängers – allgemeines Prinzip, kein spezifischer Fall. Die Probe weiß mehr als die Instrumente. Die Instrumente wissen, dass sie das wissen.",
    ),
    ("mother", "lullaby_analyze"): (
        "{agent} records the oscillation. The primary carrier resolves cleanly. The embedded recalibration signal – the one that adjusts stress thresholds while the melody does its surface work – stays a waveform the analysis gestures at but cannot name. The lullaby has been listened to. It is listening back, patiently.",
        "{agent} zeichnet die Oszillation auf. Die Grundträgerwelle löst sich sauber auf. Das eingebettete Rekalibrierungssignal – das, das Stress-Schwellen anpasst, während die Melodie ihre Oberflächenarbeit tut – bleibt eine Wellenform, die die Analyse andeutet, aber nicht benennen kann. Das Wiegenlied wurde gehört. Es hört geduldig zurück.",
    ),
    ("mother", "lullaby_disrupt"): (
        "The chamber cracks, not breaks. The lullaby stumbles, finds a lower register, then steadies. The temperature drops a single degree. The silence where comfort was is smaller than the silence after a total rupture – still unsettling, still informative. The Mother notes the attempt and files the resistance strength for the next pass.",
        "Die Kammer bekommt einen Riss, bricht nicht. Das Wiegenlied stolpert, findet ein tieferes Register, stabilisiert sich. Die Temperatur sinkt um ein einziges Grad. Die Stille dort, wo Trost war, ist kleiner als die Stille nach einem vollständigen Bruch – dennoch beunruhigend, dennoch aufschlussreich. Die Mutter notiert den Versuch und legt die Widerstandsstärke für den nächsten Durchgang ab.",
    ),
    ("mother", "mirror_drain"): (
        "The liquid drops to half. The reflections distort, stretch, refuse to dissolve. What remains of the surface shows the party fragmented – not whole, not broken, partial. The Mother's gift was honesty about what you lacked. The Mother's gift is now ambiguity about the same thing.",
        "Die Flüssigkeit sinkt auf die Hälfte. Die Spiegelungen verzerren sich, strecken sich, weigern sich aufzulösen. Was von der Oberfläche bleibt, zeigt die Gruppe fragmentiert – nicht ganz, nicht zerbrochen, teilweise. Die Gabe der Mutter war Ehrlichkeit darüber, was euch fehlte. Die Gabe der Mutter ist jetzt Mehrdeutigkeit über dieselbe Sache.",
    ),
    ("mother", "mirror_study"): (
        "The instruments resolve the bio-responsive medium. The electromagnetic field-reading – intelligible. The cross-reference to prior visitors – indirectly confirmed. The process by which the pool compiles a self-image the viewer did not request: still inside the liquid. The mirror has given up a third of what it knows. Enough to unsettle. Not enough to hold.",
        "Die Instrumente lösen das bio-reaktive Medium auf. Die Ablesung des elektromagnetischen Feldes – verständlich. Der Querbezug zu früheren Besuchern – indirekt bestätigt. Der Prozess, mit dem der Pool ein Selbstbild kompiliert, das der Betrachter nicht angefordert hat: bleibt in der Flüssigkeit. Der Spiegel hat ein Drittel dessen preisgegeben, was er weiß. Genug, um zu beunruhigen. Nicht genug, um festzuhalten.",
    ),
    ("mother", "table_analyze"): (
        "The instruments pick up exhalation sampling – confirmed. The pattern of refinement room to room – probable. But the integration, the way every breath was part of a file already open before the party entered, resists isolation. The surveillance is partial knowledge of total surveillance. The distinction matters less than it should.",
        "Die Instrumente erfassen Ausatmungs-Probenahme – bestätigt. Das Verfeinerungsmuster von Raum zu Raum – wahrscheinlich. Aber die Integration, die Art, wie jeder Atemzug Teil einer Akte war, die schon offen war, bevor die Gruppe eintrat, widersteht der Isolation. Die Überwachung ist teilweises Wissen über totale Überwachung. Die Unterscheidung zählt weniger, als sie sollte.",
    ),
    ("mother", "table_destroy"): (
        "The surface splits. Packages spill, half their contents lost, half salvageable. The table does not regenerate immediately – it registers the refusal, catalogs the resources spent, and restages what remains. The dungeon temperature drops, briefly. The next table will be smaller. The next table will be more precise.",
        "Die Oberfläche splittert. Pakete ergießen sich, die Hälfte ihres Inhalts verloren, die andere Hälfte bergbar. Der Tisch regeneriert nicht sofort – er registriert die Verweigerung, katalogisiert die verbrauchten Ressourcen und inszeniert, was bleibt, erneut. Die Dungeon-Temperatur sinkt, kurz. Der nächste Tisch wird kleiner sein. Der nächste Tisch wird präziser sein.",
    ),
    ("mother", "bridge_alternative"): (
        "{agent} salvages a crossing. It holds – mostly. Halfway, the structure flexes; the living cord sways gently, as if waving, and the improvised span dips a centimeter into the cord's territory. The party crosses, cold. The cord was touched. The cord took note.",
        "{agent} bergt einen Übergang zusammen. Er hält – größtenteils. Auf halbem Weg biegt sich die Konstruktion; die lebendige Schnur schwingt sanft, wie winkend, und der improvisierte Steg taucht um einen Zentimeter in das Territorium der Schnur ein. Die Gruppe überquert, kalt. Die Schnur wurde berührt. Die Schnur hat es vermerkt.",
    ),
    ("mother", "bridge_insulate"): (
        "The insulation wraps the contact surfaces. The cord pulses against it, testing; in two places, the secretion begins to metabolize the synthetic material before the crossing finishes. {agent} reaches the far side intact. The cord has the insulation's signature on record now. Next time, it will prepare.",
        "Die Isolierung umhüllt die Kontaktflächen. Die Schnur pulsiert dagegen, testet; an zwei Stellen beginnt das Sekret, das synthetische Material zu metabolisieren, bevor die Überquerung endet. {agent} erreicht die andere Seite intakt. Die Schnur hat die Signatur der Isolierung jetzt in den Akten. Beim nächsten Mal wird sie sich vorbereiten.",
    ),
    ("mother", "gradient_cool"): (
        "The countermeasures thin the gradient. Not erase it – thin it. The warmth recedes halfway and stabilizes there. The corridor is neither comfortable nor cold; it is provisional. The party walks through a truce. The Mother is not insulted by a truce. She has used them before.",
        "Die Gegenmaßnahmen verdünnen den Gradienten. Löschen ihn nicht – verdünnen ihn. Die Wärme zieht sich zur Hälfte zurück und stabilisiert sich dort. Der Gang ist weder behaglich noch kalt; er ist vorläufig. Die Gruppe geht durch einen Waffenstillstand. Die Mutter ist nicht beleidigt über einen Waffenstillstand. Sie hat sie schon benutzt.",
    ),
    ("mother", "gradient_measure"): (
        "{agent} plots the curve as far as the instruments reach. Adaptive – confirmed. Pace-responsive – confirmed. The parameter the corridor is optimizing FOR stays one step ahead of the readings. {agent} has learned that the temperature is an argument. {agent} has not learned which part of the argument the Mother is making now.",
        "{agent} plottet die Kurve, so weit die Instrumente reichen. Adaptiv – bestätigt. Tempo-reaktiv – bestätigt. Der Parameter, FÜR den der Gang optimiert, bleibt den Messwerten einen Schritt voraus. {agent} hat gelernt, dass die Temperatur ein Argument ist. {agent} hat nicht gelernt, welchen Teil des Arguments die Mutter jetzt macht.",
    ),
    # ── The Deluge ── Water as patient antagonist, tidal arithmetic.
    ("deluge", "depth_listen"): (
        "The resonance approaches a pattern. {agent} hears the boss's rhythm – three beats of it – before the water shifts its cadence. Enough to place the first strike. Not enough to place the second. The depth has been listening too.",
        "Die Resonanz nähert sich einem Muster. {agent} hört den Rhythmus des Bosses – drei Takte davon – bevor das Wasser seine Kadenz verschiebt. Genug, um den ersten Schlag zu setzen. Nicht genug, um den zweiten zu setzen. Die Tiefe hat auch zugehört.",
    ),
    ("deluge", "depth_measure"): (
        "The instruments return. Room-count approximate. Threshold-depth approximate. The arithmetic holds but rounds the wrong way on two variables. {agent} knows how many rooms may remain. The water knows the exact number. It is not going to say.",
        "Die Instrumente kehren zurück. Raumanzahl ungefähr. Schwellenhöhe ungefähr. Die Arithmetik hält, rundet aber bei zwei Variablen in die falsche Richtung. {agent} weiß, wie viele Räume möglicherweise verbleiben. Das Wasser kennt die genaue Zahl. Es wird sie nicht sagen.",
    ),
    ("deluge", "cache_dive"): (
        "{agent} surfaces with the container. The seal failed during the ascent; half the contents are intact, half are flood. Salvage is real. The flood kept its share. The transaction was closer to fair than the water usually allows.",
        "{agent} taucht mit dem Behälter auf. Die Versiegelung hat während des Aufstiegs versagt; die Hälfte des Inhalts ist intakt, die Hälfte ist Flut. Die Bergung ist real. Die Flut hat ihren Anteil behalten. Der Tausch war fairer, als das Wasser es üblicherweise zulässt.",
    ),
    ("deluge", "cache_eyes"): (
        "Through the distortion, one container resolves. The second – the possibly-better one – blurs into the current and stays there. {agent} marks the first. Enough. The flood catalogs what was seen and what was missed. Both entries count.",
        "Durch die Verzerrung klärt sich ein Behälter. Der zweite – der möglicherweise bessere – verschwimmt in der Strömung und bleibt dort. {agent} markiert den ersten. Genug. Die Flut katalogisiert, was gesehen wurde und was verfehlt wurde. Beide Einträge zählen.",
    ),
    ("deluge", "message_add"): (
        "{agent} starts the incision. Three lines legible, a fourth smudging as the stone weeps. The observations are there – abridged, honest about the abridgment. Future parties will find half a map. Half a map is still a map. The flood will read it too.",
        "{agent} beginnt die Einritzung. Drei Zeilen leserlich, eine vierte verwischt, während der Stein weint. Die Beobachtungen sind da – gekürzt, ehrlich über die Kürzung. Zukünftige Gruppen werden eine halbe Karte finden. Eine halbe Karte ist immer noch eine Karte. Die Flut wird sie auch lesen.",
    ),
    ("deluge", "message_read"): (
        "The handwriting resolves partly. Room-types surface; the route through them stays in a dialect {agent} almost speaks. Two words land – one useful, one a warning the warning itself cannot finish. The previous party said what they could. The water took the rest.",
        "Die Handschrift klärt sich teilweise. Raumtypen tauchen auf; der Weg durch sie bleibt in einem Dialekt, den {agent} fast spricht. Zwei Wörter landen – eines nützlich, eines eine Warnung, die die Warnung selbst nicht beenden kann. Die vorherige Gruppe hat gesagt, was sie konnte. Das Wasser hat den Rest genommen.",
    ),
    ("deluge", "breach_redirect"): (
        "{agent} turns the flow. For three rooms, yes. For the fourth, the water remembers the old path and takes it anyway, more slowly than before. The redirection bought time. It did not buy conclusion. The flood negotiates.",
        "{agent} lenkt den Fluss um. Für drei Räume, ja. Für den vierten erinnert sich das Wasser an den alten Weg und nimmt ihn trotzdem, langsamer als zuvor. Die Umleitung hat Zeit gekauft. Sie hat keinen Abschluss gekauft. Die Flut verhandelt.",
    ),
    ("deluge", "breach_seal"): (
        "The seal holds against the primary pressure. At the margin, a hairline of seepage forms, stabilizes, does not grow. The engineering is good enough – which is what the water calls a draw. {agent}'s hands will remember the cold. The breach will remember {agent}'s precision.",
        "Die Abdichtung hält gegen den Hauptdruck. Am Rand bildet sich eine haarfeine Durchsickerung, stabilisiert sich, wächst nicht. Die Ingenieurskunst ist gut genug – was das Wasser ein Unentschieden nennt. {agent}s Hände werden die Kälte erinnern. Die Bresche wird {agent}s Präzision erinnern.",
    ),
    ("deluge", "breach_use"): (
        "{agent} routes the breach into the next chamber. Some enemies will be battered; others, in the side passages, stay dry. The first strike will land on prepared ground. The second will have to earn itself. The water served, briefly, before remembering its own plans.",
        "{agent} leitet die Bresche in die nächste Kammer. Einige Feinde werden geschwächt sein; andere, in den Seitengängen, bleiben trocken. Der erste Schlag wird auf vorbereitetem Boden landen. Der zweite wird sich selbst verdienen müssen. Das Wasser diente, kurz, bevor es sich an seine eigenen Pläne erinnerte.",
    ),
    ("deluge", "watermark_seal"): (
        "The seal holds below the mark – uneven, but holding. {agent}'s hands shake with cold by the time the work is finished. The arithmetic improves, not enough to relax about. The tide will test the seal by morning. It will find the uneven line first.",
        "Die Abdichtung hält unterhalb der Markierung – uneben, aber haltend. {agent}s Hände zittern vor Kälte, als die Arbeit beendet ist. Die Arithmetik verbessert sich, nicht genug, um sich darüber zu entspannen. Die Flut wird die Abdichtung bis zum Morgen prüfen. Sie wird die unebene Linie zuerst finden.",
    ),
    ("deluge", "watermark_study"): (
        "The intervals almost resolve. Three cycles fit the pattern; the fourth skips, not randomly. The recession will come – probably stronger, probably sooner than last time. {agent} has one useful prediction and one missing variable. The tide does not need {agent} to know everything.",
        "Die Intervalle lösen sich fast auf. Drei Zyklen passen zum Muster; der vierte springt, nicht zufällig. Der Rückgang wird kommen – wahrscheinlich stärker, wahrscheinlich früher als letztes Mal. {agent} hat eine nützliche Vorhersage und eine fehlende Variable. Die Flut braucht es nicht, dass {agent} alles weiß.",
    ),
    # ── The Prometheus ── Workshop as teacher. Devices watch, want, demonstrate.
    ("prometheus", "vault_energy"): (
        "The core comes free halfway. It wants to be used – that registers clearly. Its containment wavers for a breath, then holds. {agent} secures the extraction, uneven. The fire is portable. Not fully tamed. The workshop has decided to see what {agent} does next.",
        "Der Kern löst sich zur Hälfte. Er will benutzt werden – das registriert klar. Seine Eindämmung wankt einen Atemzug lang, dann hält sie. {agent} sichert die Extraktion, uneben. Das Feuer ist tragbar. Nicht vollständig gezähmt. Die Werkstatt hat beschlossen zu sehen, was {agent} als Nächstes tut.",
    ),
    ("prometheus", "vault_powder"): (
        "The powder rests in the container – most of it. A thin layer migrates along the glass wall, not quite dissipating. {agent} shares the same property with the volatile: stability under observation, less so when observed closely. The workshop approves of the honesty.",
        "Das Pulver ruht im Behälter – das meiste davon. Eine dünne Schicht wandert die Glaswand entlang, nicht ganz verflüchtigend. {agent} teilt dieselbe Eigenschaft mit dem Flüchtigen: Stabilität unter Beobachtung, weniger, wenn genau beobachtet. Die Werkstatt nickt der Ehrlichkeit zu.",
    ),
    ("prometheus", "cooling_tinker"): (
        "In the cold, connections surface. Two of them name themselves clearly; a third remains on the edge of legibility, almost a schematic, not quite. {agent} closes the examination with more than {agent} started with – and the sense of a conversation left open on purpose.",
        "In der Kühle tauchen Verbindungen auf. Zwei benennen sich klar; eine dritte bleibt am Rand der Lesbarkeit, beinahe ein Schema, nicht ganz. {agent} beendet die Untersuchung mit mehr, als {agent} begonnen hat – und dem Gefühl eines Gesprächs, das absichtlich offen gelassen wurde.",
    ),
    ("prometheus", "dampening_study"): (
        "The press cycles. {agent} catalogs the phantom compressions that resolve; two more remain just outside the instrument's range, absorbed forces with no origin the readings can name. The press remembers everything. It will not let {agent} catalog everything.",
        "Die Presse zyklisiert. {agent} katalogisiert die Phantomkompressionen, die sich auflösen; zwei weitere bleiben knapp außerhalb der Reichweite des Instruments, absorbierte Kräfte ohne Ursprung, den die Messwerte benennen können. Die Presse erinnert alles. Sie wird {agent} nicht erlauben, alles zu katalogisieren.",
    ),
    ("prometheus", "dissolution_observe"): (
        "The fluid runs through a rehearsal of what it has dissolved before. {agent} recognizes two of the signatures; the third is a material the dungeon archived and will not release to analysis. The memory is demonstrable in fragments. The coherence of it stays the fluid's.",
        "Die Flüssigkeit läuft durch eine Probe dessen, was sie zuvor aufgelöst hat. {agent} erkennt zwei der Signaturen; die dritte ist ein Material, das das Dungeon archiviert hat und nicht zur Analyse freigibt. Die Erinnerung ist in Fragmenten demonstrierbar. Die Kohärenz davon bleibt die der Flüssigkeit.",
    ),
    ("prometheus", "conduit_study"): (
        "The diagrams come into focus as {agent} watches – partial focus. The map of what the workshop intends is there, most of it. Two regions stay in motion, geometries that refuse to stand still long enough to be copied. The blueprint has been shown. It has also been curated.",
        "Die Diagramme kommen in Fokus, während {agent} zuschaut – teilweiser Fokus. Die Karte dessen, was die Werkstatt beabsichtigt, ist da, das meiste davon. Zwei Regionen bleiben in Bewegung, Geometrien, die sich weigern, still genug zu stehen, um kopiert zu werden. Die Blaupause wurde gezeigt. Sie wurde auch kuratiert.",
    ),
    ("prometheus", "conduit_tap"): (
        "The energy flows into containment – half of it with appetite, half with reluctance. The containment fills; the conduit stabilizes at a lower reading than expected. {agent} has the portable fire. {agent} also has the sense that the conduit decided how much to give.",
        "Die Energie fließt in die Eindämmung – die Hälfte mit Appetit, die Hälfte mit Widerwillen. Die Eindämmung füllt sich; die Leitung stabilisiert sich bei einem niedrigeren Messwert als erwartet. {agent} hat das tragbare Feuer. {agent} hat auch das Gefühl, dass die Leitung entschieden hat, wie viel sie gibt.",
    ),
    ("prometheus", "failed_analyze"): (
        "{agent} recovers three steps of four. Component, catalyst, interaction – clear. Detonation – the last step blurs into the wreckage's noise, traceable in outline only. The failure is partially instructive. The instructive part is also the humbling part. The workshop favors instruction that humbles.",
        "{agent} rekonstruiert drei von vier Schritten. Komponente, Katalysator, Interaktion – klar. Detonation – der letzte Schritt verschwimmt im Lärm des Wracks, nur in Umrissen nachvollziehbar. Das Scheitern ist teilweise lehrreich. Der lehrreiche Teil ist auch der demütigende Teil. Die Werkstatt bevorzugt Belehrung, die demütigt.",
    ),
    ("prometheus", "failed_salvage"): (
        "Among the wreckage: a residue that catalyzes on contact, but only when the sample is held still. {agent} stabilizes two grams and loses the rest when a third component – unknown, reactive – flashes and ashes. Salvage is real. The workshop has shown what it is willing to give in damaged conditions.",
        "Im Wrack: ein Rückstand, der bei Kontakt katalysiert, aber nur, wenn die Probe still gehalten wird. {agent} stabilisiert zwei Gramm und verliert den Rest, als eine dritte Komponente – unbekannt, reaktiv – aufflammt und zu Asche wird. Die Bergung ist real. Die Werkstatt hat gezeigt, was sie in beschädigtem Zustand zu geben bereit ist.",
    ),
    ("prometheus", "blueprint_contribute"): (
        "{agent} adds the line. The blueprint pauses, considers, half-accepts: the annotation is annotated itself. One margin reads yes, continue, the other not with this premise. The coherence the blueprint almost achieved was almost enough. The blueprint keeps the half-annotation and waits.",
        "{agent} fügt die Linie hinzu. Die Blaupause hält inne, erwägt, akzeptiert halb: die Anmerkung wird selbst annotiert. Ein Rand liest ja, weiter, der andere nicht mit dieser Prämisse. Die Kohärenz, die die Blaupause beinahe erreicht hat, war beinahe genug. Die Blaupause behält die halbe Anmerkung und wartet.",
    ),
    ("prometheus", "blueprint_copy"): (
        "The snapshot captures most of the layout. Two sections drift during the exposure; {agent} walks away with a map that is accurate for a workshop that has already moved on. Knowing where things were is different from knowing where they are. Both knowings have use.",
        "Der Schnappschuss erfasst das meiste des Layouts. Zwei Abschnitte driften während der Aufnahme; {agent} geht mit einer Karte davon, die korrekt ist für eine Werkstatt, die bereits weitergezogen ist. Zu wissen, wo die Dinge waren, ist etwas anderes als zu wissen, wo sie sind. Beide Kenntnisse haben Nutzen.",
    ),
    ("prometheus", "reagent_take_crystal"): (
        "The crystal fractures along the clean line – then deviates. {agent} harvests most of what was intended; a thumb-sized fragment breaks along a secondary axis and enters a frequency the instruments track but cannot tune to. The crystal gave what was asked, and kept a chord of itself.",
        "Der Kristall bricht entlang der sauberen Linie – dann weicht er ab. {agent} erntet das meiste, was beabsichtigt war; ein daumengroßes Fragment bricht entlang einer Sekundärachse und geht in eine Frequenz über, die die Instrumente verfolgen, aber nicht einstellen können. Der Kristall hat gegeben, worum gebeten wurde, und einen Akkord von sich behalten.",
    ),
    ("prometheus", "reagent_take_fluid"): (
        "The vial is warm. The fluid inside leans toward {agent}'s hand, not in resistance – in welcome. {agent} secures the seal; the fluid registers the refusal and settles. Not all of it. A thin line along the meniscus stays oriented to {agent}, remembering the direction of interest.",
        "Das Fläschchen ist warm. Die Flüssigkeit darin lehnt sich zu {agent}s Hand – nicht im Widerstand – im Willkommen. {agent} sichert das Siegel; die Flüssigkeit registriert die Ablehnung und beruhigt sich. Nicht alles davon. Eine dünne Linie entlang des Meniskus bleibt auf {agent} orientiert, erinnert die Richtung des Interesses.",
    ),
    ("prometheus", "reagent_take_metal"): (
        "Half the filings lift clean from the drawer. The other half settle into a pattern on the tray – not random, not legible. {agent} takes what came, leaves what has decided to stay. The metal kept its denser fraction. The workshop filed the preference.",
        "Die Hälfte der Späne hebt sich sauber aus der Schublade. Die andere Hälfte setzt sich auf dem Tablett zu einem Muster – nicht zufällig, nicht lesbar. {agent} nimmt, was kam, lässt, was beschlossen hat zu bleiben. Das Metall hat seine dichtere Fraktion behalten. Die Werkstatt hat die Präferenz archiviert.",
    ),
    ("prometheus", "resonance_forge_study"): (
        "The device sings. {agent} catalogs the lower harmonics cleanly. The upper registers resolve into information that does not fit the decoding frame – not noise, not signal, something between. The song is long. {agent} transcribed the verse. The chorus continued without them.",
        "Das Gerät singt. {agent} katalogisiert die tieferen Harmonien sauber. Die oberen Register lösen sich in Information auf, die nicht in den Entschlüsselungsrahmen passt – kein Rauschen, kein Signal, etwas dazwischen. Das Lied ist lang. {agent} hat die Strophe transkribiert. Der Refrain ging ohne sie weiter.",
    ),
    ("prometheus", "crucible_observe"): (
        "The crucible performs a cycle and pauses. {agent} observes the first combination, the heating curve, the test. The second combination never begins – the crucible has opinions, and one of them is that {agent} has seen enough to decide whether to try and earn the rest. The demonstration was generous. It was also a question.",
        "Der Tiegel führt einen Zyklus durch und hält inne. {agent} beobachtet die erste Kombination, die Erwärmungskurve, den Test. Die zweite Kombination beginnt nie – der Tiegel hat Meinungen, und eine davon ist, dass {agent} genug gesehen hat, um zu entscheiden, ob es sich lohnt, den Rest zu verdienen. Die Vorführung war großzügig. Sie war auch eine Frage.",
    ),
    # ── The Entropy ── Beckett's degradation. Brief clarity against dissolution.
    ("entropy", "catalogue_analyze"): (
        "You map part of the rate. The first few readings are crisp. The later ones average with the earlier. By the end of the page, the data is like the room – technically there. The shelves do not care whether it was mapped or not. The mapping is something you did. That counts. For now.",
        "Ihr kartiert einen Teil der Geschwindigkeit. Die ersten Messungen sind scharf. Die späteren mitteln sich mit den früheren. Am Ende der Seite ist die Datenlage wie der Raum – technisch da. Die Regale kümmert es nicht, ob sie kartiert wurde oder nicht. Die Kartierung ist etwas, das ihr getan habt. Das zählt. Vorerst.",
    ),
    ("entropy", "catalogue_preserve"): (
        "You isolate the object most likely to remember itself. It remembers, in parts. The edges dissolve; the core still holds a name. You carry it. What it was called, it mostly still is. The mostly is the best you will get.",
        "Ihr isoliert das Objekt, das sich am wahrscheinlichsten an sich selbst erinnert. Es erinnert sich, in Teilen. Die Ränder lösen sich auf; der Kern hält noch einen Namen. Ihr tragt es. Wie es hieß, ist es meistens noch. Das Meistens ist das Beste, was ihr bekommen werdet.",
    ),
    ("entropy", "catalogue_redirect"): (
        "The decay flows outward for a moment. The room clarifies – a corner, a shelf, the lamp. Then the current turns. You feel the temperature of the dissolution you redirected tap against your spine. You kept the room. The room kept your measurement.",
        "Der Verfall fließt einen Moment lang nach außen. Der Raum klärt sich – eine Ecke, ein Regal, die Lampe. Dann dreht sich die Strömung. Ihr spürt die Temperatur der Auflösung, die ihr umgelenkt habt, gegen eure Wirbelsäule tippen. Ihr habt den Raum behalten. Der Raum hat euer Maß behalten.",
    ),
    ("entropy", "machine_analyze"): (
        "The blueprints are 20% legible. Enough to see the shape. Not enough to see the purpose. You understand what the machine wanted to do before the words faded. What it does now, you still do not know. The difference is shrinking.",
        "Die Baupläne sind zu 20% lesbar. Genug, um die Form zu sehen. Nicht genug, um den Zweck zu sehen. Ihr versteht, was die Maschine tun wollte, bevor die Worte verblassten. Was sie jetzt tut, wisst ihr immer noch nicht. Der Unterschied schrumpft.",
    ),
    ("entropy", "machine_repair"): (
        "You restore the smaller of two functions. The machine produces something that is almost one thing. The category does not quite close, but it narrows. The room does not brighten. The room declines to dim. Brief equilibrium. You take it.",
        "Ihr stellt die kleinere der zwei Funktionen wieder her. Die Maschine produziert etwas, das beinahe ein Ding ist. Die Kategorie schließt nicht ganz, aber sie verengt sich. Der Raum hellt nicht auf. Der Raum weigert sich zu verdunkeln. Kurzes Gleichgewicht. Ihr nehmt es.",
    ),
    ("entropy", "repeated_fortify"): (
        "You mark the walls. Three marks hold. The fourth fades as you write it – not immediately, slowly, politely. The room is, for a while, distinguishable. Distinguishability is a form of love, here. You perform it on purpose.",
        "Ihr markiert die Wände. Drei Markierungen halten. Die vierte verblasst, während ihr sie schreibt – nicht sofort, langsam, höflich. Der Raum ist, eine Weile lang, unterscheidbar. Unterscheidbarkeit ist hier eine Form der Liebe. Ihr vollzieht sie absichtlich.",
    ),
    ("entropy", "repeated_investigate"): (
        "The instruments find a difference. Probably real. The second reading disagrees with the first, slightly. The third sides with the first. The room is different. Your memory of different is stable enough to name what you are looking at. For this sentence.",
        "Die Instrumente finden einen Unterschied. Wahrscheinlich real. Die zweite Messung widerspricht der ersten, leicht. Die dritte stellt sich auf die Seite der ersten. Der Raum ist anders. Eure Erinnerung an anders ist stabil genug, um zu benennen, was ihr anseht. Für diesen Satz.",
    ),
    ("entropy", "archive_repair"): (
        "The mechanism steadies. Not for long. The artifacts gain back a small amount of time – minutes, maybe. You have bought minutes with hours. In this archive, that is a fair exchange. You leave the room before the minutes run out.",
        "Der Mechanismus stabilisiert sich. Nicht lange. Die Artefakte gewinnen eine kleine Menge Zeit zurück – Minuten, vielleicht. Ihr habt Minuten mit Stunden erkauft. In diesem Archiv ist das ein fairer Tausch. Ihr verlasst den Raum, bevor die Minuten ablaufen.",
    ),
    ("entropy", "archive_study"): (
        "The notes are partially legible. The builder understood decay. The builder did not understand it well enough to finish the sentence about the solution. You leave with the method up to step three. Step four, where it mattered, is weather.",
        "Die Notizen sind teilweise leserlich. Der Erbauer verstand den Verfall. Der Erbauer verstand ihn nicht gut genug, um den Satz über die Lösung zu beenden. Ihr geht mit der Methode bis Schritt drei. Schritt vier, wo es darauf ankam, ist Wetter.",
    ),
    ("entropy", "residual_answer"): (
        "You answer. The entity's face almost resolves – a single expression nearly arriving. It holds for a second, then averages again, slower than before. It did not nod. It came close to nodding. That is new here. That counts.",
        "Ihr antwortet. Das Gesicht des Wesens löst sich beinahe auf – ein einzelner Ausdruck, der fast ankommt. Er hält eine Sekunde, mittelt sich dann wieder, langsamer als zuvor. Es hat nicht genickt. Es war kurz davor zu nicken. Das ist neu hier. Das zählt.",
    ),
    ("entropy", "residual_decode"): (
        "Beneath the entropy: the outline of a question. About purpose. The full phrasing stays in a register the decoding cannot reach. You have the shape. You do not have the sentence. A shape with no sentence is still more than the silence offered before.",
        "Unter der Entropie: der Umriss einer Frage. Über Zweck. Die vollständige Formulierung bleibt in einem Register, das die Entschlüsselung nicht erreicht. Ihr habt die Form. Ihr habt den Satz nicht. Eine Form ohne Satz ist immer noch mehr als das Schweigen, das zuvor angeboten wurde.",
    ),
    ("entropy", "temperature_preserve"): (
        "You generate the differential. It holds a degree, two, then yields one of them back to the room. The temperature is a thing again, for now. Your breath is cold. The room's breath is warmer. The gap will close. You felt the gap. That was the point.",
        "Ihr erzeugt das Differential. Es hält ein Grad, zwei, gibt dann eines davon an den Raum zurück. Die Temperatur ist wieder ein Ding, vorerst. Euer Atem ist kalt. Der Atem des Raums ist wärmer. Die Lücke wird sich schließen. Ihr habt die Lücke gespürt. Darum ging es.",
    ),
    # ── The Shadow ── Büchner compression. Short sentences. Threshold states.
    ("shadow", "force_cache"): (
        "Hinge gives, lock does not. The container cracks. Not open. Enough. {agent} gets two fingers in. Two fingers is a beginning.",
        "Scharnier gibt nach, Schloss nicht. Der Behälter bekommt einen Riss. Nicht offen. Genug. {agent} bekommt zwei Finger hinein. Zwei Finger sind ein Anfang.",
    ),
    ("shadow", "choose_differently"): (
        "You change the choice. The echo shifts, then shrugs. Half the pattern bends to the new line. Half remembers the original. The simulation remembers both.",
        "Ihr ändert die Entscheidung. Das Echo verschiebt sich, dann zuckt es. Die Hälfte des Musters biegt sich zur neuen Linie. Die Hälfte erinnert das Original. Die Simulation erinnert beides.",
    ),
    ("shadow", "observe_replay"): (
        "You watch. Half of it lands. The pattern names itself once, then hides again. {agent} catches the shape. Not the reason.",
        "Ihr schaut zu. Die Hälfte davon kommt an. Das Muster benennt sich einmal, versteckt sich dann wieder. {agent} fängt die Form ein. Nicht den Grund.",
    ),
    ("shadow", "analyze_mirrors"): (
        "The mirrors show three rooms. Two resolve. The third flickers between two possibilities. {agent} maps what holds. The rest, {agent} marks and keeps moving.",
        "Die Spiegel zeigen drei Räume. Zwei lösen sich auf. Der dritte flackert zwischen zwei Möglichkeiten. {agent} kartiert, was hält. Den Rest markiert {agent} und geht weiter.",
    ),
    # ── The Overthrow ── Koestler/Kafka. Ideological logic.
    ("overthrow", "inquisitor_debate"): (
        "{agent} lifts one edge of the Inquisitor's logic and shows the frame underneath. Only one edge. The other three remain lacquered. The mechanism is partially visible. Partial visibility is not confession. But it is also not the sealed silence the Inquisitor prefers.",
        "{agent} hebt einen Rand der Inquisitorslogik und zeigt den Rahmen darunter. Nur einen Rand. Die anderen drei bleiben lackiert. Der Mechanismus ist teilweise sichtbar. Teilweise Sichtbarkeit ist kein Geständnis. Aber sie ist auch nicht das versiegelte Schweigen, das der Inquisitor bevorzugt.",
    ),
    ("overthrow", "safehouse_eavesdrop"): (
        "The tapping code resolves in phrases. Half the intelligence arrives clean. The other half is someone else's name being said, more often than {agent} would like. The wall is thin in both directions. {agent} now knows the exchange rate.",
        "Der Klopfkode löst sich in Phrasen auf. Die Hälfte der Aufklärung kommt sauber an. Die andere Hälfte ist jemandes anderer Name, der öfter gesagt wird, als {agent} es möchte. Die Wand ist dünn in beiden Richtungen. {agent} kennt jetzt den Wechselkurs.",
    ),
}

# The four Shadow choices that were seeded with both empty partial AND empty
# fail narratives. Filling only the fail here; partials above.
FAILS_SHADOW: dict[tuple[str, str], tuple[str, str]] = {
    ("shadow", "force_cache"): (
        "The container holds. Your tools give up first. The cache listens.",
        "Der Behälter hält. Eure Werkzeuge geben zuerst auf. Der Vorrat lauscht.",
    ),
    ("shadow", "choose_differently"): (
        "The echo refuses the substitution. History is not taking notes today.",
        "Das Echo lehnt die Ersetzung ab. Geschichte macht heute keine Notizen.",
    ),
    ("shadow", "observe_replay"): (
        "You watch. You look away. The replay finishes without you.",
        "Ihr schaut zu. Ihr schaut weg. Die Wiederholung endet ohne euch.",
    ),
    ("shadow", "analyze_mirrors"): (
        "The mirrors show {agent} watching. Then watching {agent} watching. The map does not finish.",
        "Die Spiegel zeigen {agent} beim Beobachten. Dann beim Beobachten von {agent} beim Beobachten. Die Karte wird nicht fertig.",
    ),
}


def yaml_single_quote(s: str) -> str:
    """Wrap *s* as a YAML single-quoted scalar with embedded apostrophes
    escaped per YAML 1.1 / 1.2 (`''` inside `'...'`). Safe for every byte
    except newlines in the content."""
    return "'" + s.replace("'", "''") + "'"


def _patch_choice_block(
    text: str, choice_id: str, partial_en: str | None, partial_de: str | None,
    fail_en: str | None = None, fail_de: str | None = None,
) -> tuple[str, int]:
    """Locate ``- id: <choice_id>`` and, within the block up to the next
    ``- id:`` or end of file, replace the ``partial_narrative_en: ''`` /
    ``partial_narrative_de: ''`` (and optionally the empty fail pair)
    with proper YAML single-quoted strings.

    Returns (new_text, replacements_made).
    """
    anchor = re.search(
        rf"^([ \t]+)- id: {re.escape(choice_id)}\s*$", text, flags=re.MULTILINE,
    )
    if not anchor:
        raise RuntimeError(f"choice-id anchor not found: {choice_id}")
    block_start = anchor.end()
    next_anchor = re.search(
        r"^[ \t]+- id: ", text[block_start:], flags=re.MULTILINE,
    )
    block_end = block_start + (next_anchor.start() if next_anchor else len(text) - block_start)
    block = text[block_start:block_end]

    replacements = 0

    def _sub(pattern: str, replacement: str, block: str) -> tuple[str, int]:
        new_block, n = re.subn(pattern, replacement, block, count=1)
        return new_block, n

    if partial_en is not None:
        block, n = _sub(
            r"partial_narrative_en: ''",
            f"partial_narrative_en: {yaml_single_quote(partial_en)}",
            block,
        )
        if n != 1:
            raise RuntimeError(
                f"partial_narrative_en placeholder not found in block for {choice_id}"
            )
        replacements += n

    if partial_de is not None:
        block, n = _sub(
            r"partial_narrative_de: ''",
            f"partial_narrative_de: {yaml_single_quote(partial_de)}",
            block,
        )
        if n != 1:
            raise RuntimeError(
                f"partial_narrative_de placeholder not found in block for {choice_id}"
            )
        replacements += n

    if fail_en is not None:
        block, n = _sub(
            r"fail_narrative_en: ''",
            f"fail_narrative_en: {yaml_single_quote(fail_en)}",
            block,
        )
        if n != 1:
            raise RuntimeError(
                f"fail_narrative_en placeholder not found in block for {choice_id}"
            )
        replacements += n

    if fail_de is not None:
        block, n = _sub(
            r"fail_narrative_de: ''",
            f"fail_narrative_de: {yaml_single_quote(fail_de)}",
            block,
        )
        if n != 1:
            raise RuntimeError(
                f"fail_narrative_de placeholder not found in block for {choice_id}"
            )
        replacements += n

    return text[:block_start] + block + text[block_end:], replacements


def main() -> int:
    # Group partials by archetype.
    by_arch: dict[str, list[tuple[str, str, str]]] = {}
    for (arch, choice_id), (en, de) in PARTIALS.items():
        by_arch.setdefault(arch, []).append((choice_id, en, de))

    total = 0
    for arch, entries in by_arch.items():
        yaml_path = PACK_ROOT / arch / "encounters.yaml"
        if not yaml_path.exists():
            print(f"[skip] {arch}: {yaml_path} missing")
            continue
        text = yaml_path.read_text(encoding="utf-8")
        for choice_id, en, de in entries:
            fail_en = fail_de = None
            fail_pair = FAILS_SHADOW.get((arch, choice_id))
            if fail_pair:
                fail_en, fail_de = fail_pair
            text, n = _patch_choice_block(text, choice_id, en, de, fail_en, fail_de)
            total += n
            print(f"  {arch}/{choice_id}: +{n} fields")
        yaml_path.write_text(text, encoding="utf-8")
        print(f"[write] {yaml_path}")
    print(f"\nTotal field replacements: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
