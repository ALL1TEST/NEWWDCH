// ============================================================
// GET /api/seo/internal-links — Analyze internal links across content
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRequestId } from '@/lib/utils';
import { getSiteWhere } from '@/lib/site-context';

export async function GET(request: NextRequest) {
  const id = generateRequestId();
  const start = Date.now();

  try {
    const siteFilter = await getSiteWhere(request);

    // Fetch published content
    const publishedItems = await db.contentItem.findMany({
      where: { ...siteFilter, status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, slug: true, content: true },
    });

    // Build slug -> id map for incoming link resolution
    const slugToId = new Map<string, string>();
    for (const item of publishedItems) {
      slugToId.set(item.slug, item.id);
    }

    // Parse links from each content item
    const linkRegex = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

    // Track outgoing links per content item
    const itemLinks = new Map<string, { internal: Set<string>; external: number }>();
    // Track incoming links per content id (who links to whom)
    const incomingLinks = new Map<string, number>();

    for (const item of publishedItems) {
      const internalSlugs = new Set<string>();
      let externalCount = 0;

      if (item.content) {
        let match: RegExpExecArray | null;
        const regex = new RegExp(linkRegex.source, linkRegex.flags);
        while ((match = regex.exec(item.content)) !== null) {
          const href = match[1] || match[2] || match[3] || '';

          if (href.startsWith('/')) {
            // Internal link - extract slug
            const parts = href.replace(/^\//, '').split('/')[0];
            if (parts) {
              internalSlugs.add(parts);
            }
          } else if (href.startsWith('http://') || href.startsWith('https://')) {
            // External link
            externalCount++;
          }
          // Ignore anchors, mailto, javascript, etc.
        }
      }

      itemLinks.set(item.id, { internal: internalSlugs, external: externalCount });
    }

    // Count incoming internal links
    for (const item of publishedItems) {
      const links = itemLinks.get(item.id);
      if (links) {
        for (const slug of links.internal) {
          const targetId = slugToId.get(slug);
          if (targetId && targetId !== item.id) {
            incomingLinks.set(targetId, (incomingLinks.get(targetId) || 0) + 1);
          }
        }
      }
    }

    // Build result items
    const items = publishedItems.map((item) => {
      const links = itemLinks.get(item.id) || { internal: new Set<string>(), external: 0 };
      const incoming = incomingLinks.get(item.id) || 0;
      const isOrphan = incoming === 0;

      return {
        contentId: item.id,
        title: item.title,
        slug: item.slug,
        internalLinks: links.internal.size,
        externalLinks: links.external,
        incomingLinks: incoming,
        isOrphan,
      };
    });

    const orphans = items.filter((i) => i.isOrphan).map((i) => i.contentId);

    const summary = {
      totalItems: items.length,
      totalInternalLinks: items.reduce((sum, i) => sum + i.internalLinks, 0),
      totalExternalLinks: items.reduce((sum, i) => sum + i.externalLinks, 0),
      orphanCount: orphans.length,
    };

    return NextResponse.json({
      data: { items, orphans, summary },
      meta: { requestId: id, timestamp: new Date().toISOString(), duration: Date.now() - start },
    });
  } catch (error) {
    console.error(`[SEO:INTERNAL-LINKS] ${id} —`, error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze internal links' }, meta: { requestId: id, timestamp: new Date().toISOString() } },
      { status: 500 },
    );
  }
}
