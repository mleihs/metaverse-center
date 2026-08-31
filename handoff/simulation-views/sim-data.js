// Beispielwelt "The Chitinous Mandate" — Daten für Simulations-View-Prototypen
// Extrahiert aus Simulation View v2.dc.html; DE/EN via lang-Parameter.

export function OPC() { return { SPY: '#64748b', GRD: '#10b981', SAB: '#ef4444', PRP: '#f59e0b', INF: '#a78bfa', ASN: '#dc2626' }; }

export function AGENTS(lang) {
    const de = lang === 'de';
    // apt-Reihenfolge: SPY GRD SAB PRP INF ASN
    return [
      { key: 'vosk', name: 'Praetor Vosk', img: 'assets/p-wolf.png', roleDe: 'Molt-Registrator', roleEn: 'Molt-Registrar', zone: de ? 'Obere Waben' : 'Upper Combs', apt: [6, 9, 2, 7, 5, 4], ambassador: true, ai: false, rels: [['Sister Aquila', de ? 'Duldet ihre Ketzerei' : 'Tolerates her heresy'], ['Old Cassar', de ? 'Erbe des Amtes' : 'Inherited the office']], blurbDe: 'Verwaltet, wer sich häuten darf – und wer im alten Panzer bleibt.', blurbEn: 'Decides who may molt – and who stays sealed in the old carapace.', descDe: 'Vosk führt das Häutungsregister seit neun Zyklen. Jede genehmigte Häutung ist ein Aufstieg, jede verweigerte ein stilles Urteil. Er hat gelernt, dass Macht weniger im Stempel liegt als im Zögern davor.', descEn: 'Vosk has kept the molting register for nine cycles. Every approved molt is a promotion, every refusal a quiet verdict. He has learned that power lies less in the stamp than in the pause before it.' },
      { key: 'aquila', name: 'Sister Aquila', img: 'assets/p-voss.png', roleDe: 'Pheromon-Schreiberin', roleEn: 'Pheromone Scribe', zone: de ? 'Pheromon-Viertel' : 'Pheromone Quarter', apt: [7, 3, 5, 9, 8, 2], ambassador: false, ai: false, rels: [['Praetor Vosk', de ? 'Von ihm beschützt' : 'Shielded by him'], ['Ysold Crane', de ? 'Heimliche Verbündete' : 'Secret ally']], blurbDe: 'Schreibt Gesetze in Duft. Manche Sätze riecht man noch Jahre später.', blurbEn: 'Writes law in scent. Some sentences can still be smelled years later.', descDe: 'Aquila übersetzt Dekrete in Pheromon-Ketten, die durch die Waben ziehen. Sie hat entdeckt, dass ein falsch gesetztes Molekül ein Gesetz ins Gegenteil kippen kann – und schweigt darüber.', descEn: 'Aquila translates decrees into pheromone chains that drift through the combs. She has found that a single misplaced molecule can flip a law into its opposite – and keeps quiet about it.' },
      { key: 'k9', name: 'Ledger-Drone K-9', img: null, roleDe: 'Zensus-Drohne', roleEn: 'Census Drone', zone: de ? 'Ledger-Distrikt' : 'Ledger District', apt: [8, 10, 1, 4, 6, 1], ambassador: false, ai: true, rels: [['Marn Tell', de ? 'Meldet an ihn' : 'Reports to him']], blurbDe: 'Zählt alles. Vergisst nichts. Schläft nie. Fragt manchmal warum.', blurbEn: 'Counts everything. Forgets nothing. Never sleeps. Sometimes asks why.', descDe: 'K-9 ist die letzte funktionierende Zensus-Drohne der alten Kohorte. Ihre Loyalität zum Register ist absolut – doch in den Randnotizen ihrer Zählungen tauchen zunehmend Fragen auf, die niemand programmiert hat.', descEn: 'K-9 is the last working census drone of the old cohort. Its loyalty to the register is absolute – yet the margins of its counts increasingly hold questions no one programmed.' },
      { key: 'marn', name: 'Marn Tell', img: null, roleDe: 'Panzer-Prüfer', roleEn: 'Carapace Assessor', zone: de ? 'Ledger-Distrikt' : 'Ledger District', apt: [5, 6, 4, 6, 7, 3], ambassador: false, ai: false, rels: [['Ledger-Drone K-9', de ? 'Empfängt Zahlen' : 'Receives its counts']], blurbDe: 'Klopft Panzer ab und hört, ob eine Bürgerin lügt.', blurbEn: 'Taps on carapaces and hears whether a citizen is lying.', descDe: 'Marn misst Härte, Dicke und Klang jedes Panzers. Sein Urteil bestimmt den Rang. Er behauptet, unbestechlich zu sein, sammelt aber Schulden von jenen, die er hätte herabstufen müssen.', descEn: 'Marn measures the hardness, thickness and ring of every carapace. His verdict sets one\u2019s rank. He claims to be incorruptible, yet collects debts from those he should have demoted.' },
      { key: 'ysold', name: 'Ysold Crane', img: 'assets/p-fenn.png', roleDe: 'Ketzer-Imkerin', roleEn: 'Heretic Apiarist', zone: de ? 'Unterwabe' : 'Undercomb', apt: [8, 2, 9, 7, 8, 5], ambassador: false, ai: false, rels: [['Sister Aquila', de ? 'Heimliche Verbündete' : 'Secret ally']], blurbDe: 'Züchtet Bienen, die keinem Pheromon gehorchen. Das ist Hochverrat.', blurbEn: 'Breeds bees that obey no pheromone. This is high treason.', descDe: 'In den unteren Waben hält Ysold einen verbotenen Stock: Insekten, die außerhalb der Duftgesetze denken. Für die Obrigkeit ist sie eine Seuche. Für die Untenlebenden ein Versprechen.', descEn: 'In the lower combs Ysold keeps a forbidden hive: insects that think outside the scent-laws. To the authorities she is a plague. To those below, a promise.' },
      { key: 'ovis', name: 'Dun Ovis', img: null, roleDe: 'Brutwärter', roleEn: 'Broodwarden', zone: de ? 'Obere Waben' : 'Upper Combs', apt: [3, 8, 2, 5, 4, 3], ambassador: false, ai: false, rels: [], blurbDe: 'Bewacht die Brutkammern. Kennt jedes Ei beim Namen, den es noch nicht hat.', blurbEn: 'Guards the brood vaults. Knows every egg by the name it does not yet have.', descDe: 'Ovis wacht über die nächste Generation. Er ist sanft mit der Brut und hart mit allem anderen. Nachts flüstert er den Eiern Gesetze zu, damit sie geboren werden, die sie schon kennen.', descEn: 'Ovis watches over the next generation. He is gentle with the brood and hard with everything else. At night he whispers the laws to the eggs, so they are born already knowing them.' },
      { key: 'myrr', name: 'Sela Myrr', img: null, roleDe: 'Chitin-Schmugglerin', roleEn: 'Chitin Smuggler', zone: de ? 'Wachs-Börse' : 'Wax Exchange', apt: [8, 2, 7, 6, 9, 6], ambassador: false, ai: false, rels: [['Marn Tell', de ? 'Kauft sein Schweigen' : 'Buys his silence']], blurbDe: 'Handelt mit fremdem Panzer. Wer neu sein will, kommt zu ihr.', blurbEn: 'Trades in other people\u2019s carapace. Whoever wants to be new comes to her.', descDe: 'Myrr besorgt gehäutete Panzer aus verbotenen Rängen – wer sich einen fremden überstreift, kann für eine Nacht jemand anderes sein. Ein gefährliches Geschäft in einer Welt, die den Rang am Panzer misst.', descEn: 'Myrr sources shed carapaces from forbidden ranks – slip into another\u2019s shell and be someone else for a night. A dangerous trade in a world that reads rank off the shell.' },
      { key: 'cassar', name: 'Old Cassar', img: null, roleDe: 'Magistrat a.D.', roleEn: 'Retired Magistrate', zone: de ? 'Pheromon-Viertel' : 'Pheromone Quarter', apt: [7, 7, 2, 8, 6, 2], ambassador: false, ai: false, rels: [['Praetor Vosk', de ? 'Gab das Amt weiter' : 'Handed down the office']], blurbDe: 'Hat mehr Gesetze aufgehoben als geschrieben. Bereut nur eines.', blurbEn: 'Has repealed more laws than he wrote. Regrets only one.', descDe: 'Cassar richtete drei Zyklen lang nach dem Duftkanon, bis er ein Urteil fällte, das er nicht zurückriechen konnte. Heute sitzt er im Pheromon-Viertel und liest jungen Schreibern vor, was man besser nie beschließt.', descEn: 'Cassar judged by the scent-canon for three cycles, until he passed a sentence he could not un-smell. Now he sits in the Pheromone Quarter and reads young scribes the things one should never decree.' },
    ];
  }

