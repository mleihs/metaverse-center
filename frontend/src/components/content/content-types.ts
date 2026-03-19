/**
 * Content page type definitions.
 *
 * Shared interfaces for the data-driven content page system.
 * Landing pages and perspective articles share one component
 * (`ContentPageView`) but differ in layout and structured data.
 */

import type { TemplateResult } from 'lit';

/* ── Section ──────────────────────────────────────────── */

export interface ContentSection {
  /** DOM id — used for scroll-spy and TOC anchor links. */
  id: string;
  /** Short label displayed in the TOC sidebar. */
  tocLabel: string;
  /** Section number string (e.g. "01", "02"). */
  number: string;
  /** Full section heading rendered as H2. */
  title: string;
  /** Rich HTML content — must be a lit `html` TemplateResult. */
  content: TemplateResult;
}

/* ── FAQ ──────────────────────────────────────────────── */

export interface ContentFaq {
  question: string;
  answer: string;
}

/* ── CTA ──────────────────────────────────────────────── */

export interface ContentCta {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/* ── Full page data ───────────────────────────────────── */

export interface ContentPageData {
  type: 'landing' | 'perspective';
  slug: string;

  seo: {
    title: string[];
    description: string;
    canonical: string;
    ogImage?: string;
  };

  hero: {
    classification?: string;
    title: string;
    subtitle: string;
    byline?: string;
    datePublished?: string;
    readTime?: string;
  };

  sections: ContentSection[];
  faqs: ContentFaq[];
  ctas: ContentCta[];

  breadcrumbs: Array<{ name: string; url: string }>;

  structuredData: {
    articleType?: 'Article' | 'BlogPosting';
    datePublished?: string;
    dateModified?: string;
    wordCount?: number;
  };
}
