// ============================================================
// SITE CONNECTION CLIENT — Decoupled External API Adapter
// ============================================================

import {
  SiteConnectionData,
  PlatformType,
  NormalizedSyncItem,
  NormalizedTaxonomyCategory,
  NormalizedTaxonomyTag,
  DiscoveredSiteContent,
} from './types';
import { decrypt } from '@/lib/encryption';
import { markdownToEditorHtml } from '@/lib/pipeline/markdown-to-html';

export interface RemoteContentItem {
  id: string | number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: string;
  publishedAt?: string;
  categories?: string[];
  featuredImageUrl?: string;
}

export interface RemoteCategory {
  id: string | number;
  name: string;
  slug: string;
  description?: string;
}

/**
 * Normalizes content HTML:
 * 1. Converts Markdown into semantic HTML if needed
 * 2. Strips editor-specific attributes: draggable, contenteditable, data-pm-*, data-tiptap-*, data-node-*, data-id, ProseMirror classes
 * 3. Resolves relative image URLs against the external site URL
 * 4. Strips interactive frontend controls (forms, input, textarea, submit buttons) for static pages
 * 5. Cleans empty noise paragraphs
 */
export function cleanAndNormalizeContentHtml(
  rawContent: string,
  siteUrl?: string,
  isPage = false,
): string {
  if (!rawContent || typeof rawContent !== 'string') return '';
  let content = rawContent.trim();

  // If content is Markdown (contains markdown headings ## and does not start with an HTML block element)
  const hasMarkdownHeadings = /(?:^|\n)#{1,6}\s+/m.test(content);
  const startsWithHtmlTag = /^\s*<(?:p|h[1-6]|div|article|section|ul|ol|table)\b/i.test(content);
  if (hasMarkdownHeadings && !startsWithHtmlTag) {
    content = markdownToEditorHtml(content);
  }

  // Strip editor-specific attributes that cause raw HTML display or editor artifacts
  content = content
    .replace(/\s+draggable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+contenteditable\s*=\s*["'](?:true|false)["']/gi, '')
    .replace(/\s+data-(?:pm|tiptap|node|editor)-[a-zA-Z0-9_-]+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+data-id\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+class\s*=\s*["'](?:\s*ProseMirror[^"']*)*["']/gi, '');

  // Strip frontend interactive form controls on static pages
  if (isPage) {
    content = content
      .replace(/<form\b[\s\S]*?<\/form>/gi, '')
      .replace(/<input\b[^>]*>/gi, '')
      .replace(/<textarea\b[\s\S]*?<\/textarea>/gi, '')
      .replace(/<button\b[\s\S]*?<\/button>/gi, '')
      .replace(/<select\b[\s\S]*?<\/select>/gi, '');
  }

  // Remove empty paragraphs
  content = content.replace(/<p\s*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');

  // Resolve relative images to absolute URLs
  if (siteUrl) {
    const cleanSite = siteUrl.replace(/\/+$/, '');
    content = content.replace(/<img\b([^>]*?)src=["'](\/[^"']+)["']([^>]*?)>/gi, (_match, before, src, after) => {
      return `<img${before}src="${cleanSite}${src}"${after}>`;
    });
  }

  return content.trim();
}

/**
 * Standardized Site Connection Interface
 */
export interface ISiteConnectionClient {
  platform: PlatformType;
  siteUrl: string;
  verify(): Promise<{ ok: boolean; message: string }>;
  fetchArticles(params?: { page?: number; limit?: number; search?: string }): Promise<RemoteContentItem[]>;
  publishArticle(data: Partial<RemoteContentItem>): Promise<RemoteContentItem>;
  fetchCategories(): Promise<RemoteCategory[]>;
  fetchPages?(): Promise<NormalizedSyncItem[]>;
  fetchTags?(): Promise<NormalizedTaxonomyTag[]>;
  discoverAllContent(): Promise<DiscoveredSiteContent>;
}

/**
 * Standard CMS HTTP Client Implementation
 */
class StandardCmsClient implements ISiteConnectionClient {
  platform: PlatformType = 'standard';
  siteUrl: string;
  apiBaseUrl: string;
  private apiKey: string;

  constructor(siteUrl: string, apiBaseUrl: string, apiKey: string) {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.apiBaseUrl = (apiBaseUrl || `${siteUrl}/api`).replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey,
        'User-Agent': 'Antigravity-CMS-Connection/1.0',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Standard CMS API error (${res.status}): ${errText || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async verify(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await this.request<{ connected?: boolean; ok?: boolean }>('/cms/health');
      if (res && (res.connected === true || res.ok === true)) {
        return { ok: true, message: 'Connected' };
      }
      return { ok: false, message: 'External API did not confirm connection' };
    } catch {
      return { ok: false, message: 'Failed to verify Standard CMS connection' };
    }
  }

  async fetchArticles(params?: { page?: number; limit?: number; search?: string }): Promise<RemoteContentItem[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<RemoteContentItem[]>(`/articles${qs}`);
  }

  async publishArticle(data: Partial<RemoteContentItem>): Promise<RemoteContentItem> {
    return this.request<RemoteContentItem>('/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async fetchCategories(): Promise<RemoteCategory[]> {
    try {
      const cats = await this.request<RemoteCategory[]>('/categories');
      return Array.isArray(cats) ? cats : [];
    } catch {
      return [];
    }
  }

  async fetchTags(): Promise<NormalizedTaxonomyTag[]> {
    try {
      const tags = await this.request<any[]>('/tags');
      if (Array.isArray(tags)) {
        return tags.map((t) => ({
          id: t.id,
          name: typeof t === 'string' ? t : (t.name || ''),
          slug: typeof t === 'string' ? t.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (t.slug || t.name),
        }));
      }
    } catch {
      // Tags endpoint not supported on external site
    }
    return [];
  }

  /**
   * Discovers static pages for a Standard CMS site.
   * If `/api/pages` exists, uses it.
   * Otherwise, discovers the site's pages from the site's public structure and navigation.
   */
  async fetchPages(): Promise<NormalizedSyncItem[]> {
    // 1. Try dedicated /api/pages endpoint
    try {
      const apiPages = await this.request<any[]>('/pages');
      if (Array.isArray(apiPages) && apiPages.length > 0) {
        return apiPages.map((p) => {
          const content = cleanAndNormalizeContentHtml(p.content || '', this.siteUrl, true);
          return {
            externalId: String(p.id || p.slug),
            title: p.title || 'Page',
            slug: p.slug,
            contentType: 'page' as const,
            content,
            excerpt: p.excerpt || '',
            status: (p.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') as 'PUBLISHED' | 'DRAFT',
            publishedAt: p.publishedAt || p.createdAt || p.date || new Date().toISOString(),
            authorName: p.author?.name || (typeof p.author === 'string' ? p.author : undefined),
            authorAvatarUrl: p.author?.avatar,
            featuredImageUrl: p.coverImage || p.featuredImageUrl || p.image,
            seoTitle: p.seoTitle || p.title,
            seoDescription: p.seoDescription || p.excerpt,
          };
        });
      }
    } catch {
      // /pages returned 404 or failed — try /content?type=page
    }

    try {
      const contentPages = await this.request<any[]>('/content?type=page');
      if (Array.isArray(contentPages) && contentPages.length > 0) {
        return contentPages.map((p) => {
          const content = cleanAndNormalizeContentHtml(p.content || '', this.siteUrl, true);
          return {
            externalId: String(p.id || p.slug),
            title: p.title || 'Page',
            slug: p.slug,
            contentType: 'page' as const,
            content,
            excerpt: p.excerpt || '',
            status: (p.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED') as 'PUBLISHED' | 'DRAFT',
            publishedAt: p.publishedAt || p.createdAt || p.date || new Date().toISOString(),
            authorName: p.author?.name || (typeof p.author === 'string' ? p.author : undefined),
            authorAvatarUrl: p.author?.avatar,
            featuredImageUrl: p.coverImage || p.featuredImageUrl || p.image,
            seoTitle: p.seoTitle || p.title,
            seoDescription: p.seoDescription || p.excerpt,
          };
        });
      }
    } catch {
      // /content?type=page not available
    }

    // 2. Generic static page link discovery from the public site homepage
    const discoveredPages: NormalizedSyncItem[] = [];

    try {
      const siteHomeRes = await fetch(this.siteUrl, {
        headers: { 'User-Agent': 'Antigravity-CMS-Connection/1.0' },
      });
      const siteHomeHtml = await siteHomeRes.text();

      // Find all internal links from navigation, footer, and body
      const pageLinkMatches = [...siteHomeHtml.matchAll(/href=["'](\/(?:about|contact|privacy|terms|faq)[^"']*)["']/gi)];
      const candidatePaths = Array.from(new Set(pageLinkMatches.map((m) => m[1].replace(/\/+$/, ''))));

      for (const pPath of candidatePaths) {
        try {
          const cleanSlug = pPath.replace(/^\//, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
          const pageRes = await fetch(`${this.siteUrl}${pPath}`, {
            headers: { 'User-Agent': 'Antigravity-CMS-Connection/1.0' },
          });
          if (!pageRes.ok) continue;

          const pageHtml = await pageRes.text();
          // Extract title from <title> or <h1>
          const titleMatch = pageHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || pageHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
          const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : cleanSlug.replace(/-/g, ' ');

          // Extract main or article content
          const mainMatch = pageHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || pageHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
          const rawMain = mainMatch ? mainMatch[1] : '';

          if (rawMain) {
            const normalized = cleanAndNormalizeContentHtml(rawMain, this.siteUrl, true);
            discoveredPages.push({
              externalId: cleanSlug,
              title: rawTitle,
              slug: cleanSlug,
              contentType: 'page',
              content: normalized,
              excerpt: normalized.replace(/<[^>]+>/g, ' ').slice(0, 160).trim(),
              status: 'PUBLISHED',
              publishedAt: new Date().toISOString(),
              seoTitle: rawTitle,
            });
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Generic static page discovery warning:', err);
    }

    return discoveredPages;
  }

  async discoverAllContent(): Promise<DiscoveredSiteContent> {
    // 1. Fetch articles / posts
    let rawArticles: any[] = [];
    try {
      rawArticles = await this.request<any[]>('/articles');
    } catch {
      rawArticles = [];
    }

    // 2. Fetch categories
    const categories: NormalizedTaxonomyCategory[] = (await this.fetchCategories()).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
    }));

    // 3. Fetch tags
    const tags: NormalizedTaxonomyTag[] = await this.fetchTags();

    // 4. Fetch static pages
    const pages = await this.fetchPages();

    // Collect tags & categories from articles if not found in taxonomy endpoints
    const catMap = new Map<string, NormalizedTaxonomyCategory>();
    for (const c of categories) {
      catMap.set(c.slug.toLowerCase(), c);
    }

    const tagMap = new Map<string, NormalizedTaxonomyTag>();
    for (const t of tags) {
      tagMap.set(t.name.toLowerCase(), t);
    }

    // Normalize posts
    const posts: NormalizedSyncItem[] = [];

    for (const a of rawArticles) {
      const rawContent = a.content || '';
      const cleanedHtml = cleanAndNormalizeContentHtml(rawContent, this.siteUrl, false);

      const categoryName = typeof a.category === 'object' ? a.category?.name : (typeof a.category === 'string' ? a.category : undefined);
      const categorySlug = a.categorySlug || (typeof a.category === 'object' ? a.category?.slug : (categoryName ? categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined));

      if (categoryName && categorySlug && !catMap.has(categorySlug.toLowerCase())) {
        const newCat = { name: categoryName, slug: categorySlug };
        catMap.set(categorySlug.toLowerCase(), newCat);
        categories.push(newCat);
      }

      const tagNames: string[] = [];
      if (Array.isArray(a.tags)) {
        for (const t of a.tags) {
          const tName = typeof t === 'string' ? t.trim() : (t?.name || '').trim();
          if (tName) {
            tagNames.push(tName);
            const lowerT = tName.toLowerCase();
            if (!tagMap.has(lowerT)) {
              const newTag = { name: tName, slug: lowerT.replace(/[^a-z0-9]+/g, '-') };
              tagMap.set(lowerT, newTag);
              tags.push(newTag);
            }
          }
        }
      }

      // Featured image URL
      let featuredImageUrl: string | undefined = a.coverImage || a.featuredImageUrl || a.featuredImage?.url;
      if (featuredImageUrl && featuredImageUrl.startsWith('/')) {
        featuredImageUrl = `${this.siteUrl}${featuredImageUrl}`;
      }

      // Author metadata
      const authorName = a.author?.name || (typeof a.author === 'string' ? a.author : undefined);
      let authorAvatar = a.author?.avatar;
      if (authorAvatar && authorAvatar.startsWith('/')) {
        authorAvatar = `${this.siteUrl}${authorAvatar}`;
      }

      posts.push({
        externalId: String(a.id || a.slug),
        title: a.title || 'Untitled',
        slug: a.slug,
        contentType: 'post',
        content: cleanedHtml,
        excerpt: a.excerpt || '',
        status: a.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        publishedAt: a.publishedAt || a.date || a.createdAt || new Date(),
        authorName,
        authorAvatar,
        authorRole: a.author?.role,
        authorBio: a.author?.bio,
        categorySlug,
        categoryName,
        tagNames,
        featuredImageUrl,
        seoTitle: a.seoTitle || a.title,
        seoDescription: a.seoDescription || a.excerpt,
        canonicalUrl: a.canonicalUrl,
        metadata: {
          readTime: a.readTime,
          featured: a.featured,
          trending: a.trending,
        },
      });
    }

    return {
      posts,
      pages,
      categories,
      tags,
    };
  }
}

/**
 * WordPress REST API Client Implementation
 */
class WordPressClient implements ISiteConnectionClient {
  platform: PlatformType = 'wordpress';
  siteUrl: string;
  restApiUrl: string;
  private username: string;
  private appPassword: string;

  constructor(siteUrl: string, restApiUrl: string, username: string, appPassword: string) {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.restApiUrl = (restApiUrl || `${siteUrl}/wp-json`).replace(/\/+$/, '');
    this.username = username;
    this.appPassword = appPassword.replace(/\s+/g, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.restApiUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const authHeader = 'Basic ' + Buffer.from(`${this.username}:${this.appPassword}`).toString('base64');

    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'Antigravity-CMS-Connection/1.0',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`WordPress REST API error (${res.status}): ${errText || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async verify(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.request('/wp/v2/users/me?context=edit');
      return { ok: true, message: 'Connected' };
    } catch {
      return { ok: false, message: 'Failed to verify WordPress connection' };
    }
  }

  async fetchArticles(params?: { page?: number; limit?: number; search?: string }): Promise<RemoteContentItem[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('per_page', String(params.limit));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';

    interface WpPost {
      id: number;
      title: { rendered: string };
      slug: string;
      content: { rendered: string };
      excerpt: { rendered: string };
      status: string;
      date: string;
    }

    const posts = await this.request<WpPost[]>(`/wp/v2/posts${qs}`);
    return posts.map((p) => ({
      id: p.id,
      title: p.title?.rendered || '',
      slug: p.slug,
      content: cleanAndNormalizeContentHtml(p.content?.rendered || '', this.siteUrl, false),
      excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() || '',
      status: p.status,
      publishedAt: p.date,
    }));
  }

  async publishArticle(data: Partial<RemoteContentItem>): Promise<RemoteContentItem> {
    interface WpPost {
      id: number;
      title: { rendered: string };
      slug: string;
      content: { rendered: string };
      excerpt: { rendered: string };
      status: string;
      date: string;
    }

    const wpPost = await this.request<WpPost>('/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        slug: data.slug,
        excerpt: data.excerpt,
        status: data.status === 'PUBLISHED' ? 'publish' : 'draft',
      }),
    });

    return {
      id: wpPost.id,
      title: wpPost.title?.rendered || '',
      slug: wpPost.slug,
      content: wpPost.content?.rendered || '',
      excerpt: wpPost.excerpt?.rendered || '',
      status: wpPost.status,
      publishedAt: wpPost.date,
    };
  }

  async fetchCategories(): Promise<RemoteCategory[]> {
    interface WpCategory {
      id: number;
      name: string;
      slug: string;
      description?: string;
    }
    const cats = await this.request<WpCategory[]>('/wp/v2/categories?per_page=100');
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
    }));
  }

  async fetchTags(): Promise<NormalizedTaxonomyTag[]> {
    interface WpTag {
      id: number;
      name: string;
      slug: string;
    }
    try {
      const tags = await this.request<WpTag[]>('/wp/v2/tags?per_page=100');
      return tags.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
      }));
    } catch {
      return [];
    }
  }

  async fetchPages(): Promise<NormalizedSyncItem[]> {
    interface WpPage {
      id: number;
      title: { rendered: string };
      slug: string;
      content: { rendered: string };
      excerpt: { rendered: string };
      status: string;
      date: string;
    }
    try {
      const wpPages = await this.request<WpPage[]>('/wp/v2/pages?per_page=100');
      return wpPages.map((p) => ({
        externalId: String(p.id),
        title: p.title?.rendered || '',
        slug: p.slug,
        contentType: 'page' as const,
        content: cleanAndNormalizeContentHtml(p.content?.rendered || '', this.siteUrl, true),
        excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() || '',
        status: (p.status === 'publish' ? 'PUBLISHED' : 'DRAFT') as 'PUBLISHED' | 'DRAFT',
        publishedAt: p.date,
      }));
    } catch {
      return [];
    }
  }

  async discoverAllContent(): Promise<DiscoveredSiteContent> {
    interface WpFullPost {
      id: number;
      title: { rendered: string };
      slug: string;
      content: { rendered: string };
      excerpt: { rendered: string };
      status: string;
      date: string;
      featured_media?: number;
      categories?: number[];
      tags?: number[];
      _embedded?: {
        'wp:featuredmedia'?: Array<{ source_url?: string; alt_text?: string }>;
        author?: Array<{ name?: string; avatar_urls?: Record<string, string> }>;
      };
    }

    const [postsRes, pages, categories, tags] = await Promise.all([
      this.request<WpFullPost[]>('/wp/v2/posts?per_page=100&_embed=true').catch(() => []),
      this.fetchPages().catch(() => []),
      this.fetchCategories().catch(() => []),
      this.fetchTags().catch(() => []),
    ]);

    const catById = new Map<number, RemoteCategory>();
    for (const c of categories) {
      if (typeof c.id === 'number') catById.set(c.id, c);
    }

    const tagById = new Map<number, NormalizedTaxonomyTag>();
    for (const t of tags) {
      if (typeof t.id === 'number') tagById.set(t.id, t);
    }

    const posts: NormalizedSyncItem[] = postsRes.map((p) => {
      const primaryCatId = p.categories?.[0];
      const primaryCat = primaryCatId ? catById.get(primaryCatId) : undefined;

      const postTagNames: string[] = [];
      if (Array.isArray(p.tags)) {
        for (const tid of p.tags) {
          const t = tagById.get(tid);
          if (t) postTagNames.push(t.name);
        }
      }

      const media = p._embedded?.['wp:featuredmedia']?.[0];
      const author = p._embedded?.author?.[0];

      return {
        externalId: String(p.id),
        title: p.title?.rendered || '',
        slug: p.slug,
        contentType: 'post' as const,
        content: cleanAndNormalizeContentHtml(p.content?.rendered || '', this.siteUrl, false),
        excerpt: p.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() || '',
        status: (p.status === 'publish' ? 'PUBLISHED' : 'DRAFT') as 'PUBLISHED' | 'DRAFT',
        publishedAt: p.date,
        authorName: author?.name,
        authorAvatar: author?.avatar_urls?.['96'] || author?.avatar_urls?.['48'],
        categorySlug: primaryCat?.slug,
        categoryName: primaryCat?.name,
        tagNames: postTagNames,
        featuredImageUrl: media?.source_url,
      };
    });

    return {
      posts,
      pages,
      categories,
      tags,
    };
  }
}

/**
 * Factory to construct an isolated client connection for a given site
 */
export async function getSiteConnectionClient(
  connectionData: SiteConnectionData,
): Promise<ISiteConnectionClient | null> {
  if (!connectionData) return null;

  // Decrypt secret if stored
  let secret = '';
  if (connectionData.encryptedCredentials) {
    try {
      secret = await decrypt(connectionData.encryptedCredentials);
    } catch (err) {
      console.error('Failed to decrypt connection credentials:', err);
    }
  }

  if (connectionData.platform === 'wordpress') {
    return new WordPressClient(
      connectionData.siteUrl,
      connectionData.apiBaseUrl,
      connectionData.username || '',
      secret,
    );
  }

  return new StandardCmsClient(
    connectionData.siteUrl,
    connectionData.apiBaseUrl,
    secret,
  );
}