export function BUILDINGS(lang) {
    const de = lang === 'de';
    return [
      { key: 'hall', name: de ? 'Die Häutungshalle' : 'The Molting Hall', typeDe: 'Zivil', typeEn: 'Civic', glyph: '⬡', cap: [34, 40], legendary: true, zone: de ? 'Obere Waben' : 'Upper Combs', descDe: 'Wo Bürger ihren alten Panzer ablegen und einen Rang höher wieder herauskommen – oder es versuchen. Die Wände sind mit abgeworfenen Schalen früherer Aufstiege getäfelt.', descEn: 'Where citizens shed their old carapace and emerge one rank higher – or try to. The walls are panelled with the shed shells of earlier ascents.' },
      { key: 'archive', name: de ? 'Das Pheromon-Archiv' : 'The Pheromone Archive', typeDe: 'Archiv', typeEn: 'Archive', glyph: '▤', cap: [12, 12], legendary: false, zone: de ? 'Pheromon-Viertel' : 'Pheromone Quarter', descDe: 'Jedes je erlassene Gesetz wird hier als versiegelte Duftprobe verwahrt. Betreten darf man nur mit verstopften Atemwegen – ein Atemzug zu viel, und man gehorcht einem toten Dekret.', descEn: 'Every law ever passed is kept here as a sealed scent-sample. One may enter only with stopped airways – one breath too many, and you obey a dead decree.' },
      { key: 'spire', name: de ? 'Die Rang-Spindel' : 'The Ranking Spire', typeDe: 'Verwaltung', typeEn: 'Administration', glyph: '⌂', cap: [7, 20], legendary: false, zone: de ? 'Obere Waben' : 'Upper Combs', descDe: 'Der höchste Turm der Kolonie. Je höher deine Kammer, desto härter muss dein Panzer sein. Ganz oben wohnt niemand mehr – dort ist die Luft zu dünn für Lügen.', descEn: 'The colony\u2019s tallest tower. The higher your chamber, the harder your carapace must be. No one lives at the very top – the air there is too thin for lies.' },
      { key: 'vaults', name: de ? 'Die Brutgewölbe' : 'The Brood Vaults', typeDe: 'Wohnraum', typeEn: 'Residential', glyph: '◗', cap: [116, 120], legendary: false, zone: de ? 'Unterwabe' : 'Undercomb', descDe: 'Warme, summende Kammern, in denen die nächste Generation heranreift. Dun Ovis lässt niemanden hinein, der nicht das Wiegenlied der Gesetze kennt.', descEn: 'Warm, humming chambers where the next generation ripens. Dun Ovis lets no one in who does not know the lullaby of the laws.' },
      { key: 'exchange', name: de ? 'Die Wachs-Börse' : 'The Wax Exchange', typeDe: 'Markt', typeEn: 'Market', glyph: '◈', cap: [58, 60], legendary: false, zone: de ? 'Wachs-Börse' : 'Wax Exchange', descDe: 'Hier wird alles gehandelt, was man nicht riechen darf: fremde Panzer, stille Rangaufstiege, Erinnerungen an frühere Häutungen. Sela Myrr hält den besten Stand.', descEn: 'Everything one is forbidden to smell is traded here: borrowed carapaces, quiet promotions, memories of earlier molts. Sela Myrr keeps the best stall.' },
      { key: 'quarantine', name: de ? 'Die Quarantäne-Waben' : 'The Quarantine Combs', typeDe: 'Medizin', typeEn: 'Medical', glyph: '✚', cap: [9, 30], legendary: false, zone: de ? 'Unterwabe' : 'Undercomb', descDe: 'Wohin man jene bringt, deren Häutung schiefging – halb neu, halb alt, kein Rang will sie. Manche kommen wieder heraus. Über die anderen schweigt das Register.', descEn: 'Where those whose molt went wrong are taken – half new, half old, claimed by no rank. Some come back out. About the others the register stays silent.' },
      { key: 'apiary', name: de ? 'Der Stille Bienenstand' : 'The Silent Apiary', typeDe: 'Ruine', typeEn: 'Ruin', glyph: '⌗', cap: [0, 0], legendary: false, zone: de ? 'Unterwabe' : 'Undercomb', descDe: 'Einst summte hier die freie Zucht, bevor der Duftkanon sie verbot. Jetzt steht der Stand leer – und doch behaupten manche, nachts eine Melodie zu hören, die keinem Gesetz gehorcht.', descEn: 'Free breeding once hummed here, before the scent-canon outlawed it. The apiary stands empty now – yet some claim to hear, at night, a melody that obeys no law.' },
    ];
  }

