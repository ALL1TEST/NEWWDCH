// ============================================================
// SITE PUBLISHER — Server-Side Sync Engine for External Sites
// ============================================================

import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface PublishResult {
  published: boolean;
  siteName?: string;
  siteId?: string;
  endpoint?: string;
  externalData?: unknown;
  reason?: string;
}

/**
 * Sanitizes and cleans HTML content before external publishing:
 * 1. Strips editor-specific attributes: draggable, contenteditable, data-pm-*, data-tiptap-*, data-node-*, data-id, ProseMirror classes
 * 2. Cleans empty noise tags (<p></p>, <p><br></p>)
 * 3. Removes leading duplicate H1 (which repeats the article title already rendered in the page hero)
 * 4. Removes leading duplicate cover image (already rendered as the featured cover above the body)
 * 5. Preserves all legitimate semantic tags (h2, h3, h4, p, ul, ol, li, strong, em, a, img, blockquote, table, etc.)
 */
export function sanitizeArticleHtmlForPublishing(
  rawContent: string,
  articleTitle?: string,
  coverImageUrl?: string,
): string {
  if (!rawContent) return '';

  let html = rawContent;

  // 1. Remove editor-only attributes
  html = html
    .replace(/\s+draggable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+contenteditable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+data-(?:pm|tiptap|node|editor)-[a-zA-Z0-9_-]+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+data-id\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+class\s*=\s*["'](?:\s*ProseMirror[^"']*)*["']/gi, '');

  // 2. Remove empty noise paragraphs
  html = html.replace(/<p\s*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');

  // 3. Remove leading duplicate <h1> if it matches the article title
  if (articleTitle) {
    const cleanTitle = articleTitle.trim().toLowerCase();
    html = html.replace(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>/i, (match, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      if (text === cleanTitle || cleanTitle.includes(text) || text.includes(cleanTitle)) {
        return '';
      }
      return match;
    });
  }

  // 4. Remove leading duplicate cover image matching coverImageUrl or hero image
  if (coverImageUrl) {
    const cleanCover = coverImageUrl.trim();
    html = html.replace(/^\s*<p\b[^>]*>\s*<img\b[^>]+src=["']([^"']+)["'][^>]*>\s*<\/p>/i, (match, src) => {
      if (src === cleanCover || cleanCover.endsWith(src) || src.endsWith(cleanCover) || src.includes('hero')) {
        return '';
      }
      return match;
    });
    html = html.replace(/^\s*<img\b[^>]+src=["']([^"']+)["'][^>]*>/i, (match, src) => {
      if (src === cleanCover || cleanCover.endsWith(src) || src.endsWith(cleanCover) || src.includes('hero')) {
        return '';
      }
      return match;
    });
  }

  return html.trim();
}

/**
 * Publishes a CMS ContentItem to its connected external site (e.g. Verdant, WordPress, Standard CMS).
 * Strictly throws an Error if the external API returns an error status, ensuring zero fake successes.
 */
export async function publishArticleToConnectedSite(
  contentItemId: string,
  explicitSiteId?: string | null,
): Promise<PublishResult> {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      contentType: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      featuredImage: { select: { id: true, url: true, alt: true } },
      tags: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!item) {
    throw new Error(`Content item ${contentItemId} not found`);
  }

  const targetSiteId = explicitSiteId || item.siteId;
  if (!targetSiteId) {
    // No site attached to this content item, local publication only
    return { published: false, reason: 'NO_SITE_ATTACHED' };
  }

  const site = await db.site.findUnique({
    where: { id: targetSiteId },
  });

  if (!site || !site.config) {
    return { published: false, siteId: targetSiteId, reason: 'SITE_OR_CONFIG_NOT_FOUND' };
  }

  let config: any = {};
  try {
    config = typeof site.config === 'string' ? JSON.parse(site.config) : site.config;
  } catch {
    return { published: false, siteId: targetSiteId, reason: 'MALFORMED_SITE_CONFIG' };
  }

  const conn = config?.connection;
  if (!conn || conn.status !== 'CONNECTED' || !conn.encryptedCredentials) {
    // Site is not configured for external API publishing
    return { published: false, siteId: targetSiteId, siteName: site.name, reason: 'SITE_NOT_CONNECTED' };
  }

  // Decrypt connection credentials
  let token = '';
  try {
    token = await decrypt(conn.encryptedCredentials);
  } catch (err: any) {
    throw new Error(`Failed to decrypt credentials for site "${site.name}": ${err.message}`);
  }

  if (!token) {
    throw new Error(`Empty connection token for site "${site.name}"`);
  }

  // Validate content type for external publication:
  // - Blog articles must use Content Type = Post -> /api/articles (or /wp/v2/posts)
  // - Static website pages can use Content Type = Page -> /api/pages (or /wp/v2/pages)
  const contentTypeSlug = item.contentType?.slug?.toLowerCase() || 'post';
  const siteCapabilities: string[] = conn.capabilities || config?.capabilities || [];

  const supportsPages =
    siteCapabilities.includes('pages') ||
    conn.platform === 'standard' ||
    conn.platform === 'wordpress' ||
    siteCapabilities.length === 0;

  if (contentTypeSlug === 'page' && !supportsPages) {
    return {
      published: false,
      siteId: targetSiteId,
      siteName: site.name,
      reason: 'STATIC_PAGE_NOT_SUPPORTED_ON_BLOG',
    };
  }

  const rawBaseUrl = conn.apiBaseUrl || `${conn.siteUrl || site.domain}/api`;
  const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  // Explicit null handling: If user removed the image, send null (never undefined/omitted)
  const coverImageUrl = item.featuredImage?.url ?? null;
  const cleanContent = sanitizeArticleHtmlForPublishing(
    item.content || '',
    item.title,
    coverImageUrl || undefined,
  );

  const payload = {
    id: item.id,
    title: item.title,
    slug: item.slug,
    type: contentTypeSlug === 'page' ? 'page' : 'post',
    contentType: contentTypeSlug,
    // Explicit empty string: If user cleared excerpt, send empty string (never omit)
    excerpt: item.excerpt ?? '',
    content: cleanContent,
    category: item.category?.name || 'General',
    categorySlug: item.category?.slug || 'general',
    coverImage: coverImageUrl,
    featuredImageUrl: coverImageUrl,
    author: item.author
      ? {
          name: item.author.name,
          avatar: item.author.avatar,
        }
      : undefined,
    published: item.status === 'PUBLISHED',
    status: item.status,
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : new Date().toISOString(),
    tags: item.tags?.map((t) => t.name) || [],
  };

  const endpoint = conn.platform === 'wordpress'
    ? (contentTypeSlug === 'page' ? `${apiBaseUrl}/wp/v2/pages` : `${apiBaseUrl}/wp/v2/posts`)
    : (contentTypeSlug === 'page' ? `${apiBaseUrl}/pages` : `${apiBaseUrl}/articles`);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-Key': token,
        'User-Agent': 'Antigravity-CMS-Connection/1.0',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr: any) {
    throw new Error(
      `Network error communicating with site "${site.name}" at ${endpoint}: ${networkErr.message}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let parsedMsg = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedMsg = errJson.error || errJson.message || errorText;
    } catch {}

    throw new Error(
      `External publishing to "${site.name}" failed [HTTP ${response.status}]: ${parsedMsg || response.statusText}`,
    );
  }

  const externalData = await response.json().catch(() => ({ ok: true }));

  console.log(`[SITE:PUBLISHER] Successfully synced article "${item.title}" to ${site.name} (${endpoint})`);

  return {
    published: true,
    siteName: site.name,
    siteId: targetSiteId,
    endpoint,
    externalData,
  };
}
