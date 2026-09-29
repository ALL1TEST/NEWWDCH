import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, fail } from '@/lib/platform/platform-auth';

// ============================================================
// GET /api/public/pages/[slug] — PUBLIC single platform page
// for the marketing site.
// ============================================================

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    if (!slug) return fail('NOT_FOUND', 'Page slug is required', 400);

    const page = await db.contentItem.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        siteId: null,
        deletedAt: null,
        contentType: { slug: 'page' },
      },
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
        author: { select: { name: true } },
      },
    });

    if (!page) {
      return fail('NOT_FOUND', `Page with slug "${slug}" not found`, 404);
    }

    return ok({ page });
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message || 'Failed to fetch public page', 500);
  }
}