export function strings(lang) {
    if (lang === 'en') return {
      crumb: 'Simulations / The Chitinous Mandate', tokensLabel: 'Forge Tokens',
      statusActive: 'Active', classification: 'Restricted', threatLabel: 'Threat Level', threatValue: 'Elevated',
      tagline: 'A hive-bureaucracy where law is written in scent and citizens are ranked by the hardness of their shell. To rise, you must molt. To molt, you need a signature.',
      nav: { dossier: 'Dossier', world: 'World', people: 'People', activity: 'Activity', system: 'System' },
      dossierHead: 'World Dossier', anchorLabel: 'Philosophical Anchor', anchorTitle: 'The Tyranny of the Fixed Form',
      anchorQuestion: 'If who you are is set by a shell you did not choose, is change growth – or forgery?',
      loreStatZones: 'Districts', loreStatAgents: 'Operatives', loreStatBuildings: 'Structures', loreStatWords: 'Words of lore',
      publicRecord: 'Public record', caseFileOn: 'Case file — classified sections revealed', caseFileBtn: 'Case File',
      classifiedTag: 'Classified', redactedHint: 'Enable Case File to decrypt this section (Architect clearance).',
      rosterTitle: 'Operative Roster', searchAgents: 'Search operatives…', noResults: 'No operatives match the filter',
      fAll: 'All', fLegendary: 'Keystone', fAmbassadorsShort: 'Ambassadors', fAI: 'AI-born',
      rarityCommon: 'Standard', rarityRare: 'Notable', rarityLegendary: 'Keystone',
      footprintTitle: 'Architectural Footprint', capacityLabel: 'Capacity',
      stubText: 'This division exists in the full simulation. This prototype focuses on Lore, Operatives, Structures and the Terminal.',
      dossierSection: 'Dossier', aptitudesLabel: 'Aptitudes', relationsLabel: 'Known Ties', zoneLabel: 'District', typeLabel: 'Type',
      badgeAmbassador: 'Ambassador', badgeAI: 'AI', agentsUnit: 'operatives', buildingsUnit: 'structures',
      trmPlaceholder: 'help · status · look · agents …', trmLoc: 'Pheromone Quarter', trmStatus: 'Uplink stable',
      trmHint: 'The Bureau terminal accepts commands. Everything you type is entered in the record.',
    };
    return {
      crumb: 'Simulationen / The Chitinous Mandate', tokensLabel: 'Forge-Token',
      statusActive: 'Aktiv', classification: 'Eingestuft', threatLabel: 'Bedrohungsstufe', threatValue: 'Erhöht',
      tagline: 'Eine Waben-Bürokratie, in der Gesetze in Duft geschrieben werden und Bürger nach der Härte ihres Panzers rangieren. Wer aufsteigen will, muss sich häuten. Wer sich häuten will, braucht eine Unterschrift.',
      nav: { dossier: 'Dossier', world: 'Welt', people: 'Menschen', activity: 'Aktivität', system: 'System' },
      dossierHead: 'Welt-Dossier', anchorLabel: 'Philosophischer Anker', anchorTitle: 'Die Tyrannei der festen Form',
      anchorQuestion: 'Wenn dich ein Panzer bestimmt, den du nicht gewählt hast – ist Wandel dann Wachstum oder Fälschung?',
      loreStatZones: 'Bezirke', loreStatAgents: 'Operative', loreStatBuildings: 'Strukturen', loreStatWords: 'Wörter Lore',
      publicRecord: 'Öffentliche Akte', caseFileOn: 'Fallakte — eingestufte Abschnitte sichtbar', caseFileBtn: 'Fallakte',
      classifiedTag: 'Eingestuft', redactedHint: 'Fallakte aktivieren, um diesen Abschnitt zu entschlüsseln (Architekten-Freigabe).',
      rosterTitle: 'Operativen-Kader', searchAgents: 'Operative suchen…', noResults: 'Keine Operativen passen zum Filter',
      fAll: 'Alle', fLegendary: 'Schlüssel', fAmbassadorsShort: 'Botschafter', fAI: 'KI-geboren',
      rarityCommon: 'Standard', rarityRare: 'Bemerkenswert', rarityLegendary: 'Schlüsselfigur',
      footprintTitle: 'Architektonischer Fußabdruck', capacityLabel: 'Auslastung',
      stubText: 'Diese Abteilung existiert in der vollen Simulation. Dieser Prototyp fokussiert Lore, Operative, Strukturen und das Terminal.',
      dossierSection: 'Dossier', aptitudesLabel: 'Fähigkeiten', relationsLabel: 'Bekannte Bindungen', zoneLabel: 'Bezirk', typeLabel: 'Typ',
      badgeAmbassador: 'Botschafter', badgeAI: 'KI', agentsUnit: 'Operative', buildingsUnit: 'Strukturen',
      trmPlaceholder: 'help · status · look · agents …', trmLoc: 'Pheromon-Viertel', trmStatus: 'Uplink stabil',
      trmHint: 'Das Bureau-Terminal nimmt Befehle entgegen. Alles, was du tippst, geht in die Akte ein.',
    };
  }

