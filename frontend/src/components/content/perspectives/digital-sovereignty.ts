/**
 * /perspectives/digital-sovereignty — Perspective article
 *
 * Targets: "digital sovereignty", "platform governance",
 * "virtual world governance", "code is law"
 *
 * References: Foucault's governmentality, Lessig's Code is Law,
 * Zuboff's surveillance capitalism, EU Digital Markets Act.
 * Directly engages with JKU Metaverse Lab framing.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getDigitalSovereigntyPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'perspectives/digital-sovereignty',

    seo: {
      title: [msg('Digital Sovereignty'), msg('Who Governs Virtual Worlds?')],
      description: msg(
        'Lessig\u2019s "Code is Law," Foucault\u2019s governmentality, and the EU Digital Markets Act \u2014 exploring self-determination in digital spaces and why platform governance matters.',
      ),
      canonical: '/perspectives/digital-sovereignty',
    },

    hero: {
      classification: msg('Bureau Perspective'),
      title: msg('Digital Sovereignty'),
      subtitle: msg('Who governs virtual worlds \u2014 and who should?'),
      byline: msg('Bureau of Impossible Geography'),
      datePublished: '2026-03-19',
      readTime: msg('11 min read'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Perspectives', url: 'https://metaverse.center/perspectives/digital-sovereignty' },
      {
        name: 'Digital Sovereignty',
        url: 'https://metaverse.center/perspectives/digital-sovereignty',
      },
    ],

    sections: [
      {
        id: 'code-is-law',
        tocLabel: msg('Code Is Law'),
        number: '01',
        title: msg('Lawrence Lessig\u2019s Four Modalities'),
        content: html`
          <p>
            ${msg('In 1999, Lawrence Lessig published Code and Other Laws of Cyberspace, arguing that behavior in digital spaces is regulated by four forces: law (state-enforced rules), norms (community expectations), markets (price signals and economic incentives), and architecture (the code itself). Of these four, Lessig identified architecture \u2014 the code \u2014 as the most powerful and the least accountable.')}
          </p>
          <blockquote>
            ${msg('"Code is law. In real space, we recognize how laws regulate \u2014 through constitutions, statutes, and other legal codes. In cyberspace we must understand how a different \u2018code\u2019 regulates \u2014 how the software and hardware that make cyberspace what it is regulate cyberspace as it is."')}
            <cite>${msg('\u2014 Lawrence Lessig, Code and Other Laws of Cyberspace (1999)')}</cite>
          </blockquote>
          <p>
            ${msg('Lessig\u2019s insight was that the architecture of digital platforms constrains user behavior more effectively than any law. If the platform doesn\u2019t provide a feature, it effectively doesn\u2019t exist. If the platform surveils a behavior, it\u2019s effectively prohibited. The code is not merely regulatory \u2014 it is constitutive. It defines the space of possible action.')}
          </p>
          <p>
            ${msg('This has profound implications for virtual worlds. When a platform corporation designs a metaverse, they are not just building infrastructure \u2014 they are writing the constitution of a digital society. Every design decision (what users can create, what data is collected, who can modify the environment, how disputes are resolved) is a governance decision, whether or not it is recognized as such.')}
          </p>
        `,
      },
      {
        id: 'governmentality',
        tocLabel: msg('Governmentality'),
        number: '02',
        title: msg('Foucault\u2019s Technologies of Power'),
        content: html`
          <p>
            ${msg('Michel Foucault, in his 1977\u201378 lectures at the Coll\u00e8ge de France (published as Security, Territory, Population), introduced governmentality \u2014 the art of governing not through direct force but through the management of populations. He defined it as "the ensemble formed by institutions, procedures, analyses and reflections, the calculations and tactics that allow the exercise of this very specific, albeit very complex, form of power that has as its target population." His most compressed formulation: governance is "the conduct of conduct" \u2014 to govern is to "control the possible field of action of others." The governed are not commanded. They are conducted.')}
          </p>
          <p>
            ${msg('Platform governance is Foucauldian governmentality in its purest digital form. Users on corporate platforms are not governed by laws they voted for \u2014 they are governed by algorithms they cannot see, terms of service they did not negotiate, and design choices they did not make. The "conduct of conduct" operates through recommendation algorithms, content moderation policies, interface affordances, and data collection practices.')}
          </p>
          <p>
            ${msg('This is not conspiracy \u2014 it is architecture. When a platform decides what content is recommended, what behaviors are measured, and what users can create, it exercises governmental power in Foucault\u2019s precise sense. The question is not whether this power exists but whether it is visible, accountable, and contestable.')}
          </p>
        `,
      },
      {
        id: 'surveillance-capitalism',
        tocLabel: msg('Surveillance'),
        number: '03',
        title: msg('The Extraction Economy'),
        content: html`
          <p>
            ${msg('Shoshana Zuboff named it in 2019: surveillance capitalism. The economic logic by which platforms extract behavioral data from users, process it into predictions of future behavior, and sell those predictions to advertisers and other clients. What Zuboff calls "behavioral surplus" \u2014 the data that exceeds what is needed to improve the product \u2014 is the raw material of an entirely new mode of accumulation.')}
          </p>
          <p>
            ${msg('Zuboff\u2019s framework reveals why corporate metaverse projects are architecturally incompatible with user sovereignty. A platform that extracts behavioral surplus from its users has an economic incentive to maximize data collection and minimize user autonomy. The more the platform knows about user behavior, the more valuable its prediction products become. Sovereignty \u2014 the user\u2019s ability to control their own data, creative output, and digital presence \u2014 directly conflicts with the platform\u2019s economic logic.')}
          </p>
          <p>
            ${msg('This is not a technical problem. It is a structural one. You cannot build sovereign digital spaces on a foundation of surveillance capitalism. The architecture precludes it.')}
          </p>
        `,
      },
      {
        id: 'regulatory-response',
        tocLabel: msg('DMA'),
        number: '04',
        title: msg('The Regulatory Response'),
        content: html`
          <p>
            ${msg('The European Union\u2019s Digital Markets Act (2022, effective 2024) represents the most significant regulatory response to platform power. It designates large platforms as "gatekeepers" and imposes obligations: interoperability requirements, prohibitions on self-preferencing, limits on data combination across services, and rights for users to port their data. The Act recognizes that platform architecture is a site of power and that architectural choices must be subject to democratic constraint.')}
          </p>
          <p>
            ${msg('Austria\u2019s academic discourse on digital sovereignty, including work from JKU Linz\u2019s LIFT_C Metaverse Lab (led by Prof. Meinhard Lukas, Institute of Civil Law), frames the problem as a governance vacuum: "In this space, there are no (state) borders, meaning that state sovereignty, with its power to enact laws, can only be exercised in a very limited way. In practice, sovereignty primarily lies with the tech giants of Silicon Valley." This framing is reactive \u2014 it sees digital space as territory to be regulated by existing state power. This is necessary but insufficient. Regulatory frameworks constrain the worst abuses of platform power but do not, by themselves, create sovereign digital spaces.')}
          </p>
          <p>
            ${msg('Sovereignty requires not just protection from external power but the positive capacity for self-governance. A truly sovereign digital space is one where inhabitants have meaningful agency over the rules that govern them, the data they produce, the creative output they generate, and the communities they form.')}
          </p>
        `,
      },
      {
        id: 'design-sovereignty',
        tocLabel: msg('By Design'),
        number: '05',
        title: msg('Sovereignty by Architecture'),
        content: html`
          <p>
            ${msg('If code is law, then sovereign digital spaces must be built from sovereign code. This means architectural decisions that prioritize user agency over platform extraction:')}
          </p>
          <p>
            <strong>${msg('User-owned creative output.')}</strong>
            ${msg('When a user creates a world, populates it with characters, and generates narrative, that creative output belongs to the user. The platform is infrastructure, not landlord. This is the Stephenson model \u2014 the metaverse as protocol, not product.')}
          </p>
          <p>
            <strong>${msg('Transparent governance.')}</strong>
            ${msg('The rules by which the platform operates should be visible and comprehensible. Row-level security, role-based access, and explicit permission models \u2014 not opaque algorithms. Users should understand what data is collected, how it is used, and what rules govern their interactions.')}
          </p>
          <p>
            <strong>${msg('Competitive emergence.')}</strong>
            ${msg('Power in the system should emerge from play, not from purchase. metaverse.center\u2019s competitive Epochs are won through strategic intelligence, alliance formation, and world quality \u2014 not through spending. The architecture makes pay-to-win structurally impossible.')}
          </p>
          <p>
            <strong>${msg('Community self-determination.')}</strong>
            ${msg('Each simulation is a self-governing space. The simulation owner controls membership, permissions, creative direction, and competitive participation. The platform provides infrastructure and connects worlds; it does not dictate what happens within them.')}
          </p>
        `,
      },
      {
        id: 'stakes',
        tocLabel: msg('Stakes'),
        number: '06',
        title: msg('Why This Matters'),
        content: html`
          <p>
            ${msg('Digital sovereignty is not an abstract principle. It is the practical question of who controls the spaces where an increasing portion of human social, creative, and economic life takes place. Foucault showed us that governance operates through architecture. Lessig showed us that code is the architecture of digital life. Zuboff showed us the economic logic that makes surveillance the default architecture of corporate platforms.')}
          </p>
          <p>
            ${msg('The alternative is not utopian. It is architectural. Build platforms where the code serves the user rather than the platform. Where creative output belongs to creators. Where governance is transparent. Where competitive dynamics emerge from play, not purchase. Where communities govern themselves.')}
          </p>
          <p>
            ${msg('metaverse.center is an experiment in this alternative. Not perfect, not complete, but intentional. Every architectural decision \u2014 from row-level security to user-owned simulations to competitive epochs \u2014 is a governance decision made in favor of user sovereignty. Because if code is law, then the question is not whether virtual worlds will be governed, but by whom, and in whose interest.')}
          </p>
        `,
      },
    ],

    faqs: [
      {
        question: msg('What is digital sovereignty?'),
        answer: msg(
          'Digital sovereignty is the capacity of individuals and communities to exercise self-determination in digital spaces \u2014 controlling their data, creative output, and the governance rules that shape their digital life. It extends the concept of political sovereignty into the digital realm.',
        ),
      },
      {
        question: msg('What does "code is law" mean?'),
        answer: msg(
          'Lawrence Lessig\u2019s concept that the architecture of digital platforms (the code) regulates user behavior more effectively than legal systems. Code determines what is possible, what is visible, and what is prohibited in digital spaces \u2014 making it the most powerful form of regulation online.',
        ),
      },
      {
        question: msg('How does metaverse.center protect user sovereignty?'),
        answer: msg(
          'Through architectural choices: user-owned creative output, transparent governance via row-level security and explicit permissions, competitive dynamics based on strategy rather than spending, and community self-determination through simulation-level governance.',
        ),
      },
      {
        question: msg('What is surveillance capitalism?'),
        answer: msg(
          'Coined by Shoshana Zuboff, surveillance capitalism describes the economic logic where platforms extract behavioral data from users, predict future behavior, and sell those predictions. This model is structurally incompatible with user sovereignty because it incentivizes maximizing data extraction.',
        ),
      },
      {
        question: msg('What is the EU Digital Markets Act?'),
        answer: msg(
          'EU legislation (2022, effective 2024) that designates large platforms as "gatekeepers" and requires interoperability, prohibits self-preferencing, limits cross-service data combination, and grants users data portability rights.',
        ),
      },
    ],

    ctas: [
      {
        label: msg('Explore the Platform'),
        href: '/worlds',
        variant: 'primary',
      },
      {
        label: msg('What Is the Metaverse?'),
        href: '/perspectives/what-is-the-metaverse',
        variant: 'secondary',
      },
      {
        label: msg('Competitive Strategy'),
        href: '/perspectives/competitive-strategy',
        variant: 'secondary',
      },
    ],

    structuredData: {
      articleType: 'Article',
      datePublished: '2026-03-19',
      dateModified: '2026-03-19',
      wordCount: 1900,
    },
  };
}
