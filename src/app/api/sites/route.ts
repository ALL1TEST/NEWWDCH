import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/platform/platform-auth';
import { checkLimit, limitExceededResponse } from '@/lib/platform/usage-limits';

// ============================================================
// GET /api/sites — List all sites (always, no siteId filter)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const sites = await db.site.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            contentItems: { where: { deletedAt: null } },
            media: true,
            categories: true,
            tags: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: sites,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        pagination: {
          page: 1,
          pageSize: sites.length,
          total: sites.length,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/sites error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SITES_FETCH_FAILED',
          message: 'Failed to fetch sites',
        },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 500 },
    );
  }
}

// ============================================================
// POST /api/sites — Create a new site
// ============================================================

export async function POST(request: NextRequest) {
  // Server-side plan-limit enforcement: the user's plan must permit
  // another site (e.g. Beta = max 3 sites). A Beta customer who already
  // owns 3 sites is blocked here with an actionable upgrade message.
  const auth = await requireAuth(request);
  if ('response' in auth) return auth.response;
  const limit = checkLimit(auth.user, 'sites', 1);
  if (!limit.ok) return limitExceededResponse(limit);
  try {
    const body = await request.json();
    const { name, slug, domain, description, logo, favicon } = body;

    if (!name || !slug) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name and slug are required',
          },
          meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        },
        { status: 400 },
      );
    }

    // Check slug uniqueness
    const existing = await db.site.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: 'SLUG_TAKEN',
            message: `A site with slug "${slug}" already exists`,
          },
          meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
        },
        { status: 409 },
      );
    }

    const site = await db.site.create({
      data: {
        name,
        slug,
        domain: domain || null,
        description: description || null,
        logo: logo || null,
        favicon: favicon || null,
        config: JSON.stringify({
          theme: { primaryColor: '#000000' },
          seo: {
            defaultTitle: name,
            titleTemplate: '%s | ' + name,
          },
        }),
      },
      include: {
        _count: {
          select: {
            contentItems: true,
            media: true,
            categories: true,
            tags: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: site,
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/sites error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SITE_CREATE_FAILED',
          message: 'Failed to create site',
        },
        meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 500 },
    );
  }
}