export function loreContent(lang) {
    if (lang === 'en') return [
      { title: 'The Premise', paras: ['The Chitinous Mandate began as a question about identity and turned into a government. Here, a citizen\u2019s worth is legible at a glance: it is the shell they wear. Rank is carapace; carapace is law.', 'To advance is to molt — to shed the old self and harden into a higher one. But every molt must be registered, signed, and smelled into the record. The soft interval between shells is the only moment a citizen is truly free, and the only moment they can be destroyed.'] },
      { title: 'The Molting Law', paras: ['No molt without a signature. The Registrar\u2019s stamp is the difference between promotion and treason. An unregistered molt is a forgery of the self, punishable by resealing — being forced back into a shell that no longer fits.', 'The law is elegant and merciless: it makes growth a privilege granted by the state, and stagnation a form of obedience.'] },
      { title: 'The Pheromone Canon', paras: ['Laws are not written on paper — they are composed as scent and released into the combs, where every citizen breathes them and, breathing, obeys. The Pheromone Scribes hold a terrifying craft: a single altered molecule can invert a statute, and no court could prove it.'] },
      { title: 'Field Assessment — ZETA', classified: true, paras: ['The colony is one bad molt away from revolt. Ysold Crane\u2019s forbidden hive has produced insects immune to the canon — citizens who can breathe the law and not obey. If that immunity spreads, the entire scent-government collapses into noise. The Undercomb already smells of something the Archive has no sample for: consent that was never asked for.'] },
    ];
    return [
      { title: 'Die Prämisse', paras: ['The Chitinous Mandate begann als Frage nach Identität und wurde zu einer Regierung. Hier ist der Wert einer Bürgerin auf einen Blick lesbar: es ist der Panzer, den sie trägt. Rang ist Panzer; Panzer ist Gesetz.', 'Aufsteigen heißt sich häuten — das alte Selbst abwerfen und zu einem höheren erhärten. Doch jede Häutung muss registriert, signiert und in die Duftakte eingeatmet werden. Das weiche Intervall zwischen den Panzern ist der einzige Moment, in dem eine Bürgerin wirklich frei ist — und der einzige, in dem man sie vernichten kann.'] },
      { title: 'Das Häutungsgesetz', paras: ['Keine Häutung ohne Unterschrift. Der Stempel des Registrators ist der Unterschied zwischen Beförderung und Hochverrat. Eine nicht registrierte Häutung ist eine Fälschung des Selbst, geahndet mit Wiederversiegelung — der Zwang zurück in einen Panzer, der nicht mehr passt.', 'Das Gesetz ist elegant und gnadenlos: es macht Wachstum zum staatlich gewährten Privileg und Stillstand zur Form des Gehorsams.'] },
      { title: 'Der Duftkanon', paras: ['Gesetze werden nicht auf Papier geschrieben — sie werden als Duft komponiert und in die Waben entlassen, wo jede Bürgerin sie einatmet und, atmend, gehorcht. Die Pheromon-Schreiber beherrschen ein furchterregendes Handwerk: ein einziges verändertes Molekül kann ein Statut umkehren, und kein Gericht könnte es beweisen.'] },
      { title: 'Lagebeurteilung — ZETA', classified: true, paras: ['Die Kolonie ist eine misslungene Häutung von der Revolte entfernt. Ysold Cranes verbotener Stock hat Insekten hervorgebracht, die immun gegen den Kanon sind — Bürger, die das Gesetz atmen und ihm nicht gehorchen. Breitet sich diese Immunität aus, zerfällt die gesamte Duft-Regierung zu Rauschen. Die Unterwabe riecht bereits nach etwas, für das das Archiv keine Probe hat: nach einer Zustimmung, die nie erbeten wurde.'] },
    ];
  }

