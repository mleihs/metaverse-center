/**
 * /privacy — Privacy Policy
 *
 * Required by Meta/Instagram API and EU GDPR.
 * Also referenced in PlatformFooter.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getPrivacyPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'privacy',

    seo: {
      title: [msg('Privacy Policy')],
      description: msg(
        'Privacy policy for metaverse.center — how we handle your data, what we collect, and your rights under GDPR.',
      ),
      canonical: '/privacy',
    },

    hero: {
      title: msg('Privacy Policy'),
      subtitle: msg('How we handle your data'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Privacy Policy', url: 'https://metaverse.center/privacy' },
    ],

    sections: [
      {
        id: 'overview',
        tocLabel: msg('Overview'),
        number: '01',
        title: msg('Overview'),
        content: html`
          <p>${msg('metaverse.center ("the Platform") is operated by Ing. Mag. Matthias Leihs, BSc, based in Austria. This privacy policy explains what personal data we collect, how we use it, and your rights under the EU General Data Protection Regulation (GDPR).')}</p>
          <p>${msg('Last updated: March 19, 2026.')}</p>
        `,
      },
      {
        id: 'data-collected',
        tocLabel: msg('Data Collected'),
        number: '02',
        title: msg('What Data We Collect'),
        content: html`
          <p><strong>${msg('Account data.')}</strong> ${msg('When you register, we collect your email address and a password (hashed, never stored in plain text). Authentication is handled by Supabase Auth.')}</p>
          <p><strong>${msg('Simulation data.')}</strong> ${msg('Content you create on the platform — simulations, agents, buildings, events, lore, and chat messages — is stored in our database. This is user-generated content that you own.')}</p>
          <p><strong>${msg('Analytics.')}</strong> ${msg('We use Google Analytics 4 (GA4) with IP anonymization enabled. GA4 collects anonymized usage data including pages visited, session duration, and device type. No personal identifiers are transmitted. You can opt out via the cookie consent banner.')}</p>
          <p><strong>${msg('Cookies.')}</strong> ${msg('We use strictly necessary cookies for authentication (Supabase session token) and optional analytics cookies (GA4). The cookie consent banner lets you accept or reject optional cookies.')}</p>
        `,
      },
      {
        id: 'purpose',
        tocLabel: msg('Purpose'),
        number: '03',
        title: msg('How We Use Your Data'),
        content: html`
          <p>${msg('We use your data for the following purposes:')}</p>
          <p><strong>${msg('Account management.')}</strong> ${msg('Your email is used for authentication, password reset, and platform communications (e.g., epoch invitations).')}</p>
          <p><strong>${msg('Platform operation.')}</strong> ${msg('Simulation data is stored to provide the core service — running AI-powered simulations, generating chronicles, and enabling competitive epochs.')}</p>
          <p><strong>${msg('Analytics.')}</strong> ${msg('Anonymized usage data helps us understand how the platform is used and improve it. No personal data is shared with third parties for advertising.')}</p>
          <p><strong>${msg('AI content generation.')}</strong> ${msg('When you interact with AI features (agent chat, chronicle generation, Simulation Forge), your prompts and simulation context are sent to AI providers (OpenRouter) for processing. We do not store or train on these interactions beyond what is needed for the current session.')}</p>
        `,
      },
      {
        id: 'third-parties',
        tocLabel: msg('Third Parties'),
        number: '04',
        title: msg('Third-Party Services'),
        content: html`
          <p>${msg('The platform uses the following third-party services:')}</p>
          <p><strong>${msg('Supabase')}</strong> ${msg('(database, authentication, file storage) — hosted in EU (AWS eu-west-3, Paris). Data processing agreement in place.')}</p>
          <p><strong>${msg('OpenRouter')}</strong> ${msg('(AI model routing) — prompts are sent for generation. No persistent storage of user data by OpenRouter.')}</p>
          <p><strong>${msg('Replicate')}</strong> ${msg('(AI image generation) — image descriptions are sent for portrait/building generation. Generated images are stored in our Supabase bucket.')}</p>
          <p><strong>${msg('Google Analytics 4')}</strong> ${msg('(analytics) — anonymized, IP masking enabled, opt-out via cookie consent.')}</p>
          <p><strong>${msg('Railway')}</strong> ${msg('(application hosting) — backend infrastructure.')}</p>
          <p><strong>${msg('Meta/Instagram Graph API')}</strong> ${msg('(social media publishing) — the platform publishes AI-generated content to Instagram. No user data is shared with Meta beyond what is publicly visible in published posts.')}</p>
        `,
      },
      {
        id: 'rights',
        tocLabel: msg('Your Rights'),
        number: '05',
        title: msg('Your Rights Under GDPR'),
        content: html`
          <p>${msg('Under the EU General Data Protection Regulation, you have the right to:')}</p>
          <p><strong>${msg('Access')}</strong> ${msg('— request a copy of all personal data we hold about you.')}</p>
          <p><strong>${msg('Rectification')}</strong> ${msg('— correct inaccurate personal data.')}</p>
          <p><strong>${msg('Erasure')}</strong> ${msg('— request deletion of your account and all associated data ("right to be forgotten").')}</p>
          <p><strong>${msg('Data portability')}</strong> ${msg('— receive your data in a structured, machine-readable format.')}</p>
          <p><strong>${msg('Objection')}</strong> ${msg('— object to processing of your data for specific purposes.')}</p>
          <p><strong>${msg('Withdraw consent')}</strong> ${msg('— withdraw previously given consent at any time (e.g., analytics cookies).')}</p>
          <p>${msg('To exercise any of these rights, contact us at privacy@metaverse.center.')}</p>
        `,
      },
      {
        id: 'ai-disclosure',
        tocLabel: msg('AI Disclosure'),
        number: '06',
        title: msg('AI-Generated Content'),
        content: html`
          <p>${msg('metaverse.center is an AI-powered platform. Content generated by AI includes: agent dialogue, chronicle articles, simulation lore, Instagram posts, and image descriptions. All AI-generated content is clearly labeled.')}</p>
          <p>${msg('The Instagram account @bureau.of.impossible.geography publishes AI-generated fiction. Every post includes an AI disclosure footer. The account biography identifies the content as AI-generated fiction from metaverse.center.')}</p>
          <p>${msg('We comply with the EU AI Act transparency requirements for AI-generated content.')}</p>
        `,
      },
      {
        id: 'retention',
        tocLabel: msg('Retention'),
        number: '07',
        title: msg('Data Retention'),
        content: html`
          <p>${msg('Account data is retained as long as your account is active. If you delete your account, all personal data is removed within 30 days. Anonymized analytics data may be retained longer.')}</p>
          <p>${msg('Simulation data (worlds, agents, buildings, events) is retained as long as the simulation exists. Simulation owners can delete their simulations at any time, which removes all associated data.')}</p>
        `,
      },
      {
        id: 'contact',
        tocLabel: msg('Contact'),
        number: '08',
        title: msg('Contact'),
        content: html`
          <p>${msg('Data controller:')}</p>
          <p>
            Ing. Mag. Matthias Leihs, BSc<br>
            ${msg('Austria')}<br>
            privacy@metaverse.center
          </p>
          <p>${msg('If you believe your data protection rights have been violated, you have the right to lodge a complaint with the Austrian Data Protection Authority (Datenschutzbehörde, dsb.gv.at).')}</p>
        `,
      },
    ],

    faqs: [],
    ctas: [],

    structuredData: {},
  };
}
