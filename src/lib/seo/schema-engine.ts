// ============================================================
// CMS-Native SEO System: Schema.org Generator & Validator
// Follows Google Search Essentials and primary-source schema guidelines
// ============================================================

import { SchemaValidationItem } from './types';

export const SUPPORTED_SCHEMA_TYPES = [
  'Article',
  'BlogPosting',
  'WebPage',
  'WebSite',
  'Organization',
  'BreadcrumbList',
  'FAQPage',
  'Product',
  'LocalBusiness',
] as const;

export type SupportedSchemaType = (typeof SUPPORTED_SCHEMA_TYPES)[number];

export const DEPRECATED_SCHEMA_TYPES: Record<string, string> = {
  HowTo: 'Google deprecated HowTo rich results in September 2023. Do not rely on it for search features.',
  SpecialAnnouncement: 'Retired by Google in July 2025.',
  FAQPage: 'Google retired FAQPage rich results for general sites on May 7, 2026. Only retain for semantic clarity.',
  ClaimReview: 'Retired from general search results in June 2025.',
  LearningVideo: 'Retired June 2025.',
  CourseInfo: 'CourseInfo carousel retired June 2025.',
};

export interface SchemaInputData {
  type: SupportedSchemaType;
  title: string;
  description?: string;
  url: string;
  siteName?: string;
  siteUrl?: string;
  authorName?: string;
  authorUrl?: string;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
  imageUrl?: string;
  breadcrumbs?: { name: string; url: string }[];
  faqs?: { question: string; answer: string }[];
  product?: {
    price: number | string;
    currency?: string;
    sku?: string;
    availability?: string;
  };
  localBusiness?: {
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    telephone?: string;
  };
}

export function generateSchemaJsonLd(data: SchemaInputData): Record<string, unknown> {
  const publishedDate = data.publishedAt
    ? new Date(data.publishedAt).toISOString()
    : new Date().toISOString();
  const modifiedDate = data.updatedAt
    ? new Date(data.updatedAt).toISOString()
    : publishedDate;

  switch (data.type) {
    case 'Article':
    case 'BlogPosting': {
      const article: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': data.type,
        headline: data.title,
        description: data.description || undefined,
        url: data.url,
        datePublished: publishedDate,
        dateModified: modifiedDate,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': data.url,
        },
      };

      if (data.authorName) {
        article.author = {
          '@type': 'Person',
          name: data.authorName,
          url: data.authorUrl || undefined,
        };
      }

      if (data.siteName) {
        article.publisher = {
          '@type': 'Organization',
          name: data.siteName,
          url: data.siteUrl || undefined,
        };
      }

      if (data.imageUrl) {
        article.image = [data.imageUrl];
      }

      return article;
    }

    case 'WebSite': {
      return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: data.siteName || data.title,
        url: data.siteUrl || data.url,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${(data.siteUrl || data.url).replace(/\/$/, '')}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      };
    }

    case 'Organization': {
      const org: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: data.siteName || data.title,
        url: data.siteUrl || data.url,
      };
      if (data.imageUrl) org.logo = data.imageUrl;
      return org;
    }

    case 'WebPage': {
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: data.title,
        description: data.description || undefined,
        url: data.url,
        datePublished: publishedDate,
        dateModified: modifiedDate,
      };
    }

    case 'BreadcrumbList': {
      const items = (data.breadcrumbs || []).map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: b.name,
        item: b.url,
      }));
      return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
      };
    }

    case 'FAQPage': {
      const mainEntity = (data.faqs || []).map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      }));
      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity,
      };
    }

    case 'Product': {
      const p = data.product || { price: 0 };
      const prod: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: data.title,
        description: data.description || undefined,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: p.currency || 'USD',
          availability: p.availability || 'https://schema.org/InStock',
          url: data.url,
        },
      };
      if (p.sku) prod.sku = p.sku;
      if (data.imageUrl) prod.image = [data.imageUrl];
      return prod;
    }

    case 'LocalBusiness': {
      const b = data.localBusiness || {};
      const lb: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: data.siteName || data.title,
        url: data.url,
      };
      if (b.telephone) lb.telephone = b.telephone;
      if (b.streetAddress || b.city) {
        lb.address = {
          '@type': 'PostalAddress',
          streetAddress: b.streetAddress || undefined,
          addressLocality: b.city || undefined,
          postalCode: b.postalCode || undefined,
          addressCountry: b.country || 'US',
        };
      }
      if (data.imageUrl) lb.image = data.imageUrl;
      return lb;
    }

    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: data.title,
        url: data.url,
      };
  }
}

export function validateSchemaJsonLd(jsonLd: Record<string, unknown>): SchemaValidationItem {
  const type = String(jsonLd['@type'] || 'Unknown');
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check deprecation
  const deprecationNotice = DEPRECATED_SCHEMA_TYPES[type];
  const isDeprecated = !!deprecationNotice;
  if (isDeprecated) {
    warnings.push(`Schema type "${type}" has deprecation considerations: ${deprecationNotice}`);
  }

  // Basic validation rules
  if (!jsonLd['@context'] || !String(jsonLd['@context']).includes('schema.org')) {
    errors.push('Missing or invalid "@context" (expected "https://schema.org").');
  }

  if (type === 'Article' || type === 'BlogPosting') {
    if (!jsonLd.headline) errors.push('Missing required property: "headline".');
    if (!jsonLd.datePublished) warnings.push('Recommended property missing: "datePublished".');
    if (!jsonLd.author) warnings.push('Author markup missing for E-E-A-T rich snippet eligibility.');
    if (!jsonLd.image) warnings.push('Recommended property missing: "image".');
  } else if (type === 'Product') {
    if (!jsonLd.name) errors.push('Missing required property: "name".');
    if (!jsonLd.offers) errors.push('Missing required property: "offers".');
  } else if (type === 'Organization') {
    if (!jsonLd.name) errors.push('Missing required property: "name".');
  } else if (type === 'BreadcrumbList') {
    if (!Array.isArray(jsonLd.itemListElement) || jsonLd.itemListElement.length === 0) {
      errors.push('BreadcrumbList must contain non-empty "itemListElement" array.');
    }
  }

  return {
    type,
    isValid: errors.length === 0,
    errors,
    warnings,
    jsonLd,
    isDeprecated,
    deprecationNotice,
  };
}