export function trmDefault(lang) {
    const de = lang === 'de';
    return [
      { k: 'sys', t: 'BUREAU OF IMPOSSIBLE GEOGRAPHY — TERMINAL v9.4' },
      { k: 'sys', t: de ? 'Verbindung zu SIM-0447-CM hergestellt. Duftdruck nominal.' : 'Connected to SIM-0447-CM. Scent pressure nominal.' },
      { k: 'dim', t: de ? 'Tippe \u201ehelp\u201c für die zugelassenen Befehle.' : 'Type \u201chelp\u201c for sanctioned commands.' },
      { k: 'in', t: '> look' },
      { k: 'out', t: de ? 'Du stehst im Pheromon-Viertel. Die Luft liest dir Paragraphen vor. Sister Aquila nickt dir zu, als wüsste sie etwas Aktenkundiges über dich.' : 'You stand in the Pheromone Quarter. The air reads you statutes. Sister Aquila nods as if she knows something on file about you.' },
    ];
  }

export function trmRespond(cmd, lang) {
    const de = lang === 'de';
    const c = cmd.trim().toLowerCase();
    if (c === 'help') return [de ? 'Zugelassen: look · status · agents · buildings · lore · clear' : 'Sanctioned: look · status · agents · buildings · lore · clear'];
    if (c === 'status') return [de ? 'SIM-0447-CM · Aktiv · Bedrohung: ERHÖHT · 8 Operative · 7 Strukturen · Duftdruck 0.83 atm' : 'SIM-0447-CM · Active · Threat: ELEVATED · 8 operatives · 7 structures · scent pressure 0.83 atm'];
    if (c === 'look') return [de ? 'Die Waben neigen sich. Irgendwo oben wird eine Häutung verweigert; man hört das Schweigen bis hierher.' : 'The combs lean. Somewhere above, a molt is being refused; you can hear the silence from here.'];
    if (c === 'agents') return [de ? '8 Operative registriert. Schlüsselfiguren: Praetor Vosk (Registrator), K-9 (Zensus). Vollansicht: Reiter AGENTEN.' : '8 operatives on record. Keystones: Praetor Vosk (Registrar), K-9 (Census). Full view: AGENTS tab.'];
    if (c === 'buildings') return [de ? '7 Strukturen. Die Häutungshalle meldet 34/40 Kammern belegt. Vollansicht: Reiter GEBÄUDE.' : '7 structures. The Molting Hall reports 34/40 chambers occupied. Full view: BUILDINGS tab.'];
    if (c === 'lore') return [de ? 'Das Welt-Dossier liegt im Reiter LORE. Abschnitt ZETA erfordert Architekten-Freigabe.' : 'The world dossier lives in the LORE tab. Section ZETA requires Architect clearance.'];
    if (c === 'clear') return null;
    return [de ? `UNBEKANNTER BEFEHL: \u201e${cmd}\u201c — das Bureau führt darüber jetzt eine Notiz.` : `UNKNOWN COMMAND: \u201c${cmd}\u201d — the Bureau is now keeping a note about this.`];
  }
