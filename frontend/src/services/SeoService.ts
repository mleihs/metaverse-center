const SITE_NAME = 'metaverse.center';
const DEFAULT_TITLE = 'metaverse.center – Multiplayer Worldbuilding & Strategy Platform';
const DEFAULT_DESCRIPTION =
  'Build civilizations, deploy operatives, shape the metaverse. A multiplayer worldbuilding and strategy platform with AI-powered agents, competitive epochs, and real-world resonances.';
const BASE_URL = 'https://metaverse.center';
const DEFAULT_OG_IMAGE =
  'https://bffjoupddfjaljqrwqck.supabase.co/storage/v1/object/public/simulation.assets/platform/og-image.jpg';
const DEFAULT_OG_IMAGE_ALT = 'metaverse.center platform preview';

type RobotsPolicy = 'index, follow' | 'noindex' | 'noindex, nofollow';
type OgType = 'website' | 'article' | 'profile';

const DEFAULT_ROBOTS: RobotsPolicy = 'index, follow';
const DEFAULT_OG_TYPE: OgType = 'website';

export interface ArticleMeta {
  /** ISO 8601 publication timestamp. */
  publishedTime?: string;
  /** ISO 8601 modification timestamp. */
  modifiedTime?: string;
  /** Canonical author name (not a URL). */
  author?: string;
  /** Section name (e.g. "Chronicle", "Broadsheet", "Lore", "Resonance Dungeons"). */
  section?: string;
  /** Topic tags; emitted as multiple `article:tag` meta tags. */
  tags?: string[];
}

class SeoService {
  /** Set page title from parts: ['Agents', 'Station Null'] → "Agents – Station Null | metaverse.center".
   *
   * Must be called FIRST in every route's SEO block. Implicitly resets all
   * route-ephemeral meta tags to platform defaults:
   *   - robots           → 'index, follow'
   *   - og:type          → 'website'
   *   - og:image / alt   → platform og-image + platform alt
   *   - article:*        → cleared
   *
   * Every route opts in to non-defaults AFTER setTitle via the corresponding
   * setter (setRobots, setOgType, setOgImage, setOgImageAlt, setArticleMeta).
   * This guarantees stale state from a previous route can never leak between
   * SPA navigations — the fix for the bureau-dispatch noindex leak generalised
   * to every social/SEO tag. */
  setTitle(parts: string[]): void {
    if (parts.length === 0) {
      document.title = DEFAULT_TITLE;
    } else {
      document.title = `${parts.join(' – ')} | ${SITE_NAME}`;
    }
    this._setMetaProperty('og:title', document.title);
    this._setMeta('twitter:title', document.title);
    // Route-ephemeral defaults — overrides layer on top
    this._setMeta('robots', DEFAULT_ROBOTS);
    this._setMetaProperty('og:type', DEFAULT_OG_TYPE);
    this._setMetaProperty('og:image', DEFAULT_OG_IMAGE);
    this._setMeta('twitter:image', DEFAULT_OG_IMAGE);
    this._setMetaProperty('og:image:alt', DEFAULT_OG_IMAGE_ALT);
    this._setMeta('twitter:image:alt', DEFAULT_OG_IMAGE_ALT);
    this.clearArticleMeta();
  }

  /** Override the robots policy for the current route. Call AFTER setTitle(). */
  setRobots(policy: RobotsPolicy): void {
    this._setMeta('robots', policy);
  }

  /** Set the Open Graph content type — 'article' for narrative pages (lore, chronicle,
   *  broadsheet, archetype), 'profile' for agents, 'website' for everything else. */
  setOgType(type: OgType): void {
    this._setMetaProperty('og:type', type);
  }

  /** Set og:image:alt + twitter:image:alt. Required for WCAG compliance and richer
   *  social previews. Call alongside setOgImage whenever a non-default image is set. */
  setOgImageAlt(alt: string): void {
    this._setMetaProperty('og:image:alt', alt);
    this._setMeta('twitter:image:alt', alt);
  }

  /** Set article-specific Open Graph meta tags (published/modified time, author, section,
   *  tags). Call together with setOgType('article'). Replaces any existing article:* tags. */
  setArticleMeta(meta: ArticleMeta): void {
    this.clearArticleMeta();
    const addArticle = (property: string, content: string): void => {
      const el = document.createElement('meta');
      el.setAttribute('property', property);
      el.content = content;
      document.head.appendChild(el);
    };
    if (meta.publishedTime) addArticle('article:published_time', meta.publishedTime);
    if (meta.modifiedTime) addArticle('article:modified_time', meta.modifiedTime);
    if (meta.author) addArticle('article:author', meta.author);
    if (meta.section) addArticle('article:section', meta.section);
    for (const tag of meta.tags ?? []) {
      addArticle('article:tag', tag);
    }
  }

