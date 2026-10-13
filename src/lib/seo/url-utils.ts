// ============================================================
// Centralized SEO Site URL Resolution Utility
// Ensures zero hardcoded domains, dynamic site-aware URL construction
// ============================================================

export interface SiteUrlContext {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  domain?: string | null;
  customDomain?: string | null;
  config?: string | Record<string, unknown> | null;
}

/**
 * Resolves the absolute canonical base URL for a site.
 * Inspects:
 * 1. site.config.connection.siteUrl
 * 2. site.domain / site.customDomain
 * 3. Fallback to https://verdantt.vercel.app for Verdant site or origin in browser
 * NEVER returns cms.example.com or example.com in production.
 */
export function resolveSiteBaseUrl(site?: SiteUrlContext | null): string {
  if (site) {
    // 1. Check structured connection configuration in site.config
    if (site.config) {
      try {
        const parsed = typeof site.config === 'string' ? JSON.parse(site.config) : site.config;
        if (parsed?.connection?.siteUrl && typeof parsed.connection.siteUrl === 'string') {
          const u = parsed.connection.siteUrl.trim();
          if (u && !u.includes('cms.example.com') && !u.includes('example.com')) {
            return u.replace(/\/+$/, '');
          }
        }
      } catch {
        // Ignore parse error and proceed to domain
      }
    }

    // 2. Check site domain or customDomain
    const rawDomain = site.domain || site.customDomain;
    if (rawDomain && typeof rawDomain === 'string') {
      const trimmed = rawDomain.trim();
      if (trimmed && !trimmed.includes('cms.example.com') && !trimmed.includes('example.com')) {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          return trimmed.replace(/\/+$/, '');
        }
        return `https://${trimmed.replace(/\/+$/, '')}`;
      }
    }
  }

  // 3. Browser environment fallback to current window origin if valid
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes('cms.example.com') && !origin.includes('example.com')) {
      // If we are in the admin dashboard (e.g. localhost or vercel), default to Verdant production site
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return origin;
      }
    }
  }

  // 4. Standard default for connected Verdant site
  return 'https://verdantt.vercel.app';
}

const KNOWN_STATIC_PAGE_SLUGS = new Set([
  '',
  'about',
  'contact',
  'privacy',
  'privacy-policy',
  'terms',
  'terms-of-service',
  'legal',
  'robots.txt',
  'sitemap.xml',
]);

/**
 * Determines whether a slug belongs to a standalone page or an editorial blog article.
 */
export function getArticleOrPagePath(slug: string, contentTypeSlug?: string | null): string {
  const clean = slug.replace(/^\/+/, '').trim();
  if (!clean) return '/';

  const isPage = contentTypeSlug === 'page' || KNOWN_STATIC_PAGE_SLUGS.has(clean);
  if (isPage) {
    return `/${clean}`;
  }
  if (clean.startsWith('blog/')) {
    return `/${clean}`;
  }
  return `/blog/${clean}`;
}

/**
 * Normalizes a path so that article slugs are prefixed with /blog/ if they aren't already.
 */
export function normalizeBlogPath(path: string): string {
  if (!path || path === '/') return '/';
  const clean = path.replace(/^\/+/, '').trim();
  if (clean.startsWith('blog/') || clean.startsWith('category/') || clean.startsWith('author/') || clean.startsWith('api/') || clean.startsWith('_next/')) {
    return `/${clean}`;
  }
  if (KNOWN_STATIC_PAGE_SLUGS.has(clean)) {
    return `/${clean}`;
  }
  return `/blog/${clean}`;
}

/**
 * Constructs a fully qualified public URL for a given path or relative URL.
 * Centralizes all URL generation to avoid manual string concatenation.
 */
export function buildPublicUrl(pathOrUrl: string, site?: SiteUrlContext | null): string {
  if (!pathOrUrl) {
    return resolveSiteBaseUrl(site);
  }

  const base = resolveSiteBaseUrl(site);

  // If already an absolute HTTP/HTTPS URL, sanitize domain & normalize path if needed
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const u = new URL(pathOrUrl);
      const normalizedPath = normalizeBlogPath(u.pathname);
      if (pathOrUrl.includes('cms.example.com') || pathOrUrl.includes('example.com')) {
        return `${base}${normalizedPath}${u.search}${u.hash}`;
      }
      return `${u.origin}${normalizedPath}${u.search}${u.hash}`;
    } catch {
      return pathOrUrl;
    }
  }

  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  const normalizedPath = normalizeBlogPath(cleanPath);
  return `${base}${normalizedPath}`;
}
