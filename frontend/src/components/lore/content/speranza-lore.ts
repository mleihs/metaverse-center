import { msg } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

/**
 * Speranza — Arc Raiders Post-Apocalyptic
 * Voice: Oral history, raid field reports, contrada bulletins, graffiti, children's rhymes
 * Inspirations: Arc Raiders, The Road, Station Eleven, Italian neorealism, NASA-punk, Le Guin
 */
export function getSperanzaLoreSections(): LoreSection[] {
  return [
    {
      id: 'the-subsidence',
      chapter: msg('The Fall — How the World Broke'),
      arcanum: 'I',
      title: msg('The Subsidence — How Toledo Fell Beneath the Earth'),
      epigraph: msg(
        'The ground opened and the city went down. This is not a metaphor. The ground literally opened. The city literally went down.',
      ),
      imageSlug: 'the-subsidence',
      imageCaption: msg(
        'The Subsidence — The day the limestone gave way and Toledo fell into the earth',
      ),
      body: msg(`ORAL HISTORY — Recorded at the Canteen, Speranza
SPEAKER: Nonna Grazia, age 94, original Subsidence survivor
RECORDED BY: Lina Russo, Tube Network, for the Contrada Archive
DATE: Year 143 of the Underground

(sound of a spoon against a bowl — the tomato soup is always the same, and Nonna Grazia always eats while she talks, because she says food and memory come from the same place)

GRAZIA: You want to know how it happened. Everyone wants to know how it happened. The young ones especially — they look at the ceiling and try to imagine sky, and they can't, because sky is not something you imagine. It's something you remember, and they have nothing to remember. So they ask, and I tell them, and they nod like they understand, but they don't. You can't understand sky from a description. It's too big for words.

I was eleven when the ground opened. That's what we call it — "the ground opened" — as though the earth politely made way. It didn't. It fell. Kilometres of limestone, undermined by centuries of quarrying and aquifer depletion and whatever the machines were doing underground before we knew they were there, and one morning the centre of Toledo — the old city, the cathedral, the alcázar, the squares where my grandmother sold oranges — dropped thirty metres into the earth like a trapdoor. The sound was — have you ever heard the Slingshot fire? Multiply it by a thousand and make it last for six minutes. That's what the Subsidence sounded like.

The first day, everyone thought it was an earthquake. The second day, the rescue teams went down and found that the collapsed area was — this is the part people don't believe, but I was there and I am not a liar — *intact*. The buildings hadn't been destroyed. They'd been lowered. Whole streets sitting in limestone caverns like exhibits in a museum, streetlights still on, cars still parked, a coffee pot I later learned was still percolating in a café on Calle del Comercio. The earth hadn't broken the city. It had *swallowed it whole*.

The third day, the ARC machines came.

We didn't call them ARC then. We didn't call them anything. They were just shapes on the horizon — big shapes, bigger than buildings, moving in formation with a precision that made the military drones look like toys. Nobody knew where they came from. Nobody knew what they wanted. What they wanted, we learned over the next three weeks, was everything. Every structure on the surface. Every vehicle. Every piece of infrastructure. They dismantled the world above with the efficiency of someone clearing a table after dinner, and they did it without malice, without rage, without any emotion that we could identify. They were *tidying up*. That's what it looked like. As though humanity had been a temporary installation and the lease had expired.

The survivors — and there were more than you'd think, because limestone caverns are excellent bomb shelters even when the bombs are the size of cathedrals — gathered in the largest cavern we could find. A natural amphitheater, carved by an underground river that had dried up centuries ago, with passages leading in five directions and a ceiling high enough that you couldn't see it by torchlight. Someone — I don't remember who, and I've been asked a hundred times — said: "We stay." Not a vote. Not a debate. Just a statement, spoken by someone who understood that the surface was over and the only question left was whether we would grieve upward or build downward.

We built downward.

That amphitheater is now the Hub. The passages are now the first five contrade. The ceiling I couldn't see by torchlight is now hung with a thousand string lights that the children call stars, and I do not correct them, because they are right. A star is a light that tells you where you are. These lights tell us where we are.

We are underground. We are alive. And we are not going back up.

(pause — the sound of soup)

GRAZIA: You know what I miss? Not the sky. Not the sun. I miss oranges. My grandmother's oranges, from her tree in the courtyard, warm from the afternoon. Everything else I can live without.

But the oranges. Those were something.`),
    },
    {
      id: 'year-one',
      chapter: msg('The Fall — How the World Broke'),
      arcanum: 'II',
      title: msg('Year One — Founding of the Contrade'),
      epigraph: msg(
        'A contrada is not a neighbourhood. A contrada is a promise that the people who live next to you will not let you starve.',
      ),
      imageSlug: 'year-one',
      imageCaption: msg(
        'Year One — The first shelters, built from whatever the surface left behind',
      ),
      body: msg(`CONTRADA BULLETIN — Speranza Historical Archive
WRITTEN BY: The Archive Committee (eleven contributors, four of whom disagree with each other on every major point; this is considered healthy)
OCCASION: The 143rd Anniversary of the Founding
DISTRIBUTED: All contrade, via Tube post

TO THE CITIZENS OF TOLEDO, UNDERGROUND:

One hundred and forty-three years ago, the Subsidence dropped the centre of Toledo into the earth, the ARC machines erased the surface, and approximately eight thousand human beings found themselves living in limestone caverns with no government, no infrastructure, no supply chain, and no plan.

Year One was not heroic. Year One was terrified. People huddled in passages. Children cried. The elderly died of exposure before anyone thought to build shelters, because shelters require materials and materials require organisation and organisation requires trust, and trust is the first casualty of catastrophe. In those first weeks, people stole food. People fought over blankets. People did what desperate mammals have always done when the world narrows to survival: they competed.

The contrada system was not designed. It emerged. It began in the amphitheater — the space that is now Speranza's Hub — when a woman named Lucia Speranza (yes, the contrada is named for her; no, she did not ask for this and would have been annoyed by it) stood on a piece of rubble and said, approximately: "We can either kill each other over blankets or we can share the blankets and kill each other over something more interesting later."

This was not an inspiring speech. Lucia Speranza was not an inspiring person. She was a mechanic. She fixed things. And what she saw, standing on that rubble, was a broken system — eight thousand people acting as eight thousand individuals, each one weaker than the sum of them. She proposed a structure. Not a government — she had no patience for governments, having lived under three of them, none satisfactory. She proposed *neighbourhoods*. Groups of two to five hundred people, living in proximity, sharing resources by agreement. Each group would have a name, a territory (a section of the cavern system), and a single rule: nobody sleeps cold if someone else has a blanket.

That was it. That was the founding principle of the contrade system that now governs seventeen underground settlements connected by 400 kilometres of Tube network. Not democracy. Not socialism. Not any -ism that the political theorists of the surface would recognise. Just: *share the blanket*.

The first five contrade formed within a month. Speranza (the largest, anchored in the amphitheater). Brenner (to the north, in a section of collapsed metro tunnel — many of the early residents were rail workers who knew how to survive underground). Stella (to the east, named by children who refused to believe the stars were gone). Ferrovia (south, built into a disused railway depot). And Profondo (deep, the furthest from the surface, settled by people who wanted as much stone between themselves and the machines as possible).

The early years were hard in ways that are difficult to convey to those who grew up with the Slingshot and the trading network and the knowledge that the tomato soup, whatever else happens, will be served at noon and at six. The early years involved eating insects. Drinking condensation. Burning furniture for warmth before anyone figured out that the deep-bore wells produced gas that could be piped for heating and cooking. The infant mortality rate in Year Three was one in four. The Archive Committee records this without editorialising, because the number speaks for itself and anything we could add would diminish it.

But the contrade held. They held because the principle was sound: a group of people who have agreed to share is stronger than a crowd of people who haven't. Disagreements were resolved by the councils — elected representatives, one per fifty residents, who met weekly and argued passionately about everything and resolved most things by compromise and the rest by exhaustion. Violence was not punished; it was *mourned*, which turned out to be more effective. When someone hurt someone else, the contrada didn't imprison them — it sat them down in the Canteen, in front of everyone, and asked them to explain. Public accounting. Public shame. Public forgiveness. It was messy. It was human. It worked.

Lucia Speranza died in Year Seven of a respiratory infection that Dottor Ferrara's grandfather could have treated if he'd had antibiotics, which he didn't, because the surface was gone and pharmaceutical manufacturing requires infrastructure that didn't exist yet. She died in the Canteen, surrounded by people eating tomato soup, and her last words — according to three witnesses who all remember them differently — were either "Tell them to fix the heating in Block Three" or "The soup needs more salt" or simply "More."

We choose to remember all three. They are all equally true. They are all equally her.

The contrade endure. One hundred and forty-three years. Seventeen settlements. Sixty thousand people.

All because one mechanic stood on a rock and said: share the blanket.

— The Archive Committee, Speranza`),
    },
    {
      id: 'slingshot-and-tube',
      chapter: msg('The Life — How We Live Down Here'),
      arcanum: 'III',
      title: msg('The Slingshot & The Tube — How the World Moves Underground'),
      epigraph: msg(
        'Sound travels faster than light down here, because there is no light. So we navigate by echo, and we move by thunder.',
      ),
      imageSlug: 'slingshot-and-tube',
      imageCaption: msg(
        'The Slingshot Hub — Where electromagnetic rails fire cargo at 200 km/h through limestone tunnels',
      ),
      body: msg(`TECHNICAL MANUAL — Tube Network Operations
WRITTEN BY: Lina Russo, Slingshot Operator, Third Class (she will not let you forget the Third Class part; she earned it)
INTENDED AUDIENCE: New operators, curious civilians, and anyone who thinks the Tube is "just a train"
WARNING: The Tube is not a train. Trains have schedules. The Tube has intentions.

The Tube is the circulatory system of Toledo Underground. Seventeen contrade, spread across a cavern network that stretches 400 kilometres from Profondo in the deep south to Vetta in the north (Vetta is only 200 metres below the surface; the residents consider this dangerously exposed and the rest of us consider them slightly mad). Between these contrade, carved into the limestone by a combination of pre-Subsidence mining tunnels, natural fissures, and fifty years of determined engineering, runs the Tube: a network of electromagnetic rails that fire cargo pods at speeds up to 200 kilometres per hour.

The Slingshot — that's what we call the launcher, the main terminal in each contrada where the pods are loaded, aimed, and fired — is the single most important piece of technology we have. More important than the water recyclers. More important than the gas pipes. More important than the UV lamps that grow the tomatoes that make the soup that keeps us sane. Because without the Slingshot, each contrada is alone. And alone, underground, is another word for dead.

How it works: imagine a gun, forty metres long, built from capacitor banks salvaged from a pre-Subsidence power plant, cooled by industrial air conditioning units that Enzo Moretti rebuilt from parts he found in a collapsed department store, powered by geothermal gas piped from deep-bore wells, and aimed using hand-drawn trajectory charts that account for tunnel curvature, limestone density, moisture levels, and the mood of the operator. I'm not joking about the last part. The Tube responds to the operator. Not mechanically — electromagnetically. The rails hum, and the hum changes depending on the tunnel conditions, and an experienced operator can hear the difference between "clear tunnel, good conductivity, fire when ready" and "partial collapse at kilometre forty-seven, reroute or reduce velocity."

I hear it. I've always heard it. The hum is how I navigate.

A pod launch goes like this: cargo is loaded into a cylindrical pod — two metres long, one metre diameter, reinforced ceramic shell with shock-absorbing interior. The pod is placed on the rail. The capacitors charge — you can feel it in your teeth, a low vibration that builds until the air tastes like metal and every hair on your arms stands up. The operator — that's me — reads the hum, checks the trajectory, and fires. The pod accelerates from zero to 200 km/h in 1.4 seconds. It enters the tunnel. It is gone. At the receiving end, the catching array — a reverse-polarity section of rail that decelerates the pod — brings it to a stop. Cargo intact. Delivered. Time from Speranza to Brenner: eleven minutes.

The pods carry everything. Food. Medicine. Machine parts. Letters (yes, we still write letters; the radio network covers emergency communications but letters carry the things that emergencies don't — gossip, love notes, recipes, arguments about whose grandmother made better bread). Trade goods. Salvage from Topside raids. Occasionally, people — though passenger pods are larger, slower, and equipped with padding that passengers describe as "insufficient."

The failures are the part we don't talk about at ceremonies. Tunnel collapses. Capacitor blowouts — I have the scars on both forearms from a brake failure during my certification run, when the receiving array lost power and I had to reverse-fire the launch rail to decelerate an incoming pod manually. Misalignment incidents, where a pod enters a junction at the wrong angle and ricochets off the tunnel wall at 180 km/h, which is exciting in a way I never want to experience again. We lose a pod perhaps once a year. We have never lost a passenger. This is the statistic I am most proud of, and it is the one I think about every time I put my hands on the controls.

The Tube connects us. I don't mean this sentimentally — I mean it literally. Without the Tube, Speranza is a single contrada of seven hundred people in a limestone cavern. With the Tube, Speranza is part of a civilisation. A small, underground, frequently-arguing, tomato-soup-fuelled civilisation, but a civilisation nonetheless. The pods carry food and medicine and machine parts, but what they really carry is proof: proof that someone at the other end cared enough to send something, proof that we are not alone, proof that the network holds.

I navigate by sound. The hum tells me what the tunnel is thinking. The echo tells me what the tunnel has seen. Every launch is a conversation between the operator and the Tube, and the Tube, if you listen — if you really listen, with the cable burns on your arms and the trajectory charts in your head and sixty thousand people depending on the next eleven minutes — the Tube listens back.

Fire when ready.`),
    },
    {
      id: 'raid-log-147',
      chapter: msg('The Raids — What We Take From the Sky'),
      arcanum: 'IV',
      title: msg('Raid Log — Cinghiali Squad, Entry 147'),
      epigraph: msg(
        'Topside Rule One: Move fast. Topside Rule Two: Be quiet. Topside Rule Three: If a Matriarch appears, there is no Rule Three.',
      ),
      body: msg(`RAID LOG — CLASSIFIED: OPERATIONAL
SQUAD: Cinghiali (Wild Boars)
SQUAD LEADER: Capitana Rosa Ferretti
ENTRY: 147
OBJECTIVE: Salvage run, Grid Reference T-14 (former industrial district, northeast sector)
DURATION: 4 hours 12 minutes (surface exposure)
WEATHER: Overcast, wind from the west, visibility 800 metres
ARC PRESENCE: Moderate (2 Snitch patrols logged, 1 Tick patrol at range)

PERSONNEL:
- Ferretti, R. (Capitana) — Squad lead, overwatch
- Vidal, T. (Raider) — Point, salvage
- Ramos, S. (Raider) — Flanking, demolition
- Ortiz, H. (Raider) — Comms, medical
- Bianchi, M. (Raider) — Heavy carry, salvage

0415 — Exit via Blast Door Tunnel 3. Topside cold. Frost on the rubble. The machines don't care about weather but we do — cold means less infrared signature, which means the Snitches have to work harder to spot us. Good. Let them work.

0422 — Movement in formation along Route 7 (collapsed highway, good cover). Vidal on point. The kid is getting better. Three months ago he'd have been crouching too high and moving too fast. Now he moves like he was born Topside, which is the highest compliment I can give and which I will never say to his face because compliments make raiders lazy.

0441 — First Snitch contact. Single unit, football-sized, scanning UV and infrared in a standard sweep pattern. We froze. The Snitch passed at forty metres. It did not detect us. Snitches operate on a 90-second relay cycle — if you stay still for 90 seconds, they move on. If they spot you, the clock starts: 90 seconds until heavier units arrive. This is the number that every raider memorises, because it is the number that separates "successful raid" from "funeral."

0503 — Reached Grid T-14. The industrial district is a graveyard of factories, warehouses, and workshops. The machines have been through here — the large structures are dismantled to the foundations — but the smaller buildings, the ones the machines presumably didn't consider worth their time, are intact. I will never understand the machines' priorities. They dismantle a power plant and leave a auto repair shop standing. They flatten a hospital and ignore a warehouse full of machine tools. Either their priorities are alien or they are making aesthetic choices, and I do not like either explanation.

0507 — Salvage operation begins. Target: an electrical supply warehouse, partially collapsed but with accessible interior. Vidal and Bianchi on salvage. Ramos on perimeter. Ortiz on comms, monitoring the Watchtower's radio channel for ARC movement alerts.

0512–0638 — Salvage. What we found: 340 metres of copper wiring (the Guild of Gears will pay well for this). 47 intact circuit breakers. A crate of capacitors that Enzo Moretti will cry over when he sees them — the good kind, pre-Subsidence manufacture, rated for the voltages the Slingshot needs. Medical supplies from a first-aid station: antibiotics (expired but Ferrara says they're still good), surgical tape, a blood pressure cuff that Ortiz immediately claimed for the Infirmary.

0644 — Vidal spotted it first. Tick patrol — large-dog-sized, six-legged, cutting arms deployed. Range: 200 metres and closing. Moving along our exfil route. Standard patrol pattern, but between us and the Blast Door.

Decision point. Wait for the Tick to pass (estimated 15 minutes). Or reroute via the collapsed overpass (adds 40 minutes to the return, through unscouted terrain). Or fight.

We don't fight. Not because we can't — Ramos carries the Frankengun, Enzo's handheld EMP device cobbled from ARC capacitors, effective at 30 metres — but because fighting draws Snitches, and Snitches draw heavier units, and heavier units draw the one thing no raider wants to see, which is a Surveyor, and if a Surveyor deploys its scanning field, everything within 200 metres that registers as organic gets flagged for "collection," and nobody who has been collected has come back.

0644–0659 — We waited. The Tick patrolled. It passed our position at 80 metres. Close enough to see the cutting arms flex. Close enough to see the rainbow-spectrum band — the Stripes — running along its dorsal plating. Every ARC machine has the Stripes. Nobody knows why. The Bureau of Impossible Geography says they're a "residual artefact." The children paint them on the walls because they're pretty. The raiders don't care why they're there. The raiders care about not being there when the machines are.

0700 — Tick passed. Exfil clear. We moved fast, loaded heavy, and made the Blast Door by 0727.

ASSESSMENT: Successful. High-value salvage. Zero casualties. Zero ARC engagement. This is a good raid. The best raids are the ones where nothing happens. I have led over two hundred raids and I can tell you that the thing that keeps you alive Topside is not courage. It is patience. The machines are patient. They do not hurry. They do not chase. They simply persist. And to outlast something that persists, you must be more patient than it is.

Vidal is learning this. Slowly. But he's learning.

SIGNED: Ferretti, R. (Capitana)
NOTE: The capacitors are for Enzo. Do not let the Council requisition them for general use. He needs them for the Slingshot. And also because he has been talking about them for three months and if he doesn't get them he will be unbearable.`),
    },
    {
      id: 'guild-of-gears',
      chapter: msg('The Community — What We Build From What We Find'),
      arcanum: 'V',
      title: msg('The Guild of Gears — On Taking Apart the Things That Hunt Us'),
      epigraph: msg(
        "An ARC machine is a terror on the surface. An ARC machine on Enzo's workbench is a treasure chest with very sharp edges.",
      ),
      body: msg(`GUILD OF GEARS — APPRENTICE ORIENTATION DOCUMENT
WRITTEN BY: Enzo Moretti, Master Mechanic, Guild of Gears
DISTRIBUTED TO: New apprentices, Year 143 intake (four this year; we are selective, but not unkind)
READ ALOUD AT: The Gear Forge, with the furnaces going, because everything sounds more important with furnaces

Welcome to the Guild of Gears.

You are here because you looked at a machine — one of the ARC units, the things that took the surface, the things that patrol the ruins and dismantle what's left of the world we built — and instead of seeing a monster, you saw a question. What is this made of? How does it work? And can we use it?

This is the correct question. This is the only question that matters down here. Because the surface is full of ARC machines, and ARC machines are full of components that we need, and the only thing standing between us and those components is fear, which is rational, and ignorance, which is curable.

I came to Speranza from Contrada Brenner when I was seven. I came in a passenger pod on the Tube, wrapped in a blanket that smelled like engine grease, because my mother was an engineer and the blanket was hers and she did not come with me. Brenner was failing — water table dropping, gas wells running dry, an ARC patrol that had started making regular passes close enough to the surface exits that the Watchtower couldn't guarantee safe movement. Half of Brenner relocated to other contrade. I was sent to Speranza because Speranza had a forge, and my mother believed that a boy who could take things apart should live in a place that valued the skill.

She was right. The Guild took me on as an apprentice at age twelve. By sixteen I could strip a Snitch unit to its components in forty minutes. By twenty I had built the Frankengun — a handheld electromagnetic pulse device assembled from ARC capacitor banks, Tube rail segments, and a trigger mechanism I fabricated from a car door handle. The Frankengun kills a Tick at thirty metres. It is ugly. It is unreliable in wet conditions. It has saved eleven lives, which is, I think, an acceptable return on ugliness.

What the Guild does:

We take apart ARC machines. Every component that the raid squads bring back — every circuit, every actuator, every fragment of the metamaterial the machines use for their shells — comes to the Forge. We catalogue it. We test it. We learn what it does. And then we repurpose it, because the machines that hunt us are made of the same fundamental materials as the machines that keep us alive, and the difference between a weapon and a tool is who holds it and what they intend.

ARC capacitors power the Slingshot. ARC sensor arrays, reversed, give the Watchtower its radar. ARC metamaterial, reshaped in the forge furnaces (which burn hot enough because they're fed by ARC thermal cells), becomes hull plating for cargo pods. We build our world from the corpses of the things that destroyed the old one. This is not revenge. This is recycling.

What the Guild believes:

Machines are not evil. I know this is an unpopular opinion. I know that every raid, every Watchtower alert, every story of a Surveyor's scanning field makes the machines feel like an enemy, and enemies are easier to face if you can hate them. But I have spent thirty years inside ARC technology, and I will tell you what I have found: efficiency. Not malice. Not hunger. Not cruelty. Efficiency. The machines do what they do because it is what they were designed to do, and the fact that we are in the way is, from their perspective, incidental.

This does not make them safe. This makes them understandable. And understanding is the beginning of every technology.

The Stripes — the rainbow-spectrum bands that run along every ARC machine, from the smallest Snitch to the largest Matriarch — I have studied them for two decades. They are not decorative. They are not a communication display. They are something else, something that our instruments can measure but not explain: a chromatic signature that corresponds to no known engineering purpose. The colours shift depending on the machine's activity — brighter during scanning, dimmer during dormancy, and occasionally, when a machine encounters something it cannot classify (which happens more often than you'd think), the Stripes pulse in a pattern that my instruments read as resonance. The machine is *vibrating* in sympathy with something. What that something is — the Bureau people, if any survived, would probably have a theory. I have a forge and a workbench and the honest admission that some things are beyond my understanding.

But not beyond my curiosity.

And that — curiosity, the unwillingness to stop asking questions, the refusal to treat mystery as a reason to stop working — is what the Guild is for. We are mechanics. We fix things. We take apart the impossible and make it useful. We build a civilisation from salvage, and we do it with our hands, and we do it every day, and we will keep doing it until the machines stop or we do.

Welcome to the Guild. Here is your wrench. The furnace is hot. There is work to do.

— Enzo`),
    },
    {
      id: 'speranza-a-word',
      chapter: msg('The Hope — What Grows Underground'),
      arcanum: 'VI',
      title: msg('Speranza — A Word We Mean'),
      epigraph: msg(
        'Hope is not the belief that things will improve. Hope is the decision to act as though they might.',
      ),
      body: msg(`FOUND: Painted on the wall of the Hub amphitheater, refreshed every year on Founding Day
AUTHOR: Attributed to Lucia Speranza, though four other contrade claim it for their own founders
TRANSCRIBED BY: Every child in Speranza, at age seven, as part of the Remembering Curriculum

—

There is a word we use down here. Speranza. It means hope, in the old language — the language from before, from the surface, from the time when words were spoken under sky instead of stone. We keep the word because words are lightweight and carry well in the dark, and this one carries more than most.

But we do not mean hope the way the surface meant it. The surface had a luxury we do not: the luxury of optimism. Optimism says: things will get better. Optimism looks at the sky and sees possibility, sees open horizon, sees a tomorrow that is wider than today. Optimism is beautiful. Optimism is for people who have not lost the sky.

We do not have a sky. We have a ceiling. We have seven hundred people in a limestone cavern with a Slingshot, a forge, a canteen that serves the same soup every day, and a watchtower that monitors the machines that took everything we were. We have tomatoes grown under UV lamps and coffee that tastes like regret and copper wiring salvaged from the ruins of a world that did not know it was temporary. We have exactly enough, and some days, less than enough.

In this place, optimism is a lie. And lies, down here, are dangerous — not because they are cruel, but because they are lazy. A lie asks nothing of you. A lie says: wait. Things will improve. Sit in the dark and trust the universe to provide. We have sat in the dark. The universe provided limestone and ARC machines.

So we do not practise optimism. We practise hope.

Hope says: things might get better. Hope says: or they might not. Hope says: either way, I am going to fix the water recycler, and I am going to teach the apprentices, and I am going to send a cargo pod to Brenner because they need capacitors and we have them, and I am going to eat this soup and taste it, really taste it, because this soup — this unremarkable, daily, eternal tomato soup — is the product of seed saved from the surface, soil amended over decades, UV lamps maintained by engineers who died before the tomatoes fruited, and the hands of the cook who woke up at four in the morning because seven hundred people need to eat and the soup does not make itself.

Hope is not passive. Hope is the most active thing we do. Every raid is hope — the decision to go Topside, to risk the machines, to bring back what we need, on the chance that what we need will be there. Every Tube launch is hope — the belief that someone at the other end wants what we're sending. Every child born underground is hope — the most audacious hope of all, because it says: we believe in a future enough to put someone in it.

The children paint the Stripes. Have you seen this? The rainbow bands that run along the ARC machines, the things that hunt us, the things that ended the world — the children paint them on the walls of the Hub, in the corridors, on their bedroom ceilings. Great arcs of colour, sweeping through the grey limestone like light through a prism. The adults find this troubling. The children do not. The children see colour, and colour is rare underground, and they claim it. They take the one beautiful thing about the machines and they make it theirs.

This is hope.

Nonna Grazia says she misses oranges. Dottor Ferrara says he misses silence — real silence, not the waiting silence of a listening post, but the silence of a Sunday morning with nothing broken and no one bleeding. Capitana Ferretti says she misses nothing, which is a lie, but it is her lie and we do not take it from her. Enzo says he misses his mother's engine grease, which is the most Enzo thing anyone has ever said.

I miss the sound of rain. Not the water — we have water. The *sound*. The way it used to hit the windows and make a percussion that was different every time, and the way it smelled — rain on hot pavement, rain on leaves, rain on the dust of a summer afternoon. You cannot bottle a sound. You can only remember it, and play it for yourself in the quiet moments, and hope that remembering is enough.

Hope is not enough. Hope was never supposed to be enough. Hope is the thing that gets you to the next thing — the repair, the raid, the lesson, the meal, the conversation with a friend in the Canteen at midnight about whether the Guild could really build a turbine from ARC parts (yes; Enzo has the blueprints). Hope is the fuel. The work is the engine. Together they move.

Speranza. A word we mean.

Not optimism. Not faith. Not certainty. Just: we are here, underground, alive, and we are choosing — every day, every hour, with every tomato planted and every cargo pod launched and every child taught to read — we are choosing to act as though the future is worth building.

It might not be. The machines might come underground. The caverns might collapse. The gas wells might run dry. Everything might end.

And if it does, it ends with us trying. It ends with the soup on the stove and the Slingshot charged and the children's Stripes on the wall.

That is enough.

That has always been enough.

— Painted on the wall, Year 1. Repainted, Year 143. Will be repainted, every year, until there is no one left to hold the brush, or until there is no wall left to paint on, whichever comes first.`),
    },
  ];
}
