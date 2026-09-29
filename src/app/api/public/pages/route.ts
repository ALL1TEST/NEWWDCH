import { db } from '@/lib/db';
import { ok, fail } from '@/lib/platform/platform-auth';

// ============================================================
// GET /api/public/pages — PUBLIC list of published platform pages
// for the marketing site.
// ============================================================
// Read-only, unauthenticated. Serves the platform's published
// pages (siteId: null, contentType: 'page').
// ============================================================

export async function GET() {
  try {
    const rows = await db.contentItem.findMany({
      where: {
        status: 'PUBLISHED',
        siteId: null,
        deletedAt: null,
        contentType: { slug: 'page' },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return ok({ pages: rows });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message || 'Failed to fetch public pages', 500);
  }
}
