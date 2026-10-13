// ============================================================
// Page Type & Search Intent Detection Engine
// Distinguishes articles, utility pages, e-commerce, home, and legal docs
// ============================================================

export type PageType =
  | 'ARTICLE'
  | 'BLOG_POST'
  | 'ABOUT'
  | 'CONTACT'
  | 'LANDING_PAGE'
  | 'HOME'
  | 'PRODUCT'
  | 'PRODUCT_CATEGORY'
  | 'CATEGORY'
  | 'AUTHOR'
  | 'TAG'
  | 'FAQ'
  | 'LEGAL'
  | 'PRIVACY'
  | 'TERMS'
  | 'SEARCH'
  | 'ARCHIVE'
  | 'OTHER_PAGE';

export type ContentIntent =
  | 'INFORMATIONAL'
  | 'COMMERCIAL'
  | 'TRANSACTIONAL'
  | 'NAVIGATIONAL'
  | 'BRAND'
  | 'SUPPORT'
  | 'LEGAL'
  | 'MIXED';

export interface PageClassification {
  pageType: PageType;
  intent: ContentIntent;
  confidence: number;
  reason: string;
}

export interface PageDetectionInput {
  url: string;
  slug?: string;
  title?: string;
  contentType?: string; // e.g. 'article', 'page', 'post', 'product'
  content?: string;
}

/**
 * Detects page type and primary search/content intent with high precision.
 * 1. Honors explicit CMS content types
 * 2. Analyzes slug paths and patterns
 * 3. Inspects semantic keywords and title markers
 */
export function detectPageTypeAndIntent(input: PageDetectionInput): PageClassification {
  const rawUrl = (input.url || '').toLowerCase();
  const slug = (input.slug || rawUrl.split('?')[0].replace(/^\/+|\/+$/g, '')).toLowerCase();
  const title = (input.title || '').toLowerCase();
  const rawType = (input.contentType || '').toLowerCase();

  // 1. Explicit Homepage check
  if (slug === '' || slug === 'home' || rawUrl === '/' || rawUrl.endsWith('.app/') || rawUrl.endsWith('.app')) {
    return {
      pageType: 'HOME',
      intent: 'BRAND',
      confidence: 1.0,
      reason: 'Root URL / homepage slug detected',
    };
  }

  // 2. Legal, Privacy, and Terms
  if (slug.includes('privacy') || title.includes('privacy policy') || slug === 'privacy-policy') {
    return {
      pageType: 'PRIVACY',
      intent: 'LEGAL',
      confidence: 0.98,
      reason: 'Privacy policy slug/title match',
    };
  }
  if (slug.includes('terms') || slug.includes('tos') || title.includes('terms of service') || title.includes('terms & conditions')) {
    return {
      pageType: 'TERMS',
      intent: 'LEGAL',
      confidence: 0.98,
      reason: 'Terms of service slug/title match',
    };
  }
  if (slug.includes('legal') || slug.includes('disclaimer') || slug.includes('cookie-policy')) {
    return {
      pageType: 'LEGAL',
      intent: 'LEGAL',
      confidence: 0.95,
      reason: 'Legal disclaimer / compliance slug match',
    };
  }

  // 3. About Us / Brand identity
  if (slug === 'about' || slug === 'about-us' || slug.startsWith('about/') || title.includes('about us') || title.includes('about verdant')) {
    return {
      pageType: 'ABOUT',
      intent: 'BRAND',
      confidence: 0.98,
      reason: 'Company about/profile slug match',
    };
  }

  // 4. Contact / Support
  if (slug === 'contact' || slug === 'contact-us' || slug.startsWith('contact/') || title.includes('contact us') || slug === 'support' || slug === 'help') {
    return {
      pageType: 'CONTACT',
      intent: 'SUPPORT',
      confidence: 0.98,
      reason: 'Contact or support page pattern match',
    };
  }

  // 5. FAQ
  if (slug === 'faq' || slug === 'faqs' || slug.includes('frequently-asked-questions') || title.includes('frequently asked questions')) {
    return {
      pageType: 'FAQ',
      intent: 'SUPPORT',
      confidence: 0.95,
      reason: 'FAQ page pattern match',
    };
  }

  // 6. Authors / Team
  if (slug.startsWith('author/') || slug.startsWith('authors/') || slug.startsWith('team/') || rawType === 'author') {
    return {
      pageType: 'AUTHOR',
      intent: 'NAVIGATIONAL',
      confidence: 0.95,
      reason: 'Author archive or profile URL prefix',
    };
  }

  // 7. Categories / Tags / Taxonomy
  if (slug.startsWith('category/') || slug.startsWith('categories/') || rawType === 'category') {
    return {
      pageType: 'CATEGORY',
      intent: 'COMMERCIAL',
      confidence: 0.95,
      reason: 'Category taxonomy archive URL prefix',
    };
  }
  if (slug.startsWith('tag/') || slug.startsWith('tags/') || rawType === 'tag') {
    return {
      pageType: 'TAG',
      intent: 'NAVIGATIONAL',
      confidence: 0.95,
      reason: 'Tag taxonomy archive URL prefix',
    };
  }

  // 8. Products & E-Commerce
  if (slug.startsWith('product/') || slug.startsWith('shop/') || slug.startsWith('item/') || rawType === 'product') {
    return {
      pageType: 'PRODUCT',
      intent: 'TRANSACTIONAL',
      confidence: 0.95,
      reason: 'E-commerce product route match',
    };
  }
  if (slug.startsWith('product-category/') || slug.startsWith('shop-category/')) {
    return {
      pageType: 'PRODUCT_CATEGORY',
      intent: 'COMMERCIAL',
      confidence: 0.95,
      reason: 'E-commerce product category catalog match',
    };
  }

  // 9. Search & Archive
  if (slug.startsWith('search') || rawUrl.includes('/search?')) {
    return {
      pageType: 'SEARCH',
      intent: 'NAVIGATIONAL',
      confidence: 0.95,
      reason: 'Search results route match',
    };
  }
  if (slug.startsWith('archive') || slug.startsWith('archives')) {
    return {
      pageType: 'ARCHIVE',
      intent: 'NAVIGATIONAL',
      confidence: 0.9,
      reason: 'Archive repository route match',
    };
  }

  // 10. Landing Pages
  if (slug.includes('landing') || slug.includes('campaign') || slug.includes('promo') || title.includes('get started')) {
    return {
      pageType: 'LANDING_PAGE',
      intent: 'COMMERCIAL',
      confidence: 0.85,
      reason: 'Landing page / campaign conversion indicators',
    };
  }

  // 11. Articles & Blog Posts (Default for content items)
  if (
    rawType === 'article' ||
    rawType === 'post' ||
    rawType === 'blog' ||
    slug.startsWith('blog/') ||
    slug.startsWith('articles/') ||
    slug.startsWith('posts/')
  ) {
    return {
      pageType: 'ARTICLE',
      intent: 'INFORMATIONAL',
      confidence: 0.95,
      reason: 'Explicit editorial content type / blog URL route',
    };
  }

  // Fallback for CMS static pages vs articles
  if (rawType === 'page') {
    return {
      pageType: 'OTHER_PAGE',
      intent: 'INFORMATIONAL',
      confidence: 0.7,
      reason: 'CMS general page with no specific utility pattern',
    };
  }

  // Default assumption for editorial items
  return {
    pageType: 'ARTICLE',
    intent: 'INFORMATIONAL',
    confidence: 0.8,
    reason: 'Standard editorial publication pattern',
  };
}
