// ============================================================
// Real-World HTTP SEO Crawler with Generic Redirect Following
// Follows 301, 302, 307, 308 HTTP redirects automatically
// Tracks full redirect chain (hops) and extracts final DOM elements
// ============================================================

export interface RedirectHop {
  statusCode: number; // 301, 302, 307, 308
  url: string;        // The URL that returned the redirect
  location: string;   // The raw Location header value
  toUrl: string;      // The resolved absolute destination URL
}

export interface CrawledElements {
  h1List: string[];
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robots?: string;
  schemas: any[];
  images: { src?: string; alt?: string; hasAlt: boolean; isDecorative: boolean }[];
  links: { href?: string; text?: string; isInternal: boolean }[];
  plainText: string;
  wordCount: number;
}

export interface CrawlResult {
  requestedUrl: string;
  finalResolvedUrl: string;
  httpStatus: number;
  html?: string;
  redirectChain: RedirectHop[];
  hasRedirected: boolean;
  error?: string;
  elements: CrawledElements;
}

export interface CrawlOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Parses raw HTML into structured SEO elements.
 */
export function parseHtmlElements(html: string, baseUrl?: string): CrawledElements {
  if (!html || typeof html !== 'string') {
    return {
      h1List: [],
      schemas: [],
      images: [],
      links: [],
      plainText: '',
      wordCount: 0,
    };
  }

  // 1. Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : undefined;

  // 2. Meta description
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const metaDescription = descMatch ? descMatch[1].trim() : undefined;

  // 3. Canonical URL
  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : undefined;

  // 4. Robots Directives
  const robotsMatch =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i);
  const robots = robotsMatch ? robotsMatch[1].trim() : undefined;

  // 5. H1 Headings
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  const h1List: string[] = [];
  let h1M: RegExpExecArray | null;
  while ((h1M = h1Regex.exec(html)) !== null) {
    const text = h1M[1].replace(/<[^>]*>/g, '').trim();
    if (text) {
      h1List.push(text);
    }
  }

  // 6. JSON-LD Schemas
  const schemaRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const schemas: any[] = [];
  let sM: RegExpExecArray | null;
  while ((sM = schemaRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(sM[1].trim());
      schemas.push(parsed);
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  // 7. Images
  const imgRegex = /<img\s+([^>]*?)>/gi;
  const images: CrawledElements['images'] = [];
  let iM: RegExpExecArray | null;
  while ((iM = imgRegex.exec(html)) !== null) {
    const attrs = iM[1];
    const srcM = attrs.match(/src=["']([^"']*)["']/i);
    const altM = attrs.match(/alt=["']([^"']*)["']/i);
    const isDecorative =
      /role=["']presentation["']/i.test(attrs) ||
      /aria-hidden=["']true["']/i.test(attrs) ||
      /alt=["']\s*["']/i.test(attrs);
    images.push({
      src: srcM ? srcM[1] : undefined,
      alt: altM ? altM[1] : undefined,
      hasAlt: altM !== null,
      isDecorative,
    });
  }

  // 8. Links
  const linkRegex = /<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi;
  const links: CrawledElements['links'] = [];
  let lM: RegExpExecArray | null;
  while ((lM = linkRegex.exec(html)) !== null) {
    const attrs = lM[1];
    const text = lM[2].replace(/<[^>]*>/g, '').trim();
    const hrefM = attrs.match(/href=["']([^"']*)["']/i);
    const href = hrefM ? hrefM[1] : undefined;
    const isInternal = href
      ? (!href.startsWith('http://') && !href.startsWith('https://')) || (baseUrl ? href.startsWith(baseUrl) : false)
      : false;
    links.push({
      href,
      text,
      isInternal,
    });
  }

  // 9. Plain text & word count
  const noScript = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
  const plainText = noScript.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return {
    h1List,
    title,
    metaDescription,
    canonicalUrl,
    robots,
    schemas,
    images,
    links,
    plainText,
    wordCount,
  };
}

/**
 * Formats a redirect chain into a human-readable string:
 * e.g. "307 /privacy-policy → 200 /privacy"
 */
export function formatRedirectChain(chain: RedirectHop[], finalStatus = 200): string {
  if (!chain || chain.length === 0) return '';
  const parts: string[] = [];

  for (const hop of chain) {
    let fromPath = hop.url;
    try {
      fromPath = new URL(hop.url).pathname;
    } catch {
      // keep full url
    }
    parts.push(`${hop.statusCode} ${fromPath}`);
  }

  const lastHop = chain[chain.length - 1];
  let finalPath = lastHop.toUrl;
  try {
    finalPath = new URL(lastHop.toUrl).pathname;
  } catch {
    // keep full url
  }
  parts.push(`${finalStatus} ${finalPath}`);

  return parts.join(' → ');
}

/**
 * Crawls a URL with automatic detection and following of 301, 302, 307, 308 redirects.
 * Follows until final resolved destination page is reached and parses its HTML.
 */
export async function crawlPage(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRedirects = options.maxRedirects ?? 10;
  const fetcher = options.fetchFn ?? fetch;

  const redirectChain: RedirectHop[] = [];
  const visited = new Set<string>();

  let currentUrl = url;
  let remainingRedirects = maxRedirects;
  let lastStatus = 0;
  let finalHtml: string | undefined;
  let errorMsg: string | undefined;

  while (true) {
    if (visited.has(currentUrl)) {
      errorMsg = `Redirect loop detected at ${currentUrl}`;
      break;
    }
    visited.add(currentUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetcher(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Verdant-SEO-Crawler/2.0 (+https://verdantt.vercel.app)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(options.headers || {}),
        },
        redirect: 'manual', // Detect 301, 302, 307, 308 explicitly
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatus = res.status;

      // Check if redirect status
      if (REDIRECT_STATUS_CODES.has(res.status)) {
        const rawLocation = res.headers.get('location');
        if (!rawLocation) {
          errorMsg = `HTTP ${res.status} redirect without Location header at ${currentUrl}`;
          finalHtml = await res.text().catch(() => undefined);
          break;
        }

        // Resolve destination URL (handles relative like "/privacy" or absolute)
        const nextUrl = new URL(rawLocation, currentUrl).toString();

        redirectChain.push({
          statusCode: res.status,
          url: currentUrl,
          location: rawLocation,
          toUrl: nextUrl,
        });

        if (remainingRedirects <= 0) {
          errorMsg = `Exceeded maximum redirect limit of ${maxRedirects}`;
          break;
        }

        remainingRedirects--;
        currentUrl = nextUrl;
        continue;
      }

      // Non-redirect response: final destination reached!
      finalHtml = await res.text();
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      errorMsg = err?.name === 'AbortError' ? 'Connection timeout' : (err?.message || 'Network error');
      break;
    }
  }

  const elements = finalHtml
    ? parseHtmlElements(finalHtml, currentUrl)
    : {
        h1List: [],
        schemas: [],
        images: [],
        links: [],
        plainText: '',
        wordCount: 0,
      };

  return {
    requestedUrl: url,
    finalResolvedUrl: currentUrl,
    httpStatus: lastStatus,
    html: finalHtml,
    redirectChain,
    hasRedirected: redirectChain.length > 0,
    error: errorMsg,
    elements,
  };
}