  /** Remove all article:* meta tags. Called implicitly by setTitle and setArticleMeta. */
  clearArticleMeta(): void {
    for (const el of document.querySelectorAll('meta[property^="article:"]')) {
      el.remove();
    }
  }

  setDescription(text: string): void {
    this._setMeta('description', text);
    this._setMetaProperty('og:description', text);
    this._setMeta('twitter:description', text);
  }

  setCanonical(path: string): void {
    const url = `${BASE_URL}${path}`;
    const el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (el) {
      el.href = url;
    }
    this._setMetaProperty('og:url', url);
  }

  setOgImage(url: string): void {
    this._setMetaProperty('og:image', url);
    this._setMeta('twitter:image', url);
  }

  /** Inject JSON-LD structured data into <head>. Replaces existing if present. */
  setStructuredData(data: Record<string, unknown>): void {
    this.removeStructuredData();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'velg-structured-data';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /** Remove JSON-LD structured data from <head>. */
  removeStructuredData(): void {
    document.getElementById('velg-structured-data')?.remove();
  }

  /** Set BreadcrumbList structured data for current page. */
  setBreadcrumbs(items: Array<{ name: string; url: string }>): void {
    if (items.length === 0) return;
    const breadcrumbList = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    };
    // Remove existing breadcrumb schema
    document.getElementById('velg-breadcrumbs')?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'velg-breadcrumbs';
    script.textContent = JSON.stringify(breadcrumbList);
    document.head.appendChild(script);
  }

  /** Remove breadcrumb schema. */
  removeBreadcrumbs(): void {
    document.getElementById('velg-breadcrumbs')?.remove();
  }

  /** Set CollectionPage structured data (agents, buildings, events lists). */
  setCollectionPage(data: {
    name: string;
    description: string;
    url: string;
    numberOfItems: number;
  }): void {
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: data.name,
      description: data.description,
      url: data.url,
      numberOfItems: data.numberOfItems,
    });
  }

  /** Set CreativeWork structured data (lore, simulation profiles, archetype detail pages). */
  setCreativeWork(data: {
    name: string;
    description: string;
    url: string;
    image?: string;
    genre?: string;
    keywords?: string[];
    inLanguage?: string;
    author?: string;
  }): void {
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: data.name,
      description: data.description,
      url: data.url,
      ...(data.image ? { image: data.image } : {}),
      ...(data.genre ? { genre: data.genre } : {}),
      ...(data.keywords?.length ? { keywords: data.keywords.join(', ') } : {}),
      ...(data.inLanguage ? { inLanguage: data.inLanguage } : {}),
      ...(data.author ? { author: { '@type': 'Organization', name: data.author } } : {}),
    });
  }

  /** Set Article structured data (chronicle editions). */
  setArticle(data: {
    headline: string;
    datePublished?: string;
    articleBody: string;
    url: string;
  }): void {
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.headline,
      articleBody: data.articleBody,
      url: data.url,
      ...(data.datePublished ? { datePublished: data.datePublished } : {}),
    });
  }

  /** Set HowTo structured data. */
  setHowTo(data: {
    name: string;
    description: string;
    steps: Array<{ name: string; text: string }>;
  }): void {
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: data.name,
      description: data.description,
      step: data.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    });
  }

  /** Remove server-injected SEO content div (called on SPA navigation). */
  removeServerContent(): void {
    document.getElementById('seo-content')?.remove();
  }

  /** Reset all SEO tags to platform defaults (for dashboard/homepage fallback paths). */
  reset(): void {
    document.title = DEFAULT_TITLE;
    this._setMeta('description', DEFAULT_DESCRIPTION);
    this._setMetaProperty('og:title', DEFAULT_TITLE);
    this._setMetaProperty('og:description', DEFAULT_DESCRIPTION);
    this._setMetaProperty('og:url', `${BASE_URL}/`);
    this._setMetaProperty('og:image', DEFAULT_OG_IMAGE);
    this._setMetaProperty('og:image:alt', DEFAULT_OG_IMAGE_ALT);
    this._setMetaProperty('og:type', DEFAULT_OG_TYPE);
    this._setMeta('twitter:title', DEFAULT_TITLE);
    this._setMeta('twitter:description', DEFAULT_DESCRIPTION);
    this._setMeta('twitter:image', DEFAULT_OG_IMAGE);
    this._setMeta('twitter:image:alt', DEFAULT_OG_IMAGE_ALT);
    this._setMeta('robots', DEFAULT_ROBOTS);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      canonical.href = `${BASE_URL}/`;
    }
    this.removeStructuredData();
    this.removeBreadcrumbs();
    this.clearArticleMeta();
  }

  private _setMeta(name: string, content: string): void {
    let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.name = name;
      document.head.appendChild(el);
    }
    el.content = content;
  }

  private _setMetaProperty(property: string, content: string): void {
    let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.content = content;
  }
}

export const seoService = new SeoService();
