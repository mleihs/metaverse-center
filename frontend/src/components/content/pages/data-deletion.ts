/**
 * /data-deletion — User Data Deletion Instructions
 *
 * Required by Meta/Instagram API for App Review.
 * Explains how users can request deletion of their data.
 */

import { msg } from '@lit/localize';
import { html } from 'lit';

import type { ContentPageData } from '../content-types.js';

export function getDataDeletionPage(): ContentPageData {
  return {
    type: 'perspective',
    slug: 'data-deletion',

    seo: {
      title: [msg('Data Deletion')],
      description: msg(
        'How to delete your account and data on metaverse.center. Instructions for exercising your GDPR right to erasure.',
      ),
      canonical: '/data-deletion',
    },

    hero: {
      title: msg('Data Deletion'),
      subtitle: msg('Your right to be forgotten'),
    },

    breadcrumbs: [
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: 'Data Deletion', url: 'https://metaverse.center/data-deletion' },
    ],

    sections: [
      {
        id: 'overview',
        tocLabel: msg('Overview'),
        number: '01',
        title: msg('Your Right to Data Deletion'),
        content: html`
          <p>${msg('Under the EU General Data Protection Regulation (GDPR), you have the right to request the deletion of all personal data we hold about you. This is known as the "right to erasure" or "right to be forgotten."')}</p>
          <p>${msg('metaverse.center fully supports this right. You can delete your account and all associated data at any time.')}</p>
        `,
      },
      {
        id: 'how-to-delete',
        tocLabel: msg('How to Delete'),
        number: '02',
        title: msg('How to Delete Your Account'),
        content: html`
          <p><strong>${msg('Option 1: Self-service (recommended)')}</strong></p>
          <p>${msg('1. Log in to your account on metaverse.center')}</p>
          <p>${msg('2. Go to your Profile (click your avatar in the header)')}</p>
          <p>${msg('3. Scroll to the "Danger Zone" section')}</p>
          <p>${msg('4. Click "Delete Account"')}</p>
          <p>${msg('5. Confirm the deletion')}</p>
          <p><strong>${msg('Option 2: Email request')}</strong></p>
          <p>${msg('Send an email to privacy@metaverse.center with the subject line "Account Deletion Request" and include the email address associated with your account. We will process your request within 30 days.')}</p>
        `,
      },
      {
        id: 'what-is-deleted',
        tocLabel: msg('What Is Deleted'),
        number: '03',
        title: msg('What Gets Deleted'),
        content: html`
          <p>${msg('When you delete your account, the following data is permanently removed:')}</p>
          <p>${msg('\u2014 Your email address and authentication credentials')}</p>
          <p>${msg('\u2014 Your user profile and preferences')}</p>
          <p>${msg('\u2014 Simulations you own (including all agents, buildings, events, lore, and chronicles)')}</p>
          <p>${msg('\u2014 Chat messages with AI agents')}</p>
          <p>${msg('\u2014 Epoch participation history')}</p>
          <p>${msg('\u2014 Any stored API keys (encrypted wallet data)')}</p>
          <p>${msg('This action is irreversible. All data is permanently deleted within 30 days of the request.')}</p>
        `,
      },
      {
        id: 'instagram-data',
        tocLabel: msg('Instagram Data'),
        number: '04',
        title: msg('Instagram & Social Media Data'),
        content: html`
          <p>${msg('If content from your simulation was published to the @bureau.of.impossible.geography Instagram account, the published posts are AI-generated fiction and do not contain personal data.')}</p>
          <p>${msg('If you wish to have Instagram posts derived from your simulation removed, contact privacy@metaverse.center and specify which simulation\u2019s content should be removed. We will delete the relevant posts within 30 days.')}</p>
        `,
      },
      {
        id: 'contact',
        tocLabel: msg('Contact'),
        number: '05',
        title: msg('Contact for Deletion Requests'),
        content: html`
          <p>${msg('Data controller:')}</p>
          <p>
            Ing. Mag. Matthias Leihs, BSc<br>
            ${msg('Austria')}<br>
            privacy@metaverse.center
          </p>
          <p>${msg('We will acknowledge your request within 72 hours and complete the deletion within 30 days, as required by GDPR Article 17.')}</p>
        `,
      },
    ],

    faqs: [],
    ctas: [],

    structuredData: {},
  };
}
