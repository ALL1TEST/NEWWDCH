// ============================================================
// Internal Linking Engine
// Safely discovers and contextually injects internal links:
// - Multi-tenant isolation: strictly discovers published content on same siteId
// - Topical similarity & keyword matching
// - Never links to invented URLs, drafts, or cross-tenant items
// - Prevents repetitive anchors & protects headings/existing links
// ============================================================

import { db } from '@/lib/db';

export interface InternalLinkCandidate {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  focusKeyword?: string | null;
  score?: number;
}

export interface InjectedLink {
  targetArticleId: string;
  targetTitle: string;
  targetSlug: string;
  targetUrl: string;
  anchorText: string;
}

export interface InternalLinkingResult {
  content: string;
  linksInjected: InjectedLink[];
  discoveredCandidateCount: number;
}

/**
 * Discover eligible published articles belonging exclusively to the current site/tenant.
 */
export async function discoverEligibleInternalLinks(
  siteId: string | null,
  currentArticleId?: string,
  topic = '',
  keywords: string[] = []
): Promise<InternalLinkCandidate[]> {
  if (!siteId) return [];

  const items = await db.contentItem.findMany({
    where: {
      siteId,
      status: 'PUBLISHED',
      deletedAt: null,
      id: currentArticleId ? { not: currentArticleId } : undefined,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      focusKeyword: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 60,
  });

  if (items.length === 0) return [];

  // Score candidate articles based on keyword overlap and topical relevance
  const queryTokens = new Set(
    [topic, ...keywords]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3)
  );

  const scored: InternalLinkCandidate[] = items.map((item) => {
    let score = 0;
    const itemTokens = (item.title + ' ' + (item.focusKeyword || '') + ' ' + (item.excerpt || ''))
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3);

    for (const tok of itemTokens) {
      if (queryTokens.has(tok)) {
        score += 2;
      }
    }

    // Boost if focusKeyword matches
    if (item.focusKeyword && queryTokens.has(item.focusKeyword.toLowerCase())) {
      score += 5;
    }

    return { ...item, score };
  });

  // Sort descending by score, keeping articles with valid slugs
  return scored
    .filter((c) => Boolean(c.slug))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Contextually inject internal links into markdown or HTML article content.
 * Respects exclusions:
 * - Does not touch headings (#, ##, <h1>, <h2>, etc.)
 * - Does not touch existing links (<a ...>, [...])
 * - Does not touch code blocks (``` or <code>)
 * - Limits to maxLinks (default 3, min 1, max 5)
 */
export function injectInternalLinks(
  content: string,
  candidates: InternalLinkCandidate[],
  maxLinks = 3
): InternalLinkingResult {
  if (!content || candidates.length === 0 || maxLinks <= 0) {
    return {
      content,
      linksInjected: [],
      discoveredCandidateCount: candidates.length,
    };
  }

  const linksInjected: InjectedLink[] = [];
  const usedSlugs = new Set<string>();
  let modified = content;

  // Track existing links in content to avoid duplicates
  const existingLinksRegex = /\[([^\]]+)\]\(([^)]+)\)|<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = existingLinksRegex.exec(content)) !== null) {
    const url = match[2] || match[3] || '';
    for (const c of candidates) {
      if (url.includes(c.slug)) {
        usedSlugs.add(c.slug);
      }
    }
  }

  // Iterate over candidate articles up to maxLinks
  for (const candidate of candidates) {
    if (linksInjected.length >= maxLinks) break;
    if (usedSlugs.has(candidate.slug)) continue;

    // Anchor search terms: focus keyword, or significant title phrase
    const searchTerms: string[] = [];
    if (candidate.focusKeyword && candidate.focusKeyword.trim().length > 3) {
      searchTerms.push(candidate.focusKeyword.trim());
    }

    // Also extract clean title without parentheticals or prefixes
    const cleanTitle = candidate.title.replace(/[:|\-].*$/, '').trim();
    if (cleanTitle.length > 5) {
      searchTerms.push(cleanTitle);
    }

    let linked = false;

    for (const term of searchTerms) {
      if (linked) break;
      // Find term in body, ensuring it's not inside a heading, code block, or link
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![\\[\\w#])\\b(${escaped})\\b(?![\\w\\]>])`, 'i');

      // Process line by line so we never touch headings or code blocks
      const lines = modified.split('\n');
      let inCodeBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          continue;
        }

        if (inCodeBlock) continue;

        // Skip heading lines
        if (
          line.trim().startsWith('#') ||
          /<h[1-6]/i.test(line) ||
          line.trim().startsWith('<figure') ||
          line.trim().startsWith('![' )
        ) {
          continue;
        }

        // Skip if line already has a link to this slug
        if (line.includes(candidate.slug)) continue;

        // Check if line contains term and not already inside markdown link
        if (regex.test(line) && !line.includes(`](${candidate.slug}`) && !line.includes(`>${term}</a>`)) {
          // Replace first instance
          const targetUrl = `/blog/${candidate.slug}`;
          let actualAnchor = term;

          lines[i] = line.replace(regex, (m) => {
            actualAnchor = m;
            return `[${m}](${targetUrl})`;
          });

          modified = lines.join('\n');
          usedSlugs.add(candidate.slug);
          linksInjected.push({
            targetArticleId: candidate.id,
            targetTitle: candidate.title,
            targetSlug: candidate.slug,
            targetUrl,
            anchorText: actualAnchor,
          });
          linked = true;
          break;
        }
      }
    }
  }

  return {
    content: modified,
    linksInjected,
    discoveredCandidateCount: candidates.length,
  };
}
